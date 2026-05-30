"use strict";

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

function permissionManifest() {
  return TOOL_PERMISSIONS.map((item) => ({ ...item }));
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
  const approved = args.approved === true || options.approved === true;

  if (tool === "read_file" && permissions.readFiles === false) {
    return deny(definition, "File read permission is disabled.");
  }
  if (tool === "write_file" && permissions.writeFiles !== true) {
    return deny(definition, "File write permission is disabled.");
  }
  if (tool === "write_file" && permissions.previewWrites !== false) {
    return {
      ok: true,
      action: "preview",
      definition,
      reason: "Preview mode converts direct writes into diff previews."
    };
  }
  if (definition.requiresApproval && definition.risk === "high" && !approved && options.allowImplicitHighRisk !== true) {
    return deny(definition, `${tool} requires explicit high-risk approval.`);
  }

  return {
    ok: true,
    action: "execute",
    definition,
    reason: "Tool permission accepted."
  };
}

function deny(definition, reason) {
  return {
    ok: false,
    action: "deny",
    definition,
    reason
  };
}

module.exports = {
  TOOL_PERMISSIONS,
  permissionManifest,
  evaluateToolPermission
};
