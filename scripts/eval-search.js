#!/usr/bin/env node

// T052 - search-quality eval harness.
// Boots a real server on a temp workspace, seeds a small labeled corpus, builds a
// local-vector index, runs a fixed query set, and scores hit@3 for keyword and
// hybrid (semantic) ranking. No Ollama required (local-vector + BM25). Prints a
// score and exits non-zero below the threshold so CI can gate search regressions.

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const port = 4900 + Math.floor(Math.random() * 200);
const THRESHOLD = Number(process.env.SEARCH_EVAL_THRESHOLD || 75); // percent
const TOP_K = 3;

const CORPUS = {
  "billing.md": "# Billing\n\nInvoices, customer payments, refunds, charges, subscriptions, and payouts.",
  "auth.md": "# Authentication\n\nLogin, password reset, OAuth, sessions, tokens, and account security.",
  "search.md": "# Search\n\nVector embeddings, semantic ranking, BM25 keyword scoring, and reranking.",
  "deploy.md": "# Deployment\n\nDocker images, Kubernetes, CI pipelines, releases, and rollbacks."
};

const CASES = [
  { query: "refund a customer payment invoice", expect: "billing.md" },
  { query: "reset user password login session", expect: "auth.md" },
  { query: "vector embedding semantic ranking bm25", expect: "search.md" },
  { query: "kubernetes docker release pipeline", expect: "deploy.md" }
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-eval-search-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), WORKSPACE_ROOT: workspaceRoot, OLLAMA_HOST: "http://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(port, () => output);
    for (const [name, content] of Object.entries(CORPUS)) {
      await postJson(`http://127.0.0.1:${port}/api/files/content`, { path: name, content });
    }
    await postJson(`http://127.0.0.1:${port}/api/search-index`, { provider: "local-vector" });

    const keyword = await scoreMode("keyword");
    const hybrid = await scoreMode("semantic");

    console.log(`Search eval - keyword hit@${TOP_K}: ${keyword.score}%  (${keyword.hits}/${keyword.total})`);
    console.log(`Search eval - hybrid  hit@${TOP_K}: ${hybrid.score}%  (${hybrid.hits}/${hybrid.total})`);
    const best = Math.max(keyword.score, hybrid.score);
    console.log(`Search eval - best: ${best}% (threshold ${THRESHOLD}%)`);

    if (best < THRESHOLD) {
      console.error(`Search eval FAILED: ${best}% < ${THRESHOLD}%`);
      process.exitCode = 1;
    } else {
      console.log("Search eval passed");
    }
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function scoreMode(mode) {
  let hits = 0;
  for (const testCase of CASES) {
    const data = await fetchJson(
      `http://127.0.0.1:${port}/api/search?query=${encodeURIComponent(testCase.query)}&limit=${TOP_K}&mode=${mode}`
    );
    const top = (data.results || []).slice(0, TOP_K).map((r) => r.path);
    assert.equal((data.results || []).every((r) => r.citation && r.span && Number.isInteger(r.span.charStart)), true);
    if (top.includes(testCase.expect)) hits += 1;
  }
  return { hits, total: CASES.length, score: Math.round((hits / CASES.length) * 100) };
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}

async function waitForServer(p, getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${p}/api/status`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
