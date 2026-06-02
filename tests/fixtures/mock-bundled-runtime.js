"use strict";

let preloadCount = 0;

async function preload({ prefill }) {
  if (!prefill || prefill.schema !== "agenttrail.prefill-state.v1") {
    throw new Error("Mock bundled runtime expected prefill state.");
  }
  if (!prefill.enabled || !prefill.prefixChars) {
    throw new Error("Mock bundled runtime expected an enabled prefill prefix.");
  }
  preloadCount += 1;
}

async function generate({ config, prompt, onToken }) {
  if (!config || !config.hardware || !config.hardware.selectedBackend) {
    throw new Error("Mock bundled runtime expected hardware policy in config.");
  }
  if (!config.loading || !config.loading.quantization || !config.loading.kvCache) {
    throw new Error("Mock bundled runtime expected loading policy in config.");
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

async function generateSpeculative({ config, prompt, onToken }) {
  if (!config.speculative || !config.speculative.enabled) {
    throw new Error("Mock bundled runtime expected speculative policy.");
  }
  if (!config.prefillState || !config.prefillState.enabled || preloadCount < 1) {
    throw new Error("Mock bundled runtime expected prefill before speculative generation.");
  }
  const text = JSON.stringify(prompt || "").includes("JSON Schema")
    ? JSON.stringify({ tasks: [{ title: "Ship bundled runtime", priority: "high" }] })
    : "speculative bundled runtime ok";
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
  if (!config.loading || !config.loading.loadOptions) {
    throw new Error("Mock bundled runtime expected loading load options in config.");
  }
  const length = String(input || "").length || 1;
  return [0.11, 0.22, 0.33, Number((length / 100).toFixed(2))];
}

module.exports = {
  preload,
  generate,
  generateSpeculative,
  embed
};
