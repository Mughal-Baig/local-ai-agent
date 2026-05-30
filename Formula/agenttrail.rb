class Agenttrail < Formula
  desc "Auditable local AI agent with Ollama, diff previews, receipts, and replay"
  homepage "https://github.com/Mughal-Baig/local-ai-agent"
  url "https://github.com/Mughal-Baig/local-ai-agent/archive/refs/tags/v0.6.0.tar.gz"
  version "0.6.0"
  license "MIT"

  depends_on "node"
  depends_on "ollama" => :recommended

  def install
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/agenttrail.js" => "agenttrail"
  end

  service do
    run [opt_bin/"agenttrail"]
    keep_alive true
    log_path var/"log/agenttrail.log"
    error_log_path var/"log/agenttrail.log"
  end

  test do
    assert_match "agenttrail", shell_output("#{bin}/agenttrail --help")
  end
end
