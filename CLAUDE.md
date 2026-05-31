# Claude Handoff

This folder is the working source copy that may be synced to GitHub by Codex.

- The old public roadmap name `docs/ROADMAP_COMPETE_OLLAMA.md` was intentionally renamed to `docs/LOCAL_AGENT_LAYER_ROADMAP.md`.
- Use this public framing: **AgentTrail is the auditable local-agent layer for Ollama and other local model runtimes.**
- Do not recreate the old "compete with Ollama" title or filename in public docs.
- If you reference the roadmap, link to `docs/LOCAL_AGENT_LAYER_ROADMAP.md`.
- Keep stale generated files out of commits: `*.bak`, `docs/.Rhistory`, `docs/preview.svg`, and `docs/demo-flow.svg`.

## Latest Claude Import + Codex Hardening - Conversation Export And Theme

Claude added a Phase 11/12 starter pass and Codex imported, checked, and hardened it:

- T206-T211 API foundation: `server.js` now has local conversation record endpoints for save/list/search/open/rename/pin/delete under `/api/conversations*`. UI wiring for a full chat-history drawer is still open.
- T212: `/api/conversations/export` exports a single conversation as Markdown, JSON, or HTML with secret redaction.
- T225: the browser has a persisted light/dark/system theme toggle using `localStorage` key `agenttrail-theme` and `[data-theme="dark"]` CSS variables.
- T240: `/api/redact` exposes the same local secret masking used by conversation export and audit surfaces.
- Tests/scripts: `npm run test:conv-export` and `npm run test:redact-api`; CI runs both.

Recommended verification before changing this layer: `npm run test:conv-export`, `npm run test:redact-api`, `npm run test:docs`, `npm run eval`, `npm test`, and `git diff --check`.

## Latest Codex Pass - Epic AD Advanced Agent

Codex completed Epic AD (T201-T205):

- T201: added `src/advanced-agent.js` multi-agent orchestration manifests with planner/researcher/implementer/reviewer roles, scoped permissions, hand-offs, acceptance criteria, and local artifacts.
- T202: added scheduled-run manifests plus `/api/advanced-agent/schedule`; due or `runNow` schedules start a local background job that records a journal checkpoint instead of running hidden cloud automation.
- T203: added resumable task journals with create/append/resume APIs. Resume returns a pending-run payload and can save it to `.agenttrail/pending-run.json`.
- T204: added sub-agent manifests with budget isolation. Child max steps/tool calls/tokens/runtime are capped by the parent budget and tracked separately.
- T205: added deterministic replay diffing that canonicalizes runs by removing volatile IDs/timestamps/latency, then writes stable hashes and a text diff.

Primary files: `src/advanced-agent.js`, `server.js`, `src/route-catalog.js`, `docs/ADVANCED_AGENT.md`, `tests/unit/advanced-agent.test.js`, and `tests/integration/advanced-agent.test.js`.

Recommended verification before changing this layer: `npm run test:advanced`, `npm run test:docs`, `npm run eval`, `npm test`, and `git diff --check`.

## Latest Codex Pass - Epic W Security & Privacy

Codex completed Epic W (T156-T160):

- T156: redaction now runs before model context and before receipts/sessions/reports/logs/audit artifacts are stored. Helper: `src/privacy.js`; patterns: `src/features/redact.js`.
- T157: `src/permissions.js` now exposes per-tool policies and `agenttrail.permission-audit.v1`; agent tool decisions append `permission-audit` and structured log events.
- T158: centralized network policy in `src/network-policy.js`; URL ingestion, marketplace imports, image-generation endpoints, and model-registry HTTP pulls enforce explicit allowlists/private-network rules.
- T159: optional AES-256-GCM encrypted-at-rest managed artifacts via `AGENTTRAIL_ENCRYPT_AT_REST` + `AGENTTRAIL_ENCRYPTION_KEY`; receipts decrypt through normal read APIs when the key is present.
- T160: added `npm run test:security-privacy`, covering path escape, exfiltration, prompt injection, egress denial, redaction, policies, and encrypted receipt readback.

Recommended verification before changing this layer: `npm run test:security-privacy`, `npm run test:redact`, `npm run test:quality`, `npm run test:docs`, `npm run test:community`, `npm run test:ecosystem`, `npm run coverage`, `npm run bench:quality`, `npm run test:unit`, `npm run test:integration`, `npm test`, and `npm run eval`.

## Latest Codex Roadmap Pass

Codex completed the first hard engineering slice from Phase 1:

