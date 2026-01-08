// Management Revision Quiz Engine (non-typing)
// Supports: matching, ordering
// Reads: quiz-data.json (same folder)

const $ = (id) => document.getElementById(id);

const screens = {
  chapters: $("screenChapters"),
  quiz: $("screenQuiz"),
  summary: $("screenSummary"),
};

const ui = {
  appTitle: $("appTitle"),
  subtitle: $("subtitle"),
  chapterList: $("chapterList"),

  btnHome: $("btnHome"),
  btnReset: $("btnReset"),

  pillChapter: $("pillChapter"),
  pillType: $("pillType"),
  pillProgress: $("pillProgress"),
  pillScore: $("pillScore"),

  questionText: $("questionText"),
  matchingUI: $("matchingUI"),
  orderingUI: $("orderingUI"),

  leftList: $("leftList"),
  rightList: $("rightList"),
  pairsView: $("pairsView"),

  orderPool: $("orderPool"),
  orderAnswer: $("orderAnswer"),
  btnUndo: $("btnUndo"),
  btnClearOrder: $("btnClearOrder"),

  btnCheck: $("btnCheck"),
  btnNext: $("btnNext"),
  feedback: $("feedback"),

  summaryText: $("summaryText"),
  btnRetry: $("btnRetry"),
  btnBackChapters: $("btnBackChapters"),
};

let DATA = null;

// State
let currentChapter = null;          // chapter object
let qIndex = 0;
let score = 0;
let checked = false;

// Matching state
let selectedLeft = null;
let selectedRight = null;
let userMatches = {};               // left -> right
let lockedRights = new Set();       // rights already used
let lockedLefts = new Set();

// Ordering state
let pool = [];                      // shuffled pool items
let answer = [];                    // chosen order items

// ---------- Utils ----------
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setFeedback(text, good) {
  ui.feedback.classList.remove("hidden", "good", "bad");
  ui.feedback.classList.add(good ? "good" : "bad");
  ui.feedback.innerHTML = text;
}

function clearFeedback() {
  ui.feedback.classList.add("hidden");
  ui.feedback.innerHTML = "";
}

function updateStatusPills(q) {
  ui.pillChapter.textContent = currentChapter.title;
  ui.pillType.textContent = `Type: ${q.type}`;
  ui.pillProgress.textContent = `Q ${qIndex + 1} / ${currentChapter.questions.length}`;
  ui.pillScore.textContent = `Score ${score}`;
}

// ---------- Load Data ----------
async function loadData() {
  // Try fetch first (GitHub Pages will work).
  try {
    const res = await fetch("quiz-data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");
    const data = await res.json();
    return data;
  } catch (e) {
    // If user opens via file://, fetch may fail. Provide a clear message.
    alert(
      "Could not load quiz-data.json.\n\n" +
      "If you opened the file directly (file://), please run it via GitHub Pages or a local server.\n" +
      "Example: VSCode Live Server."
    );
    throw e;
  }
}

// ---------- Chapter List ----------
function renderChapters() {
  ui.chapterList.innerHTML = "";

  DATA.chapters.forEach((ch) => {
    const card = document.createElement("div");
    card.className = "card chapter-card";
    card.innerHTML = `
      <div class="chapter-title">${escapeHTML(ch.title)}</div>
      <div class="chapter-meta">${ch.questions.length} questions • matching + ordering</div>
    `;
    card.addEventListener("click", () => startChapter(ch.chapterId));
    ui.chapterList.appendChild(card);
  });

  showScreen("chapters");
}

// ---------- Start Chapter ----------
function startChapter(chapterId) {
  currentChapter = DATA.chapters.find(c => c.chapterId === chapterId);
  qIndex = 0;
  score = 0;
  checked = false;

  ui.btnNext.disabled = true;
  ui.btnCheck.disabled = false;
  ui.btnNext.textContent = "Next";

  clearFeedback();
  showScreen("quiz");
  renderQuestion();
}

// ---------- Reset Current Chapter ----------
function resetChapter() {
  if (!currentChapter) return;
  startChapter(currentChapter.chapterId);
}

// ---------- Render Question ----------
function renderQuestion() {
  const q = currentChapter.questions[qIndex];
  checked = false;

  ui.btnNext.disabled = true;
  ui.btnCheck.disabled = false;
  clearFeedback();

  ui.questionText.textContent = q.question;
  updateStatusPills(q);

  // Reset per-type state
  resetMatchingState();
  resetOrderingState();

  // Show correct UI
  ui.matchingUI.classList.add("hidden");
  ui.orderingUI.classList.add("hidden");

  if (q.type === "matching") {
    ui.matchingUI.classList.remove("hidden");
    renderMatching(q);
  } else if (q.type === "ordering") {
    ui.orderingUI.classList.remove("hidden");
    renderOrdering(q);
  } else {
    setFeedback("Unsupported question type in JSON.", false);
  }
}

