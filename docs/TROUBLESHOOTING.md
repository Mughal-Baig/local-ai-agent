# Troubleshooting

Most failures fall into one of five buckets: model server offline, workspace boundary, permissions, missing local helper binary, or stale generated docs/release proof.

## Ollama Is Not Connected

Check that Ollama is running:

```bash
curl http://127.0.0.1:11434/api/tags
```

If it fails, open Ollama or start it from your system service.

If AgentTrail uses another backend, check [BACKEND_SETUP.md](BACKEND_SETUP.md) and confirm the configured host is reachable.

## No Models Appear

Pull a small model first:

```bash
ollama pull llama3.2
```

Then refresh the app.

For LM Studio, llama.cpp, vLLM, or another OpenAI-compatible server, make sure `AGENTTRAIL_MODEL_ADAPTER`, host, and model id match the backend.

## Responses Are Slow

- Try a smaller model.
- Close other GPU-heavy apps.
- Check whether Ollama is using GPU acceleration.
- Keep selected files small.
- Check `/api/resources` and `/api/runtime`.
- Run `npm run bench:quality` to rule out local app regressions.

## Semantic Search Returns Weak Results

- Pull or configure an embedding model, such as `nomic-embed-text`.
- Rebuild the search index from the app or call `/api/search-index`.
- Keep generated files, huge artifacts, and private caches out of `workspace/`.
- Use collection filters if a project has unrelated documents.

## File Reads Do Not Work

- Make sure **Allow file reads** is enabled.
- Put files inside `workspace/`.
- Avoid files larger than the app read limit.
- Absolute paths such as `/tmp/file.md` are intentionally rejected. Copy files into `workspace/` or attach them through the browser.

## File Writes Do Not Work

Writes are disabled by default.

Enable **Allow file writes** in the Permissions panel, then ask the agent to write a file inside `workspace/`.

If preview mode is on, writes appear in Diff Review first. Click Apply to write them.

## Receipts Do Not Save

Receipts are saved to:

```text
workspace/receipts/
```

If saving fails, check that the workspace folder is writable.

Encrypted receipts require the same `AGENTTRAIL_ENCRYPTION_KEY` to read them back.

## Attachments Do Not Work

- Check file size limits in `.env.example`.
- For audio, configure `AGENTTRAIL_TRANSCRIBE_COMMAND`.
- For OCR, configure `AGENTTRAIL_OCR_COMMAND`.
- For image generation, configure `AGENTTRAIL_IMAGE_HOST`.

## Voice Or TTS Fails

AgentTrail calls local helper commands. Install or configure the command first:

```bash
AGENTTRAIL_TRANSCRIBE_COMMAND=whisper-cli
AGENTTRAIL_TTS_COMMAND=say
```

On Linux, replace `say` with a local TTS command and argument template.

## OpenAI-Compatible API Returns 401 Or 429

- 401 means `AGENTTRAIL_V1_API_KEY` or `AGENTTRAIL_V1_API_KEYS` is configured and the request did not pass the key.
- 429 means the local rate limit or queue is full. Tune `AGENTTRAIL_V1_RATE_LIMIT_PER_MINUTE`, `AGENTTRAIL_V1_QUEUE_CONCURRENCY`, or `AGENTTRAIL_V1_QUEUE_MAX`.

## Team Mode Blocks A Tool

The selected local user role may not have permission. Owners/admins can write; viewer and auditor roles are read-oriented. Check `/api/team/status` or the Team panel.

## CI Fails On Docs

Run:

```bash
npm run docs:build
npm run test:docs
```

Generated files must be committed when API routes or docs-site entries change.

## CI Fails On Checksums

Regenerate in this order:

```bash
npm run release:sbom
npm run release:homebrew
npm run release:checksums
npm run release:verify-checksums
```

If SBOM or formula changes after checksums are written, verification will fail by design.

## FAQ

### Does AgentTrail send my workspace to a cloud service?

No by default. The app talks to local model backends you configure. If you point an OpenAI-compatible adapter at a remote server, that backend receives prompts.

### Can AgentTrail edit files outside `workspace/`?

No. The workspace path resolver rejects traversal and absolute paths.

### Is this a replacement for Ollama?

No. Ollama is a model runtime. AgentTrail is the auditable agent layer around local model runtimes.

### Why do writes require preview?

Silent agent writes are hard to trust. Diff previews make the change reviewable before it touches disk.

## Do Not Expose Ollama Publicly

Keep Ollama bound to `127.0.0.1` unless you know exactly how you are securing it. Public Ollama endpoints can be abused for compute theft and unsafe tool use.
