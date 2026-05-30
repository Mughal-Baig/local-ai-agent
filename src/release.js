"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const RELEASE_ARTIFACTS = [
  "server.js",
  "package.json",
  "bin/agenttrail.js",
  "mcp/server.js",
  "docs/agenttrail-demo.gif",
  "Dockerfile",
  "docker-compose.yml",
  "install.sh"
];

async function generateChecksums(projectRoot, version) {
  const rows = [];
  for (const relativePath of RELEASE_ARTIFACTS) {
    const absolutePath = path.join(projectRoot, relativePath);
    try {
      const data = await fsp.readFile(absolutePath);
      rows.push(`${crypto.createHash("sha256").update(data).digest("hex")}  ${relativePath}`);
    } catch {
      rows.push(`MISSING  ${relativePath}`);
    }
  }

  const outputPath = path.join(projectRoot, "docs", "checksums", `SHA256SUMS_${version}.txt`);
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, `${rows.join("\n")}\n`, "utf8");
  return {
    version,
    path: path.relative(projectRoot, outputPath),
    count: rows.length,
    rows
  };
}

module.exports = {
  RELEASE_ARTIFACTS,
  generateChecksums
};
