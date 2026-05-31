#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 5700 + Math.floor(Math.random() * 300);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-observability-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let childOutput = "";
  child.stdout.on("data", (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { childOutput += chunk.toString(); });

  try {
    await waitForServer();
    const first = await get("/api/observability");
    assert.equal(first.schema, "agenttrail.observability.v1");
    assert.equal(first.analytics.schema, "agenttrail.local-analytics.v1");

    const stream = await rawPost("/api/chat", {
      model: "llama3.2",
      messages: [{ role: "user", content: "hello" }],
      selectedFiles: [],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true }
    });
    assert.match(stream.body, /event: trace/);
    assert.match(stream.body, /MODEL_BACKEND/);

    const after = await get("/api/observability");
    assert.equal(after.totals.runsStarted >= 1, true);
    assert.equal(after.totals.runsFailed >= 1, true);
    assert.equal(after.errorsByCode.MODEL_BACKEND >= 1, true);
    assert.equal(after.traces.some((trace) => trace.kind === "chat" && trace.status === "failed"), true);

    const metrics = await rawGet("/api/metrics");
    assert.match(metrics.body, /agenttrail_runs_started_total/);
    assert.match(metrics.body, /agenttrail_errors_total\{code="MODEL_BACKEND"\}/);

    const traces = await get("/api/traces");
    assert.equal(traces.schema, "agenttrail.traces.v1");
    const traceId = traces.traces[0].id;
    const trace = await get(`/api/traces/content?id=${encodeURIComponent(traceId)}`);
    assert.equal(trace.trace.id, traceId);
    assert.equal(Array.isArray(trace.trace.events), true);

    const taxonomy = await get("/api/errors/taxonomy");
    assert.equal(taxonomy.taxonomy.MODEL_BACKEND.category, "runtime");
    console.log("Observability integration test passed");
  } finally {
    child.kill();
  }

  function waitForServer() {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(async () => {
        if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error(`server did not start\n${childOutput}`));
          return;
        }
        try {
          await rawGet("/api/health");
          clearInterval(timer);
          resolve();
        } catch {
          // keep trying
        }
      }, 150);
    });
  }
}

async function get(endpoint) {
  const response = await rawGet(endpoint);
  assert.equal(response.status >= 200 && response.status < 300, true, endpoint);
  return JSON.parse(response.body);
}

function rawGet(endpoint) {
  return request("GET", endpoint);
}

function rawPost(endpoint, body) {
  return request("POST", endpoint, body);
}

function request(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: endpoint,
      method,
      headers: body ? {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      } : undefined
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
