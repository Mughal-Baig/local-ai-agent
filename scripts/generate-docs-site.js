#!/usr/bin/env node

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(projectRoot, "docs");
const siteRoot = path.join(docsRoot, "site");
const SITE_DOCS = [
  ["GETTING_STARTED.md", "Start Here", "Install, open, run a safe first task, and export proof.", ["quickstart", "install", "demo"]],
  ["RECIPE_AUTHORING.md", "Recipe Authoring", "Create safe reusable recipes with validation and examples.", ["recipes", "marketplace", "workflow"]],
  ["BACKEND_SETUP.md", "Backend Setup", "Configure Ollama, LM Studio, llama.cpp, vLLM, and OpenAI-compatible local servers.", ["models", "backend", "runtime"]],
  ["MODEL_ECOSYSTEM.md", "Model Ecosystem", "LoRA adapters, fine-tuning launchers, quantization, GGUF conversion, and per-task evals.", ["models", "lora", "evaluation"]],
  ["ADVANCED_AGENT.md", "Advanced Agent", "Multi-agent plans, scheduled runs, journals, sub-agent budgets, and deterministic replay diffs.", ["agents", "schedules", "replay"]],
  ["ARCHITECTURE.md", "Architecture", "How the local agent layer, tools, memory, receipts, and security fit together.", ["architecture", "security", "local-first"]],
  ["API_REFERENCE.md", "API Reference", "Generated route and OpenAI-compatible API reference.", ["api", "routes", "openapi"]],
  ["TROUBLESHOOTING.md", "Troubleshooting And FAQ", "Fix Ollama, model, file, receipt, performance, and CI issues.", ["faq", "help", "debugging"]],
  ["VIDEO_WALKTHROUGHS.md", "Video Walkthroughs", "Shot lists and recording commands for the public demo videos.", ["video", "demo", "launch"]],
  ["LAUNCH_RESPONSE_WORKFLOW.md", "Launch Response", "Public launch checklist, response macros, triage, and success metrics.", ["launch", "community", "growth"]],
  ["RECIPE_MARKETPLACE.md", "Recipe Marketplace", "Submission path, curation rules, review rubric, and featured pack queue.", ["recipes", "marketplace", "community"]],
  ["GOOD_FIRST_ISSUES.md", "Good First Issues", "Scoped issue backlog, label set, and maintainer rules for starter tasks.", ["issues", "labels", "community"]],
  ["RELEASE_PROCESS.md", "Release Process", "Changelog discipline, release note shape, and release readiness gates.", ["release", "changelog", "process"]],
  ["SHOWCASE.md", "Showcase Gallery", "How to collect real workflows with receipt, report, and trust proof.", ["showcase", "receipts", "proof"]],
  ["COMPARISON_BENCHMARKS.md", "Comparison Benchmarks", "Honest reproducible comparison matrix and benchmark rules.", ["benchmarks", "comparison", "growth"]],
  ["PLUGIN_SDK.md", "Plugin SDK", "Plugin manifest shape, permission contract, and example plugins.", ["plugins", "sdk", "permissions"]],
  ["QUALITY_ENGINEERING.md", "Quality Engineering", "Coverage, fuzzing, UI E2E, performance gates, and matrix CI.", ["quality", "ci", "tests"]],
  ["SECURITY_POSTURE.md", "Security Posture", "Threat model and local safety boundaries.", ["security", "privacy", "threat-model"]],
  ["TEAM_ENTERPRISE.md", "Team Mode", "Local users, RBAC, audit export, sync, and SSO hooks.", ["team", "rbac", "audit"]],
  ["OPENAI_COMPATIBLE_API.md", "OpenAI-Compatible API", "Use AgentTrail through /v1 chat, models, and embeddings.", ["api", "openai-compatible", "integration"]],
  ["CLI.md", "CLI", "Run AgentTrail from terminal scripts and shell completions.", ["cli", "automation", "terminal"]]
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const index = await buildIndex();
  const html = renderHtml(index);
  const indexJson = `${JSON.stringify(index, null, 2)}\n`;
  const htmlPath = path.join(siteRoot, "index.html");
  const indexPath = path.join(siteRoot, "search-index.json");

  if (process.argv.includes("--check")) {
    assert.equal(await readIfExists(htmlPath), html, "docs/site/index.html is out of date. Run npm run docs:site.");
    assert.equal(await readIfExists(indexPath), indexJson, "docs/site/search-index.json is out of date. Run npm run docs:site.");
    console.log("Docs site is up to date");
    return;
  }

  await fsp.mkdir(siteRoot, { recursive: true });
  await fsp.writeFile(htmlPath, html, "utf8");
  await fsp.writeFile(indexPath, indexJson, "utf8");
  console.log(`Generated docs site with ${index.records.length} searchable record(s)`);
}

async function buildIndex() {
  const docs = [];
  const records = [];
  for (const [file, title, description, tags] of SITE_DOCS) {
    const markdown = await fsp.readFile(path.join(docsRoot, file), "utf8");
    const doc = {
      file,
      title,
      description,
      tags,
      href: `../${file}`,
      sections: extractSections(markdown)
    };
    docs.push(doc);
    records.push({
      type: "doc",
      title,
      description,
      href: doc.href,
      tags,
      text: compactText(markdown)
    });
    for (const section of doc.sections.slice(0, 8)) {
      records.push({
        type: "section",
        title: `${title} - ${section.title}`,
        description: section.snippet,
        href: `${doc.href}${section.anchor ? `#${section.anchor}` : ""}`,
        tags,
        text: `${section.title} ${section.snippet}`
      });
    }
  }
  return {
    schema: "agenttrail.docs-site.v1",
    title: "AgentTrail Docs",
    description: "Searchable local-first documentation for AgentTrail.",
    docs,
    records
  };
}

