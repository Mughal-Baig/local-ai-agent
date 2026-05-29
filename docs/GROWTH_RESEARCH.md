# Growth Research

Research date: 2026-05-30

## What The Market Rewards

The highest-interest local AI repos do at least one of these well:

- **Platform breadth**: broad provider support, RAG, MCP, teams, plugins, and APIs.
- **Workflow specificity**: one clear job people can understand quickly.
- **Trust and observability**: permissions, replay, audit logs, and local-first claims that are visible in the product.
- **Fast evaluation**: screenshot, demo, quick start, CI, and a clear first task.
- **Contributor surface**: small files people can add without understanding the whole codebase.

## Useful Comparables

- [ollama/ollama](https://github.com/ollama/ollama): massive pull because it is the local model runner layer.
- [open-webui/open-webui](https://github.com/open-webui/open-webui): wins as a broad self-hosted UI with Ollama, OpenAI-compatible providers, RAG, MCP, and OpenAPI.
- [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm): wins with workspaces, private document chat, agents, no-code workflows, and MCP.
- [lastmile-ai/mcp-agent](https://github.com/lastmile-ai/mcp-agent): clear protocol-native agent-building story.
- [agentreplay/agentreplay](https://github.com/agentreplay/agentreplay): local-first observability and replay is a strong trust hook.
- [abordage/awesome-mcp](https://github.com/abordage/awesome-mcp): lists and registries work because contributors can add small entries.

## Chosen Niche

Do not compete as a giant platform. Compete as:

> the smallest readable local AI agent kit with recipes, workspace-safe tools, and exportable audit receipts.

This creates a sharper reason to star:

- developers can learn from the code quickly
- contributors can add recipes without deep app knowledge
- privacy-conscious users can inspect what happened
- maintainers can grow a recipe gallery and docs over time

## Launch Checklist

1. Make the repo public only when ready.
2. Pin a short demo GIF or screenshot above the README fold.
3. Add 10-15 recipes before launch.
4. Create GitHub issues labeled `good first issue` for new recipes.
5. Post to communities with a concrete hook: "tiny local agent recipe kit with audit receipts."
6. Submit to awesome lists for Ollama, MCP, local-first AI, and self-hosted tools.
7. Keep CI green and release small tagged versions.
8. Avoid fake stars. They create long-term trust risk and can damage credibility.

## Next Differentiators

- Searchable local receipt history using JSONL or SQLite.
- Import/export recipe packs.
- Optional MCP bridge with strict per-tool approval.
- GitHub Pages demo that does not require Ollama.
- A one-file desktop launcher for non-technical users.
