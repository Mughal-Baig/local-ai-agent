#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { createObservability, estimateTokens } = require("../../src/observability");
const { classifyError, friendlyError } = require("../../src/features/errors");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  assert.equal(estimateTokens("abcdefghijkl"), 3);

  const tracker = createObservability({ maxTraces: 4, maxTraceEvents: 8 });
  const trace = tracker.startTrace("chat", { model: "llama3.2", prompt: "secret=abcd12345678" });
  tracker.recordInput(trace, "hello local agent");
  tracker.recordToken(trace, "answer text");
  tracker.recordTool(trace, "read_file", { result: "Read welcome.md" });
  tracker.finishTrace(trace, "ok");

  const snapshot = tracker.snapshot();
  assert.equal(snapshot.totals.runsStarted, 1);
  assert.equal(snapshot.totals.runsCompleted, 1);
  assert.equal(snapshot.totals.toolCalls, 1);
  assert.equal(snapshot.traces[0].status, "ok");
  assert.equal(snapshot.traces[0].counters.outputTokens > 0, true);
  assert.equal(JSON.stringify(snapshot).includes("abcd12345678"), false);

  const error = tracker.recordError(new Error("Path escapes the workspace"), { route: "/api/files/content" });
  assert.equal(error.code, "WORKSPACE_BOUNDARY");
  assert.equal(tracker.snapshot().errorsByCode.WORKSPACE_BOUNDARY, 1);
  assert.match(tracker.prometheus(), /agenttrail_runs_completed_total 1/);
  assert.match(tracker.prometheus(), /agenttrail_errors_total\{code="WORKSPACE_BOUNDARY"\} 1/);
  assert.equal(tracker.analytics().privacy.includes("aggregate-only"), true);

  assert.equal(classifyError(new Error("Ollama is offline"), { defaultModel: "llama3.2" }).code, "MODEL_BACKEND");
  assert.equal(friendlyError(new Error("embedding failed"), { embeddingModel: "nomic-embed-text" }).code, "EMBEDDING_SETUP");
  console.log("Observability unit tests passed");
}
