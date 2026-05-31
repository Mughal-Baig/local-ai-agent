# Governance

AgentTrail governance is intentionally small: keep the project local-first, auditable, and easy to contribute to.

## Maintainer Principles

- Local-first behavior is a product promise, not a marketing slogan.
- File writes must stay preview-first and receipt-backed.
- New integrations need explicit permission scopes.
- Recipes should be useful, narrow, and reviewable.
- Benchmarks must be reproducible and include limitations.
- Community submissions must not add fake usage claims, fake stars, or private user data.

## Decision Process

Small changes can merge when they pass tests and match project direction. Larger changes need an issue or discussion first when they affect:

- model backends
- file write behavior
- permission scopes
- data storage formats
- public APIs
- release packaging
- security posture

## Review Expectations

Maintainers review for safety, local-first behavior, clarity, and tests. A contribution can be declined if it expands scope faster than the project can keep reliable.

## Security And Privacy

Security reports should follow `SECURITY.md`. Do not post secrets, private receipts, or private workspace paths in public issues. When a report needs proof, redact first and include only the smallest reproduction.

## Community Conduct

The project follows `CODE_OF_CONDUCT.md`. Be direct, evidence-based, and generous with first-time contributors.
