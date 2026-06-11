#!/usr/bin/env node
"use strict";

let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  readMessages();
});

function readMessages() {
  while (buffer.length) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) return;
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + length) return;
    const body = buffer.slice(bodyStart, bodyStart + length).toString("utf8");
    buffer = buffer.slice(bodyStart + length);
    handle(JSON.parse(body));
  }
}

function handle(message) {
  if (!message.id) return;
  if (message.method === "initialize") {
    return send(message.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "mock-external-mcp", version: "0.1.0" }
    });
  }
  if (message.method === "tools/list") {
    return send(message.id, {
      tools: [{
        name: "mock.echo",
        description: "Echo a value for AgentTrail MCP client tests.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          additionalProperties: false
        }
      }]
    });
  }
  if (message.method === "tools/call") {
    return send(message.id, {
      content: [{ type: "text", text: `echo:${message.params?.arguments?.text || ""}` }]
    });
  }
  send(message.id, {});
}

function send(id, result) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result }), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}
