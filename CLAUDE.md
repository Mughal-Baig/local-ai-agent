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

Best next Claude tasks:

- Work on docs and UI copy around native tool calling, structured outputs, planner approval, run guardrails, reflection, loop safety, structured memory, memory suggestions, ranked memory retrieval, memory history, scoped memory, and markdown-aware chunk citations.
- Do not rework `server.js` tool-calling, structured-output, planner, run-cancellation, loop/reflection, memory internals, or search chunking unless you also run the matching scripts: `npm run test:tools`, `npm run test:structured`, `npm run test:planner`, `npm run test:guardrails`, `npm run test:reflection`, `npm run test:memory`, `npm run test:memory-suggestions`, `npm run test:memory-retrieval`, `npm run test:memory-history`, `npm run test:memory-scopes`, and `npm run test:search`.
- Next code target should be T038 resume interrupted run from receipt, T046 hybrid search, or T052 search quality evals, not the runtime moonshot.
