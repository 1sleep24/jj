const elements = {
  gifInput: document.getElementById("gif-input"),
  topCount: document.getElementById("top-count"),
  setupMessage: document.getElementById("setup-message"),
  battlePanel: document.getElementById("battle-panel"),
  resultsPanel: document.getElementById("results-panel"),
  rankedCount: document.getElementById("ranked-count"),
  comparisonCount: document.getElementById("comparison-count"),
  estimatedTotal: document.getElementById("estimated-total"),
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
  topListCopy: document.getElementById("top-list-copy"),
  topList: document.getElementById("top-list"),
  fullList: document.getElementById("full-list"),
  copyTopButton: document.getElementById("copy-top-button"),
  copyAllButton: document.getElementById("copy-all-button"),
  rankingItemTemplate: document.getElementById("ranking-item-template")
};

const state = {
  items: [],
  sorted: [],
  currentIndex: 0,
  currentItem: null,
  searchLow: 0,
  searchHigh: 0,
  probeIndex: 0,
  comparisons: 0,
  history: [],
  topCount: 20
};

function safeTopCount(value, totalItems) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return Math.min(20, totalItems);
  }

  return Math.min(parsed, totalItems);
}

function estimateTotalComparisons(totalItems) {
  let total = 0;
  for (let index = 1; index < totalItems; index += 1) {
    total += Math.ceil(Math.log2(index + 1));
  }
  return total;
}

function revokeAllUrls() {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
}

function resetUiForNewSession() {
  elements.battlePanel.classList.add("hidden");
  elements.resultsPanel.classList.add("hidden");
  elements.topList.innerHTML = "";
  elements.fullList.innerHTML = "";
}

function loadFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif"));

  if (files.length < 2) {
    elements.setupMessage.textContent = "Choose at least 2 GIF files to start ranking.";
    resetUiForNewSession();
    return;
  }

  revokeAllUrls();

  state.items = files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    name: file.name,
    url: URL.createObjectURL(file)
  }));

  state.topCount = safeTopCount(elements.topCount.value, state.items.length);
  elements.topCount.value = state.topCount;

  elements.setupMessage.textContent = `${state.items.length} GIFs loaded. Start tapping your favorites below.`;

  startRanking();
}

function startRanking() {
  state.sorted = [state.items[0]];
  state.currentIndex = 1;
  state.currentItem = null;
  state.searchLow = 0;
  state.searchHigh = 0;
  state.probeIndex = 0;
  state.comparisons = 0;
  state.history = [];

  elements.resultsPanel.classList.add("hidden");
  elements.battlePanel.classList.remove("hidden");

  prepareNextInsertion();
}

function prepareNextInsertion() {
  if (state.currentIndex >= state.items.length) {
    renderResults();
    return;
  }

  state.currentItem = state.items[state.currentIndex];
  state.searchLow = 0;
  state.searchHigh = state.sorted.length;
  state.probeIndex = Math.floor((state.searchLow + state.searchHigh) / 2);

  renderBattle();
}

function snapshotState() {
  return {
    sorted: [...state.sorted],
    currentIndex: state.currentIndex,
    currentItem: state.currentItem,
    searchLow: state.searchLow,
    searchHigh: state.searchHigh,
    probeIndex: state.probeIndex,
    comparisons: state.comparisons
  };
}

function handleDecision(preferCurrentItem) {
  if (!state.currentItem) {
    return;
  }

  state.history.push(snapshotState());
  state.comparisons += 1;

  if (preferCurrentItem) {
    state.searchHigh = state.probeIndex;
  } else {
    state.searchLow = state.probeIndex + 1;
  }

  if (state.searchLow >= state.searchHigh) {
    state.sorted.splice(state.searchLow, 0, state.currentItem);
    state.currentIndex += 1;
    prepareNextInsertion();
    return;
  }

  state.probeIndex = Math.floor((state.searchLow + state.searchHigh) / 2);
  renderBattle();
}

