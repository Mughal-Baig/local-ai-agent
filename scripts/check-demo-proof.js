#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  artifactDefinitions,
  fileInfo,
  flow,
  projectRoot,
  sha256File,
  sha256Text
} = require("./demo-proof-data");

const writeFingerprint = process.argv.includes("--write-fingerprint");
const manifestPath = "docs/demo-proof/manifest.json";
const fingerprintPath = "docs/demo-proof/fingerprint.json";
const fingerprintInputs = [
  "docs/agenttrail-demo.gif",
  "docs/demo-proof.html",
  "docs/demo-proof/manifest.json",
  "docs/demo-video/storyboard.json",
  "docs/demo-video/README.md",
  "scripts/demo-proof-data.js",
  "scripts/create-demo-workspace.js",
  "scripts/generate-demo-gif.js",
  "scripts/record-demo.js",
  "scripts/check-demo-proof.js"
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const manifest = await readJson(manifestPath);
  assert.equal(manifest.schema, "agenttrail.demo-proof.v1");
  assert.equal(manifest.command, "npm run demo:proof");
  assert.equal(manifest.healthCheck, "npm run demo:health");
  assert.deepEqual(manifest.flow.map((step) => step.id), flow.map((step) => step.id));

  const definitions = artifactDefinitions();
  const manifestFiles = new Map(manifest.files.map((entry) => [entry.path, entry]));
  for (const artifact of definitions) {
    const actual = await fsp.readFile(path.join(projectRoot, artifact.relativePath), "utf8");
    assert.equal(sha256Text(actual), sha256Text(artifact.content), `${artifact.relativePath} is not deterministic`);
    const manifestEntry = manifestFiles.get(artifact.relativePath);
    assert.ok(manifestEntry, `${artifact.relativePath} missing from manifest`);
    assert.equal(manifestEntry.sha256, sha256Text(artifact.content), `${artifact.relativePath} manifest hash mismatch`);
    assert.equal(manifestEntry.bytes, Buffer.byteLength(artifact.content), `${artifact.relativePath} manifest byte mismatch`);
  }

  await assertGif();
  await assertDocs();

  const fingerprint = {
    schema: "agenttrail.demo-proof-fingerprint.v1",
    generatedBy: "npm run demo:proof",
    inputs: await Promise.all(fingerprintInputs.map(fileInfo))
  };

  if (writeFingerprint) {
    await fsp.writeFile(path.join(projectRoot, fingerprintPath), `${JSON.stringify(fingerprint, null, 2)}\n`, "utf8");
    console.log(`Wrote ${fingerprintPath}`);
    return;
  }

  const existing = await readJson(fingerprintPath);
  assert.equal(existing.schema, fingerprint.schema);
  assert.deepEqual(existing.inputs, fingerprint.inputs, "demo proof fingerprint is stale; run npm run demo:proof");
  console.log("Demo proof health check passed");
}

async function assertGif() {
  const gifPath = path.join(projectRoot, "docs/agenttrail-demo.gif");
  const data = await fsp.readFile(gifPath);
  assert.equal(data.subarray(0, 6).toString("ascii"), "GIF89a");
  assert.ok(data.length > 10_000, "docs/agenttrail-demo.gif is unexpectedly small");
}

async function assertDocs() {
  const readme = await readText("README.md");
  assert.match(readme, /Why star this:/);
  assert.match(readme, /docs\/agenttrail-demo\.gif/);
  assert.match(readme, /demo-proof\.html/);

  const demoPage = await readText("docs/demo-proof.html");
  for (const step of flow) {
    assert.match(demoPage, new RegExp(step.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(demoPage, new RegExp(step.proof.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const releaseProcess = await readText("docs/RELEASE_PROCESS.md");
  assert.match(releaseProcess, /npm run demo:health/);
  assert.match(releaseProcess, /demo assets are stale/);
}

async function readText(relativePath) {
  return fsp.readFile(path.join(projectRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}
