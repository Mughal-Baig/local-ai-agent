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
| Claude handoff + Codex review | T038 carryover, T047, T048, T052 | Imported and hardened the Claude pass: local pending-run snapshot API/UI, lexical top-k reranker with `scoreParts.rerank`/`.final`, real embedding cache keyed by model + content hash, search hit@3 eval harness, CI scripts, focused tests, route catalog/eval visibility, and resume-banner UI polish. |
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
| Codex Phase 6 pass | T106, T108; T107/T109/T110 seam | Added a first-class experimental `bundled` backend adapter, optional runtime provider contract in `src/bundled-runtime.js`, `/api/runtime` readiness details, GGUF model config, mock bundled-runtime integration coverage for streaming/embeddings/structured output, docs, env examples, and CI/eval wiring while keeping the default install zero-dependency. |
| Codex Epic Q pass | T112-T118 | Added `src/runtime-hardware.js` for Metal/CUDA/ROCm/Vulkan/CPU acceleration policy, CPU SIMD/thread tuning, auto backend selection, GPU-layer offload config, `/api/runtime` hardware visibility, System panel acceleration summary, docs/env knobs, and deterministic unit/integration coverage. |
| Codex Epic R pass | T119-T124 | Added `src/runtime-loading.js` for quantization-aware GGUF loading policy, KV-cache/context shifting, batching/micro-batching, mmap/mlock, multi-GPU split metadata, `/api/runtime` loading visibility, System panel model-load summary, `npm run bench:runtime`, docs/env knobs, and deterministic tests. |
| Codex Epic S pass | T125-T131 | Added `src/model-registry.js` and `/api/model-registry/*` for resumable/checksummed GGUF pulls, Hugging Face/OCI reference parsing, Modelfile-style derived models, local model library metadata/tags, create/cp/show/share operations, and SHA/signature provenance verification. |
| Codex GitHub issue cleanup | T006, T028, T038, T154, T155 | Closed the seven public starter issues: recipe validation now rejects bad shape/duplicate IDs, prompt-injection review and meeting follow-up email recipes are present, the Pages demo shows recipe/safety/receipt proof, diff-safe writes remain covered, receipt history is searchable by model/tool/file/timestamp metadata, and model compatibility docs explain tool/write/review/summarization fit. |
| Codex Epic T pass | T132-T139 | Added native desktop distribution scaffolding: hardened macOS app bundle with Swift menu-bar launcher, Windows tray launcher, Linux desktop/deb/rpm/AppImage templates, update channel manifest and `/api/updates/check`, macOS/Windows signing dry-run scripts, desktop first-run onboarding state, and native notification hooks for long runs/model pulls. Real public signing still requires external Apple/Windows certificates. |
| Codex Epic U pass | T140-T146 | Replaced the tiny start-only CLI with an Ollama-style `agenttrail` command: `run` REPL/scripting mode, streamed JSON-capable `/api/chat` calls, `pull/list/rm/ps/show`, `serve`, `create` from Modelfile-style build files, bash/zsh/fish completions, CLI docs, CI wiring, and a mock-backed integration test. |
| Codex Epic V pass | T147-T152 | Added packaging and supply-chain foundation: BuildKit/OCI Dockerfile plus multi-arch GHCR workflow, publishable Homebrew formula generated from npm tarball SHA, npm provenance publish workflow, deterministic SPDX SBOM generation, checksum verification/signing scripts, reproducible `npm pack` check, release artifact workflow wiring, and supply-chain docs/tests. Real npm/Homebrew/GHCR publishing still requires registry ownership/secrets. |
| Codex Epic W pass | T156-T160 | Added the security/privacy layer: redaction before model context and audit artifacts, optional AES-256-GCM encrypted receipts/reports/sessions, per-tool policies with permission-audit events, centralized network egress allowlists for URL/image/model/marketplace flows, `/api/security/privacy`, and a threat-model suite for path escape, exfiltration, injection, egress denial, and encrypted receipt readback. |
| Codex Epic X pass | T161-T166 | Added the local observability layer: expanded structured logs, Prometheus-style `/api/metrics`, `/api/observability`, `/api/traces`, `/api/traces/content`, structured error taxonomy, per-run and recipe token/time accounting, persisted trace records, and an in-app privacy-preserving Observability dashboard. |
| Codex Epic Y pass | T167-T172 | Added the local team/enterprise layer: read-only shared receipts, local multi-user profiles, RBAC tool caps, opt-in shared sync packages, audit-log export in JSON/CSV, and an SSO identity hook for trusted local proxies. |
| Codex Epic Z pass | T173-T179 | Added the quality engineering layer: expanded quality tests, V8 coverage gate, UI E2E smoke with optional Playwright, shared path/diff fuzz tests, deterministic performance regression budgets, cross-platform Node matrix workflow, and eval category scoreboard. |
| Codex Epic AA pass | T180-T187 | Added the documentation layer: generated searchable static docs site, visual 60-second quick start, recipe authoring guide, LM Studio/llama.cpp/vLLM backend setup guide, architecture deep dive, generated API reference, expanded troubleshooting FAQ, and video walkthrough storyboards. |
| Codex Epic AB pass | T188-T195 | Added the community and growth layer: launch response workflow and macros, recipe marketplace curation, good-first issue backlog plus labels, contribution governance, changelog/release discipline, showcase gallery, honest comparison benchmark fixtures, plugin SDK docs, and example permissioned plugin manifests. |
| Codex Epic AC pass | T196-T200 | Added the model ecosystem layer: LoRA adapter manifests/runtime hints, fine-tuning launch delegation, quantization command wrapper, safetensors-to-GGUF conversion helper, per-task model evaluation suite, API routes, docs, eval checks, and unit/integration coverage. |
| Codex Epic AD pass | T201-T205 | Added the advanced agent layer: multi-agent orchestration manifests, scheduled-run records with local background journal checkpoints, long-running task journals with resume-to-pending support, budget-isolated sub-agent manifests, deterministic replay diffs, API routes, docs, eval checks, and unit/integration coverage. |
| Claude pass + Codex hardening | T212, T225, T240; T206-T211 API foundation | Imported Claude's conversation export/theme work, hardened the conversation store API, added `/api/redact`, redacted Markdown/JSON/HTML conversation export, persisted light/dark/system theme toggle, route/API/docs/eval visibility, and CI-backed integration tests. |
| Codex Epic AE pass | T206-T211, T213-T215 | Finished chat management: persistent sidebar history, open/continue, partial rename/pin/folder/tag updates, confirm delete with undo restore, full-text search across titles/tags/folders/messages, auto-title from first user prompt, JSON import, and branch-from-message support with UI controls and integration/UI coverage. |
| Codex Epic AF pass | T216-T224 | Added composer editing depth: edit-and-rerun from any user message, regenerate assistant responses, continue stopped generations, copy message/code controls, lightweight syntax-highlighted Markdown code blocks, `/recipe` `/file` `/model` slash palette, @file mention attachment, chat-level drag/drop, and paste file/image intake. |
| Codex Epic AG pass | T226-T233 | Added the access layer: warm and high-contrast themes, browser-persisted font size/density/motion/language controls, skip links, keyboard shortcut chords, ARIA log/status/listbox labels, visible focus states, reduced-motion handling, mobile drawer/composer polish, installable PWA manifest, and an offline app shell service worker. |
| Codex Epic AH pass | T234-T238 | Added the portability layer: checksumed all-in-one backup archives, managed `.agenttrail` export, safe restore folders, workspace identity/isolation profile, machine migration plan, scheduled backup settings, retention pruning, route/docs/eval coverage, and integration tests. |
| Codex Epic AI pass | T239, T241-T243 | Added the privacy control plane: confirmed local data wipe, dry-run wipe preview, per-artifact retention policy and apply endpoint, storage dashboard showing what is stored where, opt-in local-only analytics, UI panel, route/docs/eval coverage, and integration tests. |
| Codex Epic AJ pass | T244-T250 | Added the resilience layer: `/api/resilience`, graceful backend-down health/UI state, transient backend retry/backoff, atomic temp-file writes across local stores, corrupt search-index detection plus local-vector auto-rebuild, disk-space guards for writes/model pulls, expanded actionable error taxonomy, route/docs/eval/CI coverage, and unit/integration tests. |
| Codex Epic AK pass | T252-T255 | Added the config/admin layer: schema-backed model/cache/budget/host settings UI, `/api/config/admin`, `/api/config/workspace`, friendly startup validation actions, per-workspace `.agenttrail/workspace-config.json` overrides, persisted first-run setup state, Setup panel wizard controls, route/docs/eval/CI coverage, and unit/integration tests. |
| Codex T251 pass | T251 | Completed timeout/cancellation surfacing: run-level timeout controller, `run-control`/`timeout`/`cancelled` SSE events with stable codes, backend stream timeout propagation, UI/CLI timeout handling, config-admin timeout knobs, error taxonomy precedence, guardrail timeout test coverage, and docs/eval updates. |
| Codex Epic AL pass | T256-T262 | Added the eval-quality layer: golden agent task dataset, citation-faithfulness checks, unsupported-claim detector, CI regression trend gate, A/B model comparison, tool-use correctness scoring, latency/tokens benchmarks, `/api/evals/agent-quality`, `/api/benchmarks/models`, docs, route catalog, release metadata, and unit/integration coverage. |
| Codex Epic AM pass | T263-T268 | Added the accounting and routing layer: per-chat token/time usage records, `/api/accounting/usage`, `/api/accounting/routing`, in-app usage dashboard, soft/hard budget caps, automatic task-type model routing, speculative cheap-draft/strong-verify runs, recipe `defaultModel` hints, docs, route catalog, release metadata, eval checks, and unit/integration coverage. |
| Codex pre-Phase 15 cleanup | T044, T090, T091, T098, T104 | Closed the concrete carryovers before Phase 15: treated the local embedding stack as hardened by vector-store/chunk/eval/benchmark coverage, added `/api/webhooks/run` with pending-run receipts for automation triggers, added executable MCP stdio contract coverage for read/preview/write tools, surfaced time-to-first-token plus tokens/sec in usage accounting/UI, and exposed `OLLAMA_KEEP_ALIVE` as an idle-unload config/admin control. |
| Codex pre-Phase 15 partial closeout | T094, T096, T107, T109, T110 | Closed the remaining partials with bundled-runtime speculative policy (`AGENTTRAIL_SPECULATIVE_DECODING`), shared-prefix prefill reuse (`AGENTTRAIL_PREFILL_REUSE` plus provider `preload` / `node-llama-cpp` `preloadPrompt`), in-process GGUF validation (`npm run validate:bundled-runtime`), and expanded `npm run test:bundled` coverage for local completion streaming and embeddings without an external model server. |
| Codex Epic AN starter | T269-T270 | Added typed plugin manifest validation (`src/plugin-sdk.js`), SDK docs for required fields/approval behavior, sanitized public plugin manifests, receipt-backed permission enforcement, medium/high-risk approval gates, VM inline-code hardening, and `npm run test:plugins` CI coverage. |
| Codex Epic AN completion | T271-T272 | Added manifest-fingerprint plugin hot reload, `/api/plugins/status`, `/api/plugins/reload`, catalog reload receipts/logs, async sandbox execution, runnable `web-fetch`, `calculator`, and `shell-guarded` examples, and API/unit coverage for dev reload plus permissioned plugin behavior. |
| Codex Epic AN/AO interop pass | T273-T280 | Added plugin marketplace browse/install UI and receipts, recipe share URLs/imports, VS Code chat/apply MVP, `agenttrail chat` REPL parity, webhook trigger presets, external stdio MCP client consumption, `/api/interop/openai-export`, replay bundle export/import, docs, route catalog, and API/CLI/MCP test coverage. |
| Codex Epic AP demo-proof pass | T281-T287 | Added deterministic trust-loop demo data, `npm run demo:proof`, `npm run demo:health`, a refreshed five-step README GIF, proof storyboard, public `docs/demo-proof.html`, stale-asset fingerprinting, release checklist gates, release artifact coverage, and roadmap/docs/eval hooks. |