- T017: native Ollama tool calling via `/api/chat` `tools`
- T018: OpenAI-compatible `tools` / function-calling
- T019: shared tool schema registry in `src/tool-schemas.js`
- T020: fallback to prompt-JSON tool calls when native tools are unsupported
- T021: per-model native tool capability probe + cache (`/api/tools/capability`)
- T022: multi-tool calls in one model step, with read-only batches running in parallel
- T023: malformed tool-call argument repair before model retry
- T024: mock-backend integration tests for native tool calling
- T025: Ollama JSON-schema `format` support through `/api/structured-output`
- T026: OpenAI-compatible `response_format.json_schema` support through `/api/structured-output`
- T027: schema validation before tool execution
- T028: typed extraction recipes (`extract-tasks-json`, `extract-table-json`) with `/api/structured-output/recipe`
- T029: schema-violation responses now include a user-visible reason/message
- T030: structured-output round-trip tests for Ollama and OpenAI-compatible mock backends
- T031: `/api/agent/plan` generates a structured model plan before acting
- T032: UI plan panel lets the user edit/approve the plan before chat execution
- T033: step-budget guardrails with explicit deep-run override and budget receipts
- T034: deterministic self-check reflection event scores the final answer against the request
- T035: loop/no-progress guard aborts repeated identical tool batches before re-execution
- T036: parallel independent tool execution within a step, while write-like tools stay ordered
- T037: Stop button aborts the browser request and backend model stream
- T039: structured project memory JSON with facts, preferences, decisions, citations, and tests
- T040: automatic post-run memory suggestions with explicit user apply controls
- T041: ranked memory retrieval endpoint and prompt-budgeted structured memory injection
- T042: memory history list, diff preview, and revert flow that records a new audit entry
- T043: project/global memory scopes with prompt injection for both scopes and UI switching
- T045: markdown-aware overlapping search chunks with section headings, chunk type, and line ranges in the saved index
- T046: hybrid search ranking with BM25 keyword scoring, vector similarity, normalized score fusion, and exposed score parts
- T047: deterministic lexical top-k reranker with phrase, coverage, bigram, and path-field signals
- T048: real embedding cache keyed by model + content hash
- T052: search quality eval harness with hit@3 scoring for keyword and hybrid modes
- T038: local pending-run snapshots plus receipt/report-derived resume are done

Best next Claude tasks:

- Work on docs and UI copy around native tool calling, structured outputs, planner approval, run guardrails, reflection, loop safety, structured memory, memory suggestions, ranked memory retrieval, memory history, scoped memory, markdown-aware chunk citations, hybrid search score parts, reranking, embedding cache, and search evals.
- Do not rework `server.js` tool-calling, structured-output, planner, run-cancellation, loop/reflection, memory internals, search chunking, hybrid ranking, reranking, embedding cache, search benchmarks, or resumable-run internals unless you also run the matching scripts: `npm run test:tools`, `npm run test:structured`, `npm run test:planner`, `npm run test:guardrails`, `npm run test:reflection`, `npm run test:memory`, `npm run test:memory-suggestions`, `npm run test:memory-retrieval`, `npm run test:memory-history`, `npm run test:memory-scopes`, `npm run test:search`, `npm run test:rerank`, `npm run test:embed-cache`, `npm run test:resume`, `npm run eval:search`, and `npm run bench:search`.
- Next code target should be T076 OpenAI-compatible server mode, now that Epic J image generation is complete.

## Latest Claude Pass

Reviewed Codex's work and continued the roadmap:

- T047: reranker. Added `rerankDocuments()` for deterministic cross-encoder-style lexical reranking of top search hits using exact phrase, coverage, bigram, and path-field signals. Exposes `scoreParts.rerank` and `scoreParts.final`. Test: `npm run test:rerank`.

- T048: embedding cache. Added `fetchEmbeddingCached(text, model)` wrapping the real-embedding fetch, keyed by `model + content-hash`, gated by `AGENTTRAIL_CACHE`, capped at 2000 entries. Repointed the semantic-query and index-build embed call sites to it (the probe is left uncached). Test: `npm run test:embed-cache`.

- T052: search-quality eval harness. Added `scripts/eval-search.js` (boots a temp-workspace server, seeds a labeled 4-doc corpus, builds a local-vector index, scores hit@3 for keyword and hybrid ranking, exits non-zero below `SEARCH_EVAL_THRESHOLD`, default 75%). `npm run eval:search`, added to CI. Currently 100% hit@3 for both modes.

- T038 original partial: pending-run snapshot. Added `/api/runs/pending`, `/api/runs/pending/clear`, a resume banner in the UI, route catalog coverage, and `npm run test:resume`. Receipt-derived resume is completed in the latest Codex pass below.

Still open and recommended next: T076 OpenAI-compatible server mode.

## Latest Claude Pass - UI redesign + handoff completion

- Verified Codex's pass (all suites green, clean modules) and finished the open items.
- T038: supplied the server endpoints (`handleSavePendingRun`/`handleGetPendingRun`/`handleClearPendingRun`, `PENDING_RUN_PATH = .agenttrail/pending-run.json`) that Codex's `tests/integration/resumable-run.test.js` expects. That test now passes (was failing/missing endpoints, which had broken CI). Client saves a snapshot on send, clears on clean completion, shows a resume banner on reload.
- T047: lexical reranker confirmed (`rerankDocuments`), `npm run test:rerank` added to CI.
- T052/T048: search eval + embedding cache (prior pass), in CI.

### Chat-first UI redesign (per user: "make it simple like Claude/Ollama/Gemini")
- `public/index.html` + `public/styles.css` (v15) + `public/app.js` (v23): slim sidebar (`.rail`: brand, `#newChat`, privacy note, `#toolsToggle`), minimal topbar (`#modelSelect` + small `#workspaceStatus` + Trust pill `#trustScore` + `#toolsToggleTop`), centered chat (max 792px), subtle `[data-prompt]` suggestion chips, and a rounded composer pill with a paperclip `#attachFiles` and a circular `#sendButton`; `#stepBudgetSelect`/`#planButton`/`#stopButton` moved to a quiet row.
- **All advanced panels were moved verbatim into a slide-in `#toolsDrawer`** (toggled by `#toolsToggle`/`#toolsToggleTop`/`#toolsToggleMobile`/`#toolsBackdrop`/Esc). Every prior element ID is preserved, so all wiring still works.
- New additive JS: `startNewChat`, `openToolsDrawer`, `closeToolsDrawer`.
- Pre-redesign backups at `public/index.html.bak2` / `public/styles.css.bak2` - git-ignored (`*.bak2`), do not commit.
- Verified: full suite 24/24 (unit/integration/smoke/eval), all app.js IDs present in HTML, tags balanced.

