"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { pipeline } = require("node:stream/promises");
const { validateNetworkEgress, normalizeNetworkAllowlist } = require("./network-policy");
const { atomicWriteFile } = require("./resilience");

const REGISTRY_SCHEMA = "agenttrail.model-registry.v1";
const MODELFILE_SCHEMA = "agenttrail.modelfile.v1";

function registryPaths(workspaceRoot, env = process.env) {
  const root = path.resolve(workspaceRoot, env.AGENTTRAIL_MODEL_REGISTRY_DIR || ".agenttrail/model-registry");
  return {
    root,
    modelsDir: path.join(root, "models"),
    downloadsDir: path.join(root, "downloads"),
    sharesDir: path.join(root, "shares"),
    indexPath: path.join(root, "index.json")
  };
}

async function ensureModelRegistry(workspaceRoot, env = process.env) {
  const paths = registryPaths(workspaceRoot, env);
  await fsp.mkdir(paths.modelsDir, { recursive: true });
  await fsp.mkdir(paths.downloadsDir, { recursive: true });
  await fsp.mkdir(paths.sharesDir, { recursive: true });
  const index = await readModelIndex(workspaceRoot, env);
  await writeModelIndex(workspaceRoot, index, env);
  return paths;
}

async function readModelIndex(workspaceRoot, env = process.env) {
  const paths = registryPaths(workspaceRoot, env);
  try {
    const data = JSON.parse(await fsp.readFile(paths.indexPath, "utf8"));
    return {
      schema: REGISTRY_SCHEMA,
      updatedAt: data.updatedAt || new Date().toISOString(),
      models: Array.isArray(data.models) ? data.models : []
    };
  } catch {
    return { schema: REGISTRY_SCHEMA, updatedAt: new Date().toISOString(), models: [] };
  }
}

