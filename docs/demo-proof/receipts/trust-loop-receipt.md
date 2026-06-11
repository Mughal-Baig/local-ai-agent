# AgentTrail Demo Receipt

- Schema: `agenttrail.demo-receipt.v1`
- Generated: `2026-06-12T00:00:00.000Z`
- Model: `demo-local-model`
- Workspace: `docs/demo-proof/workspace`
- Trust Score: `100`

## Tool Steps

1. `search_workspace` found `workspace/notes/launch-note.md:3`.
2. `preview_diff` produced `docs/demo-proof/diff-preview.patch`.
3. `apply_diff` wrote only after explicit Apply.
4. `save_receipt` captured this replayable receipt.
5. `export_report` wrote `docs/demo-proof/reports/trust-loop-report.html`.

## Replay

```bash
npm run demo:proof
```