### Verified After These Passes

- Local suites covered: `npm run test:unit`, `npm run test:desktop`, `npm run test:cli`, `npm run test:supply-chain`, `npm run test:security-privacy`, `npm run test:privacy-controls`, `npm run test:resilience`, `npm run test:config-admin`, `npm run test:hardware`, `npm run test:loading`, `npm run test:registry`, `npm run test:redact`, `npm run test:redact-api`, `npm run test:conv-export`, `npm run test:documents`, `npm run test:audio`, `npm run test:search`, `npm run test:rerank`, `npm run test:integration`, `npm run test:backend`, `npm run test:v1`, `npm run test:bundled`, `npm run validate:bundled-runtime`, `npm run test:models`, `npm run test:ecosystem`, `npm run test:advanced`, `npm run test:accounting-routing`, `npm run test:mcp`, `npm run test:embed-cache`, `npm run test:resume`, `npm run test:reindex`, `npm run test:health`, `npm run test:concurrency`, `npm run test:options`, `npm run test:resources`, `npm run test:portability`, `npm run eval:search`, `npm run bench:search`, `npm run eval:agent`, `npm run bench:models`, `npm run test:eval-quality`, `npm run test:tools`, `npm run test:structured`, `npm run test:planner`, `npm run test:guardrails`, `npm run test:reflection`, memory integration suites, `npm run test:ui` including Epic AG access/PWA checks, `npm run test:quality`, `npm run test:docs`, `npm run test:community`, `npm run coverage`, `npm run bench:quality`, `npm test`, `npm run eval`, `npm run release:sbom`, `npm run release:homebrew`, `npm run release:reproducible`, `npm run release:checksums`, `npm run release:verify-checksums`, GitHub issue cleanup smoke coverage, and `git diff --check`.
- GitHub CI and GitHub Pages passed for the latest roadmap commits.
- GitHub Actions workflows now use Node-24-ready action majors and keep `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`, addressing the prior Node 20 action-runtime deprecation warning.