function undoLastDecision() {
  const previous = state.history.pop();

  if (!previous) {
    return;
  }

  state.sorted = [...previous.sorted];
  state.currentIndex = previous.currentIndex;
  state.currentItem = previous.currentItem;
  state.searchLow = previous.searchLow;
  state.searchHigh = previous.searchHigh;
  state.probeIndex = previous.probeIndex;
  state.comparisons = previous.comparisons;

  elements.resultsPanel.classList.add("hidden");
  elements.battlePanel.classList.remove("hidden");
  renderBattle();
}

function renderBattle() {
  const rankedItem = state.sorted[state.probeIndex];
  const rankedCount = Math.min(state.currentIndex, state.items.length);
  const estimatedTotal = estimateTotalComparisons(state.items.length);

  elements.rankedCount.textContent = `${rankedCount} / ${state.items.length}`;
  elements.comparisonCount.textContent = String(state.comparisons);
  elements.estimatedTotal.textContent = String(estimatedTotal);
  elements.decisionHint.textContent = `Placing ${state.currentItem.name} among your current top ${state.sorted.length}.`;

  elements.leftImage.src = state.currentItem.url;
  elements.leftImage.alt = state.currentItem.name;
  elements.leftName.textContent = state.currentItem.name;

  elements.rightImage.src = rankedItem.url;
  elements.rightImage.alt = rankedItem.name;
  elements.rightName.textContent = rankedItem.name;

  elements.undoButton.disabled = state.history.length === 0;
}

function createRankingItem(item, index, topCount) {
  const fragment = elements.rankingItemTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".ranking-item");
  const number = fragment.querySelector(".ranking-number");
  const image = fragment.querySelector(".ranking-image");
  const name = fragment.querySelector(".ranking-name");
  const tag = fragment.querySelector(".ranking-tag");

  number.textContent = String(index + 1);
  image.src = item.url;
  image.alt = item.name;
  name.textContent = item.name;

  if (index < topCount) {
    tag.textContent = "Keep";
  } else {
    tag.textContent = "Cut";
  }

  return root;
}

function renderResults() {
  elements.battlePanel.classList.add("hidden");
  elements.resultsPanel.classList.remove("hidden");

  const topItems = state.sorted.slice(0, state.topCount);
  elements.topListHeading.textContent = `Top ${state.topCount}`;
  elements.topListCopy.textContent = `${topItems.length} GIFs ready for your post, already in order.`;

  elements.topList.innerHTML = "";
  topItems.forEach((item, index) => {
    elements.topList.appendChild(createRankingItem(item, index, state.topCount));
  });

  elements.fullList.innerHTML = "";
  state.sorted.forEach((item, index) => {
    elements.fullList.appendChild(createRankingItem(item, index, state.topCount));
  });
}

async function copyRanking(limit) {
  const list = state.sorted
    .slice(0, limit)
    .map((item, index) => `${index + 1}. ${item.name}`)
    .join("\n");

  try {
    await navigator.clipboard.writeText(list);
    const scope = limit === state.sorted.length ? "full ranking" : `top ${limit}`;
    elements.topListCopy.textContent = `Copied your ${scope} to the clipboard.`;
  } catch (error) {
    elements.topListCopy.textContent = "Clipboard access failed on this browser. You can still copy the list manually.";
  }
}

elements.gifInput.addEventListener("change", (event) => {
  loadFiles(event.target.files);
});

elements.topCount.addEventListener("change", () => {
  if (state.items.length === 0) {
    return;
  }

  state.topCount = safeTopCount(elements.topCount.value, state.items.length);
  elements.topCount.value = state.topCount;

  if (state.sorted.length === state.items.length) {
    renderResults();
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
elements.copyTopButton.addEventListener("click", () => copyRanking(state.topCount));
elements.copyAllButton.addEventListener("click", () => copyRanking(state.sorted.length));

window.addEventListener("beforeunload", revokeAllUrls);
