# Advanced Agent Layer

Epic AD adds the local advanced-agent layer. It is intentionally manifest-backed: AgentTrail records plans, schedules, journals, sub-agent budgets, and replay diffs as local JSON artifacts under `workspace/.agenttrail/advanced-agent/`. It does not run hidden cloud workers or silently edit files.

## What It Covers

| Task | API | Artifact |
| --- | --- | --- |
| Multi-agent orchestration | `POST /api/advanced-agent/orchestrate` | `agenttrail.multi-agent-plan.v1` |
| Background/scheduled runs | `POST /api/advanced-agent/schedule` | `agenttrail.scheduled-run.v1` |
| Long-running task journal + resume | `POST /api/advanced-agent/journal`, `/journal/append`, `/journal/resume` | `agenttrail.task-journal.v1` |
| Sub-agent budget isolation | `POST /api/advanced-agent/sub-agent` | `agenttrail.sub-agent.v1` |
| Deterministic replay diffing | `POST /api/advanced-agent/replay-diff` | `agenttrail.replay-diff.v1` |

Status lives at:

```bash
curl http://127.0.0.1:4173/api/advanced-agent
```

## Multi-Agent Orchestration

```bash
curl -X POST http://127.0.0.1:4173/api/advanced-agent/orchestrate \
  -H 'content-type: application/json' \
  -d '{
    "prompt": "Improve the README safely.",
    "selectedFiles": ["README.md"]
  }'
```

The default roles are planner, researcher, implementer, and reviewer. Each role has a scoped goal, allowed tools, permissions, and budget. Handoffs require summaries, files read, and risk notes so the next role receives reviewable context.

## Scheduled Runs

```bash
curl -X POST http://127.0.0.1:4173/api/advanced-agent/schedule \
  -H 'content-type: application/json' \
  -d '{
    "prompt": "Check stale receipts every morning.",
    "interval": "daily",
    "runNow": true
  }'
```

Schedules create local manifests. If `runNow` is true or the `runAt` timestamp is due, AgentTrail starts a local background job that creates a task journal checkpoint. The job records proof and returns control to the user for explicit review.

## Task Journals And Resume

```bash
curl -X POST http://127.0.0.1:4173/api/advanced-agent/journal \
  -H 'content-type: application/json' \
  -d '{ "prompt": "Continue the roadmap implementation." }'
```

Append checkpoints:

```bash
curl -X POST http://127.0.0.1:4173/api/advanced-agent/journal/append \
  -H 'content-type: application/json' \
  -d '{
    "journalId": "JOURNAL_ID",
    "type": "checkpoint",
    "summary": "Searched routes and added tests."
  }'
```

Resume:

```bash
curl -X POST http://127.0.0.1:4173/api/advanced-agent/journal/resume \
  -H 'content-type: application/json' \
  -d '{ "journalId": "JOURNAL_ID" }'
```

Resume returns a pending-run payload and, by default, saves it to `workspace/.agenttrail/pending-run.json` so the UI can continue deliberately.

## Sub-Agent Budget Isolation

```bash
curl -X POST http://127.0.0.1:4173/api/advanced-agent/sub-agent \
  -H 'content-type: application/json' \
  -d '{
    "parentRunId": "run-123",
    "role": "reviewer",
    "prompt": "Review this plan for path-safety issues.",
    "parentBudget": { "maxSteps": 3, "maxToolCalls": 6, "maxTokens": 3000 },
    "budget": { "maxSteps": 10, "maxToolCalls": 20, "maxTokens": 9000 }
  }'
```

The child budget is capped by the parent budget and tracked separately. Sub-agents hand back summaries and artifacts; they do not mutate parent run state directly.

## Replay Diffing

```bash
curl -X POST http://127.0.0.1:4173/api/advanced-agent/replay-diff \
  -H 'content-type: application/json' \
  -d '{
    "before": { "id": "run-a", "prompt": "same", "result": "alpha" },
    "after": { "id": "run-b", "prompt": "same", "result": "beta" }
  }'
```

Replay diffs canonicalize runs by removing volatile fields such as IDs, timestamps, durations, and latency. The output is a deterministic text diff plus stable hashes so repeated comparisons are auditable.

## Safety Model

- All state is local to the workspace.
- Scheduled work records a local job and journal rather than running invisible automation.
- Write-like roles default to preview-only.
- Sub-agent budgets are capped by parent budgets.
- Replay diffing strips volatile fields before comparison.
- Every API writes a manifest visible through `/api/advanced-agent`.
