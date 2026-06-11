#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const {
  callMcpClientTool,
  listMcpClientTools,
  normalizeMcpClientConfig,
  publicMcpClientStatus
} = require("../../src/mcp-client");

const projectRoot = path.resolve(__dirname, "..", "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const config = normalizeMcpClientConfig({
    servers: [{
      id: "mock-external",
      title: "Mock external MCP",
      command: process.execPath,
      args: ["tests/fixtures/mock-external-mcp.js"],
      cwd: projectRoot,
      requiresApproval: true,
      timeoutMs: 5000
    }]
  });

  const status = publicMcpClientStatus(config);
  assert.equal(status.servers[0].id, "mock-external");
  assert.equal(status.servers[0].command, path.basename(process.execPath));
  assert.equal(status.servers[0].requiresApproval, true);

  const tools = await listMcpClientTools(config, { serverId: "mock-external" });
  assert.equal(tools.server.id, "mock-external");
  assert.equal(tools.tools[0].name, "mock.echo");

  await assert.rejects(
    () => callMcpClientTool(config, { serverId: "mock-external", tool: "mock.echo", arguments: { text: "blocked" } }),
    /requires explicit MCP client approval/
  );

  const result = await callMcpClientTool(config, {
    serverId: "mock-external",
    tool: "mock.echo",
    arguments: { text: "approved" },
    approved: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.content[0].text, "echo:approved");

  console.log("MCP client test passed");
}
