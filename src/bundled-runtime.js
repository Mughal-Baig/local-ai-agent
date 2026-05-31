"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { detectRuntimeHardware } = require("./runtime-hardware");

const DEFAULT_RUNTIME_MODULE = "node-llama-cpp";

const RUNTIME_STATE = {
  runtimeModuleKey: null,
  runtimeModule: null,
  sessionKey: null,
  llama: null,
  loadedModelPath: null,
  model: null,
  context: null,
  session: null
};

function bundledRuntimeConfig(env = process.env, projectRoot = process.cwd(), requestedModel = "") {
  const moduleId = String(env.AGENTTRAIL_BUNDLED_RUNTIME_MODULE || DEFAULT_RUNTIME_MODULE).trim();
  const hardware = detectRuntimeHardware(env);
  const modelPath = resolveBundledModelPath(
    requestedModel && looksLikeGgufPath(requestedModel) ? requestedModel : (env.AGENTTRAIL_GGUF_MODEL || env.AGENTTRAIL_BUNDLED_MODEL || ""),
    projectRoot
  );
  const modelName = String(env.AGENTTRAIL_BUNDLED_MODEL_NAME || (modelPath ? path.basename(modelPath) : requestedModel || "bundled-gguf")).trim();
  return {
    schema: "agenttrail.bundled-runtime.v1",
    provider: moduleId === DEFAULT_RUNTIME_MODULE ? "node-llama-cpp" : "custom-module",
    module: moduleId,
    modelPath,
    modelName,
    contextSize: numberFromEnv(env.AGENTTRAIL_BUNDLED_CONTEXT_SIZE, env.OLLAMA_NUM_CTX, 8192),
    accelerationBackend: hardware.selectedBackend,
    gpuLayers: hardware.offload.loadValue,
    threads: hardware.threading.effective,
    batchSize: optionalNumber(env.AGENTTRAIL_BUNDLED_BATCH_SIZE),
    embeddingModelPath: resolveBundledModelPath(env.AGENTTRAIL_BUNDLED_EMBED_MODEL || "", projectRoot),
    hardware
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
  const chunks = [];
  const response = await session.prompt(String(prompt || ""), {
    temperature: options.temperature,
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
  const sessionKey = `${config.module}:${config.modelPath}:${config.accelerationBackend}:${config.contextSize}:${config.gpuLayers}:${config.threads}:${config.batchSize}`;
  if (RUNTIME_STATE.sessionKey === sessionKey && RUNTIME_STATE.session) {
    return RUNTIME_STATE;
  }

  const llama = await getLlama();
  const loadOptions = { modelPath: config.modelPath };
  if (config.gpuLayers !== null) loadOptions.gpuLayers = config.gpuLayers;
  const model = await llama.loadModel(loadOptions);
  const contextOptions = {};
  if (config.contextSize) contextOptions.contextSize = config.contextSize;
  if (config.threads !== null) contextOptions.threads = config.threads;
  if (config.batchSize !== null) contextOptions.batchSize = config.batchSize;
  const context = await model.createContext(contextOptions);
  const sequence = typeof context.getSequence === "function" ? context.getSequence() : context;
  const session = new LlamaChatSession({ contextSequence: sequence });

  RUNTIME_STATE.sessionKey = sessionKey;
  RUNTIME_STATE.loadedModelPath = config.modelPath;
  RUNTIME_STATE.llama = llama;
  RUNTIME_STATE.model = model;
  RUNTIME_STATE.context = context;
  RUNTIME_STATE.session = session;
  return RUNTIME_STATE;
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

function numberFromEnv(primary, fallback, defaultValue) {
  const value = Number(primary !== undefined && primary !== "" ? primary : fallback !== undefined && fallback !== "" ? fallback : defaultValue);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function optionalNumber(primary, fallback) {
  const raw = primary !== undefined && primary !== "" ? primary : fallback;
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
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
