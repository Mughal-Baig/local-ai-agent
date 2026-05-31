#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  registryPaths,
  listLocalModels,
  pullModel,
  importModelFile,
  createModelFromSpec,
  copyModel,
  shareModel,
  verifyModelProvenance,
  parseModelSpec,
  resolveRegistrySource,
  sha256File,
  modelSlug
} = require("../../src/model-registry");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-registry-"));
  try {
    const source = path.join(workspace, "source-Q4_K_M.gguf");
    await fsp.writeFile(source, Buffer.alloc(8192, 12));
    const sha256 = await sha256File(source);

    const paths = registryPaths(workspace);
    const slug = modelSlug("tiny/q4");
    const modelDir = path.join(paths.modelsDir, slug);
    await fsp.mkdir(modelDir, { recursive: true });
    const partPath = path.join(modelDir, "source-Q4_K_M.gguf.part");
    await fsp.writeFile(partPath, Buffer.alloc(1024, 12));

    const events = [];
    const pulled = await pullModel(workspace, {
      name: "tiny/q4",
      source: pathToFileURL(source).href,
      sha256,
      signature: `sha256:${sha256}`,
      tags: ["tiny", "test"]
    }, {}, (event) => events.push(event));
    assert.equal(pulled.name, "tiny/q4");
    assert.equal(pulled.sha256, sha256);
    assert.equal(pulled.verification.ok, true);
    assert.equal(pulled.provenance.resume, true);
    assert.equal(events.some((event) => event.event === "progress"), true);
    const badSignature = await verifyModelProvenance({
      filePath: source,
      expectedSha256: `sha256:${sha256.toUpperCase()}`,
      signature: "not-real",
      publicKey: "not-a-public-key"
    });
    assert.equal(badSignature.sha256, true);
    assert.equal(badSignature.signature, false);
    assert.equal(badSignature.ok, false);

    const imported = await importModelFile(workspace, { name: "imported-q4", sourcePath: source, tags: "local,imported" });
    assert.equal(imported.tags.includes("imported"), true);

    const spec = parseModelSpec([
      "FROM tiny/q4",
      "PARAMETER temperature 0.2",
      "TAG coder,local",
      "SYSTEM \"You are local.\"",
      "LICENSE MIT"
    ].join("\n"));
    assert.equal(spec.from, "tiny/q4");
    assert.equal(spec.parameters.temperature, "0.2");
    assert.equal(spec.tags.includes("coder"), true);

    const created = await createModelFromSpec(workspace, { name: "coder/q4", spec: [
      "FROM tiny/q4",
      "PARAMETER temperature 0.2",
      "TAG coder"
    ].join("\n"), tags: "profile,fast" });
    assert.equal(created.kind, "derived");
    assert.equal(created.source.from, "tiny/q4");
    assert.equal(created.tags.includes("profile"), true);
    assert.equal(created.tags.includes("fast"), true);

    const copied = await copyModel(workspace, "tiny/q4", "tiny/q4-copy");
    assert.equal(copied.copiedFrom, "tiny/q4");

    const share = await shareModel(workspace, { name: "tiny/q4-copy" });
    assert.equal(share.ok, true);
    assert.equal((await fsp.stat(share.manifestPath)).isFile(), true);

    const hf = resolveRegistrySource("hf://TheBloke/TinyLlama/file.gguf?revision=v1");
    assert.equal(hf.type, "huggingface");
    assert.match(hf.url, /huggingface\.co\/TheBloke\/TinyLlama\/resolve\/v1\/file\.gguf/);
    const oci = resolveRegistrySource("oci://registry.local/models/tiny:latest");
    assert.equal(oci.type, "oci");

    const models = await listLocalModels(workspace);
    assert.equal(models.length >= 4, true);
    console.log("Model registry unit tests passed");
  } finally {
    await fsp.rm(workspace, { recursive: true, force: true });
  }
}
