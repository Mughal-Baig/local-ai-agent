#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 5700 + Math.floor(Math.random() * 300);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-api-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: workspaceRoot, OLLAMA_HOST: "http://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  try {
    await waitForServer();
    await post("/api/files/content", { path: "notes/api.md", content: "# API\n\nsemantic receipt replay\n" });
    await post("/api/search-index", { provider: "local-vector" });

    const endpoints = [
      "/api/status",
      "/api/foundation",
      "/api/routes",
      "/api/config",
      "/api/schemas",
      "/api/permissions",
      "/api/sqlite/status",
      "/api/watch/status",
      "/api/plugins",
      "/api/search?query=semantic",
      "/api/search/chunks?query=receipt",
      "/api/onboarding",
      "/api/demo/public",
      "/api/models/compare",
      "/api/benchmarks/history",
      "/api/releases/signing-plan"
    ];
    for (const endpoint of endpoints) {
      const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
      assert.equal(response.ok, true, endpoint);
    }

    const badge = await post("/api/trust/badge", { score: 96, label: "run" });
    assert.match(badge.svg, /AgentTrail/);

    const plugin = await post("/api/plugins/run", {
      pluginId: "example-tool",
      tool: "example.echo",
      input: { text: "hello" }
    });
    assert.equal(plugin.output, "hello");

    console.log("API integration tests passed");
  } finally {
    child.kill();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function waitForServer() {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Server did not start");
}

async function post(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}
