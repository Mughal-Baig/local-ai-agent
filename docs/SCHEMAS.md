# AgentTrail Schemas

AgentTrail treats local artifacts as stable contracts, not random files.

Current schema families:

- `agenttrail.session.v1`
- `agenttrail.receipt.v1`
- `agenttrail.report.v1`
- `agenttrail.recipe-pack.v1`
- `agenttrail.profile.v1`
- `agenttrail.memory-revision.v1`
- `agenttrail.search-index.v1`
- `agenttrail.vector-store.v1`
- `agenttrail.vector-store-migrations.v1`
- `agenttrail.tool-permission.v1`
- `agenttrail.tool-policy.v1`
- `agenttrail.permission-audit.v1`
- `agenttrail.privacy.v1`
- `agenttrail.network-policy.v1`
- `agenttrail.trace.v1`
- `agenttrail.run-accounting.v1`
- `agenttrail.local-analytics.v1`
- `agenttrail.error.v1`
- `agenttrail.team-users.v1`
- `agenttrail.shared-receipts.v1`
- `agenttrail.team-sync.v1`
- `agenttrail.audit-export.v1`
- `agenttrail.sso-hook.v1`
- `agenttrail.plugin.v1`
- `agenttrail.job.v1`
- `agenttrail.backup.v1`

The running app exposes schema summaries at `/api/schemas`. Markdown receipts now include a resume prompt section so `/api/receipts/resume` can recreate a pending run without depending on a proprietary container. Extracted PDF/DOCX/PPTX/XLSX/HTML/Markdown/code files, OCR image extracts, audio transcripts, local speech outputs, generated images, and allowlisted URL ingests are stored as plain Markdown sidecars or workspace artifacts with source/provenance metadata, plus ingestion receipts where applicable so search, receipts, and Git diffs can inspect normalized text and the ingestion steps without parsing the source again.

The served OpenAI-compatible API contract is documented separately as OpenAPI 3.1 in `docs/openapi/agenttrail-v1-openapi.json` and is available at `/v1/openapi.json`.

## Migration Rule

New versions should add fields instead of removing old ones. When old files need repair, add a migration under `src/migrations.js` and keep loading old artifacts. Vector stores also carry `version`, `minReaderVersion`, optional `collection`, and a migration manifest so older `.agenttrail/vector-store.json` files can be normalized without rebuilding the whole workspace.
