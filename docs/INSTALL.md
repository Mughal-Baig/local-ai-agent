# Install AgentTrail

This page is the public install path for AgentTrail. The goal is simple: start the local app, use a writable workspace, and know exactly what to fix when setup is not ready.

## 60-Second Start

```bash
npx agenttrail
```

Then open:

```text
http://127.0.0.1:4173
```

On first run, the CLI creates a local workspace at `./agenttrail-workspace`, adds `notes/first-run.md`, and starts the app with write previews still gated by Apply.

Check setup health:

```bash
npx agenttrail doctor
npx agenttrail doctor --json
```

The doctor checks Node.js, workspace permissions, disk space, port availability, Ollama reachability, and the default model.

## npm / npx

After the package is published:

```bash
npx agenttrail
npx agenttrail doctor
npx agenttrail chat --prompt "Search the first-run note and suggest a safer version"
```

Use a custom workspace:

```bash
npx agenttrail --workspace "$HOME/AgentTrail/workspace"
```

## Homebrew

After the formula is published to the tap:

```bash
brew tap Mughal-Baig/local-ai-agent
brew install agenttrail
agenttrail doctor
agenttrail
```

Run as a service:

```bash
brew services start agenttrail
brew services stop agenttrail
```

If the formula later lands in Homebrew core, the install command becomes:

```bash
brew install agenttrail
```

## Docker

Persist workspace data on the host:

```bash
mkdir -p agenttrail-workspace
docker run --rm \
  -p 4173:4173 \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  -v "$PWD/agenttrail-workspace:/data/workspace" \
  ghcr.io/mughal-baig/agenttrail:latest
```

Docker Compose:

```bash
docker compose up
```

The compose file maps `./workspace` to `/data/workspace`, matching `WORKSPACE_ROOT=/data/workspace` in the container.

## macOS App

After a signed release is published, download:

```text
https://github.com/Mughal-Baig/local-ai-agent/releases/latest/download/AgentTrail-macOS.dmg
```

Verify the checksum before opening:

```bash
curl -L -O https://github.com/Mughal-Baig/local-ai-agent/releases/latest/download/AgentTrail-macOS.dmg
curl -L -O https://github.com/Mughal-Baig/local-ai-agent/releases/latest/download/SHA256SUMS_v0.7.0.txt
shasum -a 256 AgentTrail-macOS.dmg
grep AgentTrail-macOS.dmg SHA256SUMS_v0.7.0.txt
```

Gatekeeper notes:

- Prefer the signed/notarized DMG once it is published.
- If macOS says the app is from an unidentified developer, do not bypass it for public releases. Verify checksums and use the unsigned build only for local development.
- Local development builds from `npm run package:mac-app` are not notarized.

## Friendly Failure Fixes

Port conflict:

```bash
agenttrail serve --port 4174
```

Missing Ollama:

```bash
ollama serve
ollama pull llama3.2
agenttrail doctor
```

Bad workspace permissions:

```bash
WORKSPACE_ROOT="$HOME/AgentTrail/workspace" agenttrail
```

Run `agenttrail doctor --json` in bug reports so maintainers can see which install check failed without collecting private workspace content.
