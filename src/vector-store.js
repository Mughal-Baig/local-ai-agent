"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

const VECTOR_STORE_SCHEMA = "agenttrail.vector-store.v1";

class FlatVectorStore {
  constructor(root, relativePath = ".agenttrail/vector-store.json") {
    this.root = root;
    this.relativePath = relativePath;
    this.absolutePath = path.resolve(root, relativePath);
  }

  async writeFromIndex(index) {
    const store = vectorStoreFromIndex(index, this.relativePath);
    await fsp.mkdir(path.dirname(this.absolutePath), { recursive: true });
    await fsp.writeFile(this.absolutePath, JSON.stringify(store, null, 2), "utf8");
    return summarizeVectorStore(store, this.relativePath);
  }

  async read() {
    const raw = await fsp.readFile(this.absolutePath, "utf8").catch(() => "");
    if (!raw) {
      return null;
    }
    const store = JSON.parse(raw);
    if (!store || store.schema !== VECTOR_STORE_SCHEMA || !Array.isArray(store.vectors)) {
      return null;
    }
    return store;
  }

  async status() {
    const store = await this.read().catch(() => null);
    return summarizeVectorStore(store, this.relativePath);
  }
}

function vectorStoreFromIndex(index, storePath = ".agenttrail/vector-store.json") {
  const vectors = [];
  for (const item of Array.isArray(index && index.items) ? index.items : []) {
    if (!Array.isArray(item.embedding) || !item.embedding.length) {
      continue;
    }
    vectors.push({
      id: `file:${item.path}`,
      scope: "file",
      path: item.path,
      hash: item.hash || "",
      size: item.size || 0,
      modifiedAt: item.modifiedAt || null,
      chunkCount: item.chunkCount || 0,
      embedding: item.embedding
    });
  }

  for (const chunk of Array.isArray(index && index.chunks) ? index.chunks : []) {
    if (!Array.isArray(chunk.embedding) || !chunk.embedding.length) {
      continue;
    }
    vectors.push({
      id: `chunk:${chunk.id || `${chunk.path}#${Number(chunk.index || 0) + 1}`}`,
      scope: "chunk",
      path: chunk.path || "",
      index: Number(chunk.index || 0),
      hash: chunk.hash || "",
      heading: chunk.heading || "",
      kind: chunk.kind || "paragraph",
      preview: chunk.preview || "",
      citation: chunk.citation || "",
      span: chunk.span || {
        startLine: chunk.startLine || 1,
        endLine: chunk.endLine || chunk.startLine || 1,
        charStart: Number.isInteger(chunk.charStart) ? chunk.charStart : null,
        charEnd: Number.isInteger(chunk.charEnd) ? chunk.charEnd : null
      },
      embedding: chunk.embedding
    });
  }

  return {
    schema: VECTOR_STORE_SCHEMA,
    path: storePath,
    provider: index && index.provider ? index.provider : "none",
    model: index && index.model ? index.model : null,
    dimensions: index && index.dimensions ? index.dimensions : 0,
    builtAt: new Date().toISOString(),
    sourceIndexBuiltAt: index && index.builtAt ? index.builtAt : null,
    vectorCount: vectors.length,
    fileVectorCount: vectors.filter((item) => item.scope === "file").length,
    chunkVectorCount: vectors.filter((item) => item.scope === "chunk").length,
    vectors
  };
}

function summarizeVectorStore(store, storePath = ".agenttrail/vector-store.json") {
  if (!store) {
    return {
      exists: false,
      path: storePath,
      schema: VECTOR_STORE_SCHEMA,
      vectorCount: 0,
      fileVectorCount: 0,
      chunkVectorCount: 0
    };
  }
  const vectors = Array.isArray(store.vectors) ? store.vectors : [];
  return {
    exists: true,
    path: store.path || storePath,
    schema: store.schema || VECTOR_STORE_SCHEMA,
    provider: store.provider || "none",
    model: store.model || null,
    dimensions: store.dimensions || 0,
    builtAt: store.builtAt || null,
    sourceIndexBuiltAt: store.sourceIndexBuiltAt || null,
    vectorCount: store.vectorCount || vectors.length,
    fileVectorCount: store.fileVectorCount || vectors.filter((item) => item.scope === "file").length,
    chunkVectorCount: store.chunkVectorCount || vectors.filter((item) => item.scope === "chunk").length
  };
}

function vectorMapsFromStore(store) {
  const fileVectors = new Map();
  const chunkVectors = new Map();
  for (const record of Array.isArray(store && store.vectors) ? store.vectors : []) {
    if (!Array.isArray(record.embedding) || !record.embedding.length) {
      continue;
    }
    if (record.scope === "file") {
      fileVectors.set(record.path, record.embedding);
      continue;
    }
    if (record.scope === "chunk") {
      if (!chunkVectors.has(record.path)) {
        chunkVectors.set(record.path, []);
      }
      chunkVectors.get(record.path).push({
        id: record.id ? record.id.replace(/^chunk:/, "") : `${record.path}#${Number(record.index || 0) + 1}`,
        path: record.path,
        index: Number(record.index || 0),
        hash: record.hash || "",
        heading: record.heading || "",
        kind: record.kind || "paragraph",
        preview: record.preview || "",
        citation: record.citation || "",
        span: record.span || null,
        startLine: record.span && record.span.startLine ? record.span.startLine : 1,
        endLine: record.span && record.span.endLine ? record.span.endLine : 1,
        charStart: record.span && Number.isInteger(record.span.charStart) ? record.span.charStart : null,
        charEnd: record.span && Number.isInteger(record.span.charEnd) ? record.span.charEnd : null,
        embedding: record.embedding
      });
    }
  }
  return { fileVectors, chunkVectors };
}

module.exports = {
  VECTOR_STORE_SCHEMA,
  FlatVectorStore,
  vectorStoreFromIndex,
  summarizeVectorStore,
  vectorMapsFromStore
};
