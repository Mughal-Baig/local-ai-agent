#!/usr/bin/env node
// T082/T085 — concurrency gate + backpressure. A mock Ollama delays /api/tags so
// the first chat holds the single slot; with maxConcurrency=1 maxQueue=0 the
// second simultaneous chat must get a 503 overload response.
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5500 + Math.floor(Math.random() * 150);
const ollamaPort = 5700 + Math.floor(Math.random() * 150);
main().catch((e) => { console.error(e); process.exit(1); });
async function main() {
  const mock = http.createServer((req, res) => {
    // Delay every response so an in-flight chat keeps holding the slot.
    setTimeout(() => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ models: [{ name: "llama3.2" }], response: "" })); }, 500);
  });
  mock.listen(ollamaPort, "127.0.0.1");
  const ws = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-conc-"));
  const child = spawn(process.execPath, ["server.js"], { cwd: projectRoot, env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: ws, OLLAMA_HOST: `http://127.0.0.1:${ollamaPort}`, AGENTTRAIL_MAX_CONCURRENCY: "1", AGENTTRAIL_MAX_QUEUE: "0" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", c => out += c); child.stderr.on("data", c => out += c);
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const status = await (await fetch(`http://127.0.0.1:${port}/api/concurrency`)).json();
    assert.equal(status.maxConcurrency, 1);
    assert.equal(status.maxQueue, 0);
    const chat = () => fetch(`http://127.0.0.1:${port}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], permissions: {}, securityMode: false }) });
    const a = chat();
    await new Promise(r => setTimeout(r, 60)); // let the first acquire the slot
    const b = await chat();
    assert.equal(b.status, 503, `second request should be rejected with 503, got ${b.status}`);
    assert.equal(b.headers.get("retry-after"), "2", "503 should include Retry-After");
    await a.catch(() => {});
    console.log("Concurrency backpressure test passed (second request 503)");
  } finally { child.kill("SIGTERM"); mock.close(); await fsp.rm(ws, { recursive: true, force: true }); }
}
