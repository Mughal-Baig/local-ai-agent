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

- macOS: Developer ID and notarization via `npm run sign:mac-app`
- Windows: Authenticode certificate via `npm run sign:windows`
- Linux: signed checksums and package repository metadata for the deb/rpm/AppImage staging under `installers/linux`

Checksums are not a replacement for code signing, but they are the first trust artifact users can verify.

Dry-run commands:

```bash
npm run sign:mac-app -- --dry-run
npm run sign:windows -- --dry-run
```

Required signing secrets:

- `AGENTTRAIL_DEVELOPER_ID_APPLICATION`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `AGENTTRAIL_WINDOWS_CERT_THUMBPRINT`
