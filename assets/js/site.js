let SUNSHINE_SCHEDULE = [
  { start: "10:00", end: "12:00", time: "10:00 - 12:00", show: "Morning Sunshine", host: "with Alex K.", dj: "Alex K." },
  { start: "12:00", end: "14:00", time: "12:00 - 14:00", show: "SunShine Hits", host: "with Maria S.", dj: "Maria S." },
  { start: "14:00", end: "16:00", time: "14:00 - 16:00", show: "Greek Vibes", host: "with Nikos P.", dj: "Nikos P." },
  { start: "16:00", end: "18:00", time: "16:00 - 18:00", show: "Dance Floor", host: "with DJ Chris", dj: "DJ Chris" },
  { start: "18:00", end: "20:00", time: "18:00 - 20:00", show: "Retro Time", host: "with Elena D.", dj: "Elena D." },
  { start: "20:00", end: "22:00", time: "20:00 - 22:00", show: "Laiko & More", host: "with Giorgos M.", dj: "Giorgos M." },
  { start: "22:00", end: "00:00", time: "22:00 - 00:00", show: "Night Sessions", host: "with DJ Alex", dj: "DJ Alex" }
];

let SUNSHINE_DJS = [
  { initials: "AK", name: "Alex K.", show: "Morning Sunshine", time: "10:00 - 12:00", start: "10:00", end: "12:00" },
  { initials: "MS", name: "Maria S.", show: "SunShine Hits", time: "12:00 - 14:00", start: "12:00", end: "14:00" },
  { initials: "NP", name: "Nikos P.", show: "Greek Vibes", time: "14:00 - 16:00", start: "14:00", end: "16:00" },
  { initials: "ED", name: "Elena D.", show: "Retro Time", time: "18:00 - 20:00", start: "18:00", end: "20:00" }
];

const SUNSHINE_INITIAL_MESSAGES = []

const CHAT_STORAGE_KEY = "sunshine_chat_preview_v1";
const CHAT_USERNAME_KEY = "sunshine_chat_username_v1";
const CHAT_OWNER_TOKEN_KEY = "sunshine_chat_owner_token_v1";
const CONTACT_STORAGE_KEY = "sunshine_contact_draft_v1";
const SUNSHINE_CMS_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-admin-auth";
const SUNSHINE_LIFESTYLE_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-lifestyle-api";
const SUNSHINE_CHAT_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-chat-api";
const SUNSHINE_PLAYBACK_MODE_KEY = "sunshine_playback_mode_v1";
let SUNSHINE_SHOWS = [];
let SUNSHINE_LIFESTYLE_ARTICLES = [];
let SUNSHINE_PUBLIC_CONTENT = {};
const SUNSHINE_RADIO_CONFIG = window.SUNSHINE_RADIO_CONFIG || { streamUrl: "", metadataUrl: "" };

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
const toast = document.getElementById("toast");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3300);
}


async function loadPublicContent() {
  try {
    const response = await fetch(SUNSHINE_CMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publicContent" }),
      cache: "no-store"
    });
    if (!response.ok) return;
    const data = await response.json();
    SUNSHINE_PUBLIC_CONTENT = data.content || {};

    if (Array.isArray(SUNSHINE_PUBLIC_CONTENT.schedule)) {
      SUNSHINE_SCHEDULE = SUNSHINE_PUBLIC_CONTENT.schedule
        .filter(item => item.active !== false)
        .sort((a,b)=>(a.order||0)-(b.order||0))
        .map(item => ({
          ...item,
          time: item.time || `${item.start || ""} - ${item.end || ""}`,
          host: item.host ? `with ${item.host}` : ""
        }));
    }

    if (Array.isArray(SUNSHINE_PUBLIC_CONTENT.djs)) {
      SUNSHINE_DJS = SUNSHINE_PUBLIC_CONTENT.djs
        .filter(item => item.active !== false)
        .sort((a,b)=>(a.order||0)-(b.order||0))
        .map(item => {
          const [start="", end=""] = String(item.time || "").split("-").map(v=>v.trim());
          return { ...item, start, end };
        });
    }

    if (Array.isArray(SUNSHINE_PUBLIC_CONTENT.shows)) {
      SUNSHINE_SHOWS = SUNSHINE_PUBLIC_CONTENT.shows
        .filter(item => item.active !== false)
        .sort((a,b)=>(a.order||0)-(b.order||0));
    }

    applyPublicContent();
  } catch (error) {
    console.warn("SunShine CMS unavailable; using static fallback.", error);
  }
}

