#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const port = 8500 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-memory-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));

  try {
    await waitForServer(() => output);
    const content = [
      "# Project Memory",
      "",
      "## Facts",
      "- AgentTrail runs locally on the user's machine.",
      "",
      "## Preferences",
      "- Prefer preview-first writes.",
      "",
      "## Decisions",
      "- Use structured memory JSON for future agent context."
    ].join("\n");

    const saved = await postJson("/api/memory", { content });
    assert.equal(saved.ok, true);
    assert.equal(saved.structured.memory.schema, "agenttrail.project-memory.v1");
    assert.equal(saved.structured.memory.facts.length, 1);
    assert.equal(saved.structured.memory.preferences.length, 1);
    assert.equal(saved.structured.memory.decisions.length, 1);
    assert.match(saved.structured.memory.preferences[0].text, /preview-first/);

    const structured = await getJson("/api/memory/structured");
    assert.equal(structured.schema, "agenttrail.project-memory.v1");
    assert.equal(structured.preferences[0].source.path, "memory/project-memory.md");

    const memory = await getJson("/api/memory");
    assert.equal(memory.structured.decisions.length, 1);

    const citations = await getJson("/api/memory/citations?query=preview");
    assert.equal(citations.citations.some((item) => item.path === "memory/project-memory.json" && item.type === "preference"), true);

    console.log("Structured memory integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
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
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