### Best Continuation Points

- T288/T295: continue with one-command install hardening and first-run retention now that Epic AP public proof is complete.

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
- [x] T044 Local embedding index hardened by semantic index, persisted vector store, chunk vectors, migrations, eval, and benchmark coverage
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
- [x] T090 Automation triggers documented with dedicated `/api/webhooks/run` endpoint, pending-run receipts, and token option
- [x] T091 MCP exposes core workspace tools (`mcp/server.js`) with read/search/preview/write parity and executable stdio contract test

---

## Phase 5 — Performance & resource management

### Epic N — Speed
- [x] T092 Prompt response cache
- [x] T093 Embedding cache (covered by T048 `fetchEmbeddingCached`, keyed by model + content hash)
- [x] T094 Speculative decoding policy implemented for the bundled runtime (`AGENTTRAIL_SPECULATIVE_DECODING`, provider `generateSpeculative`, runtime visibility, validation/test coverage)
- [x] T095 GPU-layer / context passthrough (`OLLAMA_NUM_GPU`/`OLLAMA_NUM_CTX`/`OLLAMA_NUM_THREAD` -> generate options; test: `npm run test:options`)
- [x] T096 Prefill reuse via explicit shared-prefix cache plus bundled provider `preload` / `node-llama-cpp` `preloadPrompt` path (`AGENTTRAIL_PREFILL_REUSE`)
- [x] T097 Real token streaming (no artificial delay; tokens forwarded as generated — see T012)
- [x] T098 Time-to-first-token + tokens/sec metrics surfaced in UI (`timeToFirstTokenMs`, Usage panel, accounting tests)

### Epic O — Resource management
- [x] T099 CPU/RAM/disk usage — `GET /api/resources` + a System panel in the Tools drawer (GPU reading still N/A in Node)
- [x] T100 Per-model RAM estimate (`/api/resources` `models[].estimatedRamBytes`)
- [x] T101 Quantization recommendation from free RAM (`/api/resources` `recommendedQuantization`)
- [x] T102 Disk usage shown in the System panel (free/total); per-folder breakdown still optional
- [x] T103 Configurable context length (`OLLAMA_NUM_CTX`, exposed in `/api/resources`)
- [x] T104 Keep-alive/idle-unload policy via `OLLAMA_KEEP_ALIVE`, System visibility, and config-admin control

---

## Phase 6 — The runtime moonshot (bundled inference engine)

> This is the hard core that actually makes us a peer to Ollama. Multi-quarter. Gated behind everything above being solid.

