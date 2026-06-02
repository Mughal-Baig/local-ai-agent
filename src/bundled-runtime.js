"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { detectRuntimeHardware } = require("./runtime-hardware");
const { runtimeLoadingConfig } = require("./runtime-loading");

const DEFAULT_RUNTIME_MODULE = "node-llama-cpp";

const RUNTIME_STATE = {
  runtimeModuleKey: null,
  runtimeModule: null,
  sessionKey: null,
  llama: null,
  loadedModelPath: null,
  model: null,
  context: null,
  session: null,
  promptCompletionEngine: null,
  prefillCache: null
};

function bundledRuntimeConfig(env = process.env, projectRoot = process.cwd(), requestedModel = "") {
  const moduleId = String(env.AGENTTRAIL_BUNDLED_RUNTIME_MODULE || DEFAULT_RUNTIME_MODULE).trim();
  const hardware = detectRuntimeHardware(env);
  const modelPath = resolveBundledModelPath(
    requestedModel && looksLikeGgufPath(requestedModel) ? requestedModel : (env.AGENTTRAIL_GGUF_MODEL || env.AGENTTRAIL_BUNDLED_MODEL || ""),
    projectRoot
  );
  const modelName = String(env.AGENTTRAIL_BUNDLED_MODEL_NAME || (modelPath ? path.basename(modelPath) : requestedModel || "bundled-gguf")).trim();
  const loading = runtimeLoadingConfig(env, projectRoot, modelPath || modelName, hardware);
  return {
    schema: "agenttrail.bundled-runtime.v1",
    provider: moduleId === DEFAULT_RUNTIME_MODULE ? "node-llama-cpp" : "custom-module",
    module: moduleId,
    modelPath,
    modelName,
    contextSize: loading.contextSize,
    accelerationBackend: hardware.selectedBackend,
    gpuLayers: hardware.offload.loadValue,
    threads: hardware.threading.effective,
    batchSize: loading.batching.batchSize,
    embeddingModelPath: resolveBundledModelPath(env.AGENTTRAIL_BUNDLED_EMBED_MODEL || "", projectRoot),
    prefill: loading.prefill,
    speculative: loading.speculative,
    hardware,
    loading
  };
}

async function bundledRuntimeStatus(env = process.env, projectRoot = process.cwd(), requestedModel = "") {
  const config = bundledRuntimeConfig(env, projectRoot, requestedModel);
  const moduleResolution = resolveRuntimeModule(config.module, projectRoot);
  const model = await modelPathStatus(config.modelPath);
  const embeddingModel = await modelPathStatus(config.embeddingModelPath);
  const available = moduleResolution.installed && model.exists;
  return {
    ...config,
    moduleInstalled: moduleResolution.installed,
    modulePath: moduleResolution.path,
    moduleError: moduleResolution.error || null,
    model,
    embeddingModel,
    available,
    reason: available
      ? "Bundled runtime is ready."
      : moduleResolution.installed
        ? "Set AGENTTRAIL_GGUF_MODEL to a readable .gguf file."
        : `Install optional runtime module ${config.module} or set AGENTTRAIL_BUNDLED_RUNTIME_MODULE to a compatible local provider.`
  };
}

async function listBundledModels(env = process.env, projectRoot = process.cwd(), requestedModel = "") {
  const status = await bundledRuntimeStatus(env, projectRoot, requestedModel);
  if (!status.available) {
    return { available: false, models: [], error: status.reason, runtime: status };
  }
  return {
    available: true,
    runtime: status,
    models: [{
      name: status.modelName,
      size: status.model.size || 0,
      modifiedAt: status.model.modifiedAt || null,
      details: {
        format: "gguf",
        family: "bundled-runtime",
        provider: status.provider,
        quantization: status.loading.quantization.value,
        acceleration: status.accelerationBackend,
        path: status.model.path
      }
    }]
  };
}

