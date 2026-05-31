"use strict";

const { redactValueOnly } = require("./privacy");

const TOOL_PERMISSIONS = [
  {
    tool: "list_files",
    scope: "List workspace-relative file names and metadata.",
    risk: "low",
    receipt: true,
    requiresApproval: false,
    defaultEnabled: true
  },
  {
    tool: "search_workspace",
    scope: "Read workspace file snippets for search and retrieval.",
    risk: "low",
    receipt: true,
    requiresApproval: false,
    defaultEnabled: true
  },
  {
    tool: "read_file",
    scope: "Read one workspace-relative file.",
    risk: "medium",
    receipt: true,
    requiresApproval: true,
    defaultEnabled: true
  },
  {
    tool: "preview_write_file",
    scope: "Generate a diff preview for one workspace-relative file.",
    risk: "medium",
    receipt: true,
    requiresApproval: true,
    defaultEnabled: true
  },
  {
    tool: "write_file",
    scope: "Write one workspace-relative file.",
    risk: "high",
    receipt: true,
    requiresApproval: true,
    defaultEnabled: false
  },
  {
    tool: "mcp_tool",
    scope: "Call an external MCP tool through explicit approval scopes.",
    risk: "high",
    receipt: true,
    requiresApproval: true,
    defaultEnabled: false
  }
];

const DEFAULT_TOOL_POLICIES = {
  list_files: {
    schema: "agenttrail.tool-policy.v1",
    enabled: true,
    audit: "always",
    allowedPathPrefixes: ["*"],
    blockedPathPrefixes: [],
    requiresApproval: false
  },
  search_workspace: {
    schema: "agenttrail.tool-policy.v1",
    enabled: true,
    audit: "always",
    allowedPathPrefixes: ["*"],
    blockedPathPrefixes: [".agenttrail/"],
    requiresApproval: false
  },
  read_file: {
    schema: "agenttrail.tool-policy.v1",
    enabled: true,
    audit: "always",
    allowedPathPrefixes: ["*"],
    blockedPathPrefixes: [".agenttrail/"],
    requiresApproval: true
  },
  preview_write_file: {
    schema: "agenttrail.tool-policy.v1",
    enabled: true,
    audit: "always",
    allowedPathPrefixes: ["*"],
    blockedPathPrefixes: [".agenttrail/"],
    requiresApproval: true
  },
  write_file: {
    schema: "agenttrail.tool-policy.v1",
    enabled: true,
    audit: "always",
    allowedPathPrefixes: ["*"],
    blockedPathPrefixes: [".agenttrail/"],
    requiresApproval: true,
    directWriteDefault: false
  },
  mcp_tool: {
    schema: "agenttrail.tool-policy.v1",
    enabled: false,
    audit: "always",
    allowedPathPrefixes: [],
    blockedPathPrefixes: [],
    requiresApproval: true
  }
};

function permissionManifest(options = {}) {
  return TOOL_PERMISSIONS.map((item) => ({
    ...item,
    policy: resolveToolPolicy(item.tool, options.policies || {})
  }));
}

function evaluateToolPermission(tool, permissions = {}, args = {}, options = {}) {
  const definition = TOOL_PERMISSIONS.find((item) => item.tool === tool) || {
    tool,
    scope: "Unknown tool",
    risk: "high",
    receipt: true,
    requiresApproval: true,
    defaultEnabled: false
  };
  const policy = resolveToolPolicy(tool, options.policies || permissions.toolPolicies || {});
  const approved = args.approved === true || options.approved === true;

  if (policy.enabled === false) {
    return deny(definition, policy.reason || `Tool ${tool} is disabled by policy.`, policy);
  }
  const pathDecision = evaluatePathPolicy(args.path, policy);
  if (!pathDecision.ok) {
    return deny(definition, pathDecision.reason, policy);
  }
  if (tool === "read_file" && permissions.readFiles === false) {
    return deny(definition, "File read permission is disabled.", policy);
  }
  if (tool === "write_file" && permissions.writeFiles !== true) {
    return deny(definition, "File write permission is disabled.", policy);
  }
  if (tool === "write_file" && permissions.previewWrites !== false) {
    return {
      ok: true,
      action: "preview",
      definition,
      policy,
      reason: "Preview mode converts direct writes into diff previews."
    };
  }
  if ((definition.requiresApproval || policy.requiresApproval) && definition.risk === "high" && !approved && options.allowImplicitHighRisk !== true) {
    return deny(definition, `${tool} requires explicit high-risk approval.`, policy);
  }

  return {
    ok: true,
    action: "execute",
    definition,
    policy,
    reason: "Tool permission accepted."
  };
}

