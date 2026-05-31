# npm Publish Checklist

The package metadata is ready for:

```bash
npm publish --access public
```

Before publishing:

- Confirm ownership or availability of the `agenttrail` package name.
- Run `npm test`, `npm run test:unit`, `npm run test:integration`, and `npm run eval`.
- Confirm `npm whoami`.
- Prefer npm provenance once the GitHub release workflow is configured.

After publishing:

```bash
npx agenttrail
npx agenttrail run llama3.2 "hello"
npx agenttrail list --json
```