function extractSections(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const sections = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,3})\s+(.+)$/);
    if (!match) {
      continue;
    }
    const snippet = [];
    for (let cursor = index + 1; cursor < lines.length && snippet.join(" ").length < 180; cursor += 1) {
      const line = lines[cursor].trim();
      if (/^#{1,3}\s+/.test(line)) break;
      if (!line || line.startsWith("```") || line.startsWith("|")) continue;
      snippet.push(line.replace(/[-*]\s+/, ""));
    }
    const title = match[2].trim();
    sections.push({
      title,
      anchor: slug(title),
      snippet: truncate(snippet.join(" "), 220)
    });
  }
  return sections;
}

function renderHtml(index) {
  const cards = index.docs.map((doc) => `
        <article class="card" data-title="${escapeHtml(doc.title)}" data-tags="${escapeHtml(doc.tags.join(" "))}">
          <div class="tags">${doc.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <h2><a href="${escapeHtml(doc.href)}">${escapeHtml(doc.title)}</a></h2>
          <p>${escapeHtml(doc.description)}</p>
        </article>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentTrail Docs</title>
  <style>
    :root{color-scheme:light;--ink:#25221d;--muted:#6d665b;--paper:#faf7ef;--panel:#fffdf8;--line:#ded6c8;--accent:#9b4f33;--accent2:#2f6f73}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    header{padding:40px 24px 22px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#fffdf8,#f5efe4)}
    main{max-width:1120px;margin:0 auto;padding:24px}.hero{max-width:1120px;margin:0 auto}.eyebrow{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent2);font-weight:700}
    h1{margin:.25rem 0 .5rem;font-size:clamp(2rem,5vw,4.3rem);line-height:1}p{color:var(--muted)}.search{display:grid;gap:10px;margin-top:22px;max-width:760px}
    input{width:100%;border:1px solid var(--line);border-radius:8px;padding:14px 15px;font:inherit;background:var(--panel);color:var(--ink);box-shadow:0 1px 0 rgba(30,25,15,.04)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:22px}.card{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:18px;min-height:180px}
    .card h2{font-size:1.05rem;margin:12px 0 8px}.card a{color:var(--ink);text-decoration:none}.card a:hover{color:var(--accent)}.tags{display:flex;gap:6px;flex-wrap:wrap}.tags span{font-size:.72rem;color:var(--accent2);border:1px solid #c6dedb;border-radius:999px;padding:2px 7px;background:#f4fbf9}
    .results{display:grid;gap:8px;margin-top:14px}.result{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:12px}.result strong{display:block}.result a{color:var(--accent);text-decoration:none}.muted{color:var(--muted);font-size:.92rem}
    footer{max-width:1120px;margin:0 auto;padding:30px 24px 50px;color:var(--muted)}
  </style>
</head>
<body>
  <header>
    <div class="hero">
      <div class="eyebrow">Local-first docs</div>
      <h1>AgentTrail Docs</h1>
      <p>Search the guides for the auditable local-agent layer: install, recipes, backends, architecture, API, troubleshooting, videos, quality, security, and team mode.</p>
      <label class="search">
        <span class="muted">Search docs</span>
        <input id="search" type="search" placeholder="Try: receipts, LM Studio, recipe, coverage, RBAC">
      </label>
      <div id="results" class="results" aria-live="polite"></div>
    </div>
  </header>
  <main>
    <section class="grid" id="cards">${cards}
    </section>
  </main>
  <footer>Generated by <code>npm run docs:site</code>. Search runs fully in the browser.</footer>
  <script>
    const input = document.querySelector("#search");
    const results = document.querySelector("#results");
    let records = [];
    fetch("./search-index.json").then((r) => r.json()).then((data) => { records = data.records || []; render(""); });
    input.addEventListener("input", () => render(input.value));
    function render(query) {
      const terms = String(query || "").toLowerCase().split(/\\s+/).filter(Boolean);
      if (!terms.length) { results.innerHTML = ""; return; }
      const matches = records.map((record) => ({ record, score: score(record, terms) })).filter((row) => row.score > 0).sort((a,b) => b.score - a.score).slice(0, 8);
      results.innerHTML = matches.length ? matches.map(({ record }) => '<div class="result"><strong><a href="' + esc(record.href) + '">' + esc(record.title) + '</a></strong><span class="muted">' + esc(record.description || "") + '</span></div>').join("") : '<div class="result muted">No docs matched that search.</div>';
    }
    function score(record, terms) {
      const haystack = [record.title, record.description, (record.tags || []).join(" "), record.text].join(" ").toLowerCase();
      return terms.reduce((sum, term) => sum + (haystack.includes(term) ? (record.title.toLowerCase().includes(term) ? 4 : 1) : 0), 0);
    }
    function esc(value) { return String(value || "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
  </script>
</body>
</html>
`;
}

function compactText(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`|[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

async function readIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}
