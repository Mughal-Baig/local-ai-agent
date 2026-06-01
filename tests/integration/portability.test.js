#!/usr/bin/env node
// Epic AH — portability archive, restore, isolation, migration plan, and scheduled backups.
"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5700 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-portability-"));
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
    await waitForServer(outputRef(() => output));

    const status = await getJson("/api/workspace/portability");
    assert.equal(status.schema, "agenttrail.workspace-portability.v1");
    assert.equal(status.workspace.schema, "agenttrail.workspace-profile.v1");
    assert.equal(status.workspace.isolation.workspaceScoped, true);
    assert.match(status.workspace.id, /^ws_/);

    const migrationPlan = await getJson("/api/workspace/migration-plan");
    assert.equal(migrationPlan.schema, "agenttrail.workspace-migration-plan.v1");
    assert.equal(migrationPlan.workspaceId, status.workspace.id);
    assert.equal(migrationPlan.steps.some((step) => step.includes("Copy workspace/backups")), true);

    const exported = await postJson("/api/backup/export", { includeWorkspaceFiles: false });
    assert.equal(exported.archiveVersion, 2);
    assert.equal(exported.workspaceId, status.workspace.id);
    assert.equal(exported.manifest.checksums.algorithm, "sha256");
    assert.equal(exported.path.startsWith("backups/agenttrail-archive-"), true);

    const archive = JSON.parse(await fsp.readFile(path.join(workspaceRoot, exported.path), "utf8"));
    const archivePaths = archive.items.map((item) => item.path);
    assert.equal(archivePaths.includes(".agenttrail/conversations/chat.json"), true);
    assert.equal(archivePaths.includes(".agenttrail/search-index.json"), true);
    assert.equal(archivePaths.includes("receipts/demo.md"), true);
    assert.equal(archivePaths.includes("memory/project-memory.md"), true);
    assert.equal(archivePaths.includes("notes/private.md"), false);

    const fullExport = await postJson("/api/backup/export", { includeWorkspaceFiles: true });
    const fullArchive = JSON.parse(await fsp.readFile(path.join(workspaceRoot, fullExport.path), "utf8"));
    assert.equal(fullArchive.items.some((item) => item.path === "notes/private.md"), true);

    const importArchive = {
      ...archive,
      items: archive.items.filter((item) => item.area === "workspace").slice(0, 6)
    };
    const imported = await postJson("/api/backup/import", { backup: importArchive });
    assert.equal(imported.ok, true);
    assert.equal(imported.workspaceMismatch, false);
    assert.equal(imported.restored.some((item) => item.includes("/workspace/.agenttrail/conversations/chat.json")), true);

    const schedule = await postJson("/api/backup/schedule", {
      enabled: true,
      intervalHours: 1,
      retentionCount: 1,
      includeWorkspaceFiles: false
    });
    assert.equal(schedule.schedule.schema, "agenttrail.backup-schedule.v1");
    assert.equal(schedule.schedule.enabled, true);
    assert.equal(schedule.schedule.retentionCount, 1);

    const scheduledRun = await postJson("/api/backup/schedule/run", { force: true });
    assert.equal(scheduledRun.ran, true);
    assert.equal(scheduledRun.backup.path.startsWith("backups/agenttrail-archive-"), true);
    assert.equal(Array.isArray(scheduledRun.pruned), true);

    const scheduleAfter = await getJson("/api/backup/schedule");
    assert.equal(Boolean(scheduleAfter.schedule.lastRunAt), true);
    assert.equal(scheduleAfter.destination, "backups/agenttrail-archive-*.json");

    console.log("Portability integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function seedWorkspace(workspaceRoot) {
  await fsp.mkdir(path.join(workspaceRoot, ".agenttrail", "conversations"), { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, "receipts"), { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, "memory"), { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, "notes"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, ".agenttrail", "conversations", "chat.json"), JSON.stringify({ title: "Portable chat" }), "utf8");
  await fsp.writeFile(path.join(workspaceRoot, ".agenttrail", "search-index.json"), JSON.stringify({ schema: "agenttrail.search-index.v1", items: [] }), "utf8");
  await fsp.writeFile(path.join(workspaceRoot, "receipts", "demo.md"), "# Receipt\nSearched before writing.\n", "utf8");
  await fsp.writeFile(path.join(workspaceRoot, "memory", "project-memory.md"), "# Memory\nUse receipt-first workflows.\n", "utf8");
  await fsp.writeFile(path.join(workspaceRoot, "notes", "private.md"), "# Private workspace file\nOnly export on full archive.\n", "utf8");
}

async function waitForServer(output) {
  for (let i = 0; i < 90; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${output.value()}`);
}

function outputRef(value) {
  return { value };
}

async function getJson(route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  if (!response.ok) {
    throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function postJson(route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if (!response.ok) {
    throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
