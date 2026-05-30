# Contributing

Thanks for helping improve Local AI Agent.

## Good First Contributions

- Add a recipe in `recipes/`.
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
```

## Pull Request Checklist

- Keep the no-dependency default unless a dependency is clearly worth it.
- Keep workspace file access sandboxed.
- Show user-visible receipts for agent actions.
- Keep recipes honest, specific, and useful without cloud services.
- Update docs when behavior changes.
- Run the smoke test.
