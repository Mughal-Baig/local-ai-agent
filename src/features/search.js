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
  const lineOffsets = lineStartOffsets(text);
  const blocks = [];
  const headings = [];
  let buffer = [];
  let startLine = 1;
  let kind = "paragraph";
  let inFence = false;
  let fenceStart = "";

  const currentHeading = () => headings.map((item) => item.title).join(" > ");
  const pushBuffer = (endLine) => {
    const raw = buffer.join("\n");
    const leading = (raw.match(/^\s*/) || [""])[0].length;
    const trailing = (raw.match(/\s*$/) || [""])[0].length;
    const body = raw.trim();
    if (body) {
      const rawStart = offsetForLine(lineOffsets, startLine);
      blocks.push({
        text: body,
        startLine,
        endLine,
        charStart: rawStart + leading,
        charEnd: rawStart + raw.length - trailing,
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
      const headingStart = offsetForLine(lineOffsets, lineNumber) + Math.max(0, line.indexOf(trimmed));
      blocks.push({
        text: trimmed,
        startLine: lineNumber,
        endLine: lineNumber,
        charStart: headingStart,
        charEnd: headingStart + trimmed.length,
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
    const priorLineBreaks = countLineBreaks(block.text.slice(0, index));
    const sliceLineBreaks = countLineBreaks(text);
    const startLine = (block.startLine || 1) + priorLineBreaks;
    chunks.push({
      ...block,
      text,
      startLine,
      endLine: startLine + sliceLineBreaks,
      charStart: Number.isInteger(block.charStart) ? block.charStart + index : undefined,
      charEnd: Number.isInteger(block.charStart) ? block.charStart + index + text.length : undefined,
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
  const charStarts = blocks.map((block) => block.charStart).filter(Number.isInteger);
  const charEnds = blocks.map((block) => block.charEnd).filter(Number.isInteger);
  const kinds = Array.from(new Set(blocks.map((block) => block.kind).filter(Boolean)));
  const preview = `${heading ? `${heading} - ` : ""}${text.replace(/\s+/g, " ").trim()}`.slice(0, 220);
  return {
    index,
    text,
    heading,
    startLine,
    endLine,
    charStart: charStarts.length ? Math.min(...charStarts) : null,
    charEnd: charEnds.length ? Math.max(...charEnds) : null,
    kind: kinds.length === 1 ? kinds[0] : "mixed",
    preview
  };
}

function rankChunks(query, chunks, limit = 8) {
  const terms = uniqueSearchTerms(query);
  const documents = (Array.isArray(chunks) ? chunks : []).map((chunk) => ({
    ...chunk,
    id: `${chunk.path || "workspace"}#${Number(chunk.index || 0) + 1}`,
    text: `${chunk.path || ""}\n${chunk.heading || ""}\n${chunk.kind || ""}\n${chunk.preview || ""}\n${chunk.text || ""}`
  }));
  return scoreBm25Documents(query, documents)
    .filter((chunk) => !terms.length || chunk.keywordScore > 0)
    .sort((a, b) => b.keywordScore - a.keywordScore || String(a.path).localeCompare(String(b.path)))
    .map((chunk) => {
      const { embedding, text, ...publicChunk } = chunk;
      const sourcePath = chunk.path || "workspace";
      const startLine = chunk.startLine || 1;
      const endLine = chunk.endLine || startLine;
      return {
        ...publicChunk,
        score: roundScore(chunk.keywordScore),
        scoreParts: {
          bm25: roundScore(chunk.keywordScore),
          matches: chunk.keywordMatches || []
        },
        citation: lineCitation(sourcePath, startLine, endLine),
        chunkRef: `${sourcePath}#chunk-${Number(chunk.index || 0) + 1}`,
        span: {
          startLine,
          endLine,
          charStart: Number.isInteger(chunk.charStart) ? chunk.charStart : null,
          charEnd: Number.isInteger(chunk.charEnd) ? chunk.charEnd : null
        }
      };
    })
    .slice(0, Math.min(Math.max(Number(limit) || 8, 1), 30));
}

function bestLateInteractionChunk(queryVector, chunks) {
  const query = Array.isArray(queryVector) ? queryVector : [];
  let best = null;
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    if (!Array.isArray(chunk.embedding) || !chunk.embedding.length) {
      continue;
    }
    const score = vectorCosineSimilarity(query, chunk.embedding);
    if (!best || score > best.score) {
      best = { score, chunk };
    }
  }
  if (!best) {
    return { score: 0, chunk: null };
  }
  return { score: roundScore(best.score), chunk: best.chunk };
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

// Deterministic lexical reranker (cross-encoder style, no model required):
// re-scores the top-k by exact-phrase, query-term coverage, bigram overlap, and
// path-field matches, then blends with the first-stage hybrid score (T047).
function rerankFeatures(queryTerms, queryLower, item) {
  if (!queryTerms.length) {
    return 0;
  }
  const pathText = String(item.path || item.id || "").toLowerCase();
  const bodyText = String(item.text || item.content || item.snippet || "").toLowerCase();
  const haystack = `${pathText}\n${bodyText}`;

  let present = 0;
  let fieldHits = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) present += 1;
    if (pathText.includes(term)) fieldHits += 1;
  }
  const coverage = present / queryTerms.length;
  const fieldNorm = fieldHits / queryTerms.length;

  const multiword = queryLower.split(/\s+/).filter(Boolean).length > 1;
  const phrase = multiword && bodyText.includes(queryLower) ? 1 : 0;

  let bigramHits = 0;
  let bigramTotal = 0;
  for (let i = 0; i < queryTerms.length - 1; i += 1) {
    bigramTotal += 1;
    if (haystack.includes(`${queryTerms[i]} ${queryTerms[i + 1]}`)) bigramHits += 1;
  }
  const bigram = bigramTotal ? bigramHits / bigramTotal : 0;

  return (coverage * 3) + (phrase * 3) + (bigram * 2) + (fieldNorm * 1.5);
}

function rerankDocuments(query, documents, options = {}) {
  const docs = Array.isArray(documents) ? documents : [];
  if (!docs.length) {
    return docs;
  }
  const topK = clampNumber(options.topK, 1, 50, 12);
  const hybridWeight = Number.isFinite(Number(options.hybridWeight)) ? Number(options.hybridWeight) : 0.55;
  const rerankWeight = Number.isFinite(Number(options.rerankWeight)) ? Number(options.rerankWeight) : 0.45;
  const queryTerms = uniqueSearchTerms(query, options.termLimit || 12);
  const queryLower = String(query || "").toLowerCase().trim();

  const baseOf = (item) => Number(
    item.hybridScore != null
      ? item.hybridScore
      : (item.scoreParts && item.scoreParts.keywordNormalized) || item.keywordScore || 0
  );

  const ordered = docs.slice().sort((a, b) => baseOf(b) - baseOf(a));
  const head = ordered.slice(0, topK);
  const tail = ordered.slice(topK);

  const rawScores = head.map((item) => rerankFeatures(queryTerms, queryLower, item));
  const maxRaw = Math.max(0.000001, ...rawScores);
  const baseMax = Math.max(0.000001, ...head.map(baseOf));

  const scoredHead = head.map((item, i) => {
    const rerankNormalized = rawScores[i] / maxRaw;
    const hybridNormalized = baseOf(item) / baseMax;
    const finalScore = (hybridNormalized * hybridWeight) + (rerankNormalized * rerankWeight);
    return {
      ...item,
      rerankScore: rawScores[i],
      finalScore,
      scoreParts: {
        ...(item.scoreParts || {}),
        rerank: roundScore(rerankNormalized),
        final: roundScore(finalScore)
      }
    };
  });
  scoredHead.sort((a, b) => b.finalScore - a.finalScore);

  const scoredTail = tail.map((item) => {
    const finalScore = baseOf(item) * hybridWeight;
    return {
      ...item,
      rerankScore: 0,
      finalScore,
      scoreParts: { ...(item.scoreParts || {}), rerank: 0, final: roundScore(finalScore) }
    };
  });

  return [...scoredHead, ...scoredTail];
}

function roundScore(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  const clean = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, Math.round(clean)));
}

function lineStartOffsets(text) {
  const offsets = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function offsetForLine(offsets, lineNumber) {
  return offsets[Math.max(0, Number(lineNumber || 1) - 1)] || 0;
}

function countLineBreaks(text) {
  const matches = String(text || "").match(/\n/g);
  return matches ? matches.length : 0;
}

function lineCitation(sourcePath, startLine, endLine) {
  const start = Math.max(1, Number(startLine) || 1);
  const end = Math.max(start, Number(endLine) || start);
  return start === end ? `${sourcePath}:${start}` : `${sourcePath}:${start}-${end}`;
}

function vectorCosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) {
    return 0;
  }
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
  hashContent,
  chunkText,
  chunkTextDetailed,
  tokenizeSearchText,
  uniqueSearchTerms,
  scoreBm25Documents,
  fuseHybridScores,
  rerankDocuments,
  rankChunks,
  bestLateInteractionChunk
};
