"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

const PRIVACY_SETTINGS_PATH = ".agenttrail/privacy-settings.json";
const RETENTION_POLICY_PATH = ".agenttrail/retention-policy.json";
const LOCAL_ANALYTICS_PATH = ".agenttrail/local-analytics.json";
const WIPE_CONFIRMATION = "WIPE LOCAL DATA";
const MAX_DASHBOARD_FILES = 5000;

const ARTIFACT_TYPES = [
  { id: "conversations", label: "Conversations", paths: [".agenttrail/conversations", ".agenttrail/conversations-trash"], defaultRetentionDays: 365, wipe: true },
  { id: "receipts", label: "Receipts", paths: ["receipts"], defaultRetentionDays: 365, wipe: true },
  { id: "sessions", label: "Sessions", paths: ["sessions"], defaultRetentionDays: 365, wipe: true },
  { id: "reports", label: "Reports", paths: ["reports"], defaultRetentionDays: 365, wipe: true },
  { id: "memory", label: "Project memory", paths: ["memory"], defaultRetentionDays: 0, wipe: true },
  { id: "indexes", label: "Search and vector indexes", paths: [".agenttrail/search-index.json", ".agenttrail/vector-store.json", ".agenttrail/search-collections", ".agenttrail/vector-store-migrations.json"], defaultRetentionDays: 90, wipe: true },
  { id: "pending", label: "Pending runs", paths: [".agenttrail/pending-run.json"], defaultRetentionDays: 7, wipe: true },
  { id: "logs", label: "Logs and event stores", paths: [".agenttrail/logs.jsonl", ".agenttrail/store.jsonl", ".agenttrail/agenttrail.db"], defaultRetentionDays: 30, wipe: true },
  { id: "analytics", label: "Local analytics", paths: [LOCAL_ANALYTICS_PATH], defaultRetentionDays: 30, wipe: true },
  { id: "backups", label: "Backups and restores", paths: ["backups", "restored"], defaultRetentionDays: 30, wipe: true },
  { id: "attachments", label: "Attachments and generated media", paths: ["attachments", "ingested", "images/generated"], defaultRetentionDays: 30, wipe: true },
  { id: "settings", label: "Privacy and workspace settings", paths: [PRIVACY_SETTINGS_PATH, RETENTION_POLICY_PATH, ".agenttrail/workspace-profile.json", ".agenttrail/backup-schedule.json"], defaultRetentionDays: 0, wipe: true }
];

async function readPrivacySettings(workspaceRoot) {
  return normalizePrivacySettings(await readJson(workspaceRoot, PRIVACY_SETTINGS_PATH));
}

async function writePrivacySettings(workspaceRoot, input = {}) {
  const current = await readPrivacySettings(workspaceRoot);
  const next = normalizePrivacySettings(input, current);
  await writeJson(workspaceRoot, PRIVACY_SETTINGS_PATH, next);
  return next;
}

function normalizePrivacySettings(input = {}, current = null) {
  const localAnalyticsInput = typeof input.localAnalytics === "object" && input.localAnalytics
    ? input.localAnalytics
    : {};
  const enabled = typeof input.localAnalyticsEnabled === "boolean"
    ? input.localAnalyticsEnabled
    : typeof localAnalyticsInput.enabled === "boolean"
      ? localAnalyticsInput.enabled
      : Boolean(current && current.localAnalytics && current.localAnalytics.enabled);
  return {
    schema: "agenttrail.privacy-settings.v1",
    updatedAt: new Date().toISOString(),
    localAnalytics: {
      enabled,
      network: "disabled",
      mode: "local-only",
      storagePath: enabled ? LOCAL_ANALYTICS_PATH : null,
      includes: ["counts", "latency", "error codes", "trace ids"],
      excludes: ["prompts", "file contents", "diff text", "token text"]
    }
  };
}

async function readRetentionPolicy(workspaceRoot) {
  return normalizeRetentionPolicy(await readJson(workspaceRoot, RETENTION_POLICY_PATH));
}

async function writeRetentionPolicy(workspaceRoot, input = {}) {
  const current = await readRetentionPolicy(workspaceRoot);
  const next = normalizeRetentionPolicy(input, current);
  await writeJson(workspaceRoot, RETENTION_POLICY_PATH, next);
  return next;
}

function normalizeRetentionPolicy(input = {}, current = null) {
  const source = current && current.artifacts ? current.artifacts : {};
  const overrides = input && input.artifacts && typeof input.artifacts === "object" ? input.artifacts : input;
  const artifacts = {};
  for (const artifact of ARTIFACT_TYPES) {
    const raw = Object.prototype.hasOwnProperty.call(overrides || {}, artifact.id)
      ? overrides[artifact.id]
      : source[artifact.id];
    artifacts[artifact.id] = normalizeRetentionDays(raw, artifact.defaultRetentionDays);
  }
  return {
    schema: "agenttrail.retention-policy.v1",
    updatedAt: new Date().toISOString(),
    note: "0 means keep until manually wiped. Retention applies only to AgentTrail-managed local data.",
    artifacts
  };
}

