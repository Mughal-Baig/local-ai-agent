"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const INDEX_SCHEMA = "agenttrail.advanced-agent.v1";
const PLAN_SCHEMA = "agenttrail.multi-agent-plan.v1";
const SCHEDULE_SCHEMA = "agenttrail.scheduled-run.v1";
const JOURNAL_SCHEMA = "agenttrail.task-journal.v1";
const SUB_AGENT_SCHEMA = "agenttrail.sub-agent.v1";
const REPLAY_DIFF_SCHEMA = "agenttrail.replay-diff.v1";

const DEFAULT_ROLES = [
  {
    id: "planner",
    title: "Planner",
    goal: "Break the request into reviewable steps and define acceptance criteria.",
    allowedTools: ["search_workspace", "read_file"],
    permissions: { read: true, write: false, network: false },
    budget: { maxSteps: 2, maxToolCalls: 4, maxTokens: 2500 },
    produces: ["plan", "acceptance-checklist"]
  },
  {
    id: "researcher",
    title: "Researcher",
    goal: "Gather cited local evidence before any change is proposed.",
    allowedTools: ["search_workspace", "read_file"],
    permissions: { read: true, write: false, network: false },
    budget: { maxSteps: 3, maxToolCalls: 8, maxTokens: 3500 },
    produces: ["evidence", "citations"]
  },
  {
    id: "implementer",
    title: "Implementer",
    goal: "Prepare diff-safe changes without silently writing files.",
    allowedTools: ["read_file", "preview_write"],
    permissions: { read: true, write: "preview-only", network: false },
    budget: { maxSteps: 4, maxToolCalls: 10, maxTokens: 5000 },
    produces: ["diff-preview", "test-plan"]
  },
  {
    id: "reviewer",
    title: "Reviewer",
    goal: "Check safety, tests, and handoff quality before the user applies changes.",
    allowedTools: ["search_workspace", "read_file"],
    permissions: { read: true, write: false, network: false },
    budget: { maxSteps: 2, maxToolCalls: 4, maxTokens: 2500 },
    produces: ["review", "risks", "next-action"]
  }
];

const VOLATILE_KEYS = new Set([
  "id",
  "runId",
  "jobId",
  "traceId",
  "createdAt",
  "updatedAt",
  "startedAt",
  "finishedAt",
  "timestamp",
  "durationMs",
  "latencyMs",
  "elapsedMs"
]);

function advancedAgentPaths(workspaceRoot, env = process.env) {
  const root = path.join(path.resolve(workspaceRoot), ".agenttrail", "advanced-agent");
  return {
    root,
    plansDir: path.join(root, "plans"),
    schedulesDir: path.join(root, "schedules"),
    journalsDir: path.join(root, "journals"),
    subAgentsDir: path.join(root, "subagents"),
    replayDiffsDir: path.join(root, "replay-diffs"),
    indexPath: path.join(root, "index.json"),
    env
  };
}

async function ensureAdvancedAgent(workspaceRoot, env = process.env) {
  const paths = advancedAgentPaths(workspaceRoot, env);
  await Promise.all([
    fsp.mkdir(paths.plansDir, { recursive: true }),
    fsp.mkdir(paths.schedulesDir, { recursive: true }),
    fsp.mkdir(paths.journalsDir, { recursive: true }),
    fsp.mkdir(paths.subAgentsDir, { recursive: true }),
    fsp.mkdir(paths.replayDiffsDir, { recursive: true })
  ]);
  const index = await readAdvancedAgentIndex(workspaceRoot, env);
  await writeAdvancedAgentIndex(workspaceRoot, index, env);
  return paths;
}

async function readAdvancedAgentIndex(workspaceRoot, env = process.env) {
  const paths = advancedAgentPaths(workspaceRoot, env);
  try {
    const data = JSON.parse(await fsp.readFile(paths.indexPath, "utf8"));
    return normalizeIndex(data);
  } catch {
    return normalizeIndex({});
  }
}

