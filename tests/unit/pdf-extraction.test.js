#!/usr/bin/env node

const assert = require("node:assert/strict");
const {
  extractDocumentText,
  extractPdfText,
  extractPdfContentText,
  buildExtractedDocumentMarkdown,
  htmlToMarkdown,
  isImageDocument,
  detectDocumentType
} = require("../../src/document-ingestion");
const { makePdf, makeDocx, makePptx, makeXlsx } = require("../helpers/document-fixtures");

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

const docx = extractDocumentText(makeDocx("AgentTrail DOCX extraction works"), {
  sourcePath: "attachments/sample.docx"
});
assert.equal(docx.ok, true);
assert.equal(docx.type, "docx");
assert.match(docx.text, /AgentTrail DOCX extraction works/);

const pptx = extractDocumentText(makePptx("AgentTrail PPTX extraction works"), {
  sourcePath: "attachments/sample.pptx"
});
assert.equal(pptx.ok, true);
assert.equal(pptx.type, "pptx");
assert.match(pptx.text, /Slide 1/);
assert.match(pptx.text, /AgentTrail PPTX extraction works/);

const xlsx = extractDocumentText(makeXlsx("AgentTrail XLSX extraction works"), {
  sourcePath: "attachments/sample.xlsx"
});
assert.equal(xlsx.ok, true);
assert.equal(xlsx.type, "xlsx");
assert.match(xlsx.text, /Sheet 1/);
assert.match(xlsx.text, /AgentTrail XLSX extraction works/);
assert.match(xlsx.text, /42/);

const html = extractDocumentText("<html><body><h1>AgentTrail HTML</h1><p>Clean paragraph.</p><script>ignore()</script><pre><code>const ok = true;</code></pre></body></html>", {
  sourcePath: "attachments/page.html",
  mediaType: "text/html"
});
assert.equal(html.ok, true);
assert.equal(html.type, "html");
assert.match(html.text, /# AgentTrail HTML/);
assert.match(html.text, /Clean paragraph/);
assert.match(html.text, /```/);
assert.doesNotMatch(html.text, /ignore/);
assert.match(htmlToMarkdown("<h2>A &amp; B</h2>"), /## A & B/);

const markdownDoc = extractDocumentText("# AgentTrail Markdown\n\n- keeps structure\n", {
  sourcePath: "attachments/notes.md",
  mediaType: "text/markdown"
});
assert.equal(markdownDoc.type, "markdown");
assert.match(markdownDoc.text, /# AgentTrail Markdown/);
assert.match(markdownDoc.text, /- keeps structure/);

const codeDoc = extractDocumentText("export const answer = 42;\n", {
  sourcePath: "attachments/example.ts",
  mediaType: "text/plain"
});
assert.equal(codeDoc.type, "code");
assert.match(codeDoc.text, /```typescript/);
assert.match(codeDoc.text, /export const answer = 42/);

assert.equal(isImageDocument("scan.png", "image/png"), true);
assert.equal(detectDocumentType("scan.jpeg", ""), "image");

console.log("Document extraction unit tests passed");