function deny(definition, reason, policy = null) {
  return {
    ok: false,
    action: "deny",
    definition,
    policy,
    reason
  };
}

function resolveToolPolicy(tool, overrides = {}) {
  const base = DEFAULT_TOOL_POLICIES[tool] || {
    schema: "agenttrail.tool-policy.v1",
    enabled: false,
    audit: "always",
    allowedPathPrefixes: [],
    blockedPathPrefixes: [],
    requiresApproval: true
  };
  const override = overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides[tool] || {} : {};
  return {
    ...base,
    ...override,
    allowedPathPrefixes: normalizePrefixList(override.allowedPathPrefixes || base.allowedPathPrefixes),
    blockedPathPrefixes: normalizePrefixList(override.blockedPathPrefixes || base.blockedPathPrefixes)
  };
}

function evaluatePathPolicy(relativePath, policy) {
  if (!relativePath) {
    return { ok: true };
  }
  const normalized = normalizeRelativePath(relativePath);
  for (const prefix of policy.blockedPathPrefixes || []) {
    if (prefix !== "*" && pathMatchesPrefix(normalized, prefix)) {
      return { ok: false, reason: `Path ${normalized} is blocked by the ${prefix} tool policy.` };
    }
  }
  const allowed = policy.allowedPathPrefixes || [];
  if (!allowed.length || allowed.includes("*")) {
    return { ok: true };
  }
  if (!allowed.some((prefix) => pathMatchesPrefix(normalized, prefix))) {
    return { ok: false, reason: `Path ${normalized} is outside this tool's allowed policy scope.` };
  }
  return { ok: true };
}

function permissionAuditEvent(tool, decision, args = {}, actor = "agent") {
  return {
    schema: "agenttrail.permission-audit.v1",
    createdAt: new Date().toISOString(),
    actor,
    tool,
    action: decision.action,
    ok: decision.ok === true,
    risk: decision.definition && decision.definition.risk,
    reason: decision.reason,
    scope: decision.definition && decision.definition.scope,
    policy: decision.policy || null,
    arguments: redactValueOnly(safeAuditArguments(args))
  };
}

function safeAuditArguments(args = {}) {
  const input = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "content") {
      output.contentHash = stableHash(String(value || ""));
      output.contentBytes = Buffer.byteLength(String(value || ""), "utf8");
    } else {
      output[key] = value;
    }
  }
  return output;
}

function stableHash(text) {
  let hash = 2166136261;
  const value = String(text || "");
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16)}.${value.length}`;
}

function normalizePrefixList(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[,\s]+/);
  return [...new Set(raw.map((item) => normalizeRelativePath(item)).filter(Boolean))].slice(0, 50);
}

function normalizeRelativePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  return normalized.endsWith("/") || normalized === "*" ? normalized : normalized;
}

function pathMatchesPrefix(relativePath, prefix) {
  const cleanPrefix = normalizeRelativePath(prefix);
  if (cleanPrefix === "*") {
    return true;
  }
  if (!cleanPrefix) {
    return false;
  }
  const withSlash = cleanPrefix.endsWith("/") ? cleanPrefix : `${cleanPrefix}/`;
  return relativePath === cleanPrefix.replace(/\/$/, "") || relativePath.startsWith(withSlash);
}

module.exports = {
  TOOL_PERMISSIONS,
  DEFAULT_TOOL_POLICIES,
  permissionManifest,
  resolveToolPolicy,
  evaluateToolPermission,
  permissionAuditEvent
};