### Epic P — Embed an inference engine
- [x] T105 Evaluated — prefer optional `node-llama-cpp` (documented in `docs/RUNTIME_PHASE6.md`)
- [x] T106 Optional bundled runtime provider contract behind `AGENTTRAIL_MODEL_ADAPTER=bundled` / `AGENTTRAIL_BUNDLED_RUNTIME_MODULE`
- [x] T107 Load a local GGUF and run a completion with no external server (`AGENTTRAIL_MODEL_ADAPTER=bundled`, in-process provider contract, `npm run validate:bundled-runtime`)
- [x] T108 Wire bundled engine as a first-class backend adapter (`src/model-adapters.js`, `src/bundled-runtime.js`, `/api/runtime`, `npm run test:bundled`)
- [x] T109 Streaming from the bundled engine (provider `onToken` stream, `/api/chat` SSE path, validation + `npm run test:bundled`)
- [x] T110 Embeddings from the bundled engine (`embedBundledText`, `/v1/embeddings`, validation + `npm run test:bundled`)
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
- [x] T132 macOS `.app` bundle (hardened generator, icon, desktop env, fallback launcher)
- [x] T133 Menu-bar / tray app with background server (macOS Swift menu-bar source, Windows tray PowerShell launcher, Linux tray shell)
- [x] T134 Auto-update channel (`updates/latest.json`, `/api/updates/check`, desktop menu link)
- [x] T135 Code signing + notarization (macOS dry-run/real command scaffold; requires Apple credentials for public release)
- [x] T136 Windows installer (.msi/.exe) + signing (Inno/WiX templates plus Authenticode script; requires certificate for public release)
- [x] T137 Linux packages (.deb/.rpm/AppImage) (deb control, RPM spec, AppRun/AppData, staging script)
- [x] T138 First-run onboarding inside the desktop app (`AGENTTRAIL_DESKTOP` mode and desktop onboarding state)
- [x] T139 Native notifications for long pulls/runs (desktop notification helper wired to runs and model pulls)

### Epic U — CLI parity with Ollama
- [x] T140 `agenttrail run <model>` interactive REPL
- [x] T141 `agenttrail pull / list / rm / ps / show`
- [x] T142 `agenttrail serve` (headless API)
- [x] T143 `agenttrail create` from a build file
- [x] T144 Non-interactive scripting mode + JSON output
- [x] T145 Shell completions (bash/zsh/fish)
- [x] T146 CLI integration tests

### Epic V — Packaging & supply chain
- [x] T147 Docker image (BuildKit/OCI Dockerfile plus GHCR multi-arch workflow)
- [x] T148 Homebrew formula (publishable release tarball URL, SHA-256, `agenttrail`/`agenttrail-chat`, service)
- [x] T149 npm publish pipeline (provenance workflow with dry-run/manual path)
- [x] T150 SBOM generation (deterministic SPDX 2.3 output)
- [x] T151 Release checksums (verify plus optional PEM signature script; real signing requires release secret)
- [x] T152 Reproducible builds (`npm pack` twice with isolated cache and SHA comparison)

---

## Phase 8 — Security, privacy, observability, enterprise

### Epic W — Security & privacy
- [x] T153 Workspace path sandbox
- [x] T154 Writes-off-by-default + diff-gated apply
- [x] T155 Prompt-injection hardening scan (scanner expanded for system-prompt extraction, tool escalation, encoded payloads; prompt-injection review recipe and tests added)
- [x] T156 Secret detection + redaction in context and receipts
- [x] T157 Per-tool permission policies + audit
- [x] T158 Network egress allowlist enforcement
- [x] T159 Encrypted-at-rest option for workspace/receipts
- [x] T160 Threat-model test suite (path escape, exfil, injection)

### Epic X — Observability
- [x] T161 Structured logs (exists; expand)
- [x] T162 Metrics endpoint (Prometheus-style) for tokens/latency/errors
- [x] T163 Per-run trace timeline view
- [x] T164 Token + time accounting per run/recipe
- [x] T165 Error taxonomy + actionable messages
- [x] T166 Local analytics dashboard (privacy-preserving)

### Epic Y — Team / enterprise (optional track)
- [x] T167 Read-only shared receipts view
- [x] T168 Multi-user profiles (local)
- [x] T169 RBAC for tools/permissions
- [x] T170 Shared workspace sync (opt-in)
- [x] T171 Audit-log export (CSV/JSON)
- [x] T172 SSO hook (stretch)

---

## Phase 9 — Quality, docs, community, growth

### Epic Z — Quality engineering
- [x] T173 Unit/integration/smoke/backend/model tests (exist; grow)
- [x] T174 Coverage reporting + threshold gate
- [x] T175 UI end-to-end tests (Playwright) in CI
- [x] T176 Property/fuzz tests for path + diff logic
- [x] T177 Performance regression benchmarks in CI
- [x] T178 Cross-platform CI matrix (mac/win/linux, node LTS)
- [x] T179 Eval harness expansion + scoreboard

### Epic AA — Documentation
- [x] T180 Docs site (static, searchable)
- [x] T181 Getting-started + 60-second guide (visual)
- [x] T182 Recipe authoring guide
- [x] T183 Backend setup guides (LM Studio, llama.cpp, vLLM)
- [x] T184 Architecture deep-dive
- [x] T185 API reference (generated)
- [x] T186 Troubleshooting + FAQ expansion
- [x] T187 Video walkthroughs

### Epic AB — Community & growth
- [x] T188 Execute launch (post + respond) — gated on screenshots
- [x] T189 Recipe marketplace submissions + curation
- [x] T190 Good-first-issue backlog + labels
- [x] T191 Contribution guide + governance
- [x] T192 Changelog discipline + release notes per version
- [x] T193 Showcase gallery (user receipts/workflows)
- [x] T194 Comparison benchmarks page (honest, reproducible)
- [x] T195 Plugin SDK + examples

---

## Phase 10 — Ecosystem & advanced (stretch)

### Epic AC — Model ecosystem
- [x] T196 LoRA/adapter loading
- [x] T197 Fine-tuning launcher (delegates to a trainer)
- [x] T198 Quantization tooling wrapper
- [x] T199 Model conversion helpers (safetensors → GGUF)
- [x] T200 Model evaluation suite (per-task scores)

