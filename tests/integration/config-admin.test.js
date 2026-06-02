#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 6500 + Math.floor(Math.random() * 250);
let output = "";
let childExit = null;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-config-admin-"));
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
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.once("exit", (code, signal) => {
    childExit = { code, signal };
  });

  try {
    await waitForServer();

    const config = await get("/api/config");
    assert.equal(config.schema, "agenttrail.config-status.v1");
    assert.equal(config.ok, true);
    assert.equal(config.groups.some((group) => group.id === "model"), true);

    const admin = await get("/api/config/admin");
    assert.equal(admin.schema, "agenttrail.config-admin.v1");
    assert.equal(admin.settings.some((setting) => setting.key === "OLLAMA_MODEL"), true);
    assert.equal(admin.settings.some((setting) => setting.key === "OLLAMA_KEEP_ALIVE" && /unload/i.test(setting.description)), true);
    assert.equal(admin.settings.some((setting) => setting.key === "AGENTTRAIL_CACHE"), true);
    assert.equal(admin.overrides.path, ".agenttrail/workspace-config.json");

    const saved = await post("/api/config/workspace", {
      overrides: {
        OLLAMA_MODEL: "llama3.2:latest",
        OLLAMA_KEEP_ALIVE: "0",
        AGENTTRAIL_CACHE: "off",
        AGENTTRAIL_DEFAULT_STEP_BUDGET: "2"
      }
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.saved.requiresRestart, true);
    assert.equal(saved.admin.overrides.values.OLLAMA_MODEL, "llama3.2:latest");
    assert.equal(saved.admin.overrides.values.OLLAMA_KEEP_ALIVE, "0");
    assert.equal(saved.admin.restartRequired, true);
    assert.match(await fsp.readFile(path.join(workspaceRoot, ".agenttrail", "workspace-config.json"), "utf8"), /llama3\.2:latest/);

    const bad = await postRaw("/api/config/workspace", { overrides: { PORT: "not-a-port" } });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /PORT must be a number/);

    const onboarding = await get("/api/onboarding");
    assert.equal(onboarding.schema, "agenttrail.first-run.v1");
    assert.equal(Array.isArray(onboarding.steps), true);
    assert.equal(onboarding.steps.some((step) => step.id === "config"), true);
    assert.equal(onboarding.items.length, onboarding.steps.length);

    const completed = await post("/api/onboarding", { completed: true });
    assert.equal(completed.schema, "agenttrail.first-run.v1");
    assert.equal(completed.completed, true);
    assert.match(await fsp.readFile(path.join(workspaceRoot, ".agenttrail", "first-run.json"), "utf8"), /completed/);

    console.log("Config admin integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (childExit) {
      throw new Error(`Server exited before startup: ${JSON.stringify(childExit)}\n${output}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not start.\n${output}`);
}

async function get(endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function post(endpoint, body) {
  const response = await postRaw(endpoint, body);
  assert.equal(response.ok, true, endpoint);
  return response.body;
}

async function postRaw(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const parsed = await response.json();
  return { ok: response.ok, status: response.status, body: parsed };
}
