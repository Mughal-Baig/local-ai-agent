#!/usr/bin/env node
// T089 — CLI pipe mode. Reads a prompt from stdin (or argv), sends it to a running
// AgentTrail server, and prints the streamed reply. Usage:
//   echo "summarize README" | node bin/agenttrail-chat.js
//   node bin/agenttrail-chat.js "your prompt here"
const base = process.env.AGENTTRAIL_URL || "http://127.0.0.1:4173";
async function readStdin() {
  if (process.argv[2]) return process.argv.slice(2).join(" ");
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8").trim();
}
async function main() {
  const prompt = await readStdin();
  if (!prompt) { console.error("No prompt provided."); process.exit(2); }
  let res;
  try {
    res = await fetch(base + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }], selectedFiles: [], permissions: {}, securityMode: true })
    });
  } catch (e) { console.error(`Could not reach AgentTrail at ${base}. Start it with: node server.js`); process.exit(1); }
  if (!res.ok || !res.body) { console.error(`Chat request failed: HTTP ${res.status}`); process.exit(1); }
  const dec = new TextDecoder(); let buf = "", out = "";
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let nl; while ((nl = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, nl); buf = buf.slice(nl + 2);
      let ev = "message", data = "";
      for (const line of block.split("\n")) { if (line.startsWith("event:")) ev = line.slice(6).trim(); if (line.startsWith("data:")) data += line.slice(5).trim(); }
      if (ev === "token") { try { const d = JSON.parse(data); process.stdout.write(d.text || ""); out += d.text || ""; } catch {} }
      if (ev === "error") { try { const d = JSON.parse(data); console.error("\n[error] " + (d.message || "")); } catch {} }
    }
  }
  process.stdout.write("\n");
}
main().catch((e) => { console.error(e); process.exit(1); });
