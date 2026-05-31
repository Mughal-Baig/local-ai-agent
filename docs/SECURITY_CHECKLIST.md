# Security Checklist

Use this before making a release public.

- [ ] Repository has no `.env` files committed.
- [ ] Workspace private files are not committed.
- [ ] Ollama is documented as localhost-only.
- [ ] File tools cannot escape `WORKSPACE_ROOT`.
- [ ] Workspace search cannot escape `WORKSPACE_ROOT`.
- [ ] Semantic-lite search stays local and does not call external embedding APIs.
- [ ] Writes are off by default.
- [ ] Write preview mode is on by default.
- [ ] Previewed writes require an explicit Apply action.
- [ ] Security hardening mode is enabled by default.
- [ ] Secret redaction is on for model context, receipts, sessions, reports, logs, and permission audits.
- [ ] Network egress paths have explicit allowlists (`allowlist`, `AGENTTRAIL_EGRESS_ALLOWLIST`, or service-specific allowlist).
- [ ] Optional encrypted-at-rest mode was tested if receipts/reports are shared or backed up.
- [ ] Per-tool permission policies and `permission-audit` events are present for allow/deny decisions.
- [ ] Threat-model tests cover path escape, secret exfiltration, prompt injection, egress denial, and encrypted receipt readback.
- [ ] Generated reports, memory, and receipts stay inside the workspace.
- [ ] Tool activity is visible in Agent Trail.
- [ ] Receipts can be exported and saved.
- [ ] Recipe files are prompt templates only.
- [ ] CI passes.
- [ ] README does not overclaim capabilities.
