#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const port = 5300 + Math.floor(Math.random() * 400);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-ui-e2e-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(() => output);
    const playwright = await optionalPlaywright();
    if (playwright) {
      await runPlaywrightE2e(playwright);
    } else {
      await runHttpUiContract();
    }
    console.log("UI E2E tests passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function runPlaywrightE2e(playwright) {
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.locator("text=AgentTrail").first().waitFor({ timeout: 5000 });
    await page.locator("#workspaceSearch").fill("welcome");
    await page.locator("#workspaceSearch").press("Enter");
    await page.locator("#trustScore").waitFor({ timeout: 5000 });
    await page.locator("#refreshTeam").click();
    await page.locator("#teamSummary").waitFor({ timeout: 5000 });
    const teamText = await page.locator("#teamSummary").innerText();
    assert.match(teamText, /Owner|Role/i);
  } finally {
    await browser.close();
  }
}

async function runHttpUiContract() {
  const html = await fetchText("/");
  const app = await fetchText("/app.js");
  const styles = await fetchText("/styles.css");
  const status = await fetchJson("/api/status");
  const team = await fetchJson("/api/team/status");
  const observability = await fetchJson("/api/observability");

  assert.match(html, /AgentTrail/);
  assert.match(html, /workspaceSearch/);
  assert.match(html, /teamUserSelect/);
  assert.match(html, /observabilitySummary/);
  assert.match(html, /Diff Review/);
  assert.match(app, /refreshTeam/);
  assert.match(app, /renderPendingChanges/);
  assert.match(app, /bindComposerAttachmentIntake/);
  assert.match(app, /startVoicePromptRecording/);
  assert.match(styles, /diff-preview/);
  assert.equal(status.app, "ok");
  assert.equal(team.schema, "agenttrail.team-status.v1");
  assert.equal(Array.isArray(observability.traces), true);
}

async function optionalPlaywright() {
  if (process.env.AGENTTRAIL_UI_HTTP_ONLY === "1") {
    return null;
  }
  try {
    return require("playwright");
  } catch {
    return null;
  }
}

async function waitForServer(getOutput) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(100);
    }
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}

async function fetchText(route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${route}`);
  }
  return response.text();
}

async function fetchJson(route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${route}`);
  }
  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
