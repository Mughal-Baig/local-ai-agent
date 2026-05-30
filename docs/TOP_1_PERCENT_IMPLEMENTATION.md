# Top 1 Percent Implementation Map

This table maps the requested top-1% feature list to the v0.4 implementation surface.

| Feature | v0.4 Surface |
| --- | --- |
| Visual Demo Proof | `docs/top1-demo.svg`, live demo copy, README hero visual |
| Semantic Local Search | `/api/search?mode=semantic`, semantic-lite token vectors, UI toggle |
| Receipt Timeline And Replay | receipt timeline UI, receipt selection, saved receipt snippets; replay remains next-step deepening |
| Diff Review Center | pending diff panel with apply/reject and apply-all controls |
| MCP Bridge With Explicit Approvals | `mcp/agenttrail.mcp.json` approval manifest and `/api/mcp` |
| Recipe Marketplace / Packs | `recipe-packs/*.json`, pack export UI, `/api/packs` |
| One-Command Install | `bin/agenttrail.js`, package `bin`, Dockerfile, `npm link` path |
| Model Capability Scoring | scored models in `/api/status` and UI bars |
| Agent Evaluation Harness | `npm run eval` and `/api/evals` |
| Project Memory | `/api/memory`, local memory UI, prompt context injection |
| Workspace Profiles | `profiles/*.json` and `/api/profiles` |
| Trust Score Dashboard | browser Trust Score dashboard and checklist |
| README Star Engine | 60-second quick start, comparison table, visual demo, top-1% surface list |
| Security Hardening Mode | UI toggle, prompt hardening instructions, suspicious prompt trail flags |
| Shareable Static Reports | `/api/reports`, Markdown/HTML report export to `workspace/reports/` |

## Remaining Deepening

- True embedding backends can replace semantic-lite search behind an optional dependency.
- Receipt replay should grow from receipt selection into a full rerun workflow.
- MCP manifest should become a real MCP server transport once the approval model is stable.
- Recipe pack import UI can follow the current export UI.
