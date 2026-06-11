# AgentTrail Screen Demo

The repository includes a reproducible GIF and this storyboard for recording the same flow as a live screen video.

Regenerate the public proof bundle with:

```bash
npm run demo:proof
```

For a live video, run AgentTrail locally, follow `storyboard.json`, and save the final recording as:

```text
docs/demo-video/agenttrail-screen-demo.webm
```

The required flow is search -> diff preview -> Apply -> receipt -> shareable report. `npm run demo:health` fails when the public proof assets are stale.