## Latest Claude Pass - Phase 2 RAG (T049 + T056)

- T049 Incremental re-index: `incrementalSearchIndex()` in `server.js` reuses embeddings for unchanged files (by content hash from the existing index), refreshes chunk metadata, re-embeds only changed/new files, drops deleted ones, and falls back to a full rebuild when no index exists or the embedding backend is down. Exposed via `POST /api/search-index {"incremental": true}` (returns `reused`/`reembedded`/`removed`).
- T056 Metadata filters: `/api/search` accepts `path` (substring) and `ext` (comma-separated extensions); filtering happens on the file list before ranking, so ranking internals are untouched.
- Tests: `tests/integration/search-incremental.test.js` (`npm run test:reindex`), added to CI. Did NOT modify chunking/hybrid/rerank internals; ran `test:search`, `test:rerank`, `eval:search` - all pass. Full suite 25/25.
- Note: `.agenttrail/` is now excluded from workspace walking so internal logs, stores, pending runs, and search indexes do not pollute file search. Tests still assert relative/invariant counts because legitimate workspace files such as `memory/*` can appear during server startup.

## Latest Codex Pass - Citation spans + GitHub sync

- T051 exact-span citations: `/api/search` and `/api/search/chunks` now return `citation` plus `span` with `startLine`, `endLine`, `charStart`, and `charEnd`.
- Search chunks now persist char spans in the index, file-level snippets keep exact source offsets, and the UI shows line citations under each search result.
- Tests/evals updated: `test:search`, `test:integration`, `test:reindex`, and `eval:search` assert citation spans.

## Latest Codex Pass - Multi-vector search

- T050 multi-vector / late-interaction search is done: the search index now stores embeddings per chunk as well as per file, semantic search scores each result by its best matching chunk, and results expose `bestChunk`, `semanticMode`, and `scoreParts.lateInteraction`.
- `/api/search/chunks` strips raw `embedding` and `text` fields from responses, so vectors stay internal while citations remain visible.
- Tests/evals updated: `test:search`, `test:integration`, `test:reindex`, and `eval:search` assert chunk vectors, best-chunk metadata, and sanitized chunk responses.

## Latest Codex Pass - On-disk vector store

- T053 on-disk vector store is done: full and incremental search-index builds now also write `.agenttrail/vector-store.json` using schema `agenttrail.vector-store.v1`.
- Semantic search reads vectors from the flat-file store first, then falls back to legacy vectors embedded in `.agenttrail/search-index.json` for compatibility.
- `/api/search-index` now reports `features.onDiskVectorStore` and a `vectorStore` summary with file/chunk/vector counts.
- Tests/evals updated: `test:unit`, `test:integration`, `test:reindex`, `eval`, and `eval:search` cover vector-store creation and semantic use.

## Latest Codex Pass - Vector-store migrations

- T057 store versioning/migration is done: vector stores now carry `version`, `minReaderVersion`, `recordSchema`, per-record schema/version fields, and migration history metadata.
- `src/vector-store.js` can normalize legacy `.agenttrail/vector-store.json` files, convert embedded `agenttrail.search-index.v1` vectors into the flat vector store, and write `.agenttrail/vector-store-migrations.json`.
- `src/migrations.js` now includes `005-vector-store-versioning`, so old workspaces upgrade during the normal migration pass.
- Tests/evals/docs updated: foundation tests cover legacy normalization and search-index conversion; API/reindex tests assert versioned store status.

## Latest Codex Pass - Search recall/latency benchmark

- T058 recall/latency benchmark is done: `npm run bench:search` starts a temp AgentTrail server, seeds 30 local docs, builds a local-vector index, and compares semantic search against a brute-force scanner.
- The benchmark reports index-build time, vector count, recall@3, MRR, average latency, p95 latency, max latency, and AgentTrail-vs-brute top-1 agreement.
- CI now runs `node scripts/benchmark-search.js`; `scripts/evaluate-agenttrail.js` also checks that the benchmark harness exists.
- `scripts/eval-search.js` now waits on `/api/config` instead of `/api/status` so search eval readiness does not race backend model probes.

## Latest Codex Pass - IVF-lite ANN index

- T054 large-corpus ANN indexing is done as a dependency-free IVF-lite layer: `src/vector-store.js` now builds `agenttrail.vector-ann.ivf-lite.v1` buckets from top vector dimensions for file and chunk records.
- Semantic search now uses ANN candidate paths from the vector store before doing file/chunk vector scoring, while keyword matches still keep their safety fallback.
- `/api/search-index` reports `features.annIndex`, `features.annAlgorithm`, and `vectorStore.ann`; `scoreParts.annCandidate` is visible on semantic results.
- Tests/evals/benchmark updated: foundation tests cover ANN bucket/candidate behavior, API/reindex assert ANN status, `bench:search` asserts ANN exists, and repo eval checks for the ANN harness.

## Latest Codex Pass - Search collections

- T055 namespace/collection support is done: `collection` is accepted on `/api/search-index`, `/api/search`, and `/api/search/chunks`.
- The default workspace index stays at `.agenttrail/search-index.json`; named collections write isolated indexes and vector stores under `.agenttrail/search-collections/{id}/`.
- Collection builds accept scoped filters such as `{ "filters": { "path": "docs", "ext": "md" } }`; search and incremental rebuilds preserve those filters.
- Tests/evals/docs updated: API tests cover collection build/search/chunk search, reindex tests cover collection incremental rebuilds, and repo eval checks collection support.

## Latest Codex Pass - Receipt-derived resume