### Epic AD — Advanced agent
- [x] T201 Multi-agent orchestration (roles, hand-offs)
- [x] T202 Background/scheduled agent runs
- [x] T203 Long-running task journal + resume
- [x] T204 Sub-agent spawning with budget isolation
- [x] T205 Deterministic replay diffing across runs

---

## How we execute this

1. Work **top-down**: finish Phase 1 before Phase 2, except where a later task unblocks adoption.
2. Every task ships with: implementation, a test (where code), a doc note, and a sync to the app bundle.
3. Each completed batch produces a ready commit message for Codex to push.
4. We expand an epic's tasks into finer sub-tasks (toward 1000) only when we start that epic — so the plan stays honest and current.
5. We re-mark `[x]` here as we go; this file is the single source of truth for the campaign.

**Next up:** Continue the public-growth expansion at T288 with install-path hardening, then move into T295 first-run retention. The Phase 17-22 expansion below adds the public "top 1%" path without replacing any earlier phase.

## Status & bug sweep (latest)

- Progress: **Epic AP is complete through T287** with no open or partial pre-Phase-16 roadmap items. Fully complete tracked items now include T001-T287, including the pre-Phase-15 closeout tasks T044, T090, T091, T094, T096, T098, T104, T107, T109, and T110. Phase 1 is complete; Phase 2 Epic E/F search foundation is complete; Epic G document ingestion is complete; Phase 3 vision/audio/image generation is complete; Epic K is complete; Epic L is complete; Epic M is complete for the local automation/MCP server surface; Epic N/O now have cache, option passthrough, resources, speculative bundled-runtime policy, explicit shared-prefix prefill reuse, TTFT/tokens-sec usage visibility, keep-alive idle-unload controls, runtime visibility, the AJ resilience layer, T251 timeout/cancel surfacing, and the AK config/admin layer; Phase 6 now has a first-class bundled-runtime adapter seam plus local GGUF validation, streaming, embeddings, Epic Q/R/S hardware, loading, registry policy, Epic AC model ecosystem helpers, Epic AD advanced-agent manifests, Epic AE chat management, Epic AF composer editing, Epic AG access/PWA polish, Epic AH portability archives, Epic AI privacy controls, Epic AJ resilience controls, T251 run-control polish, and Epic AK config/admin controls; Epic T native desktop distribution is complete at the repo/scaffolding level; Epic U CLI parity is complete; Epic V packaging/supply-chain foundation is complete; Epic W security/privacy is complete; Epic X observability is complete; Epic Y team/enterprise is complete; Epic Z quality engineering is complete; Epic AA documentation is complete; Epic AB community/growth is complete; Epic AL eval quality is complete; Epic AM accounting/routing is complete; Epic AN SDK/permission hardening, plugin hot reload, runnable examples, marketplace install, and recipe sharing are complete; Epic AO interop is complete with VS Code, CLI chat, webhook triggers, MCP client, OpenAI export, and replay bundles; Epic AP killer demo proof is complete with deterministic demo assets and a release health gate; and the public starter issues are cleared with tests/docs.
- Focused test suite green: accounting/routing, MCP stdio contract, config-admin, docs generation, UI E2E, bundled runtime, API integration, smoke, and repo eval, plus the prior unit, resilience, observability, team enterprise, quality engineering, community-growth, model ecosystem, coverage gate, performance regression, desktop distribution, CLI integration, supply-chain, security/privacy threat-model, privacy controls, runtime hardware, runtime loading, model registry, redaction, document extraction, v1 API, health, concurrency, model options, resources, portability, recipe validation, receipt metadata, release SBOM, reproducibility, and release checksums coverage. All touched source files pass `node --check`.
- **Bug fixed:** `listWorkspaceFiles` only skipped `.DS_Store`, so internal `.agenttrail/*` state (logs, store, search index, pending-run) was being walked, indexed, and returned in search — adding noise and per-request churn to the index. Now excludes `.agenttrail/`. Verified against smoke, api, search-incremental, search-chunking, and eval:search.
- Known minor item: a couple of integration tests assert relative/invariant counts (not exact) because the workspace can still gain legit files (e.g. `memory/*`) between calls — intentional, not a bug.

Next code target: install and first-run growth. Prioritize T288 one-command install hardening, then T295 guided first-run retention.

---

# Roadmap Expansion (Phases 11–16) — added to grow toward 1000

Open items are still marked `[ ]`; a few Phase 11/12 starter tasks are now `[x]`. Continues the sequential numbering from T205.

## Phase 11 — Conversation & UX depth

### Epic AE — Chat management
- [x] T206 Persistent conversation history (list, open, continue past chats)
- [x] T207 Rename a conversation
- [x] T208 Pin / favorite conversations
- [x] T209 Delete a conversation (with confirm + undo)
- [x] T210 Full-text search across past conversations
- [x] T211 Auto-title a chat from its first message
- [x] T212 Export a single conversation as Markdown / JSON / HTML (`POST /api/conversations/export`, secrets redacted; test: `npm run test:conv-export`)
- [x] T213 Import a conversation
- [x] T214 Folders / tags for conversations
- [x] T215 Branch a conversation from any message

### Epic AF — Composer & editing
- [x] T216 Edit a sent user message and re-run
- [x] T217 Regenerate the last assistant response
- [x] T218 Stop-and-continue (resume generation)
- [x] T219 Copy-message and copy-code buttons
- [x] T220 Markdown + syntax-highlighted code rendering with copy
- [x] T221 Slash-command palette in the composer (`/recipe`, `/file`, `/model`)
- [x] T222 @-mention workspace files to attach context inline
- [x] T223 Drag-and-drop files onto the chat to attach
- [x] T224 Paste image / file into the composer

