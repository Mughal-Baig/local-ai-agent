# Model Guide

These are practical starting points. Local performance depends on RAM, VRAM, CPU, and quantization.

| Use case | Try first | Why |
| --- | --- | --- |
| Low-memory chat | `llama3.2:3b` | Fast, good for simple notes and summaries. |
| Balanced local assistant | `gemma3:4b` | Good default for short workspace tasks. |
| Better reasoning | `qwen2.5:7b` | Stronger but slower on small machines. |
| Coding help | `qwen2.5-coder:7b` | Better for code review and implementation recipes. |
| Larger local setup | `llama3.1:8b` | Good if your machine can handle it. |

## Compatibility Notes

AgentTrail can work with any Ollama model, but local models differ a lot in how reliably they follow tool instructions. Use the built-in tool capability probe from the model picker or `GET /api/tools/capability?model=...` before trusting a model with multi-step work.

| Workflow | Stronger local fit | Watch for |
| --- | --- | --- |
| Tool calls | `qwen2.5:7b`, `qwen2.5-coder:7b`, larger Llama-family models | Smaller chat models may answer in prose instead of requesting `search_workspace` or `read_file`. |
| File writes | `qwen2.5-coder:7b` | Always keep preview mode on; weaker models may overwrite more content than requested. |
| Code review | `qwen2.5-coder:7b`, `qwen2.5:7b` | Ask for file paths and line-specific findings so the response stays grounded. |
| Summarization | `llama3.2:3b`, `gemma3:4b`, `llama3.1:8b` | Small models are fine for short notes but lose detail on long receipts. |
| Planning | `qwen2.5:7b`, `llama3.1:8b` | Keep the step budget low until the plan looks reasonable. |
| Long receipts or reports | Larger context models with `OLLAMA_NUM_CTX` raised | More context costs memory; confirm `/api/runtime` and `/api/resources` before big runs. |

## Reliability Ladder

1. For a quick summary, start with a small model and no write permission.
2. For tool-heavy work, use a model that passes the tool capability probe.
3. For code edits, prefer coder-tuned models and keep `previewWrites` enabled.
4. For long-context work, raise `OLLAMA_NUM_CTX` and select fewer files.
5. For repeated recipes, compare models in `/api/models/compare` and keep the model with the best tool, coding, planning, and vision scores.

## Tool-Use Tips

- Keep selected files focused.
- Prefer explicit prompts.
- Use receipts to inspect what the model did.
- Keep writes disabled until you need them.
- If tool calls are unreliable, try a stronger model.
- If a model ignores a recipe, paste the recipe goal into the prompt and ask it to call the needed tool by name.
