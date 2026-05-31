#!/usr/bin/env node

"use strict";

const { bundledRuntimeStatus, generateBundledText } = require("../src/bundled-runtime");
const { runtimeBenchmarkPlan, estimateTokens, tokensPerSecond } = require("../src/runtime-loading");

const OLLAMA_HOST = trimTrailingSlash(process.env.OLLAMA_HOST || "http://127.0.0.1:11434");
const MODEL = process.env.OLLAMA_MODEL || process.env.AGENTTRAIL_BUNDLED_MODEL_NAME || "llama3.2";

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  const plan = runtimeBenchmarkPlan(process.env);
  const results = {
    schema: "agenttrail.runtime-benchmark.v1",
    model: MODEL,
    promptTokens: estimateTokens(plan.prompt),
    targetTokens: plan.targetTokens,
    runs: plan.runs,
    bundled: null,
    ollama: null
  };

  const runtime = await bundledRuntimeStatus(process.env, process.cwd(), MODEL);
  if (runtime.available) {
    results.bundled = await benchmarkBundled(plan);
  } else {
    results.bundled = { skipped: true, reason: runtime.reason };
  }

  if (plan.compareToOllama) {
    results.ollama = await benchmarkOllama(plan).catch((error) => ({ skipped: true, reason: error.message }));
  }

  if (results.bundled && results.ollama && !results.bundled.skipped && !results.ollama.skipped) {
    results.ratio = Number((results.bundled.tokensPerSecond / Math.max(0.001, results.ollama.tokensPerSecond)).toFixed(3));
  }

  console.log(JSON.stringify(results, null, 2));
}

async function benchmarkBundled(plan) {
  const samples = [];
  for (let i = 0; i < plan.runs; i += 1) {
    const started = Date.now();
    const text = await generateBundledText({
      env: process.env,
      projectRoot: process.cwd(),
      model: MODEL,
      prompt: plan.prompt,
      options: { temperature: 0, num_predict: plan.targetTokens }
    });
    const ended = Date.now();
    samples.push(sample(text, started, ended));
  }
  return summarizeSamples("bundled", samples);
}

async function benchmarkOllama(plan) {
  const samples = [];
  for (let i = 0; i < plan.runs; i += 1) {
    const started = Date.now();
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: plan.prompt,
        stream: false,
        options: { temperature: 0, num_predict: plan.targetTokens }
      }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Ollama benchmark returned HTTP ${response.status}. ${details}`.trim());
    }
    const data = await response.json();
    samples.push(sample(String(data.response || ""), started, Date.now()));
  }
  return summarizeSamples("ollama", samples);
}

function sample(text, started, ended) {
  return {
    tokens: estimateTokens(text),
    elapsedMs: ended - started,
    tokensPerSecond: tokensPerSecond(text, started, ended)
  };
}

function summarizeSamples(provider, samples) {
  const count = samples.length || 1;
  return {
    provider,
    runs: samples.length,
    tokens: Math.round(samples.reduce((sum, item) => sum + item.tokens, 0) / count),
    elapsedMs: Math.round(samples.reduce((sum, item) => sum + item.elapsedMs, 0) / count),
    tokensPerSecond: Number((samples.reduce((sum, item) => sum + item.tokensPerSecond, 0) / count).toFixed(2)),
    samples
  };
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
