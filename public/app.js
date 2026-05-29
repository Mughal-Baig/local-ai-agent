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
  selectedFiles: new Set(),
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
  refreshStatus: document.querySelector("#refreshStatus"),
  refreshFiles: document.querySelector("#refreshFiles"),
  refreshRecipes: document.querySelector("#refreshRecipes"),
  recipeSelect: document.querySelector("#recipeSelect"),
  recipeHint: document.querySelector("#recipeHint"),
  useRecipe: document.querySelector("#useRecipe"),
  fileList: document.querySelector("#fileList"),
  newNote: document.querySelector("#newNote"),
  exportTrail: document.querySelector("#exportTrail"),
  clearTrail: document.querySelector("#clearTrail"),
  agentTrail: document.querySelector("#agentTrail"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  prompt: document.querySelector("#prompt"),
  sendButton: document.querySelector("#sendButton")
};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  renderMessages();
  addTrail("system", "Workspace boundary active");
  updateSendState();
  await Promise.all([refreshStatus(), refreshFiles(), refreshRecipes()]);
  els.prompt.focus();
});

function bindEvents() {
  els.refreshStatus.addEventListener("click", refreshStatus);
  els.refreshFiles.addEventListener("click", refreshFiles);
  els.refreshRecipes.addEventListener("click", refreshRecipes);
  els.modelSelect.addEventListener("change", () => {
    state.model = els.modelSelect.value;
    addTrail("model", `Model set to ${state.model}`);
    renderLocalSignals();
  });
  els.newNote.addEventListener("click", createNewNote);
  els.useRecipe.addEventListener("click", applySelectedRecipe);
  els.recipeSelect.addEventListener("change", updateRecipeHint);
  els.exportTrail.addEventListener("click", exportTrailReceipt);
  els.clearTrail.addEventListener("click", () => {
    state.trail = [];
    state.toolCount = 0;
    addTrail("system", "Trail cleared");
    renderLocalSignals();
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

async function refreshRecipes() {
  try {
    const data = await getJson("/api/recipes");
    state.recipes = data.recipes || [];
    renderRecipes();
    addTrail("recipe", `${state.recipes.length} recipe(s) loaded`);
  } catch (error) {
    state.recipes = [];
    renderRecipes();
    els.recipeHint.textContent = "Recipes could not be loaded.";
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
  } catch (error) {
    setConnection("Status check failed");
    els.modelHint.textContent = error.message;
    state.ollamaAvailable = false;
    addTrail("error", error.message);
    renderLocalSignals();
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
}

async function refreshFiles() {
  els.workspaceStatus.textContent = "Reading workspace";
  try {
    const data = await getJson("/api/files");
    state.files = data.files || [];
    renderFiles();
    els.workspaceStatus.textContent = `${state.files.length} workspace file(s)`;
    renderLocalSignals();
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
    content: `# Local Agent Note\n\nCreated ${new Date().toLocaleString()}.\n`
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
        selectedFiles: Array.from(state.selectedFiles)
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
        assistantMessage.events.push({
          type: "tool",
          label: `${data.name}: ${data.result}`
        });
        addTrail("tool", `${data.name}: ${data.result}`);
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
  }
}

function addTrail(type, label) {
  state.trail.unshift({
    type,
    label,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  });
  state.trail = state.trail.slice(0, 18);
  renderTrail();
}

function exportTrailReceipt() {
  addTrail("system", "Exported audit receipt");
  const rows = state.trail
    .slice()
    .reverse()
    .map((item) => `- ${item.time} [${item.type}] ${item.label}`)
    .join("\n");
  const content = [
    "# Local Agent Trail Receipt",
    "",
    `Exported: ${new Date().toISOString()}`,
    `Model: ${state.model || "not selected"}`,
    `Selected files: ${Array.from(state.selectedFiles).join(", ") || "none"}`,
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
        const chip = document.createElement("span");
        chip.className = `tool-chip${item.type === "error" ? " error" : ""}`;
        chip.textContent = item.label;
        events.appendChild(chip);
      }
      bubble.appendChild(events);
    }

    row.append(avatar, bubble);
    els.messages.appendChild(row);
  }

  els.messages.scrollTop = els.messages.scrollHeight;
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
