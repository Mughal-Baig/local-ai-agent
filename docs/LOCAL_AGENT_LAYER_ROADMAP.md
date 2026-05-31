# AgentTrail — Local Agent Layer Roadmap

A long-horizon backlog (12+ months) for making AgentTrail the auditable agent layer for Ollama and other local model runtimes. The honest framing first, then the product surface broken into phases → epics → concrete, checkable tasks. Tasks are numbered sequentially (`T001…`) so progress is trackable. `[x]` = already shipped, `[ ]` = open, `[~]` = partial.

> **Reality check (read this).** Ollama *is* a model runtime (llama.cpp + GPU backends + a model registry). AgentTrail should not market itself as an Ollama replacement today. The public wedge is stronger and more honest: AgentTrail is the **auditable agent layer** for local models, with receipts, diff-gated writes, replay, tools, memory, search, and security. The bundled runtime work remains a later moonshot (Phase 6). We complete the agent-layer work first, a few tasks at a time.

**Scope:** 200+ tasks here, grouped so each epic can expand into finer sub-tasks toward the 1000 mark as we detail them. We expand an epic into sub-tasks only when we reach it.

---

## Codex Implementation Log Since Public Roadmap Rename

This section tracks the concrete work shipped after the roadmap was publicly reframed from "compete with Ollama" to **AgentTrail as the auditable local-agent layer**. It is here so Claude, Codex, and contributors can review what changed without reconstructing the history from commits.

