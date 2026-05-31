# Claude Handoff

This folder is the working source copy that may be synced to GitHub by Codex.

- The old public roadmap name `docs/ROADMAP_COMPETE_OLLAMA.md` was intentionally renamed to `docs/LOCAL_AGENT_LAYER_ROADMAP.md`.
- Use this public framing: **AgentTrail is the auditable local-agent layer for Ollama and other local model runtimes.**
- Do not recreate the old "compete with Ollama" title or filename in public docs.
- If you reference the roadmap, link to `docs/LOCAL_AGENT_LAYER_ROADMAP.md`.
- Keep stale generated files out of commits: `*.bak`, `docs/.Rhistory`, `docs/preview.svg`, and `docs/demo-flow.svg`.

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
- Next code target should be T062 image OCR or Phase 3 T065 image input to vision models, not the runtime moonshot.

## Latest Claude Pass

Reviewed Codex's work and continued the roadmap:

- T047: reranker. Added `rerankDocuments()` for deterministic cross-encoder-style lexical reranking of top search hits using exact phrase, coverage, bigram, and path-field signals. Exposes `scoreParts.rerank` and `scoreParts.final`. Test: `npm run test:rerank`.

- T048: embedding cache. Added `fetchEmbeddingCached(text, model)` wrapping the real-embedding fetch, keyed by `model + content-hash`, gated by `AGENTTRAIL_CACHE`, capped at 2000 entries. Repointed the semantic-query and index-build embed call sites to it (the probe is left uncached). Test: `npm run test:embed-cache`.

- T052: search-quality eval harness. Added `scripts/eval-search.js` (boots a temp-workspace server, seeds a labeled 4-doc corpus, builds a local-vector index, scores hit@3 for keyword and hybrid ranking, exits non-zero below `SEARCH_EVAL_THRESHOLD`, default 75%). `npm run eval:search`, added to CI. Currently 100% hit@3 for both modes.

- T038 original partial: pending-run snapshot. Added `/api/runs/pending`, `/api/runs/pending/clear`, a resume banner in the UI, route catalog coverage, and `npm run test:resume`. Receipt-derived resume is completed in the latest Codex pass below.

Still open and recommended next: T062 image OCR or Phase 3 T065 image input to vision models.

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

Next open: T062 image OCR for scanned docs or Phase 3 T065 image input to vision models.
