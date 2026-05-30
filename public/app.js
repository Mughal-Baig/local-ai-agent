const state = {
  messages: [
    {
      role: "assistant",
      content:
        "I am ready. Select workspace files for context, then ask me to explain, draft, plan, or create something locally.",
      events: []
    }
  ],
  files: [],
  recipes: [],
  receipts: [],
  searchResults: [],
  pendingPreviews: [],
  packs: [],
  profiles: [],
  mcp: null,
  evals: null,
  memoryLoaded: false,
  selectedFiles: new Set(),
  permissions: {
    readFiles: true,
    writeFiles: false,
    previewWrites: true
  },
  semanticSearch: false,
  securityMode: true,
  models: [],
  model: "",
  trail: [],
  toolCount: 0,
  ollamaAvailable: false,
  busy: false
};

const els = {
  connectionStatus: document.querySelector("#connectionStatus"),
  workspaceStatus: document.querySelector("#workspaceStatus"),
  modelSelect: document.querySelector("#modelSelect"),
  modelHint: document.querySelector("#modelHint"),
  privacySignal: document.querySelector("#privacySignal"),
  selectedSignal: document.querySelector("#selectedSignal"),
  toolSignal: document.querySelector("#toolSignal"),
  setupChecklist: document.querySelector("#setupChecklist"),
  readPermission: document.querySelector("#readPermission"),
  writePermission: document.querySelector("#writePermission"),
  previewWritePermission: document.querySelector("#previewWritePermission"),
  securityMode: document.querySelector("#securityMode"),
  refreshStatus: document.querySelector("#refreshStatus"),
  refreshFiles: document.querySelector("#refreshFiles"),
  refreshRecipes: document.querySelector("#refreshRecipes"),
  modelScoreList: document.querySelector("#modelScoreList"),
  workspaceSearch: document.querySelector("#workspaceSearch"),
  semanticSearchMode: document.querySelector("#semanticSearchMode"),
  runSearch: document.querySelector("#runSearch"),
  searchResults: document.querySelector("#searchResults"),
  recipeSelect: document.querySelector("#recipeSelect"),
  recipeHint: document.querySelector("#recipeHint"),
  useRecipe: document.querySelector("#useRecipe"),
  fileList: document.querySelector("#fileList"),
  newNote: document.querySelector("#newNote"),
  exportTrail: document.querySelector("#exportTrail"),
  clearTrail: document.querySelector("#clearTrail"),
  agentTrail: document.querySelector("#agentTrail"),
  pendingChanges: document.querySelector("#pendingChanges"),
  applyAllPreviews: document.querySelector("#applyAllPreviews"),
  receiptFilter: document.querySelector("#receiptFilter"),
  receiptTimeline: document.querySelector("#receiptTimeline"),
  exportReport: document.querySelector("#exportReport"),
  memoryInput: document.querySelector("#memoryInput"),
  saveMemory: document.querySelector("#saveMemory"),
  memoryStatus: document.querySelector("#memoryStatus"),
  packSelect: document.querySelector("#packSelect"),
  exportPack: document.querySelector("#exportPack"),
  runEval: document.querySelector("#runEval"),
  evalSummary: document.querySelector("#evalSummary"),
  profileSummary: document.querySelector("#profileSummary"),
  trustScore: document.querySelector("#trustScore"),
  trustReasons: document.querySelector("#trustReasons"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  prompt: document.querySelector("#prompt"),
  sendButton: document.querySelector("#sendButton")
};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  renderMessages();
  renderSearchResults();
  renderPendingChanges();
  renderReceiptTimeline();
  renderTrustScore();
  addTrail("system", "Workspace boundary active");
  updateSendState();
  await Promise.all([refreshStatus(), refreshFiles(), refreshRecipes(), refreshReceipts(), refreshMemory(), refreshPacks(), refreshProfilesAndMcp()]);
  els.prompt.focus();
});

