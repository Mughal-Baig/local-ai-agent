#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
let agentPort = 0;
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lA8t4wAAAABJRU5ErkJggg==";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = { requests: [] };
  agentPort = await getOpenPort();
  const mock = await startMockImageServer(state);
  const mockPort = mock.address().port;
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-image-gen-"));
  let output = "";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1",
      AGENTTRAIL_IMAGE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_IMAGE_BACKEND: "automatic1111"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(() => output);
    const routes = await get("/api/routes");
    assert.equal(routes.routes.some((route) => route.routes.includes("/api/images/generate")), true);

    const generated = await post("/api/images/generate", {
      prompt: "warm local AI agent dashboard icon",
      negativePrompt: "blur, watermark",
      width: 384,
      height: 320,
      steps: 8,
      seed: 1234,
      outputPath: "images/generated/dashboard-icon.png"
    });
    assert.equal(generated.ok, true);
    assert.equal(generated.backend, "automatic1111");
    assert.equal(generated.images.length, 1);
    assert.equal(generated.images[0].path, "images/generated/dashboard-icon.png");
    assert.equal(generated.images[0].mediaType, "image/png");
    assert.match(generated.images[0].imageUrl, /^\/api\/files\/raw\?path=/);
    assert.equal(generated.provenance.path, "images/generated/dashboard-icon.provenance.md");
    assert.equal(generated.progress.some((step) => step.id === "save-provenance"), true);

    assert.equal(state.requests.length, 1);
    assert.equal(state.requests[0].prompt, "warm local AI agent dashboard icon");
    assert.equal(state.requests[0].negative_prompt, "blur, watermark");
    assert.equal(state.requests[0].width, 384);
    assert.equal(state.requests[0].height, 320);
    assert.equal(state.requests[0].steps, 8);
    assert.equal(state.requests[0].seed, 1234);

    const rawImage = await rawRequest("GET", generated.images[0].imageUrl);
    assert.equal(rawImage.status, 200);
    assert.match(rawImage.headers["content-type"], /image\/png/);
    assert.equal(Buffer.from(rawImage.body).length > 20, true);

    const provenance = await get(`/api/files/content?path=${encodeURIComponent(generated.provenance.path)}`);
    assert.match(provenance.content, /AgentTrail Image Generation Provenance/);
    assert.match(provenance.content, /warm local AI agent dashboard icon/);
    assert.match(provenance.content, /Backend: automatic1111/);
    assert.match(provenance.content, /Seed: 1234/);

    console.log("Image generation integration test passed");
  } finally {
    child.kill();
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockImageServer(state) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url.startsWith("/sdapi/v1/txt2img")) {
      const body = JSON.parse(await readBody(req) || "{}");
      state.requests.push(body);
      return json(res, {
        images: [tinyPng],
        info: JSON.stringify({ seed: body.seed, all_seeds: [body.seed] })
      });
    }
    json(res, { error: "not found" }, 404);
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function getOpenPort() {
  const server = http.createServer();
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function get(route) {
  return request("GET", route);
}

function post(route, body) {
  return request("POST", route, body);
}

async function request(method, route, body) {
  const response = await rawRequest(method, route, body);
  assert.equal(response.status >= 200 && response.status < 300, true, `${method} ${route} -> ${response.status}: ${response.body.toString("utf8")}`);
  return JSON.parse(response.body.toString("utf8"));
}

function rawRequest(method, route, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request({
      hostname: "127.0.0.1",
      port: agentPort,
      path: route,
      method,
      headers: body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
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

async function waitForServer(getOutput) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    try {
      const response = await fetch(`http://127.0.0.1:${agentPort}/api/status`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Server did not start:\n${getOutput()}`);
}
