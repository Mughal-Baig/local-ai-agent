#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const projectRoot = path.resolve(__dirname, "..");
const COVERAGE_THRESHOLD = Number(process.env.COVERAGE_THRESHOLD || 60);
const COVERAGE_TARGETS = [
  "src/workspace-safety.js",
  "src/permissions.js",
  "src/privacy.js",
  "src/network-policy.js",
  "src/observability.js",
  "src/team-enterprise.js",
  "src/runtime-hardware.js",
  "src/runtime-loading.js",
  "src/features/security.js",
  "src/features/errors.js"
];
const TEST_COMMANDS = [
  ["tests/unit/workspace-safety-fuzz.test.js"],
  ["tests/unit/security-privacy.test.js"],
  ["tests/unit/observability.test.js"],
  ["tests/unit/team-enterprise.test.js"],
  ["tests/unit/runtime-hardware.test.js"],
  ["tests/unit/runtime-loading.test.js"]
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const coverageDir = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-v8-coverage-"));
  try {
    for (const args of TEST_COMMANDS) {
      const result = spawnSync(process.execPath, args, {
        cwd: projectRoot,
        env: {
          ...process.env,
          NODE_V8_COVERAGE: coverageDir
        },
        encoding: "utf8"
      });
      if (result.status !== 0) {
        process.stdout.write(result.stdout || "");
        process.stderr.write(result.stderr || "");
        throw new Error(`Coverage test command failed: node ${args.join(" ")}`);
      }
    }

    const report = await buildCoverageReport(coverageDir);
    printReport(report);
    assert.equal(report.summary.lineCoveragePct >= COVERAGE_THRESHOLD, true, `Coverage ${report.summary.lineCoveragePct}% is below ${COVERAGE_THRESHOLD}%`);
    if (process.argv.includes("--write")) {
      const outputPath = path.join(projectRoot, "docs/quality/coverage-report.json");
      await fsp.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }
  } finally {
    await fsp.rm(coverageDir, { recursive: true, force: true });
  }
}

async function buildCoverageReport(coverageDir) {
  const coverageEntries = await readCoverageEntries(coverageDir);
  const scriptsByPath = new Map();
  for (const script of coverageEntries) {
    const filePath = scriptPath(script.url);
    if (!filePath || !filePath.startsWith(projectRoot)) {
      continue;
    }
    const relative = slash(path.relative(projectRoot, filePath));
    if (!COVERAGE_TARGETS.includes(relative)) {
      continue;
    }
    if (!scriptsByPath.has(relative)) {
      scriptsByPath.set(relative, []);
    }
    scriptsByPath.get(relative).push(script);
  }

  const files = [];
  for (const relativePath of COVERAGE_TARGETS) {
    const absolutePath = path.join(projectRoot, relativePath);
    const source = await fsp.readFile(absolutePath, "utf8");
    const lines = sourceLines(source);
    const covered = new Set();
    for (const script of scriptsByPath.get(relativePath) || []) {
      markCoveredLines(source, lines, script, covered);
    }
    const total = lines.length;
    const coveredCount = covered.size;
    files.push({
      path: relativePath,
      lines: total,
      covered: coveredCount,
      pct: total ? Math.round((coveredCount / total) * 100) : 100
    });
  }

  const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
  const coveredLines = files.reduce((sum, file) => sum + file.covered, 0);
  return {
    schema: "agenttrail.coverage-report.v1",
    target: "v8-line-coverage",
    threshold: COVERAGE_THRESHOLD,
    commands: TEST_COMMANDS.map((args) => `node ${args.join(" ")}`),
    summary: {
      files: files.length,
      lines: totalLines,
      covered: coveredLines,
      lineCoveragePct: totalLines ? Math.round((coveredLines / totalLines) * 100) : 100
    },
    files
  };
}

async function readCoverageEntries(root) {
  const entries = [];
  const files = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of files) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      entries.push(...await readCoverageEntries(entryPath));
    } else if (entry.name.endsWith(".json")) {
      const parsed = JSON.parse(await fsp.readFile(entryPath, "utf8"));
      entries.push(...(parsed.result || []));
    }
  }
  return entries;
}

function markCoveredLines(source, lines, script, covered) {
  for (const fn of script.functions || []) {
    for (const range of fn.ranges || []) {
      if (range.count <= 0) {
        continue;
      }
      for (const line of lines) {
        if (range.endOffset > line.start && range.startOffset < line.end) {
          covered.add(line.number);
        }
      }
    }
  }
}

function sourceLines(source) {
  const lines = [];
  let offset = 0;
  const rawLines = source.split(/\r?\n/);
  for (let index = 0; index < rawLines.length; index += 1) {
    const text = rawLines[index];
    const trimmed = text.trim();
    const start = offset;
    const end = offset + text.length;
    offset = end + 1;
    if (!trimmed || trimmed === "\"use strict\";" || trimmed.startsWith("//")) {
      continue;
    }
    lines.push({ number: index + 1, start, end: Math.max(end, start + 1) });
  }
  return lines;
}

function scriptPath(url) {
  if (!url || url.startsWith("node:") || url.startsWith("internal/")) {
    return "";
  }
  try {
    return url.startsWith("file:") ? fileURLToPath(url) : url;
  } catch {
    return "";
  }
}

function printReport(report) {
  console.log(`Coverage gate - ${report.summary.lineCoveragePct}% lines (${report.summary.covered}/${report.summary.lines}), threshold ${report.threshold}%`);
  for (const file of report.files) {
    console.log(`Coverage gate - ${file.path}: ${file.pct}% (${file.covered}/${file.lines})`);
  }
  console.log("Coverage gate passed");
}

function slash(value) {
  return String(value || "").replace(/\\/g, "/");
}