- T038 is now fully done: receipts/reports can be parsed back into a resumable pending run.
- New APIs: `GET /api/receipts/resume?path=...` and `POST /api/runs/pending/from-receipt`; `/api/replay/plan` also accepts receipt/report paths.
- Markdown receipts and shareable reports now include a `## Resume Prompt` section, plus model/files/permissions/trail parsing for replay.
- UI: the receipt timeline has a "Resume selected receipt" action that restores prompt, model, selected files, permissions, and trail without auto-running.
- Tests/evals/docs updated: `npm run test:resume` covers receipt-derived restore; repo eval checks the new endpoints.

## Latest Codex Pass - PDF ingestion

- T059 is done: `src/document-ingestion.js` extracts selectable PDF text locally, including uncompressed streams and FlateDecode streams, without adding dependencies.
- New API: `POST /api/documents/extract` accepts a workspace PDF path and writes a searchable Markdown sidecar (`*.pdf.agenttrail.md` by default).
- PDF attachments through `/api/attachments` now automatically produce extracted Markdown context notes when text is available, so the agent can use the PDF content without reading binary bytes.
- Tests/evals/docs updated: `npm run test:documents`, API integration coverage for PDF attachments/extract endpoint, CI checks for the new module, and repo eval checks PDF extraction.

## Latest Codex Pass - Office document ingestion

- T060 is done: the same document-ingestion module now extracts DOCX, PPTX, and XLSX text using a dependency-free ZIP/OpenXML reader.
- `/api/documents/extract` supports PDF, DOCX, PPTX, and XLSX; `/api/attachments` automatically writes searchable `.agenttrail.md` sidecars for all four formats.
- DOCX extracts paragraphs from `word/document.xml`; PPTX extracts slide text from `ppt/slides/*.xml`; XLSX resolves shared strings and sheet rows into readable Markdown.
- Tests/evals/docs updated: `npm run test:documents` covers PDF + DOCX/PPTX/XLSX fixtures, API integration covers office attachments, and repo eval checks office extraction.

## Latest Codex Pass - HTML/Markdown/code ingestion

- T061 is done: `src/document-ingestion.js` now ingests HTML, Markdown, code, and plain text in addition to PDF and Office files.
- HTML is cleaned into Markdown-like text with scripts/styles removed; Markdown is normalized; code files are wrapped in language-aware fenced blocks.
- `/api/documents/extract` and `/api/attachments` both create searchable `.agenttrail.md` sidecars for supported text documents.
- Tests/evals/docs updated: `npm run test:documents` covers HTML/Markdown/code, API integration covers HTML and TypeScript attachments, and repo eval checks text ingestion.

## Latest Codex Pass - URL ingestion

- T063 is done: `POST /api/documents/ingest-url` fetches only explicit allowlisted hosts, re-checks every redirect, blocks private/local hosts unless `allowPrivate: true`, caps response size, extracts supported document text, and writes searchable `.agenttrail.md` sidecars with `Source URL` metadata.
- Tests/evals/docs updated: API integration covers allowlist/private-host behavior and cleaned HTML URL ingestion; repo eval checks the URL ingestion endpoint.

## Latest Codex Pass - Ingestion progress receipts

- T064 is done: successful attachment extraction, `/api/documents/extract`, and `/api/documents/ingest-url` now return a `progress` array and save a Markdown receipt under `receipts/ingestion/`.
- Ingestion receipts record operation, source file, source URL when present, output file, media type, document type, extracted character count, warnings, and completed progress steps.
- Tests/evals/docs updated: API integration asserts document and URL ingestion receipts, smoke asserts attachment ingestion receipts, repo eval checks the receipt implementation, and the receipt spec now includes ingestion receipts.

## Latest Codex Pass - Image OCR ingestion

- T062 is done: image scans can be OCR'd through `POST /api/documents/ocr`, and PNG/JPEG/TIFF/BMP/WebP attachments are OCR'd automatically when a local OCR command is configured.
- OCR is local-first and optional: default command is `tesseract {{input}} stdout -l {{language}}`; users can set `AGENTTRAIL_OCR_COMMAND` and `AGENTTRAIL_OCR_ARGS` for another local executable. Missing OCR engines return a friendly setup error instead of pretending OCR worked.
- OCR outputs use the same searchable `.agenttrail.md` sidecars, progress arrays, and `receipts/ingestion/` audit receipts as the rest of document ingestion.
- Tests/evals/docs updated: API integration uses `tests/fixtures/mock-ocr.js` to prove OCR without external binaries, unit tests cover image detection, route catalog/eval/docs/roadmap now expose `/api/documents/ocr`.

## Latest Codex Pass - Vision image input

- T065 and T069 are done: selected PNG/JPEG/TIFF/BMP/WebP workspace files are attached to model calls as true vision payloads, not just OCR text.
- Ollama receives images through `images` arrays on chat/generate requests; OpenAI-compatible local servers receive `image_url` data URL content parts.
- Image attachments now return/select `visionPath` in the browser, so users get both OCR/searchable notes and raw image pixels for a vision-capable model.
- The prompt includes image path/hash metadata, `/api/chat` emits a `vision` SSE event, and cache keys include selected image hashes.
- Tests/evals/docs updated: `tests/integration/vision-input.test.js`, `npm run test:vision`, CI coverage, repo eval check, README/model-backend docs, and roadmap status.

## Latest Codex Pass - Drag-drop image composer

