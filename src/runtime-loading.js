"use strict";

const path = require("node:path");

const QUANT_PATTERNS = [
  { match: /IQ1[_-]S/i, value: "IQ1_S", bits: 1, family: "iq", memoryTier: "ultra-low", qualityTier: "experimental" },
  { match: /IQ2[_-][A-Z0-9]+/i, value: "IQ2", bits: 2, family: "iq", memoryTier: "ultra-low", qualityTier: "low" },
  { match: /Q2[_-][A-Z0-9]+/i, value: "Q2", bits: 2, family: "q", memoryTier: "ultra-low", qualityTier: "low" },
  { match: /Q3[_-][A-Z0-9]+/i, value: "Q3", bits: 3, family: "q", memoryTier: "low", qualityTier: "medium-low" },
  { match: /Q4[_-]K[_-]M/i, value: "Q4_K_M", bits: 4, family: "q", memoryTier: "balanced", qualityTier: "good" },
  { match: /Q4[_-][A-Z0-9]+/i, value: "Q4", bits: 4, family: "q", memoryTier: "balanced", qualityTier: "good" },
  { match: /Q5[_-][A-Z0-9]+/i, value: "Q5", bits: 5, family: "q", memoryTier: "medium", qualityTier: "very-good" },
  { match: /Q6[_-][A-Z0-9]+/i, value: "Q6", bits: 6, family: "q", memoryTier: "high", qualityTier: "high" },
  { match: /Q8[_-][A-Z0-9]+/i, value: "Q8", bits: 8, family: "q", memoryTier: "very-high", qualityTier: "near-float" },
  { match: /BF16/i, value: "BF16", bits: 16, family: "float", memoryTier: "max", qualityTier: "float" },
  { match: /F16/i, value: "F16", bits: 16, family: "float", memoryTier: "max", qualityTier: "float" },
  { match: /F32/i, value: "F32", bits: 32, family: "float", memoryTier: "max", qualityTier: "float" }
];

function runtimeLoadingConfig(env = process.env, projectRoot = process.cwd(), modelPath = "", hardware = {}) {
  const contextSize = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_BUNDLED_CONTEXT_SIZE", "OLLAMA_NUM_CTX"]), 8192);
  const quantization = detectModelQuantization(modelPath, env);
  const kvCache = resolveKvCachePolicy(env, contextSize, quantization);
  const prefill = resolvePrefillPolicy(env, contextSize);
  const speculative = resolveSpeculativePolicy(env, projectRoot);
  const batching = resolveBatchPolicy(env, hardware);
  const memoryMap = resolveMmapPolicy(env);
  const sharding = resolveShardingPolicy(env, hardware);
  const benchmark = runtimeBenchmarkPlan(env);

  return {
    schema: "agenttrail.runtime-loading.v1",
    quantization,
    contextSize,
    kvCache,
    prefill,
    speculative,
    batching,
    mmap: memoryMap,
    sharding,
    benchmark,
    loadOptions: {
      quantization: quantization.value,
      contextSize,
      batchSize: batching.batchSize,
      microBatchSize: batching.microBatchSize,
      useMmap: memoryMap.enabled,
      useMlock: memoryMap.mlock,
      splitMode: sharding.splitMode,
      tensorSplit: sharding.tensorSplit,
      mainGpu: sharding.mainGpu,
      prefill,
      speculative
    }
  };
}

function detectModelQuantization(modelPath = "", env = process.env) {
  const override = String(env.AGENTTRAIL_BUNDLED_QUANTIZATION || env.AGENTTRAIL_QUANTIZATION || "").trim();
  const sourceText = override || path.basename(String(modelPath || ""));
  const normalized = sourceText.replace(/\./g, "_");
  const found = QUANT_PATTERNS.find((item) => item.match.test(normalized));
  const value = override || (found && found.value) || "unknown";
  return {
    source: override ? "env" : found ? "filename" : "unknown",
    value,
    bits: found ? found.bits : null,
    family: found ? found.family : "unknown",
    memoryTier: found ? found.memoryTier : "unknown",
    qualityTier: found ? found.qualityTier : "unknown",
    detectedFrom: sourceText || ""
  };
}

function resolveKvCachePolicy(env, contextSize, quantization) {
  const cacheType = String(firstEnvValue(env, ["AGENTTRAIL_KV_CACHE_TYPE", "AGENTTRAIL_BUNDLED_KV_CACHE_TYPE"]) || defaultKvCacheType(quantization)).toLowerCase();
  const shiftMode = normalizeMode(firstEnvValue(env, ["AGENTTRAIL_CONTEXT_SHIFT", "AGENTTRAIL_BUNDLED_CONTEXT_SHIFT"]) || "auto", ["auto", "on", "off"]);
  const shiftEnabled = shiftMode === "on" || (shiftMode === "auto" && contextSize >= 4096);
  const rawShiftTokens = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_CONTEXT_SHIFT_TOKENS", "AGENTTRAIL_BUNDLED_CONTEXT_SHIFT_TOKENS"]), 0);
  const shiftTokens = shiftEnabled
    ? rawShiftTokens || Math.max(512, Math.floor(contextSize * 0.25))
    : 0;
  return {
    type: cacheType,
    shiftMode,
    shiftEnabled,
    shiftTokens,
    contextSize,
    reason: shiftEnabled
      ? `Context shifting enabled with ${shiftTokens} token window.`
      : "Context shifting disabled for this runtime config."
  };
}

