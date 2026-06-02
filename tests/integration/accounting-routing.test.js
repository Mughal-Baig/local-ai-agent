#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const mock = await startMockOpenAI();
  const mockPort = mock.address().port;
  const agentPort = await reservePort();
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-accounting-routing-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_NATIVE_TOOLS: "off",
      AGENTTRAIL_CACHE: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(agentPort, () => output);

    const preview = await postJson(agentPort, "/api/accounting/routing", {
      model: "__auto__",
      routing: { auto: true, strategy: "speculative" },
      messages: [{ role: "user", content: "Fix a JavaScript bug and verify the diff." }],
      selectedFiles: ["server.js"]
    });
    assert.equal(preview.route.speculative, true);
    assert.equal(preview.route.verifyModel, "qwen2.5-coder:7b");

    const events = await streamChat(agentPort);
    const routing = events.find((item) => item.event === "routing");
    const verification = events.find((item) => item.event === "verification");
    const accounting = events.find((item) => item.event === "accounting");
    assert.equal(routing.data.strategy, "draft-then-verify");
    assert.equal(verification.data.verifyModel, "qwen2.5-coder:7b");
    assert.equal(accounting.data.schema, "agenttrail.usage-record.v1");
    assert.equal(accounting.data.totalTokens > 0, true);

    const usage = await getJson(agentPort, "/api/accounting/usage");
    assert.equal(usage.schema, "agenttrail.usage-dashboard.v1");
    assert.equal(usage.totals.count >= 1, true);
    assert.equal(usage.byModel.length >= 1, true);

    const recipes = await getJson(agentPort, "/api/recipes");
    const coder = recipes.recipes.find((recipe) => recipe.id === "diff-safe-coder");
    assert.equal(coder.defaultModel, "qwen2.5-coder:7b");

    console.log("Accounting routing integration test passed");
  } finally {
    child.kill("SIGTERM");
    await closeServer(mock);
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function streamChat(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "__auto__",
      routing: { auto: true, strategy: "speculative" },
      budgetCaps: { profile: "standard" },
      messages: [{ role: "user", content: "Fix a JavaScript bug and verify the answer." }],
      selectedFiles: ["server.js"],
      permissions: {},
      securityMode: false
    })
  });
  assert.equal(response.ok, true, "chat request should succeed");
  return readEvents(await response.text());
}

function startMockOpenAI() {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, {
        object: "list",
        data: [
          { id: "tiny-fast", object: "model" },
          { id: "qwen2.5-coder:7b", object: "model" }
        ]
      });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      const text = body.model === "qwen2.5-coder:7b"
        ? "PASS verified by strong model."
        : "Draft answer from cheap model.";
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const token of text.split(/(\s+)/).filter(Boolean)) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    if (req.method === "POST" && req.url.startsWith("/v1/embeddings")) {
      return json(res, { data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }] });
    }
    json(res, { error: "not found" }, 404);
  });
  return listen(server, 0);
}

function readEvents(raw) {
  const events = [];
  let event = "message";
  for (const line of String(raw || "").split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("data:")) {
      continue;
    }
    events.push({ event, data: JSON.parse(line.slice(5).trim()) });
  }
  return events;
}

async function waitForServer(port, getOutput) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/accounting/usage`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not start.\n${getOutput()}`);
}

async function getJson(port, route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  assert.equal(response.ok, true, route);
  return response.json();
}

async function postJson(port, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, route);
  return response.json();
}

function json(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function reservePort() {
  const server = http.createServer();
  await listen(server, 0);
  const { port } = server.address();
  await closeServer(server);
  return port;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
