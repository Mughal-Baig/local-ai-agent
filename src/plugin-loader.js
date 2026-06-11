"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");
const { validatePluginManifest } = require("./plugin-sdk");

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
      const validation = validatePluginManifest(manifest, { path: `plugins/${entry.name}/plugin.json` });
      if (validation.ok) {
        plugins.push(validation.plugin);
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
