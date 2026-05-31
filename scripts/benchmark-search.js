#!/usr/bin/env node

// T058 - recall and latency benchmark vs brute force.
// Seeds a deterministic local corpus, builds the local-vector search index, then
// compares AgentTrail semantic search with an exhaustive in-process scanner.

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const projectRoot = path.resolve(__dirname, "..");
const port = 5200 + Math.floor(Math.random() * 400);
const TOP_K = Number(process.env.SEARCH_BENCHMARK_TOP_K || 3);
const RECALL_THRESHOLD = Number(process.env.SEARCH_BENCHMARK_RECALL_THRESHOLD || 90);
const AGREEMENT_THRESHOLD = Number(process.env.SEARCH_BENCHMARK_AGREEMENT_THRESHOLD || 90);
const STOP_WORDS = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "before", "after", "about"]);

const TOPICS = [
  {
    id: "billing",
    query: "refund invoice payment dispute subscription",
    path: "teams/billing/refunds.md",
    title: "Billing Refunds",
    body: "Refund workflows cover invoices, customer payments, disputes, subscriptions, chargebacks, credits, and payout reconciliation."
  },
  {
    id: "auth",
    query: "reset password oauth login session token",
    path: "teams/auth/password-reset.md",
    title: "Authentication Recovery",
    body: "Authentication recovery handles login sessions, OAuth tokens, password reset, account lockout, and credential security."
  },
  {
    id: "search",
    query: "vector embedding semantic bm25 reranking",
    path: "teams/search/ranking.md",
    title: "Search Ranking",
    body: "Search ranking blends vector embeddings, semantic retrieval, BM25 keyword scoring, reranking, chunk citations, and recall checks."
  },
  {
    id: "deploy",
    query: "docker kubernetes release rollback pipeline",
    path: "teams/platform/deployment.md",
    title: "Deployment Runbook",
    body: "Deployment runbooks describe Docker images, Kubernetes rollouts, CI pipelines, release approvals, rollbacks, and production checks."
  },
  {
    id: "memory",
    query: "project memory citations preferences decisions",
    path: "teams/agent/memory.md",
    title: "Project Memory",
    body: "Project memory stores facts, preferences, decisions, citations, history, scope selection, and explicit review controls."
  },
  {
    id: "security",
    query: "prompt injection exfiltration path escape suspicious tool",
    path: "teams/security/hardening.md",
    title: "Security Hardening",
    body: "Security hardening flags prompt injection, exfiltration attempts, path escapes, suspicious tool requests, and unsafe write behavior."
  },
  {
    id: "reports",
    query: "html report receipt timeline diff trust score",
    path: "teams/reports/shareable-reports.md",
    title: "Shareable Reports",
    body: "Shareable reports include HTML exports, receipt timelines, diffs, trust scores, citations, selected files, and model metadata."
  },
  {
    id: "recipes",
    query: "recipe pack marketplace founder writer coder",
    path: "teams/recipes/marketplace.md",
    title: "Recipe Marketplace",
    body: "Recipe packs organize reusable workflows for coders, founders, writers, students, security reviewers, and community submissions."
  },
  {
    id: "mcp",
    query: "mcp bridge approval scope tool receipt",
    path: "teams/integrations/mcp-bridge.md",
    title: "MCP Bridge",
    body: "The MCP bridge requires explicit tool approval, permission scopes, risk labels, receipts, and auditable external tool calls."
  },
  {
    id: "desktop",
    query: "mac app desktop launcher installer icon",
    path: "teams/desktop/mac-app.md",
    title: "Desktop App",
    body: "The desktop app needs a Mac launcher, installer packaging, app icon, local server startup, and non-developer onboarding."
  },
  {
    id: "models",
    query: "model benchmark coding planning tools long context",
    path: "teams/models/benchmarks.md",
    title: "Model Benchmarks",
    body: "Model benchmarks score local models for coding, planning, tool use, long context behavior, latency, and recommendation fit."
  },
  {
    id: "vectors",
    query: "vector store migration namespace chunk index",
    path: "teams/search/vector-store.md",
    title: "Vector Store",
    body: "The vector store persists file and chunk embeddings, schema versions, migrations, namespaces, collection metadata, and index status."
  }
];

