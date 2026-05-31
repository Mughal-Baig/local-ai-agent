#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { chunkTextDetailed, rankChunks } = require("../src/features/search");
const { buildVectorAnnIndex } = require("../src/vector-store");
const { createUnifiedDiff, resolveWorkspacePath } = require("../src/workspace-safety");

const projectRoot = path.resolve(__dirname, "..");
const PERFORMANCE_BASELINE = process.env.PERFORMANCE_BASELINE || path.join(projectRoot, "docs/quality/performance-baseline.json");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const baseline = JSON.parse(await fsp.readFile(PERFORMANCE_BASELINE, "utf8"));
  const benchmarks = [
    benchmark("chunking", baseline.budgetsMs.chunking, () => {
      const corpus = buildCorpus(80);
      for (let i = 0; i < 15; i += 1) {
        chunkTextDetailed(corpus);
      }
    }),
    benchmark("ranking", baseline.budgetsMs.ranking, () => {
      const chunks = buildChunks(400);
      for (let i = 0; i < 120; i += 1) {
        rankChunks("local receipt diff preview search memory", chunks);
      }
    }),
    benchmark("ann-index", baseline.budgetsMs.annIndex, () => {
      const vectors = buildVectors(650, 24);
      for (let i = 0; i < 18; i += 1) {
        buildVectorAnnIndex(vectors, 8);
      }
    }),
    benchmark("path-diff-fuzz", baseline.budgetsMs.pathDiffFuzz, () => {
      for (let i = 0; i < 900; i += 1) {
        resolveWorkspacePath(projectRoot, `workspace/quality-${i}/note.md`);
        createUnifiedDiff("notes/perf.md", `a\nb\n${i}`, `a\nb\n${i}\nc`);
      }
    })
  ];

  const report = {
    schema: "agenttrail.performance-regression.v1",
    baseline: slash(path.relative(projectRoot, PERFORMANCE_BASELINE)),
    benchmarks,
    summary: {
      passed: benchmarks.filter((item) => item.ok).length,
      total: benchmarks.length,
      maxRatio: Math.max(...benchmarks.map((item) => item.ratio))
    }
  };

  for (const item of benchmarks) {
    console.log(`Performance regression - ${item.name}: ${item.durationMs}ms / ${item.budgetMs}ms (${item.ratio}x)`);
    assert.equal(item.ok, true, `${item.name} exceeded ${item.budgetMs}ms budget`);
  }
  console.log(`Performance regression passed (${report.summary.passed}/${report.summary.total})`);

  if (process.argv.includes("--write")) {
    await fsp.writeFile(path.join(projectRoot, "docs/quality/performance-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
}

function benchmark(name, budgetMs, fn) {
  const started = performance.now();
  fn();
  const durationMs = Math.max(1, Math.round(performance.now() - started));
  const budget = Number(budgetMs || 1);
  return {
    name,
    durationMs,
    budgetMs: budget,
    ratio: Number((durationMs / budget).toFixed(3)),
    ok: durationMs <= budget
  };
}

function buildCorpus(paragraphs) {
  const lines = [];
  for (let i = 0; i < paragraphs; i += 1) {
    lines.push(`# Section ${i}`);
    lines.push("");
    lines.push(`AgentTrail quality paragraph ${i} covers local search, diff preview, receipt replay, memory citations, model scoring, and safe writes.`);
    lines.push("");
  }
  return lines.join("\n");
}

function buildChunks(count) {
  const chunks = [];
  for (let i = 0; i < count; i += 1) {
    chunks.push({
      path: `docs/quality-${i}.md`,
      preview: `Local agent quality chunk ${i} with receipt diff preview search memory model benchmark and security checks.`,
      index: i,
      citation: `docs/quality-${i}.md:1`
    });
  }
  return chunks;
}

function buildVectors(count, dimensions) {
  const vectors = [];
  for (let i = 0; i < count; i += 1) {
    const embedding = [];
    for (let d = 0; d < dimensions; d += 1) {
      embedding.push(((i + 1) * (d + 3)) % 17 / 17);
    }
    vectors.push({
      id: `vector-${i}`,
      path: `docs/vector-${i}.md`,
      kind: i % 3 === 0 ? "file" : "chunk",
      embedding
    });
  }
  return vectors;
}

function slash(value) {
  return String(value || "").replace(/\\/g, "/");
}
