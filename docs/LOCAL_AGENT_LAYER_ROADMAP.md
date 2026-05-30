# AgentTrail — Local Agent Layer Roadmap

A long-horizon backlog (12+ months) for making AgentTrail the auditable agent layer for Ollama and other local model runtimes. The honest framing first, then the product surface broken into phases → epics → concrete, checkable tasks. Tasks are numbered sequentially (`T001…`) so progress is trackable. `[x]` = already shipped, `[ ]` = open, `[~]` = partial.

> **Reality check (read this).** Ollama *is* a model runtime (llama.cpp + GPU backends + a model registry). AgentTrail should not market itself as an Ollama replacement today. The public wedge is stronger and more honest: AgentTrail is the **auditable agent layer** for local models, with receipts, diff-gated writes, replay, tools, memory, search, and security. The bundled runtime work remains a later moonshot (Phase 6). We complete the agent-layer work first, a few tasks at a time.

**Scope:** 200+ tasks here, grouped so each epic can expand into finer sub-tasks toward the 1000 mark as we detail them. We expand an epic into sub-tasks only when we reach it.

---

## Phase 0 — Foundation already shipped (baseline)

- [x] T001 Warm "ink & clay" UI redesign
- [x] T002 Collapsible grouped sidebar (progressive disclosure)
- [x] T003 SVG icon set + app icon (.icns) + packager wiring
- [x] T004 Hero GIF, README hero/promise, UI preview images
- [x] T005 Social preview card + README skim trim
- [x] T006 Interactive warm demo page
- [x] T007 Launch posts (HN / Reddit / PH / X)
- [x] T008 Receipt Spec v1 + Security Posture docs
- [x] T009 Provable foundation (unit + smoke + integration in CI)
- [x] T010 Shareable standalone HTML receipt export
- [x] T011 Pluggable model backend (Ollama + OpenAI-compatible) + e2e test
- [x] T012 True token streaming (NDJSON + SSE) with tool-call gating
- [x] T013 Model keep-alive (warm models)
- [x] T014 In-app model management: pull/list/delete (+ test)
- [x] T015 Response cache + prompt-budget guard
- [x] T016 Ollama gap analysis doc

---

## Phase 1 — Agent reliability & tool-calling (the wedge, hardened)

### Epic A — Native tool calling
- [x] T017 Add native tool-calling via Ollama `/api/chat` `tools` field
- [x] T018 Add OpenAI `tools`/function-calling for OpenAI-compatible backends
- [x] T019 Tool schema registry (JSON Schema per tool)
- [x] T020 Fall back to prompt-JSON parsing when a model lacks tool support
- [x] T021 Capability probe: detect per-model tool-calling support, cache result
- [x] T022 Multi-tool calls in a single step (parallel tool requests)
- [x] T023 Tool-call retry with repair on malformed arguments
- [x] T024 Unit + integration tests for native tool calling (mock backends)

### Epic B — Structured outputs
- [x] T025 Pass JSON-schema `format` to Ollama for constrained output
- [x] T026 OpenAI `response_format` json_schema support
- [x] T027 Schema-validate every tool argument before execution
- [x] T028 Typed extraction recipes (e.g., "extract table → JSON")
- [x] T029 Graceful schema-violation handling + user-visible reason
- [x] T030 Tests for structured-output round-trips

### Epic C — Planner & multi-step autonomy
- [x] T031 Explicit plan step: model proposes a plan before acting
- [x] T032 Plan shown in UI; user can edit/approve before execution
- [x] T033 Step budget + cost guardrails with user override
- [x] T034 Reflection step: self-check output against the request
- [x] T035 Loop-detection / no-progress abort
- [x] T036 Parallel independent tool execution within a step
- [x] T037 Cancellable runs (stop button → abort backend stream)
- [ ] T038 Resume an interrupted run from its receipt

