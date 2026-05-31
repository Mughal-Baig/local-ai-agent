# Integrations & Throughput (Phase 4)

## Use AgentTrail as an OpenAI-compatible API
AgentTrail exposes `/v1/chat/completions`, `/v1/models`, and `/v1/embeddings` (with optional auth + rate limiting). Point any OpenAI client at it:

```python
from openai import OpenAI
client = OpenAI(base_url="http://127.0.0.1:4173/v1", api_key="local")
client.chat.completions.create(model="llama3.2", messages=[{"role":"user","content":"hi"}])
```

LangChain / LlamaIndex: use their OpenAI-compatible classes with `base_url=http://127.0.0.1:4173/v1`.

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
`editor/vscode-agenttrail/` — open in VS Code, press F5, run "AgentTrail: Ask about selection". Talks to your local server.

## Automation triggers (T090)
Use scheduled runs + receipts: drive `bin/agenttrail-chat.js` from cron/launchd, or POST to `/api/chat` from any webhook handler. Every run leaves an auditable receipt.

## MCP (T091)
`mcp/server.js` exposes workspace tools over MCP (`list_files`, `search_workspace`, `read_file`, and the diff-preview/write tools) for other MCP clients to consume.
