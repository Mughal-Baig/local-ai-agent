(function () {
  const els = {
    refresh: document.querySelector("#refreshFoundation"),
    summary: document.querySelector("#foundationSummary"),
    details: document.querySelector("#foundationDetails"),
    audit: document.querySelector("#runFoundationJob"),
    backup: document.querySelector("#exportBackup"),
    migrations: document.querySelector("#runMigrations"),
    checksums: document.querySelector("#releaseChecksums")
  };

  if (!els.summary) {
    return;
  }

  els.refresh?.addEventListener("click", refreshFoundation);
  els.audit?.addEventListener("click", () => startJob("foundation-audit"));
  els.backup?.addEventListener("click", exportBackup);
  els.migrations?.addEventListener("click", runMigrations);
  els.checksums?.addEventListener("click", releaseChecksums);

  refreshFoundation();

  async function refreshFoundation() {
    els.summary.innerHTML = `<div class="empty-state compact">Checking foundation...</div>`;
    try {
      const [foundation, schemas, permissions, plugins, store, migrations, jobs, portability] = await Promise.all([
        getJson("/api/foundation"),
        getJson("/api/schemas"),
        getJson("/api/permissions"),
        getJson("/api/plugins"),
        getJson("/api/store/stats"),
        getJson("/api/migrations"),
        getJson("/api/jobs"),
        getJson("/api/workspace/portability")
      ]);
      els.summary.innerHTML = `
        <div class="eval-score">${Number(foundation.score || 0)}/100</div>
        <div class="eval-list"><span class="${foundation.score >= 90 ? "ok" : ""}">${foundation.passed}/${foundation.total} foundation checks</span></div>
      `;
      const rows = [
        [`Schemas`, `${schemas.schemas.length} stable contracts`],
        [`Permissions`, `${permissions.permissions.length} tool rules`],
        [`Plugins`, `${plugins.plugins.length} installed`],
        [`Store`, `${store.count} event(s)`],
        [`Migrations`, `${migrations.pending.length} pending`],
        [`Jobs`, `${jobs.jobs.length} run(s)`],
        [`Workspace`, `${portability.workspace.id} isolated`],
        [`Backups`, portability.backup.schedule.enabled ? `Every ${portability.backup.schedule.intervalHours}h · keep ${portability.backup.schedule.retentionCount}` : "Manual archive mode"]
      ];
      els.details.innerHTML = rows
        .map((row) => `<div class="mini-row"><strong>${escapeHtml(row[0])}</strong><span>${escapeHtml(row[1])}</span></div>`)
        .join("");
    } catch (error) {
      els.summary.innerHTML = `<div class="empty-state compact">${escapeHtml(error.message)}</div>`;
    }
  }

  async function startJob(type) {
    els.details.innerHTML = `<div class="mini-row muted">Starting ${escapeHtml(type)}...</div>`;
    await postJson("/api/jobs/start", { type });
    setTimeout(refreshFoundation, 350);
  }

  async function exportBackup() {
    els.details.innerHTML = `<div class="mini-row muted">Exporting local backup...</div>`;
    const result = await postJson("/api/backup/export", { includeWorkspaceFiles: false });
    els.details.innerHTML = `<div class="mini-row"><strong>Archive exported</strong><span>${escapeHtml(result.path)} · ${Number(result.itemCount || 0)} item(s)</span></div>`;
  }

  async function runMigrations() {
    const result = await postJson("/api/migrations", {});
    els.details.innerHTML = `<div class="mini-row"><strong>Migrations complete</strong><span>${result.applied.length} applied, ${result.pending.length} pending</span></div>`;
    setTimeout(refreshFoundation, 350);
  }

  async function releaseChecksums() {
    const result = await postJson("/api/releases/checksums", {});
    els.details.innerHTML = `<div class="mini-row"><strong>Checksums generated</strong><span>${escapeHtml(result.path)} · ${Number(result.count || 0)} file(s)</span></div>`;
  }

  async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async function postJson(url, data) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {})
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
