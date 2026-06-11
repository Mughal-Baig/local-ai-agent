# AgentTrail macOS App

Build a local app bundle:

```bash
npm run package:mac-app
```

The generated app lives at:

```text
dist/mac/AgentTrail.app
```

Double-clicking the app starts the embedded AgentTrail server, opens `http://127.0.0.1:4173`, and writes logs to:

```text
~/Library/Logs/AgentTrail/agenttrail.log
```

Requirements:

- Node.js installed on the Mac
- Ollama running for local models

## Native Menu-Bar Mode

When `swiftc` is available on macOS, `npm run package:mac-app` compiles `desktop/mac/AgentTrailMenuBar.swift` into the bundle. The app runs as a menu-bar utility with:

- Open AgentTrail
- Check For Updates
- Restart Server
- Show Logs
- Quit

If the build host cannot compile Swift, the bundle falls back to the shell launcher and still starts the local server.

## Updates, Signing, And Notifications

- Update channel metadata lives in `updates/latest.json` and is exposed through `/api/updates/check`.
- Long desktop runs and model pulls can trigger native notifications through `AGENTTRAIL_DESKTOP_NOTIFICATIONS=on`.
- Public distribution still needs Apple Developer ID signing and notarization. Use `npm run sign:mac-app -- --dry-run` to inspect the exact `codesign`, `notarytool`, and `stapler` commands before using credentials.

## Public Download Path

After a signed release is published, the public path should be:

```text
https://github.com/Mughal-Baig/local-ai-agent/releases/latest/download/AgentTrail-macOS.dmg
```

Verify before opening:

```bash
curl -L -O https://github.com/Mughal-Baig/local-ai-agent/releases/latest/download/AgentTrail-macOS.dmg
curl -L -O https://github.com/Mughal-Baig/local-ai-agent/releases/latest/download/SHA256SUMS_v0.7.0.txt
shasum -a 256 AgentTrail-macOS.dmg
grep AgentTrail-macOS.dmg SHA256SUMS_v0.7.0.txt
```

Gatekeeper notes:

- Public users should prefer signed and notarized builds.
- If macOS blocks an unsigned local build, verify checksums and only bypass Gatekeeper for your own development build.
- Run `agenttrail doctor` after first launch if the app opens but the model backend is missing.
