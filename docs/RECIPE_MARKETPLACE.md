# Recipe Marketplace

The AgentTrail recipe marketplace is intentionally lightweight: JSON recipes, curated role packs, visible safety expectations, and reviewable pull requests.

## Submission Path

1. Open a recipe-pack issue with role, recipes, inputs, expected outputs, and safety behavior.
2. Add or update recipes in `recipes/`.
3. Add the role pack to `recipe-packs/` if it belongs to a pack.
4. Add marketplace metadata in `marketplace/recipes.json`.
5. Run `npm run test:community`.

## Curation Rules

- Every recipe must have a specific role and task, not generic "be helpful" text.
- File-writing recipes must mention diff preview or explicit Apply.
- Recipes that inspect files should request the smallest useful workspace scope.
- Recipes that mention security must ask for evidence and avoid unsupported claims.
- Recipes must work without cloud-only services.
- A marketplace pack needs at least three useful recipes and one clear target user.

## Review Rubric

| Area | Pass condition |
| --- | --- |
| Role clarity | The intended user can tell why this pack exists in one sentence. |
| Local-first fit | It works with local files and local models. |
| Safety | File reads/writes, tools, and receipts are explicit. |
| Reuse | The recipe can be used across projects with minimal edits. |
| Evidence | Outputs ask for citations, paths, diffs, receipts, or assumptions. |

## Featured Pack Queue

- Coder Pack: stable built-in.
- Founder Pack: stable built-in.
- Security Pack: stable built-in.
- Student Pack: stable built-in.
- Writer Pack: stable built-in.
- Researcher Pack: next candidate when enough research workflows land.
- Maintainer Pack: next candidate when issue triage and release workflows mature.

## Marketplace Metadata

`marketplace/recipes.json` stores public pack metadata, submission links, and curation rules. Keep this file human-readable so contributors can update it without tooling.

```json
{
  "id": "researcher-pack",
  "title": "Researcher Pack",
  "role": "researcher",
  "recipes": ["local-rag-brief", "workspace-brief", "extract-table-json"],
  "source": "community-candidate"
}
```

## Maintainer Checklist

- Confirm all referenced recipe IDs exist.
- Confirm the pack appears in the import/export UI.
- Confirm the pack has a useful one-sentence description.
- Confirm no recipe asks users to paste secrets into external services.
- Add a short changelog entry when a pack is promoted.
