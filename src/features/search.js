"use strict";

const crypto = require("node:crypto");

function hashContent(content) {
  return crypto.createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

function chunkText(content, size = 1800, overlap = 180) {
  const text = String(content || "");
  if (!text) {
    return [];
  }
  const chunks = [];
  let index = 0;
  while (index < text.length && chunks.length < 80) {
    chunks.push(text.slice(index, index + size));
    index += Math.max(1, size - overlap);
  }
  return chunks;
}

function rankChunks(query, chunks, limit = 8) {
  const terms = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((term) => term.length >= 2)
    .slice(0, 12);
  return (Array.isArray(chunks) ? chunks : [])
    .map((chunk) => {
      const haystack = `${chunk.path || ""} ${chunk.preview || ""}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
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

module.exports = {
  hashContent,
  chunkText,
  rankChunks
};
