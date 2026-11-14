(() => {
"use strict";

const db = supabase.createClient(window.ANU_CONFIG.url, window.ANU_CONFIG.key);
const ICONS = window.ANU_ICONS;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MEDIA_MARK = "/storage/v1/object/public/media/";

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
async function uploadFile(file) {
  const s = await shrink(file);
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${s.ext}`;
  const { error } = await db.storage.from("media").upload(path, s.blob, { contentType: s.type, cacheControl: "31536000" });
  if (error) throw error;
  return { url: publicUrl(path), w: s.w, h: s.h };
}
async function removeStored(url) {
  const i = (url || "").indexOf(MEDIA_MARK);
  if (i > -1) await db.storage.from("media").remove([decodeURIComponent(url.slice(i + MEDIA_MARK.length))]);
}
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtTime = d => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* ---------- login / session ---------- */
let signUpMode = false;
$("#toggleMode").addEventListener("click", () => {
  signUpMode = !signUpMode;
  $("#loginBtn").textContent = signUpMode ? "Create account" : "Sign in";
  $("#toggleMode").textContent = signUpMode ? "I already have an account" : "First time? Create your account";
  $("#loginHint").textContent = signUpMode ? "Choose an email and a password you will remember." : "Sign in to manage your website.";
  $("#password").autocomplete = signUpMode ? "new-password" : "current-password";
});
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
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
    }
  } catch (err) { fail(err); }
  btn.disabled = false;
});
$$("[data-logout]").forEach(b => b.addEventListener("click", async () => { await db.removeAllChannels(); db.auth.signOut(); }));

let booted = false;
async function route(session) {
  if (!session) { booted = false; show("viewLogin"); return; }
  const { data, error } = await db.rpc("is_admin");
  if (error) { fail(error); show("viewLogin"); return; }
  if (data) { show("viewApp"); if (!booted) { booted = true; loadAll(); startRealtime(); } }
  else show("viewClaim");
}
db.auth.onAuthStateChange((ev, session) => { if (ev !== "TOKEN_REFRESHED") setTimeout(() => route(session), 0); });
db.auth.getSession().then(({ data }) => route(data.session));
$("#claimBtn").addEventListener("click", async () => {
  const { data, error } = await db.rpc("claim_admin");
  if (error) return fail(error);
  if (data) { toast("You are the admin now ♡"); const { data: s } = await db.auth.getSession(); route(s.session); }
  else $("#claimMsg").textContent = "This website already has an admin, and it is not this account. Sign out and use the right email.";
});

/* ---------- tabs ---------- */
function goTab(name) {
  $$("#tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === name));
  $$(".tabpane").forEach(p => p.hidden = p.id !== "tab-" + name);
  $("#bulk").hidden = name !== "photos" || !selected.size;
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

/* uploads into a specific place */
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

/* bulk actions */
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
      <div class="info"><b>${esc(p.title)}${p.published ? "" : `<span class="tag">hidden</span>`}${p.link_url ? `<span class="tag">link</span>` : ""}</b>
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
  $("#pPublished").checked = true; coverPreview();
  $("#postFormTitle").textContent = "Write a new post"; $("#postCancel").hidden = true; $("#postSave").textContent = "Save post";
}
function editPost(p) {
  editing = p.id;
  $("#pTitle").value = p.title; $("#pExcerpt").value = p.excerpt; $("#pBody").value = p.body;
  $("#pCoverUrl").value = p.cover_url || ""; $("#pLink").value = p.link_url || ""; $("#pPublished").checked = p.published; coverPreview();
  $("#postFormTitle").textContent = "Edit post"; $("#postCancel").hidden = false; $("#postSave").textContent = "Update post";
  $("#postForm").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#postCancel").addEventListener("click", resetPost);
$("#postSave").addEventListener("click", async () => {
  const title = $("#pTitle").value.trim(); if (!title) return toast("Please add a title", true);
  const row = { title, excerpt: $("#pExcerpt").value.trim(), body: $("#pBody").value.trim(),
    cover_url: cleanUrl($("#pCoverUrl").value) || null, link_url: cleanUrl($("#pLink").value) || null, published: $("#pPublished").checked };
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
   SOCIAL
   ===================================================================== */
let socials = [];
async function loadSocials() {
  const { data, error } = await db.from("socials").select("*").order("sort");
  if (error) return fail(error);
  socials = data; renderSocials();
}
function renderSocials() {
  const g = $("#socialGrid"); g.innerHTML = "";
  ICONS.PRESETS.forEach(([key, name, , ph]) => {
    const row = socials.find(s => !s.extra && s.platform === key);
    const d = document.createElement("div"); d.className = "soc";
    const ic = document.createElement("span"); ic.className = "soc-ic"; ic.append(ICONS.el(key));
    d.append(ic);
    const lab = document.createElement("label");
    lab.innerHTML = `${esc(name)}<input type="text" data-key="${esc(key)}" value="${esc(row ? row.url.replace(/^mailto:/, "") : "")}" placeholder="${esc(ph)}" inputmode="url" autocapitalize="off" autocomplete="off">`;
    d.append(lab); g.append(d);
  });
  $("#customList").innerHTML = "";
  socials.filter(s => s.extra).forEach(s => addCustomRow(s.platform, s.label, s.url));
}
function addCustomRow(icon = "link", label = "", url = "") {
  const d = document.createElement("div"); d.className = "item cust-item";
  const ic = document.createElement("span"); ic.className = "soc-ic"; ic.append(ICONS.el(icon)); d.append(ic);
  const wrap = document.createElement("div"); wrap.className = "cust grow";
  wrap.innerHTML = `<select class="ci" aria-label="Icon">${ICONS.EXTRA.map(([k, n]) => `<option value="${esc(k)}" ${k === icon ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
    <input type="text" class="cl" placeholder="Name (e.g. My shop)" value="${esc(label)}" maxlength="30">
    <input type="text" class="cu" placeholder="https://..." value="${esc(url)}" inputmode="url" autocapitalize="off">`;
  d.append(wrap);
  const x = document.createElement("button"); x.className = "ic del"; x.type = "button"; x.setAttribute("aria-label", "Remove link"); x.textContent = "✕";
  x.addEventListener("click", () => d.remove()); d.append(x);
  $(".ci", d).addEventListener("change", e => { ic.innerHTML = ""; ic.append(ICONS.el(e.target.value)); });
  $("#customList").append(d);
}
$("#customAdd").addEventListener("click", () => addCustomRow());
$("#socialSave").addEventListener("click", async () => {
  const btn = $("#socialSave"); btn.disabled = true;
  try {
    const rows = []; let n = 0;
    $$("#socialGrid input").forEach(i => { const url = cleanUrl(i.value); if (url) rows.push({ platform: i.dataset.key, label: "", url, sort: n++, extra: false }); });
    $$("#customList .item").forEach(d => {
      const url = cleanUrl($(".cu", d).value), icon = $(".ci", d).value, label = $(".cl", d).value.trim();
      if (url) rows.push({ platform: icon, label: label || ICONS.NAME[icon] || "Link", url, sort: n++, extra: true });
    });
    const del = await db.from("socials").delete().not("id", "is", null); if (del.error) throw del.error;
    if (rows.length) { const ins = await db.from("socials").insert(rows); if (ins.error) throw ins.error; }
    toast("Social links saved ♡"); loadSocials();
  } catch (e) { fail(e); }
  btn.disabled = false;
});

/* =====================================================================
   CHAT
   ===================================================================== */
let convs = [], openId = null, thread = [], rt = null;
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
      <span class="grow"><b>${esc(convName(c))}</b><small>${esc(c.last ? (c.last.sender === "admin" ? "You: " : "") + c.last.body : "")}</small></span>
      <span class="when">${c.last ? fmtTime(c.last.created_at) : ""}</span>${c.unread ? `<em class="dot">${c.unread}</em>` : ""}`;
    b.addEventListener("click", () => openThread(c.id));
    box.append(b);
  });
}
async function openThread(id) {
  openId = id; const c = convs.find(x => x.id === id);
  $("#thread").hidden = false; $("#chatWrap").classList.add("open");
  $("#threadName").textContent = convName(c);
  const { data, error } = await db.from("messages").select("*").eq("conversation_id", id).order("created_at");
  if (error) return fail(error);
  thread = data; drawThread(); renderConvs();
  if (thread.some(m => m.sender === "visitor" && !m.read)) {
    await db.from("messages").update({ read: true }).eq("conversation_id", id).eq("sender", "visitor").eq("read", false);
    if (c) c.unread = 0; renderConvs(); updateBadge();
  }
}
function drawThread() {
  const log = $("#threadLog"); log.innerHTML = "";
  thread.forEach(m => {
    const d = document.createElement("div"); d.className = "bub " + (m.sender === "admin" ? "me" : "them");
    d.textContent = m.body; const s = document.createElement("small"); s.textContent = fmtTime(m.created_at); d.append(s); log.append(d);
  });
  log.scrollTop = log.scrollHeight;
}
$("#threadBack").addEventListener("click", () => { openId = null; $("#thread").hidden = true; $("#chatWrap").classList.remove("open"); renderConvs(); });
$("#threadDel").addEventListener("click", async () => {
  if (!openId || !confirm("Delete this whole chat? This cannot be undone.")) return;
  const { error } = await db.from("conversations").delete().eq("id", openId); if (error) return fail(error);
  openId = null; $("#thread").hidden = true; $("#chatWrap").classList.remove("open"); loadConvs(); toast("Chat deleted");
});
$("#replyText").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#replyForm").requestSubmit(); } });
$("#replyForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!openId) return;
  const body = $("#replyText").value.trim(); if (!body) return;
  $("#replyText").value = "";
  const { data, error } = await db.from("messages").insert({ conversation_id: openId, sender: "admin", body, read: true }).select().single();
  if (error) { fail(error); $("#replyText").value = body; return; }
  await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", openId);
  if (!thread.some(m => m.id === data.id)) thread.push(data);
  drawThread(); loadConvs();
});

function startRealtime() {
  if (rt) return;
  rt = db.channel("admin-messages")
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
          if (!thread.some(x => x.id === m.id)) thread.push(m);
          drawThread();
          db.from("messages").update({ read: true }).eq("id", m.id).then(() => loadConvs());
        }
      } else if (openId === m.conversation_id && !thread.some(x => x.id === m.id)) { thread.push(m); drawThread(); }
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

})();
