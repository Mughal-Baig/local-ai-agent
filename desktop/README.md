# AgentTrail Desktop Launchers

These launchers give non-developers a double-click path while the project stays zero-dependency.
Desktop mode sets `AGENTTRAIL_DESKTOP=1`, enables native notifications, exposes update status at `/api/updates/check`, and shows desktop-specific first-run onboarding in the app.

## macOS

Double-click `desktop/mac/AgentTrail.command`.

For a real app bundle, run:

```bash
npm run package:mac-app
```

Then double-click `dist/mac/AgentTrail.app`.
On macOS with `swiftc` available, the bundle uses `desktop/mac/AgentTrailMenuBar.swift` to run as a native menu-bar app with Open, Check For Updates, Restart Server, Show Logs, and Quit actions. Other build hosts fall back to the shell launcher.

## Windows

Double-click `desktop/windows/AgentTrail.cmd`. It launches `desktop/windows/AgentTrail-Tray.ps1`, starts the server in the background, opens the browser, and leaves a tray icon with Open, Restart server, Show logs, and Quit actions.

## Linux

Copy `desktop/linux/agenttrail.desktop` into `~/.local/share/applications/`, then edit the `Path` value to this checkout if needed. `desktop/linux/agenttrail-tray.sh` starts the server, opens the browser through `xdg-open`, and uses `notify-send` when available.

Package metadata for Debian, RPM, and AppImage-style staging lives under `installers/linux`.

## Packaged App Notes

The generated macOS app embeds the project, starts the local server, opens `http://127.0.0.1:4173`, and logs to `~/Library/Logs/AgentTrail/agenttrail.log`. Public distribution still needs Apple Developer ID signing and notarization via `npm run sign:mac-app`.
