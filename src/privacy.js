"use strict";

const crypto = require("node:crypto");
const { redactSecrets, redactSecretsDeep } = require("./features/redact");

const ENCRYPTION_MARKER = "AGENTTRAIL_ENCRYPTED_V1";
const MANAGED_PREFIXES = [
  "receipts/",
  "reports/",
  "sessions/",
  "evals/",
  ".agenttrail/pending-run.json"
];

function secretRedactionEnabled(env = process.env) {
  return String(env.AGENTTRAIL_SECRET_REDACTION || "on").toLowerCase() !== "off";
}

function redactText(input, env = process.env) {
  const text = String(input == null ? "" : input);
  if (!secretRedactionEnabled(env)) {
    return { text, count: 0 };
  }
  const result = redactSecrets(text);
  return { text: result.redacted, count: result.count };
}

function redactValue(value, env = process.env) {
  if (!secretRedactionEnabled(env)) {
    return { value, count: 0 };
  }
  return redactSecretsDeep(value);
}

function redactTextOnly(input, env = process.env) {
  return redactText(input, env).text;
}

function redactValueOnly(value, env = process.env) {
  return redactValue(value, env).value;
}

function encryptionMode(env = process.env) {
  const raw = String(env.AGENTTRAIL_ENCRYPT_AT_REST || env.AGENTTRAIL_ENCRYPTION_MODE || "off").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return "receipts";
  if (["receipts", "reports", "sessions", "agenttrail"].includes(raw)) return raw;
  if (["all", "managed"].includes(raw)) return "agenttrail";
  return "off";
}

function encryptionKey(env = process.env) {
  const raw = String(env.AGENTTRAIL_ENCRYPTION_KEY || env.AGENTTRAIL_AT_REST_KEY || "").trim();
  if (!raw) {
    return null;
  }
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  if (raw.startsWith("base64:")) {
    const decoded = Buffer.from(raw.slice("base64:".length), "base64");
    if (decoded.length === 32) return decoded;
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) {
    return decoded;
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptionEnabled(env = process.env) {
  return encryptionMode(env) !== "off" && Boolean(encryptionKey(env));
}

function isPrivacyManagedPath(relativePath, env = process.env) {
  const mode = encryptionMode(env);
  if (mode === "off") {
    return false;
  }
  const normalized = normalizeRelativePath(relativePath);
  if (mode === "receipts") {
    return normalized.startsWith("receipts/");
  }
  if (mode === "reports") {
    return normalized.startsWith("receipts/") || normalized.startsWith("reports/");
  }
  if (mode === "sessions") {
    return normalized.startsWith("receipts/") || normalized.startsWith("reports/") || normalized.startsWith("sessions/");
  }
  return MANAGED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

function isAuditArtifactPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return MANAGED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

function isEncryptedText(text) {
  return String(text || "").startsWith(`${ENCRYPTION_MARKER}\n`);
}

function encryptText(plainText, options = {}) {
  const key = encryptionKey(options.env || process.env);
  if (!key) {
    throw new Error("AGENTTRAIL_ENCRYPTION_KEY is required for encrypted-at-rest artifacts.");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const aad = Buffer.from(String(options.aad || "agenttrail"), "utf8");
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(String(plainText || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_MARKER,
    JSON.stringify({
      alg: "AES-256-GCM",
      aad: aad.toString("utf8"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: ciphertext.toString("base64")
    })
  ].join("\n");
}

function decryptText(encryptedText, options = {}) {
  const text = String(encryptedText || "");
  if (!isEncryptedText(text)) {
    return text;
  }
  const key = encryptionKey(options.env || process.env);
  if (!key) {
    throw new Error("This artifact is encrypted. Set AGENTTRAIL_ENCRYPTION_KEY to read it.");
  }
  const envelope = JSON.parse(text.slice(`${ENCRYPTION_MARKER}\n`.length));
  const aad = Buffer.from(String(envelope.aad || options.aad || "agenttrail"), "utf8");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function protectTextForStorage(relativePath, content, env = process.env) {
  const redacted = isAuditArtifactPath(relativePath)
    ? redactText(content, env)
    : { text: String(content == null ? "" : content), count: 0 };
  const managed = isPrivacyManagedPath(relativePath, env);
  if (managed && encryptionEnabled(env)) {
    return {
      content: encryptText(redacted.text, { env, aad: normalizeRelativePath(relativePath) }),
      redactions: redacted.count,
      encrypted: true
    };
  }
  return {
    content: redacted.text,
    redactions: redacted.count,
    encrypted: false
  };
}

function revealTextFromStorage(relativePath, content, env = process.env) {
  const text = String(content == null ? "" : content);
  if (!isEncryptedText(text)) {
    return text;
  }
  return decryptText(text, { env, aad: normalizeRelativePath(relativePath) });
}

function privacyStatus(env = process.env) {
  return {
    schema: "agenttrail.privacy.v1",
    secretRedaction: secretRedactionEnabled(env) ? "on" : "off",
    encryption: {
      mode: encryptionMode(env),
      enabled: encryptionEnabled(env),
      keyConfigured: Boolean(encryptionKey(env)),
      marker: ENCRYPTION_MARKER,
      managedPrefixes: MANAGED_PREFIXES.slice()
    }
  };
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

module.exports = {
  ENCRYPTION_MARKER,
  MANAGED_PREFIXES,
  secretRedactionEnabled,
  redactText,
  redactTextOnly,
  redactValue,
  redactValueOnly,
  encryptionMode,
  encryptionEnabled,
  isPrivacyManagedPath,
  isAuditArtifactPath,
  isEncryptedText,
  encryptText,
  decryptText,
  protectTextForStorage,
  revealTextFromStorage,
  privacyStatus
};
