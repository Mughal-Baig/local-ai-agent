#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const packageMeta = require("../../package.json");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..", "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const started = Date.now();
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-install-"));
  const workspaceRoot = path.join(tmp, "workspace");
  const mock = await startMockOllama(["llama3.2"]);
  try {
    const pack = await execFileAsync("npm", ["pack", "--pack-destination", tmp], {
      cwd: projectRoot,
      env: { ...process.env, SOURCE_DATE_EPOCH: "1700000000" },
      timeout: 45_000,
      maxBuffer: 4 * 1024 * 1024
    });
    const tarball = pack.stdout.trim().split(/\n/).pop();
    const tarballPath = path.join(tmp, tarball);
    await fsp.access(tarballPath);

    const version = await execFileAsync("npm", ["exec", "--yes", "--package", tarballPath, "--", "agenttrail", "--version"], {
      cwd: tmp,
      timeout: 45_000,
      maxBuffer: 2 * 1024 * 1024
    });
    assert.equal(version.stdout.trim(), packageMeta.version);

    const port = await getOpenPort();
    const doctor = await execFileAsync("npm", [
      "exec",
      "--yes",
      "--package",
      tarballPath,
      "--",
      "agenttrail",
      "doctor",
      "--json",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--workspace",
      workspaceRoot,
      "--ollama-host",
      `http://127.0.0.1:${mock.address().port}`,
      "--model",
      "llama3.2"
    ], {
      cwd: tmp,
      timeout: 45_000,
      maxBuffer: 2 * 1024 * 1024
    });
    const report = JSON.parse(doctor.stdout);
    assert.equal(report.schema, "agenttrail.setup-doctor.v1");
    assert.equal(report.ok, true);
    assert.equal(report.workspaceRoot, workspaceRoot);
    assert.equal(report.checks.some((check) => check.id === "model" && check.ok), true);
    assert.equal(Date.now() - started < 60_000, true, "packaged install smoke should finish in under 60 seconds");
    console.log("Install smoke test passed");
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
