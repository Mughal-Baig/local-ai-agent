#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  appendLineAtomic,
  assertDiskSpace,
  atomicWriteFile,
  buildResilienceStatus,
  diskSpaceStatus,
  isTransientError,
  withRetry
} = require("../../src/resilience");
const { classifyError, friendlyError } = require("../../src/features/errors");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  let attempts = 0;
  const retried = await withRetry(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error("socket hang up");
      error.code = "ECONNRESET";
      throw error;
    }
    return { ok: true };
  }, { retries: 3, baseDelayMs: 1, jitterMs: 0 });
  assert.equal(retried.ok, true);
  assert.equal(retried.retry.attempts, 3);
  assert.equal(retried.retry.retried, true);
  assert.equal(isTransientError(Object.assign(new Error("HTTP 503"), { status: 503 })), true);

  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-resilience-unit-"));
  try {
    const file = path.join(tempRoot, "store.json");
    await atomicWriteFile(file, JSON.stringify({ ok: true }), "utf8");
    assert.deepEqual(JSON.parse(await fsp.readFile(file, "utf8")), { ok: true });
    await appendLineAtomic(path.join(tempRoot, "events.jsonl"), JSON.stringify({ id: 1 }));
    await appendLineAtomic(path.join(tempRoot, "events.jsonl"), JSON.stringify({ id: 2 }));
    assert.match(await fsp.readFile(path.join(tempRoot, "events.jsonl"), "utf8"), /"id":2/);

    const disk = await diskSpaceStatus(tempRoot, 1);
    assert.equal(disk.ok, true);
    const impossible = await assert.rejects(
      () => assertDiskSpace(tempRoot, Number.MAX_SAFE_INTEGER, { minFreeBytes: Number.MAX_SAFE_INTEGER }),
      /bytes required|disk/i
    );
    assert.equal(impossible, undefined);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }

  const resilience = buildResilienceStatus({
    backend: { available: false, message: "backend down" },
    config: { ok: true, checks: [] },
    disk: { ok: true },
    searchIndex: { ok: true, corrupt: false }
  });
  assert.equal(resilience.status, "degraded");
  assert.equal(resilience.actions[0].code, "MODEL_BACKEND");

  assert.equal(classifyError(new Error("No space left on device")).code, "DISK_SPACE");
  assert.equal(classifyError(new Error("Retry exhausted after 3 attempts")).code, "RETRY_EXHAUSTED");
  assert.equal(classifyError(new Error("Unexpected token in search index")).code, "CORRUPT_INDEX");
  assert.equal(classifyError(new Error("Ollama is not reachable. Request timed out after 100 ms.")).code, "TIMEOUT");
  assert.equal(friendlyError(new Error("startup config warning"), { code: "STARTUP_CONFIG" }).code, "STARTUP_CONFIG");

  console.log("Resilience unit test passed");
}
