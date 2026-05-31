#!/usr/bin/env node

"use strict";

const input = process.argv[2] || "unknown";
const language = process.argv[3] || "eng";

process.stdout.write([
  "AgentTrail OCR ingestion text",
  `Input: ${input}`,
  `Language: ${language}`
].join("\n"));
