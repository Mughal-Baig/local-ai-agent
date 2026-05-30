"use strict";

const crypto = require("node:crypto");

function hashContent(content) {
  return crypto.createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

function chunkText(content, size = 1800, overlap = 180) {
  return chunkTextDetailed(content, { size, overlap }).map((chunk) => chunk.text);
}

function chunkTextDetailed(content, options = {}) {
  const size = clampNumber(options.size, 320, 6000, 1800);
  const overlap = clampNumber(options.overlap, 0, Math.floor(size / 2), 220);
  const text = String(content || "").replace(/\r\n/g, "\n");
  if (!text) {
    return [];
  }
  const sourceBlocks = markdownBlocks(text);
  const chunks = [];
  let current = [];
  let currentLength = 0;

  const emit = () => {
    if (!current.some((entry) => !entry.carried)) {
      return;
    }
    chunks.push(buildChunk(current.map((entry) => entry.block), chunks.length));
    const carry = overlapBlocks(current.map((entry) => entry.block), overlap).map((block) => ({ block, carried: true }));
    current = carry;
    currentLength = carry.reduce((sum, entry) => sum + entry.block.text.length + 2, 0);
  };

  for (const block of sourceBlocks.flatMap((item) => splitLargeBlock(item, size, overlap))) {
    const blockLength = block.text.length + 2;
    if (current.length && currentLength + blockLength > size) {
      emit();
    }
    current.push({ block, carried: false });
    currentLength += blockLength;
    if (currentLength >= size) {
      emit();
    }
    if (chunks.length >= 120) {
      break;
    }
  }
  emit();
  return chunks;
}

function markdownBlocks(text) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  const headings = [];
  let buffer = [];
  let startLine = 1;
  let kind = "paragraph";
  let inFence = false;
  let fenceStart = "";

  const currentHeading = () => headings.map((item) => item.title).join(" > ");
  const pushBuffer = (endLine) => {
    const body = buffer.join("\n").trim();
    if (body) {
      blocks.push({
        text: body,
        startLine,
        endLine,
        heading: currentHeading(),
        kind
      });
    }
    buffer = [];
    kind = "paragraph";
  };

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    const fence = trimmed.match(/^(```+|~~~+)/);

    if (inFence) {
      buffer.push(line);
      if (fence && fence[1][0] === fenceStart[0]) {
        pushBuffer(lineNumber);
        inFence = false;
        fenceStart = "";
      }
      continue;
    }

    if (heading) {
      pushBuffer(lineNumber - 1);
      const level = heading[1].length;
      while (headings.length && headings[headings.length - 1].level >= level) {
        headings.pop();
      }
      headings.push({ level, title: heading[2].trim() });
      blocks.push({
        text: trimmed,
        startLine: lineNumber,
        endLine: lineNumber,
        heading: currentHeading(),
        kind: "heading"
      });
      continue;
    }

    if (!trimmed) {
      pushBuffer(lineNumber - 1);
      continue;
    }

    const nextKind = fence
      ? "code"
      : /^\|.*\|$/.test(trimmed)
        ? "table"
        : /^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)
          ? "list"
          : "paragraph";

    if (!buffer.length) {
      startLine = lineNumber;
      kind = nextKind;
    } else if (kind !== nextKind && !(kind === "list" && nextKind === "paragraph") && !(kind === "table" && nextKind === "table")) {
      pushBuffer(lineNumber - 1);
      startLine = lineNumber;
      kind = nextKind;
    }

    buffer.push(line);
    if (fence) {
      inFence = true;
      fenceStart = fence[1];
    }
  }
  pushBuffer(lines.length);
  return blocks;
}

function splitLargeBlock(block, size, overlap) {
  if (!block || block.text.length <= size) {
    return [block].filter(Boolean);
  }
  const chunks = [];
  const step = Math.max(1, size - overlap);
  let index = 0;
  while (index < block.text.length && chunks.length < 80) {
    const text = block.text.slice(index, index + size);
    chunks.push({
      ...block,
      text,
      kind: `${block.kind}-slice`
    });
    index += step;
  }
  return chunks;
}

function overlapBlocks(blocks, overlap) {
  if (!overlap || !blocks.length) {
    return [];
  }
  const selected = [];
  let total = 0;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block.kind === "heading" && selected.length) {
      selected.unshift(block);
      continue;
    }
    const nextTotal = total + block.text.length + 2;
    if (selected.length && nextTotal > overlap) {
      break;
    }
    selected.unshift(block);
    total = nextTotal;
    if (total >= overlap) {
      break;
    }
  }
  return selected;
}

function buildChunk(blocks, index) {
  const text = blocks.map((block) => block.text).join("\n\n").trim();
  const heading = blocks.map((block) => block.heading).filter(Boolean).find(Boolean) || "";
  const startLine = Math.min(...blocks.map((block) => block.startLine || 1));
  const endLine = Math.max(...blocks.map((block) => block.endLine || block.startLine || 1));
  const kinds = Array.from(new Set(blocks.map((block) => block.kind).filter(Boolean)));
  const preview = `${heading ? `${heading} - ` : ""}${text.replace(/\s+/g, " ").trim()}`.slice(0, 220);
  return {
    index,
    text,
    heading,
    startLine,
    endLine,
    kind: kinds.length === 1 ? kinds[0] : "mixed",
    preview
  };
}

function rankChunks(query, chunks, limit = 8) {
  const terms = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((term) => term.length >= 2)
    .slice(0, 12);
  return (Array.isArray(chunks) ? chunks : [])
    .map((chunk) => {
      const haystack = `${chunk.path || ""} ${chunk.heading || ""} ${chunk.kind || ""} ${chunk.preview || ""}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? (String(chunk.heading || "").toLowerCase().includes(term) ? 2 : 1) : 0), 0);
      return {
        ...chunk,
        score,
        citation: `${chunk.path || "workspace"}#chunk-${Number(chunk.index || 0) + 1}`
      };
    })
    .filter((chunk) => !terms.length || chunk.score > 0)
    .sort((a, b) => b.score - a.score || String(a.path).localeCompare(String(b.path)))
    .slice(0, Math.min(Math.max(Number(limit) || 8, 1), 30));
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  const clean = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, Math.round(clean)));
}

module.exports = {
  hashContent,
  chunkText,
  chunkTextDetailed,
  rankChunks
};
