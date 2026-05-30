# Troubleshooting

## Ollama Is Not Connected

Check that Ollama is running:

```bash
curl http://127.0.0.1:11434/api/tags
```

If it fails, open Ollama or start it from your system service.

## No Models Appear

Pull a small model first:

```bash
ollama pull llama3.2
```

Then refresh the app.

## Responses Are Slow

- Try a smaller model.
- Close other GPU-heavy apps.
- Check whether Ollama is using GPU acceleration.
- Keep selected files small.

## File Reads Do Not Work

- Make sure **Allow file reads** is enabled.
- Put files inside `workspace/`.
- Avoid files larger than the app read limit.

## File Writes Do Not Work

Writes are disabled by default.

Enable **Allow file writes** in the Permissions panel, then ask the agent to write a file inside `workspace/`.

## Receipts Do Not Save

Receipts are saved to:

```text
workspace/receipts/
```

If saving fails, check that the workspace folder is writable.

## Do Not Expose Ollama Publicly

Keep Ollama bound to `127.0.0.1` unless you know exactly how you are securing it. Public Ollama endpoints can be abused for compute theft and unsafe tool use.
