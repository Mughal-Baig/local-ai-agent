#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-mcp-"));
  await fsp.writeFile(path.join(workspaceRoot, "notes.md"), "MCP workspace receipt proof\n", "utf8");

  const child = spawn(process.execPath, ["mcp/server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MCP_ALLOW_LOW_RISK: "1"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const rpc = createRpcClient(child);

  try {
    const init = await rpc.call("initialize", {});
    assert.equal(init.serverInfo.name, "agenttrail-local-mcp");

    const listed = await rpc.call("tools/list", {});
    const toolNames = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, ["list_files", "preview_write_file", "read_file", "search_workspace", "write_file"]);

    const search = await rpc.call("tools/call", {
      name: "search_workspace",
      arguments: { query: "receipt", limit: 5 }
    });
    assert.match(search.content[0].text, /notes\.md/);

    const preview = await rpc.call("tools/call", {
      name: "preview_write_file",
      arguments: { path: "draft.md", content: "approved preview\n", approved: true }
    });
    assert.match(preview.content[0].text, /"preview": true/);

    const write = await rpc.call("tools/call", {
      name: "write_file",
      arguments: { path: "draft.md", content: "approved write\n", approved: true }
    });
    assert.match(write.content[0].text, /"ok": true/);
    assert.equal(await fsp.readFile(path.join(workspaceRoot, "draft.md"), "utf8"), "approved write\n");

    const receipts = await fsp.readdir(path.join(workspaceRoot, "receipts", "mcp"));
    assert.equal(receipts.some((name) => name.startsWith("write_file-")), true);

    console.log("MCP server integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function createRpcClient(child) {
  let nextId = 1;
  let buffer = Buffer.alloc(0);
  const pending = new Map();

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
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
      const message = JSON.parse(body);
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(message.error.message || "MCP error"));
      } else {
        waiter.resolve(message.result);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return {
    call(method, params) {
      const id = nextId++;
      const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      const framed = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`MCP call timed out: ${method}`));
        }, 3000);
        pending.set(id, {
          resolve(value) {
            clearTimeout(timer);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timer);
            reject(error);
          }
        });
        child.stdin.write(framed);
      });
    }
  };
}
