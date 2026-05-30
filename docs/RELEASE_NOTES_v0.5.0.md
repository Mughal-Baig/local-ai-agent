# AgentTrail v0.5.0 - Deep Top 1% Systems

This release turns the v0.4 top-1% surfaces into deeper working systems.

## Highlights

- Real demo GIF: `docs/agenttrail-demo.gif` shows search -> diff preview -> Apply -> receipt/replay.
- Semantic index: `/api/search-index` builds Ollama embedding indexes when available and local-vector indexes otherwise.
- Replay sessions: exported receipts now save JSON sessions with model, prompt, files, trail, permissions, and pending diffs.
- MCP server: `npm run mcp` starts a stdio MCP server with explicit per-tool approvals and receipts.
- Security scan: `/api/security/scan` flags prompt injection, exfiltration, path escapes, hidden instructions, and destructive commands.
- Memory citations: project memory now has visible citations and revision history.
- Eval history and model benchmarks: `/api/evals/history` and `/api/benchmarks` give the UI pass/fail and model-readiness signals.
- Distribution assets: install script, Docker Compose, Homebrew formula draft, and desktop launchers.
- Marketplace loop: `marketplace/recipes.json`, import route, and community submission path.

## Verification

Run:

```bash
npm test
npm run eval
```

## Honest Status

The repo is publish-ready for npm/Homebrew/DockerHub surfaces, but this release does not publish to those registries automatically.
