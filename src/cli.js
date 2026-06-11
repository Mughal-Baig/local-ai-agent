"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline");
const packageMeta = require("../package.json");
const {
  defaultWorkspaceRoot,
  formatDoctorReport,
  friendlyInstallError,
  prepareFirstRunWorkspace,
  runSetupDoctor
} = require("./setup-doctor");

const COMMANDS = ["chat", "run", "pull", "list", "rm", "ps", "show", "serve", "doctor", "create", "completion"];

async function runCli(argv = process.argv.slice(2), io = process) {
  const parsed = parseCliArgs(argv);
  const command = normalizeCommand(parsed.command);
  if (parsed.options.version) {
    io.stdout.write(`${packageMeta.version}\n`);
    return;
  }
  if (parsed.options.help && (!parsed.command || command === "help")) {
    io.stdout.write(mainHelp());
    return;
  }
  if (parsed.options.help) {
    io.stdout.write(commandHelp(command));
    return;
  }

  if (!parsed.command) {
    return serveCommand(parsed.options, io);
  }

  switch (command) {
    case "chat":
      return chatCommand(parsed.args, parsed.options, io);
    case "run":
      return runCommand(parsed.args, parsed.options, io);
    case "pull":
      return pullCommand(parsed.args, parsed.options, io);
    case "list":
      return listCommand(parsed.options, io);
    case "rm":
      return rmCommand(parsed.args, parsed.options, io);
    case "ps":
      return psCommand(parsed.options, io);
    case "show":
      return showCommand(parsed.args, parsed.options, io);
    case "serve":
      return serveCommand(parsed.options, io);
    case "doctor":
      return doctorCommand(parsed.options, io);
    case "create":
      return createCommand(parsed.args, parsed.options, io);
    case "completion":
      return completionCommand(parsed.args, io);
    case "help":
      io.stdout.write(mainHelp());
      return;
    default: {
      const error = new Error(`Unknown command "${parsed.command}". Run agenttrail --help.`);
      error.exitCode = 2;
      throw error;
    }
  }
}

function parseCliArgs(argv) {
  const options = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "-v" || arg === "--version") {
      options.version = true;
    } else if (arg === "--json" || arg === "--format=json") {
      options.json = true;
    } else if (arg === "--no-stream") {
      options.noStream = true;
    } else if (arg === "--unsafe") {
      options.securityMode = false;
    } else if (arg === "-u" || arg === "--url") {
      options.url = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--url=")) {
      options.url = arg.slice("--url=".length);
    } else if (arg === "--host") {
      options.host = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--host=")) {
      options.host = arg.slice("--host=".length);
    } else if (arg === "--port") {
      options.port = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--port=")) {
      options.port = arg.slice("--port=".length);
    } else if (arg === "-w" || arg === "--workspace") {
      options.workspace = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--workspace=")) {
      options.workspace = arg.slice("--workspace=".length);
    } else if (arg === "--ollama-host") {
      options.ollamaHost = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--ollama-host=")) {
      options.ollamaHost = arg.slice("--ollama-host=".length);
    } else if (arg === "--skip-ollama") {
      options.skipOllama = true;
    } else if (arg === "-p" || arg === "--prompt") {
      options.prompt = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--prompt=")) {
      options.prompt = arg.slice("--prompt=".length);
    } else if (arg === "-m" || arg === "--model") {
      options.model = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--model=")) {
      options.model = arg.slice("--model=".length);
    } else if (arg === "-f" || arg === "--file") {
      options.file = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--file=")) {
      options.file = arg.slice("--file=".length);
    } else if (arg === "--source") {
      options.source = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--source=")) {
      options.source = arg.slice("--source=".length);
    } else if (arg === "--name") {
      options.name = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--name=")) {
      options.name = arg.slice("--name=".length);
    } else if (arg === "--tags") {
      options.tags = requireValue(argv, i += 1, arg);
    } else if (arg.startsWith("--tags=")) {
      options.tags = arg.slice("--tags=".length);
    } else if (arg.startsWith("-")) {
      const error = new Error(`Unknown option "${arg}".`);
      error.exitCode = 2;
      throw error;
    } else {
      positionals.push(arg);
    }
  }
  return { command: positionals[0] || "", args: positionals.slice(1), options };
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    const error = new Error(`${flag} requires a value.`);
    error.exitCode = 2;
    throw error;
  }
  return value;
}