async function buildPrivacyDashboard(workspaceRoot, options = {}) {
  const policy = options.retentionPolicy || await readRetentionPolicy(workspaceRoot);
  const settings = options.settings || await readPrivacySettings(workspaceRoot);
  const artifacts = [];
  for (const artifact of ARTIFACT_TYPES) {
    const files = await collectArtifactFiles(workspaceRoot, artifact);
    const sizeBytes = files.reduce((sum, file) => sum + file.size, 0);
    artifacts.push({
      id: artifact.id,
      label: artifact.label,
      paths: artifact.paths.slice(),
      retentionDays: policy.artifacts[artifact.id],
      count: files.length,
      sizeBytes,
      oldestModifiedAt: oldest(files),
      newestModifiedAt: newest(files),
      sampleFiles: files.slice(0, 8).map((file) => file.path),
      wipeIncluded: artifact.wipe === true
    });
  }
  return {
    schema: "agenttrail.privacy-dashboard.v1",
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    localOnly: true,
    network: "disabled; these controls do not send telemetry or workspace data anywhere",
    settings,
    retentionPolicy: policy,
    totals: {
      artifactTypes: artifacts.length,
      files: artifacts.reduce((sum, artifact) => sum + artifact.count, 0),
      sizeBytes: artifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0)
    },
    artifacts
  };
}

async function applyRetentionPolicy(workspaceRoot, policy, options = {}) {
  const dryRun = options.dryRun !== false;
  const now = Number(options.now || Date.now());
  const deleted = [];
  const kept = [];
  const artifacts = [];
  for (const artifact of ARTIFACT_TYPES) {
    const retentionDays = normalizeRetentionDays(policy.artifacts && policy.artifacts[artifact.id], artifact.defaultRetentionDays);
    const files = await collectArtifactFiles(workspaceRoot, artifact);
    const cutoff = retentionDays > 0 ? now - retentionDays * 24 * 60 * 60 * 1000 : null;
    const expired = cutoff
      ? files.filter((file) => Date.parse(file.modifiedAt) < cutoff)
      : [];
    for (const file of expired) {
      if (!dryRun) {
        await fsp.unlink(resolveWorkspacePath(workspaceRoot, file.path)).catch(() => {});
      }
      deleted.push(file);
    }
    for (const file of files) {
      if (!expired.some((item) => item.path === file.path)) {
        kept.push(file);
      }
    }
    artifacts.push({
      id: artifact.id,
      retentionDays,
      scanned: files.length,
      expired: expired.length,
      bytesExpired: expired.reduce((sum, file) => sum + file.size, 0)
    });
    if (!dryRun) {
      await cleanupArtifactDirs(workspaceRoot, artifact);
    }
  }
  return {
    schema: "agenttrail.retention-apply.v1",
    dryRun,
    appliedAt: new Date().toISOString(),
    deleted: deleted.map(publicFileInfo),
    kept: kept.length,
    bytesDeleted: deleted.reduce((sum, file) => sum + file.size, 0),
    artifacts
  };
}

async function wipeLocalData(workspaceRoot, options = {}) {
  const dryRun = options.dryRun !== false;
  if (!dryRun && options.confirm !== WIPE_CONFIRMATION) {
    throw new Error(`Set confirm to "${WIPE_CONFIRMATION}" to wipe AgentTrail local data.`);
  }
  const targets = ARTIFACT_TYPES.filter((artifact) => artifact.wipe === true);
  const files = [];
  for (const artifact of targets) {
    files.push(...await collectArtifactFiles(workspaceRoot, artifact));
  }
  const deletedPaths = [];
  const skipped = [];
  if (!dryRun) {
    for (const artifact of targets) {
      for (const relativePath of artifact.paths) {
        try {
          await fsp.rm(resolveWorkspacePath(workspaceRoot, relativePath), { recursive: true, force: true });
          deletedPaths.push(relativePath);
        } catch (error) {
          skipped.push({ path: relativePath, reason: error.message });
        }
      }
    }
  }
  return {
    schema: "agenttrail.local-data-wipe.v1",
    dryRun,
    confirmation: WIPE_CONFIRMATION,
    files: files.map(publicFileInfo),
    fileCount: files.length,
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    deletedPaths,
    skipped,
    wipedAt: dryRun ? null : new Date().toISOString()
  };
}

