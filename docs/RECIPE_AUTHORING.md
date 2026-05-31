# Recipe Authoring Guide

Recipes are small JSON workflows that make AgentTrail useful for repeated local tasks. Good recipes are specific, safe, and auditable.

## Minimal Recipe

```json
{
  "id": "workspace-brief",
  "title": "Workspace Brief",
  "description": "Summarize selected files and cite evidence.",
  "tags": ["research", "summary"],
  "prompt": "Read the selected files, summarize the important facts, and cite file paths. Do not invent missing details."
}
```

## Required Fields

| Field | Rule |
| --- | --- |
| `id` | Lowercase slug. Must be unique. |
| `title` | Human-readable name. |
| `description` | One sentence explaining the outcome. |
| `tags` | Short list used by search and packs. |
| `prompt` | Clear instruction with safety boundaries. |

## Optional Fields

| Field | Use |
| --- | --- |
| `outputSchemaId` | Connects a recipe to structured output such as `task-list` or `table-extract`. |
| `action` | Adds local helper actions, such as audio transcription output paths. |
| `permissions` | Documents expected read/write/tool behavior. |
| `examples` | Helps users understand when to run it. |

## Safety Checklist

- Tell the model to search/read before writing.
- Ask for citations when facts matter.
- Say what not to invent.
- Prefer diff preview before file edits.
- Keep external network assumptions out unless the recipe explicitly needs them.
- Make output expectations concrete: table, checklist, JSON, report, or diff.

## Pack Authoring

Recipe packs live in `recipe-packs/*.json`. Packs should group recipes by role:

```json
{
  "id": "founder",
  "title": "Founder Pack",
  "role": "founder",
  "recipes": ["launch-readme", "meeting-follow-up-email", "release-notes"]
}
```

## Validation

Run:

```bash
npm test
npm run eval
```

The app rejects duplicate recipe IDs and malformed recipe shapes. Marketplace import also validates before writing files.

## Good Recipe Patterns

| Pattern | Example |
| --- | --- |
| Evidence first | "Search the workspace before answering." |
| No invention | "If a name/date is missing, say it is missing." |
| Preview-safe | "Use diff previews for any file write." |
| Structured result | "Return a table with owner, risk, next step." |
| Receipt-ready | "Mention files used and decisions made." |

## Where To Put Recipes

- Built-ins: `recipes/*.json`
- Packs: `recipe-packs/*.json`
- Marketplace manifest: `marketplace/recipes.json`

After adding a public recipe, update the relevant pack and run the smoke/eval checks.