### Epic AG — Look, feel & access
- [x] T225 Light/dark/system theme toggle in the top bar, persisted in localStorage; dark palette via `[data-theme="dark"]` CSS-variable overrides
- [x] T226 Additional warm + high-contrast themes
- [x] T227 Adjustable font size / density
- [x] T228 Full keyboard navigation + visible focus states
- [x] T229 Screen-reader pass (ARIA roles, live regions, labels)
- [x] T230 Reduced-motion support
- [x] T231 Responsive mobile layout polish
- [x] T232 Installable PWA / offline shell
- [x] T233 Internationalization (i18n) scaffolding + first locale

## Phase 12 — Data, privacy & portability

### Epic AH — Portability
- [x] T234 Export all data (chats, receipts, memory, index) as a single archive (`/api/backup/export`, archive manifest/checksums, managed `.agenttrail` data included)
- [x] T235 Import / restore from an exported archive (`/api/backup/import`, safe `workspace/restored/<archive>/` default, checksum validation)
- [x] T236 Per-workspace data isolation (`/api/workspace/portability`, `.agenttrail/workspace-profile.json`, workspace-scoped portable paths)
- [x] T237 Migrate workspace between machines (`/api/workspace/migration-plan`, restore modes, source/target workspace mismatch detection)
- [x] T238 Scheduled local backups + retention policy (`/api/backup/schedule`, `/api/backup/schedule/run`, retention pruning)

### Epic AI — Privacy controls
- [x] T239 One-click "wipe all local data" (`/api/privacy/wipe`, dry-run preview, explicit `WIPE LOCAL DATA` confirmation, UI action)
- [x] T240 Secret redaction auto-applied in conversation exports (`/api/conversations/export`); receipts redaction optional next
- [x] T241 Configurable data-retention windows per artifact type (`/api/privacy/retention`, `/api/privacy/retention/apply`, `.agenttrail/retention-policy.json`)
- [x] T242 Privacy dashboard: what is stored and where (`/api/privacy/dashboard`, UI Privacy panel)
- [x] T243 Opt-in, local-only usage analytics (no network) (`/api/privacy/settings`, `.agenttrail/local-analytics.json`, network disabled)

## Phase 13 — Reliability & operations

### Epic AJ — Resilience
- [x] T244 Graceful degradation when the model backend is down (clear UI state via `/api/health`, `/api/resilience`, and the System/Model panels)
- [x] T245 Health endpoint (`GET /api/health` — ok, uptime, version, backend; liveness check; test: `npm run test:health`; now returns `status: degraded` while backend is down instead of pretending all systems are healthy)
- [x] T246 Auto-retry with backoff on transient backend errors (`fetchBackendWithRetry`, retry metadata, `AGENTTRAIL_BACKEND_RETRIES`, `AGENTTRAIL_BACKEND_RETRY_BASE_MS`)
- [x] T247 Crash-safe writes (atomic temp-file + rename) for all local stores (`src/resilience.js`, workspace writes, JSONL store, logs, vector/search artifacts, migrations, privacy/model/agent stores)
- [x] T248 Corrupt-index detection + auto-rebuild (`inspectSearchIndexHealth`, corrupt backup, local-vector rebuild, `/api/search-index` repair metadata)
- [x] T249 Disk-space guard before large writes/pulls (`AGENTTRAIL_MIN_FREE_BYTES`, `AGENTTRAIL_MODEL_PULL_MIN_FREE_BYTES`, 507 response with `DISK_SPACE`)
- [x] T250 Structured error taxonomy with actionable messages (extended T165 with `DISK_SPACE`, `CORRUPT_INDEX`, `STARTUP_CONFIG`, `RETRY_EXHAUSTED`)
- [x] T251 Request timeouts + cancellation surfaced consistently (`run-control`, `timeout`, `cancelled` SSE events, UI/CLI handling, `AGENTTRAIL_RUN_TIMEOUT_MS`, backend stream timeout propagation)

### Epic AK — Config & admin
- [x] T252 Settings UI for all env vars (model, cache, budget, host) (`Config` drawer panel renders schema-backed settings from `/api/config/admin`)
- [x] T253 Config validation with friendly errors at startup (`src/config.js` emits actionable checks and startup warnings)
- [x] T254 Per-workspace config overrides (`.agenttrail/workspace-config.json`, `/api/config/workspace`, env-safe startup application)
- [x] T255 First-run setup wizard (`/api/onboarding`, `.agenttrail/first-run.json`, Setup panel refresh/complete controls)

## Phase 14 — Evaluation & quality depth

### Epic AL — Evals
- [x] T256 Golden-dataset eval harness for agent tasks (`src/eval-quality.js`, `GOLDEN_TASKS`, `npm run eval:agent`)
- [x] T257 Citation-faithfulness check (answer claims map to evidence) (`checkCitationFaithfulness`, `[E#]` evidence mapping)
- [x] T258 Hallucination / unsupported-claim detector (`detectUnsupportedClaims`, forbidden/risky claim flags)
- [x] T259 Regression eval gate in CI with trend tracking (`agent-eval-trend.json`, CI `node scripts/eval-agent-tasks.js`)
- [x] T260 A/B compare two models on the same task set (`compareModels`, `/api/evals/agent-quality/compare`)
- [x] T261 Tool-use correctness eval (right tool, right args) (`evaluateToolUseCorrectness`)
- [x] T262 Latency + tokens/sec benchmark across models (extend T058) (`npm run bench:models`, `/api/benchmarks/models`)

## Phase 15 — Cost, usage & smart routing

### Epic AM — Accounting & routing
- [x] T263 Per-chat token + time accounting surfaced in UI (extend T164; SSE `accounting`, usage chips, `agenttrail.usage-record.v1`)
- [x] T264 Usage dashboard (per model, per recipe, over time; `/api/accounting/usage`, drawer Usage panel)
- [x] T265 Budget caps with soft/hard limits and prompts (`budgetCaps`, Tight/Standard/Deep profiles, guardrail prompt injection)
- [x] T266 Automatic model routing by task type (code vs chat vs long-context; `/api/accounting/routing`, `classifyTaskType`, `chooseModelRoute`)
- [x] T267 Cheap-model draft → strong-model verify (speculative routing; Verify mode, `agenttrail.speculative-verification.v1`)
- [x] T268 Per-recipe default model selection (`defaultModel` schema + recipe hints for coder/security/README packs)

