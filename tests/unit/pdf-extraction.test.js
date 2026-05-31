#!/usr/bin/env node

const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { extractPdfText, extractPdfContentText, buildExtractedDocumentMarkdown } = require("../../src/document-ingestion");

const plainPdf = makePdf("(AgentTrail PDF extraction works) Tj");
const plain = extractPdfText(plainPdf, { sourcePath: "attachments/plain.pdf" });
assert.equal(plain.ok, true);
assert.match(plain.text, /AgentTrail PDF extraction works/);
assert.equal(plain.pageCount, 1);
assert.equal(plain.streamsScanned, 1);

const compressedPdf = makePdf("[(Semantic PDF ) -120 (text search)] TJ", { compress: true });
const compressed = extractPdfText(compressedPdf, { sourcePath: "attachments/compressed.pdf" });
assert.equal(compressed.ok, true);
assert.match(compressed.text, /Semantic PDF text search/);

const escaped = extractPdfContentText("BT (Hello\\nPDF \\050demo\\051) Tj T* (Next line) Tj ET");
assert.match(escaped, /Hello\nPDF \(demo\)/);
assert.match(escaped, /Next line/);

const markdown = buildExtractedDocumentMarkdown({
  sourcePath: "attachments/plain.pdf",
  originalName: "plain.pdf",
  mediaType: "application/pdf",
  extraction: plain
});
assert.match(markdown, /# Extracted PDF: plain\.pdf/);
assert.match(markdown, /## Text/);
assert.match(markdown, /AgentTrail PDF extraction works/);

console.log("PDF extraction unit tests passed");

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
