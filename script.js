const $ = (id) => document.getElementById(id);

const screens = {
  chapters: $("chaptersScreen"),
  quiz: $("quizScreen"),
  summary: $("summaryScreen"),
};

const ui = {
  appTitle: $("appTitle"),

  chaptersList: $("chaptersList"),

  btnChapters: $("btnChapters"),
  btnRestart: $("btnRestart"),

  pillChapter: $("pillChapter"),
  pillProgress: $("pillProgress"),
  pillScore: $("pillScore"),
  pillType: $("pillType"),

  questionText: $("questionText"),

  matchingUI: $("matchingUI"),
  leftCol: $("leftCol"),
  rightCol: $("rightCol"),
  pairsBox: $("pairsBox"),

  orderingUI: $("orderingUI"),
  poolBox: $("poolBox"),
  answerBox: $("answerBox"),
  btnUndo: $("btnUndo"),
  btnClear: $("btnClear"),

  btnCheck: $("btnCheck"),
  btnNext: $("btnNext"),
  feedback: $("feedback"),

  summaryText: $("summaryText"),
  btnRetry: $("btnRetry"),
  btnBack: $("btnBack"),
};

let DATA = null;
let currentChapter = null;
let qIndex = 0;
let score = 0;
let checked = false;

// Matching state (NOW UID-BASED)
let leftItems = [];      // [{uid,text}]
let rightItems = [];     // [{uid,text}]
let selectedLeftUID = null;
let selectedRightUID = null;

// userMatches[leftUID] = rightUID
let userMatches = {};
let usedLeftUID = new Set();
let usedRightUID = new Set();

// Ordering state
let pool = [];
let answer = [];

