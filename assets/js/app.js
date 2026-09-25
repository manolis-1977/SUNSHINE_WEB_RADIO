const schedule = [
  { time: "10:00 - 12:00", show: "Morning Sunshine", host: "with Alex K.", live: true },
  { time: "12:00 - 14:00", show: "SunShine Hits", host: "with Maria S." },
  { time: "14:00 - 16:00", show: "Greek Vibes", host: "with Nikos P." },
  { time: "16:00 - 18:00", show: "Dance Floor", host: "with DJ Chris" },
  { time: "18:00 - 20:00", show: "Retro Time", host: "with Elena D." },
  { time: "20:00 - 22:00", show: "Laiko & More", host: "with Giorgos M." },
  { time: "22:00 - 00:00", show: "Night Sessions", host: "with DJ Alex" }
];

const djs = [
  { initials: "AK", name: "Alex K.", show: "Morning Sunshine", time: "10:00 - 12:00", live: true },
  { initials: "MS", name: "Maria S.", show: "SunShine Hits", time: "12:00 - 14:00" },
  { initials: "NP", name: "Nikos P.", show: "Greek Vibes", time: "14:00 - 16:00" },
  { initials: "ED", name: "Elena D.", show: "Retro Time", time: "18:00 - 20:00" }
];

const initialMessages = [
  { user: "SofiaG", time: "11:24", text: "This station always puts me in a good mood! ☀️💛" },
  { user: "ChrisDJ", time: "11:27", text: "Amazing track! Keep the good vibes coming! 🙌" },
  { user: "NikosP", time: "11:25", text: "SunShine Radio = the best vibes on the web! 🎧🔥" },
  { user: "Katerina", time: "11:28", text: "SunShine family all over the world! 🌍💛" },
  { user: "EvaM", time: "11:26", text: "Listening from Thessaloniki! 🇬🇷 Love this station! 💙" },
  { user: "AlexR", time: "11:29", text: "Perfect morning show! Coffee, music and SunShine! ☕🎶" }
];

const scheduleList = document.getElementById("scheduleList");
const djGrid = document.getElementById("djGrid");
const chatFeed = document.getElementById("chatFeed");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
const toast = document.getElementById("toast");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSchedule() {
  scheduleList.innerHTML = schedule.map(item => {
    if (item.live) {
      return `
        <div class="schedule-row live">
          <div class="status-tag">ON AIR</div>
          <div class="row-time">${item.time}</div>
          <div class="row-show">${item.show}</div>
          <div class="row-host">${item.host}</div>
        </div>
      `;
    }

    return `
      <div class="schedule-row">
        <div class="row-icon">◷</div>
        <div class="row-time">${item.time}</div>
        <div class="row-show">${item.show}</div>
        <div class="row-host">${item.host}</div>
      </div>
    `;
  }).join("");
}

function renderDjs() {
  djGrid.innerHTML = djs.map(dj => `
    <article class="dj-card" aria-label="${dj.name}">
      <div class="dj-info">
        ${dj.live ? '<span class="live-pill">ON AIR</span>' : ""}
        <h3>${dj.name}</h3>
        <p>${dj.show}</p>
        <small>${dj.time}</small>
      </div>
    </article>
  `).join("");
}

function renderMessage(message) {
  const wrapper = document.createElement("article");
  wrapper.className = "chat-message";

  const initials = message.user
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  wrapper.innerHTML = `
    <div class="avatar">${escapeHtml(initials)}</div>
    <div class="message-copy">
      <div class="message-meta">
        <strong>${escapeHtml(message.user)}</strong>
        <span>${escapeHtml(message.time)}</span>
      </div>
      <p class="message-bubble">${escapeHtml(message.text)}</p>
    </div>
  `;

  chatFeed.appendChild(wrapper);
}

function renderChat() {
  chatFeed.innerHTML = "";
  initialMessages.forEach(renderMessage);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3300);
}

document.querySelectorAll("[data-live-trigger]").forEach(button => {
  button.addEventListener("click", () => {
    showToast("SunShine player is ready. The real stream will be connected when we integrate Jazzler.");
  });
});

chatForm.addEventListener("submit", event => {
  event.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  const now = new Date();
  renderMessage({
    user: "You",
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    text
  });

  chatInput.value = "";
  chatInput.focus();
  showToast("Local chat preview only. Real multi-user chat backend comes in the chat phase.");
});

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

document.getElementById("year").textContent = new Date().getFullYear();

renderSchedule();
renderDjs();
renderChat();