async function analyticsResponse(workspaceRoot, baseAnalytics, settings = null) {
  const resolved = settings || await readPrivacySettings(workspaceRoot);
  if (!resolved.localAnalytics.enabled) {
    return {
      schema: "agenttrail.local-analytics.v1",
      enabled: false,
      network: "disabled",
      privacy: "opt-in required; prompts, file contents, diffs, and token text are never included",
      storagePath: null,
      totals: null,
      recentTraceIds: []
    };
  }
  const analytics = {
    ...baseAnalytics,
    enabled: true,
    network: "disabled",
    storagePath: LOCAL_ANALYTICS_PATH,
    privacy: `${baseAnalytics.privacy}; local-only opt-in is enabled`
  };
  await writeJson(workspaceRoot, LOCAL_ANALYTICS_PATH, analytics);
  return analytics;
}

async function collectArtifactFiles(workspaceRoot, artifact) {
  const files = [];
  for (const relativePath of artifact.paths || []) {
    await collectFilesAtPath(workspaceRoot, relativePath, files);
    if (files.length >= MAX_DASHBOARD_FILES) {
      break;
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files.slice(0, MAX_DASHBOARD_FILES);
}

async function collectFilesAtPath(workspaceRoot, relativePath, files) {
  const absolutePath = resolveWorkspacePath(workspaceRoot, relativePath);
  const stat = await fsp.stat(absolutePath).catch(() => null);
  if (!stat) {
    return;
  }
  if (stat.isFile()) {
    files.push(fileInfo(workspaceRoot, absolutePath, stat));
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  const entries = await fsp.readdir(absolutePath, { withFileTypes: true }).catch(() => []);
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (files.length >= MAX_DASHBOARD_FILES || entry.name === ".DS_Store") {
      continue;
    }
    const childPath = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      await collectFilesAtPath(workspaceRoot, relativeFromRoot(workspaceRoot, childPath), files);
    } else if (entry.isFile()) {
      const childStat = await fsp.stat(childPath).catch(() => null);
      if (childStat) files.push(fileInfo(workspaceRoot, childPath, childStat));
    }
  }
}

async function cleanupArtifactDirs(workspaceRoot, artifact) {
  for (const relativePath of artifact.paths || []) {
    await removeEmptyDirs(resolveWorkspacePath(workspaceRoot, relativePath), resolveWorkspacePath(workspaceRoot, ""));
  }
}

async function removeEmptyDirs(absolutePath, root) {
  const stat = await fsp.stat(absolutePath).catch(() => null);
  if (!stat || !stat.isDirectory()) return;
  const entries = await fsp.readdir(absolutePath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirs(path.join(absolutePath, entry.name), root);
    }
  }
  if (absolutePath !== root) {
    await fsp.rmdir(absolutePath).catch(() => {});
  }
}

function fileInfo(workspaceRoot, absolutePath, stat) {
  return {
    path: relativeFromRoot(workspaceRoot, absolutePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

function publicFileInfo(file) {
  return {
    path: file.path,
    size: file.size,
    modifiedAt: file.modifiedAt
  };
}

function oldest(files) {
  return files.reduce((value, file) => !value || file.modifiedAt < value ? file.modifiedAt : value, null);
}

function newest(files) {
  return files.reduce((value, file) => !value || file.modifiedAt > value ? file.modifiedAt : value, null);
}

function normalizeRetentionDays(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(3650, Math.floor(parsed)));
}

async function readJson(workspaceRoot, relativePath) {
  try {
    return JSON.parse(await fsp.readFile(resolveWorkspacePath(workspaceRoot, relativePath), "utf8"));
  } catch {
    return {};
  }
}

async function writeJson(workspaceRoot, relativePath, value) {
  const absolutePath = resolveWorkspacePath(workspaceRoot, relativePath);
  await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsp.writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveWorkspacePath(workspaceRoot, relativePath) {
  const root = path.resolve(workspaceRoot);
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  const absolutePath = path.resolve(root, normalized || ".");
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes the workspace");
  }
  return absolutePath;
}

function relativeFromRoot(workspaceRoot, absolutePath) {
  return path.relative(path.resolve(workspaceRoot), absolutePath).replace(/\\/g, "/");
}

module.exports = {
  ARTIFACT_TYPES,
  LOCAL_ANALYTICS_PATH,
  PRIVACY_SETTINGS_PATH,
  RETENTION_POLICY_PATH,
  WIPE_CONFIRMATION,
  analyticsResponse,
  applyRetentionPolicy,
  buildPrivacyDashboard,
  normalizePrivacySettings,
  normalizeRetentionPolicy,
  readPrivacySettings,
  readRetentionPolicy,
  wipeLocalData,
  writePrivacySettings,
  writeRetentionPolicy
};
