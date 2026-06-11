"use strict";

const fsp = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const MIN_NODE_MAJOR = 20;
const MIN_FREE_BYTES = 64 * 1024 * 1024;
const DEFAULT_PORT = 4173;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2";

function defaultWorkspaceRoot(env = process.env, cwd = process.cwd()) {
  if (env.WORKSPACE_ROOT) return path.resolve(cwd, env.WORKSPACE_ROOT);
  if (env.AGENTTRAIL_WORKSPACE_ROOT) return path.resolve(cwd, env.AGENTTRAIL_WORKSPACE_ROOT);
  return path.resolve(cwd, "agenttrail-workspace");
}

async function prepareFirstRunWorkspace(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const workspaceRoot = path.resolve(options.workspaceRoot || defaultWorkspaceRoot(env, cwd));
  await fsp.mkdir(workspaceRoot, { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, ".agenttrail"), { recursive: true });
  await fsp.mkdir(path.join(workspaceRoot, "notes"), { recursive: true });
  const welcomePath = path.join(workspaceRoot, "notes", "first-run.md");
  let welcomeCreated = false;
  try {
    await fsp.access(welcomePath);
  } catch {
    welcomeCreated = true;
    await fsp.writeFile(welcomePath, [
      "# AgentTrail First Run",
      "",
      "Ask AgentTrail to search this workspace, improve this note, and show a diff before applying.",
      "",
      "Expected loop: search -> diff preview -> Apply -> receipt -> report.",
      ""
    ].join("\n"), "utf8");
  }
  return {
    workspaceRoot,
    welcomePath,
    welcomeCreated
  };
}

async function runSetupDoctor(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const host = String(options.host || env.AGENTTRAIL_HOST || env.HOST || DEFAULT_HOST);
  const port = normalizePort(options.port || env.AGENTTRAIL_PORT || env.PORT || DEFAULT_PORT);
  const ollamaHost = trimTrailingSlash(options.ollamaHost || env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST);
  const model = String(options.model || env.OLLAMA_MODEL || DEFAULT_MODEL);
  const workspaceRoot = path.resolve(options.workspaceRoot || defaultWorkspaceRoot(env, cwd));
  const checks = [];

  checks.push(checkNodeVersion(process.version));
  checks.push(await checkWorkspace(workspaceRoot));
  checks.push(await checkDiskSpace(workspaceRoot));
  checks.push(await checkPort(host, port));

  if (options.skipOllama || env.AGENTTRAIL_DOCTOR_SKIP_OLLAMA === "1") {
    checks.push({
      id: "ollama",
      ok: true,
      level: "skipped",
      title: "Ollama check skipped",
      message: "Skipped because AGENTTRAIL_DOCTOR_SKIP_OLLAMA=1 or --skip-ollama was set.",
      action: "Run without --skip-ollama before publishing install instructions."
    });
    checks.push({
      id: "model",
      ok: true,
      level: "skipped",
      title: "Model check skipped",
      message: `Skipped model availability check for ${model}.`,
      action: `Run ollama pull ${model} when using the Ollama backend.`
    });
  } else {
    const ollama = await checkOllama(ollamaHost);
    checks.push(ollama.check);
    checks.push(checkModel(model, ollama.models, ollama.available));
  }

  const failed = checks.filter((check) => !check.ok && check.level !== "warn");
  const warnings = checks.filter((check) => check.level === "warn");
  const passed = checks.filter((check) => check.ok && check.level !== "skipped");
  const score = Math.round((passed.length / Math.max(1, checks.filter((check) => check.level !== "skipped").length)) * 100);

  return {
    schema: "agenttrail.setup-doctor.v1",
    ok: failed.length === 0,
    score,
    host,
    port,
    url: `http://${host === "0.0.0.0" ? DEFAULT_HOST : host}:${port}`,
    workspaceRoot,
    ollamaHost,
    model,
    summary: failed.length
      ? `${failed.length} blocking setup check(s), ${warnings.length} warning(s).`
      : warnings.length
        ? `Ready with ${warnings.length} warning(s).`
        : "Ready to start AgentTrail.",
    checks
  };
}

