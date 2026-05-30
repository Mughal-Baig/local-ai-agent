#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 7800 + Math.floor(Math.random() * 100);
const mockPort = 8000 + Math.floor(Math.random() * 100);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = {
    sawBudgetPrompt: false,
    longRequestStarted: false,
    longBackendClosed: false
  };
  const mock = startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-guardrails-"));
  await fsp.writeFile(path.join(workspaceRoot, "notes.md"), "Budget guardrail test fixture.\n", "utf8");

  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_CACHE: "off",
      AGENTTRAIL_DEFAULT_STEP_BUDGET: "1",
      MAX_TOOL_ITERATIONS: "2"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);

    const events = await streamChat({
      model: "mock-model",
      messages: [{ role: "user", content: "Search once, then keep searching until the budget stops you." }],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true,
      stepBudget: { maxSteps: 2, override: false }
    });
    assert.equal(state.sawBudgetPrompt, true, "prompt should carry the normalized tool step budget");
    const exhausted = events.find((item) => item.event === "budget" && item.data.exhausted);
    assert.equal(exhausted.data.maxSteps, 1);
    assert.equal(events.some((item) => item.event === "done" && item.data.reason === "step-budget-exhausted"), true);
    assert.match(events.map((item) => item.data.text || "").join(""), /step budget/i);

    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${agentPort}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mock-model",
        messages: [{ role: "user", content: "Start a long answer so the user can stop it." }],
        permissions: { readFiles: true, writeFiles: false, previewWrites: true },
        securityMode: true,
        stepBudget: { maxSteps: 2, override: true }
      }),
      signal: controller.signal
    });
    assert.equal(response.ok, true, "chat response should open");
    await waitUntil(() => state.longRequestStarted, "mock backend did not receive the long run");
    controller.abort();
    await waitUntil(() => state.longBackendClosed, "backend stream should close when the user stops the run");

    console.log("Run guardrails integration test passed");
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
        return json(res, { error: "tools unsupported for guardrail test" }, 400);
      }

      state.sawBudgetPrompt = state.sawBudgetPrompt || messages.includes("Tool step budget: 1");
      res.writeHead(200, { "Content-Type": "text/event-stream" });

      if (messages.includes("long answer")) {
        state.longRequestStarted = true;
        req.on("close", () => {
          state.longBackendClosed = true;
        });
        res.on("close", () => {
          state.longBackendClosed = true;
        });
        let sent = 0;
        const timer = setInterval(() => {
          sent += 1;
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `token-${sent} ` } }] })}\n\n`);
          if (sent > 200) {
            clearInterval(timer);
            res.write("data: [DONE]\n\n");
            res.end();
          }
        }, 20);
        res.on("close", () => clearInterval(timer));
        return;
      }

      const toolJson = JSON.stringify({ tool: "search_workspace", arguments: { query: "Budget", limit: 1 } });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: toolJson } }] })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
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
  await waitUntil(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      return response.ok;
    } catch {
      return false;
    }
  }, () => `Server did not start. Output:\n${getOutput()}`);
}

async function waitUntil(predicate, message) {
  for (let i = 0; i < 100; i += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(typeof message === "function" ? message() : message);
}
