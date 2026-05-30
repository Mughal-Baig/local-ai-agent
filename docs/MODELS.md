# Model Guide

These are practical starting points. Local performance depends on RAM, VRAM, CPU, and quantization.

| Use Case | Try First | Notes |
| --- | --- | --- |
| Low-memory chat | `llama3.2:3b` | Fast, good for simple notes and summaries. |
| Balanced local assistant | `gemma3:4b` | Good default for short workspace tasks. |
| Better reasoning | `qwen2.5:7b` | Stronger but slower on small machines. |
| Coding help | `qwen2.5-coder:7b` | Better for code review and implementation recipes. |
| Larger local setup | `llama3.1:8b` | Good if your machine can handle it. |

## Tool-Use Tips

- Keep selected files focused.
- Prefer explicit prompts.
- Use receipts to inspect what the model did.
- Keep writes disabled until you need them.
- If tool calls are unreliable, try a stronger model.
