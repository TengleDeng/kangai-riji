(() => {
  "use strict";

  const DEMO_USER = "demo";
  const DEMO_PASS = "kangai2026";
  const AUTH_KEY = "kangai_auth";
  const STORE_KEY = "kangai_diaries";

  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

  const state = {
    view: "login",
    diaries: [],
    currentId: null,
    draftPhotos: [], // data URLs
    mediaRecorder: null,
    audioChunks: [],
    recording: false,
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

  function seedIfEmpty() {
    if (state.diaries.length) return;
    const samples = [
      {
        id: "seed-1",
        title: "化疗后的小确幸",
        createdAt: daysAgo(1),
        body: "阳光很好，喝了一杯温热的柠檬水。\n\n身体慢慢恢复中，心也安静了。没有什么大事，可这一小杯热水，已经足够温暖今天。\n\n慢慢来，我们都在变好。",
        tags: ["心情平稳", "小确幸"],
        images: [],
      },
      {
        id: "seed-2",
        title: "和家人散步",
        createdAt: daysAgo(3),
        body: "傍晚和家人在公园走了走，聊了聊开心的事。\n\n风有点凉，但身边有人，感觉很踏实。平凡的陪伴，是最安心的药。",
        tags: ["家人陪伴", "户外"],
        images: [],
      },
    ];
    state.diaries = samples;
    saveDiaries();
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

  function showView(name) {
    state.view = name;
    $$(".view").forEach((v) => { v.hidden = true; });
    const map = {
      login: "#view-login",
      home: "#view-home",
      record: "#view-record",
      diary: "#view-diary",
      share: "#view-share",
      book: "#view-book",
      me: "#view-me",
    };
    const el = $(map[name]);
    if (el) el.hidden = false;
    window.scrollTo(0, 0);

    if (name === "home") renderHome();
    if (name === "book") renderBook();
    if (name === "diary") renderDiary();
    if (name === "share") renderShare();
  }

  function requireAuth() {
    if (!isAuthed()) {
      showView("login");
      return false;
    }
    return true;
  }

  function renderHome() {
    const list = $("#diary-list");
    const empty = $("#empty-hint");
    list.innerHTML = "";
    const items = [...state.diaries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    empty.hidden = items.length > 0;
    items.forEach((d) => list.appendChild(makeCard(d)));
  }

  function renderBook() {
    const list = $("#book-list");
    list.innerHTML = "";
    const items = [...state.diaries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (!items.length) {
      list.innerHTML = `<p class="empty-hint">日记本还是空的，去写一记吧。</p>`;
      return;
    }
    items.forEach((d) => list.appendChild(makeCard(d)));
  }

  function makeCard(d) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diary-card";
    const thumb = d.images && d.images[0]
      ? `<img class="thumb" src="${d.images[0]}" alt="" />`
      : `<div class="thumb placeholder">🌿</div>`;
    const excerpt = (d.body || "").replace(/\n+/g, " ").slice(0, 60);
    btn.innerHTML = `
      ${thumb}
      <div>
        <h3>${escapeHtml(d.title || "无题")}</h3>
        <div class="meta">${formatMeta(d.createdAt)}</div>
        <div class="excerpt">${escapeHtml(excerpt)}</div>
        <div class="status">● 已整理</div>
      </div>`;
    btn.addEventListener("click", () => {
      state.currentId = d.id;
      showView("diary");
    });
    return btn;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  /** Local template "AI" organizer — no paid API */
  function organizeDiary(raw) {
    let text = (raw || "").trim().replace(/\s+/g, " ");
    if (!text) {
      text = "今天没有写很多字，但还是想留下一点痕迹。慢慢来，已经很好了。";
    }
    // Split into sentences roughly
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

    const closing = "\n\n慢慢来，未来值得期待。";
    let body = paras.join("\n\n");
    if (!body.includes("慢慢")) body += closing;

    const title = makeTitle(text);
    const tags = guessTags(text);
    return { title, body, tags };
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

  function uid() {
    return "d-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

  function bind() {
    $("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = $("#login-user").value.trim();
      const p = $("#login-pass").value;
      if (u === DEMO_USER && p === DEMO_PASS) {
        $("#login-error").hidden = true;
        setAuthed(true);
        seedIfEmpty();
        showView("home");
      } else {
        $("#login-error").hidden = false;
      }
    });

    $("#btn-logout").addEventListener("click", logout);
    $("#btn-logout-me").addEventListener("click", logout);
    $("#btn-clear-data").addEventListener("click", () => {
      if (confirm("确定清空本机所有日记？不可恢复。")) {
        state.diaries = [];
        saveDiaries();
        toast("已清空");
        showView("home");
      }
    });

    $("#btn-start-record").addEventListener("click", (e) => {
      if (e.target.closest("button") || e.currentTarget === e.target || true) {
        resetDraft();
        showView("record");
      }
    });

    $$(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const to = btn.dataset.back;
        if (to === "diary") showView("diary");
        else showView(to || "home");
      });
    });

    $$(".tab-bar .tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".tab-bar .tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const name = tab.dataset.tab;
        if (name === "record") {
          resetDraft();
          showView("record");
        } else if (name === "book") showView("book");
        else if (name === "me") showView("me");
        else showView("home");
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
      const entry = {
        id: uid(),
        title: organized.title,
        body: organized.body,
        tags: organized.tags,
        images: [...state.draftPhotos],
        createdAt: new Date().toISOString(),
        raw,
      };
      state.diaries.unshift(entry);
      saveDiaries();
      state.currentId = entry.id;
      resetDraft();
      toast("日记已生成（本地模板整理）");
      showView("diary");
    });

    $("#btn-edit").addEventListener("click", () => {
      const d = currentDiary();
      if (!d) return;
      $("#diary-article").hidden = true;
      $("#edit-panel").hidden = false;
      $("#edit-title").value = d.title || "";
      $("#edit-body").value = d.body || "";
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
      saveDiaries();
      $("#edit-panel").hidden = true;
      $("#diary-article").hidden = false;
      renderDiary();
      toast("已保存");
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
        state.diaries = state.diaries.filter((x) => x.id !== d.id);
        saveDiaries();
        toast("已删除");
        showView("home");
      }
    });
  }

  function resetDraft() {
    state.draftPhotos = [];
    $("#raw-text").value = "";
    renderPhotoPreviews();
    $("#voice-status").hidden = true;
    $("#voice-label").textContent = "按住说话";
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
        // Demo: no speech-to-text API — append a placeholder note
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

  function boot() {
    loadDiaries();
    bind();
    if (isAuthed()) {
      seedIfEmpty();
      showView("home");
    } else {
      showView("login");
    }
  }

  boot();
})();
