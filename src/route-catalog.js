"use strict";

const ROUTE_CATALOG = [
  { area: "search", module: "server.js + src/features/search.js", routes: ["/api/search", "/api/search-index", "/api/search/chunks"] },
  { area: "memory", module: "server.js", routes: ["/api/memory", "/api/memory/citations"] },
  { area: "reports", module: "server.js", routes: ["/api/reports", "/api/trust/badge"] },
  { area: "sessions", module: "server.js", routes: ["/api/sessions", "/api/replay/plan"] },
  { area: "tools", module: "src/permissions.js", routes: ["/api/permissions", "/api/mcp"] },
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
