"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { loadPluginCatalog, loadPlugins } = require("../../src/plugin-loader");
const { evaluateCalculatorExpression, previewShellCommand, runPluginTool } = require("../../src/plugin-sandbox");
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
  await assert.rejects(() => runPluginTool(mediumRisk, "safe.echo", { text: "blocked" }), /requires explicit plugin approval/);
  assert.equal((await runPluginTool(mediumRisk, "safe.echo", { text: "allowed" }, { approved: true })).output, "allowed");

  const installed = await loadPlugins(path.resolve(__dirname, "../../plugins"));
  assert.equal(installed.every((plugin) => plugin.valid === true), true);
  assert.equal(installed.some((plugin) => plugin.id === "example-tool"), true);
  assert.equal((await runPluginTool(installed.find((plugin) => plugin.id === "example-tool"), "example.echo", { text: "ok" })).output, "ok");

  const catalog = await loadPluginCatalog(path.resolve(__dirname, "../../plugins"), { force: true });
  assert.equal(catalog.hotReload.enabled, true);
  assert.equal(catalog.hotReload.mode, "manifest-fingerprint");
  for (const id of ["web-fetch", "calculator", "shell-guarded"]) {
    assert.equal(catalog.plugins.some((plugin) => plugin.id === id), true, id);
  }

  const calculator = catalog.plugins.find((plugin) => plugin.id === "calculator");
  assert.equal((await runPluginTool(calculator, "calculator.evaluate", { expression: "2 * (3 + 4)" })).output.result, 14);
  assert.equal(evaluateCalculatorExpression("10 % 4 + 1.5").result, 3.5);
  assert.throws(() => evaluateCalculatorExpression("process.exit()"), /supports only numbers/);

  const shell = catalog.plugins.find((plugin) => plugin.id === "shell-guarded");
  await assert.rejects(() => runPluginTool(shell, "shell.preview", { command: ["git", "status"] }), /requires explicit plugin approval/);
  const shellPreview = await runPluginTool(shell, "shell.preview", { command: ["git", "status", "--short"] }, { approved: true });
  assert.equal(shellPreview.output.previewOnly, true);
  assert.equal(shellPreview.output.allowed, true);
  assert.equal(previewShellCommand(["curl", "https://example.com"]).allowed, false);

  const webFetch = catalog.plugins.find((plugin) => plugin.id === "web-fetch");
  const dryRun = await runPluginTool(webFetch, "web.fetch_readonly", {
    url: "https://example.com",
    allowlist: ["example.com"],
    dryRun: true
  }, { approved: true });
  assert.equal(dryRun.output.dryRun, true);
  assert.equal(dryRun.output.method, "GET");
  await assert.rejects(() => runPluginTool(webFetch, "web.fetch_readonly", {
    url: "https://not-allowed.example",
    dryRun: true
  }, { approved: true }), /allowlist/);

  const hotRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-plugin-hot-"));
  const hotPluginDir = path.join(hotRoot, "hot-example");
  await fsp.mkdir(hotPluginDir, { recursive: true });
  await fsp.writeFile(path.join(hotPluginDir, "plugin.json"), JSON.stringify(basePlugin({
    id: "hot-example",
    title: "Hot Example One"
  }), null, 2));
  const firstHot = await loadPluginCatalog(hotRoot);
  assert.equal(firstHot.plugins[0].title, "Hot Example One");
  await fsp.writeFile(path.join(hotPluginDir, "plugin.json"), JSON.stringify(basePlugin({
    id: "hot-example",
    title: "Hot Example Two"
  }), null, 2));
  const secondHot = await loadPluginCatalog(hotRoot);
  assert.equal(secondHot.plugins[0].title, "Hot Example Two");
  assert.equal(secondHot.hotReload.changed, true);
  assert.equal(secondHot.hotReload.reloadCount >= firstHot.hotReload.reloadCount + 1, true);
  await fsp.rm(hotRoot, { recursive: true, force: true });

  console.log("Plugin SDK unit tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
