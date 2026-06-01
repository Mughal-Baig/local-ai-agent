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
  conversations: [],
  activeConversationId: null,
  conversationSearch: "",
  deletedConversation: null,
  editingMessageIndex: null,
  composerAssist: {
    items: [],
    activeIndex: 0
  },
  searchResults: [],
  pendingPreviews: [],
  packs: [],
  profiles: [],
  sessions: [],
  marketplace: null,
  searchIndex: null,
  observability: null,
  privacy: null,
  activeTraceId: null,
  team: null,
  teamUserId: "owner",
  benchmarks: null,
  evalHistory: [],
  mcp: null,
  evals: null,
  memoryLoaded: false,
  memoryScope: "project",
  structuredMemory: null,
  memorySuggestions: [],
  memoryHistory: [],
  selectedMemoryRevision: null,
  attachments: [],
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
  busy: false,
  planning: false,
  cancelRequested: false,
  attachmentDragDepth: 0,
  keyChord: null,
  keyChordTimer: null,
  pendingScreenshotAction: false,
  voiceRecording: {
    active: false,
    recorder: null,
    chunks: [],
    stream: null,
    startedAt: 0
  },
  speakingMessage: null,
  chatAbortController: null,
  stepBudget: {
    maxSteps: 3,
    override: false
  },
  pendingPlan: null,
  approvedPlan: null,
  selectedReceiptPath: null
};

const MAX_ATTACHMENT_COUNT = 12;
const TEXT_ATTACHMENT_MAX_BYTES = 76 * 1024;
const IMAGE_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
const AUDIO_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

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
  pullModelName: document.querySelector("#pullModelName"),
  pullModelButton: document.querySelector("#pullModelButton"),
  pullModelStatus: document.querySelector("#pullModelStatus"),
  installedModels: document.querySelector("#installedModels"),
  workspaceSearch: document.querySelector("#workspaceSearch"),
  semanticSearchMode: document.querySelector("#semanticSearchMode"),
  runSearch: document.querySelector("#runSearch"),
  buildSearchIndex: document.querySelector("#buildSearchIndex"),
  searchIndexSummary: document.querySelector("#searchIndexSummary"),
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
  sessionSelect: document.querySelector("#sessionSelect"),
  replaySession: document.querySelector("#replaySession"),
  resumeReceipt: document.querySelector("#resumeReceipt"),
  receiptTimeline: document.querySelector("#receiptTimeline"),
  exportReport: document.querySelector("#exportReport"),
  memoryInput: document.querySelector("#memoryInput"),
  memoryScope: document.querySelector("#memoryScope"),
  saveMemory: document.querySelector("#saveMemory"),
  memoryStatus: document.querySelector("#memoryStatus"),
  memoryCitations: document.querySelector("#memoryCitations"),
  memorySuggestions: document.querySelector("#memorySuggestions"),
  refreshMemoryHistory: document.querySelector("#refreshMemoryHistory"),
  memoryHistory: document.querySelector("#memoryHistory"),
  memoryHistoryDiff: document.querySelector("#memoryHistoryDiff"),
  packSelect: document.querySelector("#packSelect"),
  exportPack: document.querySelector("#exportPack"),
  runEval: document.querySelector("#runEval"),
  evalSummary: document.querySelector("#evalSummary"),
  profileSelect: document.querySelector("#profileSelect"),
  applyProfile: document.querySelector("#applyProfile"),
  runBenchmark: document.querySelector("#runBenchmark"),
  benchmarkSummary: document.querySelector("#benchmarkSummary"),
  securityScan: document.querySelector("#securityScan"),
  securitySummary: document.querySelector("#securitySummary"),
  marketplaceSummary: document.querySelector("#marketplaceSummary"),
  profileSummary: document.querySelector("#profileSummary"),
  trustScore: document.querySelector("#trustScore"),
  trustReasons: document.querySelector("#trustReasons"),
  attachmentInput: document.querySelector("#attachmentInput"),
  attachFiles: document.querySelector("#attachFiles"),
  voicePrompt: document.querySelector("#voicePrompt"),
  attachmentQueue: document.querySelector("#attachmentQueue"),
  messages: document.querySelector("#messages"),
  planPanel: document.querySelector("#planPanel"),
  planText: document.querySelector("#planText"),
  stepBudgetSelect: document.querySelector("#stepBudgetSelect"),
  planButton: document.querySelector("#planButton"),
  screenshotAction: document.querySelector("#screenshotAction"),
  stopButton: document.querySelector("#stopButton"),
  resumeBanner: document.querySelector("#resumeBanner"),
  resumeBannerText: document.querySelector("#resumeBannerText"),
  resumeRunButton: document.querySelector("#resumeRunButton"),
  dismissResumeButton: document.querySelector("#dismissResumeButton"),
  approvePlan: document.querySelector("#approvePlan"),
  discardPlan: document.querySelector("#discardPlan"),
  composerWrap: document.querySelector(".composer-wrap"),
  dropHint: document.querySelector("#dropHint"),
  composerAssist: document.querySelector("#composerAssist"),
  composerMode: document.querySelector("#composerMode"),
  composer: document.querySelector("#composer"),
  prompt: document.querySelector("#prompt"),
  sendButton: document.querySelector("#sendButton"),
  newChat: document.querySelector("#newChat"),
  conversationSearch: document.querySelector("#conversationSearch"),
  conversationList: document.querySelector("#conversationList"),
  conversationUndo: document.querySelector("#conversationUndo"),
  conversationFolder: document.querySelector("#conversationFolder"),
  conversationTags: document.querySelector("#conversationTags"),
  saveConversationMeta: document.querySelector("#saveConversationMeta"),
  exportConversation: document.querySelector("#exportConversation"),
  importConversation: document.querySelector("#importConversation"),
  conversationImportInput: document.querySelector("#conversationImportInput"),
  toolsDrawer: document.querySelector("#toolsDrawer"),
  toolsBackdrop: document.querySelector("#toolsBackdrop"),
  toolsToggle: document.querySelector("#toolsToggle"),
  toolsToggleTop: document.querySelector("#toolsToggleTop"),
  toolsToggleMobile: document.querySelector("#toolsToggleMobile"),
  closeTools: document.querySelector("#closeTools"),
  refreshResources: document.querySelector("#refreshResources"),
  resourcesSummary: document.querySelector("#resourcesSummary"),
  themeToggle: document.querySelector("#themeToggle"),
  themeSelect: document.querySelector("#themeSelect"),
  fontScaleSelect: document.querySelector("#fontScaleSelect"),
  densitySelect: document.querySelector("#densitySelect"),
  motionSelect: document.querySelector("#motionSelect"),
  localeSelect: document.querySelector("#localeSelect"),
  accessStatus: document.querySelector("#accessStatus"),
  refreshObservability: document.querySelector("#refreshObservability"),
  observabilitySummary: document.querySelector("#observabilitySummary"),
  traceTimeline: document.querySelector("#traceTimeline"),
  refreshPrivacy: document.querySelector("#refreshPrivacy"),
  localAnalyticsToggle: document.querySelector("#localAnalyticsToggle"),
  applyRetention: document.querySelector("#applyRetention"),
  previewWipe: document.querySelector("#previewWipe"),
  wipeLocalData: document.querySelector("#wipeLocalData"),
  privacySummary: document.querySelector("#privacySummary"),
  privacyArtifacts: document.querySelector("#privacyArtifacts"),
  refreshTeam: document.querySelector("#refreshTeam"),
  teamUserSelect: document.querySelector("#teamUserSelect"),
  exportAuditJson: document.querySelector("#exportAuditJson"),
  exportAuditCsv: document.querySelector("#exportAuditCsv"),
  teamSyncExport: document.querySelector("#teamSyncExport"),
  teamSummary: document.querySelector("#teamSummary"),
  sharedReceipts: document.querySelector("#sharedReceipts")
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
  await Promise.all([
    refreshStatus(),
    refreshFiles(),
    refreshRecipes(),
    refreshConversations(),
    refreshReceipts(),
    refreshSessions(),
    refreshMemory(),
    refreshMemoryCitations(),
    refreshMemoryHistory(),
    refreshPacks(),
    refreshProfilesAndMcp(),
    refreshMarketplace(),
    refreshSearchIndex(),
    refreshObservability(),
    refreshPrivacy(),
    refreshTeam(),
    refreshEvalHistory(),
    refreshInstalledModels(),
    checkPendingRun()
  ]);
  registerServiceWorker();
  els.prompt.focus();
});

let themePreference = "system";
let fontScalePreference = "default";
let densityPreference = "comfortable";
let motionPreference = "system";
let localePreference = "en";

const THEME_OPTIONS = ["system", "light", "dark", "warm", "contrast"];
const THEME_LABELS = {
  system: "System",
  light: "Light",
  dark: "Dark",
  warm: "Warm",
  contrast: "High contrast"
};

const I18N = {
  en: {
    accessTitle: "Access",
    theme: "Theme",
    textSize: "Text size",
    density: "Density",
    motion: "Motion",
    language: "Language",
    newChat: "New chat",
    privateLocal: "Private & local",
    localHint: "Chats, metadata, imports, and branches stay in this workspace by default.",
    searchChats: "Search chats...",
    folder: "Folder",
    tags: "Tags, comma-separated",
    saveChat: "Save chat",
    export: "Export",
    import: "Import",
    messagePlaceholder: "Message AgentTrail...",
    composerHint: "Local · nothing leaves your machine",
    accessStatus: "Access settings are stored only in this browser."
  },
  es: {
    accessTitle: "Acceso",
    theme: "Tema",
    textSize: "Tamano de texto",
    density: "Densidad",
    motion: "Movimiento",
    language: "Idioma",
    newChat: "Nuevo chat",
    privateLocal: "Privado y local",
    localHint: "Chats, metadatos, importaciones y ramas se quedan en este espacio.",
    searchChats: "Buscar chats...",
    folder: "Carpeta",
    tags: "Etiquetas, separadas por coma",
    saveChat: "Guardar chat",
    export: "Exportar",
    import: "Importar",
    messagePlaceholder: "Mensaje para AgentTrail...",
    composerHint: "Local · nada sale de tu maquina",
    accessStatus: "Los ajustes de acceso se guardan solo en este navegador."
  }
};

function resolvedTheme(pref) {
  if (pref === "system") {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function applyThemePreference(pref) {
  document.documentElement.dataset.theme = resolvedTheme(pref);
  const label = THEME_LABELS[pref] || pref;
  if (els.themeToggle) {
    els.themeToggle.title = `Theme: ${label}`;
    els.themeToggle.setAttribute("aria-label", `Theme: ${label}`);
  }
  if (els.themeSelect) {
    els.themeSelect.value = pref;
  }
  updateAccessStatus();
}

function initAccessPreferences() {
  themePreference = loadAccessPreference("agenttrail-theme", "system", THEME_OPTIONS);
  fontScalePreference = loadAccessPreference("agenttrail-font-scale", "default", ["small", "default", "large"]);
  densityPreference = loadAccessPreference("agenttrail-density", "comfortable", ["compact", "comfortable", "spacious"]);
  motionPreference = loadAccessPreference("agenttrail-motion", "system", ["system", "reduced", "full"]);
  localePreference = loadAccessPreference("agenttrail-locale", "en", Object.keys(I18N));
  applyThemePreference(themePreference);
  applyFontScalePreference(fontScalePreference);
  applyDensityPreference(densityPreference);
  applyMotionPreference(motionPreference);
  applyLocalePreference(localePreference);
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (themePreference === "system") {
        applyThemePreference("system");
      }
    });
  } catch {
    // matchMedia unavailable; ignore
  }
}

function loadAccessPreference(key, fallback, allowed) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveAccessPreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable; setting still applies for this tab
  }
}

function applyFontScalePreference(pref) {
  document.documentElement.dataset.fontScale = pref;
  if (els.fontScaleSelect) {
    els.fontScaleSelect.value = pref;
  }
  updateAccessStatus();
}

function applyDensityPreference(pref) {
  document.documentElement.dataset.density = pref;
  if (els.densitySelect) {
    els.densitySelect.value = pref;
  }
  updateAccessStatus();
}

function applyMotionPreference(pref) {
  document.documentElement.dataset.motion = pref;
  if (els.motionSelect) {
    els.motionSelect.value = pref;
  }
  updateAccessStatus();
}

function applyLocalePreference(pref) {
  localePreference = I18N[pref] ? pref : "en";
  document.documentElement.lang = localePreference;
  if (els.localeSelect) {
    els.localeSelect.value = localePreference;
  }
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    const value = translateText(key);
    if (value) node.textContent = value;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    const value = translateText(key);
    if (value) node.setAttribute("placeholder", value);
  });
  updateAccessStatus();
}

function translateText(key) {
  return (I18N[localePreference] && I18N[localePreference][key]) || I18N.en[key] || "";
}

function updateAccessStatus(extra) {
  if (!els.accessStatus) {
    return;
  }
  const base = translateText("accessStatus") || "Access settings are stored only in this browser.";
  const theme = THEME_LABELS[themePreference] || themePreference;
  const details = `${theme} theme, ${fontScalePreference} text, ${densityPreference} density, ${motionPreference} motion.`;
  els.accessStatus.textContent = extra || `${base} ${details}`;
}

