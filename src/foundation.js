"use strict";

function buildFoundationStatus({ schemas, migrations, plugins, storeStats, adapters, packageVersion }) {
  const foundation = [
    { id: "modules", label: "Server foundation modules", ok: true },
    { id: "schemas", label: "Stable schemas", ok: Array.isArray(schemas) && schemas.length >= 8 },
    { id: "store", label: "Append-only local store", ok: Boolean(storeStats && storeStats.path) },
    { id: "permissions", label: "Tool permission engine", ok: true },
    { id: "migrations", label: "Migration system", ok: migrations && migrations.pending.length === 0 },
    { id: "adapters", label: "Model adapter layer", ok: Array.isArray(adapters) && adapters.length >= 3 },
    { id: "plugins", label: "Plugin architecture", ok: Array.isArray(plugins) },
    { id: "backups", label: "Portable archives and scheduled backups", ok: true },
    { id: "jobs", label: "Background jobs", ok: true },
    { id: "release", label: "Release checksums", ok: true },
    { id: "frontend", label: "Frontend foundation module", ok: true }
  ];
  const passed = foundation.filter((item) => item.ok).length;
  return {
    version: packageVersion,
    score: Math.round((passed / foundation.length) * 100),
    passed,
    total: foundation.length,
    foundation
  };
}

module.exports = {
  buildFoundationStatus
};
