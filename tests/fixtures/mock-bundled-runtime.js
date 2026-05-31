"use strict";

async function generate({ config, prompt, onToken }) {
  if (!config || !config.hardware || !config.hardware.selectedBackend) {
    throw new Error("Mock bundled runtime expected hardware policy in config.");
  }
  const text = JSON.stringify(prompt || "").includes("JSON Schema")
    ? JSON.stringify({ tasks: [{ title: "Ship bundled runtime", priority: "high" }] })
    : "bundled runtime ok";
  for (const token of text.split(/(\s+)/)) {
    if (token && typeof onToken === "function") {
      onToken(token);
    }
  }
  return { text, streamed: true };
}

async function embed({ config, input }) {
  if (!config || !config.hardware || !config.hardware.loadOptions) {
    throw new Error("Mock bundled runtime expected hardware load options in config.");
  }
  const length = String(input || "").length || 1;
  return [0.11, 0.22, 0.33, Number((length / 100).toFixed(2))];
}

module.exports = {
  generate,
  embed
};
