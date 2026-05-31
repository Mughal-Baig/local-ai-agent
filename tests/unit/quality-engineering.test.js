#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const pkg = JSON.parse(await read("package.json"));
  const ci = await read(".github/workflows/ci.yml");
  const matrix = await read(".github/workflows/quality-matrix.yml");
  const coverage = await read("scripts/coverage-report.js");
  const perf = await read("scripts/performance-regression.js");
  const evalHarness = await read("scripts/evaluate-agenttrail.js");
  const scoreboard = JSON.parse(await read("docs/quality/eval-scoreboard.json"));
  const ui = await read("tests/ui/playwright-smoke.test.js");
  const docs = await read("docs/QUALITY_ENGINEERING.md");

  assert.equal(pkg.scripts["test:quality"], "node tests/unit/quality-engineering.test.js && node tests/unit/workspace-safety-fuzz.test.js");
  assert.equal(pkg.scripts.coverage, "node scripts/coverage-report.js");
  assert.equal(pkg.scripts["bench:quality"], "node scripts/performance-regression.js");
  assert.match(ci, /node scripts\/coverage-report\.js/);
  assert.match(ci, /node scripts\/performance-regression\.js/);
  assert.match(ci, /node tests\/ui\/playwright-smoke\.test\.js/);
  assert.match(matrix, /ubuntu-latest/);
  assert.match(matrix, /macos-latest/);
  assert.match(matrix, /windows-latest/);
  assert.match(matrix, /node-version: \${{ matrix.node }}/);
  assert.match(coverage, /NODE_V8_COVERAGE/);
  assert.match(coverage, /COVERAGE_THRESHOLD/);
  assert.match(perf, /agenttrail.performance-regression.v1/);
  assert.match(perf, /PERFORMANCE_BASELINE/);
  assert.match(evalHarness, /scoreboard/);
  assert.match(evalHarness, /categoryFor/);
  assert.equal(scoreboard.schema, "agenttrail.eval-scoreboard.v1");
  assert.equal(scoreboard.categories.some((item) => item.category === "quality"), true);
  assert.match(ui, /playwright/);
  assert.match(ui, /UI E2E/);
  assert.match(docs, /Coverage gate/);
  assert.match(docs, /Performance regression/);
  assert.match(docs, /Cross-platform matrix/);

  console.log("Quality engineering unit tests passed");
}

async function read(relativePath) {
  return fsp.readFile(path.join(projectRoot, relativePath), "utf8");
}
