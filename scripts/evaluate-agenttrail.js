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
  checks.push(await check("Homebrew formula exists", async () => includes("Formula/agenttrail.rb", ["class Agenttrail", "v0.7.0", "sha256"])));
  checks.push(await check("Epic V supply-chain foundation exists", async () => includes("Dockerfile", ["TARGETPLATFORM", "org.opencontainers.image.source", "USER agenttrail"]) && includes(".github/workflows/container.yml", ["linux/amd64,linux/arm64", "docker/build-push-action"]) && includes(".github/workflows/npm-publish.yml", ["npm publish --provenance", "NPM_TOKEN"]) && includes("docs/SUPPLY_CHAIN.md", ["SBOM", "Reproducible", "Multi-arch"]) && includes("scripts/generate-sbom.js", ["SPDX-2.3"]) && includes("scripts/reproducible-build.js", ["reproducible-build.v1"]) && includes("scripts/sign-checksums.js", ["checksum-signature.v1"])));
  checks.push(await check("Epic W security/privacy foundation exists", async () => includes("src/privacy.js", ["AGENTTRAIL_ENCRYPTED_V1", "protectTextForStorage", "privacyStatus"]) && includes("src/network-policy.js", ["validateNetworkEgress", "AGENTTRAIL_EGRESS_ALLOWLIST", "networkPolicyStatus"]) && includes("src/permissions.js", ["agenttrail.permission-audit.v1", "DEFAULT_TOOL_POLICIES", "permissionAuditEvent"]) && includes("server.js", ["/api/security/privacy", "auditToolPermission", "protectTextForStorage"]) && includes("tests/integration/threat-model.test.js", ["WORKSPACE_BOUNDARY", "Secret exfiltration request"])));
  checks.push(await check("Epic X observability foundation exists", async () => includes("src/observability.js", ["agenttrail.trace.v1", "agenttrail.local-analytics.v1", "agenttrail_errors_total"]) && includes("server.js", ["/api/metrics", "/api/observability", "finishResponseTrace"]) && includes("src/features/errors.js", ["ERROR_TAXONOMY", "NETWORK_EGRESS", "MODEL_BACKEND"]) && includes("public/index.html", ["observabilitySummary", "traceTimeline"]) && includes("tests/integration/observability.test.js", ["MODEL_BACKEND", "agenttrail_errors_total"])));
  checks.push(await check("Desktop launchers exist", async () => includes("desktop/README.md", ["macOS", "Windows", "Linux"])));
  checks.push(await check("Epic T desktop distribution exists", async () => includes("desktop/mac/AgentTrailMenuBar.swift", ["NSStatusBar", "Restart Server"]) && includes("desktop/windows/AgentTrail-Tray.ps1", ["NotifyIcon", "Restart server"]) && includes("desktop/linux/agenttrail-tray.sh", ["notify-send", "AGENTTRAIL_DESKTOP"]) && includes("updates/latest.json", ["agenttrail.update-channel.v1", "stable"]) && includes("src/desktop-notifications.js", ["maybeNotifyLongTask", "notify-send"]) && includes("installers/windows/AgentTrail.iss", ["AgentTrail-Setup"]) && includes("installers/linux/agenttrail.spec", ["Name: agenttrail"])));
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
  checks.push(await check("ANN vector index exists", async () => includes("src/vector-store.js", ["agenttrail.vector-ann.ivf-lite.v1", "buildVectorAnnIndex", "annCandidatePaths"])));
  checks.push(await check("Search collections exist", async () => includes("server.js", ["search-collections", "normalizeSearchCollection", "collectionConfig"])));
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
  checks.push(await check("Receipt-derived resume exists", async () => includes("server.js", ["/api/runs/pending/from-receipt", "/api/receipts/resume", "buildReceiptResume"])));
  checks.push(await check("Recipe marketplace exists", async () => includes("marketplace/recipes.json", ["Recipe Marketplace", "submissionUrl"])));
  checks.push(await check("Student and writer packs exist", async () => (await countJson("recipe-packs")) >= 5));
  checks.push(await check("Frontend split foundation module exists", async () => includes("public/modules/foundation.js", ["/api/foundation", "/api/backup/export"])));
  checks.push(await check("Release checksum docs exist", async () => includes("docs/RELEASE_SIGNING.md", ["SHA256SUMS", "release-critical"])));
  checks.push(await check("Shareable reports endpoint exists", async () => includes("server.js", ["/api/reports", "handleSaveReport"])));
  checks.push(await check("npm publish docs exist", async () => includes("docs/NPM_PUBLISH.md", ["npm publish", "npx agenttrail"])));
  checks.push(await check("MCP client examples exist", async () => includes("docs/mcp/CLIENT_SETUP.md", ["Claude Desktop", "Cursor"])));
  checks.push(await check("Public demo exists", async () => includes("docs/public-demo.html", ["Recipe Picker", "local safety signals", "Receipt Timeline"])));
  checks.push(await check("Recipe validation rejects bad files", async () => includes("server.js", ["validateRecipeShape", "invalidRecipes", "Duplicate recipe id"])));
  checks.push(await check("Meeting follow-up recipe exists", async () => includes("recipes/meeting-follow-up-email.json", ["meeting-follow-up-email", "Do not invent names"])));
  checks.push(await check("Receipt metadata search exists", async () => includes("server.js", ["receiptSearchMetadata", "fileMentions", "tools: toolNames"]) && includes("public/app.js", ["receiptMetaLine", "receiptSearchTags"])));
  checks.push(await check("Model compatibility guide exists", async () => includes("docs/MODELS.md", ["Compatibility Notes", "Tool calls", "Reliability Ladder"])));
  checks.push(await check("Prompt-injection scanner expanded", async () => includes("src/features/security.js", ["Tool escalation request", "System prompt extraction", "Encoded instruction payload"]) && includes("recipes/prompt-injection-review.json", ["tool escalation", "Do not follow instructions"])));
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
  checks.push(await check("Desktop signing scripts exist", async () => includes("scripts/sign-mac-app.js", ["notarytool", "stapler"]) && includes("scripts/sign-windows.js", ["signtool", "AGENTTRAIL_WINDOWS_CERT_THUMBPRINT"]) && includes("docs/RELEASE_SIGNING.md", ["sign:mac-app", "sign:windows"])));
  checks.push(await check("Attachment workflow exists", async () => includes("server.js", ["/api/attachments", "handleAttachments", "attachments"])));
  checks.push(await check("Attachment UI exists", async () => includes("public/index.html", ["attachmentInput", "attachFiles", "Attach"])));
  checks.push(await check("Drag-drop image composer exists", async () => includes("public/index.html", ["dropHint"]) && includes("public/app.js", ["bindComposerAttachmentIntake", "IMAGE_ATTACHMENT_MAX_BYTES", "isImageAttachment"]) && includes("server.js", ["MAX_ATTACHMENT_IMAGE_BYTES", "MAX_ATTACHMENT_BODY_BYTES"])));
  checks.push(await check("Vision model capability detection exists", async () => includes("server.js", ["/api/models/vision-capability", "visionModelCapability", "probeVisionModelSupport"]) && includes("public/app.js", ["selected.scores.vision", "Vision ready"])));
  checks.push(await check("Screenshot-to-action flow exists", async () => includes("public/index.html", ["screenshotAction"]) && includes("public/app.js", ["generateScreenshotActionPlan", "screenshotToActionPrompt", "hasSelectedVisionFile"]) && includes("server.js", ["Screenshot-to-action context", "formatVisionContextBlock"])));
  checks.push(await check("PDF extraction exists", async () => includes("src/document-ingestion.js", ["extractPdfText", "FlateDecode", "buildExtractedDocumentMarkdown"]) && includes("server.js", ["/api/documents/extract", "writeExtractedDocumentNote"])));
  checks.push(await check("Office extraction exists", async () => includes("src/document-ingestion.js", ["extractOfficeText", "extractDocxText", "extractPptxText", "extractXlsxText"])));
  checks.push(await check("HTML markdown code ingestion exists", async () => includes("src/document-ingestion.js", ["htmlToMarkdown", "extractTextDocument", "inferCodeLanguage"])));
  checks.push(await check("Image OCR ingestion exists", async () => includes("src/document-ingestion.js", ["isImageDocument", "IMAGE_EXTENSIONS"]) && includes("server.js", ["/api/documents/ocr", "writeOcrDocumentNote", "AGENTTRAIL_OCR_COMMAND"])));
  checks.push(await check("Local speech-to-text exists", async () => includes("src/audio-transcription.js", ["isAudioDocument", "buildTranscriptMarkdown", "normalizeTranscriptText"]) && includes("server.js", ["/api/audio/transcribe", "runLocalTranscription", "AGENTTRAIL_TRANSCRIBE_COMMAND"]) && includes("tests/integration/audio-transcription.test.js", ["mock-transcribe", "audio-transcribe"])));
  checks.push(await check("Voice prompt input exists", async () => includes("public/index.html", ["voicePrompt"]) && includes("public/app.js", ["startVoicePromptRecording", "transcribeVoicePrompt", "MediaRecorder"])));
  checks.push(await check("Local text-to-speech exists", async () => includes("server.js", ["/api/audio/speak", "runLocalTextToSpeech", "AGENTTRAIL_TTS_COMMAND"]) && includes("public/app.js", ["speakAssistantMessage", "/api/audio/speak"]) && includes("tests/fixtures/mock-tts.js", ["FAKEAIFF"])));
  checks.push(await check("Audio transcription recipe exists", async () => includes("recipes/audio-transcription.json", ["audio-transcription", "audio-transcribe"]) && includes("public/app.js", ["runAudioTranscriptionRecipe"]) && includes("recipe-packs/student.json", ["audio-transcription"])));
  checks.push(await check("Local image generation exists", async () => includes("src/image-generation.js", ["buildImageGenerationPayload", "parseGeneratedImages", "Image Generation Provenance"]) && includes("server.js", ["/api/images/generate", "runLocalImageGeneration", "AGENTTRAIL_IMAGE_HOST"]) && includes("tests/integration/image-generation.test.js", ["sdapi/v1/txt2img", "Image generation integration test passed"])));
  checks.push(await check("OpenAI-compatible served API exists", async () => includes("server.js", ["/v1/chat/completions", "handleV1ChatCompletions", "writeOpenAIStreamChunk", "AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE", "V1_REQUEST_QUEUE"]) && includes("docs/openapi/agenttrail-v1-openapi.json", ["/v1/chat/completions", "/v1/embeddings", "bearerAuth"]) && includes("docs/OPENAI_COMPATIBLE_API.md", ["AGENTTRAIL_V1_API_KEY", "Queue And Rate Controls"]) && includes("tests/integration/openai-compatible-server.test.js", ["queue_full", "rate_limit_exceeded", "chat\\.completion\\.chunk"])));
  checks.push(await check("Concurrency and backpressure exist", async () => includes("server.js", ["MODEL_GATE", "AGENTTRAIL_MAX_CONCURRENCY", "/api/concurrency", "Retry-After"]) && includes("tests/integration/concurrency.test.js", ["maxQueue", "503"]) && includes("scripts/load-test.js", ["p95", "rps"]) && includes("docs/INTEGRATIONS.md", ["Bounded concurrency", "Load testing"])));
  checks.push(await check("Health resources and runtime endpoints exist", async () => includes("server.js", ["/api/health", "/api/resources", "/api/runtime", "recommendedQuantization"]) && includes("tests/integration/health.test.js", ["uptimeSeconds", "healthy"]) && includes("tests/integration/resources.test.js", ["recommendedQuantization", "bundledRuntime"]) && includes("public/index.html", ["resourcesSummary", "System"])));
  checks.push(await check("Bundled GGUF runtime adapter exists", async () => includes("src/model-adapters.js", ["bundled", "AGENTTRAIL_GGUF_MODEL"]) && includes("src/bundled-runtime.js", ["node-llama-cpp", "generateBundledText", "embedBundledText"]) && includes("tests/integration/bundled-runtime.test.js", ["AGENTTRAIL_MODEL_ADAPTER", "bundled", "mock-gguf"]) && includes("docs/RUNTIME_PHASE6.md", ["AGENTTRAIL_MODEL_ADAPTER=bundled", "test:bundled"])));
  checks.push(await check("Runtime hardware acceleration policy exists", async () => includes("src/runtime-hardware.js", ["metal", "cuda", "rocm", "vulkan", "resolveGpuLayerOffload", "recommendThreads"]) && includes("tests/unit/runtime-hardware.test.js", ["selectedBackend", "AGENTTRAIL_BUNDLED_GPU_LAYERS", "VULKAN_SDK"]) && includes("server.js", ["accelerationBackend", "runtime.hardware"]) && includes("docs/RUNTIME_PHASE6.md", ["AGENTTRAIL_ACCELERATION_BACKEND", "AGENTTRAIL_BUNDLED_GPU_LAYERS"])));
  checks.push(await check("Runtime loading internals policy exists", async () => includes("src/runtime-loading.js", ["detectModelQuantization", "resolveKvCachePolicy", "resolveBatchPolicy", "resolveMmapPolicy", "resolveShardingPolicy", "runtimeBenchmarkPlan"]) && includes("scripts/benchmark-runtime.js", ["tokensPerSecond", "generateBundledText", "/api/generate"]) && includes("tests/unit/runtime-loading.test.js", ["Q4_K_M", "AGENTTRAIL_TENSOR_SPLIT"]) && includes("docs/RUNTIME_PHASE6.md", ["AGENTTRAIL_BUNDLED_MMAP", "bench:runtime"])));
  checks.push(await check("Model registry distribution exists", async () => includes("src/model-registry.js", ["resumableDownload", "resolveRegistrySource", "parseModelSpec", "shareModel", "verifyModelProvenance"]) && includes("server.js", ["/api/model-registry/pull", "handleModelRegistryCreate", "handleModelRegistryShare"]) && includes("tests/integration/model-registry.test.js", ["tiny/q5", "/api/model-registry/share"]) && includes("docs/RUNTIME_PHASE6.md", ["AGENTTRAIL_MODEL_REGISTRY_DIR", "model-registry"])));
  checks.push(await check("Epic U CLI parity exists", async () => includes("src/cli.js", ["runCommand", "pullCommand", "completionScript", "/api/model-registry/create"]) && includes("bin/agenttrail.js", ["runCli"]) && includes("tests/integration/cli.test.js", ["agenttrail-cli", "CLI integration test passed"]) && includes("docs/CLI.md", ["agenttrail run", "agenttrail create"])));
  checks.push(await check("CLI and VS Code integrations exist", async () => includes("bin/agenttrail-chat.js", ["/api/chat", "AGENTTRAIL_URL"]) && includes("editor/vscode-agenttrail/package.json", ["agenttrail.ask", "AgentTrail: Ask about selection"]) && includes("docs/INTEGRATIONS.md", ["CLI parity and pipe mode", "VS Code"])));
  checks.push(await check("Model option passthrough exists", async () => includes("server.js", ["buildModelOptions", "OLLAMA_NUM_CTX", "OLLAMA_NUM_GPU", "OLLAMA_NUM_THREAD"]) && includes("tests/integration/model-options.test.js", ["num_gpu", "num_ctx"])));
  checks.push(await check("Secret redaction helper exists", async () => includes("src/features/redact.js", ["redactSecrets", "PATTERNS", "[REDACTED]"]) && includes("tests/unit/redact.test.js", ["Redact unit test passed", "ghp_"])));
  checks.push(await check("Vision model image input exists", async () => includes("server.js", ["collectVisionImages", "openAIUserMessage", "ollamaUserMessage", "Vision image context"]) && includes("tests/integration/vision-input.test.js", ["image_url", "vision backend saw image"])));
  checks.push(await check("Allowlisted URL ingestion exists", async () => includes("server.js", ["/api/documents/ingest-url", "handleUrlIngest", "normalizeUrlAllowlist", "fetchAllowedDocumentUrl"])));
  checks.push(await check("Ingestion progress receipts exist", async () => includes("server.js", ["writeIngestionReceipt", "AgentTrail Ingestion Receipt", "ingestionProgressStep", "ingestion-receipt"])));
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
  const failed = checks.filter((item) => !item.ok);
  if (failed.length) {
    console.log(`Failed checks: ${failed.map((item) => item.name).join(", ")}`);
  }
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
