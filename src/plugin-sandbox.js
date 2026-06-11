"use strict";

const vm = require("node:vm");
const { validatePluginManifest } = require("./plugin-sdk");
const { validateNetworkEgress } = require("./network-policy");

const MAX_WEB_FETCH_BYTES = 20000;
const SHELL_OPERATOR_PATTERN = /[\n\r;&|<>`$]/;

async function runPluginTool(plugin, toolName, input = {}, options = {}) {
  if (!plugin || !Array.isArray(plugin.tools)) {
    throw new Error("Plugin manifest is invalid.");
  }
  const validation = validatePluginManifest(plugin, { path: plugin.path });
  if (!validation.ok) {
    const issue = validation.issues[0];
    throw new Error(`Plugin manifest is invalid: ${issue.path} ${issue.message}`);
  }
  const normalizedPlugin = validation.plugin;
  const tool = normalizedPlugin.tools.find((item) => item.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} was not found in plugin ${normalizedPlugin.id}.`);
  }
  if (!tool.permission || tool.permission.receipt !== true) {
    throw new Error(`${toolName} is missing a receipt-backed plugin permission.`);
  }
  const approved = options.approved === true || input.approved === true;
  if (tool.requiresApproval && approved !== true) {
    throw new Error(`${toolName} requires explicit plugin approval.`);
  }
  const cleanInput = { ...input };
  delete cleanInput.approved;
  if (toolName === "example.echo") {
    return {
      ok: true,
      tool: toolName,
      output: String(cleanInput.text || "").slice(0, 500),
      receipt: true,
      permission: {
        scope: tool.permission.scope,
        risk: tool.permission.risk,
        requiresApproval: tool.requiresApproval
      }
    };
  }
  if (toolName === "web.fetch_readonly" || toolName === "url.fetch_readonly") {
    return runReadonlyWebFetch(tool, toolName, cleanInput);
  }
  if (toolName === "calculator.evaluate") {
    return {
      ok: true,
      tool: toolName,
      output: evaluateCalculatorExpression(cleanInput.expression),
      receipt: true,
      permission: permissionResult(tool)
    };
  }
  if (toolName === "shell.preview") {
    return {
      ok: true,
      tool: toolName,
      output: previewShellCommand(cleanInput.command, tool.permission.shell),
      receipt: true,
      permission: permissionResult(tool)
    };
  }
  if (tool.code) {
    const context = vm.createContext({
      input: Object.freeze({ ...cleanInput }),
      result: null
    });
    const script = new vm.Script(`result = (function(){ ${String(tool.code)} })();`);
    const timeout = Math.min(Math.max(Number(tool.execution?.timeoutMs || 250), 10), 250);
    script.runInContext(context, { timeout });
    return {
      ok: true,
      tool: toolName,
      output: context.result,
      receipt: true,
      permission: permissionResult(tool)
    };
  }
  throw new Error(`${toolName} has no executable sandbox handler.`);
}

async function runReadonlyWebFetch(tool, toolName, input) {
  const url = String(input.url || "").trim();
  const policy = validateNetworkEgress(url, {
    allowlist: input.allowlist || tool.permission.network?.allowlist,
    allowPrivate: input.allowPrivate === true,
    requireAllowlist: tool.permission.network?.policy === "agenttrail-egress-allowlist",
    purpose: "plugin-web-fetch"
  });
  if (input.dryRun === true) {
    return {
      ok: true,
      tool: toolName,
      output: {
        dryRun: true,
        url: policy.url,
        host: policy.host,
        policy: policy.policy,
        method: "GET"
      },
      receipt: true,
      permission: permissionResult(tool)
    };
  }
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs || 5000), 500), 10000);
  const response = await fetch(policy.url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "AgentTrailPlugin/0.2" }
  });
  if (response.status >= 300 && response.status < 400) {
    const error = new Error("Plugin web fetch does not follow redirects; approve the final URL directly.");
    error.status = 403;
    throw error;
  }
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const text = await readLimitedResponseText(response, MAX_WEB_FETCH_BYTES);
  return {
    ok: true,
    tool: toolName,
    output: {
      url: policy.url,
      status: response.status,
      contentType,
      text: extractReadableText(text, contentType),
      truncated: text.length >= MAX_WEB_FETCH_BYTES
    },
    receipt: true,
    permission: permissionResult(tool)
  };
}