function setText(selector, value) {
  if (value == null || value === "") return;
  document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {}
  return "";
}

function renderAdSlot(elementId, config) {
  const root = document.getElementById(elementId);
  if (!root) return;
  root.innerHTML = "";
  root.classList.remove("is-active");
  if (!config?.enabled) return;

  const mediaUrl = safeHttpUrl(config.mediaUrl);
  if (!mediaUrl) return;

  root.classList.add("is-active");

  const label = document.createElement("span");
  label.className = "home-ad-label";
  label.textContent = config.label || "Advertisement";
  root.appendChild(label);

  const media = document.createElement(config.type === "image" ? "img" : "video");
  media.className = "home-ad-media";
  media.src = mediaUrl;
  media.setAttribute("aria-label", config.label || "Advertisement");
  media.style.objectFit = config.fit || "cover";

  if (media.tagName === "VIDEO") {
    media.autoplay = Boolean(config.autoplay);
    media.muted = config.muted !== false;
    media.loop = Boolean(config.loop);
    media.playsInline = true;
    media.controls = true;
    media.preload = "metadata";
  } else {
    media.alt = config.label || "Advertisement";
    media.loading = "lazy";
  }

  const clickUrl = safeHttpUrl(config.clickUrl);
  if (clickUrl) {
    const link = document.createElement("a");
    link.className = "home-ad-link";
    link.href = clickUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer sponsored";
    link.appendChild(media);
    root.appendChild(link);
  } else {
    root.appendChild(media);
  }
}

function applyLiveAndChatContent() {
  const live = SUNSHINE_PUBLIC_CONTENT.live || {};
  if (document.body.classList.contains("page-live")) {
    const heading = document.querySelector(".subpage-hero h1");
    if (heading && live.heroTitle) heading.textContent = live.heroTitle;
    setText(".page-live .subpage-hero p", live.heroSubtitle);
    setText(".page-live .station-label strong", live.stationLabel);
    setText(".page-live .station-label span", live.streamLabel);
    setText(".page-live #trackTitle", live.fallbackTrackTitle);
    setText(".page-live #trackArtist", live.fallbackTrackArtist);
    const player = document.getElementById("player");
    if (player && live.playerEnabled === false) player.hidden = true;
  }

  const chat = SUNSHINE_PUBLIC_CONTENT.chat || {};
  const liveChat = document.getElementById("liveChat");
  if (liveChat) {
    liveChat.hidden = chat.enabled === false;
    const title = document.getElementById("liveChatTitle");
    if (title && chat.title) title.textContent = chat.title;
    setText("#liveChatSubtitle", chat.subtitle);
    setText("#liveChatStatusLabel", chat.statusLabel);
    const input = document.getElementById("chatInputLive");
    if (input && chat.placeholder) input.placeholder = chat.placeholder;
  }
}