async function writeAdvancedAgentIndex(workspaceRoot, index, env = process.env) {
  const paths = advancedAgentPaths(workspaceRoot, env);
  await fsp.mkdir(paths.root, { recursive: true });
  const normalized = normalizeIndex(index);
  normalized.updatedAt = new Date().toISOString();
  await fsp.writeFile(paths.indexPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

async function advancedAgentStatus(workspaceRoot, env = process.env) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const index = await rebuildAdvancedAgentIndex(workspaceRoot, env);
  return {
    ...index,
    counts: {
      plans: index.plans.length,
      schedules: index.schedules.length,
      journals: index.journals.length,
      subAgents: index.subAgents.length,
      replayDiffs: index.replayDiffs.length
    },
    capabilities: [
      "multi-agent orchestration",
      "local scheduled run manifests",
      "long-running task journals",
      "budget-isolated sub-agents",
      "deterministic replay diffing"
    ],
    storageRoot: path.relative(path.resolve(workspaceRoot), advancedAgentPaths(workspaceRoot, env).root)
  };
}

async function rebuildAdvancedAgentIndex(workspaceRoot, env = process.env) {
  const paths = advancedAgentPaths(workspaceRoot, env);
  const index = normalizeIndex({
    plans: await readArtifactRecords(workspaceRoot, paths.plansDir, PLAN_SCHEMA, (record, artifactPath) => addArtifactPaths(workspaceRoot, record, artifactPath)),
    schedules: await readArtifactRecords(workspaceRoot, paths.schedulesDir, SCHEDULE_SCHEMA, (record, artifactPath) => addArtifactPaths(workspaceRoot, record, artifactPath)),
    journals: await readArtifactRecords(workspaceRoot, paths.journalsDir, JOURNAL_SCHEMA, (record, artifactPath) => summarizeJournal(workspaceRoot, record, artifactPath)),
    subAgents: await readArtifactRecords(workspaceRoot, paths.subAgentsDir, SUB_AGENT_SCHEMA, (record, artifactPath) => addArtifactPaths(workspaceRoot, record, artifactPath)),
    replayDiffs: await readArtifactRecords(workspaceRoot, paths.replayDiffsDir, REPLAY_DIFF_SCHEMA, (record, artifactPath) => addArtifactPaths(workspaceRoot, record, artifactPath))
  });
  return writeAdvancedAgentIndex(workspaceRoot, index, env);
}

async function createOrchestrationPlan(workspaceRoot, input = {}, env = process.env) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const prompt = text(input.prompt || input.goal || input.request, 6000);
  const name = normalizeName(input.name || titleFromPrompt(prompt) || "multi-agent-plan");
  const id = uniqueId(name);
  const roles = normalizeRoles(input.roles);
  const handoffs = normalizeHandoffs(input.handoffs, roles);
  const plan = {
    schema: PLAN_SCHEMA,
    id,
    name,
    prompt,
    model: text(input.model || env.OLLAMA_MODEL || "local-model", 120),
    selectedFiles: normalizePathList(input.selectedFiles || input.files),
    roles,
    handoffs,
    acceptanceCriteria: normalizeList(input.acceptanceCriteria || input.acceptance, [
      "Every read/write step is visible in the trail.",
      "Write-like work produces a diff preview before apply.",
      "The final answer cites the evidence and records a receipt."
    ], 12),
    riskControls: {
      requireUserApprovalForWrites: input.requireUserApprovalForWrites !== false,
      requireReceipts: input.requireReceipts !== false,
      boundary: "workspace-only",
      network: input.allowNetwork === true ? "explicit-allowlist" : "off"
    },
    budget: normalizeBudget(input.budget, {
      maxSteps: Math.max(6, roles.length * 2),
      maxToolCalls: Math.max(12, roles.length * 4),
      maxTokens: 14000,
      maxRuntimeMs: 20 * 60 * 1000
    }),
    status: "planned",
    createdAt: new Date().toISOString()
  };
  const paths = advancedAgentPaths(workspaceRoot, env);
  const artifactPath = path.join(paths.plansDir, `${id}.json`);
  await writeArtifact(artifactPath, plan);
  return upsertAdvancedRecord(workspaceRoot, "plans", addArtifactPaths(workspaceRoot, plan, artifactPath), env);
}

