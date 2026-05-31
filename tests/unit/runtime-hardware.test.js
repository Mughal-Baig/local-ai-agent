#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  detectRuntimeHardware,
  normalizeAccelerationBackend,
  recommendThreads
} = require("../../src/runtime-hardware");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const apple = detectRuntimeHardware({}, fakeSystem({ platform: "darwin", arch: "arm64", cpuCount: 10 }));
  assert.equal(apple.selectedBackend, "metal");
  assert.equal(apple.cpu.simd, "neon");
  assert.equal(apple.threading.effective, 9);
  assert.equal(apple.offload.mode, "auto");

  const cuda = detectRuntimeHardware({
    AGENTTRAIL_ACCELERATION_BACKEND: "cuda",
    CUDA_HOME: "/opt/cuda",
    AGENTTRAIL_BUNDLED_GPU_LAYERS: "all"
  }, fakeSystem({ platform: "linux", arch: "x64", existingPaths: ["/opt/cuda"] }));
  assert.equal(cuda.selectedBackend, "cuda");
  assert.equal(cuda.offload.loadValue, -1);
  assert.equal(cuda.selected.fallback, false);

  const rocm = detectRuntimeHardware({
    AGENTTRAIL_ACCELERATION_BACKEND: "rocm",
    HIP_PATH: "/opt/rocm",
    AGENTTRAIL_BUNDLED_THREADS: "6",
    AGENTTRAIL_BUNDLED_GPU_LAYERS: "18"
  }, fakeSystem({ platform: "linux", arch: "x64", existingPaths: ["/opt/rocm"] }));
  assert.equal(rocm.selectedBackend, "rocm");
  assert.equal(rocm.threading.effective, 6);
  assert.equal(rocm.offload.effectiveLayers, 18);

  const vulkan = detectRuntimeHardware({
    VULKAN_SDK: "/sdk/vulkan"
  }, fakeSystem({ platform: "linux", arch: "arm64", existingPaths: ["/sdk/vulkan"] }));
  assert.equal(vulkan.selectedBackend, "vulkan");

  const fallback = detectRuntimeHardware({
    AGENTTRAIL_ACCELERATION_BACKEND: "cuda",
    AGENTTRAIL_BUNDLED_GPU_LAYERS: "32"
  }, fakeSystem({ platform: "linux", arch: "x64" }));
  assert.equal(fallback.selectedBackend, "cpu");
  assert.equal(fallback.selected.fallback, true);
  assert.equal(fallback.offload.loadValue, 0);

  assert.equal(normalizeAccelerationBackend("nvidia"), "cuda");
  assert.equal(normalizeAccelerationBackend("mps"), "metal");
  assert.equal(normalizeAccelerationBackend("bad-value"), "auto");
  assert.equal(recommendThreads(2), 2);
  assert.equal(recommendThreads(16), 12);

  console.log("Runtime hardware unit tests passed");
}

function fakeSystem({ platform, arch, cpuCount = 8, existingPaths = [] }) {
  const paths = new Set(existingPaths);
  return {
    platform,
    arch,
    cpus: Array.from({ length: cpuCount }, () => ({ model: `${arch}-test-cpu` })),
    totalMemory: 32 * 1024 * 1024 * 1024,
    pathExists(value) {
      return paths.has(value);
    }
  };
}
