#!/usr/bin/env node
"use strict";

// T156/T240 - /api/redact masks secrets over HTTP.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5350 + Math.floor(Math.random() * 150);

main().catch((e) => { console.error(e); process.exit(1); });

async function main() {
  const ws = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-redact-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: ws,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let out = "";
  child.stdout.on("data", (c) => { out += c; });
  child.stderr.on("data", (c) => { out += c; });
  try {
    await waitForServer(() => out);
    const response = await fetch(`http://127.0.0.1:${port}/api/redact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "key sk-ABCDEFGHIJKLMNOPQRSTUV12345 and AKIAIOSFODNN7EXAMPLE done" })
    });
    assert.equal(response.ok, true);
    const r = await response.json();
    assert.equal(r.count >= 2, true, `expected >=2 redactions, got ${r.count}`);
    assert.equal(/sk-ABCD|AKIAIOSF/.test(r.redacted), false, "secrets removed");
    assert.equal(r.redacted.includes("done"), true, "surrounding text kept");
    console.log("Redact endpoint test passed");
  } finally { child.kill("SIGTERM"); await fsp.rm(ws, { recursive: true, force: true }); }
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
