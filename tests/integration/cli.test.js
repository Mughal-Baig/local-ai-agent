#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..", "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const installed = new Set(["llama3.2"]);
  const mock = await startMockOllama(installed);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-cli-"));
  const agentPort = await getOpenPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: `http://127.0.0.1:${mock.address().port}`,
      AGENTTRAIL_NATIVE_TOOLS: "off",
      AGENTTRAIL_DEFAULT_STEP_BUDGET: "1",
      MAX_TOOL_ITERATIONS: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

  const baseUrl = `http://127.0.0.1:${agentPort}`;
  try {
    await waitForServer(baseUrl, () => serverOutput);

    const list = await cliJson(["--url", baseUrl, "list", "--json"]);
    assert.equal(list.models.some((model) => model.name === "llama3.2"), true);

    const ps = await cliJson(["--url", baseUrl, "ps", "--json"]);
    assert.equal(ps.ok, true);
    assert.equal(ps.concurrency.maxConcurrency >= 1, true);

    const shown = await cliJson(["--url", baseUrl, "show", "llama3.2", "--json"]);
    assert.equal(shown.name, "llama3.2");

    const pull = await cliJson(["--url", baseUrl, "pull", "qwen2.5", "--json"]);
    assert.equal(pull.ok, true);
    assert.equal(installed.has("qwen2.5"), true);

    const removed = await cliJson(["--url", baseUrl, "rm", "qwen2.5", "--json"]);
    assert.equal(removed.ok, true);
    assert.equal(installed.has("qwen2.5"), false);

    const modelfile = path.join(workspaceRoot, "Modelfile");
    await fsp.writeFile(modelfile, "FROM llama3.2\nPARAMETER temperature 0.1\nTAG cli\n", "utf8");
    const created = await cliJson(["--url", baseUrl, "create", "cli/derived", "--file", modelfile, "--json"]);
    assert.equal(created.ok, true);
    assert.equal(created.model.kind, "derived");

    const registryShown = await cliJson(["--url", baseUrl, "show", "cli/derived", "--json"]);
    assert.equal(registryShown.name, "cli/derived");

    const run = await cliJson(["--url", baseUrl, "run", "llama3.2", "--prompt", "Say hello", "--json"]);
    assert.equal(run.ok, true);
    assert.match(run.response, /CLI response/);

    const chat = await cliJson(["--url", baseUrl, "chat", "--model", "llama3.2", "--prompt", "Say hello", "--json"]);
    assert.equal(chat.ok, true);
    assert.equal(chat.model, "llama3.2");
    assert.match(chat.response, /CLI response/);

    const bashCompletion = await cli(["completion", "bash"]);
    assert.match(bashCompletion.stdout, /complete -F _agenttrail agenttrail/);
    const zshCompletion = await cli(["completion", "zsh"]);
    assert.match(zshCompletion.stdout, /#compdef agenttrail/);
    const fishCompletion = await cli(["completion", "fish"]);
    assert.match(fishCompletion.stdout, /complete -c agenttrail -f -a run/);

    const servePort = await getOpenPort();
    const serveWorkspace = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-cli-serve-"));
    const serve = spawn(process.execPath, ["bin/agenttrail.js", "serve", "--host", "127.0.0.1", "--port", String(servePort)], {
      cwd: projectRoot,
      env: {
        ...process.env,
        WORKSPACE_ROOT: serveWorkspace,
        OLLAMA_HOST: `http://127.0.0.1:${mock.address().port}`,
        AGENTTRAIL_NATIVE_TOOLS: "off"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let serveOutput = "";
    serve.stdout.on("data", (chunk) => { serveOutput += chunk.toString(); });
    serve.stderr.on("data", (chunk) => { serveOutput += chunk.toString(); });
    try {
      await waitForServer(`http://127.0.0.1:${servePort}`, () => serveOutput);
      const health = await fetchJson(`http://127.0.0.1:${servePort}/api/health`);
      assert.equal(health.ok, true);
    } finally {
      serve.kill("SIGTERM");
      await fsp.rm(serveWorkspace, { recursive: true, force: true });
    }

    console.log("CLI integration test passed");
  } finally {
    child.kill("SIGTERM");
    mock.close();
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function cliJson(args) {
  const result = await cli(args);
  return JSON.parse(result.stdout);
}

async function cli(args) {
  return execFileAsync(process.execPath, ["bin/agenttrail.js", ...args], {
    cwd: projectRoot,
    env: { ...process.env },
    timeout: 20000,
    maxBuffer: 2 * 1024 * 1024
  });
}

function startMockOllama(installed) {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/tags")) {
      return json(res, {
        models: [...installed].map((name) => ({
          name,
          size: 2048,
          modified_at: null,
          details: { family: "llama", parameter_size: "3B", quantization_level: "Q4_K_M" }
        }))
      });
    }
    if (req.method === "POST" && req.url.startsWith("/api/pull")) {
      readJson(req).then((body) => {
        installed.add(body.name);
        res.writeHead(200, { "Content-Type": "application/x-ndjson" });
        res.write(`${JSON.stringify({ status: "pulling manifest" })}\n`);
        res.write(`${JSON.stringify({ status: "downloading", completed: 100, total: 100 })}\n`);
        res.end(`${JSON.stringify({ status: "success" })}\n`);
      });
      return;
    }
    if (req.method === "DELETE" && req.url.startsWith("/api/delete")) {
      readJson(req).then((body) => {
        installed.delete(body.name);
        json(res, { status: "ok" });
      });
      return;
    }
    if (req.method === "POST" && req.url.startsWith("/api/generate")) {
      readJson(req).then(() => {
        res.writeHead(200, { "Content-Type": "application/x-ndjson" });
        res.write(`${JSON.stringify({ response: "CLI " })}\n`);
        res.write(`${JSON.stringify({ response: "response." })}\n`);
        res.end(`${JSON.stringify({ done: true })}\n`);
      });
      return;
    }
    json(res, { error: "not found" }, 404);
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { resolve({}); }
    });
  });
}

function json(res, body, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function getOpenPort() {
  const server = http.createServer();
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(baseUrl, getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // wait for server boot
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${getOutput()}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}
