"use strict";

const path = require("node:path");
const zlib = require("node:zlib");

const CODE_EXTENSIONS = new Map([
  [".js", "javascript"],
  [".jsx", "jsx"],
  [".ts", "typescript"],
  [".tsx", "tsx"],
  [".css", "css"],
  [".html", "html"],
  [".xml", "xml"],
  [".json", "json"],
  [".yml", "yaml"],
  [".yaml", "yaml"],
  [".toml", "toml"],
  [".py", "python"],
  [".rb", "ruby"],
  [".go", "go"],
  [".rs", "rust"],
  [".java", "java"],
  [".c", "c"],
  [".cpp", "cpp"],
  [".h", "c"],
  [".hpp", "cpp"],
  [".swift", "swift"],
  [".sh", "bash"],
  [".zsh", "zsh"],
  [".sql", "sql"]
]);

function isPdfDocument(filePath, mediaType = "") {
  return /\.pdf$/i.test(String(filePath || "")) || String(mediaType || "").toLowerCase().includes("application/pdf");
}

function isOfficeDocument(filePath, mediaType = "") {
  const value = `${filePath || ""} ${mediaType || ""}`.toLowerCase();
  return /\.(docx|pptx|xlsx)$/i.test(String(filePath || "")) ||
    value.includes("wordprocessingml.document") ||
    value.includes("presentationml.presentation") ||
    value.includes("spreadsheetml.sheet");
}

function isTextDocument(filePath, mediaType = "") {
  return Boolean(detectTextDocumentType(filePath, mediaType));
}

function isSupportedDocument(filePath, mediaType = "") {
  return isPdfDocument(filePath, mediaType) || isOfficeDocument(filePath, mediaType) || isTextDocument(filePath, mediaType);
}

function detectDocumentType(filePath, mediaType = "") {
  const name = String(filePath || "").toLowerCase();
  const type = String(mediaType || "").toLowerCase();
  if (name.endsWith(".pdf") || type.includes("application/pdf")) return "pdf";
  if (name.endsWith(".docx") || type.includes("wordprocessingml.document")) return "docx";
  if (name.endsWith(".pptx") || type.includes("presentationml.presentation")) return "pptx";
  if (name.endsWith(".xlsx") || type.includes("spreadsheetml.sheet")) return "xlsx";
  return detectTextDocumentType(filePath, mediaType);
}

function detectTextDocumentType(filePath, mediaType = "") {
  const name = String(filePath || "").toLowerCase();
  const type = String(mediaType || "").toLowerCase();
  const ext = path.extname(name);
  if (name.endsWith(".html") || name.endsWith(".htm") || type.includes("text/html")) return "html";
  if (name.endsWith(".md") || name.endsWith(".markdown") || type.includes("markdown")) return "markdown";
  if (CODE_EXTENSIONS.has(ext) || type.includes("application/json") || type.includes("application/xml")) return "code";
  if (name.endsWith(".txt") || name.endsWith(".log") || name.endsWith(".csv") || type.startsWith("text/")) return "text";
  return "";
}

