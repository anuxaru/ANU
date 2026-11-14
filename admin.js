(() => {
"use strict";

const db = supabase.createClient(window.ANU_CONFIG.url, window.ANU_CONFIG.key);
const ICONS = window.ANU_ICONS;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MEDIA_MARK = "/storage/v1/object/public/media/";
const IDLE_MS = 10 * 60 * 1000;

/* ---------- named places on the website ---------- */
const AREAS = [
  {key:"hero",      name:"Top of the page · floating photos", hint:"The 3 polaroid photos beside the welcome text. The first 3 are shown. The caption is written under each polaroid."},
  {key:"marquee",   name:"Scrolling photo strip",             hint:"Photos that glide across the page under the welcome area. The caption is the word shown after each photo."},
  {key:"gallery",   name:"Main gallery",                      hint:"Used by Heart, 3D Carousel, Masonry, Polaroids and Film Roll."},
  {key:"spotlight", name:"Spotlight · big single photos",     hint:"One big photo at a time in a slideshow. Hide the ones you do not want to show right now."},
  {key:"collage",   name:"Collages",                          hint:"Tall collage pictures shown in \"The collages\"."},
  {key:"reasons",   name:"Reason cards · pictures",           hint:"The 6 flip cards use these in order: photo 1 is card 1, photo 2 is card 2, and so on."},
  {key:"letter",    name:"Love letter · small photo",         hint:"The small stamp photo on the letter. The first one is shown."}
];
const AREA_NAME = Object.fromEntries(AREAS.map(a => [a.key, a.name]));

/* ---------- helpers ---------- */
let toastT;
function toast(msg, bad) {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toastT); toastT = setTimeout(() => t.className = "", 3200);
}
function fail(e) { console.error(e); toast((e && e.message) || "Something went wrong", true); }
function show(id) { ["viewLogin", "viewClaim", "viewApp"].forEach(v => $("#" + v).hidden = v !== id); }
function cleanUrl(u) {
  u = (u || "").trim(); if (!u) return "";
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "mailto:" + u;
  return "https://" + u;
}
function publicUrl(path) { return db.storage.from("media").getPublicUrl(path).data.publicUrl; }
function imgSize(url) {
  return new Promise(res => {
    const i = new Image(); const t = setTimeout(() => res({}), 6000);
    i.onload = () => { clearTimeout(t); res({ w: i.naturalWidth, h: i.naturalHeight }); };
    i.onerror = () => { clearTimeout(t); res({}); }; i.src = url;
  });
}
async function shrink(file, max = 1800) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .86));
    if (blob) return { blob, w, h, ext: "jpg", type: "image/jpeg" };
  } catch (e) { /* use the original file */ }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return { blob: file, w: null, h: null, ext, type: file.type || "image/jpeg" };
}
async function uploadBlob(blob, path, type) {
  const { error } = await db.storage.from("media").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return publicUrl(path);
}
async function uploadFile(file) {
  const s = await shrink(file);
  const url = await uploadBlob(s.blob, `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${s.ext}`, s.type);
  return { url, w: s.w, h: s.h };
}
async function removeStored(url) {
  const i = (url || "").indexOf(MEDIA_MARK);
  if (i > -1) await db.storage.from("media").remove([decodeURIComponent(url.slice(i + MEDIA_MARK.length))]);
}
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtTime = d => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function ago(d) {
  const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "1 min ago";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + (Math.round(s / 3600) === 1 ? " hour ago" : " hours ago");
  return fmtDate(d);
}
function deviceName(ua) {
  ua = ua || ""; if (!ua) return "Unknown device";
  const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\/|FxiOS/.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "an unknown device";
  return b + " on " + os;
}

/* =====================================================================
   SIGN IN  (check 1 + 2: email and password)  →  face check (3)  →  app
   Ten minutes without activity signs you out.
   ===================================================================== */
let signUpMode = false;
$("#toggleMode").addEventListener("click", () => {
  signUpMode = !signUpMode;
  $("#loginBtn").textContent = signUpMode ? "Create account" : "Sign in";
  $("#toggleMode").textContent = signUpMode ? "I already have an account" : "First time? Create your account";
  $("#loginHint").textContent = signUpMode ? "Choose an email and a password you will remember." : "Sign in to manage your website.";
  $("#password").autocomplete = signUpMode ? "new-password" : "current-password";
});
function showNotice(msg) { const n = $("#loginNotice"); n.textContent = msg || ""; n.hidden = !msg; }
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); showNotice("");
  const btn = $("#loginBtn"); btn.disabled = true;
  const email = $("#email").value.trim(), password = $("#password").value;
  try {
    if (signUpMode) {
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) toast("Check your email, tap the confirm link, then sign in.");
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // start loading the face tools while the next screen opens
      if (localStorage.getItem("anu-face-on")) window.ANU_FACE.load().catch(() => {});
    }
  } catch (err) { fail(err); }
  btn.disabled = false;
});

let entered = false, routing = false, tickTimer = 0, lastAct = Date.now(), ticks = 0;
["pointerdown", "keydown", "touchstart", "scroll", "mousemove", "wheel"].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));

function stopSession() { clearInterval(tickTimer); tickTimer = 0; entered = false; $("#idleBar").hidden = true; }
async function hardLogout(msg) {
  stopSession();
  try { await db.removeAllChannels(); } catch (e) { /* ignore */ }
  try { await db.auth.signOut(); } catch (e) { /* ignore */ }
  $("#faceOverlay").hidden = true; show("viewLogin"); if (msg) showNotice(msg);
}
async function userLogout() { try { await db.rpc("log_event", { p_kind: "logout" }); } catch (e) { /* ignore */ } await hardLogout(); }
$$("[data-logout]").forEach(b => b.addEventListener("click", userLogout));

async function route(session) {
  if (routing) return; routing = true;
  try {
    if (!session) { stopSession(); show("viewLogin"); return; }
    const { data: t, error } = await db.rpc("touch_session", { p_ua: navigator.userAgent });
    if (error) { fail(error); show("viewLogin"); return; }
    if (!t || !t.valid) {
      stopSession(); try { await db.auth.signOut(); } catch (e) { /* ignore */ }
      show("viewLogin"); showNotice(t && t.reason === "idle" ? "You were signed out after 10 minutes of no activity." : ""); return;
    }
    if (!t.member) { show("viewClaim"); return; }
    if (t.face_required && !t.face_ok) { show("viewLogin"); await faceGate(); return; }
    enterApp();
  } finally { routing = false; }
}
db.auth.onAuthStateChange((ev, session) => {
  if (ev === "TOKEN_REFRESHED" || ev === "USER_UPDATED") return;
  if (ev === "SIGNED_IN" && entered) return;
  setTimeout(() => route(session), 0);
});
db.auth.getSession().then(({ data }) => route(data.session));

$("#claimBtn").addEventListener("click", async () => {
  const { data, error } = await db.rpc("claim_admin");
  if (error) return fail(error);
  if (data) { toast("You are the admin now ♡"); const { data: s } = await db.auth.getSession(); route(s.session); }
  else $("#claimMsg").textContent = "This website already has an admin, and it is not this account. Sign out and use the right email.";
});

