"use strict";

const ERROR_TAXONOMY = {
  WORKSPACE_BOUNDARY: {
    category: "security",
    severity: "high",
    hint: "Use a path inside the configured workspace folder.",
    action: "Pick a workspace-relative path or attach the file through AgentTrail first."
  },
  MODEL_BACKEND: {
    category: "runtime",
    severity: "high",
    hint: "Start Ollama or the configured local backend, verify the host, and pull the selected model.",
    action: "Run `ollama serve`, then `ollama pull llama3.2`, or update AGENTTRAIL_MODEL_ADAPTER."
  },
  EMBEDDING_SETUP: {
    category: "search",
    severity: "medium",
    hint: "Pull the configured embedding model before building semantic indexes.",
    action: "Run `ollama pull nomic-embed-text` or set OLLAMA_EMBED_MODEL to an installed embedding model."
  },
  PAYLOAD_TOO_LARGE: {
    category: "limits",
    severity: "medium",
    hint: "Select a smaller file or increase the local size limit deliberately.",
    action: "Split the input, attach a smaller file, or raise the matching AGENTTRAIL_*_MAX_* value."
  },
  PERMISSION_DENIED: {
    category: "permissions",
    severity: "medium",
    hint: "Review the permission toggles or use preview mode first.",
    action: "Enable the required read/write scope, or keep preview-only mode and apply the diff manually."
  },
  NETWORK_EGRESS: {
    category: "privacy",
    severity: "high",
    hint: "The outbound request was blocked by the local egress policy.",
    action: "Add the exact host to AGENTTRAIL_EGRESS_ALLOWLIST only if you trust it."
  },
  ENCRYPTION_AT_REST: {
    category: "privacy",
    severity: "high",
    hint: "Encrypted artifacts need a usable local encryption key.",
    action: "Set AGENTTRAIL_ENCRYPTION_KEY and retry the save/read operation."
  },
  DISK_SPACE: {
    category: "storage",
    severity: "high",
    hint: "AgentTrail stopped before writing because local disk space is below the safety threshold.",
    action: "Free disk space, remove old model pulls or exports, then retry the write."
  },
  CORRUPT_INDEX: {
    category: "search",
    severity: "medium",
    hint: "The local search index could not be parsed or matched to the expected schema.",
    action: "Let AgentTrail rebuild the local-vector index, or delete the corrupt backup after reviewing it."
  },
  STARTUP_CONFIG: {
    category: "runtime",
    severity: "medium",
    hint: "One or more environment values are invalid or risky.",
    action: "Open /api/config, fix the named environment value, and restart AgentTrail."
  },
  RETRY_EXHAUSTED: {
    category: "runtime",
    severity: "medium",
    hint: "A transient backend request was retried and still failed.",
    action: "Check the backend status, reduce load, and retry the action once the model server is stable."
  },
  RATE_LIMITED: {
    category: "runtime",
    severity: "medium",
    hint: "The local API is protecting the backend from too many requests.",
    action: "Retry after the advertised delay or lower parallel callers."
  },
  VALIDATION: {
    category: "input",
    severity: "low",
    hint: "The request did not match the expected shape.",
    action: "Check required fields, selected files, and schema names, then retry."
  },
  TIMEOUT: {
    category: "runtime",
    severity: "medium",
    hint: "The local backend or helper command took too long.",
    action: "Retry with a smaller input or increase the matching timeout environment variable."
  },
  RUN_CANCELLED: {
    category: "runtime",
    severity: "low",
    hint: "The run was stopped before completion.",
    action: "Start a new run when you are ready."
  },
  TOOL_EXECUTION: {
    category: "tools",
    severity: "medium",
    hint: "A local tool call failed while the model was working.",
    action: "Open the run trace, inspect the tool step, and retry with narrower permissions or files."
  },
  AGENTTRAIL_ERROR: {
    category: "unknown",
    severity: "medium",
    hint: "Check the Agent Trail and retry the action.",
    action: "Open logs and traces, then retry the smallest reproducible action."
  }
};

