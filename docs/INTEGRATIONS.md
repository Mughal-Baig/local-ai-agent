# Integrations & Throughput (Phase 4)

## Use AgentTrail as an OpenAI-compatible API
AgentTrail exposes `/v1/chat/completions`, `/v1/models`, and `/v1/embeddings` (with optional auth + rate limiting). Point any OpenAI client at it:

```python
from openai import OpenAI
client = OpenAI(base_url="http://127.0.0.1:4173/v1", api_key="local")
client.chat.completions.create(model="llama3.2", messages=[{"role":"user","content":"hi"}])
```

LangChain / LlamaIndex: use their OpenAI-compatible classes with `base_url=http://127.0.0.1:4173/v1`.

Discovery endpoint for local tool setup:

```bash
curl http://127.0.0.1:4173/api/interop/openai-export
```

It returns the `/v1` base URL, endpoint list, auth note, and copyable client examples.

## Concurrency, routing & warm pool (T082–T085)
- **Bounded concurrency + backpressure**: model runs are gated by `AGENTTRAIL_MAX_CONCURRENCY` (default 4); when the queue (`AGENTTRAIL_MAX_QUEUE`, default 64) is full the server returns `503` with `Retry-After`. Live status at `GET /api/concurrency`.
- **Per-request model routing (T083)**: each request carries its own `model`; the runtime loads it on demand. There is no single pinned model.
- **Warm pool / eviction (T084)**: delegated to the runtime — `OLLAMA_KEEP_ALIVE` keeps a model resident between turns, and Ollama's `OLLAMA_MAX_LOADED_MODELS` controls how many stay loaded. This is the correct layer for it (AgentTrail orchestrates; the runtime manages weights).

## Load testing (T086)
```bash
AGENTTRAIL_URL=http://127.0.0.1:4173 node scripts/load-test.js /api/health 20 500
```
Reports ok/fail, requests/sec, avg and p95 latency.

## CLI parity and pipe mode (T089, T140-T146)

Ollama-style AgentTrail CLI:

```bash
agenttrail serve
agenttrail chat --model llama3.2
agenttrail chat --prompt "summarize the README" --json
agenttrail run llama3.2
agenttrail run llama3.2 "summarize the README"
agenttrail pull llama3.2
agenttrail list --json
agenttrail ps
agenttrail show llama3.2
agenttrail create my/derived -f Modelfile
agenttrail completion zsh
```

Legacy pipe helper:

```bash
echo "summarize the README" | node bin/agenttrail-chat.js
node bin/agenttrail-chat.js "write release notes"
```

## VS Code (T088, MVP)
`editor/vscode-agenttrail/` — open in VS Code, press F5, then run:

- `AgentTrail: Chat`
- `AgentTrail: Ask about selection`
- `AgentTrail: Apply last suggestion`

The extension sends the active workspace-relative file as selected context and applies the last suggested code block only after a VS Code confirmation.

## Automation triggers (T090)
Use scheduled runs + receipts: drive `bin/agenttrail-chat.js` from cron/launchd, stream directly through `/api/chat`, or POST to the dedicated webhook endpoint:

```bash
curl -X POST http://127.0.0.1:4173/api/webhooks/run \
  -H 'Content-Type: application/json' \
  -d '{"source":"launchd","prompt":"Review today'\''s selected notes and draft follow-ups."}'
```

`/api/webhooks/run` writes `receipts/webhooks/*.md` and saves a pending run under `.agenttrail/pending-run.json` for explicit local review before execution. If `AGENTTRAIL_WEBHOOK_TOKEN` is set, pass it as `Authorization: Bearer ...` or `X-AgentTrail-Webhook-Token`.

Preset trigger catalog:

```bash
curl http://127.0.0.1:4173/api/webhooks/triggers
curl -X POST http://127.0.0.1:4173/api/webhooks/triggers/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"github-issue-triage","payload":{"title":"Bug","body":"Steps..."}}'
```

Preset triggers also create pending runs instead of executing automatically.

## MCP (T091)
`mcp/server.js` exposes the core workspace tool registry over MCP: `list_files`, `search_workspace`, `read_file`, `preview_write_file`, and `write_file`. Medium/high-risk tools require explicit approval and every tool call writes an MCP receipt under `workspace/receipts/mcp/`.

AgentTrail can also consume external stdio MCP servers from `mcp/clients.json`:

```bash
curl http://127.0.0.1:4173/api/mcp/client/status
curl "http://127.0.0.1:4173/api/mcp/client/tools?serverId=my-server&live=true"
curl -X POST http://127.0.0.1:4173/api/mcp/client/call \
  -H 'Content-Type: application/json' \
  -d '{"serverId":"my-server","tool":"tool.name","arguments":{},"approved":true}'
```

Configured servers default to explicit approval. Calls write receipts under `receipts/mcp-client/`.

## Replay Bundles

Share a replayable run without depending on private workspace state:

```bash
curl -X POST http://127.0.0.1:4173/api/replay/bundle \
  -H 'Content-Type: application/json' \
  -d '{"path":"sessions/example.json","includeFiles":false}'
```

Importing a bundle creates a pending run for local review:

```bash
curl -X POST http://127.0.0.1:4173/api/replay/bundle/import \
  -H 'Content-Type: application/json' \
  -d '{"bundle":{...}}'
```
