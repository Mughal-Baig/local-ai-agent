# AgentTrail Plugins

Plugins are small local manifests that declare tools, permissions, approvals, and receipt behavior without editing AgentTrail core. The full SDK guide is in `docs/PLUGIN_SDK.md`.

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

The `/api/plugins` endpoint lists installed manifests. `GET /api/plugins/status` shows hot-reload state, and `POST /api/plugins/reload` forces a manifest reload during development. Tool execution should go through the permission engine and leave receipts before becoming active.

Runtime guardrails:

- `schema` must be `agenttrail.plugin.v1`.
- Every tool must have a matching permission.
- Tool and permission `risk` must be `low`, `medium`, or `high`.
- Permission risk cannot be lower than tool risk.
- Tool and permission `receipt` must be `true`.
- `medium` and `high` tools require explicit approval in `/api/plugins/run`.
- Inline VM example code is capped and cannot use `require`, `process`, filesystem, network, dynamic eval, or shell APIs.

## Examples

- `plugins/example-tool`: minimum low-risk echo manifest.
- `plugins/receipt-reporter`: read one selected receipt and summarize actions/files/trust signals.
- `plugins/read-only-url`: medium-risk read-only network example that must use AgentTrail's allowlist policy.
- `plugins/web-fetch`: runnable allowlisted GET example with approval, dry-run checks, timeout, and manual redirect guardrails.
- `plugins/calculator`: pure local arithmetic example with a parser instead of eval.
- `plugins/shell-guarded`: high-risk preview-only shell example; it never executes commands.

Run `npm run test:plugins` and `npm run test:community` after adding a plugin manifest.
