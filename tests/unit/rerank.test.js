#!/usr/bin/env node

// T047 - lexical reranker unit test. A doc that exactly covers the query should
// be promoted above a doc with a higher first-stage (hybrid) score but no match.

const assert = require("node:assert/strict");
const { rerankDocuments } = require("../../src/features/search");

function main() {
  const docs = [
    { path: "misc.md", text: "general notes about unrelated things", hybridScore: 0.92, scoreParts: { hybrid: 0.92 } },
    { path: "billing-refunds.md", text: "how to refund a customer payment invoice and issue a credit", hybridScore: 0.5, scoreParts: { hybrid: 0.5 } }
  ];

  const out = rerankDocuments("refund a customer payment invoice", docs, { topK: 5 });

  assert.equal(out[0].path, "billing-refunds.md", "lexically-matching doc should rerank to the top");
  assert.ok(out[0].scoreParts.rerank > 0, "reranked top should expose a positive rerank score part");
  assert.ok(out[0].scoreParts.final >= out[1].scoreParts.final, "top doc should have the highest final score");

  // No query terms: ordering preserved, no throw.
  const passthrough = rerankDocuments("", docs, { topK: 5 });
  assert.equal(passthrough.length, 2, "empty query should pass documents through");

  console.log("Rerank unit test passed");
}

main();