function classifyError(error, context = {}) {
  const message = error && error.message ? error.message : String(error || "Internal server error");
  const lower = message.toLowerCase();
  const contextCode = String(context.code || error?.code || "").toUpperCase();
  const status = Number(context.status || error?.status || 0);
  let code = "AGENTTRAIL_ERROR";

  if (
    contextCode === "WORKSPACE_BOUNDARY" ||
    lower.includes("escapes the workspace") ||
    lower.includes("outside the workspace") ||
    lower.includes("workspace boundary")
  ) {
    code = "WORKSPACE_BOUNDARY";
  } else if (
    contextCode === "NETWORK_EGRESS" ||
    lower.includes("egress") ||
    lower.includes("allowlist") ||
    lower.includes("private network")
  ) {
    code = "NETWORK_EGRESS";
  } else if (
    contextCode === "RATE_LIMITED" ||
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("queue is full")
  ) {
    code = "RATE_LIMITED";
  } else if (
    contextCode === "ENCRYPTION_AT_REST" ||
    lower.includes("encryption") ||
    lower.includes("decrypt") ||
    lower.includes("encrypted")
  ) {
    code = "ENCRYPTION_AT_REST";
  } else if (
    contextCode === "DISK_SPACE" ||
    contextCode === "ENOSPC" ||
    lower.includes("disk space") ||
    lower.includes("no space left") ||
    lower.includes("not enough local disk")
  ) {
    code = "DISK_SPACE";
  } else if (
    contextCode === "CORRUPT_INDEX" ||
    lower.includes("corrupt index") ||
    lower.includes("search index could not") ||
    lower.includes("unexpected token") ||
    lower.includes("invalid-search-index-schema")
  ) {
    code = "CORRUPT_INDEX";
  } else if (
    contextCode === "STARTUP_CONFIG" ||
    lower.includes("startup config") ||
    lower.includes("config warning")
  ) {
    code = "STARTUP_CONFIG";
  } else if (
    contextCode === "RETRY_EXHAUSTED" ||
    lower.includes("retry exhausted")
  ) {
    code = "RETRY_EXHAUSTED";
  } else if (
    contextCode === "TIMEOUT" ||
    contextCode === "TIMEOUTERROR" ||
    lower.includes("timeout") ||
    lower.includes("timed out")
  ) {
    code = "TIMEOUT";
  } else if (
    contextCode === "EMBEDDING_SETUP" ||
    lower.includes("embedding") ||
    lower.includes("embed model")
  ) {
    code = "EMBEDDING_SETUP";
  } else if (
    contextCode === "MODEL_BACKEND" ||
    lower.includes("ollama") ||
    lower.includes("model backend") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed")
  ) {
    code = "MODEL_BACKEND";
  } else if (
    contextCode === "PAYLOAD_TOO_LARGE" ||
    status === 413 ||
    lower.includes("too large") ||
    lower.includes("max bytes")
  ) {
    code = "PAYLOAD_TOO_LARGE";
  } else if (
    contextCode === "PERMISSION_DENIED" ||
    status === 403 ||
    lower.includes("permission")
  ) {
    code = "PERMISSION_DENIED";
  } else if (
    contextCode === "RUN_CANCELLED" ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    code = "RUN_CANCELLED";
  } else if (
    contextCode === "VALIDATION" ||
    status === 400 ||
    lower.includes("invalid") ||
    lower.includes("required")
  ) {
    code = "VALIDATION";
  } else if (lower.includes("tool")) {
    code = "TOOL_EXECUTION";
  }

  const template = ERROR_TAXONOMY[code] || ERROR_TAXONOMY.AGENTTRAIL_ERROR;
  let hint = template.hint;
  let action = template.action;
  if (code === "MODEL_BACKEND") {
    hint = `Start Ollama, verify ${context.ollamaHost || "http://127.0.0.1:11434"}, and pull ${context.defaultModel || "llama3.2"}.`;
  } else if (code === "EMBEDDING_SETUP") {
    hint = `Pull the embedding model with: ollama pull ${context.embeddingModel || "nomic-embed-text"}.`;
  }

  return {
    code,
    category: template.category,
    severity: template.severity,
    message,
    hint,
    action
  };
}

function friendlyError(error, context = {}) {
  const classified = classifyError(error, context);
  return {
    error: classified.message,
    hint: classified.hint,
    code: classified.code,
    category: classified.category,
    severity: classified.severity,
    action: classified.action
  };
}

module.exports = {
  ERROR_TAXONOMY,
  classifyError,
  friendlyError
};