function normalizeCommand(value) {
  const command = String(value || "").toLowerCase();
  return {
    ls: "list",
    models: "list",
    delete: "rm",
    remove: "rm",
    repl: "chat",
    completions: "completion",
    complete: "completion",
    "-h": "help",
    "--help": "help"
  }[command] || command;
}

async function chatCommand(args, options, io) {
  const baseUrl = baseUrlFromOptions(options);
  const prompt = await resolvePrompt(args, options, io);
  const model = String(options.model || "").trim();
  const selectedFiles = splitCsv(options.file).slice(0, 8);
  if (!prompt) {
    return interactiveChat(model, selectedFiles, baseUrl, options, io);
  }
  const result = await sendChatPrompt(baseUrl, {
    ...(model ? { model } : {}),
    messages: [{ role: "user", content: prompt }],
    selectedFiles,
    permissions: { readFiles: selectedFiles.length > 0, previewWrites: true, writeFiles: false },
    securityMode: options.securityMode !== false
  }, options, io);
  if (options.json) {
    writeJson(io, {
      ok: result.ok,
      model: model || "auto",
      prompt,
      selectedFiles,
      response: result.text,
      events: result.events
    });
  } else if (!result.text.endsWith("\n")) {
    io.stdout.write("\n");
  }
}

async function runCommand(args, options, io) {
  const model = args[0];
  if (!model) {
    throw usageError("agenttrail run requires a model name.");
  }
  const prompt = await resolvePrompt(args.slice(1), options, io);
  const baseUrl = baseUrlFromOptions(options);
  if (!prompt) {
    return interactiveRun(model, baseUrl, options, io);
  }
  const result = await sendChatPrompt(baseUrl, {
    model,
    messages: [{ role: "user", content: prompt }],
    selectedFiles: [],
    permissions: {},
    securityMode: options.securityMode !== false
  }, options, io);
  if (options.json) {
    writeJson(io, {
      ok: result.ok,
      model,
      prompt,
      response: result.text,
      events: result.events
    });
  } else if (!result.text.endsWith("\n")) {
    io.stdout.write("\n");
  }
}

async function interactiveChat(initialModel, initialFiles, baseUrl, options, io) {
  if (!io.stdin.isTTY) {
    throw usageError("No prompt provided. Pass text, use --prompt, or pipe stdin.");
  }
  const rl = readline.createInterface({ input: io.stdin, output: io.stdout, prompt: "agenttrail> " });
  const messages = [];
  let model = String(initialModel || "").trim();
  const selectedFiles = [...initialFiles];
  io.stdout.write("AgentTrail chat REPL. Type /help for commands or /exit to quit.\n");
  rl.prompt();
  for await (const line of rl) {
    const prompt = line.trim();
    if (!prompt) {
      rl.prompt();
      continue;
    }
    const handled = await handleChatSlashCommand(prompt, { selectedFiles, modelRef: { get: () => model, set: (value) => { model = value; } } }, io);
    if (handled === "exit") break;
    if (handled === "clear") {
      messages.length = 0;
      rl.prompt();
      continue;
    }
    if (handled) {
      rl.prompt();
      continue;
    }
    messages.push({ role: "user", content: prompt });
    const result = await sendChatPrompt(baseUrl, {
      ...(model ? { model } : {}),
      messages,
      selectedFiles,
      permissions: { readFiles: selectedFiles.length > 0, previewWrites: true, writeFiles: false },
      securityMode: options.securityMode !== false
    }, { ...options, json: false }, io);
    messages.push({ role: "assistant", content: result.text });
    if (!result.text.endsWith("\n")) io.stdout.write("\n");
    rl.prompt();
  }
  rl.close();
}

