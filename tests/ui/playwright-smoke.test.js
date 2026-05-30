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
  const html = await fsp.readFile(path.join(projectRoot, "public/index.html"), "utf8");
  const app = await fsp.readFile(path.join(projectRoot, "public/app.js"), "utf8");
  const foundation = await fsp.readFile(path.join(projectRoot, "public/modules/foundation.js"), "utf8");
  const product = await fsp.readFile(path.join(projectRoot, "public/modules/product.js"), "utf8");

  assert.match(html, /Foundation/);
  assert.match(html, /Run real bench/);
  assert.match(html, /Import pack URL/);
  assert.match(html, /Diff Review/);
  assert.match(app, /renderPendingChanges/);
  assert.match(foundation, /\/api\/foundation/);
  assert.match(product, /\/api\/search\/chunks/);
  assert.match(product, /\/api\/replay\/plan/);

  console.log("UI smoke tests passed");
}