async function readLimitedResponseText(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }
  const chunks = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const slice = value.slice(0, Math.max(0, maxBytes - size));
    chunks.push(Buffer.from(slice));
    size += slice.length;
    if (slice.length < value.length) {
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractReadableText(text, contentType) {
  const value = String(text || "");
  if (/html/i.test(contentType)) {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  }
  return value.replace(/\s+/g, " ").trim().slice(0, 8000);
}

function evaluateCalculatorExpression(expression) {
  const parser = createExpressionParser(expression);
  const value = parser.parseExpression();
  parser.skipWhitespace();
  if (!parser.isDone()) {
    throw new Error(`Unexpected token in calculator expression near "${parser.remaining().slice(0, 12)}".`);
  }
  if (!Number.isFinite(value)) {
    throw new Error("Calculator expression produced a non-finite result.");
  }
  return {
    expression: parser.source,
    result: Number(value.toFixed(12))
  };
}

function createExpressionParser(expression) {
  const source = String(expression || "").trim();
  if (!source || source.length > 200) {
    throw new Error("Calculator expression must be 1-200 characters.");
  }
  if (!/^[\d\s+\-*/%.()]+$/.test(source)) {
    throw new Error("Calculator supports only numbers, parentheses, and + - * / % operators.");
  }
  let index = 0;
  const parser = {
    source,
    parseExpression() {
      let value = parser.parseTerm();
      while (true) {
        parser.skipWhitespace();
        const operator = source[index];
        if (operator !== "+" && operator !== "-") {
          return value;
        }
        index += 1;
        const next = parser.parseTerm();
        value = operator === "+" ? value + next : value - next;
      }
    },
    parseTerm() {
      let value = parser.parseFactor();
      while (true) {
        parser.skipWhitespace();
        const operator = source[index];
        if (operator !== "*" && operator !== "/" && operator !== "%") {
          return value;
        }
        index += 1;
        const next = parser.parseFactor();
        if ((operator === "/" || operator === "%") && next === 0) {
          throw new Error("Calculator cannot divide by zero.");
        }
        if (operator === "*") value *= next;
        if (operator === "/") value /= next;
        if (operator === "%") value %= next;
      }
    },
    parseFactor() {
      parser.skipWhitespace();
      if (source[index] === "+") {
        index += 1;
        return parser.parseFactor();
      }
      if (source[index] === "-") {
        index += 1;
        return -parser.parseFactor();
      }
      if (source[index] === "(") {
        index += 1;
        const value = parser.parseExpression();
        parser.skipWhitespace();
        if (source[index] !== ")") {
          throw new Error("Calculator expression has an unclosed parenthesis.");
        }
        index += 1;
        return value;
      }
      const match = source.slice(index).match(/^\d+(?:\.\d+)?|\.\d+/);
      if (!match) {
        throw new Error("Calculator expected a number.");
      }
      index += match[0].length;
      return Number(match[0]);
    },
    skipWhitespace() {
      while (/\s/.test(source[index] || "")) {
        index += 1;
      }
    },
    isDone() {
      return index >= source.length;
    },
    remaining() {
      return source.slice(index);
    }
  };
  return parser;
}

function previewShellCommand(command, shellPolicy = {}) {
  const tokens = normalizeShellCommand(command);
  const executable = tokens[0];
  const allowExecutables = Array.isArray(shellPolicy?.allowExecutables)
    ? shellPolicy.allowExecutables.map((item) => String(item).trim()).filter(Boolean)
    : ["git", "npm", "node", "rg"];
  const allowed = allowExecutables.includes(executable);
  return {
    previewOnly: true,
    allowed,
    command: tokens,
    executable,
    reason: allowed
      ? "Command is allowlisted for manual review; AgentTrail does not execute shell plugin previews."
      : `Executable ${executable} is not in this plugin permission allowlist.`,
    guardrails: {
      denyOperators: true,
      execution: "disabled"
    }
  };
}

function normalizeShellCommand(command) {
  const tokens = Array.isArray(command)
    ? command.map((part) => String(part || "").trim()).filter(Boolean)
    : String(command || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 12) {
    throw new Error("Shell preview needs 1-12 command tokens.");
  }
  for (const token of tokens) {
    if (SHELL_OPERATOR_PATTERN.test(token)) {
      throw new Error("Shell preview rejects control operators and command substitution.");
    }
  }
  return tokens.slice(0, 12);
}

function permissionResult(tool) {
  return {
    scope: tool.permission.scope,
    risk: tool.permission.risk,
    requiresApproval: tool.requiresApproval
  };
}

module.exports = {
  evaluateCalculatorExpression,
  previewShellCommand,
  runPluginTool
};