function enterApp() {
  entered = true; show("viewApp"); lastAct = Date.now(); ticks = 0;
  loadAll(); startRealtime(); loadSecurity(); loadSettings();
  clearInterval(tickTimer); tickTimer = setInterval(tick, 1000);
}
async function tick() {
  const idle = Date.now() - lastAct;
  if (idle >= IDLE_MS) {
    try { await db.rpc("log_event", { p_kind: "idle_logout" }); } catch (e) { /* ignore */ }
    await hardLogout("You were signed out after 10 minutes of no activity."); return;
  }
  const left = Math.ceil((IDLE_MS - idle) / 1000);
  $("#idleBar").hidden = left > 60; if (left <= 60) $("#idleSecs").textContent = left;
  if (++ticks % 20 === 0) {              // tell the server we are still here, and notice if we were signed out remotely
    const { data, error } = await db.rpc("touch_session", { p_ua: navigator.userAgent });
    if (!error && (!data || !data.valid)) await hardLogout(data && data.reason === "idle" ? "You were signed out after 10 minutes of no activity." : "You were signed out from another device.");
  }
}

/* ---------- face check overlay ---------- */
function faceFlow({ mode, templates, locked }) {
  return new Promise(resolve => {
    const ov = $("#faceOverlay"), say = $("#faceSay"), steps = $$("#faceSteps li"), retry = $("#faceRetry"), cancel = $("#faceCancel");
    let cancelled = false, done = false;
    const setSteps = i => steps.forEach((li, k) => { li.classList.toggle("done", k < i); li.classList.toggle("on", k === i); });
    ov.hidden = false;
    $("#faceTitle").textContent = mode === "enroll" ? "Set up face lock" : "Face check";
    $("#faceSub").textContent = mode === "enroll" ? "We will save a small face fingerprint (not your picture). Follow the steps." : "Look at the camera, then follow the steps. Nothing is recorded.";
    cancel.textContent = locked ? "Sign out" : "Cancel";
    const finish = v => { if (done) return; done = true; ov.hidden = true; retry.onclick = null; cancel.onclick = null; resolve(v); };
    const attempt = async () => {
      retry.hidden = true; cancelled = false; setSteps(-1);
      try {
        const r = await window.ANU_FACE.run({ video: $("#faceVideo"), enroll: mode === "enroll", templates, cancelled: () => cancelled,
          say: (t, i) => { say.textContent = t; setSteps(i); } });
        if (done) return; if (mode === "verify" || mode === "enroll") localStorage.setItem("anu-face-on", "1"); finish(r || true);
      } catch (e) {
        if (done) return;
        if (mode === "verify" && locked) db.rpc("face_fail").then(() => {}, () => {});
        say.textContent = e.message || "Something went wrong"; setSteps(-1); retry.hidden = false;
      }
    };
    retry.onclick = attempt;
    cancel.onclick = () => { cancelled = true; if (locked) { finish(null); userLogout(); } else finish(null); };
    attempt();
  });
}
async function faceGate() {
  const { data: tpl } = await db.rpc("get_face_template");
  if (!tpl || !tpl.length) { await db.rpc("face_pass"); enterApp(); return; }
  const ok = await faceFlow({ mode: "verify", templates: tpl, locked: true });
  if (ok) { const { data } = await db.rpc("face_pass"); if (data) enterApp(); else await hardLogout("Face check could not be saved. Please sign in again."); }
}

/* ---------- tabs ---------- */
function goTab(name) {
  $$("#tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === name));
  $$(".tabpane").forEach(p => p.hidden = p.id !== "tab-" + name);
  $("#bulk").hidden = name !== "photos" || !selected.size;
  if (name === "security") loadSecurity();
  scrollTo({ top: 0 });
}
$("#tabs").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (b) goTab(b.dataset.tab); });
function loadAll() { loadSections(); loadPhotos(); loadPosts(); loadSocials(); loadConvs(); }

/* =====================================================================
   SHOW / HIDE (sections)
   ===================================================================== */
let sections = [];
const secVisible = key => { const r = sections.find(s => s.key === key); return r ? r.visible : true; };
async function loadSections() {
  const { data, error } = await db.from("sections").select("*").order("sort");
  if (error) return fail(error);
  sections = data; renderSections(); renderAreas();
}
async function setSection(key, visible) {
  const r = sections.find(s => s.key === key); if (r) r.visible = visible;
  renderSections(); renderAreas();
  const { error } = await db.from("sections").update({ visible }).eq("key", key);
  if (error) { fail(error); loadSections(); } else toast(visible ? "Now showing on the website" : "Hidden from the website");
}
function switchEl(on, label, onChange) {
  const l = document.createElement("label"); l.className = "switch";
  l.innerHTML = `<input type="checkbox" ${on ? "checked" : ""}><i></i><span>${esc(label)}</span>`;
  $("input", l).addEventListener("change", e => onChange(e.target.checked));
  return l;
}
function renderSections() {
  const box = $("#sectionList"); box.innerHTML = "";
  sections.forEach(s => {
    const d = document.createElement("div"); d.className = "item";
    d.innerHTML = `<div class="info"><b>${esc(s.label)}</b><span>${s.visible ? "Showing on the website" : "Hidden"}</span></div>`;
    d.append(switchEl(s.visible, "", v => setSection(s.key, v)));
    box.append(d);
  });
}

/* =====================================================================
   SITE: name, favicon, logo
   ===================================================================== */
let settings = {};
async function loadSettings() {
  const { data, error } = await db.from("site_settings").select("*");
  if (error) return fail(error);
  settings = Object.fromEntries(data.map(r => [r.key, r.value])); renderSettings();
}
function renderSettings() {
  $("#setTitle").value = settings.title || "";
  const setPrev = (el, url) => { el.style.backgroundImage = url ? `url("${url.replace(/"/g, "%22")}")` : ""; el.textContent = url ? "" : "none"; };
  setPrev($("#favPrev"), settings.favicon); setPrev($("#logoPrev"), settings.logo);
  $("#favDel").hidden = !settings.favicon; $("#logoDel").hidden = !settings.logo;
}
async function saveSetting(key, value) {
  if (value) { const { error } = await db.from("site_settings").upsert({ key, value }); if (error) throw error; settings[key] = value; }
  else { const { error } = await db.from("site_settings").delete().eq("key", key); if (error) throw error; delete settings[key]; }
  renderSettings();
}
$("#setTitleSave").addEventListener("click", async () => {
  try { await saveSetting("title", $("#setTitle").value.trim()); toast("Website name saved ♡"); } catch (e) { fail(e); }
});
$("#setTitleReset").addEventListener("click", async () => {
  try { await saveSetting("title", ""); toast("Back to the default name"); } catch (e) { fail(e); }
});
async function pictureBlob(file, square, size) {
  const bmp = await createImageBitmap(file); const c = document.createElement("canvas"); let w, h;
  if (square) { w = h = size; const s = Math.min(bmp.width, bmp.height); c.width = c.height = size; c.getContext("2d").drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size); }
  else { const k = Math.min(1, size / Math.max(bmp.width, bmp.height)); w = Math.round(bmp.width * k); h = Math.round(bmp.height * k); c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h); }
  return new Promise(r => c.toBlob(r, "image/png"));
}
function wireAsset(key, pickId, fileId, delId, square, size, label) {
  $(pickId).addEventListener("click", () => $(fileId).click());
  $(fileId).addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return; const b = $(pickId); b.disabled = true;
    try {
      const old = settings[key];
      const blob = await pictureBlob(f, square, size);
      const url = await uploadBlob(blob, `site/${key}-${Date.now()}.png`, "image/png");
      await saveSetting(key, url); try { await removeStored(old); } catch (err) { /* ignore */ }
      toast(label + " saved ♡");
    } catch (err) { fail(err); }
    b.disabled = false; e.target.value = "";
  });
  $(delId).addEventListener("click", async () => {
    try { const old = settings[key]; await saveSetting(key, ""); try { await removeStored(old); } catch (e) { /* ignore */ } toast(label + " removed"); } catch (e) { fail(e); }
  });
}
wireAsset("favicon", "#favPick", "#favFile", "#favDel", true, 128, "Favicon");
wireAsset("logo", "#logoPick", "#logoFile", "#logoDel", false, 512, "Logo");

