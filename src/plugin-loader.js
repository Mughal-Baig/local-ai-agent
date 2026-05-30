"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

async function loadPlugins(pluginsDir) {
  const entries = await fsp.readdir(pluginsDir, { withFileTypes: true }).catch(() => []);
  const plugins = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = path.join(pluginsDir, entry.name, "plugin.json");
    try {
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
      if (manifest && manifest.id && manifest.title) {
        plugins.push({
          id: String(manifest.id),
          title: String(manifest.title),
          version: String(manifest.version || "0.0.0"),
          description: String(manifest.description || ""),
          tools: Array.isArray(manifest.tools) ? manifest.tools : [],
          permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
          path: `plugins/${entry.name}/plugin.json`
        });
      }
    } catch {
      // Broken community plugins should not break startup.
    }
  }
  return plugins.sort((a, b) => a.title.localeCompare(b.title));
}

module.exports = {
  loadPlugins
};
