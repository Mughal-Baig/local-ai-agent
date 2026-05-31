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
- `agenttrail.plugin.v1`
- `agenttrail.job.v1`
- `agenttrail.backup.v1`

The running app exposes schema summaries at `/api/schemas`. Markdown receipts now include a resume prompt section so `/api/receipts/resume` can recreate a pending run without depending on a proprietary container.

## Migration Rule

New versions should add fields instead of removing old ones. When old files need repair, add a migration under `src/migrations.js` and keep loading old artifacts. Vector stores also carry `version`, `minReaderVersion`, optional `collection`, and a migration manifest so older `.agenttrail/vector-store.json` files can be normalized without rebuilding the whole workspace.
