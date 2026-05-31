# Team And Enterprise Mode

AgentTrail's team layer is local-first. It is for shared machines, demos, audits, and trusted local networks behind your own proxy. It is not a hosted account system.

## What It Adds

- Read-only shared receipts through `/api/team/receipts` and `/api/team/receipts/content`.
- Local users in `team/users.json`.
- RBAC caps for agent tools and permission toggles.
- Audit export in JSON or CSV through `/api/team/audit/export`.
- Explicit local sync package export through `/api/team/sync/export`.
- SSO identity hook through `/api/team/sso/validate`.

## Default Roles

| Role | Tools | Shared receipts | Audit export | Sync export |
| --- | --- | --- | --- | --- |
| owner | all local tools | yes | yes | yes |
| admin | all local tools | yes | yes | yes |
| editor | file/search/read/preview/write tools | yes | no | no |
| auditor | list/search/read tools | yes | yes | no |
| viewer | no agent tools | yes | no | no |

RBAC only caps permissions. It does not silently elevate a user. If the UI has writes off, an owner still has writes off until the user enables them.

## SSO Hook

The SSO hook is deliberately small so it can sit behind a trusted reverse proxy:

```bash
AGENTTRAIL_SSO_PROVIDER=header
AGENTTRAIL_SSO_ALLOWED_DOMAINS=example.com
AGENTTRAIL_SSO_HEADER_EMAIL=x-agenttrail-sso-email
```

Then call:

```bash
curl -X POST http://127.0.0.1:4173/api/team/sso/validate \
  -H 'Content-Type: application/json' \
  -d '{"email":"person@example.com","role":"auditor"}'
```

## Sync Export

Shared workspace sync is opt-in. Send `enabled:true` or set `AGENTTRAIL_TEAM_SYNC=on`; AgentTrail writes a metadata-only package under `workspace/shared-sync/`.
