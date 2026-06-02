"use strict";

const ACCOUNTING_USAGE_SCHEMA = "agenttrail.usage-record.v1";
const ACCOUNTING_DASHBOARD_SCHEMA = "agenttrail.usage-dashboard.v1";
const ROUTING_DECISION_SCHEMA = "agenttrail.model-route.v1";
const BUDGET_CAP_SCHEMA = "agenttrail.budget-caps.v1";

const AUTO_MODEL_VALUE = "__auto__";

const DEFAULT_BUDGET_PROFILES = {
  tight: {
    inputSoftTokens: 3000,
    inputHardTokens: 7000,
    outputSoftTokens: 700,
    outputHardTokens: 1600,
    durationSoftMs: 45000,
    durationHardMs: 90000
  },
  standard: {
    inputSoftTokens: 7000,
    inputHardTokens: 14000,
    outputSoftTokens: 1400,
    outputHardTokens: 3200,
    durationSoftMs: 90000,
    durationHardMs: 180000
  },
  deep: {
    inputSoftTokens: 18000,
    inputHardTokens: 36000,
    outputSoftTokens: 3500,
    outputHardTokens: 8000,
    durationSoftMs: 180000,
    durationHardMs: 360000
  }
};

const TASK_SCORE_FIELD = {
  code: "coding",
  chat: "planning",
  longContext: "longContext",
  planning: "planning",
  security: "toolUse",
  writing: "planning",
  vision: "vision",
  tool: "toolUse"
};

function estimateTokens(text) {
  const value = String(text || "");
  if (!value.trim()) return 0;
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(Math.max(words * 1.28, value.length / 4.2)));
}

function estimateMessageTokens(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .reduce((sum, message) => sum + estimateTokens(`${message.role || "user"}: ${message.content || ""}`), 0);
}

function classifyTaskType(options = {}) {
  const messages = Array.isArray(options.messages) ? options.messages : [];
  const selectedFiles = Array.isArray(options.selectedFiles) ? options.selectedFiles : [];
  const recipe = options.recipe && typeof options.recipe === "object" ? options.recipe : null;
  const text = [
    messages.map((message) => message.content || "").join("\n"),
    recipe ? `${recipe.title || ""} ${recipe.description || ""} ${(recipe.tags || []).join(" ")}` : "",
    selectedFiles.join(" ")
  ].join("\n").toLowerCase();

  if (/\b(screenshot|image|vision|scan|photo|ui state)\b/.test(text) || selectedFiles.some(isImagePath)) {
    return "vision";
  }
  if (/\b(prompt injection|threat|security|privacy|exfiltrat|secret|permission|sandbox)\b/.test(text)) {
    return "security";
  }
  if (/\b(code|bug|test|diff|implementation|refactor|api|server|javascript|typescript|python|swift|css|html)\b/.test(text) || selectedFiles.some(isCodePath)) {
    return "code";
  }
  if (selectedFiles.length >= 5 || estimateMessageTokens(messages) > 2200 || /\b(long context|many files|whole workspace|audit all|summarize all)\b/.test(text)) {
    return "longContext";
  }
  if (/\b(plan|roadmap|strategy|steps|prioritize|proposal)\b/.test(text)) {
    return "planning";
  }
  if (/\b(write|draft|email|readme|docs|copy|polish|announce)\b/.test(text)) {
    return "writing";
  }
  if (/\b(tool|search|read file|workspace|receipt|mcp)\b/.test(text)) {
    return "tool";
  }
  return "chat";
}

