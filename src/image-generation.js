"use strict";

const IMAGE_BACKEND_ALIASES = new Map([
  ["auto1111", "automatic1111"],
  ["automatic1111", "automatic1111"],
  ["automatic-1111", "automatic1111"],
  ["sd", "automatic1111"],
  ["sd-webui", "automatic1111"],
  ["stable-diffusion-webui", "automatic1111"],
  ["openai", "openai-compatible"],
  ["openai-compatible", "openai-compatible"],
  ["localai", "openai-compatible"],
  ["generic-openai", "openai-compatible"]
]);

function normalizeImagePrompt(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeImageBackend(value) {
  const key = String(value || "automatic1111").trim().toLowerCase();
  return IMAGE_BACKEND_ALIASES.get(key) || "automatic1111";
}

function defaultImageEndpoint(backend) {
  return normalizeImageBackend(backend) === "openai-compatible"
    ? "/v1/images/generations"
    : "/sdapi/v1/txt2img";
}

function normalizeImageDimensions(input = {}) {
  const size = String(input.size || "").trim().toLowerCase();
  const match = size.match(/^(\d{2,4})x(\d{2,4})$/);
  const width = match ? Number(match[1]) : Number(input.width || 512);
  const height = match ? Number(match[2]) : Number(input.height || 512);
  return {
    width: clampDimension(width),
    height: clampDimension(height)
  };
}

function clampDimension(value) {
  const number = Number.isFinite(value) ? Math.round(value) : 512;
  return Math.max(64, Math.min(2048, number));
}

function normalizeImageFormat(value, fallback = "png") {
  const cleaned = String(value || fallback || "png").toLowerCase().replace(/^\./, "");
  return ["png", "jpg", "jpeg", "webp"].includes(cleaned) ? (cleaned === "jpeg" ? "jpg" : cleaned) : "png";
}

function imageMediaTypeForFormat(format) {
  const normalized = normalizeImageFormat(format);
  return {
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp"
  }[normalized] || "image/png";
}

function detectGeneratedImageFormat(buffer, mediaTypeHint = "") {
  const hint = String(mediaTypeHint || "").toLowerCase();
  if (hint.includes("jpeg") || hint.includes("jpg")) return "jpg";
  if (hint.includes("webp")) return "webp";
  if (Buffer.isBuffer(buffer)) {
    if (buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return "png";
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "jpg";
    }
    if (buffer.length >= 12 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") {
      return "webp";
    }
  }
  return "png";
}

function buildImageGenerationPayload(options = {}) {
  const backend = normalizeImageBackend(options.backend);
  const { width, height } = normalizeImageDimensions(options);
  const count = Math.max(1, Math.min(4, Number(options.count || options.n || 1) || 1));
  const prompt = normalizeImagePrompt(options.prompt);
  if (backend === "openai-compatible") {
    return {
      ...(options.model ? { model: String(options.model).trim() } : {}),
      prompt,
      n: count,
      size: `${width}x${height}`,
      response_format: "b64_json"
    };
  }
  return {
    prompt,
    ...(options.negativePrompt ? { negative_prompt: normalizeImagePrompt(options.negativePrompt) } : {}),
    width,
    height,
    steps: clampInt(options.steps, 1, 150, 20),
    batch_size: count,
    n_iter: 1,
    ...(options.seed !== undefined && options.seed !== null && String(options.seed).trim() !== "" ? { seed: Number(options.seed) } : {}),
    ...(options.cfgScale || options.cfg_scale ? { cfg_scale: Number(options.cfgScale || options.cfg_scale) } : {}),
    ...(options.sampler ? { sampler_name: String(options.sampler).trim() } : {})
  };
}

function parseGeneratedImages(responseBody) {
  const body = responseBody || {};
  const candidates = [];
  if (Array.isArray(body.images)) {
    candidates.push(...body.images.map((item, index) => ({ item, index })));
  }
  if (Array.isArray(body.data)) {
    candidates.push(...body.data.map((item, index) => ({ item, index })));
  }
  if (Array.isArray(body.output)) {
    candidates.push(...body.output.map((item, index) => ({ item, index })));
  }
  if (body.image) {
    candidates.push({ item: body.image, index: 0 });
  }

  const info = parseGenerationInfo(body.info);
  return candidates
    .map(({ item, index }) => parseGeneratedImageItem(item, index, info))
    .filter(Boolean);
}

function parseGeneratedImageItem(item, index, info) {
  const source = typeof item === "string"
    ? item
    : item && typeof item === "object"
      ? item.b64_json || item.base64 || item.image || item.url
      : "";
  if (!source) {
    return null;
  }
  const decoded = decodeGeneratedImageBase64(source);
  if (!decoded) {
    return null;
  }
  const seed = item && typeof item === "object" && item.seed !== undefined
    ? item.seed
    : Array.isArray(info.all_seeds)
      ? info.all_seeds[index]
      : info.seed;
  return {
    buffer: decoded.buffer,
    mediaType: decoded.mediaType,
    seed,
    sourceIndex: index
  };
}

function decodeGeneratedImageBase64(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const dataUrl = text.match(/^data:([^;,]+);base64,(.+)$/i);
  const mediaType = dataUrl ? dataUrl[1].toLowerCase() : "";
  const encoded = dataUrl ? dataUrl[2] : text;
  if (!dataUrl && !/^[A-Za-z0-9+/=\s_-]+$/.test(encoded)) {
    return null;
  }
  try {
    const buffer = Buffer.from(encoded.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (!buffer.length) {
      return null;
    }
    return { buffer, mediaType };
  } catch {
    return null;
  }
}

function parseGenerationInfo(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function buildImageProvenanceMarkdown(details = {}) {
  const outputs = Array.isArray(details.outputs) ? details.outputs : [];
  const parameters = details.parameters || {};
  return [
    "# AgentTrail Image Generation Provenance",
    "",
    `Generated: ${details.finishedAt || new Date().toISOString()}`,
    `Backend: ${details.backend || "unknown"}`,
    `Endpoint: ${details.endpoint || "unknown"}`,
    details.model ? `Model: ${details.model}` : null,
    `Prompt characters: ${String(details.prompt || "").length}`,
    "",
    "## Prompt",
    "",
    details.prompt || "",
    "",
    details.negativePrompt ? "## Negative Prompt" : null,
    details.negativePrompt ? "" : null,
    details.negativePrompt || null,
    details.negativePrompt ? "" : null,
    "## Parameters",
    "",
    ...Object.entries(parameters).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`),
    "",
    "## Outputs",
    "",
    ...outputs.flatMap((output, index) => [
      `### Image ${index + 1}`,
      "",
      `- Path: ${output.path}`,
      `- Media type: ${output.mediaType}`,
      `- Bytes: ${output.size}`,
      `- SHA-256: ${output.hash}`,
      output.seed !== undefined && output.seed !== null && output.seed !== "" ? `- Seed: ${output.seed}` : null,
      ""
    ])
  ].filter((line) => line !== null && line !== undefined).join("\n");
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

module.exports = {
  normalizeImagePrompt,
  normalizeImageBackend,
  defaultImageEndpoint,
  normalizeImageDimensions,
  normalizeImageFormat,
  imageMediaTypeForFormat,
  detectGeneratedImageFormat,
  buildImageGenerationPayload,
  parseGeneratedImages,
  decodeGeneratedImageBase64,
  buildImageProvenanceMarkdown
};
