"use strict";

const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const path = require("node:path");

const MCP_CLIENT_SCHEMA = "agenttrail.mcp-clients.v1";
const DEFAULT_TIMEOUT_MS = 5000;

async function readMcpClientConfig(configPath, env = process.env) {
  const configuredPath = env.AGENTTRAIL_MCP_CLIENT_CONFIG || configPath;
  if (!configuredPath) {
    return emptyConfig();
  }
  try {
    const raw = await fsp.readFile(configuredPath, "utf8");
    return normalizeMcpClientConfig(JSON.parse(raw));
  } catch {
    return emptyConfig();
  }
}

function normalizeMcpClientConfig(value) {
  const servers = Array.isArray(value?.servers) ? value.servers : [];
  return {
    schema: MCP_CLIENT_SCHEMA,
    servers: servers
      .map(normalizeServer)
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id))
  };
}

function emptyConfig() {
  return { schema: MCP_CLIENT_SCHEMA, servers: [] };
}

function normalizeServer(server) {
  if (!server || typeof server !== "object" || Array.isArray(server)) {
    return null;
  }
  const id = safeId(server.id || server.name);
  const command = String(server.command || "").trim();
  if (!id || !command) {
    return null;
  }
  return {
    id,
    title: String(server.title || server.name || id).trim().slice(0, 80),
    transport: "stdio",
    command,
    args: Array.isArray(server.args) ? server.args.map(String).slice(0, 24) : [],
    cwd: server.cwd ? String(server.cwd) : "",
    env: sanitizeEnv(server.env),
    enabled: server.enabled !== false,
    requiresApproval: server.requiresApproval !== false,
    timeoutMs: clamp(Number(server.timeoutMs || DEFAULT_TIMEOUT_MS), 500, 20000)
  };
}

function publicMcpClientStatus(config) {
  return {
    schema: MCP_CLIENT_SCHEMA,
    servers: (config.servers || []).map((server) => ({
      id: server.id,
      title: server.title,
      transport: server.transport,
      command: path.basename(server.command),
      args: server.args,
      enabled: server.enabled,
      requiresApproval: server.requiresApproval,
      timeoutMs: server.timeoutMs
    }))
  };
}

async function listMcpClientTools(config, options = {}) {
  const server = selectServer(config, options.serverId);
  const result = await callMcpServer(server, "tools/list", {}, options);
  return {
    server: publicServer(server),
    tools: Array.isArray(result.tools) ? result.tools : []
  };
}

async function callMcpClientTool(config, body = {}, options = {}) {
  const server = selectServer(config, body.serverId);
  if (server.requiresApproval && body.approved !== true) {
    throw statusError(403, `${server.id} requires explicit MCP client approval.`);
  }
  const toolName = String(body.tool || body.name || "").trim();
  if (!toolName) {
    throw statusError(400, "MCP client tool name is required.");
  }
  const result = await callMcpServer(server, "tools/call", {
    name: toolName,
    arguments: body.arguments || body.input || {}
  }, options);
  return {
    ok: true,
    server: publicServer(server),
    tool: toolName,
    result
  };
}

async function callMcpServer(server, method, params, options = {}) {
  if (!server || server.enabled === false) {
    throw statusError(404, "MCP client server is disabled or missing.");
  }
  const timeoutMs = clamp(Number(options.timeoutMs || server.timeoutMs || DEFAULT_TIMEOUT_MS), 500, 20000);
  const child = spawn(server.command, server.args, {
    cwd: server.cwd || process.cwd(),
    env: { ...process.env, ...server.env },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const rpc = createRpcClient(child, timeoutMs);
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  try {
    await rpc.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "agenttrail-mcp-client", version: "0.1.0" }
    });
    rpc.notify("notifications/initialized", {});
    return await rpc.call(method, params || {});
  } catch (error) {
    const message = stderr.trim() ? `${error.message}: ${stderr.trim().slice(0, 400)}` : error.message;
    throw statusError(error.status || 502, message);
  } finally {
    child.kill("SIGTERM");
  }
}

function createRpcClient(child, timeoutMs) {
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
      if (message.error) waiter.reject(statusError(502, message.error.message || "MCP server error."));
      else waiter.resolve(message.result || {});
    }
  });

  child.on("error", (error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });

  return {
    call(method, params) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(statusError(504, `MCP client call timed out: ${method}`));
        }, timeoutMs);
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
        sendFramed(child, { jsonrpc: "2.0", id, method, params });
      });
    },
    notify(method, params) {
      sendFramed(child, { jsonrpc: "2.0", method, params });
    }
  };
}

function sendFramed(child, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
  child.stdin.write(body);
}

function selectServer(config, serverId) {
  const id = safeId(serverId || (config.servers || [])[0]?.id);
  const server = (config.servers || []).find((item) => item.id === id);
  if (!server) {
    throw statusError(404, id ? `MCP client server not found: ${id}` : "No MCP client servers are configured.");
  }
  return server;
}

function publicServer(server) {
  return {
    id: server.id,
    title: server.title,
    transport: server.transport
  };
}

function sanitizeEnv(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 24)) {
    if (/^[A-Z0-9_]{1,80}$/.test(key)) {
      out[key] = String(item).slice(0, 500);
    }
  }
  return out;
}

function safeId(value) {
  const id = String(value || "").trim().toLowerCase();
  return /^[a-z][a-z0-9-]{1,63}$/.test(id) ? id : "";
}

function clamp(value, min, max) {
  const n = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, n));
}

function statusError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  MCP_CLIENT_SCHEMA,
  callMcpClientTool,
  callMcpServer,
  listMcpClientTools,
  normalizeMcpClientConfig,
  publicMcpClientStatus,
  readMcpClientConfig
};
