# v0.2.0

Local AI Agent is now a launch-ready local agent kit rather than only a chat UI.

## Added

- Static demo page and animated demo flow.
- First-run setup checklist.
- Read/write permission toggles.
- File writes disabled by default.
- Saved Markdown receipt history in `workspace/receipts/`.
- Recipe schema and 15 reusable recipes.
- Troubleshooting guide, model guide, and security checklist.
- `start.sh` and `start.command` launchers.

## Changed

- Agent prompts now include read/write permission state.
- Receipts are both downloaded and saved locally.
- README emphasizes demo-first evaluation, permissions, and recipe contribution.

## Validation

- `node --check server.js`
- `node --check public/app.js`
- `node scripts/smoke-test.js`
