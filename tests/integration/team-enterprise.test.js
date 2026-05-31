#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 5700 + Math.floor(Math.random() * 300);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-team-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1",
      AGENTTRAIL_SSO_ALLOWED_DOMAINS: "example.com"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let childOutput = "";
  child.stdout.on("data", (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { childOutput += chunk.toString(); });

  try {
    await waitForServer(childOutputRef);
    const saved = await post("/api/receipts", {
      content: [
        "# AgentTrail Receipt",
        "",
        "Model: llama3.2",
        "Selected files: welcome.md",
        "Tool calls: 1",
        "",
        "## Events",
        "- 10:00 [tool] read_file welcome.md"
      ].join("\n")
    });
    assert.match(saved.path, /^receipts\//);

    const status = await get("/api/team/status?user=viewer");
    assert.equal(status.schema, "agenttrail.team-status.v1");
    assert.equal(status.activeUser.role, "viewer");
    assert.equal(status.sharedReceipts.readOnly, true);
    assert.equal(status.sharedReceipts.count >= 1, true);
    assert.equal(status.rbac.find((item) => item.tool === "write_file").allowed, false);

    const receipts = await get("/api/team/receipts?user=viewer");
    assert.equal(receipts.schema, "agenttrail.shared-receipts.v1");
    assert.equal(receipts.receipts.some((receipt) => receipt.path === saved.path), true);

    const receiptContent = await get(`/api/team/receipts/content?user=viewer&path=${encodeURIComponent(saved.path)}`);
    assert.equal(receiptContent.readOnly, true);
    assert.match(receiptContent.receipt.content, /AgentTrail Receipt/);

    const deniedAudit = await rawGet("/api/team/audit/export?user=viewer&format=json");
    assert.equal(deniedAudit.status, 403);
    const auditJson = await rawGet("/api/team/audit/export?user=auditor&format=json");
    assert.equal(auditJson.status, 200);
    assert.equal(JSON.parse(auditJson.body).schema, "agenttrail.audit-export.v1");
    const auditCsv = await rawGet("/api/team/audit/export?user=auditor&format=csv");
    assert.equal(auditCsv.status, 200);
    assert.match(auditCsv.body, /createdAt,source,type/);

    const sync = await post("/api/team/sync/export", { userId: "owner", enabled: true });
    assert.equal(sync.ok, true);
    assert.match(sync.path, /^shared-sync\/team-sync-/);

    const sso = await post("/api/team/sso/validate", { email: "person@example.com", role: "auditor" });
    assert.equal(sso.ok, true);
    const rejectedSso = await rawPost("/api/team/sso/validate", { email: "person@elsewhere.test" });
    assert.equal(rejectedSso.status, 401);
    console.log("Team enterprise integration test passed");
  } finally {
    child.kill();
  }

  function childOutputRef() {
    return childOutput;
  }
}

async function get(endpoint) {
  const response = await rawGet(endpoint);
  assert.equal(response.status >= 200 && response.status < 300, true, endpoint);
  return JSON.parse(response.body);
}

async function post(endpoint, body) {
  const response = await rawPost(endpoint, body);
  assert.equal(response.status >= 200 && response.status < 300, true, endpoint);
  return JSON.parse(response.body);
}

function waitForServer(outputRef) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > 10000) {
        clearInterval(timer);
        reject(new Error(`server did not start\n${outputRef()}`));
        return;
      }
      try {
        await rawGet("/api/health");
        clearInterval(timer);
        resolve();
      } catch {
        // keep trying
      }
    }, 150);
  });
}

function rawGet(endpoint) {
  return request("GET", endpoint);
}

function rawPost(endpoint, body) {
  return request("POST", endpoint, body);
}

function request(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: endpoint,
      method,
      headers: body ? {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      } : undefined
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
