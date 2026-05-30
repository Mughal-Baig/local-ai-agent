# Security Policy

AgentTrail is designed to keep file access inside the configured workspace.

## Current Safety Boundaries

- The server binds to `127.0.0.1`.
- File tools resolve paths against `WORKSPACE_ROOT`.
- Attempts to escape the workspace are rejected.
- `.env` and private workspace folders are ignored by git.
- Agent Trail receipts make local tool activity visible to the user.
- File writes are disabled by default in the chat agent.
- Write preview mode is enabled by default, so agent write attempts return a diff preview before changing files.
- Previewed changes require an explicit browser **Apply** action before the app writes the proposed content.
- Local search only reads files inside `WORKSPACE_ROOT`.
- Semantic-lite search is local and uses in-process token vectors, not remote embedding APIs.
- Security hardening mode flags suspicious prompt-injection and workspace-escape language in the Agent Trail.
- Shareable reports, memory, and receipts are written inside the configured workspace only.
- Recipes are prompt templates only; they do not grant new tool permissions.

## Reporting A Vulnerability

Please open a private security advisory or contact the repository owner. Include:

- What happened
- Steps to reproduce
- Expected behavior
- Affected commit or version

Do not publish exploit details before the issue has been reviewed.
