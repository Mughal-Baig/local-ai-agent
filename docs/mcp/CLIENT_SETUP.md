# MCP Client Setup

AgentTrail ships a stdio MCP server:

```bash
npm run mcp
```

## Claude Desktop

Add a server entry similar to:

```json
{
  "mcpServers": {
    "agenttrail": {
      "command": "node",
      "args": ["/absolute/path/to/local-ai-agent/mcp/server.js"],
      "env": {
        "WORKSPACE_ROOT": "/absolute/path/to/local-ai-agent/workspace"
      }
    }
  }
}
```

## Cursor / Windsurf / Other MCP Clients

Use stdio transport:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/local-ai-agent/mcp/server.js"]
}
```

High-risk tools require explicit approval. MCP receipts are written under `workspace/receipts/mcp/`.

## AgentTrail As An MCP Client

AgentTrail can consume external stdio MCP servers from `mcp/clients.json`.

```json
{
  "schema": "agenttrail.mcp-clients.v1",
  "servers": [
    {
      "id": "example",
      "title": "Example local MCP server",
      "command": "node",
      "args": ["/absolute/path/to/server.js"],
      "enabled": true,
      "requiresApproval": true,
      "timeoutMs": 5000
    }
  ]
}
```

APIs:

- `GET /api/mcp/client/status`
- `GET /api/mcp/client/tools?serverId=example&live=true`
- `POST /api/mcp/client/call`

Tool calls require `approved:true` when `requiresApproval` is enabled and write receipts under `receipts/mcp-client/`.