| Commit | Roadmap tasks | What changed |
| --- | --- | --- |
| `667e073` | T017-T020 | Added native Ollama `/api/chat` tool calling, OpenAI-compatible function calling, a shared JSON-schema tool registry, and prompt-JSON fallback for models without native tools. |
| `b1c53c0` | T021, T023 | Added per-model tool capability probing/cache and malformed tool-call argument repair before retry. |
| `b06eee8` | T022, T036 | Added multi-tool batch execution so independent read-only tools can run in parallel while write-like tools stay ordered. |
| `5c04f59` | T025-T027 | Added structured-output support for Ollama JSON-schema `format`, OpenAI-compatible `response_format.json_schema`, and schema validation before tool execution. |
| `af307aa` | T028-T030 | Added typed extraction recipes, structured recipe endpoint, readable schema-violation messaging, and structured-output round-trip tests. |
| `9806600` | T031-T032 | Added `/api/agent/plan` and a UI plan panel so users can inspect, edit, and approve plans before execution. |
| `b895313` | T033, T037 | Added step-budget guardrails, explicit deep-run override, Stop button, and backend stream cancellation. |
| `b486410` | T034-T035 | Added deterministic final-answer self-check reflection and loop/no-progress aborts for repeated tool batches. |
| `a16c5a4` | T039 | Added structured project memory JSON with facts, preferences, decisions, citations, and tests. |
| `a2bef99` | T040 | Added post-run memory suggestions with explicit user apply controls; nothing is silently remembered. |
| `46a257b` | T041 | Added ranked memory retrieval and prompt-budgeted structured memory injection. |
| `a011c3a` | T042 | Added memory history list, diff preview, and revert flow that records a new auditable history entry. |
| `2d3c2f2` | T043 | Added project/global memory scopes, prompt injection for both scopes, scope APIs, UI switching, and tests. |
| `aa32467` | T045 | Added markdown-aware overlapping search chunks with section headings, chunk type, line ranges, saved chunking metadata, `/api/search/chunks` citation improvements, `npm run test:search`, CI coverage, README/eval/handoff updates. |
| `fb492da` | T046 | Added BM25 keyword scoring, semantic vector score fusion, `/api/search?mode=semantic` ranker `hybrid-bm25-vector`, exposed `scoreParts`, BM25 chunk ranking, tests, README/eval/handoff updates. |
| Claude handoff + Codex review | T038 partial, T047, T048, T052 | Imported and hardened the Claude pass: local pending-run snapshot API/UI, lexical top-k reranker with `scoreParts.rerank`/`.final`, real embedding cache keyed by model + content hash, search hit@3 eval harness, CI scripts, focused tests, route catalog/eval visibility, and resume-banner UI polish. |
| Claude RAG pass + Codex continuation | T049, T051, T056 | Imported Claude's incremental re-index and metadata filters, then added exact line/character citation spans across `/api/search`, `/api/search/chunks`, saved search chunks, UI search metadata, tests, eval checks, and README visibility. |
| Codex continuation | T050 | Added multi-vector late-interaction search: saved chunk embeddings in the local index, best-chunk semantic scoring for long docs, sanitized chunk APIs, `bestChunk` result metadata, tests, eval checks, and docs. |
| Codex continuation | T053 | Added a flat-file on-disk vector store at `.agenttrail/vector-store.json`, search-index status visibility, vector-store read path for semantic search, unit/integration coverage, eval checks, and docs. |
| Codex continuation | T054 | Added dependency-free IVF-lite ANN buckets to the vector store, ANN candidate path lookup for semantic search, `/api/search-index` feature/status visibility, benchmark assertions, tests, eval checks, and docs. |
| Codex continuation | T055 | Added named search collections with independent search-index/vector-store files under `.agenttrail/search-collections/{id}/`, collection filters, collection-aware search/chunk search, incremental rebuilds, tests, eval checks, and docs. |
| Codex continuation | T038 | Finished receipt-derived resume: Markdown receipts/reports now carry a resume prompt, `/api/receipts/resume` parses prompt/model/files/permissions/trail, `/api/runs/pending/from-receipt` restores a pending run, `/api/replay/plan` supports receipt paths, and the UI can resume a selected receipt. |
| Codex continuation | T059 | Added dependency-free PDF text extraction with FlateDecode stream support, `/api/documents/extract`, automatic PDF attachment sidecar notes, route/eval/CI coverage, and docs. |
| Codex continuation | T060 | Extended document ingestion to DOCX, PPTX, and XLSX using a dependency-free ZIP/OpenXML reader, automatic office attachment sidecar notes, API/integration tests, eval checks, and docs. |
| Codex continuation | T061 | Added HTML, Markdown, code, and plain-text ingestion with cleaned HTML-to-Markdown conversion, language-aware code fences, automatic text attachment sidecars, API tests, eval checks, and docs. |
| Codex continuation | T057 | Added vector-store version metadata, legacy normalization, search-index-to-vector-store migration, `.agenttrail/vector-store-migrations.json`, migration `005-vector-store-versioning`, tests, eval checks, and docs. |
| Codex continuation | T058 | Added `npm run bench:search`: deterministic local corpus, local-vector index build timing, AgentTrail semantic recall/latency, brute-force scanner baseline, top-1 agreement threshold, CI coverage, and docs. |
| Codex continuation | T063 | Added allowlisted URL ingestion with redirect re-validation, private-host opt-in, response-size limits, cleaned document extraction, searchable Markdown sidecars with source URL metadata, API tests, eval checks, and docs. |
| Codex continuation | T064 | Added ingestion progress arrays and automatic Markdown receipts under `receipts/ingestion/` for attachments, workspace document extraction, and allowlisted URL ingestion; tests, smoke, eval, and docs now assert the audit trail. |
| Codex continuation | T062 | Added optional local OCR for image scans through `/api/documents/ocr`, automatic image-attachment OCR, Tesseract-compatible command configuration, searchable OCR sidecars, ingestion receipts, route/eval coverage, and mock-command tests. |
| Codex continuation | T065, T069 | Added local vision image input for selected PNG/JPEG/TIFF/BMP/WebP files across Ollama and OpenAI-compatible backends, browser auto-selection for image attachments, prompt path/hash metadata, SSE `vision` events, eval coverage, and a mock vision backend integration test. |
| Codex continuation | T066 | Added drag/drop and pasted-image intake in the chat composer, matched browser image limits to the vision backend, allowed larger image attachment request bodies, selected dropped image pixels for vision runs, and covered the path in API/UI smoke/eval checks. |
| Codex continuation | T068 | Added vision-model capability detection with model-name heuristics, optional tiny-image backend probe at `/api/models/vision-capability`, Vision scores in the UI/model benchmarks, run warnings when image payloads target clearly non-vision models, and mock Ollama tests. |
| Codex continuation | T067 | Added screenshot-to-action planning: a composer button opens screenshot intake, attaches selected image pixels to `/api/agent/plan`, adds vision metadata/warnings to planner prompts and receipts, and turns screenshots into editable plans before tool execution. |
| Codex continuation | T070 | Added local speech-to-text through `/api/audio/transcribe`, a whisper.cpp-compatible command adapter, audio attachment metadata, searchable transcript sidecars, ingestion receipts, route/eval/CI coverage, and mock-command tests. |
| Codex continuation | T071-T073 | Added voice prompt recording in the composer, local response text-to-speech through `/api/audio/speak`, raw local audio playback, and an actionable Audio Transcription recipe that transcribes selected audio into searchable transcript sidecars with receipts. |
| Codex continuation | T074-T075 | Added optional local image generation through `/api/images/generate` for Automatic1111/Forge and OpenAI-compatible SD/Flux servers, workspace image artifact saving, Markdown provenance, route/eval/CI coverage, and mock image-backend tests. |
| Codex continuation | T076-T081 | Added OpenAI-compatible AgentTrail server mode with `/v1/chat/completions`, `/v1/models`, `/v1/embeddings`, SSE streaming chunks, optional API-key auth, local rate limiting, request queue headers, OpenAPI spec, client docs, and mock-client tests. |
| Claude continuation + Codex hardening | T082-T089, T093, T095, T097, T099-T103, T105, T111, T245 | Added bounded model concurrency/backpressure, local load testing, integration docs, CLI pipe mode, VS Code MVP, Ollama option passthrough, health/resources/runtime APIs, System panel, optional bundled-runtime seam docs, redaction helper/tests, route/eval/CI coverage, and updated completion status. |
| Codex Phase 6 pass | T106, T108; T107/T109/T110 partial | Added a first-class experimental `bundled` backend adapter, optional runtime provider contract in `src/bundled-runtime.js`, `/api/runtime` readiness details, GGUF model config, mock bundled-runtime integration coverage for streaming/embeddings/structured output, docs, env examples, and CI/eval wiring while keeping the default install zero-dependency. |
| Codex Epic Q pass | T112-T118 | Added `src/runtime-hardware.js` for Metal/CUDA/ROCm/Vulkan/CPU acceleration policy, CPU SIMD/thread tuning, auto backend selection, GPU-layer offload config, `/api/runtime` hardware visibility, System panel acceleration summary, docs/env knobs, and deterministic unit/integration coverage. |
| Codex Epic R pass | T119-T124 | Added `src/runtime-loading.js` for quantization-aware GGUF loading policy, KV-cache/context shifting, batching/micro-batching, mmap/mlock, multi-GPU split metadata, `/api/runtime` loading visibility, System panel model-load summary, `npm run bench:runtime`, docs/env knobs, and deterministic tests. |
| Codex Epic S pass | T125-T131 | Added `src/model-registry.js` and `/api/model-registry/*` for resumable/checksummed GGUF pulls, Hugging Face/OCI reference parsing, Modelfile-style derived models, local model library metadata/tags, create/cp/show/share operations, and SHA/signature provenance verification. |
| Codex GitHub issue cleanup | T006, T028, T038, T154, T155 | Closed the seven public starter issues: recipe validation now rejects bad shape/duplicate IDs, prompt-injection review and meeting follow-up email recipes are present, the Pages demo shows recipe/safety/receipt proof, diff-safe writes remain covered, receipt history is searchable by model/tool/file/timestamp metadata, and model compatibility docs explain tool/write/review/summarization fit. |