async function handleChatSlashCommand(prompt, state, io) {
  const [command, ...rest] = prompt.split(/\s+/);
  const name = command.toLowerCase();
  if (["/bye", "/exit", "/quit"].includes(name)) {
    return "exit";
  }
  if (name === "/help") {
    io.stdout.write([
      "Commands:",
      "  /model <name>   Set the model for following turns",
      "  /file <path>    Add a workspace file to selected context",
      "  /files          Show selected files",
      "  /clear          Clear conversation history on the next prompt",
      "  /exit           Quit"
    ].join("\n") + "\n");
    return true;
  }
  if (name === "/model") {
    const value = rest.join(" ").trim();
    state.modelRef.set(value);
    io.stdout.write(`Model: ${value || "auto"}\n`);
    return true;
  }
  if (name === "/file") {
    const value = rest.join(" ").trim();
    if (value && !state.selectedFiles.includes(value)) {
      state.selectedFiles.push(value);
    }
    io.stdout.write(`Files: ${state.selectedFiles.join(", ") || "none"}\n`);
    return true;
  }
  if (name === "/files") {
    io.stdout.write(`Files: ${state.selectedFiles.join(", ") || "none"}\n`);
    return true;
  }
  if (name === "/clear") {
    io.stdout.write("Conversation cleared.\n");
    return "clear";
  }
  return prompt.startsWith("/") ? false : false;
}

async function interactiveRun(model, baseUrl, options, io) {
  if (!io.stdin.isTTY) {
    throw usageError("No prompt provided. Pass text, use --prompt, or pipe stdin.");
  }
  const rl = readline.createInterface({ input: io.stdin, output: io.stdout, prompt: ">>> " });
  const messages = [];
  io.stdout.write(`AgentTrail REPL using ${model}. Type /bye or /exit to quit.\n`);
  rl.prompt();
  for await (const line of rl) {
    const prompt = line.trim();
    if (!prompt) {
      rl.prompt();
      continue;
    }
    if (["/bye", "/exit", "/quit"].includes(prompt.toLowerCase())) {
      break;
    }
    messages.push({ role: "user", content: prompt });
    const result = await sendChatPrompt(baseUrl, {
      model,
      messages,
      selectedFiles: [],
      permissions: {},
      securityMode: options.securityMode !== false
    }, { ...options, json: false }, io);
    messages.push({ role: "assistant", content: result.text });
    if (!result.text.endsWith("\n")) io.stdout.write("\n");
    rl.prompt();
  }
  rl.close();
}

async function resolvePrompt(promptArgs, options, io) {
  if (options.prompt !== undefined) return String(options.prompt);
  if (promptArgs.length) return promptArgs.join(" ");
  if (io.stdin && io.stdin.isTTY === false) {
    return (await readStream(io.stdin)).trim();
  }
  return "";
}

async function sendChatPrompt(baseUrl, payload, options, io) {
  const events = [];
  let text = "";
  let ok = true;
  await requestSse(baseUrl, "/api/chat", payload, (event, data) => {
    events.push({ event, data });
    if (event === "token") {
      const chunk = String(data.text || "");
      text += chunk;
      if (!options.json) io.stdout.write(chunk);
    } else if (event === "error" || event === "cancelled" || event === "timeout") {
      ok = false;
      if (!options.json) io.stderr.write(`${data.message || "Run failed."}\n`);
    } else if (event === "done" && data.ok === false) {
      ok = false;
    }
  });
  return { ok, text, events };
}

async function pullCommand(args, options, io) {
  const name = args[0] || options.name || "";
  const baseUrl = baseUrlFromOptions(options);
  const route = options.source ? "/api/model-registry/pull" : "/api/models/pull";
  const payload = options.source ? { name: name || undefined, source: options.source } : { name };
  if (!payload.name && !payload.source) {
    throw usageError("agenttrail pull requires a model name or --source.");
  }
  const events = [];
  await requestSse(baseUrl, route, payload, (event, data) => {
    events.push({ event, data });
    if (!options.json && event === "progress") {
      const percent = data.percent === null || data.percent === undefined ? "" : ` ${data.percent}%`;
      io.stdout.write(`${data.status || "pulling"}${percent}\n`);
    }
    if (!options.json && event === "done") {
      io.stdout.write(`Pulled ${data.name || (data.model && data.model.name) || name || options.source}\n`);
    }
    if (!options.json && event === "error") {
      io.stderr.write(`${data.message || "Pull failed."}\n`);
    }
  });
  const done = events.find((entry) => entry.event === "done");
  const error = events.find((entry) => entry.event === "error");
  if (options.json) {
    writeJson(io, { ok: Boolean(done) && !error, name, source: options.source || "", events });
  }
  if (error) {
    throw new Error(error.data.message || "Pull failed.");
  }
}

