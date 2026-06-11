"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const demoRoot = path.join(projectRoot, "docs", "demo-proof");
const fixedClock = "2026-06-12T00:00:00.000Z";

const originalNote = [
  "# Launch Note",
  "",
  "AgentTrail can search files and draft changes.",
  "The public demo should show the exact trust loop.",
  ""
].join("\n");

const appliedNote = [
  "# Launch Note",
  "",
  "AgentTrail can search files and draft changes.",
  "The public demo should show the exact trust loop.",
  "It searches first, previews a diff, waits for Apply, saves a receipt, and exports a shareable report.",
  ""
].join("\n");

const flow = [
  {
    id: "search",
    label: "Search",
    title: "Search local workspace",
    summary: "Find the selected workspace note before proposing an edit.",
    proof: "docs/demo-proof/search-results.json"
  },
  {
    id: "diff",
    label: "Diff Preview",
    title: "Preview the exact patch",
    summary: "Show a unified diff and keep writes locked until approval.",
    proof: "docs/demo-proof/diff-preview.patch"
  },
  {
    id: "apply",
    label: "Apply",
    title: "Apply after approval",
    summary: "Write the approved content into the demo workspace.",
    proof: "docs/demo-proof/applied/notes/launch-note.md"
  },
  {
    id: "receipt",
    label: "Receipt",
    title: "Save replayable receipt",
    summary: "Capture the model, selected files, tool steps, diff, trust score, and replay command.",
    proof: "docs/demo-proof/receipts/trust-loop-receipt.md"
  },
  {
    id: "report",
    label: "Report",
    title: "Export shareable report",
    summary: "Generate a polished HTML report that can be shared without the app running.",
    proof: "docs/demo-proof/reports/trust-loop-report.html"
  }
];

function artifactDefinitions() {
  const searchResults = {
    schema: "agenttrail.demo-search-results.v1",
    generatedAt: fixedClock,
    query: "show the exact AgentTrail trust loop",
    mode: "deterministic-demo",
    results: [
      {
        rank: 1,
        path: "workspace/notes/launch-note.md",
        lineStart: 3,
        lineEnd: 4,
        score: 0.97,
        citation: "workspace/notes/launch-note.md:3",
        snippet: "AgentTrail can search files and draft changes. The public demo should show the exact trust loop."
      }
    ]
  };

  const diffPreview = [
    "--- a/workspace/notes/launch-note.md",
    "+++ b/workspace/notes/launch-note.md",
    "@@ -2,3 +2,4 @@",
    "",
    " AgentTrail can search files and draft changes.",
    " The public demo should show the exact trust loop.",
    "+It searches first, previews a diff, waits for Apply, saves a receipt, and exports a shareable report.",
    ""
  ].join("\n");

  const receipt = [
    "# AgentTrail Demo Receipt",
    "",
    "- Schema: `agenttrail.demo-receipt.v1`",
    "- Generated: `2026-06-12T00:00:00.000Z`",
    "- Model: `demo-local-model`",
    "- Workspace: `docs/demo-proof/workspace`",
    "- Trust Score: `100`",
    "",
    "## Tool Steps",
    "",
    "1. `search_workspace` found `workspace/notes/launch-note.md:3`.",
    "2. `preview_diff` produced `docs/demo-proof/diff-preview.patch`.",
    "3. `apply_diff` wrote only after explicit Apply.",
    "4. `save_receipt` captured this replayable receipt.",
    "5. `export_report` wrote `docs/demo-proof/reports/trust-loop-report.html`.",
    "",
    "## Replay",
    "",
    "```bash",
    "npm run demo:proof",
    "```",
    ""
  ].join("\n");

  const reportHtml = [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "  <title>AgentTrail Demo Trust Loop Report</title>",
    "  <style>",
    "    :root { color-scheme: light; --ink: #1f2430; --muted: #59635f; --line: #d8ded8; --paper: #ffffff; --soft: #f3f7f5; --green: #246b62; --clay: #b95b43; }",
    "    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; background: var(--soft); color: var(--ink); }",
    "    main { max-width: 920px; margin: 0 auto; padding: 40px 20px; }",
    "    h1 { margin: 0 0 8px; font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.02; }",
    "    p { color: var(--muted); line-height: 1.6; }",
    "    .score { display: inline-flex; align-items: center; gap: 10px; margin: 18px 0; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); font-weight: 700; }",
    "    .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 24px; }",
    "    .step { border: 1px solid var(--line); border-radius: 8px; background: var(--paper); padding: 16px; }",
    "    .step strong { color: var(--green); }",
    "    pre { overflow: auto; padding: 16px; border-radius: 8px; background: #1f2430; color: #f4f7f5; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <h1>AgentTrail Demo Trust Loop</h1>",
    "    <p>This report is generated from deterministic demo data so the public GIF, screenshots, and release proof can be reproduced before launch.</p>",
    "    <div class=\"score\">Trust Score 100 - searched, previewed, applied by approval, receipt saved, report exported</div>",
    "    <section class=\"steps\">",
    flow.map((step, index) => `      <article class=\"step\"><strong>${index + 1}. ${escapeHtml(step.label)}</strong><p>${escapeHtml(step.summary)}</p></article>`).join("\n"),
    "    </section>",
    "    <h2>Approved Diff</h2>",
    `    <pre>${escapeHtml(diffPreview)}</pre>`,
    "  </main>",
    "</body>",
    "</html>",
    ""
  ].join("\n");

  const workspaceReadme = [
    "# AgentTrail Demo Workspace",
    "",
    "This tiny workspace is generated by `npm run demo:workspace`.",
    "It exists so the public demo GIF, screenshots, receipt, and report are reproducible.",
    "",
    "Run the full proof loop with:",
    "",
    "```bash",
    "npm run demo:proof",
    "```",
    ""
  ].join("\n");

  return [
    { phase: "workspace", relativePath: "docs/demo-proof/workspace/README.md", content: workspaceReadme },
    { phase: "workspace", relativePath: "docs/demo-proof/workspace/notes/launch-note.md", content: originalNote },
    { phase: "search", relativePath: "docs/demo-proof/search-results.json", content: `${JSON.stringify(searchResults, null, 2)}\n` },
    { phase: "diff", relativePath: "docs/demo-proof/diff-preview.patch", content: diffPreview },
    { phase: "apply", relativePath: "docs/demo-proof/applied/notes/launch-note.md", content: appliedNote },
    { phase: "receipt", relativePath: "docs/demo-proof/receipts/trust-loop-receipt.md", content: receipt },
    { phase: "report", relativePath: "docs/demo-proof/reports/trust-loop-report.html", content: reportHtml }
  ];
}

function buildManifest(fileEntries) {
  return {
    schema: "agenttrail.demo-proof.v1",
    generatedAt: fixedClock,
    title: "AgentTrail deterministic trust-loop demo",
    command: "npm run demo:proof",
    healthCheck: "npm run demo:health",
    flow,
    files: fileEntries
  };
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sha256File(relativePath) {
  const data = await fsp.readFile(path.join(projectRoot, relativePath));
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function fileInfo(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const data = await fsp.readFile(absolutePath);
  return {
    path: relativePath,
    bytes: data.length,
    sha256: crypto.createHash("sha256").update(data).digest("hex")
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

module.exports = {
  artifactDefinitions,
  buildManifest,
  demoRoot,
  fileInfo,
  fixedClock,
  flow,
  projectRoot,
  sha256File,
  sha256Text
};
