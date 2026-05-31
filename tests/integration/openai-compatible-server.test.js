#!/usr/bin/env node

"use strict";

// Proves AgentTrail can be consumed as an OpenAI-compatible local agent API.
// A mock OpenAI-compatible backend powers the model side while clients call
// AgentTrail's served /v1/* endpoints with auth, streaming, embeddings, and
// overload controls.

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { routeCatalog } = require("../../src/route-catalog");

const projectRoot = path.resolve(__dirname, "..", "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  await runServedApiScenario();
  await runRateLimitScenario();
  await runQueueFullScenario();
  console.log("OpenAI-compatible served API test passed");
}

async function runServedApiScenario() {
  const agentPort = randomPort(7800, 220);
  const mockPort = randomPort(8100, 220);
  const state = { chatBodies: [], embeddingBodies: [], modelRequests: 0 };
  const mock = await startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-v1-api-"));
  const child = spawnAgent(agentPort, workspaceRoot, {
    AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
    OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
    AGENTTRAIL_NATIVE_TOOLS: "off",
    AGENTTRAIL_CACHE: "off",
    AGENTTRAIL_V1_API_KEY: "test-key",
    AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE: "20",
    AGENTTRAIL_V1_QUEUE_CONCURRENCY: "1",
    AGENTTRAIL_V1_QUEUE_MAX: "4"
  });

  try {
    await waitForServer(agentPort, () => child.output);

    const openapi = await requestJson(agentPort, "GET", "/v1/openapi.json");
    assert.equal(openapi.status, 200);
    assert.equal(openapi.body.paths["/v1/chat/completions"].post.operationId, "createChatCompletion");

    const unauthorized = await requestJson(agentPort, "GET", "/v1/models");
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.error.type, "authentication_error");

    const models = await requestJson(agentPort, "GET", "/v1/models", null, authHeaders("test-key"));
    assert.equal(models.status, 200);
    assert.equal(models.body.object, "list");
    assert.equal(models.body.data.some((model) => model.id === "mock-agent-model"), true);
    assert.match(models.headers["x-agenttrail-queue-wait-ms"], /^\d+$/);
    assert.match(models.headers["x-ratelimit-remaining"], /^\d+$/);

    const embeddings = await requestJson(agentPort, "POST", "/v1/embeddings", {
      model: "mock-embed",
      input: ["local agent", "receipt timeline"]
    }, { "x-api-key": "test-key" });
    assert.equal(embeddings.status, 200);
    assert.equal(embeddings.body.object, "list");
    assert.equal(embeddings.body.data.length, 2);
    assert.deepEqual(embeddings.body.data[0].embedding, [0.1, 0.2, 0.3, 0.4]);
    assert.deepEqual(state.embeddingBodies[0].input, "local agent");

    const completion = await requestJson(agentPort, "POST", "/v1/chat/completions", {
      model: "mock-agent-model",
      messages: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "Say the integration phrase." }
      ],
      agenttrail: {
        selectedFiles: [],
        permissions: { readFiles: false, writeFiles: false, previewWrites: true },
        stepBudget: { maxSteps: 1 }
      }
    }, authHeaders("test-key"));
    assert.equal(completion.status, 200);
    assert.equal(completion.body.object, "chat.completion");
    assert.equal(completion.body.choices[0].message.role, "assistant");
    assert.match(completion.body.choices[0].message.content, /agent api ok/);
    assert.equal(completion.body.usage.total_tokens >= 1, true);

    const stream = await requestText(agentPort, "POST", "/v1/chat/completions", {
      model: "mock-agent-model",
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: "user", content: "Stream the integration phrase." }],
      agenttrail: {
        selectedFiles: [],
        permissions: { readFiles: false, writeFiles: false, previewWrites: true },
        stepBudget: { maxSteps: 1 }
      }
    }, authHeaders("test-key"));
    assert.equal(stream.status, 200);
    assert.match(stream.headers["content-type"], /text\/event-stream/);
    assert.match(stream.body, /chat\.completion\.chunk/);
    assert.match(stream.body, /data: \[DONE\]/);
    assert.match(collectStreamText(stream.body), /agent api ok/);

    assert.equal(state.chatBodies.length >= 2, true);
    assert.equal(state.chatBodies.every((body) => body.stream === true), true);
    assert.equal(routeCatalog().some((route) => route.area === "openai-compatible-api" && route.routes.includes("/v1/chat/completions")), true);
  } finally {
    child.kill();
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function runRateLimitScenario() {
  const agentPort = randomPort(8400, 180);
  const mockPort = randomPort(8640, 180);
  const mock = await startMockOpenAI(mockPort, {});
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-v1-rate-"));
  const child = spawnAgent(agentPort, workspaceRoot, {
    AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
    OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
    AGENTTRAIL_V1_API_KEY: "rate-key",
    AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE: "1",
    AGENTTRAIL_V1_QUEUE_CONCURRENCY: "1",
    AGENTTRAIL_V1_QUEUE_MAX: "1"
  });

  try {
    await waitForServer(agentPort, () => child.output);
    const first = await requestJson(agentPort, "GET", "/v1/models", null, authHeaders("rate-key"));
    assert.equal(first.status, 200);
    const second = await requestJson(agentPort, "GET", "/v1/models", null, authHeaders("rate-key"));
    assert.equal(second.status, 429);
    assert.equal(second.body.error.code, "rate_limit_exceeded");
    assert.equal(second.headers["x-ratelimit-remaining"], "0");
  } finally {
    child.kill();
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function runQueueFullScenario() {
  const agentPort = randomPort(8860, 180);
  const mockPort = randomPort(9100, 180);
  const mock = await startMockOpenAI(mockPort, {}, { modelDelayMs: 400 });
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-v1-queue-"));
  const child = spawnAgent(agentPort, workspaceRoot, {
    AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
    OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
    AGENTTRAIL_V1_API_KEY: "queue-key",
    AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE: "20",
    AGENTTRAIL_V1_QUEUE_CONCURRENCY: "1",
    AGENTTRAIL_V1_QUEUE_MAX: "0"
  });

  try {
    await waitForServer(agentPort, () => child.output);
    const firstPromise = requestJson(agentPort, "GET", "/v1/models", null, authHeaders("queue-key"));
    await delay(50);
    const second = await requestJson(agentPort, "GET", "/v1/models", null, authHeaders("queue-key"));
    const first = await firstPromise;
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(second.body.error.code, "queue_full");
  } finally {
    child.kill();
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function spawnAgent(port, workspaceRoot, env) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.output = "";
  child.stdout.on("data", (chunk) => { child.output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { child.output += chunk.toString(); });
  return child;
}

function startMockOpenAI(port, state = {}, options = {}) {
  state.chatBodies = state.chatBodies || [];
  state.embeddingBodies = state.embeddingBodies || [];
  state.modelRequests = state.modelRequests || 0;
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      state.modelRequests += 1;
      if (options.modelDelayMs) {
        await delay(options.modelDelayMs);
      }
      return json(res, { object: "list", data: [{ id: "mock-agent-model", object: "model", created: 0 }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/embeddings")) {
      const body = JSON.parse(await readBody(req) || "{}");
      state.embeddingBodies.push(body);
      const input = Array.isArray(body.input) ? body.input[0] : body.input;
      return json(res, {
        object: "list",
        data: [{ object: "embedding", index: 0, embedding: input ? [0.1, 0.2, 0.3, 0.4] : [] }]
      });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      state.chatBodies.push(body);
      if (body.stream === true) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const token of ["agent ", "api ", "ok"]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        return res.end();
      }
      return json(res, {
        choices: [{ message: { role: "assistant", content: "agent api ok" }, finish_reason: "stop" }]
      });
    }
    json(res, { error: "not found" }, 404);
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function requestJson(port, method, route, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.json()
  };
}

async function requestText(port, method, route, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text()
  };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function collectStreamText(payload) {
  let text = "";
  for (const line of payload.split("\n")) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") {
      continue;
    }
    const data = JSON.parse(raw);
    const choice = data.choices && data.choices[0];
    const delta = choice && choice.delta && choice.delta.content;
    if (typeof delta === "string") {
      text += delta;
    }
  }
  return text;
}

function json(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function waitForServer(port, getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/config`);
      if (response.ok) {
        return;
      }
    } catch {
      // not ready yet
    }
    await delay(100);
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomPort(base, span) {
  return base + Math.floor(Math.random() * span);
}