async function scheduleAgentRun(workspaceRoot, input = {}, env = process.env) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const prompt = text(input.prompt || input.request || input.goal, 6000);
  if (!prompt) {
    throw new Error("Scheduled agent runs require a prompt.");
  }
  const name = normalizeName(input.name || titleFromPrompt(prompt) || "scheduled-agent-run");
  const id = uniqueId(name);
  const runAt = normalizeIsoTime(input.runAt || input.scheduledFor || input.at);
  const due = input.runNow === true || (runAt ? Date.parse(runAt) <= Date.now() : false);
  const schedule = {
    schema: SCHEDULE_SCHEMA,
    id,
    name,
    prompt,
    model: text(input.model || env.OLLAMA_MODEL || "local-model", 120),
    selectedFiles: normalizePathList(input.selectedFiles || input.files),
    permissions: normalizePermissions(input.permissions),
    schedule: {
      runAt,
      interval: text(input.interval || input.rrule || "", 160),
      timezone: text(input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "local", 80),
      runNow: input.runNow === true
    },
    status: due ? "due" : "scheduled",
    nextRunAt: runAt,
    lastRunAt: null,
    budget: normalizeBudget(input.budget, {
      maxSteps: 4,
      maxToolCalls: 8,
      maxTokens: 6000,
      maxRuntimeMs: 15 * 60 * 1000
    }),
    createdAt: new Date().toISOString()
  };
  const paths = advancedAgentPaths(workspaceRoot, env);
  const artifactPath = path.join(paths.schedulesDir, `${id}.json`);
  await writeArtifact(artifactPath, schedule);
  return upsertAdvancedRecord(workspaceRoot, "schedules", addArtifactPaths(workspaceRoot, schedule, artifactPath), env);
}

async function createTaskJournal(workspaceRoot, input = {}, env = process.env) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const prompt = text(input.prompt || input.request || input.goal, 6000);
  if (!prompt) {
    throw new Error("Task journals require a prompt.");
  }
  const name = normalizeName(input.name || titleFromPrompt(prompt) || "task-journal");
  const id = uniqueId(name);
  const journal = {
    schema: JOURNAL_SCHEMA,
    id,
    name,
    prompt,
    model: text(input.model || env.OLLAMA_MODEL || "local-model", 120),
    selectedFiles: normalizePathList(input.selectedFiles || input.files),
    permissions: normalizePermissions(input.permissions),
    status: "active",
    budget: normalizeBudget(input.budget, {
      maxSteps: 12,
      maxToolCalls: 24,
      maxTokens: 24000,
      maxRuntimeMs: 60 * 60 * 1000
    }),
    checkpoints: normalizeList(input.checkpoints, [], 20).map((summary, index) => ({
      id: `checkpoint-${index + 1}`,
      summary,
      createdAt: new Date().toISOString()
    })),
    steps: [
      {
        id: "step-1",
        type: "journal-created",
        status: "completed",
        summary: "Created a resumable local task journal.",
        data: {},
        createdAt: new Date().toISOString()
      }
    ],
    resume: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const artifactPath = journalPath(workspaceRoot, journal.id, env);
  await writeArtifact(artifactPath, journal);
  return upsertAdvancedRecord(workspaceRoot, "journals", summarizeJournal(workspaceRoot, journal, artifactPath), env);
}

async function appendJournalStep(workspaceRoot, input = {}, env = process.env) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const journal = await readJournal(workspaceRoot, input.journalId || input.id, env);
  const step = {
    id: `step-${journal.steps.length + 1}`,
    type: normalizeId(input.type || "note"),
    status: normalizeStepStatus(input.status),
    summary: text(input.summary || input.message || "Journal step", 500),
    data: compactJson(input.data || {}),
    createdAt: new Date().toISOString()
  };
  journal.steps.push(step);
  journal.status = normalizeJournalStatus(input.journalStatus || journal.status);
  journal.updatedAt = new Date().toISOString();
  const artifactPath = journalPath(workspaceRoot, journal.id, env);
  await writeArtifact(artifactPath, journal);
  await upsertAdvancedRecord(workspaceRoot, "journals", summarizeJournal(workspaceRoot, journal, artifactPath), env);
  return { journal, step };
}