/* =====================================================================
   PHOTOS (named places)
   ===================================================================== */
let photos = [];
const selected = new Set();
async function loadPhotos() {
  const { data, error } = await db.from("photos").select("*").order("sort");
  if (error) return fail(error);
  photos = data; renderAreas(); renderTrash();
}
const live = area => photos.filter(p => p.area === area && !p.deleted_at).sort((a, b) => a.sort - b.sort);
const nextSort = area => Math.max(0, ...photos.filter(p => p.area === area).map(p => p.sort)) + 1;

function renderAreas() {
  const box = $("#areas"); box.innerHTML = "";
  AREAS.forEach(a => {
    const list = live(a.key), on = secVisible(a.key);
    const card = document.createElement("div"); card.className = "card area" + (on ? "" : " off");
    card.innerHTML = `
      <div class="area-head">
        <div class="grow"><h3>${esc(a.name)} <span class="count">${list.length}</span></h3><p class="muted small">${esc(a.hint)}</p></div>
      </div>
      <div class="area-tools"></div>
      <div class="progress" hidden><i></i></div>
      <details class="alt"><summary>Add a photo using an image link</summary>
        <div class="row wrap">
          <label class="grow">Image link<input type="url" class="lu" placeholder="https://example.com/photo.jpg"></label>
          <label class="grow">Caption<input type="text" class="lc" placeholder="Optional"></label>
          <button class="btn small-btn la" type="button">Add</button>
        </div>
      </details>
      <div class="grid"></div>`;
    const tools = $(".area-tools", card);
    const file = document.createElement("input"); file.type = "file"; file.accept = "image/*"; file.multiple = true; file.hidden = true;
    const pick = document.createElement("button"); pick.className = "btn small-btn"; pick.type = "button"; pick.textContent = "📷 Add photos";
    pick.addEventListener("click", () => file.click());
    file.addEventListener("change", () => addFiles([...file.files], a.key, card).then(() => file.value = ""));
    tools.append(file, pick, switchEl(on, "Show on website", v => setSection(a.key, v)));
    $(".la", card).addEventListener("click", () => addByLink(a.key, card));

    const g = $(".grid", card);
    if (!list.length) g.innerHTML = `<div class="empty">Nothing here yet. Tap "Add photos".</div>`;
    list.forEach((p, i) => {
      const d = document.createElement("div"); d.className = "ph" + (p.hidden ? " is-hidden" : "");
      d.innerHTML = `<label class="pick"><input type="checkbox" ${selected.has(p.id) ? "checked" : ""} aria-label="Select photo"></label>
        <img src="${esc(p.url)}" alt="" loading="lazy">${p.hidden ? `<span class="tag over">Hidden</span>` : ""}
        <div class="ph-body"><input type="text" value="${esc(p.caption)}" placeholder="Caption" aria-label="Caption" maxlength="140">
        <div class="ph-actions">
          <button class="ic" data-a="left" aria-label="Move earlier" ${i === 0 ? "disabled" : ""}>◀</button>
          <button class="ic" data-a="right" aria-label="Move later" ${i === list.length - 1 ? "disabled" : ""}>▶</button>
          <button class="ic" data-a="eye" aria-label="${p.hidden ? "Show photo" : "Hide photo"}">${p.hidden ? "🙈" : "👁"}</button>
          <button class="ic del" data-a="del" aria-label="Move to trash">🗑</button></div></div>`;
      const cap = $(".ph-body input", d);
      cap.addEventListener("change", async () => {
        const { error } = await db.from("photos").update({ caption: cap.value.trim() }).eq("id", p.id);
        error ? fail(error) : (p.caption = cap.value.trim(), toast("Caption saved ♡"));
      });
      $(".pick input", d).addEventListener("change", e => { e.target.checked ? selected.add(p.id) : selected.delete(p.id); updateBulk(); });
      d.addEventListener("click", e => {
        const act = e.target.closest("[data-a]")?.dataset.a; if (!act) return;
        if (act === "del") trashPhotos([p.id]);
        else if (act === "eye") setHidden([p.id], !p.hidden);
        else movePhoto(a.key, i, act === "left" ? -1 : 1);
      });
      g.append(d);
    });
    box.append(card);
  });
  updateBulk();
}
async function patchPhotos(ids, patch, okMsg) {
  if (!ids.length) return;
  const { error } = await db.from("photos").update(patch).in("id", ids);
  if (error) return fail(error);
  photos.forEach(p => { if (ids.includes(p.id)) Object.assign(p, patch); });
  renderAreas(); renderTrash(); if (okMsg) toast(okMsg);
}
const setHidden = (ids, hidden) => patchPhotos(ids, { hidden }, hidden ? "Photo hidden" : "Photo showing");
async function trashPhotos(ids) {
  ids.forEach(id => selected.delete(id));
  await patchPhotos(ids, { deleted_at: new Date().toISOString() }, ids.length > 1 ? "Moved to trash. You can restore them in Trash." : "Moved to trash. You can restore it in Trash.");
}
async function movePhoto(area, i, d) {
  const list = live(area), j = i + d; if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const jobs = [];
  list.forEach((p, k) => { if (p.sort !== k + 1) { p.sort = k + 1; jobs.push(db.from("photos").update({ sort: k + 1 }).eq("id", p.id)); } });
  renderAreas();
  const rs = await Promise.all(jobs); const bad = rs.find(r => r.error); if (bad) fail(bad.error);
}
async function addFiles(files, area, card) {
  files = files.filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  if (!files.length) return;
  const prog = $(".progress", card), bar = $("i", prog);
  prog.hidden = false; bar.style.width = "3%"; let ok = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      const up = await uploadFile(files[i]);
      const size = up.w ? up : { ...up, ...(await imgSize(up.url)) };
      const { data, error } = await db.from("photos").insert({
        area, url: up.url, caption: "", width: size.w || null, height: size.h || null, sort: nextSort(area)
      }).select().single();
      if (error) throw error; photos.push(data); ok++;
    } catch (e) { fail(e); }
    bar.style.width = Math.round((i + 1) / files.length * 100) + "%";
  }
  renderAreas();
  if (ok) toast(ok + (ok > 1 ? " photos added to " : " photo added to ") + AREA_NAME[area]);
}
async function addByLink(area, card) {
  const url = cleanUrl($(".lu", card).value); if (!url) return toast("Paste an image link first", true);
  const btn = $(".la", card); btn.disabled = true;
  const size = await imgSize(url);
  if (!size.w) { btn.disabled = false; return toast("That link did not load as an image", true); }
  const { data, error } = await db.from("photos").insert({
    area, url, caption: $(".lc", card).value.trim(), width: size.w, height: size.h, sort: nextSort(area)
  }).select().single();
  btn.disabled = false;
  if (error) return fail(error);
  photos.push(data); renderAreas(); toast("Photo added ♡");
}
const bulkMove = $("#bulkMove");
AREAS.forEach(a => bulkMove.add(new Option(a.name, a.key)));
function updateBulk() {
  const ids = [...selected].filter(id => photos.some(p => p.id === id && !p.deleted_at));
  [...selected].forEach(id => { if (!ids.includes(id)) selected.delete(id); });
  $("#bulkCount").textContent = selected.size + " selected";
  $("#bulk").hidden = !selected.size || $("#tab-photos").hidden;
}
$("#bulk").addEventListener("click", async e => {
  const act = e.target.closest("[data-bulk]")?.dataset.bulk; if (!act) return;
  const ids = [...selected];
  if (act === "clear") { selected.clear(); renderAreas(); }
  if (act === "hide") { selected.clear(); await setHidden(ids, true); }
  if (act === "show") { selected.clear(); await setHidden(ids, false); }
  if (act === "trash") { if (confirm(`Move ${ids.length} photo(s) to the trash?`)) await trashPhotos(ids); }
});
bulkMove.addEventListener("change", async () => {
  const area = bulkMove.value; bulkMove.value = ""; if (!area) return;
  const ids = [...selected]; let s = nextSort(area); selected.clear();
  const jobs = ids.map(id => { const p = photos.find(x => x.id === id); p.area = area; p.sort = s++; return db.from("photos").update({ area, sort: p.sort }).eq("id", id); });
  renderAreas();
  const rs = await Promise.all(jobs); const bad = rs.find(r => r.error);
  bad ? fail(bad.error) : toast("Moved to " + AREA_NAME[area]);
});

