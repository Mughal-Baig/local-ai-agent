#!/usr/bin/env node
// Epic AI — privacy dashboard, retention, wipe, and opt-in local analytics.
"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5900 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-privacy-"));
  await seedWorkspace(workspaceRoot);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  try {
    await waitForServer(() => output);

    const dashboard = await getJson("/api/privacy/dashboard");
    assert.equal(dashboard.schema, "agenttrail.privacy-dashboard.v1");
    assert.equal(dashboard.localOnly, true);
    assert.equal(dashboard.artifacts.some((item) => item.id === "receipts" && item.count >= 2), true);
    assert.equal(dashboard.settings.localAnalytics.enabled, false);

    const observabilityOff = await getJson("/api/observability");
    assert.equal(observabilityOff.analytics.schema, "agenttrail.local-analytics.v1");
    assert.equal(observabilityOff.analytics.enabled, false);

    const settings = await postJson("/api/privacy/settings", { localAnalytics: { enabled: true } });
    assert.equal(settings.schema, "agenttrail.privacy-settings.v1");
    assert.equal(settings.localAnalytics.enabled, true);
    assert.equal(settings.localAnalytics.network, "disabled");

    const observabilityOn = await getJson("/api/observability");
    assert.equal(observabilityOn.analytics.enabled, true);
    assert.equal(observabilityOn.analytics.network, "disabled");
    assert.equal(await exists(path.join(workspaceRoot, ".agenttrail", "local-analytics.json")), true);

    const policy = await postJson("/api/privacy/retention", { artifacts: { receipts: 1, conversations: 0, logs: 0, settings: 0 } });
    assert.equal(policy.schema, "agenttrail.retention-policy.v1");
    assert.equal(policy.artifacts.receipts, 1);

    const retentionPreview = await postJson("/api/privacy/retention/apply", { dryRun: true });
    assert.equal(retentionPreview.schema, "agenttrail.retention-apply.v1");
    assert.equal(retentionPreview.dryRun, true);
    assert.equal(retentionPreview.deleted.some((item) => item.path === "receipts/old.md"), true);
    assert.equal(await exists(path.join(workspaceRoot, "receipts", "old.md")), true);

    const retentionApply = await postJson("/api/privacy/retention/apply", { dryRun: false });
    assert.equal(retentionApply.dryRun, false);
    assert.equal(retentionApply.deleted.some((item) => item.path === "receipts/old.md"), true);
    assert.equal(await exists(path.join(workspaceRoot, "receipts", "old.md")), false);
    assert.equal(await exists(path.join(workspaceRoot, "receipts", "new.md")), true);

    const wipePreview = await postJson("/api/privacy/wipe", { dryRun: true });
    assert.equal(wipePreview.schema, "agenttrail.local-data-wipe.v1");
    assert.equal(wipePreview.dryRun, true);
    assert.equal(wipePreview.fileCount > 0, true);
    assert.equal(wipePreview.files.some((item) => item.path === "memory/project-memory.md"), true);

    const wipe = await postJson("/api/privacy/wipe", { dryRun: false, confirm: "WIPE LOCAL DATA" });
    assert.equal(wipe.dryRun, false);
    assert.equal(wipe.deletedPaths.includes("memory"), true);
    assert.equal(await exists(path.join(workspaceRoot, "memory", "project-memory.md")), false);
    assert.equal(await exists(path.join(workspaceRoot, ".agenttrail", "conversations", "chat.json")), false);

    console.log("Privacy controls integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function seedWorkspace(workspaceRoot) {
  await fsp.mkdir(path.join(workspaceRoot, ".agenttrail", "conversations"), { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, "receipts"), { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, "memory"), { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, "reports"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, ".agenttrail", "conversations", "chat.json"), JSON.stringify({ title: "Private chat" }), "utf8");
  await fsp.writeFile(path.join(workspaceRoot, "receipts", "old.md"), "# Old receipt\n", "utf8");
  await fsp.writeFile(path.join(workspaceRoot, "receipts", "new.md"), "# New receipt\n", "utf8");
  await fsp.writeFile(path.join(workspaceRoot, "memory", "project-memory.md"), "# Memory\nKeep private.\n", "utf8");
  await fsp.writeFile(path.join(workspaceRoot, "reports", "summary.md"), "# Report\n", "utf8");
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await fsp.utimes(path.join(workspaceRoot, "receipts", "old.md"), old, old);
}

async function waitForServer(output) {
  for (let i = 0; i < 90; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${output()}`);
}

async function exists(filePath) {
  return Boolean(await fsp.stat(filePath).catch(() => null));
}

async function getJson(route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  if (!response.ok) throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function postJson(route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if (!response.ok) throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  return response.json();
}
