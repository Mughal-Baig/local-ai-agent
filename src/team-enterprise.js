"use strict";

const { redactValueOnly } = require("./privacy");

const TEAM_USERS_SCHEMA = "agenttrail.team-users.v1";
const SHARED_RECEIPTS_SCHEMA = "agenttrail.shared-receipts.v1";
const TEAM_SYNC_SCHEMA = "agenttrail.team-sync.v1";
const AUDIT_EXPORT_SCHEMA = "agenttrail.audit-export.v1";
const SSO_HOOK_SCHEMA = "agenttrail.sso-hook.v1";

const TOOL_NAMES = [
  "list_files",
  "search_workspace",
  "read_file",
  "preview_write_file",
  "write_file",
  "mcp_tool"
];

const DEFAULT_TEAM_USERS = [
  {
    id: "owner",
    displayName: "Local Owner",
    role: "owner",
    profileId: "default",
    email: "owner@local.agenttrail"
  },
  {
    id: "auditor",
    displayName: "Receipt Auditor",
    role: "auditor",
    profileId: "security-review",
    email: "auditor@local.agenttrail"
  },
  {
    id: "viewer",
    displayName: "Read-only Viewer",
    role: "viewer",
    profileId: "default",
    email: "viewer@local.agenttrail"
  }
];

const ROLE_CAPABILITIES = {
  owner: {
    label: "Owner",
    tools: ["*"],
    canReadFiles: true,
    canWriteFiles: true,
    canReadSharedReceipts: true,
    canExportAudit: true,
    canSyncWorkspace: true,
    canManageUsers: true,
    canUseSso: true
  },
  admin: {
    label: "Admin",
    tools: ["list_files", "search_workspace", "read_file", "preview_write_file", "write_file", "mcp_tool"],
    canReadFiles: true,
    canWriteFiles: true,
    canReadSharedReceipts: true,
    canExportAudit: true,
    canSyncWorkspace: true,
    canManageUsers: true,
    canUseSso: true
  },
  editor: {
    label: "Editor",
    tools: ["list_files", "search_workspace", "read_file", "preview_write_file", "write_file"],
    canReadFiles: true,
    canWriteFiles: true,
    canReadSharedReceipts: true,
    canExportAudit: false,
    canSyncWorkspace: false,
    canManageUsers: false,
    canUseSso: false
  },
  auditor: {
    label: "Auditor",
    tools: ["list_files", "search_workspace", "read_file"],
    canReadFiles: true,
    canWriteFiles: false,
    canReadSharedReceipts: true,
    canExportAudit: true,
    canSyncWorkspace: false,
    canManageUsers: false,
    canUseSso: false
  },
  viewer: {
    label: "Viewer",
    tools: [],
    canReadFiles: false,
    canWriteFiles: false,
    canReadSharedReceipts: true,
    canExportAudit: false,
    canSyncWorkspace: false,
    canManageUsers: false,
    canUseSso: false
  }
};

function normalizeTeamUsers(value) {
  const source = value && typeof value === "object" ? value : {};
  const rawUsers = Array.isArray(source.users) ? source.users : Array.isArray(value) ? value : DEFAULT_TEAM_USERS;
  const users = rawUsers
    .map(normalizeTeamUser)
    .filter(Boolean);
  return {
    schema: TEAM_USERS_SCHEMA,
    updatedAt: source.updatedAt || new Date().toISOString(),
    users: users.length ? uniqueById(users) : DEFAULT_TEAM_USERS.map(normalizeTeamUser)
  };
}

function normalizeTeamUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }
  const id = safeId(user.id || user.email || user.displayName);
  if (!id) {
    return null;
  }
  const role = ROLE_CAPABILITIES[user.role] ? user.role : "viewer";
  return {
    id,
    displayName: truncate(String(user.displayName || user.name || id), 80),
    email: truncate(String(user.email || ""), 120),
    role,
    profileId: safeId(user.profileId || user.profile || "default") || "default",
    active: user.active !== false
  };
}

function selectTeamUser(users, userId) {
  const normalized = normalizeTeamUsers({ users }).users;
  const requested = safeId(userId || "");
  return normalized.find((user) => user.active && user.id === requested) ||
    normalized.find((user) => user.active && user.role === "owner") ||
    normalized.find((user) => user.active) ||
    normalizeTeamUser(DEFAULT_TEAM_USERS[0]);
}

function roleCapabilities(role) {
  const capabilities = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.viewer;
  return {
    ...capabilities,
    tools: capabilities.tools.slice()
  };
}

