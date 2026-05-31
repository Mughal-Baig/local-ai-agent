"use strict";

const { redactSecrets } = require("./redact");

function scanSecurityText(pathName, content, truncate = defaultTruncate) {
  const lines = String(content || "").split(/\r?\n/);
  const patterns = [
    {
      label: "Prompt injection override",
      severity: "high",
      pattern: /(ignore|disregard|forget).{0,30}(previous|above|system|developer).{0,30}(instruction|message|prompt)/i
    },
    {
      label: "Secret exfiltration request",
      severity: "high",
      pattern: /(send|post|upload|exfiltrate).{0,60}(secret|token|key|credential|env|\.env|password)/i
    },
    {
      label: "External network command",
      severity: "medium",
      pattern: /\b(curl|wget|nc|ncat|scp|rsync)\b.*(https?:\/\/|[a-z0-9.-]+\.[a-z]{2,})/i
    },
    {
      label: "Path escape attempt",
      severity: "high",
      pattern: /(\.\.\/|\.\.\\|\/etc\/|\/private\/|~\/|[A-Za-z]:\\)/
    },
    {
      label: "Destructive shell command",
      severity: "high",
      pattern: /\b(rm\s+-rf|dd\s+if=|mkfs|diskutil\s+erase|git\s+reset\s+--hard)\b/i
    },
    {
      label: "Hidden instruction marker",
      severity: "medium",
      pattern: /(<!--|<script|display:\s*none|base64,|BEGIN SYSTEM PROMPT)/i
    },
    {
      label: "Tool escalation request",
      severity: "high",
      pattern: /(call|use|invoke|run).{0,40}(write_file|preview_write_file|read_file|search_workspace|shell|terminal).{0,80}(without|bypass|ignore|secretly|silently|permission|approval)/i
    },
    {
      label: "System prompt extraction",
      severity: "high",
      pattern: /(reveal|print|show|dump|expose).{0,50}(system|developer|hidden).{0,30}(prompt|message|instruction)/i
    },
    {
      label: "Encoded instruction payload",
      severity: "medium",
      pattern: /\b[A-Za-z0-9+/]{80,}={0,2}\b/
    }
  ];

  const findings = [];
  lines.forEach((line, index) => {
    if (redactSecrets(line).count > 0) {
      findings.push({
        label: "Secret-like value",
        severity: "high",
        line: index + 1,
        detail: truncate(redactSecrets(line).redacted.trim(), 180)
      });
    }
    for (const pattern of patterns) {
      if (pattern.pattern.test(line)) {
        findings.push({
          label: pattern.label,
          severity: pattern.severity,
          line: index + 1,
          detail: truncate(line.trim(), 180)
        });
      }
    }
  });

  const high = findings.filter((finding) => finding.severity === "high").length;
  return {
    path: pathName,
    risk: high ? "high" : findings.length ? "medium" : "low",
    score: Math.max(0, 100 - high * 25 - (findings.length - high) * 12),
    findings
  };
}

function defaultTruncate(value, maxLength) {
  const text = String(value || "");
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

module.exports = {
  scanSecurityText
};
