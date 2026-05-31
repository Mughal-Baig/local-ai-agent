#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 5850 + Math.floor(Math.random() * 120);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-ecosystem-api-"));
  const adapterPath = path.join(workspaceRoot, "demo-adapter.safetensors");
  const datasetPath = path.join(workspaceRoot, "train.jsonl");
  const ggufPath = path.join(workspaceRoot, "demo-Q4_K_M.gguf");
  const safetensorsPath = path.join(workspaceRoot, "demo.safetensors");
  await fsp.writeFile(adapterPath, "adapter");
  await fsp.writeFile(datasetPath, "{\"prompt\":\"hello\",\"completion\":\"world\"}\n");
  await fsp.writeFile(ggufPath, Buffer.alloc(4096, 7));
  await fsp.writeFile(safetensorsPath, Buffer.alloc(4096, 8));

  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(() => output);

    const adapter = await postJson("/api/model-ecosystem/adapters", {
      name: "demo/lora",
      baseModel: "tiny/q4",
      adapterPath,
      rank: 4,
      alpha: 8
    });
    assert.equal(adapter.ok, true);
    assert.equal(adapter.adapter.schema, "agenttrail.lora-adapter.v1");

    const training = await postJson("/api/model-ecosystem/fine-tune", {
      name: "demo-train",
      baseModel: "tiny/q4",
      datasetPath,
      method: "lora"
    });
    assert.equal(training.run.status, "planned");

    const quantize = await postJson("/api/model-ecosystem/quantize", {
      name: "demo-q5",
      sourcePath: ggufPath,
      quantization: "Q5_K_M"
    });
    assert.equal(quantize.job.quantization, "Q5_K_M");

    const conversion = await postJson("/api/model-ecosystem/convert", {
      name: "demo-gguf",
      sourcePath: safetensorsPath
    });
    assert.equal(conversion.conversion.sourceFormat, "safetensors");

    const evaluation = await postJson("/api/model-ecosystem/evaluate", {
      model: "tiny/q4"
    });
    assert.equal(evaluation.evaluation.schema, "agenttrail.model-eval-suite.v1");
    assert.equal(evaluation.evaluation.taskScores.length >= 5, true);

    const status = await getJson("/api/model-ecosystem");
    assert.equal(status.ok, true);
    assert.equal(status.ecosystem.adapters.length, 1);
    assert.equal(status.ecosystem.trainingRuns.length, 1);
    assert.equal(status.ecosystem.quantizationJobs.length, 1);
    assert.equal(status.ecosystem.conversions.length, 1);
    assert.equal(status.ecosystem.evaluations.length, 1);

    console.log("Model ecosystem integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function getJson(route) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${route}`);
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function postJson(route, body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${agentPort}/api/health`);
      if (response.ok) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
