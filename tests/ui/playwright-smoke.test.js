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
    await page.locator("#toolsToggleTop").click();
    await page.locator("#themeSelect").selectOption("contrast");
    assert.equal(await page.locator("html").getAttribute("data-theme"), "contrast");
    await page.locator("#fontScaleSelect").selectOption("large");
    await page.locator("#densitySelect").selectOption("compact");
    await page.locator("#motionSelect").selectOption("reduced");
    await page.locator("#localeSelect").selectOption("es");
    assert.equal(await page.locator("html").getAttribute("lang"), "es");
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
  const manifest = await fetchText("/manifest.webmanifest");
  const serviceWorker = await fetchText("/sw.js");
  const status = await fetchJson("/api/status");
  const team = await fetchJson("/api/team/status");
  const observability = await fetchJson("/api/observability");
  const resilience = await fetchJson("/api/resilience");

  assert.match(html, /AgentTrail/);
  assert.match(html, /workspaceSearch/);
  assert.match(html, /conversationSearch/);
  assert.match(html, /conversationList/);
  assert.match(html, /conversationImportInput/);
  assert.match(html, /composerAssist/);
  assert.match(html, /composerMode/);
  assert.match(html, /teamUserSelect/);
  assert.match(html, /observabilitySummary/);
  assert.match(html, /resilienceSummary/);
  assert.match(html, /privacySummary/);
  assert.match(html, /localAnalyticsToggle/);
  assert.match(html, /themeSelect/);
  assert.match(html, /fontScaleSelect/);
  assert.match(html, /densitySelect/);
  assert.match(html, /motionSelect/);
  assert.match(html, /localeSelect/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /Diff Review/);
  assert.match(html, /role="log"/);
  assert.match(app, /refreshTeam/);
  assert.match(app, /refreshPrivacy/);
  assert.match(app, /renderResilienceSummary/);
  assert.match(app, /wipePrivacyData/);
  assert.match(app, /refreshConversations/);
  assert.match(app, /branchConversation/);
  assert.match(app, /restoreDeletedConversation/);
  assert.match(app, /editUserMessage/);
  assert.match(app, /regenerateAssistantResponse/);
  assert.match(app, /continueStoppedRun/);
  assert.match(app, /slashCommandSuggestions/);
  assert.match(app, /selectMentionedFiles/);
  assert.match(app, /copyCodeBlock/);
  assert.match(app, /renderPendingChanges/);
  assert.match(app, /bindComposerAttachmentIntake/);
  assert.match(app, /startVoicePromptRecording/);
  assert.match(app, /registerServiceWorker/);
  assert.match(app, /I18N/);
  assert.match(app, /bindAccessPreference/);
  assert.match(styles, /composer-assist/);
  assert.match(styles, /code-copy/);
  assert.match(styles, /diff-preview/);
  assert.match(styles, /\[data-theme="contrast"\]/);
  assert.match(styles, /\[data-font-scale="large"\]/);
  assert.match(styles, /\[data-motion="reduced"\]/);
  assert.match(manifest, /AgentTrail/);
  assert.match(serviceWorker, /agenttrail-shell/);
  assert.match(serviceWorker, /\/api\//);
  assert.equal(status.app, "ok");
  assert.equal(team.schema, "agenttrail.team-status.v1");
  assert.equal(resilience.schema, "agenttrail.resilience.v1");
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