function cycleTheme() {
  const currentIndex = THEME_OPTIONS.indexOf(themePreference);
  themePreference = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length] || "system";
  saveAccessPreference("agenttrail-theme", themePreference);
  applyThemePreference(themePreference);
  addTrail("system", `Theme set to ${THEME_LABELS[themePreference] || themePreference}`);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
    updateAccessStatus("Offline shell is ready. Access settings are stored only in this browser.");
    addTrail("system", "Offline shell ready");
  } catch (error) {
    updateAccessStatus(`Offline shell unavailable: ${error.message}`);
  }
}

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
    addTrail("search", `Semantic search ${state.semanticSearch ? "on" : "off"}`);
  });
  els.runSearch.addEventListener("click", searchWorkspace);
  els.buildSearchIndex.addEventListener("click", buildSearchIndex);
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
  if (els.pullModelButton) {
    els.pullModelButton.addEventListener("click", pullModel);
  }
  if (els.pullModelName) {
    els.pullModelName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        pullModel();
      }
    });
  }
  els.newNote.addEventListener("click", createNewNote);
  els.attachFiles.addEventListener("click", () => els.attachmentInput.click());
  if (els.voicePrompt) {
    els.voicePrompt.addEventListener("click", toggleVoicePrompt);
  }
  els.attachmentInput.addEventListener("change", attachSelectedFiles);
  bindComposerAttachmentIntake();
  els.useRecipe.addEventListener("click", applySelectedRecipe);
  els.recipeSelect.addEventListener("change", updateRecipeHint);
  els.stepBudgetSelect.addEventListener("change", updateStepBudget);
  els.planButton.addEventListener("click", generatePlan);
  if (els.screenshotAction) {
    els.screenshotAction.addEventListener("click", () => generateScreenshotActionPlan());
  }
  els.stopButton.addEventListener("click", stopCurrentRun);
  if (els.resumeRunButton) {
    els.resumeRunButton.addEventListener("click", resumePendingRun);
  }
  if (els.dismissResumeButton) {
    els.dismissResumeButton.addEventListener("click", dismissPendingRun);
  }
  if (els.newChat) {
    els.newChat.addEventListener("click", startNewChat);
  }
  if (els.conversationSearch) {
    els.conversationSearch.addEventListener("input", () => {
      state.conversationSearch = els.conversationSearch.value.trim();
      refreshConversations();
    });
  }
  if (els.saveConversationMeta) {
    els.saveConversationMeta.addEventListener("click", () => saveCurrentConversation({ force: true }));
  }
  if (els.exportConversation) {
    els.exportConversation.addEventListener("click", exportCurrentConversation);
  }
  if (els.importConversation) {
    els.importConversation.addEventListener("click", () => els.conversationImportInput && els.conversationImportInput.click());
  }
  if (els.conversationImportInput) {
    els.conversationImportInput.addEventListener("change", importConversationFile);
  }
  [els.toolsToggle, els.toolsToggleTop, els.toolsToggleMobile].forEach((button) => {
    if (button) button.addEventListener("click", openToolsDrawer);
  });
  if (els.closeTools) {
    els.closeTools.addEventListener("click", closeToolsDrawer);
  }
  if (els.refreshResources) {
    els.refreshResources.addEventListener("click", refreshResources);
  }
  initAccessPreferences();
  if (els.themeToggle) {
    els.themeToggle.addEventListener("click", cycleTheme);
  }
  bindAccessPreference(els.themeSelect, "agenttrail-theme", (value) => {
    themePreference = value;
    applyThemePreference(value);
    addTrail("system", `Theme set to ${THEME_LABELS[value] || value}`);
  });
  bindAccessPreference(els.fontScaleSelect, "agenttrail-font-scale", (value) => {
    fontScalePreference = value;
    applyFontScalePreference(value);
    addTrail("access", `Text size set to ${value}`);
  });
  bindAccessPreference(els.densitySelect, "agenttrail-density", (value) => {
    densityPreference = value;
    applyDensityPreference(value);
    addTrail("access", `Density set to ${value}`);
  });
  bindAccessPreference(els.motionSelect, "agenttrail-motion", (value) => {
    motionPreference = value;
    applyMotionPreference(value);
    addTrail("access", `Motion set to ${value}`);
  });
  bindAccessPreference(els.localeSelect, "agenttrail-locale", (value) => {
    localePreference = value;
    applyLocalePreference(value);
    addTrail("access", `Language set to ${value}`);
  });
  if (els.refreshObservability) {
    els.refreshObservability.addEventListener("click", refreshObservability);
  }
  if (els.refreshPrivacy) {
    els.refreshPrivacy.addEventListener("click", refreshPrivacy);
  }
  if (els.localAnalyticsToggle) {
    els.localAnalyticsToggle.addEventListener("change", updateLocalAnalyticsSetting);
  }
  if (els.applyRetention) {
    els.applyRetention.addEventListener("click", applyPrivacyRetention);
  }
  if (els.previewWipe) {
    els.previewWipe.addEventListener("click", previewPrivacyWipe);
  }
  if (els.wipeLocalData) {
    els.wipeLocalData.addEventListener("click", wipePrivacyData);
  }
  if (els.refreshTeam) {
    els.refreshTeam.addEventListener("click", refreshTeam);
  }
  if (els.teamUserSelect) {
    els.teamUserSelect.addEventListener("change", selectTeamUser);
  }
  if (els.exportAuditJson) {
    els.exportAuditJson.addEventListener("click", () => exportAudit("json"));
  }
  if (els.exportAuditCsv) {
    els.exportAuditCsv.addEventListener("click", () => exportAudit("csv"));
  }
  if (els.teamSyncExport) {
    els.teamSyncExport.addEventListener("click", exportTeamSync);
  }
  if (els.toolsBackdrop) {
    els.toolsBackdrop.addEventListener("click", closeToolsDrawer);
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.toolsDrawer && !els.toolsDrawer.hidden) {
      closeToolsDrawer();
    }
  });
  els.approvePlan.addEventListener("click", approvePlanAndRun);
  els.discardPlan.addEventListener("click", discardPlan);
  els.planText.addEventListener("input", updateSendState);
  els.exportTrail.addEventListener("click", exportTrailReceipt);
  els.applyAllPreviews.addEventListener("click", applyAllPreviews);
  els.receiptFilter.addEventListener("input", renderReceiptTimeline);
  els.replaySession.addEventListener("click", replaySelectedSession);
  if (els.resumeReceipt) {
    els.resumeReceipt.addEventListener("click", resumeSelectedReceipt);
  }
  els.exportReport.addEventListener("click", exportShareableReport);
  els.memoryScope.addEventListener("change", changeMemoryScope);
  els.saveMemory.addEventListener("click", saveMemory);
  els.refreshMemoryHistory.addEventListener("click", refreshMemoryHistory);
  els.exportPack.addEventListener("click", exportSelectedPack);
  els.runEval.addEventListener("click", runEvals);
  els.applyProfile.addEventListener("click", applySelectedProfile);
  els.runBenchmark.addEventListener("click", runBenchmarks);
  els.securityScan.addEventListener("click", runSecurityScan);
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
  els.prompt.addEventListener("input", () => {
    resizePrompt();
    renderComposerAssist();
  });
  els.prompt.addEventListener("keydown", (event) => {
    if (handleComposerAssistKeydown(event)) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      els.composer.requestSubmit();
    }
  });
  bindShortcuts();
}

function bindAccessPreference(select, storageKey, onChange) {
  if (!select) {
    return;
  }
  select.addEventListener("change", () => {
    const value = select.value;
    saveAccessPreference(storageKey, value);
    onChange(value);
  });
}

function bindShortcuts() {
  document.addEventListener("keydown", (event) => {
    // Cmd/Ctrl+Enter submits from anywhere.
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      els.composer.requestSubmit();
      return;
    }
    const tag = (event.target && event.target.tagName) || "";
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (typing) {
      if (event.key === "Escape") {
        event.target.blur();
      }
      return;
    }
    if (state.keyChord === "g") {
      clearKeyboardChord();
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        openToolsDrawer();
        focusElement(els.workspaceSearch);
        updateAccessStatus("Focused workspace search.");
      } else if (key === "c") {
        event.preventDefault();
        focusElement(els.conversationSearch);
        updateAccessStatus("Focused conversation search.");
      } else if (key === "t") {
        event.preventDefault();
        openToolsDrawer({ focusAccess: true });
        updateAccessStatus("Opened tools and access settings.");
      } else if (key === "m") {
        event.preventDefault();
        focusElement(els.messages);
        updateAccessStatus("Focused message history.");
      }
      return;
    }
    if (event.key.toLowerCase() === "g") {
      event.preventDefault();
      state.keyChord = "g";
      clearTimeout(state.keyChordTimer);
      state.keyChordTimer = setTimeout(clearKeyboardChord, 1200);
      updateAccessStatus("Shortcut prefix ready: press s, c, t, or m.");
      return;
    }
    if (event.key === "?") {
      event.preventDefault();
      openToolsDrawer({ focusAccess: true });
      updateAccessStatus("Keyboard help is in the Access panel.");
      return;
    }
    // "/" focuses workspace search; "i" focuses the prompt.
    if (event.key === "/") {
      event.preventDefault();
      openToolsDrawer();
      focusElement(els.workspaceSearch);
    } else if (event.key === "i") {
      event.preventDefault();
      focusElement(els.prompt);
    }
  });
}

function clearKeyboardChord() {
  state.keyChord = null;
  clearTimeout(state.keyChordTimer);
  state.keyChordTimer = null;
}

function focusElement(element) {
  if (element && typeof element.focus === "function") {
    element.focus({ preventScroll: false });
  }
}

function currentComposerToken() {
  if (!els.prompt) {
    return null;
  }
  const value = els.prompt.value || "";
  const cursor = typeof els.prompt.selectionStart === "number" ? els.prompt.selectionStart : value.length;
  const before = value.slice(0, cursor);
  const slashCommand = before.match(/(?:^|\n)(\/(?:recipe|file|model)\s+[^\n]*)$/i);
  if (slashCommand) {
    return {
      token: slashCommand[1],
      start: cursor - slashCommand[1].length,
      end: cursor
    };
  }
  const match = before.match(/(?:^|\s)([/@][^\s]*)$/);
  if (!match) {
    return null;
  }
  const token = match[1];
  return {
    token,
    start: cursor - token.length,
    end: cursor
  };
}

function renderComposerAssist() {
  if (!els.composerAssist) {
    return;
  }
  const active = currentComposerToken();
  if (!active || (!active.token.startsWith("/") && !active.token.startsWith("@"))) {
    state.composerAssist = { items: [], activeIndex: 0 };
    els.composerAssist.hidden = true;
    els.composerAssist.innerHTML = "";
    return;
  }

  const items = active.token.startsWith("/")
    ? slashCommandSuggestions(active.token)
    : fileMentionSuggestions(active.token.slice(1));
  const visibleItems = items.slice(0, 8);
  state.composerAssist = {
    items: visibleItems,
    activeIndex: Math.min(state.composerAssist.activeIndex || 0, Math.max(0, visibleItems.length - 1))
  };

  if (!visibleItems.length) {
    els.composerAssist.hidden = true;
    els.composerAssist.innerHTML = "";
    return;
  }

  els.composerAssist.hidden = false;
  els.composerAssist.innerHTML = visibleItems.map((item, index) => `
    <button type="button" role="option" aria-selected="${index === state.composerAssist.activeIndex ? "true" : "false"}" class="${index === state.composerAssist.activeIndex ? "active" : ""}" data-index="${index}">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.description || "")}</span>
    </button>`).join("");
  els.composerAssist.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => applyComposerAssistItem(Number(button.dataset.index) || 0));
  });
}

function slashCommandSuggestions(token) {
  const parts = token.slice(1).split(/\s+/);
  const command = (parts[0] || "").toLowerCase();
  const query = token.replace(/^\/(recipe|file|model)/i, "").replace(/^\//, "").trim().toLowerCase();
  const commands = [
    { kind: "command", command: "recipe", label: "/recipe", description: "Insert a local recipe prompt" },
    { kind: "command", command: "file", label: "/file", description: "Mention and attach a workspace file" },
    { kind: "command", command: "model", label: "/model", description: "Switch to an installed local model" }
  ];
  if (!command || !["recipe", "file", "model"].includes(command)) {
    return commands.filter((item) => item.label.includes(command || "/"));
  }
  if (command === "recipe") {
    return state.recipes
      .filter((recipe) => !query || `${recipe.title || ""} ${recipe.id || ""}`.toLowerCase().includes(query))
      .slice(0, 8)
      .map((recipe) => ({ kind: "recipe", label: recipe.title || recipe.id, description: recipe.description || recipe.id, recipe }));
  }
  if (command === "file") {
    return fileMentionSuggestions(query).map((item) => ({ ...item, replaceSlash: true }));
  }
  return state.models
    .filter((model) => !query || String(model.name || model).toLowerCase().includes(query))
    .slice(0, 8)
    .map((model) => {
      const name = typeof model === "string" ? model : model.name;
      return { kind: "model", label: name, description: "Use this model for the next run", model: name };
    });
}

function fileMentionSuggestions(query = "") {
  const normalized = String(query || "").replace(/^@/, "").toLowerCase();
  return state.files
    .filter((file) => file && file.path && (!normalized || file.path.toLowerCase().includes(normalized)))
    .slice(0, 8)
    .map((file) => ({ kind: "file", label: `@${file.path}`, description: `${formatBytes(file.size || 0)} · attach as context`, file }));
}

function handleComposerAssistKeydown(event) {
  if (!els.composerAssist || els.composerAssist.hidden || !state.composerAssist.items.length) {
    return false;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const length = state.composerAssist.items.length;
    state.composerAssist.activeIndex = (state.composerAssist.activeIndex + delta + length) % length;
    renderComposerAssist();
    return true;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    applyComposerAssistItem(state.composerAssist.activeIndex || 0);
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    state.composerAssist = { items: [], activeIndex: 0 };
    els.composerAssist.hidden = true;
    els.composerAssist.innerHTML = "";
    return true;
  }
  return false;
}

function applyComposerAssistItem(index) {
  const item = state.composerAssist.items[index];
  if (!item) {
    return;
  }
  if (item.kind === "command") {
    if (item.command === "recipe") {
      const recipe = state.recipes.find((entry) => entry.id === els.recipeSelect.value) || state.recipes[0];
      if (recipe && recipe.prompt) {
        els.prompt.value = recipe.prompt;
        addTrail("composer", `Inserted recipe ${recipe.title || recipe.id}`);
      }
    } else if (item.command === "file") {
      replaceComposerToken("@");
      addTrail("composer", "Ready for @file context");
    } else if (item.command === "model") {
      els.modelSelect.focus();
      addTrail("composer", "Model picker focused");
    }
  } else if (item.kind === "recipe" && item.recipe) {
    els.prompt.value = item.recipe.prompt || "";
    addTrail("composer", `Inserted recipe ${item.recipe.title || item.recipe.id}`);
  } else if (item.kind === "file" && item.file) {
    state.selectedFiles.add(item.file.path);
    replaceComposerToken(`${mentionTokenForFile(item.file.path)} `);
    renderFiles();
    renderLocalSignals();
    addTrail("context", `Mention attached ${item.file.path}`);
  } else if (item.kind === "model" && item.model) {
    state.model = item.model;
    els.modelSelect.value = item.model;
    replaceComposerToken("");
    addTrail("model", `Model set to ${item.model}`);
  }
  resizePrompt();
  renderComposerAssist();
  els.prompt.focus();
}

function replaceComposerToken(replacement) {
  const active = currentComposerToken();
  if (!active) {
    els.prompt.value = appendPromptText(els.prompt.value, replacement);
    return;
  }
  const value = els.prompt.value || "";
  els.prompt.value = `${value.slice(0, active.start)}${replacement}${value.slice(active.end)}`;
  const nextCursor = active.start + replacement.length;
  els.prompt.setSelectionRange(nextCursor, nextCursor);
}

function mentionTokenForFile(filePath) {
  const path = String(filePath || "");
  return /\s/.test(path) ? `@"${path}"` : `@${path}`;
}

function selectMentionedFiles(content) {
  const paths = extractMentionedFilePaths(content);
  if (!paths.length) {
    return [];
  }
  const known = new Set(state.files.map((file) => file.path));
  const selected = [];
  for (const filePath of paths) {
    if (known.has(filePath)) {
      state.selectedFiles.add(filePath);
      selected.push(filePath);
    }
  }
  if (selected.length) {
    renderFiles();
    renderLocalSignals();
    addTrail("context", `Attached ${selected.length} @mentioned file(s)`);
  }
  return selected;
}

function extractMentionedFilePaths(content) {
  const text = String(content || "");
  const paths = new Set();
  text.replace(/@"([^"]+)"/g, (_match, filePath) => {
    paths.add(filePath);
    return "";
  });
  text.replace(/@([A-Za-z0-9._/\\:-]+)/g, (_match, filePath) => {
    paths.add(filePath);
    return "";
  });
  return [...paths];
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

async function refreshConversations() {
  if (!els.conversationList) {
    return;
  }
  try {
    const query = state.conversationSearch ? `?q=${encodeURIComponent(state.conversationSearch)}` : "";
    const data = await getJson(`/api/conversations${query}`);
    state.conversations = data.conversations || [];
  } catch (error) {
    state.conversations = [];
    addTrail("error", `Could not load conversations: ${error.message}`);
  }
  renderConversations();
}

function renderConversations() {
  if (!els.conversationList) {
    return;
  }
  if (!state.conversations.length) {
    els.conversationList.innerHTML = `<div class="mini-row muted">${state.conversationSearch ? "No chats match this search." : "No saved chats yet."}</div>`;
    return;
  }

  els.conversationList.innerHTML = state.conversations.slice(0, 50).map((conversation) => {
    const tags = [
      conversation.folder ? `Folder: ${conversation.folder}` : "",
      ...(conversation.tags || []).map((tag) => `#${tag}`),
      conversation.parentId ? "branch" : ""
    ].filter(Boolean);
    return `
      <div class="conversation-row${conversation.id === state.activeConversationId ? " active" : ""}" role="listitem" data-id="${escapeHtml(conversation.id)}">
        <button class="conversation-main" type="button" data-action="open" title="Open conversation">
          <strong>${conversation.pinned ? "Pinned - " : ""}${escapeHtml(conversation.title || "New conversation")}</strong>
          <span>${escapeHtml(conversation.preview || `${conversation.messageCount || 0} message(s)`)}</span>
        </button>
        <div class="conversation-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="conversation-actions-inline">
          <button type="button" data-action="rename">Rename</button>
          <button type="button" data-action="pin">${conversation.pinned ? "Unpin" : "Pin"}</button>
          <button type="button" data-action="branch">Branch</button>
          <button type="button" data-action="delete">Delete</button>
        </div>
      </div>`;
  }).join("");

  els.conversationList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest(".conversation-row");
      const id = row ? row.dataset.id : "";
      const action = button.dataset.action;
      if (action === "open") return openConversation(id);
      if (action === "rename") return renameConversation(id);
      if (action === "pin") return toggleConversationPin(id);
      if (action === "branch") return branchConversation(id);
      if (action === "delete") return deleteConversation(id);
    });
  });
}

