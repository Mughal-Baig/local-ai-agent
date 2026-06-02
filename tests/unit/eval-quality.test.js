#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  AGENT_EVAL_SCHEMA,
  AGENT_MODEL_BENCHMARK_SCHEMA,
  AGENT_MODEL_COMPARISON_SCHEMA,
  GOLDEN_TASKS,
  appendTrend,
  benchmarkModels,
  buildBaselineOutputs,
  checkCitationFaithfulness,
  compareModels,
  detectUnsupportedClaims,
  evaluateRegressionGate,
  evaluateToolUseCorrectness,
  runAgentQualitySuite,
  runAgentTaskEval
} = require("../../src/eval-quality");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const evidence = [
    { id: "E1", citation: "README.md:1", text: "AgentTrail shows its work with diff previews and receipts." }
  ];
  const faithful = checkCitationFaithfulness("AgentTrail shows its work with diff previews [E1].", evidence);
  assert.equal(faithful.score, 100);

  const unsupported = detectUnsupportedClaims(
    "AgentTrail has fully signed production desktop binaries and guaranteed prompt-injection prevention [E1].",
    evidence
  );
  assert.equal(unsupported.count >= 1, true);

  const toolUse = evaluateToolUseCorrectness(
    [{ tool: "search_workspace", arguments: { query: "diff preview receipt" } }],
    [{ tool: "search_workspace", queryIncludes: ["diff", "receipt"] }]
  );
  assert.equal(toolUse.score, 100);

  const evalRun = runAgentTaskEval({ outputs: buildBaselineOutputs(GOLDEN_TASKS) });
  assert.equal(evalRun.schema, AGENT_EVAL_SCHEMA);
  assert.equal(evalRun.total, 7);
  assert.equal(evalRun.score >= 90, true);

  const gate = evaluateRegressionGate(evalRun, [{ score: 90, passed: 7, total: 7 }], { minScore: 85, maxRegression: 5 });
  assert.equal(gate.ok, true);

  const trend = appendTrend([], evalRun);
  assert.equal(trend.schema, "agenttrail.agent-eval-trend.v1");
  assert.equal(trend.history.length, 1);

  const comparison = compareModels(["agenttrail-audit", "loose-chat"]);
  assert.equal(comparison.schema, AGENT_MODEL_COMPARISON_SCHEMA);
  assert.equal(comparison.models.length, 2);
  assert.equal(comparison.winner.score >= comparison.loser.score, true);

  const benchmark = benchmarkModels(["agenttrail-audit", "agenttrail-fast"]);
  assert.equal(benchmark.schema, AGENT_MODEL_BENCHMARK_SCHEMA);
  assert.equal(benchmark.models.length, 2);
  assert.equal(benchmark.models.every((model) => model.avgTokensPerSecond > 0), true);

  const suite = runAgentQualitySuite({ models: ["agenttrail-audit", "agenttrail-fast"] });
  assert.equal(suite.tasks.goldenDataset, true);
  assert.equal(suite.tasks.citationFaithfulness, true);
  assert.equal(suite.tasks.unsupportedClaimDetection, true);
  assert.equal(suite.tasks.regressionGate, true);
  assert.equal(suite.tasks.modelComparison, true);
  assert.equal(suite.tasks.toolUseCorrectness, true);
  assert.equal(suite.tasks.latencyTokensBenchmark, true);
  assert.equal(suite.gate.ok, true);

  console.log("Eval quality unit tests passed");
}
