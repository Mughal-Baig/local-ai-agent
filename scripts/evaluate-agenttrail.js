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
  checks.push(await check("Static demo exists", async () => includes("docs/demo.html", ["AgentTrail", "diff preview"])));
  checks.push(await check("Recipe packs exist", async () => (await countJson("recipe-packs")) >= 3));
  checks.push(await check("MCP approval manifest exists", async () => includes("mcp/agenttrail.mcp.json", ["approvals", "write_file"])));
  checks.push(await check("MCP stdio server exists", async () => includes("mcp/server.js", ["tools/list", "explicit MCP approval"])));
  checks.push(await check("Foundation modules exist", async () => includes("src/schemas.js", ["agenttrail.session.v1", "agenttrail.backup.v1"])));
  checks.push(await check("Permission engine exists", async () => includes("src/permissions.js", ["TOOL_PERMISSIONS", "evaluateToolPermission"])));
  checks.push(await check("Model adapter layer exists", async () => includes("src/model-adapters.js", ["lmstudio", "openai-compatible"])));
  checks.push(await check("Tool schema registry exists", async () => includes("src/tool-schemas.js", ["read_file", "validateToolArguments", "toolDefinitionsForBackend"])));
  checks.push(await check("Tool capability probe exists", async () => includes("server.js", ["/api/tools/capability", "probeNativeToolSupport", "TOOL_CAPABILITY_CACHE"])));
  checks.push(await check("Migration system exists", async () => includes("src/migrations.js", ["MIGRATIONS", "runMigrations"])));
  checks.push(await check("Plugin architecture exists", async () => includes("plugins/example-tool/plugin.json", ["agenttrail.plugin.v1", "permissions"])));
  checks.push(await check("Backup endpoint exists", async () => includes("server.js", ["/api/backup/export", "exportBackup"])));
  checks.push(await check("Background jobs endpoint exists", async () => includes("server.js", ["/api/jobs/start", "JobManager"])));
  checks.push(await check("Dockerfile exists", async () => includes("Dockerfile", ["node", "server.js"])));
  checks.push(await check("Docker compose exists", async () => includes("docker-compose.yml", ["agenttrail", "OLLAMA_HOST"])));
  checks.push(await check("Homebrew formula exists", async () => includes("Formula/agenttrail.rb", ["class Agenttrail", "v0.7.0"])));
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
  checks.push(await check("npm publish docs exist", async () => includes("docs/NPM_PUBLISH.md", ["npm publish", "npx agenttrail"])));
  checks.push(await check("MCP client examples exist", async () => includes("docs/mcp/CLIENT_SETUP.md", ["Claude Desktop", "Cursor"])));
  checks.push(await check("Public demo exists", async () => includes("docs/public-demo.html", ["AgentTrail Demo", "96/100 trust"])));
  checks.push(await check("Product frontend module exists", async () => includes("public/modules/product.js", ["/api/models/compare", "/api/marketplace/import-url"])));
  checks.push(await check("SQLite store exists", async () => includes("src/sqlite-store.js", ["node:sqlite", "CREATE TABLE"])));
  checks.push(await check("Structured logging exists", async () => includes("src/logger.js", ["agenttrail.log.v1", "logs.jsonl"])));
  checks.push(await check("Config validation exists", async () => includes("src/config.js", ["validateConfig", "OLLAMA_HOST"])));
  checks.push(await check("File watcher exists", async () => includes("src/file-watcher.js", ["fs.watch", "events"])));
  checks.push(await check("Plugin sandbox exists", async () => includes("src/plugin-sandbox.js", ["vm", "example.echo"])));
  checks.push(await check("Backup import endpoint exists", async () => includes("server.js", ["/api/backup/import", "importBackup"])));
  checks.push(await check("Real benchmark endpoint exists", async () => includes("server.js", ["/api/benchmarks/run", "runModelBenchmark"])));
  checks.push(await check("Guided replay endpoint exists", async () => includes("server.js", ["/api/replay/plan", "handleReplayPlan"])));
  checks.push(await check("Trust badge endpoint exists", async () => includes("server.js", ["/api/trust/badge", "handleTrustBadge"])));
  checks.push(await check("Release artifact workflow exists", async () => includes(".github/workflows/release-artifacts.yml", ["release:checksums", "package:desktop"])));
  checks.push(await check("Attachment workflow exists", async () => includes("server.js", ["/api/attachments", "handleAttachments", "attachments"])));
  checks.push(await check("Attachment UI exists", async () => includes("public/index.html", ["attachmentInput", "attachFiles", "Attach"])));
  checks.push(await check("macOS app bundle generator exists", async () => includes("scripts/package-mac-app.js", ["AgentTrail.app", "Info.plist", "MacOS"])));
  checks.push(await check("Native tool-calling tests exist", async () => includes("tests/integration/native-tool-calling.test.js", ["tool_calls", "read_file"])));
  checks.push(await check("Tool repair tests exist", async () => includes("tests/integration/tool-repair.test.js", ["repaired", "read_file"])));
  checks.push(await check("Multi-tool batch execution exists", async () => includes("server.js", ["executeToolCallBatch", "MAX_TOOL_CALLS_PER_STEP", "tool-batch"])));
  checks.push(await check("Multi-tool tests exist", async () => includes("tests/integration/multi-tool-calls.test.js", ["tool_calls", "batch", "parallel"])));
  checks.push(await check("Structured output engine exists", async () => includes("src/structured-output.js", ["task-list", "validateStructuredOutput", "parseStructuredJson"])));
  checks.push(await check("Structured output backend support exists", async () => includes("server.js", ["format: descriptor.schema", "response_format", "/api/structured-output"])));
  checks.push(await check("Structured output tests exist", async () => includes("tests/integration/structured-output.test.js", ["response_format", "body.format", "task-list"])));

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