function activeConversationSummary() {
  return state.conversations.find((conversation) => conversation.id === state.activeConversationId) || null;
}

function conversationMetadataFromInputs() {
  return {
    folder: els.conversationFolder ? els.conversationFolder.value.trim() : "",
    tags: els.conversationTags ? els.conversationTags.value.split(",").map((tag) => tag.trim()).filter(Boolean) : []
  };
}

function setConversationMetadataInputs(conversation) {
  if (els.conversationFolder) {
    els.conversationFolder.value = conversation && conversation.folder ? conversation.folder : "";
  }
  if (els.conversationTags) {
    els.conversationTags.value = conversation && Array.isArray(conversation.tags) ? conversation.tags.join(", ") : "";
  }
}

async function saveCurrentConversation(options = {}) {
  const messages = state.messages.filter((message) => message.role === "user" || message.role === "assistant");
  const hasUserMessage = messages.some((message) => message.role === "user" && String(message.content || "").trim());
  if (!options.force && !hasUserMessage) {
    return null;
  }
  const current = activeConversationSummary();
  const payload = {
    id: state.activeConversationId || undefined,
    messages,
    title: options.title || (current && current.title) || "",
    pinned: current ? current.pinned : false,
    ...conversationMetadataFromInputs()
  };
  const saved = await postJson("/api/conversations", payload);
  state.activeConversationId = saved.id;
  await refreshConversations();
  setConversationMetadataInputs(saved);
  if (!options.silent) {
    addTrail("conversation", `Saved chat ${saved.title}`);
  }
  return saved;
}

async function openConversation(id) {
  if (!id) return;
  try {
    const data = await getJson(`/api/conversations/get?id=${encodeURIComponent(id)}`);
    const conversation = data.conversation;
    state.activeConversationId = conversation.id;
    state.editingMessageIndex = null;
    state.messages = normalizeUiMessages(conversation.messages || []);
    setConversationMetadataInputs(conversation);
    renderComposerMode();
    renderMessages();
    renderConversations();
    addTrail("conversation", `Opened ${conversation.title || "conversation"}`);
    els.prompt.focus();
  } catch (error) {
    addTrail("error", `Could not open chat: ${error.message}`);
  }
}

async function renameConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  const title = prompt("Rename conversation", conversation.title || "New conversation");
  if (!title || !title.trim()) return;
  try {
    await postJson("/api/conversations", { id, title: title.trim() });
    await refreshConversations();
    addTrail("conversation", `Renamed chat to ${title.trim()}`);
  } catch (error) {
    addTrail("error", `Could not rename chat: ${error.message}`);
  }
}

async function toggleConversationPin(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  try {
    await postJson("/api/conversations", { id, pinned: !conversation.pinned });
    await refreshConversations();
    addTrail("conversation", `${conversation.pinned ? "Unpinned" : "Pinned"} ${conversation.title}`);
  } catch (error) {
    addTrail("error", `Could not pin chat: ${error.message}`);
  }
}

async function deleteConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  if (!confirm(`Delete "${conversation.title}"? You can undo this immediately.`)) return;
  try {
    const result = await postJson("/api/conversations/delete", { id });
    state.deletedConversation = { id, title: conversation.title, undoToken: result.undoToken };
    if (state.activeConversationId === id) {
      startNewChat({ silent: true });
    }
    await refreshConversations();
    renderConversationUndo();
    addTrail("conversation", `Deleted chat ${conversation.title}`);
  } catch (error) {
    addTrail("error", `Could not delete chat: ${error.message}`);
  }
}

function renderConversationUndo() {
  if (!els.conversationUndo) return;
  if (!state.deletedConversation) {
    els.conversationUndo.hidden = true;
    els.conversationUndo.innerHTML = "";
    return;
  }
  els.conversationUndo.hidden = false;
  els.conversationUndo.innerHTML = `
    <span>Deleted ${escapeHtml(state.deletedConversation.title || "conversation")}</span>
    <button id="undoConversationDelete" class="secondary-button compact-button" type="button">Undo delete</button>`;
  const button = document.querySelector("#undoConversationDelete");
  if (button) button.addEventListener("click", restoreDeletedConversation);
}

async function restoreDeletedConversation() {
  if (!state.deletedConversation) return;
  try {
    const restored = await postJson("/api/conversations/restore", { undoToken: state.deletedConversation.undoToken });
    state.deletedConversation = null;
    await refreshConversations();
    renderConversationUndo();
    if (restored.conversation && restored.conversation.id) {
      await openConversation(restored.conversation.id);
    }
    addTrail("conversation", "Restored deleted chat");
  } catch (error) {
    addTrail("error", `Could not restore chat: ${error.message}`);
  }
}

async function exportCurrentConversation() {
  const messages = state.messages.filter((message) => message.role === "user" || message.role === "assistant");
  if (!messages.length) return;
  try {
    const current = activeConversationSummary();
    const exported = await postJson("/api/conversations/export", {
      title: current ? current.title : "AgentTrail conversation",
      messages,
      format: "markdown"
    });
    downloadText(exported.filename || "conversation.md", exported.content, exported.contentType || "text/markdown");
    addTrail("conversation", "Exported current chat");
  } catch (error) {
    addTrail("error", `Could not export chat: ${error.message}`);
  }
}

async function importConversationFile() {
  const file = els.conversationImportInput && els.conversationImportInput.files && els.conversationImportInput.files[0];
  if (!file) return;
  try {
    const content = await file.text();
    const result = await postJson("/api/conversations/import", { content });
    await refreshConversations();
    if (result.conversation && result.conversation.id) {
      await openConversation(result.conversation.id);
    }
    addTrail("conversation", `Imported ${file.name}`);
  } catch (error) {
    addTrail("error", `Could not import chat: ${error.message}`);
  } finally {
    els.conversationImportInput.value = "";
  }
}

async function branchConversation(id, messageIndex) {
  if (!id && state.activeConversationId) {
    id = state.activeConversationId;
  }
  if (!id) {
    const saved = await saveCurrentConversation({ force: true, silent: true });
    id = saved && saved.id;
  }
  if (!id) return;
  try {
    const result = await postJson("/api/conversations/branch", { id, messageIndex });
    await refreshConversations();
    if (result.conversation && result.conversation.id) {
      await openConversation(result.conversation.id);
    }
    addTrail("conversation", "Created chat branch");
  } catch (error) {
    addTrail("error", `Could not branch chat: ${error.message}`);
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

async function refreshSessions() {
  try {
    const data = await getJson("/api/sessions");
    state.sessions = data.sessions || [];
  } catch {
    state.sessions = [];
  }
  renderSessions();
  renderSetupChecklist();
  renderTrustScore();
}

function renderSessions() {
  if (!els.sessionSelect) {
    return;
  }
  els.sessionSelect.innerHTML = "";
  if (!state.sessions.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No replay sessions";
    els.sessionSelect.appendChild(option);
    els.replaySession.disabled = true;
    return;
  }

  for (const session of state.sessions.slice(0, 25)) {
    const option = document.createElement("option");
    option.value = session.path;
    option.textContent = session.title || session.path.replace(/^sessions\//, "");
    els.sessionSelect.appendChild(option);
  }
  els.replaySession.disabled = false;
}

async function replaySelectedSession() {
  const path = els.sessionSelect.value;
  if (!path) {
    return;
  }

  try {
    const file = await getJson(`/api/sessions/content?path=${encodeURIComponent(path)}`);
    const session = JSON.parse(file.content || "{}");
    state.messages = normalizeUiMessages(session.messages || []);
    state.editingMessageIndex = null;
    state.selectedFiles = new Set((session.selectedFiles || []).filter(Boolean));
    state.pendingPreviews = Array.isArray(session.pendingPreviews) ? session.pendingPreviews : [];
    state.trail = Array.isArray(session.trail) ? session.trail.slice(0, 24) : [];
    state.permissions = {
      ...state.permissions,
      ...(session.permissions || {})
    };
    els.readPermission.checked = state.permissions.readFiles !== false;
    els.writePermission.checked = state.permissions.writeFiles === true;
    els.previewWritePermission.checked = state.permissions.previewWrites !== false;
    if (session.model) {
      state.model = session.model;
      if ([...els.modelSelect.options].some((option) => option.value === session.model)) {
        els.modelSelect.value = session.model;
      }
    }
    if (session.replay && session.replay.prompt) {
      els.prompt.value = session.replay.prompt;
      resizePrompt();
    }
    addTrail("replay", `Replayed ${path}`);
    renderComposerMode();
    renderFiles();
    renderMessages();
    renderTrail();
    renderPendingChanges();
    renderLocalSignals();
    renderTrustScore();
  } catch (error) {
    addTrail("error", `Could not replay session: ${error.message}`);
  }
}

async function refreshSearchIndex() {
  try {
    const data = await getJson("/api/search-index");
    state.searchIndex = data;
    renderSearchIndex();
    renderSetupChecklist();
    renderTrustScore();
  } catch (error) {
    els.searchIndexSummary.textContent = `Search index unavailable: ${error.message}`;
  }
}

async function buildSearchIndex() {
  els.searchIndexSummary.textContent = "Building local vector index...";
  try {
    const data = await postJson("/api/search-index", { provider: "auto" });
    state.searchIndex = data;
    renderSearchIndex();
    addTrail("search", `Built ${data.provider} index over ${data.itemCount} file(s)`);
    renderSetupChecklist();
    renderTrustScore();
  } catch (error) {
    els.searchIndexSummary.textContent = error.message;
    addTrail("error", error.message);
  }
}

function renderSearchIndex() {
  if (!state.searchIndex || !els.searchIndexSummary) {
    return;
  }
  if (!state.searchIndex.exists && !state.searchIndex.ok) {
    els.searchIndexSummary.textContent = `No index yet. Embedding model: ${state.searchIndex.embedModel || "nomic-embed-text"}.`;
    return;
  }
  const provider = state.searchIndex.provider || "local-vector";
  const count = state.searchIndex.itemCount || 0;
  const model = state.searchIndex.model || state.searchIndex.embedModel || "hash";
  els.searchIndexSummary.textContent = `${provider} index: ${count} item(s), model ${model}.`;
}

async function refreshMemory() {
  try {
    const data = await getJson(`/api/memory?scope=${encodeURIComponent(state.memoryScope)}`);
    els.memoryInput.value = data.content || "";
    state.structuredMemory = data.structured || null;
    state.memoryLoaded = true;
    els.memoryStatus.textContent = data.structured
      ? `Loaded ${data.label || state.memoryScope} memory · ${memoryCountSummary(data.structured)}`
      : (data.modifiedAt ? `Loaded ${data.path}` : "Memory is ready.");
  } catch (error) {
    els.memoryStatus.textContent = `Memory unavailable: ${error.message}`;
  }
}

async function changeMemoryScope() {
  state.memoryScope = els.memoryScope.value || "project";
  state.memorySuggestions = [];
  renderMemorySuggestions();
  await refreshMemory();
  await refreshMemoryCitations();
  await refreshMemoryHistory();
}

async function saveMemory() {
  try {
    const saved = await postJson("/api/memory", { content: els.memoryInput.value, scope: state.memoryScope });
    state.memoryLoaded = true;
    state.structuredMemory = saved.structured?.memory || null;
    els.memoryStatus.textContent = `Saved ${saved.label || state.memoryScope} memory; ${memoryCountSummary(state.structuredMemory)}; history ${saved.history?.path || "recorded"}`;
    addTrail("memory", `Saved ${saved.label || state.memoryScope} memory`);
    await refreshMemoryCitations();
    await refreshMemoryHistory();
    renderTrustScore();
  } catch (error) {
    els.memoryStatus.textContent = error.message;
    addTrail("error", error.message);
  }
}

function memoryCountSummary(memory) {
  if (!memory) {
    return "0 structured items";
  }
  const facts = (memory.facts || []).length;
  const preferences = (memory.preferences || []).length;
  const decisions = (memory.decisions || []).length;
  return `${facts} facts, ${preferences} prefs, ${decisions} decisions`;
}

function renderMemorySuggestions() {
  if (!els.memorySuggestions) {
    return;
  }
  const suggestions = state.memorySuggestions || [];
  if (!suggestions.length) {
    els.memorySuggestions.innerHTML = "";
    return;
  }
  els.memorySuggestions.innerHTML = `
    <div class="mini-row muted">
      <strong>Suggested memory</strong>
      <span>${suggestions.length} item(s) for ${escapeHtml(state.memoryScope)} memory</span>
      <button type="button" data-action="save-all">Save all</button>
    </div>
    ${suggestions.slice(0, 6).map((item) => `
      <div class="mini-row memory-suggestion">
        <strong>${escapeHtml(item.type)}</strong>
        <span>${escapeHtml(item.text)}</span>
        <button type="button" data-id="${escapeHtml(item.id)}">Save</button>
      </div>
    `).join("")}
  `;
  const saveAll = els.memorySuggestions.querySelector('[data-action="save-all"]');
  if (saveAll) {
    saveAll.addEventListener("click", () => applyMemorySuggestions(suggestions));
  }
  els.memorySuggestions.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = suggestions.find((item) => item.id === button.dataset.id);
      if (match) {
        applyMemorySuggestions([match]);
      }
    });
  });
}

async function applyMemorySuggestions(suggestions) {
  if (!Array.isArray(suggestions) || !suggestions.length) {
    return;
  }
  try {
    const saved = await postJson("/api/memory/suggestions/apply", { suggestions, scope: state.memoryScope });
    state.memorySuggestions = state.memorySuggestions.filter((item) => !suggestions.some((suggestion) => suggestion.id === item.id));
    state.structuredMemory = saved.structured?.memory || state.structuredMemory;
    els.memoryStatus.textContent = `Saved ${saved.applied} ${state.memoryScope} suggestion(s); ${memoryCountSummary(state.structuredMemory)}`;
    addTrail("memory", `Saved ${saved.applied} suggested ${state.memoryScope} memory item(s)`);
    renderMemorySuggestions();
    await refreshMemory();
    await refreshMemoryCitations();
    await refreshMemoryHistory();
    renderTrustScore();
  } catch (error) {
    els.memoryStatus.textContent = error.message;
    addTrail("error", error.message);
  }
}

async function refreshMemoryCitations(query = "") {
  if (!els.memoryCitations) {
    return;
  }
  try {
    const data = await getJson(`/api/memory/citations?scope=${encodeURIComponent(state.memoryScope)}&query=${encodeURIComponent(query)}`);
    renderMemoryCitations(data.citations || []);
  } catch {
    els.memoryCitations.innerHTML = "";
  }
}

function renderMemoryCitations(citations) {
  if (!citations.length) {
    els.memoryCitations.innerHTML = `<div class="mini-row muted">No memory citations yet.</div>`;
    return;
  }
  els.memoryCitations.innerHTML = citations
    .slice(0, 4)
    .map(
      (item) => `
        <div class="mini-row">
          <strong>${escapeHtml(item.path)}:${Number(item.line) || 1}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `
    )
    .join("");
}

async function refreshMemoryHistory() {
  if (!els.memoryHistory) {
    return;
  }
  try {
    const data = await getJson(`/api/memory/history?scope=${encodeURIComponent(state.memoryScope)}`);
    state.memoryHistory = data.revisions || [];
    renderMemoryHistory();
  } catch (error) {
    els.memoryHistory.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
  }
}