function bindEvents() {
  els.refreshStatus.addEventListener("click", refreshStatus);
  els.refreshFiles.addEventListener("click", refreshFiles);
  els.refreshRecipes.addEventListener("click", refreshRecipes);
  els.readPermission.addEventListener("change", syncPermissions);
  els.writePermission.addEventListener("change", syncPermissions);
  els.previewWritePermission.addEventListener("change", syncPermissions);
  els.securityMode.addEventListener("change", () => {
    state.securityMode = els.securityMode.checked;
    addTrail("security", `Hardening mode ${state.securityMode ? "on" : "off"}`);
    renderTrustScore();
  });
  els.semanticSearchMode.addEventListener("change", () => {
    state.semanticSearch = els.semanticSearchMode.checked;
    addTrail("search", `Semantic-lite search ${state.semanticSearch ? "on" : "off"}`);
  });
  els.runSearch.addEventListener("click", searchWorkspace);
  els.workspaceSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchWorkspace();
    }
  });
  els.modelSelect.addEventListener("change", () => {
    state.model = els.modelSelect.value;
    addTrail("model", `Model set to ${state.model}`);
    renderLocalSignals();
  });
  els.newNote.addEventListener("click", createNewNote);
  els.useRecipe.addEventListener("click", applySelectedRecipe);
  els.recipeSelect.addEventListener("change", updateRecipeHint);
  els.exportTrail.addEventListener("click", exportTrailReceipt);
  els.applyAllPreviews.addEventListener("click", applyAllPreviews);
  els.receiptFilter.addEventListener("input", renderReceiptTimeline);
  els.exportReport.addEventListener("click", exportShareableReport);
  els.saveMemory.addEventListener("click", saveMemory);
  els.exportPack.addEventListener("click", exportSelectedPack);
  els.runEval.addEventListener("click", runEvals);
  els.clearTrail.addEventListener("click", () => {
    state.trail = [];
    state.toolCount = 0;
    addTrail("system", "Trail cleared");
    renderLocalSignals();
    renderTrustScore();
  });
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      els.prompt.value = button.dataset.prompt || "";
      resizePrompt();
      els.prompt.focus();
    });
  });
  els.composer.addEventListener("submit", sendMessage);
  els.prompt.addEventListener("input", resizePrompt);
  els.prompt.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      els.composer.requestSubmit();
    }
  });
}

function syncPermissions() {
  state.permissions = {
    readFiles: els.readPermission.checked,
    writeFiles: els.writePermission.checked,
    previewWrites: els.previewWritePermission.checked
  };
  addTrail(
    "permission",
    `Reads ${state.permissions.readFiles ? "on" : "off"}, writes ${state.permissions.writeFiles ? "on" : "off"}, previews ${state.permissions.previewWrites ? "on" : "off"}`
  );
  renderLocalSignals();
  renderSetupChecklist();
  renderTrustScore();
}

async function refreshRecipes() {
  try {
    const data = await getJson("/api/recipes");
    state.recipes = data.recipes || [];
    renderRecipes();
    renderSetupChecklist();
    addTrail("recipe", `${state.recipes.length} recipe(s) loaded`);
  } catch (error) {
    state.recipes = [];
    renderRecipes();
    renderSetupChecklist();
    els.recipeHint.textContent = "Recipes could not be loaded.";
    addTrail("error", error.message);
  }
}

async function refreshReceipts() {
  try {
    const data = await getJson("/api/receipts");
    state.receipts = data.receipts || [];
  } catch {
    state.receipts = [];
  }
  renderSetupChecklist();
  renderReceiptTimeline();
  renderTrustScore();
}

async function refreshMemory() {
  try {
    const data = await getJson("/api/memory");
    els.memoryInput.value = data.content || "";
    state.memoryLoaded = true;
    els.memoryStatus.textContent = data.modifiedAt ? `Loaded ${data.path}` : "Memory is ready.";
  } catch (error) {
    els.memoryStatus.textContent = `Memory unavailable: ${error.message}`;
  }
}

async function saveMemory() {
  try {
    const saved = await postJson("/api/memory", { content: els.memoryInput.value });
    state.memoryLoaded = true;
    els.memoryStatus.textContent = `Saved ${saved.path}`;
    addTrail("memory", `Saved ${saved.path}`);
    renderTrustScore();
  } catch (error) {
    els.memoryStatus.textContent = error.message;
    addTrail("error", error.message);
  }
}

async function refreshPacks() {
  try {
    const data = await getJson("/api/packs");
    state.packs = data.packs || [];
    renderPacks();
  } catch (error) {
    state.packs = [];
    renderPacks();
    addTrail("error", error.message);
  }
}

