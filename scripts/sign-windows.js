#!/usr/bin/env node

"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const artifact = path.resolve(process.env.AGENTTRAIL_WINDOWS_ARTIFACT || path.join(projectRoot, "installers", "windows", "AgentTrail-Setup.exe"));
const dryRun = process.argv.includes("--dry-run") || process.env.AGENTTRAIL_SIGN_DRY_RUN === "1";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const thumbprint = process.env.AGENTTRAIL_WINDOWS_CERT_THUMBPRINT || "";
  const timestampUrl = process.env.AGENTTRAIL_WINDOWS_TIMESTAMP_URL || "http://timestamp.digicert.com";
  const command = "signtool";
  const args = ["sign", "/fd", "SHA256", "/tr", timestampUrl, "/td", "SHA256", "/sha1", thumbprint || "<certificate-thumbprint>", artifact];

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, artifact, command, args }, null, 2));
    return;
  }
  if (!thumbprint) {
    throw new Error("Set AGENTTRAIL_WINDOWS_CERT_THUMBPRINT, or run with --dry-run.");
  }
  await execFileAsync(command, args, { cwd: projectRoot, stdio: "inherit" });
  console.log(`Signed ${artifact}`);
}
