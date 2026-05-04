const SAVE_FILES_KEY = "gif-ranker-files";
const SAVE_STATE_KEY = "gif-ranker-state";
const MAX_HISTORY = 250;

const elements = {
  gifInput: document.getElementById("gif-input"),
  topCount: document.getElementById("top-count"),
  setupMessage: document.getElementById("setup-message"),
  saveMessage: document.getElementById("save-message"),
  resumeButton: document.getElementById("resume-button"),
  clearSaveButton: document.getElementById("clear-save-button"),
  battlePanel: document.getElementById("battle-panel"),
  resultsPanel: document.getElementById("results-panel"),
  rankedCount: document.getElementById("ranked-count"),
  comparisonCount: document.getElementById("comparison-count"),
  estimatedTotal: document.getElementById("estimated-total"),
  statPrimaryLabel: document.getElementById("stat-primary-label"),
  statSecondaryLabel: document.getElementById("stat-secondary-label"),
  statTertiaryLabel: document.getElementById("stat-tertiary-label"),
  decisionHint: document.getElementById("decision-hint"),
  leftChoice: document.getElementById("left-choice"),
  rightChoice: document.getElementById("right-choice"),
  leftImage: document.getElementById("left-image"),
  rightImage: document.getElementById("right-image"),
  leftName: document.getElementById("left-name"),
  rightName: document.getElementById("right-name"),
  undoButton: document.getElementById("undo-button"),
  restartButton: document.getElementById("restart-button"),
  topListHeading: document.getElementById("top-list-heading"),
  cutListHeading: document.getElementById("cut-list-heading"),
  topListCopy: document.getElementById("top-list-copy"),
  topList: document.getElementById("top-list"),
  fullList: document.getElementById("full-list"),
  copyTopButton: document.getElementById("copy-top-button"),
  copyAllButton: document.getElementById("copy-all-button")
};

const state = {
  items: [],
  itemById: new Map(),
  leaders: [],
  cuts: [],
  currentIndex: 0,
  currentItem: null,
  searchLow: 0,
  searchHigh: 0,
  probeIndex: 0,
  comparisons: 0,
  history: [],
  topCount: 20,
  stage: "idle",
  persistenceAvailable: false
};

let dbPromise = null;
let saveTimer = null;

function safeTopCount(value, totalItems) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return Math.min(20, totalItems);
  }

  return Math.min(parsed, totalItems);
}

function revokeAllUrls() {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
}

function setInputsLocked(isLocked) {
  elements.topCount.disabled = isLocked;
}

function resetUiForNewSession() {
  elements.battlePanel.classList.add("hidden");
  elements.resultsPanel.classList.add("hidden");
  elements.topList.innerHTML = "";
  elements.fullList.innerHTML = "";
  elements.topListCopy.textContent = "";
}

function clearInMemoryState() {
  revokeAllUrls();
  state.items = [];
  state.itemById = new Map();
  state.leaders = [];
  state.cuts = [];
  state.currentIndex = 0;
  state.currentItem = null;
  state.searchLow = 0;
  state.searchHigh = 0;
  state.probeIndex = 0;
  state.comparisons = 0;
  state.history = [];
  state.stage = "idle";
  setInputsLocked(false);
}

function createItemsFromFiles(files) {
  state.items = files.map((file, index) => ({
    id: `gif-${index}`,
    name: file.name,
    file,
    url: URL.createObjectURL(file)
  }));
  state.itemById = new Map(state.items.map((item) => [item.id, item]));
}

function getRankedOpponent() {
  if (state.stage === "cutoff") {
    return state.leaders[state.leaders.length - 1];
  }

  return state.leaders[state.probeIndex];
}

function snapshotState() {
  return {
    leaders: [...state.leaders],
    cuts: [...state.cuts],
    currentIndex: state.currentIndex,
    currentItem: state.currentItem,
    searchLow: state.searchLow,
    searchHigh: state.searchHigh,
    probeIndex: state.probeIndex,
    comparisons: state.comparisons,
    stage: state.stage
  };
}

