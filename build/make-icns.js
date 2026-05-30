const fs=require('fs');const p='build/AgentTrail.iconset/';
// OSType -> source png size
const map=[['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024],['ic11',32],['ic12',64],['ic13',256],['ic14',512]];
const parts=[];
for(const [t,s] of map){const png=fs.readFileSync(`${p}icon_${s}.png`);const len=png.length+8;const h=Buffer.alloc(8);h.write(t,0,'ascii');h.writeUInt32BE(len,4);parts.push(h,png);}
const body=Buffer.concat(parts);const head=Buffer.alloc(8);head.write('icns',0,'ascii');head.writeUInt32BE(body.length+8,4);
fs.writeFileSync('build/AgentTrail.icns',Buffer.concat([head,body]));
console.log('icns bytes',body.length+8,'entries',map.length);
