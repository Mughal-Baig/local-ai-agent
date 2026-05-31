# Showcase Gallery

The showcase gallery collects real workflows that prove AgentTrail's value: visible search, safe diffs, receipts, reports, and local-first behavior.

## What Belongs Here

- A workflow users can understand quickly.
- A receipt or report summary.
- A trust signal such as diff preview, explicit Apply, citations, or replay.
- Redacted screenshots or generated demo assets.
- Clear setup notes.

## What Does Not Belong

- Private customer data.
- Unredacted file paths from sensitive projects.
- Claims without receipts, screenshots, or reproducible steps.
- Workflows that require a cloud-only service.

## Featured Workflows

| Workflow | User | Trust signal | Artifact |
| --- | --- | --- | --- |
| Diff-safe README polish | maintainer | Search -> diff preview -> Apply -> receipt | `docs/agenttrail-demo.gif` |
| Local security review | security reviewer | Prompt-injection flags and receipt summary | `recipes/prompt-injection-review.json` |
| Release proof bundle | maintainer | Checksums, SBOM, release notes, and reproducible build | `docs/SUPPLY_CHAIN.md` |

## Submission Checklist

- Add metadata to `docs/showcase/gallery.json`.
- Include a redacted artifact path or public link.
- Explain what the agent searched, changed, and exported.
- Run `npm run test:community`.
