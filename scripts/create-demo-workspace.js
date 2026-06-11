#!/usr/bin/env node
"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  artifactDefinitions,
  buildManifest,
  projectRoot,
  sha256Text
} = require("./demo-proof-data");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const definitions = artifactDefinitions();
  const files = [];

  for (const artifact of definitions) {
    const absolutePath = path.join(projectRoot, artifact.relativePath);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, artifact.content, "utf8");
    files.push({
      phase: artifact.phase,
      path: artifact.relativePath,
      bytes: Buffer.byteLength(artifact.content),
      sha256: sha256Text(artifact.content)
    });
  }

  const manifest = buildManifest(files);
  const manifestPath = path.join(projectRoot, "docs/demo-proof/manifest.json");
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Created deterministic demo workspace with ${files.length} artifacts`);
}
