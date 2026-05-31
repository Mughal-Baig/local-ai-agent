#!/usr/bin/env node

const fsp = require("node:fs/promises");
const path = require("node:path");
const packageMeta = require("../package.json");

const projectRoot = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const targets = [
    ["macos", "AgentTrail-macOS-readme.txt", "Run npm run package:mac-app for AgentTrail.app. The macOS bundle uses the native menu-bar launcher when swiftc is available, otherwise it falls back to the shell launcher. Sign and notarize with npm run sign:mac-app."],
    ["windows", "AgentTrail-Windows-readme.txt", "Use desktop/windows/AgentTrail.cmd for the tray launcher. Build an installer from installers/windows/AgentTrail.iss or AgentTrail.wxs, then sign with npm run sign:windows."],
    ["linux", "AgentTrail-Linux-readme.txt", "Use desktop/linux/agenttrail.desktop or desktop/linux/agenttrail-tray.sh. Package templates are in installers/linux for deb, rpm, and AppImage-style staging."]
  ];
  for (const [dir, file, text] of targets) {
    const outDir = path.join(projectRoot, "installers", dir);
    await fsp.mkdir(outDir, { recursive: true });
    await fsp.writeFile(path.join(outDir, file), `${[
      `AgentTrail ${packageMeta.version}`,
      "",
      text,
      "",
      "This repository includes launchers, update metadata, notification hooks, checksum generation, and signing command scaffolds. Native signing requires platform certificates."
    ].join("\n")}\n`, "utf8");
  }
  console.log(`Prepared desktop installer staging files for ${packageMeta.version}`);
}