function show(name) {
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

function setFeedback(html, good) {
  ui.feedback.classList.remove("hidden", "good", "bad");
  ui.feedback.classList.add(good ? "good" : "bad");
  ui.feedback.innerHTML = html;
}

function clearFeedback() {
  ui.feedback.classList.add("hidden");
  ui.feedback.innerHTML = "";
}

async function loadData() {
  const res = await fetch("quiz-data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load quiz-data.json");
  return res.json();
}

// ---------- Chapters ----------
function renderChapters() {
  ui.chaptersList.innerHTML = "";
  DATA.chapters.forEach(ch => {
    const card = document.createElement("div");
    card.className = "card chapterCard";
    card.innerHTML = `
      <div class="chapterTitle">${ch.title}</div>
      <div class="chapterMeta">${ch.questions.length} questions</div>
    `;
    card.onclick = () => startChapter(ch.chapterId);
    ui.chaptersList.appendChild(card);
  });
  ui.btnRestart.disabled = true;
  show("chapters");
}

function startChapter(chapterId) {
  currentChapter = DATA.chapters.find(c => c.chapterId === chapterId);
  qIndex = 0;
  score = 0;
  checked = false;

  ui.btnRestart.disabled = false;
  ui.btnNext.disabled = true;
  ui.btnCheck.disabled = false;

  show("quiz");
  renderQuestion();
}

function restartChapter() {
  if (!currentChapter) return;
  startChapter(currentChapter.chapterId);
}

// ---------- Question Rendering ----------
function updatePills(q) {
  ui.pillChapter.textContent = currentChapter.title;
  ui.pillProgress.textContent = `Q ${qIndex + 1} / ${currentChapter.questions.length}`;
  ui.pillScore.textContent = `Score ${score}`;
  ui.pillType.textContent = `Type: ${q.type}`;
}

function renderQuestion() {
  const q = currentChapter.questions[qIndex];
  checked = false;
  clearFeedback();
  ui.btnNext.disabled = true;
  ui.btnCheck.disabled = false;

  ui.questionText.textContent = q.question;
  updatePills(q);

  ui.matchingUI.classList.add("hidden");
  ui.orderingUI.classList.add("hidden");

  if (q.type === "matching") {
    ui.matchingUI.classList.remove("hidden");
    initMatching(q);
  } else if (q.type === "ordering") {
    ui.orderingUI.classList.remove("hidden");
    initOrdering(q);
  } else {
    setFeedback("Unsupported question type.", false);
  }
}

// ---------- Matching (UID FIX) ----------
function initMatching(q) {
  selectedLeftUID = null;
  selectedRightUID = null;
  userMatches = {};
  usedLeftUID = new Set();
  usedRightUID = new Set();

  ui.leftCol.innerHTML = "";
  ui.rightCol.innerHTML = "";
  ui.pairsBox.innerHTML = "";

  // Build UID-based items so duplicates (e.g., Reward) are unique
  leftItems = q.left.map((text, i) => ({ uid: `L${q.id || qIndex}-${i}`, text }));
  rightItems = q.right.map((text, i) => ({ uid: `R${q.id || qIndex}-${i}`, text }));

  // Shuffle right side only (common for matching)
  rightItems = shuffle(rightItems);

  // Render left
  leftItems.forEach(item => {
    const el = document.createElement("div");
    el.className = "item";
    el.textContent = item.text;
    el.dataset.uid = item.uid;
    el.onclick = () => selectLeft(item.uid);
    ui.leftCol.appendChild(el);
  });

  // Render right
  rightItems.forEach(item => {
    const el = document.createElement("div");
    el.className = "item";
    el.textContent = item.text;
    el.dataset.uid = item.uid;
    el.onclick = () => selectRight(item.uid);
    ui.rightCol.appendChild(el);
  });

  renderPairs();
}

function clearSelected(col) {
  col.querySelectorAll(".item").forEach(i => i.classList.remove("selected"));
}

function lockUsed() {
  ui.leftCol.querySelectorAll(".item").forEach(el => {
    const uid = el.dataset.uid;
    el.classList.toggle("locked", usedLeftUID.has(uid));
  });
  ui.rightCol.querySelectorAll(".item").forEach(el => {
    const uid = el.dataset.uid;
    el.classList.toggle("locked", usedRightUID.has(uid));
  });
}

function selectLeft(uid) {
  if (checked || usedLeftUID.has(uid)) return;
  selectedLeftUID = uid;
  clearSelected(ui.leftCol);
  ui.leftCol.querySelector(`[data-uid="${uid}"]`)?.classList.add("selected");
  tryMakePair();
}

function selectRight(uid) {
  if (checked || usedRightUID.has(uid)) return;
  selectedRightUID = uid;
  clearSelected(ui.rightCol);
  ui.rightCol.querySelector(`[data-uid="${uid}"]`)?.classList.add("selected");
  tryMakePair();
}

function tryMakePair() {
  if (!selectedLeftUID || !selectedRightUID) return;

  // If left already had a match, free the previous right UID
  if (userMatches[selectedLeftUID]) {
    usedRightUID.delete(userMatches[selectedLeftUID]);
  }

  userMatches[selectedLeftUID] = selectedRightUID;
  usedLeftUID.add(selectedLeftUID);
  usedRightUID.add(selectedRightUID);

  selectedLeftUID = null;
  selectedRightUID = null;

  clearSelected(ui.leftCol);
  clearSelected(ui.rightCol);

  lockUsed();
  renderPairs();
}

function getLeftText(uid) {
  return leftItems.find(x => x.uid === uid)?.text ?? "";
}
function getRightText(uid) {
  return rightItems.find(x => x.uid === uid)?.text ?? "";
}

function renderPairs() {
  ui.pairsBox.innerHTML = "";
  const entries = Object.entries(userMatches);

  if (entries.length === 0) {
    ui.pairsBox.innerHTML = `<div class="subtitle">No pairs yet. Tap Question then Answer.</div>`;
    return;
  }

  entries.forEach(([lUID, rUID]) => {
    const lText = getLeftText(lUID);
    const rText = getRightText(rUID);

    const row = document.createElement("div");
    row.className = "pair";
    row.innerHTML = `
      <div>
        <div><strong>${lText}</strong></div>
        <small>→ ${rText}</small>
      </div>
      <button class="btn ghost" style="width:auto;padding:8px 10px;">Unpair</button>
    `;
    row.querySelector("button").onclick = () => {
      if (checked) return;
      usedLeftUID.delete(lUID);
      usedRightUID.delete(rUID);
      delete userMatches[lUID];
      lockUsed();
      renderPairs();
    };
    ui.pairsBox.appendChild(row);
  });
}

function checkMatching(q) {
  const total = leftItems.length;

  if (Object.keys(userMatches).length < total) {
    setFeedback(`Complete all pairs first (${Object.keys(userMatches).length}/${total}).`, false);
    return false;
  }

  let correct = 0;

  // Correctness uses TEXT comparison, so duplicates are fine
  leftItems.forEach(li => {
    const chosenRightUID = userMatches[li.uid];
    const chosenText = getRightText(chosenRightUID);
    const correctText = q.correctMatches[li.text];

    if (chosenText === correctText) correct++;
  });

  score += correct;
  updatePills(q);

  setFeedback(`Correct pairs: <strong>${correct}/${total}</strong> (+${correct})`, correct === total);
  return true;
}

// ---------- Ordering ----------
function initOrdering(q) {
  pool = shuffle(q.correctOrder);
  answer = [];

  ui.poolBox.innerHTML = "";
  ui.answerBox.innerHTML = "";

  ui.btnUndo.disabled = true;
  ui.btnClear.disabled = true;

  drawPool();
  drawAnswer();

  ui.btnUndo.onclick = () => {
    if (checked || answer.length === 0) return;
    pool.push(answer.pop());
    drawPool(); drawAnswer();
    updateOrderBtns();
  };

  ui.btnClear.onclick = () => {
    if (checked) return;
    pool = shuffle(pool.concat(answer));
    answer = [];
    drawPool(); drawAnswer();
    updateOrderBtns();
  };
}

function updateOrderBtns() {
  ui.btnUndo.disabled = answer.length === 0;
  ui.btnClear.disabled = answer.length === 0;
}

function drawPool() {
  ui.poolBox.innerHTML = "";
  pool.forEach((t, idx) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = t;
    chip.onclick = () => {
      if (checked) return;
      answer.push(pool.splice(idx, 1)[0]);
      drawPool(); drawAnswer();
      updateOrderBtns();
    };
    ui.poolBox.appendChild(chip);
  });
}