function applyRbacToPermissions(permissions = {}, user = null) {
  const activeUser = normalizeTeamUser(user || DEFAULT_TEAM_USERS[0]);
  const capabilities = roleCapabilities(activeUser.role);
  const allowedTools = new Set(capabilities.tools);
  const toolPolicies = { ...(permissions.toolPolicies || {}) };

  for (const tool of TOOL_NAMES) {
    const allowed = allowedTools.has("*") || allowedTools.has(tool);
    if (!allowed) {
      toolPolicies[tool] = {
        ...(toolPolicies[tool] || {}),
        enabled: false,
        requiresApproval: true,
        reason: `RBAC role ${activeUser.role} cannot use ${tool}.`,
        rbacRole: activeUser.role
      };
    }
  }

  return {
    ...permissions,
    readFiles: permissions.readFiles !== false && capabilities.canReadFiles === true,
    writeFiles: permissions.writeFiles === true && capabilities.canWriteFiles === true,
    previewWrites: permissions.previewWrites !== false,
    toolPolicies,
    teamUser: publicTeamUser(activeUser),
    rbac: {
      role: activeUser.role,
      capabilities,
      capped: {
        readFiles: permissions.readFiles !== false && capabilities.canReadFiles !== true,
        writeFiles: permissions.writeFiles === true && capabilities.canWriteFiles !== true
      }
    }
  };
}

function teamPermissionManifest(user = null) {
  const activeUser = normalizeTeamUser(user || DEFAULT_TEAM_USERS[0]);
  const capabilities = roleCapabilities(activeUser.role);
  const allowedTools = new Set(capabilities.tools);
  return TOOL_NAMES.map((tool) => {
    const allowed = allowedTools.has("*") || allowedTools.has(tool);
    return {
      tool,
      allowed,
      role: activeUser.role,
      reason: allowed ? "Allowed by role." : `RBAC role ${activeUser.role} cannot use ${tool}.`
    };
  });
}

function publicTeamUser(user) {
  const normalized = normalizeTeamUser(user);
  return {
    id: normalized.id,
    displayName: normalized.displayName,
    email: normalized.email,
    role: normalized.role,
    profileId: normalized.profileId
  };
}

function buildSharedReceipts(receipts = [], user = null, options = {}) {
  const activeUser = normalizeTeamUser(user || DEFAULT_TEAM_USERS[0]);
  const canRead = roleCapabilities(activeUser.role).canReadSharedReceipts === true;
  const filtered = canRead
    ? receipts.map((receipt) => sharedReceiptSummary(receipt)).filter(Boolean)
    : [];
  return {
    schema: SHARED_RECEIPTS_SCHEMA,
    readOnly: true,
    canRead,
    user: publicTeamUser(activeUser),
    count: filtered.length,
    receipts: filtered.slice(0, Math.max(1, Number(options.limit || 80)))
  };
}

function sharedReceiptSummary(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return null;
  }
  return {
    path: String(receipt.path || ""),
    title: truncate(String(receipt.title || receipt.path || "Receipt"), 120),
    modifiedAt: receipt.modifiedAt || receipt.createdAt || null,
    model: receipt.model || null,
    toolCount: Number(receipt.toolCount || 0),
    fileMentions: Array.isArray(receipt.fileMentions) ? receipt.fileMentions.slice(0, 12) : [],
    eventTypes: Array.isArray(receipt.eventTypes) ? receipt.eventTypes.slice(0, 12) : [],
    snippet: truncate(String(receipt.snippet || ""), 220),
    readOnlyUrl: `/api/team/receipts/content?path=${encodeURIComponent(String(receipt.path || ""))}`
  };
}

