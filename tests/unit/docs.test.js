#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const pkg = JSON.parse(await read("package.json"));
  const site = await read("docs/site/index.html");
  const searchIndex = JSON.parse(await read("docs/site/search-index.json"));
  const apiReference = await read("docs/API_REFERENCE.md");
  const quickStart = await read("docs/GETTING_STARTED.md");
  const recipes = await read("docs/RECIPE_AUTHORING.md");
  const backends = await read("docs/BACKEND_SETUP.md");
  const modelEcosystem = await read("docs/MODEL_ECOSYSTEM.md");
  const architecture = await read("docs/ARCHITECTURE.md");
  const troubleshooting = await read("docs/TROUBLESHOOTING.md");
  const videos = await read("docs/VIDEO_WALKTHROUGHS.md");
  const storyboards = JSON.parse(await read("docs/video-walkthroughs/storyboards.json"));
  const ci = await read(".github/workflows/ci.yml");

  assert.equal(pkg.scripts["docs:site"], "node scripts/generate-docs-site.js");
  assert.equal(pkg.scripts["docs:api"], "node scripts/generate-api-reference.js");
  assert.equal(pkg.scripts["docs:build"], "node scripts/generate-api-reference.js && node scripts/generate-docs-site.js");
  assert.equal(pkg.scripts["test:docs"], "node scripts/generate-api-reference.js --check && node scripts/generate-docs-site.js --check && node tests/unit/docs.test.js");
  assert.match(ci, /node scripts\/generate-docs-site\.js --check/);
  assert.match(ci, /node tests\/unit\/docs\.test\.js/);

  assert.match(site, /AgentTrail Docs/);
  assert.match(site, /search-index\.json/);
  assert.equal(searchIndex.schema, "agenttrail.docs-site.v1");
  assert.equal(searchIndex.docs.some((doc) => doc.file === "GETTING_STARTED.md"), true);
  assert.equal(searchIndex.records.some((record) => /recipe/i.test(record.title)), true);

  assert.match(apiReference, /Generated from `src\/route-catalog\.js`/);
  assert.match(apiReference, /\/api\/team\/status/);
  assert.match(apiReference, /\/api\/model-ecosystem\/evaluate/);
  assert.match(apiReference, /\/v1\/chat\/completions/);

  assert.match(quickStart, /60-Second Flow/);
  assert.match(quickStart, /Diff Review/);
  assert.match(recipes, /Minimal Recipe/);
  assert.match(recipes, /Validation/);
  assert.match(backends, /LM Studio/);
  assert.match(backends, /llama\.cpp/);
  assert.match(backends, /vLLM/);
  assert.match(modelEcosystem, /LoRA Adapter Registration/);
  assert.match(modelEcosystem, /Safetensors To GGUF/);
  assert.equal(searchIndex.docs.some((doc) => doc.file === "MODEL_ECOSYSTEM.md"), true);
  assert.match(architecture, /System Map/);
  assert.match(architecture, /workspace-safety/);
  assert.match(troubleshooting, /FAQ/);
  assert.match(troubleshooting, /CI Fails On Docs/);
  assert.match(videos, /Walkthrough 1/);
  assert.equal(storyboards.walkthroughs.length >= 5, true);

  console.log("Docs unit tests passed");
}

async function read(relativePath) {
  return fsp.readFile(path.join(projectRoot, relativePath), "utf8");
}