### Verified After These Passes

- Local suites covered: `npm run test:unit`, `npm run test:hardware`, `npm run test:loading`, `npm run test:registry`, `npm run test:redact`, `npm run test:documents`, `npm run test:audio`, `npm run test:search`, `npm run test:rerank`, `npm run test:integration`, `npm run test:backend`, `npm run test:v1`, `npm run test:bundled`, `npm run test:models`, `npm run test:embed-cache`, `npm run test:resume`, `npm run test:reindex`, `npm run test:health`, `npm run test:concurrency`, `npm run test:options`, `npm run test:resources`, `npm run eval:search`, `npm run bench:search`, `npm run test:tools`, `npm run test:structured`, `npm run test:planner`, `npm run test:guardrails`, `npm run test:reflection`, memory integration suites, `npm run test:ui`, `npm test`, `npm run eval`, `npm run release:checksums`, GitHub issue cleanup smoke coverage, and `git diff --check`.
- GitHub CI and GitHub Pages passed for the latest roadmap commits.
- GitHub Actions workflows now use Node-24-ready action majors and keep `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`, addressing the prior Node 20 action-runtime deprecation warning.

### Best Continuation Points

- T090/T091: finish automation webhook triggers and MCP parity expansion.
- T098/T104: add time-to-first-token/tokens-per-second metrics and idle-unload policy UI.

---

## Phase 0 — Foundation already shipped (baseline)

- [x] T001 Warm "ink & clay" UI redesign
- [x] T002 Collapsible grouped sidebar (progressive disclosure)
- [x] T003 SVG icon set + app icon (.icns) + packager wiring
- [x] T004 Hero GIF, README hero/promise, UI preview images
- [x] T005 Social preview card + README skim trim
- [x] T006 Interactive warm demo page
- [x] T007 Launch posts (HN / Reddit / PH / X)
- [x] T008 Receipt Spec v1 + Security Posture docs
- [x] T009 Provable foundation (unit + smoke + integration in CI)
- [x] T010 Shareable standalone HTML receipt export
- [x] T011 Pluggable model backend (Ollama + OpenAI-compatible) + e2e test
- [x] T012 True token streaming (NDJSON + SSE) with tool-call gating
- [x] T013 Model keep-alive (warm models)
- [x] T014 In-app model management: pull/list/delete (+ test)
- [x] T015 Response cache + prompt-budget guard
- [x] T016 Ollama gap analysis doc

---

## Phase 1 — Agent reliability & tool-calling (the wedge, hardened)

### Epic A — Native tool calling
- [x] T017 Add native tool-calling via Ollama `/api/chat` `tools` field
- [x] T018 Add OpenAI `tools`/function-calling for OpenAI-compatible backends
- [x] T019 Tool schema registry (JSON Schema per tool)
- [x] T020 Fall back to prompt-JSON parsing when a model lacks tool support
- [x] T021 Capability probe: detect per-model tool-calling support, cache result
- [x] T022 Multi-tool calls in a single step (parallel tool requests)
- [x] T023 Tool-call retry with repair on malformed arguments
- [x] T024 Unit + integration tests for native tool calling (mock backends)