- T066 is done: users can drag image files into the chat composer or paste screenshots/images into the prompt, and AgentTrail saves them through `/api/attachments`.
- Browser-side image intake now allows up to 2 MB per image by default, while text attachments keep the smaller prompt-context limit.
- The server now has separate attachment limits for text, generic binary files, image files, and `/api/attachments` request bodies, so dropped screenshots can be stored and then selected for vision-model calls.
- Dropped/pasted images still produce local attachment notes/OCR receipts when available, and their raw image paths are selected as `visionPath` for the next chat run.
- Tests/evals/docs updated: API integration covers image attachments above the old 80 KB cap, UI smoke checks drag/paste wiring, repo eval checks the feature, and README/roadmap/env docs were updated.

## Latest Codex Pass - Vision capability detection

- T068 is done: models now get a `scores.vision` value and `capabilities.vision` metadata from `/api/status` and `/api/models`.
- `/api/models/vision-capability?model=...` returns heuristic detection, and `refresh=1` runs an explicit tiny local image probe against Ollama or OpenAI-compatible backends.
- The UI now shows a Vision row in model capability scores and labels vision-ready models in the installed-model list.
- Chat runs that attach image payloads to a clearly non-vision model add a visible `vision` event/warning, so users can understand bad image answers.
- Tests/evals/docs updated: mock Ollama model-management test covers heuristic + probe success/failure, API route smoke includes the endpoint, UI smoke checks the Vision surface, repo eval checks the feature, and roadmap/docs were updated.

## Latest Codex Pass - Screenshot-to-action flow

- T067 is done: the composer has a Screenshot action button that opens image intake when needed and turns the selected screenshot into an editable plan before execution.
- `/api/agent/plan` now collects selected vision images, attaches image payloads to Ollama/OpenAI-compatible structured planning calls, adds screenshot context to the planner prompt, and returns `vision` metadata with model-capability warnings.
- The planner safely treats image files as image context instead of trying to read binary pixels as text, while still preserving path/hash/size metadata for receipts and auditability.
- Tests/evals/docs updated: planner integration covers image payloads in OpenAI-compatible planning, UI smoke checks the screenshot-action surface, repo eval checks the feature, and README/model-backend/top-1%/roadmap docs were updated.

## Latest Codex Pass - Local speech-to-text

- T070 is done: `/api/audio/transcribe` runs a local, configurable whisper.cpp-compatible command (`AGENTTRAIL_TRANSCRIBE_COMMAND` + `AGENTTRAIL_TRANSCRIBE_ARGS`) against workspace audio/video files.
- Audio attachments now carry `audioPath` and `transcriptionReady` metadata, while transcription writes searchable `*.agenttrail-transcript.md` sidecars and ingestion receipts under `workspace/receipts/ingestion/`.
- The new `src/audio-transcription.js` helper handles audio detection, media types, transcript cleanup, and Markdown transcript formatting without adding external dependencies.
- Tests/evals/docs updated: unit + integration coverage use `tests/fixtures/mock-transcribe.js`, CI runs the audio suite, route catalog/foundation routes expose `/api/audio/transcribe`, repo eval checks the feature, and README/model-backend/top-1%/roadmap docs were updated.

## Latest Codex Pass - Audio UX completion

- T071 is done: the composer has a microphone button that records a voice prompt in the browser, saves it as a local audio attachment, transcribes it with `/api/audio/transcribe`, selects the transcript, and inserts the transcript text into the prompt.
- T072 is done: assistant messages now have a Speak control backed by `/api/audio/speak`, which shells out to a configurable local TTS command (`AGENTTRAIL_TTS_COMMAND` + `AGENTTRAIL_TTS_ARGS`), saves local audio output, exposes it through `/api/files/raw`, and records a receipt.
- T073 is done: `recipes/audio-transcription.json` is an actionable recipe. When selected with a local audio file, it runs transcription, saves a searchable transcript sidecar, selects it for context, and logs the receipt.
- Tests/evals/docs updated: mock TTS fixture, expanded audio integration coverage, UI smoke checks voice/TTS/recipe surfaces, repo eval checks all three tasks, route catalog/foundation docs/env/README/roadmap were updated.

## Latest Codex Pass - Image generation + GitHub warning

- GitHub Actions Node 20 warning is addressed: CI, Pages, and release-artifact workflows now use Node-24-ready action majors and keep `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`.
- T074 is done: `/api/images/generate` can call local Automatic1111/Forge-style `/sdapi/v1/txt2img` servers or OpenAI-compatible SD/Flux image endpoints through `src/image-generation.js`.
- T075 is done: generated images are saved under the workspace, exposed through `/api/files/raw`, and paired with Markdown provenance containing prompt, backend, endpoint, parameters, seeds, output paths, bytes, and hashes.
- Tests/evals/docs updated: `npm run test:images`, mock local image backend integration test, route catalog/foundation coverage, README/env/docs/roadmap/eval updates, and CI coverage.

## Latest Codex Pass - OpenAI-compatible served API

- T076 is done: AgentTrail now exposes its own OpenAI-compatible `/v1/chat/completions` endpoint, so OpenAI-style clients can call the auditable local agent layer directly instead of only using the browser UI.
- T077 is done: `/v1/models` and `/v1/embeddings` proxy the active local backend and return OpenAI-shaped model/embedding responses.
- T078 is done: served chat supports OpenAI-style SSE chunks plus optional usage chunks.
- T079 is done: `/v1/*` supports bearer or `x-api-key` local auth through `AGENTTRAIL_V1_API_KEY(S)` and `AGENTTRAIL_V1_REQUIRE_AUTH`.
- T080 is done: served endpoints have in-memory per-key rate limiting plus a local request queue with overload headers/responses.
- T081 is done: `docs/openapi/agenttrail-v1-openapi.json` and `docs/OPENAI_COMPATIBLE_API.md` document the served API.
- Tests/evals/docs updated: `npm run test:v1`, route catalog/foundation/smoke coverage, repo eval checks, env docs, README/model-backend docs, and roadmap status were updated.

