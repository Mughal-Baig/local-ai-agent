# Top 1 Percent Playbook

AgentTrail should not try to beat Open WebUI, Dify, AnythingLLM, Jan, Aider, or OpenHands at platform breadth. The believable path is to own a smaller promise:

> the clearest auditable local agent kit for people who want recipes, workspace search, diff previews, and receipts they can inspect.

## What Must Be Obvious In 30 Seconds

- It runs locally with Ollama.
- It cannot read or write outside the workspace.
- It searches local files before answering.
- It previews writes as diffs before touching files.
- It saves receipts so users can audit what happened.
- It is small enough to read and fork.

## Current Moat

- Zero npm dependencies.
- Plain JSON recipes.
- Local search across files and receipts.
- Agent Trail receipts.
- Write preview mode.
- GitHub Pages demo before install.

## Next Star Drivers

1. Add a short demo GIF to the top of the README.
2. Add Docker and `npx` launch paths.
3. Add semantic search with local embeddings.
4. Add MCP bridge support with explicit approvals.
5. Add import/export recipe packs.
6. Add receipt replay so users can rerun or inspect old agent sessions.
7. Add a desktop wrapper for non-developers.
8. Publish a comparison table against Open WebUI, AnythingLLM, Jan, Aider, and OpenHands.
9. Add 50 high-quality recipes grouped by role.
10. Create a public gallery of community recipes.

## Brutal Anti-Goals

- Do not market this as a full ChatGPT replacement yet.
- Do not add hidden cloud services.
- Do not bury the demo below long text.
- Do not add broad framework complexity before the trust story is polished.
- Do not chase every provider until the local-first workflow is excellent.