/* =====================================================================
   BLOG
   ===================================================================== */
let posts = [], editing = null;
async function loadPosts() {
  const { data, error } = await db.from("posts").select("*").order("created_at", { ascending: false });
  if (error) return fail(error);
  posts = data; renderPosts(); renderTrash();
}
function renderPosts() {
  const list = posts.filter(p => !p.deleted_at);
  $("#countPosts").textContent = list.length;
  const box = $("#postList");
  box.innerHTML = list.length ? "" : `<div class="empty">No posts yet. Write your first one above.</div>`;
  list.forEach(p => {
    const d = document.createElement("div"); d.className = "item";
    d.innerHTML = `<div class="thumb" style="${p.cover_url ? `background-image:url('${esc(p.cover_url)}')` : ""}"></div>
      <div class="info"><b>${esc(p.title)}${p.published ? "" : `<span class="tag">hidden</span>`}${p.link_url ? `<span class="tag">${p.link_hidden ? "link hidden" : "link"}</span>` : ""}</b>
      <span>${fmtDate(p.created_at)}</span></div>
      <button class="ic" data-a="eye" aria-label="${p.published ? "Hide post" : "Show post"}">${p.published ? "👁" : "🙈"}</button>
      <button class="ic" data-a="edit" aria-label="Edit post">✏️</button>
      <button class="ic del" data-a="del" aria-label="Move to trash">🗑</button>`;
    d.addEventListener("click", e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "edit") editPost(p); if (a === "del") trashPost(p); if (a === "eye") togglePost(p);
    });
    box.append(d);
  });
}
async function togglePost(p) {
  const { error } = await db.from("posts").update({ published: !p.published }).eq("id", p.id);
  if (error) return fail(error); p.published = !p.published; renderPosts(); toast(p.published ? "Post is showing" : "Post hidden");
}
function coverPreview() {
  const u = cleanUrl($("#pCoverUrl").value), el = $("#coverPrev");
  el.style.backgroundImage = u ? `url("${u.replace(/"/g, "%22")}")` : ""; el.textContent = u ? "" : "No cover image";
}
$("#pCoverUrl").addEventListener("input", coverPreview);
$("#pCoverPick").addEventListener("click", () => $("#pCoverFile").click());
$("#pCoverFile").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  const b = $("#pCoverPick"); b.disabled = true; b.textContent = "Uploading…";
  try { const up = await uploadFile(f); $("#pCoverUrl").value = up.url; coverPreview(); toast("Cover uploaded ♡"); } catch (err) { fail(err); }
  b.disabled = false; b.textContent = "📷 Upload cover image"; e.target.value = "";
});
function resetPost() {
  editing = null;
  ["pTitle", "pExcerpt", "pBody", "pCoverUrl", "pLink"].forEach(i => $("#" + i).value = "");
  $("#pPublished").checked = true; $("#pLinkShow").checked = true; coverPreview();
  $("#postFormTitle").textContent = "Write a new post"; $("#postCancel").hidden = true; $("#postSave").textContent = "Save post";
}
function editPost(p) {
  editing = p.id;
  $("#pTitle").value = p.title; $("#pExcerpt").value = p.excerpt; $("#pBody").value = p.body;
  $("#pCoverUrl").value = p.cover_url || ""; $("#pLink").value = p.link_url || ""; $("#pPublished").checked = p.published;
  $("#pLinkShow").checked = !p.link_hidden; coverPreview();
  $("#postFormTitle").textContent = "Edit post"; $("#postCancel").hidden = false; $("#postSave").textContent = "Update post";
  $("#postForm").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#postCancel").addEventListener("click", resetPost);
$("#postSave").addEventListener("click", async () => {
  const title = $("#pTitle").value.trim(); if (!title) return toast("Please add a title", true);
  const row = { title, excerpt: $("#pExcerpt").value.trim(), body: $("#pBody").value.trim(),
    cover_url: cleanUrl($("#pCoverUrl").value) || null, link_url: cleanUrl($("#pLink").value) || null,
    link_hidden: !$("#pLinkShow").checked, published: $("#pPublished").checked };
  if (!row.body && !row.link_url) return toast("Add a story, a link, or both", true);
  const btn = $("#postSave"); btn.disabled = true;
  const { error } = editing ? await db.from("posts").update(row).eq("id", editing) : await db.from("posts").insert(row);
  btn.disabled = false; if (error) return fail(error);
  toast(editing ? "Post updated ♡" : "Post published ♡"); resetPost(); loadPosts();
});
async function trashPost(p) {
  if (!confirm(`Move "${p.title}" to the trash? You can restore it later.`)) return;
  const { error } = await db.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", p.id);
  if (error) return fail(error);
  p.deleted_at = new Date().toISOString(); if (editing === p.id) resetPost();
  renderPosts(); renderTrash(); toast("Moved to trash. You can restore it in Trash.");
}

/* =====================================================================
   TRASH
   ===================================================================== */
function renderTrash() {
  const tp = photos.filter(p => p.deleted_at).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
  const to = posts.filter(p => p.deleted_at);
  $("#countTrashPhotos").textContent = tp.length; $("#countTrashPosts").textContent = to.length;
  const g = $("#trashPhotos"); g.innerHTML = tp.length ? "" : `<div class="empty">No deleted photos</div>`;
  tp.forEach(p => {
    const d = document.createElement("div"); d.className = "ph";
    d.innerHTML = `<img src="${esc(p.url)}" alt="" loading="lazy">
      <div class="ph-body"><p class="small muted tl">${esc(AREA_NAME[p.area] || p.area)}<br>Deleted ${fmtDate(p.deleted_at)}</p>
      <div class="ph-actions"><button class="ic" data-a="restore">↩ Restore</button><button class="ic del" data-a="forever" aria-label="Delete forever">✕</button></div></div>`;
    d.addEventListener("click", e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "restore") patchPhotos([p.id], { deleted_at: null }, "Photo restored ♡");
      if (a === "forever") foreverPhoto(p);
    });
    g.append(d);
  });
  const l = $("#trashPosts"); l.innerHTML = to.length ? "" : `<div class="empty">No deleted posts</div>`;
  to.forEach(p => {
    const d = document.createElement("div"); d.className = "item";
    d.innerHTML = `<div class="thumb" style="${p.cover_url ? `background-image:url('${esc(p.cover_url)}')` : ""}"></div>
      <div class="info"><b>${esc(p.title)}</b><span>Deleted ${fmtDate(p.deleted_at)}</span></div>
      <button class="ic wide" data-a="restore">↩ Restore</button><button class="ic del" data-a="forever" aria-label="Delete forever">✕</button>`;
    d.addEventListener("click", async e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "restore") {
        const { error } = await db.from("posts").update({ deleted_at: null }).eq("id", p.id);
        if (error) return fail(error); p.deleted_at = null; renderPosts(); renderTrash(); toast("Post restored ♡");
      }
      if (a === "forever") foreverPost(p);
    });
    l.append(d);
  });
}
async function foreverPhoto(p, quiet) {
  if (!quiet && !confirm("Delete this photo forever? This cannot be undone.")) return;
  const { error } = await db.from("photos").delete().eq("id", p.id); if (error) return fail(error);
  try { await removeStored(p.url); } catch (e) { /* already gone */ }
  photos = photos.filter(x => x.id !== p.id); if (!quiet) { renderAreas(); renderTrash(); toast("Deleted forever"); }
}
async function foreverPost(p, quiet) {
  if (!quiet && !confirm(`Delete "${p.title}" forever? This cannot be undone.`)) return;
  const { error } = await db.from("posts").delete().eq("id", p.id); if (error) return fail(error);
  try { await removeStored(p.cover_url); } catch (e) { /* ignore */ }
  posts = posts.filter(x => x.id !== p.id); if (!quiet) { renderTrash(); toast("Deleted forever"); }
}
$("#emptyTrash").addEventListener("click", async () => {
  const tp = photos.filter(p => p.deleted_at), to = posts.filter(p => p.deleted_at);
  if (!tp.length && !to.length) return toast("The trash is already empty");
  if (!confirm(`Delete ${tp.length} photo(s) and ${to.length} post(s) forever? This cannot be undone.`)) return;
  for (const p of tp) await foreverPhoto(p, true);
  for (const p of to) await foreverPost(p, true);
  renderAreas(); renderTrash(); toast("Trash emptied");
});

