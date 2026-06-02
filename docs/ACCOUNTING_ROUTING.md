# Accounting and routing

Epic AM adds a local cost/usage and smart-routing layer. It does not send usage analytics anywhere; records stay in the workspace JSONL store.

## What It Tracks

- Per-chat input tokens, output tokens, total tokens, duration, time-to-first-token, tokens/sec, model, task type, recipe, selected file count, and tool count.
- Usage dashboard totals grouped by model, recipe, task type, and day.
- Budget checks for input, output, and run duration.
- Routing decisions for manual, automatic, recipe-default, and speculative draft-then-verify runs.

## API

- `GET /api/accounting/usage` returns `agenttrail.usage-dashboard.v1`.
- `GET /api/accounting/routing?prompt=...&model=__auto__` previews a route.
- `POST /api/accounting/routing` previews a route from messages, selected files, recipe, budget, and routing options.
- `/api/chat` emits `routing`, `budget`, `verification`, and `accounting` SSE events.

## Budget profiles

- `tight`: small local runs with strict hard stops.
- `standard`: default balanced limits.
- `deep`: larger context and longer local runs.

Environment overrides are supported through `AGENTTRAIL_INPUT_SOFT_TOKENS`, `AGENTTRAIL_INPUT_HARD_TOKENS`, `AGENTTRAIL_OUTPUT_SOFT_TOKENS`, `AGENTTRAIL_OUTPUT_HARD_TOKENS`, `AGENTTRAIL_DURATION_SOFT_MS`, and `AGENTTRAIL_DURATION_HARD_MS`.

## Routing modes

- `Auto`: choose the installed model that best matches code, chat, planning, security, vision, or long-context work.
- `Manual`: use the selected model.
- `Verify`: draft with the cheapest installed model and verify with the strongest model for the task.

Automatic routing is local and explainable: the route preview returns the task type, candidate models, selected strategy, and why the model was chosen.

Recipes can declare `defaultModel`; AgentTrail uses it only when that model is installed.
