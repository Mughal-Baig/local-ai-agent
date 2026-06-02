# Eval Quality

Epic AL adds a deeper local-agent evaluation layer. It is offline-friendly by default so CI can verify the agent contract without a running Ollama model.

## Commands

```bash
npm run eval:agent
npm run bench:models
npm run test:eval-quality
```

## What It Measures

- **Golden task harness**: seven agent tasks cover search-before-answer, diff-safe writes, citations, unsupported launch claims, prompt-injection handling, project memory, reports, and MCP approvals.
- **Citation faithfulness**: every answer claim must map to cited local evidence such as `[E1]`; weak or missing evidence lowers the score.
- **Unsupported-claim detection**: risky claims such as signed binaries, perfect prompt-injection defense, hidden uploads, or silent edits are flagged.
- **Regression gate**: `npm run eval:agent` writes `docs/quality/agent-eval-report.json` and updates `docs/quality/agent-eval-trend.json`; CI fails if score drops below the configured floor or regresses too far.
- **A/B model compare**: `compareModels` scores two or more model profiles on the same task set and reports a winner with category scores.
- **Tool-use correctness**: required tools and arguments are checked, including search queries, file reads, and diff-preview calls.
- **Latency + tokens/sec benchmark**: `npm run bench:models` writes `docs/quality/agent-model-benchmark.json` with deterministic per-task latency and tokens/sec estimates.

## API

- `GET /api/evals/agent-quality`
- `GET /api/evals/agent-quality/history`
- `POST /api/evals/agent-quality/compare`
- `GET /api/benchmarks/models?models=agenttrail-audit,agenttrail-fast`

The API saves eval artifacts under `workspace/evals/` so the quality proof is inspectable like other AgentTrail receipts.

## CI Policy

The main CI workflow runs:

```bash
node scripts/eval-agent-tasks.js
node scripts/benchmark-agent-models.js
node tests/integration/eval-quality.test.js
```

Environment knobs:

- `AGENTTRAIL_AGENT_EVAL_MIN_SCORE`: default `85`
- `AGENTTRAIL_AGENT_EVAL_MAX_DROP`: default `5`
- `AGENTTRAIL_EVAL_MODELS`: comma-separated model names for the A/B comparison
- `AGENTTRAIL_BENCHMARK_MODELS`: comma-separated model names for the benchmark report