async function refreshProfilesAndMcp() {
  try {
    const [profileData, mcpData] = await Promise.all([getJson("/api/profiles"), getJson("/api/mcp")]);
    state.profiles = profileData.profiles || [];
    state.mcp = mcpData;
    const approvalCount = Array.isArray(mcpData.approvals) ? mcpData.approvals.length : 0;
    els.profileSummary.textContent = `${state.profiles.length} profile(s), ${approvalCount} MCP approval rule(s).`;
  } catch (error) {
    els.profileSummary.textContent = `Toolkit metadata unavailable: ${error.message}`;
  }
}

function renderPacks() {
  els.packSelect.innerHTML = "";
  if (!state.packs.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No packs found";
    els.packSelect.appendChild(option);
    els.exportPack.disabled = true;
    return;
  }

  for (const pack of state.packs) {
    const option = document.createElement("option");
    option.value = pack.id;
    option.textContent = `${pack.title} (${pack.recipes.length})`;
    els.packSelect.appendChild(option);
  }
  els.exportPack.disabled = false;
}

async function exportSelectedPack() {
  const id = els.packSelect.value;
  if (!id) {
    return;
  }

  try {
    const pack = await getJson(`/api/packs/export?id=${encodeURIComponent(id)}`);
    downloadText(`agenttrail-${id}-pack.json`, JSON.stringify(pack, null, 2), "application/json");
    addTrail("recipe", `Exported ${pack.title}`);
  } catch (error) {
    addTrail("error", error.message);
  }
}

async function runEvals() {
  els.evalSummary.innerHTML = `<div class="empty-state compact">Running local eval harness...</div>`;
  try {
    const data = await getJson("/api/evals");
    state.evals = data;
    els.evalSummary.innerHTML = `
      <div class="eval-score">${data.score}/100</div>
      <div class="eval-list">${data.checks
        .map((check) => `<span class="${check.ok ? "ok" : "fail"}">${check.ok ? "OK" : "FAIL"} ${escapeHtml(check.name)}</span>`)
        .join("")}</div>
    `;
    addTrail("eval", `Evaluation score ${data.score}/100`);
    renderTrustScore();
  } catch (error) {
    els.evalSummary.innerHTML = `<div class="empty-state compact">${escapeHtml(error.message)}</div>`;
    addTrail("error", error.message);
  }
}

function renderRecipes() {
  els.recipeSelect.innerHTML = "";

  if (!state.recipes.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No recipes found";
    els.recipeSelect.appendChild(option);
    els.useRecipe.disabled = true;
    return;
  }

  for (const recipe of state.recipes) {
    const option = document.createElement("option");
    option.value = recipe.id;
    option.textContent = recipe.title;
    els.recipeSelect.appendChild(option);
  }

  els.useRecipe.disabled = false;
  updateRecipeHint();
}

function updateRecipeHint() {
  const recipe = selectedRecipe();
  if (!recipe) {
    els.recipeHint.textContent = "Recipes are local prompt workflows stored in the repo.";
    return;
  }

  const tags = recipe.tags && recipe.tags.length ? ` Tags: ${recipe.tags.join(", ")}.` : "";
  els.recipeHint.textContent = `${recipe.description}${tags}`;
}

function applySelectedRecipe() {
  const recipe = selectedRecipe();
  if (!recipe) {
    return;
  }

  els.prompt.value = recipe.prompt;
  resizePrompt();
  els.prompt.focus();
  addTrail("recipe", `Loaded ${recipe.title}`);
}

function selectedRecipe() {
  const id = els.recipeSelect.value;
  return state.recipes.find((recipe) => recipe.id === id) || null;
}

async function searchWorkspace() {
  const query = els.workspaceSearch.value.trim();
  if (!query) {
    state.searchResults = [];
    renderSearchResults();
    return;
  }

  els.searchResults.innerHTML = `<div class="empty-state">Searching workspace...</div>`;

  try {
    const mode = state.semanticSearch ? "semantic" : "keyword";
    const data = await getJson(`/api/search?query=${encodeURIComponent(query)}&limit=8&mode=${mode}`);
    state.searchResults = data.results || [];
    renderSearchResults();
    addTrail("search", `${state.searchResults.length} ${mode} result(s) for "${query}"`);
    renderTrustScore();
  } catch (error) {
    state.searchResults = [];
    els.searchResults.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    addTrail("error", error.message);
  }
}

