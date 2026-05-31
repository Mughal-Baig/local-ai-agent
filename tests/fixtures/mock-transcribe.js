#!/usr/bin/env node

"use strict";

const input = process.argv[2] || "unknown";
const language = process.argv[3] || "auto";
const prompt = process.argv[4] || "";

process.stdout.write([
  "[00:00:00.000 --> 00:00:01.000] AgentTrail speech transcript text",
  `Input: ${input}`,
  `Language: ${language}`,
  prompt ? `Prompt: ${prompt}` : ""
].filter(Boolean).join("\n"));