### Epic B — Structured outputs
- [x] T025 Pass JSON-schema `format` to Ollama for constrained output
- [x] T026 OpenAI `response_format` json_schema support
- [x] T027 Schema-validate every tool argument before execution
- [x] T028 Typed extraction recipes (e.g., "extract table → JSON")
- [x] T029 Graceful schema-violation handling + user-visible reason
- [x] T030 Tests for structured-output round-trips

### Epic C — Planner & multi-step autonomy
- [x] T031 Explicit plan step: model proposes a plan before acting
- [x] T032 Plan shown in UI; user can edit/approve before execution
- [x] T033 Step budget + cost guardrails with user override
- [x] T034 Reflection step: self-check output against the request
- [x] T035 Loop-detection / no-progress abort
- [x] T036 Parallel independent tool execution within a step
- [x] T037 Cancellable runs (stop button → abort backend stream)
- [x] T038 Resume an interrupted run from its receipt (`/api/receipts/resume`, `/api/runs/pending/from-receipt`, receipt replay plans, UI resume action)

### Epic D — Agent memory
- [x] T039 Structured project memory schema (facts, prefs, decisions)
- [x] T040 Automatic memory capture suggestions after a run
- [x] T041 Memory retrieval ranked into the prompt budget
- [x] T042 Memory diff/history view + revert
- [x] T043 Per-workspace vs global memory scopes

---

## Phase 2 — RAG, search & knowledge

### Epic E — Search quality
- [~] T044 Local embedding index (exists; harden)
- [x] T045 Smarter chunking (semantic/markdown-aware) with overlap
- [x] T046 Hybrid search (BM25 keyword + vector) with score fusion
- [x] T047 Lexical reranker of top-k (exact-phrase, coverage, bigram, path-field; blended with hybrid; `scoreParts.rerank`/`.final`; test: `npm run test:rerank`)
- [x] T048 Embedding cache keyed by content hash (model + content hash; gated by `AGENTTRAIL_CACHE`; test: `npm run test:embed-cache`)
- [x] T049 Incremental re-index — reuse embeddings for unchanged files by content hash, refresh chunk metadata, re-embed only changed/new, drop deleted (`POST /api/search-index {incremental:true}`; returns reused/reembedded/removed; test: `npm run test:reindex`)
- [x] T050 Multi-vector / late-interaction option for long docs (chunk embeddings stored in the index; semantic search scores the best chunk and exposes `bestChunk` + `scoreParts.lateInteraction`; tests/eval assert it)
- [x] T051 Citations with exact line/char spans in answers (`/api/search` and `/api/search/chunks` return `citation` + `span` with line and char offsets; tests/eval assert spans)
- [x] T052 Search quality eval set + scoring harness (`scripts/eval-search.js`, `npm run eval:search`; scores hit@3 for keyword + hybrid, gated in CI)

### Epic F — Persistent vector store
- [x] T053 On-disk vector store (flat-file vector store at `.agenttrail/vector-store.json`; `/api/search-index` reports status; semantic search reads from it first)
- [x] T054 HNSW/IVF index for large corpora (dependency-free IVF-lite top-dimension buckets in the vector store; semantic search uses ANN candidate paths)
- [x] T055 Namespace/collection support per workspace (named search collections with scoped index/vector-store files and filters)
- [x] T056 Metadata filters — `path` (substring) and `ext` (comma-separated) query params on `/api/search` filter before ranking (test: `npm run test:reindex`)
- [x] T057 Store versioning + migration (`version`, `minReaderVersion`, record schemas, legacy normalization, search-index conversion, and migration manifest)
- [x] T058 Benchmark recall/latency vs brute force (`npm run bench:search`; deterministic corpus, brute-force baseline, recall@3, top-1 agreement, avg/p95 latency)

### Epic G — Document ingestion
- [x] T059 PDF text extraction (`/api/documents/extract` plus automatic PDF attachment Markdown sidecars)
- [x] T060 DOCX / PPTX / XLSX extraction (dependency-free OpenXML text extraction and attachment sidecars)
- [x] T061 HTML / Markdown / code-aware ingestion (clean HTML-to-Markdown, Markdown normalization, language-aware code fences)
- [x] T062 Image OCR for scanned docs (`/api/documents/ocr`, optional local OCR command, automatic image attachment sidecars)
- [x] T063 URL ingestion (fetch + clean + index) with allowlist (`/api/documents/ingest-url`, explicit host allowlist, redirect validation, private-host opt-in)
- [x] T064 Ingestion progress + receipts (progress arrays plus `receipts/ingestion/*.md` for attachments, document extraction, and URL ingestion)

---