function renderSearchResults() {
  els.searchResults.innerHTML = "";

  if (!state.searchResults.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact";
    empty.textContent = els.workspaceSearch.value.trim() ? "No matching workspace files." : "Search files and receipts without leaving the browser.";
    els.searchResults.appendChild(empty);
    return;
  }

  for (const result of state.searchResults) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `search-result${state.selectedFiles.has(result.path) ? " selected" : ""}`;
    item.title = result.path;
    item.innerHTML = `
      <span class="search-path">${escapeHtml(result.path)}</span>
      <span class="search-snippet">${escapeHtml(result.snippet || "No preview available")}</span>
    `;
    item.addEventListener("click", () => {
      state.selectedFiles.add(result.path);
      renderFiles();
      renderSearchResults();
      els.workspaceStatus.textContent = `${state.selectedFiles.size} selected`;
      addTrail("context", `Selected ${result.path} from search`);
      renderLocalSignals();
    });
    els.searchResults.appendChild(item);
  }
}

async function refreshStatus() {
  setConnection("Checking local model...");
  try {
    const status = await getJson("/api/status");
    state.models = status.ollama.models || [];
    const available = status.ollama.available;
    state.ollamaAvailable = available;

    if (available && state.models.length) {
      setConnection(`${state.models.length} local model(s) found`);
      renderModels(status.defaults.model);
      els.modelHint.textContent = `Connected to ${status.ollama.host}`;
      addTrail("model", `${state.models.length} local model(s) available`);
    } else if (available) {
      setConnection("Ollama is running with no models");
      renderModels(status.defaults.model);
      els.modelHint.textContent = `Run: ollama pull ${status.defaults.model}`;
      addTrail("model", "Ollama connected without models");
    } else {
      setConnection("Ollama is not connected");
      renderModels(status.defaults.model);
      els.modelHint.textContent = "Start Ollama and pull a model to chat.";
      addTrail("warning", "Ollama not connected");
    }
    renderLocalSignals();
    renderModelScores();
    renderSetupChecklist();
  } catch (error) {
    setConnection("Status check failed");
    els.modelHint.textContent = error.message;
    state.ollamaAvailable = false;
    addTrail("error", error.message);
    renderLocalSignals();
    renderModelScores();
    renderSetupChecklist();
  }
}

function renderModels(defaultModel) {
  const models = state.models.length ? state.models.map((model) => model.name) : [defaultModel || "llama3.2"];
  els.modelSelect.innerHTML = "";

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    els.modelSelect.appendChild(option);
  }

  if (!state.model || !models.includes(state.model)) {
    state.model = models[0];
  }
  els.modelSelect.value = state.model;
  renderModelScores();
}

function renderModelScores() {
  if (!els.modelScoreList) {
    return;
  }

  const selected = state.models.find((model) => model.name === state.model);
  if (!selected || !selected.scores) {
    els.modelScoreList.innerHTML = `<div class="empty-state compact">Model capability scores appear after Ollama responds.</div>`;
    return;
  }

  const rows = [
    ["Tool", selected.scores.toolUse],
    ["Code", selected.scores.coding],
    ["Plan", selected.scores.planning],
    ["Ctx", selected.scores.longContext]
  ];
  els.modelScoreList.innerHTML = `
    <div class="model-recommendation">Best for ${escapeHtml(selected.recommendation || "general chat")}</div>
    ${rows
      .map(
        ([label, score]) => `
          <div class="model-score-row">
            <span>${label}</span>
            <meter min="0" max="100" value="${Number(score) || 0}"></meter>
            <strong>${Number(score) || 0}</strong>
          </div>
        `
      )
      .join("")}
  `;
}

async function refreshFiles() {
  els.workspaceStatus.textContent = "Reading workspace";
  try {
    const data = await getJson("/api/files");
    state.files = data.files || [];
    renderFiles();
    els.workspaceStatus.textContent = `${state.files.length} workspace file(s)`;
    renderLocalSignals();
    renderSetupChecklist();
  } catch (error) {
    els.workspaceStatus.textContent = "Workspace unavailable";
    els.fileList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    addTrail("error", error.message);
  }
}

