"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { atomicWriteFile } = require("./resilience");

const RELEASE_ARTIFACTS = [
  "server.js",
  "package.json",
  "Dockerfile",
  ".dockerignore",
  ".npmignore",
  "bin/agenttrail.js",
  "src/cli.js",
  "src/privacy.js",
  "src/privacy-controls.js",
  "src/network-policy.js",
  "src/resilience.js",
  "src/observability.js",
  "src/team-enterprise.js",
  "src/workspace-safety.js",
  "src/model-ecosystem.js",
  "src/advanced-agent.js",
  "src/permissions.js",
  "src/features/errors.js",
  "src/features/redact.js",
  "src/features/security.js",
  "scripts/generate-sbom.js",
  "scripts/sign-checksums.js",
  "scripts/verify-checksums.js",
  "scripts/reproducible-build.js",
  "scripts/coverage-report.js",
  "scripts/performance-regression.js",
  "scripts/generate-docs-site.js",
  "scripts/generate-api-reference.js",
  "scripts/update-homebrew-formula.js",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  ".github/labels.yml",
  ".github/pull_request_template.md",
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
  "docs/GETTING_STARTED.md",
  "docs/RECIPE_AUTHORING.md",
  "docs/BACKEND_SETUP.md",
  "docs/MODEL_ECOSYSTEM.md",
  "docs/ADVANCED_AGENT.md",
  "docs/ARCHITECTURE.md",
  "docs/API_REFERENCE.md",
  "docs/VIDEO_WALKTHROUGHS.md",
  "docs/LAUNCH_RESPONSE_WORKFLOW.md",
  "docs/RECIPE_MARKETPLACE.md",
  "docs/GOOD_FIRST_ISSUES.md",
  "docs/RELEASE_PROCESS.md",
  "docs/SHOWCASE.md",
  "docs/COMPARISON_BENCHMARKS.md",
  "docs/PLUGIN_SDK.md",
  "docs/TROUBLESHOOTING.md",
  "docs/SUPPLY_CHAIN.md",
  "docs/SECURITY_POSTURE.md",
  "docs/TEAM_ENTERPRISE.md",
  "docs/QUALITY_ENGINEERING.md",
  "docs/quality/eval-scoreboard.json",
  "docs/quality/performance-baseline.json",
  "docs/site/index.html",
  "docs/site/search-index.json",
  "docs/video-walkthroughs/storyboards.json",
  "docs/launch/response-kit.json",
  "docs/community/good-first-issues.json",
  "docs/showcase/gallery.json",
  "docs/benchmarks/comparison.json",
  "docs/RELEASE_SIGNING.md",
  "docs/NPM_PUBLISH.md",
  "docs/sbom/agenttrail-v0.7.0.spdx.json",
  "Formula/agenttrail.rb",
  ".github/workflows/container.yml",
  ".github/workflows/npm-publish.yml",
  ".github/workflows/release-artifacts.yml",
  "docker-compose.yml",
  "team/users.json",
  "marketplace/recipes.json",
  "plugins/receipt-reporter/plugin.json",
  "plugins/read-only-url/plugin.json",
  "tests/unit/security-privacy.test.js",
  "tests/integration/privacy-controls.test.js",
  "tests/integration/threat-model.test.js",
  "tests/unit/observability.test.js",
  "tests/integration/observability.test.js",
  "tests/unit/resilience.test.js",
  "tests/integration/resilience.test.js",
  "tests/unit/team-enterprise.test.js",
  "tests/integration/team-enterprise.test.js",
  "tests/unit/model-ecosystem.test.js",
  "tests/integration/model-ecosystem.test.js",
  "tests/unit/advanced-agent.test.js",
  "tests/integration/advanced-agent.test.js",
  "tests/integration/conversation-export.test.js",
  "tests/integration/redact.test.js",
  "tests/unit/quality-engineering.test.js",
  "tests/unit/workspace-safety-fuzz.test.js",
  "tests/unit/docs.test.js",
  "tests/unit/community-growth.test.js",
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
  await atomicWriteFile(outputPath, `${rows.join("\n")}\n`, "utf8");
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
