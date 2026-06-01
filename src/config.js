"use strict";

const path = require("node:path");

const CONFIG_STATUS_SCHEMA = "agenttrail.config-status.v1";
const MODEL_ADAPTERS = new Set(["ollama", "lmstudio", "llamacpp", "openai-compatible", "bundled"]);
const BOOL_VALUES = new Set(["on", "off", "true", "false", "1", "0", "yes", "no"]);

function hasOwn(env, key) {
  return Object.prototype.hasOwnProperty.call(env || {}, key);
}

function envValue(env, key, fallback) {
  return hasOwn(env, key) ? env[key] : fallback;
}

function numericEnv(env, key, fallback) {
  return Number(envValue(env, key, fallback));
}

function makeCheck(id, ok, message, action, extra = {}) {
  return {
    id,
    ok: Boolean(ok),
    severity: ok ? "ok" : (extra.severity || "error"),
    message,
    action,
    ...extra
  };
}

function validHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function optionalHttpUrl(env, key) {
  return !hasOwn(env, key) || !String(env[key] || "").trim() || validHttpUrl(env[key]);
}

function numberRangeCheck(env, key, fallback, min, max, label, action, integer = true) {
  const value = numericEnv(env, key, fallback);
  const ok = Number.isFinite(value) && (!integer || Number.isInteger(value)) && value >= min && value <= max;
  return makeCheck(
    key.toLowerCase().replace(/_/g, "-"),
    ok,
    `${key} must be ${integer ? "an integer" : "a number"} between ${min} and ${max}.`,
    action || `Set ${key} to a safe ${label || "value"}.`,
    { env: key, value: String(envValue(env, key, fallback)), category: "config" }
  );
}