async function generateBundledText({ env = process.env, projectRoot = process.cwd(), model = "", prompt = "", options = {}, onToken = null }) {
  const config = bundledRuntimeConfig(env, projectRoot, model);
  const status = await bundledRuntimeStatus(env, projectRoot, model);
  if (!status.moduleInstalled) {
    throw new Error(status.reason);
  }
  if (!config.modelPath || !fs.existsSync(config.modelPath)) {
    throw new Error(`Bundled runtime model is missing. Set AGENTTRAIL_GGUF_MODEL to a readable .gguf file.`);
  }

  const runtime = await loadRuntimeModule(config.module, projectRoot);
  const prefillState = await maybePreloadWithProvider(runtime, config, prompt, options);
  config.prefillState = prefillState;
  if (config.speculative && config.speculative.enabled && typeof runtime.generateSpeculative === "function") {
    const result = await runtime.generateSpeculative({ config, model, prompt, options, onToken });
    return normalizeGeneratedText(result, onToken);
  }
  if (typeof runtime.generate === "function") {
    const result = await runtime.generate({ config, model, prompt, options, onToken });
    return normalizeGeneratedText(result, onToken);
  }

  return generateWithNodeLlamaCpp(runtime, config, prompt, options, onToken);
}

async function embedBundledText({ env = process.env, projectRoot = process.cwd(), model = "", input = "" }) {
  const config = bundledRuntimeConfig(env, projectRoot, model);
  const status = await bundledRuntimeStatus(env, projectRoot, model);
  if (!status.moduleInstalled) {
    throw new Error(status.reason);
  }
  if (!config.modelPath || !fs.existsSync(config.modelPath)) {
    throw new Error(`Bundled runtime model is missing. Set AGENTTRAIL_GGUF_MODEL to a readable .gguf file.`);
  }

  const runtime = await loadRuntimeModule(config.module, projectRoot);
  if (typeof runtime.embed === "function") {
    const vector = await runtime.embed({ config, model, input });
    return normalizeEmbedding(vector);
  }

  return embedWithNodeLlamaCpp(runtime, config, input);
}

async function generateWithNodeLlamaCpp(runtime, config, prompt, options, onToken) {
  const getLlama = runtime.getLlama || (runtime.default && runtime.default.getLlama);
  const LlamaChatSession = runtime.LlamaChatSession || (runtime.default && runtime.default.LlamaChatSession);
  if (typeof getLlama !== "function" || typeof LlamaChatSession !== "function") {
    throw new Error(`Bundled runtime module ${config.module} must export generate() or node-llama-cpp getLlama/LlamaChatSession.`);
  }

  const { session } = await getNodeLlamaSession(getLlama, LlamaChatSession, config);
  const prefillState = await maybePreloadNodeLlamaSession(session, config, prompt, options);
  config.prefillState = prefillState;
  const chunks = [];
  const response = await session.prompt(String(prompt || ""), {
    temperature: options.temperature,
    maxTokens: options.num_predict || options.maxTokens,
    signal: options.signal,
    onTextChunk(chunk) {
      const text = String(chunk || "");
      if (!text) return;
      chunks.push(text);
      if (typeof onToken === "function") onToken(text);
    }
  });
  const text = String(response || chunks.join(""));
  if (!chunks.length && text && typeof onToken === "function") {
    onToken(text);
  }
  return text;
}

async function embedWithNodeLlamaCpp(runtime, config, input) {
  const getLlama = runtime.getLlama || (runtime.default && runtime.default.getLlama);
  if (typeof getLlama !== "function") {
    throw new Error(`Bundled runtime module ${config.module} does not expose embeddings.`);
  }
  const { model } = await getNodeLlamaSession(getLlama, runtime.LlamaChatSession || function NoopSession() {}, config);
  if (typeof model.createEmbeddingContext !== "function") {
    throw new Error("The bundled runtime model does not support embeddings.");
  }
  const context = await model.createEmbeddingContext();
  const embedding = await context.getEmbeddingFor(String(input || ""));
  return normalizeEmbedding(embedding && (embedding.vector || embedding.embedding || embedding));
}

