# AgentTrail v0.7 — Launch Posts

Positioning for every channel: **a local AI agent that shows its work.** Lead with trust, point at the live demo, keep it humble and technical. Post on a Tuesday–Thursday morning (US time). Reply to every comment in the first 3 hours.

Live demo: https://mughal-baig.github.io/local-ai-agent/demo.html
Repo: https://github.com/Mughal-Baig/local-ai-agent

---

## Hacker News — Show HN

**Title**

```
Show HN: AgentTrail – a local AI agent that shows its work (Ollama, zero deps)
```

**Body**

```
I wanted a Claude/ChatGPT-style workspace assistant that could actually touch my
files — but without sending those files to a cloud, and without me having to trust
a black box. So I built AgentTrail.

The whole idea is that a local agent should prove what it did. Every run is a loop
you can watch: it searches your workspace, shows the evidence before it answers,
proposes file changes as a unified diff, and only writes after you click Apply.
Each run becomes a receipt you can reopen, export, and replay.

Some details that might interest this crowd:
- Runs on Ollama. Nothing leaves the machine; the server only talks to Ollama and
  your local browser.
- Zero npm dependencies. It's a readable Node server + a plain browser UI. Clone
  it, run `node server.js`, and you can read the whole thing in an afternoon.
- Writes are off by default. Preview mode returns a diff instead of touching files.
- File access is sandboxed to a workspace/ folder; paths outside it are blocked.
- Local semantic search (Ollama embeddings, with a keyword fallback), recipe
  workflows as plain JSON, a Trust Score that surfaces evidence/preview/receipt
  signals, an eval harness, and an MCP bridge.

There's a live demo that runs entirely in the browser (no install) so you can see
the ask → diff → Apply → receipt loop before pulling a model:
https://mughal-baig.github.io/local-ai-agent/demo.html

It's intentionally small — not a platform, a starter kit you can fork and trust.
Happy to answer anything about the design, the permission model, or the receipt
format.
```

**First comment to pin (pre-empt the obvious questions)**

```
A few things I expect to come up:
- Why not just use Open WebUI / Jan / AnythingLLM? Those are great, broader
  platforms. AgentTrail is the opposite bet: tiny and auditable, where the
  point is the receipt — proof of every search and edit — not feature breadth.
- Models: anything you can pull with Ollama (llama3.2 by default).
- Security: writes gated behind an explicit Apply, workspace path sandbox,
  and a hardening scan for prompt-injection / exfiltration patterns.
```

---

## Reddit — r/LocalLLaMA

**Title**

```
I built a local AI agent that shows its work — search, diff preview, explicit Apply, and a receipt for every run (Ollama, zero deps)
```

**Body**

```
Local models are good enough now that I wanted one to actually do work on my files
— but I didn't want a black box editing things or quietly phoning home. So the
design goal for AgentTrail was auditability: you should be able to see exactly what
the agent searched, read, and changed, and why.

The loop:
1. You ask.
2. It searches your workspace and SHOWS the evidence before answering (local
   semantic search via Ollama embeddings, keyword fallback).
3. It proposes file changes as a unified diff — no writes yet.
4. You click Apply.
5. The run becomes a receipt you can reopen, export as Markdown/HTML, and replay.

Why it might be worth a look:
- 100% local. The server only talks to Ollama + your browser.
- Zero npm dependencies — `node server.js` and you're running.
- Writes off by default; workspace-sandboxed file access.
- Recipes (plain JSON workflows), a Trust Score, an eval harness, and an MCP bridge.

Browser demo, no install needed (try the Apply button):
https://mughal-baig.github.io/local-ai-agent/demo.html

Repo (MIT): https://github.com/Mughal-Baig/local-ai-agent

It's a small, readable starter kit rather than a platform. Feedback and PRs welcome
— especially on the permission model and receipt format.
```

---

## Product Hunt

**Tagline (60 char max)**

```
The local AI agent that hands you the receipt
```

**Description**

```
AgentTrail is a private, local AI agent for working with your own files. It runs on
Ollama, searches before it answers, previews every edit as a diff you approve, and
turns each run into a replayable receipt. Zero dependencies, MIT licensed, and small
enough to read in an afternoon. Try the in-browser demo — no install.
```

**First comment**

```
Built this because I wanted local models to touch my files without becoming a black
box. The whole product is one idea: the agent should prove what it did. Every search
is shown, every write is gated behind an explicit Apply, and every run leaves a
receipt you can reopen and replay. Would love your feedback on the trust model.
```

---

## X / Twitter thread (optional)

```
1/ Local models can finally do real work on your files. But would you let one edit
your repo if you couldn't see what it did?

I built AgentTrail: a local AI agent that shows its work. Search → diff → you Apply →
receipt. Runs on Ollama, zero deps. Demo (no install): <link>

2/ The bet: a local agent should PROVE what it did.
- searches your workspace and shows the evidence before answering
- proposes edits as a diff — writes are off by default
- you click Apply
- the run becomes a receipt you can export + replay

3/ It's intentionally tiny. A readable Node server + plain browser UI, no npm
dependencies, MIT. Not a platform — a starter kit you can fork and trust.

Repo: <link>
```
