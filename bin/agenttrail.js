#!/usr/bin/env node

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("agenttrail - start the AgentTrail local AI agent");
  console.log("");
  console.log("Usage:");
  console.log("  agenttrail");
  console.log("");
  console.log("Environment:");
  console.log("  PORT=4173 OLLAMA_MODEL=llama3.2 OLLAMA_EMBED_MODEL=nomic-embed-text agenttrail");
  process.exit(0);
}

require("../server");
