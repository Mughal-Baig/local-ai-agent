"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

const VECTOR_STORE_SCHEMA = "agenttrail.vector-store.v1";
const VECTOR_STORE_VERSION = 1;
const VECTOR_RECORD_SCHEMA = "agenttrail.vector-record.v1";
const VECTOR_STORE_MIGRATION_SCHEMA = "agenttrail.vector-store-migrations.v1";
const VECTOR_STORE_MIGRATION_PATH = ".agenttrail/vector-store-migrations.json";
const ANN_INDEX_SCHEMA = "agenttrail.vector-ann.ivf-lite.v1";
const ANN_TOP_DIMENSIONS = 8;

class FlatVectorStore {
  constructor(root, relativePath = ".agenttrail/vector-store.json") {
    this.root = root;
    this.relativePath = relativePath;
    this.absolutePath = path.resolve(root, relativePath);
  }

  async writeFromIndex(index) {
    const store = vectorStoreFromIndex(index, this.relativePath);
    await this.writeStore(store);
    return summarizeVectorStore(store, this.relativePath);
  }

  async writeStore(store) {
    await fsp.mkdir(path.dirname(this.absolutePath), { recursive: true });
    await fsp.writeFile(this.absolutePath, JSON.stringify(store, null, 2), "utf8");
  }

  async read(options = {}) {
    const raw = await fsp.readFile(this.absolutePath, "utf8").catch(() => "");
    if (!raw) {
      return null;
    }
    const migrated = migrateVectorStore(JSON.parse(raw), { storePath: this.relativePath });
    if (!migrated.store) {
      return null;
    }
    if (options.persistMigrations && migrated.migrated) {
      await this.writeStore(migrated.store);
    }
    return migrated.store;
  }

  async status() {
    const store = await this.read().catch(() => null);
    return summarizeVectorStore(store, this.relativePath);
  }

  async migrate() {
    const raw = await fsp.readFile(this.absolutePath, "utf8").catch(() => "");
    if (!raw) {
      return {
        ...summarizeVectorStore(null, this.relativePath),
        migrated: false,
        migrations: []
      };
    }
    const migrated = migrateVectorStore(JSON.parse(raw), { storePath: this.relativePath });
    if (!migrated.store) {
      return {
        ...summarizeVectorStore(null, this.relativePath),
        migrated: false,
        migrations: ["invalid-vector-store"]
      };
    }
    if (migrated.migrated) {
      await this.writeStore(migrated.store);
    }
    return {
      ...summarizeVectorStore(migrated.store, this.relativePath),
      migrated: migrated.migrated,
      migrations: migrated.migrations
    };
  }
}

