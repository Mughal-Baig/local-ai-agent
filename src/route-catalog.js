"use strict";

const ROUTE_CATALOG = [
  { area: "search", module: "server.js + src/features/search.js", routes: ["/api/search", "/api/search-index", "/api/search/chunks"] },
  { area: "attachments", module: "server.js", routes: ["/api/attachments", "/api/files/content"] },
  { area: "documents", module: "server.js + src/document-ingestion.js", routes: ["/api/documents/extract", "/api/documents/ocr", "/api/documents/ingest-url"] },
  { area: "audio", module: "server.js + src/audio-transcription.js", routes: ["/api/audio/transcribe", "/api/audio/speak", "/api/files/raw"] },
  { area: "image-generation", module: "server.js + src/image-generation.js", routes: ["/api/images/generate", "/api/files/raw"] },
  { area: "memory", module: "server.js", routes: ["/api/memory", "/api/memory/scopes", "/api/memory/structured", "/api/memory/retrieve", "/api/memory/history", "/api/memory/history/diff", "/api/memory/history/revert", "/api/memory/suggestions", "/api/memory/suggestions/apply", "/api/memory/citations"] },
  { area: "reports", module: "server.js", routes: ["/api/reports", "/api/trust/badge"] },
  { area: "sessions", module: "server.js", routes: ["/api/sessions", "/api/replay/plan", "/api/runs/pending", "/api/runs/pending/from-receipt", "/api/receipts/resume"] },
  { area: "planner", module: "server.js + src/structured-output.js", routes: ["/api/agent/plan", "/api/chat"] },
  { area: "tools", module: "src/permissions.js + src/tool-schemas.js", routes: ["/api/permissions", "/api/tools/schemas", "/api/tools/capability", "/api/mcp"] },
  { area: "models", module: "server.js", routes: ["/api/models", "/api/models/pull", "/api/models/delete", "/api/models/vision-capability"] },
  { area: "structured-output", module: "src/structured-output.js", routes: ["/api/structured-output/schemas", "/api/structured-output", "/api/structured-output/recipe"] },
  { area: "security", module: "src/features/security.js", routes: ["/api/security/scan"] },
  { area: "foundation", module: "src/foundation.js", routes: ["/api/foundation", "/api/schemas", "/api/migrations"] },
  { area: "plugins", module: "src/plugin-loader.js + src/plugin-sandbox.js", routes: ["/api/plugins", "/api/plugins/run"] },
  { area: "jobs", module: "src/jobs.js", routes: ["/api/jobs", "/api/jobs/start"] },
  { area: "backup", module: "server.js", routes: ["/api/backup/export", "/api/backup/import"] }
];

function routeCatalog() {
  return ROUTE_CATALOG.map((item) => ({ ...item, routes: item.routes.slice() }));
}

module.exports = {
  routeCatalog
};
