"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { loadPlugins } = require("../../src/plugin-loader");
const { runPluginTool } = require("../../src/plugin-sandbox");
const { validatePluginManifest, publicPluginManifest } = require("../../src/plugin-sdk");

function basePlugin(overrides = {}) {
  return {
    schema: "agenttrail.plugin.v1",
    id: "safe-example",
    title: "Safe Example",
    version: "0.1.0",
    description: "A test plugin.",
    tools: [
      {
        name: "safe.echo",
        description: "Echo a value.",
        risk: "low",
        receipt: true,
        code: "return input.text;",
        execution: { runtime: "vm", timeoutMs: 25 }
      }
    ],
    permissions: [
      {
        tool: "safe.echo",
        scope: "Read one provided string and return it.",
        risk: "low",
        receipt: true
      }
    ],
    ...overrides
  };
}

async function main() {
  const valid = validatePluginManifest(basePlugin());
  assert.equal(valid.ok, true);
  assert.equal(valid.plugin.sdkVersion, "0.2.0");
  assert.equal(valid.plugin.tools[0].requiresApproval, false);

  const publicView = publicPluginManifest(valid.plugin);
  assert.equal(publicView.tools[0].code, undefined);

  const invalid = validatePluginManifest(basePlugin({
    permissions: []
  }));
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues.map((issue) => issue.message).join("\n"), /matching permission|at least one permission/);

  const dangerousCode = validatePluginManifest(basePlugin({
    tools: [
      {
        name: "safe.echo",
        description: "Try to escape.",
        risk: "low",
        receipt: true,
        code: "return require('fs').readFileSync('/etc/passwd', 'utf8');",
        execution: { runtime: "vm" }
      }
    ]
  }));
  assert.equal(dangerousCode.ok, false);
  assert.match(dangerousCode.issues.map((issue) => issue.message).join("\n"), /require\(\)/);

  const mediumRisk = validatePluginManifest(basePlugin({
    tools: [
      {
        name: "safe.echo",
        description: "Medium risk echo.",
        risk: "medium",
        receipt: true,
        code: "return input.text;",
        execution: { runtime: "vm" }
      }
    ],
    permissions: [
      {
        tool: "safe.echo",
        scope: "Read user-approved input with explicit approval.",
        risk: "medium",
        receipt: true
      }
    ]
  })).plugin;
  assert.throws(() => runPluginTool(mediumRisk, "safe.echo", { text: "blocked" }), /requires explicit plugin approval/);
  assert.equal(runPluginTool(mediumRisk, "safe.echo", { text: "allowed" }, { approved: true }).output, "allowed");

  const installed = await loadPlugins(path.resolve(__dirname, "../../plugins"));
  assert.equal(installed.every((plugin) => plugin.valid === true), true);
  assert.equal(installed.some((plugin) => plugin.id === "example-tool"), true);
  assert.equal(runPluginTool(installed.find((plugin) => plugin.id === "example-tool"), "example.echo", { text: "ok" }).output, "ok");

  console.log("Plugin SDK unit tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
