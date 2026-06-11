"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { atomicWriteFile } = require("./resilience");
const { validateConfig } = require("./config");

const CONFIG_ADMIN_SCHEMA = "agenttrail.config-admin.v1";
const WORKSPACE_CONFIG_SCHEMA = "agenttrail.workspace-config.v1";
const FIRST_RUN_SCHEMA = "agenttrail.first-run.v1";
const WORKSPACE_CONFIG_PATH = ".agenttrail/workspace-config.json";
const FIRST_RUN_PATH = ".agenttrail/first-run.json";
const FIRST_RUN_SAMPLE_PATH = "first-run/sample-typo.md";
const FIRST_RUN_SAMPLE_RECEIPT_PATH = "receipts/first-run-safe-typo.md";
const FIRST_RUN_SAMPLE_BEFORE = "# AgentTrail first run\n\nAgentTrail keeps your local files privte and shows every edit before it lands.\n";
const FIRST_RUN_SAMPLE_AFTER = "# AgentTrail first run\n\nAgentTrail keeps your local files private and shows every edit before it lands.\n";
const WORKSPACE_CONFIG_MODE_VALUES = new Set(["on", "off", "true", "false", "1", "0"]);

const CONFIG_GROUPS = [
  { id: "model", label: "Model", description: "Local model backend, model names, embedding model, and tool-call mode." },
  { id: "cache", label: "Cache", description: "Response and tool capability cache behavior." },
  { id: "budget", label: "Budget", description: "Tool, prompt, and memory budget limits." },
  { id: "host", label: "Host", description: "Local server bind, workspace, queue, retry, and disk guards." }
];

