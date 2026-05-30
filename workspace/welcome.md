# Welcome to AgentTrail 👋

This file lives in your **sandboxed workspace** — the only folder the agent can read or write. Let's run the full trust loop in about a minute.

## Try it now

1. **Select this file** in the Workspace panel on the left (it's already here).
2. In the prompt strip up top, click **Summarize** — or type your own request:

   ```text
   Summarize this file, then propose a short "Getting Started" section and show me the diff before writing it.
   ```

3. Watch the **Agent Trail** fill in: the model it used, the files it read, and each tool call — every step is logged as a receipt.
4. When the agent proposes a change, you'll get a **diff preview**. Nothing is written yet. Read it, then click **Apply** to accept.
5. Open the **Receipts** group to reopen, export, or replay that run later.

## What just happened

The agent searched before it answered, showed its evidence, proposed an edit as a reviewable diff, and only changed a file after you clicked Apply — and it left a receipt you can audit. That's the whole idea: **a local agent that shows its work.**

## Good next steps

- Try the **Plan** or **Review** starter prompts on a file of your own.
- Open the **Search & Recipes** group and run a recipe like *Explain This File* or *Code Review*.
- Drop your own notes, drafts, or code into this `workspace/` folder and ask the agent to work with them.

Everything runs locally against your Ollama model. Nothing leaves your machine.