## Phase 3 — Multi-modal

### Epic H — Vision
- [x] T065 Image input to vision models (selected workspace images are sent to Ollama/OpenAI-compatible vision backends)
- [x] T066 Drag-drop image into chat → base64 to backend
- [x] T067 Screenshot-to-action (describe + plan) flow
- [x] T068 Vision-model capability detection
- [x] T069 Tests with a mock vision backend (`tests/integration/vision-input.test.js`)

### Epic I — Audio
- [x] T070 Local speech-to-text (whisper.cpp integration)
- [x] T071 Voice prompt input in the UI
- [x] T072 Local text-to-speech for responses
- [x] T073 Audio file transcription recipe + receipt

### Epic J — Image generation (optional)
- [x] T074 Optional local image-gen backend adapter (SD/Flux servers)
- [x] T075 Image-gen results saved to workspace with provenance

---

## Phase 4 — Serving, API & interoperability

### Epic K — OpenAI-compatible server mode
- [x] T076 Expose AgentTrail's own `/v1/chat/completions` (agent-as-API)
- [x] T077 `/v1/models`, `/v1/embeddings` passthrough
- [x] T078 Streaming SSE for the served API
- [x] T079 API keys / local auth for served endpoints
- [x] T080 Rate limiting + request queue
- [x] T081 OpenAPI spec + generated client docs

### Epic L — Concurrency & throughput
- [x] T082 Bounded model concurrency + request queue (`AGENTTRAIL_MAX_CONCURRENCY`/`AGENTTRAIL_MAX_QUEUE`, status at `GET /api/concurrency`; test: `npm run test:concurrency`)
- [x] T083 Per-request model routing — each request carries its own `model`; the runtime loads on demand (documented in `docs/INTEGRATIONS.md`)
- [x] T084 Warm pool / eviction delegated to the runtime via `OLLAMA_KEEP_ALIVE` + `OLLAMA_MAX_LOADED_MODELS` (documented)
- [x] T085 Backpressure — `503` + `Retry-After` when the queue is full (test: `npm run test:concurrency`)
- [x] T086 Local load-test harness (`scripts/load-test.js`, `npm run load:test` — rps, avg/p95)

### Epic M — Integrations
- [x] T087 Integration docs (`docs/INTEGRATIONS.md`: OpenAI client, LangChain/LlamaIndex base_url)
- [x] T088 VS Code extension MVP (`editor/vscode-agenttrail/`: ask-about-selection, streamed reply)
- [x] T089 CLI pipe mode (`bin/agenttrail-chat.js`: stdin/argv prompt -> streamed reply)
- [~] T090 Automation triggers documented (cron/launchd + CLI + POST `/api/chat`; dedicated webhook endpoint pending)
- [~] T091 MCP exposes core workspace tools (`mcp/server.js`); full write-tool parity pending

---

## Phase 5 — Performance & resource management

### Epic N — Speed
- [x] T092 Prompt response cache
- [x] T093 Embedding cache (covered by T048 `fetchEmbeddingCached`, keyed by model + content hash)
- [~] T094 Speculative decoding — delegated to the runtime (no per-request Ollama knob); revisit with bundled engine (Phase 6)
- [x] T095 GPU-layer / context passthrough (`OLLAMA_NUM_GPU`/`OLLAMA_NUM_CTX`/`OLLAMA_NUM_THREAD` -> generate options; test: `npm run test:options`)
- [~] T096 Prefill reuse — partial via `keep_alive` warm context; explicit shared-prefix caching pending
- [x] T097 Real token streaming (no artificial delay; tokens forwarded as generated — see T012)
- [ ] T098 Time-to-first-token + tokens/sec metrics surfaced in UI

### Epic O — Resource management
- [x] T099 CPU/RAM/disk usage — `GET /api/resources` + a System panel in the Tools drawer (GPU reading still N/A in Node)
- [x] T100 Per-model RAM estimate (`/api/resources` `models[].estimatedRamBytes`)
- [x] T101 Quantization recommendation from free RAM (`/api/resources` `recommendedQuantization`)
- [x] T102 Disk usage shown in the System panel (free/total); per-folder breakdown still optional
- [x] T103 Configurable context length (`OLLAMA_NUM_CTX`, exposed in `/api/resources`)
- [~] T104 Keep-alive policy via `OLLAMA_KEEP_ALIVE`; idle-unload UI pending

---

## Phase 6 — The runtime moonshot (bundled inference engine)

> This is the hard core that actually makes us a peer to Ollama. Multi-quarter. Gated behind everything above being solid.

