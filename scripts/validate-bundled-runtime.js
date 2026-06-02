#!/usr/bin/env node

"use strict";

const {
  bundledRuntimeStatus,
  generateBundledText,
  embedBundledText
} = require("../src/bundled-runtime");
const { estimateTokens, tokensPerSecond } = require("../src/runtime-loading");

const MODEL = process.env.AGENTTRAIL_BUNDLED_MODEL_NAME || process.env.OLLAMA_MODEL || "bundled-gguf";
const PROMPT = process.env.AGENTTRAIL_RUNTIME_VALIDATE_PROMPT || "Reply with exactly: bundled runtime ok";
const EMBED_INPUT = process.env.AGENTTRAIL_RUNTIME_VALIDATE_EMBED_INPUT || "bundled runtime embedding check";

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  const projectRoot = process.cwd();
  const status = await bundledRuntimeStatus(process.env, projectRoot, MODEL);
  if (!status.available) {
    throw new Error(status.reason);
  }

  const streamed = [];
  const startedAtMs = Date.now();
  const text = await generateBundledText({
    env: process.env,
    projectRoot,
    model: MODEL,
    prompt: PROMPT,
    options: { temperature: 0, num_predict: Number(process.env.AGENTTRAIL_RUNTIME_VALIDATE_TOKENS || 64) },
    onToken: (token) => streamed.push(String(token || ""))
  });
  const endedAtMs = Date.now();
  const embedding = await embedBundledText({
    env: process.env,
    projectRoot,
    model: MODEL,
    input: EMBED_INPUT
  });

  const report = {
    schema: "agenttrail.bundled-runtime-validation.v1",
    ok: true,
    provider: status.provider,
    module: status.module,
    model: status.modelName,
    modelPath: status.model.path,
    generation: {
      streamed: streamed.length > 0,
      chunks: streamed.length,
      text,
      outputTokens: estimateTokens(text),
      durationMs: endedAtMs - startedAtMs,
      tokensPerSecond: tokensPerSecond(text, startedAtMs, endedAtMs),
      speculative: status.loading.speculative
    },
    embedding: {
      dimensions: embedding.length,
      sample: embedding.slice(0, 8)
    },
    prefill: status.loading.prefill,
    loading: {
      quantization: status.loading.quantization,
      kvCache: status.loading.kvCache,
      batching: status.loading.batching
    },
    hardware: {
      selectedBackend: status.hardware.selectedBackend,
      threads: status.hardware.threading.effective,
      gpuLayers: status.hardware.offload.loadValue
    }
  };
  console.log(JSON.stringify(report, null, 2));
}
