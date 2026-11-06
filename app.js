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

  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

  const state = {
    view: "login",
    diaries: [],
    currentId: null,
    draftPhotos: [],
    mediaRecorder: null,
    audioChunks: [],
    recording: false,
    // community
    posts: [],
    comments: [],
    joinedCircleIds: [],
    likedPostIds: [],
    topicFilter: "all",
    csub: "feed",
    currentPostId: null,
    currentCircleId: null,
    currentProfileId: null,
    draftTopicId: null,
    editTopicId: null,
    backFromPost: "community",
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

  function isAuthed() {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  }

  function setAuthed(ok) {
    if (ok) sessionStorage.setItem(AUTH_KEY, "1");
    else sessionStorage.removeItem(AUTH_KEY);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(10, 30, 0, 0);
    return d.toISOString();
  }

  function formatDateTitle(iso) {
    const d = new Date(iso);
    return `「${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEKDAYS[d.getDay()]}」`;
  }

  function formatMeta(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEKDAYS[d.getDay()]}`;
  }

  function formatRelative(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "刚刚";
    if (m < 60) return m + " 分钟前";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " 小时前";
    const d = Math.floor(h / 24);
    if (d < 7) return d + " 天前";
    return formatMeta(iso);
  }

  function getUser(id) {
    return seed.users.find((u) => u.id === id) || seed.users[0];
  }

  function getTopic(id) {
    return seed.topics.find((t) => t.id === id);
  }

  function getCircle(id) {
    return seed.circles.find((c) => c.id === id);
  }

  function commentCount(postId) {
    return state.comments.filter((c) => c.postId === postId).length;
  }

  /* ========== Persistence ========== */

  function loadDiaries() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      state.diaries = raw ? JSON.parse(raw) : [];
    } catch {
      state.diaries = [];
    }
  }

  function saveDiaries() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.diaries));
  }

  function loadCommunity() {
    try {
      const raw = localStorage.getItem(seed.COMMUNITY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state.posts = data.posts || clone(seed.posts);
        state.comments = data.comments || clone(seed.comments);
        state.joinedCircleIds = data.joinedCircleIds || ["c-1"];
        state.likedPostIds = data.likedPostIds || seed.posts.filter((p) => p.likedByMe).map((p) => p.id);
        // sync likedByMe flags
        state.posts.forEach((p) => {
          p.likedByMe = state.likedPostIds.includes(p.id);
        });
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
    state.joinedCircleIds = ["c-1"];
    state.likedPostIds = seed.posts.filter((p) => p.likedByMe).map((p) => p.id);
    state.posts.forEach((p) => {
      p.likedByMe = state.likedPostIds.includes(p.id);
    });
    saveCommunity();
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
      })
    );
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function seedDiariesIfEmpty() {
    if (state.diaries.length) return;
    state.diaries = [
      {
        id: "seed-1",
        title: "阳光里的一小杯水",
        createdAt: daysAgo(1),
        body: "阳光很好，喝了一杯温热的柠檬水。\n\n身体慢慢恢复中，心也安静了。没有什么大事，可这一小杯热水，已经足够温暖今天。\n\n慢慢来，我们都在变好。",
        tags: ["心情平稳", "小确幸"],
        images: [],
        visibility: "private",
        topicIds: [],
      },
      {
        id: "seed-2",
        title: "和家人散步",
        createdAt: daysAgo(3),
        body: "傍晚和家人在公园走了走，聊了聊开心的事。\n\n风有点凉，但身边有人，感觉很踏实。平凡的陪伴，是最安心的药。",
        tags: ["家人陪伴", "户外"],
        images: [],
        visibility: "private",
        topicIds: [],
      },
    ];
    saveDiaries();
  }

  /* ========== Views ========== */

  function showView(name) {
    state.view = name;
    $$(".view").forEach((v) => { v.hidden = true; });
    const map = {
      login: "#view-login",
      home: "#view-home",
      community: "#view-community",
      post: "#view-post",
      circle: "#view-circle",
      profile: "#view-profile",
      record: "#view-record",
      diary: "#view-diary",
      share: "#view-share",
      book: "#view-book",
      me: "#view-me",
    };
    const el = $(map[name]);
    if (el) el.hidden = false;
    window.scrollTo(0, 0);

    syncTabs(name);

    if (name === "home") renderHome();
    if (name === "community") renderCommunity();
    if (name === "post") renderPost();
    if (name === "circle") renderCircle();
    if (name === "profile") renderProfile();
    if (name === "book") renderBook();
    if (name === "diary") renderDiary();
    if (name === "share") renderShare();
    if (name === "me") renderMe();
    if (name === "record") renderRecordTopics();
  }

  function syncTabs(name) {
    const tabName =
      name === "post" || name === "circle" || name === "profile"
        ? "community"
        : name === "diary" || name === "share"
          ? "home"
          : name;
    $$(".tab-bar .tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tabName);
    });
  }

  /* ========== Home / Book / Me ========== */

  function renderHome() {
    const list = $("#diary-list");
    const empty = $("#empty-hint");
    list.innerHTML = "";
    const items = [...state.diaries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    empty.hidden = items.length > 0;
    items.forEach((d) => list.appendChild(makeDiaryCard(d)));
  }

  function renderBook() {
    const list = $("#book-list");
    list.innerHTML = "";
    const items = [...state.diaries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (!items.length) {
      list.innerHTML = `<p class="empty-hint">日记本还是空的，去写一记吧。</p>`;
      return;
    }
    items.forEach((d) => list.appendChild(makeDiaryCard(d)));
  }

  function renderMe() {
    const publicCount = state.posts.filter((p) => p.userId === seed.ME_ID && p.visibility === "public").length;
    $("#me-stats").textContent =
      `个人日记 ${state.diaries.length} 篇 · 社区公开 ${publicCount} 条 · 已加入 ${state.joinedCircleIds.length} 个圈子`;
  }

  function makeDiaryCard(d) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diary-card";
    const thumb =
      d.images && d.images[0]
        ? `<img class="thumb" src="${d.images[0]}" alt="" />`
        : `<div class="thumb placeholder">🌿</div>`;
    const excerpt = (d.body || "").replace(/\n+/g, " ").slice(0, 60);
    const vis = d.visibility === "public" ? "🌿 已分享社区" : "🔒 仅自己";
    btn.innerHTML = `
      ${thumb}
      <div>
        <h3>${escapeHtml(d.title || "无题")}</h3>
        <div class="meta">${formatMeta(d.createdAt)} · ${vis}</div>
        <div class="excerpt">${escapeHtml(excerpt)}</div>
        <div class="status">● 已整理</div>
      </div>`;
    btn.addEventListener("click", () => {
      state.currentId = d.id;
      showView("diary");
    });
    return btn;
  }

  function currentDiary() {
    return state.diaries.find((d) => d.id === state.currentId);
  }

  function renderDiary() {
    const d = currentDiary();
    if (!d) {
      showView("home");
      return;
    }
    $("#edit-panel").hidden = true;
    $("#diary-article").hidden = false;
    $("#diary-date-title").textContent = formatDateTitle(d.createdAt);
    const imgs = $("#diary-images");
    imgs.innerHTML = "";
    (d.images || []).forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      imgs.appendChild(img);
    });
    const body = $("#diary-body");
    body.innerHTML = (d.body || "")
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    const tags = $("#diary-tags");
    tags.innerHTML = (d.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    const badge = $("#diary-visibility-badge");
    if (d.visibility === "public") {
      const t = (d.topicIds || []).map(getTopic).filter(Boolean)[0];
      badge.textContent = t ? `🌿 已分享社区 · ${t.emoji} ${t.name}` : "🌿 已分享社区";
      badge.className = "vis-badge public";
    } else {
      badge.textContent = "🔒 仅自己可见";
      badge.className = "vis-badge private";
    }
  }

  function renderShare() {
    const d = currentDiary();
    if (!d) {
      showView("home");
      return;
    }
    const imgBox = $("#share-image");
    if (d.images && d.images[0]) {
      imgBox.innerHTML = `<img src="${d.images[0]}" alt="" />`;
    } else {
      imgBox.innerHTML = `<div class="ph">🌿</div>`;
    }
    const preview = (d.body || "").slice(0, 120) + ((d.body || "").length > 120 ? "…" : "");
    $("#share-text").textContent = preview || "把平凡的一天，轻轻留住。";
  }

  /* ========== Community ========== */

  function renderCommunity() {
    $$(".csub").forEach((b) => b.classList.toggle("active", b.dataset.csub === state.csub));
    $("#cpanel-feed").hidden = state.csub !== "feed";
    $("#cpanel-circles").hidden = state.csub !== "circles";
    $("#cpanel-people").hidden = state.csub !== "people";
    if (state.csub === "feed") renderFeed();
    if (state.csub === "circles") renderCircles();
    if (state.csub === "people") renderPeople();
  }

  function renderTopicChips() {
    const box = $("#topic-chips");
    const all = [{ id: "all", name: "全部", emoji: "✨" }, ...seed.topics];
    box.innerHTML = all
      .map(
        (t) =>
          `<button type="button" class="topic-chip${state.topicFilter === t.id ? " active" : ""}" data-topic="${t.id}">${t.emoji} ${escapeHtml(t.name)}</button>`
      )
      .join("");
    box.querySelectorAll(".topic-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.topicFilter = btn.dataset.topic;
        renderFeed();
      });
    });
  }

  function publicPosts() {
    return state.posts
      .filter((p) => p.visibility === "public")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function renderFeed() {
    renderTopicChips();
    const list = $("#feed-list");
    list.innerHTML = "";
    let items = publicPosts();
    if (state.topicFilter !== "all") {
      items = items.filter((p) => (p.topicIds || []).includes(state.topicFilter));
    }
    if (!items.length) {
      list.innerHTML = `<p class="empty-hint">这个话题还没有动态，去写一记并分享到社区吧。</p>`;
      return;
    }
    items.forEach((p) => list.appendChild(makePostCard(p)));
  }

  function makePostCard(p) {
    const u = getUser(p.userId);
    const card = document.createElement("article");
    card.className = "feed-card";
    const topics = (p.topicIds || [])
      .map(getTopic)
      .filter(Boolean)
      .map((t) => `<span class="mini-tag">${t.emoji} ${escapeHtml(t.name)}</span>`)
      .join("");
    const img =
      p.images && p.images[0]
        ? `<img class="feed-img" src="${p.images[0]}" alt="" />`
        : "";
    const excerpt = (p.body || "").replace(/\n+/g, " ").slice(0, 80);
    const liked = p.likedByMe || state.likedPostIds.includes(p.id);
    card.innerHTML = `
      <button type="button" class="feed-author" data-user="${u.id}">
        <img class="avatar" src="${u.avatar}" alt="" />
        <div>
          <strong>${escapeHtml(u.nickname)}</strong>
          <span class="meta">${escapeHtml(u.city || "")} · ${formatRelative(p.createdAt)}</span>
        </div>
      </button>
      <button type="button" class="feed-body-btn" data-post="${p.id}">
        <h3>${escapeHtml(p.title || "无题")}</h3>
        <p class="excerpt">${escapeHtml(excerpt)}${(p.body || "").length > 80 ? "…" : ""}</p>
        ${img}
        <div class="feed-tags">${topics}</div>
      </button>
      <div class="feed-actions">
        <button type="button" class="like-btn${liked ? " on" : ""}" data-like="${p.id}">
          ${liked ? "♥" : "♡"} ${p.likeCount || 0}
        </button>
        <button type="button" class="cmt-btn" data-post="${p.id}">💬 ${commentCount(p.id)}</button>
      </div>`;
    card.querySelector(".feed-author").addEventListener("click", () => openProfile(u.id));
    card.querySelector(".feed-body-btn").addEventListener("click", () => openPost(p.id));
    card.querySelector(".cmt-btn").addEventListener("click", () => openPost(p.id));
    card.querySelector(".like-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLike(p.id);
      renderCommunity();
    });
    return card;
  }

  function toggleLike(postId) {
    const p = state.posts.find((x) => x.id === postId);
    if (!p) return;
    const idx = state.likedPostIds.indexOf(postId);
    if (idx >= 0) {
      state.likedPostIds.splice(idx, 1);
      p.likedByMe = false;
      p.likeCount = Math.max(0, (p.likeCount || 0) - 1);
    } else {
      state.likedPostIds.push(postId);
      p.likedByMe = true;
      p.likeCount = (p.likeCount || 0) + 1;
    }
    saveCommunity();
  }

  function openPost(id) {
    state.currentPostId = id;
    state.backFromPost = state.view === "circle" ? "circle" : state.view === "profile" ? "profile" : "community";
    showView("post");
  }

  function renderPost() {
    const p = state.posts.find((x) => x.id === state.currentPostId);
    if (!p) {
      showView("community");
      return;
    }
    const u = getUser(p.userId);
    const topics = (p.topicIds || [])
      .map(getTopic)
      .filter(Boolean)
      .map((t) => `<span class="tag">${t.emoji} ${escapeHtml(t.name)}</span>`)
      .join("");
    const imgs = (p.images || [])
      .map((src) => `<img src="${src}" alt="" />`)
      .join("");
    const liked = p.likedByMe || state.likedPostIds.includes(p.id);
    const circle = p.circleId ? getCircle(p.circleId) : null;
    $("#post-article").innerHTML = `
      <button type="button" class="feed-author" id="post-author-btn">
        <img class="avatar" src="${u.avatar}" alt="" />
        <div>
          <strong>${escapeHtml(u.nickname)}</strong>
          <span class="meta">${escapeHtml(u.city || "")} · ${formatRelative(p.createdAt)}</span>
        </div>
      </button>
      <h2 class="post-title">${escapeHtml(p.title || "无题")}</h2>
      ${circle ? `<p class="post-circle-link">来自圈子 · ${escapeHtml(circle.name)}</p>` : ""}
      <div class="post-images">${imgs}</div>
      <div class="diary-body">${(p.body || "")
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
        .join("")}</div>
      <div class="diary-tags">${topics}</div>
      <div class="post-like-row">
        <button type="button" class="like-btn big${liked ? " on" : ""}" id="post-like-btn">
          ${liked ? "♥ 已赞" : "♡ 点赞"} · ${p.likeCount || 0}
        </button>
      </div>`;
    $("#post-author-btn").addEventListener("click", () => openProfile(u.id));
    $("#post-like-btn").addEventListener("click", () => {
      toggleLike(p.id);
      renderPost();
    });

    const clist = $("#comment-list");
    const cms = state.comments
      .filter((c) => c.postId === p.id)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    if (!cms.length) {
      clist.innerHTML = `<p class="empty-hint tiny">还没有评论，来做第一个温暖的人吧。</p>`;
    } else {
      clist.innerHTML = cms
        .map((c) => {
          const cu = getUser(c.userId);
          return `<div class="comment-item">
            <img class="avatar sm" src="${cu.avatar}" alt="" />
            <div>
              <strong>${escapeHtml(cu.nickname)}</strong>
              <span class="meta">${formatRelative(c.createdAt)}</span>
              <p>${escapeHtml(c.body)}</p>
            </div>
          </div>`;
        })
        .join("");
    }
  }

  function renderCircles() {
    const list = $("#circle-list");
    list.innerHTML = "";
    seed.circles.forEach((c) => {
      const joined = state.joinedCircleIds.includes(c.id);
      const card = document.createElement("article");
      card.className = "circle-card";
      card.innerHTML = `
        <div class="circle-cover" style="background:${c.coverColor}">${c.coverEmoji}</div>
        <div class="circle-info">
          <h3>${escapeHtml(c.name)}</h3>
          <p>${escapeHtml(c.intro)}</p>
          <div class="meta">${c.memberCount} 人 · 今日 ${c.todayPostCount} 条动态</div>
          <div class="circle-actions">
            <button type="button" class="btn-ghost btn-sm enter-circle" data-id="${c.id}">进入</button>
            <button type="button" class="btn-primary btn-sm join-circle" data-id="${c.id}">
              ${joined ? "已加入" : "加入"}
            </button>
          </div>
        </div>`;
      card.querySelector(".enter-circle").addEventListener("click", () => {
        state.currentCircleId = c.id;
        showView("circle");
      });
      card.querySelector(".join-circle").addEventListener("click", () => {
        toggleJoin(c.id);
        renderCircles();
      });
      // whole card enter except buttons handled
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        state.currentCircleId = c.id;
        showView("circle");
      });
      list.appendChild(card);
    });
  }

  function toggleJoin(circleId) {
    const idx = state.joinedCircleIds.indexOf(circleId);
    if (idx >= 0) {
      state.joinedCircleIds.splice(idx, 1);
      toast("已退出圈子（演示）");
    } else {
      state.joinedCircleIds.push(circleId);
      toast("已加入圈子（演示）");
    }
    saveCommunity();
  }

  function renderCircle() {
    const c = getCircle(state.currentCircleId);
    if (!c) {
      showView("community");
      return;
    }
    $("#circle-title").textContent = c.name;
    const joined = state.joinedCircleIds.includes(c.id);
    $("#circle-hero").innerHTML = `
      <div class="circle-hero-inner" style="background:${c.coverColor}">
        <div class="circle-emoji">${c.coverEmoji}</div>
        <h2>${escapeHtml(c.name)}</h2>
        <p>${escapeHtml(c.intro)}</p>
        <div class="meta">${c.memberCount} 人 · 今日 ${c.todayPostCount} 条</div>
        <button type="button" class="btn-primary btn-sm" id="btn-join-circle">
          ${joined ? "✓ 已加入" : "+ 加入圈子"}
        </button>
      </div>`;
    $("#btn-join-circle").addEventListener("click", () => {
      toggleJoin(c.id);
      renderCircle();
    });
    const feed = $("#circle-feed");
    feed.innerHTML = "";
    const items = publicPosts().filter((p) => p.circleId === c.id);
    if (!items.length) {
      feed.innerHTML = `<p class="empty-hint">圈子里还没有动态。</p>`;
      return;
    }
    items.forEach((p) => feed.appendChild(makePostCard(p)));
  }

  function renderPeople() {
    const list = $("#people-list");
    list.innerHTML = "";
    seed.users
      .filter((u) => u.id !== seed.ME_ID)
      .forEach((u) => {
        const topics = (u.topicIds || [])
          .map(getTopic)
          .filter(Boolean)
          .map((t) => `${t.emoji}${t.name}`)
          .join(" · ");
        const card = document.createElement("button");
        card.type = "button";
        card.className = "people-card";
        card.innerHTML = `
          <img class="avatar" src="${u.avatar}" alt="" />
          <div>
            <strong>${escapeHtml(u.nickname)}</strong>
            <span class="meta">${escapeHtml(u.city || "")}</span>
            <p>${escapeHtml(u.bio || "")}</p>
            <div class="mini-tags">${escapeHtml(topics)}</div>
          </div>`;
        card.addEventListener("click", () => openProfile(u.id));
        list.appendChild(card);
      });
  }

  function openProfile(userId) {
    state.currentProfileId = userId;
    showView("profile");
  }

  function renderProfile() {
    const u = getUser(state.currentProfileId);
    if (!u) {
      showView("community");
      return;
    }
    const topics = (u.topicIds || [])
      .map(getTopic)
      .filter(Boolean)
      .map((t) => `<span class="tag">${t.emoji} ${escapeHtml(t.name)}</span>`)
      .join("");
    $("#profile-hero").innerHTML = `
      <img class="avatar lg" src="${u.avatar}" alt="" />
      <h2>${escapeHtml(u.nickname)}</h2>
      <p class="meta">${escapeHtml(u.city || "")}</p>
      <p class="bio">${escapeHtml(u.bio || "")}</p>
      <div class="diary-tags">${topics}</div>`;
    const feed = $("#profile-feed");
    feed.innerHTML = "";
    const items = publicPosts().filter((p) => p.userId === u.id);
    if (!items.length) {
      feed.innerHTML = `<p class="empty-hint">TA 还没有公开日记。</p>`;
      return;
    }
    items.forEach((p) => feed.appendChild(makePostCard(p)));
  }

  /* ========== Record / AI template ========== */

  function renderRecordTopics() {
    const box = $("#record-topic-chips");
    box.innerHTML = seed.topics
      .map(
        (t) =>
          `<button type="button" class="topic-chip${state.draftTopicId === t.id ? " active" : ""}" data-topic="${t.id}">${t.emoji} ${escapeHtml(t.name)}</button>`
      )
      .join("");
    box.querySelectorAll(".topic-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.draftTopicId = btn.dataset.topic;
        renderRecordTopics();
      });
    });
    updateVisPick();
  }

  function updateVisPick() {
    const pub = $('input[name="visibility"][value="public"]');
    const pick = $("#topic-pick");
    if (pub && pick) pick.hidden = !pub.checked;
  }

  function renderEditTopics() {
    const box = $("#edit-topic-chips");
    box.innerHTML = seed.topics
      .map(
        (t) =>
          `<button type="button" class="topic-chip${state.editTopicId === t.id ? " active" : ""}" data-topic="${t.id}">${t.emoji} ${escapeHtml(t.name)}</button>`
      )
      .join("");
    box.querySelectorAll(".topic-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editTopicId = btn.dataset.topic;
        renderEditTopics();
      });
    });
    const pub = $('input[name="edit-visibility"][value="public"]');
    $("#edit-topic-pick").hidden = !(pub && pub.checked);
  }

  function organizeDiary(raw) {
    let text = (raw || "").trim().replace(/\s+/g, " ");
    if (!text) {
      text = "今天没有写很多字，但还是想留下一点痕迹。慢慢来，已经很好了。";
    }
    const parts = text
      .replace(/([。！？!?])/g, "$1\n")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const paras = [];
    let buf = [];
    parts.forEach((s, i) => {
      buf.push(s);
      if (buf.length >= 2 || i === parts.length - 1) {
        paras.push(buf.join(""));
        buf = [];
      }
    });
    let body = paras.join("\n\n");
    if (!body.includes("慢慢")) body += "\n\n慢慢来，未来值得期待。";
    return { title: makeTitle(text), body, tags: guessTags(text) };
  }

  function makeTitle(text) {
    const hints = [
      [/家人|爸|妈|散步/, "和家人在一起"],
      [/阳光|柠檬|茶|水/, "阳光里的小确幸"],
      [/医院|复查|治疗|化疗/, "治疗路上的一天"],
      [/睡|休息|累/, "给自己一点休息"],
      [/朋友|聊天/, "被温柔接住的一天"],
    ];
    for (const [re, t] of hints) {
      if (re.test(text)) return t;
    }
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日的记录`;
  }

  function guessTags(text) {
    const tags = [];
    if (/家人|爸|妈|孩子/.test(text)) tags.push("家人陪伴");
    if (/平静|安静|平稳|安心/.test(text)) tags.push("心情平稳");
    if (/开心|幸福|确幸|感恩/.test(text)) tags.push("小确幸");
    if (/累|疼|不适|难受/.test(text)) tags.push("需要休息");
    if (/散步|公园|户外|走/.test(text)) tags.push("户外");
    if (!tags.length) tags.push("日常点滴");
    return tags.slice(0, 3);
  }

  function publishDiaryToCommunity(diary) {
    // upsert post linked to diary
    let post = state.posts.find((p) => p.diaryId === diary.id && p.userId === seed.ME_ID);
    if (!post) {
      post = {
        id: uid("p"),
        diaryId: diary.id,
        userId: seed.ME_ID,
        circleId: state.joinedCircleIds[0] || null,
        topicIds: diary.topicIds || [],
        title: diary.title,
        body: diary.body,
        images: diary.images || [],
        likeCount: 0,
        likedByMe: false,
        createdAt: diary.createdAt,
        visibility: "public",
      };
      state.posts.unshift(post);
    } else {
      post.title = diary.title;
      post.body = diary.body;
      post.images = diary.images || [];
      post.topicIds = diary.topicIds || [];
      post.visibility = "public";
    }
    saveCommunity();
  }

  function unpublishDiaryFromCommunity(diaryId) {
    state.posts = state.posts.filter((p) => !(p.diaryId === diaryId && p.userId === seed.ME_ID));
    saveCommunity();
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
    box.querySelectorAll(".rm").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        state.draftPhotos.splice(+btn.dataset.i, 1);
        renderPhotoPreviews();
      });
    });
  }

  async function captureLongImage(targetEl, filename) {
    if (typeof html2canvas !== "function") {
      toast("长图组件加载中，请稍后再试");
      return;
    }
    toast("正在生成长图…");
    try {
      const canvas = await html2canvas(targetEl, {
        backgroundColor: "#FFFEF9",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const img = $("#lightbox-img");
      const dl = $("#lightbox-download");
      img.src = url;
      dl.href = url;
      dl.download = filename || "友爱日记.png";
      $("#lightbox").hidden = false;
    } catch (err) {
      console.error(err);
      toast("生成失败，请重试");
    }
  }

  function resetDraft() {
    state.draftPhotos = [];
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
      $("#voice-status").textContent = "不支持麦克风，请在下方打字";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      state.audioChunks = [];
      state.mediaRecorder = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) state.audioChunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ta = $("#raw-text");
        const note = "（语音已录制 · 演示站未接语音转文字，请在此补充你想说的话）";
        if (!ta.value.includes("语音已录制")) {
          ta.value = (ta.value ? ta.value + "\n" : "") + note;
        }
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

  function bind() {
    $("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = $("#login-user").value.trim();
      const p = $("#login-pass").value;
      if (u === DEMO_USER && p === DEMO_PASS) {
        $("#login-error").hidden = true;
        setAuthed(true);
        seedDiariesIfEmpty();
        loadCommunity();
        showView("home");
      } else {
        $("#login-error").hidden = false;
      }
    });

    $("#btn-logout").addEventListener("click", logout);
    $("#btn-logout-me").addEventListener("click", logout);
    $("#btn-clear-data").addEventListener("click", () => {
      if (confirm("确定清空本机日记与社区互动？不可恢复（会重新载入演示社区 seed）。")) {
        state.diaries = [];
        saveDiaries();
        localStorage.removeItem(seed.COMMUNITY_KEY);
        seedCommunity();
        toast("已清空并重置社区演示数据");
        showView("home");
      }
    });

    $("#btn-community-pick").addEventListener("click", () => {
      state.csub = "feed";
      showView("community");
    });

    $("#btn-start-record").addEventListener("click", () => {
      resetDraft();
      showView("record");
    });

    $$(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const to = btn.dataset.back;
        if (to === "diary") showView("diary");
        else if (to === "community") {
          // smart back from post/circle/profile
          if (state.view === "post" && state.backFromPost === "circle") showView("circle");
          else if (state.view === "post" && state.backFromPost === "profile") showView("profile");
          else {
            state.csub = state.view === "circle" ? "circles" : state.view === "profile" ? "people" : state.csub;
            showView("community");
          }
        } else showView(to || "home");
      });
    });

    // tab bars (multiple instances)
    document.addEventListener("click", (e) => {
      const tab = e.target.closest(".tab-bar .tab");
      if (!tab) return;
      const name = tab.dataset.tab;
      if (name === "record") {
        resetDraft();
        showView("record");
      } else if (name === "community") {
        state.csub = "feed";
        showView("community");
      } else if (name === "book") showView("book");
      else if (name === "me") showView("me");
      else showView("home");
    });

    $$(".csub").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.csub = btn.dataset.csub;
        renderCommunity();
      });
    });

    $("#comment-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#comment-input");
      const body = input.value.trim();
      if (!body || !state.currentPostId) return;
      state.comments.push({
        id: uid("cm"),
        postId: state.currentPostId,
        userId: seed.ME_ID,
        body,
        createdAt: new Date().toISOString(),
      });
      saveCommunity();
      input.value = "";
      toast("评论已发布（仅本机）");
      renderPost();
    });

    $$('input[name="visibility"]').forEach((r) => {
      r.addEventListener("change", updateVisPick);
    });
    $$('input[name="edit-visibility"]').forEach((r) => {
      r.addEventListener("change", () => {
        $("#edit-topic-pick").hidden = !$('input[name="edit-visibility"][value="public"]').checked;
      });
    });

    $("#photo-drop").addEventListener("click", () => $("#photo-input").click());
    $("#photo-input").addEventListener("change", async (e) => {
      const files = [...(e.target.files || [])];
      for (const f of files.slice(0, 6)) {
        if (!f.type.startsWith("image/")) continue;
        const url = await fileToDataURL(f);
        state.draftPhotos.push(url);
      }
      renderPhotoPreviews();
      e.target.value = "";
    });

    const voiceBtn = $("#btn-voice");
    voiceBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      startVoice();
    });
    voiceBtn.addEventListener("pointerup", () => stopVoice());
    voiceBtn.addEventListener("pointerleave", () => {
      if (state.recording) stopVoice();
    });
    voiceBtn.addEventListener("pointercancel", () => {
      if (state.recording) stopVoice();
    });

    $("#btn-generate").addEventListener("click", () => {
      const raw = $("#raw-text").value;
      if (!raw.trim() && !state.draftPhotos.length) {
        toast("先拍张照、说几句，或打几个字吧");
        return;
      }
      const organized = organizeDiary(raw);
      const visibility = $('input[name="visibility"][value="public"]').checked ? "public" : "private";
      if (visibility === "public" && !state.draftTopicId) {
        toast("分享到社区请先选一个话题");
        return;
      }
      const entry = {
        id: uid("d"),
        title: organized.title,
        body: organized.body,
        tags: organized.tags,
        images: [...state.draftPhotos],
        createdAt: new Date().toISOString(),
        raw,
        visibility,
        topicIds: visibility === "public" ? [state.draftTopicId] : [],
      };
      state.diaries.unshift(entry);
      saveDiaries();
      if (visibility === "public") {
        publishDiaryToCommunity(entry);
        toast("日记已生成并分享到社区");
      } else {
        toast("日记已生成（仅自己可见）");
      }
      state.currentId = entry.id;
      resetDraft();
      showView("diary");
    });

    $("#btn-edit").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      $("#diary-article").hidden = true;
      $("#edit-panel").hidden = false;
      $("#edit-title").value = d.title || "";
      $("#edit-body").value = d.body || "";
      const vis = d.visibility === "public" ? "public" : "private";
      $(`input[name="edit-visibility"][value="${vis}"]`).checked = true;
      state.editTopicId = (d.topicIds && d.topicIds[0]) || seed.topics[0].id;
      renderEditTopics();
    });
    $("#btn-cancel-edit").addEventListener("click", () => {
      $("#edit-panel").hidden = true;
      $("#diary-article").hidden = false;
    });
    $("#btn-save-edit").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      d.title = $("#edit-title").value.trim() || d.title;
      d.body = $("#edit-body").value;
      const visibility = $('input[name="edit-visibility"][value="public"]').checked ? "public" : "private";
      if (visibility === "public" && !state.editTopicId) {
        toast("分享到社区请先选一个话题");
        return;
      }
      d.visibility = visibility;
      d.topicIds = visibility === "public" ? [state.editTopicId] : [];
      saveDiaries();
      if (visibility === "public") publishDiaryToCommunity(d);
      else unpublishDiaryFromCommunity(d.id);
      $("#edit-panel").hidden = true;
      $("#diary-article").hidden = false;
      renderDiary();
      toast(visibility === "public" ? "已保存并同步到社区" : "已保存（仅自己）");
    });

    $("#btn-longimg").addEventListener("click", () => {
      captureLongImage($("#diary-article"), "友爱日记-详情.png");
    });
    $("#btn-share").addEventListener("click", () => showView("share"));

    $("#btn-copy-link").addEventListener("click", async () => {
      const url = location.href.split("#")[0];
      try {
        await navigator.clipboard.writeText(url);
        toast("已复制本站链接（演示：亲友需自行登录查看）");
      } catch {
        toast("请手动复制地址栏链接");
      }
    });
    $("#btn-moments").addEventListener("click", () => {
      captureLongImage($("#share-card"), "友爱日记-分享卡.png");
    });
    $("#btn-save-album").addEventListener("click", () => {
      captureLongImage($("#share-card"), "友爱日记.png");
    });

    $("#lightbox-close").addEventListener("click", () => {
      $("#lightbox").hidden = true;
    });
    $("#btn-more").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      if (confirm("删除这篇日记？")) {
        unpublishDiaryFromCommunity(d.id);
        state.diaries = state.diaries.filter((x) => x.id !== d.id);
        saveDiaries();
        toast("已删除");
        showView("home");
      }
    });
  }

  function boot() {
    loadDiaries();
    bind();
    if (isAuthed()) {
      seedDiariesIfEmpty();
      loadCommunity();
      showView("home");
    } else {
      showView("login");
    }
  }

  boot();
})();
