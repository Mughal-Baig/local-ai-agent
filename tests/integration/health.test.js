#!/usr/bin/env node
// T245 — health endpoint liveness check.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5400 + Math.floor(Math.random() * 150);
main().catch((e) => { console.error(e); process.exit(1); });
async function main() {
  const ws = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-health-"));
  const child = spawn(process.execPath, ["server.js"], { cwd: projectRoot, env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: ws, OLLAMA_HOST: "http://127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", c => out += c); child.stderr.on("data", c => out += c);
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const r = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(r.ok, true);
    const h = await r.json();
    assert.equal(h.ok, true, "health ok");
    assert.equal(h.status, "degraded");
    assert.equal(typeof h.uptimeSeconds, "number");
    assert.equal(typeof h.version, "string");
    assert.equal(typeof h.backend.title, "string");
    assert.equal(h.backend.available, false);
    assert.equal(h.checks.some((check) => check.id === "backend" && check.code === "MODEL_BACKEND"), true);
    console.log("Health test passed");
  } finally { child.kill("SIGTERM"); await fsp.rm(ws, { recursive: true, force: true }); }
}
