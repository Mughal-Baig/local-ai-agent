"use strict";

const fs = require("node:fs");
const os = require("node:os");

const GPU_BACKENDS = ["metal", "cuda", "rocm", "vulkan"];
const ALL_BACKENDS = [...GPU_BACKENDS, "cpu"];
const BACKEND_LABELS = {
  metal: "Metal",
  cuda: "CUDA",
  rocm: "ROCm",
  vulkan: "Vulkan",
  cpu: "CPU"
};

function detectRuntimeHardware(env = process.env, system = {}) {
  const snapshot = systemSnapshot(system);
  const requestedBackend = normalizeAccelerationBackend(env.AGENTTRAIL_ACCELERATION_BACKEND || env.AGENTTRAIL_BUNDLED_ACCELERATION || "auto");
  const cpu = detectCpu(snapshot, env);
  const candidates = buildCandidates(env, snapshot);
  const selected = selectBackend(requestedBackend, candidates);
  const offload = resolveGpuLayerOffload(env, selected.id);
  const threading = resolveThreading(env, cpu);

  return {
    schema: "agenttrail.runtime-hardware.v1",
    requestedBackend,
    selectedBackend: selected.id,
    selected,
    candidates,
    cpu,
    threading,
    offload,
    loadOptions: {
      backend: selected.id,
      gpuLayers: offload.loadValue,
      threads: threading.effective,
      cpuSimd: cpu.simd
    }
  };
}

function buildCandidates(env, snapshot) {
  const platform = snapshot.platform;
  const arch = snapshot.arch;
  const pathExists = snapshot.pathExists;
  const candidates = [];

  const metalAvailable = platform === "darwin" && arch === "arm64";
  candidates.push(candidate("metal", {
    available: metalAvailable,
    priority: 100,
    evidence: metalAvailable ? ["darwin/arm64"] : [],
    reason: metalAvailable
      ? "Apple Silicon detected; Metal is the preferred bundled acceleration path."
      : "Metal acceleration is only auto-enabled on Apple Silicon."
  }));

  const cudaEvidence = envEvidence(env, ["AGENTTRAIL_CUDA_PATH", "CUDA_HOME", "CUDA_PATH"], pathExists);
  const nvidiaVisible = String(env.NVIDIA_VISIBLE_DEVICES || "").trim();
  if (nvidiaVisible && !["void", "none", "none,", "-1"].includes(nvidiaVisible.toLowerCase())) {
    cudaEvidence.push("NVIDIA_VISIBLE_DEVICES");
  }
  candidates.push(candidate("cuda", {
    available: cudaEvidence.length > 0,
    priority: 90,
    evidence: cudaEvidence,
    reason: cudaEvidence.length
      ? "CUDA path or NVIDIA device visibility detected."
      : "Set CUDA_HOME, CUDA_PATH, AGENTTRAIL_CUDA_PATH, or NVIDIA_VISIBLE_DEVICES to enable CUDA selection."
  }));

  const rocmEvidence = envEvidence(env, ["AGENTTRAIL_ROCM_PATH", "ROCM_HOME", "ROCM_PATH", "HIP_PATH"], pathExists);
  candidates.push(candidate("rocm", {
    available: rocmEvidence.length > 0,
    priority: 80,
    evidence: rocmEvidence,
    reason: rocmEvidence.length
      ? "ROCm/HIP path detected."
      : "Set ROCM_HOME, ROCM_PATH, HIP_PATH, or AGENTTRAIL_ROCM_PATH to enable ROCm selection."
  }));

  const vulkanEvidence = envEvidence(env, ["AGENTTRAIL_VULKAN_PATH", "VULKAN_SDK", "VK_ICD_FILENAMES"], pathExists);
  candidates.push(candidate("vulkan", {
    available: vulkanEvidence.length > 0,
    priority: 70,
    evidence: vulkanEvidence,
    reason: vulkanEvidence.length
      ? "Vulkan SDK or ICD path detected."
      : "Set VULKAN_SDK, VK_ICD_FILENAMES, or AGENTTRAIL_VULKAN_PATH to enable Vulkan selection."
  }));

  candidates.push(candidate("cpu", {
    available: true,
    priority: 10,
    evidence: [`${cpuCount(snapshot.cpus)} logical CPU thread(s)`],
    reason: "CPU fallback is always available."
  }));

  return candidates;
}

function selectBackend(requestedBackend, candidates) {
  if (requestedBackend !== "auto") {
    const requested = candidates.find((item) => item.id === requestedBackend);
    if (requested && requested.available) {
      return { ...requested, mode: "manual", fallback: false };
    }
    const cpu = candidates.find((item) => item.id === "cpu");
    return {
      ...cpu,
      mode: "manual-fallback",
      fallback: true,
      requested: requestedBackend,
      reason: `${BACKEND_LABELS[requestedBackend] || requestedBackend} was requested but not detected; falling back to CPU.`
    };
  }

  const available = candidates
    .filter((item) => item.available)
    .sort((a, b) => b.priority - a.priority);
  return { ...available[0], mode: "auto", fallback: false };
}

