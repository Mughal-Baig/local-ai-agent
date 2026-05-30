#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { listSchemaSummaries, validateSchema, withSchema } = require("../../src/schemas");
const { evaluateToolPermission } = require("../../src/permissions");
const { listModelAdapters } = require("../../src/model-adapters");
const { JsonLineStore } = require("../../src/json-store");
const { runMigrations, migrationStatus } = require("../../src/migrations");
const { loadPlugins } = require("../../src/plugin-loader");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  assert.equal(listSchemaSummaries().length >= 10, true);
  assert.equal(validateSchema("session", withSchema("session", {
    title: "T",
    createdAt: new Date().toISOString(),
    model: "llama3.2",
    messages: [],
    selectedFiles: [],
    trail: []
  })).ok, true);

  assert.equal(evaluateToolPermission("write_file", { writeFiles: false }).ok, false);
  assert.equal(evaluateToolPermission("write_file", { writeFiles: true, previewWrites: true }).action, "preview");
  assert.equal(listModelAdapters({}).some((adapter) => adapter.id === "ollama"), true);

  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-foundation-"));
  try {
    const store = new JsonLineStore(tempRoot);
    await store.append("test", { ok: true });
    const stats = await store.stats();
    assert.equal(stats.count, 1);
    assert.equal(stats.byType.test, 1);

    const migrations = await runMigrations(tempRoot, "0.6.0");
    assert.equal(migrations.pending.length, 0);
    const status = await migrationStatus(tempRoot);
    assert.equal(status.applied.length >= 3, true);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }

  const plugins = await loadPlugins(path.resolve(__dirname, "../../plugins"));
  assert.equal(plugins.some((plugin) => plugin.id === "example-tool"), true);

  console.log("Foundation unit tests passed");
}
