# AgentTrail VS Code Extension

MVP editor bridge for a running local AgentTrail server.

## Commands

- `AgentTrail: Chat` opens a prompt and streams the answer into the AgentTrail output channel.
- `AgentTrail: Ask about selection` sends the active selection plus the current workspace-relative file path.
- `AgentTrail: Apply last suggestion` replaces the selection, or the whole file after confirmation, with the last code block returned by AgentTrail.

## Settings

- `agenttrail.url`: local AgentTrail URL, default `http://127.0.0.1:4173`.
- `agenttrail.model`: optional model override. Empty uses AgentTrail routing/defaults.

## Run Locally

Start AgentTrail with `agenttrail serve`, open this folder in VS Code, press `F5`, then run the commands from the Command Palette.
