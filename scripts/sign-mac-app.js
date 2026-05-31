#!/usr/bin/env node

"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const appPath = path.resolve(process.env.AGENTTRAIL_MAC_APP || path.join(projectRoot, "dist", "mac", "AgentTrail.app"));
const dryRun = process.argv.includes("--dry-run") || process.env.AGENTTRAIL_SIGN_DRY_RUN === "1";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const identity = process.env.AGENTTRAIL_DEVELOPER_ID_APPLICATION || "";
  const appleId = process.env.APPLE_ID || "";
  const teamId = process.env.APPLE_TEAM_ID || "";
  const password = process.env.APPLE_APP_SPECIFIC_PASSWORD || "";
  const commands = [
    ["codesign", ["--force", "--deep", "--options", "runtime", "--timestamp", "--sign", identity || "Developer ID Application: <name>", appPath]],
    ["ditto", ["-c", "-k", "--keepParent", appPath, `${appPath}.zip`]],
    ["xcrun", ["notarytool", "submit", `${appPath}.zip`, "--apple-id", appleId || "<apple-id>", "--team-id", teamId || "<team-id>", "--password", password ? "<app-specific-password>" : "<password>", "--wait"]],
    ["xcrun", ["stapler", "staple", appPath]]
  ];

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, appPath, commands }, null, 2));
    return;
  }

  if (!identity || !appleId || !teamId || !password) {
    throw new Error("Set AGENTTRAIL_DEVELOPER_ID_APPLICATION, APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD, or run with --dry-run.");
  }

  for (const [command, args] of commands) {
    await execFileAsync(command, args, { cwd: projectRoot, stdio: "inherit" });
  }
  console.log(`Signed and notarized ${appPath}`);
}