function applyPublicContent() {
  const site = SUNSHINE_PUBLIC_CONTENT.site || {};
  if (document.body.classList.contains("page-home")) {
    const hero = document.querySelector(".hero-brand h1");
    if (hero && (site.heroTitle || site.heroAccent)) {
      hero.innerHTML = `${escapeHtml(site.heroTitle || "Feel the Music.")} <span>${escapeHtml(site.heroAccent || "Feel the Light.")}</span>`;
    }
    setText(".hero-brand > p", site.subtitle);
  }
  setText(".station-label strong", site.stationName);
  setText(".station-label span", site.streamLabel);
  setText(".footer-brand strong", site.stationName);
  setText(".footer-brand p", site.tagline);

  const social = SUNSHINE_PUBLIC_CONTENT.social || {};
  const socialMap = { Facebook: social.facebook, Instagram: social.instagram, TikTok: social.tiktok, YouTube: social.youtube };
  document.querySelectorAll(".social-row a").forEach(link => {
    const url = socialMap[link.getAttribute("aria-label")];
    if (url) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.removeAttribute("data-placeholder-link");
    } else {
      link.href = "#";
    }
  });

  const ads = SUNSHINE_PUBLIC_CONTENT.ads || {};
  renderAdSlot("homeAdLeft", ads.homeLeft);
  renderAdSlot("homeAdRight", ads.homeRight);
  applyLiveAndChatContent();

  const lifestyle = SUNSHINE_PUBLIC_CONTENT.lifestyle || {};
  if (document.body.classList.contains("page-lifestyle")) {
    setText("#lifestyleTitle", lifestyle.title ? "SunShine " + lifestyle.title : "SunShine Life Style");
    setText("#lifestyleSubtitle", lifestyle.subtitle);
  }

  const contact = SUNSHINE_PUBLIC_CONTENT.contact || {};
  const emailEl = document.getElementById("publicContactEmail");
  const phoneEl = document.getElementById("publicContactPhone");
  const locationEl = document.getElementById("publicContactLocation");
  if (emailEl) emailEl.textContent = contact.email || "Not published yet";
  if (phoneEl) phoneEl.textContent = contact.phone || "Not published yet";
  if (locationEl) locationEl.textContent = contact.location || "Not published yet";

  const features = SUNSHINE_PUBLIC_CONTENT.features || {};
  const visibility = [
    ["#schedule", features.homeSchedule],
    ["#djs", features.homeDjs],
    [".listen-everywhere", features.listenEverywhere]
  ];
  visibility.forEach(([selector, enabled]) => {
    if (enabled === false) document.querySelectorAll(selector).forEach(el => el.hidden = true);
  });

  const navFeatureMap = {
    "shows.html": "showsPage",
    "schedule.html": "schedulePage",
    "djs.html": "djsPage",
    "lifestyle.html": "lifestylePage",
    "chat.html": "chatPage",
    "contact.html": "contactPage"
  };
  document.querySelectorAll('a[href]').forEach(link => {
    const key = navFeatureMap[link.getAttribute("href")];
    if (key && features[key] === false) link.hidden = true;
  });

  if (features.maintenanceMode) {
    const main = document.querySelector("main");
    if (main) {
      main.innerHTML = `<section class="subpage-main"><div class="container subpage-panel legal-copy"><h1>SunShine <span>Maintenance</span></h1><p>${escapeHtml(features.maintenanceMessage || "SunShine Web Radio is currently being updated.")}</p></div></section>`;
    }
  }

  const seo = SUNSHINE_PUBLIC_CONTENT.seo || {};
  if (seo.siteTitle && document.body.classList.contains("page-home")) document.title = seo.siteTitle;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && seo.description) desc.content = seo.description;
}

async function loadLifestyleArticles() {
  if (!document.body.classList.contains("page-lifestyle")) return;
  const status = document.getElementById("lifestyleStatus");
  try {
    const cfg = SUNSHINE_PUBLIC_CONTENT.lifestyle || {};
    if (cfg.enabled === false) {
      if (status) status.textContent = cfg.emptyMessage || "Life Style is currently unavailable.";
      const grid = document.getElementById("lifestyleGrid");
      if (grid) grid.replaceChildren();
      return;
    }
    const limit = Math.max(1, Math.min(200, Number(cfg.maxArticles || 48)));
    const response = await fetch(SUNSHINE_LIFESTYLE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "public", limit }),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "LIFESTYLE_LOAD_FAILED");
    SUNSHINE_LIFESTYLE_ARTICLES = Array.isArray(data.articles) ? data.articles : [];
    renderLifestyle();
  } catch (error) {
    console.warn("Life Style feed unavailable.", error);
    if (status) status.textContent = "Life Style stories are temporarily unavailable.";
  }
}

function lifestyleDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function renderLifestyle(category = "All") {
  const grid = document.getElementById("lifestyleGrid");
  const filters = document.getElementById("lifestyleFilters");
  const status = document.getElementById("lifestyleStatus");
  if (!grid || !filters) return;

  const cfg = SUNSHINE_PUBLIC_CONTENT.lifestyle || {};
  const categories = ["All", ...new Set(SUNSHINE_LIFESTYLE_ARTICLES.map(a => a.category || "Lifestyle"))];
  filters.replaceChildren();

  categories.forEach(name => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lifestyle-filter" + (name === category ? " active" : "");
    button.textContent = name;
    button.addEventListener("click", () => renderLifestyle(name));
    filters.appendChild(button);
  });

  const visible = category === "All"
    ? SUNSHINE_LIFESTYLE_ARTICLES
    : SUNSHINE_LIFESTYLE_ARTICLES.filter(a => (a.category || "Lifestyle") === category);

  if (status) {
    status.textContent = visible.length
      ? visible.length + " fresh " + (visible.length === 1 ? "story" : "stories") + " from selected sources."
      : (cfg.emptyMessage || "New stories are being collected. Check back shortly.");
  }

  grid.replaceChildren();

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty-state lifestyle-empty";
    const strong = document.createElement("strong");
    strong.textContent = "SunShine Life Style";
    const p = document.createElement("p");
    p.textContent = cfg.emptyMessage || "New stories are being collected. Check back shortly.";
    empty.append(strong, p);
    grid.appendChild(empty);
    return;
  }

  visible.forEach(article => {
    const card = document.createElement("article");
    card.className = "lifestyle-card" + (article.pinned ? " pinned" : "");

    const mediaLink = document.createElement("a");
    mediaLink.className = "lifestyle-media";
    mediaLink.href = safeHttpUrl(article.article_url) || "#";
    if (cfg.openLinksNewTab !== false) {
      mediaLink.target = "_blank";
      mediaLink.rel = "noopener noreferrer";
    }

    const imageUrl = safeHttpUrl(article.image_url);
    if (cfg.showImages !== false && imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = "";
      img.loading = "lazy";
      mediaLink.appendChild(img);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "lifestyle-image-fallback";
      fallback.textContent = "☀";
      mediaLink.appendChild(fallback);
    }

    const body = document.createElement("div");
    body.className = "lifestyle-card-body";

    const meta = document.createElement("div");
    meta.className = "lifestyle-meta";
    if (cfg.showSource !== false && article.source_name) {
      const source = document.createElement("span");
      source.textContent = article.source_name;
      meta.appendChild(source);
    }
    if (cfg.showDate !== false && article.published_at) {
      const time = document.createElement("time");
      time.dateTime = article.published_at;
      time.textContent = lifestyleDate(article.published_at);
      meta.appendChild(time);
    }

    const title = document.createElement("h3");
    const titleLink = document.createElement("a");
    titleLink.href = safeHttpUrl(article.article_url) || "#";
    titleLink.textContent = article.title || "";
    if (cfg.openLinksNewTab !== false) {
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
    }
    title.appendChild(titleLink);

    body.append(meta, title);

    if (article.excerpt) {
      const excerpt = document.createElement("p");
      excerpt.textContent = article.excerpt;
      body.appendChild(excerpt);
    }

    const read = document.createElement("a");
    read.className = "card-link";
    read.href = safeHttpUrl(article.article_url) || "#";
    read.textContent = "Read original story →";
    if (cfg.openLinksNewTab !== false) {
      read.target = "_blank";
      read.rel = "noopener noreferrer";
    }
    body.appendChild(read);

    card.append(mediaLink, body);
    grid.appendChild(card);
  });
}

function renderShows() {
  const root = document.getElementById("showsGrid");
  if (!root || !SUNSHINE_SHOWS.length) return;
  root.innerHTML = SUNSHINE_SHOWS.map(item => `
    <article class="content-card">
      <strong>${escapeHtml(item.time || "")}</strong>
      <h3>${escapeHtml(item.name || "")}</h3>
      <p>${escapeHtml(item.description || "")}</p>
      <a class="card-link" href="schedule.html">View schedule →</a>
    </article>`).join("");
}

function timeToMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function athensMinutesNow() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Athens",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    const hour = Number(parts.find(part => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find(part => part.type === "minute")?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

