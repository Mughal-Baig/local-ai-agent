# AgentTrail Local AI Agent

[![CI](https://github.com/Mughal-Baig/local-ai-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Mughal-Baig/local-ai-agent/actions/workflows/ci.yml)
![No npm dependencies](https://img.shields.io/badge/runtime-zero%20npm%20deps-246B62)
![Local first](https://img.shields.io/badge/privacy-local--first-C35B43)
![Ollama](https://img.shields.io/badge/models-Ollama-D99B2B)

AgentTrail is a tiny, auditable local AI agent kit for people who want a Claude/ChatGPT/Gemini-style workspace assistant without sending files to a cloud service.

![Local AI Agent preview](docs/preview.svg)

![Local AI Agent demo flow](docs/demo-flow.svg)

**Live demo:** [mughal-baig.github.io/local-ai-agent/demo.html](https://mughal-baig.github.io/local-ai-agent/demo.html)

**Core promise:** a local agent should show what it searched, what it read, what it planned to write, and why you can trust it.

## Why Star This

- **Transparent by default**: every tool call is shown as an Agent Trail receipt.
- **Search before answer**: built-in local workspace search helps the agent find evidence before responding.
- **Diff-safe writes**: preview mode shows a unified diff in chat and lets the user apply it deliberately.
- **Recipe-driven**: reusable local workflows live in plain JSON files anyone can add.
- **Demo-first**: the static demo lets visitors understand the project before installing Ollama.
- **Permission-aware**: file reads are explicit and file writes are off by default.
- **Private by design**: the server only talks to Ollama and the local browser UI.
- **Safe workspace boundary**: file reads and writes are blocked outside `workspace/`.
- **Zero npm dependencies**: clone, run `node server.js`, and start building.
- **Hackable core**: the agent loop is one readable Node server, not a framework maze.

## What Makes It Different

Popular local AI tools are often full platforms. This project is intentionally smaller: it is a starter agent you can read, modify, and trust in an afternoon.

| Area | AgentTrail |
| --- | --- |
| Setup | One Node command, no package install required |
| Model backend | Ollama |
| File access | Sandboxed workspace tools plus local search |
| Trust UX | Visible local signals, reviewable diff previews, explicit apply buttons, exportable receipts, and tool history |
| Workflow system | Plain JSON recipes in `recipes/` |
| Best use | Personal workspace agent starter kit and auditable local workflow lab |

## Features

- Chat UI with model picker and streaming-style responses
- Starter prompts for summarize, plan, review, and save-note workflows
- Local recipe picker backed by plain JSON workflow files
- Local search across workspace files and saved receipts
- First-run setup checklist for Ollama, models, workspace files, recipes, and receipts
- Permission toggles for file reads, file writes, and write preview mode
- Ollama integration for local models
- Workspace-aware tools: list files, search files, read files, preview writes, and write files
- In-chat diff cards with explicit **Apply** buttons for proposed file changes
- Agent Trail receipts for tool calls, selected context, model status, and errors
- Exportable Markdown audit receipts
- Saved receipt history in `workspace/receipts/`
- Safe path handling so the agent stays inside `workspace/`
- Smoke test and GitHub Actions CI included

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
- `search_workspace`: searches local files and receipts for relevant context
- `read_file`: reads a workspace file
- `preview_write_file`: returns a diff preview without writing
- `write_file`: creates or updates a workspace file

When write preview mode is enabled, `write_file` returns a diff preview instead of changing the file. The browser shows that diff with an explicit **Apply** button, keeping the default experience reviewable even when an LLM tries to write.

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
- `OLLAMA_HOST`: Ollama API host
- `OLLAMA_MODEL`: default model name
- `WORKSPACE_ROOT`: folder the agent can access
- `MAX_TOOL_ITERATIONS`: maximum tool loop steps per message

## Troubleshooting And Models

- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Model guide](docs/MODELS.md)
- [Security checklist](docs/SECURITY_CHECKLIST.md)

## Test

```bash
node scripts/smoke-test.js
```

The smoke test starts the server on a temporary port, checks the UI and API, writes a test file in a temporary workspace, reads it back, and shuts the server down.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md).

## Growth Research

See [docs/GROWTH_RESEARCH.md](docs/GROWTH_RESEARCH.md) for research-backed positioning, [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) for the public launch checklist, and [docs/TOP_1_PERCENT_PLAYBOOK.md](docs/TOP_1_PERCENT_PLAYBOOK.md) for the focused growth path.

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
