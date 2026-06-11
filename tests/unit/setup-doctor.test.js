#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {
  defaultWorkspaceRoot,
  friendlyInstallError,
  prepareFirstRunWorkspace,
  runSetupDoctor
} = require("../../src/setup-doctor");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-doctor-"));
  const mock = await startMockOllama(["llama3.2"]);
  const port = await getOpenPort();
  try {
    assert.equal(defaultWorkspaceRoot({}, tmp), path.join(tmp, "agenttrail-workspace"));

    const firstRun = await prepareFirstRunWorkspace({ workspaceRoot: path.join(tmp, "workspace") });
    assert.equal(firstRun.workspaceRoot, path.join(tmp, "workspace"));
    assert.match(await fsp.readFile(firstRun.welcomePath, "utf8"), /Expected loop/);

    const ready = await runSetupDoctor({
      cwd: tmp,
      workspaceRoot: firstRun.workspaceRoot,
      port,
      ollamaHost: `http://127.0.0.1:${mock.address().port}`,
      model: "llama3.2"
    });
    assert.equal(ready.schema, "agenttrail.setup-doctor.v1");
    assert.equal(ready.ok, true);
    assert.equal(ready.checks.some((check) => check.id === "node" && check.ok), true);
    assert.equal(ready.checks.some((check) => check.id === "workspace" && check.ok), true);
    assert.equal(ready.checks.some((check) => check.id === "disk" && check.ok), true);
    assert.equal(ready.checks.some((check) => check.id === "port" && check.ok), true);
    assert.equal(ready.checks.some((check) => check.id === "ollama" && check.ok), true);
    assert.equal(ready.checks.some((check) => check.id === "model" && check.ok), true);

    const missingModel = await runSetupDoctor({
      cwd: tmp,
      workspaceRoot: firstRun.workspaceRoot,
      port: await getOpenPort(),
      ollamaHost: `http://127.0.0.1:${mock.address().port}`,
      model: "qwen2.5"
    });
    assert.equal(missingModel.ok, false);
    assert.match(missingModel.checks.find((check) => check.id === "model").action, /ollama pull qwen2\.5/);

    assert.match(friendlyInstallError({ code: "EADDRINUSE" }, { port: 4173 }), /agenttrail serve --port 4174/);
    assert.match(friendlyInstallError({ code: "EACCES" }, { workspaceRoot: "/root/nope" }), /WORKSPACE_ROOT/);
    console.log("Setup doctor unit tests passed");
  } finally {
    mock.close();
    await fsp.rm(tmp, { recursive: true, force: true });
  }
}

function startMockOllama(models) {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/api/tags") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models: models.map((name) => ({ name, size: 1 })) }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function getOpenPort() {
  const server = http.createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}
