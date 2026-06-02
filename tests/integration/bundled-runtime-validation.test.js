#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
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
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-bundled-validation-"));
  const modelPath = path.join(workspaceRoot, "models", "validation-Q4_K_M.gguf");
  await fsp.mkdir(path.dirname(modelPath), { recursive: true });
  await fsp.writeFile(modelPath, Buffer.alloc(4096, 9));

  try {
    const result = await runValidation({
      ...process.env,
      AGENTTRAIL_BUNDLED_RUNTIME_MODULE: "tests/fixtures/mock-bundled-runtime.js",
      AGENTTRAIL_GGUF_MODEL: modelPath,
      AGENTTRAIL_BUNDLED_MODEL_NAME: "validation-gguf",
      AGENTTRAIL_ACCELERATION_BACKEND: "cpu",
      AGENTTRAIL_BUNDLED_GPU_LAYERS: "0",
      AGENTTRAIL_BUNDLED_SPECULATIVE: "ngram-simple",
      AGENTTRAIL_BUNDLED_PREFILL_REUSE: "on",
      AGENTTRAIL_BUNDLED_PREFILL_MIN_SHARED_CHARS: "12"
    });
    assert.equal(result.ok, true);
    assert.equal(result.schema, "agenttrail.bundled-runtime-validation.v1");
    assert.equal(result.provider, "custom-module");
    assert.equal(result.generation.streamed, true);
    assert.match(result.generation.text, /speculative bundled runtime ok/);
    assert.equal(result.generation.speculative.enabled, true);
    assert.equal(result.embedding.dimensions, 4);
    assert.equal(result.prefill.enabled, true);
    assert.equal(result.loading.quantization.value, "Q4_K_M");
    assert.equal(result.hardware.selectedBackend, "cpu");

    console.log("Bundled runtime validation test passed");
  } finally {
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function runValidation(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/validate-bundled-runtime.js"], {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`validation exited ${code}\n${stderr}\n${stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`validation did not return JSON: ${error.message}\n${stdout}\n${stderr}`));
      }
    });
  });
}
