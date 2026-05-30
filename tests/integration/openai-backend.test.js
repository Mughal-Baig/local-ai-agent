#!/usr/bin/env node

// Proves the pluggable OpenAI-compatible model backend works end to end:
// a mock OpenAI server stands in for LM Studio / llama.cpp / vLLM, and AgentTrail
// is started with AGENTTRAIL_MODEL_ADAPTER=openai-compatible pointed at it.

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 4700 + Math.floor(Math.random() * 200);
const mockPort = 4300 + Math.floor(Math.random() * 200);
const REPLY = "Hello from the OpenAI-compatible backend.";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const mock = startMockOpenAI(mockPort);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-openai-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);

    // Status should report the OpenAI-compatible backend and the mock model.
    const status = await fetchJson(`http://127.0.0.1:${agentPort}/api/status`);
    assert.equal(status.backend.api, "openai-compatible", "backend api should be openai-compatible");
    assert.equal(status.ollama.available, true, "mock backend should be reachable");
    assert.equal(status.ollama.models.some((m) => m.name === "mock-model"), true, "mock model should be listed");

    // Chat should round-trip through the mock /v1/chat/completions endpoint.
    const text = await streamChat(agentPort, "mock-model", "hello");
    assert.match(text, /OpenAI-compatible backend/, "assistant text should come from the mock backend");

    console.log("OpenAI-compatible backend test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOpenAI(port) {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, { object: "list", data: [{ id: "mock-model", object: "model" }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      // Stream the reply as Server-Sent Events, like a real OpenAI-compatible server.
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const word of REPLY.split(/(\s+)/)) {
        if (!word) continue;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    if (req.method === "POST" && req.url.startsWith("/v1/embeddings")) {
      return json(res, { data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }] });
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

function json(res, body, code = 200) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(payload);
}

async function streamChat(port, model, content) {
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      selectedFiles: [],
      permissions: {},
      securityMode: false
    })
  });
  assert.equal(response.ok, true, "chat request should succeed");
  const body = await response.text();
  let text = "";
  for (const line of body.split("\n")) {
    if (line.startsWith("data:")) {
      try {
        const data = JSON.parse(line.slice(5).trim());
        if (data && typeof data.text === "string") {
          text += data.text;
        }
      } catch {
        // ignore non-JSON data lines
      }
    }
  }
  return text;
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}

async function waitForServer(port, getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) {
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
