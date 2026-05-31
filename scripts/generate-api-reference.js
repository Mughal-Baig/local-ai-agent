#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { routeCatalog } = require("../src/route-catalog");

const projectRoot = path.resolve(__dirname, "..");
const openApiPath = path.join(projectRoot, "docs/openapi/agenttrail-v1-openapi.json");
const outputPath = path.join(projectRoot, "docs/API_REFERENCE.md");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const markdown = await renderApiReference();
  if (process.argv.includes("--check")) {
    assert.equal(await readIfExists(outputPath), markdown, "docs/API_REFERENCE.md is out of date. Run npm run docs:api.");
    console.log("API reference is up to date");
    return;
  }
  await fsp.writeFile(outputPath, markdown, "utf8");
  console.log("Generated docs/API_REFERENCE.md");
}

async function renderApiReference() {
  const openapi = JSON.parse(await fsp.readFile(openApiPath, "utf8"));
  const routes = routeCatalog();
  const lines = [];
  lines.push("# API Reference");
  lines.push("");
  lines.push("> Generated from `src/route-catalog.js` and `docs/openapi/agenttrail-v1-openapi.json`. Do not edit route tables by hand; run `npm run docs:api`.");
  lines.push("");
  lines.push("AgentTrail exposes two API layers: local app endpoints under `/api/*` and an OpenAI-compatible facade under `/v1/*`. By default the server binds to `127.0.0.1` and keeps data inside the configured workspace.");
  lines.push("");
  lines.push("## Local App Routes");
  lines.push("");
  lines.push("| Area | Module | Routes |");
  lines.push("| --- | --- | --- |");
  for (const item of routes) {
    lines.push(`| ${escapeCell(item.area)} | ${escapeCell(item.module)} | ${escapeCell(item.routes.map((route) => `\`${route}\``).join("<br>"))} |`);
  }
  lines.push("");
  lines.push("## OpenAI-Compatible Routes");
  lines.push("");
  lines.push(`Spec: \`${path.relative(projectRoot, openApiPath)}\``);
  lines.push("");
  lines.push("| Method | Path | Operation | Summary |");
  lines.push("| --- | --- | --- | --- |");
  for (const [route, methods] of Object.entries(openapi.paths || {})) {
    for (const [method, operation] of Object.entries(methods || {})) {
      lines.push(`| ${method.toUpperCase()} | \`${route}\` | \`${operation.operationId || ""}\` | ${escapeCell(operation.summary || "")} |`);
    }
  }
  lines.push("");
  lines.push("## Auth And Rate Controls");
  lines.push("");
  lines.push("- `/api/*` is intended for the local browser app and local CLI.");
  lines.push("- `/v1/*` can require `AGENTTRAIL_V1_API_KEY` or `AGENTTRAIL_V1_API_KEYS`.");
  lines.push("- `/v1/*` uses `AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE`, `AGENTTRAIL_V1_QUEUE_CONCURRENCY`, and `AGENTTRAIL_V1_QUEUE_MAX` for local rate limiting and backpressure.");
  lines.push("- Network egress remains governed by `AGENTTRAIL_EGRESS_ALLOWLIST` and related privacy settings.");
  lines.push("");
  lines.push("## Examples");
  lines.push("");
  lines.push("```bash");
  lines.push("curl http://127.0.0.1:4173/api/status");
  lines.push("curl http://127.0.0.1:4173/api/search?query=receipt");
  lines.push("curl http://127.0.0.1:4173/api/team/status");
  lines.push("```");
  lines.push("");
  lines.push("```bash");
  lines.push("curl http://127.0.0.1:4173/v1/chat/completions \\");
  lines.push("  -H 'Content-Type: application/json' \\");
  lines.push("  -d '{\"model\":\"llama3.2\",\"messages\":[{\"role\":\"user\",\"content\":\"Summarize the workspace\"}]}'");
  lines.push("```");
  lines.push("");
  lines.push("## Route Ownership");
  lines.push("");
  lines.push("Use the `module` column to find the implementation owner before changing behavior. New endpoints should be added to `src/route-catalog.js`, covered in tests, and regenerated here.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

async function readIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}
