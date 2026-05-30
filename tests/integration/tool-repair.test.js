#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 6000 + Math.floor(Math.random() * 200);
const mockPort = 6200 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = { turns: 0 };
  const mock = startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-tool-repair-"));
  await fsp.mkdir(path.join(workspaceRoot, "notes"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, "notes", "repair.md"), "repairable argument aliases\n", "utf8");

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
    const readEvent = result.tools.find((event) => event.name === "read_file");
    assert.ok(readEvent, "repairable read_file call should execute");
    assert.equal(readEvent.repaired, true, "event should disclose that arguments were repaired");
    assert.equal(readEvent.arguments.path, "notes/repair.md", "file alias should repair into path");
    assert.match(result.text, /repair completed/i);
    console.log("Tool repair integration test passed");
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
      const isProbe = JSON.stringify(body.messages || []).includes("Capability probe");
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      if (isProbe) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "OK" } }] })}\n\n`);
      } else if (state.turns === 0) {
        state.turns += 1;
        res.write(`data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: "call_repair",
                type: "function",
                function: {
                  name: "read_file",
                  arguments: JSON.stringify({ file: "notes/repair.md" })
                }
              }]
            }
          }]
        })}\n\n`);
      } else {
        state.turns += 1;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "repair completed" } }] })}\n\n`);
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
      messages: [{ role: "user", content: "Read notes/repair.md" }],
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
