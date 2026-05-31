#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 4800 + Math.floor(Math.random() * 200);
const mockPort = 5000 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = { requests: [] };
  const mock = startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-vision-"));
  await fsp.mkdir(path.join(workspaceRoot, "images"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, "images", "scan.png"), Buffer.from("tiny fake png bytes"));

  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      AGENTTRAIL_MODEL_ADAPTER: "openai-compatible",
      OPENAI_COMPATIBLE_HOST: `http://127.0.0.1:${mockPort}`,
      AGENTTRAIL_NATIVE_TOOLS: "off",
      AGENTTRAIL_CACHE: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(agentPort, () => output);
    const result = await streamChat(agentPort);
    assert.match(result.text, /vision backend saw image/);
    assert.equal(result.visionEvents.length, 1);
    assert.equal(result.visionEvents[0].count, 1);
    assert.equal(result.visionEvents[0].images[0].path, "images/scan.png");

    const chatRequest = state.requests.find((request) => Array.isArray(request.messages));
    assert.ok(chatRequest, "mock should receive a chat request");
    const content = chatRequest.messages[0].content;
    assert.equal(Array.isArray(content), true, "OpenAI-compatible vision payload should use content parts");
    assert.equal(content.some((part) => part.type === "text" && /Vision image context/.test(part.text)), true);
    const imagePart = content.find((part) => part.type === "image_url");
    assert.ok(imagePart, "image_url part should be present");
    assert.match(imagePart.image_url.url, /^data:image\/png;base64,/);

    console.log("Vision input integration test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOpenAI(port, state) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      return json(res, { object: "list", data: [{ id: "vision-model", object: "model" }] });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      const body = JSON.parse(await readBody(req) || "{}");
      state.requests.push(body);
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const token of ["vision ", "backend ", "saw ", "image"]) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    if (req.method === "POST" && req.url.startsWith("/v1/embeddings")) {
      return json(res, { data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }] });
    }
    json(res, { error: "not found" }, 404);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

async function streamChat(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "vision-model",
      messages: [{ role: "user", content: "Describe this scan." }],
      selectedFiles: ["images/scan.png"],
      permissions: {},
      securityMode: false
    })
  });
  assert.equal(response.ok, true, "chat request should succeed");
  const raw = await response.text();
  let text = "";
  const visionEvents = [];
  let event = "message";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = JSON.parse(line.slice(5).trim());
    if (typeof data.text === "string") {
      text += data.text;
    }
    if (event === "vision") {
      visionEvents.push(data);
    }
  }
  return { text, visionEvents };
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
