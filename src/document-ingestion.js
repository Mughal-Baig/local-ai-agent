"use strict";

const path = require("node:path");
const zlib = require("node:zlib");

function isPdfDocument(filePath, mediaType = "") {
  return /\.pdf$/i.test(String(filePath || "")) || String(mediaType || "").toLowerCase().includes("application/pdf");
}

function extractPdfText(input, options = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || "");
  const raw = buffer.toString("latin1");
  if (!raw.includes("%PDF")) {
    throw new Error("File does not look like a PDF.");
  }

  const warnings = [];
  const streams = extractPdfStreams(raw);
  const chunks = [];

  for (const stream of streams) {
    let decoded;
    try {
      decoded = decodePdfStream(stream);
    } catch (error) {
      warnings.push(`Skipped stream: ${error.message}`);
      continue;
    }

    const content = decoded.toString("latin1");
    if (!/\bBT\b|Tj\b|TJ\b/.test(content)) {
      continue;
    }
    const text = extractPdfContentText(content);
    if (text) {
      chunks.push(text);
    }
  }

  if (!chunks.length) {
    const fallback = extractPdfContentText(raw);
    if (fallback) {
      chunks.push(fallback);
      warnings.push("Used whole-file text fallback; stream decoding found no text objects.");
    }
  }

  const text = cleanExtractedText(chunks.join("\n"));
  return {
    ok: Boolean(text),
    type: "pdf",
    sourcePath: options.sourcePath || "",
    text,
    charCount: text.length,
    pageCount: countPdfPages(raw),
    streamsScanned: streams.length,
    warnings
  };
}

function buildExtractedDocumentMarkdown({ sourcePath, originalName, mediaType, extraction }) {
  const text = extraction && extraction.text ? extraction.text : "";
  const warnings = extraction && extraction.warnings && extraction.warnings.length
    ? extraction.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- none";
  return [
    `# Extracted PDF: ${originalName || path.basename(sourcePath || "document.pdf")}`,
    "",
    `- Source file: ${sourcePath}`,
    `- Media type: ${mediaType || "application/pdf"}`,
    `- Pages detected: ${extraction && extraction.pageCount ? extraction.pageCount : "unknown"}`,
    `- Extracted characters: ${text.length}`,
    "",
    "## Extraction Warnings",
    "",
    warnings,
    "",
    "## Text",
    "",
    text || "No selectable text was found in this PDF."
  ].join("\n");
}

function extractPdfStreams(raw) {
  const streams = [];
  const pattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    const dictionaryStart = raw.lastIndexOf("<<", match.index);
    const dictionaryEnd = raw.lastIndexOf(">>", match.index);
    const dictionary = dictionaryStart !== -1 && dictionaryEnd !== -1 && dictionaryEnd > dictionaryStart
      ? raw.slice(dictionaryStart, dictionaryEnd + 2)
      : "";
    streams.push({
      dictionary,
      data: Buffer.from(match[1], "latin1")
    });
  }
  return streams;
}