### Epic P — Embed an inference engine
- [x] T105 Evaluated — prefer optional `node-llama-cpp` (documented in `docs/RUNTIME_PHASE6.md`)
- [x] T106 Optional bundled runtime provider contract behind `AGENTTRAIL_MODEL_ADAPTER=bundled` / `AGENTTRAIL_BUNDLED_RUNTIME_MODULE`
- [~] T107 Load a local GGUF and run a completion with no external server (adapter path implemented; real `node-llama-cpp` hardware validation pending)
- [x] T108 Wire bundled engine as a first-class backend adapter (`src/model-adapters.js`, `src/bundled-runtime.js`, `/api/runtime`, `npm run test:bundled`)
- [~] T109 Streaming from the bundled engine (provider contract + mock coverage; native runtime validation pending)
- [~] T110 Embeddings from the bundled engine (provider contract + mock coverage; native runtime validation pending)
- [x] T111 Zero-dependency default preserved; bundled runtime is opt-in (documented)

### Epic Q — Hardware acceleration
- [x] T112 Metal (Apple Silicon) acceleration path (auto-select policy + provider config; hardware validation still requires a Mac GGUF run)
- [x] T113 CUDA path detection + load (CUDA env/device detection + provider config)
- [x] T114 ROCm path (ROCm/HIP env detection + provider config)
- [x] T115 Vulkan path (Vulkan SDK/ICD detection + provider config)
- [x] T116 CPU SIMD / thread tuning
- [x] T117 Auto-detect best backend per machine
- [x] T118 GPU-layer offload configuration

### Epic R — Model loading internals
- [x] T119 Quantization-aware loader (Q4_K_M, Q5, Q8, etc.)
- [x] T120 KV-cache management + context shifting
- [x] T121 Batched inference
- [x] T122 Mmap model loading for fast start
- [x] T123 Multi-GPU sharding (stretch)
- [x] T124 Benchmark tokens/sec vs Ollama on identical models

### Epic S — Model registry & distribution
- [x] T125 Resumable, checksummed model downloads
- [x] T126 Model registry client (pull from HuggingFace/OCI)
- [x] T127 `Modelfile`-equivalent build format
- [x] T128 Local model library with metadata + tags
- [x] T129 Model `create`/`cp`/`show` operations
- [x] T130 Optional push/share to a registry
- [x] T131 Signature/provenance verification on pull

---

## Phase 7 — Desktop, CLI & distribution

### Epic T — Native desktop app
- [~] T132 macOS `.app` bundle (exists; harden)
- [ ] T133 Menu-bar / tray app with background server
- [ ] T134 Auto-update channel
- [ ] T135 Code signing + notarization (macOS)
- [ ] T136 Windows installer (.msi/.exe) + signing
- [ ] T137 Linux packages (.deb/.rpm/AppImage)
- [ ] T138 First-run onboarding inside the desktop app
- [ ] T139 Native notifications for long pulls/runs

### Epic U — CLI parity with Ollama
- [ ] T140 `agenttrail run <model>` interactive REPL
- [ ] T141 `agenttrail pull / list / rm / ps / show`
- [ ] T142 `agenttrail serve` (headless API)
- [ ] T143 `agenttrail create` from a build file
- [ ] T144 Non-interactive scripting mode + JSON output
- [ ] T145 Shell completions (bash/zsh/fish)
- [ ] T146 CLI integration tests

### Epic V — Packaging & supply chain
- [~] T147 Docker image (exists; multi-arch)
- [ ] T148 Homebrew formula (publishable)
- [ ] T149 npm publish pipeline
- [ ] T150 SBOM generation
- [~] T151 Release checksums (exists; sign releases)
- [ ] T152 Reproducible builds

---

## Phase 8 — Security, privacy, observability, enterprise

### Epic W — Security & privacy
- [x] T153 Workspace path sandbox
- [x] T154 Writes-off-by-default + diff-gated apply
- [x] T155 Prompt-injection hardening scan (scanner expanded for system-prompt extraction, tool escalation, encoded payloads; prompt-injection review recipe and tests added)
- [ ] T156 Secret detection + redaction in context and receipts
- [ ] T157 Per-tool permission policies + audit
- [ ] T158 Network egress allowlist enforcement
- [ ] T159 Encrypted-at-rest option for workspace/receipts
- [ ] T160 Threat-model test suite (path escape, exfil, injection)

### Epic X — Observability
- [~] T161 Structured logs (exists; expand)
- [ ] T162 Metrics endpoint (Prometheus-style) for tokens/latency/errors
- [ ] T163 Per-run trace timeline view
- [ ] T164 Token + time accounting per run/recipe
- [ ] T165 Error taxonomy + actionable messages
- [ ] T166 Local analytics dashboard (privacy-preserving)

### Epic Y — Team / enterprise (optional track)
- [ ] T167 Read-only shared receipts view
- [ ] T168 Multi-user profiles (local)
- [ ] T169 RBAC for tools/permissions
- [ ] T170 Shared workspace sync (opt-in)
- [ ] T171 Audit-log export (CSV/JSON)
- [ ] T172 SSO hook (stretch)

---

## Phase 9 — Quality, docs, community, growth

