# Plugin SDK

AgentTrail plugins are local manifests that describe tools, permissions, approval rules, and receipt behavior. The SDK is intentionally small so contributors can add integrations without editing core files first, while AgentTrail can still fail closed when a manifest is ambiguous.

Current SDK contract: `agenttrail.plugin.v1`, loader SDK `0.2.0`.

## Development Hot Reload

The plugin catalog hot-reloads from manifest fingerprints. During development, edit any `plugins/<plugin-id>/plugin.json` file and call `/api/plugins` or `/api/plugins/status`; AgentTrail reloads the changed manifest without a server restart.

Useful endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/plugins` | Returns sanitized public manifests plus hot-reload metadata. |
| `GET /api/plugins/status` | Shows plugin count, invalid manifest count, watched paths, and reload count. |
| `POST /api/plugins/reload` | Forces a catalog reload and records a local receipt/log event. |

## Plugin Shape

Each plugin lives under `plugins/<plugin-id>/plugin.json`.

```json
{
  "schema": "agenttrail.plugin.v1",
  "id": "receipt-reporter",
  "title": "Receipt Reporter",
  "version": "0.1.0",
  "tools": [
    {
      "name": "receipt.summary",
      "description": "Summarize an AgentTrail receipt.",
      "risk": "low",
      "receipt": true,
      "code": "return input.receiptText.slice(0, 400);",
      "execution": {
        "runtime": "vm",
        "timeoutMs": 100
      }
    }
  ],
  "permissions": [
    {
      "tool": "receipt.summary",
      "scope": "Read one selected receipt and return a summary.",
      "risk": "low",
      "receipt": true,
      "requiresApproval": false
    }
  ]
}
```

### Required Fields

| Field | Rule |
| --- | --- |
| `schema` | Must be exactly `agenttrail.plugin.v1`. |
| `id` | Lowercase slug, letters/numbers/hyphens only. |
| `title` | Human-readable name. |
| `version` | Semver-like string such as `0.1.0`. |
| `tools[]` | At least one tool, at most 25. |
| `permissions[]` | At least one matching permission. |

### Tool Fields

| Field | Rule |
| --- | --- |
| `name` | Dotted tool name such as `receipt.summary`. |
| `description` | Human-readable purpose. |
| `risk` | `low`, `medium`, or `high`. |
| `receipt` | Must be `true`; plugin tools must leave receipts. |
| `code` | Optional inline VM code for small examples only. |
| `execution.runtime` | Required as `vm` when `code` is present. |

## Permission Contract

- Every tool needs a human-readable scope.
- Every tool must have a matching permission where `permission.tool === tool.name`.
- Risk must be explicit: `low`, `medium`, or `high`.
- Permission risk may be higher than tool risk, but not lower.
- File-writing tools must require review and leave receipts.
- Network tools must declare allowed host behavior.
- Shell tools should use preview-only mode unless a future trusted executor is explicitly added.
- Plugins should fail closed when permissions are missing.
- `medium` and `high` tools require explicit approval at `/api/plugins/run`.
- Inline VM code cannot reference `require`, `process`, `fs`, `child_process`, `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, or `Function`.

`/api/plugins` returns sanitized plugin manifests. Inline `code` is removed from the public catalog response.

`/api/plugins/run` accepts:

```json
{
  "pluginId": "example-tool",
  "tool": "example.echo",
  "approved": true,
  "input": {
    "text": "hello"
  }
}
```

`approved` is only required for `medium` and `high` tools. Low-risk tools can run without it.

## Example Plugins

| Plugin | Purpose | Risk |
| --- | --- | --- |
| `plugins/example-tool` | Minimal echo manifest | low |
| `plugins/receipt-reporter` | Receipt summary example | low |
| `plugins/read-only-url` | Read-only URL fetch example with allowlist expectation | medium |
| `plugins/web-fetch` | Runnable read-only fetch example with allowlist, manual redirects, timeout, approval, and dry-run policy checks | medium |
| `plugins/calculator` | Pure local arithmetic parser with no eval/network/filesystem | low |
| `plugins/shell-guarded` | Preview-only high-risk shell pattern that never executes plugin commands | high |

## Contributor Checklist

- Add a manifest under `plugins/`.
- Use `agenttrail.plugin.v1`.
- Include at least one permission with scope and receipt behavior.
- Keep tool names unique and dotted.
- Use `requiresApproval: true` for any network, shell, write, delete, export, or external-system action.
- Add docs if the tool has user-visible setup.
- Run `npm run test:plugins` and `npm run test:community`.