function extractDocumentText(input, options = {}) {
  const type = detectDocumentType(options.sourcePath || options.filePath || "", options.mediaType || "");
  if (type === "pdf") {
    return extractPdfText(input, options);
  }
  if (["docx", "pptx", "xlsx"].includes(type)) {
    return extractOfficeText(input, { ...options, type });
  }
  if (["html", "markdown", "code", "text"].includes(type)) {
    return extractTextDocument(input, { ...options, type });
  }
  throw new Error("Unsupported document type.");
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

function buildExtractedDocumentMarkdown({ sourcePath, sourceUrl, originalName, mediaType, extraction }) {
  const text = extraction && extraction.text ? extraction.text : "";
  const warnings = extraction && extraction.warnings && extraction.warnings.length
    ? extraction.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- none";
  const type = extraction && extraction.type ? String(extraction.type).toUpperCase() : "Document";
  return [
    `# Extracted ${type}: ${originalName || path.basename(sourcePath || "document")}`,
    "",
    `- Source file: ${sourcePath}`,
    sourceUrl ? `- Source URL: ${sourceUrl}` : null,
    `- Media type: ${mediaType || "application/octet-stream"}`,
    extraction && extraction.pageCount ? `- Pages detected: ${extraction.pageCount}` : null,
    extraction && extraction.partCount ? `- Parts extracted: ${extraction.partCount}` : null,
    `- Extracted characters: ${text.length}`,
    "",
    "## Extraction Warnings",
    "",
    warnings,
    "",
    "## Text",
    "",
    text || "No selectable text was found in this document."
  ].filter((line) => line !== null).join("\n");
}

function extractTextDocument(input, options = {}) {
  const raw = Buffer.isBuffer(input) ? input.toString("utf8") : String(input || "");
  const warnings = [];
  let text = "";
  let language = "";

  if (options.type === "html") {
    text = htmlToMarkdown(raw);
  } else if (options.type === "markdown") {
    text = normalizeMarkdown(raw);
  } else if (options.type === "code") {
    language = inferCodeLanguage(options.sourcePath || options.filePath || "", options.mediaType || "");
    text = [
      `\`\`\`${language}`,
      normalizeCodeText(raw),
      "```"
    ].join("\n");
  } else {
    text = normalizePlainText(raw);
  }

  if (!text) {
    warnings.push("No text content found.");
  }
  return {
    ok: Boolean(text),
    type: options.type,
    language,
    sourcePath: options.sourcePath || "",
    text,
    charCount: text.length,
    partCount: 1,
    warnings
  };
}

function htmlToMarkdown(value) {
  let html = String(value || "");
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");

  html = html.replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => `\n\n\`\`\`\n${decodeHtmlEntities(stripHtmlTags(code)).trim()}\n\`\`\`\n\n`);
  html = html.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => `\n\n\`\`\`\n${decodeHtmlEntities(stripHtmlTags(code)).trim()}\n\`\`\`\n\n`);
  for (let level = 1; level <= 6; level += 1) {
    html = html.replace(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi"), (_, body) => `\n\n${"#".repeat(level)} ${decodeHtmlEntities(stripHtmlTags(body)).trim()}\n\n`);
  }
  html = html
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => `\n- ${decodeHtmlEntities(stripHtmlTags(body)).trim()}`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|tr|table|ul|ol)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeMarkdown(decodeHtmlEntities(html));
}

function normalizeMarkdown(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function normalizeCodeText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function normalizePlainText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function inferCodeLanguage(filePath, mediaType = "") {
  const ext = path.extname(String(filePath || "").toLowerCase());
  if (CODE_EXTENSIONS.has(ext)) {
    return CODE_EXTENSIONS.get(ext);
  }
  const type = String(mediaType || "").toLowerCase();
  if (type.includes("json")) return "json";
  if (type.includes("xml")) return "xml";
  if (type.includes("javascript")) return "javascript";
  if (type.includes("typescript")) return "typescript";
  return "";
}

function stripHtmlTags(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function extractOfficeText(input, options = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || "");
  const entries = readZipEntries(buffer);
  const warnings = [];
  let result;
  if (options.type === "docx") {
    result = extractDocxText(entries, warnings);
  } else if (options.type === "pptx") {
    result = extractPptxText(entries, warnings);
  } else if (options.type === "xlsx") {
    result = extractXlsxText(entries, warnings);
  } else {
    throw new Error("Unsupported OpenXML document type.");
  }
  const text = cleanExtractedText(result.parts.map((part) => part.text).filter(Boolean).join("\n\n"));
  return {
    ok: Boolean(text),
    type: options.type,
    sourcePath: options.sourcePath || "",
    text,
    charCount: text.length,
    partCount: result.parts.length,
    warnings
  };
}

function extractDocxText(entries, warnings) {
  const parts = [];
  const main = readZipText(entries, "word/document.xml", warnings);
  if (main) {
    parts.push({ name: "Document", text: extractXmlParagraphText(main, "p", "t") });
  }
  for (const name of sortedEntryNames(entries, /^word\/(header|footer)\d+\.xml$/)) {
    const text = extractXmlParagraphText(readZipText(entries, name, warnings), "p", "t");
    if (text) {
      parts.push({ name, text });
    }
  }
  return { parts };
}

function extractPptxText(entries, warnings) {
  const parts = [];
  for (const name of sortedEntryNames(entries, /^ppt\/slides\/slide\d+\.xml$/)) {
    const number = (name.match(/slide(\d+)\.xml$/) || [null, String(parts.length + 1)])[1];
    const text = extractXmlTaggedText(readZipText(entries, name, warnings), "t");
    if (text) {
      parts.push({ name, text: `Slide ${number}\n${text}` });
    }
  }
  return { parts };
}

function extractXlsxText(entries, warnings) {
  const sharedStrings = parseSharedStrings(readZipText(entries, "xl/sharedStrings.xml", warnings));
  const parts = [];
  for (const name of sortedEntryNames(entries, /^xl\/worksheets\/sheet\d+\.xml$/)) {
    const number = (name.match(/sheet(\d+)\.xml$/) || [null, String(parts.length + 1)])[1];
    const rows = extractWorksheetRows(readZipText(entries, name, warnings), sharedStrings);
    if (rows.length) {
      parts.push({ name, text: `Sheet ${number}\n${rows.join("\n")}` });
    }
  }
  return { parts };
}

function readZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new Error("OpenXML file is not a valid ZIP archive.");
  }
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory.");
    }
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (![0, 8].includes(compression)) {
      throw new Error(`Unsupported ZIP compression method ${compression} in ${name}`);
    }
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${name}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    entries.set(name, {
      name,
      compression,
      data: compression === 8 ? zlib.inflateRawSync(compressed) : compressed
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - 65557);
  for (let index = buffer.length - 22; index >= start; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      return index;
    }
  }
  throw new Error("ZIP end-of-central-directory record not found.");
}