async function resumeTaskJournal(workspaceRoot, input = {}, env = process.env) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const journal = await readJournal(workspaceRoot, input.journalId || input.id, env);
  const pending = {
    prompt: text(input.prompt || journal.prompt, 6000),
    model: journal.model,
    selectedFiles: journal.selectedFiles,
    permissions: journal.permissions,
    securityMode: input.securityMode !== false,
    source: "advanced-journal",
    journalId: journal.id,
    trail: journal.steps.slice(-40).map((step) => ({
      type: step.type,
      status: step.status,
      summary: step.summary,
      createdAt: step.createdAt
    })),
    startedAt: new Date().toISOString()
  };
  journal.status = "resumable";
  journal.resume = {
    createdAt: new Date().toISOString(),
    pending
  };
  journal.updatedAt = new Date().toISOString();
  const artifactPath = journalPath(workspaceRoot, journal.id, env);
  await writeArtifact(artifactPath, journal);
  await upsertAdvancedRecord(workspaceRoot, "journals", summarizeJournal(workspaceRoot, journal, artifactPath), env);
  return { journal, pending };
}

async function spawnSubAgent(workspaceRoot, input = {}, env = process.env) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const roleInput = input.role && typeof input.role === "object" ? input.role : { id: input.role || "sub-agent" };
  const role = normalizeRoles([roleInput])[0];
  const prompt = text(input.prompt || input.task || role.goal, 6000);
  if (!prompt) {
    throw new Error("Sub-agents require a task prompt.");
  }
  const parentBudget = normalizeBudget(input.parentBudget || {}, {
    maxSteps: 12,
    maxToolCalls: 24,
    maxTokens: 24000,
    maxRuntimeMs: 60 * 60 * 1000
  });
  const requestedBudget = normalizeBudget(input.budget || role.budget || {}, {
    maxSteps: 3,
    maxToolCalls: 6,
    maxTokens: 4000,
    maxRuntimeMs: 10 * 60 * 1000
  });
  const isolatedBudget = {
    maxSteps: Math.min(requestedBudget.maxSteps, parentBudget.maxSteps),
    maxToolCalls: Math.min(requestedBudget.maxToolCalls, parentBudget.maxToolCalls),
    maxTokens: Math.min(requestedBudget.maxTokens, parentBudget.maxTokens),
    maxRuntimeMs: Math.min(requestedBudget.maxRuntimeMs, parentBudget.maxRuntimeMs)
  };
  const name = normalizeName(input.name || `${role.id}-sub-agent`);
  const id = uniqueId(name);
  const subAgent = {
    schema: SUB_AGENT_SCHEMA,
    id,
    name,
    parentRunId: text(input.parentRunId || input.runId || "", 120),
    orchestrationPlanId: text(input.orchestrationPlanId || input.planId || "", 120),
    role,
    prompt,
    selectedFiles: normalizePathList(input.selectedFiles || input.files),
    budget: isolatedBudget,
    budgetIsolation: {
      parentBudget,
      requestedBudget,
      remainingBudget: isolatedBudget,
      rule: "Child budgets are capped by the parent and tracked separately from the parent run."
    },
    status: "spawned",
    handoffProtocol: normalizeList(input.handoffProtocol, [
      "Return a concise evidence summary.",
      "List files read and diffs proposed.",
      "Do not write directly to parent state; hand back a receipt-ready summary."
    ], 8),
    createdAt: new Date().toISOString()
  };
  const paths = advancedAgentPaths(workspaceRoot, env);
  const artifactPath = path.join(paths.subAgentsDir, `${id}.json`);
  await writeArtifact(artifactPath, subAgent);
  return upsertAdvancedRecord(workspaceRoot, "subAgents", addArtifactPaths(workspaceRoot, subAgent, artifactPath), env);
}