Next open: T082 request queue with configurable concurrency.

## Latest Claude Pass — verify Codex + T245 health

- Verified Codex's continuation (T050 late-interaction, T051 citation spans, T058 search bench, T059-T064 doc ingestion, T065-T069 vision, audio, image-gen, Epic K OpenAI-compatible server): full suite 32/32 green, server.js syntax OK. Roadmap markers already accurate (83 done).
- Added T245 health endpoint: `GET /api/health` (ok, status, uptimeSeconds, version, backend, pid, time) — lightweight liveness, no backend call. `tests/integration/health.test.js`, `npm run test:health`, CI step. Did not touch other internals; smoke + api still pass.
- Next open: T206 conversation history, T244 graceful-degradation UI, T263 per-chat usage accounting, T234/T235 export/import archive.

## Latest Codex Review Of Claude Pass

- Imported Claude's broader Phase 4/5/6 batch from Downloads: bounded model concurrency/backpressure, `/api/concurrency`, `/api/resources`, `/api/runtime`, System panel, `OLLAMA_NUM_CTX`/`OLLAMA_NUM_GPU`/`OLLAMA_NUM_THREAD` passthrough, `scripts/load-test.js`, `docs/INTEGRATIONS.md`, `docs/RUNTIME_PHASE6.md`, `bin/agenttrail-chat.js`, and the VS Code MVP.
- Hardened the handoff by exposing `agenttrail-chat` as an npm bin, adding redaction and new route coverage to CI, adding `/api/health`/resources/runtime/concurrency to route catalog and foundation docs, expanding repo eval checks, and updating the roadmap progress/completion log.
- Next open: finish T090/T091 dedicated automation/webhook + MCP parity, then T098/T104 runtime metrics and idle-unload policy UI.

## Latest Codex Pass - Phase 6 bundled runtime adapter

- T106 is done: AgentTrail now has an opt-in bundled runtime provider contract behind `AGENTTRAIL_MODEL_ADAPTER=bundled`, `AGENTTRAIL_GGUF_MODEL`, and `AGENTTRAIL_BUNDLED_RUNTIME_MODULE`.
- T108 is done: `bundled` is a first-class model adapter, `/api/runtime` reports module/model readiness, and the server dispatch path can use bundled generation/embeddings.
- T107/T109/T110 are partial: the adapter path supports local GGUF completion, streaming, and embeddings when a provider is present, and CI proves the contract with `tests/fixtures/mock-bundled-runtime.js`; real `node-llama-cpp` hardware validation is still next.
- Tests/docs updated: `npm run test:bundled`, `docs/RUNTIME_PHASE6.md`, `docs/MODEL_BACKENDS.md`, README/env docs, repo eval, and CI.

Next open: validate the bundled adapter against real `node-llama-cpp` + a tiny GGUF, then work through T112/T116/T118 hardware/thread/offload detection.

## Latest Codex Pass - Epic Q hardware acceleration policy

- T112-T118 are implemented as a deterministic bundled-runtime hardware policy layer in `src/runtime-hardware.js`: Metal auto-select on Apple Silicon, CUDA/ROCm/Vulkan env/path detection, CPU SIMD/thread tuning, auto backend selection, and GPU-layer offload parsing.
- `/api/runtime` now exposes `bundledRuntime.hardware`, `accelerationBackend`, selected backend evidence/reason, offload mode, and effective threads; the System panel shows the selected acceleration summary.
- The bundled provider config now receives `config.hardware`, `config.accelerationBackend`, `config.gpuLayers`, and `config.threads` so custom providers can load the right native path while the default install remains zero-dependency.
- Tests/docs updated: `npm run test:hardware`, expanded `npm run test:bundled`/resources assertions, README/env/model backend/runtime docs, roadmap, repo eval, and CI.

Next open: real `node-llama-cpp` validation with a tiny GGUF on actual hardware, then Epic R model loading internals.

## Latest Codex Pass - Epic R model loading internals

- T119-T124 are implemented as a deterministic bundled-runtime loading policy layer in `src/runtime-loading.js`: GGUF quantization detection/override, KV-cache type and context-shift policy, batch/micro-batch/parallel sequence config, mmap/mlock flags, multi-GPU tensor split metadata, and tokens/sec benchmark helpers.
- `/api/runtime` now exposes `bundledRuntime.loading`; the System panel shows quantization, mmap state, and batch size alongside the bundled acceleration summary.
- The bundled provider config now receives `config.loading` and `config.loading.loadOptions`, and `npm run bench:runtime` can compare bundled runtime throughput against Ollama when both are configured with the same model.
- Tests/docs updated: `npm run test:loading`, expanded bundled/resources assertions, README/env/model backend/runtime docs, roadmap, repo eval, and CI.

Next open: real `node-llama-cpp` validation with a tiny GGUF on actual hardware, then Epic S model registry/distribution.

## Latest Codex Pass - Epic S model registry/distribution

- T125-T131 are implemented in `src/model-registry.js`: resumable/checksummed downloads, Hugging Face and OCI reference parsing, Modelfile-style derived model manifests, local model library metadata/tags, create/cp/show/share operations, and checksum/signature provenance verification.
- New routes: `/api/model-registry`, `/api/model-registry/show`, `/api/model-registry/pull`, `/api/model-registry/import`, `/api/model-registry/create`, `/api/model-registry/cp`, and `/api/model-registry/share`. `/api/models` now also reports `registryModels` and `canManageRegistry`.
- Bundled `/api/models/pull` delegates to the registry pull path, so GGUF registry downloads have SSE progress instead of the old "not implemented" response.
- Tests/docs updated: `npm run test:registry`, unit + integration registry coverage, README/env/model backend/runtime docs, route catalog, roadmap, repo eval, and CI.

