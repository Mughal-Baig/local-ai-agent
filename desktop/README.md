# AgentTrail Desktop Launchers

These launchers give non-developers a double-click path while the project stays zero-dependency.

## macOS

Double-click `desktop/mac/AgentTrail.command`.

## Windows

Double-click `desktop/windows/AgentTrail.cmd`.

## Linux

Copy `desktop/linux/agenttrail.desktop` into `~/.local/share/applications/`, then edit the `Exec` and `Path` values to this checkout.

## Packaged App Roadmap

The launchers are the first desktop surface. A full signed Tauri/Electron app should wrap the same local server, open `http://127.0.0.1:4173`, and expose an Ollama/setup check before first run.