function validateConfig(env = process.env, options = {}) {
  const port = numericEnv(env, "PORT", 4173);
  const maxToolIterations = numericEnv(env, "MAX_TOOL_ITERATIONS", 4);
  const maxToolCalls = numericEnv(env, "MAX_TOOL_CALLS_PER_STEP", 6);
  const defaultStepBudget = numericEnv(env, "AGENTTRAIL_DEFAULT_STEP_BUDGET", Math.min(3, maxToolIterations || 4));
  const maxPromptChars = numericEnv(env, "AGENTTRAIL_MAX_PROMPT_CHARS", 24000);
  const memoryPromptChars = numericEnv(env, "AGENTTRAIL_MEMORY_PROMPT_CHARS", Math.floor(maxPromptChars * 0.16));
  const rawMemoryPromptChars = numericEnv(env, "AGENTTRAIL_RAW_MEMORY_PROMPT_CHARS", Math.min(1200, Math.floor(memoryPromptChars * 0.5)));
  const modelAdapter = String(envValue(env, "AGENTTRAIL_MODEL_ADAPTER", "ollama") || "").trim().toLowerCase();
  const host = String(envValue(env, "HOST", "127.0.0.1") || "").trim();
  const workspaceRoot = String(envValue(env, "WORKSPACE_ROOT", options.workspaceRoot || "workspace") || "").trim();
  const workspaceAbsolute = workspaceRoot ? path.resolve(workspaceRoot) : "";
  const workspaceIsRoot = workspaceAbsolute && workspaceAbsolute === path.parse(workspaceAbsolute).root;

  const checks = [
    makeCheck(
      "port",
      Number.isInteger(port) && port > 0 && port < 65536,
      "PORT must be a valid TCP port.",
      "Use a port between 1 and 65535, for example PORT=4173.",
      { env: "PORT", value: String(envValue(env, "PORT", 4173)), category: "host" }
    ),
    makeCheck(
      "host",
      Boolean(host) && !/\s/.test(host),
      "HOST must be a non-empty host name or IP address.",
      "Use HOST=127.0.0.1 for local-only access.",
      { env: "HOST", value: host || "(empty)", category: "host" }
    ),
    makeCheck(
      "workspace-root",
      Boolean(workspaceRoot) && !workspaceIsRoot,
      "WORKSPACE_ROOT must point to a project folder, not the filesystem root.",
      "Set WORKSPACE_ROOT to a dedicated folder such as ./workspace.",
      { env: "WORKSPACE_ROOT", value: workspaceRoot || "(empty)", category: "host" }
    ),
    makeCheck(
      "model-adapter",
      MODEL_ADAPTERS.has(modelAdapter),
      "AGENTTRAIL_MODEL_ADAPTER must be ollama, lmstudio, llamacpp, openai-compatible, or bundled.",
      "Choose a supported local backend adapter.",
      { env: "AGENTTRAIL_MODEL_ADAPTER", value: modelAdapter || "(empty)", category: "model" }
    ),
    makeCheck(
      "ollama-host",
      validHttpUrl(envValue(env, "OLLAMA_HOST", "http://127.0.0.1:11434")),
      "OLLAMA_HOST must start with http:// or https://.",
      "Set OLLAMA_HOST=http://127.0.0.1:11434 unless Ollama runs elsewhere.",
      { env: "OLLAMA_HOST", value: String(envValue(env, "OLLAMA_HOST", "http://127.0.0.1:11434")), category: "model" }
    ),
    makeCheck(
      "lmstudio-host",
      optionalHttpUrl(env, "LMSTUDIO_HOST"),
      "LMSTUDIO_HOST must start with http:// or https:// when set.",
      "Use LMSTUDIO_HOST=http://127.0.0.1:1234 for LM Studio.",
      { env: "LMSTUDIO_HOST", value: String(envValue(env, "LMSTUDIO_HOST", "")), category: "model" }
    ),
    makeCheck(
      "llamacpp-host",
      optionalHttpUrl(env, "LLAMACPP_HOST"),
      "LLAMACPP_HOST must start with http:// or https:// when set.",
      "Use LLAMACPP_HOST=http://127.0.0.1:8080 for llama.cpp server.",
      { env: "LLAMACPP_HOST", value: String(envValue(env, "LLAMACPP_HOST", "")), category: "model" }
    ),
    makeCheck(
      "openai-compatible-host",
      optionalHttpUrl(env, "OPENAI_COMPATIBLE_HOST"),
      "OPENAI_COMPATIBLE_HOST must start with http:// or https:// when set.",
      "Use a local OpenAI-compatible endpoint such as http://127.0.0.1:8000/v1.",
      { env: "OPENAI_COMPATIBLE_HOST", value: String(envValue(env, "OPENAI_COMPATIBLE_HOST", "")), category: "model" }
    ),
    makeCheck(
      "model",
      Boolean(String(envValue(env, "OLLAMA_MODEL", "llama3.2")).trim()),
      "OLLAMA_MODEL must not be empty.",
      "Set OLLAMA_MODEL to an installed local model, for example llama3.2.",
      { env: "OLLAMA_MODEL", value: String(envValue(env, "OLLAMA_MODEL", "llama3.2")), category: "model" }
    ),
    makeCheck(
      "embedding-model",
      Boolean(String(envValue(env, "OLLAMA_EMBED_MODEL", "nomic-embed-text")).trim()),
      "OLLAMA_EMBED_MODEL must not be empty.",
      "Set OLLAMA_EMBED_MODEL=nomic-embed-text or another installed embedding model.",
      { env: "OLLAMA_EMBED_MODEL", value: String(envValue(env, "OLLAMA_EMBED_MODEL", "nomic-embed-text")), category: "model" }
    ),
    makeCheck(
      "native-tools",
      BOOL_VALUES.has(String(envValue(env, "AGENTTRAIL_NATIVE_TOOLS", "on")).trim().toLowerCase()),
      "AGENTTRAIL_NATIVE_TOOLS must be on or off.",
      "Use AGENTTRAIL_NATIVE_TOOLS=on unless your backend needs prompt-JSON fallback.",
      { env: "AGENTTRAIL_NATIVE_TOOLS", value: String(envValue(env, "AGENTTRAIL_NATIVE_TOOLS", "on")), category: "model" }
    ),
    makeCheck(
      "cache-enabled",
      BOOL_VALUES.has(String(envValue(env, "AGENTTRAIL_CACHE", "on")).trim().toLowerCase()),
      "AGENTTRAIL_CACHE must be on or off.",
      "Use AGENTTRAIL_CACHE=on for faster repeated local prompts.",
      { env: "AGENTTRAIL_CACHE", value: String(envValue(env, "AGENTTRAIL_CACHE", "on")), category: "cache" }
    ),
    numberRangeCheck(env, "AGENTTRAIL_CACHE_TTL_MS", 300000, 1000, 86400000, "cache TTL", "Use a cache TTL between 1000 and 86400000 milliseconds."),
    numberRangeCheck(env, "AGENTTRAIL_TOOL_CAPABILITY_TTL_MS", 600000, 1000, 86400000, "tool capability TTL", "Use a tool capability cache TTL between 1000 and 86400000 milliseconds."),
    numberRangeCheck(env, "MAX_TOOL_ITERATIONS", 4, 1, 20, "tool iteration budget", "Use MAX_TOOL_ITERATIONS between 1 and 20."),
    numberRangeCheck(env, "MAX_TOOL_CALLS_PER_STEP", 6, 1, 20, "tool-call budget", "Use MAX_TOOL_CALLS_PER_STEP between 1 and 20."),
    makeCheck(
      "default-step-budget",
      Number.isInteger(defaultStepBudget) && defaultStepBudget >= 1 && defaultStepBudget <= Math.max(1, maxToolIterations || 1),
      "AGENTTRAIL_DEFAULT_STEP_BUDGET must be between 1 and MAX_TOOL_ITERATIONS.",
      "Keep the default step budget below or equal to the max tool iterations.",
      { env: "AGENTTRAIL_DEFAULT_STEP_BUDGET", value: String(envValue(env, "AGENTTRAIL_DEFAULT_STEP_BUDGET", Math.min(3, maxToolIterations || 4))), category: "budget" }
    ),
    numberRangeCheck(env, "AGENTTRAIL_MAX_PROMPT_CHARS", 24000, 4000, 500000, "prompt budget", "Use AGENTTRAIL_MAX_PROMPT_CHARS between 4000 and 500000."),
    makeCheck(
      "memory-prompt-budget",
      Number.isInteger(memoryPromptChars) && memoryPromptChars >= 240 && memoryPromptChars <= Math.max(240, maxPromptChars || 240),
      "AGENTTRAIL_MEMORY_PROMPT_CHARS must be between 240 and AGENTTRAIL_MAX_PROMPT_CHARS.",
      "Lower memory prompt chars or raise the max prompt budget.",
      { env: "AGENTTRAIL_MEMORY_PROMPT_CHARS", value: String(envValue(env, "AGENTTRAIL_MEMORY_PROMPT_CHARS", Math.floor(maxPromptChars * 0.16))), category: "budget" }
    ),
    makeCheck(
      "raw-memory-prompt-budget",
      Number.isInteger(rawMemoryPromptChars) && rawMemoryPromptChars >= 240 && rawMemoryPromptChars <= Math.max(240, memoryPromptChars || 240),
      "AGENTTRAIL_RAW_MEMORY_PROMPT_CHARS must be between 240 and AGENTTRAIL_MEMORY_PROMPT_CHARS.",
      "Keep raw memory smaller than the structured memory prompt budget.",
      { env: "AGENTTRAIL_RAW_MEMORY_PROMPT_CHARS", value: String(envValue(env, "AGENTTRAIL_RAW_MEMORY_PROMPT_CHARS", Math.min(1200, Math.floor(memoryPromptChars * 0.5)))), category: "budget" }
    ),
    numberRangeCheck(env, "AGENTTRAIL_MAX_CONCURRENCY", 4, 1, 32, "concurrency", "Use AGENTTRAIL_MAX_CONCURRENCY between 1 and 32."),
    numberRangeCheck(env, "AGENTTRAIL_MAX_QUEUE", 64, 0, 1024, "queue depth", "Use AGENTTRAIL_MAX_QUEUE between 0 and 1024."),
    numberRangeCheck(env, "AGENTTRAIL_BACKEND_RETRIES", 2, 0, 5, "retry attempts", "Use AGENTTRAIL_BACKEND_RETRIES between 0 and 5."),
    numberRangeCheck(env, "AGENTTRAIL_BACKEND_RETRY_BASE_MS", 120, 10, 2000, "retry base delay", "Use AGENTTRAIL_BACKEND_RETRY_BASE_MS between 10 and 2000."),
    numberRangeCheck(env, "AGENTTRAIL_RUN_TIMEOUT_MS", 120000, 100, 1800000, "run timeout", "Use AGENTTRAIL_RUN_TIMEOUT_MS between 100 and 1800000 milliseconds."),
    numberRangeCheck(env, "AGENTTRAIL_BACKEND_STREAM_TIMEOUT_MS", 120000, 100, 1800000, "backend stream timeout", "Use AGENTTRAIL_BACKEND_STREAM_TIMEOUT_MS between 100 and 1800000 milliseconds."),
    numberRangeCheck(env, "AGENTTRAIL_MIN_FREE_BYTES", 64 * 1024 * 1024, 0, Number.MAX_SAFE_INTEGER, "minimum free bytes", "Use a non-negative disk-space guard.", false),
    numberRangeCheck(env, "AGENTTRAIL_MODEL_PULL_MIN_FREE_BYTES", 512 * 1024 * 1024, 0, Number.MAX_SAFE_INTEGER, "model-pull free bytes", "Use a non-negative model-pull disk guard.", false)
  ];

  const failed = checks.filter((check) => !check.ok);
  const appliedWorkspaceKeys = Array.isArray(options.appliedWorkspaceKeys) ? options.appliedWorkspaceKeys : [];
  return {
    schema: CONFIG_STATUS_SCHEMA,
    ok: failed.length === 0,
    status: failed.length === 0 ? "ready" : "needs-attention",
    summary: failed.length === 0
      ? "Configuration is ready."
      : `${failed.length} configuration issue${failed.length === 1 ? "" : "s"} need attention.`,
    friendlySummary: failed.length === 0
      ? "AgentTrail config is ready."
      : failed.map((check) => `${check.message} ${check.action}`).join(" "),
    checks,
    failed,
    actions: failed.map((check) => ({ id: check.id, env: check.env, message: check.message, action: check.action })),
    appliedWorkspaceKeys
  };
}

function formatConfigWarnings(status) {
  const failed = (status && Array.isArray(status.failed) ? status.failed : (status?.checks || []).filter((check) => !check.ok));
  if (!failed.length) {
    return "";
  }
  return failed.map((check) => `${check.env || check.id}: ${check.message} ${check.action || ""}`.trim()).join("\n");
}

module.exports = {
  CONFIG_STATUS_SCHEMA,
  formatConfigWarnings,
  validateConfig
};