Next open: real `node-llama-cpp` validation with a tiny GGUF on actual hardware, then Phase 7 desktop/CLI distribution.

## Latest Codex Pass - GitHub issue cleanup

- Cleared the seven open starter issues: recipe validation, prompt-injection review recipe, static Pages demo, diff-preview proof, meeting follow-up email recipe, searchable receipt history, and model compatibility notes.
- `/api/recipes` now returns `agenttrail.recipes.v1`, `invalidRecipes`, and duplicate-ID validation while still skipping bad community JSON safely. Smoke creates invalid/duplicate recipes to prove startup keeps working.
- `/api/receipts` now returns searchable metadata for exported timestamp, model, selected files, permissions, tool count, event types, tool names, file mentions, and `searchText`; the receipt timeline filter uses those fields.
- `docs/public-demo.html` now shows recipe picker, local safety signals, diff preview, Apply, and receipt timeline; `docs/MODELS.md` has practical tool/write/review/summarization compatibility notes.
- T155 moved to done after expanding the security scanner for tool escalation, system prompt extraction, and encoded payloads, with foundation test coverage.

Next open: real `node-llama-cpp` validation with a tiny GGUF on actual hardware, then Phase 7 desktop/CLI distribution.

## Latest Codex Pass - Epic T native desktop distribution

- T132-T139 are implemented at the repo/scaffolding level: hardened macOS `.app` packaging, native Swift menu-bar launcher source, Windows PowerShell tray launcher, Linux desktop/tray launcher, deb/rpm/AppImage metadata, update channel manifest, signing dry-run scripts, desktop onboarding state, and native notification hooks for long runs/model pulls.
- New API surface: `/api/updates/check` returns `agenttrail.updates.v1` from `updates/latest.json`; `/api/onboarding` now reports desktop mode, notifications, and update channel.
- Desktop launchers set `AGENTTRAIL_DESKTOP=1`, `AGENTTRAIL_APP_MODE`, `AGENTTRAIL_DESKTOP_NOTIFICATIONS=on`, and `AGENTTRAIL_UPDATE_CHANNEL=stable`.
- New test/docs: `npm run test:desktop`, `docs/DESKTOP_DISTRIBUTION.md`, expanded desktop/signing docs, release workflow dry-runs for macOS/Windows signing, and checksum coverage for desktop-critical files.

Next open: real `node-llama-cpp` validation with a tiny GGUF on actual hardware, then Epic U CLI parity.

## Latest Codex Pass - Epic U CLI parity

- T140-T146 are implemented through `src/cli.js` and `bin/agenttrail.js`: `agenttrail run <model>` REPL/scripting mode, streamed `/api/chat` output, `--json` automation output, and `--url/--host/--port` targeting.
- Ollama-style model commands now exist: `agenttrail pull`, `list`, `rm`, `ps`, and `show`, with registry-aware `show` and `pull --source` support where AgentTrail owns the GGUF registry.
- `agenttrail serve` starts the headless local API/UI server, and `agenttrail create <name> -f Modelfile` creates a derived registry model through `/api/model-registry/create`.
- Shell completions are available through `agenttrail completion bash|zsh|fish`.
- Tests/docs updated: `npm run test:cli`, CI node checks and integration step, `docs/CLI.md`, integration docs, README/NPM docs, roadmap progress, repo eval, and release checksums.

Next open: real `node-llama-cpp` validation with a tiny GGUF on actual hardware, then Epic V packaging and supply-chain polish.

## Latest Codex Pass - Epic V packaging and supply chain

- T147-T152 are implemented at the repo/workflow level: Dockerfile is BuildKit/OCI/multi-arch ready with a non-root runtime, and `.github/workflows/container.yml` publishes linux/amd64 + linux/arm64 images to GHCR on tags/dispatch.
- Homebrew is now publishable: `npm run release:homebrew` computes the SHA-256 from the npm tarball and updates `Formula/agenttrail.rb`, including both `agenttrail` and `agenttrail-chat` plus a service.
- npm provenance pipeline exists in `.github/workflows/npm-publish.yml`, with dry-run/manual support and real publish via `NPM_TOKEN`.
- SBOM and reproducibility are first-class: `npm run release:sbom` writes SPDX 2.3 output, and `npm run release:reproducible` verifies two isolated-cache `npm pack` outputs match.
- Release checksums are stronger: `npm run release:verify-checksums` validates every row, and `npm run release:sign-checksums` supports PEM-key signatures with dry-run fallback.
- Tests/docs updated: `npm run test:supply-chain`, `docs/SUPPLY_CHAIN.md`, release signing/npm docs, README, release workflow artifact uploads, repo eval, and checksum coverage.

Next open: real `node-llama-cpp` validation with a tiny GGUF on actual hardware, then package-publication launch polish.

## Latest Codex Pass - Epic X observability

- T161-T166 are implemented through `src/observability.js`, expanded `src/features/errors.js`, and new API routes: `/api/metrics`, `/api/observability`, `/api/traces`, `/api/traces/content`, and `/api/errors/taxonomy`.
- Chat, structured-output, and typed recipe runs now create privacy-preserving traces with token/time accounting, tool-call counts, status/error events, and persisted `run-accounting` / `run-trace` records in the append-only store.
- The sidebar now has an Observability panel showing completed/failed/active runs, input/output token estimates, p50/p95 latency, classified errors, and recent trace timeline rows without prompt text.
- Tests/docs updated: `npm run test:observability`, README, foundation routes, schema docs, roadmap progress, repo eval, and release checksum/SBOM paths.

