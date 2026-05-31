"use strict";

// T156/T240 — detect and redact common secrets in text (context, receipts, exports).
const PATTERNS = [
  { name: "openai", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: "aws", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "github", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: "slack", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "bearer", re: /\bBearer\s+[A-Za-z0-9._\-]{16,}/gi },
  { name: "privateKey", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "assignment", re: /\b(api[_-]?key|apikey|access[_-]?token|token|secret|password|passwd|pwd)\b(\s*[:=]\s*)(["']?)([A-Za-z0-9._\-]{8,})(\3)/gi }
];
function redactSecrets(input) {
  let text = String(input == null ? "" : input);
  let count = 0;
  for (const { re } of PATTERNS) {
    text = text.replace(re, function (match, p1, p2, p3, p4, p5) {
      count += 1;
      if (typeof p1 === "string" && typeof p2 === "string" && /key|token|secret|pass|pwd/i.test(p1)) {
        return `${p1}${p2}${p3 || ""}[REDACTED]${p3 || ""}`;
      }
      return "[REDACTED]";
    });
  }
  return { redacted: text, count };
}

function redactSecretsDeep(value, options = {}) {
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 8;
  const seen = new WeakSet();
  let count = 0;

  function visit(item, depth) {
    if (typeof item === "string") {
      const result = redactSecrets(item);
      count += result.count;
      return result.redacted;
    }
    if (Buffer.isBuffer(item)) {
      return item;
    }
    if (!item || typeof item !== "object") {
      return item;
    }
    if (depth > maxDepth) {
      return "[REDACTED:depth-limit]";
    }
    if (seen.has(item)) {
      return "[Circular]";
    }
    seen.add(item);

    if (Array.isArray(item)) {
      return item.map((entry) => visit(entry, depth + 1));
    }

    const output = {};
    for (const [key, entry] of Object.entries(item)) {
      if (secretLikeKey(key)) {
        const text = String(entry == null ? "" : entry);
        if (text) count += 1;
        output[key] = text ? "[REDACTED]" : entry;
      } else {
        output[key] = visit(entry, depth + 1);
      }
    }
    return output;
  }

  return {
    value: visit(value, 0),
    count
  };
}

function secretLikeKey(key) {
  return /\b(api[_-]?key|apikey|access[_-]?token|token|secret|password|passwd|pwd|authorization|bearer)\b/i.test(String(key || ""));
}

module.exports = { redactSecrets, redactSecretsDeep, secretLikeKey, PATTERNS };
