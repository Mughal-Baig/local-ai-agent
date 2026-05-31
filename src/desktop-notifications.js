"use strict";

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function desktopNotificationsEnabled(env = process.env) {
  const value = String(env.AGENTTRAIL_DESKTOP_NOTIFICATIONS || "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(value)) return false;
  if (["1", "true", "on", "yes"].includes(value)) return true;
  return env.AGENTTRAIL_DESKTOP === "1" || ["desktop", "menubar", "tray"].includes(String(env.AGENTTRAIL_APP_MODE || "").toLowerCase());
}

function notificationThresholdMs(env = process.env) {
  const value = Number(env.AGENTTRAIL_NOTIFY_AFTER_MS || env.AGENTTRAIL_DESKTOP_NOTIFICATION_THRESHOLD_MS || 30000);
  return Number.isFinite(value) && value >= 0 ? value : 30000;
}

function shouldNotifyLongTask(startedAt, env = process.env, now = Date.now()) {
  if (!desktopNotificationsEnabled(env)) return false;
  return now - Number(startedAt || now) >= notificationThresholdMs(env);
}

async function maybeNotifyLongTask({ startedAt, title, message, env = process.env, platform = process.platform }) {
  if (!shouldNotifyLongTask(startedAt, env)) {
    return { attempted: false, ok: false, reason: "threshold-not-met" };
  }
  return notifyNative(title || "AgentTrail", message || "Task completed.", { env, platform });
}

async function notifyNative(title, message, options = {}) {
  const command = buildNotificationCommand(title, message, options.platform || process.platform);
  if (!command) {
    return { attempted: false, ok: false, reason: "unsupported-platform" };
  }
  try {
    await execFileAsync(command.command, command.args, { timeout: 5000, windowsHide: true });
    return { attempted: true, ok: true, command: command.command };
  } catch (error) {
    return { attempted: true, ok: false, command: command.command, error: error.message || "notification failed" };
  }
}

function buildNotificationCommand(title, message, platform = process.platform) {
  const safeTitle = truncate(String(title || "AgentTrail"), 80);
  const safeMessage = truncate(String(message || ""), 180);
  if (platform === "darwin") {
    return {
      command: "osascript",
      args: ["-e", `display notification "${escapeAppleScript(safeMessage)}" with title "${escapeAppleScript(safeTitle)}"`]
    };
  }
  if (platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$n = New-Object System.Windows.Forms.NotifyIcon",
      "$n.Icon = [System.Drawing.SystemIcons]::Information",
      "$n.BalloonTipTitle = '" + escapePowerShell(safeTitle) + "'",
      "$n.BalloonTipText = '" + escapePowerShell(safeMessage) + "'",
      "$n.Visible = $true",
      "$n.ShowBalloonTip(5000)",
      "Start-Sleep -Seconds 6",
      "$n.Dispose()"
    ].join("; ");
    return { command: "powershell.exe", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script] };
  }
  if (platform === "linux") {
    return { command: "notify-send", args: [safeTitle, safeMessage] };
  }
  return null;
}

function escapeAppleScript(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapePowerShell(value) {
  return String(value).replace(/'/g, "''");
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
}

module.exports = {
  desktopNotificationsEnabled,
  notificationThresholdMs,
  shouldNotifyLongTask,
  maybeNotifyLongTask,
  notifyNative,
  buildNotificationCommand
};