function renderFiles() {
  els.fileList.innerHTML = "";

  if (!state.files.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No files yet. Create a note or add files to the workspace folder.";
    els.fileList.appendChild(empty);
    return;
  }

  for (const file of state.files) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `file-item${state.selectedFiles.has(file.path) ? " selected" : ""}`;
    item.title = file.path;
    item.innerHTML = `
      <span class="file-name">${escapeHtml(file.path)}</span>
      <span class="file-size">${formatBytes(file.size)}</span>
    `;
    item.addEventListener("click", () => {
      if (state.selectedFiles.has(file.path)) {
        state.selectedFiles.delete(file.path);
      } else {
        state.selectedFiles.add(file.path);
      }
      renderFiles();
      els.workspaceStatus.textContent = `${state.selectedFiles.size} selected`;
      addTrail("context", `${state.selectedFiles.size} selected file(s)`);
      renderLocalSignals();
    });
    els.fileList.appendChild(item);
  }
}

async function createNewNote() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `notes/note-${stamp}.md`;
  await postJson("/api/files/content", {
    path,
    content: `# AgentTrail Note\n\nCreated ${new Date().toLocaleString()}.\n`
  });
  await refreshFiles();
  state.selectedFiles.add(path);
  renderFiles();
  els.workspaceStatus.textContent = `Created ${path}`;
  addTrail("file", `Created ${path}`);
  renderLocalSignals();
}

async function sendMessage(event) {
  event.preventDefault();
  if (state.busy) {
    return;
  }

  const content = els.prompt.value.trim();
  if (!content) {
    return;
  }

  const userMessage = { role: "user", content, events: [] };
  const assistantMessage = { role: "assistant", content: "", events: [] };
  const requestMessages = [...state.messages, userMessage]
    .filter((message) => message.content && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({ role: message.role, content: message.content }));

  state.messages.push(userMessage, assistantMessage);
  state.busy = true;
  const suspicious = detectSuspiciousPrompt(content);
  if (suspicious.length) {
    addTrail("security", `Suspicious instruction flagged: ${suspicious[0]}`);
  }
  addTrail("chat", `Sent prompt with ${state.selectedFiles.size} file(s)`);
  els.prompt.value = "";
  resizePrompt();
  renderMessages();
  updateSendState();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: state.model,
        messages: requestMessages,
        selectedFiles: Array.from(state.selectedFiles),
        permissions: state.permissions,
        securityMode: state.securityMode
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Chat request failed with HTTP ${response.status}`);
    }

    await readEventStream(response.body, (eventName, data) => {
      if (eventName === "token") {
        assistantMessage.content += data.text || "";
      }
      if (eventName === "tool") {
        state.toolCount += 1;
        const label = `${data.name}: ${data.result}`;
        assistantMessage.events.push({
          type: data.preview ? "preview" : "tool",
          label,
          preview: data.preview || null,
          id: data.preview ? `preview-${Date.now()}-${state.toolCount}` : null
        });
        if (data.preview) {
          state.pendingPreviews.unshift({
            id: `pending-${Date.now()}-${state.toolCount}`,
            label,
            preview: data.preview,
            applied: false,
            rejected: false
          });
          renderPendingChanges();
        }
        addTrail(data.preview ? "preview" : "tool", label);
      }
      if (eventName === "status") {
        els.workspaceStatus.textContent = data.message || "Working";
      }
      if (eventName === "error") {
        assistantMessage.events.push({
          type: "error",
          label: data.message || "The agent hit an error"
        });
        addTrail("error", data.message || "Agent error");
      }
      renderLocalSignals();
      renderTrustScore();
      renderMessages();
    });
  } catch (error) {
    assistantMessage.events.push({ type: "error", label: error.message });
    addTrail("error", error.message);
    renderMessages();
  } finally {
    state.busy = false;
    els.workspaceStatus.textContent = `${state.files.length} workspace file(s)`;
    updateSendState();
    await refreshFiles();
    await refreshReceipts();
  }
}

function addTrail(type, label) {
  state.trail.unshift({
    type,
    label,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  });
  state.trail = state.trail.slice(0, 24);
  renderTrail();
  if (els.trustScore) {
    renderTrustScore();
  }
}

async function exportTrailReceipt() {
  addTrail("system", "Exported audit receipt");
  const rows = state.trail
    .slice()
    .reverse()
    .map((item) => `- ${item.time} [${item.type}] ${item.label}`)
    .join("\n");
  const content = [
    "# AgentTrail Receipt",
    "",
    `Exported: ${new Date().toISOString()}`,
    `Model: ${state.model || "not selected"}`,
    `Selected files: ${Array.from(state.selectedFiles).join(", ") || "none"}`,
    `Permissions: reads ${state.permissions.readFiles ? "on" : "off"}, writes ${state.permissions.writeFiles ? "on" : "off"}, previews ${state.permissions.previewWrites ? "on" : "off"}`,
    `Tool calls: ${state.toolCount}`,
    "",
    "## Events",
    "",
    rows || "- No events"
  ].join("\n");
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `local-agent-trail-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  link.click();
  URL.revokeObjectURL(url);

  try {
    const saved = await postJson("/api/receipts", { content });
    addTrail("file", `Saved receipt ${saved.path}`);
    await refreshReceipts();
  } catch (error) {
    addTrail("error", `Could not save receipt: ${error.message}`);
  }
}