## Phase 16 — Extensibility & ecosystem depth

### Epic AN — SDK & plugins
- [x] T269 Documented plugin SDK + typed manifest (`src/plugin-sdk.js`, `docs/PLUGIN_SDK.md`, sanitized `/api/plugins` catalog, CI `npm run test:plugins`)
- [x] T270 Plugin permissions + sandbox hardening review (matching permissions required, receipt-backed scopes, medium/high approval gates, inline VM code restrictions)
- [x] T271 Plugin hot-reload in dev (`loadPluginCatalog`, `/api/plugins/status`, `/api/plugins/reload`, reload logs/receipts)
- [x] T272 Example plugins (runnable `web-fetch`, `calculator`, `shell-guarded` with permissioned sandbox handlers)
- [x] T273 Plugin marketplace browse/install from UI (`marketplace/plugins.json`, `/api/plugins/marketplace`, `/api/plugins/install`, Top 1% Kit install/recheck UI, install receipts)
- [x] T274 Recipe sharing import/export from URL (AgentTrail share URLs, `/api/marketplace/share`, `/api/marketplace/import-share`, Top 1% Kit share/import UI)

### Epic AO — Interop
- [x] T275 VS Code extension MVP (chat + diff-apply in editor via `editor/vscode-agenttrail`)
- [x] T276 CLI chat REPL parity (extend Epic U with `agenttrail chat`, slash commands, JSON one-shot mode)
- [x] T277 Webhook triggers for automation (`/api/webhooks/triggers`, `/api/webhooks/triggers/run`, pending-run receipts)
- [x] T278 Local MCP client to consume external MCP servers (`src/mcp-client.js`, `mcp/clients.json`, approved calls + receipts)
- [x] T279 Export agent as an OpenAI-compatible endpoint (extend T076 with `/api/interop/openai-export`)
- [x] T280 Shareable, self-contained run replay bundle (`/api/replay/bundle`, `/api/replay/bundle/import`, optional redacted file snapshots)

---

# Top 1% Upgrade Expansion (Phases 17-22) - added after ranking baseline

This expansion does not replace Phase 0-16. It adds the next public-product layer after the 2026-05-31 comparison against leading local/self-hosted agent projects such as OpenHands, Cline, AnythingLLM, Open Interpreter, Aider, and Continue.

## Ranking baseline (2026-05-31)

- Brutal current score: **62/100** against the best local-agent projects.
- Strongest wedge: local-first trust, receipts, diff-gated writes, searchable evidence, redaction, and replay/export.
- Biggest gap: public adoption and instant proof. The repo can look impressive in docs, but top projects win because a new user can install, run, understand, and trust the core loop in minutes.
- Score targets:
  - 70/100: conversation UI, first-run flow, one-command install, and demo proof are all reliable.
  - 80/100: daily workflow is smooth enough for real users, with benchmarks and public comparison proof.
  - 90/100: signed desktop builds, strong onboarding, stable releases, user showcases, and active issue/discussion loops.
  - 95+/100: AgentTrail owns a distinct category: the auditable local-agent layer for local models.

## Phase 17 — 60-second proof and install

### Epic AP — Killer demo proof
- [x] T281 Record a real GIF/video of search -> diff preview -> apply -> receipt -> shareable report.
- [x] T282 Add a one-click demo script that creates a tiny workspace and runs the full trust loop.
- [x] T283 Add deterministic demo data so screenshots/GIFs are reproducible.
- [x] T284 Add a demo health check that verifies search, diff, apply, receipt, and export before recording.
- [x] T285 Put the GIF above the README fold with a short "why star this" caption.
- [x] T286 Add a public `/demo-proof.html` page with the same flow and links to source files.
- [x] T287 Add a release checklist item that blocks launches when demo assets are stale.

### Epic AQ — One-command install that feels real
- [ ] T288 Make `npx agenttrail` start the app with a clean first-run path.
- [ ] T289 Add `brew install agenttrail` instructions that work after the formula is published.
- [ ] T290 Add a Docker quick-start that persists workspace data safely.
- [ ] T291 Add a Mac app download path with checksum verification and Gatekeeper notes.
- [ ] T292 Add a setup doctor that checks Node, Ollama, disk space, ports, and model availability.
- [ ] T293 Add friendly install failure messages for port conflicts, missing model runtimes, and bad permissions.
- [ ] T294 Add a 60-second install test in CI using the packaged artifact path.

## Phase 18 — First-run retention and daily-use polish

### Epic AR — First-run product path
- [ ] T295 Build a guided first-run wizard: choose workspace, choose model, run first task.
- [ ] T296 Add a sample "fix a typo safely" task that always succeeds locally.
- [ ] T297 Add empty states that show the next useful action instead of documentation blocks.
- [ ] T298 Add model download/setup prompts only when the model is actually missing.
- [ ] T299 Add "use your own project" handoff after the sample task completes.
- [ ] T300 Add first-run telemetry that is local-only and visible in the privacy dashboard.

### Epic AS — Daily agent workflow
- [ ] T301 Finish persistent conversation UI for list/open/rename/pin/delete/search.
- [ ] T302 Add one-screen run review: files read, evidence used, diff preview, trust score, receipt.
- [ ] T303 Add a "continue last run" button from the home/empty state.
- [ ] T304 Add recent workspaces and recent recipes with clear privacy boundaries.
- [ ] T305 Add quick actions for code review, docs summarize, security scan, and meeting notes.
- [ ] T306 Add run failure recovery: retry, save prompt, export debug bundle, or open troubleshooting.
- [ ] T307 Add keyboard-first navigation for the core chat/search/diff/receipt loop.

