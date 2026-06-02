#!/usr/bin/env node

"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  benchmarkModels,
  compareModels
} = require("../src/eval-quality");

const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "docs", "quality", "agent-model-benchmark.json");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const models = String(process.env.AGENTTRAIL_BENCHMARK_MODELS || "agenttrail-audit,agenttrail-fast")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const benchmark = benchmarkModels(models);
  const comparison = compareModels(models);
  const report = {
    schema: "agenttrail.agent-model-benchmark-report.v1",
    createdAt: new Date().toISOString(),
    comparison,
    benchmark
  };
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  for (const row of benchmark.models) {
    console.log(`Agent model benchmark - ${row.model}: avg ${row.avgLatencyMs}ms, ${row.avgTokensPerSecond} tok/s`);
  }
  console.log(`Agent model benchmark - winner ${comparison.winner ? comparison.winner.model : "none"}`);
}
