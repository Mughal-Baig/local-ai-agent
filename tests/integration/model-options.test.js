#!/usr/bin/env node
// T095 — GPU-layer / context option passthrough. A mock Ollama captures the
// /api/generate body and asserts num_gpu/num_ctx from env are forwarded.
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5800 + Math.floor(Math.random() * 150);
const ollamaPort = 5950 + Math.floor(Math.random() * 40);
main().catch((e) => { console.error(e); process.exit(1); });
async function main() {
  let captured = null;
  const mock = http.createServer((req, res) => {
    if (req.url.startsWith("/api/tags")) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ models: [{ name: "llama3.2" }] })); }
    if (req.url.startsWith("/api/generate")) {
      let body = ""; req.on("data", c => body += c); req.on("end", () => { try { captured = JSON.parse(body); } catch {} res.writeHead(200, { "Content-Type": "application/x-ndjson" }); res.end(JSON.stringify({ response: "ok", done: true }) + "\n"); });
      return;
    }
    res.writeHead(404); res.end();
  });
  mock.listen(ollamaPort, "127.0.0.1");
  const ws = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-opts-"));
  const child = spawn(process.execPath, ["server.js"], { cwd: projectRoot, env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: ws, OLLAMA_HOST: `http://127.0.0.1:${ollamaPort}`, OLLAMA_NUM_GPU: "20", OLLAMA_NUM_CTX: "4096" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", c => out += c); child.stderr.on("data", c => out += c);
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const res = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], permissions: {}, securityMode: false }) });
    await res.text();
    await new Promise(r => setTimeout(r, 150));
    assert.ok(captured, "generate body should be captured");
    assert.equal(captured.options.num_gpu, 20, "num_gpu env should pass through");
    assert.equal(captured.options.num_ctx, 4096, "num_ctx env should pass through");
    console.log("Model options passthrough test passed");
  } finally { child.kill("SIGTERM"); mock.close(); await fsp.rm(ws, { recursive: true, force: true }); }
}
