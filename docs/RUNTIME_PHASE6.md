# Phase 6 — Bundled Runtime (honest scope)

**Reality:** matching Ollama's *engine* means shipping GGUF inference with GPU backends (Metal/CUDA/ROCm/Vulkan), quantization, and KV-cache. That is multi-quarter, native-build work — not something to fake. AgentTrail stays a **zero-dependency** agent layer by default and treats a bundled runtime as **opt-in**.

## What exists now (the seam)
- `GET /api/runtime` reports the active backend, bundled runtime provider, optional module resolution, GGUF model path, model readiness, context size, selected acceleration backend, GPU-layer offload policy, CPU SIMD hint, and thread tuning.
- `AGENTTRAIL_MODEL_ADAPTER=bundled` is a first-class backend adapter. It stays off by default, requires an explicit local `.gguf` file, and loads either `node-llama-cpp` or a compatible provider module from `AGENTTRAIL_BUNDLED_RUNTIME_MODULE`.
- AgentTrail's internal adapter contract can stream completions and return embeddings through the bundled provider. CI proves this with `tests/fixtures/mock-bundled-runtime.js` and `npm run test:bundled` so the server path is real without bundling native binaries.
- `src/runtime-hardware.js` covers Epic Q policy: Metal on Apple Silicon, CUDA/ROCm/Vulkan path detection, CPU fallback with SIMD/thread tuning, automatic backend selection, and explicit GPU-layer offload via `AGENTTRAIL_BUNDLED_GPU_LAYERS`.
- `src/runtime-loading.js` covers Epic R policy: quantization-aware GGUF detection, KV-cache/context-shift settings, batch/micro-batch settings, mmap/mlock flags, multi-GPU split config, and the `bench:runtime` comparison harness.
- `src/model-registry.js` covers Epic S distribution: resumable/checksummed pulls, Hugging Face/OCI reference parsing, Modelfile-style derived models, local model library metadata/tags, create/cp/show/share operations, and checksum/signature provenance verification.
- `src/model-ecosystem.js` covers Epic AC ecosystem helpers: LoRA adapter manifests, fine-tuning launch delegation, quantization wrappers, safetensors-to-GGUF conversion plans, and per-task model evaluation.
- Default behavior is unchanged: Ollama or any OpenAI-compatible server.

## Decision (T105)
Prefer an **optional `node-llama-cpp`** dependency over spawning `llama-server`: it loads a GGUF in-process, supports Metal/CUDA where prebuilt binaries exist, and keeps a single-process story. It is opt-in so the zero-dep default holds.

## Hardware knobs (Epic Q)
- `AGENTTRAIL_ACCELERATION_BACKEND=auto|metal|cuda|rocm|vulkan|cpu`
- `AGENTTRAIL_BUNDLED_GPU_LAYERS=auto|all|0|N`
- `AGENTTRAIL_BUNDLED_THREADS=N`
- `AGENTTRAIL_CPU_SIMD=neon|x64-simd|portable|...`
- `AGENTTRAIL_CUDA_PATH`, `AGENTTRAIL_ROCM_PATH`, and `AGENTTRAIL_VULKAN_PATH` for machines where the standard SDK env vars are not set.

## Loading knobs (Epic R)
- `AGENTTRAIL_BUNDLED_QUANTIZATION=Q4_K_M|Q5_K_M|Q8_0|...` overrides filename-based quantization detection.
- `AGENTTRAIL_KV_CACHE_TYPE=f16|q8_0|...`, `AGENTTRAIL_CONTEXT_SHIFT=auto|on|off`, and `AGENTTRAIL_CONTEXT_SHIFT_TOKENS=N` control KV-cache/context-shift policy.
- `AGENTTRAIL_BUNDLED_BATCH_SIZE=N`, `AGENTTRAIL_BUNDLED_UBATCH_SIZE=N`, and `AGENTTRAIL_BUNDLED_PARALLEL_SEQUENCES=N` control batching policy.
- `AGENTTRAIL_BUNDLED_MMAP=true|false` and `AGENTTRAIL_BUNDLED_MLOCK=true|false` control memory-mapped model loading policy.
- `AGENTTRAIL_GPU_DEVICES=0,1`, `AGENTTRAIL_TENSOR_SPLIT=0.5,0.5`, `AGENTTRAIL_GPU_SPLIT_MODE=layer|row`, and `AGENTTRAIL_MAIN_GPU=N` describe multi-GPU sharding for compatible providers.
- `npm run bench:runtime` compares bundled runtime tokens/sec against Ollama when both are configured with the same model.

## Registry knobs (Epic S)
- `AGENTTRAIL_MODEL_REGISTRY_DIR=.agenttrail/model-registry` stores the local model library under the workspace.
- `AGENTTRAIL_REGISTRY_TOKEN` or `HUGGINGFACE_TOKEN` adds bearer auth for registry pulls.
- `/api/model-registry/pull` supports `file://`, `http(s)`, and `hf://owner/repo/path.gguf?revision=main` sources with resume and SHA-256 verification.
- `/api/model-registry/create`, `/api/model-registry/cp`, `/api/model-registry/show`, and `/api/model-registry/share` provide Modelfile-style create/copy/show/share operations.

## Ecosystem knobs (Epic AC)
- `AGENTTRAIL_TRAINER_COMMAND` delegates fine-tuning to an installed trainer such as LLaMA-Factory, Axolotl, or a local script.
- `AGENTTRAIL_QUANTIZE_COMMAND` delegates GGUF quantization to a local `llama-quantize` compatible command.
- `AGENTTRAIL_CONVERT_COMMAND` delegates safetensors-to-GGUF conversion to a local converter such as `convert-hf-to-gguf.py`.
- `/api/model-ecosystem/*` stores auditable manifests and defaults to dry-run planning until `dryRun=false`.

## Still open (the moonshot)
Real-hardware validation for `node-llama-cpp` and production GGUF load testing still require native toolchains and real hardware.
