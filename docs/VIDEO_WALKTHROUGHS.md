# Video Walkthroughs

The goal is short proof, not a long tutorial. Each video should show the local safety loop clearly: context, action, preview, approval, receipt.

## Recording Commands

```bash
npm run demo:gif
npm run demo:video
```

For real browser capture, use [demo-video/storyboard.json](demo-video/storyboard.json) and the shot lists below.

## Walkthrough 1: 60-Second Quick Start

| Time | Shot | Proof |
| --- | --- | --- |
| 0-8s | Open AgentTrail locally | Browser on `127.0.0.1` |
| 8-18s | Search workspace | Search result and selected file |
| 18-35s | Ask for safe edit | Trail shows search/read |
| 35-48s | Diff Review | Preview before apply |
| 48-60s | Receipt/report | Exported proof |

## Walkthrough 2: Diff-Safe Coding

Show a small code/doc edit. The important moment is the Apply button: file changes should not happen until the user clicks it.

## Walkthrough 3: Security Hardening

Use a prompt-injection sample file. Show the scanner flagging suspicious instructions, path escape/exfiltration wording, and safe-write enforcement.

## Walkthrough 4: Team And Audit

Switch local users, show RBAC, export audit JSON/CSV, and open shared read-only receipts.

## Walkthrough 5: Quality Proof

Show terminal commands:

```bash
npm run test:quality
npm run coverage
npm run bench:quality
npm run eval
```

End on the eval category scoreboard.

## Publishing Checklist

- Keep videos under 90 seconds.
- Start with the actual app, not slides.
- Show local address and workspace boundary.
- Show diff preview before apply.
- End with receipt/report proof.
- Link back to [GETTING_STARTED.md](GETTING_STARTED.md) and [public-demo.html](public-demo.html).
