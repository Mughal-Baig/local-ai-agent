#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 8800 + Math.floor(Math.random() * 100);
const mockPort = 9000 + Math.floor(Math.random() * 100);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const capturedPrompts = [];
  const mock = startMockOpenAI(mockPort, capturedPrompts);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-memory-retrieval-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_CACHE: "off",
      AGENTTRAIL_MEMORY_PROMPT_CHARS: "420",
      AGENTTRAIL_RAW_MEMORY_PROMPT_CHARS: "240"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));

  try {
    await waitForServer(() => output);
    await postJson("/api/memory", {
      content: [
        "# Project Memory",
        "",
        "## Facts",
        "- AgentTrail stores receipts locally.",
        "- The launch site uses warm UI copy.",
        "",
        "## Preferences",
        "- Prefer preview-first writes before applying changes.",
        "- Always archive release screenshots after a demo.",
        "",
        "## Decisions",
        "- Use structured memory JSON for future agent context.",
        "- Ship desktop packaging only after tests pass."
      ].join("\n")
    });

    const retrieval = await getJson("/api/memory/retrieve?query=preview%20writes&budget=260");
    assert.equal(retrieval.schema, "agenttrail.memory-retrieval.v1");
    assert.equal(retrieval.selected.length >= 1, true);
    assert.match(retrieval.selected[0].text, /preview-first writes/);
    assert.equal(retrieval.selected[0].matches.includes("preview"), true);
    assert.equal(retrieval.usedChars <= retrieval.budgetChars + 1, true);

    await streamChat({
      model: "mock-model",
      messages: [{ role: "user", content: "Before editing, remember my preview write preference." }],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true,
      stepBudget: { maxSteps: 2, override: false }
    });

    const prompt = capturedPrompts.join("\n");
    assert.match(prompt, /Ranked structured memory/);
    assert.match(prompt, /Prefer preview-first writes before applying changes/);
    assert.match(prompt, /used \d+\/420 chars/);

    console.log("Memory retrieval integration test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOpenAI(port, capturedPrompts) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, { object: "list", data: [{ id: "mock-model", object: "model" }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      const messages = JSON.stringify(body.messages || []);
      if (messages.includes("Capability probe")) {
        return json(res, { error: "tools unsupported for memory retrieval test" }, 400);
      }
      capturedPrompts.push(messages);
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Final answer." } }] })}\n\n`);
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
  await response.text();
}

async function getJson(endpoint) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function postJson(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${agentPort}/api/status`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