function isTimeRangeLive(start, end, nowMinutes = athensMinutesNow()) {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  if (endMinutes === 0) endMinutes = 1440;
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

function currentScheduleIndex() {
  const now = athensMinutesNow();
  return SUNSHINE_SCHEDULE.findIndex(item => isTimeRangeLive(item.start, item.end, now));
}

function scheduleRow(item, live) {
  return `
    <div class="schedule-row${live ? " live" : ""}">
      <div class="${live ? "status-tag" : "row-icon"}">${live ? "ON AIR" : "◷"}</div>
      <div class="row-time">${escapeHtml(item.time)}</div>
      <div class="row-show">${escapeHtml(item.show)}</div>
      <div class="row-host">${escapeHtml(item.host)}</div>
    </div>
  `;
}

function renderSchedules() {
  const current = currentScheduleIndex();
  const markup = SUNSHINE_SCHEDULE.map((item, index) => scheduleRow(item, index === current)).join("");

  const homeList = document.getElementById("scheduleList");
  if (homeList) homeList.innerHTML = markup;

  const fullList = document.getElementById("fullScheduleList");
  if (fullList) fullList.innerHTML = markup;

  const status = document.getElementById("scheduleLiveStatus");
  if (status) {
    if (current >= 0) {
      const item = SUNSHINE_SCHEDULE[current];
      status.innerHTML = `<span class="online-dot"></span> ON AIR now: <strong>${escapeHtml(item.show)}</strong> — ${escapeHtml(item.host)}`;
    } else {
      status.textContent = "No listed live show is active right now. SunShine continues with automated music.";
    }
  }
}

function djCard(dj, live, full = false) {
  if (full) {
    return `
      <article class="subpage-dj${live ? " live-dj" : ""}">
        <div class="dj-orb" aria-hidden="true"></div>
        ${live ? '<span class="live-pill">ON AIR</span>' : ""}
        <h3>${escapeHtml(dj.name)}</h3>
        <p>${escapeHtml(dj.show)}</p>
        <small>${escapeHtml(dj.time)}</small>
      </article>
    `;
  }

  return `
    <article class="dj-card" aria-label="${escapeHtml(dj.name)}">
      <div class="dj-info">
        ${live ? '<span class="live-pill">ON AIR</span>' : ""}
        <h3>${escapeHtml(dj.name)}</h3>
        <p>${escapeHtml(dj.show)}</p>
        <small>${escapeHtml(dj.time)}</small>
      </div>
    </article>
  `;
}

function renderDjs() {
  const now = athensMinutesNow();

  const home = document.getElementById("djGrid");
  if (home) {
    home.innerHTML = SUNSHINE_DJS.map(dj => djCard(dj, isTimeRangeLive(dj.start, dj.end, now), false)).join("");
  }

  const full = document.getElementById("djGridFull");
  if (full) {
    full.innerHTML = SUNSHINE_DJS.map(dj => djCard(dj, isTimeRangeLive(dj.start, dj.end, now), true)).join("");
  }
}

function chatOwnerToken() {
  try {
    let token = localStorage.getItem(CHAT_OWNER_TOKEN_KEY) || "";
    if (token.length >= 32) return token;
    token = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) +
      (crypto.randomUUID?.() || Math.random().toString(36).slice(2));
    localStorage.setItem(CHAT_OWNER_TOKEN_KEY, token);
    return token;
  } catch {
    return (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) +
      (crypto.randomUUID?.() || Math.random().toString(36).slice(2));
  }
}

function storedChatUsername() {
  try { return (localStorage.getItem(CHAT_USERNAME_KEY) || "").trim(); }
  catch { return ""; }
}

function saveChatUsername(username) {
  try { localStorage.setItem(CHAT_USERNAME_KEY, username); } catch {}
}

function clearChatIdentity() {
  try {
    localStorage.removeItem(CHAT_USERNAME_KEY);
    localStorage.removeItem(CHAT_OWNER_TOKEN_KEY);
  } catch {}
}

async function chatApi(action, payload = {}) {
  const response = await fetch(SUNSHINE_CHAT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "CHAT_REQUEST_FAILED");
    error.payload = data;
    throw error;
  }
  return data;
}

