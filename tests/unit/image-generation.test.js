#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  normalizeImagePrompt,
  normalizeImageBackend,
  normalizeImageDimensions,
  buildImageGenerationPayload,
  parseGeneratedImages,
  buildImageProvenanceMarkdown
} = require("../../src/image-generation");

const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lA8t4wAAAABJRU5ErkJggg==";

assert.equal(normalizeImagePrompt("  clay   robot \r\n\n studio  "), "clay robot\nstudio");
assert.equal(normalizeImageBackend("sd-webui"), "automatic1111");
assert.equal(normalizeImageBackend("openai"), "openai-compatible");
assert.deepEqual(normalizeImageDimensions({ size: "1024x768" }), { width: 1024, height: 768 });
assert.deepEqual(normalizeImageDimensions({ width: 12, height: 9000 }), { width: 64, height: 2048 });

const autoPayload = buildImageGenerationPayload({
  backend: "automatic1111",
  prompt: "warm local AI agent icon",
  negativePrompt: "blur",
  width: 640,
  height: 512,
  steps: 12,
  seed: 42,
  count: 2
});
assert.equal(autoPayload.prompt, "warm local AI agent icon");
assert.equal(autoPayload.negative_prompt, "blur");
assert.equal(autoPayload.width, 640);
assert.equal(autoPayload.batch_size, 2);
assert.equal(autoPayload.seed, 42);

const openAiPayload = buildImageGenerationPayload({
  backend: "openai-compatible",
  model: "flux-schnell",
  prompt: "local image",
  size: "512x512"
});
assert.equal(openAiPayload.model, "flux-schnell");
assert.equal(openAiPayload.size, "512x512");
assert.equal(openAiPayload.response_format, "b64_json");

const parsedAuto = parseGeneratedImages({
  images: [tinyPng],
  info: JSON.stringify({ seed: 123, all_seeds: [123] })
});
assert.equal(parsedAuto.length, 1);
assert.equal(parsedAuto[0].seed, 123);
assert.equal(parsedAuto[0].buffer.length > 20, true);

const parsedOpenAi = parseGeneratedImages({
  data: [{ b64_json: `data:image/png;base64,${tinyPng}`, seed: 7 }]
});
assert.equal(parsedOpenAi.length, 1);
assert.equal(parsedOpenAi[0].mediaType, "image/png");
assert.equal(parsedOpenAi[0].seed, 7);

const provenance = buildImageProvenanceMarkdown({
  backend: "automatic1111",
  endpoint: "http://127.0.0.1:7860/sdapi/v1/txt2img",
  prompt: "warm local AI agent icon",
  parameters: { width: 512, height: 512, seed: 42 },
  outputs: [{
    path: "images/generated/test.png",
    mediaType: "image/png",
    size: 67,
    hash: "abc",
    seed: 42
  }]
});
assert.match(provenance, /AgentTrail Image Generation Provenance/);
assert.match(provenance, /warm local AI agent icon/);
assert.match(provenance, /images\/generated\/test\.png/);

console.log("Image generation unit tests passed");
