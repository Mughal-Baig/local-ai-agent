// Generates branded hero-loop frames (SVG) for AgentTrail.
// Run: node build/make-demo-gif.js  (then ImageMagick assembles the GIF)
const fs = require("fs");
const path = require("path");

const C = {
  bg: "#f0eee6", panel: "#faf9f5", panel2: "#ffffff", ink: "#1f1e1d",
  inkSoft: "#3c3a36", muted: "#75716a", faint: "#9b968c", line: "#e2ddd0",
  clay: "#cc785c", clayDeep: "#b35f43", claySoft: "#f3e4dc", clayFaint: "#f8efe9",
  sage: "#5c7257", sageSoft: "#e7eee2", amber: "#c2933b", rose: "#b4543a",
};

const W = 1200, H = 720;
const steps = ["Ask", "Search", "Preview", "Apply", "Receipt"];

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function header(trust) {
  return `
  <rect x="0" y="0" width="${W}" height="78" fill="${C.panel}"/>
  <line x1="0" y1="78" x2="${W}" y2="78" stroke="${C.line}" stroke-width="1"/>
  <rect x="36" y="20" width="38" height="38" rx="11" fill="${C.clay}"/>
  <rect x="56" y="30" width="13" height="18" rx="3" fill="${C.clayFaint}"/>
  <circle cx="49" cy="31" r="3.4" fill="${C.amber}"/>
  <circle cx="49" cy="40" r="3" fill="${C.clayFaint}"/>
  <circle cx="49" cy="49" r="3" fill="${C.sage}"/>
  <text x="86" y="45" font-family="Georgia, serif" font-size="22" font-weight="600" fill="${C.ink}">AgentTrail</text>
  <text x="86" y="62" font-family="sans-serif" font-size="12" fill="${C.muted}">Private local assistant — nothing leaves your machine</text>
  <rect x="${W-208}" y="22" width="172" height="34" rx="17" fill="${C.clayFaint}" stroke="${C.claySoft}"/>
  <text x="${W-192}" y="44" font-family="sans-serif" font-size="13" font-weight="700" fill="${C.clayDeep}">Trust Score</text>
  <text x="${W-70}" y="44" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${C.clayDeep}">${trust}</text>`;
}

function rail(active) {
  let out = "";
  const x = 40, y0 = 130, gap = 96;
  for (let i = 0; i < steps.length; i++) {
    const y = y0 + i * gap;
    const on = i === active, done = i < active;
    const dot = on ? C.clay : done ? C.sage : C.line;
    const txtC = on ? C.ink : done ? C.inkSoft : C.faint;
    if (i < steps.length - 1) out += `<line x1="${x+13}" y1="${y+14}" x2="${x+13}" y2="${y+gap-14}" stroke="${done ? C.sage : C.line}" stroke-width="2"/>`;
    out += `<circle cx="${x+13}" cy="${y}" r="13" fill="${on ? C.clay : C.panel}" stroke="${dot}" stroke-width="2"/>`;
    if (done) out += `<path d="M${x+7} ${y} l4 4 l8 -8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,-1)"/>`;
    else out += `<circle cx="${x+13}" cy="${y}" r="4" fill="${on ? "#fff" : C.faint}"/>`;
    out += `<text x="${x+40}" y="${y+5}" font-family="sans-serif" font-size="16" font-weight="${on ? 700 : 600}" fill="${txtC}">${steps[i]}</text>`;
  }
  return out;
}

function card(x, y, w, h, fill, stroke) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill || C.panel}" stroke="${stroke || C.line}" stroke-width="1"/>`;
}

function panelTitle(x, y, t) {
  return `<rect x="${x}" y="${y-9}" width="6" height="6" rx="2" fill="${C.clay}"/><text x="${x+14}" y="${y}" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1.2" fill="${C.muted}">${t}</text>`;
}

const MX = 320, MW = 840;