function renderMemoryHistory() {
  if (!els.memoryHistory) {
    return;
  }
  const revisions = state.memoryHistory || [];
  if (!revisions.length) {
    els.memoryHistory.innerHTML = `<div class="mini-row muted">No memory revisions yet.</div>`;
    if (els.memoryHistoryDiff) {
      els.memoryHistoryDiff.innerHTML = "";
    }
    return;
  }
  els.memoryHistory.innerHTML = revisions.slice(0, 6).map((item) => `
    <div class="mini-row memory-history-row">
      <strong>${escapeHtml(memoryRevisionLabel(item))}</strong>
      <span>${escapeHtml(memoryRevisionSummary(item))}</span>
      <div class="memory-history-actions">
        <button type="button" data-action="diff" data-id="${escapeHtml(item.id)}">View diff</button>
        <button type="button" data-action="revert" data-id="${escapeHtml(item.id)}">Revert</button>
      </div>
    </div>
  `).join("");
  els.memoryHistory.querySelectorAll("[data-action='diff']").forEach((button) => {
    button.addEventListener("click", () => showMemoryRevisionDiff(button.dataset.id));
  });
  els.memoryHistory.querySelectorAll("[data-action='revert']").forEach((button) => {
    button.addEventListener("click", () => revertMemoryRevision(button.dataset.id));
  });
}

function memoryRevisionLabel(item) {
  const date = item.savedAt ? new Date(item.savedAt) : null;
  const label = date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : item.id;
  return `${label} · ${item.reason || "manual-save"}`;
}

function memoryRevisionSummary(item) {
  const counts = item.counts || {};
  const total = (Number(counts.facts) || 0) + (Number(counts.preferences) || 0) + (Number(counts.decisions) || 0);
  return `${total} item(s), ${Number(item.newSize || item.size || 0)} bytes · ${item.preview || ""}`;
}

async function showMemoryRevisionDiff(id) {
  if (!id || !els.memoryHistoryDiff) {
    return;
  }
  try {
    const data = await getJson(`/api/memory/history/diff?scope=${encodeURIComponent(state.memoryScope)}&id=${encodeURIComponent(id)}`);
    state.selectedMemoryRevision = data.revision || null;
    const revision = data.revision || {};
    els.memoryHistoryDiff.innerHTML = `
      <div class="diff-preview memory-diff-preview">
        <div class="diff-preview-heading">
          <strong>${escapeHtml(revision.path || id)}</strong>
          <span>${escapeHtml(`Revert preview: +${data.diff?.stats?.added || 0}, -${data.diff?.stats?.removed || 0}`)}</span>
        </div>
        <pre class="diff-block">${colorDiffLines(data.diff?.text || "")}</pre>
      </div>
    `;
  } catch (error) {
    els.memoryHistoryDiff.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
  }
}

