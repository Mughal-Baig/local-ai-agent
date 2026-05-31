#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const agentPort = 5980 + Math.floor(Math.random() * 120);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-advanced-agent-api-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(agentPort),
      WORKSPACE_ROOT: workspaceRoot,
      OLLAMA_HOST: "http://127.0.0.1:1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(() => output);

    const plan = await postJson("/api/advanced-agent/orchestrate", {
      prompt: "Plan a safe local agent change.",
      roles: ["planner", "researcher", "implementer", "reviewer"]
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.plan.schema, "agenttrail.multi-agent-plan.v1");
    assert.equal(plan.plan.handoffs.length, 3);

    const schedule = await postJson("/api/advanced-agent/schedule", {
      prompt: "Run a local receipt check.",
      runNow: true,
      selectedFiles: ["README.md"]
    });
    assert.equal(schedule.ok, true);
    assert.equal(schedule.schedule.schema, "agenttrail.scheduled-run.v1");
    assert.equal(schedule.job.type, "advanced-agent-run");

    const journal = await postJson("/api/advanced-agent/journal", {
      prompt: "Resume this work after a break.",
      selectedFiles: ["docs/LOCAL_AGENT_LAYER_ROADMAP.md"]
    });
    assert.equal(journal.ok, true);
    assert.equal(journal.journal.schema, "agenttrail.task-journal.v1");

    const append = await postJson("/api/advanced-agent/journal/append", {
      journalId: journal.journal.id,
      type: "checkpoint",
      summary: "Saved a checkpoint before tests."
    });
    assert.equal(append.step.status, "completed");

    const resume = await postJson("/api/advanced-agent/journal/resume", {
      journalId: journal.journal.id
    });
    assert.equal(resume.pending.source, "advanced-journal");
    assert.equal(resume.pending.journalId, journal.journal.id);

    const subAgent = await postJson("/api/advanced-agent/sub-agent", {
      parentRunId: "parent-api",
      role: "reviewer",
      prompt: "Review budget isolation.",
      parentBudget: { maxSteps: 2, maxToolCalls: 4, maxTokens: 2000 },
      budget: { maxSteps: 9, maxToolCalls: 20, maxTokens: 9000 }
    });
    assert.equal(subAgent.subAgent.schema, "agenttrail.sub-agent.v1");
    assert.equal(subAgent.subAgent.budget.maxSteps, 2);

    const replayDiff = await postJson("/api/advanced-agent/replay-diff", {
      before: { id: "run-1", prompt: "same", result: "alpha", latencyMs: 15 },
      after: { id: "run-2", prompt: "same", result: "beta", latencyMs: 99 }
    });
    assert.equal(replayDiff.replayDiff.schema, "agenttrail.replay-diff.v1");
    assert.equal(replayDiff.replayDiff.changed, true);
    assert.match(replayDiff.replayDiff.diff, /beta/);

    const status = await getJson("/api/advanced-agent");
    assert.equal(status.ok, true);
    assert.equal(status.agent.counts.plans, 1);
    assert.equal(status.agent.counts.schedules, 1);
    assert.equal(status.agent.counts.journals >= 1, true);
    assert.equal(status.agent.counts.subAgents, 1);
    assert.equal(status.agent.counts.replayDiffs, 1);

    console.log("Advanced agent integration test passed");
  } finally {
    child.kill("SIGTERM");
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function getJson(route) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${route}`);
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function postJson(route, body) {
  const response = await fetch(`http://127.0.0.1:${agentPort}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true, `${route} should respond ok`);
  return response.json();
}

async function waitForServer(getOutput) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${agentPort}/api/health`);
      if (response.ok) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. Output:\n${getOutput()}`);
}