function sortedEntryNames(entries, pattern) {
  return [...entries.keys()]
    .filter((name) => pattern.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function readZipText(entries, name, warnings) {
  const entry = entries.get(name);
  if (!entry) {
    if (warnings) warnings.push(`Missing ${name}`);
    return "";
  }
  return entry.data.toString("utf8");
}

function extractXmlParagraphText(xml, paragraphName, textName) {
  const paragraphs = [];
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${paragraphName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${paragraphName}>`, "gi");
  let match;
  while ((match = pattern.exec(String(xml || ""))) !== null) {
    const text = extractXmlTaggedText(match[1], textName, { separator: "" });
    if (text) paragraphs.push(text);
  }
  return cleanExtractedText((paragraphs.length ? paragraphs : [extractXmlTaggedText(xml, textName)]).join("\n"));
}

function extractXmlTaggedText(xml, localName, options = {}) {
  const values = [];
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, "gi");
  let match;
  while ((match = pattern.exec(String(xml || ""))) !== null) {
    values.push(decodeXmlEntities(stripXmlTags(match[1])));
  }
  return cleanExtractedText(values.join(options.separator == null ? "\n" : String(options.separator)));
}

function parseSharedStrings(xml) {
  const strings = [];
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match;
  while ((match = pattern.exec(String(xml || ""))) !== null) {
    strings.push(extractXmlTaggedText(match[1], "t", { separator: "" }));
  }
  return strings;
}

function extractWorksheetRows(xml, sharedStrings) {
  const rows = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(String(xml || ""))) !== null) {
    const values = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1] || "";
      const body = cellMatch[2] || "";
      if (/\bt="s"/.test(attrs)) {
        const index = Number(extractXmlTaggedText(body, "v"));
        values.push(sharedStrings[index] || "");
      } else if (/\bt="inlineStr"/.test(attrs)) {
        values.push(extractXmlTaggedText(body, "t", { separator: "" }));
      } else {
        values.push(extractXmlTaggedText(body, "v"));
      }
    }
    const row = values.map((value) => value.trim()).filter(Boolean).join(" | ");
    if (row) rows.push(row);
  }
  return rows;
}

function stripXmlTags(value) {
  return String(value || "").replace(/<[^>]+>/g, "");
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
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
  isOfficeDocument,
  isSupportedDocument,
  detectDocumentType,
  extractDocumentText,
  extractPdfText,
  extractOfficeText,
  extractTextDocument,
  buildExtractedDocumentMarkdown,
  extractPdfContentText,
  htmlToMarkdown,
  readZipEntries
};
