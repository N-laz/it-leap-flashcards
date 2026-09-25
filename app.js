/* ITLEAP PRO — flashcards with spaced repetition, quizzes and progress */
(() => {
  const META = [
    ["Python", "devicon-python-plain", "#4f9fe8", "python"],
    ["JavaScript", "devicon-javascript-plain", "#f7df1e", "javascript"],
    ["TypeScript", "devicon-typescript-plain", "#3b8eea", "typescript"],
    ["HTML", "devicon-html5-plain", "#f06a3c", "xml"],
    ["CSS", "devicon-css3-plain", "#3d8fe0", "css"],
    ["React", "devicon-react-original", "#61dafb", "javascript"],
    ["Node.js", "devicon-nodejs-plain", "#6cc24a", "javascript"],
    ["Java", "devicon-java-plain", "#f0893a", "java"],
    ["C", "devicon-c-plain", "#7b9fd4", "c"],
    ["C++", "devicon-cplusplus-plain", "#5b8fd6", "cpp"],
    ["C#", "devicon-csharp-plain", "#a877e0", "csharp"],
    ["PHP", "devicon-php-plain", "#8892d6", "php"],
    ["SQL", "ms:database", "#4fc3d9", "sql"],
    ["MongoDB", "devicon-mongodb-plain", "#4db33d", "javascript"],
    ["Django", "devicon-django-plain", "#3fae84", "python"],
    ["NumPy", "devicon-numpy-plain", "#4dabcf", "python"],
    ["jQuery", "devicon-jquery-plain", "#3f8fd6", "javascript"],
    ["Git", "devicon-git-plain", "#f05133", "bash"],
    ["Linux", "devicon-linux-plain", "#f5c542", "bash"],
    ["Docker", "devicon-docker-plain", "#2496ed", "dockerfile"],
    ["DSA", "ms:account_tree", "#ff7ab6", "python"],
    ["Networking", "ms:lan", "#53ddfc", "bash"],
    ["Cloud & AWS", "ms:cloud", "#ff9f43", "bash"],
    ["Machine Learning", "ms:neurology", "#af88ff", "python"],
  ];
  const RAW = window.CARDS || {};
  const DECKS = META.filter(([n]) => RAW[n]?.length).map(([name, icon, color, lang]) => ({
    name, icon, color, lang,
    cards: RAW[name].map((c, i) => ({ ...c, id: `${name}#${i}`, deck: name })),
  }));
  const ALL = DECKS.flatMap((d) => d.cards);
  const BY_ID = Object.fromEntries(ALL.map((c) => [c.id, c]));
  const deckOf = (n) => DECKS.find((d) => d.name === n);

  /* ---------- persistence (falls back to memory when storage is blocked) ---------- */
  const KEY = "itleap-pro-v2";
  const mem = {};
  const store = {
    get() {
      if (mem[KEY] !== undefined) return mem[KEY];
      try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
    },
    set(v) {
      mem[KEY] = v;
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
    },
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const _stored = store.get() || {};
  const S = {
    srs: {}, saved: [], xp: 0, days: {}, goal: 30, lastDay: null, streak: 0,
    ..._stored,
    quiz: { right: 0, total: 0, ...(_stored.quiz || {}) },
  };
  const save = () => store.set(S);

  /* ---------- spaced repetition (Leitner-style boxes) ---------- */
  const MIN = 60e3, DAY = 864e5;
  const IV = [0, 10 * MIN, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY, 80 * DAY];
  const st = (id) => S.srs[id];
  const isDue = (id) => st(id) && st(id).due <= Date.now();
  const mastered = (id) => (st(id)?.box || 0) >= 4;
  function nextBox(box, r) { return r === 1 ? 0 : r === 2 ? Math.max(1, box) : r === 3 ? Math.min(7, box + 1) : Math.min(7, box + 2); }
  function ivFor(box, r) { return r === 1 ? MIN : r === 2 ? Math.max(5 * MIN, IV[Math.max(1, box)] * 0.5) : IV[nextBox(box, r)]; }
  const fmtIv = (ms) => ms < 3600e3 ? `${Math.round(ms / MIN)}m` : ms < DAY ? `${Math.round(ms / 3600e3)}h` : `${Math.round(ms / DAY)}d`;

  function touchDay(n = 1) {
    const d = today();
    if (S.lastDay !== d) {
      const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
      S.streak = S.lastDay === y ? S.streak + 1 : 1;
      S.lastDay = d;
    }
    S.days[d] = (S.days[d] || 0) + n;
  }
  function addXP(n, el) {
    S.xp += n;
    if (el) {
      const r = el.getBoundingClientRect();
      const f = document.createElement("div");
      f.className = "xp-float"; f.textContent = `+${n} XP`;
      f.style.left = r.left + r.width / 2 - 24 + "px"; f.style.top = r.top - 10 + "px";
      document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
    }
  }
  const level = () => Math.floor(Math.sqrt(S.xp / 60)) + 1;

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const ic = (h) => h.replace(/`([^`]+)`/g, '<code class="ic">$1</code>');
  const fmt = (s) => ic(esc(s));
  const iconHTML = (d) => d.icon.startsWith("ms:") ? `<span class="ms">${d.icon.slice(3)}</span>` : `<i class="${d.icon}"></i>`;
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function codeHTML(code, deck) {
    if (!code) return "";
    const lang = deckOf(deck)?.lang || "plaintext";
    let html = esc(code);
    try { if (window.hljs) html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch {}
    return `<pre class="code"><span class="lang">${esc(lang === "xml" ? "html" : lang)}</span><code>${html}</code></pre>`;
  }
  let toastT;
  function toast(msg, icon = "check_circle") {
    const t = $("#toast"); t.innerHTML = `<span class="ms" style="color:var(--cyan)">${icon}</span>${msg}`; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }
  const lvlTag = (l) => `<span class="tag lvl-${l}">${l}</span>`;

  /* ---------- navigation ---------- */
  let view = "home";
  const CRUMB = { home: ["space_dashboard", "Dashboard"], study: ["style", "Study"], quiz: ["bolt", "Quiz"], browse: ["search", "Browse"], saved: ["bookmark", "Saved"] };
  function go(v) {
    view = v;
    $$(".view").forEach((s) => s.classList.toggle("on", s.id === "view-" + v));
    $$("[data-view]").forEach((a) => a.classList.toggle("on", a.dataset.view === v));
    $("#crumbs").innerHTML = `<span class="ms">${CRUMB[v][0]}</span>${CRUMB[v][1]}`;
    if (v === "home") renderHome();
    if (v === "browse") renderBrowse(true);
    if (v === "saved") renderSaved();
    if (v === "quiz" && !quiz.active) renderQuizSetup();
    if (v === "study" && !sess.queue.length) startSession(sess.deck, sess.lvl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("[data-view]").forEach((a) => a.addEventListener("click", () => go(a.dataset.view)));
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));

  /* ---------- global stats ---------- */
  function renderStats() {
    const learned = Object.keys(S.srs).length;
    const mast = Object.keys(S.srs).filter(mastered).length;
    const due = Object.keys(S.srs).filter(isDue).length;
    const td = S.days[today()] || 0;
    const streak = S.lastDay === today() || S.lastDay === new Date(Date.now() - DAY).toISOString().slice(0, 10) ? S.streak : 0;
    $("#kLearned").textContent = learned.toLocaleString();
    $("#kMastered").textContent = mast.toLocaleString();
    $("#kDue").textContent = due.toLocaleString();
    $("#kAcc").textContent = S.quiz.total ? Math.round((S.quiz.right / S.quiz.total) * 100) + "%" : "—";
    ["#streakTop", "#streakMob", "#streakSide"].forEach((s) => ($(s).textContent = streak));
    ["#xpTop", "#xpMob"].forEach((s) => ($(s).textContent = S.xp.toLocaleString()));
    $("#lvlTop").textContent = level();
    $("#goalNum").textContent = td; $("#goalMax").textContent = S.goal;
    const gp = Math.min(100, Math.round((td / S.goal) * 100));
    $("#goalRing").style.setProperty("--p", gp); $("#goalRing").dataset.v = gp + "%";
    $("#navDue").textContent = due || "";
    $("#navTotal").textContent = ALL.length.toLocaleString();
    $("#navSaved").textContent = S.saved.length || "";
    $("#heroCount").textContent = ALL.length.toLocaleString();
    $("#heroTopics").textContent = DECKS.length;
    $("#heroStudyLabel").textContent = due ? `Review ${due} due card${due > 1 ? "s" : ""}` : learned ? "Continue studying" : "Start studying";
  }

  /* ---------- home ---------- */
  function deckProgress(d) {
    const m = d.cards.filter((c) => mastered(c.id)).length;
    const l = d.cards.filter((c) => st(c.id)).length;
    return { m, l, p: Math.round((m / d.cards.length) * 100) };
  }
  function renderHome() {
    renderStats();
    $("#topicGrid").innerHTML = DECKS.map((d) => {
      const { m, l, p } = deckProgress(d);
      return `<button class="topic" style="--c:${d.color}" data-deck="${esc(d.name)}">
        <div class="topic-top"><div class="t-icon">${iconHTML(d)}</div><div class="ring" style="--p:${p};--c:${d.color}" data-v="${p}%"></div></div>
        <h3>${esc(d.name)}</h3><p>${d.cards.length} cards · ${l} learned · ${m} mastered</p>
        <div class="bar"><i style="width:${Math.max(p, l ? 2 : 0)}%"></i></div></button>`;
    }).join("");
    $$("#topicGrid .topic").forEach((b) => b.addEventListener("click", () => { startSession(b.dataset.deck, "all"); go("study"); }));
  }
  $("#heroStudy").addEventListener("click", () => { startSession("all", "all"); go("study"); });

  function renderNavTopics() {
    $("#navTopics").innerHTML = DECKS.map((d) => `<a data-deck="${esc(d.name)}" style="--c:${d.color}"><span class="t-icon" style="width:22px;height:22px;border-radius:7px;font-size:13px;--c:${d.color}">${iconHTML(d).replace('class="ms"', 'class="ms" style="font-size:14px"').replace(/<i class="([^"]+)"><\/i>/, '<i class="$1" style="font-size:13px"></i>')}</span>${esc(d.name)}<span class="count">${d.cards.length}</span></a>`).join("");
    $$("#navTopics a").forEach((a) => a.addEventListener("click", () => { startSession(a.dataset.deck, "all"); go("study"); }));
  }

  /* ---------- study session ---------- */
  const sess = { deck: "all", lvl: "all", queue: [], i: 0, done: 0, total: 0, flipped: false, savedOnly: false };
  function pool(deck, lvl, savedOnly) {
    let cs = savedOnly ? S.saved.map((id) => BY_ID[id]).filter(Boolean) : deck === "all" ? ALL : deckOf(deck)?.cards || [];
    if (lvl !== "all") cs = cs.filter((c) => c.level === lvl);
    return cs;
  }
  function startSession(deck = "all", lvl = "all", savedOnly = false) {
    Object.assign(sess, { deck, lvl, savedOnly, i: 0, done: 0 });
    const cs = pool(deck, lvl, savedOnly);
    const due = shuffle(cs.filter((c) => isDue(c.id)));
    const fresh = shuffle(cs.filter((c) => !st(c.id)));
    const later = shuffle(cs.filter((c) => st(c.id) && !isDue(c.id)));
    // due reviews first, then new cards; if nothing left, allow extra practice
    sess.queue = (savedOnly ? shuffle(cs) : [...due, ...fresh.slice(0, Math.max(0, 25 - due.length))]);
    if (!sess.queue.length) sess.queue = later.slice(0, 20);
    sess.total = sess.queue.length;
    $("#deckSel").value = savedOnly ? "__saved" : deck;
    $$("#levelChips .chip").forEach((c) => c.classList.toggle("on", c.dataset.lvl === lvl));
    const nDue = due.length, nNew = Math.min(fresh.length, Math.max(0, 25 - due.length));
    $("#sessInfo").textContent = savedOnly ? "saved cards" : nDue || nNew ? `${nDue} due · ${nNew} new` : "extra practice";
    showCard();
  }
  function current() { return sess.queue[sess.i]; }
  function showCard() {
    const area = $("#studyArea");
    const c = current();
    $("#sessPos").textContent = `${Math.min(sess.done, sess.total)}/${sess.total}`;
    $("#sessBar").style.width = (sess.total ? (sess.done / sess.total) * 100 : 0) + "%";
    if (!c) { renderDone(); return; }
    if (area.dataset.done) { area.innerHTML = area._orig; delete area.dataset.done; bindStudy(); }
    const d = deckOf(c.deck);
    const fc = $("#fcard");
    fc.classList.remove("flip", "swipe-l", "swipe-r");
    void fc.offsetWidth; fc.classList.add("enter");
    sess.flipped = false;
    $("#fTopic").innerHTML = `<span style="color:${d.color};display:inline-flex">${iconHTML(d).replace('class="ms"', 'class="ms" style="font-size:14px"').replace(/<i class="([^"]+)"><\/i>/, '<i class="$1" style="font-size:13px"></i>')}</span>${esc(c.deck)}`;
    $("#fLevel").className = `tag lvl-${c.level}`; $("#fLevel").textContent = c.level;
    $("#fQ").innerHTML = fmt(c.q);
    $("#fA").innerHTML = fmt(c.a);
    $("#fCode").innerHTML = codeHTML(c.code, c.deck);
    $("#fSub").textContent = c.sub || "";
    const s = st(c.id);
    $("#fBox").textContent = s ? `Box ${s.box} · seen ${s.seen}×` : "New card";
    const box = s?.box || 0;
    [1, 2, 3, 4].forEach((r) => ($("#iv" + r).textContent = fmtIv(ivFor(box, r))));
    $("#saveBtn").classList.toggle("saved", S.saved.includes(c.id));
    $("#saveBtn .ms").classList.toggle("fill", S.saved.includes(c.id));
    $("#revealRow").hidden = false; $("#rateRow").hidden = true;
  }
  function flip() {
    if (!current()) return;
    sess.flipped = !sess.flipped;
    $("#fcard").classList.toggle("flip", sess.flipped);
    $("#revealRow").hidden = sess.flipped; $("#rateRow").hidden = !sess.flipped;
  }
  function rate(r, el) {
    const c = current(); if (!c || !sess.flipped) return;
    const s = st(c.id) || { box: 0, seen: 0, right: 0 };
    const iv = ivFor(s.box, r);
    s.box = nextBox(s.box, r); s.due = Date.now() + iv; s.seen++; if (r >= 3) s.right++;
    S.srs[c.id] = s;
    touchDay(); addXP([0, 2, 5, 10, 15][r], el);
    const fc = $("#fcard"); fc.classList.remove("enter"); fc.classList.add(r === 1 ? "swipe-l" : "swipe-r");
    if (r === 1) sess.queue.splice(Math.min(sess.queue.length, sess.i + 4), 0, c); else sess.done++;
    if (r === 1) sess.total = Math.max(sess.total, sess.done + (sess.queue.length - sess.i - 1));
    sess.i++;
    save(); renderStats();
    const td = S.days[today()];
    if (td === S.goal) { celebrate(); toast(`Daily goal reached — ${S.goal} cards!`, "emoji_events"); }
    setTimeout(showCard, 360);
  }
  function skip() {
    const c = current(); if (!c) return;
    if (sess.queue.length === 1) { sess.done++; sess.i++; }
    else { sess.queue.splice(sess.i, 1); sess.queue.push(c); }
    const fc = $("#fcard"); fc.classList.add("swipe-l"); setTimeout(showCard, 360);
  }
  function toggleSave(id) {
    const i = S.saved.indexOf(id);
    if (i >= 0) { S.saved.splice(i, 1); toast("Removed from saved", "bookmark_remove"); } else { S.saved.push(id); toast("Saved for later", "bookmark_added"); }
    save(); renderStats();
  }
  function renderDone() {
    const area = $("#studyArea");
    if (!area.dataset.done) { area._orig = area._orig || area.innerHTML; area.dataset.done = "1"; }
    const dueLeft = pool(sess.deck, sess.lvl, sess.savedOnly).filter((c) => isDue(c.id)).length;
    area.innerHTML = `<div class="done"><div class="big">🎉</div><h2>Session complete</h2>
      <p>You reviewed ${sess.done} card${sess.done === 1 ? "" : "s"}. ${dueLeft ? `${dueLeft} more are due now.` : "Come back later — cards will return right before you forget them."}</p>
      <div class="hero-actions" style="justify-content:center"><button class="btn btn-primary" id="againBtn"><span class="ms">replay</span>Keep going</button><button class="btn btn-ghost" id="toQuiz"><span class="ms">bolt</span>Test yourself</button></div></div>`;
    $("#againBtn").onclick = () => startSession(sess.deck, sess.lvl, sess.savedOnly);
    $("#toQuiz").onclick = () => { quizCfg.deck = sess.deck === "all" ? "all" : sess.deck; go("quiz"); };
    if (sess.done) celebrate();
  }
  function bindStudy() {
    $("#fcard").onclick = flip;
    $("#revealBtn").onclick = flip;
    $("#skipBtn").onclick = skip;
    $("#saveBtn").onclick = (e) => { e.stopPropagation(); const c = current(); if (c) { toggleSave(c.id); showSaveState(); } };
    $$("#rateRow button").forEach((b) => (b.onclick = () => rate(+b.dataset.r, b)));
    // swipe on touch
    let x0 = null;
    $("#fcard").addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    $("#fcard").addEventListener("touchend", (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 70 && sess.flipped) rate(dx > 0 ? 3 : 1, $("#rateRow"));
    });
  }
  function showSaveState() { const c = current(); if (!c) return; const on = S.saved.includes(c.id); $("#saveBtn").classList.toggle("saved", on); $("#saveBtn .ms").classList.toggle("fill", on); }

  function fillDeckSelects() {
    const opts = DECKS.map((d) => `<option value="${esc(d.name)}">${esc(d.name)} (${d.cards.length})</option>`).join("");
    $("#deckSel").innerHTML = `<option value="all">All topics (${ALL.length})</option>${opts}<option value="__saved">★ Saved cards</option>`;
    $("#browseDeck").innerHTML = `<option value="all">All topics</option>${opts}`;
  }
  $("#deckSel").addEventListener("change", (e) => e.target.value === "__saved" ? startSession("all", sess.lvl, true) : startSession(e.target.value, sess.lvl));
  $$("#levelChips .chip").forEach((c) => c.addEventListener("click", () => startSession(sess.deck, c.dataset.lvl, sess.savedOnly)));

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input,select,textarea")) return;
    if (view === "study") {
      if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); flip(); }
      else if (["1", "2", "3", "4"].includes(e.key)) rate(+e.key, $(`#rateRow [data-r="${e.key}"]`));
      else if (e.key === "ArrowRight") skip();
      else if (e.key.toLowerCase() === "s") { const c = current(); if (c) { toggleSave(c.id); showSaveState(); } }
    } else if (view === "quiz" && quiz.active && !quiz.answered) {
      const n = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[e.key.toLowerCase()];
      if (n != null) $$(".opt")[n]?.click();
    } else if (view === "quiz" && quiz.active && quiz.answered && (e.key === "Enter" || e.code === "Space")) { e.preventDefault(); $("#nextQ")?.click(); }
  });

  /* ---------- quiz ---------- */
  const quizCfg = { deck: "all", n: 10, lvl: "all", timed: true };
  const quiz = { active: false, qs: [], i: 0, right: 0, combo: 0, best: 0, wrong: [], answered: false, timer: null, t0: 0 };
  const QTIME = 25;
  function renderQuizSetup() {
    quiz.active = false;
    $("#quizArea").innerHTML = `<div class="quiz-setup">
      <span class="tag"><span class="ms" style="font-size:14px;color:var(--amber)">bolt</span>Quiz mode</span>
      <h1 class="hero" style="font-size:clamp(28px,3.4vw,40px);margin-top:14px">Test what you <em>really</em> know.</h1>
      <p class="lead">Multiple-choice questions pulled from the deck. Build combos for bonus XP — every mistake is added to your review queue.</p>
      <div class="setup-grid">
        <div class="field"><label>Topic</label><select class="select" id="qzDeck"><option value="all">All topics</option>${DECKS.map((d) => `<option ${quizCfg.deck === d.name ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Difficulty</label><select class="select" id="qzLvl"><option value="all">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
        <div class="field"><label>Questions</label><div class="seg" id="qzN">${[10, 20, 30].map((n) => `<button class="chip ${quizCfg.n === n ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}</div></div>
        <div class="field"><label>Timer</label><div class="seg" id="qzT"><button class="chip ${quizCfg.timed ? "on" : ""}" data-t="1">${QTIME}s per question</button><button class="chip ${!quizCfg.timed ? "on" : ""}" data-t="0">Relaxed</button></div></div>
      </div>
      <button class="btn btn-primary" id="qzStart" style="height:52px;padding:0 28px"><span class="ms">play_arrow</span>Start quiz</button>
    </div>`;
    $("#qzDeck").value = quizCfg.deck; $("#qzLvl").value = quizCfg.lvl;
    $$("#qzN .chip").forEach((b) => (b.onclick = () => { quizCfg.n = +b.dataset.n; $$("#qzN .chip").forEach((x) => x.classList.toggle("on", x === b)); }));
    $$("#qzT .chip").forEach((b) => (b.onclick = () => { quizCfg.timed = b.dataset.t === "1"; $$("#qzT .chip").forEach((x) => x.classList.toggle("on", x === b)); }));
    $("#qzStart").onclick = () => { quizCfg.deck = $("#qzDeck").value; quizCfg.lvl = $("#qzLvl").value; startQuiz(); };
  }
  function startQuiz() {
    let cs = quizCfg.deck === "all" ? ALL : deckOf(quizCfg.deck).cards;
    if (quizCfg.lvl !== "all") cs = cs.filter((c) => c.level === quizCfg.lvl);
    const picked = shuffle(cs).slice(0, quizCfg.n);
    quiz.qs = picked.map((c) => {
      const deckCards = deckOf(c.deck).cards.filter((x) => x.id !== c.id && x.a !== c.a);
      const same = shuffle(deckCards.filter((x) => x.sub === c.sub || x.level === c.level));
      let distract = [...new Set([...same, ...shuffle(deckCards)].map((x) => x.a))].slice(0, 3);
      if (distract.length < 3) {
        const backup = shuffle(ALL.filter((x) => x.id !== c.id && x.a !== c.a && !distract.includes(x.a)).map((x) => x.a));
        distract = [...new Set([...distract, ...backup])].slice(0, 3);
      }
      const opts = shuffle([c.a, ...distract]);
      return { c, opts, ans: opts.indexOf(c.a) };
    });
    Object.assign(quiz, { active: true, i: 0, right: 0, combo: 0, best: 0, wrong: [] });
    showQ();
  }
  function showQ() {
    clearInterval(quiz.timer);
    const q = quiz.qs[quiz.i];
    if (!q) return quizResult();
    quiz.answered = false;
    const d = deckOf(q.c.deck);
    $("#quizArea").innerHTML = `<div class="q-card">
      <div class="q-meta"><span>Question ${quiz.i + 1} / ${quiz.qs.length}</span><span>${quiz.combo >= 2 ? `<span class="combo"><span class="ms fill" style="font-size:16px">local_fire_department</span>${quiz.combo}× combo</span>` : `${quiz.right} correct`}</span></div>
      <div class="timer"><i id="qTimer" style="transform:scaleX(1)"></i></div>
      <div style="display:flex;gap:8px;margin-bottom:14px"><span class="tag"><span style="color:${d.color};display:inline-flex">${iconHTML(d).replace('class="ms"', 'class="ms" style="font-size:14px"').replace(/<i class="([^"]+)"><\/i>/, '<i class="$1" style="font-size:13px"></i>')}</span>${esc(q.c.deck)}</span>${lvlTag(q.c.level)}</div>
      <h2 class="q-text">${fmt(q.c.q)}</h2>
      <div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${"ABCD"[k]}</span><span>${fmt(o)}</span></button>`).join("")}</div>
      <div id="qAfter"></div></div>`;
    $$(".opt").forEach((b) => (b.onclick = () => answer(+b.dataset.k)));
    if (quizCfg.timed) {
      quiz.t0 = Date.now();
      quiz.timer = setInterval(() => {
        const left = 1 - (Date.now() - quiz.t0) / (QTIME * 1000);
        const el = $("#qTimer"); if (el) el.style.transform = `scaleX(${Math.max(0, left)})`;
        if (left <= 0) answer(-1);
      }, 100);
    } else $("#qTimer").parentElement.style.visibility = "hidden";
  }
  function answer(k) {
    if (quiz.answered) return;
    quiz.answered = true; clearInterval(quiz.timer);
    const q = quiz.qs[quiz.i];
    const ok = k === q.ans;
    $$(".opt").forEach((b, j) => { b.disabled = true; if (j === q.ans) b.classList.add("ok"); else if (j === k) b.classList.add("bad"); });
    S.quiz.total++;
    if (ok) {
      quiz.right++; quiz.combo++; quiz.best = Math.max(quiz.best, quiz.combo); S.quiz.right++;
      addXP(10 + Math.min(10, (quiz.combo - 1) * 2), $$(".opt")[k]);
    } else {
      quiz.combo = 0; quiz.wrong.push({ q, k });
      const s = S.srs[q.c.id] || { box: 0, seen: 0, right: 0 }; s.box = 0; s.due = Date.now(); S.srs[q.c.id] = s;
    }
    touchDay(0); save(); renderStats();
    const last = quiz.i === quiz.qs.length - 1;
    $("#qAfter").innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;flex-wrap:wrap">
      <span style="font-size:14px;color:${ok ? "var(--green)" : "var(--red)"};font-weight:600;display:inline-flex;gap:6px;align-items:center"><span class="ms fill">${ok ? "check_circle" : k === -1 ? "timer_off" : "cancel"}</span>${ok ? "Correct!" : k === -1 ? "Time's up" : "Not quite — added to your review queue"}</span>
      <button class="btn btn-primary btn-sm" id="nextQ">${last ? "See results" : "Next question"}<span class="ms">arrow_forward</span></button></div>
      ${q.c.code ? codeHTML(q.c.code, q.c.deck).replace('class="code"', 'class="code" style="margin-top:14px"') : ""}`;
    $("#nextQ").onclick = () => { quiz.i++; showQ(); };
  }
  function quizResult() {
    quiz.active = false;
    const pct = Math.round((quiz.right / quiz.qs.length) * 100);
    const msg = pct >= 90 ? "Outstanding. You're interview-ready." : pct >= 70 ? "Strong work — a little more review and you've got it." : pct >= 40 ? "Good start. Your mistakes are queued for review." : "Every expert started here. Review and try again.";
    $("#quizArea").innerHTML = `<div class="quiz-setup result">
      <div class="score-ring" style="--p:${pct}"><div><span>${pct}%<small>${quiz.right} / ${quiz.qs.length} correct</small></span></div></div>
      <h2 class="h2" style="font-size:24px">${msg}</h2>
      <p class="lead" style="margin:8px auto 0">Best combo: ${quiz.best}× · Total XP: ${S.xp.toLocaleString()}</p>
      <div class="hero-actions" style="justify-content:center"><button class="btn btn-primary" id="qzAgain"><span class="ms">replay</span>Play again</button><button class="btn btn-ghost" id="qzNew"><span class="ms">tune</span>New settings</button>${quiz.wrong.length ? `<button class="btn btn-ghost" id="qzReview"><span class="ms">style</span>Review mistakes</button>` : ""}</div>
      ${quiz.wrong.length ? `<div class="mistakes"><h3 class="h2" style="font-size:16px;margin-bottom:4px">Review your mistakes</h3>${quiz.wrong.map(({ q, k }) => `<div class="mistake"><b>${fmt(q.c.q)}</b>${k >= 0 ? `<p>Your answer: ${fmt(q.opts[k])}</p>` : `<p>No answer (time ran out)</p>`}<p class="ok">Correct: ${fmt(q.c.a)}</p></div>`).join("")}</div>` : ""}
    </div>`;
    if (pct >= 70) celebrate();
    $("#qzAgain").onclick = startQuiz;
    $("#qzNew").onclick = renderQuizSetup;
    const rv = $("#qzReview"); if (rv) rv.onclick = () => { startSession(quizCfg.deck, "all"); go("study"); };
  }

  /* ---------- browse ---------- */
  let shown = 40;
  function rowHTML(c, term) {
    const d = deckOf(c.deck);
    const hl = (s) => { const e = esc(s); if (!term) return e; const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"); return e.replace(re, '<mark class="mark">$1</mark>'); };
    const hf = (s) => ic(hl(s));
    const saved = S.saved.includes(c.id);
    return `<div class="row" data-id="${esc(c.id)}"><button class="row-head"><span class="t-icon" style="--c:${d.color}">${iconHTML(d)}</span><span class="row-q">${hf(c.q)}</span><span class="row-meta">${lvlTag(c.level)}${mastered(c.id) ? '<span class="ms fill" style="color:var(--green);font-size:18px" title="Mastered">verified</span>' : ""}<span class="ms chev">expand_more</span></span></button>
      <div class="row-body"><div>${hf(c.a)}</div>${codeHTML(c.code, c.deck)}<div style="display:flex;gap:8px;margin-top:12px;align-items:center"><span class="tag">${esc(c.deck)}${c.sub ? " · " + esc(c.sub) : ""}</span><button class="btn btn-ghost btn-sm save-row" style="margin-left:auto"><span class="ms ${saved ? "fill" : ""}" style="${saved ? "color:var(--amber)" : ""}">bookmark</span>${saved ? "Saved" : "Save"}</button></div></div></div>`;
  }
  function bindRow(r) {
    $(".row-head", r).onclick = () => r.classList.toggle("open");
    $(".save-row", r).onclick = () => {
      toggleSave(r.dataset.id);
      if (view === "saved") return renderSaved();
      const n = document.createElement("div"); n.innerHTML = rowHTML(BY_ID[r.dataset.id], $("#q").value.trim().toLowerCase());
      const nr = n.firstElementChild; if (r.classList.contains("open")) nr.classList.add("open");
      r.replaceWith(nr); bindRow(nr);
    };
  }
  function bindRows(root) { $$(".row", root).forEach(bindRow); }
  function renderBrowse(reset) {
    if (reset) shown = 40;
    const term = $("#q").value.trim().toLowerCase();
    const dk = $("#browseDeck").value, lv = $("#browseLvl").value;
    let cs = dk === "all" ? ALL : deckOf(dk).cards;
    if (lv !== "all") cs = cs.filter((c) => c.level === lv);
    if (term) cs = cs.filter((c) => (c.q + " " + c.a + " " + (c.code || "") + " " + (c.sub || "")).toLowerCase().includes(term));
    $("#browseCount").textContent = `${cs.length.toLocaleString()} card${cs.length === 1 ? "" : "s"}`;
    const list = $("#browseList");
    list.innerHTML = cs.length ? cs.slice(0, shown).map((c) => rowHTML(c, term)).join("") : `<div class="empty">No cards match “${esc(term)}”. Try another keyword.</div>`;
    bindRows(list);
    $("#moreBtn").parentElement.style.display = cs.length > shown ? "flex" : "none";
  }
  let qT; $("#q").addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(() => renderBrowse(true), 150); });
  $("#browseDeck").addEventListener("change", () => renderBrowse(true));
  $("#browseLvl").addEventListener("change", () => renderBrowse(true));
  $("#moreBtn").addEventListener("click", () => { shown += 40; renderBrowse(false); });

  function renderSaved() {
    const cs = S.saved.map((id) => BY_ID[id]).filter(Boolean);
    $("#savedList").innerHTML = cs.length ? cs.map((c) => rowHTML(c, "")).join("") : `<div class="empty"><span class="ms" style="font-size:32px;display:block;margin-bottom:8px">bookmark</span>No saved cards yet. Tap the bookmark on any card to save it here.</div>`;
    bindRows($("#savedList"));
    $("#studySaved").disabled = !cs.length;
  }
  $("#studySaved").addEventListener("click", () => { startSession("all", "all", true); go("study"); });

  /* ---------- celebration ---------- */
  function celebrate() {
    if (!window.confetti || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors: ["#53ddfc", "#af88ff", "#ff7ab6", "#4ade9b"] });
  }

  /* ---------- init ---------- */
  fillDeckSelects();
  renderNavTopics();
  bindStudy();
  renderHome();
  $("#q").placeholder = `Search ${ALL.length.toLocaleString()} questions and answers…`;
})();