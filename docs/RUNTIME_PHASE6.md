# Phase 6 — Bundled Runtime (honest scope)

**Reality:** matching Ollama's *engine* means shipping GGUF inference with GPU backends (Metal/CUDA/ROCm/Vulkan), quantization, and KV-cache. That is multi-quarter, native-build work — not something to fake. AgentTrail stays a **zero-dependency** agent layer by default and treats a bundled runtime as **opt-in**.

## What exists now (the seam)
- `GET /api/runtime` reports the active backend, bundled runtime provider, optional module resolution, GGUF model path, model readiness, context size, GPU layers, and threads.
- `AGENTTRAIL_MODEL_ADAPTER=bundled` is a first-class backend adapter. It stays off by default, requires an explicit local `.gguf` file, and loads either `node-llama-cpp` or a compatible provider module from `AGENTTRAIL_BUNDLED_RUNTIME_MODULE`.
- AgentTrail's internal adapter contract can stream completions and return embeddings through the bundled provider. CI proves this with `tests/fixtures/mock-bundled-runtime.js` and `npm run test:bundled` so the server path is real without bundling native binaries.
- Default behavior is unchanged: Ollama or any OpenAI-compatible server.

## Decision (T105)
Prefer an **optional `node-llama-cpp`** dependency over spawning `llama-server`: it loads a GGUF in-process, supports Metal/CUDA where prebuilt binaries exist, and keeps a single-process story. It is opt-in so the zero-dep default holds.

## Still open (the moonshot — Epics P–S)
Real-hardware validation for `node-llama-cpp`, production GGUF load testing, hardware acceleration (T112–T118), quantization/KV-cache/batching (T119–T124), and the model registry/distribution (T125–T131). These require native toolchains and real hardware to test, and are tracked as open.
