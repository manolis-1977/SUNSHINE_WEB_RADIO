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


let CMS = {};

function uid(prefix="item") {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,7);
}
function esc(value="") {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function readText(id) { return document.getElementById(id)?.value?.trim() || ""; }
function setInput(id, value) {
  const el=document.getElementById(id);
  if(!el) return;
  if(el.type==="checkbox") el.checked=Boolean(value);
  else el.value=value ?? "";
}
function normalizeOrder(items) {
  return items.map((item,index)=>({...item,order:index+1}));
}
function renderScheduleEditor() {
  const root=document.getElementById("scheduleEditor"); if(!root) return;
  root.innerHTML=(CMS.schedule||[]).map((x,i)=>`
    <div class="list-row" data-list="schedule" data-index="${i}">
      <label>Start<input data-k="start" type="time" value="${esc(x.start)}"></label>
      <label>End<input data-k="end" type="time" value="${esc(x.end)}"></label>
      <label>Show<input data-k="show" value="${esc(x.show)}"></label>
      <label>Host<input data-k="host" value="${esc(x.host)}"></label>
      <label>Active<select data-k="active"><option value="true" ${x.active!==false?"selected":""}>Yes</option><option value="false" ${x.active===false?"selected":""}>No</option></select></label>
      <button class="row-remove" data-remove="schedule" type="button">Remove</button>
    </div>`).join("");
}
function renderShowsEditor() {
  const root=document.getElementById("showsEditor"); if(!root) return;
  root.innerHTML=(CMS.shows||[]).map((x,i)=>`
    <div class="list-row shows" data-list="shows" data-index="${i}">
      <label>Time<input data-k="time" value="${esc(x.time)}"></label>
      <label>Name<input data-k="name" value="${esc(x.name)}"></label>
      <label>Description<textarea data-k="description" rows="2">${esc(x.description)}</textarea></label>
      <label>Active<select data-k="active"><option value="true" ${x.active!==false?"selected":""}>Yes</option><option value="false" ${x.active===false?"selected":""}>No</option></select></label>
      <button class="row-remove" data-remove="shows" type="button">Remove</button>
    </div>`).join("");
}
function renderDjsEditor() {
  const root=document.getElementById("djsEditor"); if(!root) return;
  root.innerHTML=(CMS.djs||[]).map((x,i)=>`
    <div class="list-row djs" data-list="djs" data-index="${i}">
      <label>Name<input data-k="name" value="${esc(x.name)}"></label>
      <label>Show<input data-k="show" value="${esc(x.show)}"></label>
      <label>Time<input data-k="time" value="${esc(x.time)}"></label>
      <label>Image URL<input data-k="image" value="${esc(x.image||"")}"></label>
      <label>Active<select data-k="active"><option value="true" ${x.active!==false?"selected":""}>Yes</option><option value="false" ${x.active===false?"selected":""}>No</option></select></label>
      <button class="row-remove" data-remove="djs" type="button">Remove</button>
    </div>`).join("");
}
function renderFeatures() {
  const root=document.getElementById("featuresEditor"); if(!root) return;
  const labels={
    homeSchedule:"Home: Schedule",homeDjs:"Home: DJs",homeChat:"Home: Chat",listenEverywhere:"Home: Listen Everywhere",
    showsPage:"Shows page",schedulePage:"Schedule page",djsPage:"DJs page",chatPage:"Chat page",contactPage:"Contact page",maintenanceMode:"Maintenance mode"
  };
  root.innerHTML=Object.entries(labels).map(([k,label])=>`<label class="feature-toggle"><input type="checkbox" data-feature="${k}" ${CMS.features?.[k]?"checked":""}> ${label}</label>`).join("");
}
function bindListEditors() {
  document.addEventListener("input", event=>{
    const row=event.target.closest("[data-list]"); if(!row) return;
    const list=row.dataset.list, index=Number(row.dataset.index), key=event.target.dataset.k;
    if(!key||!CMS[list]?.[index]) return;
    let value=event.target.value;
    if(key==="active") value=value==="true";
    CMS[list][index][key]=value;
  });
  document.addEventListener("click", event=>{
    const remove=event.target.closest("[data-remove]");
    if(remove){
      const row=remove.closest("[data-list]"), list=row.dataset.list, index=Number(row.dataset.index);
      CMS[list].splice(index,1); CMS[list]=normalizeOrder(CMS[list]);
      ({schedule:renderScheduleEditor,shows:renderShowsEditor,djs:renderDjsEditor}[list])();
    }
  });
}
function populateCms() {
  const site=CMS.site||{};
  ["stationName","tagline","heroTitle","heroAccent","subtitle","streamLabel"].forEach(k=>setInput("site_"+k,site[k]));
  const contact=CMS.contact||{};
  ["email","phone","location","publicContactEnabled","formEnabled"].forEach(k=>setInput("contact_"+k,contact[k]));
  const social=CMS.social||{};
  ["facebook","instagram","tiktok","youtube"].forEach(k=>setInput("social_"+k,social[k]));
  const seo=CMS.seo||{};
  ["siteTitle","description","shareImage"].forEach(k=>setInput("seo_"+k,seo[k]));
  renderScheduleEditor(); renderShowsEditor(); renderDjsEditor(); renderFeatures();
}
function collectNamespace(ns) {
  if(ns==="site") return {
    stationName:readText("site_stationName"),tagline:readText("site_tagline"),heroTitle:readText("site_heroTitle"),
    heroAccent:readText("site_heroAccent"),subtitle:readText("site_subtitle"),streamLabel:readText("site_streamLabel")
  };
  if(ns==="contact") return {
    email:readText("contact_email"),phone:readText("contact_phone"),location:readText("contact_location"),
    publicContactEnabled:document.getElementById("contact_publicContactEnabled").checked,
    formEnabled:document.getElementById("contact_formEnabled").checked
  };
  if(ns==="social") return {facebook:readText("social_facebook"),instagram:readText("social_instagram"),tiktok:readText("social_tiktok"),youtube:readText("social_youtube")};
  if(ns==="seo") return {siteTitle:readText("seo_siteTitle"),description:readText("seo_description"),shareImage:readText("seo_shareImage")};
  if(ns==="features"){
    const next={...(CMS.features||{})};
    document.querySelectorAll("[data-feature]").forEach(el=>next[el.dataset.feature]=el.checked);
    return next;
  }
  if(["schedule","shows","djs"].includes(ns)) return normalizeOrder(CMS[ns]||[]);
  return CMS[ns]||{};
}
async function saveNamespace(ns) {
  const status=document.getElementById("status_"+ns);
  setStatus(status,"Saving…");
  try{
    const data=collectNamespace(ns);
    await api("saveContent",{namespace:ns,data},getSessionToken());
    CMS[ns]=data;
    setStatus(status,"Saved and published.","ok");
  }catch(error){setStatus(status,friendlyError(error),"error")}
}
async function loadCms() {
  const result=await api("content",{},getSessionToken());
  CMS=result.content||{};
  populateCms();
}
function initCmsControls() {
  bindListEditors();
  document.querySelectorAll("[data-save]").forEach(btn=>btn.addEventListener("click",()=>saveNamespace(btn.dataset.save)));
  document.getElementById("addSchedule")?.addEventListener("click",()=>{CMS.schedule=CMS.schedule||[];CMS.schedule.push({id:uid("schedule"),start:"00:00",end:"00:00",show:"New Show",host:"",active:true,order:CMS.schedule.length+1});renderScheduleEditor()});
  document.getElementById("addShow")?.addEventListener("click",()=>{CMS.shows=CMS.shows||[];CMS.shows.push({id:uid("show"),name:"New Show",time:"",description:"",active:true,order:CMS.shows.length+1});renderShowsEditor()});
  document.getElementById("addDj")?.addEventListener("click",()=>{CMS.djs=CMS.djs||[];CMS.djs.push({id:uid("dj"),name:"New DJ",show:"",time:"",image:"",bio:"",active:true,order:CMS.djs.length+1});renderDjsEditor()});
}

async function initDashboard() {
  if (!document.body.classList.contains("admin-dashboard")) return;
  const session = await guardDashboard();
  if (!session) return;

  document.getElementById("adminUsername").textContent = session.username;
  initCmsControls();
  try { await loadCms(); } catch (error) { console.error(error); }
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