const CONFIG_SETTINGS = [
  { key: "AGENTTRAIL_MODEL_ADAPTER", group: "model", label: "Model adapter", type: "select", defaultValue: "ollama", options: ["ollama", "lmstudio", "llamacpp", "openai-compatible", "bundled"] },
  { key: "OLLAMA_HOST", group: "model", label: "Ollama host", type: "url", defaultValue: "http://127.0.0.1:11434" },
  { key: "LMSTUDIO_HOST", group: "model", label: "LM Studio host", type: "url", defaultValue: "http://127.0.0.1:1234" },
  { key: "LLAMACPP_HOST", group: "model", label: "llama.cpp host", type: "url", defaultValue: "http://127.0.0.1:8080" },
  { key: "OPENAI_COMPATIBLE_HOST", group: "model", label: "OpenAI-compatible host", type: "url", defaultValue: "http://127.0.0.1:8000/v1" },
  { key: "OLLAMA_MODEL", group: "model", label: "Default model", type: "text", defaultValue: "llama3.2" },
  { key: "OLLAMA_EMBED_MODEL", group: "model", label: "Embedding model", type: "text", defaultValue: "nomic-embed-text" },
  { key: "OLLAMA_KEEP_ALIVE", group: "model", label: "Idle unload policy", type: "text", defaultValue: "5m", description: "Ollama keep_alive value; use 0 for unload after each request or a duration like 5m to keep models warm." },
  { key: "AGENTTRAIL_PREFILL_REUSE", group: "model", label: "Prefill reuse", type: "select", defaultValue: "on", options: ["on", "off"], description: "Reuse shared prompt prefixes through bundled-runtime preloading when the provider supports it." },
  { key: "AGENTTRAIL_SPECULATIVE_DECODING", group: "model", label: "Speculative decoding", type: "select", defaultValue: "off", options: ["off", "ngram-simple", "ngram-cache", "ngram-map-k", "draft-simple"], description: "Request bundled-runtime speculative decoding; draft-simple can use AGENTTRAIL_DRAFT_GGUF_MODEL." },
  { key: "AGENTTRAIL_DRAFT_GGUF_MODEL", group: "model", label: "Draft GGUF model", type: "text", defaultValue: "", description: "Optional local GGUF draft model path for draft-model speculative decoding." },
  { key: "AGENTTRAIL_NATIVE_TOOLS", group: "model", label: "Native tool calls", type: "select", defaultValue: "on", options: ["on", "off"] },

  { key: "AGENTTRAIL_CACHE", group: "cache", label: "Response cache", type: "select", defaultValue: "on", options: ["on", "off"] },
  { key: "AGENTTRAIL_CACHE_TTL_MS", group: "cache", label: "Response cache TTL", type: "number", defaultValue: "300000", min: 1000, max: 86400000 },
  { key: "AGENTTRAIL_TOOL_CAPABILITY_TTL_MS", group: "cache", label: "Tool capability TTL", type: "number", defaultValue: "600000", min: 1000, max: 86400000 },

  { key: "MAX_TOOL_ITERATIONS", group: "budget", label: "Max tool iterations", type: "number", defaultValue: "4", min: 1, max: 20 },
  { key: "MAX_TOOL_CALLS_PER_STEP", group: "budget", label: "Max tool calls per step", type: "number", defaultValue: "6", min: 1, max: 20 },
  { key: "AGENTTRAIL_DEFAULT_STEP_BUDGET", group: "budget", label: "Default step budget", type: "number", defaultValue: "3", min: 1, max: 20 },
  { key: "AGENTTRAIL_MAX_PROMPT_CHARS", group: "budget", label: "Max prompt chars", type: "number", defaultValue: "24000", min: 4000, max: 500000 },
  { key: "AGENTTRAIL_MEMORY_PROMPT_CHARS", group: "budget", label: "Memory prompt chars", type: "number", defaultValue: "3840", min: 240, max: 500000 },
  { key: "AGENTTRAIL_RAW_MEMORY_PROMPT_CHARS", group: "budget", label: "Raw memory chars", type: "number", defaultValue: "1200", min: 240, max: 500000 },

  { key: "HOST", group: "host", label: "Bind host", type: "text", defaultValue: "127.0.0.1" },
  { key: "PORT", group: "host", label: "Port", type: "number", defaultValue: "4173", min: 1, max: 65535 },
  { key: "WORKSPACE_ROOT", group: "host", label: "Workspace root", type: "text", defaultValue: "workspace" },
  { key: "AGENTTRAIL_MAX_CONCURRENCY", group: "host", label: "Max concurrency", type: "number", defaultValue: "4", min: 1, max: 32 },
  { key: "AGENTTRAIL_MAX_QUEUE", group: "host", label: "Max queue", type: "number", defaultValue: "64", min: 0, max: 1024 },
  { key: "AGENTTRAIL_BACKEND_RETRIES", group: "host", label: "Backend retries", type: "number", defaultValue: "2", min: 0, max: 5 },
  { key: "AGENTTRAIL_BACKEND_RETRY_BASE_MS", group: "host", label: "Retry base ms", type: "number", defaultValue: "120", min: 10, max: 2000 },
  { key: "AGENTTRAIL_RUN_TIMEOUT_MS", group: "host", label: "Run timeout ms", type: "number", defaultValue: "120000", min: 100, max: 1800000 },
  { key: "AGENTTRAIL_BACKEND_STREAM_TIMEOUT_MS", group: "host", label: "Backend stream timeout ms", type: "number", defaultValue: "120000", min: 100, max: 1800000 },
  { key: "AGENTTRAIL_MIN_FREE_BYTES", group: "host", label: "Write free bytes guard", type: "number", defaultValue: String(64 * 1024 * 1024), min: 0, max: Number.MAX_SAFE_INTEGER },
  { key: "AGENTTRAIL_MODEL_PULL_MIN_FREE_BYTES", group: "host", label: "Model pull free bytes guard", type: "number", defaultValue: String(512 * 1024 * 1024), min: 0, max: Number.MAX_SAFE_INTEGER }
].map((setting) => ({
  restartRequired: true,
  secret: false,
  description: setting.description || setting.label,
  ...setting
}));

const CONFIG_SETTING_MAP = new Map(CONFIG_SETTINGS.map((setting) => [setting.key, setting]));

function nowIso() {
  return new Date().toISOString();
}

function workspaceConfigAbsolutePath(workspaceRoot) {
  return path.join(path.resolve(workspaceRoot || "workspace"), WORKSPACE_CONFIG_PATH);
}

function firstRunAbsolutePath(workspaceRoot) {
  return path.join(path.resolve(workspaceRoot || "workspace"), FIRST_RUN_PATH);
}

function defaultWorkspaceConfig() {
  return {
    schema: WORKSPACE_CONFIG_SCHEMA,
    updatedAt: null,
    overrides: {}
  };
}

