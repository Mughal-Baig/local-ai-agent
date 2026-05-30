# v0.3.0 - AgentTrail Upgrade

This release sharpens the project around the auditable local-agent niche.

## Added

- AgentTrail branding across the app, demo, and README.
- Local workspace search API and `search_workspace` agent tool.
- Search UI for files, notes, and saved receipts.
- `preview_write_file` agent tool for diff-safe file proposals.
- Write preview mode, enabled by default, so write attempts return a diff instead of changing files.
- `/api/files/preview` endpoint for direct diff previews.
- Five new high-value recipes:
  - Diff-Safe Coder
  - Local RAG Brief
  - Receipt Auditor
  - MCP Readiness Review
  - GitHub Star Teardown
- Top 1 Percent Playbook for focused project positioning.

## Improved

- README now leads with search, diff previews, receipts, and the live demo.
- Demo page now shows the trust loop: search, preview, receipt.
- Security docs now document search boundaries and write preview behavior.
- Roadmap now separates shipped differentiators from next star drivers.
- UI palette now uses a calmer neutral system instead of a beige-heavy theme.

## Verified

- `node --check server.js`
- `node --check public/app.js`
- `node scripts/smoke-test.js`
