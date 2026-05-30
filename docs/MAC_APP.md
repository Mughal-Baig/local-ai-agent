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

This app bundle is unsigned. Public distribution still needs Apple Developer ID signing and notarization.