async function writeModelIndex(workspaceRoot, index, env = process.env) {
  const paths = registryPaths(workspaceRoot, env);
  await fsp.mkdir(paths.root, { recursive: true });
  const next = {
    schema: REGISTRY_SCHEMA,
    updatedAt: new Date().toISOString(),
    models: Array.isArray(index.models) ? index.models.sort((a, b) => a.name.localeCompare(b.name)) : []
  };
  await atomicWriteFile(paths.indexPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

async function listLocalModels(workspaceRoot, env = process.env) {
  await ensureModelRegistry(workspaceRoot, env);
  const index = await readModelIndex(workspaceRoot, env);
  return index.models;
}

async function showLocalModel(workspaceRoot, name, env = process.env) {
  const model = (await listLocalModels(workspaceRoot, env)).find((item) => item.name === name || item.slug === name);
  if (!model) {
    throw new Error(`Model not found in local registry: ${name}`);
  }
  return model;
}

async function pullModel(workspaceRoot, input, env = process.env, onProgress = null) {
  await ensureModelRegistry(workspaceRoot, env);
  const source = resolveRegistrySource(input.source || input.url || input.reference || "");
  const name = normalizeModelName(input.name || source.name || path.basename(source.file || source.url || "model.gguf"));
  const slug = modelSlug(name);
  const paths = registryPaths(workspaceRoot, env);
  const modelDir = path.join(paths.modelsDir, slug);
  await fsp.mkdir(modelDir, { recursive: true });

  const filename = safeFilename(input.filename || path.basename(source.file || source.url || `${slug}.gguf`));
  const destination = path.join(modelDir, filename);
  const partPath = `${destination}.part`;
  const downloadUrl = input.url || source.url;
  if (!downloadUrl) {
    throw new Error(`No direct download URL is available for ${source.type} reference. Provide url for this registry.`);
  }

  emit(onProgress, "resolved", { name, source });
  const download = await resumableDownload({
    url: downloadUrl,
    destination,
    partPath,
    sha256: input.sha256 || "",
    headers: registryHeaders(input, env),
    allowlist: registryAllowlist(input, source, env),
    env,
    onProgress: (event) => emit(onProgress, "progress", event)
  });
  const sha256 = download.sha256 || await sha256File(destination);
  const verification = await verifyModelProvenance({
    filePath: destination,
    sha256,
    expectedSha256: input.sha256 || "",
    signature: input.signature || "",
    publicKey: input.publicKey || ""
  });
  const metadata = await upsertModel(workspaceRoot, {
    name,
    slug,
    path: destination,
    relativePath: path.relative(workspaceRoot, destination),
    size: download.size,
    sha256,
    tags: normalizeTags(input.tags),
    source,
    provenance: {
      pulledAt: new Date().toISOString(),
      source: input.source || input.url || "",
      url: downloadUrl,
      resume: download.resumed,
      bytesWritten: download.size
    },
    verification,
    kind: "pulled"
  }, env);
  emit(onProgress, "done", { name, sha256, size: download.size });
  return metadata;
}

async function importModelFile(workspaceRoot, input, env = process.env) {
  await ensureModelRegistry(workspaceRoot, env);
  const sourcePath = path.resolve(input.sourcePath || input.path || "");
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("A readable sourcePath is required.");
  }
  const name = normalizeModelName(input.name || path.basename(sourcePath));
  const slug = modelSlug(name);
  const paths = registryPaths(workspaceRoot, env);
  const modelDir = path.join(paths.modelsDir, slug);
  await fsp.mkdir(modelDir, { recursive: true });
  const destination = path.join(modelDir, safeFilename(input.filename || path.basename(sourcePath)));
  await fsp.copyFile(sourcePath, destination);
  const stat = await fsp.stat(destination);
  const sha256 = await sha256File(destination);
  return upsertModel(workspaceRoot, {
    name,
    slug,
    path: destination,
    relativePath: path.relative(workspaceRoot, destination),
    size: stat.size,
    sha256,
    tags: normalizeTags(input.tags),
    source: { type: "local", url: sourcePath, name },
    provenance: { importedAt: new Date().toISOString(), sourcePath },
    verification: { ok: true, sha256: true, signature: input.signature ? "provided" : "not-provided" },
    kind: "imported"
  }, env);
}

async function createModelFromSpec(workspaceRoot, input, env = process.env) {
  await ensureModelRegistry(workspaceRoot, env);
  const spec = parseModelSpec(input.spec || input.modelfile || "");
  const name = normalizeModelName(input.name || spec.name || "agenttrail-derived-model");
  const slug = modelSlug(name);
  const paths = registryPaths(workspaceRoot, env);
  const modelDir = path.join(paths.modelsDir, slug);
  await fsp.mkdir(modelDir, { recursive: true });

  let base = null;
  if (spec.from) {
    base = await resolveBaseModel(workspaceRoot, spec.from, env);
  }
  const manifest = {
    schema: MODELFILE_SCHEMA,
    name,
    createdAt: new Date().toISOString(),
    from: spec.from || "",
    baseModel: base ? { name: base.name, sha256: base.sha256, path: base.relativePath } : null,
    parameters: spec.parameters,
    template: spec.template,
    system: spec.system,
    license: spec.license,
    tags: normalizeTags([...normalizeTags(input.tags), ...spec.tags])
  };
  const manifestPath = path.join(modelDir, "Modelfile.agenttrail.json");
  await atomicWriteFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const sha256 = await sha256File(manifestPath);
  return upsertModel(workspaceRoot, {
    name,
    slug,
    path: manifestPath,
    relativePath: path.relative(workspaceRoot, manifestPath),
    size: (await fsp.stat(manifestPath)).size,
    sha256,
    tags: manifest.tags,
    source: { type: "modelfile", from: spec.from || "" },
    provenance: { createdAt: manifest.createdAt, manifest },
    verification: { ok: true, sha256: true, signature: "manifest-only" },
    kind: "derived"
  }, env);
}

async function copyModel(workspaceRoot, fromName, toName, env = process.env) {
  const source = await showLocalModel(workspaceRoot, fromName, env);
  const name = normalizeModelName(toName);
  const slug = modelSlug(name);
  const paths = registryPaths(workspaceRoot, env);
  const modelDir = path.join(paths.modelsDir, slug);
  await fsp.mkdir(modelDir, { recursive: true });
  const destination = path.join(modelDir, path.basename(source.path));
  await fsp.copyFile(source.path, destination);
  const sha256 = await sha256File(destination);
  return upsertModel(workspaceRoot, {
    ...source,
    name,
    slug,
    path: destination,
    relativePath: path.relative(workspaceRoot, destination),
    sha256,
    copiedFrom: source.name,
    provenance: { ...(source.provenance || {}), copiedAt: new Date().toISOString(), copiedFrom: source.name },
    kind: source.kind || "copy"
  }, env);
}

async function shareModel(workspaceRoot, input, env = process.env) {
  const model = await showLocalModel(workspaceRoot, input.name, env);
  const paths = registryPaths(workspaceRoot, env);
  await fsp.mkdir(paths.sharesDir, { recursive: true });
  const manifest = {
    schema: "agenttrail.model-share.v1",
    createdAt: new Date().toISOString(),
    registry: input.registry || "local-manifest",
    model: publicModelMetadata(model),
    provenance: model.provenance || {},
    verification: model.verification || {}
  };
  const destination = input.destination
    ? path.resolve(input.destination)
    : path.join(paths.sharesDir, `${model.slug}.share.json`);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await atomicWriteFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { ok: true, pushed: false, manifestPath: destination, manifest };
}

async function resumableDownload({ url, destination, partPath = `${destination}.part`, sha256 = "", headers = {}, allowlist = [], env = process.env, onProgress = null }) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const existing = await statSize(partPath);
  const parsed = new URL(url);
  if (parsed.protocol === "file:") {
    return copyFileResumable(fileURLToPath(parsed), destination, partPath, sha256, existing, onProgress);
  }
  validateNetworkEgress(parsed, {
    allowlist,
    requireAllowlist: true,
    allowPrivate: false,
    purpose: "model-registry-pull",
    env
  });

  const requestHeaders = { ...headers };
  if (existing > 0) requestHeaders.Range = `bytes=${existing}-`;
  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok && !(response.status === 206 && existing > 0)) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Download response did not include a body.");
  }
  if (existing > 0 && response.status !== 206) {
    await fsp.rm(partPath, { force: true });
  }
  const mode = existing > 0 && response.status === 206 ? "a" : "w";
  const write = fs.createWriteStream(partPath, { flags: mode });
  let written = mode === "a" ? existing : 0;
  const total = Number(response.headers.get("content-length") || 0) + (mode === "a" ? existing : 0);
  for await (const chunk of response.body) {
    written += chunk.length;
    emit(onProgress, "progress", { completed: written, total: total || null, resumed: mode === "a" });
    if (!write.write(chunk)) await onceDrain(write);
  }
  await new Promise((resolve, reject) => write.end((error) => error ? reject(error) : resolve()));
  const actual = await sha256File(partPath);
  if (sha256 && actual !== sha256) {
    throw new Error(`Checksum mismatch: expected ${sha256}, got ${actual}`);
  }
  await fsp.rename(partPath, destination);
  return { path: destination, sha256: actual, size: await statSize(destination), resumed: mode === "a" };
}

