"use strict";

const PLUGIN_SCHEMA = "agenttrail.plugin.v1";
const PLUGIN_SDK_VERSION = "0.2.0";
const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const RISK_LEVELS = ["low", "medium", "high"];
const RISK_WEIGHT = { low: 1, medium: 2, high: 3 };
const FORBIDDEN_CODE_PATTERNS = [
  { pattern: /\brequire\s*\(/, label: "require()" },
  { pattern: /\bprocess\b/, label: "process" },
  { pattern: /\bchild_process\b/, label: "child_process" },
  { pattern: /\bfs\b/, label: "fs" },
  { pattern: /\bfetch\s*\(/, label: "fetch()" },
  { pattern: /\bXMLHttpRequest\b/, label: "XMLHttpRequest" },
  { pattern: /\bWebSocket\b/, label: "WebSocket" },
  { pattern: /\beval\s*\(/, label: "eval()" },
  { pattern: /\bFunction\s*\(/, label: "Function()" }
];

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeRisk(value) {
  const risk = stringValue(value).toLowerCase();
  return RISK_LEVELS.includes(risk) ? risk : "";
}

function pushIssue(issues, path, message, severity = "error") {
  issues.push({ severity, path, message });
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizePermission(permission) {
  if (!isObject(permission)) {
    return null;
  }
  const risk = normalizeRisk(permission.risk);
  return {
    tool: stringValue(permission.tool),
    scope: stringValue(permission.scope),
    risk,
    receipt: permission.receipt === true,
    requiresApproval: permission.requiresApproval === true || risk === "medium" || risk === "high",
    network: isObject(permission.network) ? { ...permission.network } : null,
    sandbox: isObject(permission.sandbox) ? { ...permission.sandbox } : null
  };
}

function validateInlineCode(tool, pathPrefix, issues) {
  if (tool.code === undefined) {
    return;
  }
  if (typeof tool.code !== "string") {
    pushIssue(issues, `${pathPrefix}.code`, "Inline plugin code must be a string.");
    return;
  }
  if (!isObject(tool.execution) || tool.execution.runtime !== "vm") {
    pushIssue(issues, `${pathPrefix}.execution.runtime`, "Inline code tools must declare execution.runtime = \"vm\".");
  }
  if (tool.code.length > 4000) {
    pushIssue(issues, `${pathPrefix}.code`, "Inline plugin code must be 4000 characters or fewer.");
  }
  for (const item of FORBIDDEN_CODE_PATTERNS) {
    if (item.pattern.test(tool.code)) {
      pushIssue(issues, `${pathPrefix}.code`, `Inline plugin code may not reference ${item.label}.`);
    }
  }
}

function validatePluginManifest(manifest, options = {}) {
  const issues = [];
  if (!isObject(manifest)) {
    return {
      ok: false,
      issues: [{ severity: "error", path: "$", message: "Plugin manifest must be a JSON object." }],
      plugin: null
    };
  }

  if (manifest.schema !== PLUGIN_SCHEMA) {
    pushIssue(issues, "schema", `Plugin schema must be ${PLUGIN_SCHEMA}.`);
  }
  const id = stringValue(manifest.id);
  if (!PLUGIN_ID_PATTERN.test(id)) {
    pushIssue(issues, "id", "Plugin id must use lowercase letters, numbers, and hyphens.");
  }
  const title = stringValue(manifest.title);
  if (!title) {
    pushIssue(issues, "title", "Plugin title is required.");
  }
  const version = stringValue(manifest.version);
  if (!VERSION_PATTERN.test(version)) {
    pushIssue(issues, "version", "Plugin version must be semver-like, for example 0.1.0.");
  }
  const tools = Array.isArray(manifest.tools) ? manifest.tools : [];
  if (!tools.length) {
    pushIssue(issues, "tools", "Plugin must declare at least one tool.");
  }
  if (tools.length > 25) {
    pushIssue(issues, "tools", "Plugin manifests may declare at most 25 tools.");
  }
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions.map(normalizePermission).filter(Boolean) : [];
  if (!permissions.length) {
    pushIssue(issues, "permissions", "Plugin must declare at least one permission.");
  }

  const permissionByTool = new Map();
  for (const [index, permission] of permissions.entries()) {
    const pathPrefix = `permissions[${index}]`;
    if (!TOOL_NAME_PATTERN.test(permission.tool)) {
      pushIssue(issues, `${pathPrefix}.tool`, "Permission tool must match a dotted tool name.");
    }
    if (!permission.scope) {
      pushIssue(issues, `${pathPrefix}.scope`, "Permission scope is required.");
    }
    if (!permission.risk) {
      pushIssue(issues, `${pathPrefix}.risk`, "Permission risk must be low, medium, or high.");
    }
    if (permission.receipt !== true) {
      pushIssue(issues, `${pathPrefix}.receipt`, "Permission receipt must be true.");
    }
    if (permissionByTool.has(permission.tool)) {
      pushIssue(issues, `${pathPrefix}.tool`, `Duplicate permission for ${permission.tool}.`);
    }
    permissionByTool.set(permission.tool, permission);
  }

  const normalizedTools = [];
  const seenTools = new Set();
  for (const [index, rawTool] of tools.entries()) {
    const pathPrefix = `tools[${index}]`;
    if (!isObject(rawTool)) {
      pushIssue(issues, pathPrefix, "Tool must be an object.");
      continue;
    }
    const name = stringValue(rawTool.name);
    const risk = normalizeRisk(rawTool.risk);
    if (!TOOL_NAME_PATTERN.test(name)) {
      pushIssue(issues, `${pathPrefix}.name`, "Tool name must be dotted, for example receipt.summary.");
    }
    if (seenTools.has(name)) {
      pushIssue(issues, `${pathPrefix}.name`, `Duplicate tool ${name}.`);
    }
    seenTools.add(name);
    if (!stringValue(rawTool.description)) {
      pushIssue(issues, `${pathPrefix}.description`, "Tool description is required.");
    }
    if (!risk) {
      pushIssue(issues, `${pathPrefix}.risk`, "Tool risk must be low, medium, or high.");
    }
    if (rawTool.receipt !== true) {
      pushIssue(issues, `${pathPrefix}.receipt`, "Tool receipt must be true.");
    }
    validateInlineCode(rawTool, pathPrefix, issues);

    const permission = permissionByTool.get(name);
    if (!permission) {
      pushIssue(issues, `${pathPrefix}.permission`, `Tool ${name} must have a matching permission.`);
    } else if (risk && permission.risk && RISK_WEIGHT[permission.risk] < RISK_WEIGHT[risk]) {
      pushIssue(issues, `${pathPrefix}.permission`, `Permission risk for ${name} cannot be lower than tool risk.`);
    }

    normalizedTools.push({
      name,
      description: stringValue(rawTool.description),
      risk,
      receipt: rawTool.receipt === true,
      requiresApproval: (permission && permission.requiresApproval) || risk === "medium" || risk === "high",
      code: typeof rawTool.code === "string" ? rawTool.code : undefined,
      execution: isObject(rawTool.execution) ? { ...rawTool.execution } : undefined,
      permission: permission || null
    });
  }

  const ok = !issues.some((issue) => issue.severity === "error");
  const plugin = ok
    ? {
        schema: PLUGIN_SCHEMA,
        sdkVersion: PLUGIN_SDK_VERSION,
        id,
        title,
        version,
        description: stringValue(manifest.description),
        author: stringValue(manifest.author),
        tools: normalizedTools,
        permissions,
        path: options.path || stringValue(manifest.path),
        valid: true,
        issues: []
      }
    : null;

  return { ok, issues, plugin };
}

function publicPluginManifest(plugin) {
  return {
    ...plugin,
    tools: (plugin.tools || []).map((tool) => {
      const { code, ...publicTool } = tool;
      return publicTool;
    })
  };
}

module.exports = {
  PLUGIN_SCHEMA,
  PLUGIN_SDK_VERSION,
  RISK_LEVELS,
  validatePluginManifest,
  publicPluginManifest
};