async function getNodeLlamaSession(getLlama, LlamaChatSession, config) {
  const sessionKey = `${config.module}:${config.modelPath}:${config.accelerationBackend}:${config.contextSize}:${config.gpuLayers}:${config.threads}:${config.batchSize}:${config.loading.kvCache.type}:${config.loading.kvCache.shiftTokens}:${config.loading.mmap.enabled}:${config.loading.sharding.tensorSplit.join(",")}`;
  if (RUNTIME_STATE.sessionKey === sessionKey && RUNTIME_STATE.session) {
    return RUNTIME_STATE;
  }

  const llama = await getLlama();
  const loadOptions = { modelPath: config.modelPath };
  if (config.gpuLayers !== null) loadOptions.gpuLayers = config.gpuLayers;
  if (config.loading.mmap.enabled === false) loadOptions.useMmap = false;
  if (config.loading.mmap.mlock) loadOptions.useMlock = true;
  if (config.loading.sharding.enabled && config.loading.sharding.tensorSplit.length) loadOptions.tensorSplit = config.loading.sharding.tensorSplit;
  if (config.loading.sharding.mainGpu !== null) loadOptions.mainGpu = config.loading.sharding.mainGpu;
  const model = await llama.loadModel(loadOptions);
  const contextOptions = {};
  if (config.contextSize) contextOptions.contextSize = config.contextSize;
  if (config.threads !== null) contextOptions.threads = config.threads;
  if (config.batchSize !== null) contextOptions.batchSize = config.batchSize;
  const context = await model.createContext(contextOptions);
  const sequence = typeof context.getSequence === "function" ? context.getSequence() : context;
  const session = new LlamaChatSession({ contextSequence: sequence });
  const promptCompletionEngine = typeof session.createPromptCompletionEngine === "function"
    ? session.createPromptCompletionEngine()
    : null;

  RUNTIME_STATE.sessionKey = sessionKey;
  RUNTIME_STATE.loadedModelPath = config.modelPath;
  RUNTIME_STATE.llama = llama;
  RUNTIME_STATE.model = model;
  RUNTIME_STATE.context = context;
  RUNTIME_STATE.session = session;
  RUNTIME_STATE.promptCompletionEngine = promptCompletionEngine;
  return RUNTIME_STATE;
}

async function maybePreloadWithProvider(runtime, config, prompt, options = {}) {
  const state = buildPrefillState(config, prompt);
  if (!state.enabled || typeof runtime.preload !== "function") {
    rememberPrefillState(state);
    return state;
  }
  await runtime.preload({ config, prompt, options, prefill: state });
  state.preloaded = true;
  rememberPrefillState(state);
  return state;
}

async function maybePreloadNodeLlamaSession(session, config, prompt, options = {}) {
  const state = buildPrefillState(config, prompt);
  if (!state.enabled || typeof session.preloadPrompt !== "function") {
    rememberPrefillState(state);
    return state;
  }
  const shouldPreload = state.hit || state.prefixChars >= state.minSharedChars;
  if (!shouldPreload) {
    rememberPrefillState(state);
    return state;
  }
  await session.preloadPrompt(state.prefix, {
    signal: options.signal
  });
  state.preloaded = true;
  rememberPrefillState(state);
  return state;
}

function buildPrefillState(config, prompt) {
  const policy = config.prefill || (config.loading && config.loading.prefill) || {};
  const enabled = policy.enabled === true;
  const prefix = enabled ? sharedPrefixCandidate(prompt, policy.prefixChars) : "";
  const hash = prefix ? hashText(prefix) : "";
  const previous = RUNTIME_STATE.prefillCache;
  const commonChars = previous && previous.prefix ? commonPrefixLength(previous.prefix, prefix) : 0;
  const minSharedChars = Math.max(1, Number(policy.minSharedChars || 1200));
  return {
    schema: "agenttrail.prefill-state.v1",
    enabled,
    strategy: policy.strategy || "shared-prefix-preload",
    prefixChars: prefix.length,
    minSharedChars,
    hash,
    hit: Boolean(previous && (previous.hash === hash || commonChars >= minSharedChars)),
    commonChars,
    preloaded: false,
    prefix
  };
}