function pushHistory() {
  state.history.push(snapshotState());
  if (state.history.length > MAX_HISTORY) {
    state.history.shift();
  }
}

function restoreFromHistory() {
  const previous = state.history.pop();
  if (!previous) {
    return;
  }

  state.leaders = [...previous.leaders];
  state.cuts = [...previous.cuts];
  state.currentIndex = previous.currentIndex;
  state.currentItem = previous.currentItem;
  state.searchLow = previous.searchLow;
  state.searchHigh = previous.searchHigh;
  state.probeIndex = previous.probeIndex;
  state.comparisons = previous.comparisons;
  state.stage = previous.stage;
}

function serializeState() {
  return {
    topCount: state.topCount,
    currentIndex: state.currentIndex,
    currentItemId: state.currentItem ? state.currentItem.id : null,
    searchLow: state.searchLow,
    searchHigh: state.searchHigh,
    probeIndex: state.probeIndex,
    comparisons: state.comparisons,
    stage: state.stage,
    leaderIds: state.leaders.map((item) => item.id),
    cutIds: state.cuts.map((item) => item.id),
    history: state.history.map((entry) => ({
      leaderIds: entry.leaders.map((item) => item.id),
      cutIds: entry.cuts.map((item) => item.id),
      currentIndex: entry.currentIndex,
      currentItemId: entry.currentItem ? entry.currentItem.id : null,
      searchLow: entry.searchLow,
      searchHigh: entry.searchHigh,
      probeIndex: entry.probeIndex,
      comparisons: entry.comparisons,
      stage: entry.stage
    }))
  };
}

function deserializeState(snapshot) {
  const getItem = (id) => state.itemById.get(id) || null;

  state.topCount = safeTopCount(snapshot.topCount, state.items.length);
  state.currentIndex = snapshot.currentIndex;
  state.currentItem = getItem(snapshot.currentItemId);
  state.searchLow = snapshot.searchLow;
  state.searchHigh = snapshot.searchHigh;
  state.probeIndex = snapshot.probeIndex;
  state.comparisons = snapshot.comparisons;
  state.stage = snapshot.stage;
  state.leaders = snapshot.leaderIds.map(getItem).filter(Boolean);
  state.cuts = snapshot.cutIds.map(getItem).filter(Boolean);
  state.history = (snapshot.history || []).map((entry) => ({
    leaders: entry.leaderIds.map(getItem).filter(Boolean),
    cuts: entry.cutIds.map(getItem).filter(Boolean),
    currentIndex: entry.currentIndex,
    currentItem: getItem(entry.currentItemId),
    searchLow: entry.searchLow,
    searchHigh: entry.searchHigh,
    probeIndex: entry.probeIndex,
    comparisons: entry.comparisons,
    stage: entry.stage
  }));
}

function setGifImage(img, item) {
  if (img.dataset.currentUrl === item.url) {
    return;
  }

  img.dataset.currentUrl = item.url;
  img.removeAttribute("src");
  img.src = item.url;
  img.alt = item.name;
}

function createTextRankingItem(item, index, tagText) {
  const li = document.createElement("li");
  li.className = "ranking-item ranking-item-simple";

  const number = document.createElement("span");
  number.className = "ranking-number";
  number.textContent = String(index + 1);

  const copy = document.createElement("div");
  copy.className = "ranking-copy";

  const name = document.createElement("span");
  name.className = "ranking-name";
  name.textContent = item.name;

  const tag = document.createElement("span");
  tag.className = "ranking-tag";
  tag.textContent = tagText;

  copy.append(name, tag);
  li.append(number, copy);

  return li;
}

