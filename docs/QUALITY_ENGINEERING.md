# Quality Engineering

Epic Z turns the existing smoke-heavy test setup into a visible quality system.

## Commands

```bash
npm run test:quality
npm run coverage
npm run bench:quality
npm run test:ui
npm run eval
```

## Coverage gate

`npm run coverage` uses V8 coverage through `NODE_V8_COVERAGE`, runs the focused quality/security/runtime/team suites, and fails below `COVERAGE_THRESHOLD` (default `60`). It reports per-file line coverage for the most risk-sensitive local-agent modules.

## UI E2E

`npm run test:ui` starts a real local AgentTrail server and validates the browser contract. If Playwright is installed, it drives Chromium through the app shell; otherwise it runs a dependency-free HTTP UI contract so CI stays zero-install.

## Fuzz tests

`npm run test:quality` includes property-style fuzzing for workspace path resolution and unified diff generation. The same `src/workspace-safety.js` helpers are used by the server and the tests.

## Performance regression

`npm run bench:quality` runs deterministic micro-benchmarks for chunking, ranking, ANN-index building, path safety, and diff generation. Budgets live in `docs/quality/performance-baseline.json` and can be tightened after collecting public CI history.

## Cross-platform matrix

`.github/workflows/quality-matrix.yml` runs the quality suite on macOS, Windows, and Linux across Node LTS/current lines. The main CI remains the full Ubuntu gate; the matrix catches platform-specific path and runtime regressions early.

## Eval scoreboard

`npm run eval` now prints a category scoreboard in addition to the total repo score. The scoreboard groups checks by foundation, agent reliability, search, runtime, distribution, security, observability, team, quality, and UX proof.
