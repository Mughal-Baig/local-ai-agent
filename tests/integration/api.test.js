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
      "/api/tools/schemas",
      "/api/tools/capability?model=llama3.2",
      "/api/structured-output/schemas",
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

    const indexStatus = await get("/api/search-index");
    assert.equal(indexStatus.chunking.strategy, "markdown-overlap-v1");
    assert.equal(indexStatus.features.multiVector, true);
    assert.equal(indexStatus.features.lateInteraction, true);
    assert.equal(indexStatus.features.onDiskVectorStore, true);
    assert.equal(indexStatus.features.annIndex, true);
    assert.equal(indexStatus.features.annAlgorithm, "ivf-lite-top-dimensions");
    assert.equal(indexStatus.vectorStore.exists, true);
    assert.equal(indexStatus.vectorStore.path, ".agenttrail/vector-store.json");
    assert.equal(indexStatus.vectorStore.version, 1);
    assert.equal(indexStatus.vectorStore.ann.exists, true);
    assert.equal(indexStatus.vectorStore.compatible, true);
    assert.equal(indexStatus.vectorStore.vectorCount >= indexStatus.itemCount + indexStatus.chunkCount, true);
    assert.equal(indexStatus.features.chunkVectorCount >= indexStatus.chunkCount, true);

    const hybridSearch = await get("/api/search?query=semantic&mode=semantic");
    assert.equal(hybridSearch.ranker, "hybrid-bm25-vector");
    assert.equal(hybridSearch.results.some((result) => result.mode === "hybrid" && result.scoreParts && typeof result.scoreParts.bm25 === "number"), true);
    assert.equal(hybridSearch.results.some((result) => /^notes\/api\.md:\d+$/.test(result.citation || "") && result.span && Number.isInteger(result.span.charStart)), true);
    assert.equal(hybridSearch.results.some((result) => result.bestChunk && result.bestChunk.citation && typeof result.scoreParts.lateInteraction === "number"), true);
    assert.equal(hybridSearch.results.some((result) => result.scoreParts.annCandidate === true), true);

    const chunkResults = await get("/api/search/chunks?query=receipt");
    assert.equal(chunkResults.chunks.some((chunk) => chunk.heading === "API" && chunk.startLine >= 1 && chunk.endLine >= chunk.startLine), true);
    assert.equal(chunkResults.chunks.some((chunk) => /^notes\/api\.md:\d+(-\d+)?$/.test(chunk.citation || "") && chunk.span && Number.isInteger(chunk.span.charStart)), true);
    assert.equal(chunkResults.chunks.every((chunk) => !Array.isArray(chunk.embedding) && chunk.text == null), true);

    const pdfAttachment = await post("/api/attachments", {
      files: [{
        name: "sample.pdf",
        type: "application/pdf",
        encoding: "base64",
        content: makePdf("(AgentTrail PDF ingestion text) Tj").toString("base64")
      }]
    });
    assert.equal(pdfAttachment.ok, true);
    assert.equal(pdfAttachment.saved[0].extracted, true);
    assert.equal(pdfAttachment.saved[0].extraction.ok, true);
    const pdfNote = await get(`/api/files/content?path=${encodeURIComponent(pdfAttachment.saved[0].contextPath)}`);
    assert.match(pdfNote.content, /AgentTrail PDF ingestion text/);

    const extracted = await post("/api/documents/extract", {
      path: pdfAttachment.saved[0].path,
      outputPath: "extracted/sample-pdf.md"
    });
    assert.equal(extracted.ok, true);
    assert.equal(extracted.extraction.type, "pdf");
    assert.match(extracted.output.path, /extracted\/sample-pdf\.md/);
    const extractedNote = await get("/api/files/content?path=extracted%2Fsample-pdf.md");
    assert.match(extractedNote.content, /AgentTrail PDF ingestion text/);

    await post("/api/files/content", { path: "docs/guide.md", content: "# Guide\n\nnamespace collection isolated search\n" });
    const collectionIndex = await post("/api/search-index", {
      provider: "local-vector",
      collection: "Docs Only!",
      filters: { path: "docs" }
    });
    assert.equal(collectionIndex.collection, "docs-only");
    assert.equal(collectionIndex.collectionConfig.filters.pathPrefix, "docs");
    assert.equal(collectionIndex.path, ".agenttrail/search-collections/docs-only/search-index.json");
    assert.equal(collectionIndex.vectorStore.path, ".agenttrail/search-collections/docs-only/vector-store.json");
    const collectionStatus = await get("/api/search-index?collection=docs-only");
    assert.equal(collectionStatus.exists, true);
    assert.equal(collectionStatus.collection, "docs-only");
    assert.equal(collectionStatus.vectorStore.compatible, true);
    const collectionSearch = await get("/api/search?query=namespace&mode=semantic&collection=docs-only");
    assert.equal(collectionSearch.collection, "docs-only");
    assert.equal(collectionSearch.results.some((result) => result.path === "docs/guide.md"), true);
    assert.equal(collectionSearch.results.every((result) => result.path.startsWith("docs/")), true);
    const collectionChunks = await get("/api/search/chunks?query=namespace&collection=docs-only");
    assert.equal(collectionChunks.collection, "docs-only");
    assert.equal(collectionChunks.chunks.some((chunk) => chunk.path === "docs/guide.md"), true);

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

async function get(endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

function makePdf(textOperator) {
  const content = `BT /F1 12 Tf 72 720 Td ${textOperator} ET`;
  const stream = Buffer.from(content, "latin1");
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n", "latin1"),
    Buffer.from("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n", "latin1"),
    Buffer.from("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n", "latin1"),
    Buffer.from("3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n", "latin1"),
    Buffer.from("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n", "latin1"),
    Buffer.from(`5 0 obj << /Length ${stream.length} >> stream\n`, "latin1"),
    stream,
    Buffer.from("\nendstream endobj\n%%EOF\n", "latin1")
  ]);
}