// ---------- Matching ----------
function resetMatchingState() {
  selectedLeft = null;
  selectedRight = null;
  userMatches = {};
  lockedRights = new Set();
  lockedLefts = new Set();
  ui.leftList.innerHTML = "";
  ui.rightList.innerHTML = "";
  ui.pairsView.innerHTML = "";
}

function renderMatching(q) {
  // Shuffle right for fair matching
  const rightShuffled = shuffle(q.right);

  // Render left items
  q.left.forEach((text) => {
    const el = document.createElement("div");
    el.className = "item";
    el.textContent = text;
    el.addEventListener("click", () => onSelectLeft(text, el));
    ui.leftList.appendChild(el);
  });

  // Render right items
  rightShuffled.forEach((text) => {
    const el = document.createElement("div");
    el.className = "item";
    el.textContent = text;
    el.addEventListener("click", () => onSelectRight(text, el));
    ui.rightList.appendChild(el);
  });

  renderPairsView();
}

function clearSelectionStyles(listEl) {
  [...listEl.querySelectorAll(".item")].forEach(el => el.classList.remove("selected"));
}

function onSelectLeft(value, el) {
  if (checked) return;
  if (lockedLefts.has(value)) return;

  selectedLeft = value;
  clearSelectionStyles(ui.leftList);
  el.classList.add("selected");

  tryPairIfReady();
}

function onSelectRight(value, el) {
  if (checked) return;
  if (lockedRights.has(value)) return;

  selectedRight = value;
  clearSelectionStyles(ui.rightList);
  el.classList.add("selected");

  tryPairIfReady();
}

function tryPairIfReady() {
  if (!selectedLeft || !selectedRight) return;

  // If left already matched, free old right
  if (userMatches[selectedLeft]) {
    lockedRights.delete(userMatches[selectedLeft]);
  }

  userMatches[selectedLeft] = selectedRight;
  lockedLefts.add(selectedLeft);
  lockedRights.add(selectedRight);

  // Clear selections
  selectedLeft = null;
  selectedRight = null;
  clearSelectionStyles(ui.leftList);
  clearSelectionStyles(ui.rightList);

  // Visually lock used items
  lockUsedItems();

  renderPairsView();
}

function lockUsedItems() {
  [...ui.leftList.querySelectorAll(".item")].forEach(el => {
    const txt = el.textContent;
    if (lockedLefts.has(txt)) el.classList.add("locked");
    else el.classList.remove("locked");
  });

  [...ui.rightList.querySelectorAll(".item")].forEach(el => {
    const txt = el.textContent;
    if (lockedRights.has(txt)) el.classList.add("locked");
    else el.classList.remove("locked");
  });
}

function renderPairsView() {
  ui.pairsView.innerHTML = "";

  const entries = Object.entries(userMatches);
  if (entries.length === 0) {
    ui.pairsView.innerHTML = `<div class="subtitle">No pairs yet. Tap one left item, then one right item.</div>`;
    return;
  }

  entries.forEach(([l, r]) => {
    const row = document.createElement("div");
    row.className = "pair";
    row.innerHTML = `
      <div>
        <div><strong>${escapeHTML(l)}</strong></div>
        <small>→ ${escapeHTML(r)}</small>
      </div>
      <button class="btn ghost" type="button">Unpair</button>
    `;

    row.querySelector("button").addEventListener("click", () => {
      if (checked) return;
      // remove match
      lockedLefts.delete(l);
      lockedRights.delete(r);
      delete userMatches[l];
      lockUsedItems();
      renderPairsView();
    });

    ui.pairsView.appendChild(row);
  });
}

function checkMatching(q) {
  const total = q.left.length;

  // Must match all to check
  if (Object.keys(userMatches).length < total) {
    setFeedback(`You matched ${Object.keys(userMatches).length}/${total}. Complete all pairs first.`, false);
    return false;
  }

  let correctCount = 0;

  // Mark correct/wrong in pair view and lists
  [...ui.leftList.querySelectorAll(".item")].forEach(el => {
    el.classList.remove("correct", "wrong");
    const l = el.textContent;
    const userR = userMatches[l];
    const correctR = q.correctMatches[l];
    if (userR === correctR) {
      el.classList.add("correct");
      correctCount++;
    } else {
      el.classList.add("wrong");
    }
  });

  // Right list marking: any right used incorrectly becomes wrong; correct ones correct
  [...ui.rightList.querySelectorAll(".item")].forEach(el => {
    el.classList.remove("correct", "wrong");
    const r = el.textContent;
    // find which left used this right
    const leftUsed = Object.keys(userMatches).find(k => userMatches[k] === r);
    if (!leftUsed) return;
    const correctR = q.correctMatches[leftUsed];
    if (r === correctR) el.classList.add("correct");
    else el.classList.add("wrong");
  });

  const gained = correctCount; // 1 point per correct pair
  score += gained;
  ui.pillScore.textContent = `Score ${score}`;

  setFeedback(
    `You got <strong>${correctCount}/${total}</strong> correct. (+${gained} points)`,
    correctCount === total
  );

  return true;
}

