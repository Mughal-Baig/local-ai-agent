#!/usr/bin/env node

const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 7600 + Math.floor(Math.random() * 200);
const mockPort = 7900 + Math.floor(Math.random() * 200);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const state = { sawPlanSchema: false, sawApprovedPlan: false, sawVisionPlan: false };
  const mock = startMockOpenAI(mockPort, state);
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-plan-"));
  await fsp.writeFile(path.join(workspaceRoot, "brief.md"), "Need a safe implementation plan.\n", "utf8");
  await fsp.mkdir(path.join(workspaceRoot, "screens"), { recursive: true });
  await fsp.writeFile(path.join(workspaceRoot, "screens", "bug.png"), Buffer.from("fake screenshot bytes"));

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
    const plan = await postJson("/api/agent/plan", {
      model: "mock-model",
      messages: [{ role: "user", content: "Update the workspace safely." }],
      selectedFiles: ["brief.md"],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.output.summary, "Inspect before editing");
    assert.equal(plan.output.steps.length, 2);
    assert.equal(state.sawPlanSchema, true, "planner should request the agent-plan JSON schema");

    const screenshotPlan = await postJson("/api/agent/plan", {
      model: "mock-model",
      messages: [{ role: "user", content: "Turn this screenshot into next actions." }],
      selectedFiles: ["screens/bug.png"],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true
    });
    assert.equal(screenshotPlan.ok, true);
    assert.equal(screenshotPlan.vision.count, 1);
    assert.equal(state.sawVisionPlan, true, "planner should attach screenshot pixels to vision-capable planning");

    const text = await streamChat({
      model: "mock-model",
      messages: [{ role: "user", content: "Update the workspace safely." }],
      selectedFiles: ["brief.md"],
      permissions: { readFiles: true, writeFiles: false, previewWrites: true },
      securityMode: true,
      approvedPlan: {
        summary: "Inspect before editing",
        steps: plan.output.steps,
        editedText: "Summary: Inspect before editing\n1. Read brief.md\n2. Preview the change",
        approvedAt: new Date().toISOString()
      }
    });
    assert.match(text, /approved plan received/i);
    assert.equal(state.sawApprovedPlan, true, "chat prompt should include the approved plan");
    console.log("Agent plan integration test passed");
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
      const messages = JSON.stringify(body.messages || []);

      if (body.response_format && body.response_format.json_schema && body.response_format.json_schema.name === "agent-plan") {
        state.sawPlanSchema = true;
        const userContent = body.messages && body.messages[1] && body.messages[1].content;
        if (Array.isArray(userContent)) {
          state.sawVisionPlan = userContent.some((part) => part.type === "image_url") &&
            userContent.some((part) => part.type === "text" && /Screenshot-to-action context/.test(part.text || ""));
        }
        return json(res, {
          choices: [{
            message: {
              content: JSON.stringify({
                summary: "Inspect before editing",
                steps: [
                  { title: "Read the selected brief", intent: "read", tool: "read_file", risk: "low", needsApproval: false },
                  { title: "Preview the proposed change", intent: "edit", tool: "preview_write_file", risk: "medium", needsApproval: true }
                ],
                warnings: ["Write permission is off, so use preview mode."],
                requiresApproval: true
              })
            }
          }]
        });
      }

      if (messages.includes("Capability probe")) {
        return json(res, { choices: [{ message: { content: "OK" } }] });
      }

      state.sawApprovedPlan = messages.includes("Approved user plan") && messages.includes("Preview the change");
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const token of ["Approved ", "plan received."]) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
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

async function postJson(endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, endpoint);
  return response.json();
}

async function streamChat(body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, "chat request should succeed");
  const raw = await response.text();
  let text = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const data = JSON.parse(line.slice(5).trim());
      if (typeof data.text === "string") text += data.text;
    } catch {
      // Ignore non-JSON data lines.
    }
  }
  return text;
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
