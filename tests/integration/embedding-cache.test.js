#!/usr/bin/env node

// Proves the embedding cache (T048): an identical (model + text) is embedded once.
// A mock Ollama counts /api/embed calls; an identical semantic query must not
// trigger a second embed call.

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 4820 + Math.floor(Math.random() * 120);
const ollamaPort = 4520 + Math.floor(Math.random() * 120);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const counter = { embed: 0 };
  const mock = startMockOllama(ollamaPort, counter);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-embed-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: `http://127.0.0.1:${ollamaPort}`,
      AGENTTRAIL_CACHE: "on"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);

    // Seed a file and build an Ollama-provider semantic index.
    await postJson(`http://127.0.0.1:${agentPort}/api/files/content`, {
      path: "notes/embed.md",
      content: "# Embedding cache\n\nHybrid search blends keyword and vector scores for local files.\n"
    });
    await postJson(`http://127.0.0.1:${agentPort}/api/search-index`, { provider: "ollama" });

    // First semantic query embeds the query text once.
    await fetchJson(`http://127.0.0.1:${agentPort}/api/search?query=vector%20scores&limit=5&mode=semantic`);
    const afterFirst = counter.embed;

    // Identical query again must hit the cache (no new embed call).
    await fetchJson(`http://127.0.0.1:${agentPort}/api/search?query=vector%20scores&limit=5&mode=semantic`);
    const afterSecond = counter.embed;

    assert.equal(afterFirst > 0, true, "the first semantic query should embed the query");
    assert.equal(afterSecond, afterFirst, "the identical query should be served from the embedding cache");

    console.log(`Embedding cache test passed (embed calls stable at ${afterSecond} across identical queries)`);
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOllama(port, counter) {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/tags")) {
      return json(res, { models: [{ name: "llama3.2", size: 1000, modified_at: null }] });
    }
    if (req.method === "POST" && req.url.startsWith("/api/embed")) {
      counter.embed += 1;
      return json(res, { embeddings: [[0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88]] });
    }
    if (req.method === "POST" && req.url.startsWith("/api/embeddings")) {
      counter.embed += 1;
      return json(res, { embedding: [0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88] });
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

function json(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}

async function waitForServer(port, getOutput) {
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
