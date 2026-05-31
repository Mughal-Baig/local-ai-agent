# Desktop Distribution

Epic T adds a native-desktop path while keeping AgentTrail's zero-dependency local server intact.

## Surfaces

- macOS: `npm run package:mac-app` builds `dist/mac/AgentTrail.app`. On macOS with `swiftc`, it compiles the native menu-bar app in `desktop/mac/AgentTrailMenuBar.swift`; otherwise it uses the shell launcher.
- Windows: `desktop/windows/AgentTrail.cmd` launches `desktop/windows/AgentTrail-Tray.ps1` with a tray icon and server controls. Installer templates live in `installers/windows/AgentTrail.iss` and `installers/windows/AgentTrail.wxs`.
- Linux: `desktop/linux/agenttrail.desktop` and `desktop/linux/agenttrail-tray.sh` provide desktop entry and notification startup. Package metadata lives in `installers/linux` for deb, rpm, and AppImage-style staging.

## Update Channel

`updates/latest.json` is the local update-channel manifest. The app exposes it at:

```text
GET /api/updates/check
```

The response includes current version, latest version, update availability, release notes, channel, and artifact metadata.

## Native Notifications

Desktop launchers set:

```bash
AGENTTRAIL_DESKTOP=1
AGENTTRAIL_APP_MODE=desktop
AGENTTRAIL_DESKTOP_NOTIFICATIONS=on
```

Long agent runs and model pulls notify through macOS `osascript`, Windows tray balloon notifications, or Linux `notify-send` when the duration exceeds `AGENTTRAIL_NOTIFY_AFTER_MS` (default 30000).

## Signing

- macOS: `npm run sign:mac-app -- --dry-run`
- Windows: `npm run sign:windows -- --dry-run`
- Linux: publish signed checksums and package repository metadata.

Real signing requires platform certificates; dry runs are safe in CI.
