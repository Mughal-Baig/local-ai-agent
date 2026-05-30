#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const checks = [];
  checks.push(await check("README has star engine", async () => includes("README.md", ["Why Star This", "60-second"])));
  checks.push(await check("Static demo exists", async () => includes("docs/demo.html", ["AgentTrail", "diff previews"])));
  checks.push(await check("Recipe packs exist", async () => (await countJson("recipe-packs")) >= 3));
  checks.push(await check("MCP approval manifest exists", async () => includes("mcp/agenttrail.mcp.json", ["approvals", "write_file"])));
  checks.push(await check("MCP stdio server exists", async () => includes("mcp/server.js", ["tools/list", "explicit MCP approval"])));
  checks.push(await check("Foundation modules exist", async () => includes("src/schemas.js", ["agenttrail.session.v1", "agenttrail.backup.v1"])));
  checks.push(await check("Permission engine exists", async () => includes("src/permissions.js", ["TOOL_PERMISSIONS", "evaluateToolPermission"])));
  checks.push(await check("Model adapter layer exists", async () => includes("src/model-adapters.js", ["lmstudio", "openai-compatible"])));
  checks.push(await check("Migration system exists", async () => includes("src/migrations.js", ["MIGRATIONS", "runMigrations"])));
  checks.push(await check("Plugin architecture exists", async () => includes("plugins/example-tool/plugin.json", ["agenttrail.plugin.v1", "permissions"])));
  checks.push(await check("Backup endpoint exists", async () => includes("server.js", ["/api/backup/export", "exportBackup"])));
  checks.push(await check("Background jobs endpoint exists", async () => includes("server.js", ["/api/jobs/start", "JobManager"])));
  checks.push(await check("Dockerfile exists", async () => includes("Dockerfile", ["node", "server.js"])));
  checks.push(await check("Docker compose exists", async () => includes("docker-compose.yml", ["agenttrail", "OLLAMA_HOST"])));
  checks.push(await check("Homebrew formula exists", async () => includes("Formula/agenttrail.rb", ["class Agenttrail", "v0.6.0"])));
  checks.push(await check("Desktop launchers exist", async () => includes("desktop/README.md", ["macOS", "Windows", "Linux"])));
  checks.push(await check("Real demo GIF exists", async () => hasFile("docs/agenttrail-demo.gif")));
  checks.push(await check("Trust dashboard exists", async () => includes("public/index.html", ["Trust Score", "Diff Review", "Receipts"])));
  checks.push(await check("Security hardening mode exists", async () => includes("public/index.html", ["Security hardening mode"])));
  checks.push(await check("Security scan endpoint exists", async () => includes("server.js", ["/api/security/scan", "scanSecurityText"])));
  checks.push(await check("Replay sessions endpoint exists", async () => includes("server.js", ["/api/sessions", "handleSaveSession"])));
  checks.push(await check("True semantic index endpoint exists", async () => includes("server.js", ["/api/search-index", "fetchOllamaEmbedding", "local-vector"])));
  checks.push(await check("Semantic index stores hashes and chunks", async () => includes("server.js", ["fileHashes", "chunkText", "hashContent"])));
  checks.push(await check("Recipe marketplace exists", async () => includes("marketplace/recipes.json", ["Recipe Marketplace", "submissionUrl"])));
  checks.push(await check("Student and writer packs exist", async () => (await countJson("recipe-packs")) >= 5));
  checks.push(await check("Frontend split foundation module exists", async () => includes("public/modules/foundation.js", ["/api/foundation", "/api/backup/export"])));
  checks.push(await check("Release checksum docs exist", async () => includes("docs/RELEASE_SIGNING.md", ["SHA256SUMS", "release-critical"])));
  checks.push(await check("Shareable reports endpoint exists", async () => includes("server.js", ["/api/reports", "handleSaveReport"])));

  const passed = checks.filter((item) => item.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  assert.equal(score >= 90, true);
  console.log(`AgentTrail repo eval score: ${score}/100 (${passed}/${checks.length})`);
}

async function check(name, fn) {
  try {
    return { name, ok: (await fn()) === true };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

async function includes(file, needles) {
  const content = await fsp.readFile(path.join(projectRoot, file), "utf8");
  return needles.every((needle) => content.includes(needle));
}

async function countJson(dir) {
  const entries = await fsp.readdir(path.join(projectRoot, dir), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).length;
}

async function hasFile(file) {
  const stat = await fsp.stat(path.join(projectRoot, file));
  return stat.isFile() && stat.size > 1000;
}
