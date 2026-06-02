#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  aggregateUsage,
  buildUsageRecord,
  chooseModelRoute,
  classifyTaskType,
  evaluateBudgetCaps,
  normalizeBudgetCaps
} = require("../../src/accounting-routing");

const models = [
  { name: "tiny-fast", size: 1, scores: { coding: 30, toolUse: 35, planning: 40, longContext: 20, vision: 10 } },
  { name: "qwen2.5-coder:7b", size: 7, scores: { coding: 92, toolUse: 81, planning: 70, longContext: 64, vision: 10 } },
  { name: "llama3.2", size: 4, scores: { coding: 58, toolUse: 86, planning: 84, longContext: 62, vision: 10 } }
];

assert.equal(classifyTaskType({
  messages: [{ role: "user", content: "Fix this JavaScript bug and add tests." }],
  selectedFiles: ["src/app.js"]
}), "code");

assert.equal(classifyTaskType({
  messages: [{ role: "user", content: "Summarize this whole workspace and long context." }],
  selectedFiles: ["a.md", "b.md", "c.md", "d.md", "e.md"]
}), "longContext");

const autoCode = chooseModelRoute({
  requestedModel: "__auto__",
  availableModels: models,
  taskType: "code",
  defaultModel: "llama3.2",
  routing: { auto: true }
});
assert.equal(autoCode.strategy, "auto");
assert.equal(autoCode.model, "qwen2.5-coder:7b");

const recipeRoute = chooseModelRoute({
  requestedModel: "",
  availableModels: models,
  taskType: "writing",
  defaultModel: "llama3.2",
  recipe: { id: "readme-polish", defaultModel: "llama3.2" },
  routing: { auto: true }
});
assert.equal(recipeRoute.reason, "recipe default model");
assert.equal(recipeRoute.recipeId, "readme-polish");
assert.equal(recipeRoute.model, "llama3.2");

const speculative = chooseModelRoute({
  requestedModel: "__auto__",
  availableModels: models,
  taskType: "code",
  defaultModel: "llama3.2",
  routing: { auto: true, strategy: "speculative" }
});
assert.equal(speculative.strategy, "draft-then-verify");
assert.equal(speculative.draftModel, "tiny-fast");
assert.equal(speculative.verifyModel, "qwen2.5-coder:7b");

const tightCaps = normalizeBudgetCaps({ profile: "tight", inputHardTokens: 10 });
const budget = evaluateBudgetCaps({ inputTokens: 42 }, tightCaps, "prompt");
assert.equal(budget.ok, false);
assert.equal(budget.severity, "hard");

const record = buildUsageRecord({
  model: "llama3.2",
  taskType: "chat",
  inputTokens: 100,
  outputTokens: 50,
  durationMs: 1000,
  timeToFirstTokenMs: 123,
  recipeId: "readme-polish"
});
assert.equal(record.totalTokens, 150);
assert.equal(record.tokensPerSecond, 50);
assert.equal(record.timeToFirstTokenMs, 123);

const dashboard = aggregateUsage([record], { limit: 5 });
assert.equal(dashboard.totals.avgTimeToFirstTokenMs, 123);
assert.equal(dashboard.byModel[0].key, "llama3.2");
assert.equal(dashboard.byRecipe[0].key, "readme-polish");

console.log("Accounting and routing unit tests passed");
