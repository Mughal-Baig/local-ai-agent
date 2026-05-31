// AgentTrail VS Code extension — MVP. Sends the active selection (or a prompt) to
// a running AgentTrail server and shows the streamed reply in an output channel.
const vscode = require("vscode");
function activate(context) {
  const out = vscode.window.createOutputChannel("AgentTrail");
  context.subscriptions.push(vscode.commands.registerCommand("agenttrail.ask", async () => {
    const base = vscode.workspace.getConfiguration("agenttrail").get("url");
    const editor = vscode.window.activeTextEditor;
    const selection = editor ? editor.document.getText(editor.selection) : "";
    const prompt = await vscode.window.showInputBox({ prompt: "Ask AgentTrail", value: selection ? "Explain this:\n" + selection : "" });
    if (!prompt) return;
    out.show(true); out.appendLine("> " + prompt.split("\n")[0]);
    try {
      const res = await fetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }], selectedFiles: [], permissions: {}, securityMode: true }) });
      const dec = new TextDecoder(); let buf = "";
      for await (const chunk of res.body) { buf += dec.decode(chunk, { stream: true }); let nl; while ((nl = buf.indexOf("\n\n")) !== -1) { const block = buf.slice(0, nl); buf = buf.slice(nl + 2); let ev = "message", data = ""; for (const line of block.split("\n")) { if (line.startsWith("event:")) ev = line.slice(6).trim(); if (line.startsWith("data:")) data += line.slice(5).trim(); } if (ev === "token") { try { out.append(JSON.parse(data).text || ""); } catch {} } } }
      out.appendLine("");
    } catch (e) { vscode.window.showErrorMessage("AgentTrail: could not reach " + base); }
  }));
}
function deactivate() {}
module.exports = { activate, deactivate };