async function revertMemoryRevision(id) {
  if (!id) {
    return;
  }
  const revision = (state.memoryHistory || []).find((item) => item.id === id);
  const label = revision ? memoryRevisionLabel(revision) : id;
  if (!window.confirm(`Revert ${state.memoryScope} memory to ${label}? A new history entry will be created.`)) {
    return;
  }
  try {
    const saved = await postJson("/api/memory/history/revert", { id, scope: state.memoryScope });
    state.structuredMemory = saved.structured?.memory || state.structuredMemory;
    els.memoryStatus.textContent = `Restored ${saved.label || state.memoryScope} memory; ${memoryCountSummary(state.structuredMemory)}`;
    addTrail("memory", `Reverted ${state.memoryScope} memory to ${id}`);
    await refreshMemory();
    await refreshMemoryCitations();
    await refreshMemoryHistory();
    if (els.memoryHistoryDiff) {
      els.memoryHistoryDiff.innerHTML = "";
    }
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

async function refreshMarketplace() {
  try {
    const data = await getJson("/api/marketplace");
    state.marketplace = data.marketplace || null;
    renderMarketplace();
  } catch (error) {
    els.marketplaceSummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
  }
}

async function refreshProfilesAndMcp() {
  try {
    const [profileData, mcpData] = await Promise.all([getJson("/api/profiles"), getJson("/api/mcp")]);
    state.profiles = profileData.profiles || [];
    state.mcp = mcpData;
    const approvalCount = Array.isArray(mcpData.approvals) ? mcpData.approvals.length : 0;
    renderProfiles();
    els.profileSummary.textContent = `${state.profiles.length} profile(s), ${approvalCount} MCP approval rule(s).`;
  } catch (error) {
    els.profileSummary.textContent = `Toolkit metadata unavailable: ${error.message}`;
  }
}

function renderProfiles() {
  if (!els.profileSelect) {
    return;
  }
  els.profileSelect.innerHTML = "";
  if (!state.profiles.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No profiles found";
    els.profileSelect.appendChild(option);
    els.applyProfile.disabled = true;
    return;
  }
  for (const profile of state.profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.title;
    els.profileSelect.appendChild(option);
  }
  els.applyProfile.disabled = false;
}

async function applySelectedProfile() {
  const id = els.profileSelect.value;
  if (!id) {
    return;
  }
  try {
    const data = await postJson("/api/profiles/apply", { id });
    const applied = data.applied || {};
    state.permissions = {
      readFiles: applied.permissions?.readFiles !== false,
      writeFiles: applied.permissions?.writeFiles === true,
      previewWrites: applied.permissions?.previewWrites !== false
    };
    els.readPermission.checked = state.permissions.readFiles;
    els.writePermission.checked = state.permissions.writeFiles;
    els.previewWritePermission.checked = state.permissions.previewWrites;
    if (applied.model) {
      state.model = applied.model;
      if ([...els.modelSelect.options].some((option) => option.value === applied.model)) {
        els.modelSelect.value = applied.model;
      }
    }
    addTrail("profile", `Applied ${data.activeProfile.title}`);
    renderLocalSignals();
    renderSetupChecklist();
    renderTrustScore();
  } catch (error) {
    addTrail("error", error.message);
  }
}

function renderMarketplace() {
  if (!state.marketplace || !els.marketplaceSummary) {
    return;
  }
  const packs = state.marketplace.packs || [];
  if (!packs.length) {
    els.marketplaceSummary.innerHTML = `<div class="mini-row muted">Marketplace manifest is ready for community packs.</div>`;
    return;
  }
  els.marketplaceSummary.innerHTML = packs
    .slice(0, 3)
    .map(
      (pack) => `
        <div class="mini-row">
          <strong>${escapeHtml(pack.title)}</strong>
          <span>${escapeHtml(pack.role)} · ${pack.recipes.length} recipe(s)</span>
        </div>
      `
    )
    .join("");
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
    await refreshEvalHistory();
    renderTrustScore();
  } catch (error) {
    els.evalSummary.innerHTML = `<div class="empty-state compact">${escapeHtml(error.message)}</div>`;
    addTrail("error", error.message);
  }
}

async function refreshEvalHistory() {
  try {
    const data = await getJson("/api/evals/history");
    state.evalHistory = data.history || [];
    renderEvalHistory();
  } catch {
    state.evalHistory = [];
  }
}

function renderEvalHistory() {
  if (!els.evalSummary || state.evals) {
    return;
  }
  if (!state.evalHistory.length) {
    els.evalSummary.innerHTML = `<div class="empty-state compact">Eval history appears after the first run.</div>`;
    return;
  }
  const latest = state.evalHistory[0];
  els.evalSummary.innerHTML = `
    <div class="eval-score">${Number(latest.score || 0)}/100</div>
    <div class="eval-list"><span class="ok">${state.evalHistory.length} saved eval run(s)</span></div>
  `;
}

async function runBenchmarks() {
  els.benchmarkSummary.innerHTML = `<div class="mini-row muted">Benchmarking installed models...</div>`;
  try {
    const data = await getJson("/api/benchmarks");
    state.benchmarks = data;
    const rows = (data.benchmarks || []).slice(0, 4);
    if (!rows.length) {
      els.benchmarkSummary.innerHTML = `<div class="mini-row muted">No local models found. Pull one with Ollama.</div>`;
    } else {
      els.benchmarkSummary.innerHTML = rows
        .map(
          (item) => `
            <div class="mini-row">
              <strong>${escapeHtml(item.model)} · ${Number(item.score || 0)}/100</strong>
              <span>${escapeHtml(item.recommendation || "general chat")}</span>
            </div>
          `
        )
        .join("");
    }
    addTrail("eval", `Benchmarked ${rows.length} local model(s)`);
  } catch (error) {
    els.benchmarkSummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    addTrail("error", error.message);
  }
}

async function runSecurityScan() {
  els.securitySummary.innerHTML = `<div class="mini-row muted">Scanning selected context...</div>`;
  try {
    const data = await postJson("/api/security/scan", {
      paths: Array.from(state.selectedFiles),
      content: els.prompt.value
    });
    const findings = data.findings || [];
    els.securitySummary.innerHTML = findings.length
      ? findings
          .slice(0, 4)
          .map(
            (finding) => `
              <div class="mini-row">
                <strong>${escapeHtml(finding.severity || "risk")} · ${escapeHtml(finding.label)}</strong>
                <span>${escapeHtml(finding.path || "prompt")}${finding.line ? `:${Number(finding.line)}` : ""}</span>
              </div>
            `
          )
          .join("")
      : `<div class="mini-row"><strong>Security score ${Number(data.score || 0)}/100</strong><span>No suspicious instructions found.</span></div>`;
    addTrail("security", `Security scan ${data.risk} risk (${data.score}/100)`);
    renderTrustScore();
  } catch (error) {
    els.securitySummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
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
  const typed = recipe.structuredOutput ? ` Typed JSON: ${recipe.structuredOutput.schemaId || "custom schema"}.` : "";
  els.recipeHint.textContent = `${recipe.description}${typed}${tags}`;
}

async function applySelectedRecipe() {
  const recipe = selectedRecipe();
  if (!recipe) {
    return;
  }
  if (recipe.action && recipe.action.type === "audio-transcribe") {
    await runAudioTranscriptionRecipe(recipe);
    return;
  }

  els.prompt.value = recipe.prompt;
  resizePrompt();
  els.prompt.focus();
  addTrail("recipe", recipe.structuredOutput ? `Loaded typed recipe ${recipe.title}` : `Loaded ${recipe.title}`);
}

async function runAudioTranscriptionRecipe(recipe) {
  const audioPath = firstSelectedAudioPath();
  if (!audioPath) {
    els.workspaceStatus.textContent = "Select or attach an audio file first";
    addTrail("audio", "Audio recipe needs a selected audio file");
    els.attachmentInput.click();
    return;
  }

  els.useRecipe.disabled = true;
  els.workspaceStatus.textContent = "Transcribing audio";
  addTrail("audio", `Transcribing ${audioPath}`);
  try {
    const outputPath = `${recipe.action.outputDir || "transcripts"}/${safeBaseName(audioPath)}.md`;
    const result = await postJson(recipe.action.endpoint || "/api/audio/transcribe", {
      path: audioPath,
      outputPath,
      language: "auto"
    });
    state.selectedFiles.add(result.output.path);
    els.prompt.value = `${recipe.prompt}\n\nTranscript file: ${result.output.path}`;
    resizePrompt();
    await refreshFiles();
    await refreshReceipts();
    renderFiles();
    renderTrustScore();
    addTrail("audio", `Transcript saved ${result.output.path}`);
    if (result.receipt && result.receipt.path) {
      addTrail("receipt", `Audio receipt ${result.receipt.path}`);
    }
    els.prompt.focus();
  } catch (error) {
    addTrail("error", error.message);
  } finally {
    els.useRecipe.disabled = false;
    els.workspaceStatus.textContent = `${state.selectedFiles.size} selected`;
  }
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
    const provider = data.semanticProvider ? ` via ${data.semanticProvider}` : "";
    addTrail("search", `${state.searchResults.length} ${mode} result(s)${provider} for "${query}"`);
    await refreshMemoryCitations(query);
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
    const semanticLabel = result.semanticMode === "late-interaction" ? "best chunk" : result.semanticMode;
    const meta = [result.citation, semanticLabel, result.semanticProvider].filter(Boolean).join(" - ");
    item.innerHTML = `
      <span class="search-path">${escapeHtml(result.path)}</span>
      <span class="search-snippet">${escapeHtml(result.snippet || "No preview available")}</span>
      ${meta ? `<span class="search-provider">${escapeHtml(meta)}</span>` : ""}
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
    state.model = pickRecommendedModel(models);
    const meta = state.models.find((model) => model.name === state.model);
    if (meta && meta.scores) {
      addTrail("model", `Auto-selected ${state.model} (best for ${meta.recommendation || "general use"})`);
    }
  }
  els.modelSelect.value = state.model;
  renderModelScores();
}

function pickRecommendedModel(modelNames) {
  let best = modelNames[0];
  let bestScore = -1;
  for (const name of modelNames) {
    const meta = state.models.find((model) => model.name === name);
    const scores = meta && meta.scores;
    const total = scores
      ? Number(scores.toolUse || 0) + Number(scores.coding || 0) + Number(scores.planning || 0) + Number(scores.longContext || 0) + Number(scores.vision || 0)
      : -1;
    if (total > bestScore) {
      bestScore = total;
      best = name;
    }
  }
  return best;
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
    ["Ctx", selected.scores.longContext],
    ["Vision", selected.scores.vision]
  ];
  const vision = selected.capabilities && selected.capabilities.vision;
  const visionLabel = vision
    ? `${vision.supported ? "Vision ready" : Number(vision.confidence || 0) >= 0.7 ? "Vision unlikely" : "Vision unknown"} · ${Math.round(Number(vision.confidence || 0) * 100)}%`
    : "Vision not checked";
  els.modelScoreList.innerHTML = `
    <div class="model-recommendation">Best for ${escapeHtml(selected.recommendation || "general chat")}</div>
    <div class="model-recommendation subtle">${escapeHtml(visionLabel)}</div>
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

async function savePendingRun(record) {
  try {
    await fetch("/api/runs/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
  } catch {
    // best effort; resume is a convenience, not critical path
  }
}

async function clearPendingRun() {
  try {
    await fetch("/api/runs/pending/clear", { method: "POST" });
  } catch {
    // best effort
  }
}

async function checkPendingRun() {
  if (!els.resumeBanner) {
    return;
  }
  try {
    const data = await getJson("/api/runs/pending");
    state.pendingRun = data.pending || null;
    if (state.pendingRun && state.pendingRun.prompt) {
      const text = state.pendingRun.prompt;
      const preview = text.length > 80 ? `${text.slice(0, 80)}...` : text;
      els.resumeBannerText.textContent = `Interrupted run - resume: "${preview}"`;
      els.resumeBanner.hidden = false;
    }
  } catch {
    state.pendingRun = null;
  }
}

function resumePendingRun() {
  const run = state.pendingRun;
  if (!run) {
    return;
  }
  restorePendingRun(run, { submit: true, trailLabel: "Resumed interrupted run" });
}

function restorePendingRun(run, options = {}) {
  if (run.model && [...els.modelSelect.options].some((option) => option.value === run.model)) {
    state.model = run.model;
    els.modelSelect.value = run.model;
  }
  if (Array.isArray(run.selectedFiles)) {
    state.selectedFiles = new Set(run.selectedFiles.filter(Boolean));
    renderFiles();
    renderLocalSignals();
  }
  if (run.permissions) {
    state.permissions = {
      ...state.permissions,
      ...run.permissions
    };
    els.readPermission.checked = state.permissions.readFiles !== false;
    els.writePermission.checked = state.permissions.writeFiles === true;
    els.previewWritePermission.checked = state.permissions.previewWrites !== false;
  }
  els.prompt.value = run.prompt || "";
  state.editingMessageIndex = null;
  renderComposerMode();
  resizePrompt();
  if (els.resumeBanner) {
    els.resumeBanner.hidden = true;
  }
  addTrail("run", options.trailLabel || "Restored resumable run");
  if (options.submit) {
    els.composer.requestSubmit();
  } else {
    els.prompt.focus();
  }
}

async function resumeSelectedReceipt() {
  const path = state.selectedReceiptPath || state.receipts[0]?.path;
  if (!path) {
    return;
  }
  try {
    const data = await postJson("/api/runs/pending/from-receipt", { path });
    state.pendingRun = data.pending || null;
    if (state.pendingRun) {
      restorePendingRun(state.pendingRun, { trailLabel: `Restored receipt ${path}` });
    }
    if (data.warnings && data.warnings.length) {
      addTrail("warning", data.warnings[0]);
    }
  } catch (error) {
    addTrail("error", `Could not resume receipt: ${error.message}`);
  }
}

function dismissPendingRun() {
  els.resumeBanner.hidden = true;
  state.pendingRun = null;
  clearPendingRun();
}

function startNewChat(options = {}) {
  state.messages = [{
    role: "assistant",
    content: "New chat - ask me anything, or attach files to work on locally.",
    events: []
  }];
  state.activeConversationId = null;
  state.editingMessageIndex = null;
  setConversationMetadataInputs(null);
  renderComposerMode();
  renderComposerAssist();
  renderConversations();
  renderMessages();
  els.prompt.value = "";
  resizePrompt();
  els.prompt.focus();
  state.pendingRun = null;
  clearPendingRun();
  if (els.resumeBanner) {
    els.resumeBanner.hidden = true;
  }
  if (!options.silent) {
    addTrail("system", "Started a new chat");
  }
}

function openToolsDrawer(options = {}) {
  if (!els.toolsDrawer) {
    return;
  }
  els.toolsDrawer.hidden = false;
  if (els.toolsBackdrop) {
    els.toolsBackdrop.hidden = false;
  }
  refreshResources();
  refreshObservability();
  refreshPrivacy();
  refreshTeam();
  if (options && options.focusAccess) {
    setTimeout(() => focusElement(els.themeSelect || els.closeTools), 0);
  }
}

function formatGb(bytes) {
  return `${(Number(bytes || 0) / 1e9).toFixed(1)} GB`;
}

async function refreshResources() {
  if (!els.resourcesSummary) {
    return;
  }
  try {
    const [r, rt] = await Promise.all([getJson("/api/resources"), getJson("/api/runtime").catch(() => null)]);
    const rows = [];
    rows.push(["CPU", `${r.cpu.count} cores · load ${(r.cpu.loadAverage[0] || 0).toFixed(2)}`]);
    rows.push(["Memory", `${formatGb(r.memory.used)} / ${formatGb(r.memory.total)} used`]);
    if (r.disk) rows.push(["Disk", `${formatGb(r.disk.free)} free of ${formatGb(r.disk.total)}`]);
    rows.push(["Context", `${r.contextLength} tokens · keep-alive ${r.keepAlive}`]);
    rows.push(["Suggested quant", r.recommendedQuantization]);
    if (rt) {
      rows.push(["Backend", `${rt.activeBackend.title}${rt.bundledRuntime.installed ? " · bundled runtime ready" : ""}`]);
      if (rt.bundledRuntime.hardware) {
        const hw = rt.bundledRuntime.hardware;
        const offload = hw.offload.mode === "fixed" ? `${hw.offload.effectiveLayers} GPU layers` : `${hw.offload.mode} offload`;
        rows.push(["Bundled accel", `${hw.selected.label} · ${offload} · ${hw.threading.effective} threads`]);
      }
      if (rt.bundledRuntime.loading) {
        const load = rt.bundledRuntime.loading;
        rows.push(["Model load", `${load.quantization.value} · mmap ${load.mmap.enabled ? "on" : "off"} · batch ${load.batching.batchSize}`]);
      }
    }
    els.resourcesSummary.innerHTML = rows
      .map(([k, v]) => `<div class="mini-row"><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></div>`)
      .join("");
  } catch (error) {
    els.resourcesSummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
  }
}

async function refreshObservability() {
  if (!els.observabilitySummary || !els.traceTimeline) {
    return;
  }
  try {
    const data = await getJson("/api/observability");
    state.observability = data;
    renderObservability();
  } catch (error) {
    els.observabilitySummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    els.traceTimeline.innerHTML = "";
  }
}

function renderObservability() {
  if (!els.observabilitySummary || !els.traceTimeline) {
    return;
  }
  const data = state.observability;
  if (!data) {
    els.observabilitySummary.innerHTML = `<div class="mini-row muted">No observability data yet.</div>`;
    els.traceTimeline.innerHTML = "";
    return;
  }
  const totals = data.totals || {};
  const latency = data.latency || {};
  const active = Number(data.activeRuns || 0);
  const rows = [
    ["Runs", `${totals.runsCompleted || 0} ok · ${totals.runsFailed || 0} failed · ${active} active`],
    ["Tokens", `${totals.inputTokens || 0} in · ${totals.outputTokens || 0} out`],
    ["Latency", `${formatDuration(latency.p50Ms || 0)} p50 · ${formatDuration(latency.p95Ms || 0)} p95`],
    ["Errors", `${totals.errors || 0} classified`]
  ];
  els.observabilitySummary.innerHTML = rows
    .map(([k, v]) => `<div class="metric-tile"><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></div>`)
    .join("");

  const traces = Array.isArray(data.traces) ? data.traces.slice(0, 6) : [];
  if (!traces.length) {
    els.traceTimeline.innerHTML = `<div class="mini-row muted">No run traces yet.</div>`;
    return;
  }
  els.traceTimeline.innerHTML = traces.map((trace) => {
    const counters = trace.counters || {};
    const meta = trace.metadata || {};
    const parts = [
      trace.kind,
      trace.status,
      formatDuration(trace.durationMs || 0),
      `${counters.outputTokens || 0} tok`,
      `${counters.toolCalls || 0} tools`
    ].filter(Boolean);
    const title = meta.model || meta.recipeId || trace.id;
    const last = trace.lastEvent && trace.lastEvent.label ? ` · ${trace.lastEvent.label}` : "";
    return `
      <div class="mini-row trace-row" data-trace-id="${escapeHtml(trace.id)}">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(parts.join(" · "))}${escapeHtml(last)}</span>
      </div>
    `;
  }).join("");
}

async function refreshPrivacy() {
  if (!els.privacySummary || !els.privacyArtifacts) {
    return;
  }
  try {
    const data = await getJson("/api/privacy/dashboard");
    state.privacy = data;
    renderPrivacy();
  } catch (error) {
    els.privacySummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    els.privacyArtifacts.innerHTML = "";
  }
}

function renderPrivacy() {
  if (!els.privacySummary || !els.privacyArtifacts) {
    return;
  }
  const data = state.privacy;
  if (!data) {
    els.privacySummary.innerHTML = `<div class="mini-row muted">No privacy data yet.</div>`;
    els.privacyArtifacts.innerHTML = "";
    return;
  }
  const totals = data.totals || {};
  const settings = data.settings || {};
  const analytics = settings.localAnalytics || {};
  if (els.localAnalyticsToggle) {
    els.localAnalyticsToggle.checked = analytics.enabled === true;
  }
  const rows = [
    ["Managed files", `${totals.files || 0} file(s)`],
    ["Storage", formatBytes(totals.sizeBytes || 0)],
    ["Analytics", analytics.enabled ? "Local-only on" : "Off"],
    ["Network", "Disabled"]
  ];
  els.privacySummary.innerHTML = rows
    .map(([key, value]) => `<div class="metric-tile"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");

  const artifacts = Array.isArray(data.artifacts) ? data.artifacts.slice(0, 8) : [];
  els.privacyArtifacts.innerHTML = artifacts.length
    ? artifacts.map((artifact) => `
      <div class="mini-row">
        <strong>${escapeHtml(artifact.label)}</strong>
        <span>${Number(artifact.count || 0)} file(s) · ${formatBytes(artifact.sizeBytes || 0)} · ${Number(artifact.retentionDays || 0) || "keep"} day(s)</span>
      </div>
    `).join("")
    : `<div class="mini-row muted">No AgentTrail-managed local files yet.</div>`;
}

async function updateLocalAnalyticsSetting() {
  if (!els.localAnalyticsToggle) {
    return;
  }
  const enabled = els.localAnalyticsToggle.checked;
  await postJson("/api/privacy/settings", { localAnalytics: { enabled } });
  addTrail("privacy", `Local analytics ${enabled ? "enabled" : "disabled"}`);
  await Promise.all([refreshPrivacy(), refreshObservability()]);
}

async function applyPrivacyRetention() {
  if (!els.privacyArtifacts) {
    return;
  }
  els.privacyArtifacts.innerHTML = `<div class="mini-row muted">Applying retention policy...</div>`;
  const result = await postJson("/api/privacy/retention/apply", { dryRun: false });
  addTrail("privacy", `Retention removed ${result.deleted.length} file(s)`);
  await refreshPrivacy();
}

async function previewPrivacyWipe() {
  const result = await postJson("/api/privacy/wipe", { dryRun: true });
  addTrail("privacy", `Wipe preview found ${result.fileCount} file(s)`);
  if (els.privacyArtifacts) {
    els.privacyArtifacts.innerHTML = `
      <div class="mini-row">
        <strong>Wipe preview</strong>
        <span>${Number(result.fileCount || 0)} file(s) · ${formatBytes(result.bytes || 0)}</span>
      </div>
    `;
  }
}

async function wipePrivacyData() {
  if (!window.confirm("Wipe AgentTrail local data for this workspace?")) {
    return;
  }
  const result = await postJson("/api/privacy/wipe", { dryRun: false, confirm: "WIPE LOCAL DATA" });
  addTrail("privacy", `Wiped ${result.fileCount} local data file(s)`);
  await Promise.all([
    refreshPrivacy(),
    refreshObservability(),
    refreshConversations(),
    refreshReceipts(),
    refreshSessions(),
    refreshMemory()
  ]);
}

async function refreshTeam() {
  if (!els.teamSummary || !els.sharedReceipts) {
    return;
  }
  try {
    const query = state.teamUserId ? `?user=${encodeURIComponent(state.teamUserId)}` : "";
    const data = await getJson(`/api/team/status${query}`);
    state.team = data;
    state.teamUserId = data.activeUser?.id || state.teamUserId || "owner";
    renderTeam();
  } catch (error) {
    els.teamSummary.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
    els.sharedReceipts.innerHTML = "";
  }
}

function renderTeam() {
  if (!els.teamSummary || !els.sharedReceipts || !state.team) {
    return;
  }
  const team = state.team;
  if (els.teamUserSelect) {
    els.teamUserSelect.innerHTML = "";
    for (const user of team.users || []) {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = `${user.displayName} (${user.role})`;
      option.selected = user.id === team.activeUser?.id;
      els.teamUserSelect.appendChild(option);
    }
  }
  const caps = team.capabilities || {};
  const sso = team.sso || {};
  const sync = team.sync || {};
  const allowed = (team.rbac || []).filter((item) => item.allowed).length;
  els.teamSummary.innerHTML = [
    ["Role", `${team.activeUser?.role || "viewer"} · ${allowed} tool(s)`],
    ["Receipts", `${team.sharedReceipts?.count || 0} read-only shared`],
    ["Audit", caps.canExportAudit ? "export allowed" : "view only"],
    ["Sync", sync.enabled ? "enabled" : "explicit export required"],
    ["SSO", sso.configured ? `${sso.provider} hook configured` : "hook available"]
  ].map(([k, v]) => `<div class="mini-row"><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></div>`).join("");

  const receipts = team.sharedReceipts?.receipts || [];
  els.sharedReceipts.innerHTML = receipts.length
    ? receipts.slice(0, 4).map((receipt) => `
      <div class="mini-row">
        <strong>${escapeHtml(receipt.title || receipt.path)}</strong>
        <span>${escapeHtml(receipt.model || "receipt")} · ${escapeHtml(receipt.snippet || receipt.path)}</span>
      </div>
    `).join("")
    : `<div class="mini-row muted">No shared receipts yet.</div>`;
}

async function selectTeamUser() {
  const id = els.teamUserSelect?.value || "owner";
  try {
    const data = await postJson("/api/team/users/select", { userId: id, permissions: state.permissions });
    state.teamUserId = data.activeUser?.id || id;
    state.team = {
      ...(state.team || {}),
      activeUser: data.activeUser,
      capabilities: data.capabilities,
      rbac: data.rbac
    };
    const permissions = data.applied?.permissions || {};
    state.permissions = {
      readFiles: permissions.readFiles !== false,
      writeFiles: permissions.writeFiles === true,
      previewWrites: permissions.previewWrites !== false
    };
    els.readPermission.checked = state.permissions.readFiles;
    els.writePermission.checked = state.permissions.writeFiles;
    els.previewWritePermission.checked = state.permissions.previewWrites;
    renderTeam();
    addTrail("team", `Team user ${data.activeUser?.displayName || id}`);
    renderTrustScore();
  } catch (error) {
    addTrail("error", `Team user failed: ${error.message}`);
  }
}

async function exportAudit(format) {
  const user = encodeURIComponent(state.teamUserId || "owner");
  const endpoint = `/api/team/audit/export?format=${encodeURIComponent(format)}&user=${user}`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Audit export failed with HTTP ${response.status}`);
    }
    const text = await response.text();
    downloadText(`agenttrail-audit.${format === "csv" ? "csv" : "json"}`, text, format === "csv" ? "text/csv" : "application/json");
    addTrail("audit", `Exported audit ${format.toUpperCase()}`);
  } catch (error) {
    addTrail("error", `Audit export failed: ${error.message}`);
  }
}

async function exportTeamSync() {
  try {
    const data = await postJson("/api/team/sync/export", {
      enabled: true,
      userId: state.teamUserId || "owner"
    });
    addTrail("team", `Exported sync pack ${data.path}`);
    await refreshFiles();
    await refreshTeam();
  } catch (error) {
    addTrail("error", `Sync export failed: ${error.message}`);
  }
}

function closeToolsDrawer() {
  if (els.toolsDrawer) {
    els.toolsDrawer.hidden = true;
  }
  if (els.toolsBackdrop) {
    els.toolsBackdrop.hidden = true;
  }
}

async function refreshInstalledModels() {
  if (!els.installedModels) {
    return;
  }
  try {
    const data = await getJson("/api/models");
    renderInstalledModels(data);
  } catch (error) {
    els.installedModels.innerHTML = `<div class="mini-row muted">${escapeHtml(error.message)}</div>`;
  }
}

function renderInstalledModels(data) {
  if (!data.canManage) {
    els.installedModels.innerHTML = `<div class="mini-row muted">Model management is handled by ${escapeHtml((data.backend && data.backend.title) || "your backend")}.</div>`;
    if (els.pullModelButton) els.pullModelButton.disabled = true;
    if (els.pullModelName) els.pullModelName.disabled = true;
    return;
  }
  const models = data.models || [];
  if (!models.length) {
    els.installedModels.innerHTML = `<div class="mini-row muted">No local models yet. Pull one above.</div>`;
    return;
  }
  els.installedModels.innerHTML = "";
  for (const model of models.slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "mini-row model-row";
    const vision = model.capabilities && model.capabilities.vision;
    const visionText = vision && vision.supported ? " · vision" : "";
    row.innerHTML = `<div class="mr-meta"><strong>${escapeHtml(model.name)}</strong><span>${escapeHtml(model.recommendation || "general chat")}${visionText} · ${formatBytes(model.size || 0)}</span></div>`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "model-delete";
    remove.title = `Remove ${model.name}`;
    remove.textContent = "Remove";
    remove.addEventListener("click", () => deleteModel(model.name));
    row.appendChild(remove);
    els.installedModels.appendChild(row);
  }
}

async function pullModel() {
  const name = els.pullModelName.value.trim();
  if (!name) {
    return;
  }
  els.pullModelButton.disabled = true;
  els.pullModelStatus.textContent = `Pulling ${name}...`;
  addTrail("model", `Pulling ${name}`);
  try {
    const response = await fetch("/api/models/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (!response.ok || !response.body) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    await readEventStream(response.body, (eventName, data) => {
      if (eventName === "progress") {
        els.pullModelStatus.textContent = data.percent != null ? `${data.status} - ${data.percent}%` : (data.status || "pulling...");
      }
      if (eventName === "error") {
        els.pullModelStatus.textContent = data.message || "Pull failed.";
        addTrail("error", data.message || "Pull failed");
      }
      if (eventName === "done") {
        els.pullModelStatus.textContent = `Pulled ${data.name}.`;
        addTrail("model", `Pulled ${data.name}`);
      }
    });
    els.pullModelName.value = "";
    await refreshStatus();
    await refreshInstalledModels();
  } catch (error) {
    els.pullModelStatus.textContent = error.message;
    addTrail("error", error.message);
  } finally {
    els.pullModelButton.disabled = false;
  }
}

async function deleteModel(name) {
  if (!window.confirm(`Remove the local model "${name}"? This deletes it from disk.`)) {
    return;
  }
  els.pullModelStatus.textContent = `Removing ${name}...`;
  try {
    await postJson("/api/models/delete", { name });
    addTrail("model", `Removed ${name}`);
    els.pullModelStatus.textContent = `Removed ${name}.`;
    await refreshStatus();
    await refreshInstalledModels();
  } catch (error) {
    els.pullModelStatus.textContent = error.message;
    addTrail("error", error.message);
  }
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

function bindComposerAttachmentIntake() {
  const dropTargets = [els.composerWrap, els.messages].filter(Boolean);
  if (!dropTargets.length) {
    return;
  }

  for (const dropTarget of dropTargets) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropTarget.addEventListener(eventName, (event) => {
        if (!hasTransferFiles(event.dataTransfer)) {
          return;
        }
        event.preventDefault();
        if (eventName === "dragenter") {
          state.attachmentDragDepth += 1;
        }
        setAttachmentDragActive(true);
      });
    });

    dropTarget.addEventListener("dragleave", (event) => {
      if (!hasTransferFiles(event.dataTransfer)) {
        return;
      }
      state.attachmentDragDepth = Math.max(0, state.attachmentDragDepth - 1);
      if (!state.attachmentDragDepth) {
        setAttachmentDragActive(false);
      }
    });

    dropTarget.addEventListener("drop", async (event) => {
      if (!hasTransferFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      state.attachmentDragDepth = 0;
      setAttachmentDragActive(false);
      await attachFiles(Array.from(event.dataTransfer.files || []), "drop");
    });
  }

  els.prompt.addEventListener("paste", async (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) {
      return;
    }
    event.preventDefault();
    await attachFiles(files, "paste");
  });
}

