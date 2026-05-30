# v0.3.1 - Visible Diff Apply Flow

This release closes the biggest trust gap in v0.3.0: diff previews are now visible and actionable inside the chat.

## Added

- In-chat diff preview cards for agent-proposed file changes.
- Explicit **Apply** button for previewed changes.
- SSE preview payloads with path, stats, diff text, and proposed content.
- Compact prompt history for preview results so large proposed content does not bloat the agent loop.

## Improved

- README now explains the review-and-apply write flow.
- Frontend cache version bumped for the new diff UI.

## Verified

- `node --check server.js`
- `node --check public/app.js`
- `npm test`