function renderBattle() {
  const remainingCount = Math.max(state.items.length - state.currentIndex, 0);
  const rankedItem = getRankedOpponent();

  elements.statPrimaryLabel.textContent = "Shortlist";
  elements.statSecondaryLabel.textContent = "Comparisons";
  elements.statTertiaryLabel.textContent = "Remaining GIFs";
  elements.rankedCount.textContent = `${state.leaders.length} / ${state.topCount}`;
  elements.comparisonCount.textContent = String(state.comparisons);
  elements.estimatedTotal.textContent = String(remainingCount);

  if (state.stage === "cutoff") {
    elements.decisionHint.textContent = `${state.currentItem.name} only needs to beat your current #${state.topCount} GIF to enter the shortlist.`;
  } else if (state.stage === "seed") {
    elements.decisionHint.textContent = `Building your shortlist with ${state.currentItem.name}.`;
  } else {
    elements.decisionHint.textContent = `Placing ${state.currentItem.name} inside your current shortlist.`;
  }

  setGifImage(elements.leftImage, state.currentItem);
  setGifImage(elements.rightImage, rankedItem);
  elements.leftName.textContent = state.currentItem.name;
  elements.rightName.textContent = rankedItem.name;
  elements.undoButton.disabled = state.history.length === 0;
}

function renderResults() {
  elements.battlePanel.classList.add("hidden");
  elements.resultsPanel.classList.remove("hidden");

  elements.statPrimaryLabel.textContent = "Shortlist";
  elements.statSecondaryLabel.textContent = "Compared";
  elements.statTertiaryLabel.textContent = "Trimmed";
  elements.rankedCount.textContent = `${state.leaders.length} / ${state.topCount}`;
  elements.comparisonCount.textContent = String(state.comparisons);
  elements.estimatedTotal.textContent = String(state.cuts.length);

  elements.topListHeading.textContent = `Top ${state.topCount}`;
  elements.cutListHeading.textContent = state.cuts.length > 0 ? "Trimmed away" : "No trimmed GIFs";
  elements.topListCopy.textContent = `${state.leaders.length} GIFs are ready for your post, already in order.`;

  elements.topList.innerHTML = "";
  state.leaders.forEach((item, index) => {
    elements.topList.appendChild(createTextRankingItem(item, index, "Keep"));
  });

  elements.fullList.innerHTML = "";
  state.cuts.forEach((item, index) => {
    elements.fullList.appendChild(createTextRankingItem(item, index, "Cut"));
  });
}

function prepareNextStep() {
  if (state.currentIndex >= state.items.length) {
    state.stage = "done";
    renderResults();
    queueStateSave();
    return;
  }

  state.currentItem = state.items[state.currentIndex];

  if (state.leaders.length < state.topCount) {
    state.stage = "seed";
    state.searchLow = 0;
    state.searchHigh = state.leaders.length;
    state.probeIndex = Math.floor((state.searchLow + state.searchHigh) / 2);
  } else {
    state.stage = "cutoff";
    state.searchLow = 0;
    state.searchHigh = 0;
    state.probeIndex = state.leaders.length - 1;
  }

  elements.resultsPanel.classList.add("hidden");
  elements.battlePanel.classList.remove("hidden");
  renderBattle();
  queueStateSave();
}

function finishCurrentInsertion() {
  state.leaders.splice(state.searchLow, 0, state.currentItem);

  if (state.leaders.length > state.topCount) {
    const removed = state.leaders.pop();
    if (removed) {
      state.cuts.push(removed);
    }
  }

  state.currentIndex += 1;
  state.currentItem = null;
  prepareNextStep();
}

function beginInsertionAfterCutoffWin() {
  state.stage = "insert";
  state.searchLow = 0;
  state.searchHigh = state.leaders.length - 1;

  if (state.searchLow >= state.searchHigh) {
    finishCurrentInsertion();
    return;
  }

  state.probeIndex = Math.floor((state.searchLow + state.searchHigh) / 2);
  renderBattle();
  queueStateSave();
}

