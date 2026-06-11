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
  recipePackShare: {
    schema: "agenttrail.recipe-pack-share.v1",
    required: ["schema", "exportedAt", "appVersion", "pack"],
    optional: ["shareUrl"]
  },
  pluginMarketplace: {
    schema: "agenttrail.plugin-marketplace.v1",
    required: ["schema", "title", "plugins"],
    optional: ["description"]
  },
  mcpClients: {
    schema: "agenttrail.mcp-clients.v1",
    required: ["schema", "servers"],
    optional: ["configPath"]
  },
  openaiExport: {
    schema: "agenttrail.openai-export.v1",
    required: ["schema", "app", "baseUrl", "endpoints", "capabilities"],
    optional: ["auth", "examples"]
  },
  replayBundle: {
    schema: "agenttrail.replay-bundle.v1",
    required: ["schema", "exportedAt", "appVersion", "sourcePath", "replay"],
    optional: ["title", "steps", "warnings", "files", "privacy"]
  },
  profile: {
    schema: "agenttrail.profile.v1",
    required: ["id", "title", "workspace", "permissions"],
    optional: ["description", "defaultModel", "memoryPath"]
  },
  teamUsers: {
    schema: "agenttrail.team-users.v1",
    required: ["schema", "updatedAt", "users"],
    optional: ["activeUser"]
  },
  sharedReceipts: {
    schema: "agenttrail.shared-receipts.v1",
    required: ["schema", "readOnly", "canRead", "user", "receipts"],
    optional: ["count"]
  },
  teamSync: {
    schema: "agenttrail.team-sync.v1",
    required: ["schema", "createdAt", "mode", "receipts", "profiles", "users", "audit"],
    optional: ["workspaceRoot", "privacy"]
  },
  auditExport: {
    schema: "agenttrail.audit-export.v1",
    required: ["schema", "exportedAt", "count", "records"],
    optional: ["format"]
  },
  ssoHook: {
    schema: "agenttrail.sso-hook.v1",
    required: ["schema", "configured", "provider", "headerName", "allowedDomains", "mode"],
    optional: ["issuer", "audience"]
  },
  privacySettings: {
    schema: "agenttrail.privacy-settings.v1",
    required: ["schema", "updatedAt", "localAnalytics"],
    optional: ["notes"]
  },
  retentionPolicy: {
    schema: "agenttrail.retention-policy.v1",
    required: ["schema", "updatedAt", "artifacts"],
    optional: ["note"]
  },
  privacyDashboard: {
    schema: "agenttrail.privacy-dashboard.v1",
    required: ["schema", "generatedAt", "workspaceRoot", "localOnly", "settings", "retentionPolicy", "totals", "artifacts"],
    optional: ["runtimePrivacy", "networkPolicy"]
  },
  localDataWipe: {
    schema: "agenttrail.local-data-wipe.v1",
    required: ["schema", "dryRun", "confirmation", "fileCount", "bytes", "files"],
    optional: ["deletedPaths", "skipped", "wipedAt"]
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
    optional: ["workspaceRoot", "collection", "chunks", "fileHashes"]
  },
  vectorStore: {
    schema: "agenttrail.vector-store.v1",
    required: ["schema", "version", "provider", "model", "dimensions", "builtAt", "vectors"],
    optional: ["minReaderVersion", "recordSchema", "path", "collection", "sourceIndexBuiltAt", "migrations", "lastMigratedAt"]
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
    required: ["schema", "id", "title", "version", "tools", "permissions"],
    optional: ["description", "author", "sdkVersion", "path", "valid", "issues"]
  },
  job: {
    schema: "agenttrail.job.v1",
    required: ["id", "type", "status", "createdAt"],
    optional: ["startedAt", "finishedAt", "progress", "result", "error"]
  },
  workspaceProfile: {
    schema: "agenttrail.workspace-profile.v1",
    required: ["schema", "id", "name", "workspaceRoot", "dataRoot", "createdAt", "isolation", "portablePaths"],
    optional: ["backupRoot", "updatedAt"]
  },
  backupSchedule: {
    schema: "agenttrail.backup-schedule.v1",
    required: ["schema", "enabled", "intervalHours", "retentionCount", "includeWorkspaceFiles", "nextRunAt"],
    optional: ["lastRunAt", "updatedAt"]
  },
  backup: {
    schema: "agenttrail.backup.v1",
    required: ["createdAt", "paths", "items"],
    optional: ["archiveVersion", "archiveId", "manifest", "profiles", "sessions", "receipts", "memory", "recipes", "includeWorkspaceFiles"]
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
