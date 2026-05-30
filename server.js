#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

loadDotEnv();

const PORT = Number(process.env.PORT || 4173);
const OLLAMA_HOST = trimTrailingSlash(process.env.OLLAMA_HOST || "http://127.0.0.1:11434");
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const MAX_TOOL_ITERATIONS = Number(process.env.MAX_TOOL_ITERATIONS || 4);
const PROJECT_ROOT = __dirname;
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");
const RECIPES_DIR = path.join(PROJECT_ROOT, "recipes");
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, process.env.WORKSPACE_ROOT || "workspace");
const RECEIPTS_DIR = "receipts";
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_FILE_BYTES = 80 * 1024;
const MAX_PROMPT_FILE_BYTES = 28 * 1024;
const MAX_SEARCH_FILE_BYTES = 160 * 1024;

fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

    if (url.pathname === "/api/status" && req.method === "GET") {
      return handleStatus(res);
    }

    if (url.pathname === "/api/files" && req.method === "GET") {
      return handleListFiles(res);
    }

    if (url.pathname === "/api/recipes" && req.method === "GET") {
      return handleListRecipes(res);
    }

    if (url.pathname === "/api/receipts" && req.method === "GET") {
      return handleListReceipts(res);
    }

    if (url.pathname === "/api/receipts" && req.method === "POST") {
      return handleSaveReceipt(req, res);
    }

    if (url.pathname === "/api/search" && req.method === "GET") {
      return handleSearch(url, res);
    }

    if (url.pathname === "/api/files/content" && req.method === "GET") {
      return handleReadFile(url, res);
    }

    if (url.pathname === "/api/files/content" && req.method === "POST") {
      return handleWriteFile(req, res);
    }

    if (url.pathname === "/api/files/preview" && req.method === "POST") {
      return handlePreviewFile(req, res);
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      return handleChat(req, res);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      if (url.pathname.startsWith("/docs/")) {
        return serveStaticFrom(DOCS_DIR, url.pathname.replace(/^\/docs\/?/, ""), req, res);
      }
      return serveStatic(url.pathname, req, res);
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: error.message || "Internal server error" });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AgentTrail running at http://127.0.0.1:${PORT}`);
  console.log(`Workspace root: ${WORKSPACE_ROOT}`);
});

async function handleStatus(res) {
  const models = await fetchOllamaModels();
  sendJson(res, 200, {
    app: "ok",
    ollama: {
      available: models.available,
      host: OLLAMA_HOST,
      models: models.models,
      error: models.error || null
    },
    defaults: {
      model: DEFAULT_MODEL,
      workspaceRoot: WORKSPACE_ROOT
    }
  });
}

async function handleListFiles(res) {
  const files = await listWorkspaceFiles();
  sendJson(res, 200, { workspaceRoot: WORKSPACE_ROOT, files });
}

async function handleListRecipes(res) {
  const recipes = await listRecipes();
  sendJson(res, 200, { recipes });
}

async function handleListReceipts(res) {
  const files = await listWorkspaceFiles();
  sendJson(res, 200, {
    receipts: files.filter((file) => file.path.startsWith(`${RECEIPTS_DIR}/`))
  });
}