function startRanking() {
  state.leaders = [state.items[0]];
  state.cuts = [];
  state.currentIndex = 1;
  state.currentItem = null;
  state.searchLow = 0;
  state.searchHigh = 0;
  state.probeIndex = 0;
  state.comparisons = 0;
  state.history = [];
  state.stage = "seed";
  prepareNextStep();
}

function handleDecision(preferCurrentItem) {
  if (!state.currentItem) {
    return;
  }

  pushHistory();
  state.comparisons += 1;

  if (state.stage === "cutoff") {
    if (preferCurrentItem) {
      beginInsertionAfterCutoffWin();
      return;
    }

    state.cuts.push(state.currentItem);
    state.currentIndex += 1;
    state.currentItem = null;
    prepareNextStep();
    return;
  }

  if (preferCurrentItem) {
    state.searchHigh = state.probeIndex;
  } else {
    state.searchLow = state.probeIndex + 1;
  }

  if (state.searchLow >= state.searchHigh) {
    finishCurrentInsertion();
    return;
  }

  state.probeIndex = Math.floor((state.searchLow + state.searchHigh) / 2);
  renderBattle();
  queueStateSave();
}

function undoLastDecision() {
  if (state.history.length === 0) {
    return;
  }

  restoreFromHistory();
  if (state.stage === "done") {
    renderResults();
  } else {
    elements.resultsPanel.classList.add("hidden");
    elements.battlePanel.classList.remove("hidden");
    renderBattle();
  }
  queueStateSave();
}

function buildListText(items) {
  return items.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
}

async function copyLines(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    elements.topListCopy.textContent = successMessage;
  } catch (error) {
    elements.topListCopy.textContent = "Clipboard access failed on this browser. You can still copy the list manually.";
  }
}

function updateSavedSessionButtons(hasSavedSession) {
  elements.resumeButton.classList.toggle("hidden", !hasSavedSession);
  elements.clearSaveButton.classList.toggle("hidden", !hasSavedSession);
}

function getDb() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open("gif-ranker-db", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("session");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

async function dbGet(key) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("session", "readonly").objectStore("session").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(key, value) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("session", "readwrite");
    transaction.objectStore("session").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function dbDelete(key) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("session", "readwrite");
    transaction.objectStore("session").delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function persistFiles() {
  try {
    await dbPut(
      SAVE_FILES_KEY,
      state.items.map((item) => ({ id: item.id, name: item.name, file: item.file }))
    );
    state.persistenceAvailable = true;
    elements.saveMessage.textContent = "Auto-save is on. You can refresh later and resume on this device.";
    updateSavedSessionButtons(true);
  } catch (error) {
    state.persistenceAvailable = false;
    elements.saveMessage.textContent = "This browser could not save the GIF files for resume, but ranking still works.";
    updateSavedSessionButtons(false);
  }
}

function queueStateSave() {
  if (!state.persistenceAvailable || state.items.length === 0) {
    return;
  }

  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(async () => {
    try {
      await dbPut(SAVE_STATE_KEY, serializeState());
      updateSavedSessionButtons(true);
    } catch (error) {
      elements.saveMessage.textContent = "Saving progress stopped working in this browser, but your current session can still continue.";
    }
  }, 120);
}

async function clearSavedSession() {
  try {
    await Promise.all([dbDelete(SAVE_FILES_KEY), dbDelete(SAVE_STATE_KEY)]);
  } catch (error) {
    // Ignore failures and still reset the UI.
  }

  updateSavedSessionButtons(false);
  elements.saveMessage.textContent = "";
}

async function loadFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif"));

  if (files.length < 2) {
    elements.setupMessage.textContent = "Choose at least 2 GIF files to start ranking.";
    resetUiForNewSession();
    return;
  }

  clearInMemoryState();
  createItemsFromFiles(files);
  state.topCount = safeTopCount(elements.topCount.value, state.items.length);
  elements.topCount.value = state.topCount;
  setInputsLocked(true);

  elements.setupMessage.textContent = `${state.items.length} GIFs loaded. Fast shortlist mode is on.`;
  elements.saveMessage.textContent = "Saving these GIFs locally so you can resume this session if needed.";

  await persistFiles();
  startRanking();
}

