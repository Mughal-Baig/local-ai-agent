#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { makePdf, makeDocx, makePptx, makeXlsx } = require("../helpers/document-fixtures");

const projectRoot = path.resolve(__dirname, "../..");
const port = 5700 + Math.floor(Math.random() * 300);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-api-"));
  let urlServer = null;
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
    assert.match(pdfAttachment.saved[0].receiptPath, /^receipts\/ingestion\//);
    assert.equal(pdfAttachment.saved[0].progress.some((step) => step.id === "save-receipt" && step.percent === 100), true);
    const pdfNote = await get(`/api/files/content?path=${encodeURIComponent(pdfAttachment.saved[0].contextPath)}`);
    assert.match(pdfNote.content, /AgentTrail PDF ingestion text/);

    const extracted = await post("/api/documents/extract", {
      path: pdfAttachment.saved[0].path,
      outputPath: "extracted/sample-pdf.md"
    });
    assert.equal(extracted.ok, true);
    assert.equal(extracted.extraction.type, "pdf");
    assert.match(extracted.output.path, /extracted\/sample-pdf\.md/);
    assert.match(extracted.receipt.path, /^receipts\/ingestion\//);
    assert.equal(extracted.progress.some((step) => step.id === "write-sidecar"), true);
    const extractedNote = await get("/api/files/content?path=extracted%2Fsample-pdf.md");
    assert.match(extractedNote.content, /AgentTrail PDF ingestion text/);
    const extractedReceipt = await get(`/api/files/content?path=${encodeURIComponent(extracted.receipt.path)}`);
    assert.match(extractedReceipt.content, /AgentTrail Ingestion Receipt/);
    assert.match(extractedReceipt.content, /Operation: document-extract/);
    assert.match(extractedReceipt.content, /Output file: extracted\/sample-pdf\.md/);

    const officeFiles = [
      ["sample.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", makeDocx("AgentTrail DOCX ingestion text")],
      ["sample.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", makePptx("AgentTrail PPTX ingestion text")],
      ["sample.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", makeXlsx("AgentTrail XLSX ingestion text")]
    ];
    for (const [name, type, content] of officeFiles) {
      const officeAttachment = await post("/api/attachments", {
        files: [{ name, type, encoding: "base64", content: content.toString("base64") }]
      });
      assert.equal(officeAttachment.ok, true);
      assert.equal(officeAttachment.saved[0].extracted, true);
      assert.equal(officeAttachment.saved[0].extraction.ok, true);
      const officeNote = await get(`/api/files/content?path=${encodeURIComponent(officeAttachment.saved[0].contextPath)}`);
      assert.match(officeNote.content, new RegExp(`AgentTrail ${name.slice(7, 11).toUpperCase()} ingestion text`));
    }

    const htmlAttachment = await post("/api/attachments", {
      files: [{
        name: "research.html",
        type: "text/html",
        encoding: "text",
        content: "<h1>AgentTrail HTML ingestion</h1><p>Clean local page text.</p><script>hidden()</script>"
      }]
    });
    assert.equal(htmlAttachment.ok, true);
    assert.equal(htmlAttachment.saved[0].extracted, true);
    const htmlNote = await get(`/api/files/content?path=${encodeURIComponent(htmlAttachment.saved[0].contextPath)}`);
    assert.match(htmlNote.content, /# AgentTrail HTML ingestion/);
    assert.match(htmlNote.content, /Clean local page text/);
    assert.doesNotMatch(htmlNote.content, /hidden/);

    const codeAttachment = await post("/api/attachments", {
      files: [{
        name: "example.ts",
        type: "text/plain",
        encoding: "text",
        content: "export const agentTrail = true;\n"
      }]
    });
    assert.equal(codeAttachment.saved[0].extracted, true);
    const codeNote = await get(`/api/files/content?path=${encodeURIComponent(codeAttachment.saved[0].contextPath)}`);
    assert.match(codeNote.content, /```typescript/);
    assert.match(codeNote.content, /export const agentTrail = true/);

    urlServer = await startUrlFixtureServer();
    const urlPath = `http://127.0.0.1:${urlServer.address().port}/research.html`;
    const blockedUrl = await rawPost("/api/documents/ingest-url", { url: urlPath, allowlist: ["127.0.0.1"] });
    assert.equal(blockedUrl.status, 403);
    const blockedRedirect = await rawPost("/api/documents/ingest-url", {
      url: `http://127.0.0.1:${urlServer.address().port}/redirect-out`,
      allowlist: ["127.0.0.1"],
      allowPrivate: true
    });
    assert.equal(blockedRedirect.status, 403);
    const urlIngest = await post("/api/documents/ingest-url", {
      url: urlPath,
      allowlist: ["127.0.0.1"],
      allowPrivate: true
    });
    assert.equal(urlIngest.ok, true);
    assert.equal(urlIngest.extraction.type, "html");
    assert.match(urlIngest.source.path, /^ingested\/url-/);
    assert.match(urlIngest.receipt.path, /^receipts\/ingestion\//);
    assert.equal(urlIngest.progress.some((step) => step.id === "save-receipt" && step.percent === 100), true);
    const urlNote = await get(`/api/files/content?path=${encodeURIComponent(urlIngest.output.path)}`);
    assert.match(urlNote.content, /Source URL: http:\/\/127\.0\.0\.1:/);
    assert.match(urlNote.content, /# AgentTrail URL ingestion/);
    assert.match(urlNote.content, /Allowlisted page text/);
    assert.doesNotMatch(urlNote.content, /stealToken/);
    const urlReceipt = await get(`/api/files/content?path=${encodeURIComponent(urlIngest.receipt.path)}`);
    assert.match(urlReceipt.content, /Operation: url-ingest/);
    assert.match(urlReceipt.content, /Source URL: http:\/\/127\.0\.0\.1:/);

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
    if (urlServer) {
      await new Promise((resolve) => urlServer.close(resolve));
    }
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

async function rawPost(endpoint, body) {
  return fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
}

async function get(endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function startUrlFixtureServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/research.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>AgentTrail URL ingestion</h1><p>Allowlisted page text.</p><script>stealToken()</script>");
      return;
    }
    if (req.url === "/redirect-out") {
      res.writeHead(302, { Location: "https://example.test/research.html" });
      res.end("");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}
