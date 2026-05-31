"use strict";

const zlib = require("node:zlib");

function makePdf(textOperator, options = {}) {
  const content = `BT /F1 12 Tf 72 720 Td ${textOperator} ET`;
  const stream = options.compress ? zlib.deflateSync(Buffer.from(content, "latin1")) : Buffer.from(content, "latin1");
  const filter = options.compress ? "/Filter /FlateDecode " : "";
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n", "latin1"),
    Buffer.from("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n", "latin1"),
    Buffer.from("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n", "latin1"),
    Buffer.from("3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n", "latin1"),
    Buffer.from("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n", "latin1"),
    Buffer.from(`5 0 obj << ${filter}/Length ${stream.length} >> stream\n`, "latin1"),
    stream,
    Buffer.from("\nendstream endobj\n%%EOF\n", "latin1")
  ]);
}

function makeDocx(text = "AgentTrail DOCX extraction works") {
  return makeZip({
    "[Content_Types].xml": "<Types></Types>",
    "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`
  });
}

function makePptx(text = "AgentTrail PPTX extraction works") {
  return makeZip({
    "[Content_Types].xml": "<Types></Types>",
    "ppt/slides/slide1.xml": `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
  });
}

function makeXlsx(text = "AgentTrail XLSX extraction works") {
  return makeZip({
    "[Content_Types].xml": "<Types></Types>",
    "xl/sharedStrings.xml": `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>${escapeXml(text)}</t></si></sst>`,
    "xl/worksheets/sheet1.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row></sheetData></worksheet>'
  });
}

function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
    const compressed = zlib.deflateRawSync(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuffer, compressed);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = {
  makePdf,
  makeDocx,
  makePptx,
  makeXlsx,
  makeZip
};
