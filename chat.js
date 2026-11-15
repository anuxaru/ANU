/* Live chat bubble for visitors.
   Everything goes through safe database functions (chat_send / chat_poll / chat_typing / chat_react / chat_edit),
   so a visitor can only ever see and change their own conversation.
   Emojis come from the phone's / computer's own emoji keyboard. */
(() => {
"use strict";

function start(ctx) {
  const CFG = window.ANU_CONFIG, store = ctx.store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wrap = $("#chat");
  if (!wrap || !CFG || ctx.SECTIONS.chat === false) return;
  wrap.hidden = false;

  const fab = $("#chatFab"), panel = $("#chatPanel"), log = $("#chatLog"), form = $("#chatForm"), text = $("#chatText"),
        nameIn = $("#chatName"), note = $("#chatNote"), dot = $("#chatDot"), menu = $("#emoPop");

  let token = store.get("anu-chat-token");
  if (!token || token.length < 20) {
    token = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)) + Math.random().toString(36).slice(2, 12);
    store.set("anu-chat-token", token);
  }
  nameIn.value = store.get("anu-chat-name") || "";

  let msgs = [], adminTyping = false, open = false, seen = +(store.get("anu-chat-seen") || 0), timer = 0, busy = false, lastSig = "", lastPing = 0;
  let editingId = null, menuMsg = null;

  const rpc = (fn, body) => fetch(CFG.url + "/rest/v1/rpc/" + fn, {
    method: "POST", headers: { apikey: CFG.key, Authorization: "Bearer " + CFG.key, "Content-Type": "application/json" }, body: JSON.stringify(body)
  }).then(async r => {
    if (!r.ok) { let m = ""; try { m = (await r.json()).message; } catch (e) { /* ignore */ } throw new Error(m || "Could not reach chat"); }
    return r.status === 204 ? null : r.json();
  });

  const fmtT = d => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function ago(d) {
    const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
    if (s < 45) return "just now";
    if (s < 90) return "1 min ago";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + (Math.round(s / 3600) === 1 ? " hour ago" : " hours ago");
    return new Date(d).toLocaleDateString();
  }
  const isTemp = m => String(m.id).startsWith("tmp");

  /* ---------- drawing ---------- */
  function draw() {
    log.textContent = "";
    const hi = document.createElement("div"); hi.className = "cm them"; hi.textContent = "Hi! Write me a message here and I will reply as soon as I see it ♡"; log.append(hi);
    let lastSeenMine = null;
    msgs.forEach(m => { if (m.sender === "visitor" && m.read_at) lastSeenMine = m; });
    msgs.forEach(m => {
      const mine = m.sender === "visitor";
      const row = document.createElement("div"); row.className = "cm-row " + (mine ? "me" : "them"); row.dataset.id = m.id;
      if (editingId === m.id) { row.append(editBox(m)); log.append(row); return; }
      const b = document.createElement("div"); b.className = "cm " + (mine ? "me" : "them");
      b.tabIndex = 0; b.setAttribute("role", "button"); b.setAttribute("aria-label", "Message options");
      b.textContent = m.body;
      const meta = document.createElement("small");
      meta.textContent = fmtT(m.created_at) + (m.edited_at ? " · edited" : "");
      b.append(meta);
      const pick = () => { if (!isTemp(m)) openMenu(m, b); };
      b.addEventListener("click", pick);
      b.addEventListener("keydown", e => { if (e.key === "Enter") pick(); });
      row.append(b);
      if (m.reactions && m.reactions.length) {
        const rr = document.createElement("div"); rr.className = "reacts";
        m.reactions.forEach(x => {
          const c = document.createElement("button"); c.type = "button"; c.className = "rx" + (x.side === "visitor" ? " mine" : "");
          c.textContent = x.emoji; c.setAttribute("aria-label", "Reaction " + x.emoji); c.addEventListener("click", pick); rr.append(c);
        });
        row.append(rr);
      }
      if (lastSeenMine && m.id === lastSeenMine.id) {
        const s = document.createElement("div"); s.className = "seen"; s.dataset.t = m.read_at; s.textContent = "Seen " + ago(m.read_at); row.append(s);
      }
      log.append(row);
    });
    if (adminTyping) {
      const t = document.createElement("div"); t.className = "cm them typing"; t.setAttribute("aria-label", "typing");
      t.innerHTML = "<i></i><i></i><i></i>"; log.append(t);
    }
    if (editingId === null) log.scrollTop = log.scrollHeight;
  }
  const adminCount = () => msgs.filter(m => m.sender === "admin").length;
  function updateDot() {
    const n = adminCount() - seen;
    dot.hidden = open || n <= 0; dot.textContent = n > 9 ? "9+" : String(n);
  }
  setInterval(() => $$(".seen", log).forEach(e => { e.textContent = "Seen " + ago(e.dataset.t); }), 15000);

  /* ---------- editing a message (like Messenger: the bubble turns into a text box) ---------- */
  function editBox(m) {
    const box = document.createElement("div"); box.className = "edit-box";
    box.innerHTML = '<p class="edit-h">Edit message</p><textarea rows="2" maxlength="1000" aria-label="Edit your message"></textarea>' +
                    '<div class="edit-row"><button type="button" class="eb-cancel">Cancel</button><button type="button" class="eb-save">Save</button></div>';
    const ta = $("textarea", box); ta.value = m.body;
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; };
    ta.addEventListener("input", grow);
    const cancel = () => { editingId = null; draw(); };
    const save = async () => {
      const body = ta.value.trim();
      if (!body) { ta.focus(); return; }
      if (body === m.body) { cancel(); return; }
      const old = m.body; m.body = body; m.edited_at = new Date().toISOString(); editingId = null; draw();
      try { await rpc("chat_edit", { p_token: token, p_message_id: m.id, p_body: body }); note.textContent = ""; pull(); }
      catch (err) { m.body = old; note.textContent = err.message || "Could not edit"; draw(); }
    };
    $(".eb-cancel", box).addEventListener("click", cancel); $(".eb-save", box).addEventListener("click", save);
    ta.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); cancel(); } else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } });
    setTimeout(() => { grow(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
    return box;
  }

  /* ---------- tap a message: react with a quick emoji or ANY emoji from your keyboard, edit, copy ---------- */
  const QUICK = ["❤️","😂","😍","👍","😮","😢"];
  const isEmoji = s => /\p{Extended_Pictographic}/u.test(s) && [...s].length <= 8;
  const myReaction = m => ((m.reactions || []).find(x => x.side === "visitor") || {}).emoji || "";

  function openMenu(m, anchor) {
    closeMenu(); menuMsg = m; menu.textContent = "";
    const q = document.createElement("div"); q.className = "mm-quick";
    QUICK.forEach(e => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = e; b.setAttribute("aria-label", "React " + e);
      if (myReaction(m) === e) b.classList.add("on");
      b.addEventListener("click", () => react(m, e)); q.append(b);
    });
    const plus = document.createElement("button"); plus.type = "button"; plus.className = "mm-plus"; plus.textContent = "+"; plus.setAttribute("aria-label", "More emojis from your keyboard");
    q.append(plus); menu.append(q);

    const own = document.createElement("div"); own.className = "mm-own"; own.hidden = true;
    own.innerHTML = '<input type="text" inputmode="text" placeholder="Open your emoji keyboard 😊" maxlength="16" aria-label="Type any emoji" autocomplete="off"><button type="button">React</button>';
    const inp = $("input", own), go = $("button", own);
    const add = () => { const v = inp.value.trim(); if (!isEmoji(v)) { inp.value = ""; inp.placeholder = "Please pick an emoji 😊"; inp.focus(); return; } react(m, v); };
    go.addEventListener("click", add);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });
    const oneSymbol = s => (window.Intl && Intl.Segmenter) ? [...new Intl.Segmenter().segment(s)].length === 1 : [...s].length === 1;
    inp.addEventListener("input", () => { const v = inp.value.trim(); if (v && isEmoji(v) && oneSymbol(v)) add(); });   // one emoji picked from the keyboard: done
    menu.append(own);
    plus.addEventListener("click", () => { own.hidden = !own.hidden; if (!own.hidden) { inp.focus(); placeMenu(anchor); } });

    const acts = document.createElement("div"); acts.className = "mm-acts";
    if (m.sender === "visitor") {
      const ed = document.createElement("button"); ed.type = "button"; ed.textContent = "✏️  Edit"; ed.addEventListener("click", () => { closeMenu(); editingId = m.id; draw(); });
      acts.append(ed);
    }
    const cp = document.createElement("button"); cp.type = "button"; cp.textContent = "📋  Copy";
    cp.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(m.body); note.textContent = "Copied"; } catch (e) { note.textContent = "Could not copy"; }
      closeMenu(); setTimeout(() => { if (note.textContent === "Copied") note.textContent = ""; }, 1500);
    });
    acts.append(cp); menu.append(acts);
    menu._anchor = anchor; menu.hidden = false; placeMenu(anchor);
  }
  function placeMenu(anchor) {
    const c = panel.getBoundingClientRect(), a = anchor.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    let top = a.top - c.top - mh - 8;
    if (top < 58) top = a.bottom - c.top + 8;
    top = Math.max(58, Math.min(top, c.height - mh - 120));
    let left = a.left - c.left + (a.width - mw) / 2;
    left = Math.max(8, Math.min(c.width - mw - 8, left));
    menu.style.top = top + "px"; menu.style.left = left + "px";
  }
  function closeMenu() { menu.hidden = true; menu.textContent = ""; menuMsg = null; }
  async function react(m, emoji) {
    closeMenu();
    const had = myReaction(m);
    const next = had === emoji ? "" : emoji;                       // tap the same one again to remove it
    m.reactions = (m.reactions || []).filter(x => x.side !== "visitor");
    if (next) m.reactions.push({ side: "visitor", emoji: next });
    draw();
    try { await rpc("chat_react", { p_token: token, p_message_id: m.id, p_emoji: next }); pull(); }
    catch (err) { note.textContent = err.message || "Could not react"; pull(); }
  }
  document.addEventListener("pointerdown", e => { if (!menu.hidden && !e.target.closest("#emoPop, .cm, .rx")) closeMenu(); });
  log.addEventListener("scroll", () => { if (!menu.hidden && menu._anchor && menu._anchor.isConnected) placeMenu(menu._anchor); else if (!menu.hidden) closeMenu(); }, { passive: true });

  /* ---------- talking to the database ---------- */
  async function pull() {
    if (busy) return; busy = true;
    try {
      const r = await rpc("chat_poll", { p_token: token, p_open: open });
      const rows = (r && r.messages) || [];
      const typing = !!(r && r.admin_typing);
      const sig = JSON.stringify(rows) + "|" + typing;
      msgs = rows; adminTyping = typing;
      if (open) { seen = adminCount(); store.set("anu-chat-seen", String(seen)); }
      if (sig !== lastSig) { lastSig = sig; if (open && editingId === null && menu.hidden) draw(); }
      updateDot();
    } catch (e) { /* offline: try again later */ }
    busy = false;
  }
  function schedule() {
    clearTimeout(timer);
    if (!document.hidden && (open || msgs.length)) timer = setTimeout(async () => { await pull(); schedule(); }, open ? 1500 : 10000);
  }
  function setOpen(v) {
    open = v; panel.hidden = !v; fab.setAttribute("aria-expanded", String(v)); closeMenu(); editingId = null;
    if (v) { seen = adminCount(); store.set("anu-chat-seen", String(seen)); draw(); updateDot(); pull(); text.focus(); }
    schedule();
  }
  fab.addEventListener("click", () => setOpen(!open));
  $("#chatClose").addEventListener("click", () => setOpen(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { pull(); schedule(); } });

  /* ---------- typing ping + sending ---------- */
  text.addEventListener("input", () => {
    if (!text.value.trim()) return;
    const now = Date.now();
    if (now - lastPing > 2500) { lastPing = now; rpc("chat_typing", { p_token: token }).catch(() => {}); }
  });
  text.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const body = text.value.trim(); if (!body) return;
    const nm = nameIn.value.trim(); store.set("anu-chat-name", nm);
    note.textContent = ""; text.value = ""; closeMenu();
    msgs.push({ id: "tmp" + Date.now(), sender: "visitor", body, created_at: new Date().toISOString(), reactions: [] }); draw();
    try { await rpc("chat_send", { p_token: token, p_name: nm, p_body: body }); note.textContent = ""; await pull(); schedule(); }
    catch (err) { note.textContent = err.message || "Could not send, please try again"; msgs.pop(); draw(); text.value = body; }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!menu.hidden) { closeMenu(); return; }
    const lb = document.getElementById("lb");
    if (open && editingId === null && (!lb || lb.hidden)) setOpen(false);
  });

  pull().then(schedule);
}

if (window.ANU_READY) start(window.ANU_READY);
else document.addEventListener("anu-ready", () => start(window.ANU_READY), { once: true });
})();