async function copyFileResumable(source, destination, partPath, expectedSha256, existing, onProgress) {
  const total = await statSize(source);
  const read = fs.createReadStream(source, { start: existing });
  const write = fs.createWriteStream(partPath, { flags: existing > 0 ? "a" : "w" });
  let completed = existing;
  read.on("data", (chunk) => {
    completed += chunk.length;
    emit(onProgress, "progress", { completed, total, resumed: existing > 0 });
  });
  await pipeline(read, write);
  const actual = await sha256File(partPath);
  if (expectedSha256 && actual !== expectedSha256) {
    throw new Error(`Checksum mismatch: expected ${expectedSha256}, got ${actual}`);
  }
  await fsp.rename(partPath, destination);
  return { path: destination, sha256: actual, size: total, resumed: existing > 0 };
}

async function verifyModelProvenance({ filePath, sha256 = "", expectedSha256 = "", signature = "", publicKey = "" }) {
  const actual = normalizeDigest(sha256 || await sha256File(filePath));
  const expected = normalizeDigest(expectedSha256);
  const shaOk = expected ? actual === expected : true;
  let signatureOk = !signature;
  if (signature && publicKey) {
    try {
      signatureOk = crypto.verify("sha256", Buffer.from(actual), publicKey, Buffer.from(signature, "base64"));
    } catch {
      signatureOk = false;
    }
  } else if (signature) {
    const normalized = normalizeDigest(signature);
    signatureOk = normalized === actual;
  }
  return {
    ok: shaOk && signatureOk,
    sha256: shaOk,
    signature: signature ? signatureOk : "not-provided",
    expectedSha256: expected || "",
    actualSha256: actual
  };
}

function parseModelSpec(text) {
  const spec = { from: "", parameters: {}, tags: [], template: "", system: "", license: "" };
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [keywordRaw, ...rest] = line.split(/\s+/);
    const keyword = keywordRaw.toUpperCase();
    const value = rest.join(" ").trim().replace(/^"|"$/g, "");
    if (keyword === "FROM") spec.from = value;
    else if (keyword === "NAME") spec.name = value;
    else if (keyword === "PARAMETER") {
      const [key, ...parts] = rest;
      if (key) spec.parameters[key] = parts.join(" ").replace(/^"|"$/g, "");
    } else if (keyword === "TAG") {
      spec.tags.push(...normalizeTags(value.split(/[,\s]+/)));
    } else if (keyword === "TEMPLATE") spec.template = value;
    else if (keyword === "SYSTEM") spec.system = value;
    else if (keyword === "LICENSE") spec.license = value;
  }
  return spec;
}