function chooseModelRoute(options = {}) {
  const requestedModel = String(options.requestedModel || "").trim();
  const routing = options.routing && typeof options.routing === "object" ? options.routing : {};
  const recipe = options.recipe && typeof options.recipe === "object" ? options.recipe : null;
  const taskType = options.taskType || classifyTaskType(options);
  const defaultModel = String(options.defaultModel || "llama3.2").trim();
  const available = normalizeAvailableModels(options.availableModels, defaultModel);
  const availableNames = new Set(available.map((model) => model.name));
  const recipeDefault = normalizeModelName(recipe && (recipe.defaultModel || recipe.model));
  const manual = requestedModel && requestedModel !== AUTO_MODEL_VALUE && routing.auto !== true;
  let primaryModel = manual ? requestedModel : "";
  let reason = manual ? "manual model selection" : "automatic model routing";

  if (!primaryModel && recipeDefault) {
    if (availableNames.has(recipeDefault)) {
      primaryModel = recipeDefault;
      reason = "recipe default model";
    } else {
      reason = "recipe default unavailable; automatic model routing";
    }
  }
  if (!primaryModel) {
    primaryModel = bestModelForTask(available, taskType).name;
  }

  const draftModel = cheapestModel(available, primaryModel).name;
  const verifyModel = strongestModel(available, taskType, primaryModel).name;
  const speculativeRequested = routing.strategy === "speculative" || routing.speculative === true;
  const speculative = speculativeRequested && draftModel && verifyModel && draftModel !== verifyModel;

  return {
    schema: ROUTING_DECISION_SCHEMA,
    taskType,
    requestedModel: requestedModel || null,
    model: speculative ? draftModel : primaryModel,
    primaryModel,
    draftModel: speculative ? draftModel : null,
    verifyModel: speculative ? verifyModel : null,
    strategy: speculative ? "draft-then-verify" : (manual ? "manual" : "auto"),
    automatic: !manual,
    speculative,
    reason,
    recipeId: recipe ? recipe.id || null : null,
    candidates: available.map((model) => ({
      name: model.name,
      size: model.size || 0,
      scores: model.scores,
      recommendation: model.recommendation || recommendationForTask(taskType)
    }))
  };
}

function normalizeBudgetCaps(input = {}, env = process.env) {
  const raw = input && typeof input === "object" ? input : {};
  const profile = String(raw.profile || env.AGENTTRAIL_BUDGET_PROFILE || "standard").trim();
  const selectedProfile = DEFAULT_BUDGET_PROFILES[profile] ? profile : "standard";
  const base = DEFAULT_BUDGET_PROFILES[selectedProfile];
  return {
    schema: BUDGET_CAP_SCHEMA,
    profile: selectedProfile,
    inputSoftTokens: clampPositive(raw.inputSoftTokens || env.AGENTTRAIL_INPUT_SOFT_TOKENS, base.inputSoftTokens),
    inputHardTokens: clampPositive(raw.inputHardTokens || env.AGENTTRAIL_INPUT_HARD_TOKENS, base.inputHardTokens),
    outputSoftTokens: clampPositive(raw.outputSoftTokens || env.AGENTTRAIL_OUTPUT_SOFT_TOKENS, base.outputSoftTokens),
    outputHardTokens: clampPositive(raw.outputHardTokens || env.AGENTTRAIL_OUTPUT_HARD_TOKENS, base.outputHardTokens),
    durationSoftMs: clampPositive(raw.durationSoftMs || env.AGENTTRAIL_DURATION_SOFT_MS, base.durationSoftMs),
    durationHardMs: clampPositive(raw.durationHardMs || env.AGENTTRAIL_DURATION_HARD_MS, base.durationHardMs)
  };
}

function evaluateBudgetCaps(metrics = {}, caps = normalizeBudgetCaps(), phase = "input") {
  const checks = [];
  if (Number(metrics.inputTokens || 0) > caps.inputSoftTokens) {
    checks.push(budgetFinding("input", "soft", metrics.inputTokens, caps.inputSoftTokens, "Input is above the soft context budget."));
  }
  if (Number(metrics.inputTokens || 0) > caps.inputHardTokens) {
    checks.push(budgetFinding("input", "hard", metrics.inputTokens, caps.inputHardTokens, "Input is above the hard context budget."));
  }
  if (Number(metrics.outputTokens || 0) > caps.outputSoftTokens) {
    checks.push(budgetFinding("output", "soft", metrics.outputTokens, caps.outputSoftTokens, "Output is above the soft completion budget."));
  }
  if (Number(metrics.outputTokens || 0) > caps.outputHardTokens) {
    checks.push(budgetFinding("output", "hard", metrics.outputTokens, caps.outputHardTokens, "Output is above the hard completion budget."));
  }
  if (Number(metrics.durationMs || 0) > caps.durationSoftMs) {
    checks.push(budgetFinding("time", "soft", metrics.durationMs, caps.durationSoftMs, "Run time is above the soft duration budget."));
  }
  if (Number(metrics.durationMs || 0) > caps.durationHardMs) {
    checks.push(budgetFinding("time", "hard", metrics.durationMs, caps.durationHardMs, "Run time is above the hard duration budget."));
  }
  const hardStops = checks.filter((item) => item.level === "hard");
  return {
    schema: "agenttrail.budget-check.v1",
    phase,
    ok: hardStops.length === 0,
    severity: hardStops.length ? "hard" : (checks.length ? "soft" : "ok"),
    checks,
    prompt: budgetGuidance(checks, phase)
  };
}

