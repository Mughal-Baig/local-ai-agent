"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

const MIGRATIONS = [
  {
    id: "001-agenttrail-directories",
    title: "Ensure durable AgentTrail workspace directories",
    creates: [".agenttrail", "sessions", "receipts", "reports", "memory/history", "evals", "backups"]
  },
  {
    id: "002-schema-manifest",
    title: "Write schema version manifest",
    creates: [".agenttrail/schema-manifest.json"]
  },
  {
    id: "003-jsonl-store",
    title: "Enable append-only local store",
    creates: [".agenttrail/store.jsonl"]
  }
];

async function runMigrations(workspaceRoot, version) {
  const statePath = path.join(workspaceRoot, ".agenttrail", "migrations.json");
  const state = await readJson(statePath, { applied: [] });
  const applied = new Set(state.applied || []);
  const newlyApplied = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }
    for (const target of migration.creates || []) {
      const absolute = path.join(workspaceRoot, target);
      if (path.extname(absolute)) {
        await fsp.mkdir(path.dirname(absolute), { recursive: true });
        if (!(await exists(absolute))) {
          await fsp.writeFile(absolute, target.endsWith(".json") ? JSON.stringify({ version, createdAt: new Date().toISOString() }, null, 2) : "", "utf8");
        }
      } else {
        await fsp.mkdir(absolute, { recursive: true });
      }
    }
    applied.add(migration.id);
    newlyApplied.push(migration.id);
  }

  await fsp.mkdir(path.dirname(statePath), { recursive: true });
  await fsp.writeFile(statePath, JSON.stringify({
    schema: "agenttrail.migrations.v1",
    version,
    applied: Array.from(applied),
    updatedAt: new Date().toISOString()
  }, null, 2), "utf8");

  return {
    total: MIGRATIONS.length,
    applied: Array.from(applied),
    newlyApplied,
    pending: MIGRATIONS.filter((migration) => !applied.has(migration.id)).map((migration) => migration.id)
  };
}

async function migrationStatus(workspaceRoot) {
  const statePath = path.join(workspaceRoot, ".agenttrail", "migrations.json");
  const state = await readJson(statePath, { applied: [] });
  const applied = new Set(state.applied || []);
  return {
    total: MIGRATIONS.length,
    applied: Array.from(applied),
    pending: MIGRATIONS.filter((migration) => !applied.has(migration.id)).map((migration) => migration.id),
    migrations: MIGRATIONS
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function exists(filePath) {
  try {
    await fsp.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  MIGRATIONS,
  runMigrations,
  migrationStatus
};
