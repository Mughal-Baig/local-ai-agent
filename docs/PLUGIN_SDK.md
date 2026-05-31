# Plugin SDK

AgentTrail plugins are local manifests that describe tools, permissions, and receipt behavior. The SDK is intentionally small so contributors can add integrations without editing core files first.

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
      "receipt": true
    }
  ],
  "permissions": [
    {
      "tool": "receipt.summary",
      "scope": "Read one selected receipt and return a summary.",
      "risk": "low",
      "receipt": true
    }
  ]
}
```

## Permission Contract

- Every tool needs a human-readable scope.
- Risk must be explicit: `low`, `medium`, or `high`.
- File-writing tools must require review and leave receipts.
- Network tools must declare allowed host behavior.
- Plugins should fail closed when permissions are missing.

## Example Plugins

| Plugin | Purpose | Risk |
| --- | --- | --- |
| `plugins/example-tool` | Minimal echo manifest | low |
| `plugins/receipt-reporter` | Receipt summary example | low |
| `plugins/read-only-url` | Read-only URL fetch example with allowlist expectation | medium |

## Contributor Checklist

- Add a manifest under `plugins/`.
- Use `agenttrail.plugin.v1`.
- Include at least one permission with scope and receipt behavior.
- Add docs if the tool has user-visible setup.
- Run `npm run test:community`.