### Epic D — Agent memory
- [x] T039 Structured project memory schema (facts, prefs, decisions)
- [x] T040 Automatic memory capture suggestions after a run
- [x] T041 Memory retrieval ranked into the prompt budget
- [ ] T042 Memory diff/history view + revert
- [ ] T043 Per-workspace vs global memory scopes

---

## Phase 2 — RAG, search & knowledge

### Epic E — Search quality
- [~] T044 Local embedding index (exists; harden)
- [ ] T045 Smarter chunking (semantic/markdown-aware) with overlap
- [ ] T046 Hybrid search (BM25 keyword + vector) with score fusion
- [ ] T047 Cross-encoder / LLM reranking of top-k
- [ ] T048 Embedding cache keyed by content hash
- [ ] T049 Incremental re-index on file change (watcher-driven)
- [ ] T050 Multi-vector / late-interaction option for long docs
- [ ] T051 Citations with exact line/char spans in answers
- [ ] T052 Search quality eval set + scoring harness

### Epic F — Persistent vector store
- [ ] T053 On-disk vector store (SQLite-vec or flat-file ANN)
- [ ] T054 HNSW/IVF index for large corpora
- [ ] T055 Namespace/collection support per workspace
- [ ] T056 Metadata filters (path, type, date) in queries
- [ ] T057 Store versioning + migration
- [ ] T058 Benchmark recall/latency vs brute force

### Epic G — Document ingestion
- [ ] T059 PDF text extraction
- [ ] T060 DOCX / PPTX / XLSX extraction
- [ ] T061 HTML / Markdown / code-aware ingestion
- [ ] T062 Image OCR for scanned docs
- [ ] T063 URL ingestion (fetch + clean + index) with allowlist
- [ ] T064 Ingestion progress + receipts

---

## Phase 3 — Multi-modal

### Epic H — Vision
- [ ] T065 Image input to vision models (llava, qwen-vl, etc.)
- [ ] T066 Drag-drop image into chat → base64 to backend
- [ ] T067 Screenshot-to-action (describe + plan) flow
- [ ] T068 Vision-model capability detection
- [ ] T069 Tests with a mock vision backend

### Epic I — Audio
- [ ] T070 Local speech-to-text (whisper.cpp integration)
- [ ] T071 Voice prompt input in the UI
- [ ] T072 Local text-to-speech for responses
- [ ] T073 Audio file transcription recipe + receipt

### Epic J — Image generation (optional)
- [ ] T074 Optional local image-gen backend adapter (SD/Flux servers)
- [ ] T075 Image-gen results saved to workspace with provenance

---

## Phase 4 — Serving, API & interoperability

### Epic K — OpenAI-compatible server mode
- [ ] T076 Expose AgentTrail's own `/v1/chat/completions` (agent-as-API)
- [ ] T077 `/v1/models`, `/v1/embeddings` passthrough
- [ ] T078 Streaming SSE for the served API
- [ ] T079 API keys / local auth for served endpoints
- [ ] T080 Rate limiting + request queue
- [ ] T081 OpenAPI spec + generated client docs

### Epic L — Concurrency & throughput
- [ ] T082 Request queue with configurable concurrency
- [ ] T083 Multiple loaded models (route by request)
- [ ] T084 Per-model warm pool + eviction policy
- [ ] T085 Backpressure + graceful overload responses
- [ ] T086 Load test harness (k6-style, local)

### Epic M — Integrations
- [ ] T087 LangChain / LlamaIndex adapter docs
- [ ] T088 VS Code extension (chat + diff apply in-editor)
- [ ] T089 CLI pipe mode (`echo prompt | agenttrail`)
- [ ] T090 Webhook / automation triggers
- [ ] T091 MCP server parity expansion (more tools exposed)

---

## Phase 5 — Performance & resource management

### Epic N — Speed
- [x] T092 Prompt response cache
- [ ] T093 Embedding cache
- [ ] T094 Speculative decoding support (where backend allows)
- [ ] T095 Flash-attention / GPU-layer passthrough flags
- [ ] T096 Prefill reuse across steps (shared system prompt)
- [ ] T097 Token streaming backpressure tuning
- [ ] T098 Time-to-first-token + tokens/sec metrics surfaced in UI

