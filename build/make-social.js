// GitHub social-preview card (1280x640), warm "ink & clay". Run: node build/make-social.js
const fs = require("fs");
const path = require("path");
const C = {
  bg: "#f0eee6", tint: "#ebe8dd", panel: "#faf9f5", ink: "#1f1e1d", inkSoft: "#3c3a36",
  muted: "#75716a", faint: "#9b968c", line: "#e2ddd0", clay: "#cc785c", clayDeep: "#b35f43",
  claySoft: "#f3e4dc", clayFaint: "#f8efe9", sage: "#5c7257", sageSoft: "#e7eee2", amber: "#c2933b",
};
const W = 1280, H = 640;
const txt = (x,y,s,o={}) => `<text x="${x}" y="${y}" font-family="${o.f||"sans-serif"}" font-size="${o.s||14}" font-weight="${o.w||400}" fill="${o.c||C.ink}"${o.a?` text-anchor="${o.a}"`:""}${o.ls?` letter-spacing="${o.ls}"`:""}>${s}</text>`;
const rr = (x,y,w,h,r,f,st,sw=1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}"${st?` stroke="${st}" stroke-width="${sw}"`:""}/>`;

function logo(x, y, sz) {
  const k = sz / 96;
  return `<g transform="translate(${x},${y}) scale(${k})">
    <defs><linearGradient id="lg" x1="12" y1="10" x2="84" y2="86" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#D58468"/><stop offset="1" stop-color="#B35F43"/></linearGradient></defs>
    <rect x="8" y="8" width="80" height="80" rx="22" fill="url(#lg)"/>
    <rect x="38" y="24" width="34" height="48" rx="8" fill="#F7F4EC"/>
    <path d="M46 36H64M46 46H64M46 56H57" stroke="#2A2723" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M27 33V63" stroke="#F7F4EC" stroke-opacity="0.85" stroke-width="3" stroke-linecap="round"/>
    <circle cx="27" cy="33" r="6.5" fill="#E0AE54"/><circle cx="27" cy="48" r="5.5" fill="#F7F4EC"/><circle cx="27" cy="63" r="5.5" fill="#6E8568"/>
  </g>`;
}

function pill(x, y, label, kind) {
  const w = label.length * 9.2 + 52;
  const bg = kind === "sage" ? C.sageSoft : C.clayFaint;
  const fg = kind === "sage" ? "#3c5238" : C.clayDeep;
  const dot = kind === "sage" ? C.sage : C.clay;
  return rr(x, y, w, 40, 20, bg, kind === "sage" ? "#cfe0c6" : C.claySoft) +
    `<circle cx="${x+24}" cy="${y+20}" r="5" fill="${dot}"/>` +
    txt(x+38, y+26, label, { s: 16, w: 600, c: fg }) + `<!--w:${w}-->`;
}

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
s += `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg}"/><stop offset="1" stop-color="${C.tint}"/></linearGradient>`;
s += `<clipPath id="frameClip"><rect x="28" y="28" width="${W-56}" height="${H-56}" rx="28"/></clipPath></defs>`;
s += rr(0,0,W,H,0,"url(#bg)");
// border frame + warm accent edge
s += rr(28,28,W-56,H-56,28,"none",C.line,1.5);
s += rr(28,28,7,H-56,0,C.clay);
s += rr(28,28,7,160,0,C.clay) + rr(28,28,7,80,0,C.amber);

// header: logo + wordmark
s += logo(72, 70, 84);
s += txt(176, 110, "AgentTrail", { f: "Georgia, serif", s: 40, w: 600, c: C.ink });
s += txt(178, 142, "LOCAL AI AGENT", { s: 15, w: 700, c: C.muted, ls: 3 });

// promise
s += txt(74, 250, "A local AI agent that", { f: "Georgia, serif", s: 64, w: 600, c: C.ink });
s += txt(74, 322, "shows its work.", { f: "Georgia, serif", s: 64, w: 600, c: C.clayDeep });
s += txt(74, 378, "Every search, every edit, every reason — on your machine. Nothing leaves.", { s: 24, c: C.inkSoft });

// loop pills
let px = 74, py = 432;
const steps = ["Ask", "Search", "Diff preview", "You Apply", "Receipt"];
steps.forEach((st, i) => {
  const w = st.length * 13 + 44;
  s += rr(px, py, w, 50, 25, C.panel, C.line);
  s += txt(px + w/2, py + 32, st, { s: 19, w: 600, c: C.inkSoft, a: "middle" });
  px += w;
  if (i < steps.length - 1) { s += txt(px + 14, py + 33, "→", { s: 22, w: 700, c: C.clay }); px += 40; }
});

// bottom badges
let bx = 74, by = 528;
[["Runs on Ollama","clay"],["Zero npm dependencies","sage"],["Auditable receipts","clay"],["MIT","sage"]].forEach(([l,k]) => {
  const frag = pill(bx, by, l, k);
  s += frag;
  const w = parseInt(frag.match(/w:(\d+)/)[1], 10);
  bx += w + 14;
});

// repo handle bottom-right
s += txt(W - 72, 590, "github.com/Mughal-Baig/local-ai-agent", { s: 18, w: 600, c: C.muted, a: "end" });

s += "</svg>";
const dir = path.join(__dirname, "social");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "social-preview.svg"), s);
console.log("wrote social-preview.svg");
