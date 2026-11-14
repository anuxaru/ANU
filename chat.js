/* Live chat bubble for visitors.
   Everything goes through safe database functions (chat_send / chat_poll / chat_typing / chat_react),
   so a visitor can only ever see their own conversation. */
(() => {
"use strict";

function start(ctx) {
  const CFG = window.ANU_CONFIG, I = window.ANU_ICONS, store = ctx.store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wrap = $("#chat");
  if (!wrap || !CFG || !I || ctx.SECTIONS.chat === false) return;
  wrap.hidden = false;
  $("#chatIco").style.setProperty("--i", 'url("' + I.url("chat") + '")');

  const fab = $("#chatFab"), panel = $("#chatPanel"), log = $("#chatLog"), form = $("#chatForm"), text = $("#chatText"),
        nameIn = $("#chatName"), note = $("#chatNote"), dot = $("#chatDot"), pop = $("#emoPop"), emoBtn = $("#chatEmo");

  let token = store.get("anu-chat-token");
  if (!token || token.length < 20) {
    token = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)) + Math.random().toString(36).slice(2, 12);
    store.set("anu-chat-token", token);
  }
  nameIn.value = store.get("anu-chat-name") || "";

  let msgs = [], adminTyping = false, open = false, seen = +(store.get("anu-chat-seen") || 0), timer = 0, busy = false, lastSig = "", lastPing = 0;
  let popMode = null, popMsg = null;

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

  /* ---------- drawing ---------- */
  function draw() {
    log.textContent = "";
    const hi = document.createElement("div"); hi.className = "cm them"; hi.textContent = "Hi! Write me a message here and I will reply as soon as I see it ♡"; log.append(hi);
    let lastSeenMine = null;
    msgs.forEach(m => { if (m.sender === "visitor" && m.read_at) lastSeenMine = m; });
    msgs.forEach(m => {
      const mine = m.sender === "visitor";
      const row = document.createElement("div"); row.className = "cm-row " + (mine ? "me" : "them");
      const b = document.createElement("div"); b.className = "cm " + (mine ? "me" : "them");
      b.tabIndex = 0; b.setAttribute("role", "button"); b.setAttribute("aria-label", "React to this message");
      b.textContent = m.body;
      const meta = document.createElement("small");
      meta.textContent = fmtT(m.created_at) + (m.edited_at ? " · edited" : "");
      b.append(meta);
      const react = () => openPop("react", m);
      b.addEventListener("click", react);
      b.addEventListener("keydown", e => { if (e.key === "Enter") react(); });
      row.append(b);
      if (m.reactions && m.reactions.length) {
        const rr = document.createElement("div"); rr.className = "reacts";
        m.reactions.forEach(x => {
          const c = document.createElement("button"); c.type = "button"; c.className = "rx" + (x.side === "visitor" ? " mine" : "");
          c.textContent = x.emoji; c.setAttribute("aria-label", "Reaction " + x.emoji); c.addEventListener("click", react); rr.append(c);
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
    log.scrollTop = log.scrollHeight;
  }
  const adminCount = () => msgs.filter(m => m.sender === "admin").length;
  function updateDot() {
    const n = adminCount() - seen;
    dot.hidden = open || n <= 0; dot.textContent = n > 9 ? "9+" : String(n);
  }
  setInterval(() => $$(".seen", log).forEach(e => { e.textContent = "Seen " + ago(e.dataset.t); }), 15000);

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
      if (sig !== lastSig) { lastSig = sig; if (open) draw(); }
      updateDot();
    } catch (e) { /* offline: try again later */ }
    busy = false;
  }
  function schedule() {
    clearTimeout(timer);
    if (!document.hidden && (open || msgs.length)) timer = setTimeout(async () => { await pull(); schedule(); }, open ? 1500 : 10000);
  }
  function setOpen(v) {
    open = v; panel.hidden = !v; fab.setAttribute("aria-expanded", String(v)); closePop();
    if (v) { seen = adminCount(); store.set("anu-chat-seen", String(seen)); draw(); updateDot(); pull(); text.focus(); }
    schedule();
  }
  fab.addEventListener("click", () => setOpen(!open));
  $("#chatClose").addEventListener("click", () => setOpen(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { pull(); schedule(); } });

  /* ---------- typing ping ---------- */
  text.addEventListener("input", () => {
    if (!text.value.trim()) return;
    const now = Date.now();
    if (now - lastPing > 2500) { lastPing = now; rpc("chat_typing", { p_token: token }).catch(() => {}); }
  });
  text.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  /* ---------- sending ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const body = text.value.trim(); if (!body) return;
    const nm = nameIn.value.trim(); store.set("anu-chat-name", nm);
    note.textContent = ""; text.value = ""; closePop();
    msgs.push({ id: "tmp" + Date.now(), sender: "visitor", body, created_at: new Date().toISOString(), reactions: [] }); draw();
    try { await rpc("chat_send", { p_token: token, p_name: nm, p_body: body }); note.textContent = ""; await pull(); schedule(); }
    catch (err) { note.textContent = err.message || "Could not send, please try again"; msgs.pop(); draw(); text.value = body; }
  });

  /* ---------- emoji: insert into the message, or react to a message ---------- */
  const EMOJIS = ["😀","😂","🥹","😍","🥰","😘","😊","😉","😎","🤩","🥳","😭","😢","😡","😴","🤔","🙄","😇","🤗","😋",
                  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💖","💕","💞","💘","✨","🌸","🌹","🔥","🎉","🎂","🎁","🎈",
                  "👍","👎","👏","🙌","🙏","💪","👌","✌️","🤞","👋","😅","🫶","💯","⭐","🌙","☀️"];
  const QUICK = ["❤️","😂","😍","👍","😮","😢"];
  const isEmoji = s => /\p{Extended_Pictographic}/u.test(s) && [...s].length <= 8;

  function openPop(mode, msg) {
    popMode = mode; popMsg = msg || null; pop.textContent = "";
    const h = document.createElement("p"); h.className = "emo-h"; h.textContent = mode === "react" ? "React with any emoji" : "Add an emoji"; pop.append(h);
    if (mode === "react") {
      const q = document.createElement("div"); q.className = "emo-quick";
      QUICK.forEach(e => q.append(emoButton(e))); pop.append(q);
    }
    const g = document.createElement("div"); g.className = "emo-grid";
    EMOJIS.forEach(e => g.append(emoButton(e))); pop.append(g);
    const r = document.createElement("div"); r.className = "emo-own";
    r.innerHTML = '<input type="text" placeholder="Or type / paste any emoji" maxlength="16" aria-label="Any emoji"><button type="button">Add</button>';
    const inp = $("input", r), go = $("button", r);
    const add = () => { const v = inp.value.trim(); if (!isEmoji(v)) { inp.value = ""; inp.placeholder = "That is not an emoji, try again"; return; } choose(v); };
    go.addEventListener("click", add); inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });
    pop.append(r);
    if (mode === "react" && msg && (msg.reactions || []).some(x => x.side === "visitor")) {
      const rm = document.createElement("button"); rm.type = "button"; rm.className = "emo-rm"; rm.textContent = "Remove my reaction";
      rm.addEventListener("click", () => choose("")); pop.append(rm);
    }
    pop.hidden = false;
  }
  function emoButton(e) { const b = document.createElement("button"); b.type = "button"; b.textContent = e; b.setAttribute("aria-label", e); b.addEventListener("click", () => choose(e)); return b; }
  function closePop() { pop.hidden = true; popMode = null; popMsg = null; }
  async function choose(emoji) {
    if (popMode === "insert") {
      const s = text.selectionStart ?? text.value.length, en = text.selectionEnd ?? s;
      text.value = text.value.slice(0, s) + emoji + text.value.slice(en);
      text.focus(); text.selectionStart = text.selectionEnd = s + emoji.length; closePop(); return;
    }
    if (popMode === "react" && popMsg && !String(popMsg.id).startsWith("tmp")) {
      const m = popMsg; closePop();
      m.reactions = (m.reactions || []).filter(x => x.side !== "visitor");
      if (emoji) m.reactions.push({ side: "visitor", emoji });
      draw();
      try { await rpc("chat_react", { p_token: token, p_message_id: m.id, p_emoji: emoji }); pull(); }
      catch (err) { note.textContent = err.message || "Could not react"; pull(); }
    }
  }
  emoBtn.addEventListener("click", () => { pop.hidden ? openPop("insert") : closePop(); });
  document.addEventListener("pointerdown", e => { if (!pop.hidden && !e.target.closest("#emoPop, #chatEmo, .cm, .rx")) closePop(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!pop.hidden) { closePop(); return; }
    const lb = document.getElementById("lb");
    if (open && (!lb || lb.hidden)) setOpen(false);
  });

  pull().then(schedule);
}

if (window.ANU_READY) start(window.ANU_READY);
else document.addEventListener("anu-ready", () => start(window.ANU_READY), { once: true });
})();
