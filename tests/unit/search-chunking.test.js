#!/usr/bin/env node

const assert = require("node:assert/strict");
const { chunkText, chunkTextDetailed, rankChunks } = require("../../src/features/search");

const markdown = [
  "# AgentTrail",
  "",
  "AgentTrail keeps local agent runs auditable.",
  "",
  "## Install",
  "",
  "Run `npx agenttrail` and build the local index.",
  "The installer should stay local, simple, and receipt-aware so people can trust the agent before they grant file access.",
  "Search chunks should preserve the section heading because ranked results need useful citations, not anonymous text windows.",
  "",
  "- Pull an Ollama model",
  "- Review the diff before applying",
  "",
  "```js",
  "console.log('receipt safe');",
  "```",
  "",
  "## Receipts",
  "",
  "Every search, preview, apply action, and report gets a receipt."
].join("\n");

const chunks = chunkTextDetailed(markdown, { size: 260, overlap: 90 });

assert.equal(chunks.length >= 2, true);
assert.equal(chunks.every((chunk) => typeof chunk.text === "string" && chunk.text.length > 0), true);
assert.equal(chunks.every((chunk) => Number.isInteger(chunk.startLine) && chunk.startLine >= 1), true);
assert.equal(chunks.every((chunk) => Number.isInteger(chunk.endLine) && chunk.endLine >= chunk.startLine), true);
assert.equal(chunks.some((chunk) => chunk.heading.includes("Install")), true);
assert.equal(chunks.some((chunk) => chunk.kind === "code" || chunk.kind === "mixed"), true);
assert.equal(chunkText(markdown, 260, 90).every((chunk) => typeof chunk === "string"), true);

const ranked = rankChunks("install npx", chunks.map((chunk) => ({ ...chunk, path: "README.md" })), 1);
assert.equal(ranked.length, 1);
assert.equal(ranked[0].heading.includes("Install"), true);
assert.match(ranked[0].citation, /^README\.md#chunk-\d+$/);

console.log("Search chunking tests passed");