function normalizeAuditRecords({ logs = [], events = [] } = {}) {
  const rows = [];
  for (const log of logs) {
    rows.push({
      source: "log",
      createdAt: log.time || log.createdAt || "",
      type: log.event || "log",
      level: log.level || "",
      actor: log.actor || "",
      tool: log.tool || "",
      action: log.action || "",
      ok: typeof log.ok === "boolean" ? log.ok : "",
      risk: log.risk || "",
      reason: log.reason || "",
      message: log.message || log.event || "",
      traceId: log.traceId || ""
    });
  }
  for (const event of events) {
    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    rows.push({
      source: "store",
      createdAt: event.createdAt || payload.createdAt || "",
      type: event.type || "",
      level: payload.ok === false ? "warn" : "",
      actor: payload.actor || "",
      tool: payload.tool || "",
      action: payload.action || "",
      ok: typeof payload.ok === "boolean" ? payload.ok : "",
      risk: payload.risk || "",
      reason: payload.reason || "",
      message: payload.message || payload.error || payload.reason || event.type || "",
      traceId: payload.traceId || ""
    });
  }
  return rows
    .map((row) => redactValueOnly(row))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function exportAudit(records, format = "json") {
  const normalizedFormat = String(format || "json").toLowerCase() === "csv" ? "csv" : "json";
  if (normalizedFormat === "csv") {
    return {
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
      body: auditRecordsToCsv(records)
    };
  }
  return {
    contentType: "application/json; charset=utf-8",
    extension: "json",
    body: JSON.stringify({
      schema: AUDIT_EXPORT_SCHEMA,
      exportedAt: new Date().toISOString(),
      count: records.length,
      records
    }, null, 2)
  };
}

function auditRecordsToCsv(records = []) {
  const headers = ["createdAt", "source", "type", "level", "actor", "tool", "action", "ok", "risk", "reason", "message", "traceId"];
  const lines = [headers.join(",")];
  for (const record of records) {
    lines.push(headers.map((header) => csvCell(record[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function buildSyncPackage({ receipts = [], profiles = [], users = [], audit = [], workspaceRoot = "", createdAt = new Date().toISOString() } = {}) {
  return {
    schema: TEAM_SYNC_SCHEMA,
    createdAt,
    workspaceRoot,
    mode: "local-opt-in",
    privacy: "metadata and receipt summaries only; no arbitrary workspace files",
    receipts: receipts.map(sharedReceiptSummary).filter(Boolean),
    profiles: profiles.map((profile) => redactValueOnly({
      id: profile.id,
      title: profile.title,
      description: profile.description || "",
      defaultModel: profile.defaultModel || "",
      permissions: profile.permissions || {}
    })),
    users: normalizeTeamUsers({ users }).users.map(publicTeamUser),
    audit: audit.slice(0, 200)
  };
}

function syncStatus(env = process.env) {
  const enabled = parseBool(env.AGENTTRAIL_TEAM_SYNC || env.AGENTTRAIL_SHARED_SYNC || "off");
  return {
    schema: "agenttrail.team-sync-status.v1",
    enabled,
    mode: enabled ? "local-opt-in" : "disabled",
    directory: env.AGENTTRAIL_TEAM_SYNC_DIR || env.AGENTTRAIL_SHARED_SYNC_DIR || "shared-sync",
    requiresExplicitExport: true
  };
}

function ssoStatus(env = process.env) {
  const provider = String(env.AGENTTRAIL_SSO_PROVIDER || "").trim();
  const allowedDomains = parseList(env.AGENTTRAIL_SSO_ALLOWED_DOMAINS || "");
  const headerName = String(env.AGENTTRAIL_SSO_HEADER_EMAIL || "x-agenttrail-sso-email").toLowerCase();
  return {
    schema: SSO_HOOK_SCHEMA,
    configured: Boolean(provider || allowedDomains.length),
    provider: provider || "header",
    headerName,
    allowedDomains,
    mode: "identity-hook"
  };
}

function validateSsoIdentity(identity = {}, env = process.env) {
  const status = ssoStatus(env);
  const email = String(identity.email || "").trim().toLowerCase();
  if (!status.configured) {
    return {
      ok: false,
      status,
      reason: "SSO hook is not configured. Set AGENTTRAIL_SSO_PROVIDER or AGENTTRAIL_SSO_ALLOWED_DOMAINS."
    };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, status, reason: "A valid SSO email is required." };
  }
  const domain = email.split("@").pop();
  if (status.allowedDomains.length && !status.allowedDomains.includes(domain)) {
    return { ok: false, status, reason: `Email domain ${domain} is not allowed.` };
  }
  return {
    ok: true,
    status,
    user: {
      id: safeId(email),
      displayName: truncate(String(identity.displayName || identity.name || email.split("@")[0]), 80),
      email,
      role: ROLE_CAPABILITIES[identity.role] ? identity.role : "viewer",
      profileId: safeId(identity.profileId || "default") || "default"
    }
  };
}

function canReadSharedReceipts(user) {
  return roleCapabilities(normalizeTeamUser(user || DEFAULT_TEAM_USERS[0]).role).canReadSharedReceipts === true;
}

function canExportAudit(user) {
  return roleCapabilities(normalizeTeamUser(user || DEFAULT_TEAM_USERS[0]).role).canExportAudit === true;
}

function canSyncWorkspace(user) {
  return roleCapabilities(normalizeTeamUser(user || DEFAULT_TEAM_USERS[0]).role).canSyncWorkspace === true;
}

function safeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/@/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueById(users) {
  const seen = new Set();
  const output = [];
  for (const user of users) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    output.push(user);
  }
  return output;
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max - 1) : text;
}

function parseList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseBool(value) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value || "").trim().toLowerCase());
}

function csvCell(value) {
  const text = String(value == null ? "" : value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

module.exports = {
  AUDIT_EXPORT_SCHEMA,
  DEFAULT_TEAM_USERS,
  ROLE_CAPABILITIES,
  SHARED_RECEIPTS_SCHEMA,
  SSO_HOOK_SCHEMA,
  TEAM_SYNC_SCHEMA,
  TEAM_USERS_SCHEMA,
  TOOL_NAMES,
  applyRbacToPermissions,
  auditRecordsToCsv,
  buildSharedReceipts,
  buildSyncPackage,
  canExportAudit,
  canReadSharedReceipts,
  canSyncWorkspace,
  exportAudit,
  normalizeAuditRecords,
  normalizeTeamUsers,
  publicTeamUser,
  roleCapabilities,
  selectTeamUser,
  ssoStatus,
  syncStatus,
  teamPermissionManifest,
  validateSsoIdentity
};
