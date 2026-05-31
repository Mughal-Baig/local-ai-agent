# Top 1 Percent Playbook

AgentTrail should not try to beat Open WebUI, Dify, AnythingLLM, Jan, Aider, or OpenHands at platform breadth. The believable path is to own a smaller promise:

> the clearest auditable local-agent layer for people who want workspace search, diff previews, explicit approvals, receipts, replay, and reports they can inspect.

## What Must Be Obvious In 30 Seconds

- It runs locally with Ollama.
- It can also use OpenAI-compatible local model servers.
- It cannot read or write outside the workspace.
- It searches local files before answering.
- It previews writes as diffs before touching files.
- It saves receipts so users can audit what happened.
- It is still small enough to inspect, fork, and test.

## Current Moat

- Zero runtime npm dependencies in the core app.
- Plain JSON recipes.
- Keyword search plus local vector search across files, sessions, and receipts.
- Agent Trail receipts.
- Write preview mode with explicit Apply.
- Trust Score dashboard.
- Receipt timeline and shareable reports.
- Conversation export, redaction, recipe packs, profiles, model scoring, MCP, Dockerfile, and eval harness.
- GitHub Pages demo before install.

## Next Star Drivers

1. Record a real 20-second GIF using the search -> diff -> Apply -> receipt/report loop.
2. Make one-command install feel production-ready: `npx`, Docker persistence, Homebrew, setup doctor.
3. Finish persistent conversation UI: list, open, rename, pin, delete, search, import/export, branch.
4. Add guided first-run onboarding so a new user succeeds before using their own files.
5. Publish honest comparison proof against OpenHands, Cline, AnythingLLM, Open Interpreter, Aider, and Continue.
6. Turn prompt-injection, redaction, network policy, and path safety into visible demo proof.
7. Ship signed desktop releases after certificate setup.
8. Add user showcases built around safe, redacted receipts.

## Brutal Anti-Goals

- Do not market this as a full ChatGPT replacement yet.
- Do not add hidden cloud services.
- Do not bury the demo below long text.
- Do not add broad framework complexity before the trust story is polished.
- Do not chase every provider until the local-first workflow is excellent.
