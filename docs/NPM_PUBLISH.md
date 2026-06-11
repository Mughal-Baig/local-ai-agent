# npm Publish Checklist

The package metadata is ready for:

```bash
npm publish --access public
```

Before publishing:

- Confirm ownership or availability of the `agenttrail` package name.
- Run `npm test`, `npm run test:unit`, `npm run test:supply-chain`, `npm run test:integration`, and `npm run eval`.
- Run `npm run release:sbom` and `npm run release:reproducible`.
- Confirm `npm whoami`.
- Use the GitHub npm publish workflow for provenance, or publish manually with `npm publish --provenance --access public`.

After publishing:

```bash
npx agenttrail
npx agenttrail doctor
npx agenttrail run llama3.2 "hello"
npx agenttrail list --json
```
