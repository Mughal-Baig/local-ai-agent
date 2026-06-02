#!/usr/bin/env node

"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  runAgentQualitySuite
} = require("../src/eval-quality");

const projectRoot = path.resolve(__dirname, "..");
const reportPath = path.join(projectRoot, "docs", "quality", "agent-eval-report.json");
const trendPath = path.join(projectRoot, "docs", "quality", "agent-eval-trend.json");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const history = await readTrend();
  const models = String(process.env.AGENTTRAIL_EVAL_MODELS || "agenttrail-audit,agenttrail-fast")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const suite = runAgentQualitySuite({
    models,
    history,
    minScore: Number(process.env.AGENTTRAIL_AGENT_EVAL_MIN_SCORE || 85),
    maxRegression: Number(process.env.AGENTTRAIL_AGENT_EVAL_MAX_DROP || 5)
  });

  await fsp.mkdir(path.dirname(reportPath), { recursive: true });
  await fsp.writeFile(reportPath, `${JSON.stringify(suite, null, 2)}\n`, "utf8");
  await fsp.writeFile(trendPath, `${JSON.stringify(suite.gate.trend, null, 2)}\n`, "utf8");

  console.log(`Agent task eval - score ${suite.current.score}/100 (${suite.current.passed}/${suite.current.total})`);
  console.log(`Agent task eval - winner ${suite.comparison.winner ? suite.comparison.winner.model : "none"}`);
  console.log(`Agent task eval - regression gate ${suite.gate.ok ? "passed" : "failed"} (delta ${suite.gate.delta})`);
  if (!suite.gate.ok) {
    throw new Error(suite.gate.reason);
  }
}

async function readTrend() {
  try {
    const parsed = JSON.parse(await fsp.readFile(trendPath, "utf8"));
    return Array.isArray(parsed.history) ? parsed.history : [];
  } catch {
    return [];
  }
}
