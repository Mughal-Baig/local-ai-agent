#!/usr/bin/env node

"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");
const packageMeta = require("../package.json");

const projectRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(projectRoot, "installers", "linux", "staging");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  await fsp.rm(outputRoot, { recursive: true, force: true });
  await stageDeb();
  await stageRpm();
  await stageAppImage();
  console.log(`Prepared Linux package staging files for ${packageMeta.version}`);
}

async function stageDeb() {
  const root = path.join(outputRoot, "deb");
  const appRoot = path.join(root, "usr", "share", "agenttrail");
  await fsp.mkdir(path.join(root, "DEBIAN"), { recursive: true });
  await fsp.mkdir(appRoot, { recursive: true });
  await fsp.mkdir(path.join(root, "usr", "share", "applications"), { recursive: true });
  await fsp.copyFile(path.join(projectRoot, "installers", "linux", "debian", "control"), path.join(root, "DEBIAN", "control"));
  await fsp.copyFile(path.join(projectRoot, "desktop", "linux", "agenttrail.desktop"), path.join(root, "usr", "share", "applications", "agenttrail.desktop"));
  await copyProjectPayload(appRoot);
}

async function stageRpm() {
  const root = path.join(outputRoot, "rpm");
  const appRoot = path.join(root, "usr", "share", "agenttrail");
  await fsp.mkdir(root, { recursive: true });
  await fsp.mkdir(appRoot, { recursive: true });
  await fsp.copyFile(path.join(projectRoot, "installers", "linux", "agenttrail.spec"), path.join(root, "agenttrail.spec"));
  await copyProjectPayload(appRoot);
}

async function stageAppImage() {
  const root = path.join(outputRoot, "AppDir");
  const appRoot = path.join(root, "usr", "share", "agenttrail");
  await fsp.mkdir(root, { recursive: true });
  await fsp.mkdir(appRoot, { recursive: true });
  await fsp.copyFile(path.join(projectRoot, "installers", "linux", "AppRun"), path.join(root, "AppRun"));
  await fsp.chmod(path.join(root, "AppRun"), 0o755);
  await fsp.copyFile(path.join(projectRoot, "desktop", "linux", "agenttrail.desktop"), path.join(root, "agenttrail.desktop"));
  await fsp.copyFile(path.join(projectRoot, "installers", "linux", "agenttrail.appdata.xml"), path.join(root, "agenttrail.appdata.xml"));
  await copyProjectPayload(appRoot);
}

async function copyProjectPayload(destination) {
  const entries = await fsp.readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }
    await fsp.cp(path.join(projectRoot, entry.name), path.join(destination, entry.name), {
      recursive: true,
      filter: (source) => !shouldSkipEntry(path.basename(source))
    });
  }
}

function shouldSkipEntry(name) {
  return [
    ".git",
    ".DS_Store",
    ".playwright-cli",
    "dist",
    "installers",
    "node_modules",
    "staging"
  ].includes(name) || name.endsWith(".tgz") || name.endsWith(".bak2");
}
