"use strict";

function friendlyError(error, context = {}) {
  const message = error && error.message ? error.message : "Internal server error";
  const lower = message.toLowerCase();
  let hint = "Check the Agent Trail and retry the action.";
  if (lower.includes("ollama")) {
    hint = `Start Ollama, verify ${context.ollamaHost || "http://127.0.0.1:11434"}, and pull ${context.defaultModel || "llama3.2"}.`;
  } else if (lower.includes("embedding")) {
    hint = `Pull the embedding model with: ollama pull ${context.embeddingModel || "nomic-embed-text"}.`;
  } else if (lower.includes("too large")) {
    hint = "Select a smaller file or increase the local size limit deliberately.";
  } else if (lower.includes("escapes the workspace")) {
    hint = "Use a path inside the configured workspace folder.";
  } else if (lower.includes("permission")) {
    hint = "Review the permission toggles or use preview mode first.";
  }
  return {
    error: message,
    hint,
    code: lower.includes("workspace") ? "WORKSPACE_BOUNDARY" : lower.includes("ollama") ? "MODEL_BACKEND" : "AGENTTRAIL_ERROR"
  };
}

module.exports = {
  friendlyError
};
