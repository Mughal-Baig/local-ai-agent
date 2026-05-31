#!/usr/bin/env node

"use strict";

const fsp = require("node:fs/promises");

const output = process.argv[2];
const textFile = process.argv[3];
const voice = process.argv[4] || "default";

async function main() {
  const text = await fsp.readFile(textFile, "utf8");
  await fsp.writeFile(output, Buffer.from(`FAKEAIFF\nVoice: ${voice}\n${text}`));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
