# Getting Started

This is the fastest path to a useful AgentTrail run: install, open, search, preview a safe edit, save a receipt, and export proof.

## 60-Second Flow

```mermaid
flowchart LR
  A["Install"] --> B["Open local app"]
  B --> C["Add files to workspace"]
  C --> D["Search or attach context"]
  D --> E["Ask for a safe change"]
  E --> F["Review diff preview"]
  F --> G["Apply intentionally"]
  G --> H["Save receipt or report"]
```

## Quick Start

```bash
npx agenttrail
```

This creates `./agenttrail-workspace`, writes `notes/first-run.md`, starts the local app, and keeps write previews gated by Apply.

Check setup:

```bash
npx agenttrail doctor
```

Or from a clone:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173
```

## First Safe Task

1. Put a small note in `workspace/notes/demo.md`.
2. Turn on file reads and write previews.
3. Ask: `Search the workspace, improve notes/demo.md, and show me the diff before applying.`
4. Review the Diff Review panel.
5. Click Apply only after the proposed content looks right.
6. Export a receipt or HTML report.

## What Good Looks Like

| Signal | Expected result |
| --- | --- |
| Search | The trail shows a search/read step before edits. |
| Diff preview | The proposed write appears in Diff Review. |
| Apply | The file changes only after explicit approval. |
| Receipt | The receipt lists model, selected files, tools, diffs, and trust score. |
| Privacy | The app runs on `127.0.0.1` and keeps workspace data local. |

## Demo Assets

- GIF proof: [agenttrail-demo.gif](agenttrail-demo.gif)
- App screenshot: [preview-app.png](preview-app.png)
- Diff screenshot: [preview-diff.png](preview-diff.png)
- Static browser demo: [public-demo.html](public-demo.html)

## Next Guides

- Recipes: [RECIPE_AUTHORING.md](RECIPE_AUTHORING.md)
- Install: [INSTALL.md](INSTALL.md)
- Backends: [BACKEND_SETUP.md](BACKEND_SETUP.md)
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
