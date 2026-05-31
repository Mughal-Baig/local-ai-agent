(function () {
  const els = {
    query: document.querySelector("#workspaceSearch"),
    runSearch: document.querySelector("#runSearch"),
    citations: document.querySelector("#chunkCitations"),
    session: document.querySelector("#sessionSelect"),
    replayPlan: document.querySelector("#replayPlan"),
    replayButton: document.querySelector("#replaySession"),
    realBench: document.querySelector("#runRealBenchmark"),
    compare: document.querySelector("#compareModels"),
    compareSummary: document.querySelector("#modelCompareSummary"),
    packUrl: document.querySelector("#packImportUrl"),
    importPack: document.querySelector("#importPackUrl"),
    pluginGallery: document.querySelector("#pluginGallery"),
    onboarding: document.querySelector("#onboardingSummary")
  };

  if (!els.citations) {
    return;
  }

  els.runSearch?.addEventListener("click", () => setTimeout(refreshChunkCitations, 250));
  els.query?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      setTimeout(refreshChunkCitations, 250);
    }
  });
  els.replayButton?.addEventListener("click", () => setTimeout(refreshReplayPlan, 250));
  els.session?.addEventListener("change", refreshReplayPlan);
  els.realBench?.addEventListener("click", runRealBenchmark);
  els.compare?.addEventListener("click", compareModels);
  els.importPack?.addEventListener("click", importPackUrl);

  refreshPluginGallery();
  refreshOnboarding();
  compareModels();
  refreshReplayPlan();

  async function refreshChunkCitations() {
    const query = (els.query?.value || "").trim();
    if (!query) {
      els.citations.innerHTML = `<div class="mini-row muted">Chunk citations appear after search.</div>`;
      return;
    }
    try {
      const data = await getJson(`/api/search/chunks?query=${encodeURIComponent(query)}&limit=4`);
      if (!data.chunks.length) {
        els.citations.innerHTML = `<div class="mini-row muted">No chunk citations yet. Build the semantic index first.</div>`;
        return;
      }
      els.citations.innerHTML = data.chunks
        .map((chunk) => `<div class="mini-row"><strong>${escapeHtml(chunk.citation)}</strong><span>${escapeHtml(chunk.preview || "")}</span></div>`)
        .join("");
    } catch (error) {
      els.citations.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    }
  }

  async function refreshReplayPlan() {
    const path = els.session?.value || "";
    if (!path) {
      els.replayPlan.innerHTML = `<div class="mini-row muted">Replay guidance appears after saving a session.</div>`;
      return;
    }
    try {
      const data = await getJson(`/api/replay/plan?path=${encodeURIComponent(path)}`);
      els.replayPlan.innerHTML = data.steps
        .slice(0, 4)
        .map((step) => `<div class="mini-row"><strong>${step.done ? "OK" : "NEXT"} ${escapeHtml(step.id)}</strong><span>${escapeHtml(step.label)}</span></div>`)
        .join("");
    } catch (error) {
      els.replayPlan.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    }
  }

  async function runRealBenchmark() {
    els.compareSummary.innerHTML = `<div class="mini-row muted">Starting benchmark job...</div>`;
    try {
      const job = await postJson("/api/jobs/start", { type: "benchmark-run" });
      els.compareSummary.innerHTML = `<div class="mini-row"><strong>Benchmark job ${escapeHtml(job.id)}</strong><span>${escapeHtml(job.status)} · ${Number(job.progress || 0)}%</span></div>`;
      pollBenchmarkJob(job.id);
    } catch (error) {
      els.compareSummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    }
  }

  async function pollBenchmarkJob(jobId, attempt = 0) {
    if (!jobId || attempt > 8) {
      return;
    }
    await delay(1800);
    try {
      const data = await getJson("/api/jobs");
      const job = (data.jobs || []).find((item) => item.id === jobId);
      if (!job) {
        return;
      }
      const suffix = job.message ? ` · ${job.message}` : "";
      els.compareSummary.innerHTML = `<div class="mini-row"><strong>Benchmark job ${escapeHtml(job.id)}</strong><span>${escapeHtml(job.status)} · ${Number(job.progress || 0)}%${escapeHtml(suffix)}</span></div>`;
      if (job.status === "completed" && job.result?.runs?.length) {
        els.compareSummary.innerHTML = job.result.runs
          .map((run) => `<div class="mini-row"><strong>${escapeHtml(run.model)} · ${Number(run.score || 0)}/100</strong><span>Prompt score ${Number(run.realPromptScore || 0)}/100</span></div>`)
          .join("");
        return;
      }
      if (job.status === "failed") {
        els.compareSummary.innerHTML = `<div class="mini-row muted">${escapeHtml(job.error || "Benchmark failed")}</div>`;
        return;
      }
      pollBenchmarkJob(jobId, attempt + 1);
    } catch {
      // Keep the latest visible state if polling is interrupted.
    }
  }

  async function compareModels() {
    try {
      const data = await getJson("/api/models/compare");
      const rows = (data.models || []).slice(0, 4);
      els.compareSummary.innerHTML = rows.length
        ? rows.map((model) => `<div class="mini-row"><strong>${escapeHtml(model.model)} · ${Number(model.score || 0)}/100</strong><span>${escapeHtml(model.recommendation || "general chat")}</span></div>`).join("")
        : `<div class="mini-row muted">No local models to compare yet.</div>`;
    } catch (error) {
      els.compareSummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    }
  }

  async function importPackUrl() {
    const url = (els.packUrl?.value || "").trim();
    if (!url) {
      return;
    }
    els.pluginGallery.innerHTML = `<div class="mini-row muted">Importing recipe pack...</div>`;
    try {
      const data = await postJson("/api/marketplace/import-url", { url });
      els.pluginGallery.innerHTML = `<div class="mini-row"><strong>Imported ${escapeHtml(data.pack.title)}</strong><span>${escapeHtml(data.path)}</span></div>`;
    } catch (error) {
      els.pluginGallery.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    }
  }

  async function refreshPluginGallery() {
    try {
      const data = await getJson("/api/plugins");
      els.pluginGallery.innerHTML = data.plugins.length
        ? data.plugins.map((plugin) => `<div class="mini-row"><strong>${escapeHtml(plugin.title)}</strong><span>${plugin.tools.length} tool(s) · ${escapeHtml(plugin.version)}</span></div>`).join("")
        : `<div class="mini-row muted">No plugins installed yet.</div>`;
    } catch {
      els.pluginGallery.innerHTML = "";
    }
  }

  async function refreshOnboarding() {
    try {
      const data = await getJson("/api/onboarding");
      const desktop = data.desktop && data.desktop.enabled
        ? `${data.desktop.appMode} desktop · notifications ${data.desktop.notifications ? "on" : "off"}`
        : "browser mode · desktop shell available";
      const next = (data.items || []).find((item) => !item.ok);
      els.onboarding.innerHTML = [
        `<div class="mini-row"><strong>Onboarding ${Number(data.score || 0)}/100</strong><span>${data.items.filter((item) => item.ok).length}/${data.items.length} first-run checks complete</span></div>`,
        `<div class="mini-row"><strong>Desktop</strong><span>${escapeHtml(desktop)}</span></div>`,
        next ? `<div class="mini-row"><strong>Next</strong><span>${escapeHtml(next.action || next.label)}</span></div>` : ""
      ].filter(Boolean).join("");
    } catch {
      els.onboarding.innerHTML = "";
    }
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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
