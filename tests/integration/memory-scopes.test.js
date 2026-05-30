#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 8750 + Math.floor(Math.random() * 120);
const mockPort = 9050 + Math.floor(Math.random() * 120);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const capturedPrompts = [];
  const mock = startMockOpenAI(mockPort, capturedPrompts);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-memory-scopes-workspace-"));
  const globalRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-memory-scopes-global-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_GLOBAL_MEMORY_ROOT: globalRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_CACHE: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));

  try {
    await waitForServer(() => output);
    await postJson("/api/memory", {
      scope: "project",
      content: [
        "# Project Memory",
        "",
        "## Decisions",
        "- Use project deploy checklist before release."
      ].join("\n")
    });
    await postJson("/api/memory", {
      scope: "global",
      content: [
        "# Global Memory",
        "",
        "## Preferences",
        "- Prefer concise global style notes across workspaces."
      ].join("\n")
    });

    const scopes = await getJson("/api/memory/scopes");
    assert.equal(scopes.schema, "agenttrail.memory-scopes.v1");
    assert.equal(scopes.scopes.some((item) => item.id === "global" && item.exists), true);
    assert.equal(scopes.scopes.some((item) => item.id === "project" && item.exists), true);

    const projectMemory = await getJson("/api/memory?scope=project");
    assert.equal(projectMemory.scope, "project");
    assert.match(projectMemory.content, /project deploy checklist/);
    assert.doesNotMatch(projectMemory.content, /global style/);

    const globalMemory = await getJson("/api/memory?scope=global");
    assert.equal(globalMemory.scope, "global");
    assert.match(globalMemory.content, /global style notes/);
    assert.doesNotMatch(globalMemory.content, /project deploy/);

    const retrieval = await getJson("/api/memory/retrieve?scope=all&query=global%20style%20deploy&budget=900");
    assert.equal(retrieval.scope, "all");
    assert.equal(retrieval.selected.some((item) => item.citation.startsWith("global/memory/global-memory.md")), true);
    assert.equal(retrieval.selected.some((item) => item.citation.startsWith("memory/project-memory.md")), true);

    const citations = await getJson("/api/memory/citations?scope=all&query=global");
    assert.equal(citations.citations.some((item) => item.scope === "global" && item.path === "global/memory/global-memory.json"), true);

    await streamChat({
      model: "mock-model",
      messages: [{ role: "user", content: "Use my global style preference and the project deploy decision." }],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true,
      stepBudget: { maxSteps: 2, override: false }
    });

    const prompt = capturedPrompts.join("\n");
    assert.match(prompt, /Global memory:/);
    assert.match(prompt, /Project memory:/);
    assert.match(prompt, /Prefer concise global style notes across workspaces/);
    assert.match(prompt, /Use project deploy checklist before release/);

    console.log("Memory scopes integration test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
    await fsp.rm(globalRoot, { recursive: true, force: true });
  }
}

function startMockOpenAI(port, capturedPrompts) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, { object: "list", data: [{ id: "mock-model", object: "model" }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      const messages = JSON.stringify(body.messages || []);
      if (messages.includes("Capability probe")) {
        return json(res, { error: "tools unsupported for memory scope test" }, 400);
      }
      capturedPrompts.push(messages);
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Final answer." } }] })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

function json(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function streamChat(body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, "chat request should succeed");
  await response.text();
}

async function getJson(endpoint) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${endpoint}`);
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function postJson(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${agentPort}/api/status`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
