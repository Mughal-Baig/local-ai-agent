#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
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
  const mockOllama = await startMockOllama();
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-config-admin-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: `http://127.0.0.1:${mockOllama.address().port}`
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
    assert.equal(admin.settings.some((setting) => setting.key === "AGENTTRAIL_PREFILL_REUSE" && /prefix/i.test(setting.description)), true);
    assert.equal(admin.settings.some((setting) => setting.key === "AGENTTRAIL_SPECULATIVE_DECODING" && /speculative/i.test(setting.description)), true);
    assert.equal(admin.settings.some((setting) => setting.key === "AGENTTRAIL_CACHE"), true);
    assert.equal(admin.overrides.path, ".agenttrail/workspace-config.json");

    const saved = await post("/api/config/workspace", {
      overrides: {
        OLLAMA_MODEL: "llama3.2:latest",
        OLLAMA_KEEP_ALIVE: "0",
        AGENTTRAIL_SPECULATIVE_DECODING: "ngram-simple",
        AGENTTRAIL_CACHE: "off",
        AGENTTRAIL_DEFAULT_STEP_BUDGET: "2"
      }
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.saved.requiresRestart, true);
    assert.equal(saved.admin.overrides.values.OLLAMA_MODEL, "llama3.2:latest");
    assert.equal(saved.admin.overrides.values.OLLAMA_KEEP_ALIVE, "0");
    assert.equal(saved.admin.overrides.values.AGENTTRAIL_SPECULATIVE_DECODING, "ngram-simple");
    assert.equal(saved.admin.restartRequired, true);
    assert.match(await fsp.readFile(path.join(workspaceRoot, ".agenttrail", "workspace-config.json"), "utf8"), /llama3\.2:latest/);

    const bad = await postRaw("/api/config/workspace", { overrides: { PORT: "not-a-port" } });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /PORT must be a number/);

    const onboarding = await get("/api/onboarding");
    assert.equal(onboarding.schema, "agenttrail.first-run.v1");
    assert.equal(Array.isArray(onboarding.steps), true);
    assert.equal(Array.isArray(onboarding.guidedSteps), true);
    assert.equal(onboarding.steps.some((step) => step.id === "config"), true);
    assert.equal(onboarding.guidedSteps.some((step) => step.id === "run-sample-task"), true);
    assert.equal(onboarding.items.length, onboarding.steps.length);

    const choices = await post("/api/onboarding", {
      action: "save-choices",
      workspaceChoice: workspaceRoot,
      modelChoice: "llama3.2"
    });
    assert.equal(choices.workspaceChoice.selected, workspaceRoot);
    assert.equal(choices.modelChoice.selected, "llama3.2");
    assert.equal(choices.telemetry.counts["choices-saved"], 1);

    const sample = await post("/api/onboarding", { action: "run-sample-task" });
    assert.equal(sample.sampleTask.status, "completed");
    assert.equal(sample.handoff.ready, true);
    assert.equal(sample.telemetry.counts["sample-task-completed"], 1);
    assert.match(await fsp.readFile(path.join(workspaceRoot, "first-run", "sample-typo.md"), "utf8"), /private/);
    assert.doesNotMatch(await fsp.readFile(path.join(workspaceRoot, "first-run", "sample-typo.md"), "utf8"), /privte/);
    assert.match(await fsp.readFile(path.join(workspaceRoot, "receipts", "first-run-safe-typo.md"), "utf8"), /First-run safe typo fix/);

    const handoff = await post("/api/onboarding", { action: "use-own-project" });
    assert.equal(handoff.completed, true);
    assert.equal(handoff.telemetry.counts["use-own-project-handoff"], 1);

    const completed = await post("/api/onboarding", { completed: true });
    assert.equal(completed.schema, "agenttrail.first-run.v1");
    assert.equal(completed.completed, true);
    assert.match(await fsp.readFile(path.join(workspaceRoot, ".agenttrail", "first-run.json"), "utf8"), /completed/);

    console.log("Config admin integration test passed");
  } finally {
    child.kill("SIGTERM");
    await closeServer(mockOllama);
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOllama() {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/tags")) {
      return json(res, { models: [{ name: "llama3.2", size: 123 }] });
    }
    return json(res, { error: "not found" }, 404);
  });
  return listen(server, 0);
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

function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function listen(server, requestedPort) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(requestedPort, "127.0.0.1");
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
