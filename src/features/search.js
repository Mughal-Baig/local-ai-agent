"use strict";

const crypto = require("node:crypto");

function hashContent(content) {
  return crypto.createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

function chunkText(content, size = 1800, overlap = 180) {
  return chunkTextDetailed(content, { size, overlap }).map((chunk) => chunk.text);
}

function tokenizeSearchText(text, limit = 50000) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((term) => term.length >= 2)
    .slice(0, Math.max(1, Number(limit) || 50000));
}

function uniqueSearchTerms(text, limit = 12) {
  return Array.from(new Set(tokenizeSearchText(text, 200))).slice(0, Math.max(1, Number(limit) || 12));
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
  const terms = uniqueSearchTerms(query);
  const documents = (Array.isArray(chunks) ? chunks : []).map((chunk) => ({
    ...chunk,
    id: `${chunk.path || "workspace"}#${Number(chunk.index || 0) + 1}`,
    text: `${chunk.path || ""}\n${chunk.heading || ""}\n${chunk.kind || ""}\n${chunk.preview || ""}`
  }));
  return scoreBm25Documents(query, documents)
    .filter((chunk) => !terms.length || chunk.keywordScore > 0)
    .sort((a, b) => b.keywordScore - a.keywordScore || String(a.path).localeCompare(String(b.path)))
    .map((chunk) => ({
      ...chunk,
      score: roundScore(chunk.keywordScore),
      scoreParts: {
        bm25: roundScore(chunk.keywordScore),
        matches: chunk.keywordMatches || []
      },
      citation: `${chunk.path || "workspace"}#chunk-${Number(chunk.index || 0) + 1}`
    }))
    .slice(0, Math.min(Math.max(Number(limit) || 8, 1), 30));
}

function scoreBm25Documents(query, documents, options = {}) {
  const queryTerms = uniqueSearchTerms(query, options.termLimit || 12);
  const docs = (Array.isArray(documents) ? documents : []).map((document, index) => {
    const pathText = String(document.path || document.id || "");
    const headingText = String(document.heading || "");
    const previewText = String(document.preview || "");
    const bodyText = String(document.text || document.content || "");
    const tokens = tokenizeSearchText(`${pathText}\n${headingText}\n${previewText}\n${bodyText}`);
    const frequencies = new Map();
    for (const token of tokens) {
      if (queryTerms.includes(token)) {
        frequencies.set(token, (frequencies.get(token) || 0) + 1);
      }
    }
    return {
      document,
      index,
      pathText: pathText.toLowerCase(),
      headingText: headingText.toLowerCase(),
      previewText: previewText.toLowerCase(),
      length: Math.max(tokens.length, 1),
      frequencies
    };
  });

  if (!queryTerms.length || !docs.length) {
    return docs.map((entry) => ({
      ...entry.document,
      keywordScore: 0,
      keywordMatches: []
    }));
  }

  const averageLength = docs.reduce((sum, entry) => sum + entry.length, 0) / docs.length || 1;
  const documentFrequency = new Map();
  for (const term of queryTerms) {
    documentFrequency.set(term, docs.filter((entry) => entry.frequencies.has(term)).length);
  }

  const k1 = Math.max(0.5, Math.min(3, Number.isFinite(Number(options.k1)) ? Number(options.k1) : 1.45));
  const b = Math.max(0, Math.min(1, Number.isFinite(Number(options.b)) ? Number(options.b) : 0.72));
  const totalDocuments = docs.length;

  return docs.map((entry) => {
    let keywordScore = 0;
    const keywordMatches = [];
    for (const term of queryTerms) {
      const termFrequency = entry.frequencies.get(term) || 0;
      if (!termFrequency) {
        continue;
      }
      const df = documentFrequency.get(term) || 0;
      const idf = Math.log(1 + ((totalDocuments - df + 0.5) / (df + 0.5)));
      const lengthPenalty = k1 * (1 - b + b * (entry.length / averageLength));
      const bm25 = idf * ((termFrequency * (k1 + 1)) / (termFrequency + lengthPenalty));
      const fieldBoost = fieldMatchBoost(term, entry);
      keywordScore += bm25 + fieldBoost;
      keywordMatches.push(term);
    }
    return {
      ...entry.document,
      keywordScore,
      keywordMatches
    };
  });
}

function fuseHybridScores(documents, options = {}) {
  const docs = Array.isArray(documents) ? documents : [];
  const keywordWeight = Number.isFinite(Number(options.keywordWeight)) ? Number(options.keywordWeight) : 0.62;
  const semanticWeight = Number.isFinite(Number(options.semanticWeight)) ? Number(options.semanticWeight) : 0.38;
  const totalWeight = Math.max(keywordWeight + semanticWeight, 0.001);
  const maxKeyword = Math.max(0, ...docs.map((item) => Number(item.keywordScore || 0)));
  const maxSemantic = Math.max(0, ...docs.map((item) => Number(item.semanticScore || 0)));

  return docs.map((item) => {
    const keywordNormalized = maxKeyword > 0 ? Number(item.keywordScore || 0) / maxKeyword : 0;
    const semanticNormalized = maxSemantic > 0 ? Number(item.semanticScore || 0) / maxSemantic : 0;
    const hybridNormalized = ((keywordNormalized * keywordWeight) + (semanticNormalized * semanticWeight)) / totalWeight;
    return {
      ...item,
      hybridScore: hybridNormalized,
      scoreParts: {
        bm25: roundScore(item.keywordScore || 0),
        semantic: roundScore(item.semanticScore || 0),
        keywordNormalized: roundScore(keywordNormalized),
        semanticNormalized: roundScore(semanticNormalized),
        hybrid: roundScore(hybridNormalized)
      }
    };
  });
}

function fieldMatchBoost(term, entry) {
  let boost = 0;
  if (entry.pathText.includes(term)) {
    boost += 2.4;
  }
  if (entry.headingText.includes(term)) {
    boost += 1.8;
  }
  if (entry.previewText.includes(term)) {
    boost += 0.6;
  }
  return boost;
}

function roundScore(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
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
  tokenizeSearchText,
  uniqueSearchTerms,
  scoreBm25Documents,
  fuseHybridScores,
  rankChunks
};