async function restoreSavedSession() {
  const filesRecord = await dbGet(SAVE_FILES_KEY);
  const snapshot = await dbGet(SAVE_STATE_KEY);

  if (!filesRecord || !snapshot) {
    elements.setupMessage.textContent = "No saved session was found anymore.";
    updateSavedSessionButtons(false);
    return;
  }

  clearInMemoryState();

  const files = filesRecord
    .map((entry) => {
      if (!entry || !(entry.file instanceof Blob)) {
        return null;
      }
      return new File([entry.file], entry.name, { type: entry.file.type || "image/gif" });
    })
    .filter(Boolean);

  if (files.length < 2) {
    elements.setupMessage.textContent = "The saved session was incomplete, so it could not be restored.";
    await clearSavedSession();
    return;
  }

  createItemsFromFiles(files);
  state.persistenceAvailable = true;
  deserializeState(snapshot);
  setInputsLocked(true);

  elements.topCount.value = state.topCount;
  elements.setupMessage.textContent = `Restored ${state.items.length} GIFs and your saved progress.`;
  elements.saveMessage.textContent = "Auto-save is on for this restored session too.";
  updateSavedSessionButtons(true);

  if (state.stage === "done") {
    renderResults();
  } else {
    elements.resultsPanel.classList.add("hidden");
    elements.battlePanel.classList.remove("hidden");
    renderBattle();
  }
}

async function initSavedSessionUi() {
  try {
    const [filesRecord, snapshot] = await Promise.all([dbGet(SAVE_FILES_KEY), dbGet(SAVE_STATE_KEY)]);
    const hasSavedSession = Boolean(filesRecord && snapshot);
    updateSavedSessionButtons(hasSavedSession);

    if (hasSavedSession) {
      elements.setupMessage.textContent = "A saved session is available on this device.";
      elements.saveMessage.textContent = "You can resume where you left off or clear it and start fresh.";
    } else {
      elements.setupMessage.textContent = "Waiting for your GIFs.";
    }
  } catch (error) {
    updateSavedSessionButtons(false);
    elements.setupMessage.textContent = "Waiting for your GIFs.";
    elements.saveMessage.textContent = "This browser may not support saved sessions, but you can still rank your GIFs.";
  }
}

elements.gifInput.addEventListener("change", async (event) => {
  try {
    await loadFiles(event.target.files);
  } catch (error) {
    elements.setupMessage.textContent = "Those GIFs could not be loaded cleanly. Try selecting them again.";
  }
});
elements.leftChoice.addEventListener("click", () => handleDecision(true));
elements.rightChoice.addEventListener("click", () => handleDecision(false));
elements.undoButton.addEventListener("click", undoLastDecision);
elements.restartButton.addEventListener("click", () => {
  if (state.items.length > 1) {
    startRanking();
  }
});
elements.copyTopButton.addEventListener("click", () => {
  copyLines(buildListText(state.leaders), `Copied your top ${state.leaders.length} list to the clipboard.`);
});
elements.copyAllButton.addEventListener("click", () => {
  copyLines(buildListText(state.cuts), "Copied your cut list to the clipboard.");
});
elements.resumeButton.addEventListener("click", async () => {
  try {
    await restoreSavedSession();
  } catch (error) {
    elements.setupMessage.textContent = "The saved session could not be restored cleanly. Clear it and start fresh.";
  }
});
elements.clearSaveButton.addEventListener("click", async () => {
  await clearSavedSession();
  if (state.items.length === 0) {
    elements.setupMessage.textContent = "Saved session cleared. Load GIFs to start fresh.";
  }
});

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }
  revokeAllUrls();
});

resetUiForNewSession();
initSavedSessionUi();
