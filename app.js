(() => {
  "use strict";

  const DEMO_USER = "demo";
  const DEMO_PASS = "kangai2026";
  const AUTH_KEY = "kangai_auth";
  const STORE_KEY = "kangai_diaries";

  const seed = window.YouaiSeed;
  if (!seed) {
    console.error("data.js missing");
    return;
  }
  const ME = seed.ME_ID;
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

  const state = {
    view: "login",
    diaries: [],
    currentId: null,
    draftPhotos: [],
    draftMood: null,
    mediaRecorder: null,
    audioChunks: [],
    recording: false,
    posts: [],
    comments: [],
    joinedCircleIds: [],
    likedPostIds: [],
    huggedPostIds: [],
    followedUserIds: [],
    seenResponseIds: [],
    topicFilter: "all",
    csub: "feed",
    currentPostId: null,
    currentCircleId: null,
    currentProfileId: null,
    draftTopicId: null,
    editTopicId: null,
    backFromPost: "community",
    bookFilter: "all",
    feedLoadedOnce: false,
    expanded: {},
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function toast(msg, ms = 2200) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms);
  }

  const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === "1";
  function setAuthed(ok) {
    if (ok) sessionStorage.setItem(AUTH_KEY, "1");
    else sessionStorage.removeItem(AUTH_KEY);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const uid = (prefix) => (prefix || "id") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const paras = (body) =>
    (body || "").split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");

  /* ========== Date helpers ========== */
  const dayKey = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  function formatDateTitle(iso) {
    const d = new Date(iso);
    return `「${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEKDAYS[d.getDay()]}」`;
  }
  function formatMeta(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEKDAYS[d.getDay()]}`;
  }
  function formatDayHead(iso) {
    const k = dayKey(iso);
    const today = dayKey(new Date().toISOString());
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (k === today) return "今天 · " + formatMeta(iso);
    if (k === dayKey(y.toISOString())) return "昨天 · " + formatMeta(iso);
    return formatMeta(iso);
  }
  function formatRelative(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "刚刚";
    if (m < 60) return m + " 分钟前";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " 小时前";
    const d = Math.floor(h / 24);
    if (d === 1) return "昨天";
    if (d < 7) return d + " 天前";
    return formatMeta(iso);
  }

  /* ========== Lookups ========== */
  const getUser = (id) => seed.users.find((u) => u.id === id) || seed.users[0];
  const getTopic = (id) => seed.topics.find((t) => t.id === id);
  const getCircle = (id) => seed.circles.find((c) => c.id === id);
  const getMood = (id) => seed.MOODS.find((m) => m.id === id);
  const commentsOf = (postId) =>
    state.comments.filter((c) => c.postId === postId).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  const commentCount = (postId) => state.comments.filter((c) => c.postId === postId).length;
  const myPosts = () => state.posts.filter((p) => p.userId === ME && p.visibility === "public");
  const postOfDiary = (diaryId) => state.posts.find((p) => p.diaryId === diaryId && p.userId === ME);

  /* ========== Persistence ========== */
  function loadDiaries() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      state.diaries = raw ? JSON.parse(raw) : [];
    } catch {
      state.diaries = [];
    }
  }
  const saveDiaries = () => localStorage.setItem(STORE_KEY, JSON.stringify(state.diaries));

  function seedDiaries() {
    const own = state.diaries.filter((d) => !/^seed-|^d-seed-/.test(d.id));
    state.diaries = [...own, ...clone(seed.diaries)];
    saveDiaries();
    localStorage.setItem(seed.DIARY_SEED_FLAG, "1");
  }
  function ensureDiarySeed() {
    loadDiaries();
    if (!localStorage.getItem(seed.DIARY_SEED_FLAG)) seedDiaries();
  }

  function loadCommunity() {
    (seed.LEGACY_KEYS || []).forEach((k) => localStorage.removeItem(k));
    try {
      const raw = localStorage.getItem(seed.COMMUNITY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state.posts = data.posts || clone(seed.posts);
        state.comments = data.comments || clone(seed.comments);
        state.joinedCircleIds = data.joinedCircleIds || ["c-1", "c-4"];
        state.likedPostIds = data.likedPostIds || [];
        state.huggedPostIds = data.huggedPostIds || [];
        state.followedUserIds = data.followedUserIds || [];
        state.seenResponseIds = data.seenResponseIds || [];
        syncFlags();
        return;
      }
    } catch (e) {
      console.warn(e);
    }
    seedCommunity();
  }
  function seedCommunity() {
    state.posts = clone(seed.posts);
    state.comments = clone(seed.comments);
    state.joinedCircleIds = ["c-1", "c-4"];
    state.likedPostIds = seed.posts.filter((p) => p.likedByMe).map((p) => p.id);
    state.huggedPostIds = [];
    state.followedUserIds = ["u-1", "u-4"];
    const mine = new Set(seed.posts.filter((p) => p.userId === ME).map((p) => p.id));
    const resp = seed.comments.filter((c) => mine.has(c.postId)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    state.seenResponseIds = resp.slice(2).map((c) => c.id);
    syncFlags();
    saveCommunity();
  }
  function syncFlags() {
    state.posts.forEach((p) => {
      p.likedByMe = state.likedPostIds.includes(p.id);
      p.huggedByMe = state.huggedPostIds.includes(p.id);
      if (p.hugCount == null) p.hugCount = 0;
    });
  }
  function saveCommunity() {
    localStorage.setItem(
      seed.COMMUNITY_KEY,
      JSON.stringify({
        seeded: true,
        posts: state.posts,
        comments: state.comments,
        joinedCircleIds: state.joinedCircleIds,
        likedPostIds: state.likedPostIds,
        huggedPostIds: state.huggedPostIds,
        followedUserIds: state.followedUserIds,
        seenResponseIds: state.seenResponseIds,
      })
    );
  }

  /* ========== Recorder stats ========== */
  function recordStats() {
    const days = new Set(state.diaries.map((d) => dayKey(d.createdAt)));
    const cur = new Date();
    const todayDone = days.has(dayKey(cur.toISOString()));
    if (!todayDone) cur.setDate(cur.getDate() - 1);
    let streak = 0;
    while (days.has(dayKey(cur.toISOString()))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    const weekAgo = Date.now() - 7 * 864e5;
    const week = state.diaries.filter((d) => new Date(d.createdAt).getTime() >= weekAgo).length;
    return { streak, todayDone, week, total: state.diaries.length, shared: state.diaries.filter((d) => d.visibility === "public").length };
  }
  function moodWeekHtml() {
    const cells = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d.toISOString());
      const items = state.diaries.filter((x) => dayKey(x.createdAt) === k);
      const mood = items.map((x) => getMood(x.mood)).filter(Boolean)[0];
      cells.push(`<div class="mw-cell${items.length ? " on" : ""}${i === 0 ? " today" : ""}">
        <span class="mw-emoji">${mood ? mood.emoji : items.length ? "📝" : "·"}</span>
        <span class="mw-day">${i === 0 ? "今天" : "周" + WEEKDAYS[d.getDay()]}</span></div>`);
    }
    const counts = {};
    state.diaries
      .filter((x) => new Date(x.createdAt).getTime() >= Date.now() - 7 * 864e5 && x.mood)
      .forEach((x) => { counts[x.mood] = (counts[x.mood] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const tm = top && getMood(top[0]);
    const summary = tm ? `这一周你最常感到「${tm.emoji} ${tm.name}」。每一种心情都值得被记下。` : "记下心情后，这里会出现你的一周心情。";
    return `<div class="mw-row">${cells.join("")}</div><p class="mw-sum">${summary}</p>`;
  }

  /* ========== Responses (sharer value) ========== */
  function myResponses() {
    const ids = new Set(myPosts().map((p) => p.id));
    return state.comments
      .filter((c) => ids.has(c.postId) && c.userId !== ME)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const unseenResponses = () => myResponses().filter((c) => !state.seenResponseIds.includes(c.id));
  function markResponsesSeen() {
    myResponses().forEach((c) => {
      if (!state.seenResponseIds.includes(c.id)) state.seenResponseIds.push(c.id);
    });
    saveCommunity();
  }
  function responseItemHtml(c) {
    const u = getUser(c.userId);
    const p = state.posts.find((x) => x.id === c.postId);
    const isNew = !state.seenResponseIds.includes(c.id);
    return `<button type="button" class="resp-item" data-post="${c.postId}">
      <img class="avatar sm" src="${u.avatar}" alt="" />
      <div>
        <p class="resp-head"><strong>${escapeHtml(u.nickname)}</strong> 回应了「${escapeHtml(p ? p.title : "")}」${isNew ? '<span class="new-dot">新</span>' : ""}</p>
        <p class="resp-body">${escapeHtml(c.body)}</p>
        <span class="meta">${formatRelative(c.createdAt)}</span>
      </div></button>`;
  }
  function bindRespItems(root) {
    $$(".resp-item", root).forEach((b) => b.addEventListener("click", () => openPost(b.dataset.post)));
  }

  /* ========== Views ========== */
  function showView(name) {
    state.view = name;
    $$(".view").forEach((v) => { v.hidden = true; });
    const el = $("#view-" + name);
    if (el) el.hidden = false;
    window.scrollTo(0, 0);
    syncTabs(name);
    const r = {
      home: renderHome, community: renderCommunity, post: renderPost, circle: renderCircle,
      profile: renderProfile, book: renderBook, diary: renderDiary, share: renderShare,
      me: renderMe, record: renderRecord,
    }[name];
    if (r) r();
  }
  function syncTabs(name) {
    const tabName =
      name === "post" || name === "circle" || name === "profile" ? "community"
        : name === "diary" || name === "share" ? "book" : name;
    $$(".tab-bar .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tabName));
    const n = unseenResponses().length;
    $$('.tab-bar .tab[data-tab="me"]').forEach((t) => {
      let dot = t.querySelector(".tab-dot");
      if (n && !dot) {
        dot = document.createElement("i");
        dot.className = "tab-dot";
        t.appendChild(dot);
      }
      if (dot) { dot.hidden = !n; dot.textContent = n > 9 ? "9+" : n; }
    });
  }

  /* ========== Home ========== */
  function renderHome() {
    const h = new Date().getHours();
    const hi = h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
    $("#home-greeting").textContent = `${hi}，今天也记录一点点`;

    const s = recordStats();
    $("#home-streak").innerHTML = `
      <div class="sk-main">
        <span class="sk-num">${s.streak}</span><span class="sk-unit">天</span>
        <div class="sk-text">
          <strong>连续记录</strong>
          <span>${s.todayDone ? "今天已记录，明天见 🌿" : s.streak ? `今天记一笔，就是第 ${s.streak + 1} 天` : "从今天开始，每天一句就好"}</span>
        </div>
      </div>
      <div class="sk-sub">
        <span>本周 <b>${s.week}</b> 篇</span><span>共 <b>${s.total}</b> 篇</span><span>已分享 <b>${s.shared}</b> 篇</span>
        <span class="sk-link">心情回顾 ›</span>
      </div>`;
    $("#home-hero-text").textContent = s.todayDone
      ? "今天已经记过啦。想再补一句、换个心情，也可以再写一记。"
      : "不用写很多，记一句话、一张图、一个心情就好。";

    const box = $("#home-responses");
    const resp = myResponses();
    const unseen = unseenResponses();
    if (resp.length) {
      const likes = myPosts().reduce((a, p) => a + (p.likeCount || 0), 0);
      const hugs = myPosts().reduce((a, p) => a + (p.hugCount || 0), 0);
      box.hidden = false;
      box.innerHTML = `
        <div class="resp-top">
          <strong>💌 你的分享被接住了</strong>
          <span class="muted">${unseen.length ? `${unseen.length} 条新回应` : "看看大家说了什么"}</span>
        </div>
        <p class="resp-stat">♥ ${likes} 个赞 · 🤗 ${hugs} 个抱抱 · 💬 ${resp.length} 条留言</p>
        ${resp.slice(0, 2).map(responseItemHtml).join("")}
        <button type="button" class="link-btn block" id="home-resp-more">查看全部回应 ›</button>`;
      bindRespItems(box);
      $("#home-resp-more").addEventListener("click", () => showView("me"));
    } else box.hidden = true;

    const picks = state.posts.filter((p) => p.featured && p.visibility === "public").slice(0, 4);
    $("#home-picks").innerHTML = picks
      .map((p) => {
        const u = getUser(p.userId);
        const bg = p.images[0] ? `<img src="${p.images[0]}" alt="" />` : `<div class="pick-ph">${(getTopic(p.topicIds[0]) || {}).emoji || "🌿"}</div>`;
        return `<button type="button" class="pick-card" data-post="${p.id}">${bg}
          <div class="pick-body"><h4>${escapeHtml(p.title)}</h4>
          <p><img class="avatar xs" src="${u.avatar}" alt="" />${escapeHtml(u.nickname)} · ♥ ${p.likeCount} · 💬 ${commentCount(p.id)}</p></div></button>`;
      })
      .join("");
    $$("#home-picks .pick-card").forEach((b) => b.addEventListener("click", () => openPost(b.dataset.post)));

    const list = $("#diary-list");
    list.innerHTML = "";
    const items = sortedDiaries().slice(0, 3);
    $("#empty-hint").hidden = items.length > 0;
    items.forEach((d) => list.appendChild(makeDiaryCard(d)));
  }

  const sortedDiaries = () => [...state.diaries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  /* ========== Book ========== */
  function renderBook() {
    const s = recordStats();
    $("#book-stats").innerHTML = `
      <div><b>${s.total}</b><span>篇日记</span></div>
      <div><b>${s.streak}</b><span>连续天数</span></div>
      <div><b>${s.week}</b><span>本周</span></div>
      <div><b>${s.shared}</b><span>已进社区</span></div>`;
    $("#book-mood").innerHTML = moodWeekHtml();
    const filters = [
      { id: "all", name: "全部" },
      { id: "private", name: "🔒 仅自己" },
      { id: "public", name: "🌿 已进社区" },
    ];
    $("#book-filter").innerHTML = filters
      .map((f) => `<button type="button" class="topic-chip${state.bookFilter === f.id ? " active" : ""}" data-f="${f.id}">${f.name}</button>`)
      .join("");
    $$("#book-filter .topic-chip").forEach((b) =>
      b.addEventListener("click", () => { state.bookFilter = b.dataset.f; renderBook(); })
    );
    const list = $("#book-list");
    list.innerHTML = "";
    let items = sortedDiaries();
    if (state.bookFilter !== "all") items = items.filter((d) => (d.visibility || "private") === state.bookFilter);
    if (!items.length) {
      list.innerHTML = `<p class="empty-hint">${state.bookFilter === "public" ? "还没有分享到社区的日记。被看见也是一种力量，挑一篇试试？" : state.bookFilter === "private" ? "没有仅自己可见的日记。" : "日记本还是空的，去写一记吧。"}</p>`;
      return;
    }
    let lastDay = "";
    items.forEach((d) => {
      const k = dayKey(d.createdAt);
      if (k !== lastDay) {
        lastDay = k;
        const h = document.createElement("p");
        h.className = "day-head";
        h.textContent = formatDayHead(d.createdAt);
        list.appendChild(h);
      }
      list.appendChild(makeDiaryCard(d, true));
    });
  }

  function makeDiaryCard(d, withToggle) {
    const wrap = document.createElement("div");
    wrap.className = "diary-card-wrap";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diary-card";
    const thumb = d.images && d.images[0]
      ? `<img class="thumb" src="${d.images[0]}" alt="" />`
      : `<div class="thumb placeholder">${(getMood(d.mood) || {}).emoji || "🌿"}</div>`;
    const excerpt = (d.body || "").replace(/\n+/g, " ").slice(0, 60);
    const pub = d.visibility === "public";
    const post = pub ? postOfDiary(d.id) : null;
    const mood = getMood(d.mood);
    btn.innerHTML = `
      ${thumb}
      <div>
        <h3>${escapeHtml(d.title || "无题")}</h3>
        <div class="meta">${formatMeta(d.createdAt)}${mood ? ` · ${mood.emoji} ${mood.name}` : ""}</div>
        <div class="excerpt">${escapeHtml(excerpt)}</div>
        <div class="card-foot">
          <span class="vis-tag ${pub ? "pub" : "priv"}">${pub ? "🌿 已进社区" : "🔒 仅自己"}</span>
          ${post ? `<span class="resp-mini">♥ ${post.likeCount} · 🤗 ${post.hugCount || 0} · 💬 ${commentCount(post.id)}</span>` : ""}
        </div>
      </div>`;
    btn.addEventListener("click", () => { state.currentId = d.id; showView("diary"); });
    wrap.appendChild(btn);
    if (withToggle) {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "vis-toggle";
      t.textContent = pub ? "改为仅自己" : "分享到社区";
      t.addEventListener("click", (e) => {
        e.stopPropagation();
        quickToggleVisibility(d, () => renderBook());
      });
      wrap.appendChild(t);
    }
    return wrap;
  }

  function quickToggleVisibility(d, after) {
    if (d.visibility === "public") {
      d.visibility = "private";
      d.topicIds = [];
      saveDiaries();
      unpublishDiaryFromCommunity(d.id);
      toast("已改为仅自己可见，社区里不再显示");
      after && after();
      return;
    }
    pickTopicSheet(d.topicIds && d.topicIds[0], (topicId) => {
      d.visibility = "public";
      d.topicIds = [topicId];
      saveDiaries();
      const post = publishDiaryToCommunity(d);
      const t = getTopic(topicId);
      toast(`已分享到「${t.emoji} ${t.name}」，同路人能看到了`);
      simulateResponse(post);
      after && after();
    });
  }

  /* ========== Sheet ========== */
  function openSheet(html, onMount) {
    $("#sheet-body").innerHTML = html;
    $("#sheet").hidden = false;
    onMount && onMount($("#sheet-body"));
  }
  const closeSheet = () => { $("#sheet").hidden = true; };

  function topicChipsHtml(activeId) {
    return seed.topics
      .map((t) => `<button type="button" class="topic-chip${activeId === t.id ? " active" : ""}" data-topic="${t.id}">${t.emoji} ${escapeHtml(t.name)}</button>`)
      .join("");
  }

  function pickTopicSheet(preset, onPick) {
    let chosen = preset || null;
    openSheet(
      `<h3 class="sheet-title">分享到哪个话题？</h3>
       <p class="sheet-sub">选一个话题，同路人更容易找到你的分享。随时可以改回「仅自己」。</p>
       <div class="topic-chips compact" id="sheet-topics">${topicChipsHtml(chosen)}</div>
       <div class="sheet-actions"><button type="button" class="btn-ghost" data-close>取消</button>
       <button type="button" class="btn-primary" id="sheet-ok">分享</button></div>`,
      (root) => {
        $("#sheet-topics", root).addEventListener("click", (e) => {
          const c = e.target.closest(".topic-chip");
          if (!c) return;
          chosen = c.dataset.topic;
          $("#sheet-topics").innerHTML = topicChipsHtml(chosen);
        });
        $("[data-close]", root).addEventListener("click", closeSheet);
        $("#sheet-ok", root).addEventListener("click", () => {
          if (!chosen) { toast("先选一个话题吧"); return; }
          closeSheet();
          onPick(chosen);
        });
      }
    );
  }

  function savedSheet(entry, isPublic) {
    const s = recordStats();
    const t = isPublic ? getTopic(entry.topicIds[0]) : null;
    const mood = getMood(entry.mood);
    openSheet(
      `<div class="saved-hero">
         <div class="saved-ico">🌿</div>
         <h3>已保存到日记本</h3>
         <p>${isPublic ? `也已分享到「${t.emoji} ${t.name}」，同路人现在能看到了` : "仅自己可见，随时可以改为分享"}</p>
       </div>
       <div class="saved-stats">
         <div><b>${s.streak}</b><span>连续天数</span></div>
         <div><b>${s.week}</b><span>本周篇数</span></div>
         <div><b>${mood ? mood.emoji : "📝"}</b><span>${mood ? mood.name : "今日一记"}</span></div>
       </div>
       <p class="saved-note">${s.streak >= 3 ? `已经连续 ${s.streak} 天了，你在认真地陪伴自己。` : "写下来，这一天就被留住了。"}</p>
       <div class="sheet-actions col">
         <button type="button" class="btn-primary btn-block" id="sv-view">看看这篇日记</button>
         <button type="button" class="btn-ghost btn-block" id="sv-share">做成长图，发给家人</button>
       </div>`,
      (root) => {
        $("#sv-view", root).addEventListener("click", closeSheet);
        $("#sv-share", root).addEventListener("click", () => { closeSheet(); showView("share"); });
      }
    );
  }

  /* ========== Diary detail / share ========== */
  const currentDiary = () => state.diaries.find((d) => d.id === state.currentId);

  function renderDiary() {
    const d = currentDiary();
    if (!d) { showView("home"); return; }
    $("#edit-panel").hidden = true;
    $("#diary-article").hidden = false;
    $("#diary-date-title").textContent = formatDateTitle(d.createdAt);
    $("#diary-images").innerHTML = (d.images || []).map((src) => `<img src="${src}" alt="" />`).join("");
    $("#diary-body").innerHTML = paras(d.body);
    $("#diary-tags").innerHTML = (d.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    const badge = $("#diary-visibility-badge");
    if (d.visibility === "public") {
      const t = (d.topicIds || []).map(getTopic).filter(Boolean)[0];
      badge.textContent = t ? `🌿 已分享社区 · ${t.emoji} ${t.name}` : "🌿 已分享社区";
      badge.className = "vis-badge public";
    } else {
      badge.textContent = "🔒 仅自己可见";
      badge.className = "vis-badge private";
    }
    const mood = getMood(d.mood);
    const mb = $("#diary-mood-badge");
    mb.hidden = !mood;
    if (mood) mb.textContent = `${mood.emoji} ${mood.name}`;

    const cbox = $("#diary-community");
    const post = d.visibility === "public" ? postOfDiary(d.id) : null;
    cbox.hidden = false;
    if (post) {
      const cms = commentsOf(post.id).filter((c) => c.userId !== ME);
      cbox.innerHTML = `
        <div class="dc-head"><strong>💌 社区回应</strong><button type="button" class="link-btn" id="dc-open">去看看 ›</button></div>
        <p class="resp-stat">♥ ${post.likeCount} 个赞 · 🤗 ${post.hugCount || 0} 个抱抱 · 💬 ${commentCount(post.id)} 条留言</p>
        ${cms.slice(-2).reverse().map((c) => {
          const u = getUser(c.userId);
          return `<p class="dc-cm"><img class="avatar xs" src="${u.avatar}" alt="" /><span><b>${escapeHtml(u.nickname)}</b>：${escapeHtml(c.body)}</span></p>`;
        }).join("") || '<p class="muted">刚分享不久，同路人很快会来看你。</p>'}
        <button type="button" class="link-btn small" id="dc-private">改为仅自己</button>`;
      $("#dc-open").addEventListener("click", () => openPost(post.id));
      $("#dc-private").addEventListener("click", () => quickToggleVisibility(d, renderDiary));
    } else {
      cbox.innerHTML = `
        <div class="dc-head"><strong>想被看见吗？</strong></div>
        <p class="muted">这篇只有你自己能看到。分享到社区后，同路人可以给你点赞、抱抱和留言。</p>
        <button type="button" class="btn-ghost btn-sm" id="dc-share">🌿 分享到社区</button>`;
      $("#dc-share").addEventListener("click", () => quickToggleVisibility(d, renderDiary));
    }
  }

  function renderShare() {
    const d = currentDiary();
    if (!d) { showView("home"); return; }
    $("#share-date").textContent = formatDateTitle(d.createdAt);
    const mood = getMood(d.mood);
    $("#share-image").innerHTML = d.images && d.images[0]
      ? `<img src="${d.images[0]}" alt="" />`
      : `<div class="ph">${mood ? mood.emoji : "🌿"}</div>`;
    $("#share-title").textContent = (d.title || "今天") + (mood ? ` · ${mood.emoji} ${mood.name}` : "");
    const preview = (d.body || "").slice(0, 160) + ((d.body || "").length > 160 ? "…" : "");
    $("#share-text").textContent = preview || "把平凡的一天，轻轻留住。";
    $("#share-community-label").textContent = d.visibility === "public" ? "看社区回应" : "也分享到社区";
  }

  /* ========== Me ========== */
  function renderMe() {
    const s = recordStats();
    const mine = myPosts();
    const likes = mine.reduce((a, p) => a + (p.likeCount || 0), 0);
    const hugs = mine.reduce((a, p) => a + (p.hugCount || 0), 0);
    const resp = myResponses();
    $("#me-avatar").src = getUser(ME).avatar;
    $("#me-stats").innerHTML = `
      <div><b>${s.total}</b><span>日记</span></div>
      <div><b>${s.streak}</b><span>连续天数</span></div>
      <div><b>${mine.length}</b><span>社区分享</span></div>
      <div><b>${likes}</b><span>收到的赞</span></div>
      <div><b>${hugs}</b><span>收到的抱抱</span></div>
      <div><b>${resp.length}</b><span>收到的留言</span></div>`;
    $("#me-mood").innerHTML = moodWeekHtml();
    const un = unseenResponses().length;
    $("#me-resp-count").textContent = un ? `${un} 条新` : "";
    const rl = $("#me-responses");
    rl.innerHTML = resp.length
      ? resp.slice(0, 12).map(responseItemHtml).join("")
      : `<p class="empty-hint tiny">分享一篇日记到社区，同路人的回应会出现在这里。</p>`;
    bindRespItems(rl);
    $("#me-circles").innerHTML = state.joinedCircleIds.map(getCircle).filter(Boolean)
      .map((c) => `<button type="button" class="me-chip" data-c="${c.id}">${c.coverEmoji} ${escapeHtml(c.name)}</button>`).join("") || '<span class="muted">还没加入圈子</span>';
    $$("#me-circles .me-chip").forEach((b) => b.addEventListener("click", () => openCircle(b.dataset.c)));
    $("#me-following").innerHTML = state.followedUserIds.map(getUser)
      .map((u) => `<button type="button" class="me-chip" data-u="${u.id}"><img class="avatar xs" src="${u.avatar}" alt="" />${escapeHtml(u.nickname)}</button>`).join("") || '<span class="muted">还没关注同路人</span>';
    $$("#me-following .me-chip").forEach((b) => b.addEventListener("click", () => openProfile(b.dataset.u)));
    setTimeout(() => { if (state.view === "me") { markResponsesSeen(); syncTabs("me"); } }, 1500);
  }

  /* ========== Community ========== */
  function renderCommunity() {
    $$(".csub").forEach((b) => b.classList.toggle("active", b.dataset.csub === state.csub));
    $("#cpanel-feed").hidden = state.csub !== "feed";
    $("#cpanel-circles").hidden = state.csub !== "circles";
    $("#cpanel-people").hidden = state.csub !== "people";
    if (state.csub === "feed") {
      if (!state.feedLoadedOnce) {
        state.feedLoadedOnce = true;
        renderTopicChips();
        $("#composer-avatar").src = getUser(ME).avatar;
        $("#feed-summary").textContent = "";
        $("#feed-list").innerHTML = skeletonHtml(3);
        setTimeout(() => { if (state.view === "community" && state.csub === "feed") renderFeed(); }, 450);
      } else renderFeed();
    }
    if (state.csub === "circles") renderCircles();
    if (state.csub === "people") renderPeople();
  }
  function skeletonHtml(n) {
    return Array.from({ length: n }, () =>
      `<div class="feed-card skeleton"><div class="sk-row"><i class="sk-av"></i><i class="sk-line w40"></i></div>
       <i class="sk-line w70"></i><i class="sk-line"></i><i class="sk-img"></i></div>`).join("") +
      `<p class="loading-tip">同路人的日记正在赶来…</p>`;
  }

  function renderTopicChips() {
    const box = $("#topic-chips");
    const all = [
      { id: "all", name: "全部", emoji: "✨" },
      { id: "mine", name: "我的分享", emoji: "🙋" },
      { id: "following", name: "关注", emoji: "👀" },
      ...seed.topics,
    ];
    box.innerHTML = all
      .map((t) => `<button type="button" class="topic-chip${state.topicFilter === t.id ? " active" : ""}${t.id === "mine" ? " mine" : ""}" data-topic="${t.id}">${t.emoji} ${escapeHtml(t.name)}</button>`)
      .join("");
    $$(".topic-chip", box).forEach((btn) =>
      btn.addEventListener("click", () => { state.topicFilter = btn.dataset.topic; renderFeed(); })
    );
  }

  const publicPosts = () =>
    state.posts.filter((p) => p.visibility === "public").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function renderFeed() {
    const sx = $("#topic-chips").scrollLeft;
    renderTopicChips();
    $("#topic-chips").scrollLeft = sx;
    $("#composer-avatar").src = getUser(ME).avatar;
    const list = $("#feed-list");
    list.innerHTML = "";
    let items = publicPosts();
    const f = state.topicFilter;
    if (f === "mine") items = items.filter((p) => p.userId === ME);
    else if (f === "following") items = items.filter((p) => state.followedUserIds.includes(p.userId));
    else if (f !== "all") items = items.filter((p) => (p.topicIds || []).includes(f));
    const t = getTopic(f);
    $("#feed-summary").textContent =
      f === "all" ? `最近 14 天 · ${items.length} 篇同路人日记`
        : f === "mine" ? `你分享了 ${items.length} 篇 · 共收到 ${myResponses().length} 条留言`
          : f === "following" ? `你关注的 ${state.followedUserIds.length} 位同路人 · ${items.length} 篇`
            : t ? `${t.emoji} ${t.name} · ${t.desc} · ${items.length} 篇` : "";
    if (!items.length) {
      list.innerHTML = f === "mine"
        ? `<div class="empty-state"><div>🌱</div><p>你还没有分享过日记。</p><p class="muted">写一记时选「分享到社区」，同路人就能看见你。</p><button type="button" class="btn-primary btn-sm" id="empty-go-share">写一条分享</button></div>`
        : f === "following"
          ? `<div class="empty-state"><div>👀</div><p>还没关注任何人。</p><p class="muted">去「同路人」看看，有没有和你相似的人。</p></div>`
          : `<div class="empty-state"><div>🍃</div><p>这个话题还没有动态。</p><p class="muted">你可以成为第一个分享的人。</p></div>`;
      const g = $("#empty-go-share");
      if (g) g.addEventListener("click", () => startRecord(true));
      return;
    }
    items.forEach((p) => list.appendChild(makePostCard(p)));
  }

  function moodLine(p) {
    const parts = [];
    const m = getMood(p.mood);
    if (m) parts.push(`${m.emoji} ${m.name}`);
    if (p.weather) parts.push(escapeHtml(p.weather));
    if (p.location) parts.push("📍 " + escapeHtml(p.location));
    return parts.length ? `<div class="mood-line">${parts.map((x) => `<span>${x}</span>`).join("")}</div>` : "";
  }

  function makePostCard(p) {
    const u = getUser(p.userId);
    const mine = p.userId === ME;
    const card = document.createElement("article");
    card.className = "feed-card" + (mine ? " mine" : "");
    const topics = (p.topicIds || []).map(getTopic).filter(Boolean)
      .map((t) => `<button type="button" class="mini-tag" data-topic="${t.id}">${t.emoji} ${escapeHtml(t.name)}</button>`).join("");
    const circle = p.circleId ? getCircle(p.circleId) : null;
    const img = p.images && p.images[0] ? `<img class="feed-img" src="${p.images[0]}" alt="" loading="lazy" />` : "";
    const long = (p.body || "").length > 70;
    const expanded = !!state.expanded[p.id];
    const cms = commentsOf(p.id).filter((c) => c.userId !== p.userId);
    const preview = cms.length ? cms[cms.length - 1] : null;
    const pu = preview ? getUser(preview.userId) : null;
    card.innerHTML = `
      <div class="feed-head">
        <button type="button" class="feed-author" data-user="${u.id}">
          <img class="avatar" src="${u.avatar}" alt="" />
          <div>
            <strong>${escapeHtml(u.nickname)}${mine ? '<span class="me-badge">我的分享</span>' : ""}</strong>
            <span class="meta">${escapeHtml(u.city || "")} · ${formatRelative(p.createdAt)}${circle ? ` · ${escapeHtml(circle.name)}` : ""}</span>
          </div>
        </button>
      </div>
      <div class="feed-body" data-post="${p.id}">
        <h3>${escapeHtml(p.title || "无题")}</h3>
        <div class="body-text${long && !expanded ? " clamp" : ""}">${paras(p.body)}</div>
        ${long ? `<button type="button" class="expand-btn">${expanded ? "收起" : "展开全文"}</button>` : ""}
        ${img}
        ${moodLine(p)}
        <div class="feed-tags">${topics}</div>
      </div>
      ${preview ? `<button type="button" class="cmt-preview"><b>${escapeHtml(pu.nickname)}</b>：${escapeHtml(preview.body)}${commentCount(p.id) > 1 ? `<span class="muted"> · 共 ${commentCount(p.id)} 条</span>` : ""}</button>` : ""}
      <div class="feed-actions">${actionsHtml(p)}</div>`;
    $(".feed-author", card).addEventListener("click", () => openProfile(u.id));
    $(".feed-body", card).addEventListener("click", (e) => {
      const ex = e.target.closest(".expand-btn");
      if (ex) {
        e.stopPropagation();
        state.expanded[p.id] = !state.expanded[p.id];
        $(".body-text", card).classList.toggle("clamp", !state.expanded[p.id]);
        ex.textContent = state.expanded[p.id] ? "收起" : "展开全文";
        return;
      }
      const tag = e.target.closest(".mini-tag");
      if (tag) {
        e.stopPropagation();
        state.topicFilter = tag.dataset.topic;
        state.csub = "feed";
        showView("community");
        return;
      }
      openPost(p.id);
    });
    const pv = $(".cmt-preview", card);
    if (pv) pv.addEventListener("click", () => openPost(p.id));
    bindActions($(".feed-actions", card), p);
    return card;
  }

  function actionsHtml(p) {
    const liked = state.likedPostIds.includes(p.id);
    const hugged = state.huggedPostIds.includes(p.id);
    return `
      <button type="button" class="act like-btn${liked ? " on" : ""}" data-act="like"><i>${liked ? "♥" : "♡"}</i> ${p.likeCount || 0}</button>
      <button type="button" class="act hug-btn${hugged ? " on" : ""}" data-act="hug"><i>🤗</i> ${hugged ? "已抱抱" : "抱抱"} ${p.hugCount || 0}</button>
      <button type="button" class="act cmt-btn" data-act="cmt"><i>💬</i> ${commentCount(p.id)}</button>`;
  }
  function bindActions(box, p) {
    box.addEventListener("click", (e) => {
      const b = e.target.closest(".act");
      if (!b) return;
      e.stopPropagation();
      const act = b.dataset.act;
      if (act === "cmt") {
        if (state.view === "post") $("#comment-input").focus();
        else openPost(p.id);
        return;
      }
      if (act === "like") toggleLike(p.id);
      if (act === "hug") toggleHug(p.id);
      box.innerHTML = actionsHtml(p);
      const nb = $(`[data-act="${act}"]`, box);
      nb.classList.add("pop");
      if (act === "hug" && state.huggedPostIds.includes(p.id)) floatHeart(nb, "🤗");
      if (act === "like" && state.likedPostIds.includes(p.id)) floatHeart(nb, "♥");
    });
  }
  function floatHeart(el, ch) {
    const f = document.createElement("span");
    f.className = "float-heart";
    f.textContent = ch;
    el.appendChild(f);
    setTimeout(() => f.remove(), 800);
  }

  function toggleLike(postId) {
    const p = state.posts.find((x) => x.id === postId);
    if (!p) return;
    const idx = state.likedPostIds.indexOf(postId);
    if (idx >= 0) {
      state.likedPostIds.splice(idx, 1);
      p.likeCount = Math.max(0, (p.likeCount || 0) - 1);
    } else {
      state.likedPostIds.push(postId);
      p.likeCount = (p.likeCount || 0) + 1;
    }
    p.likedByMe = idx < 0;
    saveCommunity();
  }
  function toggleHug(postId) {
    const p = state.posts.find((x) => x.id === postId);
    if (!p) return;
    const idx = state.huggedPostIds.indexOf(postId);
    if (idx >= 0) {
      state.huggedPostIds.splice(idx, 1);
      p.hugCount = Math.max(0, (p.hugCount || 0) - 1);
    } else {
      state.huggedPostIds.push(postId);
      p.hugCount = (p.hugCount || 0) + 1;
      if (p.userId !== ME) toast(`你抱了抱 ${getUser(p.userId).nickname} 🤗`);
    }
    p.huggedByMe = idx < 0;
    saveCommunity();
  }

  function openPost(id) {
    if (state.view !== "post") {
      state.backFromPost = ["circle", "profile", "home", "me", "diary", "share"].includes(state.view) ? state.view : "community";
    }
    state.currentPostId = id;
    showView("post");
  }

  function renderPost() {
    const p = state.posts.find((x) => x.id === state.currentPostId);
    if (!p) { showView("community"); return; }
    const u = getUser(p.userId);
    const mine = p.userId === ME;
    const topics = (p.topicIds || []).map(getTopic).filter(Boolean)
      .map((t) => `<span class="tag">${t.emoji} ${escapeHtml(t.name)}</span>`).join("");
    const imgs = (p.images || []).map((src) => `<img src="${src}" alt="" />`).join("");
    const circle = p.circleId ? getCircle(p.circleId) : null;
    const followed = state.followedUserIds.includes(u.id);
    $("#post-article").innerHTML = `
      <div class="feed-head">
        <button type="button" class="feed-author" id="post-author-btn">
          <img class="avatar" src="${u.avatar}" alt="" />
          <div>
            <strong>${escapeHtml(u.nickname)}${mine ? '<span class="me-badge">我的分享</span>' : ""}</strong>
            <span class="meta">${escapeHtml(u.city || "")} · ${formatRelative(p.createdAt)}</span>
          </div>
        </button>
        ${mine ? "" : `<button type="button" class="follow-btn${followed ? " on" : ""}" id="post-follow">${followed ? "已关注" : "+ 关注"}</button>`}
      </div>
      <h2 class="post-title">${escapeHtml(p.title || "无题")}</h2>
      ${circle ? `<button type="button" class="post-circle-link" id="post-circle">${circle.coverEmoji} 来自圈子 · ${escapeHtml(circle.name)} ›</button>` : ""}
      ${moodLine(p)}
      <div class="post-images">${imgs}</div>
      <div class="diary-body">${paras(p.body)}</div>
      <div class="diary-tags">${topics}</div>
      <div class="feed-actions post-react">${actionsHtml(p)}</div>
      ${mine ? `<div class="mine-tools"><span>🙋 这是你的分享 · 同路人的回应都在下面</span>${p.diaryId ? '<button type="button" class="link-btn" id="post-to-share">做成长图发给家人 ›</button>' : ""}</div>` : ""}`;
    $("#post-author-btn").addEventListener("click", () => openProfile(u.id));
    const fb = $("#post-follow");
    if (fb) fb.addEventListener("click", () => { toggleFollow(u.id); renderPost(); });
    const cl = $("#post-circle");
    if (cl) cl.addEventListener("click", () => openCircle(circle.id));
    const ts = $("#post-to-share");
    if (ts) ts.addEventListener("click", () => { state.currentId = p.diaryId; showView("share"); });
    bindActions($(".post-react"), p);

    const cms = commentsOf(p.id);
    $("#comment-title").textContent = cms.length ? `${cms.length} 条温暖回应` : "评论";
    const clist = $("#comment-list");
    clist.innerHTML = cms.length
      ? cms.map((c) => {
          const cu = getUser(c.userId);
          const isAuthor = c.userId === p.userId;
          return `<div class="comment-item">
            <button type="button" class="cm-av" data-user="${cu.id}"><img class="avatar sm" src="${cu.avatar}" alt="" /></button>
            <div>
              <strong>${escapeHtml(cu.nickname)}</strong>${isAuthor ? '<span class="author-badge">作者</span>' : ""}
              <span class="meta">${formatRelative(c.createdAt)}</span>
              <p>${escapeHtml(c.body)}</p>
            </div>
          </div>`;
        }).join("")
      : `<p class="empty-hint tiny">还没有评论，来做第一个温暖的人吧。</p>`;
    $$(".cm-av", clist).forEach((b) => b.addEventListener("click", () => openProfile(b.dataset.user)));
    $("#quick-replies").innerHTML = (mine ? ["谢谢大家 🌿", "被你们接住了", "我会好好的"] : seed.quickReplies)
      .map((q) => `<button type="button" class="quick-chip">${escapeHtml(q)}</button>`).join("");
    $$("#quick-replies .quick-chip").forEach((b) =>
      b.addEventListener("click", () => {
        const input = $("#comment-input");
        input.value = b.textContent;
        input.focus();
      })
    );
    $("#comment-input").placeholder = mine ? "回复大家一句…" : `给 ${u.nickname} 说一句温暖的话…`;
    if (mine) markResponsesSeen();
  }

  /* ========== Circles ========== */
  const circlePostCount = (id) => state.posts.filter((p) => p.circleId === id && p.visibility === "public").length;

  function circleCardHtml(c) {
    const joined = state.joinedCircleIds.includes(c.id);
    const avs = (c.memberIds || []).filter((id) => id !== ME).slice(0, 4).map(getUser)
      .map((u) => `<img class="avatar xs" src="${u.avatar}" alt="" />`).join("");
    return `
      <div class="circle-cover" style="background:${c.coverColor}">${c.coverEmoji}</div>
      <div class="circle-info">
        <h3>${escapeHtml(c.name)}${joined ? '<span class="joined-tag">已加入</span>' : ""}</h3>
        <p>${escapeHtml(c.intro)}</p>
        <p class="rule-line">📜 ${escapeHtml(c.rule)}</p>
        <div class="circle-meta"><span class="av-stack">${avs}</span><span class="meta">${c.memberCount + (joined ? 1 : 0)} 人 · ${circlePostCount(c.id)} 篇 · 今日 +${c.todayPostCount}</span></div>
      </div>
      <button type="button" class="join-pill${joined ? " on" : ""}">${joined ? "✓" : "加入"}</button>`;
  }

  function renderCircles() {
    const list = $("#circle-list");
    list.innerHTML = "";
    const joined = seed.circles.filter((c) => state.joinedCircleIds.includes(c.id));
    const others = seed.circles.filter((c) => !state.joinedCircleIds.includes(c.id));
    const section = (title, arr) => {
      if (!arr.length) return;
      const h = document.createElement("p");
      h.className = "list-head";
      h.textContent = title;
      list.appendChild(h);
      arr.forEach((c) => {
        const card = document.createElement("article");
        card.className = "circle-card";
        card.innerHTML = circleCardHtml(c);
        card.addEventListener("click", (e) => {
          if (e.target.closest(".join-pill")) {
            toggleJoin(c.id);
            renderCircles();
            return;
          }
          openCircle(c.id);
        });
        list.appendChild(card);
      });
    };
    section(`我加入的 · ${joined.length}`, joined);
    section(`推荐给你 · ${others.length}`, others);
    if (!joined.length && !others.length) list.innerHTML = `<div class="empty-state"><div>🌿</div><p>圈子正在筹备中。</p></div>`;
  }

  function openCircle(id) {
    state.currentCircleId = id;
    showView("circle");
  }

  function toggleJoin(circleId) {
    const idx = state.joinedCircleIds.indexOf(circleId);
    const c = getCircle(circleId);
    if (idx >= 0) {
      state.joinedCircleIds.splice(idx, 1);
      toast(`已退出「${c.name}」`);
    } else {
      state.joinedCircleIds.push(circleId);
      toast(`欢迎加入「${c.name}」🌿`);
    }
    saveCommunity();
  }

  function renderCircle() {
    const c = getCircle(state.currentCircleId);
    if (!c) { showView("community"); return; }
    $("#circle-title").textContent = c.name;
    const joined = state.joinedCircleIds.includes(c.id);
    const members = (c.memberIds || []).filter((id) => id !== ME);
    if (joined) members.unshift(ME);
    const avs = members.map(getUser)
      .map((u) => `<button type="button" class="member" data-user="${u.id}"><img class="avatar sm" src="${u.avatar}" alt="" /><span>${escapeHtml(u.nickname)}</span></button>`).join("");
    const total = c.memberCount + (joined ? 1 : 0);
    $("#circle-hero").innerHTML = `
      <div class="circle-hero-inner" style="background:${c.coverColor}">
        <div class="circle-emoji">${c.coverEmoji}</div>
        <h2>${escapeHtml(c.name)}</h2>
        <p>${escapeHtml(c.intro)}</p>
        <div class="hero-stats">
          <div><b>${total}</b><span>成员</span></div>
          <div><b>${circlePostCount(c.id)}</b><span>圈内日记</span></div>
          <div><b>+${c.todayPostCount}</b><span>今日</span></div>
        </div>
        <button type="button" class="${joined ? "btn-ghost" : "btn-primary"} btn-sm" id="btn-join-circle">${joined ? "✓ 已加入 · 点击退出" : "+ 加入圈子"}</button>
      </div>
      <div class="circle-rule"><b>📜 圈规</b><span>${escapeHtml(c.rule)}</span></div>
      <div class="circle-members">
        <p class="vis-label">成员预览 · 共 ${total} 人</p>
        <div class="member-row">${avs}<span class="member more">+${total - members.length}</span></div>
      </div>
      ${joined
        ? `<button type="button" class="composer-card" id="circle-compose"><span>在「${escapeHtml(c.name)}」分享今天…</span><span class="composer-go">写一记 ›</span></button>`
        : `<p class="circle-tip">加入后，你分享的日记可以出现在这个圈子里。</p>`}`;
    $("#btn-join-circle").addEventListener("click", () => { toggleJoin(c.id); renderCircle(); });
    $$("#circle-hero .member[data-user]").forEach((b) => b.addEventListener("click", () => openProfile(b.dataset.user)));
    const cc = $("#circle-compose");
    if (cc) cc.addEventListener("click", () => { startRecord(true, c.id); });
    const feed = $("#circle-feed");
    feed.innerHTML = "";
    const items = publicPosts().filter((p) => p.circleId === c.id);
    $("#circle-feed-count").textContent = `${items.length} 篇`;
    if (!items.length) {
      feed.innerHTML = `<div class="empty-state"><div>${c.coverEmoji}</div><p>圈子里还很安静。</p><p class="muted">来写下第一篇吧。</p></div>`;
      return;
    }
    items.forEach((p) => feed.appendChild(makePostCard(p)));
  }

  /* ========== People ========== */
  function userStats(id) {
    const ps = state.posts.filter((p) => p.userId === id && p.visibility === "public");
    return {
      posts: ps.length,
      likes: ps.reduce((a, p) => a + (p.likeCount || 0), 0),
      hugs: ps.reduce((a, p) => a + (p.hugCount || 0), 0),
    };
  }
  function toggleFollow(id) {
    const idx = state.followedUserIds.indexOf(id);
    if (idx >= 0) {
      state.followedUserIds.splice(idx, 1);
      toast(`已取消关注 ${getUser(id).nickname}`);
    } else {
      state.followedUserIds.push(id);
      toast(`已关注 ${getUser(id).nickname}，TA 的分享会出现在「关注」里`);
    }
    saveCommunity();
  }

  function renderPeople() {
    const me = getUser(ME);
    const list = $("#people-list");
    list.innerHTML = "";
    seed.users
      .filter((u) => u.id !== ME)
      .map((u) => {
        const common = (u.topicIds || []).filter((t) => me.topicIds.includes(t));
        const sameCity = u.city === me.city;
        return { u, common, sameCity, score: common.length * 2 + (sameCity ? 3 : 0) };
      })
      .sort((a, b) => b.score - a.score)
      .forEach(({ u, common, sameCity }) => {
        const st = userStats(u.id);
        const followed = state.followedUserIds.includes(u.id);
        const card = document.createElement("article");
        card.className = "people-card";
        const reason = [
          sameCity ? `<span class="why city">📍 同城 · ${escapeHtml(u.city)}</span>` : `<span class="why plain">📍 ${escapeHtml(u.city)}</span>`,
          ...common.map(getTopic).map((t) => `<span class="why">${t.emoji} ${escapeHtml(t.name)}</span>`),
        ].join("");
        card.innerHTML = `
          <img class="avatar" src="${u.avatar}" alt="" />
          <div class="pc-main">
            <strong>${escapeHtml(u.nickname)}${u.joinedDays < 14 ? '<span class="new-tag">新人</span>' : ""}</strong>
            <p>${escapeHtml(u.bio || "")}</p>
            <div class="why-row">${reason}</div>
            <span class="meta">${common.length ? `${common.length} 个共同话题 · ` : ""}公开日记 ${st.posts} · 粉丝 ${u.followers + (followed ? 1 : 0)}</span>
          </div>
          <button type="button" class="follow-btn${followed ? " on" : ""}">${followed ? "已关注" : "+ 关注"}</button>`;
        card.addEventListener("click", (e) => {
          if (e.target.closest(".follow-btn")) {
            toggleFollow(u.id);
            renderPeople();
            return;
          }
          openProfile(u.id);
        });
        list.appendChild(card);
      });
  }

  function openProfile(userId) {
    if (state.view !== "profile") state.profileBack = state.view;
    state.currentProfileId = userId;
    showView("profile");
  }

  function renderProfile() {
    const u = getUser(state.currentProfileId);
    if (!u) { showView("community"); return; }
    const me = getUser(ME);
    const isMe = u.id === ME;
    const st = userStats(u.id);
    const followed = state.followedUserIds.includes(u.id);
    const common = (u.topicIds || []).filter((t) => me.topicIds.includes(t));
    const topics = (u.topicIds || []).map(getTopic).filter(Boolean)
      .map((t) => `<span class="tag${common.includes(t.id) && !isMe ? " common" : ""}">${t.emoji} ${escapeHtml(t.name)}</span>`).join("");
    const circles = seed.circles.filter((c) => (isMe ? state.joinedCircleIds.includes(c.id) : (c.memberIds || []).includes(u.id)));
    $("#profile-hero").innerHTML = `
      <img class="avatar lg" src="${u.avatar}" alt="" />
      <h2>${escapeHtml(u.nickname)}</h2>
      <p class="meta">📍 ${escapeHtml(u.city || "")} · 加入 ${u.joinedDays} 天${!isMe && u.city === me.city ? " · 和你同城" : ""}</p>
      <p class="bio">${escapeHtml(u.bio || "")}</p>
      <div class="hero-stats">
        <div><b>${st.posts}</b><span>公开日记</span></div>
        <div><b>${u.followers + (followed ? 1 : 0)}</b><span>粉丝</span></div>
        <div><b>${st.likes}</b><span>获赞</span></div>
        <div><b>${st.hugs}</b><span>抱抱</span></div>
      </div>
      <div class="diary-tags center">${topics}</div>
      ${!isMe && common.length ? `<p class="common-hint">你们有 ${common.length} 个共同话题</p>` : ""}
      ${circles.length ? `<p class="profile-circles">${circles.map((c) => `${c.coverEmoji} ${escapeHtml(c.name)}`).join(" · ")}</p>` : ""}
      ${isMe ? "" : `<button type="button" class="${followed ? "btn-ghost" : "btn-primary"} btn-sm" id="profile-follow">${followed ? "已关注" : "+ 关注 TA"}</button>`}`;
    const pf = $("#profile-follow");
    if (pf) pf.addEventListener("click", () => { toggleFollow(u.id); renderProfile(); });
    $("#profile-feed-title").textContent = isMe ? `我的公开日记 · ${st.posts}` : `TA 的公开日记 · ${st.posts}`;
    const feed = $("#profile-feed");
    feed.innerHTML = "";
    const items = publicPosts().filter((p) => p.userId === u.id);
    if (!items.length) {
      feed.innerHTML = `<div class="empty-state"><div>🌱</div><p>${isMe ? "你还没有公开日记。" : "TA 还没有公开日记。"}</p></div>`;
      return;
    }
    items.forEach((p) => feed.appendChild(makePostCard(p)));
  }

  /* ========== Record ========== */
  function startRecord(asShare, circleId) {
    resetDraft();
    state.composeCircleId = circleId || null;
    if (asShare) $('input[name="visibility"][value="public"]').checked = true;
    showView("record");
  }

  function renderRecord() {
    $("#mood-chips").innerHTML = seed.MOODS
      .map((m) => `<button type="button" class="mood-chip${state.draftMood === m.id ? " active" : ""}" data-mood="${m.id}"><span>${m.emoji}</span>${m.name}</button>`).join("");
    $("#prompt-chips").innerHTML = seed.prompts.map((p) => `<button type="button" class="quick-chip">${escapeHtml(p)}…</button>`).join("");
    const s = recordStats();
    $("#record-intro-title").textContent = s.todayDone ? "再补一记也很好" : "今天记一句就好";
    $("#record-intro-sub").textContent = s.todayDone
      ? "今天已经记录过了，想到什么随时补充。"
      : s.streak ? `写完就是连续第 ${s.streak + 1} 天。一句话、一张图、一个心情，都算。` : "一句话、一张图、一个心情，都算记录。";
    $("#record-topic-chips").innerHTML = topicChipsHtml(state.draftTopicId);
    const c = state.composeCircleId ? getCircle(state.composeCircleId) : null;
    $(".vis-hint").textContent = c
      ? `将分享到圈子「${c.name}」。同路人可以点赞、抱抱、留言；随时可在日记本改回「仅自己」。`
      : "分享后同路人可以点赞、抱抱、留言；不想继续公开，随时在日记本里改回「仅自己」。";
    updateVisPick();
  }

  function updateVisPick() {
    const pub = $('input[name="visibility"][value="public"]');
    const pick = $("#topic-pick");
    if (pub && pick) pick.hidden = !pub.checked;
    $("#btn-generate").textContent = pub && pub.checked ? "生成日记并分享 🌿" : "生成日记 🍃";
  }

  function renderEditTopics() {
    $("#edit-topic-chips").innerHTML = topicChipsHtml(state.editTopicId);
    const pub = $('input[name="edit-visibility"][value="public"]');
    $("#edit-topic-pick").hidden = !(pub && pub.checked);
  }

  function organizeDiary(raw, moodId) {
    let text = (raw || "").trim().replace(/\s+/g, " ");
    const m = getMood(moodId);
    if (!text) {
      text = m ? `今天的心情是「${m.name}」。没有写很多字，但还是想留下一点痕迹。` : "今天没有写很多字，但还是想留下一点痕迹。慢慢来，已经很好了。";
    }
    const parts = text.replace(/([。！？!?])/g, "$1\n").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const ps = [];
    let buf = [];
    parts.forEach((s, i) => {
      buf.push(s);
      if (buf.length >= 2 || i === parts.length - 1) {
        ps.push(buf.join(""));
        buf = [];
      }
    });
    let body = ps.join("\n\n");
    if (!body.includes("慢慢")) body += "\n\n慢慢来，未来值得期待。";
    const tags = guessTags(text);
    if (m && !tags.includes(m.name)) tags.unshift(m.name);
    return { title: makeTitle(text), body, tags: tags.slice(0, 3) };
  }

  function makeTitle(text) {
    const hints = [
      [/谢谢|感谢/, "想说一声谢谢"],
      [/家人|爸|妈|散步/, "和家人在一起"],
      [/阳光|柠檬|茶|水/, "阳光里的小确幸"],
      [/医院|复查|治疗/, "治疗路上的一天"],
      [/睡|休息|累/, "给自己一点休息"],
      [/吃|粥|汤|饭/, "好好吃饭的一天"],
      [/朋友|聊天/, "被温柔接住的一天"],
    ];
    for (const [re, t] of hints) if (re.test(text)) return t;
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日的记录`;
  }

  function guessTags(text) {
    const tags = [];
    if (/家人|爸|妈|孩子/.test(text)) tags.push("家人陪伴");
    if (/平静|安静|平稳|安心/.test(text)) tags.push("心情平稳");
    if (/开心|幸福|确幸|感恩|谢谢/.test(text)) tags.push("小确幸");
    if (/累|疼|不适|难受/.test(text)) tags.push("需要休息");
    if (/散步|公园|户外|走/.test(text)) tags.push("户外");
    if (!tags.length) tags.push("日常点滴");
    return tags;
  }

  function publishDiaryToCommunity(diary) {
    let post = postOfDiary(diary.id);
    const circleId = state.composeCircleId || (post && post.circleId) || state.joinedCircleIds[0] || null;
    if (!post) {
      post = {
        id: uid("p"),
        diaryId: diary.id,
        userId: ME,
        circleId,
        topicIds: diary.topicIds || [],
        title: diary.title,
        body: diary.body,
        images: diary.images || [],
        mood: diary.mood || null,
        weather: null,
        location: getUser(ME).city,
        likeCount: 0,
        hugCount: 0,
        likedByMe: false,
        createdAt: new Date().toISOString(),
        visibility: "public",
      };
      state.posts.unshift(post);
    } else {
      Object.assign(post, {
        title: diary.title, body: diary.body, images: diary.images || [],
        topicIds: diary.topicIds || [], mood: diary.mood || null, visibility: "public",
      });
    }
    state.composeCircleId = null;
    saveCommunity();
    return post;
  }

  function unpublishDiaryFromCommunity(diaryId) {
    const post = postOfDiary(diaryId);
    state.posts = state.posts.filter((p) => !(p.diaryId === diaryId && p.userId === ME));
    if (post) state.comments = state.comments.filter((c) => c.postId !== post.id);
    saveCommunity();
  }

  // 演示：分享后几秒内模拟同路人的回应（点赞、抱抱、留言），让分享者立刻有「被接住」的感觉
  function simulateResponse(post) {
    if (!post) return;
    const others = seed.users.filter((u) => u.id !== ME);
    const pick = others[Math.floor(Math.random() * others.length)];
    setTimeout(() => {
      const p = state.posts.find((x) => x.id === post.id);
      if (!p) return;
      p.likeCount = (p.likeCount || 0) + 2;
      p.hugCount = (p.hugCount || 0) + 1;
      saveCommunity();
    }, 1500);
    setTimeout(() => {
      const p = state.posts.find((x) => x.id === post.id);
      if (!p) return;
      const body = seed.warmReplies[Math.floor(Math.random() * seed.warmReplies.length)];
      state.comments.push({ id: uid("cm"), postId: p.id, userId: pick.id, body, createdAt: new Date().toISOString() });
      p.likeCount = (p.likeCount || 0) + 1;
      saveCommunity();
      toast(`🤗 ${pick.nickname} 抱了抱你：「${body}」`, 3600);
      syncTabs(state.view);
      if (["home", "diary", "book"].includes(state.view) && $("#sheet").hidden) {
        const y = window.scrollY;
        showView(state.view);
        window.scrollTo(0, y);
      }
    }, 5000);
  }

  async function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderPhotoPreviews() {
    const box = $("#photo-previews");
    box.innerHTML = "";
    state.draftPhotos.forEach((src, i) => {
      const wrap = document.createElement("div");
      wrap.className = "photo-wrap";
      wrap.innerHTML = `<img src="${src}" alt="" /><button type="button" class="rm" data-i="${i}">×</button>`;
      box.appendChild(wrap);
    });
    $$(".rm", box).forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        state.draftPhotos.splice(+btn.dataset.i, 1);
        renderPhotoPreviews();
      })
    );
  }

  async function captureLongImage(targetEl, filename) {
    if (typeof html2canvas !== "function") {
      toast("长图组件加载中，请稍后再试");
      return;
    }
    toast("正在生成长图…");
    try {
      const canvas = await html2canvas(targetEl, { backgroundColor: "#FFFEF9", scale: 2, useCORS: true, logging: false });
      const url = canvas.toDataURL("image/png");
      $("#lightbox-img").src = url;
      const dl = $("#lightbox-download");
      dl.href = url;
      dl.download = filename || "友爱日记.png";
      $("#lightbox").hidden = false;
      toast("长图已生成：长按或点「下载图片」，再发给家人");
    } catch (err) {
      console.error(err);
      toast("生成失败，请重试");
    }
  }

  function resetDraft() {
    state.draftPhotos = [];
    state.draftMood = null;
    state.draftTopicId = seed.topics[0].id;
    $("#raw-text").value = "";
    const priv = $('input[name="visibility"][value="private"]');
    if (priv) priv.checked = true;
    renderPhotoPreviews();
    $("#voice-status").hidden = true;
    $("#voice-label").textContent = "按住说话";
    updateVisPick();
  }

  function logout() {
    setAuthed(false);
    showView("login");
    toast("已退出");
  }

  async function startVoice() {
    if (state.recording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("当前环境不支持录音，请改用打字");
      $("#voice-status").hidden = false;
      $("#voice-status").textContent = "不支持麦克风，请在上方打字";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      state.audioChunks = [];
      state.mediaRecorder = rec;
      rec.ondataavailable = (e) => { if (e.data.size) state.audioChunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ta = $("#raw-text");
        const note = "（语音已录制 · 演示站未接语音转文字，请在此补充你想说的话）";
        if (!ta.value.includes("语音已录制")) ta.value = (ta.value ? ta.value + "\n" : "") + note;
        $("#voice-status").hidden = false;
        $("#voice-status").textContent = "录音结束 · 请用文字补充内容";
        toast("录音完成（演示：请打字补充）");
      };
      rec.start();
      state.recording = true;
      $("#btn-voice").classList.add("recording");
      $("#voice-label").textContent = "松开结束";
      $("#voice-status").hidden = false;
      $("#voice-status").textContent = "正在听你说…";
    } catch (err) {
      console.warn(err);
      toast("无法使用麦克风，请改用打字");
      $("#voice-status").hidden = false;
      $("#voice-status").textContent = "麦克风权限未开，请打字";
    }
  }

  function stopVoice() {
    if (!state.recording || !state.mediaRecorder) return;
    try {
      if (state.mediaRecorder.state !== "inactive") state.mediaRecorder.stop();
    } catch (_) {}
    state.recording = false;
    $("#btn-voice").classList.remove("recording");
    $("#voice-label").textContent = "按住说话";
  }

  function enterApp() {
    ensureDiarySeed();
    loadCommunity();
    showView("home");
  }

  function goBack() {
    const v = state.view;
    if (v === "post") { showView(state.backFromPost || "community"); return; }
    if (v === "profile") {
      const b = state.profileBack;
      if (b && b !== "profile" && b !== "login") { showView(b); return; }
      state.csub = "people";
      showView("community");
      return;
    }
    if (v === "circle") { state.csub = "circles"; showView("community"); return; }
    if (v === "share") { showView("diary"); return; }
    if (v === "diary") { showView("book"); return; }
    showView("home");
  }

  function bind() {
    $("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = $("#login-user").value.trim();
      const p = $("#login-pass").value;
      if (u === DEMO_USER && p === DEMO_PASS) {
        $("#login-error").hidden = true;
        setAuthed(true);
        enterApp();
      } else {
        $("#login-error").hidden = false;
      }
    });

    $("#btn-logout").addEventListener("click", logout);
    $("#btn-logout-me").addEventListener("click", logout);
    $("#btn-clear-data").addEventListener("click", () => {
      if (confirm("确定清空本机日记与社区互动？会重新载入演示数据。")) {
        state.diaries = [];
        seedDiaries();
        localStorage.removeItem(seed.COMMUNITY_KEY);
        seedCommunity();
        state.feedLoadedOnce = false;
        toast("已重置为演示数据");
        showView("home");
      }
    });

    $("#btn-community-pick").addEventListener("click", () => {
      state.csub = "feed";
      state.topicFilter = "all";
      showView("community");
    });
    $("#home-streak").addEventListener("click", () => showView("book"));
    $$("[data-goto-book]").forEach((b) => b.addEventListener("click", () => showView("book")));
    $("#btn-start-record").addEventListener("click", () => startRecord(false));
    $("#btn-compose-share").addEventListener("click", () => startRecord(true));

    $$(".back-btn").forEach((btn) => btn.addEventListener("click", goBack));

    document.addEventListener("click", (e) => {
      const tab = e.target.closest(".tab-bar .tab");
      if (!tab) return;
      const name = tab.dataset.tab;
      if (name === "record") startRecord(false);
      else if (name === "community") { state.csub = "feed"; showView("community"); }
      else showView(name);
    });

    $$(".csub").forEach((btn) =>
      btn.addEventListener("click", () => { state.csub = btn.dataset.csub; renderCommunity(); })
    );

    $("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });

    $("#comment-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#comment-input");
      const body = input.value.trim();
      if (!body || !state.currentPostId) return;
      state.comments.push({ id: uid("cm"), postId: state.currentPostId, userId: ME, body, createdAt: new Date().toISOString() });
      saveCommunity();
      input.value = "";
      const p = state.posts.find((x) => x.id === state.currentPostId);
      toast(p && p.userId !== ME ? `${getUser(p.userId).nickname} 会收到你的温暖 🌿` : "回复已发布（仅本机）");
      renderPost();
      const last = $("#comment-list .comment-item:last-child");
      if (last) { last.classList.add("just-added"); last.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });

    // record page delegates
    $("#mood-chips").addEventListener("click", (e) => {
      const b = e.target.closest(".mood-chip");
      if (!b) return;
      state.draftMood = state.draftMood === b.dataset.mood ? null : b.dataset.mood;
      $$("#mood-chips .mood-chip").forEach((x) => x.classList.toggle("active", x.dataset.mood === state.draftMood));
    });
    $("#prompt-chips").addEventListener("click", (e) => {
      const b = e.target.closest(".quick-chip");
      if (!b) return;
      const ta = $("#raw-text");
      const starter = b.textContent.replace(/…$/, "");
      ta.value = (ta.value ? ta.value.trim() + "\n" : "") + starter;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    $$('input[name="visibility"]').forEach((r) => r.addEventListener("change", updateVisPick));
    $("#record-topic-chips").addEventListener("click", (e) => {
      const c = e.target.closest(".topic-chip");
      if (!c) return;
      state.draftTopicId = c.dataset.topic;
      $("#record-topic-chips").innerHTML = topicChipsHtml(state.draftTopicId);
    });
    $("#edit-topic-chips").addEventListener("click", (e) => {
      const c = e.target.closest(".topic-chip");
      if (!c) return;
      state.editTopicId = c.dataset.topic;
      renderEditTopics();
    });
    $$('input[name="edit-visibility"]').forEach((r) => r.addEventListener("change", renderEditTopics));

    $("#photo-drop").addEventListener("click", (e) => {
      if (e.target.id !== "photo-input") { e.preventDefault(); $("#photo-input").click(); }
    });
    $("#photo-input").addEventListener("change", async (e) => {
      const files = [...(e.target.files || [])];
      for (const f of files.slice(0, 6)) {
        if (!f.type.startsWith("image/")) continue;
        state.draftPhotos.push(await fileToDataURL(f));
      }
      renderPhotoPreviews();
      e.target.value = "";
    });

    const voiceBtn = $("#btn-voice");
    voiceBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); startVoice(); });
    voiceBtn.addEventListener("pointerup", () => stopVoice());
    voiceBtn.addEventListener("pointerleave", () => { if (state.recording) stopVoice(); });
    voiceBtn.addEventListener("pointercancel", () => { if (state.recording) stopVoice(); });

    $("#btn-generate").addEventListener("click", () => {
      const raw = $("#raw-text").value;
      if (!raw.trim() && !state.draftPhotos.length && !state.draftMood) {
        toast("记一句话、选个心情或配张图，都可以");
        return;
      }
      const visibility = $('input[name="visibility"][value="public"]').checked ? "public" : "private";
      if (visibility === "public" && !state.draftTopicId) {
        toast("分享到社区请先选一个话题");
        return;
      }
      const organized = organizeDiary(raw, state.draftMood);
      const entry = {
        id: uid("d"),
        title: organized.title,
        body: organized.body,
        tags: organized.tags,
        mood: state.draftMood,
        images: [...state.draftPhotos],
        createdAt: new Date().toISOString(),
        raw,
        visibility,
        topicIds: visibility === "public" ? [state.draftTopicId] : [],
      };
      state.diaries.unshift(entry);
      saveDiaries();
      const post = visibility === "public" ? publishDiaryToCommunity(entry) : null;
      state.currentId = entry.id;
      resetDraft();
      showView("diary");
      savedSheet(entry, visibility === "public");
      if (post) simulateResponse(post);
    });

    $("#btn-edit").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      $("#diary-article").hidden = true;
      $("#diary-community").hidden = true;
      $("#edit-panel").hidden = false;
      $("#edit-title").value = d.title || "";
      $("#edit-body").value = d.body || "";
      const vis = d.visibility === "public" ? "public" : "private";
      $(`input[name="edit-visibility"][value="${vis}"]`).checked = true;
      state.editTopicId = (d.topicIds && d.topicIds[0]) || seed.topics[0].id;
      renderEditTopics();
    });
    $("#btn-cancel-edit").addEventListener("click", () => renderDiary());
    $("#btn-save-edit").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      const visibility = $('input[name="edit-visibility"][value="public"]').checked ? "public" : "private";
      if (visibility === "public" && !state.editTopicId) {
        toast("分享到社区请先选一个话题");
        return;
      }
      const wasPublic = d.visibility === "public";
      d.title = $("#edit-title").value.trim() || d.title;
      d.body = $("#edit-body").value;
      d.visibility = visibility;
      d.topicIds = visibility === "public" ? [state.editTopicId] : [];
      saveDiaries();
      if (visibility === "public") {
        const post = publishDiaryToCommunity(d);
        if (!wasPublic) simulateResponse(post);
      } else unpublishDiaryFromCommunity(d.id);
      renderDiary();
      toast(visibility === "public" ? (wasPublic ? "已保存并同步到社区" : "已保存并分享到社区 🌿") : "已保存（仅自己可见）");
    });

    $("#btn-longimg").addEventListener("click", () => captureLongImage($("#diary-article"), "友爱日记-详情.png"));
    $("#btn-share").addEventListener("click", () => showView("share"));

    $("#btn-copy-link").addEventListener("click", async () => {
      const d = currentDiary();
      const text = d
        ? `【${d.title}】${formatMeta(d.createdAt)}\n${(d.body || "").slice(0, 160)}\n\n—— 想让你看见我的这一天。不用给建议，回我一句「我在」就好。（来自 友爱日记）`
        : location.href.split("#")[0];
      try {
        await navigator.clipboard.writeText(text);
        toast("已复制，可直接粘贴发给家人朋友");
      } catch {
        toast("复制失败，请长按文字手动复制");
      }
    });
    $("#btn-moments").addEventListener("click", () => captureLongImage($("#share-card"), "友爱日记-分享卡.png"));
    $("#btn-share-community").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      if (d.visibility === "public") {
        const p = postOfDiary(d.id);
        if (p) openPost(p.id);
        return;
      }
      quickToggleVisibility(d, renderShare);
    });

    $("#lightbox-close").addEventListener("click", () => { $("#lightbox").hidden = true; });
    $("#btn-more").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      if (confirm("删除这篇日记？已分享到社区的动态也会一起撤下。")) {
        unpublishDiaryFromCommunity(d.id);
        state.diaries = state.diaries.filter((x) => x.id !== d.id);
        saveDiaries();
        toast("已删除");
        showView("book");
      }
    });
  }

  function boot() {
    loadDiaries();
    bind();
    if (isAuthed()) enterApp();
    else showView("login");
  }

  boot();
})();