function formatDoctorReport(report) {
  const lines = [
    `AgentTrail setup doctor: ${report.ok ? "ready" : "needs attention"} (${report.score}/100)`,
    `URL: ${report.url}`,
    `Workspace: ${report.workspaceRoot}`,
    ""
  ];
  for (const check of report.checks) {
    const marker = check.ok ? "OK" : check.level === "warn" ? "WARN" : "FIX";
    lines.push(`${marker} ${check.title}`);
    lines.push(`   ${check.message}`);
    if (check.action) lines.push(`   Next: ${check.action}`);
  }
  lines.push("");
  return lines.join("\n");
}

function friendlyInstallError(error, context = {}) {
  const code = error && error.code;
  if (code === "EADDRINUSE") {
    const port = context.port || DEFAULT_PORT;
    return [
      `Port ${port} is already in use, so AgentTrail could not start.`,
      `Try: agenttrail serve --port ${Number(port) + 1}`,
      "Or stop the process using that port, then run: agenttrail doctor"
    ].join("\n");
  }
  if (code === "EACCES" || code === "EPERM") {
    return [
      "AgentTrail does not have permission to create or write its workspace.",
      `Workspace: ${context.workspaceRoot || "not set"}`,
      "Try a writable folder: WORKSPACE_ROOT=$HOME/AgentTrail/workspace agenttrail"
    ].join("\n");
  }
  if (code === "ENOENT") {
    return [
      "A required install path was not found.",
      "Run: agenttrail doctor",
      error.message || String(error)
    ].join("\n");
  }
  if (error && /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(error.message || "")) {
    return [
      "AgentTrail could not reach the local model runtime.",
      "For Ollama: run `ollama serve`, then `ollama pull llama3.2`.",
      "Then run: agenttrail doctor"
    ].join("\n");
  }
  return error && error.message ? error.message : String(error);
}

function checkNodeVersion(version) {
  const major = Number(String(version || "").replace(/^v/, "").split(".")[0]);
  const ok = Number.isFinite(major) && major >= MIN_NODE_MAJOR;
  return {
    id: "node",
    ok,
    level: ok ? "pass" : "fail",
    title: "Node.js version",
    message: ok ? `Node ${version} is supported.` : `Node ${version || "unknown"} is too old.`,
    action: ok ? "" : "Install Node.js 20 or newer, then rerun agenttrail doctor."
  };
}

async function checkWorkspace(workspaceRoot) {
  try {
    await prepareFirstRunWorkspace({ workspaceRoot });
    const probePath = path.join(workspaceRoot, ".agenttrail", "doctor-write-test.tmp");
    await fsp.writeFile(probePath, "ok\n", "utf8");
    await fsp.rm(probePath, { force: true });
    return {
      id: "workspace",
      ok: true,
      level: "pass",
      title: "Workspace writable",
      message: `Workspace is ready at ${workspaceRoot}.`,
      action: ""
    };
  } catch (error) {
    return {
      id: "workspace",
      ok: false,
      level: "fail",
      title: "Workspace writable",
      message: friendlyInstallError(error, { workspaceRoot }),
      action: "Choose a writable folder with WORKSPACE_ROOT=/path/to/workspace agenttrail."
    };
  }
}

async function checkDiskSpace(workspaceRoot) {
  try {
    const target = await nearestExistingPath(workspaceRoot);
    if (typeof fsp.statfs !== "function") {
      return {
        id: "disk",
        ok: true,
        level: "warn",
        title: "Disk space",
        message: "Node.js could not report filesystem space on this platform.",
        action: "Keep at least 64 MB free for receipts, reports, and indexes."
      };
    }
    const stats = await fsp.statfs(target);
    const freeBytes = Number(stats.bavail || stats.bfree || 0) * Number(stats.bsize || 0);
    const ok = freeBytes >= MIN_FREE_BYTES;
    return {
      id: "disk",
      ok,
      level: ok ? "pass" : "fail",
      title: "Disk space",
      message: `${formatBytes(freeBytes)} available near ${target}.`,
      action: ok ? "" : "Free at least 64 MB before starting AgentTrail."
    };
  } catch (error) {
    return {
      id: "disk",
      ok: false,
      level: "fail",
      title: "Disk space",
      message: error.message,
      action: "Check workspace permissions and available disk space."
    };
  }
}

