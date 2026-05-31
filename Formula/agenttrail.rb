class Agenttrail < Formula
  desc "Auditable local AI agent with Ollama, diff previews, receipts, and replay"
  homepage "https://github.com/Mughal-Baig/local-ai-agent"
  url "https://github.com/Mughal-Baig/local-ai-agent/releases/download/v0.7.0/agenttrail-0.7.0.tgz"
  sha256 "3db75d4980a4b5263c2e39bb9c5db96c49785befcb18db04bcc545d9a57e8082"
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
