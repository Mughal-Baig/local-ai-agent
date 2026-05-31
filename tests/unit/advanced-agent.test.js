#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  advancedAgentStatus,
  createOrchestrationPlan,
  scheduleAgentRun,
  createTaskJournal,
  appendJournalStep,
  resumeTaskJournal,
  spawnSubAgent,
  diffReplayRuns,
  canonicalReplay
} = require("../../src/advanced-agent");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-advanced-agent-"));
  try {
    const plan = await createOrchestrationPlan(workspace, {
      prompt: "Ship the advanced agent roadmap safely.",
      selectedFiles: ["docs/LOCAL_AGENT_LAYER_ROADMAP.md"]
    });
    assert.equal(plan.schema, "agenttrail.multi-agent-plan.v1");
    assert.equal(plan.roles.length >= 4, true);
    assert.equal(plan.handoffs.length, plan.roles.length - 1);
    assert.equal(plan.riskControls.requireUserApprovalForWrites, true);

    const schedule = await scheduleAgentRun(workspace, {
      prompt: "Check stale receipts every morning.",
      runNow: true,
      interval: "daily",
      permissions: { read: true, write: "preview-only" }
    });
    assert.equal(schedule.schema, "agenttrail.scheduled-run.v1");
    assert.equal(schedule.status, "due");
    assert.equal(schedule.permissions.write, "preview-only");

    const journal = await createTaskJournal(workspace, {
      prompt: "Continue a long local refactor.",
      model: "llama3.2",
      selectedFiles: ["src/server.js"]
    });
    assert.equal(journal.schema, "agenttrail.task-journal.v1");
    assert.equal(journal.stepCount, 1);

    const appended = await appendJournalStep(workspace, {
      journalId: journal.id,
      type: "search",
      summary: "Searched for advanced agent routes.",
      data: { query: "advanced-agent" }
    });
    assert.equal(appended.step.type, "search");
    assert.equal(appended.journal.steps.length, 2);

    const resumed = await resumeTaskJournal(workspace, {
      journalId: journal.id
    });
    assert.equal(resumed.pending.source, "advanced-journal");
    assert.equal(resumed.pending.journalId, journal.id);
    assert.equal(resumed.pending.trail.length, 2);

    const subAgent = await spawnSubAgent(workspace, {
      parentRunId: "parent-1",
      role: { id: "reviewer", budget: { maxSteps: 8, maxToolCalls: 50, maxTokens: 9000 } },
      prompt: "Review the proposed orchestration plan.",
      parentBudget: { maxSteps: 3, maxToolCalls: 7, maxTokens: 3000 }
    });
    assert.equal(subAgent.schema, "agenttrail.sub-agent.v1");
    assert.equal(subAgent.budget.maxSteps, 3);
    assert.equal(subAgent.budget.maxToolCalls, 7);
    assert.equal(subAgent.budget.maxTokens, 3000);

    const stable = canonicalReplay({
      id: "random",
      createdAt: "now",
      prompt: "same",
      nested: { latencyMs: 99, value: 1 }
    });
    assert.deepEqual(stable, { nested: { value: 1 }, prompt: "same" });

    const replayDiff = await diffReplayRuns(workspace, {
      before: { id: "run-a", prompt: "Build", model: "m1", output: ["a"] },
      after: { id: "run-b", prompt: "Build", model: "m2", output: ["a", "b"] }
    });
    assert.equal(replayDiff.schema, "agenttrail.replay-diff.v1");
    assert.equal(replayDiff.changed, true);
    assert.match(replayDiff.diff, /m2/);

    const status = await advancedAgentStatus(workspace);
    assert.equal(status.counts.plans, 1);
    assert.equal(status.counts.schedules, 1);
    assert.equal(status.counts.journals, 1);
    assert.equal(status.counts.subAgents, 1);
    assert.equal(status.counts.replayDiffs, 1);

    console.log("Advanced agent unit tests passed");
  } finally {
    await fsp.rm(workspace, { recursive: true, force: true });
  }
}
