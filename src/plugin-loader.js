"use strict";

const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const path = require("node:path");
const { validatePluginManifest } = require("./plugin-sdk");

const catalogCache = new Map();

async function loadPluginCatalog(pluginsDir, options = {}) {
  const root = path.resolve(pluginsDir);
  const fingerprint = await readManifestFingerprint(root);
  const cached = catalogCache.get(root);
  const force = options.force === true;
  const changed = !cached || cached.fingerprint !== fingerprint.value;
  if (cached && !force && !changed) {
    return {
      plugins: cached.plugins,
      invalid: cached.invalid,
      hotReload: {
        ...cached.hotReload,
        cacheHit: true,
        changed: false
      }
    };
  }

  const { plugins, invalid } = await readPlugins(root);
  const loadedAt = new Date().toISOString();
  const hotReload = {
    enabled: true,
    mode: "manifest-fingerprint",
    changed,
    cacheHit: false,
    forced: force,
    loadedAt,
    reloadCount: (cached?.hotReload.reloadCount || 0) + 1,
    pluginCount: plugins.length,
    invalidCount: invalid.length,
    watchedPaths: fingerprint.paths
  };
  catalogCache.set(root, {
    fingerprint: fingerprint.value,
    plugins,
    invalid,
    hotReload
  });
  return { plugins, invalid, hotReload };
}

async function loadPlugins(pluginsDir, options = {}) {
  const catalog = await loadPluginCatalog(pluginsDir, options);
  return catalog.plugins;
}

async function reloadPlugins(pluginsDir) {
  return loadPluginCatalog(pluginsDir, { force: true });
}

async function readPlugins(pluginsDir) {
  const entries = await fsp.readdir(pluginsDir, { withFileTypes: true }).catch(() => []);
  const plugins = [];
  const invalid = [];
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
      } else {
        invalid.push({
          id: entry.name,
          path: `plugins/${entry.name}/plugin.json`,
          issues: validation.issues
        });
      }
    } catch (error) {
      // Broken community plugins should not break startup.
      invalid.push({
        id: entry.name,
        path: `plugins/${entry.name}/plugin.json`,
        issues: [{ severity: "error", path: "$", message: error.message || "Could not read plugin manifest." }]
      });
    }
  }
  return {
    plugins: plugins.sort((a, b) => a.title.localeCompare(b.title)),
    invalid: invalid.sort((a, b) => a.id.localeCompare(b.id))
  };
}

async function readManifestFingerprint(pluginsDir) {
  const entries = await fsp.readdir(pluginsDir, { withFileTypes: true }).catch(() => []);
  const paths = [];
  const hash = crypto.createHash("sha256");
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = path.join(pluginsDir, entry.name, "plugin.json");
    try {
      const content = await fsp.readFile(manifestPath);
      const relativePath = `plugins/${entry.name}/plugin.json`;
      paths.push(relativePath);
      hash.update(relativePath);
      hash.update("\0");
      hash.update(content);
      hash.update("\0");
    } catch {
      // Missing or unreadable manifests are handled by readPlugins.
    }
  }
  return {
    paths,
    value: hash.digest("hex")
  };
}

module.exports = {
  loadPluginCatalog,
  loadPlugins,
  reloadPlugins
};