function rememberPrefillState(state) {
  if (!state || !state.enabled || !state.prefix) return;
  RUNTIME_STATE.prefillCache = {
    hash: state.hash,
    prefix: state.prefix,
    prefixChars: state.prefixChars,
    updatedAt: Date.now()
  };
}

function sharedPrefixCandidate(prompt, maxChars = 12000) {
  const text = String(prompt || "");
  const limit = Math.max(1, Number(maxChars || 12000));
  const markers = ["\nConversation:", "\nNext response:"];
  const markerIndex = markers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const end = Number.isInteger(markerIndex) ? markerIndex : Math.min(text.length, limit);
  return text.slice(0, Math.min(end, limit));
}

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex");
}

function commonPrefixLength(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left.charCodeAt(index) === right.charCodeAt(index)) {
    index += 1;
  }
  return index;
}

async function loadRuntimeModule(moduleId, projectRoot) {
  const key = `${projectRoot}:${moduleId}`;
  if (RUNTIME_STATE.runtimeModuleKey === key && RUNTIME_STATE.runtimeModule) {
    return RUNTIME_STATE.runtimeModule;
  }
  const resolution = resolveRuntimeModule(moduleId, projectRoot);
  if (!resolution.installed) {
    throw new Error(resolution.error || `Cannot resolve bundled runtime module: ${moduleId}`);
  }
  try {
    const loaded = require(resolution.requireId);
    RUNTIME_STATE.runtimeModuleKey = key;
    RUNTIME_STATE.runtimeModule = loaded;
    return loaded;
  } catch (error) {
    if (error && error.code !== "ERR_REQUIRE_ESM") {
      throw error;
    }
    const imported = await import(resolution.isPath ? pathToFileURL(resolution.requireId).href : resolution.requireId);
    RUNTIME_STATE.runtimeModuleKey = key;
    RUNTIME_STATE.runtimeModule = imported;
    return imported;
  }
}

function resolveRuntimeModule(moduleId, projectRoot) {
  const value = String(moduleId || DEFAULT_RUNTIME_MODULE).trim();
  if (isPathLike(value)) {
    const absolute = path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
    return fs.existsSync(absolute)
      ? { installed: true, path: absolute, requireId: absolute, isPath: true }
      : { installed: false, path: absolute, requireId: absolute, isPath: true, error: `Runtime module file not found: ${absolute}` };
  }
  try {
    const resolved = require.resolve(value, { paths: [projectRoot] });
    return { installed: true, path: resolved, requireId: value, isPath: false };
  } catch (error) {
    return { installed: false, path: null, requireId: value, isPath: false, error: error.message };
  }
}

async function modelPathStatus(modelPath) {
  if (!modelPath) {
    return { path: null, exists: false, size: 0, modifiedAt: null };
  }
  try {
    const stat = await fsp.stat(modelPath);
    return {
      path: modelPath,
      exists: stat.isFile(),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch {
    return { path: modelPath, exists: false, size: 0, modifiedAt: null };
  }
}

function resolveBundledModelPath(value, projectRoot) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

function normalizeGeneratedText(result, onToken) {
  const text = typeof result === "string"
    ? result
    : result && typeof result.text === "string"
      ? result.text
      : "";
  if (text && typeof onToken === "function" && !(result && result.streamed === true)) {
    onToken(text);
  }
  return text;
}

function normalizeEmbedding(vector) {
  const values = Array.isArray(vector) ? vector : Array.from(vector || []);
  if (!values.length) {
    throw new Error("Bundled runtime did not return an embedding vector.");
  }
  return values.map(Number);
}

function isPathLike(value) {
  return value.startsWith(".") || value.startsWith("/") || value.includes(path.sep);
}

function looksLikeGgufPath(value) {
  const text = String(value || "");
  return text.toLowerCase().endsWith(".gguf") || isPathLike(text);
}

module.exports = {
  DEFAULT_RUNTIME_MODULE,
  bundledRuntimeConfig,
  bundledRuntimeStatus,
  listBundledModels,
  generateBundledText,
  embedBundledText,
  resolveRuntimeModule
};
