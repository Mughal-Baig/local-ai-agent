#!/usr/bin/env node

const fsp = require("node:fs/promises");
const path = require("node:path");
const { fixedClock, flow } = require("./demo-proof-data");

const projectRoot = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const storyboard = {
    schema: "agenttrail.demo-video.v1",
    title: "AgentTrail screen demo",
    generatedAt: fixedClock,
    gif: "docs/agenttrail-demo.gif",
    proofPage: "docs/demo-proof.html",
    output: "docs/demo-video/agenttrail-screen-demo.webm",
    deterministicCommand: "npm run demo:proof",
    liveRecordingCommand: "npm run dev, then record http://127.0.0.1:4173/ while following this storyboard",
    steps: flow.map((step, index) => ({
      order: index + 1,
      id: step.id,
      label: step.label,
      action: step.summary,
      proof: step.proof
    }))
  };
  await fsp.mkdir(path.join(projectRoot, "docs", "demo-video"), { recursive: true });
  await fsp.writeFile(path.join(projectRoot, "docs", "demo-video", "storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");
  await fsp.writeFile(path.join(projectRoot, "docs", "demo-video", "README.md"), [
    "# AgentTrail Screen Demo",
    "",
    "The repository includes a reproducible GIF and this storyboard for recording the same flow as a live screen video.",
    "",
    "Regenerate the public proof bundle with:",
    "",
    "```bash",
    "npm run demo:proof",
    "```",
    "",
    "For a live video, run AgentTrail locally, follow `storyboard.json`, and save the final recording as:",
    "",
    "```text",
    "docs/demo-video/agenttrail-screen-demo.webm",
    "```",
    "",
    "The required flow is search -> diff preview -> Apply -> receipt -> shareable report. `npm run demo:health` fails when the public proof assets are stale."
  ].join("\n"), "utf8");
  console.log("Prepared deterministic demo video storyboard");
}
