"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const RELEASE_ARTIFACTS = [
  "server.js",
  "package.json",
  "Dockerfile",
  ".dockerignore",
  ".npmignore",
  "bin/agenttrail.js",
  "src/cli.js",
  "src/privacy.js",
  "src/network-policy.js",
  "src/observability.js",
  "src/team-enterprise.js",
  "src/permissions.js",
  "src/features/errors.js",
  "src/features/redact.js",
  "src/features/security.js",
  "scripts/generate-sbom.js",
  "scripts/sign-checksums.js",
  "scripts/verify-checksums.js",
  "scripts/reproducible-build.js",
  "scripts/update-homebrew-formula.js",
  "mcp/server.js",
  "scripts/package-mac-app.js",
  "scripts/sign-mac-app.js",
  "scripts/sign-windows.js",
  "desktop/mac/AgentTrailMenuBar.swift",
  "desktop/windows/AgentTrail-Tray.ps1",
  "desktop/linux/agenttrail-tray.sh",
  "updates/latest.json",
  "docs/agenttrail-demo.gif",
  "docs/MAC_APP.md",
  "docs/CLI.md",
  "docs/SUPPLY_CHAIN.md",
  "docs/SECURITY_POSTURE.md",
  "docs/TEAM_ENTERPRISE.md",
  "docs/RELEASE_SIGNING.md",
  "docs/NPM_PUBLISH.md",
  "docs/sbom/agenttrail-v0.7.0.spdx.json",
  "Formula/agenttrail.rb",
  ".github/workflows/container.yml",
  ".github/workflows/npm-publish.yml",
  ".github/workflows/release-artifacts.yml",
  "docker-compose.yml",
  "team/users.json",
  "tests/unit/security-privacy.test.js",
  "tests/integration/threat-model.test.js",
  "tests/unit/observability.test.js",
  "tests/integration/observability.test.js",
  "tests/unit/team-enterprise.test.js",
  "tests/integration/team-enterprise.test.js",
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
