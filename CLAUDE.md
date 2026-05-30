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
- T038 partial: local pending-run snapshot API/UI for interrupted browser runs; true receipt-derived resume remains open

Best next Claude tasks:

- Work on docs and UI copy around native tool calling, structured outputs, planner approval, run guardrails, reflection, loop safety, structured memory, memory suggestions, ranked memory retrieval, memory history, scoped memory, markdown-aware chunk citations, hybrid search score parts, reranking, embedding cache, and search evals.
- Do not rework `server.js` tool-calling, structured-output, planner, run-cancellation, loop/reflection, memory internals, search chunking, hybrid ranking, reranking, embedding cache, or resumable-run internals unless you also run the matching scripts: `npm run test:tools`, `npm run test:structured`, `npm run test:planner`, `npm run test:guardrails`, `npm run test:reflection`, `npm run test:memory`, `npm run test:memory-suggestions`, `npm run test:memory-retrieval`, `npm run test:memory-history`, `npm run test:memory-scopes`, `npm run test:search`, `npm run test:rerank`, `npm run test:embed-cache`, `npm run test:resume`, and `npm run eval:search`.
- Next code target should be finishing T038 receipt-derived resume, T049 incremental re-index, T051 exact citations, or T053 on-disk vector store, not the runtime moonshot.

## Latest Claude Pass

Reviewed Codex's work and continued the roadmap:

- T047: reranker. Added `rerankDocuments()` for deterministic cross-encoder-style lexical reranking of top search hits using exact phrase, coverage, bigram, and path-field signals. Exposes `scoreParts.rerank` and `scoreParts.final`. Test: `npm run test:rerank`.

- T048: embedding cache. Added `fetchEmbeddingCached(text, model)` wrapping the real-embedding fetch, keyed by `model + content-hash`, gated by `AGENTTRAIL_CACHE`, capped at 2000 entries. Repointed the semantic-query and index-build embed call sites to it (the probe is left uncached). Test: `npm run test:embed-cache`.

- T052: search-quality eval harness. Added `scripts/eval-search.js` (boots a temp-workspace server, seeds a labeled 4-doc corpus, builds a local-vector index, scores hit@3 for keyword and hybrid ranking, exits non-zero below `SEARCH_EVAL_THRESHOLD`, default 75%). `npm run eval:search`, added to CI. Currently 100% hit@3 for both modes.

- T038 partial: pending-run snapshot. Added `/api/runs/pending`, `/api/runs/pending/clear`, a resume banner in the UI, route catalog coverage, and `npm run test:resume`. This handles interrupted browser runs, but full receipt-derived resume remains open.

Still open and recommended next: finish T038 receipt-derived resume, T049 incremental re-index on file change, T051 exact citations, T053 on-disk vector store.
