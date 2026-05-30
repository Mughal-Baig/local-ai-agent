# AgentTrail — Next Plan (v0.8): from polished to popular

The first plan ([ELITE_UPGRADE_PLAN.md](ELITE_UPGRADE_PLAN.md)) was about the *first impression*. That work is done: warm UI, grouped sidebar, real icons, app icon, hero GIF, rewritten README, UI previews, sharpened comparison, interactive demo, launch copy.

The repo now *looks* top‑tier. This plan is about the next, harder thing: getting people to **find it, try it, keep it, and trust it enough to depend on it.** Stars are a lagging indicator of those four. Ordered by impact‑per‑hour.

## Where we are
- Strong foundation + a first impression that finally matches it.
- 0 stars, 0 forks. The product is ready; distribution and retention are not yet proven.
- The bottleneck is no longer quality — it's reach and the first‑run experience.

## Tier 1 — Make the repo *findable and skimmable* (highest impact)

### 1. Ship a custom social preview image
When the repo link is shared anywhere (HN, Reddit, X, Slack), GitHub shows an Open Graph card. The default is auto‑generated and generic. Upload a 1280×640 branded card (warm palette, logo, the one‑line promise, the loop). Settings → Social preview. This is the single highest‑leverage 20‑minute task for click‑through.

### 2. Pass the 5‑second README skim test
Most visitors decide in one screen. Above the fold should be: logo + promise, the hero GIF, the live‑demo button, and the three badges — nothing else competing. Move the long feature lists below "A Look Inside." Trim "Why Star This" from ~13 bullets to the 5 that actually differentiate (auditable receipts, search‑before‑answer, diff‑gated writes, zero deps, local‑first).

### 3. Tighten GitHub topics + About line
Topics are search surface. Keep the sharp ones (`ollama`, `local-ai`, `ai-agent`, `audit-trail`, `local-first`, `privacy`) and drop vanity ones. Confirm the About line is the trust promise (set via the Codex push command).

### 4. A real "60 seconds to first result" path
The current quick start is code blocks. Add a screenshot‑backed, numbered first‑run: install Ollama → `npx github:...` → ask one thing → see the receipt. Visual, not just commands. Friction here is where stars leak.

## Tier 2 — Earn the second session (retention)

### 5. A first‑run onboarding moment
The first time the app opens with an empty workspace, show a one‑screen guided tour: "Here's the trail, here's a diff, click Apply." A single seeded example beats any docs. This converts a curious visitor into a returning user.

### 6. A genuinely useful recipe library
Recipes are the reason people come back. Ship 8–10 sharp, reviewable ones: code review, release notes, security hardening, meeting‑notes → action items, README pass, dependency audit, changelog draft, "explain this file." Each should be useful with zero cloud and obvious in one line.

### 7. Streaming + keyboard‑first UX polish
Token streaming (or a convincing streamed feel), Cmd/Ctrl+Enter to send, `/` to focus search, arrow‑key file selection. Small touches that make it feel like a daily tool, not a demo.

### 8. Model auto‑detect and a "best model for this" nudge
On first run, detect installed Ollama models and recommend one for the task (you already score coding/planning/long‑context). Surface that recommendation prominently so users don't bounce on model confusion.

## Tier 3 — Credibility and moat (trust the claims)

### 9. Make the foundation *provable*, not just present
Add a visible coverage number and a one‑line "what the smoke test proves." Replace placeholder benchmark text with one real local run's numbers. "Serious foundation" should be checkable in 10 seconds.

### 10. Publish the Receipt spec as a small standard
The receipt is your wedge — make it a named, documented format (`docs/RECEIPT_SPEC.md`): fields, example, and why each exists. A documented artifact others could adopt turns a feature into a category you own.

### 11. A short, honest SECURITY posture page
Threat model in plain language: what's sandboxed, what isn't, what "local‑first" guarantees and what it doesn't. Security‑minded users (your core audience) reward honesty and will trust the rest more.

## Tier 4 — Differentiated bets (do after Tiers 1–3 land)

### 12. The receipt as a shareable artifact
Let a user export a run as a single self‑contained HTML receipt they can send to a teammate — "here's exactly what the agent did." That's a viral loop built into the core value prop.

### 13. Replay diffing across runs
Compare two runs of the same recipe: what changed in the plan, the evidence, the output. Nobody in the local‑agent space does run‑level auditing well. This is where AgentTrail could be genuinely best‑in‑class.

### 14. Lightweight team/audit angle
Even just a read‑only shared receipts folder positions AgentTrail for the "AI that touches our files, and we can audit it" use case — a real wedge into teams without becoming a platform.

## Metrics to watch
- Stars in the 72 hours after a launch post (reach signal).
- Demo page → repo click‑through (positioning signal).
- Issues/discussions opened by non‑you accounts (genuine‑interest signal).
- Returning‑user signal: hard to measure locally, so proxy with "recipe imported" or "second session" telemetry you keep entirely local.

## Two‑week cadence
- **Days 1–2:** Social preview image, README skim trim, topics/About (Tier 1).
- **Days 3–5:** First‑run onboarding + 8 recipes (Tier 2 #5–6).
- **Days 6–8:** Streaming/keyboard polish + model auto‑detect (Tier 2 #7–8).
- **Day 9:** Coverage/benchmark proof + Receipt spec + security page (Tier 3).
- **Day 10:** Launch (post the v0.7 copy, reply fast). Hold Tier 4 for the follow‑up release.

## What NOT to do
- Don't add more API endpoints or dashboards — surface is already wide.
- Don't start a desktop‑framework rewrite; the zero‑dep Node + browser story is the moat.
- Don't launch before the social preview image and first‑run onboarding exist — you get one good shot at each post.
- Don't widen scope into a platform. Stay the small, auditable, trustworthy one.

## Suggested next session
Tier 1 in full (social preview image — I can design it — plus the README skim trim), then the first‑run onboarding and the recipe library. That sequence turns the polish you already have into actual adoption.
