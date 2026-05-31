"use strict";

const SCHEMA_VERSION = "0.6.0";

const SCHEMAS = {
  session: {
    schema: "agenttrail.session.v1",
    required: ["schema", "title", "createdAt", "model", "messages", "selectedFiles", "trail"],
    optional: ["permissions", "trustScore", "pendingPreviews", "replay"]
  },
  receipt: {
    schema: "agenttrail.receipt.v1",
    required: ["title", "createdAt", "model", "events"],
    optional: ["selectedFiles", "permissions", "trustScore", "toolCalls"]
  },
  report: {
    schema: "agenttrail.report.v1",
    required: ["title", "createdAt", "markdown"],
    optional: ["html", "trustScore", "citations", "diffs"]
  },
  recipePack: {
    schema: "agenttrail.recipe-pack.v1",
    required: ["id", "title", "recipes"],
    optional: ["description", "role", "author", "source"]
  },
  profile: {
    schema: "agenttrail.profile.v1",
    required: ["id", "title", "workspace", "permissions"],
    optional: ["description", "defaultModel", "memoryPath"]
  },
  memoryRevision: {
    schema: "agenttrail.memory-revision.v1",
    required: ["savedAt", "path", "content"],
    optional: ["previousSize", "newSize", "reason"]
  },
  projectMemory: {
    schema: "agenttrail.project-memory.v1",
    required: ["schema", "updatedAt", "facts", "preferences", "decisions"],
    optional: ["sourcePath", "version", "summary", "scope"]
  },
  searchIndex: {
    schema: "agenttrail.search-index.v1",
    required: ["schema", "provider", "model", "dimensions", "builtAt", "items"],
    optional: ["workspaceRoot", "chunks", "fileHashes"]
  },
  vectorStore: {
    schema: "agenttrail.vector-store.v1",
    required: ["schema", "version", "provider", "model", "dimensions", "builtAt", "vectors"],
    optional: ["minReaderVersion", "recordSchema", "path", "sourceIndexBuiltAt", "migrations", "lastMigratedAt"]
  },
  vectorStoreMigrations: {
    schema: "agenttrail.vector-store-migrations.v1",
    required: ["schema", "version", "updatedAt", "vectorStore", "actions"],
    optional: ["notes"]
  },
  toolPermission: {
    schema: "agenttrail.tool-permission.v1",
    required: ["tool", "scope", "risk", "receipt"],
    optional: ["requiresApproval", "defaultEnabled"]
  },
  plugin: {
    schema: "agenttrail.plugin.v1",
    required: ["id", "title", "version", "tools"],
    optional: ["description", "author", "permissions"]
  },
  job: {
    schema: "agenttrail.job.v1",
    required: ["id", "type", "status", "createdAt"],
    optional: ["startedAt", "finishedAt", "progress", "result", "error"]
  },
  backup: {
    schema: "agenttrail.backup.v1",
    required: ["createdAt", "paths", "items"],
    optional: ["profiles", "sessions", "receipts", "memory", "recipes"]
  }
};

function listSchemaSummaries() {
  return Object.entries(SCHEMAS).map(([name, schema]) => ({
    name,
    schema: schema.schema,
    required: schema.required,
    optional: schema.optional
  }));
}

function validateSchema(name, value) {
  const definition = SCHEMAS[name];
  if (!definition) {
    return { ok: false, errors: [`Unknown schema: ${name}`] };
  }
  const target = value && typeof value === "object" ? value : {};
  const errors = [];
  for (const key of definition.required) {
    if (!(key in target)) {
      errors.push(`Missing required key: ${key}`);
    }
  }
  if (definition.schema && target.schema && target.schema !== definition.schema) {
    errors.push(`Expected schema ${definition.schema}, got ${target.schema}`);
  }
  return { ok: errors.length === 0, errors };
}

function withSchema(name, value) {
  const definition = SCHEMAS[name];
  return {
    schema: definition ? definition.schema : `agenttrail.${name}.v1`,
    ...value
  };
}

module.exports = {
  SCHEMA_VERSION,
  SCHEMAS,
  listSchemaSummaries,
  validateSchema,
  withSchema
};
