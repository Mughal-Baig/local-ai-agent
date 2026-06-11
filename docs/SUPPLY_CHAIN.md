# Supply Chain

AgentTrail release hardening covers six public distribution surfaces: Multi-arch Docker, Homebrew, npm provenance, SBOM, signed checksums, and reproducible package checks.

## Multi-arch Docker

The root [Dockerfile](../Dockerfile) is BuildKit-ready and uses OCI labels, a non-root `agenttrail` user, `/data/workspace` as the mounted workspace, and `TARGETPLATFORM`/`BUILDPLATFORM` support.

Tag builds publish to GHCR for both common Linux architectures:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/Mughal-Baig/agenttrail:v0.7.0 .
```

GitHub workflow: `.github/workflows/container.yml`.

Safe local quick start with persisted workspace data:

```bash
mkdir -p agenttrail-workspace
docker run --rm -p 4173:4173 \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  -v "$PWD/agenttrail-workspace:/data/workspace" \
  ghcr.io/mughal-baig/agenttrail:latest
```

## Homebrew

The formula points to the npm release tarball uploaded with the GitHub release:

```bash
npm run release:homebrew
```

That command packs the current npm artifact, computes its SHA-256, and updates [Formula/agenttrail.rb](../Formula/agenttrail.rb). The formula installs both `agenttrail` and `agenttrail-chat` and includes a launch service.

After the tap is published:

```bash
brew tap Mughal-Baig/local-ai-agent
brew install agenttrail
agenttrail doctor
```

## npm Provenance

The npm workflow runs tests, SBOM generation, reproducibility checks, and then publishes with provenance:

```bash
npm publish --provenance --access public
```

GitHub workflow: `.github/workflows/npm-publish.yml`. Required secret: `NPM_TOKEN`.

## SBOM

Generate the SPDX 2.3 SBOM:

```bash
npm run release:sbom
```

Output: `docs/sbom/agenttrail-v0.7.0.spdx.json`.

The SBOM excludes generated checksum/SBOM files so it stays stable across release regeneration.

## Signed Checksums

Generate and verify release-critical checksums:

```bash
npm run release:checksums
npm run release:verify-checksums
```

Sign the checksum file with a PEM private key:

```bash
AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY="$(cat private-key.pem)" npm run release:sign-checksums
```

Dry-run the signing plan without secrets:

```bash
npm run release:sign-checksums -- --dry-run
```

Required release secret: `AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY`.

## Reproducible Builds

Run the reproducibility check:

```bash
npm run release:reproducible
```

The script runs `npm pack` twice with `SOURCE_DATE_EPOCH`, compares SHA-256 and size, and writes a report under `dist/reproducible/`.