async function checkPort(host, port) {
  const health = await tryHealth(`http://${host === "0.0.0.0" ? DEFAULT_HOST : host}:${port}`);
  if (health.ok) {
    return {
      id: "port",
      ok: true,
      level: "pass",
      title: "Port availability",
      message: `AgentTrail is already responding on port ${port}.`,
      action: ""
    };
  }
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      resolve({
        id: "port",
        ok: false,
        level: "fail",
        title: "Port availability",
        message: friendlyInstallError(error, { port }),
        action: `Use another port: agenttrail serve --port ${Number(port) + 1}`
      });
    });
    probe.once("listening", () => {
      probe.close(() => resolve({
        id: "port",
        ok: true,
        level: "pass",
        title: "Port availability",
        message: `Port ${port} is available on ${host}.`,
        action: ""
      }));
    });
    probe.listen(port, host);
  });
}

async function checkOllama(ollamaHost) {
  try {
    const response = await fetchWithTimeout(`${ollamaHost}/api/tags`, {}, 1800);
    if (!response.ok) {
      return {
        available: false,
        models: [],
        check: {
          id: "ollama",
          ok: false,
          level: "fail",
          title: "Ollama reachable",
          message: `Ollama responded with HTTP ${response.status} at ${ollamaHost}.`,
          action: "Run ollama serve, or set OLLAMA_HOST to the correct local endpoint."
        }
      };
    }
    const data = await response.json().catch(() => ({}));
    const models = Array.isArray(data.models) ? data.models.map((model) => model.name).filter(Boolean) : [];
    return {
      available: true,
      models,
      check: {
        id: "ollama",
        ok: true,
        level: "pass",
        title: "Ollama reachable",
        message: `Connected to ${ollamaHost}.`,
        action: ""
      }
    };
  } catch (error) {
    return {
      available: false,
      models: [],
      check: {
        id: "ollama",
        ok: false,
        level: "fail",
        title: "Ollama reachable",
        message: friendlyInstallError(error),
        action: "Install/start Ollama, then run: ollama pull llama3.2"
      }
    };
  }
}

function checkModel(model, models, ollamaAvailable) {
  if (!ollamaAvailable) {
    return {
      id: "model",
      ok: false,
      level: "fail",
      title: "Default model available",
      message: `Could not check ${model} because Ollama is not reachable.`,
      action: "Start Ollama, then run: ollama pull llama3.2"
    };
  }
  const ok = models.includes(model) || models.includes(`${model}:latest`);
  return {
    id: "model",
    ok,
    level: ok ? "pass" : "fail",
    title: "Default model available",
    message: ok ? `${model} is installed.` : `${model} is not installed. Installed models: ${models.join(", ") || "none"}.`,
    action: ok ? "" : `Run: ollama pull ${model}`
  };
}

async function tryHealth(baseUrl) {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/health`, {}, 250);
    if (!response.ok) return { ok: false };
    const data = await response.json().catch(() => ({}));
    return { ok: data.ok !== false };
  } catch {
    return { ok: false };
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function nearestExistingPath(target) {
  let current = path.resolve(target);
  while (current && current !== path.dirname(current)) {
    try {
      await fsp.access(current);
      return current;
    } catch {
      current = path.dirname(current);
    }
  }
  return os.homedir();
}

function normalizePort(value) {
  const port = Number(value || DEFAULT_PORT);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_PORT;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function formatBytes(value) {
  const size = Number(value || 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = size;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 || unit === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`;
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_HOST,
  DEFAULT_PORT,
  defaultWorkspaceRoot,
  formatDoctorReport,
  friendlyInstallError,
  prepareFirstRunWorkspace,
  runSetupDoctor
};
