"use strict";

const vm = require("node:vm");
const { validatePluginManifest } = require("./plugin-sdk");

function runPluginTool(plugin, toolName, input = {}, options = {}) {
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
      permission: {
        scope: tool.permission.scope,
        risk: tool.permission.risk,
        requiresApproval: tool.requiresApproval
      }
    };
  }
  throw new Error(`${toolName} has no executable sandbox handler.`);
}

module.exports = {
  runPluginTool
};
