"use strict";

const ROUTE_CATALOG = [
  { area: "search", module: "server.js + src/features/search.js", routes: ["/api/search", "/api/search-index", "/api/search/chunks"] },
  { area: "attachments", module: "server.js", routes: ["/api/attachments", "/api/files/content"] },
  { area: "documents", module: "server.js + src/document-ingestion.js", routes: ["/api/documents/extract", "/api/documents/ocr", "/api/documents/ingest-url"] },
  { area: "audio", module: "server.js + src/audio-transcription.js", routes: ["/api/audio/transcribe", "/api/audio/speak", "/api/files/raw"] },
  { area: "image-generation", module: "server.js + src/image-generation.js", routes: ["/api/images/generate", "/api/files/raw"] },
  { area: "memory", module: "server.js", routes: ["/api/memory", "/api/memory/scopes", "/api/memory/structured", "/api/memory/retrieve", "/api/memory/history", "/api/memory/history/diff", "/api/memory/history/revert", "/api/memory/suggestions", "/api/memory/suggestions/apply", "/api/memory/citations"] },
  { area: "reports", module: "server.js", routes: ["/api/reports", "/api/trust/badge"] },
  { area: "conversations", module: "server.js", routes: ["/api/conversations", "/api/conversations/get", "/api/conversations/delete", "/api/conversations/restore", "/api/conversations/import", "/api/conversations/branch", "/api/conversations/export"] },
  { area: "sessions", module: "server.js", routes: ["/api/sessions", "/api/replay/plan", "/api/runs/pending", "/api/runs/pending/from-receipt", "/api/receipts/resume"] },
  { area: "planner", module: "server.js + src/structured-output.js", routes: ["/api/agent/plan", "/api/chat"] },
  { area: "tools", module: "src/permissions.js + src/tool-schemas.js", routes: ["/api/permissions", "/api/tools/schemas", "/api/tools/capability", "/api/mcp"] },
  { area: "models", module: "server.js", routes: ["/api/models", "/api/models/pull", "/api/models/delete", "/api/models/vision-capability"] },
  { area: "model-registry", module: "server.js + src/model-registry.js", routes: ["/api/model-registry", "/api/model-registry/show", "/api/model-registry/pull", "/api/model-registry/import", "/api/model-registry/create", "/api/model-registry/cp", "/api/model-registry/share"] },
  { area: "model-ecosystem", module: "server.js + src/model-ecosystem.js", routes: ["/api/model-ecosystem", "/api/model-ecosystem/adapters", "/api/model-ecosystem/fine-tune", "/api/model-ecosystem/quantize", "/api/model-ecosystem/convert", "/api/model-ecosystem/evaluate"] },
  { area: "advanced-agent", module: "server.js + src/advanced-agent.js", routes: ["/api/advanced-agent", "/api/advanced-agent/orchestrate", "/api/advanced-agent/schedule", "/api/advanced-agent/journal", "/api/advanced-agent/journal/append", "/api/advanced-agent/journal/resume", "/api/advanced-agent/sub-agent", "/api/advanced-agent/replay-diff"] },
  { area: "system", module: "server.js + src/resilience.js", routes: ["/api/health", "/api/resilience", "/api/resources", "/api/runtime", "/api/concurrency", "/api/updates/check"] },
  { area: "openai-compatible-api", module: "server.js", routes: ["/v1/chat/completions", "/v1/models", "/v1/embeddings", "/v1/openapi.json"] },
  { area: "structured-output", module: "src/structured-output.js", routes: ["/api/structured-output/schemas", "/api/structured-output", "/api/structured-output/recipe"] },
  { area: "security", module: "src/features/security.js + src/privacy.js + src/privacy-controls.js + src/network-policy.js + src/features/redact.js", routes: ["/api/security/scan", "/api/security/privacy", "/api/privacy/dashboard", "/api/privacy/settings", "/api/privacy/retention", "/api/privacy/retention/apply", "/api/privacy/wipe", "/api/redact"] },
  { area: "observability", module: "src/observability.js + src/logger.js", routes: ["/api/logs", "/api/metrics", "/api/observability", "/api/traces", "/api/traces/content", "/api/errors/taxonomy"] },
  { area: "team-enterprise", module: "src/team-enterprise.js", routes: ["/api/team/status", "/api/team/users", "/api/team/users/select", "/api/team/rbac", "/api/team/receipts", "/api/team/receipts/content", "/api/team/sync/status", "/api/team/sync/export", "/api/team/audit/export", "/api/team/sso", "/api/team/sso/validate"] },
  { area: "foundation", module: "src/foundation.js", routes: ["/api/foundation", "/api/schemas", "/api/migrations"] },
  { area: "plugins", module: "src/plugin-loader.js + src/plugin-sandbox.js", routes: ["/api/plugins", "/api/plugins/run"] },
  { area: "jobs", module: "src/jobs.js", routes: ["/api/jobs", "/api/jobs/start"] },
  { area: "backup", module: "server.js", routes: ["/api/workspace/portability", "/api/workspace/migration-plan", "/api/backup/export", "/api/backup/import", "/api/backup/schedule", "/api/backup/schedule/run"] }
];

function routeCatalog() {
  return ROUTE_CATALOG.map((item) => ({ ...item, routes: item.routes.slice() }));
}

module.exports = {
  routeCatalog
};
