# AgentTrail Plugins

Plugins are small local manifests that declare tools, permissions, and receipt behavior without editing AgentTrail core.

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