function chatErrorMessage(error) {
  const code = String(error?.message || "");
  if (code === "USERNAME_TAKEN") return "This username is already reserved by another device. Choose another username.";
  if (code === "INVALID_USERNAME") return "Use 3–24 letters, numbers, spaces, dot, dash or underscore.";
  if (code === "BANNED") return "This username has been banned from SunShine Chat.";
  if (code === "BLOCKED") return "This username is currently blocked from SunShine Chat.";
  if (code === "USERNAME_OWNED_BY_ANOTHER_DEVICE") return "This username belongs to another saved device.";
  return "Chat is temporarily unavailable. Please try again.";
}

function messageMarkup(message) {
  const user = String(message.username_snapshot || message.user || "");
  const initials = user.split(/\s+/).map(part => part[0] || "").join("").slice(0, 2).toUpperCase();
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : String(message.time || "");
  return `
    <article class="chat-message" data-chat-message-id="${escapeHtml(message.id || "")}">
      <div class="avatar">${escapeHtml(initials)}</div>
      <div class="message-copy">
        <div class="message-meta">
          <strong>${escapeHtml(user)}</strong>
          <span>${escapeHtml(time)}</span>
        </div>
        <p class="message-bubble">${escapeHtml(message.body || message.text || "")}</p>
      </div>
    </article>
  `;
}

async function renderRemoteChat(feed) {
  if (!feed) return;
  try {
    const data = await chatApi("messages", { limit: 60 });
    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (!messages.length) {
      feed.innerHTML = '<div class="chat-empty-state"><strong>SunShine Community</strong><p>No public messages yet. Be the first to say hello.</p></div>';
      return;
    }
    feed.innerHTML = messages.map(messageMarkup).join("");
    // Newest messages are rendered first by the API. Keep the feed pinned to the top.
    feed.scrollTop = 0;
  } catch {
    feed.innerHTML = '<div class="chat-empty-state"><strong>SunShine Community</strong><p>Chat messages are temporarily unavailable.</p></div>';
  }
}

function updateChatLoginUi(panel, username = "") {
  if (!panel) return;
  const login = panel.querySelector("[data-chat-login]");
  const userBar = panel.querySelector("[data-chat-user-bar]");
  const userName = panel.querySelector("[data-chat-user-name]");
  const compose = panel.querySelector(".chat-compose");
  const signedIn = Boolean(username);
  if (login) login.hidden = signedIn;
  if (userBar) userBar.hidden = !signedIn;
  if (userName) userName.textContent = username;
  if (compose) compose.hidden = !signedIn;
}

async function claimChatUsername(panel, username) {
  const status = panel?.querySelector("[data-chat-login-status]");
  if (status) status.textContent = "Checking username…";
  try {
    const data = await chatApi("claim", {
      username,
      ownerToken: chatOwnerToken()
    });
    const claimed = data.user?.username || username;
    saveChatUsername(claimed);
    updateChatLoginUi(panel, claimed);
    if (status) status.textContent = "";
    return claimed;
  } catch (error) {
    if (status) status.textContent = chatErrorMessage(error);
    updateChatLoginUi(panel, "");
    throw error;
  }
}

function setupChat(feedId, formId, inputId) {
  const feed = document.getElementById(feedId);
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);
  if (!feed || !form || !input) return;

  const panel = feed.closest(".chat-panel") || feed.parentElement;
  const loginForm = panel?.querySelector("[data-chat-login-form]");
  const usernameInput = panel?.querySelector("[data-chat-username]");
  const logout = panel?.querySelector("[data-chat-logout]");

  renderRemoteChat(feed);

  const savedUsername = storedChatUsername();
  if (savedUsername) {
    claimChatUsername(panel, savedUsername).catch(() => {});
  } else {
    updateChatLoginUi(panel, "");
  }

  loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const username = String(usernameInput?.value || "").trim();
    if (!username) return;
    try {
      await claimChatUsername(panel, username);
      if (usernameInput) usernameInput.value = "";
      showToast("Welcome to SunShine Chat.");
    } catch {}
  });

  logout?.addEventListener("click", () => {
    clearChatIdentity();
    updateChatLoginUi(panel, "");
    showToast("Saved chat identity removed from this device.");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const username = storedChatUsername();
    const text = input.value.trim();
    if (!username) {
      showToast("Choose your username before sending messages.");
      return;
    }
    if (!text) return;
    try {
      await chatApi("post", { username, ownerToken: chatOwnerToken(), text });
      input.value = "";
      await renderRemoteChat(feed);
      input.focus();
    } catch (error) {
      showToast(chatErrorMessage(error));
      if (String(error?.message || "") === "BANNED" || String(error?.message || "") === "BLOCKED") {
        updateChatLoginUi(panel, "");
      }
    }
  });

  window.setInterval(() => renderRemoteChat(feed), 5000);
}

