# Release Checksums, SBOM, And Signing

AgentTrail generates release-critical checksums, SPDX SBOMs, reproducible package reports, and optional checksum signatures.

Generate checksums:

```bash
npm run release:checksums
npm run release:verify-checksums
npm run release:sbom
npm run release:reproducible
```

The server also exposes:

```text
POST /api/releases/checksums
```

This writes `docs/checksums/SHA256SUMS_v<version>.txt`.

## Checksum Signing

Use a PEM private key to sign `SHA256SUMS_v<version>.txt`:

```bash
AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY="$(cat private-key.pem)" npm run release:sign-checksums
npm run release:sign-checksums -- --dry-run
```

The signing script writes:

- `docs/checksums/SHA256SUMS_v<version>.txt.sig`
- `docs/checksums/SHA256SUMS_v<version>.txt.sig.json`

## Platform Signing

For a fully signed desktop release, also use platform signing:

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
- `AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY`

See [SUPPLY_CHAIN.md](SUPPLY_CHAIN.md) for Docker, Homebrew, npm provenance, SBOM, checksum, and reproducible-build details.
