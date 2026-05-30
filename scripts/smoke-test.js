#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const port = 4900 + Math.floor(Math.random() * 700);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "local-agent-workspace-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
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
    await waitForServer(port, () => output);

  const home = await fetchText(`http://127.0.0.1:${port}/`);
  assert.match(home, /Local AI Agent/);

  const demo = await fetchText(`http://127.0.0.1:${port}/docs/demo.html`);
  assert.match(demo, /Tiny local agent kit/);

  const status = await fetchJson(`http://127.0.0.1:${port}/api/status`);
    assert.equal(status.app, "ok");
    assert.equal(status.ollama.available, false);

    const recipes = await fetchJson(`http://127.0.0.1:${port}/api/recipes`);
    assert.equal(Array.isArray(recipes.recipes), true);
    assert.equal(recipes.recipes.some((recipe) => recipe.id === "code-review"), true);

    const write = await postJson(`http://127.0.0.1:${port}/api/files/content`, {
      path: "notes/test.md",
      content: "# Test\n\nSmoke test content.\n"
    });
    assert.equal(write.ok, true);

    const file = await fetchJson(`http://127.0.0.1:${port}/api/files/content?path=notes/test.md`);
    assert.match(file.content, /Smoke test content/);

    const files = await fetchJson(`http://127.0.0.1:${port}/api/files`);
    assert.equal(files.files.some((item) => item.path === "notes/test.md"), true);

    const receipt = await postJson(`http://127.0.0.1:${port}/api/receipts`, {
      content: "# Receipt\n\nSmoke test receipt.\n"
    });
    assert.equal(receipt.ok, true);

    const receipts = await fetchJson(`http://127.0.0.1:${port}/api/receipts`);
    assert.equal(receipts.receipts.length, 1);

    console.log("Smoke test passed");
  } finally {
    child.kill();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function waitForServer(targetPort, getOutput) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      await fetchText(`http://127.0.0.1:${targetPort}/`);
      return;
    } catch {
      await delay(100);
    }
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