## Phase 19 — Trust, safety, and reliability proof

### Epic AT — End-to-end reliability gates
- [ ] T308 Add an end-to-end trust-loop test covering search -> plan -> diff -> apply -> receipt -> report.
- [ ] T309 Add fixture workspaces for code, docs, secrets, images, audio, and large files.
- [ ] T310 Add a nightly long-run suite for memory, replay, MCP, search, and report export.
- [ ] T311 Add flaky-test quarantine rules with issue creation and owner labels.
- [ ] T312 Add release-blocking regression budgets for startup, search, first token, and report export.
- [ ] T313 Add crash-recovery tests for interrupted writes, corrupt receipts, and partial indexes.
- [ ] T314 Add cross-platform smoke tests for macOS, Windows, and Linux packages.

### Epic AU — Public safety proof
- [ ] T315 Add a public threat-model page with concrete blocked attack examples.
- [ ] T316 Add prompt-injection demo fixtures and screenshots showing safe refusal/flagging.
- [ ] T317 Add a "nothing leaves your machine" audit page that maps every network path.
- [ ] T318 Add receipt redaction verification for reports, conversation export, and debug bundles.
- [ ] T319 Add path-boundary proof tests for symlinks, dotfiles, archives, and generated files.
- [ ] T320 Add a security disclosure policy and supported-version table.

## Phase 20 — Credibility, benchmarks, and public comparison

### Epic AV — Honest comparison engine
- [ ] T321 Publish a comparison table against OpenHands, Cline, AnythingLLM, Open Interpreter, Aider, and Continue.
- [ ] T322 Separate comparison dimensions: install, local privacy, coding, RAG, multimodal, MCP, safety, receipts, replay.
- [ ] T323 Add reproducible benchmark scripts behind every comparison claim.
- [ ] T324 Add screenshots for each feature claim so readers can see proof before installing.
- [ ] T325 Add a "where AgentTrail is weaker" section to build trust and reduce hype.
- [ ] T326 Refresh comparison data on every major release.

### Epic AW — Community growth loop
- [ ] T327 Open and label starter issues mapped to the next 20 roadmap tasks.
- [ ] T328 Add GitHub Discussions categories for showcase, support, recipes, and roadmap voting.
- [ ] T329 Add contributor quick-start that gets tests running in under 5 minutes.
- [ ] T330 Add release posts for HN, Reddit, X, LinkedIn, Product Hunt, and local-LLM communities.
- [ ] T331 Add a user showcase submission template for receipts, reports, and workflows.
- [ ] T332 Add "good first recipe" tasks so non-core contributors can help without touching server code.
- [ ] T333 Add a weekly roadmap status note template with completed, next, blockers, and help wanted.

## Phase 21 — Real distribution for non-developers

### Epic AX — Signed desktop releases
- [ ] T334 Produce signed macOS builds with notarization and checksum verification.
- [ ] T335 Produce signed Windows installer builds with SmartScreen-friendly metadata.
- [ ] T336 Produce Linux AppImage/deb/rpm artifacts with desktop integration.
- [ ] T337 Add automatic update checks that respect local-only/privacy settings.
- [ ] T338 Add release provenance: SBOM, checksums, signatures, and build logs linked from releases.
- [ ] T339 Add a download page that chooses the right installer for the user's OS.
- [ ] T340 Add post-install smoke checks that launch the app and verify the local server.

### Epic AY — Supportability
- [ ] T341 Add one-click local diagnostic bundle with redaction and explicit user review.
- [ ] T342 Add troubleshooting flows for model missing, Ollama offline, port busy, slow GPU, and disk full.
- [ ] T343 Add versioned migration tests for receipts, conversations, memory, indexes, and profiles.
- [ ] T344 Add upgrade notes inside the app after major releases.
- [ ] T345 Add backwards compatibility policy for CLI, receipts, reports, and plugin manifests.
- [ ] T346 Add issue templates that request diagnostic output without secrets.
- [ ] T347 Add a public support matrix for macOS, Windows, Linux, Node, Ollama, and model backends.

## Phase 22 — Durable moat

### Epic AZ — AgentTrail-only differentiators
- [ ] T348 Make trust score explainable: each score item links to evidence, files, diffs, or receipts.
- [x] T349 Add receipt replay bundles that can be shared without exposing private workspace files (delivered via T280 replay bundles with default no-file-content export and optional redacted snapshots)
- [ ] T350 Add "proof mode" that refuses to answer without cited local evidence when enabled.
- [ ] T351 Add an agent black-box recorder: prompts, tools, diffs, approvals, timing, errors, and model settings.
- [ ] T352 Add recipe-to-report pipelines for repeatable workflows with consistent outputs.
- [ ] T353 Add local governance rules: "this workspace never allows shell", "reports always redact secrets", etc.
- [ ] T354 Add a public gallery of safe, redacted receipts as the main brand artifact.

### Epic BA — Ecosystem integrations
- [ ] T355 Finish MCP client/server parity with per-tool scopes, receipts, and approvals.
- [ ] T356 Add IDE integrations beyond VS Code: JetBrains, Cursor-compatible endpoint, and editor-agnostic CLI hooks.
- [ ] T357 Add Obsidian/Markdown vault workflow for local knowledge agents.
- [ ] T358 Add GitHub issue/PR workflow recipes that still run locally and preserve receipts.
- [ ] T359 Add import/export packs for teams, students, founders, writers, security reviewers, and researchers.
- [ ] T360 Add a plugin compatibility test kit so third-party plugins can prove safety and receipt behavior.
