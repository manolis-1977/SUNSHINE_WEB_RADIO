const ADMIN_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-admin-auth";
const LIFESTYLE_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-lifestyle-api";
const LIFESTYLE_REFRESH_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-lifestyle-refresh";
const CHAT_API = "https://mrxiticrskkmwatclkbb.supabase.co/functions/v1/sunshine-chat-api";
const SESSION_KEY = "sunshine_admin_session_v1";

async function lifestyleApi(action, payload = {}, token = "") {
  const response = await fetch(LIFESTYLE_API, {
    method: "POST",
    headers: {"Content-Type":"application/json", ...(token ? {Authorization:`Bearer ${token}`} : {})},
    body: JSON.stringify({action, ...payload}),
    cache: "no-store"
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "LIFESTYLE_REQUEST_FAILED");
  return data;
}

async function refreshLifestyle(payload = {}) {
  const response = await fetch(LIFESTYLE_REFRESH_API, {
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:`Bearer ${getSessionToken()}`},
    body:JSON.stringify(payload),
    cache:"no-store"
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || "LIFESTYLE_REFRESH_FAILED");
  return data;
}

async function chatAdminApi(action, payload = {}) {
  const response = await fetch(CHAT_API, {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      Authorization:`Bearer ${getSessionToken()}`
    },
    body: JSON.stringify({action, ...payload}),
    cache: "no-store"
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || "CHAT_ADMIN_REQUEST_FAILED");
  return data;
}

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
  if (code.includes("REMOVE_ADMIN_FIRST")) return "Remove Chat Admin rights before releasing this username.";
  if (code.includes("ADMIN_PROTECTED")) return "Chat Admin accounts are protected from this moderation action.";
  if (code.includes("INVALID_BLOCK_UNTIL")) return "Choose a valid block duration.";
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
    showsPage:"Shows page",schedulePage:"Schedule page",djsPage:"DJs page",lifestylePage:"Life Style page",chatPage:"Chat page",contactPage:"Contact page",maintenanceMode:"Maintenance mode"
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

  const ads=CMS.ads||{};
  ["homeLeft","homeRight"].forEach(slot=>{
    const cfg=ads[slot]||{};
    ["enabled","type","mediaUrl","clickUrl","label","autoplay","muted","loop"].forEach(k=>setInput("ads_"+slot+"_"+k,cfg[k]));
  });

  const live=CMS.live||{};
  ["heroTitle","heroSubtitle","stationLabel","streamLabel","fallbackTrackTitle","fallbackTrackArtist","playerEnabled","defaultPlaybackMode"].forEach(k=>setInput("live_"+k,live[k]));

  const chat=CMS.chat||{};
  ["enabled","title","subtitle","statusLabel","placeholder"].forEach(k=>setInput("chat_"+k,chat[k]));

  const lifestyle=CMS.lifestyle||{};
  ["enabled","title","subtitle","maxArticles","showImages","showSource","showDate","openLinksNewTab","emptyMessage"].forEach(k=>setInput("lifestyle_"+k,lifestyle[k]));

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
  if(ns==="ads") return {
    homeLeft:{
      enabled:document.getElementById("ads_homeLeft_enabled").checked,
      type:readText("ads_homeLeft_type")||"video",
      mediaUrl:readText("ads_homeLeft_mediaUrl"),
      clickUrl:readText("ads_homeLeft_clickUrl"),
      label:readText("ads_homeLeft_label")||"Advertisement",
      autoplay:document.getElementById("ads_homeLeft_autoplay").checked,
      muted:document.getElementById("ads_homeLeft_muted").checked,
      loop:document.getElementById("ads_homeLeft_loop").checked,
      fit:"cover"
    },
    homeRight:{
      enabled:document.getElementById("ads_homeRight_enabled").checked,
      type:readText("ads_homeRight_type")||"video",
      mediaUrl:readText("ads_homeRight_mediaUrl"),
      clickUrl:readText("ads_homeRight_clickUrl"),
      label:readText("ads_homeRight_label")||"Advertisement",
      autoplay:document.getElementById("ads_homeRight_autoplay").checked,
      muted:document.getElementById("ads_homeRight_muted").checked,
      loop:document.getElementById("ads_homeRight_loop").checked,
      fit:"cover"
    }
  };
  if(ns==="live") return {
    heroTitle:readText("live_heroTitle"),heroSubtitle:readText("live_heroSubtitle"),
    stationLabel:readText("live_stationLabel"),streamLabel:readText("live_streamLabel"),
    fallbackTrackTitle:readText("live_fallbackTrackTitle"),fallbackTrackArtist:readText("live_fallbackTrackArtist"),
    playerEnabled:document.getElementById("live_playerEnabled").checked,
    defaultPlaybackMode:readText("live_defaultPlaybackMode")==="auto"?"auto":"manual",
    casterPublicToken:CMS.live?.casterPublicToken||"",
    casterTheme:CMS.live?.casterTheme||"dark",
    casterColor:CMS.live?.casterColor||"ffba00"
  };
  if(ns==="chat") return {
    enabled:document.getElementById("chat_enabled").checked,
    title:readText("chat_title"),subtitle:readText("chat_subtitle"),
    statusLabel:readText("chat_statusLabel"),placeholder:readText("chat_placeholder"),
    placement:"live-right"
  };
  if(ns==="lifestyle") return {
    enabled:document.getElementById("lifestyle_enabled").checked,
    title:readText("lifestyle_title")||"Life Style",
    subtitle:readText("lifestyle_subtitle"),
    maxArticles:Math.max(1,Math.min(200,Number(readText("lifestyle_maxArticles")||48))),
    showImages:document.getElementById("lifestyle_showImages").checked,
    showSource:document.getElementById("lifestyle_showSource").checked,
    showDate:document.getElementById("lifestyle_showDate").checked,
    openLinksNewTab:document.getElementById("lifestyle_openLinksNewTab").checked,
    emptyMessage:readText("lifestyle_emptyMessage")
  };
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


let LIFESTYLE_ADMIN={sources:[],articles:[]};

function lifestyleDate(value){
  if(!value) return "Never";
  try{return new Date(value).toLocaleString()}catch{return String(value)}
}

function renderLifestyleSources(){
  const root=document.getElementById("lifestyleSourcesEditor");
  if(!root) return;
  if(!LIFESTYLE_ADMIN.sources.length){
    root.innerHTML='<div class="lock-note">No sources yet. Add your first RSS/Atom source.</div>';
    return;
  }
  root.innerHTML=LIFESTYLE_ADMIN.sources.map((x,i)=>`
    <div class="lifestyle-source-row" data-lifestyle-source="${i}">
      <label>Name<input data-k="name" value="${esc(x.name||"")}"></label>
      <label>Website<input data-k="site_url" type="url" value="${esc(x.site_url||"")}"></label>
      <label>RSS / Atom URL<input data-k="feed_url" type="url" value="${esc(x.feed_url||"")}"></label>
      <label>Category<input data-k="category" value="${esc(x.category||"Lifestyle")}"></label>
      <label>Minutes<input data-k="refresh_minutes" type="number" min="10" max="1440" value="${Number(x.refresh_minutes||30)}"></label>
      <label>Items<input data-k="max_items" type="number" min="1" max="50" value="${Number(x.max_items||12)}"></label>
      <label>Enabled<select data-k="enabled"><option value="true" ${x.enabled!==false?"selected":""}>Yes</option><option value="false" ${x.enabled===false?"selected":""}>No</option></select></label>
      <div class="lifestyle-row-actions"><button class="primary-btn" type="button" data-life-save>Save</button><button class="row-remove" type="button" data-life-remove>Remove</button></div>
      <div class="lifestyle-source-meta">
        <span>Last success: ${esc(lifestyleDate(x.last_success_at))}</span>
        <span>Items: ${Number(x.last_item_count||0)}</span>
        ${x.last_error?`<span class="error">Error: ${esc(x.last_error)}</span>`:""}
      </div>
    </div>`).join("");
}

function renderLifestyleArticlesAdmin(){
  const root=document.getElementById("lifestyleArticlesEditor");
  if(!root) return;
  if(!LIFESTYLE_ADMIN.articles.length){
    root.innerHTML='<div class="lock-note">No collected articles yet.</div>';
    return;
  }
  root.innerHTML=LIFESTYLE_ADMIN.articles.slice(0,100).map(a=>`
    <div class="lifestyle-article-admin-row" data-article-id="${a.id}">
      <div><strong>${esc(a.title||"")}</strong><small>${esc(a.source_name||"")} · ${esc(a.category||"")} · ${esc(lifestyleDate(a.published_at||a.fetched_at))}</small></div>
      <label><input type="checkbox" data-article-pin ${a.pinned?"checked":""}> Pin</label>
      <label><input type="checkbox" data-article-hide ${a.hidden?"checked":""}> Hide</label>
    </div>`).join("");
}

async function loadLifestyleAdmin(){
  const data=await lifestyleApi("admin",{limit:100},getSessionToken());
  LIFESTYLE_ADMIN.sources=data.sources||[];
  LIFESTYLE_ADMIN.articles=data.articles||[];
  renderLifestyleSources();
  renderLifestyleArticlesAdmin();
}

function sourceFromRow(row,index){
  const base=LIFESTYLE_ADMIN.sources[index]||{};
  const get=k=>row.querySelector(`[data-k="${k}"]`)?.value ?? "";
  return {
    ...base,
    name:get("name").trim(),
    site_url:get("site_url").trim(),
    feed_url:get("feed_url").trim(),
    category:get("category").trim()||"Lifestyle",
    refresh_minutes:Number(get("refresh_minutes")||30),
    max_items:Number(get("max_items")||12),
    enabled:get("enabled")!=="false",
    order_index:index
  };
}

function initLifestyleAdmin(){
  const root=document.getElementById("lifestyleAdminPanel");
  if(!root) return;

  document.getElementById("addLifestyleSource")?.addEventListener("click",()=>{
    LIFESTYLE_ADMIN.sources.push({id:null,name:"",site_url:"",feed_url:"",category:"Lifestyle",enabled:true,refresh_minutes:30,max_items:12,order_index:LIFESTYLE_ADMIN.sources.length});
    renderLifestyleSources();
  });

  document.getElementById("reloadLifestyleAdmin")?.addEventListener("click",()=>loadLifestyleAdmin().catch(console.error));

  document.getElementById("refreshLifestyleAll")?.addEventListener("click",async()=>{
    const status=document.getElementById("lifestyleSourceStatus");
    setStatus(status,"Refreshing sources…");
    try{
      const result=await refreshLifestyle({force:true});
      setStatus(status,`Refresh complete: ${result.refreshed||0} source(s), ${result.failed||0} failed.`,result.failed?"error":"ok");
      await loadLifestyleAdmin();
    }catch(error){setStatus(status,friendlyError(error),"error")}
  });

  root.addEventListener("click",async event=>{
    const row=event.target.closest("[data-lifestyle-source]");
    if(!row) return;
    const index=Number(row.dataset.lifestyleSource);
    const status=document.getElementById("lifestyleSourceStatus");

    if(event.target.closest("[data-life-save]")){
      const source=sourceFromRow(row,index);
      setStatus(status,"Saving source…");
      try{
        await lifestyleApi("saveSource",{source},getSessionToken());
        setStatus(status,"Source saved.","ok");
        await loadLifestyleAdmin();
      }catch(error){setStatus(status,friendlyError(error),"error")}
    }

    if(event.target.closest("[data-life-remove]")){
      const source=LIFESTYLE_ADMIN.sources[index];
      if(!source?.id){
        LIFESTYLE_ADMIN.sources.splice(index,1);
        renderLifestyleSources();
        return;
      }
      setStatus(status,"Removing source…");
      try{
        await lifestyleApi("removeSource",{id:source.id},getSessionToken());
        setStatus(status,"Source removed.","ok");
        await loadLifestyleAdmin();
      }catch(error){setStatus(status,friendlyError(error),"error")}
    }
  });

  document.getElementById("lifestyleArticlesEditor")?.addEventListener("change",async event=>{
    const row=event.target.closest("[data-article-id]");
    if(!row) return;
    try{
      await lifestyleApi("articleFlags",{
        id:row.dataset.articleId,
        pinned:Boolean(row.querySelector("[data-article-pin]")?.checked),
        hidden:Boolean(row.querySelector("[data-article-hide]")?.checked)
      },getSessionToken());
    }catch(error){console.error(error)}
  });
}


let CHAT_ADMIN={users:[],messages:[]};

function chatAdminDate(value){
  if(!value) return "—";
  try{return new Date(value).toLocaleString()}catch{return String(value)}
}

function renderChatUsersAdmin(){
  const root=document.getElementById("chatUsersAdmin");
  if(!root) return;
  if(!CHAT_ADMIN.users.length){
    root.innerHTML='<div class="lock-note">No chat users yet.</div>';
    return;
  }
  root.innerHTML=CHAT_ADMIN.users.map(user=>`
    <div class="chat-user-admin-row${user.is_admin?" is-chat-admin":""}" data-chat-user-id="${user.id}">
      <div class="chat-admin-main">
        <strong>${esc(user.username||"")}</strong>
        <small>Last seen: ${esc(chatAdminDate(user.last_seen_at))}</small>
        <div class="chat-state-row">
          ${user.is_admin?`<span class="chat-state admin">CHAT ADMIN</span>`:""}
          ${user.banned?`<span class="chat-state banned">BANNED</span>`:user.blocked?`<span class="chat-state blocked">BLOCKED</span>`:`<span class="chat-state active">ACTIVE</span>`}
        </div>
      </div>
      <div class="chat-admin-actions">
        <button class="${user.is_admin?"row-remove":"primary-btn"}" type="button" data-chat-role>${user.is_admin?"Remove Admin":"Make Admin"}</button>
        ${user.blocked
          ? `<span class="chat-block-until">${user.blocked_until ? "Until " + esc(chatAdminDate(user.blocked_until)) : "No expiry"}</span>`
          : `<select class="chat-block-duration" data-chat-block-duration aria-label="Block duration for ${esc(user.username||"")}" ${user.is_admin?"disabled title=\"Remove Chat Admin role before blocking\"":""}>
              <option value="5">5 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
              <option value="360">6 hours</option>
              <option value="1440">24 hours</option>
            </select>`}
        <button class="ghost-btn" type="button" data-chat-block ${user.is_admin?"disabled title=\"Remove Chat Admin role before blocking\"":""}>${user.blocked?"Unblock":"Block"}</button>
        <button class="row-remove" type="button" data-chat-ban ${user.is_admin?"disabled title=\"Remove Chat Admin role before banning\"":""}>${user.banned?"Unban":"Ban"}</button>
        <button class="ghost-btn" type="button" data-chat-release ${user.is_admin?"disabled title=\"Remove Chat Admin role before releasing username\"":""}>Release Username</button>
      </div>
    </div>`).join("");
}

function renderChatMessagesAdmin(){
  const root=document.getElementById("chatMessagesAdmin");
  if(!root) return;
  if(!CHAT_ADMIN.messages.length){
    root.innerHTML='<div class="lock-note">No chat messages yet.</div>';
    return;
  }
  root.innerHTML=CHAT_ADMIN.messages.map(message=>`
    <div class="chat-message-admin-row${message.deleted_at?" deleted":""}" data-chat-message-id="${message.id}">
      <div class="chat-admin-main">
        <strong>${esc(message.username_snapshot||"")}</strong>
        <p>${esc(message.body||"")}</p>
        <small>${esc(chatAdminDate(message.created_at))}${message.deleted_at?" · Deleted":""}</small>
      </div>
      <div class="chat-admin-actions">
        ${message.deleted_at?"":'<button class="row-remove" type="button" data-chat-delete>Delete</button>'}
      </div>
    </div>`).join("");
}

async function loadChatModeration(){
  const data=await chatAdminApi("adminList");
  CHAT_ADMIN.users=data.users||[];
  CHAT_ADMIN.messages=data.messages||[];
  renderChatUsersAdmin();
  renderChatMessagesAdmin();
}

function initChatModeration(){
  const root=document.getElementById("chatModerationPanel");
  if(!root) return;
  const status=document.getElementById("chatModerationStatus");

  document.getElementById("reloadChatModeration")?.addEventListener("click",async()=>{
    setStatus(status,"Loading chat…");
    try{await loadChatModeration();setStatus(status,"Chat moderation refreshed.","ok")}
    catch(error){setStatus(status,friendlyError(error),"error")}
  });

  document.getElementById("clearAllChatMessages")?.addEventListener("click",async event=>{
    const button=event.currentTarget;
    if(!confirm("Clear ALL chat messages permanently? Users, usernames, Chat Admin roles, blocks and bans will NOT be changed.")) return;
    button.disabled=true;
    setStatus(status,"Clearing all chat messages…");
    try{
      const data=await chatAdminApi("adminClearMessages");
      setStatus(status,`All chat messages cleared (${Number(data.deleted||0)} removed). Users were not changed.`,"ok");
      await loadChatModeration();
    }catch(error){
      setStatus(status,friendlyError(error),"error");
    }finally{
      button.disabled=false;
    }
  });

  document.getElementById("chatUsersAdmin")?.addEventListener("click",async event=>{
    const row=event.target.closest("[data-chat-user-id]");
    if(!row) return;
    const user=CHAT_ADMIN.users.find(x=>x.id===row.dataset.chatUserId);
    if(!user) return;

    try{
      if(event.target.closest("[data-chat-role]")){
        const isAdmin=!user.is_admin;
        if(!confirm(isAdmin
          ? `Make ${user.username} a Chat Admin? They will be able to moderate users and messages.`
          : `Remove Chat Admin rights from ${user.username}?`)) return;
        await chatAdminApi("adminSetRole",{id:user.id,isAdmin});
        setStatus(status,isAdmin?"Chat Admin granted.":"Chat Admin removed.","ok");
      }else if(event.target.closest("[data-chat-block]")){
        const blocked=!user.blocked;
        if(blocked){
          const durationSelect=row.querySelector("[data-chat-block-duration]");
          const minutes=Number(durationSelect?.value||15);
          const blockedUntil=new Date(Date.now()+minutes*60*1000).toISOString();
          await chatAdminApi("adminUserStatus",{
            id:user.id,
            blocked:true,
            blockedUntil,
            banned:false,
            reason:`Blocked by administrator for ${minutes} minute(s)`
          });
          const label=minutes<60?`${minutes} min`:`${minutes/60} h`;
          setStatus(status,`User blocked for ${label}.`,"ok");
        }else{
          await chatAdminApi("adminUserStatus",{id:user.id,blocked:false,banned:user.banned,reason:""});
          setStatus(status,"User unblocked.","ok");
        }
      }else if(event.target.closest("[data-chat-ban]")){
        const banned=!user.banned;
        await chatAdminApi("adminUserStatus",{id:user.id,blocked:user.blocked,banned,reason:banned?"Banned by administrator":""});
        setStatus(status,banned?"User banned.":"User unbanned.","ok");
      }else if(event.target.closest("[data-chat-release]")){
        if(!confirm("Release this username? The current device will lose ownership and somebody else may claim it.")) return;
        await chatAdminApi("adminReleaseUsername",{id:user.id});
        setStatus(status,"Username released.","ok");
      }else return;
      await loadChatModeration();
    }catch(error){setStatus(status,friendlyError(error),"error")}
  });

  document.getElementById("chatMessagesAdmin")?.addEventListener("click",async event=>{
    const row=event.target.closest("[data-chat-message-id]");
    if(!row||!event.target.closest("[data-chat-delete]")) return;
    if(!confirm("Delete this public chat message?")) return;
    try{
      await chatAdminApi("adminDeleteMessage",{id:row.dataset.chatMessageId,reason:"Deleted by administrator"});
      setStatus(status,"Message deleted.","ok");
      await loadChatModeration();
    }catch(error){setStatus(status,friendlyError(error),"error")}
  });
}

async function initDashboard() {
  if (!document.body.classList.contains("admin-dashboard")) return;
  const session = await guardDashboard();
  if (!session) return;

  document.getElementById("adminUsername").textContent = session.username;
  initCmsControls();
  initLifestyleAdmin();
  initChatModeration();
  try { await loadCms(); } catch (error) { console.error(error); }
  try { await loadLifestyleAdmin(); } catch (error) { console.error(error); }
  try { await loadChatModeration(); } catch (error) { console.error(error); }
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
