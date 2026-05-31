#!/usr/bin/env node
// Epic O (T099-T103) resources + Phase 6 runtime seam.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5300 + Math.floor(Math.random() * 150);
main().catch((e) => { console.error(e); process.exit(1); });
async function main() {
  const ws = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-res-"));
  const child = spawn(process.execPath, ["server.js"], { cwd: projectRoot, env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: ws, OLLAMA_HOST: "http://127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", c => out += c); child.stderr.on("data", c => out += c);
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const r = await (await fetch(`http://127.0.0.1:${port}/api/resources`)).json();
    assert.equal(r.cpu.count > 0, true, "cpu count");
    assert.equal(r.memory.total > 0, true, "memory total");
    assert.equal(typeof r.recommendedQuantization, "string");
    assert.equal(Array.isArray(r.models), true, "models array");
    assert.equal(r.contextLength > 0, true, "context length");
    const rt = await (await fetch(`http://127.0.0.1:${port}/api/runtime`)).json();
    assert.equal(typeof rt.bundledRuntime.installed, "boolean");
    assert.equal(typeof rt.bundledRuntime.hardware.selectedBackend, "string");
    assert.equal(typeof rt.bundledRuntime.hardware.threading.effective, "number");
    assert.equal(typeof rt.bundledRuntime.loading.quantization.value, "string");
    assert.equal(typeof rt.bundledRuntime.loading.batching.batchSize, "number");
    assert.equal(typeof rt.activeBackend.id, "string");
    console.log("Resources + runtime test passed");
  } finally { child.kill("SIGTERM"); await fsp.rm(ws, { recursive: true, force: true }); }
}
