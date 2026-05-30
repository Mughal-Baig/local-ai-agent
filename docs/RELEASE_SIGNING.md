# Release Checksums And Signing

AgentTrail v0.6 adds checksum generation for release-critical files.

Generate checksums:

```bash
npm run release:checksums
```

The server also exposes:

```text
POST /api/releases/checksums
```

This writes `docs/checksums/SHA256SUMS_v<version>.txt`.

## Next Signing Step

For a fully signed desktop release, use platform signing:

- macOS: Developer ID and notarization
- Windows: Authenticode certificate
- Linux: signed checksums and package repository metadata

Checksums are not a replacement for code signing, but they are the first trust artifact users can verify.
