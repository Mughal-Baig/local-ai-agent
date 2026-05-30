#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, process.env.WORKSPACE_ROOT || "workspace");
const RECEIPTS_DIR = "receipts/mcp";
const MAX_FILE_BYTES = 160 * 1024;
const APPROVED_TOOLS = new Set(
  String(process.env.AGENTTRAIL_MCP_APPROVALS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);

fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

const tools = [
  {
    name: "list_files",
    description: "List files inside the AgentTrail workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "search_workspace",
    description: "Search workspace files by keyword and return snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        approved: { type: "boolean", description: "Explicit approval flag from the MCP client." }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "read_file",
    description: "Read one workspace-relative file after approval.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        approved: { type: "boolean", description: "Explicit approval flag from the MCP client." }
      },
      required: ["path"],
      additionalProperties: false
    }
  },
  {
    name: "preview_write_file",
    description: "Return a diff preview for a workspace file without writing it.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        approved: { type: "boolean", description: "Explicit approval flag from the MCP client." }
      },
      required: ["path", "content"],
      additionalProperties: false
    }
  },
  {
    name: "write_file",
    description: "Write a workspace file. Requires explicit approval.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        approved: { type: "boolean", description: "Explicit approval flag from the MCP client." }
      },
      required: ["path", "content", "approved"],
      additionalProperties: false
    }
  }
];

let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  readMessages().catch((error) => {
    sendError(null, -32603, error.message);
  });
});

async function readMessages() {
  while (buffer.length) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      throw new Error("Missing Content-Length header");
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + length) {
      return;
    }

    const body = buffer.slice(bodyStart, bodyStart + length).toString("utf8");
    buffer = buffer.slice(bodyStart + length);
    const message = JSON.parse(body);
    await handleMessage(message);
  }
}

async function handleMessage(message) {
  if (message.method && message.method.startsWith("notifications/")) {
    return;
  }

  try {
    if (message.method === "initialize") {
      return sendResult(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "agenttrail-local-mcp", version: "0.7.0" }
      });
    }

    if (message.method === "tools/list") {
      return sendResult(message.id, { tools });
    }

    if (message.method === "tools/call") {
      const name = message.params?.name;
      const args = message.params?.arguments || {};
      const result = await callTool(name, args);
      await saveReceipt(name, args, result);
      return sendResult(message.id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      });
    }

    return sendError(message.id, -32601, `Unknown MCP method: ${message.method}`);
  } catch (error) {
    return sendError(message.id, -32000, error.message);
  }
}

async function callTool(name, args) {
  requireApproval(name, args);

  if (name === "list_files") {
    return { files: await listFiles() };
  }
  if (name === "search_workspace") {
    return { results: await searchWorkspace(String(args.query || ""), Number(args.limit || 8)) };
  }
  if (name === "read_file") {
    return readFile(String(args.path || ""));
  }
  if (name === "preview_write_file") {
    return previewFile(String(args.path || ""), String(args.content || ""));
  }
  if (name === "write_file") {
    const absolutePath = resolveWorkspacePath(args.path);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, String(args.content || ""), "utf8");
    return { ok: true, path: normalizeRelativePath(args.path), size: Buffer.byteLength(String(args.content || ""), "utf8") };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function requireApproval(name, args) {
  const lowRisk = name === "list_files" || name === "search_workspace";
  if (lowRisk && process.env.AGENTTRAIL_MCP_ALLOW_LOW_RISK !== "0") {
    return;
  }
  if (args && args.approved === true) {
    return;
  }
  if (APPROVED_TOOLS.has(name) || APPROVED_TOOLS.has("all")) {
    return;
  }
  throw new Error(`${name} requires explicit MCP approval`);
}

async function listFiles() {
  const files = [];
  async function walk(currentDir, relativeDir) {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".DS_Store") {
        continue;
      }
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        const stat = await fsp.stat(absolutePath);
        files.push({ path: relativePath, size: stat.size, modifiedAt: stat.mtime.toISOString() });
      }
    }
  }
  await walk(WORKSPACE_ROOT, "");
  return files.slice(0, 300);
}

async function searchWorkspace(query, limit) {
  const terms = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((term) => term.length >= 2)
    .slice(0, 8);
  const results = [];
  for (const file of await listFiles()) {
    if (file.size > MAX_FILE_BYTES) {
      continue;
    }
    let content = "";
    try {
      content = await fsp.readFile(resolveWorkspacePath(file.path), "utf8");
    } catch {
      continue;
    }
    const haystack = `${file.path}\n${content}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (score) {
      results.push({ ...file, score, snippet: createSnippet(content, terms) });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, Math.min(Math.max(limit || 8, 1), 20));
}

async function readFile(relativePath) {
  const absolutePath = resolveWorkspacePath(relativePath);
  const stat = await fsp.stat(absolutePath);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
    throw new Error("File is missing, not a file, or too large");
  }
  return {
    path: normalizeRelativePath(relativePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    content: await fsp.readFile(absolutePath, "utf8")
  };
}

async function previewFile(relativePath, content) {
  const normalized = normalizeRelativePath(relativePath);
  let before = "";
  let exists = false;
  try {
    before = (await readFile(normalized)).content;
    exists = true;
  } catch {
    before = "";
  }
  const diff = createUnifiedDiff(normalized, before, content);
  return { path: normalized, exists, preview: true, proposedContent: content, diff };
}

async function saveReceipt(tool, args, result) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const content = [
    "# AgentTrail MCP Receipt",
    "",
    `Tool: ${tool}`,
    `Time: ${new Date().toISOString()}`,
    "",
    "## Arguments",
    "",
    "```json",
    JSON.stringify(redactApproval(args), null, 2),
    "```",
    "",
    "## Result",
    "",
    "```json",
    JSON.stringify(result, null, 2).slice(0, 6000),
    "```"
  ].join("\n");
  const target = resolveWorkspacePath(`${RECEIPTS_DIR}/${tool}-${stamp}.md`);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, content, "utf8");
}

function resolveWorkspacePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(WORKSPACE_ROOT, normalized);
  if (absolutePath !== WORKSPACE_ROOT && !absolutePath.startsWith(`${WORKSPACE_ROOT}${path.sep}`)) {
    throw new Error("Path escapes the workspace");
  }
  return absolutePath;
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function createSnippet(content, terms) {
  const lines = String(content || "").split(/\r?\n/);
  const fallback = lines.find((line) => line.trim()) || "";
  const found = lines.find((line) => terms.some((term) => line.toLowerCase().includes(term)));
  return (found || fallback).trim().slice(0, 220);
}

function createUnifiedDiff(filePath, before, after) {
  const beforeLines = String(before || "").split(/\r?\n/);
  const afterLines = String(after || "").split(/\r?\n/);
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    ...beforeLines.slice(0, 80).map((line) => `-${line}`),
    ...afterLines.slice(0, 80).map((line) => `+${line}`)
  ].join("\n");
}

function redactApproval(args) {
  return { ...args, approved: args?.approved === true };
}

function sendResult(id, result) {
  sendMessage({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  sendMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function sendMessage(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}
