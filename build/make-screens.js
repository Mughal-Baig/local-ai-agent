// Generates high-fidelity preview images of the redesigned AgentTrail UI.
// Mirrors public/styles.css (warm "ink & clay"). Run: node build/make-screens.js
const fs = require("fs");
const path = require("path");

const C = {
  bg: "#f0eee6", tint: "#ebe8dd", panel: "#faf9f5", panel2: "#ffffff", ink: "#1f1e1d",
  inkSoft: "#3c3a36", muted: "#75716a", faint: "#9b968c", line: "#e2ddd0", lineS: "#d6d0c0",
  clay: "#cc785c", clayDeep: "#b35f43", claySoft: "#f3e4dc", clayFaint: "#f8efe9",
  sage: "#5c7257", sageSoft: "#e7eee2", amber: "#c2933b", amberSoft: "#f6ecd5",
};
const S = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rrect = (x,y,w,h,r,f,st,sw=1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}"${st?` stroke="${st}" stroke-width="${sw}"`:""}/>`;
const txt = (x,y,s,o={}) => `<text x="${x}" y="${y}" font-family="${o.f||"sans-serif"}" font-size="${o.s||14}" font-weight="${o.w||400}" fill="${o.c||C.ink}"${o.a?` text-anchor="${o.a}"`:""}${o.ls?` letter-spacing="${o.ls}"`:""}>${S(s)}</text>`;
const chevron = (x,y) => `<path d="M${x} ${y} l5 5 l5 -5" stroke="${C.faint}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const brandMark = (x,y,sz=40) => {
  const k = sz/40;
  return rrect(x,y,sz,sz,11*k,C.clay) +
    rrect(x+sz*0.5,y+sz*0.27,sz*0.32,sz*0.46,3,C.clayFaint) +
    `<circle cx="${x+sz*0.32}" cy="${y+sz*0.3}" r="${3.4*k}" fill="${C.amber}"/>` +
    `<circle cx="${x+sz*0.32}" cy="${y+sz*0.5}" r="${3*k}" fill="${C.clayFaint}"/>` +
    `<circle cx="${x+sz*0.32}" cy="${y+sz*0.7}" r="${3*k}" fill="${C.sage}"/>`;
};
const panelHead = (x,y,t) => `<rect x="${x}" y="${y-9}" width="6" height="6" rx="2" fill="${C.clay}"/>` + txt(x+13,y,t,{s:12,w:700,c:C.muted,ls:0.6});

function appOverview() {
  const W=1280,H=824, SB=372;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  // window chrome
  s += rrect(0,0,W,H,0,C.bg);
  // sidebar
  s += `<defs><linearGradient id="sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.tint}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs>`;
  s += rrect(0,0,SB,H,0,"url(#sb)") + `<line x1="${SB}" y1="0" x2="${SB}" y2="${H}" stroke="${C.line}"/>`;
  // brand
  s += brandMark(22,24,46) + txt(82,46,"AgentTrail",{f:"Georgia, serif",s:21,w:600}) + txt(82,64,"Connected · llama3.2",{s:12,c:C.muted});
  // Essentials group (open)
  let y=104;
  s += txt(28,y,"ESSENTIALS",{s:11,w:700,c:C.muted,ls:1}) + chevron(SB-44,y-5);
  s += `<path d="M${SB-44} ${y-5} l5 5 l5 -5" stroke="${C.faint}" stroke-width="2" fill="none" transform="rotate(180 ${SB-39} ${y-3})"/>`;
  // Model panel
  y=124;
  s += rrect(20,y,SB-40,96,12,C.panel,C.line) + panelHead(36,y+24,"MODEL");
  s += rrect(36,y+38,SB-72,40,9,C.panel2,C.line) + txt(50,y+63,"llama3.2",{s:14,w:600}) + chevron(SB-58,y+54);
  // Workspace panel
  y+=112;
  s += rrect(20,y,SB-40,168,12,C.panel,C.line) + panelHead(36,y+24,"WORKSPACE");
  const files=[["welcome.md","2 KB",true],["roadmap.md","6 KB",false],["notes/launch.md","4 KB",false]];
  files.forEach((f,i)=>{const fy=y+40+i*40; const sel=f[2];
    s += rrect(36,fy,SB-72,32,9,sel?C.clayFaint:C.panel2,sel?C.clay:C.line);
    if(sel) s += rrect(36,fy,3,32,0,C.clay);
    s += txt(50,fy+21,f[0],{s:13.5,w:600,c:C.ink}) + txt(SB-58,fy+21,f[1],{s:12,c:C.faint,a:"end"});});
  // Agent Trail panel
  y+=184;
  s += rrect(20,y,SB-40,162,12,C.panel,C.line) + panelHead(36,y+24,"AGENT TRAIL");
  const trail=[["Read welcome.md",C.sage],["search_workspace · 3 hits",C.amber],["Proposed diff · README.md",C.amber],["Applied · README.md",C.sage]];
  trail.forEach((t,i)=>{const ty=y+40+i*30; s += rrect(36,ty,SB-72,24,8,C.panel2,C.line) + `<circle cx="${50}" cy="${ty+12}" r="4" fill="${t[1]}"/>` + txt(64,ty+16,t[0],{s:12.5,w:600,c:C.inkSoft});});
  // collapsed groups
  y+=178;
  ["Trust & Safety","Search & Recipes","History","Setup","Labs"].forEach((g,i)=>{const gy=y+i*40;
    s += `<line x1="20" y1="${gy}" x2="${SB-20}" y2="${gy}" stroke="${C.line}"/>` + txt(28,gy+24,g.toUpperCase(),{s:11,w:700,c:C.muted,ls:1}) + chevron(SB-44,gy+18);});

  // ===== main =====
  const MX=SB;
  // topbar
  s += rrect(MX,0,W-MX,82,0,C.panel) + `<line x1="${MX}" y1="82" x2="${W}" y2="82" stroke="${C.line}"/>`;
  s += txt(MX+30,34,"PRIVATE LOCAL ASSISTANT",{s:11,w:700,c:C.clayDeep,ls:1.4});
  s += txt(MX+30,62,"Auditable local agent with recipes, search, and receipts",{f:"Georgia, serif",s:21,w:600});
  s += rrect(W-186,26,150,32,16,C.sageSoft,"#cfe0c6") + txt(W-111,46,"Workspace ready",{s:13,w:600,c:"#3c5238",a:"middle"});
  // prompt strip
  let py=104; const chips=["Summarize","Plan","Review","Search","Save note"]; let cx=MX+30;
  chips.forEach(ch=>{const w=ch.length*8+30; s += rrect(cx,py,w,34,17,C.panel,C.line) + txt(cx+w/2,py+22,ch,{s:13.5,w:600,c:C.inkSoft,a:"middle"}); cx+=w+10;});
  s += `<line x1="${MX}" y1="158" x2="${W}" y2="158" stroke="${C.line}"/>`;
  // trust dashboard
  let ty2=176;
  s += rrect(MX+30,ty2,158,76,12,C.clayFaint,C.claySoft) + txt(MX+46,ty2+26,"TRUST SCORE",{s:11,w:700,c:C.clayDeep,ls:0.8}) + txt(MX+46,ty2+62,"88",{f:"Georgia, serif",s:30,w:700,c:C.clayDeep});
  const reasons=[["Evidence shown",true],["Diff previewed",true],["Receipt saved",true],["Writes gated",true],["Eval passed",true]];
  let rx=MX+204, ry=ty2+6;
  reasons.forEach((r,i)=>{const w=r[0].length*7.4+34; if(rx+w>W-30){rx=MX+204; ry+=40;} s += rrect(rx,ry,w,32,16,C.sageSoft,"#cfe0c6") + `<path d="M${rx+14} ${ry+16} l4 4 l8 -8" stroke="${C.sage}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` + txt(rx+28,ry+21,r[0],{s:12.5,w:600,c:"#3c5238"}); rx+=w+8;});
  s += `<line x1="${MX}" y1="266" x2="${W}" y2="266" stroke="${C.line}"/>`;
  // messages
  // user bubble (right)
  let my=300;
  const ub="Update the README intro to lead with trust. Show me the diff first.";
  s += rrect(W-30-560,my,560,64,14,C.clayFaint,C.claySoft) + txt(W-30-560+22,my+28,"Update the README intro to lead with trust.",{s:15,c:C.ink}) + txt(W-30-560+22,my+50,"Show me the diff first.",{s:15,c:C.ink});
  s += rrect(W-30-36,my,36,36,10,C.clay) + txt(W-30-18,my+24,"B",{s:14,w:700,c:"#fff",a:"middle"});
  // assistant bubble (left)
  my+=92;
  s += rrect(MX+30,my,36,36,10,C.ink) + txt(MX+48,my+24,"A",{s:14,w:700,c:C.bg,a:"middle"});
  const aw=620, ax=MX+78;
  s += rrect(ax,my,aw,150,14,C.panel,C.line);
  s += txt(ax+22,my+34,"Searched 3 files, then drafted a tighter intro. Here is the",{s:15,c:C.inkSoft});
  s += txt(ax+22,my+58,"proposed change — review and Apply when you're ready:",{s:15,c:C.inkSoft});
  // tool chips
  s += rrect(ax+22,my+78,168,30,15,C.amberSoft,"#e6d4a6") + `<circle cx="${ax+38}" cy="${my+93}" r="4" fill="${C.amber}"/>` + txt(ax+50,my+98,"search_workspace",{s:12.5,w:600,c:"#6b4f17"});
  s += rrect(ax+200,my+78,150,30,15,C.amberSoft,"#e6d4a6") + `<circle cx="${ax+216}" cy="${my+93}" r="4" fill="${C.amber}"/>` + txt(ax+228,my+98,"read_file ×2",{s:12.5,w:600,c:"#6b4f17"});
  s += rrect(ax+360,my+78,180,30,15,C.sageSoft,"#cfe0c6") + `<path d="M${ax+376} ${my+93} l4 4 l8 -8" stroke="${C.sage}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` + txt(ax+392,my+98,"preview_write_file",{s:12.5,w:600,c:"#3c5238"});
  // mini diff inside bubble
  s += rrect(ax+22,my+118,aw-44,22,6,"#26241f");
  // composer
  const fy=H-92;
  s += `<line x1="${MX}" y1="${fy-14}" x2="${W}" y2="${fy-14}" stroke="${C.line}"/>`;
  s += rrect(MX+30,fy,96,52,12,C.panel2,C.line) + txt(MX+78,fy+32,"Attach",{s:14,w:700,c:C.inkSoft,a:"middle"});
  s += rrect(MX+136,fy,W-MX-136-30-120,52,12,C.panel2,C.line) + txt(MX+156,fy+32,"Ask the agent to explain, draft, code, or edit selected files…",{s:14,c:C.faint});
  s += rrect(W-30-104,fy,104,52,12,C.ink) + txt(W-30-52,fy+32,"Send",{s:14,w:700,c:C.bg,a:"middle"});
  s += "</svg>";
  return s;
}

