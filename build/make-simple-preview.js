// Faithful mockup of the new chat-first layout (mirrors public/styles.css v15).
const fs = require("fs");
const path = require("path");
const C = {
  bg:"#f0eee6", tint:"#ebe8dd", panel:"#faf9f5", panel2:"#ffffff", ink:"#1f1e1d", inkSoft:"#3c3a36",
  muted:"#75716a", faint:"#9b968c", line:"#e2ddd0", lineS:"#d6d0c0", clay:"#cc785c", clayDeep:"#b35f43",
  claySoft:"#f3e4dc", clayFaint:"#f8efe9", sage:"#5c7257", sageSoft:"#e7eee2", amber:"#c2933b", amberSoft:"#f6ecd5"
};
const W=1280,H=820,SB=248;
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const rr=(x,y,w,h,r,f,st,sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}"${st?` stroke="${st}" stroke-width="${sw}"`:""}/>`;
const t=(x,y,s,o={})=>`<text x="${x}" y="${y}" font-family="${o.f||"sans-serif"}" font-size="${o.s||14}" font-weight="${o.w||400}" fill="${o.c||C.ink}"${o.a?` text-anchor="${o.a}"`:""}${o.ls?` letter-spacing="${o.ls}"`:""}>${esc(s)}</text>`;
const logo=(x,y,sz)=>{const k=sz/96;return `<g transform="translate(${x},${y}) scale(${k})"><defs><linearGradient id="lg" x1="12" y1="10" x2="84" y2="86" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#D58468"/><stop offset="1" stop-color="#B35F43"/></linearGradient></defs><rect x="8" y="8" width="80" height="80" rx="22" fill="url(#lg)"/><rect x="38" y="24" width="34" height="48" rx="8" fill="#F7F4EC"/><path d="M46 36H64M46 46H64M46 56H57" stroke="#2A2723" stroke-width="4.2" stroke-linecap="round"/><path d="M27 33V63" stroke="#F7F4EC" stroke-opacity="0.85" stroke-width="3" stroke-linecap="round"/><circle cx="27" cy="33" r="6.5" fill="#E0AE54"/><circle cx="27" cy="48" r="5.5" fill="#F7F4EC"/><circle cx="27" cy="63" r="5.5" fill="#6E8568"/></g>`;};

let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>`;
// sidebar
s+=`<defs><linearGradient id="sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.tint}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs>`;
s+=rr(0,0,SB,H,0,"url(#sb)")+`<line x1="${SB}" y1="0" x2="${SB}" y2="${H}" stroke="${C.line}"/>`;
s+=logo(14,16,30)+t(54,36,"AgentTrail",{f:"Georgia, serif",s:18,w:600});
// new chat
s+=rr(12,60,SB-24,42,11,C.panel,C.line)+`<path d="M34 81h16M42 73v16" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>`+t(58,86,"New chat",{s:14,w:600});
// mid
s+=t(20,140,"PRIVATE & LOCAL",{s:10,w:700,c:C.muted,ls:1.2})+t(20,162,"Your chats and files stay on",{s:12.5,c:C.muted})+t(20,180,"this machine. Nothing leaves.",{s:12.5,c:C.muted});
// bottom
s+=t(20,H-58,"Connected - llama3.2",{s:11,c:C.faint});
s+=rr(12,H-44,SB-24,38,11,"none",C.line)+`<circle cx="32" cy="${H-25}" r="7" fill="none" stroke="${C.muted}" stroke-width="2"/><circle cx="32" cy="${H-25}" r="2.4" fill="${C.muted}"/>`+t(48,H-20,"Tools & settings",{s:13,w:600,c:C.inkSoft});

// ---- main ----
const MX=SB;
// topbar
s+=rr(MX,0,W-MX,58,0,"rgba(250,249,245,0.6)")+`<line x1="${MX}" y1="58" x2="${W}" y2="58" stroke="${C.line}"/>`;
s+=t(MX+22,36,"llama3.2",{s:15,w:600})+t(MX+96,36,"v",{s:13,c:C.faint});
// right
s+=rr(W-150,15,86,28,14,C.clayFaint,C.claySoft)+t(W-136,33,"Trust",{s:12,w:600,c:C.clayDeep})+t(W-78,34,"88",{f:"Georgia, serif",s:15,w:700,c:C.clayDeep});
s+=`<path d="M${W-46} 22h22M${W-46} 29h22M${W-46} 36h22" stroke="${C.muted}" stroke-width="2" stroke-linecap="round"/>`;

