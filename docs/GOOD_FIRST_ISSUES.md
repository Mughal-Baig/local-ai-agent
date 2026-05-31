# Good First Issues

This backlog keeps community work small enough for a first pull request. It is mirrored in `docs/community/good-first-issues.json` so maintainers can copy tasks into GitHub issues without inventing scope every time.

## Label Set

Use `.github/labels.yml` as the source of truth for community labels:

- `good first issue`
- `help wanted`
- `recipe`
- `docs`
- `showcase`
- `benchmark`
- `plugin`
- `security`
- `needs receipt`

## Opening Issues

For each new issue, include:

- The user problem.
- Why the contribution matters.
- Exact files likely to change.
- Acceptance criteria.
- The command to verify the change.

## Seed Backlog

| Title | Area | Verify |
| --- | --- | --- |
| Add a researcher recipe pack | recipes | `npm run test:community` |
| Add a showcase entry for a real receipt workflow | showcase | `npm run test:community` |
| Add one honest comparison benchmark fixture | benchmarks | `npm run test:community` |
| Create a plugin example for a safe read-only tool | plugins | `npm run test:community` |
| Improve the launch response FAQ | docs | `npm run test:docs` |
| Add a recipe marketplace curation example | marketplace | `npm run test:community` |
| Add Windows or Linux screenshot notes | docs | `npm run test:docs` |
| Add a maintainer recipe for issue triage | recipes | `npm run test:community` |

## Maintainer Rule

Do not open vague issues like "improve docs" or "add more recipes." A good first issue should be finishable in one small pull request and reviewable without knowing the whole system.
