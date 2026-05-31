AgentTrail 0.7.0

Run npm run package:mac-app for AgentTrail.app. The macOS bundle uses the native menu-bar launcher when swiftc is available, otherwise it falls back to the shell launcher. Sign and notarize with npm run sign:mac-app.

This repository includes launchers, update metadata, notification hooks, checksum generation, and signing command scaffolds. Native signing requires platform certificates.