async function listCommand(options, io) {
  const data = await requestJson(baseUrlFromOptions(options), "/api/models");
  if (options.json) {
    writeJson(io, data);
    return;
  }
  const rows = [
    ...data.models.map((model) => ["ollama", model.name, formatBytes(model.size || 0), model.scores && model.scores.overall]),
    ...data.registryModels.map((model) => ["registry", model.name, formatBytes(model.size || 0), model.scores && model.scores.overall])
  ];
  printTable(io, ["SOURCE", "NAME", "SIZE", "SCORE"], rows);
}

async function rmCommand(args, options, io) {
  const name = args[0];
  if (!name) throw usageError("agenttrail rm requires a model name.");
  const data = await requestJson(baseUrlFromOptions(options), "/api/models/delete", {
    method: "POST",
    body: { name }
  });
  if (options.json) writeJson(io, data);
  else io.stdout.write(`Removed ${data.name || name}\n`);
}

async function psCommand(options, io) {
  const baseUrl = baseUrlFromOptions(options);
  const [status, concurrency] = await Promise.all([
    requestJson(baseUrl, "/api/status"),
    requestJson(baseUrl, "/api/concurrency")
  ]);
  const running = [{
    model: status.defaults && status.defaults.model,
    backend: status.backend && status.backend.id,
    host: status.backend && status.backend.host,
    active: concurrency.active,
    queued: concurrency.queued
  }];
  const data = { ok: true, running, concurrency };
  if (options.json) {
    writeJson(io, data);
  } else {
    printTable(io, ["MODEL", "BACKEND", "ACTIVE", "QUEUED"], running.map((row) => [row.model, row.backend, row.active, row.queued]));
  }
}

async function showCommand(args, options, io) {
  const name = args[0];
  if (!name) throw usageError("agenttrail show requires a model name.");
  const baseUrl = baseUrlFromOptions(options);
  const registry = await tryRequestJson(baseUrl, `/api/model-registry/show?name=${encodeURIComponent(name)}`);
  if (registry && registry.ok) {
    if (options.json) writeJson(io, registry.model);
    else printObject(io, registry.model);
    return;
  }
  const listed = await requestJson(baseUrl, "/api/models");
  const model = [...listed.models, ...listed.registryModels].find((entry) => entry.name === name);
  if (!model) {
    const error = new Error(`Model not found: ${name}`);
    error.exitCode = 1;
    throw error;
  }
  if (options.json) writeJson(io, model);
  else printObject(io, model);
}

async function createCommand(args, options, io) {
  const name = args[0] || options.name;
  if (!name) throw usageError("agenttrail create requires a model name.");
  const file = path.resolve(options.file || args[1] || "Modelfile");
  const spec = await fsp.readFile(file, "utf8");
  const body = {
    name,
    spec,
    tags: splitTags(options.tags)
  };
  const data = await requestJson(baseUrlFromOptions(options), "/api/model-registry/create", {
    method: "POST",
    body
  });
  if (options.json) writeJson(io, data);
  else io.stdout.write(`Created ${data.model.name} from ${path.basename(file)}\n`);
}

async function serveCommand(options, io = process) {
  if (options.port) process.env.PORT = String(options.port);
  if (options.host) process.env.HOST = String(options.host);
  if (options.workspace) process.env.WORKSPACE_ROOT = path.resolve(options.workspace);
  if (!process.env.WORKSPACE_ROOT) {
    process.env.WORKSPACE_ROOT = defaultWorkspaceRoot(process.env, process.cwd());
  }
  process.env.AGENTTRAIL_HEADLESS = process.env.AGENTTRAIL_HEADLESS || "1";
  try {
    const firstRun = await prepareFirstRunWorkspace({
      env: process.env,
      cwd: process.cwd(),
      workspaceRoot: process.env.WORKSPACE_ROOT
    });
    const port = process.env.PORT || "4173";
    const host = process.env.HOST || "127.0.0.1";
    const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
    io.stdout.write([
      "AgentTrail first-run path is ready.",
      `Workspace: ${firstRun.workspaceRoot}`,
      `Starter note: ${path.relative(firstRun.workspaceRoot, firstRun.welcomePath)}`,
      `Open: http://${displayHost}:${port}`,
      "Run `agenttrail doctor` if setup looks unhealthy.",
      ""
    ].join("\n"));
  } catch (error) {
    error.message = friendlyInstallError(error, { workspaceRoot: process.env.WORKSPACE_ROOT });
    throw error;
  }
  require("../server");
}

