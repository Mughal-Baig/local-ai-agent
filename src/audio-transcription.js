"use strict";

const path = require("node:path");

const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".webm", ".mp4", ".mov"]);

function isAudioDocument(filePath, mediaType = "") {
  const ext = path.extname(String(filePath || "").toLowerCase());
  const type = String(mediaType || "").toLowerCase();
  return AUDIO_EXTENSIONS.has(ext) ||
    type.startsWith("audio/") ||
    type.includes("audio/") ||
    type.includes("video/mp4") ||
    type.includes("video/webm") ||
    type.includes("video/quicktime");
}

function defaultAudioMediaType(filePath, fallback = "") {
  const ext = path.extname(String(filePath || "").toLowerCase());
  return {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".webm": "audio/webm",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime"
  }[ext] || fallback || "audio/wav";
}

function normalizeTranscriptLanguage(value) {
  const cleaned = String(value || "auto").trim();
  return /^[A-Za-z0-9_+-]{1,32}$/.test(cleaned) ? cleaned : "auto";
}

function normalizeTranscriptText(value) {
  return String(value || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line
      .replace(/^\s*\[[0-9:.]+\s*-->\s*[0-9:.]+\]\s*/g, "")
      .replace(/^\s*\([0-9:.]+\s*-->\s*[0-9:.]+\)\s*/g, "")
      .replace(/[ \t\f\v]+/g, " ")
      .trim())
    .filter((line) => line && !/^(whisper_|system_info:|main:|ggml_|llama_)/i.test(line))
    .join("\n");
}

function buildTranscriptMarkdown({ sourcePath, originalName, mediaType, transcription }) {
  const text = transcription && transcription.text ? transcription.text : "";
  const warnings = transcription && Array.isArray(transcription.warnings) && transcription.warnings.length
    ? transcription.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- none";
  return [
    `# Audio Transcript: ${originalName || path.basename(sourcePath || "audio")}`,
    "",
    `- Source file: ${sourcePath}`,
    `- Media type: ${mediaType || defaultAudioMediaType(sourcePath)}`,
    transcription && transcription.engine ? `- Transcription engine: ${transcription.engine}` : null,
    transcription && transcription.language ? `- Transcription language: ${transcription.language}` : null,
    `- Transcript characters: ${text.length}`,
    "",
    "## Transcription Warnings",
    "",
    warnings,
    "",
    "## Transcript",
    "",
    text || "No speech text was found in this audio file."
  ].filter((line) => line !== null).join("\n");
}

module.exports = {
  AUDIO_EXTENSIONS,
  isAudioDocument,
  defaultAudioMediaType,
  normalizeTranscriptLanguage,
  normalizeTranscriptText,
  buildTranscriptMarkdown
};
