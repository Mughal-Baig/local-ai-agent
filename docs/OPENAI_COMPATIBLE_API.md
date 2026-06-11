# OpenAI-Compatible API

AgentTrail can expose its local agent through OpenAI-style endpoints. This is for local tools that already know how to call `/v1/chat/completions`, `/v1/models`, or `/v1/embeddings`.

## Enable Auth

```bash
AGENTTRAIL_V1_API_KEY=local-dev-key node server.js
```

Use `AGENTTRAIL_V1_API_KEYS` for a comma- or newline-separated list. When one or more keys are configured, every `/v1/*` endpoint except `/v1/openapi.json` requires either:

```bash
Authorization: Bearer local-dev-key
```

or:

```bash
x-api-key: local-dev-key
```

## Chat

```bash
curl http://127.0.0.1:4173/v1/chat/completions \
  -H "Authorization: Bearer local-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Summarize the selected workspace context"}],
    "agenttrail": {
      "selectedFiles": ["workspace/welcome.md"],
      "permissions": {"readFiles": true, "writeFiles": false, "previewWrites": true}
    }
  }'
```

Streaming uses normal OpenAI-style SSE chunks:

```json
{"model":"llama3.2","stream":true,"messages":[{"role":"user","content":"Say hi"}]}
```

## Models And Embeddings

`GET /v1/models` lists models from the active local backend. `POST /v1/embeddings` passes requests through the active embedding backend and returns OpenAI-shaped embedding rows.

## Export Descriptor

Use this endpoint when wiring another local tool to AgentTrail:

```text
GET /api/interop/openai-export
```

It returns:

- `baseUrl`, usually `http://127.0.0.1:4173/v1`
- supported endpoint paths
- auth expectations
- copyable cURL and OpenAI SDK examples
- capability flags for chat completions, streaming, tools, and embeddings

## Queue And Rate Controls

- `AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE`: default `60`; set `0` to disable.
- `AGENTTRAIL_V1_QUEUE_CONCURRENCY`: default `2`.
- `AGENTTRAIL_V1_QUEUE_MAX`: default `16`.

Responses include `X-AgentTrail-Queue-*` and `X-RateLimit-*` headers so clients can back off politely.

## OpenAPI

The spec lives at [openapi/agenttrail-v1-openapi.json](openapi/agenttrail-v1-openapi.json) and is served from:

```text
GET /v1/openapi.json
```
