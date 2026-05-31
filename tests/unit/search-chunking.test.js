#!/usr/bin/env node

const assert = require("node:assert/strict");
const {
  chunkText,
  chunkTextDetailed,
  bestLateInteractionChunk,
  fuseHybridScores,
  rankChunks,
  scoreBm25Documents
} = require("../../src/features/search");

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
assert.equal(chunks.every((chunk) => Number.isInteger(chunk.charStart) && chunk.charStart >= 0), true);
assert.equal(chunks.every((chunk) => Number.isInteger(chunk.charEnd) && chunk.charEnd >= chunk.charStart), true);
assert.equal(chunks.some((chunk) => chunk.heading.includes("Install")), true);
assert.equal(chunks.some((chunk) => chunk.kind === "code" || chunk.kind === "mixed"), true);
assert.equal(chunkText(markdown, 260, 90).every((chunk) => typeof chunk === "string"), true);

const installChunk = chunks.find((chunk) => chunk.heading.includes("Install"));
assert.equal(markdown.slice(installChunk.charStart, installChunk.charEnd).includes("Run `npx agenttrail`"), true);

const ranked = rankChunks("install npx", chunks.map((chunk) => ({ ...chunk, path: "README.md" })), 1);
assert.equal(ranked.length, 1);
assert.equal(ranked[0].heading.includes("Install"), true);
assert.match(ranked[0].citation, /^README\.md:\d+(-\d+)?$/);
assert.match(ranked[0].chunkRef, /^README\.md#chunk-\d+$/);
assert.equal("embedding" in ranked[0], false);
assert.equal("text" in ranked[0], false);
assert.equal(Number.isInteger(ranked[0].span.charStart), true);
assert.equal(ranked[0].scoreParts.matches.includes("install"), true);

const late = bestLateInteractionChunk([1, 0], [
  { path: "a.md", index: 0, embedding: [0.1, 0.9] },
  { path: "b.md", index: 1, embedding: [0.95, 0.05] }
]);
assert.equal(late.chunk.path, "b.md");
assert.equal(late.score > 0.9, true);

const bm25 = scoreBm25Documents("install npx", [
  { id: "install", path: "docs/install.md", text: "npx agenttrail install local agent local agent" },
  { id: "receipts", path: "docs/receipts.md", text: "receipts reports replay timeline" }
]).sort((a, b) => b.keywordScore - a.keywordScore);

assert.equal(bm25[0].id, "install");
assert.equal(bm25[0].keywordMatches.includes("npx"), true);

const fused = fuseHybridScores([
  { id: "keyword", keywordScore: 10, semanticScore: 0.2 },
  { id: "semantic", keywordScore: 1, semanticScore: 0.9 }
], { keywordWeight: 0.35, semanticWeight: 0.65 }).sort((a, b) => b.hybridScore - a.hybridScore);

assert.equal(fused[0].id, "semantic");
assert.equal(fused[0].scoreParts.semanticNormalized, 1);

console.log("Search chunking tests passed");
