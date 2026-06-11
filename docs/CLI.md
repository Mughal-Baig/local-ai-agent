# AgentTrail CLI

AgentTrail ships an Ollama-style CLI for local agent workflows while keeping the browser UI and API server available.

## Start The Server

```bash
agenttrail serve
agenttrail serve --host 127.0.0.1 --port 4173
```

No arguments still start the local AgentTrail server for backward compatibility:

```bash
agenttrail
```

## Run A Model

Interactive REPL:

```bash
agenttrail run llama3.2
```

Non-interactive prompt:

```bash
agenttrail run llama3.2 "summarize workspace/welcome.md"
echo "write release notes" | agenttrail run llama3.2
agenttrail run llama3.2 --prompt "list risks" --json
```

Use `--json` for scripts and CI jobs. Use `--url http://127.0.0.1:4173` when the server runs somewhere else.

## Chat REPL

`agenttrail chat` is the model-optional app-composer path. It uses AgentTrail's default model/router unless `--model` is set.

```bash
agenttrail chat
agenttrail chat --model llama3.2
agenttrail chat --prompt "Summarize docs/ROADMAP.md" --file docs/ROADMAP.md --json
echo "list the next risks" | agenttrail chat --json
```

Interactive slash commands:

- `/model <name>` sets the model for following turns.
- `/file <path>` adds a workspace file to selected context.
- `/files` shows selected files.
- `/clear` clears the conversation.
- `/exit` quits.

## Manage Models

```bash
agenttrail list
agenttrail pull llama3.2
agenttrail rm llama3.2
agenttrail ps
agenttrail show llama3.2
```

`list` shows both Ollama-managed models and AgentTrail registry models. `ps` reports active and queued AgentTrail model work from `/api/concurrency`.

## Create A Registry Model

```bash
agenttrail create my/derived-model -f Modelfile
agenttrail create my/derived-model -f Modelfile --tags local,coding --json
```

Supported build-file directives include `FROM`, `NAME`, `PARAMETER`, `TAG`, `TEMPLATE`, `SYSTEM`, and `LICENSE`.

## Shell Completions

```bash
agenttrail completion bash
agenttrail completion zsh
agenttrail completion fish
```

Install the printed script through your shell's normal completion setup.
