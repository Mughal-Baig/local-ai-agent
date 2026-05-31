#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  desktopNotificationsEnabled,
  notificationThresholdMs,
  shouldNotifyLongTask,
  buildNotificationCommand
} = require("../../src/desktop-notifications");

const projectRoot = path.resolve(__dirname, "..", "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  assert.equal(desktopNotificationsEnabled({ AGENTTRAIL_DESKTOP: "1" }), true);
  assert.equal(desktopNotificationsEnabled({ AGENTTRAIL_DESKTOP_NOTIFICATIONS: "off", AGENTTRAIL_DESKTOP: "1" }), false);
  assert.equal(notificationThresholdMs({ AGENTTRAIL_NOTIFY_AFTER_MS: "0" }), 0);
  assert.equal(shouldNotifyLongTask(1000, { AGENTTRAIL_DESKTOP: "1", AGENTTRAIL_NOTIFY_AFTER_MS: "10" }, 1011), true);
  assert.equal(shouldNotifyLongTask(1000, { AGENTTRAIL_DESKTOP: "1", AGENTTRAIL_NOTIFY_AFTER_MS: "20" }, 1011), false);
  assert.equal(buildNotificationCommand("AgentTrail", "Done", "darwin").command, "osascript");
  assert.equal(buildNotificationCommand("AgentTrail", "Done", "win32").command, "powershell.exe");
  assert.equal(buildNotificationCommand("AgentTrail", "Done", "linux").command, "notify-send");

  await assertFileIncludes("desktop/mac/AgentTrailMenuBar.swift", ["NSStatusBar", "AGENTTRAIL_APP_MODE", "Restart Server"]);
  await assertFileIncludes("desktop/windows/AgentTrail-Tray.ps1", ["NotifyIcon", "Restart server", "AGENTTRAIL_APP_MODE"]);
  await assertFileIncludes("desktop/linux/agenttrail-tray.sh", ["notify-send", "AGENTTRAIL_DESKTOP"]);
  await assertFileIncludes("updates/latest.json", ["agenttrail.update-channel.v1", "\"stable\""]);
  await assertFileIncludes("installers/windows/AgentTrail.iss", ["AgentTrail-Setup", "Sign"]);
  await assertFileIncludes("installers/windows/AgentTrail.wxs", ["Wix", "AgentTrailFiles"]);
  await assertFileIncludes("installers/linux/debian/control", ["Package: agenttrail", "Depends: nodejs"]);
  await assertFileIncludes("installers/linux/agenttrail.spec", ["Name: agenttrail", "BuildArch: noarch"]);
  await assertFileIncludes("installers/linux/AppRun", ["AGENTTRAIL_DESKTOP", "node server.js"]);
  await assertFileIncludes("scripts/sign-mac-app.js", ["notarytool", "stapler"]);
  await assertFileIncludes("scripts/sign-windows.js", ["signtool", "AGENTTRAIL_WINDOWS_CERT_THUMBPRINT"]);
  console.log("Desktop distribution unit tests passed");
}

async function assertFileIncludes(relativePath, needles) {
  const content = await fsp.readFile(path.join(projectRoot, relativePath), "utf8");
  for (const needle of needles) {
    assert.equal(content.includes(needle), true, `${relativePath} should include ${needle}`);
  }
}
