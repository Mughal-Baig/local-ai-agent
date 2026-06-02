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
| Experimental bundled GGUF runtime | `bundled` | `AGENTTRAIL_GGUF_MODEL` | local `.gguf` path | In-process bundled runtime |

For OpenAI-compatible backends, AgentTrail calls `/v1/chat/completions`, `/v1/models`, and `/v1/embeddings`. If the host already ends in `/v1`, it is used as-is; otherwise `/v1` is appended. An optional bearer token can be supplied with `OPENAI_API_KEY` (or `AGENTTRAIL_API_KEY`) for servers that require one. Selected local images are sent as OpenAI-compatible `image_url` data URLs for vision-capable local models.

For the experimental bundled backend, set `AGENTTRAIL_MODEL_ADAPTER=bundled`, install the optional `node-llama-cpp` package, and point `AGENTTRAIL_GGUF_MODEL` at a readable local `.gguf` file. The default install remains zero-dependency; `/api/runtime` shows whether the optional runtime module and model file are ready. CI uses a mock bundled-runtime provider to prove AgentTrail's adapter contract without shipping native binaries. Hardware, loading, and registry policy are visible there: AgentTrail auto-selects Metal on Apple Silicon, detects CUDA/ROCm/Vulkan signals, tunes CPU/thread/offload choices, detects GGUF quantization from filenames, exposes KV-cache, mmap, batching, and multi-GPU split settings, and keeps a local model registry with checksummed/provenanced pulls.

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

### Experimental bundled GGUF runtime
```bash
npm install node-llama-cpp
AGENTTRAIL_MODEL_ADAPTER=bundled \
AGENTTRAIL_GGUF_MODEL=/absolute/path/to/model.gguf \
node server.js
```

Useful knobs: `AGENTTRAIL_BUNDLED_MODEL_NAME`, `AGENTTRAIL_BUNDLED_CONTEXT_SIZE`, `AGENTTRAIL_ACCELERATION_BACKEND`, `AGENTTRAIL_BUNDLED_GPU_LAYERS`, `AGENTTRAIL_BUNDLED_THREADS`, `AGENTTRAIL_CPU_SIMD`, `AGENTTRAIL_BUNDLED_QUANTIZATION`, `AGENTTRAIL_KV_CACHE_TYPE`, `AGENTTRAIL_CONTEXT_SHIFT`, `AGENTTRAIL_PREFILL_REUSE`, `AGENTTRAIL_SPECULATIVE_DECODING`, `AGENTTRAIL_DRAFT_GGUF_MODEL`, `AGENTTRAIL_BUNDLED_BATCH_SIZE`, `AGENTTRAIL_BUNDLED_MMAP`, `AGENTTRAIL_TENSOR_SPLIT`, `AGENTTRAIL_CUDA_PATH`, `AGENTTRAIL_ROCM_PATH`, `AGENTTRAIL_VULKAN_PATH`, and `AGENTTRAIL_BUNDLED_RUNTIME_MODULE`.

Validate a configured in-process runtime before using it as the app backend:
```bash
npm run validate:bundled-runtime
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
- **Screenshot-to-action planning** — `/api/agent/plan` can receive those same local image payloads, so screenshots can be described and converted into editable plans before tool execution.
- **Local image generation** — `/api/images/generate` is model-backend independent and can call a local Automatic1111/Forge-style `/sdapi/v1/txt2img` endpoint or a local OpenAI-compatible image endpoint. Generated images are saved under the workspace with Markdown provenance files.
- **Local audio** — `/api/audio/transcribe` and `/api/audio/speak` are intentionally model-backend independent: they shell out to local whisper.cpp-compatible STT (`AGENTTRAIL_TRANSCRIBE_COMMAND`) and TTS (`AGENTTRAIL_TTS_COMMAND`) tools, then write transcript/speech artifacts and receipts before the output is used as agent context or playback.
- **Vision capability detection** — `/api/status` scores model names for image readiness, and `/api/models/vision-capability?model=...&refresh=1` can probe a backend with a tiny local image payload.
- **Model listing** — `fetchOllamaModels()` → Ollama `/api/tags` or OpenAI `/v1/models`.
- **Embeddings** — `fetchOllamaEmbedding()` → Ollama `/api/embed` or OpenAI `/v1/embeddings`, with a local-vector fallback when no embedding model is available.
- **Bundled runtime** — `AGENTTRAIL_MODEL_ADAPTER=bundled` loads the optional provider contract from `src/bundled-runtime.js`; it can stream completions and embeddings from a local GGUF runtime when the optional module and model path are present. `src/runtime-hardware.js` supplies acceleration policy, while `src/runtime-loading.js` supplies quantization, KV-cache/context shift, shared-prefix prefill reuse, speculative decoding policy, batching, mmap/mlock, multi-GPU split, and benchmark policy for compatible providers.
- **Bundled model registry** — `/api/model-registry/*` and `src/model-registry.js` provide resumable/checksummed GGUF pulls, Hugging Face/OCI reference parsing, Modelfile-style create/copy/show/share, local metadata/tags, and provenance verification.
- **Model ecosystem** — `/api/model-ecosystem/*` and `src/model-ecosystem.js` add LoRA adapter manifests, fine-tuning launch records, quantization command plans, safetensors-to-GGUF conversion helpers, and per-task model evaluation scores. See [MODEL_ECOSYSTEM.md](MODEL_ECOSYSTEM.md).
- **Agent-as-API** — AgentTrail also serves its own `/v1/chat/completions`, `/v1/models`, and `/v1/embeddings` facade so OpenAI-compatible clients can call the auditable local agent layer directly. The served API has optional API-key auth, local rate limiting, request queue headers, streaming SSE, and `/v1/openapi.json`.

The trust model is identical across backends: the agent still searches before answering, previews writes as diffs, gates every write behind your explicit Apply, and logs each step to a receipt. Switching runtimes does not change the auditability guarantees.

## Verifying

An end-to-end test stands up a mock OpenAI-compatible server and runs AgentTrail against it:
```bash
npm run test:backend
```
It asserts that `/api/status` reports the OpenAI-compatible backend, lists the served model, and that a chat round-trips through `/v1/chat/completions`.