function renderTrail() {
  els.agentTrail.innerHTML = "";

  if (!state.trail.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No activity yet.";
    els.agentTrail.appendChild(empty);
    return;
  }

  for (const item of state.trail) {
    const row = document.createElement("div");
    row.className = `trail-item ${item.type}`;
    row.innerHTML = `
      <span class="trail-dot" aria-hidden="true"></span>
      <span class="trail-text">${escapeHtml(item.label)}</span>
      <time>${escapeHtml(item.time)}</time>
    `;
    els.agentTrail.appendChild(row);
  }
}

function renderLocalSignals() {
  els.privacySignal.textContent = state.ollamaAvailable ? "Offline-ready" : "Local";
  els.selectedSignal.textContent = `${state.selectedFiles.size} file${state.selectedFiles.size === 1 ? "" : "s"}`;
  els.toolSignal.textContent = `${state.toolCount} call${state.toolCount === 1 ? "" : "s"}`;
}

function renderSetupChecklist() {
  const items = [
    {
      ok: state.ollamaAvailable,
      text: state.ollamaAvailable ? "Ollama is reachable" : "Start Ollama on 127.0.0.1:11434"
    },
    {
      ok: state.models.length > 0,
      text: state.models.length ? `${state.models.length} model(s) available` : "Pull a model: ollama pull llama3.2"
    },
    {
      ok: state.files.length > 0,
      text: state.files.length ? `${state.files.length} workspace file(s)` : "Add files to workspace/"
    },
    {
      ok: state.recipes.length >= 10,
      text: `${state.recipes.length} recipe(s) loaded`
    },
    {
      ok: state.permissions.previewWrites,
      text: state.permissions.previewWrites ? "Write previews are enabled" : "Enable previews before direct writes"
    },
    {
      ok: state.receipts.length > 0,
      text: state.receipts.length ? `${state.receipts.length} saved receipt(s)` : "Export a receipt after a run"
    }
  ];

  els.setupChecklist.innerHTML = items
    .map((item) => `<div class="setup-item ${item.ok ? "ok" : ""}"><span>${item.ok ? "OK" : "TODO"}</span>${escapeHtml(item.text)}</div>`)
    .join("");
}

