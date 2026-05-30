# AgentTrail Receipt Spec (v1)

A **receipt** is AgentTrail's core artifact: a human- and machine-readable record of what the agent did during a run — what it searched, what it read, what it proposed to write, and under which permissions. The point is auditability: anyone should be able to reconstruct a run from its receipt.

This document specifies the three related artifacts AgentTrail produces. They are intentionally plain (Markdown + JSON) so they can be read in any editor, diffed in Git, and parsed without a dependency.

## 1. Trail Receipt (`receipts/trail-<timestamp>.md`)

Saved when you export the Agent Trail (`POST /api/receipts`). Markdown, with a fixed header block followed by an ordered event log.

```markdown
# AgentTrail Receipt

Exported: 2026-05-30T09:41:12.004Z
Model: llama3.2
Selected files: README.md, docs/ROADMAP.md
Permissions: reads on, writes off, previews on
Tool calls: 5

## Events

- 09:41:02 [search] 3 keyword result(s) for "intro"
- 09:41:04 [tool] read_file: README.md
- 09:41:06 [preview] preview_write_file: README.md (+4 -1)
- 09:41:09 [file] Applied preview README.md
- 09:41:12 [system] Exported audit receipt
```

### Header fields

| Field | Meaning |
| --- | --- |
| `Exported` | ISO-8601 timestamp of export |
| `Model` | Ollama model used for the run, or `not selected` |
| `Selected files` | Workspace paths supplied as context, comma-separated, or `none` |
| `Permissions` | Effective read / write / preview permission state at export |
| `Tool calls` | Count of tool invocations in the run |

### Event line grammar

```
- <HH:MM:SS> [<type>] <label>
```

Events are listed in chronological order (oldest first). `type` is one of the controlled values below; `label` is free text.

### Event types

| Type | Emitted when |
| --- | --- |
| `system` | Lifecycle events (boundary active, trail cleared, receipt exported) |
| `model` | Model selected, auto-selected, or availability change |
| `context` | Files selected or deselected as context |
| `search` | A keyword or semantic search ran (with result count + provider) |
| `tool` | A workspace tool ran (`list_files`, `read_file`, `search_workspace`) |
| `preview` | A write was proposed as a diff (`preview_write_file`) — no file changed |
| `file` | A file was created or a preview was applied (the only events that mutate disk) |
| `permission` | A permission toggle changed |
| `security` | Hardening toggled, a suspicious prompt flagged, or a scan completed |
| `memory` / `recipe` / `replay` / `report` / `eval` | The corresponding subsystem acted |
| `warning` / `error` | A non-fatal warning or a failure |

**Invariant:** a `file` event for an applied write must always be preceded by a `preview` event for the same path. Writes are never silent.

## 2. Replay Session (`sessions/<timestamp>.json`)

Saved alongside a receipt (`POST /api/sessions`). JSON that lets the UI restore a full run — prompt, messages, selected files, model, permissions, trail, and pending diffs.

```json
{
  "title": "AgentTrail replay session",
  "model": "llama3.2",
  "trustScore": "88",
  "messages": [{ "role": "user", "content": "…", "events": [] }],
  "selectedFiles": ["README.md"],
  "permissions": { "readFiles": true, "writeFiles": false, "previewWrites": true },
  "trail": [{ "type": "search", "label": "…", "time": "09:41:02" }],
  "pendingPreviews": [
    { "preview": { "path": "README.md", "diff": "…", "stats": { "added": 4, "removed": 1 } } }
  ]
}
```

Loading a session (`GET /api/sessions/content?path=…`) restores `messages`, `selectedFiles`, `permissions`, `model`, `trail`, and `pendingPreviews`, and re-populates the prompt from `replay.prompt` when present.

## 3. Shareable Report (`reports/<name>.md`)

A polished, self-contained Markdown export for sharing (`POST /api/reports`): trust score, model, search provider, selected files, the full trail, memory citations, and every pending/applied diff in fenced `diff` blocks. Built for sending to a teammate who wants to see exactly what happened, without running AgentTrail.

## Design principles

1. **Plain by default.** Markdown and JSON only — no proprietary container, no dependency to read or write a receipt.
2. **Append-only history.** Receipts and sessions are timestamped files; runs are never overwritten.
3. **Writes are provable.** Every disk mutation has a preceding preview event and a diff, so a receipt is sufficient to audit what changed.
4. **Local and portable.** Receipts live in `workspace/receipts/` and contain no secrets beyond what the run touched.

## Versioning

This is **Receipt Spec v1**. Additive fields are backward-compatible; a parser should ignore unknown header fields and unknown event types (treating the latter as opaque log lines).
