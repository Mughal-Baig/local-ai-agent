#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 6200 + Math.floor(Math.random() * 300);
let output = "";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-resilience-"));
  await fsp.mkdir(path.join(workspaceRoot, ".agenttrail"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, "notes.md"), "# Resilience\n\nsearch diff receipt\n", "utf8");
  await fsp.writeFile(path.join(workspaceRoot, ".agenttrail", "search-index.json"), "{ this is not json", "utf8");

  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1",
      AGENTTRAIL_BACKEND_RETRIES: "1",
      AGENTTRAIL_BACKEND_RETRY_BASE_MS: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  try {
    await waitForServer();

    const health = await get("/api/health");
    assert.equal(health.ok, true);
    assert.equal(health.status, "degraded");
    assert.equal(health.backend.available, false);
    assert.equal(health.checks.some((check) => check.id === "backend" && check.code === "MODEL_BACKEND"), true);

    const resilience = await get("/api/resilience");
    assert.equal(resilience.schema, "agenttrail.resilience.v1");
    assert.equal(resilience.status, "degraded");
    assert.equal(resilience.retryPolicy.backendRetries, 1);
    assert.equal(resilience.atomicWrites.strategy, "temp-file-rename");
    assert.equal(resilience.actions.some((action) => action.code === "MODEL_BACKEND"), true);

    const indexStatus = await get("/api/search-index");
    assert.equal(indexStatus.exists, true);
    assert.equal(indexStatus.health.corrupt, false);
    assert.equal(indexStatus.repair.rebuilt, true);
    assert.equal(indexStatus.provider, "local-vector");
    assert.equal(indexStatus.features.onDiskVectorStore, true);
    const repairedFiles = await fsp.readdir(path.join(workspaceRoot, ".agenttrail"));
    assert.equal(repairedFiles.some((name) => name.startsWith("search-index.json.corrupt-")), true);

    const write = await post("/api/files/content", { path: "safe-write.md", content: "# Atomic\n" });
    assert.equal(write.ok, true);
    assert.equal(write.atomic, true);
    assert.match(await fsp.readFile(path.join(workspaceRoot, "safe-write.md"), "utf8"), /# Atomic/);

    const taxonomy = await get("/api/errors/taxonomy");
    assert.equal(Boolean(taxonomy.taxonomy.DISK_SPACE), true);
    assert.equal(Boolean(taxonomy.taxonomy.CORRUPT_INDEX), true);
    assert.equal(Boolean(taxonomy.taxonomy.RETRY_EXHAUSTED), true);

    console.log("Resilience integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start.\n${output}`);
}

async function get(endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function post(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}
