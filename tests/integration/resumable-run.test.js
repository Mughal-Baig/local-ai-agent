#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 5040 + Math.floor(Math.random() * 160);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-resume-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: workspaceRoot, OLLAMA_HOST: "http://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(() => output);

    const empty = await getJson("/api/runs/pending");
    assert.equal(empty.pending, null);

    const bad = await fetch(`http://127.0.0.1:${port}/api/runs/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "" })
    });
    assert.equal(bad.status, 400);

    await postJson("/api/runs/pending", {
      prompt: "Review billing refund flow",
      model: "llama3.2",
      selectedFiles: ["billing.md", "refunds.md"],
      permissions: { readFiles: true, writeFiles: false },
      securityMode: true
    });

    const saved = await getJson("/api/runs/pending");
    assert.equal(saved.pending.prompt, "Review billing refund flow");
    assert.equal(saved.pending.model, "llama3.2");
    assert.deepEqual(saved.pending.selectedFiles, ["billing.md", "refunds.md"]);
    assert.equal(saved.pending.permissions.readFiles, true);

    await postJson("/api/runs/pending/clear", {});
    const cleared = await getJson("/api/runs/pending");
    assert.equal(cleared.pending, null);

    console.log("Resumable run integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) {
        return;
      }
    } catch {
      // server still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
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
    body: JSON.stringify(body || {})
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}
