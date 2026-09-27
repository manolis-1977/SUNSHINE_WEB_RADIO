const ADMIN_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-admin-auth";
const SESSION_KEY = "sunshine_admin_session_v1";

async function api(action, payload = {}, token = "") {
  const response = await fetch(ADMIN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store"
  });

  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error || "REQUEST_FAILED");
    error.status = response.status;
    throw error;
  }
  return data;
}

function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY) || "";
}
function setSessionToken(token) {
  sessionStorage.setItem(SESSION_KEY, token);
}
function clearSessionToken() {
  sessionStorage.removeItem(SESSION_KEY);
}
function setStatus(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.className = `form-status ${type}`.trim();
}
function friendlyError(error) {
  const code = String(error?.message || "");
  if (code.includes("INVALID_CREDENTIALS")) return "Wrong username or password.";
  if (code.includes("TOO_MANY_ATTEMPTS")) return "Too many failed attempts. Try again later.";
  if (code.includes("PASSWORD_TOO_SHORT")) return "Password must be at least 12 characters.";
  if (code.includes("INVALID_USERNAME")) return "Username must be 3–64 characters: letters, numbers, dot, underscore or hyphen.";
  if (code.includes("INVALID_SETUP_KEY")) return "Invalid one-time setup key.";
  if (code.includes("ADMIN_ALREADY_PROVISIONED")) return "Admin account has already been created.";
  if (code.includes("INVALID_CURRENT_PASSWORD")) return "Current password is incorrect.";
  return "Request failed. Please try again.";
}

async function guardDashboard() {
  const token = getSessionToken();
  if (!token) {
    location.replace("index.html");
    return null;
  }
  try {
    return await api("session", {}, token);
  } catch {
    clearSessionToken();
    location.replace("index.html");
    return null;
  }
}

async function initLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const existing = getSessionToken();
  if (existing) {
    try {
      await api("session", {}, existing);
      location.replace("dashboard.html");
      return;
    } catch { clearSessionToken(); }
  }

  const status = document.getElementById("loginStatus");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "Signing in…");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    try {
      const data = await api("login", { username, password });
      setSessionToken(data.token);
      location.replace("dashboard.html");
    } catch (error) {
      setStatus(status, friendlyError(error), "error");
    }
  });
}

async function initSetup() {
  const form = document.getElementById("setupForm");
  if (!form) return;
  const status = document.getElementById("setupStatus");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const setupKey = document.getElementById("setupKey").value.trim();
    const username = document.getElementById("setupUsername").value.trim();
    const password = document.getElementById("setupPassword").value;
    const confirm = document.getElementById("setupConfirm").value;
    if (password !== confirm) {
      setStatus(status, "Passwords do not match.", "error");
      return;
    }
    setStatus(status, "Creating secure admin account…");
    try {
      const data = await api("setup", { setupKey, username, password });
      setSessionToken(data.token);
      location.replace("dashboard.html");
    } catch (error) {
      setStatus(status, friendlyError(error), "error");
    }
  });
}

async function initDashboard() {
  if (!document.body.classList.contains("admin-dashboard")) return;
  const session = await guardDashboard();
  if (!session) return;

  document.getElementById("adminUsername").textContent = session.username;
  document.getElementById("sessionExpiry").textContent =
    new Date(session.expiresAt).toLocaleString();

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    const token = getSessionToken();
    try { await api("logout", {}, token); } catch {}
    clearSessionToken();
    location.replace("index.html");
  });

  const form = document.getElementById("passwordForm");
  const status = document.getElementById("passwordStatus");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    if (newPassword.length < 12) {
      setStatus(status, "New password must be at least 12 characters.", "error");
      return;
    }
    setStatus(status, "Updating password…");
    try {
      await api("changePassword", { currentPassword, newPassword }, getSessionToken());
      clearSessionToken();
      setStatus(status, "Password changed. Sign in again.", "ok");
      setTimeout(() => location.replace("index.html"), 900);
    } catch (error) {
      setStatus(status, friendlyError(error), "error");
    }
  });
}

initLogin();
initSetup();
initDashboard();
