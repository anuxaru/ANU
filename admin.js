(() => {
"use strict";

const db = supabase.createClient(window.ANU_CONFIG.url, window.ANU_CONFIG.key);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MEDIA_MARK = "/storage/v1/object/public/media/";

/* ---------- small helpers ---------- */
let toastT;
function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toastT); toastT = setTimeout(() => t.className = "", 3200);
}
function fail(e) { console.error(e); toast((e && e.message) || "Something went wrong", true); }
function show(id) { ["viewLogin", "viewClaim", "viewApp"].forEach(v => $("#" + v).hidden = v !== id); }
function cleanUrl(u) {
  u = (u || "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "mailto:" + u;
  return "https://" + u;
}
function publicUrl(path) { return db.storage.from("media").getPublicUrl(path).data.publicUrl; }
function imgSize(url) {
  return new Promise(res => {
    const i = new Image();
    const t = setTimeout(() => res({}), 6000);
    i.onload = () => { clearTimeout(t); res({ w: i.naturalWidth, h: i.naturalHeight }); };
    i.onerror = () => { clearTimeout(t); res({}); };
    i.src = url;
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
  } catch (e) { /* fall back to the original file */ }
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
$$("[data-logout]").forEach(b => b.addEventListener("click", () => db.auth.signOut()));

let booted = false;
async function route(session) {
  if (!session) { booted = false; show("viewLogin"); return; }
  const { data, error } = await db.rpc("is_admin");
  if (error) { fail(error); show("viewLogin"); return; }
  if (data) { show("viewApp"); if (!booted) { booted = true; loadAll(); } }
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
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  $$("#tabs button").forEach(x => x.classList.toggle("on", x === b));
  $$(".tabpane").forEach(p => p.hidden = p.id !== "tab-" + b.dataset.tab);
  scrollTo({ top: 0 });
});

function loadAll() { loadPhotos(); loadPosts(); loadSocials(); }

/* ---------- PHOTOS ---------- */
let photos = [];
async function loadPhotos() {
  const { data, error } = await db.from("photos").select("*").order("sort");
  if (error) return fail(error);
  photos = data; renderPhotos();
}
function renderPhotos() {
  $("#countPhotos").textContent = photos.length;
  ["gallery", "collage"].forEach(sec => {
    const list = photos.filter(p => p.section === sec);
    const g = $(sec === "gallery" ? "#gridGallery" : "#gridCollage");
    g.innerHTML = list.length ? "" : `<div class="empty">No photos here yet</div>`;
    list.forEach((p, i) => {
      const d = document.createElement("div"); d.className = "ph";
      d.innerHTML = `<img src="${esc(p.url)}" alt="" loading="lazy">
        <div class="ph-body"><input type="text" value="${esc(p.caption)}" placeholder="Add a caption" aria-label="Caption" maxlength="140">
        <div class="ph-actions">
          <button class="ic" data-a="left" aria-label="Move earlier" ${i === 0 ? "disabled" : ""}>◀</button>
          <button class="ic" data-a="right" aria-label="Move later" ${i === list.length - 1 ? "disabled" : ""}>▶</button>
          <button class="ic del" data-a="del" aria-label="Delete photo">🗑</button></div></div>`;
      const inp = $("input", d);
      inp.addEventListener("change", async () => {
        const { error } = await db.from("photos").update({ caption: inp.value.trim() }).eq("id", p.id);
        error ? fail(error) : (p.caption = inp.value.trim(), toast("Caption saved ♡"));
      });
      d.addEventListener("click", e => {
        const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
        if (a === "del") delPhoto(p); else movePhoto(list, i, a === "left" ? -1 : 1);
      });
      g.append(d);
    });
  });
}
async function movePhoto(list, i, d) {
  const j = i + d; if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const jobs = [];
  list.forEach((p, k) => { if (p.sort !== k + 1) { p.sort = k + 1; jobs.push(db.from("photos").update({ sort: k + 1 }).eq("id", p.id)); } });
  photos.sort((a, b) => a.sort - b.sort); renderPhotos();
  const rs = await Promise.all(jobs); const bad = rs.find(r => r.error); if (bad) fail(bad.error);
}
async function delPhoto(p) {
  if (!confirm("Delete this photo? This cannot be undone.")) return;
  const { error } = await db.from("photos").delete().eq("id", p.id);
  if (error) return fail(error);
  try { await removeStored(p.url); } catch (e) { /* file already gone */ }
  photos = photos.filter(x => x.id !== p.id); renderPhotos(); toast("Photo deleted");
}
function nextSort(sec) { return Math.max(0, ...photos.filter(p => p.section === sec).map(p => p.sort)) + 1; }

$("#pickBtn").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", e => addFiles([...e.target.files]).then(() => e.target.value = ""));
const drop = $("#drop");
["dragenter", "dragover"].forEach(v => drop.addEventListener(v, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(v => drop.addEventListener(v, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => addFiles([...e.dataTransfer.files].filter(f => f.type.startsWith("image/"))));

async function addFiles(files) {
  if (!files.length) return;
  const sec = $("#photoSection").value, bar = $("#progressBar");
  $("#progress").hidden = false; bar.style.width = "3%";
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      const up = await uploadFile(files[i]);
      const size = up.w ? up : { ...up, ...(await imgSize(up.url)) };
      const { data, error } = await db.from("photos").insert({
        section: sec, url: up.url, caption: "", width: size.w || null, height: size.h || null, sort: nextSort(sec)
      }).select().single();
      if (error) throw error;
      photos.push(data); ok++;
    } catch (e) { fail(e); }
    bar.style.width = Math.round((i + 1) / files.length * 100) + "%";
  }
  renderPhotos();
  setTimeout(() => $("#progress").hidden = true, 600);
  if (ok) toast(ok + (ok > 1 ? " photos added ♡" : " photo added ♡"));
}
$("#linkAdd").addEventListener("click", async () => {
  const url = cleanUrl($("#linkUrl").value); if (!url) return toast("Paste an image link first", true);
  const sec = $("#photoSection").value, btn = $("#linkAdd"); btn.disabled = true;
  const size = await imgSize(url);
  if (!size.w) { btn.disabled = false; return toast("That link did not load as an image", true); }
  const { data, error } = await db.from("photos").insert({
    section: sec, url, caption: $("#linkCap").value.trim(), width: size.w, height: size.h, sort: nextSort(sec)
  }).select().single();
  btn.disabled = false;
  if (error) return fail(error);
  photos.push(data); renderPhotos(); $("#linkUrl").value = ""; $("#linkCap").value = ""; toast("Photo added ♡");
});

/* ---------- BLOG ---------- */
let posts = [], editing = null;
async function loadPosts() {
  const { data, error } = await db.from("posts").select("*").order("created_at", { ascending: false });
  if (error) return fail(error);
  posts = data; renderPosts();
}
function renderPosts() {
  $("#countPosts").textContent = posts.length;
  const box = $("#postList");
  box.innerHTML = posts.length ? "" : `<div class="empty">No posts yet. Write your first one above.</div>`;
  posts.forEach(p => {
    const d = document.createElement("div"); d.className = "item";
    d.innerHTML = `<div class="thumb" style="${p.cover_url ? `background-image:url('${esc(p.cover_url)}')` : ""}"></div>
      <div class="info"><b>${esc(p.title)}${p.published ? "" : `<span class="tag">hidden</span>`}${p.link_url ? `<span class="tag">link</span>` : ""}</b>
      <span>${new Date(p.created_at).toLocaleDateString()}</span></div>
      <button class="ic" data-a="edit" aria-label="Edit post">✏️</button>
      <button class="ic del" data-a="del" aria-label="Delete post">🗑</button>`;
    d.addEventListener("click", e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "edit") editPost(p); if (a === "del") delPost(p);
    });
    box.append(d);
  });
}
function coverPreview() {
  const u = cleanUrl($("#pCoverUrl").value), el = $("#coverPrev");
  el.style.backgroundImage = u ? `url("${u.replace(/"/g, "%22")}")` : "";
  el.textContent = u ? "" : "No cover image";
}
$("#pCoverUrl").addEventListener("input", coverPreview);
$("#pCoverPick").addEventListener("click", () => $("#pCoverFile").click());
$("#pCoverFile").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  const b = $("#pCoverPick"); b.disabled = true; b.textContent = "Uploading…";
  try { const up = await uploadFile(f); $("#pCoverUrl").value = up.url; coverPreview(); toast("Cover uploaded ♡"); }
  catch (err) { fail(err); }
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
  $("#pCoverUrl").value = p.cover_url || ""; $("#pLink").value = p.link_url || ""; $("#pPublished").checked = p.published;
  coverPreview();
  $("#postFormTitle").textContent = "Edit post"; $("#postCancel").hidden = false; $("#postSave").textContent = "Update post";
  $("#postForm").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#postCancel").addEventListener("click", resetPost);
$("#postSave").addEventListener("click", async () => {
  const title = $("#pTitle").value.trim();
  if (!title) return toast("Please add a title", true);
  const row = {
    title, excerpt: $("#pExcerpt").value.trim(), body: $("#pBody").value.trim(),
    cover_url: cleanUrl($("#pCoverUrl").value) || null, link_url: cleanUrl($("#pLink").value) || null,
    published: $("#pPublished").checked
  };
  if (!row.body && !row.link_url) return toast("Add a story, a link, or both", true);
  const btn = $("#postSave"); btn.disabled = true;
  const { error } = editing ? await db.from("posts").update(row).eq("id", editing) : await db.from("posts").insert(row);
  btn.disabled = false;
  if (error) return fail(error);
  toast(editing ? "Post updated ♡" : "Post published ♡"); resetPost(); loadPosts();
});
async function delPost(p) {
  if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
  const { error } = await db.from("posts").delete().eq("id", p.id);
  if (error) return fail(error);
  try { await removeStored(p.cover_url); } catch (e) { /* ignore */ }
  if (editing === p.id) resetPost();
  posts = posts.filter(x => x.id !== p.id); renderPosts(); toast("Post deleted");
}

/* ---------- SOCIAL ---------- */
const PLATFORMS = [
  ["instagram", "Instagram", "📸", "https://instagram.com/yourname"],
  ["facebook", "Facebook", "👍", "https://facebook.com/yourname"],
  ["whatsapp", "WhatsApp", "💬", "https://wa.me/8801XXXXXXXXX"],
  ["tiktok", "TikTok", "🎵", "https://tiktok.com/@yourname"],
  ["youtube", "YouTube", "▶️", "https://youtube.com/@yourname"],
  ["x", "X (Twitter)", "🐦", "https://x.com/yourname"],
  ["snapchat", "Snapchat", "👻", "https://snapchat.com/add/yourname"],
  ["telegram", "Telegram", "✈️", "https://t.me/yourname"],
  ["pinterest", "Pinterest", "📌", "https://pinterest.com/yourname"],
  ["linkedin", "LinkedIn", "💼", "https://linkedin.com/in/yourname"],
  ["spotify", "Spotify", "🎧", "https://open.spotify.com/user/..."],
  ["email", "Email", "✉️", "you@example.com"]
];
let socials = [];
async function loadSocials() {
  const { data, error } = await db.from("socials").select("*").order("sort");
  if (error) return fail(error);
  socials = data; renderSocials();
}
function renderSocials() {
  const g = $("#socialGrid"); g.innerHTML = "";
  PLATFORMS.forEach(([key, name, icon, ph]) => {
    const row = socials.find(s => s.platform === key);
    const d = document.createElement("div"); d.className = "soc";
    d.innerHTML = `<i>${icon}</i><label>${esc(name)}<input type="text" data-key="${key}" value="${esc(row ? row.url.replace(/^mailto:/, "") : "")}" placeholder="${esc(ph)}" inputmode="url" autocapitalize="off" autocomplete="off"></label>`;
    g.append(d);
  });
  const box = $("#customList"); box.innerHTML = "";
  socials.filter(s => s.platform === "custom").forEach(s => addCustomRow(s.label, s.url));
}
function addCustomRow(label = "", url = "") {
  const d = document.createElement("div"); d.className = "item";
  d.innerHTML = `<div class="cust grow"><input type="text" class="cl" placeholder="Name (e.g. My shop)" value="${esc(label)}" maxlength="30">
    <input type="text" class="cu" placeholder="https://..." value="${esc(url)}" inputmode="url" autocapitalize="off"></div>
    <button class="ic del" aria-label="Remove link" type="button">✕</button>`;
  $(".ic", d).addEventListener("click", () => d.remove());
  $("#customList").append(d);
}
$("#customAdd").addEventListener("click", () => addCustomRow());
$("#socialSave").addEventListener("click", async () => {
  const btn = $("#socialSave"); btn.disabled = true;
  try {
    const rows = []; let n = 0;
    $$("#socialGrid input").forEach(i => {
      const url = cleanUrl(i.value); if (!url) return;
      rows.push({ platform: i.dataset.key, label: "", url, sort: n++ });
    });
    $$("#customList .item").forEach(d => {
      const url = cleanUrl($(".cu", d).value), label = $(".cl", d).value.trim();
      if (url) rows.push({ platform: "custom", label: label || "Link", url, sort: n++ });
    });
    // replace the whole list (small table, simplest and always consistent)
    const del = await db.from("socials").delete().not("id", "is", null);
    if (del.error) throw del.error;
    if (rows.length) { const ins = await db.from("socials").insert(rows); if (ins.error) throw ins.error; }
    toast("Social links saved ♡"); loadSocials();
  } catch (e) { fail(e); }
  btn.disabled = false;
});

})();
