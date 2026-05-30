"use strict";

const MODEL_ADAPTERS = [
  {
    id: "ollama",
    title: "Ollama",
    env: "OLLAMA_HOST",
    defaultHost: "http://127.0.0.1:11434",
    status: "active",
    api: "native"
  },
  {
    id: "lmstudio",
    title: "LM Studio",
    env: "LMSTUDIO_HOST",
    defaultHost: "http://127.0.0.1:1234",
    status: "planned",
    api: "openai-compatible"
  },
  {
    id: "llamacpp",
    title: "llama.cpp server",
    env: "LLAMACPP_HOST",
    defaultHost: "http://127.0.0.1:8080",
    status: "planned",
    api: "openai-compatible"
  },
  {
    id: "openai-compatible",
    title: "OpenAI-compatible local server",
    env: "OPENAI_COMPATIBLE_HOST",
    defaultHost: "http://127.0.0.1:8000/v1",
    status: "planned",
    api: "openai-compatible"
  }
];

function listModelAdapters(env = process.env) {
  return MODEL_ADAPTERS.map((adapter) => ({
    ...adapter,
    host: env[adapter.env] || adapter.defaultHost,
    configured: Boolean(env[adapter.env]) || adapter.id === "ollama"
  }));
}

function activeModelAdapter(env = process.env) {
  const requested = String(env.AGENTTRAIL_MODEL_ADAPTER || "ollama").toLowerCase();
  return listModelAdapters(env).find((adapter) => adapter.id === requested) || listModelAdapters(env)[0];
}

module.exports = {
  MODEL_ADAPTERS,
  listModelAdapters,
  activeModelAdapter
};
