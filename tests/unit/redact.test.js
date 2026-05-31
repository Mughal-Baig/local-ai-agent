#!/usr/bin/env node
const assert = require("node:assert/strict");
const { redactSecrets } = require("../../src/features/redact");
function main() {
  const sample = [
    "Here is my key sk-ABCDEFGHIJKLMNOPQRSTUVWX12345",
    "export AWS_KEY=AKIAIOSFODNN7EXAMPLE",
    "api_key = \"abcdEFGH123456\"",
    "Authorization: Bearer abcdef0123456789ABCDEF",
    "token: ghp_abcdefghijklmnopqrstuvwxyz0123",
    "nothing secret here, just words"
  ].join("\n");
  const { redacted, count } = redactSecrets(sample);
  assert.equal(count >= 5, true, `expected >=5 redactions, got ${count}`);
  assert.equal(/sk-ABCDEF/.test(redacted), false, "openai key removed");
  assert.equal(/AKIAIOSF/.test(redacted), false, "aws key removed");
  assert.equal(/ghp_abcdef/.test(redacted), false, "github token removed");
  assert.equal(redacted.includes("[REDACTED]"), true, "placeholder present");
  assert.equal(redacted.includes("just words"), true, "non-secret text preserved");
  // idempotent + empty
  assert.equal(redactSecrets("").count, 0);
  console.log("Redact unit test passed (" + count + " redactions)");
}
main();