### Epic O — Resource management
- [ ] T099 Show GPU/CPU/RAM usage in UI
- [ ] T100 Per-model memory estimate before load
- [ ] T101 Auto-pick quantization based on available RAM/VRAM
- [ ] T102 Disk usage dashboard for models + workspaces
- [ ] T103 Configurable context length per model
- [ ] T104 Idle unload + keep-alive policy UI

---

## Phase 6 — The runtime moonshot (bundled inference engine)

> This is the hard core that actually makes us a peer to Ollama. Multi-quarter. Gated behind everything above being solid.

### Epic P — Embed an inference engine
- [ ] T105 Evaluate `node-llama-cpp` vs spawning `llama-server`
- [ ] T106 Optional bundled `node-llama-cpp` dependency (behind a flag)
- [ ] T107 Load a local GGUF and run a completion with no external server
- [ ] T108 Wire bundled engine as a first-class backend adapter
- [ ] T109 Streaming from the bundled engine
- [ ] T110 Embeddings from the bundled engine
- [ ] T111 Keep zero-dep default; bundled engine is opt-in install

### Epic Q — Hardware acceleration
- [ ] T112 Metal (Apple Silicon) acceleration path
- [ ] T113 CUDA path detection + load
- [ ] T114 ROCm path
- [ ] T115 Vulkan path
- [ ] T116 CPU SIMD / thread tuning
- [ ] T117 Auto-detect best backend per machine
- [ ] T118 GPU-layer offload configuration

### Epic R — Model loading internals
- [ ] T119 Quantization-aware loader (Q4_K_M, Q5, Q8, etc.)
- [ ] T120 KV-cache management + context shifting
- [ ] T121 Batched inference
- [ ] T122 Mmap model loading for fast start
- [ ] T123 Multi-GPU sharding (stretch)
- [ ] T124 Benchmark tokens/sec vs Ollama on identical models

### Epic S — Model registry & distribution
- [ ] T125 Resumable, checksummed model downloads
- [ ] T126 Model registry client (pull from HuggingFace/OCI)
- [ ] T127 `Modelfile`-equivalent build format
- [ ] T128 Local model library with metadata + tags
- [ ] T129 Model `create`/`cp`/`show` operations
- [ ] T130 Optional push/share to a registry
- [ ] T131 Signature/provenance verification on pull

---

## Phase 7 — Desktop, CLI & distribution

### Epic T — Native desktop app
- [~] T132 macOS `.app` bundle (exists; harden)
- [ ] T133 Menu-bar / tray app with background server
- [ ] T134 Auto-update channel
- [ ] T135 Code signing + notarization (macOS)
- [ ] T136 Windows installer (.msi/.exe) + signing
- [ ] T137 Linux packages (.deb/.rpm/AppImage)
- [ ] T138 First-run onboarding inside the desktop app
- [ ] T139 Native notifications for long pulls/runs

### Epic U — CLI parity with Ollama
- [ ] T140 `agenttrail run <model>` interactive REPL
- [ ] T141 `agenttrail pull / list / rm / ps / show`
- [ ] T142 `agenttrail serve` (headless API)
- [ ] T143 `agenttrail create` from a build file
- [ ] T144 Non-interactive scripting mode + JSON output
- [ ] T145 Shell completions (bash/zsh/fish)
- [ ] T146 CLI integration tests

### Epic V — Packaging & supply chain
- [~] T147 Docker image (exists; multi-arch)
- [ ] T148 Homebrew formula (publishable)
- [ ] T149 npm publish pipeline
- [ ] T150 SBOM generation
- [~] T151 Release checksums (exists; sign releases)
- [ ] T152 Reproducible builds

---

## Phase 8 — Security, privacy, observability, enterprise

