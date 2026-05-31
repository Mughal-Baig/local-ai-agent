#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const packageMeta = require("../package.json");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-repro-"));
  try {
    const first = await packOnce(path.join(root, "first"));
    const second = await packOnce(path.join(root, "second"));
    const ok = first.sha256 === second.sha256 && first.size === second.size;
    const report = {
      schema: "agenttrail.reproducible-build.v1",
      version: packageMeta.version,
      ok,
      packageName: first.filename,
      first,
      second,
      sourceDateEpoch: process.env.SOURCE_DATE_EPOCH || "1772323200"
    };
    const output = path.join(projectRoot, "dist", "reproducible", `agenttrail-v${packageMeta.version}.json`);
    await fsp.mkdir(path.dirname(output), { recursive: true });
    await fsp.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (!ok) {
      throw new Error(`npm pack was not reproducible: ${first.sha256} != ${second.sha256}`);
    }
    console.log(`Reproducible npm pack verified: ${first.sha256}`);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

async function packOnce(destination) {
  await fsp.mkdir(destination, { recursive: true });
  const { stdout } = await execFileAsync("npm", ["pack", "--json", "--pack-destination", destination], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || "1772323200",
      npm_config_cache: path.join(destination, ".npm-cache")
    },
    maxBuffer: 2 * 1024 * 1024
  });
  const [info] = JSON.parse(stdout);
  const tarball = path.join(destination, info.filename);
  const buffer = await fsp.readFile(tarball);
  return {
    filename: info.filename,
    size: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex")
  };
}
