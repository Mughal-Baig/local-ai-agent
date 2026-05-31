# Model Ecosystem

Epic AC adds a local model ecosystem layer around AgentTrail's existing model registry. It does not bundle heavy native training or conversion stacks. Instead, AgentTrail creates auditable manifests, validates local paths, stores run records, and delegates to user-installed tools through explicit no-shell commands.

## What It Covers

| Task | API | Artifact |
| --- | --- | --- |
| LoRA/adapter loading | `POST /api/model-ecosystem/adapters` | `agenttrail.lora-adapter.v1` |
| Fine-tuning launcher | `POST /api/model-ecosystem/fine-tune` | `agenttrail.fine-tune-launch.v1` |
| Quantization wrapper | `POST /api/model-ecosystem/quantize` | `agenttrail.quantization-job.v1` |
| Safetensors to GGUF conversion | `POST /api/model-ecosystem/convert` | `agenttrail.model-conversion.v1` |
| Per-task model evaluation | `POST /api/model-ecosystem/evaluate` | `agenttrail.model-eval-suite.v1` |

Status lives at:

```bash
curl http://127.0.0.1:4173/api/model-ecosystem
```

## Delegate Commands

AgentTrail uses `execFile`, not a shell. Configure commands as either a quoted command string or a JSON array. JSON arrays are safest when paths contain spaces.

```bash
export AGENTTRAIL_TRAINER_COMMAND='["/usr/local/bin/llamafactory-cli","train","{config}"]'
export AGENTTRAIL_QUANTIZE_COMMAND='["/usr/local/bin/llama-quantize","{source}","{output}","{quantization}"]'
export AGENTTRAIL_CONVERT_COMMAND='["/usr/local/bin/convert-hf-to-gguf.py","{source}","--outfile","{output}"]'
```

Supported placeholders:

- `{task}`
- `{name}`
- `{baseModel}`
- `{dataset}`
- `{config}`
- `{source}`
- `{input}`
- `{output}`
- `{quantization}`
- `{format}`
- `{sourceFormat}`
- `{method}`

Requests default to dry-run planning. Set `"dryRun": false` to execute the configured delegate command.

## LoRA Adapter Registration

```bash
curl -X POST http://127.0.0.1:4173/api/model-ecosystem/adapters \
  -H 'content-type: application/json' \
  -d '{
    "name": "coder/lora",
    "baseModel": "tiny/q4",
    "adapterPath": "/models/adapters/coder.safetensors",
    "rank": 8,
    "alpha": 16,
    "scale": 0.75
  }'
```

The manifest includes checksum, rank/alpha metadata, runtime hints, and llama.cpp-style adapter args.

## Fine-Tuning Launcher

```bash
curl -X POST http://127.0.0.1:4173/api/model-ecosystem/fine-tune \
  -H 'content-type: application/json' \
  -d '{
    "name": "support-lora",
    "baseModel": "tiny/q4",
    "datasetPath": "/workspace/train.jsonl",
    "method": "lora",
    "hyperparameters": { "epochs": 1, "learningRate": 0.0002 }
  }'
```

AgentTrail writes a config JSON, output directory, launch manifest, and command plan. It delegates training only when a trainer command is configured and `dryRun` is false.

## Quantization Wrapper

```bash
curl -X POST http://127.0.0.1:4173/api/model-ecosystem/quantize \
  -H 'content-type: application/json' \
  -d '{
    "name": "tiny-q5",
    "sourcePath": "/models/tiny-f16.gguf",
    "quantization": "Q5_K_M"
  }'
```

Supported presets include `Q4_K_M`, `Q5_K_M`, `Q8_0`, `F16`, and `F32`.

## Safetensors To GGUF

```bash
curl -X POST http://127.0.0.1:4173/api/model-ecosystem/convert \
  -H 'content-type: application/json' \
  -d '{
    "name": "tiny-gguf",
    "sourcePath": "/models/tiny/model.safetensors"
  }'
```

The conversion helper stores source checksum, inferred source format, target GGUF path, delegate command, and output checksum when the output exists.

## Per-Task Evaluation

```bash
curl -X POST http://127.0.0.1:4173/api/model-ecosystem/evaluate \
  -H 'content-type: application/json' \
  -d '{ "model": "llama3.2", "runPrompts": false }'
```

Offline mode creates a deterministic rubric for:

- tool use
- diff-safe coding
- planning
- long context
- safety

Set `runPrompts` to true to run evaluation prompts through the configured backend and score expected keywords in each response.

## Safety Model

- Commands run without shell interpolation.
- Paths must point to readable local files.
- Heavy tools are never installed automatically.
- Dry-run is the default.
- Every run writes a JSON manifest and is visible through `/api/model-ecosystem`.