function resolveRegistrySource(reference) {
  const value = String(reference || "").trim();
  if (!value) return { type: "unknown", url: "", name: "" };
  if (/^https?:\/\//i.test(value) || value.startsWith("file:")) {
    return { type: value.startsWith("file:") ? "file" : "http", url: value, name: path.basename(value.split("?")[0]) };
  }
  if (value.startsWith("hf://") || value.startsWith("huggingface://")) {
    const url = new URL(value.replace(/^huggingface:\/\//, "hf://"));
    const segments = url.pathname.split("/").filter(Boolean);
    const repo = [url.hostname, segments.shift()].filter(Boolean).join("/");
    const file = segments.join("/") || "model.gguf";
    const revision = url.searchParams.get("revision") || "main";
    return {
      type: "huggingface",
      repo,
      file,
      revision,
      name: `${repo}:${path.basename(file)}`,
      url: `https://huggingface.co/${repo}/resolve/${revision}/${file}`
    };
  }
  if (value.startsWith("oci://")) {
    return { type: "oci", reference: value, url: "", name: value.replace(/^oci:\/\//, "") };
  }
  return { type: "local", url: pathToFileUrl(path.resolve(value)), name: path.basename(value), file: value };
}

async function upsertModel(workspaceRoot, model, env) {
  const index = await readModelIndex(workspaceRoot, env);
  const now = new Date().toISOString();
  const existing = index.models.find((item) => item.name === model.name || item.slug === model.slug);
  const record = {
    schema: "agenttrail.model.v1",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    ...model
  };
  index.models = index.models.filter((item) => item.name !== model.name && item.slug !== model.slug);
  index.models.push(record);
  await writeModelIndex(workspaceRoot, index, env);
  return record;
}

async function resolveBaseModel(workspaceRoot, from, env) {
  try {
    return await showLocalModel(workspaceRoot, from, env);
  } catch {
    return null;
  }
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function statSize(filePath) {
  try {
    return (await fsp.stat(filePath)).size;
  } catch {
    return 0;
  }
}

function registryHeaders(input, env = process.env) {
  const headers = {};
  const token = input.token || env.HUGGINGFACE_TOKEN || env.AGENTTRAIL_REGISTRY_TOKEN || "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function registryAllowlist(input, source, env = process.env) {
  const entries = [
    ...(Array.isArray(input.allowlist) ? input.allowlist : String(input.allowlist || "").split(/[,\s]+/)),
    ...(env.AGENTTRAIL_MODEL_REGISTRY_ALLOWLIST ? String(env.AGENTTRAIL_MODEL_REGISTRY_ALLOWLIST).split(/[,\s]+/) : []),
    source && source.type === "huggingface" ? "huggingface.co" : ""
  ];
  return normalizeNetworkAllowlist(entries, env);
}

function publicModelMetadata(model) {
  return {
    name: model.name,
    slug: model.slug,
    size: model.size,
    sha256: model.sha256,
    tags: model.tags || [],
    source: model.source || {},
    kind: model.kind || "model"
  };
}

function normalizeModelName(value) {
  const name = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,160}$/.test(name)) {
    throw new Error("A valid model name is required.");
  }
  return name;
}

function modelSlug(value) {
  return normalizeModelName(value).replace(/[^A-Za-z0-9._-]+/g, "--").slice(0, 180);
}

function safeFilename(value) {
  return path.basename(String(value || "model.gguf")).replace(/[^A-Za-z0-9._-]+/g, "-") || "model.gguf";
}

function normalizeTags(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,\s]+/);
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))].slice(0, 24);
}

function normalizeDigest(value) {
  return String(value || "").trim().replace(/^sha256[:=]/i, "").toLowerCase();
}

function pathToFileUrl(filePath) {
  return pathToFileURL(path.resolve(filePath)).href;
}

function emit(fn, event, data) {
  if (typeof fn === "function") fn({ event, ...data });
}

function onceDrain(stream) {
  return new Promise((resolve) => stream.once("drain", resolve));
}

module.exports = {
  REGISTRY_SCHEMA,
  MODELFILE_SCHEMA,
  registryPaths,
  ensureModelRegistry,
  readModelIndex,
  listLocalModels,
  showLocalModel,
  pullModel,
  importModelFile,
  createModelFromSpec,
  copyModel,
  shareModel,
  resumableDownload,
  verifyModelProvenance,
  parseModelSpec,
  resolveRegistrySource,
  sha256File,
  modelSlug
};