### Epic Z — Quality engineering
- [~] T173 Unit/integration/smoke/backend/model tests (exist; grow)
- [ ] T174 Coverage reporting + threshold gate
- [ ] T175 UI end-to-end tests (Playwright) in CI
- [ ] T176 Property/fuzz tests for path + diff logic
- [ ] T177 Performance regression benchmarks in CI
- [ ] T178 Cross-platform CI matrix (mac/win/linux, node LTS)
- [ ] T179 Eval harness expansion + scoreboard

### Epic AA — Documentation
- [ ] T180 Docs site (static, searchable)
- [ ] T181 Getting-started + 60-second guide (visual)
- [ ] T182 Recipe authoring guide
- [ ] T183 Backend setup guides (LM Studio, llama.cpp, vLLM)
- [ ] T184 Architecture deep-dive
- [ ] T185 API reference (generated)
- [ ] T186 Troubleshooting + FAQ expansion
- [ ] T187 Video walkthroughs

### Epic AB — Community & growth
- [ ] T188 Execute launch (post + respond) — gated on screenshots
- [ ] T189 Recipe marketplace submissions + curation
- [ ] T190 Good-first-issue backlog + labels
- [ ] T191 Contribution guide + governance
- [ ] T192 Changelog discipline + release notes per version
- [ ] T193 Showcase gallery (user receipts/workflows)
- [ ] T194 Comparison benchmarks page (honest, reproducible)
- [ ] T195 Plugin SDK + examples

---

## Phase 10 — Ecosystem & advanced (stretch)

### Epic AC — Model ecosystem
- [ ] T196 LoRA/adapter loading
- [ ] T197 Fine-tuning launcher (delegates to a trainer)
- [ ] T198 Quantization tooling wrapper
- [ ] T199 Model conversion helpers (safetensors → GGUF)
- [ ] T200 Model evaluation suite (per-task scores)

### Epic AD — Advanced agent
- [ ] T201 Multi-agent orchestration (roles, hand-offs)
- [ ] T202 Background/scheduled agent runs
- [ ] T203 Long-running task journal + resume
- [ ] T204 Sub-agent spawning with budget isolation
- [ ] T205 Deterministic replay diffing across runs

---

## How we execute this

1. Work **top-down**: finish Phase 1 before Phase 2, except where a later task unblocks adoption.
2. Every task ships with: implementation, a test (where code), a doc note, and a sync to the app bundle.
3. Each completed batch produces a ready commit message for Codex to push.
4. We expand an epic's tasks into finer sub-tasks (toward 1000) only when we start that epic — so the plan stays honest and current.
5. We re-mark `[x]` here as we go; this file is the single source of truth for the campaign.

**Next up:** validate real `node-llama-cpp` with a tiny GGUF on hardware, then move into Phase 7 desktop/CLI distribution.

## Status & bug sweep (latest)

- Progress: **125 tasks done**, with 72 open or partial items in the tracked Phases 1-10 set. Phase 1 is complete; Phase 2 Epic E/F search foundation is complete except T044 as a hardening umbrella; Epic G document ingestion is complete; Phase 3 vision/audio/image generation is complete; Epic K is complete; Epic L is complete; Epic M is partially complete; Epic N/O now have cache, option passthrough, resources, and runtime visibility; Phase 6 now has a first-class bundled-runtime adapter seam plus Epic Q/R/S hardware, loading, and registry policy; and the public starter issues are cleared with tests/docs.
- Focused test suite green: unit, runtime hardware, runtime loading, model registry, bundled runtime, redaction, document extraction, API integration, v1 API, health, concurrency, model options, resources, smoke, recipe validation, receipt metadata, repo eval, and release checksums. All touched source files pass `node --check`.
- **Bug fixed:** `listWorkspaceFiles` only skipped `.DS_Store`, so internal `.agenttrail/*` state (logs, store, search index, pending-run) was being walked, indexed, and returned in search — adding noise and per-request churn to the index. Now excludes `.agenttrail/`. Verified against smoke, api, search-incremental, search-chunking, and eval:search.
- Known minor item: a couple of integration tests assert relative/invariant counts (not exact) because the workspace can still gain legit files (e.g. `memory/*`) between calls — intentional, not a bug.

Next code target: T107 real `node-llama-cpp` hardware validation with a tiny GGUF, then Phase 7 desktop/CLI distribution.

---

# Roadmap Expansion (Phases 11–16) — added to grow toward 1000

All `[ ]` open. Continues the sequential numbering from T205.

## Phase 11 — Conversation & UX depth

### Epic AE — Chat management
- [ ] T206 Persistent conversation history (list, open, continue past chats)
- [ ] T207 Rename a conversation
- [ ] T208 Pin / favorite conversations
- [ ] T209 Delete a conversation (with confirm + undo)
- [ ] T210 Full-text search across past conversations
- [ ] T211 Auto-title a chat from its first message
- [ ] T212 Export a single conversation (Markdown / JSON / HTML)
- [ ] T213 Import a conversation
- [ ] T214 Folders / tags for conversations
- [ ] T215 Branch a conversation from any message