async function handleSaveReceipt(req, res) {
  const body = await readJsonBody(req);
  const content = String(body.content || "").trim();
  if (!content) {
    return sendJson(res, 400, { error: "Receipt content is required" });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const result = await writeWorkspaceFile(`${RECEIPTS_DIR}/trail-${stamp}.md`, content);
  sendJson(res, 200, result);
}

async function handleSearch(url, res) {
  const query = url.searchParams.get("query") || "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 8), 1), 20);
  const results = await searchWorkspace(query, limit);
  sendJson(res, 200, { query, results });
}

async function handleReadFile(url, res) {
  const relativePath = url.searchParams.get("path") || "";
  const file = await readWorkspaceFile(relativePath, MAX_FILE_BYTES);
  sendJson(res, 200, file);
}

async function handleWriteFile(req, res) {
  const body = await readJsonBody(req);
  const relativePath = String(body.path || "").trim();
  const content = typeof body.content === "string" ? body.content : "";
  if (!relativePath) {
    return sendJson(res, 400, { error: "Missing file path" });
  }

  const result = await writeWorkspaceFile(relativePath, content);
  sendJson(res, 200, result);
}

async function handlePreviewFile(req, res) {
  const body = await readJsonBody(req);
  const relativePath = String(body.path || "").trim();
  const content = typeof body.content === "string" ? body.content : "";
  if (!relativePath) {
    return sendJson(res, 400, { error: "Missing file path" });
  }

  const result = await previewWorkspaceFile(relativePath, content);
  sendJson(res, 200, result);
}

async function handleChat(req, res) {
  const body = await readJsonBody(req);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  try {
    await runAgent(body, res);
  } catch (error) {
    sendEvent(res, "error", { message: error.message || "The agent stopped unexpectedly." });
  } finally {
    res.end();
  }
}

async function runAgent(body, res) {
  const messages = normalizeMessages(body.messages);
  const selectedFiles = Array.isArray(body.selectedFiles) ? body.selectedFiles.slice(0, 8) : [];
  const permissions = normalizePermissions(body.permissions);
  const status = await fetchOllamaModels();

  if (!status.available) {
    sendEvent(res, "error", {
      message: `Ollama is not reachable at ${OLLAMA_HOST}. Install Ollama, start it, and pull a model such as ${DEFAULT_MODEL}.`
    });
    return;
  }

  const requestedModel = String(body.model || "").trim();
  const model = requestedModel || status.models[0]?.name || DEFAULT_MODEL;
  const toolHistory = [];

  sendEvent(res, "status", { message: `Using ${model}` });

  for (let step = 0; step < MAX_TOOL_ITERATIONS; step += 1) {
    sendEvent(res, "status", {
      message: step === 0 ? "Thinking with local context" : "Reviewing tool result"
    });

    const prompt = await buildAgentPrompt(messages, selectedFiles, toolHistory, permissions);
    const output = await generateWithOllama(model, prompt, {
      temperature: typeof body.temperature === "number" ? body.temperature : 0.2
    });

    const toolCall = extractToolCall(output);
    if (toolCall) {
      const result = await executeToolCall(toolCall, permissions);
      toolHistory.push({ call: toolCall, result });
      sendEvent(res, "tool", {
        name: toolCall.tool,
        arguments: toolCall.arguments || {},
        result: summarizeToolResult(result)
      });
      continue;
    }

    const finalOutput = cleanAssistantOutput(output);
    await streamText(res, finalOutput || "I did not get a usable response from the model.");
    sendEvent(res, "done", { ok: true });
    return;
  }

  const fallback = [
    "I reached the tool step limit before producing a final answer.",
    "Here is the latest tool context I gathered:",
    truncate(JSON.stringify(toolHistory, null, 2), 1600)
  ].join("\n\n");
  await streamText(res, fallback);
  sendEvent(res, "done", { ok: true });
}

async function buildAgentPrompt(messages, selectedFiles, toolHistory, permissions) {
  const selectedFileBlocks = [];

  for (const filePath of selectedFiles) {
    try {
      const file = await readWorkspaceFile(filePath, MAX_PROMPT_FILE_BYTES);
      selectedFileBlocks.push(`--- ${file.path} ---\n${file.content}`);
    } catch (error) {
      selectedFileBlocks.push(`--- ${filePath} ---\nCould not read file: ${error.message}`);
    }
  }

  const transcript = messages
    .slice(-14)
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n\n");

  const toolNotes = toolHistory.length
    ? toolHistory
        .map((entry, index) => {
          return [
            `Tool step ${index + 1}`,
            `Call: ${JSON.stringify(entry.call)}`,
            `Result: ${truncate(JSON.stringify(entry.result), 12000)}`
          ].join("\n");
        })
        .join("\n\n")
    : "No tools have been used yet.";

  return [
    "You are AgentTrail, a private AI assistant running on the user's computer.",
    "You are inspired by modern assistants, but you are not Claude, ChatGPT, or Gemini.",
    "You help with coding, writing, planning, and workspace files.",
    "",
    "You may use tools by replying with exactly one JSON object and no extra text.",
    "Tool call format:",
    "{\"tool\":\"list_files\",\"arguments\":{}}",
    "{\"tool\":\"search_workspace\",\"arguments\":{\"query\":\"search terms\",\"limit\":5}}",
    "{\"tool\":\"read_file\",\"arguments\":{\"path\":\"relative/path.txt\"}}",
    "{\"tool\":\"preview_write_file\",\"arguments\":{\"path\":\"relative/path.txt\",\"content\":\"complete file content\"}}",
    "{\"tool\":\"write_file\",\"arguments\":{\"path\":\"relative/path.txt\",\"content\":\"complete file content\"}}",
    "",
    "Tool rules:",
    "- Use paths relative to the workspace.",
    "- Use search_workspace when you need the most relevant local files before asking the user to pick context.",
    "- Read a file before changing it when existing content matters.",
    `- read_file permission is ${permissions.readFiles ? "enabled" : "disabled"}.`,
    `- write_file permission is ${permissions.writeFiles ? "enabled" : "disabled"}.`,
    `- write preview mode is ${permissions.previewWrites ? "enabled" : "disabled"}.`,
    "- Use preview_write_file before changing existing files.",
    "- Use write_file only when write permission is enabled and the user asks you to create or update a file.",
    "- When write preview mode is enabled, write_file returns a diff preview instead of changing the file.",
    "- Do not call read_file for a selected file when its content already appears in selected file context.",
    "- If no tool is needed, answer normally in helpful Markdown.",
    "- Never claim you used a tool unless the tool result appears below.",
    "",
    `Workspace root is sandboxed by the server. Current date: ${new Date().toISOString().slice(0, 10)}.`,
    "",
    "Selected file context:",
    selectedFileBlocks.length ? selectedFileBlocks.join("\n\n") : "No files selected.",
    "",
    "Tool history:",
    toolNotes,
    "",
    "Conversation:",
    transcript || "No conversation yet.",
    "",
    "Next response:"
  ].join("\n");
}

async function executeToolCall(toolCall, permissions) {
  const args = toolCall.arguments || {};

  if (toolCall.tool === "list_files") {
    return { files: await listWorkspaceFiles() };
  }

  if (toolCall.tool === "search_workspace") {
    return { results: await searchWorkspace(String(args.query || ""), Number(args.limit || 5)) };
  }

  if (toolCall.tool === "read_file") {
    if (!permissions.readFiles) {
      return { error: "read_file permission is disabled" };
    }
    return readWorkspaceFile(String(args.path || ""), MAX_FILE_BYTES);
  }

  if (toolCall.tool === "preview_write_file") {
    return previewWorkspaceFile(String(args.path || ""), String(args.content || ""));
  }

  if (toolCall.tool === "write_file") {
    if (!permissions.writeFiles) {
      return { error: "write_file permission is disabled" };
    }
    if (permissions.previewWrites) {
      return previewWorkspaceFile(String(args.path || ""), String(args.content || ""), {
        blockedWrite: true
      });
    }
    return writeWorkspaceFile(String(args.path || ""), String(args.content || ""));
  }

  return { error: `Unknown tool: ${toolCall.tool}` };
}

function extractToolCall(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed.tool === "string") {
        return {
          tool: parsed.tool,
          arguments: parsed.arguments && typeof parsed.arguments === "object" ? parsed.arguments : {}
        };
      }
    } catch {
      // Keep trying candidates.
    }
  }

  return null;
}

