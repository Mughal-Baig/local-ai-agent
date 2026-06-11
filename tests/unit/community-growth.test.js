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
  const launch = await read("docs/LAUNCH_RESPONSE_WORKFLOW.md");
  const responseKit = JSON.parse(await read("docs/launch/response-kit.json"));
  const marketplace = JSON.parse(await read("marketplace/recipes.json"));
  const marketplaceGuide = await read("docs/RECIPE_MARKETPLACE.md");
  const issues = JSON.parse(await read("docs/community/good-first-issues.json"));
  const issueGuide = await read("docs/GOOD_FIRST_ISSUES.md");
  const labels = await read(".github/labels.yml");
  const contributing = await read("CONTRIBUTING.md");
  const governance = await read("GOVERNANCE.md");
  const changelog = await read("CHANGELOG.md");
  const releaseProcess = await read("docs/RELEASE_PROCESS.md");
  const showcase = JSON.parse(await read("docs/showcase/gallery.json"));
  const showcaseGuide = await read("docs/SHOWCASE.md");
  const comparison = JSON.parse(await read("docs/benchmarks/comparison.json"));
  const comparisonGuide = await read("docs/COMPARISON_BENCHMARKS.md");
  const pluginSdk = await read("docs/PLUGIN_SDK.md");
  const receiptPlugin = JSON.parse(await read("plugins/receipt-reporter/plugin.json"));
  const urlPlugin = JSON.parse(await read("plugins/read-only-url/plugin.json"));
  const webFetchPlugin = JSON.parse(await read("plugins/web-fetch/plugin.json"));
  const calculatorPlugin = JSON.parse(await read("plugins/calculator/plugin.json"));
  const shellPlugin = JSON.parse(await read("plugins/shell-guarded/plugin.json"));
  const ci = await read(".github/workflows/ci.yml");
  const docsIndex = JSON.parse(await read("docs/site/search-index.json"));

  assert.equal(pkg.scripts["test:community"], "node scripts/generate-docs-site.js --check && node tests/unit/community-growth.test.js");
  assert.match(ci, /node --check tests\/unit\/community-growth\.test\.js/);
  assert.match(ci, /node tests\/unit\/community-growth\.test\.js/);

  assert.match(launch, /Response Triage/);
  assert.match(launch, /search -> diff preview -> Apply -> receipt/);
  assert.equal(responseKit.schema, "agenttrail.launch-response-kit.v1");
  assert.equal(responseKit.primaryAssets.includes("docs/agenttrail-demo.gif"), true);

  assert.equal(marketplace.curation.schema, "agenttrail.recipe-marketplace-curation.v1");
  assert.equal(marketplace.submissionQueue.length >= 2, true);
  assert.match(marketplaceGuide, /Curation Rules/);
  assertRecipePackReferences(marketplace);

  assert.equal(issues.schema, "agenttrail.good-first-issues.v1");
  assert.equal(issues.issues.length >= 8, true);
  assert.match(issueGuide, /Seed Backlog/);
  assert.match(labels, /name: good first issue/);
  assert.match(labels, /name: needs receipt/);

  assert.match(contributing, /Community Assets/);
  assert.match(governance, /Maintainer Principles/);
  assert.match(changelog, /Unreleased/);
  assert.match(releaseProcess, /Release Readiness Gate/);

  assert.equal(showcase.schema, "agenttrail.showcase-gallery.v1");
  assert.equal(showcase.entries.length >= 3, true);
  assert.match(showcaseGuide, /Submission Checklist/);

  assert.equal(comparison.schema, "agenttrail.comparison-benchmarks.v1");
  assert.equal(comparison.scenarios.length >= 3, true);
  assert.match(comparisonGuide, /Benchmark Rules/);
  assert.match(comparisonGuide, /Known Limits/);

  for (const plugin of [receiptPlugin, urlPlugin, webFetchPlugin, calculatorPlugin, shellPlugin]) {
    assert.equal(plugin.schema, "agenttrail.plugin.v1");
    assert.equal(plugin.permissions.every((permission) => permission.scope && permission.receipt === true), true);
  }
  assert.match(pluginSdk, /Permission Contract/);
  assert.match(pluginSdk, /Development Hot Reload/);
  assert.match(pluginSdk, /plugins\/receipt-reporter/);
  assert.match(pluginSdk, /plugins\/read-only-url/);
  assert.match(pluginSdk, /plugins\/web-fetch/);
  assert.match(pluginSdk, /plugins\/calculator/);
  assert.match(pluginSdk, /plugins\/shell-guarded/);

  const communityDocs = [
    "LAUNCH_RESPONSE_WORKFLOW.md",
    "RECIPE_MARKETPLACE.md",
    "GOOD_FIRST_ISSUES.md",
    "RELEASE_PROCESS.md",
    "SHOWCASE.md",
    "COMPARISON_BENCHMARKS.md",
    "PLUGIN_SDK.md"
  ];
  for (const file of communityDocs) {
    assert.equal(docsIndex.docs.some((doc) => doc.file === file), true, `${file} missing from docs site`);
  }

  console.log("Community growth unit tests passed");
}

function assertRecipePackReferences(marketplace) {
  const builtInRecipeIds = new Set(require("node:fs")
    .readdirSync(path.join(projectRoot, "recipes"))
    .filter((name) => name.endsWith(".json") && name !== "schema.json")
    .map((name) => name.replace(/\.json$/, "")));
  for (const pack of marketplace.packs || []) {
    assert.equal(Array.isArray(pack.recipes), true, `${pack.id} recipes must be an array`);
    for (const recipeId of pack.recipes) {
      assert.equal(builtInRecipeIds.has(recipeId), true, `${pack.id} references missing recipe ${recipeId}`);
    }
  }
}

async function read(relativePath) {
  return fsp.readFile(path.join(projectRoot, relativePath), "utf8");
}
