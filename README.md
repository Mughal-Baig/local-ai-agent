# Local AI Agent

A private, local-first AI agent inspired by tools like Claude, ChatGPT, and Gemini. It runs on your machine, talks to local Ollama models, and can inspect or update files inside a sandboxed workspace folder.

## Features

- Chat UI with model picker and streaming-style responses
- Ollama integration for local models
- Workspace-aware tools: list files, read files, and write files
- Safe path handling so the agent stays inside `workspace/`
- No npm dependencies required
- Smoke test included

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

4. Open:

   ```text
   http://127.0.0.1:4173
   ```

You can also use:

```bash
npm start
```

## How It Works

The browser sends messages to the local Node server. The server sends the prompt to Ollama and gives the model a small tool protocol. When the model requests a tool, the server runs it against the workspace and sends the result back into the next model step.

Available tools:

- `list_files`: shows files in the workspace
- `read_file`: reads a workspace file
- `write_file`: creates or updates a workspace file

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

## Test

```bash
node scripts/smoke-test.js
```

The smoke test starts the server on a temporary port, checks the UI and API, writes a test file in a temporary workspace, reads it back, and shuts the server down.

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