function resolveGpuLayerOffload(env, selectedBackend) {
  const raw = firstEnv(env, ["AGENTTRAIL_BUNDLED_GPU_LAYERS", "AGENTTRAIL_GPU_LAYERS", "OLLAMA_NUM_GPU"]);
  const source = raw.key || (selectedBackend === "cpu" ? "cpu-default" : "auto-default");
  const value = String(raw.value || "").trim().toLowerCase();

  if (selectedBackend === "cpu") {
    return {
      source,
      requested: raw.value || "",
      mode: "cpu",
      effectiveLayers: 0,
      loadValue: 0,
      reason: "CPU backend selected; GPU layer offload is disabled."
    };
  }

  if (!value || value === "auto") {
    return {
      source,
      requested: raw.value || "auto",
      mode: "auto",
      effectiveLayers: null,
      loadValue: null,
      reason: "GPU backend selected; provider may choose the best offload automatically."
    };
  }
  if (["all", "max", "-1"].includes(value)) {
    return {
      source,
      requested: raw.value,
      mode: "all",
      effectiveLayers: -1,
      loadValue: -1,
      reason: "All possible layers are requested for GPU offload."
    };
  }

  const layers = Number(value);
  if (Number.isFinite(layers) && layers >= 0) {
    return {
      source,
      requested: raw.value,
      mode: layers === 0 ? "cpu" : "fixed",
      effectiveLayers: layers,
      loadValue: layers,
      reason: layers === 0 ? "GPU offload explicitly disabled." : `${layers} layer(s) requested for GPU offload.`
    };
  }

  return {
    source,
    requested: raw.value,
    mode: "auto",
    effectiveLayers: null,
    loadValue: null,
    reason: `Could not parse GPU layer setting "${raw.value}"; using provider auto mode.`
  };
}

function resolveThreading(env, cpu) {
  const raw = firstEnv(env, ["AGENTTRAIL_BUNDLED_THREADS", "AGENTTRAIL_THREADS", "OLLAMA_NUM_THREAD"]);
  const configured = Number(raw.value);
  if (Number.isFinite(configured) && configured > 0) {
    return {
      source: raw.key,
      effective: Math.max(1, Math.floor(configured)),
      recommended: cpu.recommendedThreads,
      reason: "Thread count set by environment."
    };
  }
  return {
    source: "auto",
    effective: cpu.recommendedThreads,
    recommended: cpu.recommendedThreads,
    reason: "Thread count auto-tuned from available CPU cores."
  };
}

function detectCpu(snapshot, env) {
  const count = cpuCount(snapshot.cpus);
  const model = snapshot.cpus[0] && snapshot.cpus[0].model ? snapshot.cpus[0].model : "unknown";
  const simd = String(env.AGENTTRAIL_CPU_SIMD || "").trim() || defaultSimd(snapshot.arch);
  return {
    platform: snapshot.platform,
    arch: snapshot.arch,
    logicalThreads: count,
    model,
    totalMemoryBytes: snapshot.totalMemory,
    simd,
    recommendedThreads: recommendThreads(count)
  };
}

function recommendThreads(count) {
  const safeCount = Math.max(1, Number(count) || 1);
  if (safeCount <= 2) return safeCount;
  return Math.max(1, Math.min(safeCount - 1, 12));
}

function defaultSimd(arch) {
  if (arch === "arm64") return "neon";
  if (arch === "x64") return "x64-simd";
  if (arch === "ia32") return "sse2";
  return "portable";
}

function candidate(id, input) {
  return {
    id,
    label: BACKEND_LABELS[id] || id,
    available: Boolean(input.available),
    priority: input.priority,
    evidence: input.evidence || [],
    reason: input.reason
  };
}

function envEvidence(env, keys, pathExists) {
  const evidence = [];
  for (const key of keys) {
    const value = String(env[key] || "").trim();
    if (!value) continue;
    if (key.endsWith("_PATH") || key.endsWith("_HOME") || key === "VULKAN_SDK") {
      if (pathExists(value)) {
        evidence.push(key);
      }
    } else {
      evidence.push(key);
    }
  }
  return evidence;
}

function firstEnv(env, keys) {
  for (const key of keys) {
    if (env[key] !== undefined && env[key] !== null && String(env[key]).trim() !== "") {
      return { key, value: env[key] };
    }
  }
  return { key: "", value: "" };
}

function normalizeAccelerationBackend(value) {
  const raw = String(value || "auto").trim().toLowerCase();
  const aliases = {
    apple: "metal",
    mps: "metal",
    nvidia: "cuda",
    amd: "rocm",
    hip: "rocm",
    vk: "vulkan",
    cpuonly: "cpu",
    "cpu-only": "cpu"
  };
  const normalized = aliases[raw] || raw;
  return normalized === "auto" || ALL_BACKENDS.includes(normalized) ? normalized : "auto";
}

function systemSnapshot(system) {
  const cpus = Array.isArray(system.cpus) ? system.cpus : os.cpus();
  return {
    platform: system.platform || os.platform(),
    arch: system.arch || os.arch(),
    cpus,
    totalMemory: Number(system.totalMemory || os.totalmem()),
    pathExists: typeof system.pathExists === "function" ? system.pathExists : fs.existsSync
  };
}

function cpuCount(cpus) {
  return Array.isArray(cpus) && cpus.length ? cpus.length : 1;
}

module.exports = {
  GPU_BACKENDS,
  ALL_BACKENDS,
  detectRuntimeHardware,
  normalizeAccelerationBackend,
  resolveGpuLayerOffload,
  recommendThreads
};
