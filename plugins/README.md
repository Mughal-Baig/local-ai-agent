# AgentTrail Plugins

Plugins are small local manifests that declare tools, permissions, and receipt behavior without editing AgentTrail core. The full SDK guide is in `docs/PLUGIN_SDK.md`.

Each plugin lives in `plugins/<plugin-id>/plugin.json`.

Minimum shape:

```json
{
  "schema": "agenttrail.plugin.v1",
  "id": "example-tool",
  "title": "Example Tool",
  "version": "0.1.0",
  "tools": [
    {
      "name": "example.echo",
      "description": "Echo approved input for testing.",
      "risk": "low",
      "receipt": true
    }
  ],
  "permissions": [
    {
      "tool": "example.echo",
      "scope": "Read one provided string and return it.",
      "risk": "low",
      "receipt": true
    }
  ]
}
```

The `/api/plugins` endpoint lists installed manifests. Tool execution should go through the permission engine and leave receipts before becoming active.

## Examples

- `plugins/example-tool`: minimum low-risk echo manifest.
- `plugins/receipt-reporter`: read one selected receipt and summarize actions/files/trust signals.
- `plugins/read-only-url`: medium-risk read-only network example that must use AgentTrail's allowlist policy.

Run `npm run test:community` after adding a plugin manifest.
