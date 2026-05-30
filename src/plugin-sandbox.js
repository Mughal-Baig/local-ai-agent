"use strict";

const vm = require("node:vm");

function runPluginTool(plugin, toolName, input) {
  if (!plugin || !Array.isArray(plugin.tools)) {
    throw new Error("Plugin manifest is invalid.");
  }
  const tool = plugin.tools.find((item) => item.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} was not found in plugin ${plugin.id}.`);
  }
  if (tool.risk && tool.risk !== "low" && input.approved !== true) {
    throw new Error(`${toolName} requires explicit plugin approval.`);
  }
  if (toolName === "example.echo") {
    return {
      ok: true,
      tool: toolName,
      output: String(input.text || "").slice(0, 500),
      receipt: true
    };
  }
  if (tool.code) {
    const context = vm.createContext({
      input: Object.freeze({ ...input }),
      result: null
    });
    const script = new vm.Script(`result = (function(){ ${String(tool.code)} })();`);
    script.runInContext(context, { timeout: 250 });
    return { ok: true, tool: toolName, output: context.result, receipt: true };
  }
  throw new Error(`${toolName} has no executable sandbox handler.`);
}

module.exports = {
  runPluginTool
};
