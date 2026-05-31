#!/usr/bin/env node

// Proves in-app model management (list / pull-with-progress / delete) against a
// mock Ollama server, using the default native backend.

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 4760 + Math.floor(Math.random() * 120);
const ollamaPort = 4380 + Math.floor(Math.random() * 120);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const installed = new Set(["llama3.2", "llama3.2-vision"]);
  const mock = startMockOllama(ollamaPort, installed);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-models-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: `http://127.0.0.1:${ollamaPort}`
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);

    // List
    let list = await fetchJson(`http://127.0.0.1:${agentPort}/api/models`);
    assert.equal(list.canManage, true, "native backend should allow management");
    assert.equal(list.models.some((m) => m.name === "llama3.2"), true);
    const visionModel = list.models.find((m) => m.name === "llama3.2-vision");
    assert.equal(visionModel.capabilities.vision.supported, true, "vision model should be detected");
    assert.equal(visionModel.scores.vision >= 80, true, "vision score should be high");
    const textModel = list.models.find((m) => m.name === "llama3.2");
    assert.equal(textModel.capabilities.vision.supported, false, "text model should not be marked vision-ready");

    const heuristicVision = await fetchJson(`http://127.0.0.1:${agentPort}/api/models/vision-capability?model=llama3.2-vision`);
    assert.equal(heuristicVision.supported, true, "vision capability endpoint should expose heuristic support");
    const probedVision = await fetchJson(`http://127.0.0.1:${agentPort}/api/models/vision-capability?model=llama3.2-vision&refresh=1`);
    assert.equal(probedVision.supported, true, "vision probe should pass against mock vision model");
    assert.equal(probedVision.mode, "probe");
    const probedText = await fetchJson(`http://127.0.0.1:${agentPort}/api/models/vision-capability?model=llama3.2&refresh=1`);
    assert.equal(probedText.supported, false, "vision probe should fail against mock text model");

    // Pull (streamed progress + done)
    const pull = await streamPull(agentPort, "qwen2.5");
    assert.equal(pull.sawProgress, true, "pull should stream progress events");
    assert.equal(pull.done, true, "pull should finish with a done event");
    assert.equal(installed.has("qwen2.5"), true, "mock should have received the pull");

    list = await fetchJson(`http://127.0.0.1:${agentPort}/api/models`);
    assert.equal(list.models.some((m) => m.name === "qwen2.5"), true, "pulled model should now list");

    // Delete
    const del = await postJson(`http://127.0.0.1:${agentPort}/api/models/delete`, { name: "qwen2.5" });
    assert.equal(del.ok, true, "delete should succeed");
    assert.equal(installed.has("qwen2.5"), false, "mock should have removed the model");

    console.log("Model management test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOllama(port, installed) {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/tags")) {
      return json(res, {
        models: [...installed].map((name) => ({
          name,
          size: 1000,
          modified_at: null,
          details: { family: name.includes("vision") ? "llama-vision" : "llama" }
        }))
      });
    }
    if (req.method === "POST" && req.url.startsWith("/api/pull")) {
      readBody(req).then((body) => {
        const name = (body && body.name) || "unknown";
        res.writeHead(200, { "Content-Type": "application/x-ndjson" });
        res.write(JSON.stringify({ status: "pulling manifest" }) + "\n");
        res.write(JSON.stringify({ status: "downloading", total: 100, completed: 50 }) + "\n");
        res.write(JSON.stringify({ status: "downloading", total: 100, completed: 100 }) + "\n");
        res.write(JSON.stringify({ status: "success" }) + "\n");
        installed.add(name);
        res.end();
      });
      return;
    }
    if (req.method === "POST" && req.url.startsWith("/api/generate")) {
      readBody(req).then((body) => {
        const hasImage = Array.isArray(body.images) && body.images.length > 0;
        if (hasImage && !String(body.model || "").includes("vision")) {
          return json(res, { error: "model does not support images" }, 400);
        }
        json(res, { response: "OK" });
      });
      return;
    }
    if (req.method === "DELETE" && req.url.startsWith("/api/delete")) {
      readBody(req).then((body) => {
        const name = (body && body.name) || "";
        installed.delete(name);
        json(res, { status: "ok" });
      });
      return;
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); }
    });
  });
}

function json(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function streamPull(port, name) {
  const response = await fetch(`http://127.0.0.1:${port}/api/models/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  assert.equal(response.ok, true, "pull request should respond ok");
  const body = await response.text();
  let sawProgress = false;
  let done = false;
  let event = "message";
  for (const line of body.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) {
      if (event === "progress") sawProgress = true;
      if (event === "done") done = true;
    }
  }
  return { sawProgress, done };
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
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
