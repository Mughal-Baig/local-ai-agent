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
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-audio-"));
  await fsp.mkdir(path.join(workspaceRoot, "audio"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, "audio", "meeting.wav"), Buffer.from("fake local audio bytes"));
  await fsp.writeFile(path.join(workspaceRoot, "notes.txt"), "not audio", "utf8");

  let output = "";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1",
      AGENTTRAIL_TRANSCRIBE_COMMAND: process.execPath,
      AGENTTRAIL_TRANSCRIBE_ARGS: "tests/fixtures/mock-transcribe.js {{input}} {{language}} {{prompt}}"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(() => output);

    const unsupported = await rawPost("/api/audio/transcribe", { path: "notes.txt" });
    assert.equal(unsupported.status, 400);

    const transcription = await post("/api/audio/transcribe", {
      path: "audio/meeting.wav",
      outputPath: "transcripts/meeting.md",
      language: "en",
      prompt: "project sync"
    });
    assert.equal(transcription.ok, true);
    assert.equal(transcription.transcription.type, "audio");
    assert.equal(transcription.transcription.language, "en");
    assert.match(transcription.transcription.engine, /node/);
    assert.match(transcription.output.path, /transcripts\/meeting\.md/);
    assert.match(transcription.receipt.path, /^receipts\/ingestion\//);
    assert.equal(transcription.progress.some((step) => step.id === "transcribe-audio"), true);

    const transcriptNote = await get(`/api/files/content?path=${encodeURIComponent(transcription.output.path)}`);
    assert.match(transcriptNote.content, /Audio Transcript: meeting\.wav/);
    assert.match(transcriptNote.content, /AgentTrail speech transcript text/);
    assert.match(transcriptNote.content, /Transcription engine:/);

    const receipt = await get(`/api/files/content?path=${encodeURIComponent(transcription.receipt.path)}`);
    assert.match(receipt.content, /Operation: audio-transcribe/);
    assert.match(receipt.content, /Transcription engine:/);
    assert.match(receipt.content, /Transcript characters:/);
  } finally {
    child.kill();
  }

  console.log("Audio transcription integration test passed");

  async function waitForServer(outputText) {
    const started = Date.now();
    while (Date.now() - started < 5000) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/status`);
        if (response.ok) return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error(`Server did not start:\n${outputText()}`);
  }

  function get(route) {
    return request("GET", route);
  }

  function post(route, body) {
    return request("POST", route, body);
  }

  function rawPost(route, body) {
    return rawRequest("POST", route, body);
  }

  function request(method, route, body) {
    return rawRequest(method, route, body).then(async (response) => {
      assert.equal(response.ok, true, `${method} ${route} -> ${response.status}: ${response.text}`);
      return JSON.parse(response.text);
    });
  }

  function rawRequest(method, route, body) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : "";
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: route,
        method,
        headers: body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}
      }, (res) => {
        let text = "";
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text }));
      });
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }
}