function drawAnswer() {
  ui.answerBox.innerHTML = "";
  answer.forEach((t, idx) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = `${idx + 1}. ${t}`;
    chip.onclick = () => {
      if (checked) return;
      pool.push(answer.splice(idx, 1)[0]);
      drawPool(); drawAnswer();
      updateOrderBtns();
    };
    ui.answerBox.appendChild(chip);
  });
}

function checkOrdering(q) {
  const total = q.correctOrder.length;
  if (answer.length < total) {
    setFeedback(`Complete the order first (${answer.length}/${total}).`, false);
    return false;
  }

  let correct = 0;
  for (let i = 0; i < total; i++) {
    if (answer[i] === q.correctOrder[i]) correct++;
  }

  score += correct;
  updatePills(q);

  setFeedback(`Correct positions: <strong>${correct}/${total}</strong> (+${correct})`, correct === total);
  return true;
}

// ---------- Check / Next ----------
function onCheck() {
  if (checked) return;
  const q = currentChapter.questions[qIndex];

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
    renderQuestion();
  } else {
    ui.summaryText.textContent = `${currentChapter.title} finished. Score: ${score}.`;
    show("summary");
  }
}

// ---------- Buttons ----------
ui.btnChapters.onclick = () => { currentChapter = null; show("chapters"); };
ui.btnRestart.onclick = restartChapter;
ui.btnCheck.onclick = onCheck;
ui.btnNext.onclick = onNext;

ui.btnRetry.onclick = () => startChapter(currentChapter.chapterId);
ui.btnBack.onclick = () => { currentChapter = null; show("chapters"); };

// ---------- Init ----------
(async function init() {
  try {
    DATA = await loadData();
    ui.appTitle.textContent = DATA.appTitle || "Management Quiz";
    renderChapters();
  } catch (e) {
    ui.appTitle.textContent = "Failed to load JSON";
    console.error(e);
  }
})();