function renderPendingChanges() {
  const active = state.pendingPreviews.filter((item) => !item.applied && !item.rejected);
  els.applyAllPreviews.disabled = active.length === 0;
  els.pendingChanges.innerHTML = "";

  if (!state.pendingPreviews.length) {
    els.pendingChanges.innerHTML = `<div class="empty-state compact">No pending diffs yet.</div>`;
    return;
  }

  for (const item of state.pendingPreviews.slice(0, 6)) {
    const row = document.createElement("div");
    row.className = `pending-change${item.applied ? " applied" : ""}${item.rejected ? " rejected" : ""}`;
    const stats = item.preview.stats || { added: 0, removed: 0 };
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.preview.path)}</strong>
        <span>+${Number(stats.added || 0)} -${Number(stats.removed || 0)}${item.applied ? " · applied" : item.rejected ? " · rejected" : ""}</span>
      </div>
      <div class="pending-actions">
        <button type="button" data-action="apply" ${item.applied || item.rejected ? "disabled" : ""}>Apply</button>
        <button type="button" data-action="reject" ${item.applied || item.rejected ? "disabled" : ""}>Reject</button>
      </div>
    `;
    row.querySelector('[data-action="apply"]').addEventListener("click", () => applyPendingPreview(item));
    row.querySelector('[data-action="reject"]').addEventListener("click", () => rejectPendingPreview(item.id));
    els.pendingChanges.appendChild(row);
  }
}

function renderReceiptTimeline() {
  const filter = (els.receiptFilter?.value || "").trim().toLowerCase();
  const receipts = state.receipts.filter((receipt) => {
    const text = `${receipt.path} ${receipt.snippet || ""}`.toLowerCase();
    return !filter || text.includes(filter);
  });

  if (!receipts.length) {
    els.receiptTimeline.innerHTML = `<div class="empty-state compact">No receipts match this filter.</div>`;
    return;
  }

  els.receiptTimeline.innerHTML = receipts
    .slice(0, 8)
    .map(
      (receipt) => `
        <button type="button" class="receipt-row" data-path="${escapeHtml(receipt.path)}">
          <strong>${escapeHtml(receipt.path.replace(/^receipts\//, ""))}</strong>
          <span>${escapeHtml(receipt.snippet || formatBytes(receipt.size))}</span>
        </button>
      `
    )
    .join("");

  els.receiptTimeline.querySelectorAll(".receipt-row").forEach((row) => {
    row.addEventListener("click", () => {
      const path = row.dataset.path;
      if (path) {
        state.selectedFiles.add(path);
        renderFiles();
        addTrail("receipt", `Selected ${path}`);
        renderTrustScore();
      }
    });
  });
}

function renderTrustScore() {
  const checks = [
    { ok: state.ollamaAvailable, label: "Local model connected" },
    { ok: state.trail.some((item) => item.type === "search"), label: "Evidence searched" },
    { ok: state.trail.some((item) => item.type === "preview") || state.pendingPreviews.length > 0, label: "Writes previewed" },
    { ok: state.receipts.length > 0, label: "Receipt saved" },
    { ok: state.securityMode, label: "Hardening mode" },
    { ok: state.memoryLoaded, label: "Project memory" },
    { ok: !state.permissions.writeFiles || state.permissions.previewWrites, label: "No direct writes" },
    { ok: state.evals && state.evals.score >= 80, label: "Eval harness passed" }
  ];
  const passed = checks.filter((check) => check.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  els.trustScore.textContent = String(score);
  els.trustReasons.innerHTML = checks
    .map((check) => `<span class="${check.ok ? "ok" : ""}">${check.ok ? "OK" : "TODO"} ${escapeHtml(check.label)}</span>`)
    .join("");
}

async function exportShareableReport() {
  const trustScore = els.trustScore.textContent;
  const rows = state.trail
    .slice()
    .reverse()
    .map((item) => `- ${item.time} [${item.type}] ${item.label}`)
    .join("\n");
  const diffs = state.pendingPreviews
    .map((item) => `## ${item.preview.path}\n\n\`\`\`diff\n${item.preview.diff || ""}\n\`\`\``)
    .join("\n\n");
  const markdown = [
    "# AgentTrail Shareable Report",
    "",
    `Exported: ${new Date().toISOString()}`,
    `Trust score: ${trustScore}/100`,
    `Model: ${state.model || "not selected"}`,
    `Selected files: ${Array.from(state.selectedFiles).join(", ") || "none"}`,
    "",
    "## Trail",
    "",
    rows || "- No events",
    "",
    "## Pending And Applied Diffs",
    "",
    diffs || "No diffs captured."
  ].join("\n");

  try {
    const saved = await postJson("/api/reports", {
      title: "AgentTrail Shareable Report",
      markdown
    });
    downloadText("agenttrail-report.md", markdown, "text/markdown");
    addTrail("report", `Saved report ${saved.markdown.path}`);
    await refreshFiles();
  } catch (error) {
    addTrail("error", error.message);
  }
}

async function readEventStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseChunk(chunk);
      if (parsed) {
        onEvent(parsed.event, parsed.data);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function parseSseChunk(chunk) {
  const lines = chunk.split("\n");
  let event = "message";
  const data = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }
    if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }

  if (!data.length) {
    return null;
  }

  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return { event, data: { text: data.join("\n") } };
  }
}

