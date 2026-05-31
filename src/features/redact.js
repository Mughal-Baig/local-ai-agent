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
module.exports = { redactSecrets, PATTERNS };
