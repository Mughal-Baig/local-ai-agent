#!/usr/bin/env node

const fsp = require("node:fs/promises");
const path = require("node:path");

const scale = 1;
const baseWidth = 640;
const baseHeight = 360;
const width = baseWidth * scale;
const height = baseHeight * scale;
const outPath = path.resolve(__dirname, "../docs/agenttrail-demo.gif");
const palette = [
  [244, 247, 245],
  [255, 255, 255],
  [31, 36, 48],
  [36, 107, 98],
  [228, 240, 237],
  [195, 91, 67],
  [217, 155, 43],
  [214, 222, 217],
  [23, 76, 70],
  [247, 231, 226],
  [237, 243, 240],
  [255, 244, 216],
  [145, 170, 164],
  [125, 47, 30],
  [101, 72, 20],
  [0, 0, 0]
];

async function main() {
  const frames = [
    drawFrame(0, "SEARCH", "semantic index finds local context"),
    drawFrame(1, "DIFF PREVIEW", "agent proposes a safe patch"),
    drawFrame(2, "APPLY", "human approves the exact change"),
    drawFrame(3, "RECEIPT", "run is saved and replayable"),
    drawFrame(4, "REPORT", "shareable proof is exported")
  ];
  await fsp.writeFile(outPath, encodeGif(frames, 115));
  console.log(`Wrote ${outPath}`);
}

function drawFrame(activeStep, title, subtitle) {
  const pixels = new Uint8Array(width * height).fill(0);

  fill(pixels, 0, 0, width, height, 0);
  fill(pixels, 20, 20, 190, 320, 10);
  rect(pixels, 20, 20, 190, 320, 7);
  fill(pixels, 230, 20, 390, 70, 1);
  rect(pixels, 230, 20, 390, 70, 7);
  fill(pixels, 230, 108, 390, 190, 1);
  rect(pixels, 230, 108, 390, 190, 7);
  fill(pixels, 230, 315, 390, 25, 1);
  rect(pixels, 230, 315, 390, 25, 7);

  drawText(pixels, 44, 44, "AGENTTRAIL", 3, 2);
  drawText(pixels, 44, 66, "LOCAL LAYER", 8, 2);
  drawText(pixels, 248, 38, title, activeStep >= 3 ? 5 : 3, 3);
  drawText(pixels, 248, 68, subtitle.toUpperCase(), 2, 1);

  const steps = [
    ["SEARCH", 52, 112, 0],
    ["DIFF", 52, 152, 1],
    ["APPLY", 52, 192, 2],
    ["RECEIPT", 52, 232, 3],
    ["REPORT", 52, 272, 4]
  ];
  for (const [label, x, y, index] of steps) {
    fill(pixels, x, y, 122, 34, index === activeStep ? 4 : 1);
    rect(pixels, x, y, 122, 34, index === activeStep ? 3 : 7);
    drawText(pixels, x + 12, y + 12, label, index === activeStep ? 8 : 2, 1);
  }

  if (activeStep === 0) {
    drawSearch(pixels);
  } else if (activeStep === 1) {
    drawDiff(pixels);
  } else if (activeStep === 2) {
    drawApply(pixels);
  } else if (activeStep === 3) {
    drawReceipt(pixels);
  } else {
    drawReport(pixels);
  }

  drawTrust(pixels, activeStep);
  return pixels;
}

function drawSearch(pixels) {
  drawText(pixels, 250, 126, "QUERY  TRUST SCORE", 2, 2);
  fill(pixels, 250, 154, 270, 28, 4);
  rect(pixels, 250, 154, 270, 28, 3);
  drawText(pixels, 266, 164, "SEARCH WORKSPACE RECEIPTS", 8, 1);
  for (let i = 0; i < 3; i += 1) {
    fill(pixels, 250, 198 + i * 34, 320, 24, i === 0 ? 11 : 1);
    rect(pixels, 250, 198 + i * 34, 320, 24, 7);
    drawText(pixels, 264, 207 + i * 34, i === 0 ? "SEMANTIC HIT" : "LOCAL FILE", i === 0 ? 14 : 2, 1);
  }
}

function drawDiff(pixels) {
  drawText(pixels, 250, 126, "PENDING CHANGE", 2, 2);
  fill(pixels, 250, 154, 330, 118, 2);
  rect(pixels, 250, 154, 330, 118, 7);
  drawText(pixels, 266, 170, "--- A NOTE MD", 12, 1);
  drawText(pixels, 266, 196, "+++ B NOTE MD", 12, 1);
  drawText(pixels, 266, 222, "+ ADD SAFER PLAN", 4, 1);
  drawText(pixels, 266, 248, "+ SAVE RECEIPT", 4, 1);
}

function drawApply(pixels) {
  drawText(pixels, 250, 126, "HUMAN APPROVAL", 2, 2);
  fill(pixels, 276, 166, 130, 54, 3);
  rect(pixels, 276, 166, 130, 54, 8);
  drawText(pixels, 310, 187, "APPLY", 1, 2);
  fill(pixels, 430, 166, 130, 54, 9);
  rect(pixels, 430, 166, 130, 54, 5);
  drawText(pixels, 460, 187, "REJECT", 13, 2);
  drawText(pixels, 276, 246, "WRITE ONLY AFTER CLICK", 2, 1);
}

