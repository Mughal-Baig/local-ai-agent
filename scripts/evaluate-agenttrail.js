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
  checks.push(await check("Trust dashboard exists", async () => includes("public/index.html", ["trustScore", "Diff Review", "Receipts"])));
  checks.push(await check("Security hardening mode exists", async () => includes("public/index.html", ["Security hardening mode"])));
  checks.push(await check("Security scan endpoint exists", async () => includes("server.js", ["/api/security/scan", "scanSecurityText"])));
  checks.push(await check("Replay sessions endpoint exists", async () => includes("server.js", ["/api/sessions", "handleSaveSession"])));
  checks.push(await check("True semantic index endpoint exists", async () => includes("server.js", ["/api/search-index", "fetchOllamaEmbedding", "local-vector"])));
  checks.push(await check("Semantic index stores hashes and chunks", async () => includes("server.js", ["fileHashes", "chunkText", "hashContent"])));
  checks.push(await check("Markdown-aware chunking exists", async () => includes("src/features/search.js", ["chunkTextDetailed", "markdownBlocks", "overlapBlocks", "startLine", "charStart"])));
  checks.push(await check("Search index stores chunk metadata", async () => includes("server.js", ["markdown-overlap-v1", "heading", "startLine", "endLine", "charStart"])));
  checks.push(await check("Exact citation spans exist", async () => includes("server.js", ["formatLineCitation", "createSnippetWithSpan", "charEnd"])));
  checks.push(await check("Late-interaction chunk vectors exist", async () => includes("server.js", ["attachChunkEmbeddings", "bestLateInteractionChunk", "lateInteraction"])));
  checks.push(await check("Flat vector store exists", async () => includes("src/vector-store.js", ["agenttrail.vector-store.v1", "FlatVectorStore", "vectorMapsFromStore"])));
  checks.push(await check("Vector store migrations exist", async () => includes("src/vector-store.js", ["VECTOR_STORE_VERSION", "migrateVectorStore", "migrateVectorStoreFiles"])));
  checks.push(await check("Search chunking tests exist", async () => includes("tests/unit/search-chunking.test.js", ["chunkTextDetailed", "Install", "startLine", "charStart"])));
  checks.push(await check("Hybrid search fusion exists", async () => includes("src/features/search.js", ["scoreBm25Documents", "fuseHybridScores", "keywordNormalized", "semanticNormalized"])));
  checks.push(await check("Hybrid search API exposes score parts", async () => includes("server.js", ["hybrid-bm25-vector", "scoreParts", "keywordMatches"])));
  checks.push(await check("Search reranker exists", async () => includes("src/features/search.js", ["rerankDocuments", "rerankFeatures", "scoreParts", "final"])));
  checks.push(await check("Embedding cache exists", async () => includes("server.js", ["fetchEmbeddingCached", "EMBED_CACHE", "EMBED_CACHE_MAX"])));
  checks.push(await check("Search eval harness exists", async () => includes("scripts/eval-search.js", ["hit@3", "SEARCH_EVAL_THRESHOLD", "Search eval passed"])));
  checks.push(await check("Search benchmark harness exists", async () => includes("scripts/benchmark-search.js", ["agenttrail.search-benchmark.v1", "brute force recall", "p95LatencyMs"])));
  checks.push(await check("Resumable run endpoints exist", async () => includes("server.js", ["/api/runs/pending", "handleSavePendingRun", "PENDING_RUN_PATH"])));
  checks.push(await check("Resumable run UI exists", async () => includes("public/index.html", ["resumeBanner", "resumeRunButton", "dismissResumeButton"])));
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
  checks.push(await check("Typed extraction recipes exist", async () => (await includes("recipes/extract-tasks-json.json", ["outputSchemaId", "task-list"])) && (await includes("recipes/extract-table-json.json", ["outputSchemaId", "table-extract"]))));
  checks.push(await check("Structured recipe endpoint exists", async () => includes("server.js", ["/api/structured-output/recipe", "handleStructuredRecipeOutput", "structured-output-recipe"])));
  checks.push(await check("Schema violation message exists", async () => includes("src/structured-output.js", ["structuredOutputMessage", "schema-violation", "did not match"])));
  checks.push(await check("Planner schema exists", async () => includes("src/structured-output.js", ["agent-plan", "requiresApproval", "needsApproval"])));
  checks.push(await check("Planner approval endpoint exists", async () => includes("server.js", ["/api/agent/plan", "handleAgentPlan", "Approved user plan"])));
  checks.push(await check("Planner UI exists", async () => includes("public/index.html", ["planPanel", "approvePlan", "planButton"])));
  checks.push(await check("Planner tests exist", async () => includes("tests/integration/agent-plan.test.js", ["agent-plan", "approvedPlan", "sawApprovedPlan"])));
  checks.push(await check("Run guardrails exist", async () => includes("server.js", ["normalizeStepBudget", "run-budget", "step-budget-exhausted"])));
  checks.push(await check("Cancellable runs exist", async () => includes("server.js", ["AbortController", "run-cancelled", "abortSignalWithTimeout"])));
  checks.push(await check("Stop button UI exists", async () => includes("public/index.html", ["stopButton", "stepBudgetSelect", "Deep 4"])));
  checks.push(await check("Run guardrail tests exist", async () => includes("tests/integration/run-guardrails.test.js", ["step-budget-exhausted", "backend stream should close"])));
  checks.push(await check("Reflection self-check exists", async () => includes("server.js", ["buildRunReflection", "run-reflection", "agenttrail.run-reflection.v1"])));
  checks.push(await check("Loop guard exists", async () => includes("server.js", ["createLoopGuard", "loop-abort", "loop-detected"])));
  checks.push(await check("Reflection and loop tests exist", async () => includes("tests/integration/reflection-loop.test.js", ["reflection", "loop-detected", "duplicate tool batch should not execute twice"])));
  checks.push(await check("Structured project memory schema exists", async () => includes("src/schemas.js", ["projectMemory", "facts", "preferences", "decisions"])));
  checks.push(await check("Structured memory endpoint exists", async () => includes("server.js", ["/api/memory/structured", "normalizeStructuredMemory", "agenttrail.project-memory.v1"])));
  checks.push(await check("Structured memory tests exist", async () => includes("tests/integration/memory-structured.test.js", ["memory/project-memory.json", "preferences", "decisions"])));
  checks.push(await check("Memory suggestion engine exists", async () => includes("server.js", ["buildMemorySuggestions", "memory-suggestions", "agenttrail.memory-suggestions.v1"])));
  checks.push(await check("Memory suggestion apply endpoint exists", async () => includes("server.js", ["/api/memory/suggestions/apply", "mergeMemorySuggestions", "appendSuggestionsToMemoryMarkdown"])));
  checks.push(await check("Memory suggestion tests exist", async () => includes("tests/integration/memory-suggestions.test.js", ["memory-suggestions", "suggestions/apply", "structured memory JSON"])));
  checks.push(await check("Ranked memory retrieval exists", async () => includes("server.js", ["/api/memory/retrieve", "rankStructuredMemory", "agenttrail.memory-retrieval.v1"])));
  checks.push(await check("Memory retrieval prompt budget exists", async () => includes("server.js", ["MEMORY_PROMPT_CHARS", "Ranked structured memory", "RAW_MEMORY_PROMPT_CHARS"])));
  checks.push(await check("Memory retrieval tests exist", async () => includes("tests/integration/memory-retrieval.test.js", ["memory-retrieval.v1", "Ranked structured memory", "preview-first writes"])));
  checks.push(await check("Memory history endpoints exist", async () => includes("server.js", ["/api/memory/history", "handleMemoryHistoryRevert", "agenttrail.memory-history.v1"])));
  checks.push(await check("Memory history UI exists", async () => includes("public/index.html", ["memoryHistory", "refreshMemoryHistory", "memoryHistoryDiff"])));
  checks.push(await check("Memory history tests exist", async () => includes("tests/integration/memory-history.test.js", ["memory-history.v1", "history/revert", "Original local fact"])));
  checks.push(await check("Scoped memory endpoints exist", async () => includes("server.js", ["/api/memory/scopes", "GLOBAL_MEMORY_ROOT", "agenttrail.memory-scopes.v1"])));
  checks.push(await check("Scoped memory prompt injection exists", async () => includes("server.js", ["Global memory:", "Project memory:", "readStructuredMemoryForScope"])));
  checks.push(await check("Scoped memory tests exist", async () => includes("tests/integration/memory-scopes.test.js", ["memory-scopes.v1", "Global memory:", "Project memory:"])));

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
