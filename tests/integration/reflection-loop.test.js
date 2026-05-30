#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 8100 + Math.floor(Math.random() * 100);
const mockPort = 8300 + Math.floor(Math.random() * 100);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = { reflectionRequests: 0, loopRequests: 0 };
  const mock = startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-reflection-loop-"));
  await fsp.writeFile(path.join(workspaceRoot, "notes.md"), "Reflection and loop fixture.\n", "utf8");

  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_CACHE: "off",
      AGENTTRAIL_DEFAULT_STEP_BUDGET: "3",
      MAX_TOOL_ITERATIONS: "3"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);

    const reflected = await streamChat({
      model: "mock-model",
      messages: [{ role: "user", content: "Give a direct final answer about workspace safety." }],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true,
      stepBudget: { maxSteps: 3, override: false }
    });
    const reflection = reflected.find((item) => item.event === "reflection");
    assert.equal(Boolean(reflection), true, "final answers should emit a reflection event");
    assert.equal(reflection.data.schema, "agenttrail.run-reflection.v1");
    assert.equal(reflection.data.verdict, "pass");
    assert.equal(reflection.data.checks.some((check) => check.id === "request-coverage" && check.ok), true);

    const looped = await streamChat({
      model: "mock-model",
      messages: [{ role: "user", content: "Repeat search loop until the guardrail catches it." }],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true,
      stepBudget: { maxSteps: 3, override: true }
    });
    assert.equal(looped.filter((item) => item.event === "tool").length, 1, "duplicate tool batch should not execute twice");
    assert.equal(looped.some((item) => item.event === "guardrail" && item.data.reason === "loop-detected"), true);
    assert.equal(looped.some((item) => item.event === "done" && item.data.reason === "loop-detected"), true);
    assert.equal(state.loopRequests >= 2, true, "mock should have been asked twice before loop abort");

    console.log("Reflection and loop guard integration test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOpenAI(port, state) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, { object: "list", data: [{ id: "mock-model", object: "model" }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      const messages = JSON.stringify(body.messages || []);

      if (messages.includes("Capability probe")) {
        return json(res, { error: "tools unsupported for reflection test" }, 400);
      }

      res.writeHead(200, { "Content-Type": "text/event-stream" });
      if (messages.includes("direct final answer")) {
        state.reflectionRequests += 1;
        streamTokens(res, ["Direct ", "final ", "answer ", "about ", "workspace ", "safety."]);
        return;
      }

      state.loopRequests += 1;
      const toolJson = JSON.stringify({ tool: "search_workspace", arguments: { query: "Reflection", limit: 1 } });
      streamTokens(res, [toolJson]);
      return;
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

function streamTokens(res, tokens) {
  for (const token of tokens) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

function json(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function streamChat(body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, "chat request should succeed");
  const raw = await response.text();
  const events = [];
  let event = "message";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("data:")) continue;
    events.push({ event, data: JSON.parse(line.slice(5).trim()) });
  }
  return events;
}

async function waitForServer(port, getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