function hasTransferFiles(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes("Files");
}

function setAttachmentDragActive(active) {
  if (els.composerWrap) {
    els.composerWrap.classList.toggle("drag-active", active);
  }
  if (els.dropHint) {
    els.dropHint.hidden = !active;
  }
  if (active) {
    els.workspaceStatus.textContent = "Drop onto chat to attach locally";
  } else if (!state.busy) {
    els.workspaceStatus.textContent = state.selectedFiles.size ? `${state.selectedFiles.size} selected` : `${state.files.length} workspace file(s)`;
  }
}

async function attachSelectedFiles() {
  const files = Array.from(els.attachmentInput.files || []);
  els.attachmentInput.value = "";
  await attachFiles(files, "picker");
}

async function attachFiles(files, source = "picker") {
  if (!files.length) {
    return;
  }

  const limitedFiles = files.slice(0, MAX_ATTACHMENT_COUNT);
  const skipped = files.length > MAX_ATTACHMENT_COUNT
    ? files.slice(MAX_ATTACHMENT_COUNT).map((file, index) => ({
        name: attachmentDisplayName(file, source, MAX_ATTACHMENT_COUNT + index),
        error: `Only ${MAX_ATTACHMENT_COUNT} attachments can be saved at once`
      }))
    : [];

  state.attachments = limitedFiles.map((file, index) => ({ name: attachmentDisplayName(file, source, index), status: "reading", size: file.size }));
  renderAttachments();
  const payload = [];
  for (const [index, file] of limitedFiles.entries()) {
    const displayName = attachmentDisplayName(file, source, index);
    const maxBytes = attachmentMaxBytes(file);
    if (file.size > maxBytes) {
      skipped.push({ name: displayName, error: `Too large for local context (${formatBytes(file.size)} > ${formatBytes(maxBytes)})` });
      continue;
    }
    try {
      if (isTextAttachment(file)) {
        payload.push({
          name: displayName,
          type: file.type || "text/plain",
          encoding: "text",
          content: await file.text()
        });
      } else {
        payload.push({
          name: displayName,
          type: file.type || "application/octet-stream",
          encoding: "base64",
          content: arrayBufferToBase64(await file.arrayBuffer())
        });
      }
    } catch (error) {
      skipped.push({ name: file.name, error: error.message });
    }
  }

  if (!payload.length) {
    state.attachments = skipped.map((item) => ({ ...item, status: "skipped" }));
    renderAttachments();
    addTrail("attachment", "No attachment saved");
    return { ok: false, saved: [], skipped };
  }

  state.attachments = payload.map((file) => ({ name: file.name, status: "saving" })).concat(skipped.map((item) => ({ ...item, status: "skipped" })));
  renderAttachments();
  try {
    const result = await postJson("/api/attachments", { files: payload });
    for (const item of result.saved || []) {
      state.selectedFiles.add(item.contextPath || item.path);
      if (item.visionPath) {
        state.selectedFiles.add(item.visionPath);
      }
      if (item.audioPath) {
        state.selectedFiles.add(item.audioPath);
      }
    }
    state.attachments = [
      ...(result.saved || []).map((item) => ({
        name: item.originalName || item.path,
        path: [item.contextPath || item.path, item.visionPath, item.audioPath].filter(Boolean).join(" + "),
        status: "saved",
        binary: item.encoding === "base64"
      })),
      ...(result.skipped || skipped).map((item) => ({ ...item, status: "skipped" }))
    ];
    await refreshFiles();
    renderAttachments();
    els.workspaceStatus.textContent = `${state.selectedFiles.size} selected`;
    addTrail("attachment", `${(result.saved || []).length} ${attachmentSourceLabel(source)} saved`);
    renderLocalSignals();
    renderTrustScore();
    if (state.pendingScreenshotAction) {
      if (hasSelectedVisionFile()) {
        await generateScreenshotActionPlan({ fromAttachment: true });
      } else {
        state.pendingScreenshotAction = false;
        addTrail("warning", "No screenshot image was attached");
      }
    }
    return result;
  } catch (error) {
    state.attachments = payload.map((file) => ({ name: file.name, status: "error", error: error.message })).concat(skipped.map((item) => ({ ...item, status: "skipped" })));
    renderAttachments();
    addTrail("error", error.message);
    return { ok: false, saved: [], skipped, error: error.message };
  }
}

function attachmentDisplayName(file, source = "picker", index = 0) {
  if (file.name && file.name.trim()) {
    return file.name;
  }
  const extension = imageExtensionForType(file.type) || "png";
  return `${source === "paste" ? "pasted" : "dropped"}-image-${index + 1}.${extension}`;
}

function attachmentMaxBytes(file) {
  if (isImageAttachment(file)) return IMAGE_ATTACHMENT_MAX_BYTES;
  if (isAudioAttachment(file)) return AUDIO_ATTACHMENT_MAX_BYTES;
  return TEXT_ATTACHMENT_MAX_BYTES;
}

function isImageAttachment(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"].some((extension) => name.endsWith(extension));
}

function isAudioAttachment(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return type.startsWith("audio/") || type === "video/webm" || type === "video/mp4" || [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".webm", ".mp4", ".mov"].some((extension) => name.endsWith(extension));
}

function imageExtensionForType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("jpeg")) return "jpg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("tiff")) return "tiff";
  if (normalized.includes("bmp")) return "bmp";
  if (normalized.includes("webp")) return "webp";
  return "";
}

function attachmentSourceLabel(source) {
  if (source === "drop") return "dropped file(s)";
  if (source === "paste") return "pasted image(s)";
  if (source === "voice") return "voice prompt";
  return "attachment(s)";
}

async function toggleVoicePrompt() {
  if (state.voiceRecording.active) {
    stopVoicePromptRecording();
  } else {
    await startVoicePromptRecording();
  }
}

async function startVoicePromptRecording() {
  if (state.busy || state.planning) {
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
    addTrail("error", "Browser voice recording is not available");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = preferredAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    state.voiceRecording = {
      active: true,
      recorder,
      chunks: [],
      stream,
      startedAt: Date.now()
    };
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size) {
        state.voiceRecording.chunks.push(event.data);
      }
    });
    recorder.addEventListener("stop", () => {
      finishVoicePromptRecording(recorder, state.voiceRecording.chunks.slice(), stream);
    }, { once: true });
    recorder.start();
    setVoiceRecordingUi(true);
    els.workspaceStatus.textContent = "Recording voice prompt";
    addTrail("audio", "Voice prompt recording started");
  } catch (error) {
    addTrail("error", `Voice recording failed: ${error.message}`);
    setVoiceRecordingUi(false);
  }
}

function stopVoicePromptRecording() {
  const recorder = state.voiceRecording.recorder;
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
}

async function finishVoicePromptRecording(recorder, chunks, stream) {
  stream.getTracks().forEach((track) => track.stop());
  state.voiceRecording = { active: false, recorder: null, chunks: [], stream: null, startedAt: 0 };
  setVoiceRecordingUi(false);
  if (!chunks.length) {
    addTrail("warning", "Voice prompt had no audio");
    return;
  }
  const type = recorder.mimeType || preferredAudioMimeType() || "audio/webm";
  const blob = new Blob(chunks, { type });
  if (blob.size > AUDIO_ATTACHMENT_MAX_BYTES) {
    addTrail("error", `Voice prompt is too large (${formatBytes(blob.size)})`);
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = new File([blob], `voice-prompt-${stamp}.${audioExtensionForType(type)}`, { type });
  els.workspaceStatus.textContent = "Saving voice prompt";
  const attached = await attachFiles([file], "voice");
  const savedAudio = (attached.saved || []).find((item) => item.audioPath);
  if (savedAudio && savedAudio.audioPath) {
    await transcribeVoicePrompt(savedAudio.audioPath);
  }
}

async function transcribeVoicePrompt(audioPath) {
  els.workspaceStatus.textContent = "Transcribing voice prompt";
  addTrail("audio", "Transcribing voice prompt locally");
  try {
    const outputPath = `transcripts/${safeBaseName(audioPath)}.md`;
    const result = await postJson("/api/audio/transcribe", {
      path: audioPath,
      outputPath,
      language: "auto"
    });
    state.selectedFiles.add(result.output.path);
    const transcript = await getJson(`/api/files/content?path=${encodeURIComponent(result.output.path)}`);
    els.prompt.value = appendPromptText(els.prompt.value, extractTranscriptText(transcript.content));
    resizePrompt();
    await refreshFiles();
    await refreshReceipts();
    renderFiles();
    renderTrustScore();
    els.prompt.focus();
    addTrail("audio", `Voice transcript ready ${result.output.path}`);
  } catch (error) {
    addTrail("error", error.message);
  }
}

function setVoiceRecordingUi(active) {
  if (!els.voicePrompt) return;
  els.voicePrompt.classList.toggle("recording", active);
  els.voicePrompt.setAttribute("aria-label", active ? "Stop voice recording" : "Record voice prompt");
  els.voicePrompt.title = active ? "Stop voice recording" : "Record voice prompt";
  updateSendState();
}

function preferredAudioMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/wav"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || "";
}

function audioExtensionForType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("ogg")) return "ogg";
  return "webm";
}

function appendPromptText(current, next) {
  const cleaned = String(next || "").trim();
  if (!cleaned) return current;
  return current && current.trim() ? `${current.trim()}\n\n${cleaned}` : cleaned;
}

function extractTranscriptText(markdown) {
  const text = String(markdown || "");
  const marker = "## Transcript";
  const index = text.indexOf(marker);
  return index === -1 ? text : text.slice(index + marker.length).trim();
}

function hasSelectedVisionFile() {
  return Array.from(state.selectedFiles || []).some((filePath) => isVisionPath(filePath));
}

