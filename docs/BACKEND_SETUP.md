# Backend Setup Guides

AgentTrail is the auditable agent layer. The model backend can be Ollama, LM Studio, llama.cpp, vLLM, another OpenAI-compatible local server, or the experimental bundled GGUF adapter.

## Ollama

```bash
ollama pull llama3.2
OLLAMA_MODEL=llama3.2 npm run dev
```

Useful knobs:

```bash
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_KEEP_ALIVE=5m
OLLAMA_NUM_CTX=8192
OLLAMA_NUM_GPU=999
OLLAMA_NUM_THREAD=8
```

Embeddings for semantic search:

```bash
ollama pull nomic-embed-text
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## LM Studio

1. Start LM Studio local server.
2. Confirm it exposes an OpenAI-compatible endpoint.
3. Run AgentTrail:

```bash
AGENTTRAIL_MODEL_ADAPTER=lmstudio \
LMSTUDIO_HOST=http://127.0.0.1:1234 \
OLLAMA_MODEL=local-model \
npm run dev
```

If LM Studio uses a different model id, set `OLLAMA_MODEL` to that id.

## llama.cpp Server

Start a llama.cpp server with a GGUF model:

```bash
llama-server -m /models/model.gguf --host 127.0.0.1 --port 8080
```

Run AgentTrail:

```bash
AGENTTRAIL_MODEL_ADAPTER=llamacpp \
LLAMACPP_HOST=http://127.0.0.1:8080 \
OLLAMA_MODEL=local-gguf \
npm run dev
```

## vLLM

Start vLLM with its OpenAI-compatible API:

```bash
python -m vllm.entrypoints.openai.api_server \
  --host 127.0.0.1 \
  --port 8000 \
  --model /models/model
```

Run AgentTrail:

```bash
AGENTTRAIL_MODEL_ADAPTER=openai-compatible \
OPENAI_COMPATIBLE_HOST=http://127.0.0.1:8000 \
OLLAMA_MODEL=/models/model \
npm run dev
```

## Generic OpenAI-Compatible Local Server

```bash
AGENTTRAIL_MODEL_ADAPTER=openai-compatible \
OPENAI_COMPATIBLE_HOST=http://127.0.0.1:8000 \
OPENAI_API_KEY=optional-local-token \
OLLAMA_MODEL=your-model-id \
npm run dev
```

## Experimental Bundled Runtime

The bundled path is intentionally optional so the default install stays small.

```bash
AGENTTRAIL_MODEL_ADAPTER=bundled \
AGENTTRAIL_GGUF_MODEL=/models/tiny.gguf \
AGENTTRAIL_BUNDLED_RUNTIME_MODULE=node-llama-cpp \
npm run dev
```

See [RUNTIME_PHASE6.md](RUNTIME_PHASE6.md) for hardware, quantization, KV cache, mmap, and registry details.

## Backend Readiness Checklist

| Check | Command |
| --- | --- |
| App status | `curl http://127.0.0.1:4173/api/status` |
| Local models | `curl http://127.0.0.1:4173/api/models` |
| Runtime details | `curl http://127.0.0.1:4173/api/runtime` |
| OpenAI facade | `curl http://127.0.0.1:4173/v1/models` |
| Resources | `curl http://127.0.0.1:4173/api/resources` |

Keep all model servers bound to `127.0.0.1` unless you have a separate authentication and network boundary.
