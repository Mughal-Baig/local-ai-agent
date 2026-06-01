"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

const RESILIENCE_SCHEMA = "agenttrail.resilience.v1";
const DEFAULT_RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const DEFAULT_RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETRESET",
  "ENETUNREACH",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET"
]);
const DEFAULT_MIN_FREE_BYTES = 64 * 1024 * 1024;
const APPEND_LOCKS = new Map();

function nowIso() {
  return new Date().toISOString();
}

function normalizeErrorCode(error) {
  return String(error && (error.code || error.cause?.code || error.name) || "").toUpperCase();
}

function isRetryableStatus(status) {
  return DEFAULT_RETRYABLE_STATUS_CODES.has(Number(status || 0));
}

function isTransientError(error) {
  if (!error) {
    return false;
  }
  if (isRetryableStatus(error.status || error.statusCode)) {
    return true;
  }
  const code = normalizeErrorCode(error);
  if (DEFAULT_RETRYABLE_ERROR_CODES.has(code)) {
    return true;
  }
  const message = String(error.message || error || "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("socket hang up") ||
    message.includes("connection reset") ||
    message.includes("temporarily unavailable") ||
    message.includes("transient") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function retryDelay(attempt, options = {}) {
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs ?? 150));
  const maxDelayMs = Math.max(baseDelayMs, Number(options.maxDelayMs ?? 1200));
  const jitterMs = Math.max(0, Number(options.jitterMs ?? 25));
  const exponential = Math.min(maxDelayMs, baseDelayMs * (2 ** Math.max(0, attempt - 1)));
  const jitter = jitterMs ? Math.floor(Math.random() * jitterMs) : 0;
  return exponential + jitter;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

async function withRetry(operation, options = {}) {
  const retries = Math.max(0, Number(options.retries ?? 2));
  const shouldRetry = typeof options.shouldRetry === "function" ? options.shouldRetry : isTransientError;
  const attempts = [];
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const value = await operation({ attempt, previousError: lastError, attempts: attempts.slice() });
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return { ...value, retry: { attempts: attempt, attempted: attempts, retried: attempt > 1 } };
      }
      return { value, retry: { attempts: attempt, attempted: attempts, retried: attempt > 1 } };
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry(error);
      const delayMs = retryable && attempt <= retries ? retryDelay(attempt, options) : 0;
      attempts.push({
        attempt,
        retryable,
        delayMs,
        code: normalizeErrorCode(error) || null,
        status: Number(error && (error.status || error.statusCode) || 0) || null,
        message: String(error && error.message || error || "Unknown error").slice(0, 300)
      });
      if (!retryable || attempt > retries) {
        const exhausted = new Error(`Retry exhausted after ${attempt} attempt${attempt === 1 ? "" : "s"}: ${error.message || error}`);
        exhausted.code = "RETRY_EXHAUSTED";
        exhausted.cause = error;
        exhausted.attempts = attempts;
        throw exhausted;
      }
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("Retry failed before first attempt");
}

async function atomicWriteFile(absolutePath, data, options = {}) {
  const dir = path.dirname(absolutePath);
  const base = path.basename(absolutePath);
  await fsp.mkdir(dir, { recursive: true });
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tempPath = path.join(dir, `.${base}.tmp-${suffix}`);
  await fsp.writeFile(tempPath, data, options);
  try {
    const handle = await fsp.open(tempPath, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // fsync is best-effort across platforms and filesystems.
  }
  await fsp.rename(tempPath, absolutePath);
  try {
    const dirHandle = await fsp.open(dir, "r");
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    // Directory fsync is unavailable on some platforms.
  }
  return { path: absolutePath, atomic: true };
}

async function appendLineAtomic(absolutePath, line, options = {}) {
  const key = path.resolve(absolutePath);
  const previous = APPEND_LOCKS.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const encoding = options.encoding || "utf8";
    const existing = await fsp.readFile(absolutePath, encoding).catch(() => "");
    const cleanLine = String(line || "").endsWith("\n") ? String(line || "") : `${String(line || "")}\n`;
    return atomicWriteFile(absolutePath, `${existing}${cleanLine}`, encoding);
  });
  const lock = next.finally(() => {
    if (APPEND_LOCKS.get(key) === lock) {
      APPEND_LOCKS.delete(key);
    }
  });
  APPEND_LOCKS.set(key, lock);
  return next;
}

