"use strict";

const vscode = require("vscode");

function activate(context) {
  const out = vscode.window.createOutputChannel("AgentTrail");
  let lastSuggestion = "";

  context.subscriptions.push(vscode.commands.registerCommand("agenttrail.chat", async () => {
    const prompt = await vscode.window.showInputBox({ prompt: "Ask AgentTrail" });
    if (!prompt) return;
    lastSuggestion = await sendAgentTrail(prompt, out);
  }));

  context.subscriptions.push(vscode.commands.registerCommand("agenttrail.ask", async () => {
    const editor = vscode.window.activeTextEditor;
    const selection = editor ? editor.document.getText(editor.selection) : "";
    const prompt = await vscode.window.showInputBox({
      prompt: "Ask AgentTrail about the current selection",
      value: selection ? `Explain or improve this:\n${selection}` : ""
    });
    if (!prompt) return;
    lastSuggestion = await sendAgentTrail(prompt, out, editor);
  }));

  context.subscriptions.push(vscode.commands.registerCommand("agenttrail.applySuggestion", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("AgentTrail: open a file before applying a suggestion.");
      return;
    }
    const replacement = extractSuggestedCode(lastSuggestion);
    if (!replacement.trim()) {
      vscode.window.showErrorMessage("AgentTrail: no previous suggestion to apply.");
      return;
    }
    const range = editor.selection && !editor.selection.isEmpty
      ? editor.selection
      : new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
    const scope = editor.selection && !editor.selection.isEmpty ? "selected text" : "entire file";
    const answer = await vscode.window.showWarningMessage(`Apply AgentTrail's last suggestion to the ${scope}?`, { modal: true }, "Apply");
    if (answer !== "Apply") return;
    await editor.edit((builder) => builder.replace(range, replacement));
    out.appendLine(`[applied] ${editor.document.fileName}`);
  }));
}

async function sendAgentTrail(prompt, out, editor) {
  const config = vscode.workspace.getConfiguration("agenttrail");
  const base = String(config.get("url") || "http://127.0.0.1:4173").replace(/\/+$/, "");
  const model = String(config.get("model") || "").trim();
  const selectedFiles = selectedWorkspaceFiles(editor);
  const payload = {
    ...(model ? { model } : {}),
    messages: [{ role: "user", content: prompt }],
    selectedFiles,
    permissions: { readFiles: selectedFiles.length > 0, previewWrites: true, writeFiles: false },
    securityMode: true
  };
  out.show(true);
  out.appendLine(`> ${prompt.split("\n")[0]}`);
  try {
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }
    let text = "";
    await readSse(response.body, (event, data) => {
      if (event === "token") {
        const chunk = String(data.text || "");
        text += chunk;
        out.append(chunk);
      }
      if (event === "error" || event === "timeout" || event === "cancelled") {
        out.appendLine(`\n[${event}] ${data.message || "AgentTrail run failed."}`);
      }
    });
    out.appendLine("");
    return text;
  } catch (error) {
    vscode.window.showErrorMessage(`AgentTrail: could not reach ${base} (${error.message})`);
    return "";
  }
}

function selectedWorkspaceFiles(editor) {
  if (!editor || editor.document.uri.scheme !== "file") {
    return [];
  }
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (!workspaceFolder) {
    return [];
  }
  return [vscode.workspace.asRelativePath(editor.document.uri, false)];
}

async function readSse(stream, onEvent) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      parseSseBlock(buffer.slice(0, boundary), onEvent);
      buffer = buffer.slice(boundary + 2);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) parseSseBlock(buffer, onEvent);
}

function parseSseBlock(block, onEvent) {
  let event = "message";
  const dataLines = [];
  for (const line of String(block || "").split(/\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;
  try {
    onEvent(event, JSON.parse(dataLines.join("\n")));
  } catch {
    onEvent(event, { text: dataLines.join("\n") });
  }
}

function extractSuggestedCode(text) {
  const match = String(text || "").match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  return match ? match[1].replace(/\n$/, "") : String(text || "");
}

function deactivate() {}

module.exports = { activate, deactivate };
