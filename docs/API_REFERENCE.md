# API Reference

> Generated from `src/route-catalog.js` and `docs/openapi/agenttrail-v1-openapi.json`. Do not edit route tables by hand; run `npm run docs:api`.

AgentTrail exposes two API layers: local app endpoints under `/api/*` and an OpenAI-compatible facade under `/v1/*`. By default the server binds to `127.0.0.1` and keeps data inside the configured workspace.

## Local App Routes

| Area | Module | Routes |
| --- | --- | --- |
| search | server.js + src/features/search.js | `/api/search`<br>`/api/search-index`<br>`/api/search/chunks` |
| attachments | server.js | `/api/attachments`<br>`/api/files/content` |
| documents | server.js + src/document-ingestion.js | `/api/documents/extract`<br>`/api/documents/ocr`<br>`/api/documents/ingest-url` |
| audio | server.js + src/audio-transcription.js | `/api/audio/transcribe`<br>`/api/audio/speak`<br>`/api/files/raw` |
| image-generation | server.js + src/image-generation.js | `/api/images/generate`<br>`/api/files/raw` |
| memory | server.js | `/api/memory`<br>`/api/memory/scopes`<br>`/api/memory/structured`<br>`/api/memory/retrieve`<br>`/api/memory/history`<br>`/api/memory/history/diff`<br>`/api/memory/history/revert`<br>`/api/memory/suggestions`<br>`/api/memory/suggestions/apply`<br>`/api/memory/citations` |
| reports | server.js | `/api/reports`<br>`/api/trust/badge` |
| conversations | server.js | `/api/conversations`<br>`/api/conversations/get`<br>`/api/conversations/delete`<br>`/api/conversations/restore`<br>`/api/conversations/import`<br>`/api/conversations/branch`<br>`/api/conversations/export` |
| sessions | server.js | `/api/sessions`<br>`/api/replay/plan`<br>`/api/runs/pending`<br>`/api/runs/pending/from-receipt`<br>`/api/receipts/resume` |
| planner | server.js + src/structured-output.js | `/api/agent/plan`<br>`/api/chat` |
| tools | src/permissions.js + src/tool-schemas.js | `/api/permissions`<br>`/api/tools/schemas`<br>`/api/tools/capability`<br>`/api/mcp` |
| models | server.js | `/api/models`<br>`/api/models/pull`<br>`/api/models/delete`<br>`/api/models/vision-capability` |
| model-registry | server.js + src/model-registry.js | `/api/model-registry`<br>`/api/model-registry/show`<br>`/api/model-registry/pull`<br>`/api/model-registry/import`<br>`/api/model-registry/create`<br>`/api/model-registry/cp`<br>`/api/model-registry/share` |
| model-ecosystem | server.js + src/model-ecosystem.js | `/api/model-ecosystem`<br>`/api/model-ecosystem/adapters`<br>`/api/model-ecosystem/fine-tune`<br>`/api/model-ecosystem/quantize`<br>`/api/model-ecosystem/convert`<br>`/api/model-ecosystem/evaluate` |
| advanced-agent | server.js + src/advanced-agent.js | `/api/advanced-agent`<br>`/api/advanced-agent/orchestrate`<br>`/api/advanced-agent/schedule`<br>`/api/advanced-agent/journal`<br>`/api/advanced-agent/journal/append`<br>`/api/advanced-agent/journal/resume`<br>`/api/advanced-agent/sub-agent`<br>`/api/advanced-agent/replay-diff` |
| system | server.js | `/api/health`<br>`/api/resources`<br>`/api/runtime`<br>`/api/concurrency`<br>`/api/updates/check` |
| openai-compatible-api | server.js | `/v1/chat/completions`<br>`/v1/models`<br>`/v1/embeddings`<br>`/v1/openapi.json` |
| structured-output | src/structured-output.js | `/api/structured-output/schemas`<br>`/api/structured-output`<br>`/api/structured-output/recipe` |
| security | src/features/security.js + src/privacy.js + src/privacy-controls.js + src/network-policy.js + src/features/redact.js | `/api/security/scan`<br>`/api/security/privacy`<br>`/api/privacy/dashboard`<br>`/api/privacy/settings`<br>`/api/privacy/retention`<br>`/api/privacy/retention/apply`<br>`/api/privacy/wipe`<br>`/api/redact` |
| observability | src/observability.js + src/logger.js | `/api/logs`<br>`/api/metrics`<br>`/api/observability`<br>`/api/traces`<br>`/api/traces/content`<br>`/api/errors/taxonomy` |
| team-enterprise | src/team-enterprise.js | `/api/team/status`<br>`/api/team/users`<br>`/api/team/users/select`<br>`/api/team/rbac`<br>`/api/team/receipts`<br>`/api/team/receipts/content`<br>`/api/team/sync/status`<br>`/api/team/sync/export`<br>`/api/team/audit/export`<br>`/api/team/sso`<br>`/api/team/sso/validate` |
| foundation | src/foundation.js | `/api/foundation`<br>`/api/schemas`<br>`/api/migrations` |
| plugins | src/plugin-loader.js + src/plugin-sandbox.js | `/api/plugins`<br>`/api/plugins/run` |
| jobs | src/jobs.js | `/api/jobs`<br>`/api/jobs/start` |
| backup | server.js | `/api/workspace/portability`<br>`/api/workspace/migration-plan`<br>`/api/backup/export`<br>`/api/backup/import`<br>`/api/backup/schedule`<br>`/api/backup/schedule/run` |

## OpenAI-Compatible Routes

Spec: `docs/openapi/agenttrail-v1-openapi.json`

| Method | Path | Operation | Summary |
| --- | --- | --- | --- |
| POST | `/v1/chat/completions` | `createChatCompletion` | Run AgentTrail through an OpenAI-compatible chat-completions interface |
| GET | `/v1/models` | `listModels` | List models from the active local backend |
| POST | `/v1/embeddings` | `createEmbedding` | Create embeddings through the active local backend |
| GET | `/v1/openapi.json` | `getOpenApiSpec` | Return this OpenAPI document |

## Auth And Rate Controls

- `/api/*` is intended for the local browser app and local CLI.
- `/v1/*` can require `AGENTTRAIL_V1_API_KEY` or `AGENTTRAIL_V1_API_KEYS`.
- `/v1/*` uses `AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE`, `AGENTTRAIL_V1_QUEUE_CONCURRENCY`, and `AGENTTRAIL_V1_QUEUE_MAX` for local rate limiting and backpressure.
- Network egress remains governed by `AGENTTRAIL_EGRESS_ALLOWLIST` and related privacy settings.

## Examples

```bash
curl http://127.0.0.1:4173/api/status
curl http://127.0.0.1:4173/api/search?query=receipt
curl http://127.0.0.1:4173/api/team/status
```

```bash
curl http://127.0.0.1:4173/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2","messages":[{"role":"user","content":"Summarize the workspace"}]}'
```

## Route Ownership

Use the `module` column to find the implementation owner before changing behavior. New endpoints should be added to `src/route-catalog.js`, covered in tests, and regenerated here.

