#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");
const packageMeta = require("../../package.json");

const projectRoot = path.resolve(__dirname, "..", "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  await assertIncludes("Dockerfile", ["TARGETPLATFORM", "org.opencontainers.image.source", "USER agenttrail"]);
  await assertIncludes(".github/workflows/container.yml", ["linux/amd64,linux/arm64", "docker/build-push-action"]);
  await assertIncludes("Formula/agenttrail.rb", ["sha256", "agenttrail-chat", "service do"]);
  await assertIncludes(".github/workflows/npm-publish.yml", ["npm publish --provenance", "NPM_TOKEN"]);
  await assertIncludes("scripts/generate-sbom.js", ["SPDX-2.3", "packageVerificationCode"]);
  await assertIncludes("scripts/sign-checksums.js", ["AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY", "checksum-signature.v1"]);
  await assertIncludes("scripts/reproducible-build.js", ["npm", "pack", "reproducible-build.v1"]);
  await assertIncludes("docs/SUPPLY_CHAIN.md", ["SBOM", "Reproducible", "Multi-arch"]);
  const sbom = JSON.parse(await fsp.readFile(path.join(projectRoot, "docs", "sbom", `agenttrail-v${packageMeta.version}.spdx.json`), "utf8"));
  assert.equal(sbom.spdxVersion, "SPDX-2.3");
  assert.equal(sbom.packages[0].versionInfo, packageMeta.version);
  console.log("Supply-chain unit tests passed");
}

async function assertIncludes(relativePath, needles) {
  const content = await fsp.readFile(path.join(projectRoot, relativePath), "utf8");
  for (const needle of needles) {
    assert.equal(content.includes(needle), true, `${relativePath} should include ${needle}`);
  }
}
