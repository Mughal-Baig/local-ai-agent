#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 6800 + Math.floor(Math.random() * 250);
let output = "";
let childExit = null;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-eval-quality-"));
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
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.once("exit", (code, signal) => {
    childExit = { code, signal };
  });

  try {
    await waitForServer();

    const quality = await get("/api/evals/agent-quality");
    assert.equal(quality.schema, "agenttrail.agent-quality-suite.v1");
    assert.equal(quality.current.schema, "agenttrail.agent-eval.v1");
    assert.equal(quality.current.total, 7);
    assert.equal(quality.current.score >= 85, true);
    assert.equal(quality.gate.ok, true);
    assert.equal(quality.saved.path.startsWith("evals/agent-quality-"), true);

    const history = await get("/api/evals/agent-quality/history");
    assert.equal(history.schema, "agenttrail.agent-quality-history.v1");
    assert.equal(history.history.length >= 1, true);

    const comparison = await post("/api/evals/agent-quality/compare", { models: ["agenttrail-audit", "loose-chat"] });
    assert.equal(comparison.schema, "agenttrail.agent-model-comparison.v1");
    assert.equal(comparison.models.length, 2);
    assert.equal(comparison.winner.model, "agenttrail-audit");

    const benchmark = await get("/api/benchmarks/models?models=agenttrail-audit,agenttrail-fast");
    assert.equal(benchmark.schema, "agenttrail.agent-model-benchmark.v1");
    assert.equal(benchmark.models.length, 2);
    assert.equal(benchmark.models.every((model) => model.avgTokensPerSecond > 0), true);

    console.log("Eval quality integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (childExit) {
      throw new Error(`Server exited before startup: ${JSON.stringify(childExit)}\n${output}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not start.\n${output}`);
}

async function get(endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function post(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}