// ---------- Ordering ----------
function resetOrderingState() {
  pool = [];
  answer = [];
  ui.orderPool.innerHTML = "";
  ui.orderAnswer.innerHTML = "";
}

function renderOrdering(q) {
  pool = shuffle(q.correctOrder);
  answer = [];

  ui.btnUndo.disabled = true;
  ui.btnClearOrder.disabled = true;

  drawOrderPool();
  drawOrderAnswer();

  ui.btnUndo.onclick = () => {
    if (checked) return;
    if (answer.length === 0) return;
    const last = answer.pop();
    pool.push(last);
    drawOrderPool();
    drawOrderAnswer();
    updateOrderButtons();
  };

  ui.btnClearOrder.onclick = () => {
    if (checked) return;
    pool = pool.concat(answer);
    answer = [];
    pool = shuffle(pool);
    drawOrderPool();
    drawOrderAnswer();
    updateOrderButtons();
  };
}

function updateOrderButtons() {
  ui.btnUndo.disabled = answer.length === 0;
  ui.btnClearOrder.disabled = answer.length === 0;
}

function drawOrderPool() {
  ui.orderPool.innerHTML = "";
  pool.forEach((item, idx) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = item;
    chip.addEventListener("click", () => {
      if (checked) return;
      // move to answer
      const picked = pool.splice(idx, 1)[0];
      answer.push(picked);
      drawOrderPool();
      drawOrderAnswer();
      updateOrderButtons();
    });
    ui.orderPool.appendChild(chip);
  });
}

function drawOrderAnswer() {
  ui.orderAnswer.innerHTML = "";
  answer.forEach((item, idx) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = `${idx + 1}. ${item}`;
    chip.addEventListener("click", () => {
      if (checked) return;
      // remove specific item from answer back to pool
      const removed = answer.splice(idx, 1)[0];
      pool.push(removed);
      drawOrderPool();
      drawOrderAnswer();
      updateOrderButtons();
    });
    ui.orderAnswer.appendChild(chip);
  });
}

function checkOrdering(q) {
  const total = q.correctOrder.length;
  if (answer.length < total) {
    setFeedback(`Your order is ${answer.length}/${total}. Tap all items to complete the order.`, false);
    return false;
  }

  let correctCount = 0;
  for (let i = 0; i < total; i++) {
    if (answer[i] === q.correctOrder[i]) correctCount++;
  }

  // Mark each answer chip correct/wrong
  [...ui.orderAnswer.querySelectorAll(".chip")].forEach((chipEl, i) => {
    chipEl.classList.remove("correct", "wrong");
    if (answer[i] === q.correctOrder[i]) chipEl.classList.add("correct");
    else chipEl.classList.add("wrong");
  });

  const gained = correctCount; // 1 point per correct position
  score += gained;
  ui.pillScore.textContent = `Score ${score}`;

  setFeedback(
    `Correct positions: <strong>${correctCount}/${total}</strong>. (+${gained} points)`,
    correctCount === total
  );

  return true;
}

// ---------- Check + Next ----------
function onCheck() {
  const q = currentChapter.questions[qIndex];
  if (checked) return;

  let ok = false;

  if (q.type === "matching") ok = checkMatching(q);
  if (q.type === "ordering") ok = checkOrdering(q);

  if (!ok) return;

  checked = true;
  ui.btnCheck.disabled = true;
  ui.btnNext.disabled = false;
}

function onNext() {
  if (!checked) return;

  if (qIndex < currentChapter.questions.length - 1) {
    qIndex++;
    ui.btnNext.disabled = true;
    ui.btnCheck.disabled = false;
    renderQuestion();
  } else {
    // summary
    showSummary();
  }
}

function showSummary() {
  const totalQs = currentChapter.questions.length;
  ui.summaryText.textContent = `You completed ${currentChapter.title}. Total score: ${score}.`;
  showScreen("summary");
}

// ---------- Wiring ----------
ui.btnCheck.addEventListener("click", onCheck);
ui.btnNext.addEventListener("click", onNext);

ui.btnHome.addEventListener("click", () => {
  currentChapter = null;
  showScreen("chapters");
});

ui.btnReset.addEventListener("click", resetChapter);

ui.btnRetry.addEventListener("click", () => {
  if (!currentChapter) return;
  startChapter(currentChapter.chapterId);
});

ui.btnBackChapters.addEventListener("click", () => {
  currentChapter = null;
  showScreen("chapters");
});

// ---------- Init ----------
(async function init() {
  DATA = await loadData();
  ui.appTitle.textContent = DATA.appTitle || "Management Revision Quiz";
  renderChapters();
})();
