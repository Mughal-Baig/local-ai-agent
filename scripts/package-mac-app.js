#!/usr/bin/env node

const fsp = require("node:fs/promises");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");
const packageMeta = require("../package.json");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.resolve(process.env.AGENTTRAIL_APP_OUTPUT || path.join(projectRoot, "dist", "mac", "AgentTrail.app"));
const appMode = String(process.env.AGENTTRAIL_MAC_APP_MODE || "menubar").toLowerCase();

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const contentsDir = path.join(outputPath, "Contents");
  const macosDir = path.join(contentsDir, "MacOS");
  const resourcesDir = path.join(contentsDir, "Resources");
  const appProjectDir = path.join(resourcesDir, "agenttrail");

  await fsp.rm(outputPath, { recursive: true, force: true });
  await fsp.mkdir(macosDir, { recursive: true });
  await fsp.mkdir(resourcesDir, { recursive: true });

  await fsp.mkdir(appProjectDir, { recursive: true });
  const entries = await fsp.readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }
    await fsp.cp(path.join(projectRoot, entry.name), path.join(appProjectDir, entry.name), {
      recursive: true,
      filter: (source) => !shouldSkipEntry(path.basename(source))
    });
  }

  await fsp.writeFile(path.join(contentsDir, "Info.plist"), plist(), "utf8");
  const executablePath = path.join(macosDir, "AgentTrail");
  const usedNativeMenuBar = await installMenuBarBinary(executablePath, resourcesDir);
  if (!usedNativeMenuBar) {
    await fsp.writeFile(executablePath, launcher(), "utf8");
    await fsp.chmod(executablePath, 0o755);
  }

  await installIcon(resourcesDir);

  console.log(`Built ${outputPath}${usedNativeMenuBar ? " with native menu-bar launcher" : " with shell launcher"}`);
}

async function installMenuBarBinary(executablePath, resourcesDir) {
  const source = path.join(projectRoot, "desktop", "mac", "AgentTrailMenuBar.swift");
  const destination = path.join(resourcesDir, "AgentTrailMenuBar.swift");
  await fsp.copyFile(source, destination).catch(() => {});
  if (appMode === "browser" || process.platform !== "darwin" || !(await commandExists("swiftc"))) {
    return false;
  }
  try {
    await execFileAsync("swiftc", [
      source,
      "-o",
      executablePath,
      "-framework",
      "Cocoa",
      "-framework",
      "UserNotifications"
    ], { cwd: projectRoot, timeout: 60000 });
    await fsp.chmod(executablePath, 0o755);
    return true;
  } catch (error) {
    console.warn(`Swift menu-bar build failed; falling back to shell launcher: ${error.message}`);
    return false;
  }
}

async function installIcon(resourcesDir) {
  const iconSource = path.join(projectRoot, "build", "AgentTrail.icns");
  try {
    await fsp.copyFile(iconSource, path.join(resourcesDir, "AgentTrail.icns"));
  } catch (error) {
    console.warn(`Skipped app icon (missing ${iconSource}). Run "node build/make-icns.js" to regenerate.`);
  }
}

function plist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>AgentTrail</string>
  <key>CFBundleDisplayName</key>
  <string>AgentTrail</string>
  <key>CFBundleIdentifier</key>
  <string>com.agenttrail.local</string>
  <key>CFBundleVersion</key>
  <string>${escapePlist(packageMeta.version)}</string>
  <key>CFBundleShortVersionString</key>
  <string>${escapePlist(packageMeta.version)}</string>
  <key>CFBundleExecutable</key>
  <string>AgentTrail</string>
  <key>CFBundleIconFile</key>
  <string>AgentTrail</string>
  <key>CFBundleIconName</key>
  <string>AgentTrail</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSUserNotificationAlertStyle</key>
  <string>banner</string>
</dict>
</plist>
`;
}

function launcher() {
  return `#!/bin/sh
set -eu

APP_CONTENTS="$(cd "$(dirname "$0")/.." && pwd)"
AGENTTRAIL_ROOT="$APP_CONTENTS/Resources/agenttrail"
LOG_DIR="$HOME/Library/Logs/AgentTrail"
PORT="\${AGENTTRAIL_PORT:-4173}"
HOST="\${AGENTTRAIL_HOST:-127.0.0.1}"
URL="http://$HOST:$PORT/"

mkdir -p "$LOG_DIR"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "AgentTrail needs Node.js. Install Node, then open AgentTrail again." buttons {"OK"} default button "OK" with title "AgentTrail"'
  exit 1
fi

if command -v curl >/dev/null 2>&1 && curl -fsS "$URL/api/status" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

cd "$AGENTTRAIL_ROOT"
export PORT HOST AGENTTRAIL_DESKTOP=1 AGENTTRAIL_APP_MODE=desktop AGENTTRAIL_DESKTOP_NOTIFICATIONS=on AGENTTRAIL_UPDATE_CHANNEL="\${AGENTTRAIL_UPDATE_CHANNEL:-stable}"
node server.js >> "$LOG_DIR/agenttrail.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$LOG_DIR/agenttrail.pid"
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' INT TERM EXIT

COUNT=0
until curl -fsS "$URL/api/status" >/dev/null 2>&1; do
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    osascript -e 'display dialog "AgentTrail could not start. Check ~/Library/Logs/AgentTrail/agenttrail.log" buttons {"OK"} default button "OK" with title "AgentTrail"'
    exit 1
  fi
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -gt 50 ]; then
    osascript -e 'display dialog "AgentTrail is taking too long to start. Check ~/Library/Logs/AgentTrail/agenttrail.log" buttons {"OK"} default button "OK" with title "AgentTrail"'
    exit 1
  fi
  sleep 0.2
done

open "$URL"
wait "$SERVER_PID"
`;
}

function shouldSkipEntry(name) {
  return [
    ".git",
    "dist",
    "node_modules",
    ".DS_Store",
    "agenttrail-0.7.0.tgz"
  ].includes(name);
}

async function commandExists(command) {
  try {
    await execFileAsync("/usr/bin/env", ["which", command], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function escapePlist(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
