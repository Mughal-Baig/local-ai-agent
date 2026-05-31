# Contributing

Thanks for helping improve AgentTrail. The best contributions make local agents more useful, more inspectable, or easier to trust.

## Good First Contributions

- Add a recipe in `recipes/`.
- Add or improve a role pack in `recipe-packs/`.
- Add a marketplace submission or curation note in `marketplace/recipes.json`.
- Add a showcase entry in `docs/showcase/gallery.json`.
- Add one reproducible comparison fixture in `docs/benchmarks/comparison.json`.
- Add a safe plugin manifest under `plugins/`.
- Improve recipe validation against `recipes/schema.json`.
- Add a small workspace tool with clear safety boundaries.
- Improve the prompt protocol for local models.
- Add tests for path handling and file operations.
- Improve accessibility, keyboard flow, or responsive layout.
- Add documentation for real local workflows.

## Development

Run the app:

```bash
node server.js
```

Run checks:

```bash
node --check server.js
node --check public/app.js
node scripts/smoke-test.js
npm run test:community
```

## Community Assets

- `docs/GOOD_FIRST_ISSUES.md` lists scoped starter issues.
- `.github/labels.yml` defines labels maintainers should keep in GitHub.
- `docs/RECIPE_MARKETPLACE.md` explains recipe pack curation.
- `docs/SHOWCASE.md` explains how to submit public workflow proof.
- `docs/PLUGIN_SDK.md` explains the plugin manifest contract.

## Governance

Project governance lives in `GOVERNANCE.md`. Large changes should start with an issue or discussion when they affect file-write behavior, permission scopes, storage formats, model backends, public APIs, release packaging, or security posture.

## Pull Request Checklist

- Keep the no-dependency default unless a dependency is clearly worth it.
- Keep workspace file access sandboxed.
- Show user-visible receipts for agent actions.
- Keep recipes honest, specific, and useful without cloud services.
- Update docs when behavior changes.
- Run the smoke test.
- Update `CHANGELOG.md` or release notes when the public surface changes.