function cleanAssistantOutput(text) {
  let value = String(text || "").trim();
  value = value.replace(/^["“]([\s\S]*)["”]$/g, "$1").trim();
  value = value.replace(/^(Assistant|AgentTrail|Local Agent|AI):\s*/i, "").trim();
  return value;
}

function normalizePermissions(value) {
  const permissions = value && typeof value === "object" ? value : {};
  return {
    readFiles: permissions.readFiles !== false,
    writeFiles: permissions.writeFiles === true,
    previewWrites: permissions.previewWrites !== false
  };
}

async function generateWithOllama(model, prompt, options) {
  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature,
        num_ctx: 8192
      }
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Ollama returned ${response.status}. ${details}`.trim());
  }

  const data = await response.json();
  return String(data.response || "");
}

async function fetchOllamaModels() {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const models = Array.isArray(data.models)
      ? data.models.map((model) => ({
          name: model.name,
          size: model.size || 0,
          modifiedAt: model.modified_at || null
        }))
      : [];
    return { available: true, models };
  } catch (error) {
    return { available: false, models: [], error: error.message };
  }
}

async function listWorkspaceFiles() {
  const files = [];

  async function walk(currentDir, relativeDir) {
    if (files.length >= 300) {
      return;
    }

    const entries = await fsp.readdir(currentDir, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.name === ".DS_Store") {
        continue;
      }

      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        const stat = await fsp.stat(absolutePath);
        files.push({
          path: relativePath,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString()
        });
      }
    }
  }

  await walk(WORKSPACE_ROOT, "");
  return files;
}

async function searchWorkspace(query, limit) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const terms = normalizedQuery
    .split(/[^a-z0-9_.-]+/i)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2)
    .slice(0, 8);
  const files = await listWorkspaceFiles();
  const candidates = [];

  for (const file of files) {
    if (file.size > MAX_SEARCH_FILE_BYTES) {
      continue;
    }

    let content = "";
    try {
      content = await fsp.readFile(resolveWorkspacePath(file.path), "utf8");
    } catch {
      continue;
    }

    if (content.includes("\u0000")) {
      continue;
    }

    const haystack = `${file.path}\n${content}`.toLowerCase();
    let score = 0;

    if (!terms.length) {
      score = Date.parse(file.modifiedAt) || 0;
    } else {
      for (const term of terms) {
        if (file.path.toLowerCase().includes(term)) {
          score += 8;
        }
        score += countOccurrences(haystack, term);
      }
    }

    if (score > 0 || !terms.length) {
      candidates.push({
        path: file.path,
        size: file.size,
        modifiedAt: file.modifiedAt,
        score,
        snippet: createSnippet(content, terms)
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.modifiedAt.localeCompare(a.modifiedAt);
  });

  return candidates.slice(0, Math.min(Math.max(Number(limit) || 8, 1), 20));
}

async function listRecipes() {
  const entries = await fsp.readdir(RECIPES_DIR, { withFileTypes: true }).catch(() => []);
  const recipes = [];
  const seenIds = new Set();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const absolutePath = path.join(RECIPES_DIR, entry.name);
    try {
      const raw = await fsp.readFile(absolutePath, "utf8");
      const recipe = normalizeRecipe(JSON.parse(raw), entry.name);
      if (recipe && !seenIds.has(recipe.id)) {
        seenIds.add(recipe.id);
        recipes.push(recipe);
      }
    } catch {
      // Invalid community recipe files are ignored instead of breaking startup.
    }
  }

  recipes.sort((a, b) => a.title.localeCompare(b.title));
  return recipes;
}

function normalizeRecipe(recipe, fileName) {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  const id = String(recipe.id || fileName.replace(/\.json$/, "")).trim();
  const title = String(recipe.title || "").trim();
  const description = String(recipe.description || "").trim();
  const prompt = String(recipe.prompt || "").trim();

  if (!id || !/^[a-z0-9-]+$/.test(id) || !title || !prompt) {
    return null;
  }

  return {
    id,
    title: truncate(title, 80),
    description: truncate(description, 180),
    prompt: truncate(prompt, 2400),
    tags: Array.isArray(recipe.tags) ? recipe.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8) : []
  };
}

async function readWorkspaceFile(relativePath, maxBytes) {
  const absolutePath = resolveWorkspacePath(relativePath);
  const stat = await fsp.stat(absolutePath);
  if (!stat.isFile()) {
    throw new Error("Path is not a file");
  }
  if (stat.size > maxBytes) {
    throw new Error(`File is too large to read here (${stat.size} bytes)`);
  }

  return {
    path: normalizeRelativePath(relativePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    content: await fsp.readFile(absolutePath, "utf8")
  };
}

async function writeWorkspaceFile(relativePath, content) {
  if (!relativePath || relativePath.endsWith("/") || relativePath.endsWith("\\")) {
    throw new Error("A file path is required");
  }

  const absolutePath = resolveWorkspacePath(relativePath);
  await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsp.writeFile(absolutePath, content, "utf8");
  const stat = await fsp.stat(absolutePath);

  return {
    path: normalizeRelativePath(relativePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    ok: true
  };
}

async function previewWorkspaceFile(relativePath, content, options = {}) {
  if (!relativePath || relativePath.endsWith("/") || relativePath.endsWith("\\")) {
    throw new Error("A file path is required");
  }

  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = resolveWorkspacePath(normalized);
  let current = "";
  let exists = false;

  try {
    const stat = await fsp.stat(absolutePath);
    if (!stat.isFile()) {
      throw new Error("Path is not a file");
    }
    if (stat.size > MAX_FILE_BYTES) {
      throw new Error(`File is too large to preview here (${stat.size} bytes)`);
    }
    current = await fsp.readFile(absolutePath, "utf8");
    exists = true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const diff = createUnifiedDiff(normalized, current, content);
  return {
    path: normalized,
    size: Buffer.byteLength(content, "utf8"),
    exists,
    preview: true,
    blockedWrite: options.blockedWrite === true,
    diff,
    stats: diff.stats
  };
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
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

async function serveStatic(requestPath, req, res) {
  const pathname = decodeURIComponent(requestPath);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  return serveStaticFrom(PUBLIC_DIR, relativePath, req, res);
}

async function serveStaticFrom(rootDir, relativePath, req, res) {
  const safeRelativePath = decodeURIComponent(relativePath || "").replace(/^\/+/, "") || "index.html";
  const absolutePath = path.resolve(rootDir, safeRelativePath);

  if (absolutePath !== rootDir && !absolutePath.startsWith(`${rootDir}${path.sep}`)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  try {
    const stat = await fsp.stat(absolutePath);
    const filePath = stat.isDirectory() ? path.join(absolutePath, "index.html") : absolutePath;
    const content = req.method === "HEAD" ? null : await fsp.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-cache"
    });
    if (content) {
      res.end(content);
    } else {
      res.end();
    }
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: truncate(String(message.content || ""), 16000)
    }))
    .filter((message) => message.content.trim());
}

async function streamText(res, text) {
  const parts = text.match(/(\s+|\S+)/g) || [text];
  for (const part of parts) {
    sendEvent(res, "token", { text: part });
    await delay(5);
  }
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function summarizeToolResult(result) {
  if (result && Array.isArray(result.files)) {
    return `${result.files.length} file(s) found`;
  }
  if (result && Array.isArray(result.results)) {
    return `${result.results.length} search result(s)`;
  }
  if (result && result.preview) {
    const action = result.blockedWrite ? "Previewed instead of writing" : "Previewed";
    return `${action} ${result.path} (+${result.stats.added}, -${result.stats.removed})`;
  }
  if (result && result.content) {
    return `Read ${result.path} (${result.size} bytes)`;
  }
  if (result && result.ok) {
    return `Wrote ${result.path} (${result.size} bytes)`;
  }
  if (result && result.error) {
    return result.error;
  }
  return truncate(JSON.stringify(result), 280);
}

function countOccurrences(text, term) {
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function createSnippet(content, terms) {
  const lines = String(content || "").split(/\r?\n/);
  const fallback = lines.find((line) => line.trim()) || "";
  if (!terms.length) {
    return truncate(fallback.trim(), 180);
  }

  const found = lines.find((line) => {
    const lower = line.toLowerCase();
    return terms.some((term) => lower.includes(term));
  });

  return truncate((found || fallback).trim(), 180);
}

function createUnifiedDiff(filePath, before, after) {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const stats = {
    added: afterLines.length,
    removed: beforeLines.length
  };

  if (before === after) {
    return {
      text: [`--- a/${filePath}`, `+++ b/${filePath}`, " no changes"].join("\n"),
      stats: { added: 0, removed: 0 }
    };
  }

  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const contextBefore = beforeLines.slice(Math.max(0, prefix - 3), prefix);
  const removed = beforeLines.slice(prefix, beforeLines.length - suffix);
  const added = afterLines.slice(prefix, afterLines.length - suffix);
  const contextAfter = beforeLines.slice(beforeLines.length - suffix, Math.min(beforeLines.length, beforeLines.length - suffix + 3));

  stats.added = added.length;
  stats.removed = removed.length;

  const lines = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    ...contextBefore.map((line) => ` ${line}`),
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
    ...contextAfter.map((line) => ` ${line}`)
  ];

  return {
    text: truncate(lines.join("\n"), 6000),
    stats
  };
}

function splitLines(text) {
  const value = String(text || "");
  return value ? value.split(/\r?\n/) : [];
}

function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 24)}\n...[truncated]`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml; charset=utf-8",
      ".png": "image/png",
      ".ico": "image/x-icon"
    }[extension] || "application/octet-stream"
  );
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
    }
  }
}
