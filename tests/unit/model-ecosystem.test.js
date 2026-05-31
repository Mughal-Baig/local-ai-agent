#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  modelEcosystemStatus,
  registerLoraAdapter,
  launchFineTune,
  quantizeModel,
  convertModelToGguf,
  runModelEvaluationSuite,
  parseCommandTemplate,
  runDelegatedCommand
} = require("../../src/model-ecosystem");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), "agenttrail-ecosystem-"));
  try {
    const adapterPath = path.join(workspace, "coder-adapter.safetensors");
    const datasetPath = path.join(workspace, "train.jsonl");
    const ggufPath = path.join(workspace, "base-Q4_K_M.gguf");
    const safetensorsPath = path.join(workspace, "model.safetensors");
    await fsp.writeFile(adapterPath, Buffer.from("adapter"));
    await fsp.writeFile(datasetPath, "{\"prompt\":\"A\",\"completion\":\"B\"}\n");
    await fsp.writeFile(ggufPath, Buffer.alloc(2048, 3));
    await fsp.writeFile(safetensorsPath, Buffer.alloc(1024, 4));

    const adapter = await registerLoraAdapter(workspace, {
      name: "coder/lora",
      baseModel: "tiny/q4",
      adapterPath,
      rank: 8,
      alpha: 16,
      scale: 0.75,
      tags: "coder,lora"
    });
    assert.equal(adapter.schema, "agenttrail.lora-adapter.v1");
    assert.equal(adapter.baseModel, "tiny/q4");
    assert.equal(adapter.runtime.env.AGENTTRAIL_LORA_SCALE, "0.75");

    const command = JSON.stringify([process.execPath, "-e", "console.log('trainer {name} {method}')"]);
    const training = await launchFineTune(workspace, {
      name: "coder-train",
      baseModel: "tiny/q4",
      datasetPath,
      method: "lora",
      command,
      hyperparameters: { epochs: 1 }
    });
    assert.equal(training.schema, "agenttrail.fine-tune-launch.v1");
    assert.equal(training.status, "planned");
    assert.equal(training.command.configured, true);
    assert.equal(training.command.command.some((part) => part.includes("coder-train")), true);

    const quantized = await quantizeModel(workspace, {
      name: "base-q5",
      sourcePath: ggufPath,
      quantization: "Q5_K_M",
      command: "llama-quantize {source} {output} {quantization}"
    });
    assert.equal(quantized.schema, "agenttrail.quantization-job.v1");
    assert.equal(quantized.quantization, "Q5_K_M");
    assert.equal(quantized.status, "planned");
    assert.match(quantized.command.command.join(" "), /Q5_K_M/);

    const converted = await convertModelToGguf(workspace, {
      name: "model-gguf",
      sourcePath: safetensorsPath,
      command: "convert-hf-to-gguf {source} --outfile {output}"
    });
    assert.equal(converted.schema, "agenttrail.model-conversion.v1");
    assert.equal(converted.sourceFormat, "safetensors");
    assert.equal(converted.targetFormat, "gguf");

    const evaluation = await runModelEvaluationSuite(workspace, { model: "tiny/q4" });
    assert.equal(evaluation.schema, "agenttrail.model-eval-suite.v1");
    assert.equal(evaluation.taskScores.length >= 5, true);
    assert.equal(evaluation.score >= 65, true);

    const executed = await runDelegatedCommand({
      template: JSON.stringify([process.execPath, "-e", "console.log('ok')"]),
      placeholders: {},
      cwd: workspace,
      dryRun: false,
      timeoutMs: 5000
    });
    assert.equal(executed.executed, true);
    assert.match(executed.stdout, /ok/);

    assert.deepEqual(parseCommandTemplate("cmd \"two words\" {name}", { name: "value" }), ["cmd", "two words", "value"]);

    const status = await modelEcosystemStatus(workspace);
    assert.equal(status.adapters.length, 1);
    assert.equal(status.trainingRuns.length, 1);
    assert.equal(status.quantizationJobs.length, 1);
    assert.equal(status.conversions.length, 1);
    assert.equal(status.evaluations.length, 1);

    console.log("Model ecosystem unit tests passed");
  } finally {
    await fsp.rm(workspace, { recursive: true, force: true });
  }
}
