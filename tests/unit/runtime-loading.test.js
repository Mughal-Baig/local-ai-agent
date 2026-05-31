#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  runtimeLoadingConfig,
  detectModelQuantization,
  resolveKvCachePolicy,
  resolveBatchPolicy,
  resolveMmapPolicy,
  resolveShardingPolicy,
  estimateTokens,
  tokensPerSecond
} = require("../../src/runtime-loading");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const q4 = detectModelQuantization("/models/llama-3.2-8b-Q4_K_M.gguf", {});
  assert.equal(q4.value, "Q4_K_M");
  assert.equal(q4.bits, 4);
  assert.equal(q4.memoryTier, "balanced");

  const override = detectModelQuantization("/models/model.gguf", { AGENTTRAIL_BUNDLED_QUANTIZATION: "Q8_0" });
  assert.equal(override.value, "Q8_0");
  assert.equal(override.source, "env");

  const kv = resolveKvCachePolicy({ AGENTTRAIL_CONTEXT_SHIFT_TOKENS: "1024" }, 8192, q4);
  assert.equal(kv.type, "q8_0");
  assert.equal(kv.shiftEnabled, true);
  assert.equal(kv.shiftTokens, 1024);

  const batch = resolveBatchPolicy({
    AGENTTRAIL_BUNDLED_BATCH_SIZE: "384",
    AGENTTRAIL_BUNDLED_UBATCH_SIZE: "96",
    AGENTTRAIL_BUNDLED_PARALLEL_SEQUENCES: "3"
  }, { selectedBackend: "cuda", threading: { effective: 8 } });
  assert.equal(batch.batchSize, 384);
  assert.equal(batch.microBatchSize, 96);
  assert.equal(batch.mode, "batched");

  const mmap = resolveMmapPolicy({ AGENTTRAIL_BUNDLED_MMAP: "off", AGENTTRAIL_BUNDLED_MLOCK: "on" });
  assert.equal(mmap.enabled, false);
  assert.equal(mmap.mlock, true);

  const sharding = resolveShardingPolicy({
    AGENTTRAIL_TENSOR_SPLIT: "0.6,0.4",
    AGENTTRAIL_GPU_DEVICES: "0,1",
    AGENTTRAIL_MAIN_GPU: "1"
  }, { selectedBackend: "cuda" });
  assert.equal(sharding.enabled, true);
  assert.deepEqual(sharding.tensorSplit, [0.6, 0.4]);
  assert.deepEqual(sharding.devices, ["0", "1"]);
  assert.equal(sharding.mainGpu, 1);

  const loading = runtimeLoadingConfig({
    AGENTTRAIL_BUNDLED_CONTEXT_SIZE: "12000",
    AGENTTRAIL_BUNDLED_GPU_LAYERS: "all",
    AGENTTRAIL_BUNDLED_BATCH_SIZE: "512",
    AGENTTRAIL_RUNTIME_BENCHMARK_TOKENS: "64"
  }, process.cwd(), "/models/agent-Q5_K_M.gguf", { selectedBackend: "metal", threading: { effective: 10 } });
  assert.equal(loading.contextSize, 12000);
  assert.equal(loading.quantization.value, "Q5");
  assert.equal(loading.batching.batchSize, 512);
  assert.equal(loading.mmap.enabled, true);
  assert.equal(loading.benchmark.targetTokens, 64);
  assert.equal(loading.loadOptions.useMmap, true);

  assert.equal(estimateTokens("abcd ".repeat(8)) > 0, true);
  assert.equal(tokensPerSecond("abcd ".repeat(8), 0, 1000) > 0, true);

  console.log("Runtime loading unit tests passed");
}