function resolvePrefillPolicy(env, contextSize) {
  const mode = normalizeMode(firstEnvValue(env, ["AGENTTRAIL_PREFILL_REUSE", "AGENTTRAIL_BUNDLED_PREFILL_REUSE"]) || "on", ["on", "off"]);
  const prefixChars = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_PREFILL_PREFIX_CHARS", "AGENTTRAIL_BUNDLED_PREFILL_PREFIX_CHARS"]), Math.min(24000, Math.max(4096, contextSize * 3)));
  const minSharedChars = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_PREFILL_MIN_SHARED_CHARS", "AGENTTRAIL_BUNDLED_PREFILL_MIN_SHARED_CHARS"]), 1200);
  return {
    enabled: mode === "on",
    mode,
    strategy: "shared-prefix-preload",
    prefixChars,
    minSharedChars,
    reason: mode === "on"
      ? "Shared prompt prefixes are cached and preloaded when the bundled provider supports it."
      : "Shared prompt prefix reuse is disabled by config."
  };
}

function resolveSpeculativePolicy(env, projectRoot = process.cwd()) {
  const rawMode = String(firstEnvValue(env, ["AGENTTRAIL_SPECULATIVE_DECODING", "AGENTTRAIL_BUNDLED_SPECULATIVE"]) || "off").trim().toLowerCase();
  const enabled = !["", "0", "false", "no", "off", "none"].includes(rawMode);
  const draftModelPath = resolveRuntimePath(firstEnvValue(env, ["AGENTTRAIL_DRAFT_GGUF_MODEL", "AGENTTRAIL_BUNDLED_DRAFT_MODEL"]), projectRoot);
  const requestedType = firstEnvValue(env, ["AGENTTRAIL_SPECULATIVE_TYPE", "AGENTTRAIL_BUNDLED_SPECULATIVE_TYPE"]);
  const type = normalizeSpeculativeType(requestedType || (enabled && draftModelPath ? "draft-simple" : enabled ? rawMode : "none"));
  const draftTokens = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_SPECULATIVE_DRAFT_TOKENS", "AGENTTRAIL_BUNDLED_SPECULATIVE_DRAFT_TOKENS"]), 32);
  const ngramSize = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_SPECULATIVE_NGRAM_SIZE", "AGENTTRAIL_BUNDLED_SPECULATIVE_NGRAM_SIZE"]), 12);
  return {
    enabled,
    type: enabled ? type : "none",
    draftModelPath: enabled ? draftModelPath : "",
    draftTokens,
    ngramSize,
    provider: enabled ? "bundled-runtime" : "disabled",
    reason: enabled
      ? speculativeReason(type, draftModelPath)
      : "Speculative decoding is disabled by config.",
    loadOptions: {
      enabled,
      type: enabled ? type : "none",
      draftModelPath: enabled ? draftModelPath : "",
      draftTokens,
      ngramSize
    }
  };
}

function resolveBatchPolicy(env, hardware = {}) {
  const cpuThreads = hardware.threading && Number(hardware.threading.effective) > 0 ? Number(hardware.threading.effective) : 4;
  const defaultBatch = hardware.selectedBackend && hardware.selectedBackend !== "cpu" ? 512 : Math.max(64, Math.min(256, cpuThreads * 32));
  const batchSize = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_BUNDLED_BATCH_SIZE", "AGENTTRAIL_BATCH_SIZE"]), defaultBatch);
  const microBatchSize = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_BUNDLED_UBATCH_SIZE", "AGENTTRAIL_UBATCH_SIZE"]), Math.min(batchSize, 128));
  const parallelSequences = positiveNumber(firstEnvValue(env, ["AGENTTRAIL_BUNDLED_PARALLEL_SEQUENCES", "AGENTTRAIL_PARALLEL_SEQUENCES"]), 1);
  return {
    batchSize,
    microBatchSize,
    parallelSequences,
    mode: parallelSequences > 1 ? "batched" : "single-sequence",
    reason: parallelSequences > 1
      ? `${parallelSequences} parallel sequence(s) configured.`
      : "Single-sequence batching configured."
  };
}