function detail(step) {
  const x = MX, w = MW, y = 120, h = 480;
  let inner = "";
  if (step === 0) {
    inner = card(x, y, w, h) + panelTitle(x+26, y+34, "YOUR REQUEST") +
      `<rect x="${x+26}" y="${y+60}" width="${w-52}" height="120" rx="12" fill="${C.clayFaint}" stroke="${C.claySoft}"/>
       <text x="${x+46}" y="${y+102}" font-family="sans-serif" font-size="19" fill="${C.ink}">Update the README intro to lead with trust and privacy.</text>
       <text x="${x+46}" y="${y+132}" font-family="sans-serif" font-size="15" fill="${C.muted}">Show me the diff before changing anything.</text>
       <rect x="${x+26}" y="${y+220}" width="${w-52}" height="56" rx="12" fill="${C.panel2}" stroke="${C.line}"/>
       <text x="${x+46}" y="${y+254}" font-family="sans-serif" font-size="15" fill="${C.faint}">Ask the agent to explain, draft, code, or edit selected files…</text>
       <rect x="${x+w-120}" y="${y+228}" width="84" height="40" rx="10" fill="${C.ink}"/>
       <text x="${x+w-78}" y="${y+253}" font-family="sans-serif" font-size="14" font-weight="700" fill="${C.bg}" text-anchor="middle">Send</text>`;
  } else if (step === 1) {
    inner = card(x, y, w, h) + panelTitle(x+26, y+34, "SEARCH BEFORE ANSWER") +
      `<text x="${x+26}" y="${y+72}" font-family="sans-serif" font-size="16" fill="${C.inkSoft}">Searched the workspace locally — 3 files matched.</text>` +
      ["search_workspace · README.md", "read_file · README.md", "read_file · docs/ROADMAP.md"].map((t,i)=>
        `<rect x="${x+26}" y="${y+96+i*46}" width="${w-52}" height="36" rx="10" fill="${C.sageSoft}" stroke="#cfe0c6"/>
         <circle cx="${x+46}" cy="${y+114+i*46}" r="4" fill="${C.sage}"/>
         <text x="${x+62}" y="${y+119+i*46}" font-family="monospace" font-size="14" fill="#3c5238">${t}</text>`).join("") +
      `<text x="${x+26}" y="${y+280}" font-family="sans-serif" font-size="13" fill="${C.muted}">Every search is shown as a receipt. No hidden calls, no cloud.</text>`;
  } else if (step === 2) {
    inner = card(x, y, w, h) +
      `<rect x="${x}" y="${y}" width="${w}" height="48" rx="14" fill="${C.clayFaint}"/>
       <rect x="${x}" y="${y+34}" width="${w}" height="14" fill="${C.clayFaint}"/>
       <text x="${x+26}" y="${y+30}" font-family="sans-serif" font-size="14" font-weight="700" fill="${C.clayDeep}">Diff preview — README.md</text>
       <rect x="${x+w-130}" y="${y+10}" width="104" height="30" rx="9" fill="${C.clay}"/>
       <text x="${x+w-78}" y="${y+30}" font-family="sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">Apply</text>
       <rect x="${x+1}" y="${y+58}" width="${w-2}" height="${h-70}" rx="12" fill="#26241f"/>` +
      [["-","AgentTrail is a tiny, auditable local AI agent kit.","#e88b74"],
       ["+","A local AI agent that shows its work — every search,","#9ed29a"],
       ["+","edit, and reason. On your machine. Nothing leaves.","#9ed29a"],
       [" ","","#bdb8ac"],
       ["+","Search before answer · Diff before write · Receipt","#9ed29a"],
       ["+","for every run.","#9ed29a"]].map((r,i)=>
        `<text x="${x+28}" y="${y+92+i*30}" font-family="monospace" font-size="15" fill="${r[2]}">${r[0]==="-"?"−":r[0]}  ${esc(r[1])}</text>`).join("");
  } else if (step === 3) {
    inner = card(x, y, w, h) +
      `<rect x="${x}" y="${y}" width="${w}" height="48" rx="14" fill="${C.sageSoft}"/>
       <rect x="${x}" y="${y+34}" width="${w}" height="14" fill="${C.sageSoft}"/>
       <text x="${x+26}" y="${y+30}" font-family="sans-serif" font-size="14" font-weight="700" fill="#3c5238">README.md — change applied</text>
       <rect x="${x+w-150}" y="${y+10}" width="124" height="30" rx="9" fill="${C.sage}"/>
       <path d="M${x+w-128} ${y+25} l6 6 l12 -12" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
       <text x="${x+w-92}" y="${y+30}" font-family="sans-serif" font-size="13" font-weight="700" fill="#fff">Applied</text>
       <rect x="${x+1}" y="${y+58}" width="${w-2}" height="${h-70}" rx="12" fill="${C.panel2}" stroke="${C.line}"/>
       <circle cx="${x+w/2}" cy="${y+200}" r="44" fill="${C.sageSoft}" stroke="#cfe0c6"/>
       <path d="M${x+w/2-20} ${y+200} l13 13 l26 -26" stroke="${C.sage}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
       <text x="${x+w/2}" y="${y+290}" font-family="sans-serif" font-size="17" font-weight="700" fill="${C.ink}" text-anchor="middle">You approved the write.</text>
       <text x="${x+w/2}" y="${y+318}" font-family="sans-serif" font-size="14" fill="${C.muted}" text-anchor="middle">Writes are off by default. The agent never edits without your click.</text>`;
  } else {
    inner = card(x, y, w, h) + panelTitle(x+26, y+34, "RECEIPT · REPLAYABLE") +
      `<rect x="${x+26}" y="${y+56}" width="${w-52}" height="64" rx="12" fill="${C.panel2}" stroke="${C.line}"/>
       <circle cx="${x+50}" cy="${y+88}" r="6" fill="${C.sage}"/>
       <text x="${x+70}" y="${y+84}" font-family="monospace" font-size="14" font-weight="700" fill="${C.clayDeep}">receipt-2026-05-30-readme.md</text>
       <text x="${x+70}" y="${y+106}" font-family="sans-serif" font-size="13" fill="${C.muted}">prompt · 3 searches · 1 diff applied · model llama3.2 — saved locally</text>
       <rect x="${x+26}" y="${y+136}" width="${(w-64)/2}" height="120" rx="12" fill="${C.clayFaint}" stroke="${C.claySoft}"/>
       <text x="${x+46}" y="${y+168}" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1" fill="${C.clayDeep}">TRUST SCORE</text>
       <text x="${x+46}" y="${y+220}" font-family="Georgia, serif" font-size="42" font-weight="700" fill="${C.clayDeep}">88</text>
       <text x="${x+46+90}" y="${y+220}" font-family="sans-serif" font-size="14" fill="${C.sage}">▲ from 60</text>
       <rect x="${x+42+(w-64)/2}" y="${y+136}" width="${(w-64)/2}" height="120" rx="12" fill="${C.panel2}" stroke="${C.line}"/>
       <text x="${x+62+(w-64)/2}" y="${y+168}" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1" fill="${C.muted}">REPLAY</text>
       <text x="${x+62+(w-64)/2}" y="${y+196}" font-family="sans-serif" font-size="14" fill="${C.inkSoft}">Reopen this run, restore</text>
       <text x="${x+62+(w-64)/2}" y="${y+216}" font-family="sans-serif" font-size="14" fill="${C.inkSoft}">prompt, files, model + diff.</text>
       <text x="${x+62+(w-64)/2}" y="${y+240}" font-family="sans-serif" font-size="13" fill="${C.muted}">Export as Markdown / HTML.</text>
       <text x="${x+26}" y="${y+300}" font-family="sans-serif" font-size="14" fill="${C.muted}">A local agent should show what it searched, read, and changed — and why you can trust it.</text>`;
  }
  return inner;
}

function frame(step) {
  const trust = step >= 4 ? 88 : 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${header(trust)}
  ${rail(step)}
  ${detail(step)}
  </svg>`;
}

const outDir = path.join(__dirname, "demo-frames");
fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < steps.length; i++) {
  fs.writeFileSync(path.join(outDir, `frame_${i}.svg`), frame(i));
}
console.log("wrote", steps.length, "frames to", outDir);
