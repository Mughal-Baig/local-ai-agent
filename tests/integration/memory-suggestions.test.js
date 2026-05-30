#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 8700 + Math.floor(Math.random() * 100);
const mockPort = 8900 + Math.floor(Math.random() * 100);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const mock = startMockOpenAI(mockPort);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-memory-suggestions-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_CACHE: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));

  try {
    await waitForServer(() => output);
    const events = await streamChat({
      model: "mock-model",
      messages: [{ role: "user", content: "From now on prefer preview-first writes and remember the memory JSON decision." }],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true,
      stepBudget: { maxSteps: 3, override: false }
    });
    const memoryEvent = events.find((item) => item.event === "memory-suggestions");
    assert.equal(Boolean(memoryEvent), true, "chat should emit automatic memory suggestions");
    assert.equal(memoryEvent.data.schema, "agenttrail.memory-suggestions.v1");
    assert.equal(memoryEvent.data.suggestions.some((item) => item.type === "preference"), true);
    assert.equal(memoryEvent.data.suggestions.some((item) => item.type === "decision"), true);

    const applied = await postJson("/api/memory/suggestions/apply", {
      suggestions: memoryEvent.data.suggestions
    });
    assert.equal(applied.applied >= 2, true);
    assert.equal(applied.structured.memory.preferences.length >= 1, true);
    assert.equal(applied.structured.memory.decisions.length >= 1, true);

    const citations = await getJson("/api/memory/citations?query=preview");
    assert.equal(citations.citations.some((item) => item.path === "memory/project-memory.json"), true);

    console.log("Memory suggestions integration test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOpenAI(port) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, { object: "list", data: [{ id: "mock-model", object: "model" }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      const messages = JSON.stringify(body.messages || []);
      if (messages.includes("Capability probe")) {
        return json(res, { error: "tools unsupported for memory suggestion test" }, 400);
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const text = "Preference: Prefer preview-first writes. Decision: Use structured memory JSON for future agent context. AgentTrail stores memory locally.";
      for (const token of text.split(/(\s+)/).filter(Boolean)) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
      }
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