function isVisionPath(filePath) {
  const path = String(filePath || "").toLowerCase();
  return [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"].some((extension) => path.endsWith(extension));
}

function firstSelectedAudioPath() {
  return Array.from(state.selectedFiles || []).find((filePath) => isAudioPath(filePath)) || "";
}

function isAudioPath(filePath) {
  const value = String(filePath || "").toLowerCase();
  return [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".webm", ".mp4", ".mov"].some((extension) => value.endsWith(extension));
}

function safeBaseName(filePath) {
  return String(filePath || "audio")
    .split("/")
    .pop()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "audio";
}

function renderAttachments() {
  if (!els.attachmentQueue) {
    return;
  }
  els.attachmentQueue.innerHTML = "";
  for (const attachment of state.attachments.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = `attachment-pill${attachment.status === "error" || attachment.status === "skipped" ? " error" : ""}`;
    const label = attachment.status === "saved"
      ? `${attachment.binary ? "Saved note for " : "Attached "}${attachment.name}`
      : `${attachment.name}: ${attachment.error || attachment.status}`;
    item.textContent = label;
    item.title = attachment.path || attachment.error || attachment.name;
    els.attachmentQueue.appendChild(item);
  }
}

function updateStepBudget() {
  const raw = els.stepBudgetSelect.value || "3";
  const override = raw.startsWith("override:");
  const maxSteps = Number.parseInt(raw.replace("override:", ""), 10) || 3;
  state.stepBudget = { maxSteps, override };
  addTrail("budget", `${override ? "Deep override" : "Step budget"} set to ${maxSteps}`);
}

function stopCurrentRun() {
  if (!state.busy || !state.chatAbortController || state.cancelRequested) {
    return;
  }
  state.cancelRequested = true;
  els.workspaceStatus.textContent = "Stopping run";
  addTrail("run", "Stop requested");
  state.chatAbortController.abort();
  updateSendState();
}

async function generatePlan() {
  if (state.busy || state.planning) {
    return;
  }
  const content = els.prompt.value.trim();
  if (!content) {
    return;
  }
  selectMentionedFiles(content);

  const requestMessages = [...state.messages, { role: "user", content }]
    .filter((message) => message.content && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({ role: message.role, content: message.content }));

  state.planning = true;
  updateSendState();
  els.workspaceStatus.textContent = "Planning run";
  addTrail("plan", "Requested editable plan");

  try {
    const data = await postJson("/api/agent/plan", {
      model: state.model,
      messages: requestMessages,
      selectedFiles: Array.from(state.selectedFiles),
      permissions: state.permissions,
      securityMode: state.securityMode,
      stepBudget: state.stepBudget
    });
    state.pendingPlan = data.output;
    state.approvedPlan = null;
    renderPlanPanel(data.output);
    addTrail("plan", `${(data.output.steps || []).length} step plan ready`);
  } catch (error) {
    addTrail("error", error.message);
  } finally {
    state.planning = false;
    els.workspaceStatus.textContent = `${state.files.length} workspace file(s)`;
    updateSendState();
  }
}

async function generateScreenshotActionPlan({ fromAttachment = false } = {}) {
  if (state.busy || state.planning) {
    return;
  }
  if (!hasSelectedVisionFile()) {
    state.pendingScreenshotAction = true;
    els.workspaceStatus.textContent = "Attach or paste a screenshot";
    addTrail("vision", "Waiting for a screenshot image");
    if (!fromAttachment) {
      els.attachmentInput.click();
    }
    updateSendState();
    return;
  }

  state.pendingScreenshotAction = false;
  els.prompt.value = screenshotToActionPrompt(els.prompt.value.trim());
  resizePrompt();
  addTrail("vision", "Requested screenshot-to-action plan");
  await generatePlan();
}

function screenshotToActionPrompt(existingPrompt = "") {
  const base = [
    "Look at the attached screenshot.",
    "Describe the visible UI or state, infer what the user is trying to do, identify the likely problem or opportunity, and create a concrete action plan.",
    "If this is an app or bug screenshot, include what to inspect first, likely files or systems to check, and safe next steps before any edit."
  ].join(" ");
  return existingPrompt ? `${base}\n\nUser goal:\n${existingPrompt}` : base;
}

function renderPlanPanel(plan) {
  if (!plan) {
    els.planPanel.hidden = true;
    els.planText.value = "";
    return;
  }
  els.planText.value = formatPlanForEdit(plan);
  els.planPanel.hidden = false;
}

function formatPlanForEdit(plan) {
  const rows = [];
  if (plan.summary) {
    rows.push(`Summary: ${plan.summary}`);
  }
  for (const [index, step] of (plan.steps || []).entries()) {
    const details = [
      step.intent ? `intent ${step.intent}` : "",
      step.risk ? `risk ${step.risk}` : "",
      step.tool ? `tool ${step.tool}` : "",
      step.needsApproval ? "approval required" : ""
    ].filter(Boolean).join(", ");
    rows.push(`${index + 1}. ${step.title}${details ? ` (${details})` : ""}`);
  }
  if (Array.isArray(plan.warnings) && plan.warnings.length) {
    rows.push("");
    rows.push("Warnings:");
    for (const warning of plan.warnings) {
      rows.push(`- ${warning}`);
    }
  }
  return rows.join("\n").trim();
}

function approvePlanAndRun() {
  const editedText = els.planText.value.trim();
  if (!editedText || state.busy) {
    return;
  }
  state.approvedPlan = {
    ...(state.pendingPlan || {}),
    editedText,
    approvedAt: new Date().toISOString()
  };
  els.planPanel.hidden = true;
  addTrail("plan", "Approved plan");
  els.composer.requestSubmit();
}

function discardPlan() {
  state.pendingPlan = null;
  state.approvedPlan = null;
  renderPlanPanel(null);
  addTrail("plan", "Discarded plan");
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

  const editIndex = Number.isInteger(state.editingMessageIndex) ? state.editingMessageIndex : null;
  await runChatTurn({
    content,
    historyMessages: editIndex === null ? state.messages : state.messages.slice(0, editIndex),
    replaceFromIndex: editIndex,
    trailLabel: editIndex === null ? null : "Edited message and reran",
    clearPrompt: true
  });
}

async function runChatTurn({ content, historyMessages, replaceFromIndex = null, trailLabel = null, clearPrompt = false, userEvents = [] }) {
  if (state.busy) {
    return;
  }

  selectMentionedFiles(content);
  const userMessage = { role: "user", content, events: [] };
  if (Array.isArray(userEvents) && userEvents.length) {
    userMessage.events = userEvents;
  }
  const assistantMessage = { role: "assistant", content: "", events: [] };
  const approvedPlan = state.approvedPlan;
  const requestMessages = [...(historyMessages || []), userMessage]
    .filter((message) => message.content && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({ role: message.role, content: message.content }));

  if (Number.isInteger(replaceFromIndex) && replaceFromIndex >= 0) {
    state.messages.splice(replaceFromIndex, state.messages.length - replaceFromIndex, userMessage, assistantMessage);
  } else {
    state.messages.push(userMessage, assistantMessage);
  }
  state.busy = true;
  state.cancelRequested = false;
  state.editingMessageIndex = null;
  state.chatAbortController = new AbortController();
  renderComposerMode();
  if (els.resumeBanner) {
    els.resumeBanner.hidden = true;
  }
  let runCompleted = false;
  savePendingRun({
    prompt: content,
    model: state.model,
    selectedFiles: Array.from(state.selectedFiles),
    permissions: state.permissions,
    securityMode: state.securityMode
  });
  const suspicious = detectSuspiciousPrompt(content);
  if (suspicious.length) {
    addTrail("security", `Suspicious instruction flagged: ${suspicious[0]}`);
  }
  addTrail("chat", trailLabel || `Sent prompt with ${state.selectedFiles.size} file(s)`);
  if (clearPrompt) {
    els.prompt.value = "";
  }
  resizePrompt();
  renderComposerAssist();
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
        securityMode: state.securityMode,
        teamUserId: state.teamUserId,
        approvedPlan,
        stepBudget: state.stepBudget
      }),
      signal: state.chatAbortController.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`Chat request failed with HTTP ${response.status}`);
    }

    await readEventStream(response.body, (eventName, data) => {
      if (eventName === "trace") {
        state.activeTraceId = data.id || null;
        const label = data.id ? `Trace ${data.id.slice(0, 18)}` : "Run trace started";
        assistantMessage.events.push({
          type: "trace",
          label
        });
        addTrail("trace", label);
      }
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
      if (eventName === "budget") {
        if (data.exhausted) {
          assistantMessage.events.push({
            type: "error",
            label: `Step budget reached (${data.maxSteps})`
          });
          addTrail("budget", `Step budget reached (${data.maxSteps})`);
        } else {
          addTrail("budget", `Run budget ${data.maxSteps} step(s)${data.override ? " with override" : ""}`);
        }
      }
      if (eventName === "vision") {
        const vision = data.model && data.model.vision;
        const label = `${data.count || 0} image(s) attached · ${vision && vision.supported ? "vision-ready model" : "vision uncertain"}`;
        assistantMessage.events.push({
          type: vision && vision.supported ? "vision" : "error",
          label
        });
        addTrail("vision", label);
        for (const warning of data.warnings || []) {
          addTrail("warning", warning);
        }
      }
      if (eventName === "reflection") {
        const label = `Self-check ${data.score}/100 · ${data.verdict}`;
        assistantMessage.events.push({
          type: data.verdict === "fail" ? "error" : "reflection",
          label
        });
        addTrail("reflection", label);
      }
      if (eventName === "guardrail") {
        assistantMessage.events.push({
          type: "error",
          label: data.message || "Run guardrail stopped the agent"
        });
        addTrail("guardrail", data.reason || "Run guardrail");
      }
      if (eventName === "memory-suggestions") {
        state.memorySuggestions = data.suggestions || [];
        renderMemorySuggestions();
        const label = `${state.memorySuggestions.length} memory suggestion(s)`;
        assistantMessage.events.push({
          type: "memory",
          label
        });
        addTrail("memory", label);
      }
      if (eventName === "cancelled") {
        assistantMessage.events.push({
          type: "error",
          label: data.message || "Run stopped"
        });
        addTrail("run", data.message || "Run stopped");
      }
      if (eventName === "error") {
        const detail = data.code && data.action ? `${data.code}: ${data.action}` : data.message || "The agent hit an error";
        assistantMessage.events.push({
          type: "error",
          label: detail
        });
        addTrail("error", detail);
      }
      if (eventName === "done") {
        const label = data.ok ? "Run completed with accounting" : `Run ended: ${data.reason || "not ok"}`;
        assistantMessage.events.push({
          type: data.ok ? "trace" : "error",
          label
        });
        addTrail("trace", label);
      }
      renderLocalSignals();
      renderTrustScore();
      renderMessages();
    });
    runCompleted = !state.cancelRequested;
  } catch (error) {
    if (state.cancelRequested || error.name === "AbortError") {
      assistantMessage.events.push({ type: "error", label: "Run stopped by user" });
      addTrail("run", "Run stopped");
    } else {
      assistantMessage.events.push({ type: "error", label: error.message });
      addTrail("error", error.message);
    }
    renderMessages();
  } finally {
    state.busy = false;
    state.cancelRequested = false;
    state.chatAbortController = null;
    state.approvedPlan = null;
    state.pendingPlan = null;
    renderPlanPanel(null);
    els.workspaceStatus.textContent = `${state.files.length} workspace file(s)`;
    updateSendState();
    renderMessages();
    if (runCompleted) {
      clearPendingRun();
      state.pendingRun = null;
    }
    try {
      await saveCurrentConversation({ silent: true });
    } catch (error) {
      addTrail("error", `Could not save chat: ${error.message}`);
    }
    await refreshFiles();
    await refreshReceipts();
    await refreshObservability();
  }
}

async function regenerateAssistantResponse(index) {
  if (state.busy) {
    return;
  }
  const assistantIndex = Number.isInteger(index) ? index : state.messages.length - 1;
  const userIndex = previousUserMessageIndex(assistantIndex);
  if (userIndex < 0) {
    return;
  }
  const userMessage = state.messages[userIndex];
  await runChatTurn({
    content: userMessage.content,
    historyMessages: state.messages.slice(0, userIndex),
    replaceFromIndex: userIndex,
    trailLabel: "Regenerated assistant response",
    userEvents: userMessage.events || []
  });
}

async function continueStoppedRun(index) {
  if (state.busy) {
    return;
  }
  const assistantIndex = Number.isInteger(index) ? index : state.messages.length - 1;
  const assistantMessage = state.messages[assistantIndex];
  if (!assistantMessage || assistantMessage.role !== "assistant") {
    return;
  }
  const prompt = [
    "Continue from the partial answer above.",
    "Do not repeat text that is already present unless needed for continuity.",
    "If tools or context are needed, continue safely with the same local workspace constraints."
  ].join(" ");
  await runChatTurn({
    content: prompt,
    historyMessages: state.messages.slice(0, assistantIndex + 1),
    trailLabel: "Continued stopped generation"
  });
}

function editUserMessage(index) {
  if (state.busy || !state.messages[index] || state.messages[index].role !== "user") {
    return;
  }
  state.editingMessageIndex = index;
  els.prompt.value = state.messages[index].content || "";
  resizePrompt();
  renderComposerMode();
  els.prompt.focus();
  addTrail("composer", "Editing previous user message");
}

function cancelMessageEdit() {
  state.editingMessageIndex = null;
  renderComposerMode();
  addTrail("composer", "Cancelled message edit");
}

function renderComposerMode() {
  if (!els.composerMode) {
    return;
  }
  if (!Number.isInteger(state.editingMessageIndex)) {
    els.composerMode.hidden = true;
    els.composerMode.innerHTML = "";
    return;
  }
  els.composerMode.hidden = false;
  els.composerMode.innerHTML = `
    <span>Editing message ${state.editingMessageIndex + 1}; send will rerun from here.</span>
    <button type="button" id="cancelMessageEdit">Cancel</button>`;
  const button = document.querySelector("#cancelMessageEdit");
  if (button) button.addEventListener("click", cancelMessageEdit);
}

function previousUserMessageIndex(beforeIndex) {
  for (let index = Math.min(beforeIndex - 1, state.messages.length - 1); index >= 0; index -= 1) {
    if (state.messages[index] && state.messages[index].role === "user") {
      return index;
    }
  }
  return -1;
}

function isStoppedAssistantMessage(message) {
  return message && message.role === "assistant" && Array.isArray(message.events) && message.events.some((event) => String(event.label || "").toLowerCase().includes("run stopped"));
}

function isTextAttachment(file) {
  const name = file.name.toLowerCase();
  if ((file.type || "").startsWith("text/")) {
    return true;
  }
  return [
    ".txt", ".md", ".markdown", ".json", ".js", ".ts", ".tsx", ".jsx", ".css", ".html", ".xml", ".csv", ".yml", ".yaml", ".toml", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".swift", ".sh", ".zsh", ".sql", ".log"
  ].some((extension) => name.endsWith(extension));
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
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
  const resumePrompt = latestUiUserPrompt() || els.prompt.value.trim();
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
    `Resume prompt: ${resumePrompt ? resumePrompt.replace(/\s+/g, " ").slice(0, 240) : "none"}`,
    "",
    "## Resume Prompt",
    "",
    resumePrompt || "No prompt captured.",
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
    const session = await postJson("/api/sessions", {
      title: "AgentTrail replay session",
      model: state.model,
      messages: state.messages,
      selectedFiles: Array.from(state.selectedFiles),
      permissions: state.permissions,
      trustScore: els.trustScore.textContent,
      trail: state.trail,
      pendingPreviews: state.pendingPreviews
    });
    addTrail("replay", `Saved replay session ${session.path}`);
    await refreshReceipts();
    await refreshSessions();
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
    },
    {
      ok: state.searchIndex && (state.searchIndex.exists || state.searchIndex.ok),
      text: state.searchIndex && (state.searchIndex.exists || state.searchIndex.ok) ? "Semantic index ready" : "Build semantic index"
    },
    {
      ok: state.sessions.length > 0,
      text: state.sessions.length ? `${state.sessions.length} replay session(s)` : "Save a replay session"
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
    const text = [
      receipt.path,
      receipt.snippet || "",
      receipt.searchText || "",
      receipt.model || "",
      receipt.exportedAt || "",
      (receipt.selectedFiles || []).join(" "),
      (receipt.fileMentions || []).join(" "),
      (receipt.tools || []).join(" "),
      (receipt.eventTypes || []).join(" ")
    ].join(" ").toLowerCase();
    return !filter || text.includes(filter);
  });

  if (!receipts.length) {
    els.receiptTimeline.innerHTML = `<div class="empty-state compact">No receipts match this filter.</div>`;
    if (els.resumeReceipt) {
      els.resumeReceipt.disabled = true;
    }
    return;
  }

  if (!state.selectedReceiptPath || !receipts.some((receipt) => receipt.path === state.selectedReceiptPath)) {
    state.selectedReceiptPath = receipts[0].path;
  }
  if (els.resumeReceipt) {
    els.resumeReceipt.disabled = false;
  }

  els.receiptTimeline.innerHTML = receipts
    .slice(0, 8)
    .map(
      (receipt) => {
        const meta = receiptMetaLine(receipt);
        const tags = receiptSearchTags(receipt);
        return `
        <button type="button" class="receipt-row" data-path="${escapeHtml(receipt.path)}">
          <strong>${escapeHtml(receipt.path.replace(/^receipts\//, ""))}</strong>
          <span>${escapeHtml(receipt.snippet || formatBytes(receipt.size))}</span>
          ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
          ${tags ? `<em>${escapeHtml(tags)}</em>` : ""}
        </button>
      `;
      }
    )
    .join("");

  els.receiptTimeline.querySelectorAll(".receipt-row").forEach((row) => {
    row.addEventListener("click", () => {
      const path = row.dataset.path;
      if (path) {
        state.selectedReceiptPath = path;
        if (els.resumeReceipt) {
          els.resumeReceipt.disabled = false;
        }
        state.selectedFiles.add(path);
        renderFiles();
        addTrail("receipt", `Selected ${path}`);
        renderTrustScore();
      }
    });
  });
}

function receiptMetaLine(receipt) {
  const parts = [];
  if (receipt.model) parts.push(`model ${receipt.model}`);
  if (receipt.tools && receipt.tools.length) parts.push(`tools ${receipt.tools.slice(0, 3).join(", ")}`);
  if (receipt.selectedFiles && receipt.selectedFiles.length) parts.push(`files ${receipt.selectedFiles.slice(0, 2).join(", ")}`);
  if (receipt.exportedAt) parts.push(shortDate(receipt.exportedAt));
  return parts.join(" | ");
}

function receiptSearchTags(receipt) {
  const values = [
    ...(receipt.eventTypes || []),
    ...(receipt.fileMentions || []).slice(0, 2)
  ].filter(Boolean);
  return values.slice(0, 5).join(" # ");
}

