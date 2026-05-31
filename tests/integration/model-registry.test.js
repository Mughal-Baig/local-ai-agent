#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { sha256File } = require("../../src/model-registry");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 9700 + Math.floor(Math.random() * 120);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-registry-api-"));
  const source = path.join(workspaceRoot, "tiny-Q5_K_M.gguf");
  await fsp.writeFile(source, Buffer.alloc(4096, 33));
  const sha256 = await sha256File(source);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(() => output);

    const pull = await streamPull({
      name: "tiny/q5",
      source: pathToFileURL(source).href,
      sha256,
      signature: sha256,
      tags: ["tiny", "api"]
    });
    assert.equal(pull.done, true);
    assert.equal(pull.progress, true);

    let list = await getJson("/api/model-registry");
    assert.equal(list.models.some((model) => model.name === "tiny/q5"), true);

    const shown = await getJson("/api/model-registry/show?name=tiny/q5");
    assert.equal(shown.model.verification.ok, true);
    assert.equal(shown.model.sha256, sha256);

    const created = await postJson("/api/model-registry/create", {
      name: "tiny/q5-derived",
      spec: "FROM tiny/q5\nPARAMETER temperature 0.1\nTAG derived"
    });
    assert.equal(created.model.kind, "derived");

    const copied = await postJson("/api/model-registry/cp", { from: "tiny/q5", to: "tiny/q5-copy" });
    assert.equal(copied.model.copiedFrom, "tiny/q5");

    const share = await postJson("/api/model-registry/share", { name: "tiny/q5-copy" });
    assert.equal(share.ok, true);

    const models = await getJson("/api/models");
    assert.equal(models.canManageRegistry, true);
    assert.equal(models.registryModels.some((model) => model.name === "tiny/q5-copy"), true);

    list = await getJson("/api/model-registry");
    assert.equal(list.models.length >= 3, true);
    console.log("Model registry integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function streamPull(body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}/api/model-registry/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, "registry pull should respond ok");
  const text = await response.text();
  return {
    progress: text.includes("event: progress"),
    done: text.includes("event: done")
  };
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
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