function decodePdfStream(stream) {
  const filter = stream.dictionary.match(/\/Filter\s*(?:\/([A-Za-z0-9]+)|\[\s*\/([A-Za-z0-9]+))/);
  const filterName = filter ? filter[1] || filter[2] : "";
  if (!filterName) {
    return stream.data;
  }
  if (filterName === "FlateDecode" || filterName === "Fl") {
    try {
      return zlib.inflateSync(stream.data);
    } catch {
      return zlib.inflateRawSync(stream.data);
    }
  }
  throw new Error(`unsupported PDF stream filter ${filterName}`);
}

function extractPdfContentText(content) {
  const tokens = tokenizePdfContent(content);
  const stack = [];
  const lines = [];
  let current = "";

  function appendText(value) {
    const text = String(value || "");
    if (!text) {
      return;
    }
    current += text;
  }

  function newline() {
    const line = current.trim();
    if (line) {
      lines.push(line);
    }
    current = "";
  }

  for (const token of tokens) {
    if (token.type === "arrayEnd") {
      const items = [];
      while (stack.length) {
        const item = stack.pop();
        if (item && item.type === "arrayStart") {
          break;
        }
        items.unshift(item);
      }
      stack.push({ type: "array", items });
      continue;
    }

    if (token.type !== "word" || !isPdfOperator(token.value)) {
      stack.push(token);
      continue;
    }

    const operator = token.value;
    if (operator === "Tj") {
      const item = lastStackItem(stack, "string");
      if (item) appendText(item.value);
    } else if (operator === "TJ") {
      const item = lastStackItem(stack, "array");
      if (item) {
        appendText(item.items.filter((entry) => entry && entry.type === "string").map((entry) => entry.value).join(""));
      }
    } else if (operator === "'" || operator === "\"") {
      newline();
      const item = lastStackItem(stack, "string");
      if (item) appendText(item.value);
    } else if (operator === "T*" || operator === "Td" || operator === "TD") {
      newline();
    }
    stack.length = 0;
  }
  newline();
  return cleanExtractedText(lines.join("\n"));
}

function tokenizePdfContent(content) {
  const tokens = [];
  const text = String(content || "");
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "%") {
      while (index < text.length && text[index] !== "\n" && text[index] !== "\r") index += 1;
      continue;
    }
    if (char === "(") {
      const parsed = parseLiteralString(text, index);
      tokens.push({ type: "string", value: parsed.value });
      index = parsed.end;
      continue;
    }
    if (char === "<" && text[index + 1] !== "<") {
      const end = text.indexOf(">", index + 1);
      if (end === -1) {
        break;
      }
      tokens.push({ type: "string", value: decodeHexString(text.slice(index + 1, end)) });
      index = end + 1;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "arrayStart" });
      index += 1;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "arrayEnd" });
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < text.length && !/[\s[\]<>()]/.test(text[end])) {
      end += 1;
    }
    tokens.push({ type: "word", value: text.slice(index, end) });
    index = end;
  }

  return tokens;
}

function parseLiteralString(text, start) {
  let index = start + 1;
  let depth = 1;
  let value = "";

  while (index < text.length && depth > 0) {
    const char = text[index];
    if (char === "\\") {
      const next = text[index + 1] || "";
      if (/[0-7]/.test(next)) {
        const octal = text.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)[0];
        value += String.fromCharCode(parseInt(octal, 8));
        index += octal.length + 1;
        continue;
      }
      if (next === "\r" && text[index + 2] === "\n") {
        index += 3;
        continue;
      }
      if (next === "\n" || next === "\r") {
        index += 2;
        continue;
      }
      value += ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" })[next] || next;
      index += 2;
      continue;
    }
    if (char === "(") {
      depth += 1;
      value += char;
      index += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth > 0) value += char;
      index += 1;
      continue;
    }
    value += char;
    index += 1;
  }

  return { value, end: index };
}

function decodeHexString(hex) {
  const cleaned = String(hex || "").replace(/[^0-9a-f]/gi, "");
  const padded = cleaned.length % 2 === 0 ? cleaned : `${cleaned}0`;
  let value = "";
  for (let index = 0; index < padded.length; index += 2) {
    const code = parseInt(padded.slice(index, index + 2), 16);
    if (Number.isFinite(code)) {
      value += String.fromCharCode(code);
    }
  }
  return value;
}

function isPdfOperator(value) {
  return new Set(["Tj", "TJ", "'", "\"", "T*", "Td", "TD", "Tm", "BT", "ET"]).has(value);
}

function lastStackItem(stack, type) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index] && stack[index].type === type) {
      return stack[index];
    }
  }
  return null;
}

function cleanExtractedText(value) {
  const lines = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean);
  return lines.filter((line, index) => line !== lines[index - 1]).join("\n");
}

function countPdfPages(raw) {
  const matches = String(raw || "").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

module.exports = {
  isPdfDocument,
  extractPdfText,
  buildExtractedDocumentMarkdown,
  extractPdfContentText
};
