#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const port = 8650 + Math.floor(Math.random() * 150);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-memory-history-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));

  try {
    await waitForServer(() => output);
    const firstContent = [
      "# Project Memory",
      "",
      "## Facts",
      "- Original local fact.",
      "",
      "## Preferences",
      "- Prefer first memory."
    ].join("\n");
    const secondContent = [
      "# Project Memory",
      "",
      "## Facts",
      "- Updated local fact.",
      "",
      "## Decisions",
      "- Use second memory."
    ].join("\n");

    const first = await postJson("/api/memory", { content: firstContent });
    const firstId = path.basename(first.history.path, ".md");
    await delay(25);
    await postJson("/api/memory", { content: secondContent });

    const history = await getJson("/api/memory/history");
    assert.equal(history.schema, "agenttrail.memory-history.v1");
    assert.equal(history.revisions.length >= 2, true);
    assert.equal(history.revisions.some((item) => item.id === firstId), true);
    assert.equal(history.revisions.some((item) => item.counts.facts >= 1), true);

    const diff = await getJson(`/api/memory/history/diff?id=${encodeURIComponent(firstId)}`);
    assert.equal(diff.schema, "agenttrail.memory-history-diff.v1");
    assert.equal(diff.revision.id, firstId);
    assert.match(diff.diff.text, /Original local fact/);
    assert.equal(diff.diff.stats.added >= 1, true);

    const reverted = await postJson("/api/memory/history/revert", { id: firstId });
    assert.equal(reverted.restoredFrom.id, firstId);
    assert.equal(reverted.structured.memory.preferences.length, 1);

    const memory = await getJson("/api/memory");
    assert.match(memory.content, /Original local fact/);
    assert.doesNotMatch(memory.content, /Updated local fact/);

    const afterRevert = await getJson("/api/memory/history");
    assert.equal(afterRevert.revisions[0].reason, `revert:${firstId}`);

    console.log("Memory history integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function getJson(endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function postJson(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await delay(100);
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
