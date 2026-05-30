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
    ["macos", "AgentTrail-macOS-readme.txt", "Use desktop/mac/AgentTrail.command. Sign with Developer ID before public distribution."],
    ["windows", "AgentTrail-Windows-readme.txt", "Use desktop/windows/AgentTrail.cmd. Sign with Authenticode before public distribution."],
    ["linux", "AgentTrail-Linux-readme.txt", "Use desktop/linux/agenttrail.desktop. Publish signed checksums for distro packages."]
  ];
  for (const [dir, file, text] of targets) {
    const outDir = path.join(projectRoot, "installers", dir);
    await fsp.mkdir(outDir, { recursive: true });
    await fsp.writeFile(path.join(outDir, file), [
      `AgentTrail ${packageMeta.version}`,
      "",
      text,
      "",
      "This repository includes launchers and checksum generation. Native signing requires platform certificates."
    ].join("\n"), "utf8");
  }
  console.log(`Prepared desktop installer staging files for ${packageMeta.version}`);
}
