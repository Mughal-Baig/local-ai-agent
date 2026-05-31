#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const packageMeta = require("../package.json");

const projectRoot = path.resolve(__dirname, "..");
const version = packageMeta.version;
const outputPath = path.join(projectRoot, "docs", "sbom", `agenttrail-v${version}.spdx.json`);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const files = await releaseFiles();
  const spdx = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `AgentTrail ${version}`,
    documentNamespace: `https://github.com/Mughal-Baig/local-ai-agent/sbom/v${version}/${hashText(files.join("\n")).slice(0, 16)}`,
    creationInfo: {
      created: releaseCreatedAt(),
      creators: ["Tool: AgentTrail generate-sbom.js"]
    },
    packages: [{
      name: packageMeta.name,
      SPDXID: "SPDXRef-Package-AgentTrail",
      versionInfo: version,
      downloadLocation: "https://github.com/Mughal-Baig/local-ai-agent",
      filesAnalyzed: true,
      licenseConcluded: packageMeta.license || "MIT",
      licenseDeclared: packageMeta.license || "MIT",
      copyrightText: "NOASSERTION",
      checksums: [{ algorithm: "SHA256", checksumValue: hashText(files.join("\n")) }],
      packageVerificationCode: {
        packageVerificationCodeValue: hashText((await Promise.all(files.map(fileShaLine))).join("\n"))
      }
    }],
    files: await Promise.all(files.map(spdxFile)),
    relationships: [
      { spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES", relatedSpdxElement: "SPDXRef-Package-AgentTrail" },
      ...files.map((file) => ({
        spdxElementId: "SPDXRef-Package-AgentTrail",
        relationshipType: "CONTAINS",
        relatedSpdxElement: spdxIdForFile(file)
      }))
    ]
  };
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, `${JSON.stringify(spdx, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} (${files.length} file(s))`);
}

async function releaseFiles() {
  const roots = [...new Set(["package.json", "README.md", "LICENSE", ...packageMeta.files])];
  const files = [];
  for (const root of roots) {
    if (root.includes("*")) {
      files.push(...await expandPattern(root));
      continue;
    }
    const absolute = path.join(projectRoot, root);
    if (await isFile(absolute)) {
      if (!shouldSkip(root)) files.push(root);
    } else if (await isDirectory(absolute)) {
      files.push(...await walk(root));
    }
  }
  return [...new Set(files)].filter((file) => !shouldSkip(file)).sort();
}

async function expandPattern(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const dir = slash === -1 ? "." : normalized.slice(0, slash);
  const basename = slash === -1 ? normalized : normalized.slice(slash + 1);
  const regex = new RegExp(`^${basename.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  const entries = await fsp.readdir(path.join(projectRoot, dir), { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && regex.test(entry.name))
    .map((entry) => path.join(dir, entry.name).replace(/\\/g, "/"));
}

async function walk(relativeDir) {
  const absoluteDir = path.join(projectRoot, relativeDir);
  const entries = await fsp.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const relative = path.join(relativeDir, entry.name).replace(/\\/g, "/");
    if (shouldSkip(relative)) continue;
    if (entry.isDirectory()) files.push(...await walk(relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function spdxFile(relativePath) {
  const buffer = await fsp.readFile(path.join(projectRoot, relativePath));
  return {
    fileName: `./${relativePath}`,
    SPDXID: spdxIdForFile(relativePath),
    checksums: [{ algorithm: "SHA256", checksumValue: sha256(buffer) }],
    licenseConcluded: "NOASSERTION",
    copyrightText: "NOASSERTION"
  };
}

async function fileShaLine(relativePath) {
  return `${sha256(await fsp.readFile(path.join(projectRoot, relativePath)))}  ${relativePath}`;
}

function shouldSkip(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized === ".git" ||
    normalized.startsWith(".git/") ||
    normalized === "node_modules" ||
    normalized.startsWith("node_modules/") ||
    normalized === "dist" ||
    normalized.startsWith("dist/") ||
    normalized === ".playwright-cli" ||
    normalized.startsWith(".playwright-cli/") ||
    normalized === "installers/linux/staging" ||
    normalized.startsWith("installers/linux/staging/") ||
    normalized === "docs/sbom" ||
    normalized.startsWith("docs/sbom/") ||
    normalized === "docs/checksums" ||
    normalized.startsWith("docs/checksums/") ||
    (normalized.startsWith("workspace/") && normalized !== "workspace/welcome.md") ||
    normalized.endsWith(".tgz") ||
    normalized.endsWith(".bak") ||
    normalized.endsWith(".bak2");
}

async function isFile(filePath) {
  try {
    return (await fsp.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(filePath) {
  try {
    return (await fsp.stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

function spdxIdForFile(file) {
  return `SPDXRef-File-${file.replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function releaseCreatedAt() {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH || Date.UTC(2026, 4, 31) / 1000);
  return new Date(epoch * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hashText(text) {
  return sha256(Buffer.from(String(text), "utf8"));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
