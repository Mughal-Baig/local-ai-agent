# AgentTrail Desktop Launchers

These launchers give non-developers a double-click path while the project stays zero-dependency.

## macOS

Double-click `desktop/mac/AgentTrail.command`.

For a real app bundle, run:

```bash
npm run package:mac-app
```

Then double-click `dist/mac/AgentTrail.app`.

## Windows

Double-click `desktop/windows/AgentTrail.cmd`.

## Linux

Copy `desktop/linux/agenttrail.desktop` into `~/.local/share/applications/`, then edit the `Exec` and `Path` values to this checkout.

## Packaged App Notes

The generated macOS app embeds the project, starts the local server, opens `http://127.0.0.1:4173`, and logs to `~/Library/Logs/AgentTrail/agenttrail.log`. Public distribution still needs Apple Developer ID signing and notarization.
