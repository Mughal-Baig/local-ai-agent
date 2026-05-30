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