function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value).slice(0, 16) : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderTrustScore() {
  const checks = [
    { ok: state.ollamaAvailable, label: "Local model connected" },
    { ok: state.trail.some((item) => item.type === "search"), label: "Evidence searched" },
    { ok: state.trail.some((item) => item.type === "preview") || state.pendingPreviews.length > 0, label: "Writes previewed" },
    { ok: state.receipts.length > 0, label: "Receipt saved" },
    { ok: state.securityMode, label: "Hardening mode" },
    { ok: state.memoryLoaded, label: "Project memory" },
    { ok: state.searchIndex && (state.searchIndex.exists || state.searchIndex.ok), label: "Semantic index" },
    { ok: state.sessions.length > 0, label: "Replay saved" },
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
  const resumePrompt = latestUiUserPrompt() || els.prompt.value.trim();
  const rows = state.trail
    .slice()
    .reverse()
    .map((item) => `- ${item.time} [${item.type}] ${item.label}`)
    .join("\n");
  const diffs = state.pendingPreviews
    .map((item) => `## ${item.preview.path}\n\n\`\`\`diff\n${item.preview.diff || ""}\n\`\`\``)
    .join("\n\n");
  const citations = Array.from(els.memoryCitations?.querySelectorAll(".mini-row") || [])
    .map((row) => `- ${row.textContent.trim().replace(/\s+/g, " ")}`)
    .join("\n");
  const markdown = [
    "# AgentTrail Shareable Report",
    "",
    `Exported: ${new Date().toISOString()}`,
    `Trust score: ${trustScore}/100`,
    `Model: ${state.model || "not selected"}`,
    `Search index: ${state.searchIndex?.provider || "not built"}`,
    `Selected files: ${Array.from(state.selectedFiles).join(", ") || "none"}`,
    `Resume prompt: ${resumePrompt ? resumePrompt.replace(/\s+/g, " ").slice(0, 240) : "none"}`,
    "",
    "## Resume Prompt",
    "",
    resumePrompt || "No prompt captured.",
    "",
    "## Trail",
    "",
    rows || "- No events",
    "",
    "## Memory Citations",
    "",
    citations || "- No memory citations captured.",
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
    downloadText("agenttrail-receipt.html", buildShareableHtml({
      trustScore,
      model: state.model || "not selected",
      provider: state.searchIndex?.provider || "not built",
      selectedFiles: Array.from(state.selectedFiles),
      trail: state.trail,
      citations: Array.from(els.memoryCitations?.querySelectorAll(".mini-row") || [])
        .map((row) => row.textContent.trim().replace(/\s+/g, " ")),
      previews: state.pendingPreviews.map((item) => ({
        path: item.preview.path,
        diff: item.preview.diff || "",
        stats: item.preview.stats || { added: 0, removed: 0 },
        applied: Boolean(item.applied)
      }))
    }), "text/html");
    addTrail("report", `Saved report ${saved.markdown.path}; exported shareable HTML receipt`);
    await refreshFiles();
  } catch (error) {
    addTrail("error", error.message);
  }
}

function colorDiffLines(diff) {
  return String(diff || "")
    .split("\n")
    .map((line) => {
      const safe = escapeHtml(line);
      if (line.startsWith("+")) {
        return `<span class="add">${safe}</span>`;
      }
      if (line.startsWith("-")) {
        return `<span class="del">${safe}</span>`;
      }
      return safe;
    })
    .join("\n");
}

function buildShareableHtml(data) {
  const dotColor = (type) => {
    if (type === "tool") return "#c2933b";
    if (type === "error" || type === "warning") return "#b4543a";
    if (type === "preview") return "#cc785c";
    if (type === "file") return "#b35f43";
    return "#5c7257";
  };
  const trailRows = (data.trail || [])
    .slice()
    .reverse()
    .map(
      (item) => `<li><span class="dot" style="background:${dotColor(item.type)}"></span>` +
        `<span class="tm">${escapeHtml(item.time)}</span>` +
        `<span class="ty">${escapeHtml(item.type)}</span>` +
        `<span class="lb">${escapeHtml(item.label)}</span></li>`
    )
    .join("");
  const diffBlocks = (data.previews || []).length
    ? data.previews
        .map(
          (preview) => `<div class="diff"><div class="dh"><strong>${escapeHtml(preview.path)}</strong>` +
            `<span>+${Number(preview.stats.added || 0)} −${Number(preview.stats.removed || 0)}${preview.applied ? " · applied" : ""}</span></div>` +
            `<pre>${colorDiffLines(preview.diff)}</pre></div>`
        )
        .join("")
    : `<p class="muted">No diffs captured in this run.</p>`;
  const cites = (data.citations || []).length
    ? `<ul class="cites">${data.citations.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`
    : `<p class="muted">No memory citations captured.</p>`;
  const files = data.selectedFiles && data.selectedFiles.length
    ? data.selectedFiles.map((f) => `<code>${escapeHtml(f)}</code>`).join(" ")
    : `<span class="muted">none</span>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgentTrail Receipt</title>
<style>
:root{--bg:#f0eee6;--panel:#faf9f5;--ink:#1f1e1d;--muted:#75716a;--line:#e2ddd0;--clay:#cc785c;--clayDeep:#b35f43;--sage:#5c7257}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:880px;margin:0 auto;padding:40px 24px 64px}
.head{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:24px}
.mark{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#d58468,#b35f43);flex:0 0 auto}
h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.5rem;margin:0;font-weight:600}
.sub{color:var(--muted);font-size:.85rem;margin-top:2px}
.meta{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}
.chip{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:var(--panel);font-size:.82rem}
.chip b{color:var(--clayDeep)}
.score{margin-left:auto;text-align:right}
.score b{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:2rem;color:var(--clayDeep);line-height:1}
h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:32px 0 12px;display:flex;align-items:center;gap:8px}
h2::before{content:"";width:5px;height:5px;border-radius:2px;background:var(--clay)}
ul.trail{list-style:none;margin:0;padding:0;display:grid;gap:6px}
ul.trail li{display:grid;grid-template-columns:10px 70px 84px 1fr;gap:10px;align-items:center;padding:9px 12px;border:1px solid var(--line);border-radius:9px;background:var(--panel);font-size:.83rem}
.dot{width:8px;height:8px;border-radius:50%}
.tm{color:var(--muted);font-variant-numeric:tabular-nums}
.ty{color:var(--clayDeep);font-weight:600;font-size:.72rem;text-transform:uppercase}
.diff{border:1px solid var(--line);border-radius:11px;overflow:hidden;margin-bottom:14px}
.dh{display:flex;justify-content:space-between;gap:12px;padding:10px 13px;background:#f8efe9;border-bottom:1px solid var(--line)}
.dh strong{color:var(--clayDeep);font-size:.85rem}.dh span{color:var(--muted);font-size:.78rem}
.diff pre{margin:0;padding:13px;background:#26241f;color:#f3f0e7;font-family:"SFMono-Regular",Consolas,monospace;font-size:.78rem;line-height:1.55;overflow-x:auto;white-space:pre-wrap}
.diff .add{color:#9ed29a}.diff .del{color:#e88b74}
.cites{margin:0;padding-left:18px;color:var(--muted);font-size:.84rem;display:grid;gap:4px}
code{background:#ebe7da;padding:2px 6px;border-radius:5px;font-size:.82rem;color:var(--clayDeep)}
.muted{color:var(--muted)}
.foot{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.8rem}
.foot a{color:var(--clayDeep)}
</style></head>
<body><div class="wrap">
<div class="head"><div class="mark"></div><div><h1>AgentTrail Receipt</h1><div class="sub">A local agent that shows its work - exported ${escapeHtml(new Date().toLocaleString())}</div></div></div>
<div class="meta">
<span class="chip">Model <b>${escapeHtml(data.model)}</b></span>
<span class="chip">Search index <b>${escapeHtml(data.provider)}</b></span>
<span class="chip">Context files: ${files}</span>
<span class="score"><div class="sub">Trust Score</div><b>${escapeHtml(String(data.trustScore))}</b></span>
</div>
<h2>Agent Trail</h2><ul class="trail">${trailRows || '<li><span class="lb muted">No events recorded.</span></li>'}</ul>
<h2>Proposed &amp; Applied Diffs</h2>${diffBlocks}
<h2>Memory Citations</h2>${cites}
<div class="foot">Generated locally by AgentTrail. Nothing in this receipt left your machine. · <a href="https://github.com/Mughal-Baig/local-ai-agent">github.com/Mughal-Baig/local-ai-agent</a></div>
</div></body></html>`;
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

  for (const [index, message] of state.messages.entries()) {
    const row = document.createElement("article");
    row.className = `message ${message.role}`;
    row.setAttribute("aria-label", message.role === "user" ? "User message" : "Assistant message");
    row.setAttribute("tabindex", "-1");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = message.role === "user" ? "YOU" : "AI";
    avatar.setAttribute("aria-hidden", "true");

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.setAttribute("role", "group");
    bubble.innerHTML = formatMessage(message.content || " ");

    const isLast = message === state.messages[state.messages.length - 1];
    if (state.busy && message.role === "assistant" && isLast) {
      const caret = document.createElement("span");
      caret.className = "stream-caret";
      caret.setAttribute("aria-hidden", "true");
      bubble.appendChild(caret);
    }

    bubble.querySelectorAll(".code-copy").forEach((button) => {
      button.addEventListener("click", () => copyCodeBlock(button));
    });

    if (message.content && message.content.trim()) {
      bubble.appendChild(renderMessageActions(message, index));
    }

    if (message.events && message.events.length) {
      const events = document.createElement("div");
      events.className = "tool-events";
      for (const item of message.events) {
        if (item.type === "preview" && item.preview) {
          events.appendChild(renderPreviewEvent(item));
        } else {
          const chip = document.createElement("span");
          chip.className = `tool-chip${item.type === "error" ? " error" : ""}${item.type === "reflection" ? " reflection" : ""}${item.type === "memory" ? " memory" : ""}${item.type === "trace" ? " trace" : ""}`;
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

function renderMessageActions(message, index) {
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "message-action";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => copyMessage(message));
  actions.appendChild(copy);
  if (message.role === "user") {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "message-action";
    edit.textContent = "Edit + rerun";
    edit.disabled = state.busy;
    edit.addEventListener("click", () => editUserMessage(index));
    actions.appendChild(edit);
  }
  if (message.role === "assistant") {
    const speak = document.createElement("button");
    speak.type = "button";
    speak.className = "message-action";
    speak.textContent = state.speakingMessage === index ? "Speaking" : "Speak";
    speak.disabled = state.speakingMessage === index;
    speak.addEventListener("click", () => speakAssistantMessage(message, index, speak));
    actions.appendChild(speak);
    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.className = "message-action";
    regenerate.textContent = "Regenerate";
    regenerate.disabled = state.busy || previousUserMessageIndex(index) < 0;
    regenerate.addEventListener("click", () => regenerateAssistantResponse(index));
    actions.appendChild(regenerate);
    if (isStoppedAssistantMessage(message)) {
      const continueButton = document.createElement("button");
      continueButton.type = "button";
      continueButton.className = "message-action";
      continueButton.textContent = "Continue";
      continueButton.disabled = state.busy;
      continueButton.addEventListener("click", () => continueStoppedRun(index));
      actions.appendChild(continueButton);
    }
  }
  const canBranch = state.activeConversationId || state.messages.some((item) => item.role === "user" && String(item.content || "").trim());
  if (canBranch) {
    const branch = document.createElement("button");
    branch.type = "button";
    branch.className = "message-action";
    branch.textContent = "Branch";
    branch.addEventListener("click", () => branchConversation(state.activeConversationId, index));
    actions.appendChild(branch);
  }
  return actions;
}

async function copyMessage(message) {
  const text = String(message && message.content ? message.content : "");
  if (!text.trim()) {
    return;
  }
  await copyText(text, "Copied message");
}

async function copyCodeBlock(button) {
  const code = button && button.dataset ? button.dataset.code || "" : "";
  if (!code) {
    return;
  }
  await copyText(code, "Copied code block");
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = "Copy";
  }, 1200);
}

async function copyText(text, label) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    addTrail("composer", label);
  } catch (error) {
    addTrail("error", `Copy failed: ${error.message}`);
  }
}

async function speakAssistantMessage(message, index, button) {
  const text = stripMarkdownForSpeech(message.content || "");
  if (!text) {
    return;
  }
  const originalLabel = button.textContent;
  state.speakingMessage = index;
  button.disabled = true;
  button.textContent = "Speaking";
  addTrail("audio", "Creating local speech audio");
  try {
    const result = await postJson("/api/audio/speak", { text });
    const audio = new Audio(result.audioUrl);
    audio.addEventListener("ended", () => {
      state.speakingMessage = null;
      renderMessages();
    }, { once: true });
    await audio.play();
    if (result.receipt && result.receipt.path) {
      addTrail("receipt", `Speech receipt ${result.receipt.path}`);
    }
  } catch (error) {
    state.speakingMessage = null;
    button.disabled = false;
    button.textContent = originalLabel;
    addTrail("error", error.message);
  }
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
  const codeBlocks = [];
  const withBlocks = escaped.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const language = String(lang || "text").toLowerCase();
    const highlighted = highlightEscapedCode(code, language);
    const token = `@@AGENTTRAILCODE${indexLetters(codeBlocks.length)}@@`;
    const html = [
      `<div class="code-block" data-lang="${escapeHtml(language)}">`,
      `<div class="code-head"><span>${escapeHtml(language)}</span><button class="code-copy" type="button" data-code="${code}">Copy</button></div>`,
      `<pre><code>${highlighted}</code></pre>`,
      "</div>"
    ].join("");
    codeBlocks.push([token, html]);
    return token;
  });

  return withBlocks
    .split(/\n{2,}/)
    .map((paragraph) => {
      const exactBlock = codeBlocks.find(([token]) => paragraph.trim() === token);
      if (exactBlock) {
        return exactBlock[1];
      }
      let rendered = `<p>${paragraph
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br />")}</p>`;
      for (const [token, html] of codeBlocks) {
        rendered = rendered.replaceAll(token, html);
      }
      return rendered;
    })
    .join("");
}

function highlightEscapedCode(code, language = "text") {
  let highlighted = String(code || "");
  const protectedSegments = [];
  const protect = (pattern, className) => {
    highlighted = highlighted.replace(pattern, (match) => {
      const token = `@@AGENTTRAILHL${indexLetters(protectedSegments.length)}@@`;
      protectedSegments.push([token, `<span class="${className}">${match}</span>`]);
      return token;
    });
  };
  if (["js", "jsx", "ts", "tsx", "javascript", "typescript"].includes(language)) {
    protect(/(\/\/.*)$/gm, "syntax-comment");
  } else if (["py", "python", "sh", "bash", "zsh"].includes(language)) {
    protect(/(#.*)$/gm, "syntax-comment");
  }
  protect(/(&quot;.*?&quot;|&#039;.*?&#039;|`.*?`)/g, "syntax-string");
  highlighted = highlighted.replace(/\b(0x[a-fA-F0-9]+|\d+(?:\.\d+)?)\b/g, '<span class="syntax-number">$1</span>');
  if (["js", "jsx", "ts", "tsx", "javascript", "typescript"].includes(language)) {
    highlighted = highlighted.replace(/\b(async|await|const|let|var|function|return|if|else|for|while|class|new|try|catch|throw|import|export|from)\b/g, '<span class="syntax-keyword">$1</span>');
  } else if (["py", "python"].includes(language)) {
    highlighted = highlighted.replace(/\b(async|await|def|return|if|elif|else|for|while|class|try|except|raise|import|from|with|as|lambda)\b/g, '<span class="syntax-keyword">$1</span>');
  } else if (["sh", "bash", "zsh"].includes(language)) {
    highlighted = highlighted.replace(/\b(if|then|else|fi|for|do|done|case|esac|function|export)\b/g, '<span class="syntax-keyword">$1</span>');
  } else if (["json"].includes(language)) {
    highlighted = highlighted.replace(/(&quot;[^&]+&quot;)(\s*:)/g, '<span class="syntax-keyword">$1</span>$2');
  }
  for (const [token, html] of protectedSegments) {
    highlighted = highlighted.replaceAll(token, html);
  }
  return highlighted;
}

function indexLetters(index) {
  let value = Number(index || 0);
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function stripMarkdownForSpeech(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function resizePrompt() {
  els.prompt.style.height = "auto";
  els.prompt.style.height = `${Math.min(els.prompt.scrollHeight, 180)}px`;
  updateSendState();
}

function updateSendState() {
  els.sendButton.disabled = state.busy || state.planning || !els.prompt.value.trim();
  els.planButton.disabled = state.busy || state.planning || !els.prompt.value.trim();
  if (els.screenshotAction) {
    els.screenshotAction.disabled = state.busy || state.planning;
  }
  if (els.voicePrompt) {
    els.voicePrompt.disabled = (state.busy || state.planning) && !state.voiceRecording.active;
  }
  els.stepBudgetSelect.disabled = state.busy || state.planning;
  els.stopButton.disabled = !state.busy || state.cancelRequested;
  els.approvePlan.disabled = state.busy || state.planning || !els.planText.value.trim();
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
    throw new Error(error.userMessage || error.error || `HTTP ${response.status}`);
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

function normalizeUiMessages(messages) {
  const normalized = Array.isArray(messages) ? messages : [];
  if (!normalized.length) {
    return [
      {
        role: "assistant",
        content: "Replayed session loaded. Review the selected files, prompt, pending previews, and trail.",
        events: []
      }
    ];
  }
  return normalized
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: message.content || "",
      events: Array.isArray(message.events) ? message.events : []
    }));
}

function latestUiUserPrompt() {
  const message = state.messages
    .slice()
    .reverse()
    .find((item) => item.role === "user" && String(item.content || "").trim());
  return message ? String(message.content || "").trim() : "";
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

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }
  if (value < 60000) {
    return `${(value / 1000).toFixed(1)} s`;
  }
  return `${Math.round(value / 60000)} min`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
