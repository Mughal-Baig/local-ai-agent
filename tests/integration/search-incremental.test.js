#!/usr/bin/env node

// T049 incremental re-index + T056 metadata filters. No Ollama (local-vector + BM25).

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5200 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-reindex-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: workspaceRoot, OLLAMA_HOST: "http://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(() => output);

    await write("notes/alpha.md", "# Alpha\n\ndata vector embeddings ranking");
    await write("beta.txt", "data kubernetes docker deploy");
    await write("gamma.md", "# Gamma\n\ndata billing refund invoice");

    // Full build (workspace may also contain auto-created files like memory/*).
    const built = await post("/api/search-index", { provider: "local-vector" });
    assert.equal(built.itemCount >= 3, true, "index should cover at least the three seeded files");

    // Incremental: unchanged seeded files are reused, and within a pass the counts
    // always balance (reused + re-embedded == itemCount).
    let incr = await post("/api/search-index", { incremental: true });
    assert.equal(incr.incremental, true, "should run an incremental pass");
    assert.equal(incr.reused >= 3, true, "the unchanged seeded files should be reused");
    assert.equal(incr.reused + incr.reembedded, incr.itemCount, "reused + re-embedded must equal itemCount");
    const chunkHits = await get(`/api/search/chunks?query=embeddings&limit=5`);
    assert.equal(chunkHits.chunks.every((chunk) => chunk.citation && chunk.span && Number.isInteger(chunk.span.charStart)), true, "reused chunks should refresh exact citation spans");

    // Change one file; it is re-embedded, and the other seeded files are still reused.
    await write("notes/alpha.md", "# Alpha\n\ndata vector embeddings ranking and reranking changed");
    incr = await post("/api/search-index", { incremental: true });
    assert.equal(incr.reembedded >= 1, true, "the changed file should be re-embedded");
    assert.equal(incr.reused >= 2, true, "the unchanged seeded files should still be reused");
    assert.equal(incr.reused + incr.reembedded, incr.itemCount, "reused + re-embedded must equal itemCount");

    // T056 - ext filter keeps only .md files.
    const md = await get(`/api/search?query=data&limit=10&mode=keyword&ext=md`);
    const mdPaths = md.results.map((r) => r.path);
    assert.equal(mdPaths.every((p) => p.endsWith(".md")), true, "ext=md should only return .md files");
    assert.equal(mdPaths.includes("beta.txt"), false, "ext=md should exclude beta.txt");
    assert.equal(mdPaths.includes("gamma.md"), true, "ext=md should include gamma.md");
    assert.equal(md.results.every((result) => result.citation && result.span && Number.isInteger(result.span.charStart)), true, "search results should include exact citation spans");

    // T056 - path filter keeps only notes/ files.
    const notes = await get(`/api/search?query=data&limit=10&mode=keyword&path=notes`);
    const notePaths = notes.results.map((r) => r.path);
    assert.equal(notePaths.every((p) => p.includes("notes")), true, "path=notes should only return notes/ files");
    assert.equal(notePaths.includes("notes/alpha.md"), true, "path=notes should include notes/alpha.md");

    console.log("Search incremental + filters test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }

  async function write(p, content) { return post("/api/files/content", { path: p, content }); }
  async function get(endpoint) {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
    assert.equal(response.ok, true, endpoint);
    return response.json();
  }
  async function post(endpoint, body) {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {})
    });
    assert.equal(response.ok, true, endpoint);
    return response.json();
  }
  async function waitForServer(getOutput) {
    for (let i = 0; i < 80; i += 1) {
      try { if ((await fetch(`http://127.0.0.1:${port}/api/status`)).ok) return; } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Server did not start. Output:\n${getOutput()}`);
  }
}