async function doctorCommand(options, io) {
  const workspaceRoot = options.workspace
    ? path.resolve(options.workspace)
    : (process.env.WORKSPACE_ROOT || defaultWorkspaceRoot(process.env, process.cwd()));
  const report = await runSetupDoctor({
    env: process.env,
    cwd: process.cwd(),
    host: options.host,
    port: options.port,
    workspaceRoot,
    ollamaHost: options.ollamaHost,
    model: options.model,
    skipOllama: options.skipOllama
  });
  if (options.json) {
    writeJson(io, report);
  } else {
    io.stdout.write(formatDoctorReport(report));
  }
}

function completionCommand(args, io) {
  const shell = String(args[0] || "bash").toLowerCase();
  io.stdout.write(completionScript(shell));
}

function baseUrlFromOptions(options = {}) {
  const explicit = options.url || process.env.AGENTTRAIL_URL;
  if (explicit) return trimTrailingSlash(explicit);
  const host = options.host || process.env.AGENTTRAIL_HOST || process.env.HOST || "127.0.0.1";
  const port = options.port || process.env.AGENTTRAIL_PORT || process.env.PORT || "4173";
  return `http://${host}:${port}`;
}

async function requestJson(baseUrl, route, options = {}) {
  let response;
  try {
    response = await fetch(`${trimTrailingSlash(baseUrl)}${route}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    throw new Error(`${friendlyInstallError(error)}\nStart AgentTrail with: agenttrail\nOr inspect setup with: agenttrail doctor`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${route} failed with HTTP ${response.status}: ${text}`);
  }
  return JSON.parse(text || "{}");
}

async function tryRequestJson(baseUrl, route) {
  try {
    return await requestJson(baseUrl, route);
  } catch {
    return null;
  }
}

async function requestSse(baseUrl, route, body, onEvent) {
  let response;
  try {
    response = await fetch(`${trimTrailingSlash(baseUrl)}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new Error(`${friendlyInstallError(error)}\nCould not reach AgentTrail at ${baseUrl}.\nStart it with: agenttrail\nOr inspect setup with: agenttrail doctor`);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${route} failed with HTTP ${response.status}: ${text}`);
  }
  if (!response.body) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      parseSseText(block, onEvent);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) parseSseText(buffer, onEvent);
}

function parseSseText(text, onEvent) {
  for (const block of String(text || "").split(/\n\n+/)) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines = [];
    for (const line of block.split(/\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) continue;
    let data = {};
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      data = { text: dataLines.join("\n") };
    }
    onEvent(event, data);
  }
}

function readStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

function writeJson(io, value) {
  io.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printTable(io, headers, rows) {
  const normalized = rows.map((row) => row.map((value) => value === undefined || value === null ? "" : String(value)));
  const widths = headers.map((header, index) => Math.max(String(header).length, ...normalized.map((row) => row[index].length)));
  io.stdout.write(`${headers.map((header, index) => String(header).padEnd(widths[index])).join("  ")}\n`);
  for (const row of normalized) {
    io.stdout.write(`${row.map((value, index) => value.padEnd(widths[index])).join("  ")}\n`);
  }
}

function printObject(io, value) {
  const lines = [];
  flattenObject(value, "", lines);
  for (const [key, item] of lines) {
    io.stdout.write(`${key}: ${item}\n`);
  }
}

function flattenObject(value, prefix, lines) {
  if (Array.isArray(value)) {
    lines.push([prefix || "value", value.join(", ")]);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      flattenObject(item, prefix ? `${prefix}.${key}` : key, lines);
    }
    return;
  }
  lines.push([prefix || "value", value === undefined || value === null ? "" : String(value)]);
}

