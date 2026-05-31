# Model Backends

AgentTrail is no longer tied to a single runtime. It talks to a **model backend** through a small adapter layer, so you can run it against Ollama *or* any OpenAI-compatible local server — llama.cpp's `llama-server`, LM Studio, vLLM, Jan, LocalAI, and others — without changing code.

Pick a backend with the `AGENTTRAIL_MODEL_ADAPTER` environment variable. Everything else (chat, model listing, embeddings for semantic search) is dispatched to the chosen backend automatically.

## Backends at a glance

| Backend | `AGENTTRAIL_MODEL_ADAPTER` | Host variable | Default host | API |
| --- | --- | --- | --- | --- |
| Ollama (default) | `ollama` | `OLLAMA_HOST` | `http://127.0.0.1:11434` | native |
| LM Studio | `lmstudio` | `LMSTUDIO_HOST` | `http://127.0.0.1:1234` | OpenAI-compatible |
| llama.cpp server | `llamacpp` | `LLAMACPP_HOST` | `http://127.0.0.1:8080` | OpenAI-compatible |
| Any OpenAI-compatible server | `openai-compatible` | `OPENAI_COMPATIBLE_HOST` | `http://127.0.0.1:8000/v1` | OpenAI-compatible |

For OpenAI-compatible backends, AgentTrail calls `/v1/chat/completions`, `/v1/models`, and `/v1/embeddings`. If the host already ends in `/v1`, it is used as-is; otherwise `/v1` is appended. An optional bearer token can be supplied with `OPENAI_API_KEY` (or `AGENTTRAIL_API_KEY`) for servers that require one. Selected local images are sent as OpenAI-compatible `image_url` data URLs for vision-capable local models.

## Examples

### Default — Ollama
```bash
node server.js
```

### LM Studio
Start LM Studio's local server (it exposes an OpenAI-compatible API on port 1234), then:
```bash
AGENTTRAIL_MODEL_ADAPTER=lmstudio node server.js
```

### llama.cpp server
```bash
# in the llama.cpp repo
./llama-server -m models/your-model.gguf --port 8080
# then, in AgentTrail
AGENTTRAIL_MODEL_ADAPTER=llamacpp node server.js
```

### vLLM / LocalAI / any OpenAI-compatible endpoint
```bash
AGENTTRAIL_MODEL_ADAPTER=openai-compatible \
OPENAI_COMPATIBLE_HOST=http://127.0.0.1:8000/v1 \
OPENAI_API_KEY=optional-token \
node server.js
```

When the server starts it prints the active backend, e.g.:
```
Model backend: LM Studio (openai-compatible) at http://127.0.0.1:1234
```
and `/api/status` reports it under a `backend` field.

## How it works

A single dispatcher routes the three model primitives to the active backend:

- **Generation** — `generateCompletion()` → Ollama `/api/generate` or OpenAI `/v1/chat/completions`.
- **Vision input** — selected, dragged, or pasted workspace images are attached to Ollama chat/generate as `images` arrays and to OpenAI-compatible chat as `image_url` content parts.
- **Model listing** — `fetchOllamaModels()` → Ollama `/api/tags` or OpenAI `/v1/models`.
- **Embeddings** — `fetchOllamaEmbedding()` → Ollama `/api/embed` or OpenAI `/v1/embeddings`, with a local-vector fallback when no embedding model is available.

The trust model is identical across backends: the agent still searches before answering, previews writes as diffs, gates every write behind your explicit Apply, and logs each step to a receipt. Switching runtimes does not change the auditability guarantees.

## Verifying

An end-to-end test stands up a mock OpenAI-compatible server and runs AgentTrail against it:
```bash
npm run test:backend
```
It asserts that `/api/status` reports the OpenAI-compatible backend, lists the served model, and that a chat round-trips through `/v1/chat/completions`.