function setupEmojiButtons() {
  document.querySelectorAll("[data-emoji-target]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.emojiTarget);
      if (!input) return;
      input.value = `${input.value}${input.value ? " " : ""}☀️`;
      input.focus();
    });
  });
}

function getPlaybackMode() {
  const configured = SUNSHINE_PUBLIC_CONTENT.live?.defaultPlaybackMode === "auto" ? "auto" : "manual";
  try {
    const saved = localStorage.getItem(SUNSHINE_PLAYBACK_MODE_KEY);
    if (saved === "auto" || saved === "manual") return saved;
  } catch {}
  return configured;
}

function updatePlaybackModeUi(mode, message = "") {
  document.querySelectorAll("[data-playback-mode]").forEach(button => {
    const active = button.dataset.playbackMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-playback-status]").forEach(status => {
    status.textContent = message || (mode === "auto"
      ? "AUTO: playback will be attempted automatically."
      : "MANUAL: press PLAY in the stream player.");
  });
}

function findPlayableControl(root) {
  if (!root) return null;
  const media = root.querySelector?.("audio, video");
  if (media) return { type: "media", node: media };

  const candidates = [...(root.querySelectorAll?.("button, [role='button'], input[type='button'], input[type='submit']") || [])];
  const button = candidates.find(node => {
    const text = [
      node.textContent,
      node.getAttribute?.("aria-label"),
      node.getAttribute?.("title"),
      node.getAttribute?.("value")
    ].filter(Boolean).join(" ").toLowerCase();
    return /(^|\s)(play|listen|start)(\s|$)/.test(text) || text.includes("play");
  });
  return button ? { type: "button", node: button } : null;
}

async function tryStartCasterPlayback({ userInitiated = false } = {}) {
  const widget = document.getElementById("casterLivePlayer");
  if (!widget) return false;

  const attempt = async root => {
    const control = findPlayableControl(root);
    if (!control) return false;
    try {
      if (control.type === "media") {
        control.node.muted = false;
        await control.node.play();
      } else {
        control.node.click();
      }
      return true;
    } catch {
      return false;
    }
  };

  if (await attempt(widget)) return true;

  for (const frame of widget.querySelectorAll("iframe")) {
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (doc && await attempt(doc)) return true;
    } catch {}
  }

  if (userInitiated) {
    const frame = widget.querySelector("iframe");
    if (frame) {
      try { frame.focus(); } catch {}
    }
  }
  return false;
}

async function applyPlaybackMode(mode, { persist = false, userInitiated = false } = {}) {
  const normalized = mode === "auto" ? "auto" : "manual";
  if (persist) {
    try { localStorage.setItem(SUNSHINE_PLAYBACK_MODE_KEY, normalized); } catch {}
  }

  if (normalized === "manual") {
    updatePlaybackModeUi("manual");
    return;
  }

  updatePlaybackModeUi("auto", "AUTO: trying to start the live stream…");
  const started = await tryStartCasterPlayback({ userInitiated });
  updatePlaybackModeUi("auto", started
    ? "AUTO: live stream start requested."
    : "AUTO is enabled. If your browser blocks sound autoplay, press PLAY once.");
}

