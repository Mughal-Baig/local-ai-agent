"use strict";

function validateConfig(env = process.env) {
  const port = Number(env.PORT || 4173);
  const maxToolIterations = Number(env.MAX_TOOL_ITERATIONS || 4);
  const checks = [
    {
      id: "port",
      ok: Number.isInteger(port) && port > 0 && port < 65536,
      message: "PORT must be a valid TCP port."
    },
    {
      id: "ollama-host",
      ok: /^https?:\/\//.test(String(env.OLLAMA_HOST || "http://127.0.0.1:11434")),
      message: "OLLAMA_HOST must start with http:// or https://."
    },
    {
      id: "model",
      ok: Boolean(String(env.OLLAMA_MODEL || "llama3.2").trim()),
      message: "OLLAMA_MODEL must not be empty."
    },
    {
      id: "embedding-model",
      ok: Boolean(String(env.OLLAMA_EMBED_MODEL || "nomic-embed-text").trim()),
      message: "OLLAMA_EMBED_MODEL must not be empty."
    },
    {
      id: "tool-iterations",
      ok: Number.isInteger(maxToolIterations) && maxToolIterations >= 1 && maxToolIterations <= 20,
      message: "MAX_TOOL_ITERATIONS must be between 1 and 20."
    }
  ];
  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

module.exports = {
  validateConfig
};
