#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  applyRbacToPermissions,
  auditRecordsToCsv,
  buildSharedReceipts,
  buildSyncPackage,
  exportAudit,
  normalizeAuditRecords,
  normalizeTeamUsers,
  selectTeamUser,
  ssoStatus,
  teamPermissionManifest,
  validateSsoIdentity
} = require("../../src/team-enterprise");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const users = normalizeTeamUsers({
    users: [
      { id: "owner", displayName: "Owner", role: "owner", profileId: "default" },
      { id: "viewer", displayName: "Viewer", role: "viewer", profileId: "default" },
      { id: "auditor", displayName: "Auditor", role: "auditor", profileId: "security-review" }
    ]
  }).users;
  assert.equal(users.length, 3);
  assert.equal(selectTeamUser(users, "viewer").role, "viewer");

  const viewerPermissions = applyRbacToPermissions({ readFiles: true, writeFiles: true, previewWrites: false }, users[1]);
  assert.equal(viewerPermissions.readFiles, false);
  assert.equal(viewerPermissions.writeFiles, false);
  assert.equal(viewerPermissions.toolPolicies.write_file.enabled, false);
  assert.equal(teamPermissionManifest(users[1]).find((item) => item.tool === "write_file").allowed, false);

  const receipts = buildSharedReceipts([{
    path: "receipts/demo.md",
    title: "Demo",
    modifiedAt: "2026-05-31T00:00:00.000Z",
    snippet: "Read-only receipt"
  }], users[1]);
  assert.equal(receipts.readOnly, true);
  assert.equal(receipts.count, 1);
  assert.match(receipts.receipts[0].readOnlyUrl, /\/api\/team\/receipts\/content/);

  const audit = normalizeAuditRecords({
    logs: [{ time: "2026-05-31T00:00:00.000Z", level: "info", event: "permission.audit", tool: "read_file" }],
    events: [{ createdAt: "2026-05-31T00:00:01.000Z", type: "permission-audit", payload: { actor: "owner:owner", tool: "write_file", ok: false, reason: "blocked" } }]
  });
  assert.equal(audit.length, 2);
  assert.match(auditRecordsToCsv(audit), /createdAt,source,type/);
  assert.equal(JSON.parse(exportAudit(audit, "json").body).schema, "agenttrail.audit-export.v1");

  const sync = buildSyncPackage({ receipts: receipts.receipts, profiles: [], users, audit });
  assert.equal(sync.schema, "agenttrail.team-sync.v1");
  assert.equal(sync.users.length, 3);

  assert.equal(ssoStatus({ AGENTTRAIL_SSO_ALLOWED_DOMAINS: "example.com" }).configured, true);
  assert.equal(validateSsoIdentity({ email: "person@example.com", role: "auditor" }, { AGENTTRAIL_SSO_ALLOWED_DOMAINS: "example.com" }).ok, true);
  assert.equal(validateSsoIdentity({ email: "person@elsewhere.test" }, { AGENTTRAIL_SSO_ALLOWED_DOMAINS: "example.com" }).ok, false);
  console.log("Team enterprise unit tests passed");
}
