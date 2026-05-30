# v0.4.0 - Top 1% Surface Pass

This release implements a dependency-free first pass across the 15 requested top-1% feature areas.

## Added

- Animated visual demo proof in `docs/top1-demo.svg`.
- Semantic-lite local search with `/api/search?mode=semantic`.
- Receipt timeline with saved receipt snippets.
- Diff Review center with pending preview apply/reject controls.
- MCP approval manifest in `mcp/agenttrail.mcp.json`.
- Recipe packs for coder, founder, and security workflows.
- Dockerfile and `agenttrail` bin entry for one-command install paths.
- Model capability scoring for coding, tool use, planning, and long context.
- Local evaluation harness via `npm run eval` and `/api/evals`.
- Project memory endpoint and UI.
- Workspace profile templates.
- Trust Score dashboard.
- Security hardening mode and prompt-injection warning trail entries.
- Shareable Markdown/HTML report export.

## Improved

- README now includes a 60-second quick start, comparison table, top-1% surfaces, and install paths.
- Smoke test now covers semantic search, memory, packs, profiles, MCP, evals, and reports.
- Generated private memory/report files are ignored by git.

## Verified

- `node --check server.js`
- `node --check public/app.js`
- `npm test`
- `npm run eval`
