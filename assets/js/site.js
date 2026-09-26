const SUNSHINE_SCHEDULE = [
  { start: "10:00", end: "12:00", time: "10:00 - 12:00", show: "Morning Sunshine", host: "with Alex K.", dj: "Alex K." },
  { start: "12:00", end: "14:00", time: "12:00 - 14:00", show: "SunShine Hits", host: "with Maria S.", dj: "Maria S." },
  { start: "14:00", end: "16:00", time: "14:00 - 16:00", show: "Greek Vibes", host: "with Nikos P.", dj: "Nikos P." },
  { start: "16:00", end: "18:00", time: "16:00 - 18:00", show: "Dance Floor", host: "with DJ Chris", dj: "DJ Chris" },
  { start: "18:00", end: "20:00", time: "18:00 - 20:00", show: "Retro Time", host: "with Elena D.", dj: "Elena D." },
  { start: "20:00", end: "22:00", time: "20:00 - 22:00", show: "Laiko & More", host: "with Giorgos M.", dj: "Giorgos M." },
  { start: "22:00", end: "00:00", time: "22:00 - 00:00", show: "Night Sessions", host: "with DJ Alex", dj: "DJ Alex" }
];

const SUNSHINE_DJS = [
  { initials: "AK", name: "Alex K.", show: "Morning Sunshine", time: "10:00 - 12:00", start: "10:00", end: "12:00" },
  { initials: "MS", name: "Maria S.", show: "SunShine Hits", time: "12:00 - 14:00", start: "12:00", end: "14:00" },
  { initials: "NP", name: "Nikos P.", show: "Greek Vibes", time: "14:00 - 16:00", start: "14:00", end: "16:00" },
  { initials: "ED", name: "Elena D.", show: "Retro Time", time: "18:00 - 20:00", start: "18:00", end: "20:00" }
];

const SUNSHINE_INITIAL_MESSAGES = [
  { user: "SofiaG", time: "11:24", text: "This station always puts me in a good mood! ☀️💛" },
  { user: "ChrisDJ", time: "11:27", text: "Amazing track! Keep the good vibes coming! 🙌" },
  { user: "NikosP", time: "11:25", text: "SunShine Radio = the best vibes on the web! 🎧🔥" },
  { user: "Katerina", time: "11:28", text: "SunShine family all over the world! 🌍💛" },
  { user: "EvaM", time: "11:26", text: "Listening from Thessaloniki! 🇬🇷 Love this station! 💙" },
  { user: "AlexR", time: "11:29", text: "Perfect morning show! Coffee, music and SunShine! ☕🎶" }
];

const CHAT_STORAGE_KEY = "sunshine_chat_preview_v1";
const CONTACT_STORAGE_KEY = "sunshine_contact_draft_v1";

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

function loadChatMessages() {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "null");
    if (Array.isArray(stored) && stored.length) return stored.slice(-30);
  } catch {}
  return [...SUNSHINE_INITIAL_MESSAGES];
}

function saveChatMessages(messages) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {}
}

function messageMarkup(message) {
  const initials = String(message.user)
    .split(/\s+/)
    .map(part => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return `
    <article class="chat-message">
      <div class="avatar">${escapeHtml(initials)}</div>
      <div class="message-copy">
        <div class="message-meta">
          <strong>${escapeHtml(message.user)}</strong>
          <span>${escapeHtml(message.time)}</span>
        </div>
        <p class="message-bubble">${escapeHtml(message.text)}</p>
      </div>
    </article>
  `;
}

function renderChatInto(feed) {
  if (!feed) return;
  feed.innerHTML = loadChatMessages().map(messageMarkup).join("");
}

function setupChat(feedId, formId, inputId) {
  const feed = document.getElementById(feedId);
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);

  renderChatInto(feed);
  if (!feed || !form || !input) return;

  form.addEventListener("submit", event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const messages = loadChatMessages();
    const now = new Date();
    messages.push({
      user: "You",
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text
    });
    saveChatMessages(messages);
    renderChatInto(feed);
    input.value = "";
    input.focus();
    feed.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast("Message added to your local SunShine chat preview. Multi-user chat backend comes next.");
  });
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

function setupLiveActions() {
  const onLivePage = document.body.classList.contains("page-live");

  document.querySelectorAll("[data-live-trigger]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      if (!onLivePage) {
        window.location.href = "live-radio.html#player";
        return;
      }

      document.getElementById("player")?.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("SunShine Live player is ready. The actual audio stream will activate when the Jazzler stream endpoint is connected.");
    });
  });

  document.querySelectorAll("[data-live-control]").forEach(button => {
    button.addEventListener("click", () => {
      showToast("SunShine is a continuous live stream. Track navigation will be connected only if Jazzler exposes that control.");
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

function setYear() {
  document.querySelectorAll("[data-current-year], #year").forEach(element => {
    element.textContent = new Date().getFullYear();
  });
}

setupMenu();
setupLiveActions();
setupPlaceholderLinks();
setupEmojiButtons();
setupContactDraft();
renderSchedules();
renderDjs();
setupChat("chatFeed", "chatForm", "chatInput");
setupChat("chatFeedPage", "chatFormPage", "chatInputPage");
setYear();