### Epic W — Security & privacy
- [x] T153 Workspace path sandbox
- [x] T154 Writes-off-by-default + diff-gated apply
- [~] T155 Prompt-injection hardening scan (exists; expand)
- [ ] T156 Secret detection + redaction in context and receipts
- [ ] T157 Per-tool permission policies + audit
- [ ] T158 Network egress allowlist enforcement
- [ ] T159 Encrypted-at-rest option for workspace/receipts
- [ ] T160 Threat-model test suite (path escape, exfil, injection)

### Epic X — Observability
- [~] T161 Structured logs (exists; expand)
- [ ] T162 Metrics endpoint (Prometheus-style) for tokens/latency/errors
- [ ] T163 Per-run trace timeline view
- [ ] T164 Token + time accounting per run/recipe
- [ ] T165 Error taxonomy + actionable messages
- [ ] T166 Local analytics dashboard (privacy-preserving)

### Epic Y — Team / enterprise (optional track)
- [ ] T167 Read-only shared receipts view
- [ ] T168 Multi-user profiles (local)
- [ ] T169 RBAC for tools/permissions
- [ ] T170 Shared workspace sync (opt-in)
- [ ] T171 Audit-log export (CSV/JSON)
- [ ] T172 SSO hook (stretch)

---

## Phase 9 — Quality, docs, community, growth

### Epic Z — Quality engineering
- [~] T173 Unit/integration/smoke/backend/model tests (exist; grow)
- [ ] T174 Coverage reporting + threshold gate
- [ ] T175 UI end-to-end tests (Playwright) in CI
- [ ] T176 Property/fuzz tests for path + diff logic
- [ ] T177 Performance regression benchmarks in CI
- [ ] T178 Cross-platform CI matrix (mac/win/linux, node LTS)
- [ ] T179 Eval harness expansion + scoreboard

### Epic AA — Documentation
- [ ] T180 Docs site (static, searchable)
- [ ] T181 Getting-started + 60-second guide (visual)
- [ ] T182 Recipe authoring guide
- [ ] T183 Backend setup guides (LM Studio, llama.cpp, vLLM)
- [ ] T184 Architecture deep-dive
- [ ] T185 API reference (generated)
- [ ] T186 Troubleshooting + FAQ expansion
- [ ] T187 Video walkthroughs

### Epic AB — Community & growth
- [ ] T188 Execute launch (post + respond) — gated on screenshots
- [ ] T189 Recipe marketplace submissions + curation
- [ ] T190 Good-first-issue backlog + labels
- [ ] T191 Contribution guide + governance
- [ ] T192 Changelog discipline + release notes per version
- [ ] T193 Showcase gallery (user receipts/workflows)
- [ ] T194 Comparison benchmarks page (honest, reproducible)
- [ ] T195 Plugin SDK + examples

---

## Phase 10 — Ecosystem & advanced (stretch)

### Epic AC — Model ecosystem
- [ ] T196 LoRA/adapter loading
- [ ] T197 Fine-tuning launcher (delegates to a trainer)
- [ ] T198 Quantization tooling wrapper
- [ ] T199 Model conversion helpers (safetensors → GGUF)
- [ ] T200 Model evaluation suite (per-task scores)

### Epic AD — Advanced agent
- [ ] T201 Multi-agent orchestration (roles, hand-offs)
- [ ] T202 Background/scheduled agent runs
- [ ] T203 Long-running task journal + resume
- [ ] T204 Sub-agent spawning with budget isolation
- [ ] T205 Deterministic replay diffing across runs

---

## How we execute this

1. Work **top-down**: finish Phase 1 before Phase 2, except where a later task unblocks adoption.
2. Every task ships with: implementation, a test (where code), a doc note, and a sync to the app bundle.
3. Each completed batch produces a ready commit message for Codex to push.
4. We expand an epic's tasks into finer sub-tasks (toward 1000) only when we start that epic — so the plan stays honest and current.
5. We re-mark `[x]` here as we go; this file is the single source of truth for the campaign.

**Next up:** Phase 1, Epic A — native tool calling (T017–T024).
