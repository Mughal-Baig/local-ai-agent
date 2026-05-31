class Agenttrail < Formula
  desc "Auditable local AI agent with Ollama, diff previews, receipts, and replay"
  homepage "https://github.com/Mughal-Baig/local-ai-agent"
  url "https://github.com/Mughal-Baig/local-ai-agent/releases/download/v0.7.0/agenttrail-0.7.0.tgz"
  sha256 "ce4714f3f49a4208de3164a3a95dbb51bf8137f0357ee1a65e09d73994022ba4"
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
