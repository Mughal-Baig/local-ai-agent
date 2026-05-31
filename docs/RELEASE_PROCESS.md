# Release Process

Release discipline matters because AgentTrail makes a trust claim. Every release should explain what changed, how it was verified, and what proof users can inspect.

## Version Checklist

1. Update `CHANGELOG.md`.
2. Add or update `docs/RELEASE_NOTES_vX.Y.Z.md`.
3. Run `npm run docs:build`.
4. Run `npm run test:community`.
5. Run `npm run eval`.
6. Run release artifact checks:

```bash
npm run release:homebrew
npm run release:sbom
npm run release:checksums
npm run release:verify-checksums
npm run release:reproducible
```

7. Attach the demo GIF, screenshots, checksums, and release notes.
8. Keep the release post honest: show the exact workflow and limitations.

## Release Notes Shape

Each release note should include:

- One-line user promise.
- What changed.
- How to verify.
- Known limits.
- Links to screenshots, demo, or docs.

## Changelog Rules

- `CHANGELOG.md` summarizes public changes by version.
- `docs/RELEASE_NOTES_v*.md` gives the detailed version-specific story.
- Do not list unreleased features as shipped.
- Do not claim performance wins without a benchmark entry.
- Do not claim security guarantees without the relevant test or docs link.

## Release Readiness Gate

A release is ready only when:

- CI is green.
- Quality Matrix is green.
- Docs site check passes.
- Community test passes.
- Checksums have no missing artifacts.
- The README still shows the demo and quick start above the fold.