function drawReceipt(pixels) {
  drawText(pixels, 250, 126, "REPLAYABLE SESSION", 2, 2);
  fill(pixels, 250, 154, 330, 130, 1);
  rect(pixels, 250, 154, 330, 130, 3);
  drawText(pixels, 270, 174, "MODEL  FILES  TOOLS", 8, 1);
  drawText(pixels, 270, 204, "DIFFS  TRUST  CITATIONS", 8, 1);
  drawText(pixels, 270, 234, "EXPORT HTML REPORT", 5, 1);
  drawText(pixels, 270, 264, "REPLAY THIS RUN", 3, 1);
}

function drawReport(pixels) {
  drawText(pixels, 250, 126, "SHAREABLE REPORT", 2, 2);
  fill(pixels, 250, 154, 330, 130, 1);
  rect(pixels, 250, 154, 330, 130, 3);
  fill(pixels, 268, 174, 294, 26, 4);
  rect(pixels, 268, 174, 294, 26, 3);
  drawText(pixels, 284, 183, "TRUST LOOP VERIFIED", 8, 1);
  drawText(pixels, 270, 216, "TIMELINE DIFFS CITATIONS", 2, 1);
  drawText(pixels, 270, 246, "MODEL FILES RECEIPT", 2, 1);
  drawText(pixels, 270, 272, "EXPORT HTML", 5, 1);
}

function drawTrust(pixels, activeStep) {
  const score = [68, 78, 88, 96, 100][activeStep] || 100;
  fill(pixels, 250, 324, Math.round(3.1 * score), 8, 3);
  drawText(pixels, 250, 300, `TRUST ${score}`, 3, 2);
}

function fill(pixels, x, y, w, h, color) {
  const left = Math.round(x * scale);
  const top = Math.round(y * scale);
  const right = Math.round((x + w) * scale);
  const bottom = Math.round((y + h) * scale);
  for (let yy = Math.max(0, top); yy < Math.min(height, bottom); yy += 1) {
    for (let xx = Math.max(0, left); xx < Math.min(width, right); xx += 1) {
      pixels[yy * width + xx] = color;
    }
  }
}

function rect(pixels, x, y, w, h, color) {
  fill(pixels, x, y, w, 2, color);
  fill(pixels, x, y + h - 2, w, 2, color);
  fill(pixels, x, y, 2, h, color);
  fill(pixels, x + w - 2, y, 2, h, color);
}

function drawText(pixels, x, y, text, color, scale) {
  let cursor = x;
  for (const char of String(text)) {
    if (char === " ") {
      cursor += 4 * scale;
      continue;
    }
    const glyph = FONT[char] || FONT["?"];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === "1") {
          fill(pixels, cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cursor += 6 * scale;
  }
}

function encodeGif(framePixels, delayCs) {
  const bytes = [];
  writeString(bytes, "GIF89a");
  writeShort(bytes, width);
  writeShort(bytes, height);
  bytes.push(0xf7, 0, 0);
  for (let i = 0; i < 256; i += 1) {
    const color = palette[i] || [0, 0, 0];
    bytes.push(color[0], color[1], color[2]);
  }
  bytes.push(0x21, 0xff, 0x0b);
  writeString(bytes, "NETSCAPE2.0");
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);

  for (const pixels of framePixels) {
    bytes.push(0x21, 0xf9, 0x04, 0x04);
    writeShort(bytes, delayCs);
    bytes.push(0x00, 0x00);
    bytes.push(0x2c);
    writeShort(bytes, 0);
    writeShort(bytes, 0);
    writeShort(bytes, width);
    writeShort(bytes, height);
    bytes.push(0x00);
    bytes.push(0x08);
    const imageData = lzwEncode(pixels);
    for (let i = 0; i < imageData.length; i += 255) {
      const block = imageData.slice(i, i + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0x00);
  }

  bytes.push(0x3b);
  return Buffer.from(bytes);
}

function lzwEncode(indices) {
  const clear = 256;
  const end = 257;
  const codes = [clear];
  let sinceClear = 0;
  for (const index of indices) {
    codes.push(index);
    sinceClear += 1;
    if (sinceClear >= 240) {
      codes.push(clear);
      sinceClear = 0;
    }
  }
  codes.push(end);

  const out = [];
  let current = 0;
  let bits = 0;
  for (const code of codes) {
    current |= code << bits;
    bits += 9;
    while (bits >= 8) {
      out.push(current & 0xff);
      current >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) {
    out.push(current & 0xff);
  }
  return out;
}

function writeString(bytes, value) {
  for (let i = 0; i < value.length; i += 1) {
    bytes.push(value.charCodeAt(i));
  }
}

function writeShort(bytes, value) {
  bytes.push(value & 0xff, (value >> 8) & 0xff);
}

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"]
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