async function diffReplayRuns(workspaceRoot, input = {}, env = process.env, readWorkspaceFileFn = null) {
  await ensureAdvancedAgent(workspaceRoot, env);
  const before = await resolveReplayValue(input, "before", readWorkspaceFileFn);
  const after = await resolveReplayValue(input, "after", readWorkspaceFileFn);
  const canonicalBefore = canonicalReplay(before);
  const canonicalAfter = canonicalReplay(after);
  const beforeText = stableStringify(canonicalBefore);
  const afterText = stableStringify(canonicalAfter);
  const diff = lineDiff(beforeText, afterText);
  const name = normalizeName(input.name || "replay-diff");
  const replayDiff = {
    schema: REPLAY_DIFF_SCHEMA,
    id: uniqueId(name),
    name,
    beforePath: input.beforePath ? normalizeWorkspacePath(input.beforePath) : "",
    afterPath: input.afterPath ? normalizeWorkspacePath(input.afterPath) : "",
    changed: beforeText !== afterText,
    summary: summarizeDiff(diff),
    hashes: {
      before: sha256(beforeText),
      after: sha256(afterText)
    },
    diff,
    createdAt: new Date().toISOString()
  };
  const paths = advancedAgentPaths(workspaceRoot, env);
  const artifactPath = path.join(paths.replayDiffsDir, `${replayDiff.id}.json`);
  await writeArtifact(artifactPath, replayDiff);
  return upsertAdvancedRecord(workspaceRoot, "replayDiffs", addArtifactPaths(workspaceRoot, replayDiff, artifactPath), env);
}

async function readJournal(workspaceRoot, id, env) {
  const journalId = text(id, 160);
  if (!journalId) {
    throw new Error("journalId is required.");
  }
  const filePath = journalPath(workspaceRoot, journalId, env);
  const data = JSON.parse(await fsp.readFile(filePath, "utf8"));
  if (data.schema !== JOURNAL_SCHEMA) {
    throw new Error("Task journal schema is invalid.");
  }
  data.steps = Array.isArray(data.steps) ? data.steps : [];
  data.checkpoints = Array.isArray(data.checkpoints) ? data.checkpoints : [];
  return data;
}

async function upsertAdvancedRecord(workspaceRoot, key, record, env) {
  const index = await readAdvancedAgentIndex(workspaceRoot, env);
  const id = record.id || uniqueId(key);
  index[key] = (index[key] || []).filter((item) => item.id !== id);
  index[key].push({ ...record, id });
  await writeAdvancedAgentIndex(workspaceRoot, index, env);
  return { ...record, id };
}

function normalizeIndex(data) {
  return {
    schema: INDEX_SCHEMA,
    updatedAt: data.updatedAt || new Date().toISOString(),
    plans: sortRecent(data.plans),
    schedules: sortRecent(data.schedules),
    journals: sortRecent(data.journals),
    subAgents: sortRecent(data.subAgents),
    replayDiffs: sortRecent(data.replayDiffs)
  };
}

function sortRecent(values) {
  return (Array.isArray(values) ? values : [])
    .filter((item) => item && typeof item === "object")
    .sort((a, b) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")));
}

function normalizeRoles(values) {
  const source = Array.isArray(values) && values.length ? values : DEFAULT_ROLES;
  const seen = new Set();
  return source.slice(0, 8).map((role, index) => {
    const raw = typeof role === "string" ? { id: role } : (role && typeof role === "object" ? role : {});
    const id = uniqueRoleId(raw.id || raw.name || `role-${index + 1}`, seen);
    return {
      id,
      title: text(raw.title || raw.name || humanizeId(id), 80),
      goal: text(raw.goal || raw.description || DEFAULT_ROLES[index]?.goal || "Complete the assigned handoff.", 260),
      allowedTools: normalizeList(raw.allowedTools || raw.tools, DEFAULT_ROLES[index]?.allowedTools || ["search_workspace", "read_file"], 10),
      permissions: normalizePermissions(raw.permissions || DEFAULT_ROLES[index]?.permissions || {}),
      budget: normalizeBudget(raw.budget || DEFAULT_ROLES[index]?.budget || {}, {
        maxSteps: 2,
        maxToolCalls: 4,
        maxTokens: 2500,
        maxRuntimeMs: 10 * 60 * 1000
      }),
      receives: normalizeList(raw.receives, [], 8),
      produces: normalizeList(raw.produces, DEFAULT_ROLES[index]?.produces || ["handoff"], 8)
    };
  });
}

function normalizeHandoffs(values, roles) {
  if (Array.isArray(values) && values.length) {
    return values.slice(0, 12).map((handoff, index) => {
      const raw = handoff && typeof handoff === "object" ? handoff : {};
      return {
        id: normalizeId(raw.id || `handoff-${index + 1}`),
        from: normalizeId(raw.from || roles[index % roles.length]?.id || "planner"),
        to: normalizeId(raw.to || roles[Math.min(index + 1, roles.length - 1)]?.id || "reviewer"),
        requires: normalizeList(raw.requires, ["summary", "artifacts", "openQuestions"], 8),
        approvalRequired: raw.approvalRequired !== false,
        notes: text(raw.notes || "", 240)
      };
    });
  }
  return roles.slice(0, -1).map((role, index) => {
    const next = roles[index + 1];
    return {
      id: `${role.id}-to-${next.id}`,
      from: role.id,
      to: next.id,
      requires: ["summary", "files-read", "risks"],
      approvalRequired: next.permissions.write === true || next.permissions.write === "preview-only",
      notes: `${role.title} hands off a receipt-ready summary to ${next.title}.`
    };
  });
}

function normalizeBudget(value, defaults) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    maxSteps: clampInt(raw.maxSteps, 1, 100, defaults.maxSteps),
    maxToolCalls: clampInt(raw.maxToolCalls, 0, 500, defaults.maxToolCalls),
    maxTokens: clampInt(raw.maxTokens, 256, 500000, defaults.maxTokens),
    maxRuntimeMs: clampInt(raw.maxRuntimeMs, 1000, 24 * 60 * 60 * 1000, defaults.maxRuntimeMs)
  };
}

