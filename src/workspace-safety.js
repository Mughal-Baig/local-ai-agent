"use strict";

const path = require("node:path");

const MAX_DIFF_TEXT = 6000;

function normalizeRelativePath(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .trim();
}

function validateRelativePath(relativePath) {
  const raw = String(relativePath || "").trim().replace(/\\/g, "/");
  const normalized = normalizeRelativePath(relativePath);
  if (/[\0\r\n]/.test(normalized)) {
    throw new Error("Path contains unsafe control characters");
  }
  if (raw.startsWith("/") || /^[a-zA-Z]:\//.test(raw)) {
    throw new Error("Path escapes the workspace");
  }
  return normalized;
}

function resolveWorkspacePath(workspaceRoot, relativePath) {
  const root = path.resolve(workspaceRoot);
  const normalized = validateRelativePath(relativePath);
  const absolutePath = path.resolve(root, normalized);
  const relative = path.relative(root, absolutePath);
  const inside = relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  if (!inside) {
    throw new Error("Path escapes the workspace");
  }
  return absolutePath;
}

function isWorkspacePathSafe(workspaceRoot, relativePath) {
  try {
    resolveWorkspacePath(workspaceRoot, relativePath);
    return true;
  } catch {
    return false;
  }
}

function createUnifiedDiff(filePath, before, after) {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);

  if (String(before || "") === String(after || "")) {
    return {
      text: [`--- a/${filePath}`, `+++ b/${filePath}`, " no changes"].join("\n"),
      stats: { added: 0, removed: 0 }
    };
  }

  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const contextBefore = beforeLines.slice(Math.max(0, prefix - 3), prefix);
  const removed = beforeLines.slice(prefix, beforeLines.length - suffix);
  const added = afterLines.slice(prefix, afterLines.length - suffix);
  const contextAfter = beforeLines.slice(
    beforeLines.length - suffix,
    Math.min(beforeLines.length, beforeLines.length - suffix + 3)
  );

  const lines = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    ...contextBefore.map((line) => ` ${line}`),
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
    ...contextAfter.map((line) => ` ${line}`)
  ];

  return {
    text: truncate(lines.join("\n"), MAX_DIFF_TEXT),
    stats: {
      added: added.length,
      removed: removed.length
    }
  };
}

function splitLines(text) {
  const value = String(text || "");
  return value ? value.split(/\r?\n/) : [];
}

function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 24)}\n...[truncated]`;
}

module.exports = {
  MAX_DIFF_TEXT,
  createUnifiedDiff,
  isWorkspacePathSafe,
  normalizeRelativePath,
  resolveWorkspacePath,
  splitLines,
  validateRelativePath
};
