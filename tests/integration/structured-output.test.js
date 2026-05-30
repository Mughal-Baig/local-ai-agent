#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
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
  await runOpenAIStructuredOutput();
  await runOllamaStructuredOutput();
  console.log("Structured output integration test passed");
}

async function runOpenAIStructuredOutput() {
  const agentPort = 6600 + Math.floor(Math.random() * 200);
  const mockPort = 6900 + Math.floor(Math.random() * 200);
  const state = { responseFormat: null };
  const mock = startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-structured-openai-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_CACHE: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);
    const result = await post(agentPort, "/api/structured-output", {
      model: "mock-model",
      schemaId: "task-list",
      prompt: "Extract tasks: ship structured output today."
    });
    assert.equal(result.ok, true);
    assert.equal(result.output.tasks[0].priority, "high");
    assert.equal(state.responseFormat.type, "json_schema");
    assert.equal(state.responseFormat.json_schema.strict, true);
    assert.equal(state.responseFormat.json_schema.name, "task-list");
    assert.equal(state.responseFormat.json_schema.schema.required.includes("tasks"), true);

    const recipeResult = await post(agentPort, "/api/structured-output/recipe", {
      model: "mock-model",
      recipeId: "extract-tasks-json",
      input: "Rohit must ship the structured recipe by Friday. Priority is high."
    });
    assert.equal(recipeResult.ok, true);
    assert.equal(recipeResult.recipe.id, "extract-tasks-json");
    assert.equal(recipeResult.output.tasks[0].title, "Ship structured output");

    const invalid = await postRaw(agentPort, "/api/structured-output", {
      model: "mock-model",
      schemaId: "task-list",
      prompt: "Return invalid priority for this test."
    });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.ok, false);
    assert.equal(invalid.body.reason, "schema-violation");
    assert.match(invalid.body.userMessage, /did not match Task list/);
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function runOllamaStructuredOutput() {
  const agentPort = 7100 + Math.floor(Math.random() * 200);
  const mockPort = 7400 + Math.floor(Math.random() * 200);
  const state = { format: null };
  const mock = startMockOllama(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-structured-ollama-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_CACHE: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);
    const result = await post(agentPort, "/api/structured-output", {
      model: "mock-ollama",
      schemaId: "table-extract",
      prompt: "Extract a table with Product and Price."
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.output.columns, ["Product", "Price"]);
    assert.equal(state.format.type, "object");
    assert.equal(state.format.required.includes("columns"), true);
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOpenAI(port, state) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, { object: "list", data: [{ id: "mock-model", object: "model" }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      state.responseFormat = body.response_format;
      const content = JSON.stringify(body.messages || []);
      const output = content.includes("invalid priority")
        ? { tasks: [{ title: "Bad priority", priority: "urgent" }] }
        : { tasks: [{ title: "Ship structured output", priority: "high", owner: "AgentTrail", done: false }] };
      return json(res, {
        choices: [{
          message: {
            content: JSON.stringify(output)
          }
        }]
      });
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

function startMockOllama(port, state) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/tags")) {
      return json(res, { models: [{ name: "mock-ollama", size: 1, modified_at: new Date().toISOString() }] });
    }
    if (req.method === "POST" && req.url.startsWith("/api/generate")) {
      const body = JSON.parse(await readBody(req) || "{}");
      state.format = body.format;
      return json(res, {
        response: JSON.stringify({
          columns: ["Product", "Price"],
          rows: [{ Product: "AgentTrail", Price: "$0 local" }]
        })
      });
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

async function post(port, endpoint, body) {
  const result = await postRaw(port, endpoint, body);
  assert.equal(result.ok, true, endpoint);
  return result.body;
}

async function postRaw(port, endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const responseBody = await response.json();
  return { ok: response.ok, status: response.status, body: responseBody };
}

async function waitForServer(port, getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
