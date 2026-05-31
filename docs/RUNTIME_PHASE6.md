# Phase 6 — Bundled Runtime (honest scope)

**Reality:** matching Ollama's *engine* means shipping GGUF inference with GPU backends (Metal/CUDA/ROCm/Vulkan), quantization, and KV-cache. That is multi-quarter, native-build work — not something to fake. AgentTrail stays a **zero-dependency** agent layer by default and treats a bundled runtime as **opt-in**.

## What exists now (the seam)
- `GET /api/runtime` reports the active backend and whether an optional bundled runtime (`node-llama-cpp`) is installed, with opt-in guidance. (T105 evaluation, T108 adapter seam, T111 zero-dep default.)
- Default behavior is unchanged: Ollama or any OpenAI-compatible server.

## Decision (T105)
Prefer an **optional `node-llama-cpp`** dependency over spawning `llama-server`: it loads a GGUF in-process, supports Metal/CUDA where prebuilt binaries exist, and keeps a single-process story. It is opt-in so the zero-dep default holds.

## Still open (the moonshot — Epics P–S)
GGUF load (T107), streaming/embeddings from the bundled engine (T109/T110), hardware acceleration (T112–T118), quantization/KV-cache/batching (T119–T124), and the model registry/distribution (T125–T131). These require native toolchains and real hardware to test, and are tracked as open.