function diffCloseup() {
  const W=1100,H=640;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  // assistant avatar + diff card
  const x=40,y=40,w=W-80;
  s += rrect(x,y,36,36,10,C.ink) + txt(x+18,y+24,"A",{s:14,w:700,c:C.bg,a:"middle"});
  s += txt(x+52,y+24,"Proposed change to README.md — writes are off by default, so nothing changed yet.",{s:15,c:C.inkSoft});
  // diff card
  const dy=y+56, dw=w;
  s += rrect(x,dy,dw,360,14,C.panel,C.lineS);
  s += rrect(x,dy,dw,52,14,C.clayFaint) + rrect(x,dy+38,dw,14,0,C.clayFaint);
  s += txt(x+24,dy+32,"Diff preview — README.md",{s:14,w:700,c:C.clayDeep});
  s += rrect(x+dw-128,dy+11,104,30,9,C.clay) + txt(x+dw-76,dy+31,"Apply",{s:13,w:700,c:"#fff",a:"middle"});
  s += rrect(x+10,dy+62,dw-20,286,12,"#26241f");
  const lines=[["-","AgentTrail is a tiny, auditable local AI agent kit.","#e88b74"],
    ["+","A local AI agent that shows its work — every search,","#9ed29a"],
    ["+","edit, and reason. On your machine. Nothing leaves.","#9ed29a"],
    [" ","","#bdb8ac"],
    ["+","Live demo, zero install · search before answer ·","#9ed29a"],
    ["+","diff before write · replayable receipt for every run.","#9ed29a"]];
  lines.forEach((l,i)=> s += txt(x+34,dy+96+i*34,(l[0]==="-"?"−":l[0])+"  "+l[1],{f:"monospace",s:15,c:l[2]}));
  // receipt row below
  const ry=dy+384;
  s += panelHead(x+16,ry,"RECEIPT · REPLAYABLE");
  s += rrect(x,ry+14,dw,72,12,C.panel2,C.line) + `<circle cx="${x+26}" cy="${ry+50}" r="6" fill="${C.sage}"/>`;
  s += txt(x+46,ry+46,"receipt-2026-05-30-readme.md",{f:"monospace",s:14,w:700,c:C.clayDeep});
  s += txt(x+46,ry+68,"prompt · 3 searches · 1 diff applied · model llama3.2 — saved to workspace/receipts/",{s:13,c:C.muted});
  s += rrect(x+dw-150,ry+30,126,32,9,C.sageSoft,"#cfe0c6") + txt(x+dw-87,ry+51,"Replay run",{s:13,w:700,c:"#3c5238",a:"middle"});
  s += "</svg>";
  return s;
}

const dir = path.join(__dirname, "screens");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "preview-app.svg"), appOverview());
fs.writeFileSync(path.join(dir, "preview-diff.svg"), diffCloseup());
console.log("wrote preview SVGs to", dir);
