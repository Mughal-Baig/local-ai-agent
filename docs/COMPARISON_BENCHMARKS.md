# Comparison Benchmarks

AgentTrail should compare itself honestly. This page is for reproducible checks, not marketing claims.

## Positioning

AgentTrail does not try to replace broad local AI platforms. It focuses on a smaller wedge:

- auditable local agent runs
- diff-safe writes
- visible receipts
- recipe packs
- readable implementation

## Benchmark Rules

- Use public commands and fixtures.
- Include hardware, OS, Node version, backend, and model when measuring runtime behavior.
- Separate product capability checks from speed checks.
- Record limitations beside every result.
- Never imply another project is weak because it optimizes for a different use case.

## Current Comparison Matrix

| Capability | AgentTrail | Broad local AI UI | Raw model runner |
| --- | --- | --- | --- |
| Local model support | Ollama, bundled seam, OpenAI-compatible | Usually broad | Core purpose |
| Diff-safe writes | First-class | Varies | Not a UI feature |
| Receipts and replay | First-class | Varies | Not a UI feature |
| Recipe marketplace | Lightweight JSON packs | Varies | Not a UI feature |
| Plugin permissions | Explicit manifest | Varies | Not a UI feature |
| One-command start | `npx agenttrail` path | Varies | Usually install-focused |
| Best fit | Auditable project assistant | General local AI workspace | Model serving |

## Reproducible Fixtures

The data file `docs/benchmarks/comparison.json` tracks scenarios and metrics. Add new entries only when the setup is specific enough for another maintainer to rerun.

## Known Limits

- AgentTrail is not the fastest model runner.
- AgentTrail is not a full team collaboration suite.
- Desktop packaging is scaffolded but still needs signed public releases.
- Benchmark data is small until more community fixtures are added.