function normalizeWorkspaceConfig(parsed) {
  const overrides = parsed && parsed.overrides && typeof parsed.overrides === "object" && !Array.isArray(parsed.overrides)
    ? normalizeOverrides(parsed.overrides)
    : {};
  return {
    schema: WORKSPACE_CONFIG_SCHEMA,
    updatedAt: parsed && parsed.updatedAt ? String(parsed.updatedAt) : null,
    overrides
  };
}

function readWorkspaceConfigSync(workspaceRoot) {
  const absolutePath = workspaceConfigAbsolutePath(workspaceRoot);
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    return { ...normalizeWorkspaceConfig(parsed), path: WORKSPACE_CONFIG_PATH, absolutePath, exists: true };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ...defaultWorkspaceConfig(), path: WORKSPACE_CONFIG_PATH, absolutePath, exists: false };
    }
    return { ...defaultWorkspaceConfig(), path: WORKSPACE_CONFIG_PATH, absolutePath, exists: true, invalid: true, error: error.message };
  }
}

async function readWorkspaceConfig(workspaceRoot) {
  const absolutePath = workspaceConfigAbsolutePath(workspaceRoot);
  try {
    const parsed = JSON.parse(await fsp.readFile(absolutePath, "utf8"));
    return { ...normalizeWorkspaceConfig(parsed), path: WORKSPACE_CONFIG_PATH, absolutePath, exists: true };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ...defaultWorkspaceConfig(), path: WORKSPACE_CONFIG_PATH, absolutePath, exists: false };
    }
    return { ...defaultWorkspaceConfig(), path: WORKSPACE_CONFIG_PATH, absolutePath, exists: true, invalid: true, error: error.message };
  }
}