const DISTRACTORS = [
  ["notes/company-handbook.md", "Company handbook with meeting norms, holiday calendars, expense policy, and team rituals."],
  ["notes/customer-interviews.md", "Customer interviews mention onboarding friction, pricing questions, dashboard clarity, and export needs."],
  ["notes/frontend-polish.md", "Frontend polish covers spacing, typography, contrast, empty states, keyboard focus, and responsive layout."],
  ["notes/release-post.md", "Launch posts should explain the promise, quick start, demo proof, roadmap, and contribution path."],
  ["notes/data-import.md", "Data import covers CSV cleanup, spreadsheet parsing, field mapping, validation, and backup export."],
  ["notes/support-queue.md", "Support queues track severity, owner, response time, escalation, resolution, and customer follow up."]
];

const CASES = TOPICS.map((topic) => ({
  id: topic.id,
  query: topic.query,
  expect: topic.path
}));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-search-benchmark-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1",
      AGENTTRAIL_CACHE: "off"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString()));
  child.stderr.on("data", (c) => (output += c.toString()));

  try {
    await waitForServer(port, () => output);
    const corpus = buildCorpus();
    for (const doc of corpus) {
      await postJson(`http://127.0.0.1:${port}/api/files/content`, { path: doc.path, content: doc.content });
    }

    const indexStart = performance.now();
    const index = await postJson(`http://127.0.0.1:${port}/api/search-index`, { provider: "local-vector" });
    const indexLatencyMs = elapsed(indexStart);
    assert.equal(index.features && index.features.annIndex, true, "search index should build an ANN candidate index");
    assert.equal(index.vectorStore && index.vectorStore.ann && index.vectorStore.ann.exists, true, "vector store should report ANN status");

    const bruteForceRows = [];
    const agentRows = [];
    for (const testCase of CASES) {
      const bruteStart = performance.now();
      const bruteResults = bruteForceSearch(testCase.query, corpus, TOP_K);
      bruteForceRows.push({
        ...rankMetrics(testCase.expect, bruteResults.map((item) => item.path)),
        latencyMs: elapsed(bruteStart),
        topPaths: bruteResults.map((item) => item.path)
      });

      const agentStart = performance.now();
      const agent = await fetchJson(
        `http://127.0.0.1:${port}/api/search?query=${encodeURIComponent(testCase.query)}&limit=${TOP_K}&mode=semantic`
      );
      const agentPaths = (agent.results || []).slice(0, TOP_K).map((item) => item.path);
      agentRows.push({
        ...rankMetrics(testCase.expect, agentPaths),
        bruteTop1Agreement: agentPaths.includes(bruteResults[0] && bruteResults[0].path),
        latencyMs: elapsed(agentStart),
        topPaths: agentPaths
      });
    }

    const brute = summarizeRows(bruteForceRows);
    const agent = summarizeRows(agentRows);
    const agreement = percent(agentRows.filter((row) => row.bruteTop1Agreement).length, agentRows.length);
    const result = {
      schema: "agenttrail.search-benchmark.v1",
      createdAt: new Date().toISOString(),
      corpus: { documents: corpus.length, cases: CASES.length },
      index: {
        latencyMs: indexLatencyMs,
        itemCount: index.itemCount,
        chunkCount: index.chunkCount,
        vectorStore: index.vectorStore || null
      },
      bruteForce: brute,
      agentTrailSemantic: {
        ...agent,
        bruteTop1Agreement: agreement
      },
      thresholds: {
        recallAtK: RECALL_THRESHOLD,
        bruteTop1Agreement: AGREEMENT_THRESHOLD
      }
    };

    console.log(`Search benchmark - corpus: ${corpus.length} docs, ${CASES.length} labeled queries`);
    console.log(`Search benchmark - index build: ${indexLatencyMs}ms, vectors: ${index.vectorStore ? index.vectorStore.vectorCount : 0}, ANN buckets: ${index.vectorStore && index.vectorStore.ann ? index.vectorStore.ann.bucketCount : 0}`);
    console.log(`Search benchmark - brute force recall@${TOP_K}: ${brute.recallAtK}% avg ${brute.avgLatencyMs}ms p95 ${brute.p95LatencyMs}ms`);
    console.log(`Search benchmark - AgentTrail semantic recall@${TOP_K}: ${agent.recallAtK}% avg ${agent.avgLatencyMs}ms p95 ${agent.p95LatencyMs}ms`);
    console.log(`Search benchmark - AgentTrail vs brute top-1 agreement@${TOP_K}: ${agreement}%`);

    assert.equal(brute.recallAtK, 100, "brute-force scanner should recover every labeled fixture");
    if (agent.recallAtK < RECALL_THRESHOLD || agreement < AGREEMENT_THRESHOLD) {
      console.error(JSON.stringify(result, null, 2));
      throw new Error(`Search benchmark failed: recall ${agent.recallAtK}% or agreement ${agreement}% below threshold`);
    }
    console.log("Search benchmark passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function buildCorpus() {
  const docs = [];
  for (const topic of TOPICS) {
    docs.push({
      path: topic.path,
      content: [
        `# ${topic.title}`,
        "",
        topic.body,
        "",
        `Benchmark label: ${topic.id}. Query terms: ${topic.query}.`
      ].join("\n")
    });
    docs.push({
      path: `archive/${topic.id}-notes.md`,
      content: [
        `# ${topic.title} Archive`,
        "",
        `Background notes for ${topic.title.toLowerCase()} include planning context, owners, status, risks, and release notes.`
      ].join("\n")
    });
  }
  for (const [docPath, content] of DISTRACTORS) {
    docs.push({ path: docPath, content: `# ${titleFromPath(docPath)}\n\n${content}` });
  }
  return docs;
}

function bruteForceSearch(query, corpus, limit) {
  const terms = tokenize(query);
  return corpus
    .map((doc) => {
      const pathTokens = tokenize(doc.path);
      const textTokens = tokenize(doc.content);
      const pathMatches = terms.filter((term) => pathTokens.includes(term)).length;
      const textMatches = terms.filter((term) => textTokens.includes(term)).length;
      const coverage = new Set(terms.filter((term) => textTokens.includes(term) || pathTokens.includes(term))).size;
      return {
        path: doc.path,
        score: coverage * 10 + textMatches * 2 + pathMatches * 3
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function rankMetrics(expected, paths) {
  const rank = paths.indexOf(expected) + 1;
  return {
    hit: rank > 0,
    rank: rank || null,
    reciprocalRank: rank ? 1 / rank : 0
  };
}

function summarizeRows(rows) {
  const latencies = rows.map((row) => row.latencyMs);
  return {
    recallAtK: percent(rows.filter((row) => row.hit).length, rows.length),
    mrr: Number((rows.reduce((sum, row) => sum + row.reciprocalRank, 0) / rows.length).toFixed(3)),
    avgLatencyMs: average(latencies),
    p95LatencyMs: percentile(latencies, 95),
    maxLatencyMs: Math.max(...latencies)
  };
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function percent(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) {
    return 0;
  }
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function percentile(values, p) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) {
    return 0;
  }
  const index = Math.min(clean.length - 1, Math.ceil((p / 100) * clean.length) - 1);
  return clean[index];
}

function elapsed(started) {
  return Math.round(performance.now() - started);
}

function titleFromPath(docPath) {
  return path.basename(docPath, path.extname(docPath)).replace(/-/g, " ");
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
    body: JSON.stringify(payload || {})
  });
  assert.equal(response.ok, true, `${url} should respond ok`);
  return response.json();
}

async function waitForServer(p, getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${p}/api/config`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