// messages centered, column max 792 centered in main (MX..W)
const colW=792, colX=MX+((W-MX)-colW)/2;
// user bubble (right aligned)
let y=96;
const ubw=420;
s+=rr(colX+colW-ubw-46,y,ubw,52,14,C.clayFaint,C.claySoft)+t(colX+colW-ubw-46+20,y+31,"Summarize this file and show me the diff first.",{s:14.5,c:C.ink});
s+=rr(colX+colW-36,y,36,36,10,C.clay)+t(colX+colW-18,y+24,"B",{s:13,w:700,c:"#fff",a:"middle"});
// assistant bubble (left)
y+=84;
s+=rr(colX,y,36,36,10,C.ink)+t(colX+18,y+24,"A",{s:13,w:700,c:C.bg,a:"middle"});
const abx=colX+48, abw=560;
s+=rr(abx,y,abw,118,14,C.panel,C.line);
s+=t(abx+20,y+32,"Searched the workspace and read the file. Here's a",{s:14.5,c:C.inkSoft});
s+=t(abx+20,y+54,"tighter summary - review the proposed change below.",{s:14.5,c:C.inkSoft});
s+=rr(abx+20,y+72,150,28,14,C.amberSoft,"#e6d4a6")+`<circle cx="${abx+36}" cy="${y+86}" r="4" fill="${C.amber}"/>`+t(abx+48,y+91,"read_file x1",{s:12,w:600,c:"#6b4f17"});
s+=rr(abx+180,y+72,166,28,14,C.sageSoft,"#cfe0c6")+`<path d="M${abx+196} ${y+86} l4 4 l8 -8" stroke="${C.sage}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`+t(abx+212,y+91,"preview_write_file",{s:12,w:600,c:"#3c5238"});

// ---- composer area (bottom) ----
const cy=H-150;
// suggestions
const chips=["Summarize","Plan","Review","Search"]; let cx=colX+(colW-(chips.reduce((a,c)=>a+c.length*8+40,0)))/2;
chips.forEach(ch=>{const w=ch.length*8+30; s+=rr(cx,cy,w,32,16,C.panel,C.line)+t(cx+w/2,cy+21,ch,{s:13,w:500,c:C.muted,a:"middle"}); cx+=w+8;});
// composer pill
const py=cy+48, ph=58;
s+=rr(colX,py,colW,ph,26,C.panel2,C.lineS,1.4);
// paperclip
s+=`<path d="M${colX+34} ${py+22} l-12 12 a5 5 0 0 0 7 7 l14 -14 a8 8 0 0 0 -11 -11 l-14 14 a11 11 0 0 0 15 15 l12 -12" fill="none" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6,-4) scale(0.8)"/>`;
s+=t(colX+58,py+35,"Message AgentTrail...",{s:15,c:C.faint});
// circular send
s+=`<circle cx="${colX+colW-32}" cy="${py+ph/2}" r="19" fill="${C.ink}"/>`+`<path d="M${colX+colW-32} ${py+ph/2+7} V${py+ph/2-7} M${colX+colW-39} ${py+ph/2} l7 -7 l7 7" stroke="${C.bg}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
// tools row
s+=t(colX+8,py+ph+26,"Steps",{s:12,w:600,c:C.muted})+rr(colX+50,py+ph+12,46,24,8,C.panel,C.line)+t(colX+62,py+ph+28,"3",{s:12,c:C.inkSoft});
s+=rr(colX+108,py+ph+12,84,24,8,"none",C.line)+t(colX+150,py+ph+28,"Plan first",{s:12,w:600,c:C.inkSoft,a:"middle"});
s+=t(colX+colW,py+ph+27,"Local - nothing leaves your machine",{s:11,c:C.faint,a:"end"});

s+="</svg>";
const dir=path.join(__dirname,"simple");
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,"simple-preview.svg"),s);
console.log("wrote simple-preview.svg");