/* =====================================================================
   SOCIAL (hide or delete any link)
   ===================================================================== */
let socials = [];
async function loadSocials() {
  const { data, error } = await db.from("socials").select("*").order("sort");
  if (error) return fail(error);
  socials = data; renderSocials();
}
function eyeBtn(row) {
  const b = document.createElement("button"); b.type = "button"; b.className = "ic eye";
  const upd = () => { const h = row.dataset.hidden === "1"; b.textContent = h ? "🙈" : "👁"; b.setAttribute("aria-label", h ? "Show this link on the website" : "Hide this link"); b.title = h ? "Hidden. Tap to show" : "Showing. Tap to hide"; row.classList.toggle("is-off", h); };
  b.addEventListener("click", () => { row.dataset.hidden = row.dataset.hidden === "1" ? "0" : "1"; upd(); });
  upd(); return b;
}
function renderSocials() {
  const g = $("#socialGrid"); g.innerHTML = "";
  ICONS.PRESETS.forEach(([key, name, , ph]) => {
    const row = socials.find(s => !s.extra && s.platform === key);
    const d = document.createElement("div"); d.className = "soc"; d.dataset.hidden = row && row.hidden ? "1" : "0";
    const ic = document.createElement("span"); ic.className = "soc-ic"; ic.append(ICONS.el(key)); d.append(ic);
    const lab = document.createElement("label");
    lab.innerHTML = `${esc(name)}<input type="text" data-key="${esc(key)}" value="${esc(row ? row.url.replace(/^mailto:/, "") : "")}" placeholder="${esc(ph)}" inputmode="url" autocapitalize="off" autocomplete="off">`;
    d.append(lab);
    const del = document.createElement("button"); del.type = "button"; del.className = "ic del"; del.textContent = "✕"; del.setAttribute("aria-label", "Delete this link"); del.title = "Delete this link";
    del.addEventListener("click", () => { $("input", lab).value = ""; d.dataset.hidden = "0"; $(".eye", d).textContent = "👁"; d.classList.remove("is-off"); toast("Link cleared. Press Save to apply."); });
    d.append(eyeBtn(d), del); g.append(d);
  });
  $("#customList").innerHTML = "";
  socials.filter(s => s.extra).forEach(s => addCustomRow(s.platform, s.label, s.url, s.hidden));
}
function addCustomRow(icon = "link", label = "", url = "", hidden = false) {
  const d = document.createElement("div"); d.className = "item cust-item"; d.dataset.hidden = hidden ? "1" : "0";
  const ic = document.createElement("span"); ic.className = "soc-ic"; ic.append(ICONS.el(icon)); d.append(ic);
  const wrap = document.createElement("div"); wrap.className = "cust grow";
  wrap.innerHTML = `<select class="ci" aria-label="Icon">${ICONS.EXTRA.map(([k, n]) => `<option value="${esc(k)}" ${k === icon ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
    <input type="text" class="cl" placeholder="Name (e.g. My shop)" value="${esc(label)}" maxlength="30">
    <input type="text" class="cu" placeholder="https://..." value="${esc(url)}" inputmode="url" autocapitalize="off">`;
  d.append(wrap);
  const x = document.createElement("button"); x.className = "ic del"; x.type = "button"; x.setAttribute("aria-label", "Delete this link"); x.textContent = "✕";
  x.addEventListener("click", () => d.remove());
  d.append(eyeBtn(d), x);
  $(".ci", d).addEventListener("change", e => { ic.innerHTML = ""; ic.append(ICONS.el(e.target.value)); });
  $("#customList").append(d);
}
$("#customAdd").addEventListener("click", () => addCustomRow());
$("#socialSave").addEventListener("click", async () => {
  const btn = $("#socialSave"); btn.disabled = true;
  try {
    const rows = []; let n = 0;
    $$("#socialGrid .soc").forEach(d => {
      const i = $("input", d), url = cleanUrl(i.value);
      if (url) rows.push({ platform: i.dataset.key, label: "", url, sort: n++, extra: false, hidden: d.dataset.hidden === "1" });
    });
    $$("#customList .item").forEach(d => {
      const url = cleanUrl($(".cu", d).value), icon = $(".ci", d).value, label = $(".cl", d).value.trim();
      if (url) rows.push({ platform: icon, label: label || ICONS.NAME[icon] || "Link", url, sort: n++, extra: true, hidden: d.dataset.hidden === "1" });
    });
    const del = await db.from("socials").delete().not("id", "is", null); if (del.error) throw del.error;
    if (rows.length) { const ins = await db.from("socials").insert(rows); if (ins.error) throw ins.error; }
    toast("Social links saved ♡"); loadSocials();
  } catch (e) { fail(e); }
  btn.disabled = false;
});

/* =====================================================================
   CHAT: stored, edit your messages, emoji, reactions, typing, seen
   ===================================================================== */
let convs = [], openId = null, thread = [], rt = null, editingMsg = null, popFor = null, lastPing = 0;
let audioCtx = null;
addEventListener("pointerdown", () => { if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no sound */ } }, { once: true });
function beep() {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(880, audioCtx.currentTime); o.frequency.setValueAtTime(1175, audioCtx.currentTime + .12);
    g.gain.setValueAtTime(.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.25, audioCtx.currentTime + .02);
    g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .35);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + .36);
  } catch (e) { /* ignore */ }
}
const convName = c => (c && c.visitor_name) || "Visitor";
const typingNow = c => !!(c && c.visitor_typing_at && Date.now() - new Date(c.visitor_typing_at) < 5000);
async function loadConvs() {
  const [c, m] = await Promise.all([
    db.from("conversations").select("*").order("last_message_at", { ascending: false }),
    db.from("messages").select("conversation_id,sender,body,read,created_at").order("created_at", { ascending: false }).limit(500)
  ]);
  if (c.error) return fail(c.error);
  if (m.error) return fail(m.error);
  const last = {}, unread = {};
  m.data.forEach(x => { if (!last[x.conversation_id]) last[x.conversation_id] = x; if (x.sender === "visitor" && !x.read) unread[x.conversation_id] = (unread[x.conversation_id] || 0) + 1; });
  convs = c.data.map(x => ({ ...x, last: last[x.id], unread: unread[x.id] || 0 }));
  renderConvs(); updateBadge();
}
function updateBadge() {
  const n = convs.reduce((a, c) => a + c.unread, 0);
  const b = $("#chatBadge"); b.hidden = !n; b.textContent = n > 9 ? "9+" : n;
  document.title = (n ? `(${n}) ` : "") + "Anu Admin";
}
function renderConvs() {
  const box = $("#convList");
  box.innerHTML = `<h3>All chats <span class="count">${convs.length}</span></h3>`;
  if (!convs.length) { box.insertAdjacentHTML("beforeend", `<div class="empty">No messages yet. When someone writes from the website, it shows up here.</div>`); return; }
  convs.forEach(c => {
    const b = document.createElement("button"); b.type = "button"; b.className = "conv" + (c.id === openId ? " on" : "");
    b.innerHTML = `<span class="av">${esc(convName(c).slice(0, 1).toUpperCase())}</span>
      <span class="grow"><b>${esc(convName(c))}</b><small>${typingNow(c) ? "typing…" : esc(c.last ? (c.last.sender === "admin" ? "You: " : "") + c.last.body : "")}</small></span>
      <span class="when">${c.last ? fmtTime(c.last.created_at) : ""}</span>${c.unread ? `<em class="dot">${c.unread}</em>` : ""}`;
    b.addEventListener("click", () => openThread(c.id));
    box.append(b);
  });
}
async function loadReactions() {
  if (!thread.length) return;
  const { data, error } = await db.from("message_reactions").select("*").in("message_id", thread.map(m => m.id));
  if (error) return;
  thread.forEach(m => { m.reactions = data.filter(r => r.message_id === m.id); });
}
async function openThread(id) {
  openId = id; editingMsg = null; closePop(); const c = convs.find(x => x.id === id);
  $("#thread").hidden = false; $("#chatWrap").classList.add("open");
  $("#threadName").textContent = convName(c);
  const { data, error } = await db.from("messages").select("*").eq("conversation_id", id).order("created_at");
  if (error) return fail(error);
  thread = data.map(m => ({ ...m, reactions: [] })); await loadReactions(); drawThread(true); renderConvs(); headSub();
  if (thread.some(m => m.sender === "visitor" && !m.read)) {
    await db.from("messages").update({ read: true }).eq("conversation_id", id).eq("sender", "visitor").eq("read", false);
    if (c) c.unread = 0; renderConvs(); updateBadge();
  }
}
function headSub() {
  const c = convs.find(x => x.id === openId); if (!c) return;
  $("#threadSub").textContent = typingNow(c) ? "typing…" : c.visitor_seen_at ? "Last active " + ago(c.visitor_seen_at) : "";
}
function drawThread(forceBottom) {
  const c = convs.find(x => x.id === openId), log = $("#threadLog");
  const atBottom = forceBottom || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.innerHTML = "";
  const lastAdmin = [...thread].reverse().find(m => m.sender === "admin");
  thread.forEach(m => {
    const mine = m.sender === "admin";
    const row = document.createElement("div"); row.className = "brow " + (mine ? "me" : "them");
    if (editingMsg === m.id) {
      const box = document.createElement("div"); box.className = "edit-box";
      box.innerHTML = `<textarea rows="3" maxlength="1000" aria-label="Edit message"></textarea><div class="row"><button class="btn small-btn" type="button">Save</button><button class="btn ghost small-btn" type="button">Cancel</button></div>`;
      const ta = $("textarea", box); ta.value = m.body;
      const [save, cancel] = $$("button", box);
      cancel.addEventListener("click", () => { editingMsg = null; drawThread(); });
      save.addEventListener("click", async () => {
        const body = ta.value.trim(); if (!body) return toast("A message cannot be empty", true);
        if (body === m.body) { editingMsg = null; return drawThread(); }
        const { error } = await db.from("messages").update({ body }).eq("id", m.id);
        if (error) return fail(error);
        m.body = body; m.edited_at = new Date().toISOString(); editingMsg = null; drawThread(); loadConvs(); toast("Message edited ♡");
      });
      row.append(box); log.append(row); setTimeout(() => ta.focus(), 0); return;
    }
    const line = document.createElement("div"); line.className = "bline";
    const b = document.createElement("div"); b.className = "bub " + (mine ? "me" : "them"); b.textContent = m.body;
    const s = document.createElement("small"); s.textContent = fmtTime(m.created_at) + (m.edited_at ? " · edited" : ""); b.append(s);
    const acts = document.createElement("div"); acts.className = "bact";
    const r = document.createElement("button"); r.type = "button"; r.className = "ic"; r.textContent = "😊"; r.setAttribute("aria-label", "React to this message");
    r.addEventListener("click", () => openPop("react", m)); acts.append(r);
    if (mine) {
      const ed = document.createElement("button"); ed.type = "button"; ed.className = "ic"; ed.textContent = "✏️"; ed.setAttribute("aria-label", "Edit this message");
      ed.addEventListener("click", () => { editingMsg = m.id; drawThread(); }); acts.append(ed);
    }
    line.append(...(mine ? [acts, b] : [b, acts])); row.append(line);
    if (m.reactions && m.reactions.length) {
      const rr = document.createElement("div"); rr.className = "reacts";
      m.reactions.forEach(x => {
        const ch = document.createElement("button"); ch.type = "button"; ch.className = "rx" + (x.side === "admin" ? " mine" : ""); ch.textContent = x.emoji;
        ch.setAttribute("aria-label", "Reaction " + x.emoji); ch.addEventListener("click", () => openPop("react", m)); rr.append(ch);
      });
      row.append(rr);
    }
    if (lastAdmin && m.id === lastAdmin.id) {
      const sn = document.createElement("div"); sn.className = "seen";
      const seen = c && c.visitor_seen_at && new Date(c.visitor_seen_at) >= new Date(m.created_at);
      sn.dataset.t = seen ? c.visitor_seen_at : ""; sn.textContent = seen ? "Seen " + ago(c.visitor_seen_at) : "Delivered"; row.append(sn);
    }
    log.append(row);
  });
  if (typingNow(c)) {
    const t = document.createElement("div"); t.className = "bub them typing-b"; t.innerHTML = "<i></i><i></i><i></i>"; t.setAttribute("aria-label", "typing"); log.append(t);
  }
  if (atBottom) log.scrollTop = log.scrollHeight;
}
setInterval(() => {                                     // keep "typing…" and "seen … ago" fresh
  if (!openId) return;
  const c = convs.find(x => x.id === openId); if (!c) return;
  const has = !!$(".typing-b"); if (has !== typingNow(c) && editingMsg === null) drawThread();
  $$("#threadLog .seen").forEach(e => { if (e.dataset.t) e.textContent = "Seen " + ago(e.dataset.t); }); headSub();
}, 1000);
$("#threadBack").addEventListener("click", () => { openId = null; $("#thread").hidden = true; $("#chatWrap").classList.remove("open"); renderConvs(); });
$("#threadDel").addEventListener("click", async () => {
  if (!openId || !confirm("Delete this whole chat? This cannot be undone.")) return;
  const { error } = await db.from("conversations").delete().eq("id", openId); if (error) return fail(error);
  openId = null; $("#thread").hidden = true; $("#chatWrap").classList.remove("open"); loadConvs(); toast("Chat deleted");
});
$("#threadSave").addEventListener("click", () => {
  const c = convs.find(x => x.id === openId); if (!c) return;
  const txt = `Chat with ${convName(c)}\n\n` + thread.map(m => `[${fmtTime(m.created_at)}] ${m.sender === "admin" ? "You" : convName(c)}: ${m.body}${m.edited_at ? " (edited)" : ""}`).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
  a.download = `chat-${convName(c).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$("#replyText").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#replyForm").requestSubmit(); } });
$("#replyText").addEventListener("input", () => {
  if (!openId || !$("#replyText").value.trim()) return;
  const now = Date.now(); if (now - lastPing < 2500) return; lastPing = now;
  db.from("conversations").update({ admin_typing_at: new Date().toISOString() }).eq("id", openId).then(() => {}, () => {});
});
$("#replyForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!openId) return;
  const body = $("#replyText").value.trim(); if (!body) return;
  $("#replyText").value = ""; closePop();
  const { data, error } = await db.from("messages").insert({ conversation_id: openId, sender: "admin", body, read: true }).select().single();
  if (error) { fail(error); $("#replyText").value = body; return; }
  await db.from("conversations").update({ last_message_at: new Date().toISOString(), admin_typing_at: null }).eq("id", openId);
  if (!thread.some(m => m.id === data.id)) thread.push({ ...data, reactions: [] });
  drawThread(true); loadConvs();
});

/* emoji: put one in your reply, or react to any message with any emoji */
const EMOJIS = ["😀","😂","🥹","😍","🥰","😘","😊","😉","😎","🤩","🥳","😭","😢","😡","😴","🤔","🙄","😇","🤗","😋",
                "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💖","💕","💞","💘","✨","🌸","🌹","🔥","🎉","🎂","🎁","🎈",
                "👍","👎","👏","🙌","🙏","💪","👌","✌️","🤞","👋","😅","🫶","💯","⭐","🌙","☀️"];
const QUICK = ["❤️","😂","😍","👍","😮","😢"];
const isEmoji = s => /\p{Extended_Pictographic}/u.test(s) && [...s].length <= 8;
function openPop(mode, msg) {
  const pop = $("#emoPop"); popFor = { mode, msg }; pop.textContent = "";
  const h = document.createElement("p"); h.className = "emo-h"; h.textContent = mode === "react" ? "React with any emoji" : "Add an emoji"; pop.append(h);
  const btn = e => { const b = document.createElement("button"); b.type = "button"; b.textContent = e; b.setAttribute("aria-label", e); b.addEventListener("click", () => pickEmoji(e)); return b; };
  if (mode === "react") { const q = document.createElement("div"); q.className = "emo-quick"; QUICK.forEach(e => q.append(btn(e))); pop.append(q); }
  const g = document.createElement("div"); g.className = "emo-grid"; EMOJIS.forEach(e => g.append(btn(e))); pop.append(g);
  const r = document.createElement("div"); r.className = "emo-own";
  r.innerHTML = '<input type="text" placeholder="Or type / paste any emoji" maxlength="16" aria-label="Any emoji"><button type="button" class="btn small-btn">Add</button>';
  const inp = $("input", r), add = () => { const v = inp.value.trim(); if (!isEmoji(v)) { inp.value = ""; inp.placeholder = "That is not an emoji, try again"; return; } pickEmoji(v); };
  $("button", r).addEventListener("click", add); inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  pop.append(r);
  if (mode === "react" && msg && (msg.reactions || []).some(x => x.side === "admin")) {
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "emo-rm"; rm.textContent = "Remove my reaction"; rm.addEventListener("click", () => pickEmoji("")); pop.append(rm);
  }
  pop.hidden = false;
}
function closePop() { $("#emoPop").hidden = true; popFor = null; }
async function pickEmoji(e) {
  const p = popFor; if (!p) return;
  if (p.mode === "insert") {
    const t = $("#replyText"), s = t.selectionStart ?? t.value.length, en = t.selectionEnd ?? s;
    t.value = t.value.slice(0, s) + e + t.value.slice(en); t.focus(); t.selectionStart = t.selectionEnd = s + e.length; closePop(); return;
  }
  const m = p.msg; closePop();
  m.reactions = (m.reactions || []).filter(x => x.side !== "admin"); if (e) m.reactions.push({ message_id: m.id, side: "admin", emoji: e });
  drawThread();
  const { error } = e ? await db.from("message_reactions").upsert({ message_id: m.id, side: "admin", emoji: e }, { onConflict: "message_id,side" })
                      : await db.from("message_reactions").delete().eq("message_id", m.id).eq("side", "admin");
  if (error) { fail(error); loadReactions().then(() => drawThread()); }
}
$("#replyEmo").addEventListener("click", () => { $("#emoPop").hidden ? openPop("insert") : closePop(); });
document.addEventListener("pointerdown", e => { if (!$("#emoPop").hidden && !e.target.closest("#emoPop, #replyEmo, .bact")) closePop(); });

function startRealtime() {
  if (rt) return;
  rt = db.channel("admin-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async p => {
      const m = p.new;
      if (m.sender === "visitor") {
        await loadConvs();
        const c = convs.find(x => x.id === m.conversation_id);
        beep(); toast(`New message from ${convName(c)}`);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          try { new Notification(`New message from ${convName(c)}`, { body: m.body.slice(0, 120), tag: "anu-chat" }); } catch (e) { /* ignore */ }
        }
        if (openId === m.conversation_id) {
          if (!thread.some(x => x.id === m.id)) thread.push({ ...m, reactions: [] });
          drawThread(); headSub();
          db.from("messages").update({ read: true }).eq("id", m.id).then(() => loadConvs());
        }
      } else if (openId === m.conversation_id && !thread.some(x => x.id === m.id)) { thread.push({ ...m, reactions: [] }); drawThread(); }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, p => {
      const c = convs.find(x => x.id === p.new.id); if (!c) { loadConvs(); return; }
      Object.assign(c, p.new); renderConvs(); if (openId === c.id && editingMsg === null) { drawThread(); headSub(); }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, async () => {
      if (openId) { await loadReactions(); if (editingMsg === null) drawThread(); }
    })
    .subscribe();
}
function notifyState() {
  const st = $("#notifyState"), b = $("#notifyBtn");
  if (!("Notification" in window)) { st.textContent = "This browser cannot show pop-up alerts, but you will still hear a sound while this page is open."; b.hidden = true; return; }
  if (Notification.permission === "granted") { st.textContent = "Alerts are on. You get a sound and a pop-up for each new message while this page is open."; b.hidden = true; }
  else if (Notification.permission === "denied") { st.textContent = "Alerts are blocked in your browser settings. You still hear a sound while this page is open."; b.hidden = true; }
}
$("#notifyBtn").addEventListener("click", async () => { try { await Notification.requestPermission(); } catch (e) { /* ignore */ } notifyState(); });
notifyState();

/* =====================================================================
   SECURITY: face lock, devices, login history
   ===================================================================== */
let secState = { face_required: false, has_template: false };
async function loadSecurity() {
  const [s, l, h] = await Promise.all([db.rpc("get_security"), db.rpc("list_sessions"), db.rpc("login_history")]);
  if (s.data) secState = s.data; renderFace();
  renderDevices(l.data || []); renderHistory(h.data || []);
}
function renderFace() {
  $("#faceState").textContent = secState.face_required ? "on" : "off";
  $("#faceSetup").textContent = secState.has_template ? "Update my face" : "Set up face lock";
  $("#faceTest").hidden = !secState.has_template; $("#faceOff").hidden = !secState.face_required;
}
$("#faceSetup").addEventListener("click", async () => {
  const r = await faceFlow({ mode: "enroll", templates: [], locked: false });
  if (!r || !r.template) return;
  const { data, error } = await db.rpc("set_face_lock", { p_template: r.template, p_enabled: true });
  if (error || !data) return fail(error || new Error("Could not save the face lock"));
  toast("Face lock is on ♡"); loadSecurity();
});
async function myTemplate() { const { data } = await db.rpc("get_face_template"); return data; }
$("#faceTest").addEventListener("click", async () => {
  const tpl = await myTemplate(); if (!tpl || !tpl.length) return toast("Set up the face lock first", true);
  const ok = await faceFlow({ mode: "verify", templates: tpl, locked: false }); if (ok) toast("It works ✓ That was you");
});
$("#faceOff").addEventListener("click", async () => {
  const tpl = await myTemplate();
  if (tpl && tpl.length) { const ok = await faceFlow({ mode: "verify", templates: tpl, locked: false }); if (!ok) return; }
  const { data, error } = await db.rpc("set_face_lock", { p_template: null, p_enabled: false });
  if (error || !data) return fail(error || new Error("Could not turn it off"));
  toast("Face lock is off"); loadSecurity();
});
function renderDevices(rows) {
  $("#countDevices").textContent = rows.length;
  const box = $("#deviceList"); box.innerHTML = rows.length ? "" : `<div class="empty">No devices found</div>`;
  rows.forEach(s => {
    const d = document.createElement("div"); d.className = "item dev";
    const active = Date.now() - new Date(s.last_seen) < 120000;
    d.innerHTML = `<span class="soc-ic">${/iPhone|Android|iPad/.test(s.user_agent || "") ? "📱" : "💻"}</span>
      <div class="info"><b>${esc(deviceName(s.user_agent))}${s.is_current ? `<span class="tag">this device</span>` : ""}</b>
      <span>${active ? "Active now" : "Last active " + ago(s.last_seen)}${s.ip ? " · IP " + esc(s.ip) : ""}</span>
      <span>Signed in ${esc(fmtTime(s.created_at))}</span></div>
      <button class="ic wide del" type="button">${s.is_current ? "Sign out" : "Log out"}</button>`;
    $("button", d).addEventListener("click", async () => {
      if (s.is_current) return userLogout();
      if (!confirm(`Sign out ${deviceName(s.user_agent)}?`)) return;
      const { data, error } = await db.rpc("revoke_session", { p_id: s.session_id });
      if (error || !data) return fail(error || new Error("Could not sign that device out"));
      toast("That device was signed out"); loadSecurity();
    });
    box.append(d);
  });
}
$("#signOutOthers").addEventListener("click", async () => {
  if (!confirm("Sign out every other device? This one stays signed in.")) return;
  const { data, error } = await db.rpc("revoke_other_sessions"); if (error) return fail(error);
  toast(data ? `Signed out ${data} other device(s)` : "No other devices were signed in"); loadSecurity();
});
$("#refreshDevices").addEventListener("click", loadSecurity);
const EVENT_LABEL = { login: "Signed in", face_passed: "Face check passed ✓", face_failed: "Face check failed ✗", revoked: "A device was signed out", idle_logout: "Signed out (10 min idle)", logout: "Signed out" };
function renderHistory(rows) {
  const box = $("#historyList"); box.innerHTML = rows.length ? "" : `<div class="empty">Nothing yet</div>`;
  rows.forEach(r => {
    const d = document.createElement("div"); d.className = "item hist" + (r.kind === "face_failed" ? " bad" : "");
    d.innerHTML = `<div class="info"><b>${esc(EVENT_LABEL[r.kind] || r.kind)}</b><span>${esc(fmtTime(r.at))}${r.user_agent ? " · " + esc(deviceName(r.user_agent)) : ""}${r.ip ? " · IP " + esc(r.ip) : ""}</span></div>`;
    box.append(d);
  });
}

})();