function normalizePermissions(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    read: raw.read !== false,
    write: raw.write === true ? true : raw.write === "preview-only" ? "preview-only" : false,
    network: raw.network === true
  };
}

function normalizePathList(values) {
  return (Array.isArray(values) ? values : String(values || "").split(/[,\n]/))
    .map(normalizeWorkspacePath)
    .filter(Boolean)
    .slice(0, 48);
}

function normalizeList(values, fallback = [], max = 10) {
  const source = Array.isArray(values) ? values : String(values || "").split(/[,\n]/);
  const normalized = source.map((item) => text(item, 180)).filter(Boolean).slice(0, max);
  return normalized.length ? normalized : fallback.slice(0, max).map((item) => text(item, 180)).filter(Boolean);
}

function normalizeWorkspacePath(value) {
  const clean = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = [];
  for (const part of clean.split("/")) {
    if (!part || part === "." || part === "..") {
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function normalizeName(value) {
  return text(value || "agenttrail-item", 120) || "agenttrail-item";
}

function normalizeId(value) {
  return slug(value || "item");
}

function uniqueRoleId(value, seen) {
  const base = normalizeId(value || "role");
  let id = base;
  let counter = 2;
  while (seen.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  seen.add(id);
  return id;
}

function normalizeStepStatus(value) {
  const status = String(value || "completed").toLowerCase();
  return ["queued", "running", "completed", "failed", "skipped", "blocked"].includes(status) ? status : "completed";
}

function normalizeJournalStatus(value) {
  const status = String(value || "active").toLowerCase();
  return ["active", "paused", "resumable", "completed", "failed", "blocked"].includes(status) ? status : "active";
}

function normalizeIsoTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function titleFromPrompt(prompt) {
  const words = String(prompt || "")
    .replace(/[`*_#>[\]{}()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
  return words || "";
}

function addArtifactPaths(workspaceRoot, record, artifactPath) {
  return {
    ...record,
    artifactPath,
    relativeArtifactPath: path.relative(path.resolve(workspaceRoot), artifactPath)
  };
}

function summarizeJournal(workspaceRoot, journal, artifactPath) {
  return addArtifactPaths(workspaceRoot, {
    schema: journal.schema,
    id: journal.id,
    name: journal.name,
    prompt: journal.prompt,
    model: journal.model,
    selectedFiles: journal.selectedFiles,
    status: journal.status,
    stepCount: journal.steps.length,
    latestStep: journal.steps[journal.steps.length - 1] || null,
    createdAt: journal.createdAt,
    updatedAt: journal.updatedAt
  }, artifactPath);
}

function journalPath(workspaceRoot, id, env) {
  return path.join(advancedAgentPaths(workspaceRoot, env).journalsDir, `${normalizeId(id)}.json`);
}

function compactJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value || {};
  }
  const output = {};
  for (const key of Object.keys(value).slice(0, 50)) {
    const current = value[key];
    output[text(key, 80)] = typeof current === "string" ? text(current, 1000) : current;
  }
  return output;
}

async function writeArtifact(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readArtifactRecords(workspaceRoot, dir, schema, mapRecord) {
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const artifactPath = path.join(dir, entry.name);
    try {
      const record = JSON.parse(await fsp.readFile(artifactPath, "utf8"));
      if (record.schema === schema) {
        records.push(mapRecord(record, artifactPath, workspaceRoot));
      }
    } catch {
      // Ignore corrupt artifacts; the source JSON can be inspected manually.
    }
  }
  return records;
}

async function resolveReplayValue(input, key, readWorkspaceFileFn) {
  if (Object.prototype.hasOwnProperty.call(input, key)) {
    return parseReplayValue(input[key]);
  }
  const pathKey = `${key}Path`;
  if (!input[pathKey]) {
    return {};
  }
  if (typeof readWorkspaceFileFn !== "function") {
    throw new Error(`${pathKey} requires a workspace file reader.`);
  }
  const file = await readWorkspaceFileFn(normalizeWorkspacePath(input[pathKey]));
  return parseReplayValue(file.content);
}

function parseReplayValue(value) {
  if (typeof value !== "string") {
    return value;
  }
  const textValue = value.trim();
  if (!textValue) return "";
  try {
    return JSON.parse(textValue);
  } catch {
    return textValue;
  }
}

function canonicalReplay(value, key = "") {
  if (VOLATILE_KEYS.has(key) || /(?:^|_)(timestamp|duration|latency|elapsed)(?:$|_)/i.test(key)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalReplay(item)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const currentKey of Object.keys(value).sort()) {
      const current = canonicalReplay(value[currentKey], currentKey);
      if (current !== undefined) {
        output[currentKey] = current;
      }
    }
    return output;
  }
  return value;
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function lineDiff(beforeText, afterText) {
  const before = beforeText.split(/\n/);
  const after = afterText.split(/\n/);
  const ops = diffOps(before, after);
  const rows = ["--- before", "+++ after"];
  for (const op of ops) {
    if (op.type === "same") rows.push(` ${op.value}`);
    if (op.type === "remove") rows.push(`-${op.value}`);
    if (op.type === "add") rows.push(`+${op.value}`);
  }
  return rows.join("\n");
}

function diffOps(before, after) {
  const rows = before.length + 1;
  const cols = after.length + 1;
  const table = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      ops.push({ type: "same", value: before[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ type: "remove", value: before[i] });
      i += 1;
    } else {
      ops.push({ type: "add", value: after[j] });
      j += 1;
    }
  }
  while (i < before.length) {
    ops.push({ type: "remove", value: before[i] });
    i += 1;
  }
  while (j < after.length) {
    ops.push({ type: "add", value: after[j] });
    j += 1;
  }
  return ops;
}

function summarizeDiff(diff) {
  const lines = String(diff || "").split(/\n/);
  const additions = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const deletions = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
  return {
    additions,
    deletions,
    unchanged: lines.filter((line) => line.startsWith(" ")).length,
    changed: additions + deletions > 0
  };
}

function uniqueId(value) {
  return `${slug(value)}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function slug(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "item";
}

function humanizeId(value) {
  return String(value || "Role")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function text(value, max) {
  const output = String(value || "").trim();
  return output.length <= max ? output : output.slice(0, max);
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

module.exports = {
  INDEX_SCHEMA,
  PLAN_SCHEMA,
  SCHEDULE_SCHEMA,
  JOURNAL_SCHEMA,
  SUB_AGENT_SCHEMA,
  REPLAY_DIFF_SCHEMA,
  advancedAgentPaths,
  ensureAdvancedAgent,
  readAdvancedAgentIndex,
  rebuildAdvancedAgentIndex,
  advancedAgentStatus,
  createOrchestrationPlan,
  scheduleAgentRun,
  createTaskJournal,
  appendJournalStep,
  resumeTaskJournal,
  spawnSubAgent,
  diffReplayRuns,
  canonicalReplay
};