function setupPlaybackMode() {
  const initialMode = getPlaybackMode();
  updatePlaybackModeUi(initialMode);

  document.querySelectorAll("[data-playback-mode]").forEach(button => {
    button.addEventListener("click", () => {
      applyPlaybackMode(button.dataset.playbackMode, { persist: true, userInitiated: true });
    });
  });

  if (initialMode === "auto") {
    let tries = 0;
    const timer = window.setInterval(async () => {
      tries += 1;
      const started = await tryStartCasterPlayback();
      if (started || tries >= 8) {
        window.clearInterval(timer);
        updatePlaybackModeUi("auto", started
          ? "AUTO: live stream start requested."
          : "AUTO is enabled. If your browser blocks sound autoplay, press PLAY once.");
      }
    }, 750);
  }
}

function setupLiveActions() {
  const widget = document.getElementById("casterLivePlayer");

  document.querySelectorAll("[data-live-trigger]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      if (widget) {
        widget.scrollIntoView({ behavior: "smooth", block: "center" });
        if (getPlaybackMode() === "auto") {
          applyPlaybackMode("auto", { userInitiated: true });
          showToast("SunShine AUTO play selected.");
        } else {
          showToast("SunShine is live — press PLAY in the radio player.");
        }
        return;
      }

      window.location.href = "live-radio.html#casterLivePlayer";
    });
  });

  document.querySelectorAll("[data-live-control]").forEach(button => {
    button.addEventListener("click", () => {
      showToast("SunShine is one continuous live stream; previous/next track control is not available.");
    });
  });
}

function setupPlaceholderLinks() {
  document.querySelectorAll('[data-placeholder-link], .social-row a[href="#"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      showToast("This public link has not been configured yet.");
    });
  });
}

function setupContactDraft() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const name = document.getElementById("contactName");
  const email = document.getElementById("contactEmail");
  const message = document.getElementById("contactMessage");
  const status = document.getElementById("contactFormStatus");

  try {
    const draft = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "null");
    if (draft) {
      if (name) name.value = draft.name || "";
      if (email) email.value = draft.email || "";
      if (message) message.value = draft.message || "";
    }
  } catch {}

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!name?.value.trim() || !email?.value.trim() || !message?.value.trim()) {
      if (status) status.textContent = "Complete all fields before saving the draft.";
      return;
    }

    try {
      localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify({
        name: name.value.trim(),
        email: email.value.trim(),
        message: message.value.trim()
      }));
    } catch {}

    if (status) status.textContent = "Draft saved on this device. Sending will be enabled after the official SunShine contact channel is configured.";
    showToast("Contact draft saved locally.");
  });
}

function setupMenu() {
  if (!menuToggle || !mainNav) return;

  menuToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  mainNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setupLiveChatPanelSizing() {
  const player = document.querySelector(".page-live .player-card");
  const panel = document.querySelector(".page-live .live-chat-panel");
  if (!player || !panel) return;

  const desktop = window.matchMedia("(min-width: 1101px)");

  const sync = () => {
    if (!desktop.matches) {
      panel.style.removeProperty("height");
      panel.style.removeProperty("max-height");
      return;
    }
    const height = Math.ceil(player.getBoundingClientRect().height);
    if (height > 0) {
      panel.style.height = `${height}px`;
      panel.style.maxHeight = `${height}px`;
    }
  };

  sync();
  window.addEventListener("resize", sync, { passive: true });
  desktop.addEventListener?.("change", sync);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(sync);
    observer.observe(player);
  } else {
    window.setInterval(sync, 1500);
  }

  window.setTimeout(sync, 250);
  window.setTimeout(sync, 1000);
  window.setTimeout(sync, 2500);
}

function setYear() {
  document.querySelectorAll("[data-current-year], #year").forEach(element => {
    element.textContent = new Date().getFullYear();
  });
}

async function bootstrapSunShine() {
  await loadPublicContent();
  setupMenu();
  setupLiveActions();
  setupPlaybackMode();
  setupPlaceholderLinks();
  setupEmojiButtons();
  setupContactDraft();
  renderSchedules();
  renderDjs();
  renderShows();
  await loadLifestyleArticles();
  setupChat("chatFeed", "chatForm", "chatInput");
  setupChat("chatFeedLive", "chatFormLive", "chatInputLive");
  setupChat("chatFeedPage", "chatFormPage", "chatInputPage");
  setupLiveChatPanelSizing();
  setYear();
}
bootstrapSunShine();