### Epic AF — Composer & editing
- [ ] T216 Edit a sent user message and re-run
- [ ] T217 Regenerate the last assistant response
- [ ] T218 Stop-and-continue (resume generation)
- [ ] T219 Copy-message and copy-code buttons
- [ ] T220 Markdown + syntax-highlighted code rendering with copy
- [ ] T221 Slash-command palette in the composer (`/recipe`, `/file`, `/model`)
- [ ] T222 @-mention workspace files to attach context inline
- [ ] T223 Drag-and-drop files onto the chat to attach
- [ ] T224 Paste image / file into the composer

### Epic AG — Look, feel & access
- [ ] T225 Light/dark/system theme toggle (persisted)
- [ ] T226 Additional warm + high-contrast themes
- [ ] T227 Adjustable font size / density
- [ ] T228 Full keyboard navigation + visible focus states
- [ ] T229 Screen-reader pass (ARIA roles, live regions, labels)
- [ ] T230 Reduced-motion support
- [ ] T231 Responsive mobile layout polish
- [ ] T232 Installable PWA / offline shell
- [ ] T233 Internationalization (i18n) scaffolding + first locale

## Phase 12 — Data, privacy & portability

### Epic AH — Portability
- [ ] T234 Export all data (chats, receipts, memory, index) as a single archive
- [ ] T235 Import / restore from an exported archive
- [ ] T236 Per-workspace data isolation
- [ ] T237 Migrate workspace between machines
- [ ] T238 Scheduled local backups + retention policy

### Epic AI — Privacy controls
- [ ] T239 One-click "wipe all local data"
- [ ] T240 Secret detection + redaction in receipts/exports (extend T156)
- [ ] T241 Configurable data-retention windows per artifact type
- [ ] T242 Privacy dashboard: what is stored and where
- [ ] T243 Opt-in, local-only usage analytics (no network)

## Phase 13 — Reliability & operations

### Epic AJ — Resilience
- [ ] T244 Graceful degradation when the model backend is down (clear UI state)
- [x] T245 Health endpoint (`GET /api/health` — ok, uptime, version, backend; liveness check; test: `npm run test:health`). UI indicator still open.
- [ ] T246 Auto-retry with backoff on transient backend errors
- [ ] T247 Crash-safe writes (atomic temp-file + rename) for all stores
- [ ] T248 Corrupt-index detection + auto-rebuild
- [ ] T249 Disk-space guard before large writes/pulls
- [ ] T250 Structured error taxonomy with actionable messages (extend T165)
- [ ] T251 Request timeouts + cancellation surfaced consistently

### Epic AK — Config & admin
- [ ] T252 Settings UI for all env vars (model, cache, budget, host)
- [ ] T253 Config validation with friendly errors at startup
- [ ] T254 Per-workspace config overrides
- [ ] T255 First-run setup wizard

## Phase 14 — Evaluation & quality depth

### Epic AL — Evals
- [ ] T256 Golden-dataset eval harness for agent tasks
- [ ] T257 Citation-faithfulness check (answer claims map to evidence)
- [ ] T258 Hallucination / unsupported-claim detector
- [ ] T259 Regression eval gate in CI with trend tracking
- [ ] T260 A/B compare two models on the same task set
- [ ] T261 Tool-use correctness eval (right tool, right args)
- [ ] T262 Latency + tokens/sec benchmark across models (extend T058)

## Phase 15 — Cost, usage & smart routing

### Epic AM — Accounting & routing
- [ ] T263 Per-chat token + time accounting surfaced in UI (extend T164)
- [ ] T264 Usage dashboard (per model, per recipe, over time)
- [ ] T265 Budget caps with soft/hard limits and prompts
- [ ] T266 Automatic model routing by task type (code vs chat vs long-context)
- [ ] T267 Cheap-model draft → strong-model verify (speculative routing)
- [ ] T268 Per-recipe default model selection

## Phase 16 — Extensibility & ecosystem depth

### Epic AN — SDK & plugins
- [ ] T269 Documented plugin SDK + typed manifest
- [ ] T270 Plugin permissions + sandbox hardening review
- [ ] T271 Plugin hot-reload in dev
- [ ] T272 Example plugins (web-fetch, calculator, shell-guarded)
- [ ] T273 Plugin marketplace browse/install from UI
- [ ] T274 Recipe sharing import/export from URL (extend marketplace)

### Epic AO — Interop
- [ ] T275 VS Code extension MVP (chat + diff-apply in editor)
- [ ] T276 CLI chat REPL parity (extend Epic U)
- [ ] T277 Webhook triggers for automation
- [ ] T278 Local MCP client to consume external MCP servers
- [ ] T279 Export agent as an OpenAI-compatible endpoint (extend T076)
- [ ] T280 Shareable, self-contained run replay bundle
