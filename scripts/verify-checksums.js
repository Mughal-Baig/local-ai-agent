#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const packageMeta = require("../package.json");

const projectRoot = path.resolve(__dirname, "..");
const checksumPath = path.join(projectRoot, "docs", "checksums", `SHA256SUMS_v${packageMeta.version}.txt`);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const text = await fsp.readFile(checksumPath, "utf8");
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const mismatches = [];
  for (const row of rows) {
    const match = row.match(/^([a-f0-9]{64}|MISSING)\s+(.+)$/i);
    if (!match) {
      mismatches.push({ row, reason: "invalid-row" });
      continue;
    }
    const expected = match[1];
    const relativePath = match[2];
    const absolutePath = path.join(projectRoot, relativePath);
    try {
      const actual = sha256(await fsp.readFile(absolutePath));
      if (expected === "MISSING" || actual !== expected.toLowerCase()) {
        mismatches.push({ file: relativePath, expected, actual });
      }
    } catch {
      if (expected !== "MISSING") {
        mismatches.push({ file: relativePath, expected, actual: "MISSING" });
      }
    }
  }
  if (mismatches.length) {
    throw new Error(`Checksum verification failed: ${JSON.stringify(mismatches, null, 2)}`);
  }
  console.log(`Verified ${rows.length} checksum row(s)`);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
