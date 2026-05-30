#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 5400 + Math.floor(Math.random() * 200);
const mockPort = 5600 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = { requests: 0, sawNativeTools: false };
  const mock = startMockOllama(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-ollama-tools-"));
  await fsp.writeFile(path.join(workspaceRoot, "welcome.md"), "hello from ollama tools\n", "utf8");

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
    const result = await streamChat(agentPort);
    assert.equal(state.sawNativeTools, true, "Ollama chat request should include tools");
    assert.equal(result.tools.some((event) => event.name === "read_file"), true, "Ollama native tool call should execute read_file");
    assert.match(result.text, /Ollama native tool call finished/, "final answer should stream after tool result");
    console.log("Ollama native tool-calling test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function startMockOllama(port, state) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/tags")) {
      return json(res, { models: [{ name: "mock-ollama", size: 1, modified_at: new Date().toISOString() }] });
    }
    if (req.method === "POST" && req.url.startsWith("/api/chat")) {
      const body = JSON.parse(await readBody(req) || "{}");
      state.requests += 1;
      state.sawNativeTools = state.sawNativeTools || Array.isArray(body.tools) && body.tools.some((tool) => tool.function && tool.function.name === "read_file");
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      if (state.requests === 1) {
        res.write(`${JSON.stringify({
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ function: { name: "read_file", arguments: { path: "welcome.md" } } }]
          },
          done: true
        })}\n`);
      } else {
        for (const token of ["Ollama native ", "tool call finished."]) {
          res.write(`${JSON.stringify({ message: { role: "assistant", content: token }, done: false })}\n`);
        }
        res.write(`${JSON.stringify({ message: { role: "assistant", content: "" }, done: true })}\n`);
      }
      return res.end();
    }
    if (req.method === "POST" && req.url.startsWith("/api/generate")) {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write(`${JSON.stringify({ response: "fallback", done: true })}\n`);
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
      model: "mock-ollama",
      messages: [{ role: "user", content: "Read welcome.md" }],
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