function vectorStoreFromIndex(index, storePath = ".agenttrail/vector-store.json") {
  const vectors = [];
  for (const item of Array.isArray(index && index.items) ? index.items : []) {
    if (!Array.isArray(item.embedding) || !item.embedding.length) {
      continue;
    }
    vectors.push({
      schema: VECTOR_RECORD_SCHEMA,
      version: VECTOR_STORE_VERSION,
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
      schema: VECTOR_RECORD_SCHEMA,
      version: VECTOR_STORE_VERSION,
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
    version: VECTOR_STORE_VERSION,
    minReaderVersion: 1,
    recordSchema: VECTOR_RECORD_SCHEMA,
    path: storePath,
    provider: index && index.provider ? index.provider : "none",
    model: index && index.model ? index.model : null,
    dimensions: index && index.dimensions ? index.dimensions : 0,
    builtAt: new Date().toISOString(),
    sourceIndexBuiltAt: index && index.builtAt ? index.builtAt : null,
    vectorCount: vectors.length,
    fileVectorCount: vectors.filter((item) => item.scope === "file").length,
    chunkVectorCount: vectors.filter((item) => item.scope === "chunk").length,
    ann: buildVectorAnnIndex(vectors, index && index.dimensions ? index.dimensions : 0),
    migrations: [],
    vectors
  };
}

function migrateVectorStore(rawStore, options = {}) {
  const storePath = options.storePath || ".agenttrail/vector-store.json";
  if (!rawStore || typeof rawStore !== "object") {
    return { store: null, migrated: false, migrations: [] };
  }
  if (rawStore.schema === "agenttrail.search-index.v1" || (Array.isArray(rawStore.items) && !Array.isArray(rawStore.vectors))) {
    const store = vectorStoreFromIndex(rawStore, storePath);
    return {
      store: addMigration(store, "search-index-to-vector-store-v1"),
      migrated: true,
      migrations: ["search-index-to-vector-store-v1"]
    };
  }
  if (rawStore.schema && rawStore.schema !== VECTOR_STORE_SCHEMA) {
    return { store: null, migrated: false, migrations: [] };
  }

  const migrations = [];
  const existingMigrationIds = new Set((Array.isArray(rawStore.migrations) ? rawStore.migrations : [])
    .map((entry) => typeof entry === "string" ? entry : entry && entry.id)
    .filter(Boolean));
  const normalizedVectors = [];
  let recordsChanged = false;
  for (const record of Array.isArray(rawStore.vectors) ? rawStore.vectors : []) {
    const normalized = normalizeVectorRecord(record);
    if (!normalized) {
      recordsChanged = true;
      continue;
    }
    normalizedVectors.push(normalized);
    if (JSON.stringify(normalized) !== JSON.stringify(record)) {
      recordsChanged = true;
    }
  }

  const store = {
    ...rawStore,
    schema: VECTOR_STORE_SCHEMA,
    version: VECTOR_STORE_VERSION,
    minReaderVersion: 1,
    recordSchema: VECTOR_RECORD_SCHEMA,
    path: rawStore.path || storePath,
    provider: rawStore.provider || "none",
    model: rawStore.model || null,
    dimensions: Number(rawStore.dimensions || inferDimensions(normalizedVectors) || 0),
    builtAt: rawStore.builtAt || new Date().toISOString(),
    sourceIndexBuiltAt: rawStore.sourceIndexBuiltAt || null,
    vectors: normalizedVectors
  };
  store.ann = rawStore.ann && rawStore.ann.schema === ANN_INDEX_SCHEMA
    ? rawStore.ann
    : buildVectorAnnIndex(normalizedVectors, store.dimensions);
  store.vectorCount = normalizedVectors.length;
  store.fileVectorCount = normalizedVectors.filter((item) => item.scope === "file").length;
  store.chunkVectorCount = normalizedVectors.filter((item) => item.scope === "chunk").length;

  const needsVersionMigration = rawStore.schema !== VECTOR_STORE_SCHEMA
    || rawStore.version !== VECTOR_STORE_VERSION
    || rawStore.minReaderVersion !== 1
    || rawStore.recordSchema !== VECTOR_RECORD_SCHEMA
    || rawStore.path !== store.path
    || !rawStore.ann
    || rawStore.vectorCount !== store.vectorCount
    || rawStore.fileVectorCount !== store.fileVectorCount
    || rawStore.chunkVectorCount !== store.chunkVectorCount
    || recordsChanged;

  if (needsVersionMigration && !existingMigrationIds.has("vector-store-v1-normalize")) {
    const updated = addMigration(store, "vector-store-v1-normalize");
    migrations.push("vector-store-v1-normalize");
    return { store: updated, migrated: true, migrations };
  }

  return { store, migrated: needsVersionMigration, migrations };
}

function normalizeVectorRecord(record) {
  if (!record || typeof record !== "object" || !Array.isArray(record.embedding)) {
    return null;
  }
  const embedding = record.embedding.map(Number).filter(Number.isFinite);
  if (!embedding.length) {
    return null;
  }
  const scope = record.scope === "chunk" || String(record.id || "").startsWith("chunk:") ? "chunk" : "file";
  const recordPath = String(record.path || "");
  if (!recordPath) {
    return null;
  }
  if (scope === "chunk") {
    const index = Number(record.index || 0);
    const span = record.span || {
      startLine: record.startLine || 1,
      endLine: record.endLine || record.startLine || 1,
      charStart: Number.isInteger(record.charStart) ? record.charStart : null,
      charEnd: Number.isInteger(record.charEnd) ? record.charEnd : null
    };
    return {
      schema: VECTOR_RECORD_SCHEMA,
      version: VECTOR_STORE_VERSION,
      id: record.id || `chunk:${recordPath}#${index + 1}`,
      scope,
      path: recordPath,
      index,
      hash: record.hash || "",
      heading: record.heading || "",
      kind: record.kind || "paragraph",
      preview: record.preview || "",
      citation: record.citation || "",
      span,
      embedding
    };
  }
  return {
    schema: VECTOR_RECORD_SCHEMA,
    version: VECTOR_STORE_VERSION,
    id: record.id || `file:${recordPath}`,
    scope,
    path: recordPath,
    hash: record.hash || "",
    size: record.size || 0,
    modifiedAt: record.modifiedAt || null,
    chunkCount: record.chunkCount || 0,
    embedding
  };
}

function addMigration(store, id) {
  const migrations = Array.isArray(store.migrations) ? store.migrations.slice() : [];
  const existing = new Set(migrations.map((entry) => typeof entry === "string" ? entry : entry && entry.id).filter(Boolean));
  if (!existing.has(id)) {
    migrations.push({ id, appliedAt: new Date().toISOString() });
  }
  return {
    ...store,
    lastMigratedAt: new Date().toISOString(),
    migrations
  };
}

function inferDimensions(vectors) {
  const record = vectors.find((item) => Array.isArray(item.embedding) && item.embedding.length);
  return record ? record.embedding.length : 0;
}

function buildVectorAnnIndex(vectors, dimensions = 0, options = {}) {
  const topDimensions = Number(options.topDimensions || ANN_TOP_DIMENSIONS);
  const buckets = {};
  const cleanVectors = Array.isArray(vectors) ? vectors : [];
  for (const record of cleanVectors) {
    if (!record || !record.id || !record.path || !Array.isArray(record.embedding) || !record.embedding.length) {
      continue;
    }
    const scope = record.scope === "chunk" ? "chunk" : "file";
    for (const dimension of topVectorDimensions(record.embedding, topDimensions)) {
      const key = `${scope}:${dimension}`;
      if (!buckets[key]) {
        buckets[key] = [];
      }
      buckets[key].push(record.id);
    }
  }
  return {
    schema: ANN_INDEX_SCHEMA,
    algorithm: "ivf-lite-top-dimensions",
    builtAt: new Date().toISOString(),
    dimensions: Number(dimensions || inferDimensions(cleanVectors) || 0),
    topDimensions,
    bucketCount: Object.keys(buckets).length,
    vectorCount: cleanVectors.length,
    buckets
  };
}

function topVectorDimensions(vector, limit = ANN_TOP_DIMENSIONS) {
  return (Array.isArray(vector) ? vector : [])
    .map((value, index) => ({ index, value: Math.abs(Number(value) || 0) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .slice(0, Math.max(Number(limit) || ANN_TOP_DIMENSIONS, 1))
    .map((item) => item.index);
}

function summarizeVectorStore(store, storePath = ".agenttrail/vector-store.json") {
  if (!store) {
    return {
      exists: false,
      path: storePath,
      schema: VECTOR_STORE_SCHEMA,
      version: VECTOR_STORE_VERSION,
      ann: summarizeAnnIndex(null),
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
    version: store.version || VECTOR_STORE_VERSION,
    minReaderVersion: store.minReaderVersion || 1,
    provider: store.provider || "none",
    model: store.model || null,
    dimensions: store.dimensions || 0,
    builtAt: store.builtAt || null,
    sourceIndexBuiltAt: store.sourceIndexBuiltAt || null,
    lastMigratedAt: store.lastMigratedAt || null,
    migrationCount: Array.isArray(store.migrations) ? store.migrations.length : 0,
    ann: summarizeAnnIndex(store.ann),
    vectorCount: store.vectorCount || vectors.length,
    fileVectorCount: store.fileVectorCount || vectors.filter((item) => item.scope === "file").length,
    chunkVectorCount: store.chunkVectorCount || vectors.filter((item) => item.scope === "chunk").length
  };
}

function summarizeAnnIndex(ann) {
  if (!ann || ann.schema !== ANN_INDEX_SCHEMA) {
    return {
      exists: false,
      schema: ANN_INDEX_SCHEMA,
      algorithm: "ivf-lite-top-dimensions",
      bucketCount: 0,
      vectorCount: 0
    };
  }
  return {
    exists: true,
    schema: ann.schema,
    algorithm: ann.algorithm || "ivf-lite-top-dimensions",
    dimensions: ann.dimensions || 0,
    topDimensions: ann.topDimensions || ANN_TOP_DIMENSIONS,
    bucketCount: ann.bucketCount || Object.keys(ann.buckets || {}).length,
    vectorCount: ann.vectorCount || 0,
    builtAt: ann.builtAt || null
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
  return { fileVectors, chunkVectors, ann: store && store.ann ? store.ann : null };
}

function annCandidatePaths(store, queryVector, options = {}) {
  const ann = store && store.ann && store.ann.schema === ANN_INDEX_SCHEMA ? store.ann : null;
  if (!ann || !ann.buckets || !Array.isArray(store.vectors)) {
    return {
      enabled: false,
      algorithm: "none",
      candidatePaths: new Set(),
      candidateRecordCount: 0,
      probedBucketCount: 0
    };
  }
  const probes = topVectorDimensions(queryVector, Number(options.topDimensions || ann.topDimensions || ANN_TOP_DIMENSIONS));
  const recordById = new Map(store.vectors.map((record) => [record.id, record]));
  const candidateRecordIds = new Set();
  for (const scope of ["file", "chunk"]) {
    for (const dimension of probes) {
      for (const id of ann.buckets[`${scope}:${dimension}`] || []) {
        candidateRecordIds.add(id);
      }
    }
  }
  const candidatePaths = new Set();
  for (const id of candidateRecordIds) {
    const record = recordById.get(id);
    if (record && record.path) {
      candidatePaths.add(record.path);
    }
  }
  return {
    enabled: true,
    algorithm: ann.algorithm || "ivf-lite-top-dimensions",
    candidatePaths,
    candidateRecordCount: candidateRecordIds.size,
    probedBucketCount: probes.length * 2
  };
}

async function migrateVectorStoreFiles(workspaceRoot, options = {}) {
  const vectorStorePath = options.vectorStorePath || ".agenttrail/vector-store.json";
  const searchIndexPath = options.searchIndexPath || ".agenttrail/search-index.json";
  const migrationPath = options.migrationPath || VECTOR_STORE_MIGRATION_PATH;
  const vectorStore = new FlatVectorStore(workspaceRoot, vectorStorePath);
  const actions = [];
  let status = await vectorStore.migrate();

  if (!status.exists) {
    const index = await readJsonFile(path.join(workspaceRoot, searchIndexPath));
    if (index && index.schema === "agenttrail.search-index.v1") {
      status = await vectorStore.writeFromIndex(index);
      status = {
        ...status,
        migrated: true,
        migrations: ["search-index-to-vector-store-v1"]
      };
      actions.push("search-index-to-vector-store-v1");
    }
  } else {
    actions.push(...(status.migrations || []));
  }

  const manifest = {
    schema: VECTOR_STORE_MIGRATION_SCHEMA,
    version: 1,
    updatedAt: new Date().toISOString(),
    vectorStore: status,
    actions
  };
  const absoluteMigrationPath = path.join(workspaceRoot, migrationPath);
  await fsp.mkdir(path.dirname(absoluteMigrationPath), { recursive: true });
  await fsp.writeFile(absoluteMigrationPath, JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

module.exports = {
  VECTOR_STORE_SCHEMA,
  VECTOR_STORE_VERSION,
  VECTOR_RECORD_SCHEMA,
  VECTOR_STORE_MIGRATION_SCHEMA,
  ANN_INDEX_SCHEMA,
  FlatVectorStore,
  vectorStoreFromIndex,
  migrateVectorStore,
  migrateVectorStoreFiles,
  buildVectorAnnIndex,
  annCandidatePaths,
  summarizeVectorStore,
  vectorMapsFromStore
};