function resolveMmapPolicy(env) {
  const enabled = boolFromEnv(firstEnvValue(env, ["AGENTTRAIL_BUNDLED_MMAP", "AGENTTRAIL_MMAP"]), true);
  const mlock = boolFromEnv(firstEnvValue(env, ["AGENTTRAIL_BUNDLED_MLOCK", "AGENTTRAIL_MLOCK"]), false);
  return {
    enabled,
    mlock,
    source: "env",
    reason: enabled
      ? "Memory-mapped model loading is enabled for faster startup."
      : "Memory-mapped model loading is disabled by config."
  };
}

function resolveShardingPolicy(env, hardware = {}) {
  const rawTensorSplit = String(firstEnvValue(env, ["AGENTTRAIL_TENSOR_SPLIT", "AGENTTRAIL_BUNDLED_TENSOR_SPLIT"]) || "").trim();
  const devices = parseDeviceList(firstEnvValue(env, ["AGENTTRAIL_GPU_DEVICES", "AGENTTRAIL_BUNDLED_GPU_DEVICES"]));
  const tensorSplit = parseTensorSplit(rawTensorSplit);
  const splitMode = String(firstEnvValue(env, ["AGENTTRAIL_GPU_SPLIT_MODE", "AGENTTRAIL_BUNDLED_SPLIT_MODE"]) || (tensorSplit.length ? "layer" : "none")).toLowerCase();
  const mainGpu = optionalInteger(firstEnvValue(env, ["AGENTTRAIL_MAIN_GPU", "AGENTTRAIL_BUNDLED_MAIN_GPU"]));
  const selectedBackend = hardware.selectedBackend || "cpu";
  const enabled = selectedBackend !== "cpu" && (tensorSplit.length > 1 || devices.length > 1);
  return {
    enabled,
    selectedBackend,
    splitMode,
    devices,
    tensorSplit,
    mainGpu,
    reason: enabled
      ? "Multi-GPU sharding policy is configured for the bundled provider."
      : "Multi-GPU sharding is inactive until multiple devices or tensor splits are configured."
  };
}

function runtimeBenchmarkPlan(env = process.env) {
  const prompt = String(env.AGENTTRAIL_RUNTIME_BENCHMARK_PROMPT || "Write one concise paragraph about local AI agents.");
  const targetTokens = positiveNumber(env.AGENTTRAIL_RUNTIME_BENCHMARK_TOKENS, 128);
  const runs = positiveNumber(env.AGENTTRAIL_RUNTIME_BENCHMARK_RUNS, 1);
  return {
    prompt,
    targetTokens,
    runs,
    compareToOllama: String(env.AGENTTRAIL_RUNTIME_BENCHMARK_OLLAMA || "on").toLowerCase() !== "off"
  };
}

function estimateTokens(text) {
  const value = String(text || "").trim();
  if (!value) return 0;
  return Math.max(1, Math.ceil(value.length / 4));
}

function tokensPerSecond(text, startedAtMs, endedAtMs) {
  const seconds = Math.max(0.001, (Number(endedAtMs) - Number(startedAtMs)) / 1000);
  return Number((estimateTokens(text) / seconds).toFixed(2));
}

function defaultKvCacheType(quantization) {
  if (quantization && quantization.bits !== null && quantization.bits <= 4) return "q8_0";
  return "f16";
}

function boolFromEnv(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseDeviceList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTensorSplit(value) {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0);
}

function firstEnvValue(env, keys) {
  for (const key of keys) {
    if (env[key] !== undefined && env[key] !== null && String(env[key]).trim() !== "") {
      return env[key];
    }
  }
  return "";
}

function positiveNumber(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
}

function optionalInteger(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

function normalizeMode(value, allowed) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : allowed[0];
}

function normalizeSpeculativeType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = {
    on: "ngram-simple",
    true: "ngram-simple",
    "1": "ngram-simple",
    draft: "draft-simple",
    ngram: "ngram-simple",
    "ngram-map": "ngram-map-k"
  };
  const candidate = aliases[normalized] || normalized;
  return [
    "draft-simple",
    "draft-mtp",
    "ngram-cache",
    "ngram-simple",
    "ngram-map-k",
    "ngram-map-k4v"
  ].includes(candidate) ? candidate : "ngram-simple";
}

function speculativeReason(type, draftModelPath) {
  if (type.startsWith("draft")) {
    return draftModelPath
      ? "Draft-model speculative decoding is requested for a compatible bundled runtime."
      : "Draft-model speculative decoding is requested; set AGENTTRAIL_DRAFT_GGUF_MODEL for runtimes that require a separate draft model.";
  }
  return "N-gram/self speculative decoding is requested for a compatible bundled runtime.";
}

function resolveRuntimePath(value, projectRoot) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

module.exports = {
  runtimeLoadingConfig,
  detectModelQuantization,
  resolveKvCachePolicy,
  resolvePrefillPolicy,
  resolveSpeculativePolicy,
  resolveBatchPolicy,
  resolveMmapPolicy,
  resolveShardingPolicy,
  runtimeBenchmarkPlan,
  estimateTokens,
  tokensPerSecond
};
