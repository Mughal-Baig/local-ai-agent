#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { validateConfig } = require("../../src/config");
const {
  CONFIG_ADMIN_SCHEMA,
  FIRST_RUN_SCHEMA,
  WORKSPACE_CONFIG_SCHEMA,
  applyWorkspaceConfigOverridesSync,
  buildConfigAdmin,
  buildFirstRunWizard,
  readWorkspaceConfig,
  writeFirstRunState,
  writeWorkspaceConfig
} = require("../../src/config-admin");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-config-admin-unit-"));
  try {
    const validation = validateConfig({
      PORT: "abc",
      OLLAMA_HOST: "127.0.0.1:11434",
      OLLAMA_MODEL: "",
      OLLAMA_EMBED_MODEL: "nomic-embed-text",
      MAX_TOOL_ITERATIONS: "99"
    }, { workspaceRoot });
    assert.equal(validation.schema, "agenttrail.config-status.v1");
    assert.equal(validation.ok, false);
    assert.equal(validation.failed.some((check) => check.env === "PORT" && /port/i.test(check.action)), true);
    assert.match(validation.friendlySummary, /OLLAMA_HOST/);

    const saved = await writeWorkspaceConfig(workspaceRoot, {
      overrides: {
        OLLAMA_MODEL: "llama3.2:latest",
        AGENTTRAIL_CACHE: "off",
        MAX_TOOL_ITERATIONS: 6,
        PORT: "4188"
      }
    });
    assert.equal(saved.schema, WORKSPACE_CONFIG_SCHEMA);
    assert.equal(saved.requiresRestart, true);
    assert.equal(saved.overrideCount, 4);

    const config = await readWorkspaceConfig(workspaceRoot);
    assert.equal(config.overrides.OLLAMA_MODEL, "llama3.2:latest");
    assert.equal(config.overrides.AGENTTRAIL_CACHE, "off");

    const env = {};
    const boot = applyWorkspaceConfigOverridesSync(workspaceRoot, env);
    assert.deepEqual(boot.appliedKeys.sort(), ["AGENTTRAIL_CACHE", "MAX_TOOL_ITERATIONS", "OLLAMA_MODEL", "PORT"].sort());
    assert.equal(env.OLLAMA_MODEL, "llama3.2:latest");
    assert.equal(env.PORT, "4188");

    const envWins = { PORT: "9999" };
    const shadowed = applyWorkspaceConfigOverridesSync(workspaceRoot, envWins);
    assert.equal(envWins.PORT, "9999");
    assert.equal(shadowed.shadowedKeys.includes("PORT"), true);

    const admin = await buildConfigAdmin(env, {
      workspaceRoot,
      appliedWorkspaceKeys: boot.appliedKeys,
      validation: validateConfig(env, { workspaceRoot, appliedWorkspaceKeys: boot.appliedKeys })
    });
    assert.equal(admin.schema, CONFIG_ADMIN_SCHEMA);
    assert.equal(admin.groups.some((group) => group.id === "model"), true);
    assert.equal(admin.settings.some((setting) => setting.key === "OLLAMA_MODEL" && setting.source === "workspace"), true);
    assert.equal(admin.validation.ok, true);

    await assert.rejects(
      () => writeWorkspaceConfig(workspaceRoot, { overrides: { NOT_REAL: "x" } }),
      /Unknown config key/
    );

    const firstRun = await writeFirstRunState(workspaceRoot, { completed: true });
    assert.equal(firstRun.schema, FIRST_RUN_SCHEMA);
    assert.equal(firstRun.completed, true);

    const wizard = buildFirstRunWizard({
      version: "0.0.0",
      state: firstRun,
      configStatus: { ok: true, failed: [] },
      modelStatus: { available: true },
      files: [{ path: "welcome.md" }],
      packs: [{ id: "coder" }, { id: "founder" }, { id: "security" }, { id: "student" }, { id: "writer" }],
      foundation: { score: 95 },
      searchIndexReady: true,
      desktop: { enabled: false }
    });
    assert.equal(wizard.schema, FIRST_RUN_SCHEMA);
    assert.equal(wizard.completed, true);
    assert.equal(wizard.steps.some((step) => step.id === "config" && step.ok), true);

    console.log("Config admin unit test passed");
  } finally {
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}
