#!/usr/bin/env node

const path = require("node:path");
const packageMeta = require("../package.json");
const { generateChecksums } = require("../src/release");

const projectRoot = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const result = await generateChecksums(projectRoot, `v${packageMeta.version}`);
  console.log(`Wrote ${result.path} (${result.count} artifact(s))`);
}
