#!/usr/bin/env node
"use strict";

// T206-T212 - conversation store plus Markdown/JSON/HTML export with secret redaction.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const port = 5380 + Math.floor(Math.random() * 150);

main().catch((e) => { console.error(e); process.exit(1); });

async function main() {
  const ws = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-convexport-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: ws,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let out = "";
  child.stdout.on("data", (c) => { out += c; });
  child.stderr.on("data", (c) => { out += c; });
  try {
    await waitForServer(() => out);
    const messages = [{ role: "user", content: "my key is sk-ABCDEFGHIJKLMNOPQRSTUV12345" }, { role: "assistant", content: "Noted." }];
    const saved = await postJson("/api/conversations", { messages, title: "Test chat", pinned: true });
    assert.equal(saved.ok, true);
    assert.equal(saved.messageCount, 2);

    const listed = await getJson("/api/conversations?q=key");
    assert.equal(listed.conversations.length, 1);
    assert.equal(listed.conversations[0].pinned, true);

    const opened = await getJson(`/api/conversations/get?id=${saved.id}`);
    assert.equal(opened.conversation.title, "Test chat");
    assert.equal(opened.conversation.messages.length, 2);

    const renamed = await postJson("/api/conversations", { id: saved.id, messages, title: "Renamed chat", pinned: false });
    assert.equal(renamed.title, "Renamed chat");
    assert.equal(renamed.pinned, false);

    const md = await postJson("/api/conversations/export", { messages, title: "Test chat", format: "markdown" });
    assert.equal(md.messageCount, 2);
    assert.equal(md.content.includes("# Test chat"), true);
    assert.equal(md.content.includes("**You:**") && md.content.includes("**AgentTrail:**"), true);
    assert.equal(/sk-ABCDEF/.test(md.content), false, "secret redacted in export");
    const j = await postJson("/api/conversations/export", { messages, format: "json" });
    assert.equal(JSON.parse(j.content).messages.length, 2);
    const h = await postJson("/api/conversations/export", { messages, format: "html" });
    assert.equal(h.content.includes('<div class="msg'), true);
    const deleted = await postJson("/api/conversations/delete", { id: saved.id });
    assert.equal(deleted.ok, true);
    console.log("Conversation export test passed");
  } finally { child.kill("SIGTERM"); await fsp.rm(ws, { recursive: true, force: true }); }
}

async function getJson(route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function postJson(route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
