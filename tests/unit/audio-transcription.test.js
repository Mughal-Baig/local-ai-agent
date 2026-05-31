#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  isAudioDocument,
  defaultAudioMediaType,
  normalizeTranscriptLanguage,
  normalizeTranscriptText,
  buildTranscriptMarkdown,
  speechOutputMediaType,
  normalizeTtsVoice,
  normalizeSpeechText
} = require("../../src/audio-transcription");

assert.equal(isAudioDocument("voice.wav", "audio/wav"), true);
assert.equal(isAudioDocument("meeting.m4a", ""), true);
assert.equal(isAudioDocument("clip.webm", "video/webm"), true);
assert.equal(isAudioDocument("notes.txt", "text/plain"), false);

assert.equal(defaultAudioMediaType("voice.mp3"), "audio/mpeg");
assert.equal(defaultAudioMediaType("screen.mov"), "video/quicktime");
assert.equal(speechOutputMediaType("answer.aiff"), "audio/aiff");
assert.equal(speechOutputMediaType("answer.wav"), "audio/wav");
assert.equal(normalizeTranscriptLanguage("en-US"), "en-US");
assert.equal(normalizeTranscriptLanguage("../bad"), "auto");
assert.equal(normalizeTtsVoice("Samantha"), "Samantha");
assert.equal(normalizeTtsVoice("../../bad"), "");
assert.equal(normalizeSpeechText("**Hello** [`link`](https://example.com)"), "Hello link");

const normalized = normalizeTranscriptText([
  "\u001b[31m[00:00:00.000 --> 00:00:01.000] Hello local audio\u001b[0m",
  "whisper_print_timings: ignored",
  "main: ignored",
  "Second line"
].join("\n"));
assert.equal(normalized, "Hello local audio\nSecond line");

const markdown = buildTranscriptMarkdown({
  sourcePath: "audio/voice.wav",
  originalName: "voice.wav",
  mediaType: "audio/wav",
  transcription: {
    engine: "whisper-cli",
    language: "auto",
    text: "Hello local audio",
    warnings: []
  }
});
assert.match(markdown, /# Audio Transcript: voice\.wav/);
assert.match(markdown, /Transcription engine: whisper-cli/);
assert.match(markdown, /Hello local audio/);

console.log("Audio transcription unit tests passed");