async function diskSpaceStatus(root, requiredBytes = 0, options = {}) {
  const minFreeBytes = Number(options.minFreeBytes ?? DEFAULT_MIN_FREE_BYTES);
  const required = Math.max(0, Number(requiredBytes || 0));
  const pathForStat = path.resolve(root || process.cwd());
  if (typeof fsp.statfs !== "function") {
    return {
      ok: true,
      checked: false,
      reason: "statfs-unavailable",
      path: pathForStat,
      requiredBytes: required,
      minFreeBytes
    };
  }
  try {
    const stat = await fsp.statfs(pathForStat);
    const blockSize = Number(stat.bsize || stat.frsize || 0);
    const freeBytes = Number(stat.bavail || stat.bfree || 0) * blockSize;
    const totalBytes = Number(stat.blocks || 0) * blockSize;
    const thresholdBytes = Math.max(required, minFreeBytes);
    return {
      ok: freeBytes >= thresholdBytes,
      checked: true,
      path: pathForStat,
      freeBytes,
      totalBytes,
      requiredBytes: required,
      minFreeBytes,
      thresholdBytes,
      message: freeBytes >= thresholdBytes
        ? "Enough local disk space is available."
        : `Only ${freeBytes} bytes free; ${thresholdBytes} bytes required.`
    };
  } catch (error) {
    return {
      ok: true,
      checked: false,
      reason: error.message,
      path: pathForStat,
      requiredBytes: required,
      minFreeBytes
    };
  }
}

async function assertDiskSpace(root, requiredBytes = 0, options = {}) {
  const status = await diskSpaceStatus(root, requiredBytes, options);
  if (!status.ok) {
    const error = new Error(status.message || "Not enough local disk space for this write.");
    error.code = "DISK_SPACE";
    error.status = status;
    throw error;
  }
  return status;
}

function indexHealthFromParsed(index, vectorStore = null) {
  const itemCount = Array.isArray(index && index.items) ? index.items.length : 0;
  const chunkCount = Array.isArray(index && index.chunks) ? index.chunks.length : 0;
  const schemaOk = Boolean(index && index.schema === "agenttrail.search-index.v1");
  return {
    schema: "agenttrail.search-index-health.v1",
    ok: schemaOk,
    corrupt: !schemaOk,
    reason: schemaOk ? null : "invalid-search-index-schema",
    provider: index && index.provider || "none",
    model: index && index.model || null,
    itemCount,
    chunkCount,
    vectorStoreCompatible: Boolean(vectorStore),
    checkedAt: nowIso()
  };
}

function buildResilienceStatus(parts = {}) {
  const backend = parts.backend || { available: false, error: "Backend status unavailable" };
  const config = parts.config || { ok: true, checks: [] };
  const disk = parts.disk || { ok: true, checked: false };
  const searchIndex = parts.searchIndex || { ok: true, corrupt: false };
  const checks = [
    {
      id: "backend",
      ok: backend.available !== false,
      code: backend.available === false ? "MODEL_BACKEND" : null,
      message: backend.available === false ? (backend.message || backend.error || "Model backend is unavailable.") : "Model backend is reachable."
    },
    {
      id: "config",
      ok: config.ok !== false,
      code: config.ok === false ? "STARTUP_CONFIG" : null,
      message: config.ok === false ? "Startup configuration has warnings." : "Startup configuration is valid."
    },
    {
      id: "disk",
      ok: disk.ok !== false,
      code: disk.ok === false ? "DISK_SPACE" : null,
      message: disk.ok === false ? (disk.message || "Disk guard failed.") : "Disk guard is healthy."
    },
    {
      id: "search-index",
      ok: searchIndex.corrupt !== true,
      code: searchIndex.corrupt ? "CORRUPT_INDEX" : null,
      message: searchIndex.corrupt ? (searchIndex.reason || "Search index needs rebuild.") : "Search index is readable."
    }
  ];
  const degraded = checks.some((check) => !check.ok);
  return {
    schema: RESILIENCE_SCHEMA,
    ok: true,
    status: degraded ? "degraded" : "healthy",
    checks,
    backend,
    config,
    disk,
    searchIndex,
    actions: checks
      .filter((check) => !check.ok)
      .map((check) => actionForCheck(check.id, check.code)),
    time: nowIso()
  };
}

function actionForCheck(id, code) {
  if (id === "backend") {
    return { code, title: "Start model backend", command: "ollama serve", detail: "Then pull the selected model and refresh status." };
  }
  if (id === "config") {
    return { code, title: "Fix startup config", command: "npm run test:health", detail: "Review /api/config for exact invalid values." };
  }
  if (id === "disk") {
    return { code, title: "Free disk space", command: null, detail: "Remove old pulls, exports, or receipts before a large write." };
  }
  if (id === "search-index") {
    return { code, title: "Rebuild local index", command: null, detail: "Open Search and click Build search index, or call POST /api/search-index." };
  }
  return { code, title: "Review resilience check", command: null, detail: "Open System for details." };
}

module.exports = {
  RESILIENCE_SCHEMA,
  DEFAULT_MIN_FREE_BYTES,
  atomicWriteFile,
  appendLineAtomic,
  assertDiskSpace,
  buildResilienceStatus,
  diskSpaceStatus,
  indexHealthFromParsed,
  isRetryableStatus,
  isTransientError,
  retryDelay,
  withRetry
};
