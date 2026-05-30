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
- T030: structured-output round-trip tests for Ollama and OpenAI-compatible mock backends
- T036: parallel independent tool execution within a step, while write-like tools stay ordered

Best next Claude tasks:

- Work on docs and UI copy around native tool calling and structured outputs.
- Do not rework `server.js` tool-calling or structured-output internals unless you also run `npm run test:tools` and `npm run test:structured`.
- Next code target should be T028 typed extraction recipes or T029 user-visible schema violation handling, not the runtime moonshot.
