#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 5000 + Math.floor(Math.random() * 300);
const mockPort = 5300 + Math.floor(Math.random() * 300);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = { requests: 0, sawNativeTools: false };
  const mock = startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-native-tools-"));
  await fsp.mkdir(path.join(workspaceRoot, "notes"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, "notes", "tool.md"), "native tool calling works\n", "utf8");

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
    const result = await streamChat(agentPort);
    assert.equal(state.sawNativeTools, true, "AgentTrail should send native tool definitions to the backend");
    assert.equal(result.tools.some((event) => event.name === "read_file"), true, "native tool call should execute read_file");
    assert.match(result.text, /read the file/i, "second model turn should produce final prose");
    console.log("Native tool-calling integration test passed");
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
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      state.sawNativeTools = state.sawNativeTools || Array.isArray(parsed.tools) && parsed.tools.some((tool) => tool.function && tool.function.name === "read_file");
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const isProbe = JSON.stringify(parsed.messages || []).includes("Capability probe");
      if (isProbe) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "OK" } }] })}\n\n`);
      } else if (state.requests === 0) {
        state.requests += 1;
        const args = JSON.stringify({ path: "notes/tool.md" });
        const toolCall = {
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: "call_read",
                type: "function",
                function: { name: "read_file", arguments: args }
              }]
            }
          }]
        };
        res.write(`data: ${JSON.stringify(toolCall)}\n\n`);
      } else {
        state.requests += 1;
        for (const token of ["I read the file", " with native tools."]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
        }
      }
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

async function streamChat(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mock-model",
      messages: [{ role: "user", content: "Read notes/tool.md" }],
      selectedFiles: [],
      permissions: { readFiles: true },
      securityMode: false
    })
  });
  assert.equal(response.ok, true, "chat request should succeed");
  const raw = await response.text();
  const tools = [];
  let text = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const data = JSON.parse(line.slice(5).trim());
      if (typeof data.text === "string") text += data.text;
      if (data.name) tools.push(data);
    } catch {
      // Ignore non-JSON data lines.
    }
  }
  return { text, tools };
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