function splitTags(value) {
  return String(value || "").split(/[,\s]+/).map((tag) => tag.trim()).filter(Boolean);
}

function splitCsv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = size;
  let unit = 0;
  while (n >= 1024 && unit < units.length - 1) {
    n /= 1024;
    unit += 1;
  }
  return `${n >= 10 || unit === 0 ? Math.round(n) : n.toFixed(1)} ${units[unit]}`;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function usageError(message) {
  const error = new Error(`${message}\nRun agenttrail --help for usage.`);
  error.exitCode = 2;
  return error;
}

function mainHelp() {
  return [
    "agenttrail - local AI agent CLI",
    "",
    "Usage:",
    "  agenttrail serve [--host 127.0.0.1] [--port 4173]",
    "  agenttrail chat [prompt...] [--model <model>] [--file path] [--json]",
    "  agenttrail run <model> [prompt...] [--json]",
    "  agenttrail pull <model> [--json]",
    "  agenttrail list [--json]",
    "  agenttrail rm <model> [--json]",
    "  agenttrail ps [--json]",
    "  agenttrail show <model> [--json]",
    "  agenttrail doctor [--workspace path] [--json]",
    "  agenttrail create <name> -f Modelfile [--json]",
    "  agenttrail completion <bash|zsh|fish>",
    "",
    "Global options:",
    "  -u, --url <url>       AgentTrail server URL (default http://127.0.0.1:4173)",
    "  -w, --workspace <dir> Workspace root for serve/doctor",
    "      --json            Print machine-readable JSON",
    "  -p, --prompt <text>   Non-interactive prompt for chat/run",
    "  -m, --model <name>    Model for chat",
    "  -h, --help            Show help",
    "  -v, --version         Print version",
    ""
  ].join("\n");
}

function commandHelp(command) {
  const help = {
    chat: "Usage: agenttrail chat [prompt...] [--model name] [--file path] [--json]\nStarts a model-optional chat REPL when no prompt/stdin is provided.\n",
    run: "Usage: agenttrail run <model> [prompt...] [--prompt text] [--json]\nStarts a REPL when no prompt/stdin is provided.\n",
    pull: "Usage: agenttrail pull <model> [--json]\nUse --source <file|url|hf://...> to pull into the AgentTrail model registry.\n",
    list: "Usage: agenttrail list [--json]\nLists Ollama and AgentTrail registry models.\n",
    rm: "Usage: agenttrail rm <model> [--json]\nRemoves an Ollama-managed model.\n",
    ps: "Usage: agenttrail ps [--json]\nShows active/queued AgentTrail model work.\n",
    show: "Usage: agenttrail show <model> [--json]\nShows Ollama or AgentTrail registry model metadata.\n",
    serve: "Usage: agenttrail serve [--host 127.0.0.1] [--port 4173]\nStarts the headless AgentTrail API/UI server.\n",
    doctor: "Usage: agenttrail doctor [--workspace dir] [--ollama-host url] [--model name] [--json]\nChecks Node, workspace, disk, port, Ollama, and model readiness.\n",
    create: "Usage: agenttrail create <name> -f Modelfile [--tags a,b] [--json]\nCreates an AgentTrail registry model manifest from a build file.\n",
    completion: "Usage: agenttrail completion <bash|zsh|fish>\nPrints shell completion script.\n"
  };
  return help[command] || mainHelp();
}

function completionScript(shell) {
  const words = COMMANDS.join(" ");
  if (shell === "zsh") {
    return `#compdef agenttrail\n_arguments '1:command:(${words})' '*::arg:->args'\n`;
  }
  if (shell === "fish") {
    return COMMANDS.map((command) => `complete -c agenttrail -f -a ${command}`).join("\n") + "\n";
  }
  return [
    "_agenttrail() {",
    "  local cur",
    "  COMPREPLY=()",
    "  cur=\"${COMP_WORDS[COMP_CWORD]}\"",
    `  COMPREPLY=( $(compgen -W "${words}" -- "$cur") )`,
    "}",
    "complete -F _agenttrail agenttrail",
    ""
  ].join("\n");
}

module.exports = {
  runCli,
  parseCliArgs,
  parseSseText,
  baseUrlFromOptions,
  completionScript
};
