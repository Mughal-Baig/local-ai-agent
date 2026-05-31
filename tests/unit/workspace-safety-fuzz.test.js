#!/usr/bin/env node

const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const {
  MAX_DIFF_TEXT,
  createUnifiedDiff,
  isWorkspacePathSafe,
  normalizeRelativePath,
  resolveWorkspacePath,
  validateRelativePath
} = require("../../src/workspace-safety");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = path.join(os.tmpdir(), "agenttrail-fuzz-root");
  fuzzWorkspacePaths(workspaceRoot);
  fuzzUnifiedDiffs();
  console.log("Workspace safety fuzz tests passed");
}

function fuzzWorkspacePaths(workspaceRoot) {
  const rng = lcg(173);
  const safeSegments = ["notes", "src", "receipts", "memory", "space name", "dash-name", "under_score", "file.md"];
  const unsafeSeeds = [
    "../secret.txt",
    "..\\secret.txt",
    "/etc/passwd",
    "\\Windows\\system32",
    "C:\\Users\\secret.txt",
    "D:/models/private.gguf",
    "safe/\0bad.md",
    "safe\nbad.md",
    "safe\rbad.md"
  ];

  for (const candidate of unsafeSeeds) {
    assert.equal(isWorkspacePathSafe(workspaceRoot, candidate), false, `${candidate} should be rejected`);
    assert.throws(() => resolveWorkspacePath(workspaceRoot, candidate), /workspace|control/i);
  }

  for (let i = 0; i < 500; i += 1) {
    const parts = [];
    const depth = 1 + Math.floor(rng() * 5);
    for (let j = 0; j < depth; j += 1) {
      parts.push(safeSegments[Math.floor(rng() * safeSegments.length)]);
    }
    const candidate = parts.join(rng() > 0.5 ? "/" : "\\");
    const absolute = resolveWorkspacePath(workspaceRoot, candidate);
    const relative = path.relative(path.resolve(workspaceRoot), absolute);
    assert.equal(relative.startsWith(".."), false, `${candidate} should stay inside workspace`);
    assert.equal(path.isAbsolute(relative), false, `${candidate} should resolve relatively`);
    assert.equal(normalizeRelativePath(candidate).includes("\\"), false);
  }

  const traversalPieces = ["..", "../..", "safe/../../outside", "safe\\..\\..\\outside"];
  for (const candidate of traversalPieces) {
    assert.equal(isWorkspacePathSafe(workspaceRoot, candidate), false, `${candidate} traversal should escape`);
  }

  assert.equal(normalizeRelativePath(" /notes/demo.md "), "/notes/demo.md");
  assert.equal(validateRelativePath(" notes/demo.md "), "notes/demo.md");
}

function fuzzUnifiedDiffs() {
  const rng = lcg(176);
  const words = ["alpha", "beta", "gamma", "delta", "receipt", "preview", "search", "memory", "model"];

  for (let i = 0; i < 400; i += 1) {
    const before = randomLines(rng, words, Math.floor(rng() * 12));
    const after = mutateLines(rng, words, before);
    const diff = createUnifiedDiff("notes/fuzz.md", before.join("\n"), after.join("\n"));

    assert.match(diff.text, /^--- a\/notes\/fuzz\.md\n\+\+\+ b\/notes\/fuzz\.md/);
    assert.equal(diff.text.length <= MAX_DIFF_TEXT + 32, true);
    assert.equal(Number.isInteger(diff.stats.added), true);
    assert.equal(Number.isInteger(diff.stats.removed), true);
    assert.equal(diff.stats.added >= 0, true);
    assert.equal(diff.stats.removed >= 0, true);

    if (before.join("\n") === after.join("\n")) {
      assert.deepEqual(diff.stats, { added: 0, removed: 0 });
      assert.match(diff.text, /no changes/);
    } else {
      assert.equal(diff.stats.added <= after.length, true);
      assert.equal(diff.stats.removed <= before.length, true);
      assert.equal(diff.stats.added + diff.stats.removed > 0, true);
    }
  }

  const append = createUnifiedDiff("notes/add.md", "one\ntwo", "one\ntwo\nthree");
  assert.deepEqual(append.stats, { added: 1, removed: 0 });
  assert.match(append.text, /\+three/);

  const remove = createUnifiedDiff("notes/remove.md", "one\ntwo\nthree", "one\nthree");
  assert.deepEqual(remove.stats, { added: 0, removed: 1 });
  assert.match(remove.text, /-two/);
}

function randomLines(rng, words, count) {
  const lines = [];
  for (let i = 0; i < count; i += 1) {
    const width = 1 + Math.floor(rng() * 5);
    const line = [];
    for (let j = 0; j < width; j += 1) {
      line.push(words[Math.floor(rng() * words.length)]);
    }
    lines.push(line.join(" "));
  }
  return lines;
}

function mutateLines(rng, words, before) {
  const after = before.slice();
  const operations = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < operations; i += 1) {
    const op = Math.floor(rng() * 3);
    const index = Math.floor(rng() * (after.length + 1));
    if (op === 0 || after.length === 0) {
      after.splice(index, 0, randomLines(rng, words, 1)[0]);
    } else if (op === 1) {
      after.splice(Math.min(index, after.length - 1), 1);
    } else {
      after[Math.min(index, after.length - 1)] = randomLines(rng, words, 1)[0];
    }
  }
  return after;
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