function normalizeOverrides(overrides = {}) {
  const normalized = {};
  for (const [key, rawValue] of Object.entries(overrides || {})) {
    if (!CONFIG_SETTING_MAP.has(key)) {
      const error = new Error(`Unknown config key: ${key}`);
      error.code = "CONFIG_KEY";
      throw error;
    }
    const value = normalizeOverrideValue(CONFIG_SETTING_MAP.get(key), rawValue);
    if (value !== null) {
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizeOverrideValue(setting, rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  const value = String(rawValue).trim();
  if (!value) {
    return null;
  }
  if (setting.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(`${setting.key} must be a number.`);
    }
    if (setting.min !== undefined && number < setting.min) {
      throw new Error(`${setting.key} must be at least ${setting.min}.`);
    }
    if (setting.max !== undefined && number > setting.max) {
      throw new Error(`${setting.key} must be at most ${setting.max}.`);
    }
    return String(Number.isInteger(number) ? number : number);
  }
  if (setting.type === "select" && Array.isArray(setting.options) && setting.options.length) {
    const selected = value.toLowerCase();
    if (!setting.options.includes(selected)) {
      throw new Error(`${setting.key} must be one of: ${setting.options.join(", ")}.`);
    }
    return selected;
  }
  return value;
}

async function writeWorkspaceConfig(workspaceRoot, input = {}) {
  const current = await readWorkspaceConfig(workspaceRoot);
  const incoming = Object.prototype.hasOwnProperty.call(input, "overrides") ? input.overrides : input;
  const overrides = normalizeOverrides(incoming || {});
  const config = {
    schema: WORKSPACE_CONFIG_SCHEMA,
    updatedAt: nowIso(),
    overrides
  };
  await atomicWriteFile(workspaceConfigAbsolutePath(workspaceRoot), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return {
    ...config,
    path: WORKSPACE_CONFIG_PATH,
    absolutePath: workspaceConfigAbsolutePath(workspaceRoot),
    exists: true,
    previousOverrideCount: Object.keys(current.overrides || {}).length,
    overrideCount: Object.keys(overrides).length,
    requiresRestart: true
  };
}

function applyWorkspaceConfigOverridesSync(workspaceRoot, env = process.env) {
  const mode = String(env.AGENTTRAIL_WORKSPACE_CONFIG || "on").trim().toLowerCase();
  if (WORKSPACE_CONFIG_MODE_VALUES.has(mode) && ["off", "false", "0"].includes(mode)) {
    return { enabled: false, appliedKeys: [], shadowedKeys: [], config: readWorkspaceConfigSync(workspaceRoot) };
  }
  const priority = String(env.AGENTTRAIL_WORKSPACE_CONFIG_PRIORITY || "env").trim().toLowerCase();
  const config = readWorkspaceConfigSync(workspaceRoot);
  const appliedKeys = [];
  const shadowedKeys = [];
  if (config.invalid) {
    return { enabled: true, appliedKeys, shadowedKeys, config, error: config.error };
  }
  for (const [key, value] of Object.entries(config.overrides || {})) {
    if (!CONFIG_SETTING_MAP.has(key)) {
      continue;
    }
    const envHasValue = Object.prototype.hasOwnProperty.call(env, key);
    if (envHasValue && priority !== "workspace") {
      shadowedKeys.push(key);
      continue;
    }
    env[key] = String(value);
    appliedKeys.push(key);
  }
  return { enabled: true, appliedKeys, shadowedKeys, config };
}

async function buildConfigAdmin(env = process.env, options = {}) {
  const workspaceRoot = options.workspaceRoot || env.WORKSPACE_ROOT || "workspace";
  const workspaceConfig = await readWorkspaceConfig(workspaceRoot);
  const appliedWorkspaceKeys = Array.isArray(options.appliedWorkspaceKeys) ? options.appliedWorkspaceKeys : [];
  const validation = options.validation || validateConfig(env, { workspaceRoot, appliedWorkspaceKeys });
  const validationByEnv = new Map((validation.checks || []).filter((check) => check.env).map((check) => [check.env, check]));
  const settings = CONFIG_SETTINGS.map((setting) => ({
    ...describeSetting(setting, env, workspaceConfig, appliedWorkspaceKeys),
    validation: validationByEnv.get(setting.key) || null
  }));
  const groups = CONFIG_GROUPS.map((group) => {
    const groupSettings = settings.filter((setting) => setting.group === group.id);
    return {
      ...group,
      settingCount: groupSettings.length,
      overrideCount: groupSettings.filter((setting) => setting.overrideValue !== null).length,
      issueCount: groupSettings.filter((setting) => setting.validation && setting.validation.ok === false).length
    };
  });
  const effective = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const pendingRestart = settings.filter((setting) => setting.source === "workspace-pending" || setting.shadowedByEnv).map((setting) => setting.key);
  return {
    schema: CONFIG_ADMIN_SCHEMA,
    workspaceRoot: path.resolve(workspaceRoot),
    generatedAt: nowIso(),
    groups,
    settings,
    effective,
    validation,
    overrides: {
      schema: workspaceConfig.schema,
      path: workspaceConfig.path,
      exists: workspaceConfig.exists,
      invalid: workspaceConfig.invalid === true,
      error: workspaceConfig.error || null,
      updatedAt: workspaceConfig.updatedAt,
      values: workspaceConfig.overrides || {},
      appliedKeys: appliedWorkspaceKeys,
      shadowedKeys: settings.filter((setting) => setting.shadowedByEnv).map((setting) => setting.key)
    },
    restartRequired: pendingRestart.length > 0,
    restartKeys: pendingRestart
  };
}

function describeSetting(setting, env, workspaceConfig, appliedWorkspaceKeys) {
  const workspaceHas = Object.prototype.hasOwnProperty.call(workspaceConfig.overrides || {}, setting.key);
  const envHas = Object.prototype.hasOwnProperty.call(env || {}, setting.key);
  const appliedFromWorkspace = appliedWorkspaceKeys.includes(setting.key);
  const overrideValue = workspaceHas ? workspaceConfig.overrides[setting.key] : null;
  let source = "default";
  let value = setting.defaultValue;
  if (appliedFromWorkspace) {
    source = "workspace";
    value = env[setting.key];
  } else if (envHas) {
    source = "env";
    value = env[setting.key];
  } else if (workspaceHas) {
    source = "workspace-pending";
    value = overrideValue;
  }
  const shadowedByEnv = workspaceHas && envHas && !appliedFromWorkspace;
  return {
    ...setting,
    value: String(value),
    defaultValue: String(setting.defaultValue),
    overrideValue,
    source,
    shadowedByEnv,
    validation: null
  };
}

async function readFirstRunState(workspaceRoot) {
  const absolutePath = firstRunAbsolutePath(workspaceRoot);
  try {
    const parsed = JSON.parse(await fsp.readFile(absolutePath, "utf8"));
    return { ...normalizeFirstRunState(parsed), path: FIRST_RUN_PATH, exists: true };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ...defaultFirstRunState(), path: FIRST_RUN_PATH, exists: false };
    }
    return { ...defaultFirstRunState(), path: FIRST_RUN_PATH, exists: true, invalid: true, error: error.message };
  }
}

async function writeFirstRunState(workspaceRoot, patch = {}) {
  const current = await readFirstRunState(workspaceRoot);
  const stamp = nowIso();
  const next = normalizeFirstRunState({
    ...current,
    schema: FIRST_RUN_SCHEMA,
    completed: patch.completed !== undefined ? patch.completed === true : current.completed,
    dismissed: patch.dismissed !== undefined ? patch.dismissed === true : current.dismissed,
    completedAt: patch.completed === true ? (current.completedAt || stamp) : (patch.completed === false ? null : current.completedAt),
    dismissedAt: patch.dismissed === true ? (current.dismissedAt || stamp) : (patch.dismissed === false ? null : current.dismissedAt),
    updatedAt: stamp,
    choices: normalizeFirstRunChoices({
      ...(current.choices || {}),
      ...(patch.choices || {}),
      ...(patch.workspaceChoice !== undefined ? { workspaceRoot: patch.workspaceChoice } : {}),
      ...(patch.modelChoice !== undefined ? { model: patch.modelChoice } : {})
    }),
    sampleTask: normalizeSampleTask({ ...(current.sampleTask || {}), ...(patch.sampleTask || {}) }),
    handoff: normalizeFirstRunHandoff({ ...(current.handoff || {}), ...(patch.handoff || {}) }),
    telemetry: appendFirstRunTelemetry(current.telemetry, patch.telemetryEvent, stamp)
  });
  await atomicWriteFile(firstRunAbsolutePath(workspaceRoot), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { ...next, path: FIRST_RUN_PATH, exists: true };
}

function buildFirstRunWizard(input = {}) {
  const state = input.state || {};
  const desktop = input.desktop || {};
  const configStatus = input.configStatus || { ok: true, failed: [] };
  const modelStatus = input.modelStatus || {};
  const files = Array.isArray(input.files) ? input.files : [];
  const packs = Array.isArray(input.packs) ? input.packs : [];
  const foundation = input.foundation || {};
  const searchIndexReady = input.searchIndexReady === true;
  const workspaceRoot = path.resolve(input.workspaceRoot || process.env.WORKSPACE_ROOT || "workspace");
  const installedModels = modelNames(modelStatus);
  const defaultModel = String(input.defaultModel || "llama3.2").trim() || "llama3.2";
  const selectedModel = String((state.choices && state.choices.model) || defaultModel).trim() || defaultModel;
  const selectedModelReady = modelInstalled(installedModels, selectedModel);
  const modelMissing = modelStatus.available === true && selectedModel && !selectedModelReady;
  const modelOptions = uniqueStrings([selectedModel, defaultModel, ...installedModels]);
  const sampleTask = normalizeSampleTask(state.sampleTask);
  const handoff = normalizeFirstRunHandoff(state.handoff);
  const steps = [
    { id: "config", label: "Config validated", ok: configStatus.ok !== false, required: true, action: firstConfigAction(configStatus) },
    { id: "desktop-shell", label: "Desktop shell launched", ok: desktop.enabled === true, required: false, action: "Open AgentTrail.app, AgentTrail-Tray.ps1, or the Linux desktop launcher" },
    { id: "model-backend", label: "Model backend reachable", ok: modelStatus.available === true, required: true, action: `Start Ollama or pull ${input.defaultModel || "llama3.2"}` },
    { id: "workspace", label: "Workspace file available", ok: files.length > 0, required: true, action: "Create a note or add a file to the workspace" },
    { id: "semantic-index", label: "Semantic index ready", ok: searchIndexReady, required: false, action: "Build the local semantic index" },
    { id: "recipe", label: "Recipe packs loaded", ok: packs.length >= 5, required: false, action: "Load the Coder, Founder, Security, Student, and Writer packs" },
    { id: "safe-write", label: "Diff-safe writes enabled", ok: true, required: true, action: "Keep preview writes enabled before applying edits" },
    { id: "foundation", label: "Foundation score healthy", ok: Number(foundation.score || 0) >= 90, required: false, action: "Open Foundation and run the audit" }
  ];
  const completedSteps = steps.filter((step) => step.ok).length;
  const requiredOpen = steps.filter((step) => step.required && !step.ok);
  const score = Math.round((completedSteps / steps.length) * 100);
  const guidedSteps = [
    {
      id: "choose-workspace",
      label: "Choose workspace",
      ok: state.completed === true || Boolean(state.choices && state.choices.workspaceRoot),
      required: true,
      action: "Confirm the project folder AgentTrail should work inside"
    },
    {
      id: "choose-model",
      label: "Choose model",
      ok: state.completed === true || (Boolean(selectedModel) && !modelMissing),
      required: true,
      action: modelMissing ? `Pull ${selectedModel} or choose an installed model` : "Choose the local model AgentTrail should use"
    },
    {
      id: "run-sample-task",
      label: "Run safe sample task",
      ok: state.completed === true || sampleTask.status === "completed",
      required: true,
      action: "Run the local typo-fix sample to see diff, apply, and receipt"
    },
    {
      id: "use-own-project",
      label: "Use your own project",
      ok: Boolean(handoff.completedAt || state.completed === true),
      required: false,
      action: "After the sample, hand off to your real project"
    }
  ];
  const guidedRequiredOpen = guidedSteps.filter((step) => step.required && !step.ok);
  const nextGuided = guidedSteps.find((step) => !step.ok);
  const completed = state.completed === true || guidedRequiredOpen.length === 0;
  return {
    schema: FIRST_RUN_SCHEMA,
    version: input.version || "",
    status: completed && !nextGuided ? "complete" : sampleTask.status === "completed" ? "handoff-ready" : "needs-setup",
    completed,
    dismissed: state.dismissed === true,
    completedAt: state.completedAt || null,
    updatedAt: state.updatedAt || null,
    score,
    progress: `${completedSteps}/${steps.length}`,
    workspaceChoice: {
      current: workspaceRoot,
      selected: (state.choices && state.choices.workspaceRoot) || workspaceRoot,
      applied: path.resolve((state.choices && state.choices.workspaceRoot) || workspaceRoot) === workspaceRoot
    },
    modelChoice: {
      selected: selectedModel,
      defaultModel,
      installed: installedModels,
      options: modelOptions,
      backendAvailable: modelStatus.available === true,
      ready: selectedModelReady,
      missing: modelMissing
    },
    modelPrompt: {
      show: modelMissing,
      title: modelMissing ? "Model missing" : "Model ready",
      action: modelMissing ? `ollama pull ${selectedModel}` : "No model download needed"
    },
    sampleTask,
    handoff: {
      ...handoff,
      ready: handoff.ready === true || sampleTask.status === "completed",
      message: sampleTask.status === "completed"
        ? "Sample complete. Select or add your real project files, then ask AgentTrail for a safe first change."
        : "Run the sample task first so the handoff starts from a proven safe loop."
    },
    telemetry: normalizeFirstRunTelemetry(state.telemetry),
    guidedSteps,
    nextAction: nextGuided ? nextGuided.action : "Ready for your own project",
    desktop,
    blockers: requiredOpen,
    steps,
    items: steps
  };
}

function defaultFirstRunState() {
  return {
    schema: FIRST_RUN_SCHEMA,
    completed: false,
    dismissed: false,
    completedAt: null,
    dismissedAt: null,
    updatedAt: null,
    choices: normalizeFirstRunChoices(),
    sampleTask: normalizeSampleTask(),
    handoff: normalizeFirstRunHandoff(),
    telemetry: normalizeFirstRunTelemetry()
  };
}

function normalizeFirstRunState(parsed = {}) {
  return {
    schema: FIRST_RUN_SCHEMA,
    completed: parsed.completed === true,
    dismissed: parsed.dismissed === true,
    completedAt: parsed.completedAt || null,
    dismissedAt: parsed.dismissedAt || null,
    updatedAt: parsed.updatedAt || null,
    choices: normalizeFirstRunChoices(parsed.choices),
    sampleTask: normalizeSampleTask(parsed.sampleTask),
    handoff: normalizeFirstRunHandoff(parsed.handoff),
    telemetry: normalizeFirstRunTelemetry(parsed.telemetry)
  };
}

function normalizeFirstRunChoices(input = {}) {
  return {
    workspaceRoot: input && input.workspaceRoot ? String(input.workspaceRoot) : null,
    model: input && input.model ? String(input.model) : null
  };
}

function normalizeSampleTask(input = {}) {
  const status = ["pending", "completed", "failed"].includes(input.status) ? input.status : "pending";
  return {
    status,
    path: input.path ? String(input.path) : FIRST_RUN_SAMPLE_PATH,
    receiptPath: input.receiptPath ? String(input.receiptPath) : FIRST_RUN_SAMPLE_RECEIPT_PATH,
    completedAt: input.completedAt || null,
    lastError: input.lastError ? String(input.lastError) : null,
    diffStats: input.diffStats && typeof input.diffStats === "object"
      ? { added: Number(input.diffStats.added || 0), removed: Number(input.diffStats.removed || 0) }
      : { added: 0, removed: 0 }
  };
}

function normalizeFirstRunHandoff(input = {}) {
  return {
    ready: input.ready === true,
    completedAt: input.completedAt || null,
    target: input.target ? String(input.target) : null
  };
}

function normalizeFirstRunTelemetry(input = {}) {
  const events = Array.isArray(input.events)
    ? input.events.map(normalizeFirstRunEvent).filter(Boolean).slice(-50)
    : [];
  const counts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
  return {
    schema: "agenttrail.first-run-telemetry.v1",
    localOnly: true,
    network: "disabled",
    privacy: "Milestone metadata only; no prompts, file contents, diff text, or token text.",
    events,
    counts
  };
}

function appendFirstRunTelemetry(currentTelemetry, event, stamp) {
  const telemetry = normalizeFirstRunTelemetry(currentTelemetry);
  const normalized = normalizeFirstRunEvent(event, stamp);
  if (!normalized) {
    return telemetry;
  }
  return normalizeFirstRunTelemetry({
    events: [...telemetry.events, normalized]
  });
}

function normalizeFirstRunEvent(event, stamp = nowIso()) {
  if (!event || !event.type) {
    return null;
  }
  const metadata = {};
  for (const [key, value] of Object.entries(event.metadata || {})) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      metadata[key] = value;
    } else {
      metadata[key] = String(value).slice(0, 160);
    }
  }
  return {
    id: event.id || `fr-${Date.parse(stamp) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(event.type).replace(/[^a-z0-9_.-]+/gi, "-").slice(0, 80),
    at: event.at || stamp,
    metadata
  };
}

function modelNames(modelStatus = {}) {
  const raw = Array.isArray(modelStatus.models) ? modelStatus.models : [];
  return uniqueStrings(raw.map((model) => typeof model === "string" ? model : model && model.name).filter(Boolean));
}

function modelInstalled(installedModels, selectedModel) {
  const selected = String(selectedModel || "").trim();
  if (!selected) {
    return false;
  }
  const names = new Set((installedModels || []).flatMap((name) => [name, name.replace(/:latest$/, "")]));
  return names.has(selected) || names.has(selected.replace(/:latest$/, ""));
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function firstConfigAction(configStatus) {
  const failed = Array.isArray(configStatus.failed) ? configStatus.failed : [];
  return failed.length ? failed[0].action || failed[0].message : "Config is ready";
}

module.exports = {
  CONFIG_ADMIN_SCHEMA,
  CONFIG_GROUPS,
  CONFIG_SETTINGS,
  FIRST_RUN_SAMPLE_AFTER,
  FIRST_RUN_SAMPLE_BEFORE,
  FIRST_RUN_PATH,
  FIRST_RUN_SAMPLE_PATH,
  FIRST_RUN_SAMPLE_RECEIPT_PATH,
  FIRST_RUN_SCHEMA,
  WORKSPACE_CONFIG_PATH,
  WORKSPACE_CONFIG_SCHEMA,
  applyWorkspaceConfigOverridesSync,
  buildConfigAdmin,
  buildFirstRunWizard,
  readFirstRunState,
  readWorkspaceConfig,
  readWorkspaceConfigSync,
  writeFirstRunState,
  writeWorkspaceConfig
};
