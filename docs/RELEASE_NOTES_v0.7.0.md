# AgentTrail v0.7.0 - Product And Foundation Expansion

This release works through the next 30-item list: stronger product proof plus deeper app foundation.

## Product Surfaces

- Chunk citation search: `/api/search/chunks` and UI citation rows.
- Guided replay: `/api/replay/plan` and replay guidance in the receipts panel.
- Real benchmark runner: `/api/benchmarks/run`.
- Model comparison: `/api/models/compare`.
- Recipe pack import from GitHub URLs: `/api/marketplace/import-url`.
- Plugin gallery and plugin sandbox execution: `/api/plugins`, `/api/plugins/run`.
- Trust badge export: `/api/trust/badge`.
- Onboarding checklist: `/api/onboarding`.
- Public demo data and static page: `/api/demo/public`, `docs/public-demo.html`.
- MCP client setup examples for Claude Desktop, Cursor, Windsurf, and stdio clients.
- npm publish checklist and package metadata for public package publication.

## Foundation Surfaces

- SQLite local store: `src/sqlite-store.js`, `/api/sqlite/status`.
- Structured logging: `src/logger.js`, `/api/logs`.
- Config validation: `src/config.js`, `/api/config`.
- File watcher controls: `src/file-watcher.js`, `/api/watch/*`.
- Plugin sandbox: `src/plugin-sandbox.js`.
- Feature modules for search, security, and errors under `src/features/`.
- Route catalog: `src/route-catalog.js`, `/api/routes`.
- Backup import: `/api/backup/import`.
- Versioned migration manifests under `migrations/`.
- Release artifact workflow and desktop installer staging script.
- Integration and UI smoke tests.

## Verification

```bash
npm run test:unit
npm run test:integration
npm run test:ui
npm test
npm run eval
npm run release:checksums
npm run package:desktop
```

Expected repo eval: `100/100`.