function buildUsageRecord(input = {}) {
  const startedAt = input.startedAt || new Date().toISOString();
  const endedAt = input.endedAt || new Date().toISOString();
  const inputTokens = Math.max(0, Math.round(Number(input.inputTokens || 0)));
  const outputTokens = Math.max(0, Math.round(Number(input.outputTokens || 0)));
  const durationMs = Math.max(0, Math.round(Number(input.durationMs || 0)));
  const timeToFirstTokenMs = input.timeToFirstTokenMs === null || input.timeToFirstTokenMs === undefined
    ? null
    : Math.max(0, Math.round(Number(input.timeToFirstTokenMs || 0)));
  return {
    schema: ACCOUNTING_USAGE_SCHEMA,
    id: input.id || `usage-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
    runId: input.runId || null,
    conversationId: input.conversationId || null,
    recipeId: input.recipeId || null,
    taskType: input.taskType || "chat",
    status: input.status || "completed",
    startedAt,
    endedAt,
    durationMs,
    model: input.model || "",
    requestedModel: input.requestedModel || null,
    routing: input.routing || null,
    budget: input.budget || null,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    timeToFirstTokenMs,
    tokensPerSecond: tokensPerSecond(outputTokens, durationMs),
    toolCalls: Math.max(0, Math.round(Number(input.toolCalls || 0))),
    selectedFiles: Math.max(0, Math.round(Number(input.selectedFiles || 0)))
  };
}

function aggregateUsage(records = [], options = {}) {
  const normalized = (Array.isArray(records) ? records : [])
    .map((record) => record && record.payload ? record.payload : record)
    .filter((record) => record && record.schema === ACCOUNTING_USAGE_SCHEMA);
  const sorted = normalized
    .slice()
    .sort((a, b) => String(b.endedAt || b.startedAt || "").localeCompare(String(a.endedAt || a.startedAt || "")));
  const limit = Math.max(1, Number(options.limit || 50));
  return {
    schema: ACCOUNTING_DASHBOARD_SCHEMA,
    generatedAt: new Date().toISOString(),
    totals: summarizeRows(sorted),
    byModel: groupUsage(sorted, (row) => row.model || "unknown"),
    byRecipe: groupUsage(sorted, (row) => row.recipeId || "none"),
    byTaskType: groupUsage(sorted, (row) => row.taskType || "chat"),
    overTime: groupUsageByDate(sorted),
    recent: sorted.slice(0, limit)
  };
}

function budgetGuidance(checks = [], phase = "input") {
  if (!checks.length) {
    return "Budget is within configured limits.";
  }
  const hard = checks.some((item) => item.level === "hard");
  const target = checks.map((item) => item.kind).join(", ");
  if (hard && phase === "input") {
    return `Hard budget limit hit for ${target}. Ask the user to select fewer files, narrow the prompt, or switch to Deep budget before continuing.`;
  }
  if (hard) {
    return `Hard budget limit hit for ${target}. Summarize briefly and ask before spending more local compute.`;
  }
  return `Soft budget warning for ${target}. Be concise, use the fewest tools needed, and explain if more budget is required.`;
}

function routingPrompt(route) {
  if (!route || route.schema !== ROUTING_DECISION_SCHEMA) {
    return "No model routing decision was provided.";
  }
  const parts = [
    `Task type: ${route.taskType}.`,
    `Routing strategy: ${route.strategy}.`,
    `Selected model: ${route.model}.`
  ];
  if (route.speculative) {
    parts.push(`Draft with ${route.draftModel}, then verify with ${route.verifyModel}.`);
  }
  return parts.join(" ");
}

function normalizeAvailableModels(models, defaultModel = "llama3.2") {
  const list = Array.isArray(models) && models.length ? models : [{ name: defaultModel }];
  return list
    .map((model) => {
      const value = typeof model === "string" ? { name: model } : (model || {});
      const name = normalizeModelName(value.name || value.id || defaultModel);
      return {
        ...value,
        name,
        scores: normalizeScores(value.scores, name),
        size: Number(value.size || 0),
        recommendation: value.recommendation || ""
      };
    })
    .filter((model) => model.name)
    .slice(0, 16);
}

function bestModelForTask(models, taskType) {
  const field = TASK_SCORE_FIELD[taskType] || "planning";
  return models.slice().sort((a, b) => Number(b.scores[field] || 0) - Number(a.scores[field] || 0) || a.name.localeCompare(b.name))[0] || models[0];
}

function strongestModel(models, taskType, fallbackName) {
  return bestModelForTask(models, taskType) || models.find((model) => model.name === fallbackName) || models[0];
}

function cheapestModel(models, fallbackName) {
  const sorted = models.slice().sort((a, b) => Number(a.size || 0) - Number(b.size || 0) || fastScore(b.name) - fastScore(a.name) || a.name.localeCompare(b.name));
  return sorted[0] || models.find((model) => model.name === fallbackName) || models[0];
}

function normalizeScores(scores, name) {
  if (scores && typeof scores === "object") {
    return {
      coding: Number(scores.coding || 0),
      toolUse: Number(scores.toolUse || 0),
      planning: Number(scores.planning || 0),
      longContext: Number(scores.longContext || 0),
      vision: Number(scores.vision || 0)
    };
  }
  const text = String(name || "").toLowerCase();
  return {
    coding: /code|coder|qwen|deepseek/.test(text) ? 82 : 55,
    toolUse: /tool|llama|qwen|mistral/.test(text) ? 78 : 55,
    planning: /instruct|llama|mistral|gemma/.test(text) ? 78 : 58,
    longContext: /32k|64k|128k|long/.test(text) ? 86 : 52,
    vision: /vision|llava|vl|pixtral|moondream/.test(text) ? 88 : 20
  };
}

function recommendationForTask(taskType) {
  return {
    code: "coding",
    longContext: "long context",
    security: "tool use",
    vision: "vision",
    writing: "drafting",
    planning: "planning"
  }[taskType] || "general chat";
}

function groupUsage(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const bucket = groups.get(key) || [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries()).map(([key, bucket]) => ({
    key,
    ...summarizeRows(bucket)
  })).sort((a, b) => b.totalTokens - a.totalTokens || a.key.localeCompare(b.key));
}

function groupUsageByDate(rows) {
  return groupUsage(rows, (row) => String(row.endedAt || row.startedAt || "").slice(0, 10) || "unknown")
    .sort((a, b) => a.key.localeCompare(b.key));
}

function summarizeRows(rows) {
  const count = rows.length;
  const inputTokens = sum(rows, "inputTokens");
  const outputTokens = sum(rows, "outputTokens");
  const totalTokens = sum(rows, "totalTokens");
  const durationMs = sum(rows, "durationMs");
  const ttftRows = rows.filter((row) => Number.isFinite(Number(row.timeToFirstTokenMs)));
  const timeToFirstTokenMs = sum(ttftRows, "timeToFirstTokenMs");
  return {
    count,
    inputTokens,
    outputTokens,
    totalTokens,
    durationMs,
    avgDurationMs: count ? Math.round(durationMs / count) : 0,
    avgTimeToFirstTokenMs: ttftRows.length ? Math.round(timeToFirstTokenMs / ttftRows.length) : null,
    avgTokensPerSecond: tokensPerSecond(outputTokens, durationMs)
  };
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Math.max(0, Number(row[field] || 0)), 0);
}

function budgetFinding(kind, level, value, limit, message) {
  return {
    kind,
    level,
    value: Math.round(Number(value || 0)),
    limit: Math.round(Number(limit || 0)),
    message
  };
}

function tokensPerSecond(tokens, durationMs) {
  return Math.round((Number(tokens || 0) / Math.max(Number(durationMs || 1), 1)) * 1000);
}

function clampPositive(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeModelName(value) {
  return String(value || "").trim();
}

function fastScore(name) {
  return /fast|small|tiny|mini|phi/.test(String(name || "").toLowerCase()) ? 1 : 0;
}

function isCodePath(filePath) {
  return /\.(js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|swift|java|kt|cs|cpp|c|h|hpp|php|sh|zsh|fish|css|html|vue|svelte|sql)$/i.test(String(filePath || ""));
}

function isImagePath(filePath) {
  return /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(String(filePath || ""));
}

module.exports = {
  ACCOUNTING_USAGE_SCHEMA,
  ACCOUNTING_DASHBOARD_SCHEMA,
  ROUTING_DECISION_SCHEMA,
  BUDGET_CAP_SCHEMA,
  AUTO_MODEL_VALUE,
  DEFAULT_BUDGET_PROFILES,
  aggregateUsage,
  budgetGuidance,
  chooseModelRoute,
  classifyTaskType,
  estimateMessageTokens,
  estimateTokens,
  evaluateBudgetCaps,
  buildUsageRecord,
  normalizeBudgetCaps,
  routingPrompt
};
