#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const packageMeta = require("../package.json");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-homebrew-"));
  try {
    const { stdout } = await execFileAsync("npm", ["pack", "--json", "--pack-destination", tmp], {
      cwd: projectRoot,
      env: {
        ...process.env,
        SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || "1772323200",
        npm_config_cache: path.join(tmp, ".npm-cache")
      },
      maxBuffer: 2 * 1024 * 1024
    });
    const [info] = JSON.parse(stdout);
    const tarball = path.join(tmp, info.filename);
    const sha256 = crypto.createHash("sha256").update(await fsp.readFile(tarball)).digest("hex");
    const formula = formulaText({ version: packageMeta.version, sha256, tarball: info.filename });
    const destination = path.join(projectRoot, "Formula", "agenttrail.rb");
    await fsp.writeFile(destination, formula, "utf8");
    console.log(`Updated Formula/agenttrail.rb for ${info.filename}`);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
}

function formulaText({ version, sha256, tarball }) {
  return `class Agenttrail < Formula
  desc "Auditable local AI agent with Ollama, diff previews, receipts, and replay"
  homepage "https://github.com/Mughal-Baig/local-ai-agent"
  url "https://github.com/Mughal-Baig/local-ai-agent/releases/download/v${version}/${tarball}"
  sha256 "${sha256}"
  license "MIT"
  head "https://github.com/Mughal-Baig/local-ai-agent.git", branch: "main"

  depends_on "node"
  depends_on "ollama" => :recommended

  def install
    root = buildpath/"package"
    root = buildpath unless root.exist?
    libexec.install Dir[root/"*"]
    bin.install_symlink libexec/"bin/agenttrail.js" => "agenttrail"
    bin.install_symlink libexec/"bin/agenttrail-chat.js" => "agenttrail-chat"
  end

  service do
    run [opt_bin/"agenttrail", "serve"]
    keep_alive true
    log_path var/"log/agenttrail.log"
    error_log_path var/"log/agenttrail.log"
  end

  test do
    assert_match "agenttrail - local AI agent CLI", shell_output("#{bin}/agenttrail --help")
    assert_match version.to_s, shell_output("#{bin}/agenttrail --version")
  end
end
`;
}