Next section records the Epic Y team/enterprise pass.

## Latest Codex Pass - Epic Y team enterprise

- T167-T172 are implemented through `src/team-enterprise.js`, `team/users.json`, and `/api/team/*` routes.
- Added read-only shared receipt summaries/content, local owner/auditor/viewer users, RBAC caps that feed into agent tool policies, audit-log export in JSON/CSV, explicit opt-in sync package export under `workspace/shared-sync/`, and an SSO identity hook for trusted local proxies.
- The app sidebar now has a Team panel for switching local users, viewing shared receipts, exporting audit logs, and writing sync packs.
- Tests/docs updated: `npm run test:team`, route catalog, schema docs, README, repo eval, CI, roadmap progress, and release checksum/SBOM paths.

Next section records the Epic Z quality engineering pass.

## Latest Codex Pass - Epic Z quality engineering

- T173-T179 are implemented through `src/workspace-safety.js`, `scripts/coverage-report.js`, `scripts/performance-regression.js`, `tests/unit/workspace-safety-fuzz.test.js`, `tests/unit/quality-engineering.test.js`, `tests/ui/playwright-smoke.test.js`, and `.github/workflows/quality-matrix.yml`.
- Added a V8 coverage gate (`npm run coverage`), shared workspace path/diff safety helpers, property-style fuzz tests for traversal and diff invariants, a dependency-free UI E2E smoke with optional Playwright browser driving, deterministic performance regression budgets, and a cross-platform macOS/Windows/Linux Node matrix.
- `npm run eval` now prints a category scoreboard and can write `docs/quality/eval-scoreboard.json` for public proof.
- Tests/docs updated: `npm run test:quality`, `npm run coverage`, `npm run bench:quality`, `npm run test:ui`, `docs/QUALITY_ENGINEERING.md`, README, repo eval, CI, roadmap progress, and release checksum/SBOM paths.

Next section records the Epic AA documentation pass.

## Latest Codex Pass - Epic AA documentation

- T180-T187 are implemented through `scripts/generate-docs-site.js`, `scripts/generate-api-reference.js`, `docs/site/*`, `docs/API_REFERENCE.md`, `docs/GETTING_STARTED.md`, `docs/RECIPE_AUTHORING.md`, `docs/BACKEND_SETUP.md`, `docs/ARCHITECTURE.md`, expanded `docs/TROUBLESHOOTING.md`, `docs/VIDEO_WALKTHROUGHS.md`, and `docs/video-walkthroughs/storyboards.json`.
- Added a searchable static docs site for GitHub Pages, a visual 60-second quick start, recipe/pack authoring rules, LM Studio/llama.cpp/vLLM/OpenAI-compatible setup, architecture map, generated route/API reference, FAQ expansion, and launch-ready video shot lists.
- Docs are now generated and checked with `npm run docs:build` / `npm run test:docs`; CI verifies generated docs are current.
- Tests/docs updated: README, top-1% implementation notes, roadmap progress, repo eval, release artifact list, SBOM/checksum paths, and docs unit coverage.

Next section records the Epic AB community and growth pass.

## Latest Codex Pass - Epic AB community and growth

- T188-T195 are implemented through `docs/LAUNCH_RESPONSE_WORKFLOW.md`, `docs/launch/response-kit.json`, `docs/RECIPE_MARKETPLACE.md`, `marketplace/recipes.json`, `docs/GOOD_FIRST_ISSUES.md`, `docs/community/good-first-issues.json`, `.github/labels.yml`, `GOVERNANCE.md`, `CHANGELOG.md`, `docs/RELEASE_PROCESS.md`, `docs/SHOWCASE.md`, `docs/showcase/gallery.json`, `docs/COMPARISON_BENCHMARKS.md`, `docs/benchmarks/comparison.json`, `docs/PLUGIN_SDK.md`, and example plugin manifests in `plugins/receipt-reporter` and `plugins/read-only-url`.
- Added launch response macros, marketplace curation state, starter issue backlog, GitHub label config, contribution/governance rules, changelog/release discipline, public workflow showcase metadata, honest comparison fixtures, and a plugin SDK contract with permission/receipt examples.
- Community assets are now checked with `npm run test:community`; CI and `npm run eval` cover the Epic AB public-growth surface.
- Tests/docs updated: README, docs site, roadmap progress, repo eval, release artifact list, SBOM/checksum paths, and community-growth unit coverage.

Next section records the Epic AC model ecosystem pass.

## Latest Codex Pass - Epic AC model ecosystem

- T196-T200 are implemented through `src/model-ecosystem.js`, `/api/model-ecosystem/*`, `docs/MODEL_ECOSYSTEM.md`, route/API docs, and `tests/unit|integration/model-ecosystem.test.js`.
- Added LoRA adapter manifests with runtime hints, dry-run-first fine-tuning launch delegation, quantization command wrappers, safetensors-to-GGUF conversion helpers, and a per-task model evaluation suite.
- Delegates use `execFile` with no shell. Heavy tools are never installed automatically; users configure `AGENTTRAIL_TRAINER_COMMAND`, `AGENTTRAIL_QUANTIZE_COMMAND`, and `AGENTTRAIL_CONVERT_COMMAND`, then opt into execution with `dryRun=false`.
- Tests/docs updated: README, runtime/model backend docs, docs site, generated API reference, repo eval, release artifact list, SBOM/checksum paths, and roadmap progress.

Next open: T206 persistent conversation history, then T207 conversation rename. Earlier partial hardening remains in T090/T091 and T098/T104.
