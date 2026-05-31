#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 9300 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-bundled-"));
  const modelPath = path.join(workspaceRoot, "models", "mock.gguf");
  await fsp.mkdir(path.dirname(modelPath), { recursive: true });
  await fsp.writeFile(modelPath, Buffer.alloc(4096, 7));

  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "bundled",
      AGENTTRAIL_BUNDLED_RUNTIME_MODULE: "tests/fixtures/mock-bundled-runtime.js",
      AGENTTRAIL_GGUF_MODEL: modelPath,
      AGENTTRAIL_BUNDLED_MODEL_NAME: "mock-gguf",
      AGENTTRAIL_CACHE: "off",
      AGENTTRAIL_NATIVE_TOOLS: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(() => output);

    const runtime = await getJson("/api/runtime");
    assert.equal(runtime.activeBackend.api, "bundled");
    assert.equal(runtime.bundledRuntime.installed, true);
    assert.equal(runtime.bundledRuntime.available, true);
    assert.equal(runtime.bundledRuntime.model.exists, true);
    assert.equal(runtime.bundledRuntime.modelName, "mock-gguf");

    const status = await getJson("/api/status");
    assert.equal(status.backend.api, "bundled");
    assert.equal(status.ollama.available, true);
    assert.equal(status.ollama.models.some((model) => model.name === "mock-gguf"), true);

    const models = await getJson("/v1/models");
    assert.equal(models.data.some((model) => model.id === "mock-gguf"), true);

    const embedding = await postJson("/v1/embeddings", {
      model: "mock-gguf",
      input: "local bundled embedding"
    });
    assert.deepEqual(embedding.data[0].embedding.slice(0, 3), [0.11, 0.22, 0.33]);

    const text = await streamChat("mock-gguf", "Say the bundled phrase.");
    assert.match(text, /bundled runtime ok/);

    const structured = await postJson("/api/structured-output", {
      model: "mock-gguf",
      schemaId: "task-list",
      prompt: "Extract one task."
    });
    assert.equal(structured.ok, true);
    assert.equal(structured.output.tasks[0].title, "Ship bundled runtime");

    console.log("Bundled runtime integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function streamChat(model, content) {
  const response = await fetch(`http://127.0.0.1:${agentPort}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      selectedFiles: [],
      permissions: {},
      securityMode: false,
      stepBudget: { maxSteps: 1 }
    })
  });
  assert.equal(response.ok, true, "chat request should succeed");
  const body = await response.text();
  let text = "";
  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const data = JSON.parse(line.slice(5).trim());
      if (data && typeof data.text === "string") text += data.text;
    } catch {
      // ignore non-token events
    }
  }
  return text;
}

async function getJson(route) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${route}`);
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function postJson(route, body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${agentPort}/api/health`);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
