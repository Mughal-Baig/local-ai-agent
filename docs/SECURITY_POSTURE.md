# Security Posture

AgentTrail's audience is people who care about exactly what an AI does to their files. This page is an honest account of what AgentTrail protects, what it does not, and the assumptions behind "local-first." It is a posture statement, not a guarantee. For reporting issues, see [SECURITY.md](../SECURITY.md).

## Threat model in one paragraph

AgentTrail runs a local Node server that talks to a local Ollama instance and your browser. The main risks it is designed to contain are: (1) an LLM proposing destructive or out-of-scope file writes, (2) prompt-injection content in your own files trying to redirect the agent, and (3) accidental data exfiltration. It is **not** designed to defend a multi-user server, sandbox malicious code execution, or protect against an attacker who already controls your machine or your Ollama host.

## What AgentTrail does protect

- **Workspace boundary.** All file tools resolve and confine paths to `workspace/`. Reads and writes outside that folder are blocked. This is the primary containment.
- **Writes off by default.** `write_file` is disabled until you enable it; with preview mode on (the default), a write returns a diff instead of touching disk.
- **Explicit apply.** A proposed change becomes a reviewable diff. Nothing is written until you click Apply — and every applied write is preceded by a preview event in the receipt.
- **Local-only networking.** The server binds to `127.0.0.1` by default and only communicates with Ollama and your browser. It does not call out to third-party services.
- **Hardening scan.** An optional pass flags common prompt-injection and exfiltration patterns (instruction overrides, "send to http…", shell/network commands, destructive phrasing, workspace-escape language) in prompts and selected context.
- **Auditability.** Every tool call is logged to the Agent Trail and can be exported as a receipt, so after the fact you can see exactly what ran.

## What AgentTrail does NOT protect against

- **A compromised machine or Ollama host.** AgentTrail trusts the local Ollama endpoint and the local filesystem. If either is controlled by an attacker, AgentTrail offers no defense.
- **Multi-user / network exposure.** It is a single-user local tool. Binding it to `0.0.0.0` (e.g. in Docker) or exposing the port removes the local-only assumption — do not run it on an untrusted network without your own auth/proxy.
- **Arbitrary code execution safety.** AgentTrail edits files; it does not sandbox running the code it writes. Review and run generated code as you would any untrusted snippet.
- **Perfect prompt-injection defense.** The hardening scan is heuristic. It raises the cost of an attack and surfaces suspicious content; it is not a guarantee. The real backstop is that writes are gated behind your explicit Apply.
- **Secret hygiene in your own files.** If you select a file containing secrets as context, those contents go to your local model and may appear in receipts. Receipts are local, but treat them as you would any log.

## "Local-first" — what it means precisely

- Your prompts, files, and embeddings are processed by your local Ollama models. The server does not transmit them to any cloud service.
- Zero runtime npm dependencies means a small, readable supply chain you can audit yourself.
- "Local-first" guarantees the **data path**, not the **execution safety** of code the agent produces, and not the security of the host it runs on.

## Recommended safe defaults

1. Keep **preview mode on** and **direct writes off** unless you are actively applying changes.
2. Keep the server bound to `127.0.0.1`; add your own auth before exposing it.
3. Keep **hardening mode on**, and run a **security scan** before acting on untrusted file content.
4. Don't put credentials in `workspace/`; if you must, exclude those paths from context.
5. Review every diff before clicking Apply — that click is the real security boundary.

## Reporting

Found a path-escape, an unguarded write, or an exfiltration vector? Please report it via [SECURITY.md](../SECURITY.md). Honest, reproducible reports are very welcome.