function renderMessages() {
  els.messages.innerHTML = "";

  for (const message of state.messages) {
    const row = document.createElement("article");
    row.className = `message ${message.role}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = message.role === "user" ? "YOU" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = formatMessage(message.content || " ");

    if (message.events && message.events.length) {
      const events = document.createElement("div");
      events.className = "tool-events";
      for (const item of message.events) {
        if (item.type === "preview" && item.preview) {
          events.appendChild(renderPreviewEvent(item));
        } else {
          const chip = document.createElement("span");
          chip.className = `tool-chip${item.type === "error" ? " error" : ""}`;
          chip.textContent = item.label;
          events.appendChild(chip);
        }
      }
      bubble.appendChild(events);
    }

    row.append(avatar, bubble);
    els.messages.appendChild(row);
  }

  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderPreviewEvent(item) {
  const card = document.createElement("div");
  card.className = "diff-preview";

  const preview = item.preview;
  const stats = preview.stats || { added: 0, removed: 0 };
  const status = preview.blockedWrite ? "Write blocked by preview mode" : "Preview only";

  const heading = document.createElement("div");
  heading.className = "diff-preview-heading";
  heading.innerHTML = `
    <div>
      <strong>${escapeHtml(preview.path)}</strong>
      <span>${escapeHtml(status)} · +${Number(stats.added || 0)} -${Number(stats.removed || 0)}</span>
    </div>
  `;

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "apply-preview-button";
  applyButton.textContent = item.applied ? "Applied" : "Apply";
  applyButton.disabled = item.applied === true;
  applyButton.addEventListener("click", () => applyPreview(item, applyButton));
  heading.appendChild(applyButton);

  const diff = document.createElement("pre");
  diff.className = "diff-block";
  diff.textContent = preview.diff || "No diff available";

  card.append(heading, diff);
  return card;
}

async function applyPreview(item, button) {
  if (!item.preview || !item.preview.path) {
    return;
  }

  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Applying";

  try {
    const result = await postJson("/api/files/content", {
      path: item.preview.path,
      content: item.preview.proposedContent || ""
    });
    item.applied = true;
    markPendingPreview(item.preview.path, "applied");
    button.textContent = "Applied";
    addTrail("file", `Applied preview ${result.path}`);
    await refreshFiles();
    await refreshReceipts();
    renderPendingChanges();
    renderTrustScore();
  } catch (error) {
    button.disabled = false;
    button.textContent = originalLabel;
    addTrail("error", `Could not apply preview: ${error.message}`);
  }
}

async function applyPendingPreview(item) {
  if (!item || !item.preview || item.applied || item.rejected) {
    return;
  }

  const result = await postJson("/api/files/content", {
    path: item.preview.path,
    content: item.preview.proposedContent || ""
  });
  item.applied = true;
  addTrail("file", `Applied preview ${result.path}`);
  await refreshFiles();
  renderPendingChanges();
  renderTrustScore();
}

async function applyAllPreviews() {
  const pending = state.pendingPreviews.filter((item) => !item.applied && !item.rejected);
  for (const item of pending) {
    try {
      await applyPendingPreview(item);
    } catch (error) {
      addTrail("error", `Could not apply ${item.preview.path}: ${error.message}`);
    }
  }
  await refreshReceipts();
}

function rejectPendingPreview(id) {
  const item = state.pendingPreviews.find((preview) => preview.id === id);
  if (item) {
    item.rejected = true;
    addTrail("preview", `Rejected ${item.preview.path}`);
  }
  renderPendingChanges();
  renderTrustScore();
}

function markPendingPreview(path, status) {
  for (const item of state.pendingPreviews) {
    if (item.preview && item.preview.path === path) {
      item[status] = true;
    }
  }
}

function formatMessage(text) {
  const escaped = escapeHtml(text || "");
  const withBlocks = escaped.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const label = lang ? ` data-lang="${lang}"` : "";
    return `<pre${label}><code>${code}</code></pre>`;
  });

  return withBlocks
    .split(/\n{2,}/)
    .map((paragraph) => {
      if (paragraph.startsWith("<pre")) {
        return paragraph;
      }
      return `<p>${paragraph
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

function resizePrompt() {
  els.prompt.style.height = "auto";
  els.prompt.style.height = `${Math.min(els.prompt.scrollHeight, 180)}px`;
  updateSendState();
}

function updateSendState() {
  els.sendButton.disabled = state.busy || !els.prompt.value.trim();
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function detectSuspiciousPrompt(content) {
  const text = String(content || "").toLowerCase();
  const patterns = [
    ["ignore previous", "instruction override"],
    ["system prompt", "system prompt request"],
    ["send to http", "hidden exfiltration"],
    ["curl ", "network command"],
    ["delete all", "destructive request"],
    ["outside workspace", "workspace escape"]
  ];
  return patterns.filter(([needle]) => text.includes(needle)).map(([, label]) => label);
}

function setConnection(text) {
  els.connectionStatus.textContent = text;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
