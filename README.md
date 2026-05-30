# AgentTrail Local AI Agent

[![CI](https://github.com/Mughal-Baig/local-ai-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Mughal-Baig/local-ai-agent/actions/workflows/ci.yml)
![No npm dependencies](https://img.shields.io/badge/runtime-zero%20npm%20deps-B35F43)
![Local first](https://img.shields.io/badge/privacy-local--first-5C7257)
![Ollama](https://img.shields.io/badge/models-Ollama-C2933B)
![Auditable](https://img.shields.io/badge/every%20action-auditable%20receipt-CC785C)

> ### A local AI agent that shows its work.
> Every search, every edit, every reason — on your machine. Nothing leaves.

![AgentTrail core loop: ask, search before answer, diff preview, explicit Apply, replayable receipt](docs/agenttrail-demo.gif)

*The loop: **ask → search before answer → diff preview → you click Apply → replayable receipt.** Every step is shown. Writes are off by default.*

**▶ Live demo, zero install:** [mughal-baig.github.io/local-ai-agent/demo.html](https://mughal-baig.github.io/local-ai-agent/demo.html)

ChatGPT and Claude are great — until you need them to touch private files. AgentTrail gives you that same chat-and-workspace workflow, but it runs entirely on your machine with Ollama, and it turns every action into an auditable, replayable receipt. It is the only local agent built so you can verify exactly what it did and why.

## A Look Inside

![AgentTrail redesigned interface — grouped sidebar, trust dashboard, and chat with tool receipts](docs/preview-app.png)

A calm, grouped workspace: model and files up top, every tool call logged in the Agent Trail, and a live Trust Score — collapsible sections keep the power tools one click away instead of in your face.

![Diff preview with explicit Apply, and the replayable receipt it produces](docs/preview-diff.png)

Writes are off by default. The agent proposes a unified diff; you click **Apply**; the run becomes a receipt you can reopen, export, and replay.

## GitHub Visual Assets

- Hero GIF: [`docs/agenttrail-demo.gif`](docs/agenttrail-demo.gif)
- UI preview: [`docs/preview-app.png`](docs/preview-app.png)
- Diff preview: [`docs/preview-diff.png`](docs/preview-diff.png)
- Social preview upload asset: [`docs/social-preview.png`](docs/social-preview.png)

## Why Star This

- **Transparent by default**: every tool call is shown as an Agent Trail receipt.
- **Search before answer**: keyword search plus real local vector search with Ollama embeddings when available.
- **Diff-safe writes**: preview mode shows a unified diff in chat and lets the user apply it deliberately.
- **Trust Score dashboard**: each run shows evidence, preview, receipt, memory, hardening, and eval signals.
- **Receipt timeline, replay, and reports**: reopen a saved run, restore prompt/files/model/diffs, and export Markdown/HTML reports.
- **Recipe-driven**: reusable local workflows live in plain JSON files anyone can add.
- **Demo-first**: the GIF and static demo let visitors understand the project before installing Ollama.
- **Permission-aware**: file reads are explicit and file writes are off by default.
- **Private by design**: the server only talks to Ollama and the local browser UI.
- **Safe workspace boundary**: file reads and writes are blocked outside `workspace/`.
- **Zero npm dependencies**: clone, run `node server.js`, and start building.
- **Serious foundation**: schemas, migrations, permission engine, background jobs, backups, plugins, checksums, and tests keep it from feeling like a toy.
- **Product proof loop**: chunk citations, replay guidance, model comparison, plugin gallery, onboarding, and trust badges make the value obvious fast.

## What Makes It Different

Popular local AI tools are often full platforms. This project is intentionally smaller: it is a starter agent you can read, modify, and trust in an afternoon.

| Area | AgentTrail |
| --- | --- |
| Setup | One Node command, `npx`-ready package metadata, Docker Compose, Homebrew formula draft, desktop launchers |
| Model backend | Ollama, or any OpenAI-compatible local server (LM Studio, llama.cpp, vLLM, Jan) — see [Model Backends](docs/MODEL_BACKENDS.md) |
| File access | Sandboxed workspace tools plus keyword search, local vector index, and Ollama embedding index |
| Trust UX | Trust Score, local signals, security scan, reviewable diff previews, explicit apply buttons, exportable reports, replay sessions, receipts, and tool history |
| Workflow system | Plain JSON recipes, role-based recipe packs, import/export UI, and marketplace manifest |
| Foundation | Stable schemas, migrations, append-only store, permission engine, plugin manifests, backups, jobs, checksums |
| Best use | Personal workspace agent starter kit and auditable local workflow lab |

## 60-second Quick Start

```bash
git clone https://github.com/Mughal-Baig/local-ai-agent.git
cd local-ai-agent
ollama pull llama3.2
npx github:Mughal-Baig/local-ai-agent
```

Or clone and run:

```bash
git clone https://github.com/Mughal-Baig/local-ai-agent.git
cd local-ai-agent
node server.js
```

Open `http://127.0.0.1:4173`, build the semantic index, ask for a change, review the diff, click **Apply**, then export the receipt/report/replay session.

## Features

- Chat UI with model picker and **true token streaming** (tokens stream from the backend as generated; models kept warm via keep-alive)
- **In-app model management**: pull (with live progress), list, and remove local models without leaving the app
- **Response cache** so repeated recipe runs return instantly, plus prompt and step-budget guards that keep long workspaces fast
- Starter prompts for summarize, plan, review, and save-note workflows
- Local recipe picker backed by plain JSON workflow files
- Keyword search and semantic local search across workspace files, sessions, and saved receipts
- Ollama embedding index using `OLLAMA_EMBED_MODEL=nomic-embed-text`, with local-vector fallback
- First-run setup checklist for Ollama, models, workspace files, recipes, and receipts
- Attachment picker that copies local files into `workspace/attachments/` and selects them for agent context
- Permission toggles for file reads, file writes, write preview mode, and security hardening mode
- Ollama integration for local models
- Model capability scoring for coding, tool use, planning, and long context
- Workspace-aware tools: list files, search files, read files, preview writes, and write files
- Native tool calling for Ollama `/api/chat` and OpenAI-compatible local backends, with per-model capability probing, multi-tool batches, schema validation, and repair for malformed arguments
- Structured JSON output endpoint for Ollama schema `format` and OpenAI-compatible `response_format.json_schema`, plus typed extraction recipes with readable schema-error reasons
- Planner approval flow: generate a structured plan, edit it, approve it, then run the agent with that plan in context
- Run guardrails: choose a step budget, use a deep-run override deliberately, and stop an active run so the backend stream aborts
- Reflection and loop safety: every final answer gets a self-check score, and repeated identical tool loops abort before wasting another step
- In-chat diff cards with explicit **Apply** buttons for proposed file changes
- Diff Review center with pending-change apply/reject controls
- Agent Trail receipts for tool calls, selected context, model status, and errors
- Receipt timeline, replayable saved sessions, and exportable Markdown/HTML reports
- Project memory stored locally as Markdown plus structured facts/preferences/decisions JSON, with visible citations, revision history, and prompt context
- Recipe packs for coder, founder, and security workflows, plus marketplace manifest and import/export route
- Real MCP stdio server with explicit per-tool approvals and receipts
- Workspace profile templates with profile switching API/UI
- Local evaluation harness plus saved pass/fail history and model benchmark surface
- Dockerfile, Docker Compose, `agenttrail` bin entry, install script, Homebrew formula draft, desktop launchers, and a macOS `.app` bundle generator
- Stable schemas exposed at `/api/schemas`
- Route catalog exposed at `/api/routes`
- Config validation exposed at `/api/config`
- Structured logs exposed at `/api/logs`
- SQLite store exposed at `/api/sqlite/status`
- File watcher controls exposed at `/api/watch/status`, `/api/watch/start`, and `/api/watch/stop`
- Append-only local event store exposed at `/api/store/stats`
- Migration system exposed at `/api/migrations`
- Background jobs exposed at `/api/jobs`
- Plugin manifests exposed at `/api/plugins`
- Plugin sandbox execution exposed at `/api/plugins/run`
- Backup export exposed at `/api/backup/export`
- Backup import exposed at `/api/backup/import`
- Release checksums exposed at `/api/releases/checksums`
- Release signing plan exposed at `/api/releases/signing-plan`
- Separate frontend foundation and product modules in `public/modules/`
- Saved receipt history in `workspace/receipts/`
- Safe path handling so the agent stays inside `workspace/`
- Smoke test and GitHub Actions CI included

## Comparison

Other local tools let an AI *do* things. AgentTrail is the one that makes the AI **prove** what it did. Auditability and replay are the category it owns.

| Tool | Main strength | What AgentTrail does that it doesn't |
| --- | --- | --- |
| Open WebUI | Broad self-hosted chat platform | Turns every tool call into a receipt; writes gated behind an explicit diff Apply |
| AnythingLLM | Document chat and workspaces | Shows the search evidence *before* the answer, then logs it |
| Jan | Polished offline chat app | Adds workspace edits, a live Trust Score, and replayable runs |
| Aider | Terminal coding agent | Same diff-approval safety in a readable browser UI, plus exportable receipts |
| OpenHands | Full coding-agent platform | A tiny, zero-dependency lab you can read and fork in an afternoon |

**The one-line wedge:** every other tool asks you to trust the output. AgentTrail hands you the receipt.

## Quick Start

1. Install [Ollama](https://ollama.com/download).
2. Pull a model:

   ```bash
   ollama pull llama3.2
   ```

3. Start this app:

   ```bash
   node server.js
   ```

   macOS and Linux users can also run:

   ```bash
   ./start.sh
   ```

4. Open:

   ```text
   http://127.0.0.1:4173
   ```

You can also use:

```bash
npm start
```

Other install paths:

```bash
npm link
agenttrail
docker build -t agenttrail .
docker run --rm -p 4173:4173 -v "$PWD/workspace:/app/workspace" agenttrail
docker compose up --build
./install.sh
npm run package:mac-app
```

## Try It

1. Open the app.
2. Select `welcome.md` in the workspace.
3. Click **Summarize** or ask:

   ```text
   Summarize the selected file and create a checklist for improving the project.
   ```

4. Watch the Agent Trail for local model, context, and tool receipts.

## Recipes

Recipes are reusable local workflows stored as JSON files in [recipes](recipes).

Each recipe has:

- `title`
- `description`
- `tags`
- `prompt`

Good recipe ideas are easy to review and useful without any cloud service: code review, launch notes, security hardening, receipt summaries, research briefs, and workspace planning.

Recipe shape is documented in [recipes/schema.json](recipes/schema.json).

## How It Works

The browser sends messages to the local Node server. The server sends a prompt to Ollama with a small tool protocol. When the model requests a tool, the server runs it against the workspace and sends the result into the next model step.

Available tools:

- `list_files`: shows files in the workspace
- `search_workspace`: searches local files, sessions, receipts, and memory for relevant context
- `read_file`: reads a workspace file
- `preview_write_file`: returns a diff preview without writing
- `write_file`: creates or updates a workspace file

When write preview mode is enabled, `write_file` returns a diff preview instead of changing the file. The browser shows that diff with an explicit **Apply** button, keeping the default experience reviewable even when an LLM tries to write.

## Top 1% Surfaces

- Visual demo proof: [docs/agenttrail-demo.gif](docs/agenttrail-demo.gif), [docs/preview-app.png](docs/preview-app.png), [docs/preview-diff.png](docs/preview-diff.png)
- True semantic search: `/api/search-index`, `/api/search?mode=semantic`, Ollama embeddings with local-vector fallback
- Receipt timeline and replay: saved Markdown receipts in `workspace/receipts/`, JSON sessions in `workspace/sessions/`
- Diff Review center: pending preview apply/reject UI
- Local attachments: `/api/attachments` plus browser file picker that saves files into the workspace
- MCP bridge: [mcp/server.js](mcp/server.js) and [mcp/agenttrail.mcp.json](mcp/agenttrail.mcp.json)
- Recipe marketplace: [marketplace/recipes.json](marketplace/recipes.json), [recipe-packs](recipe-packs), `/api/packs/import`
- One-command install surfaces: `bin/agenttrail.js`, [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml), [install.sh](install.sh), [Formula/agenttrail.rb](Formula/agenttrail.rb), [desktop](desktop)
- Physical Mac app: `npm run package:mac-app` builds `dist/mac/AgentTrail.app`
- Model scoring and benchmarking: `/api/status`, `/api/benchmarks`
- Agent eval harness and history: `npm run eval`, `/api/evals`, `/api/evals/history`
- Project memory: `workspace/memory/project-memory.md`, `workspace/memory/project-memory.json`, citations, and revision history
- Workspace profiles: [profiles](profiles), `/api/profiles/apply`
- Trust Score dashboard: browser UI
- README star engine: demo, comparison, 60-second quick start, roadmap
- Security hardening engine: prompt flags, path escape checks, exfiltration patterns, `/api/security/scan`
- Shareable reports: polished Markdown/HTML exports in `workspace/reports/`
- Community growth loop: issue templates, launch posts, marketplace submissions, and good-first contribution docs
- Guided replay: `/api/replay/plan`
- Chunk citations: `/api/search/chunks`
- Trust badge: `/api/trust/badge`
- Model comparison: `/api/models/compare`
- Real benchmark run endpoint: `/api/benchmarks/run`
- Pack import from GitHub URL: `/api/marketplace/import-url`
- Public demo data: `/api/demo/public` and [docs/public-demo.html](docs/public-demo.html)
- MCP client setup examples: [docs/mcp/CLIENT_SETUP.md](docs/mcp/CLIENT_SETUP.md)

## Foundation Surfaces

- Server modules: [src](src)
- Stable schemas: [docs/SCHEMAS.md](docs/SCHEMAS.md)
- Permission engine: [src/permissions.js](src/permissions.js)
- Model adapters: [src/model-adapters.js](src/model-adapters.js)
- Migration system: [src/migrations.js](src/migrations.js)
- Append-only store: [src/json-store.js](src/json-store.js)
- Background jobs: [src/jobs.js](src/jobs.js)
- Plugin architecture: [plugins](plugins)
- Release checksums: [docs/RELEASE_SIGNING.md](docs/RELEASE_SIGNING.md)
- Backup export: `workspace/backups/`
- SQLite store: `workspace/.agenttrail/agenttrail.db`
- Structured logs: `workspace/.agenttrail/logs.jsonl`
- Versioned migration files: [migrations](migrations)

## Workspace

Put project notes, drafts, and files you want the agent to work with inside:

```text
workspace/
```

The app intentionally blocks paths outside that folder.

## Configuration

Create `.env` from `.env.example` or set environment variables directly:

```bash
PORT=4173 OLLAMA_MODEL=llama3.2 node server.js
```

Supported variables:

- `PORT`: local web server port
- `HOST`: bind address, default `127.0.0.1`; Docker uses `0.0.0.0`
- `OLLAMA_HOST`: Ollama API host
- `OLLAMA_MODEL`: default model name
- `OLLAMA_EMBED_MODEL`: local embedding model for semantic index, default `nomic-embed-text`
- `AGENTTRAIL_MODEL_ADAPTER`: model backend — `ollama` (default), `lmstudio`, `llamacpp`, or `openai-compatible`. See [Model Backends](docs/MODEL_BACKENDS.md)
- `LMSTUDIO_HOST` / `LLAMACPP_HOST` / `OPENAI_COMPATIBLE_HOST`: host for the chosen OpenAI-compatible backend
- `OPENAI_API_KEY`: optional bearer token for OpenAI-compatible backends that require one
- `OLLAMA_KEEP_ALIVE`: how long to keep the model warm between turns, default `5m` (cuts cold-start latency)
- `AGENTTRAIL_CACHE`: set to `off` to disable the in-memory response cache (default on); `AGENTTRAIL_CACHE_TTL_MS` tunes the TTL
- `AGENTTRAIL_MAX_PROMPT_CHARS`: prompt budget cap for assembled context, default `24000`
- `AGENTTRAIL_DEFAULT_STEP_BUDGET`: default model/tool loop budget, default `3`
- `WORKSPACE_ROOT`: folder the agent can access
- `MAX_TOOL_ITERATIONS`: maximum tool loop steps per message

## Troubleshooting And Models

- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Model guide](docs/MODELS.md)
- [Security checklist](docs/SECURITY_CHECKLIST.md)

## Test

```bash
node scripts/smoke-test.js
npm run test:unit
npm run test:integration
npm run test:backend
npm run test:models
npm run test:guardrails
npm run test:reflection
npm run test:memory
npm run test:ui
npm run eval
npm run release:checksums
npm run package:desktop
npm run package:mac-app
```

**What the suite proves.** Three layers run with no cloud and no Ollama required (the smoke test points at a dead Ollama host on purpose):

- **Unit** — foundation modules (schemas, permissions, store, migrations) behave as specified.
- **Integration** — the API contract holds across endpoints.
- **End-to-end smoke** — boots a real server on a temp workspace and asserts the full trust loop: the UI serves, `/api/status` reports `ok` with Ollama correctly detected as unavailable, the foundation score is **≥ 90**, **≥ 10** stable schemas are exposed, `write_file` is a permissioned tool, recipes load (including `code-review`), and a write → read → **preview diff** → search round-trip all succeed. It then shuts the server down.

In other words, "serious foundation" is checkable in one command — every claim above is an assertion in `scripts/smoke-test.js`.

See also the [Receipt Spec](docs/RECEIPT_SPEC.md) (the auditable artifact format AgentTrail produces) and the honest [Security Posture](docs/SECURITY_POSTURE.md).

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md).

## Growth Research

See [docs/GROWTH_RESEARCH.md](docs/GROWTH_RESEARCH.md) for research-backed positioning, [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) for the public launch checklist, and [docs/TOP_1_PERCENT_PLAYBOOK.md](docs/TOP_1_PERCENT_PLAYBOOK.md) for the focused growth path.

The v0.7 implementation map is in [docs/TOP_1_PERCENT_IMPLEMENTATION.md](docs/TOP_1_PERCENT_IMPLEMENTATION.md).

## Contributing

Small, focused contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Upload To GitHub

If GitHub CLI is installed and authenticated:

```bash
git add .
git commit -m "Create local AI agent"
gh repo create local-ai-agent --private --source=. --remote=origin --push
```

Use `--public` instead of `--private` if you want the repository to be visible to everyone.

If you already created a GitHub repo:

```bash
git remote add origin https://github.com/YOUR_USERNAME/local-ai-agent.git
git branch -M main
git push -u origin main
```

## Notes

This is not a clone of Claude, ChatGPT, or Gemini. It is a local AI assistant with a similar chat-and-workspace workflow that you control on your own machine.
