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
- Keyword and semantic-lite search across files and receipts.
- Agent Trail receipts.
- Write preview mode with explicit Apply.
- Trust Score dashboard.
- Receipt timeline and shareable reports.
- Recipe packs, profiles, model scoring, MCP manifest, Dockerfile, and eval harness.
- GitHub Pages demo before install.

## Next Star Drivers

1. Record a real 20-second GIF using the v0.4 trust loop.
2. Add optional true local embeddings for semantic search.
3. Add receipt replay so users can rerun a prior session with the same context.
4. Add real MCP server transport behind the approval manifest.
5. Add recipe pack import UI and community gallery.
6. Add a desktop wrapper for non-developers.
7. Add 50 high-quality recipes grouped by role.
8. Publish benchmark screenshots from `npm run eval`.

## Brutal Anti-Goals

- Do not market this as a full ChatGPT replacement yet.
- Do not add hidden cloud services.
- Do not bury the demo below long text.
- Do not add broad framework complexity before the trust story is polished.
- Do not chase every provider until the local-first workflow is excellent.
