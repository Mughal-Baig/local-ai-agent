#!/usr/bin/env node

const fsp = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const storyboard = {
    schema: "agenttrail.demo-video.v1",
    title: "AgentTrail screen demo",
    output: "docs/demo-video/agenttrail-screen-demo.webm",
    steps: [
      "Open local app",
      "Build semantic index",
      "Search workspace",
      "Show chunk citations",
      "Preview diff",
      "Apply diff",
      "Export receipt and replay plan"
    ],
    command: "Use Playwright video recording or OS screen recorder against http://127.0.0.1:4174/"
  };
  await fsp.mkdir(path.join(projectRoot, "docs", "demo-video"), { recursive: true });
  await fsp.writeFile(path.join(projectRoot, "docs", "demo-video", "storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");
  await fsp.writeFile(path.join(projectRoot, "docs", "demo-video", "README.md"), [
    "# AgentTrail Screen Demo",
    "",
    "The repository includes a generated GIF and this storyboard for recording a real screen video.",
    "",
    "Record against `http://127.0.0.1:4174/` and save the final video as:",
    "",
    "```text",
    "docs/demo-video/agenttrail-screen-demo.webm",
    "```",
    "",
    "The exact storyboard is in `storyboard.json`."
  ].join("\n"), "utf8");
  console.log("Prepared demo video storyboard");
}
