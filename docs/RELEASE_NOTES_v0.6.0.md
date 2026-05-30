# AgentTrail v0.6.0 - Foundation Pass

This release works through the full 30-item top-1% and foundation list.

## Star Features Improved

- Semantic search now stores file hashes and chunk metadata.
- Recipe marketplace now includes student and writer packs.
- Foundation panel is visible in the UI with audit, migration, backup, and checksum actions.
- README now explains the foundation, not just the flashy surfaces.

## Foundation Added

- Server foundation modules under `src/`.
- Stable schema registry and `/api/schemas`.
- Append-only JSONL event store and `/api/store/stats`.
- Tool permission engine integrated into agent tool execution.
- Migration system with `/api/migrations`.
- Model adapter layer for Ollama now and LM Studio/llama.cpp/OpenAI-compatible local servers later.
- Background job manager and `/api/jobs`.
- Friendly error hints for common local-agent failures.
- Plugin architecture with an example plugin manifest.
- Backup export through `/api/backup/export`.
- Release checksum generation through `npm run release:checksums` and `/api/releases/checksums`.
- Unit tests for schemas, permissions, adapters, migrations, store, and plugins.
- Separate frontend foundation module at `public/modules/foundation.js`.

## Verification

```bash
npm run test:unit
npm test
npm run eval
npm run release:checksums
```

Expected repo eval: `100/100`.
