(async () => {
"use strict";

/* ================= DATA (fallback photos, used if the database is unreachable) ================= */
let P = [
  ["p11.jpg",240,486,"In blue, like my favourite sky"],
  ["p06.jpg",388,600,"A bride I'll never stop dreaming of"],
  ["p02.jpg",312,408,"Pink saree, golden smile"],
  ["p07.jpg",252,600,"That red lipstick"],
  ["p14.jpg",640,250,"Boat rides & red silk"],
  ["p01.jpg",250,390,"Glasses on, heart off"],
  ["p05.jpg",330,495,"Sunshine in yellow"],
  ["p15.jpg",243,300,"Green and gold, all grace"],
  ["p08.jpg",253,476,"Soft eyes, softer heart"],
  ["p04.jpg",565,312,"The eyes I get lost in"],
  ["p12.jpg",226,350,"My favourite little smile"],
  ["p16.jpg",202,262,"Blue silk afternoon"],
  ["p03.jpg",333,294,"Dark lips, bright soul"],
  ["p17.jpg",640,272,"Three times as lovely"],
  ["p13.jpg",224,276,"Golden hour girl"],
  ["p19.jpg",202,335,"Queen in red"],
  ["p18.jpg",210,340,"Selfie with a secret"],
  ["p10.jpg",230,309,"Moonlight face"],
  ["p20.jpg",228,300,"Looking at you, always"],
  ["p09.jpg",228,276,"Peach & poetry"]
].map(([f,w,h,c]) => ({src:"img/"+f, w, h, cap:c}));

let COLLAGES = [
  {src:"img/bg.jpg",w:900,h:1599,cap:"Anamika: cutie collage"},
  {src:"img/anu-1.jpg",w:640,h:911,cap:"Happy Birthday, Dear Anu"},
  {src:"img/anu-4.jpg",w:640,h:1137,cap:"Every shade of you"},
  {src:"img/anu-2.jpg",w:640,h:936,cap:"Memories, part one"},
  {src:"img/anu-3.jpg",w:640,h:999,cap:"Memories, part two"},
  {src:"img/anu-5.jpg",w:640,h:1137,cap:"Memories, part three"},
  {src:"img/anu-6.jpg",w:640,h:1137,cap:"Memories, part four"}
];

const REASONS = [
  ["Smile like sunshine","One smile from you and every bad day turns into a good one.","p12.jpg"],
  ["Sweeter than cake","Even the birthday cake gets jealous of how sweet you are.","p02.jpg"],
  ["Always reliable","You are the person I can trust with every secret.","p11.jpg"],
  ["Super smart","Full of ideas, full of talent, full of magic.","p01.jpg"],
  ["Fun mode: ON","Wherever you are, there's laughter. No exceptions.","p05.jpg"],
  ["Heart of gold","Kind, caring, and loved by everyone around you.","p06.jpg"]
];

const LINES = [
  "Are you WiFi? Because I'm feeling a strong connection with you, Anu.",
  "Anu, are you a birthday cake? Because you make everything sweeter.",
  "Is your name Google? Because you have everything I've been searching for.",
  "Do you have a map? I got lost in your smile.",
  "Are you a charger? Because you give me energy every single day.",
  "Anu, you must be made of chocolate, because you're impossible to resist.",
  "If cuteness was a crime, Anu, you'd be in jail for life.",
  "Are you a star? Because even in the dark, you light up my world.",
  "Anu, you're the 9th of January of my heart: the most special day.",
  "Is it your birthday, or did the sun just come out for you?"
];

/* ================= LIVE DATA (Supabase) =================
   Photos, collages, blog posts and social links come from the admin panel.
   If the database cannot be reached, the built-in photos above are used. */
let POSTS = [], SOCIALS = [];
try {
  const C = window.ANU_CONFIG;
  if (C) {
    const get = t => fetch(C.url + "/rest/v1/" + t, {headers:{apikey:C.key, Authorization:"Bearer " + C.key}, signal:AbortSignal.timeout(4000)})
      .then(r => r.ok ? r.json() : Promise.reject(r.status));
    const [ph, po, so] = await Promise.all([
      get("photos?select=*&order=sort"),
      get("posts?select=*&published=eq.true&order=created_at.desc"),
      get("socials?select=*&order=sort")
    ]);
    const mapP = r => ({src:r.url, w:r.width || 300, h:r.height || 400, cap:r.caption || ""});
    const g = ph.filter(r => r.section === "gallery").map(mapP), c = ph.filter(r => r.section === "collage").map(mapP);
    if (g.length) P = g;
    if (ph.length) COLLAGES = c;
    POSTS = po; SOCIALS = so;
  }
} catch (e) { console.warn("Using built-in photos:", e); }

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};

/* ================= THEME ================= */
const root = document.documentElement;
const savedTheme = store.get("anu-theme");
if (savedTheme) root.dataset.theme = savedTheme;
$("#themeBtn").addEventListener("click", () => {
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  store.set("anu-theme", root.dataset.theme);
});

/* ================= GATE ================= */
const gate = $("#gate");
document.body.classList.add("locked");
function openGate(){
  const env = $("#openGate");
  if (env.classList.contains("open")) return;
  env.classList.add("open");
  setTimeout(() => { gate.classList.add("gone"); document.body.classList.remove("locked"); confetti(26); }, RM ? 50 : 1300);
  setTimeout(() => gate.remove(), 2400);
}
$("#openGate").addEventListener("click", openGate);
gate.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openGate(); });
$("#openGate").focus();

/* ================= HELPERS ================= */
function tile(p, i, list, extra=""){
  const f = document.createElement("figure");
  f.className = "tile " + extra;
  f.tabIndex = 0;
  f.setAttribute("role","button");
  f.setAttribute("aria-label", "Open photo: " + p.cap);
  f.style.setProperty("--ar", p.w + "/" + p.h);
  f.innerHTML = `<img src="${p.src}" alt="${p.cap}" width="${p.w}" height="${p.h}" loading="lazy" decoding="async"><figcaption class="cap">${p.cap}</figcaption>`;
  f.dataset.i = i;
  f._list = list;
  return f;
}

let io;
function observe(nodes){
  if (RM || !("IntersectionObserver" in window)) return;
  io = io || new IntersectionObserver(es => es.forEach(x => {
    if (x.isIntersecting){ x.target.classList.add("in"); io.unobserve(x.target); }
  }), {threshold:.08, rootMargin:"0px 0px -5% 0px"});
  nodes.forEach((n,k) => { n.classList.add("reveal"); n.style.transitionDelay = (k % 6) * 60 + "ms"; io.observe(n); });
}

/* ================= MARQUEE ================= */
(() => {
  const words = ["you", "my favourite view", "always", "Anu"];
  const pick = [P[0],P[2],P[5],P[9],P[6],P[13],P[3],P[11]];
  let html = "";
  pick.forEach((p,k) => html += `<img src="${p.src}" alt="" loading="lazy" decoding="async" width="${p.w}" height="${p.h}"><span>${words[k%words.length]}</span>`);
  $("#mq").innerHTML = html + html;
})();

/* ================= GALLERY MODES ================= */
const stage = $("#stage"), coverNav = $("#coverNav");
let mode = store.get("anu-mode") || "masonry";
let coverIdx = 0;

const HEART = [
  ".XX...XX.",
  "XXXX.XXXX",
  "XXXXXXXXX",
  "XXXXXXXXX",
  ".XXXXXXX.",
  "..XXXXX..",
  "...XXX...",
  "....X...."
];

const renders = {
  masonry(){
    P.forEach((p,i) => stage.append(tile(p,i,P)));
  },
  polaroid(){
    P.forEach((p,i) => {
      const t = tile(p,i,P);
      t.style.setProperty("--rot", ((i*37)%11 - 5) + "deg");
      t.style.setProperty("--tape", ((i*53)%9 - 4) + "deg");
      stage.append(t);
    });
  },
  bento(){
    P.forEach((p,i) => {
      const r = p.h / p.w;
      let cls = r > 1.7 ? "tall" : r < .7 ? "wide" : "";
      if (i === 0 || i === 7) cls = "big";
      stage.append(tile(p,i,P,cls));
    });
  },
  film(){
    P.forEach((p,i) => stage.append(tile(p,i,P)));
  },
  heart(){
    let k = 0;
    HEART.join("").split("").forEach(c => {
      if (c === "X"){ const i = k++ % P.length; stage.append(tile(P[i], i, P)); }
      else { const b = document.createElement("div"); b.className = "blank"; stage.append(b); }
    });
  },
  cover(){
    P.forEach((p,i) => stage.append(tile(p,i,P)));
    layoutCover();
  }
};

function setMode(m){
  if (!renders[m]) m = "masonry";
  mode = m; store.set("anu-mode", m);
  $$("#switch button").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === m));
  stage.className = "stage m-" + m;
  stage.innerHTML = "";
  renders[m]();
  coverNav.hidden = m !== "cover";
  if (m !== "cover" && m !== "film" && m !== "heart") observe($$(".tile", stage));
  if (!RM){ stage.classList.remove("swap"); void stage.offsetWidth; stage.classList.add("swap"); }
}
$("#switch").addEventListener("click", e => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  setMode(b.dataset.mode);
  const sw = $("#switch"), sl = b.offsetLeft - (sw.clientWidth - b.offsetWidth) / 2;
  sw.scrollTo({left: sl, behavior: "smooth"});
  // keep the new layout in view when it is shorter than the previous one
  const top = stage.getBoundingClientRect().top - sw.getBoundingClientRect().bottom - 16;
  if (top < 0) scrollBy({top, behavior: RM ? "auto" : "smooth"});
});

/* 3D coverflow */
function layoutCover(){
  const tiles = $$(".tile", stage);
  const step = Math.min(220, innerWidth * .28);
  tiles.forEach((t,i) => {
    const d = i - coverIdx, a = Math.abs(d);
    t.style.setProperty("--x", (d === 0 ? 0 : Math.sign(d) * (step * .55 + a * step * .45)) + "px");
    t.style.setProperty("--z", (-a * 140) + "px");
    t.style.setProperty("--ry", (d === 0 ? 0 : d < 0 ? 42 : -42) + "deg");
    t.style.setProperty("--s", d === 0 ? 1 : .86);
    t.style.setProperty("--o", a > 4 ? 0 : 1);
    t.style.setProperty("--b", 1 - Math.min(a,4) * .14);
    t.style.setProperty("--zi", 100 - a);
    t.classList.toggle("active", d === 0);
    t.tabIndex = a > 4 ? -1 : 0;
  });
  $("#cCount").textContent = (coverIdx + 1) + " / " + P.length;
}
function coverGo(n){ coverIdx = (n + P.length) % P.length; layoutCover(); }
$("#cPrev").addEventListener("click", () => coverGo(coverIdx - 1));
$("#cNext").addEventListener("click", () => coverGo(coverIdx + 1));
swipe(stage, dir => { if (mode === "cover") coverGo(coverIdx + dir); });
let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => mode === "cover" && layoutCover(), 150); });

/* tile click → lightbox (or cover focus) */
function onTile(e){
  const t = e.target.closest(".tile"); if (!t) return;
  const i = +t.dataset.i;
  if (mode === "cover" && t.closest("#stage") && i !== coverIdx){ coverGo(i); return; }
  openLb(t._list, i);
}
document.addEventListener("click", e => { if (stage._dragged){ stage._dragged = false; return; } onTile(e); });
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("tile")){ e.preventDefault(); onTile(e); }
  if (lb.hidden && mode === "cover" && stage.contains(document.activeElement)){
    if (e.key === "ArrowLeft") coverGo(coverIdx - 1);
    if (e.key === "ArrowRight") coverGo(coverIdx + 1);
  }
});

/* ================= COLLAGES ================= */
const cWrap = $("#collages");
COLLAGES.forEach((p,i) => cWrap.append(tile(p,i,COLLAGES)));
observe($$(".tile", cWrap));

/* ================= REASONS ================= */
const rg = $("#reasonGrid");
REASONS.forEach(([h,t,img],i) => {
  const b = document.createElement("button");
  b.className = "flip";
  b.setAttribute("aria-label", h + ": flip card");
  b.innerHTML = `<div class="flip-in">
    <div class="face front"><img src="img/${img}" alt="" loading="lazy" decoding="async"><h3><small>reason ${i+1}</small>${h}</h3></div>
    <div class="face back"><span class="num">${i+1}</span><p>${t}</p></div></div>`;
  b.addEventListener("click", () => { b.classList.toggle("on"); if (b.classList.contains("on")) burstAt(b); });
  rg.append(b);
});
observe($$(".flip", rg));

/* ================= LINES ================= */
let li = -1;
$("#lineBtn").addEventListener("click", e => {
  let n; do n = Math.floor(Math.random() * LINES.length); while (n === li);
  li = n; const el = $("#line");
  el.textContent = "“" + LINES[n] + "”";
  el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  burstAt(e.currentTarget);
});

/* ================= COUNTDOWN ================= */
function tick(){
  const now = new Date(), y = now.getFullYear();
  if (now.getMonth() === 0 && now.getDate() === 9){
    $("#cmsg").textContent = "It's your birthday TODAY, Anu! ♡";
    ["cd","ch","cm","cs"].forEach(x => $("#"+x).textContent = "0"); return;
  }
  let t = new Date(y,0,9); if (t < now) t = new Date(y+1,0,9);
  const d = t - now;
  $("#cd").textContent = Math.floor(d/864e5);
  $("#ch").textContent = Math.floor(d/36e5) % 24;
  $("#cm").textContent = Math.floor(d/6e4) % 60;
  $("#cs").textContent = Math.floor(d/1e3) % 60;
}
tick(); setInterval(tick, 1000);

/* ================= LIGHTBOX ================= */
const lb = $("#lb"), lbImg = $("#lbImg");
let lbList = P, lbI = 0, lastFocus;
function showLb(){
  const p = lbList[lbI];
  lbImg.style.opacity = 0;
  const im = new Image(); im.src = p.src;
  (im.decode ? im.decode() : Promise.resolve()).catch(()=>{}).then(() => {
    lbImg.src = p.src; lbImg.alt = p.cap; lbImg.style.opacity = 1; lbImg.style.transform = "";
  });
  $("#lbCap").textContent = p.cap;
  $("#lbNum").textContent = (lbI + 1) + " / " + lbList.length;
  [lbList[(lbI+1)%lbList.length], lbList[(lbI-1+lbList.length)%lbList.length]].forEach(n => { new Image().src = n.src; });
}
function openLb(list, i){
  lastFocus = document.activeElement;
  lbList = list; lbI = i; lb.hidden = false; document.body.classList.add("locked");
  showLb(); $("#lbClose").focus();
}
function closeLb(){ lb.hidden = true; document.body.classList.remove("locked"); lastFocus && lastFocus.focus && lastFocus.focus({preventScroll:true}); }
function lbGo(d){ lbI = (lbI + d + lbList.length) % lbList.length; showLb(); }
$("#lbClose").addEventListener("click", closeLb);
$("#lbPrev").addEventListener("click", () => lbGo(-1));
$("#lbNext").addEventListener("click", () => lbGo(1));
lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });
document.addEventListener("keydown", e => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLb();
  if (e.key === "ArrowLeft") lbGo(-1);
  if (e.key === "ArrowRight") lbGo(1);
  if (e.key === "Tab"){ // trap focus
    const f = $$("button", lb), first = f[0], last = f[f.length-1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
});
swipe(lb, d => lbGo(d), (dx) => { lbImg.style.transform = `translateX(${dx}px)`; });
let lastTap = 0;
lbImg.addEventListener("pointerup", e => {
  const now = Date.now();
  if (now - lastTap < 320){ bigHeart(e.clientX, e.clientY); }
  lastTap = now;
});
lbImg.addEventListener("dblclick", e => e.preventDefault());

/* generic horizontal swipe */
function swipe(el, onSwipe, onMove){
  let x0 = null, y0 = 0, id = null, moved = 0;
  el.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button")) return;
    x0 = e.clientX; y0 = e.clientY; id = e.pointerId; moved = 0;
  });
  el.addEventListener("pointermove", e => {
    if (x0 === null || e.pointerId !== id) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > Math.abs(e.clientY - y0)){ moved = dx; onMove && onMove(dx * .6); }
  });
  const end = e => {
    if (x0 === null) return;
    if (Math.abs(moved) > 45){ onSwipe(moved < 0 ? 1 : -1); el._dragged = true; setTimeout(() => el._dragged = false, 50); }
    else if (onMove) onMove(0);
    x0 = null;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/* ================= FX ================= */
const HS = ["♡","❤","✿","❀","♥"];
function burstAt(elOrX, y){
  if (RM) return;
  let x = elOrX;
  if (typeof elOrX === "object"){ const r = elOrX.getBoundingClientRect(); x = r.left + r.width/2; y = r.top + r.height/2; }
  for (let k = 0; k < 8; k++){
    const s = document.createElement("span");
    s.className = "burst"; s.textContent = HS[k % HS.length];
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.setProperty("--x", (Math.random()*160 - 80) + "px");
    s.style.setProperty("--y", (Math.random()*-140 - 20) + "px");
    document.body.append(s); setTimeout(() => s.remove(), 950);
  }
}
function bigHeart(x, y){
  const h = document.createElement("span");
  h.className = "bigheart"; h.textContent = "♥";
  h.style.left = x + "px"; h.style.top = y + "px";
  document.body.append(h); setTimeout(() => h.remove(), 950);
  burstAt(x, y);
}
function confetti(n){
  if (RM) return;
  const E = ["💖","🌸","✨","💕","🎀","🌹","💗"];
  for (let k = 0; k < n; k++) setTimeout(() => {
    const f = document.createElement("span");
    f.className = "confetti"; f.textContent = E[k % E.length];
    f.style.left = Math.random()*96 + "vw";
    f.style.animationDuration = 3 + Math.random()*2.5 + "s";
    document.body.append(f); setTimeout(() => f.remove(), 6000);
  }, k * 80);
}
$("#partyBtn").addEventListener("click", () => confetti(40));
$("#loveBtn").addEventListener("click", e => { const r = e.currentTarget.getBoundingClientRect(); bigHeart(r.left + r.width/2, r.top); });
document.addEventListener("pointerdown", e => {
  if (e.target.closest("button,a,.tile,#lb,.flip")) return;
  burstAt(e.clientX, e.clientY);
});

/* hero parallax tilt (desktop pointer only) */
const hero = $("#heroStack");
if (!RM && matchMedia("(hover:hover) and (pointer:fine)").matches){
  addEventListener("pointermove", e => {
    const rx = (e.clientY / innerHeight - .5) * -8, ry = (e.clientX / innerWidth - .5) * 10;
    hero.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  }, {passive:true});
}

/* ================= PETALS CANVAS ================= */
(() => {
  if (RM) return;
  const c = $("#petals"), ctx = c.getContext("2d");
  let W, H, dpr, petals = [], raf;
  const N = innerWidth < 600 ? 14 : 28;
  const cols = ["#ff8fab","#ffb3c6","#f4729a","#ffc8d6","#e85d84"];
  function size(){ dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W*dpr; c.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
  function mk(top){ return {x:Math.random()*W, y: top ? -20 : Math.random()*H, s:6 + Math.random()*9, vy:.35 + Math.random()*.8,
    vx:-.3 + Math.random()*.6, a:Math.random()*6.28, va:-.02 + Math.random()*.04, w:Math.random()*6.28, c:cols[Math.random()*cols.length|0], o:.35 + Math.random()*.45}; }
  size(); addEventListener("resize", size);
  for (let i = 0; i < N; i++) petals.push(mk(false));
  function draw(){
    ctx.clearRect(0,0,W,H);
    for (const p of petals){
      p.w += .02; p.x += p.vx + Math.sin(p.w)*.6; p.y += p.vy; p.a += p.va;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) Object.assign(p, mk(true));
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.scale(1, .6 + Math.sin(p.w*2)*.3);
      ctx.globalAlpha = p.o; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.moveTo(0,-p.s);
      ctx.bezierCurveTo(p.s*.9,-p.s*.6, p.s*.7,p.s*.7, 0,p.s);
      ctx.bezierCurveTo(-p.s*.7,p.s*.7, -p.s*.9,-p.s*.6, 0,-p.s);
      ctx.fill(); ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  }
  draw();
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else draw(); });
})();

/* ================= COLLAGES VISIBILITY ================= */
if (!COLLAGES.length) { const sec = cWrap.closest("section"); if (sec) sec.hidden = true; }

/* ================= BLOG ================= */
(() => {
  const sec = $("#blog"), grid = $("#blogGrid");
  if (!POSTS.length) { sec.hidden = true; $$('a[href="#blog"]').forEach(a => a.hidden = true); return; }
  const dlg = $("#post"), safe = u => /^(https?:|mailto:|tel:)/i.test(u || "") ? u : "";
  const fmt = d => new Date(d).toLocaleDateString(undefined, {year:"numeric", month:"long", day:"numeric"});
  POSTS.forEach(p => {
    const a = document.createElement("article");
    a.className = "bcard"; a.tabIndex = 0; a.setAttribute("role", "button");
    const cover = safe(p.cover_url);
    a.innerHTML = (cover ? `<img src="${cover}" alt="" loading="lazy" decoding="async">` : `<div class="bph">♡</div>`) +
      `<div class="bbody"><small>${fmt(p.created_at)}</small><h3></h3><p></p></div>`;
    $("h3", a).textContent = p.title; $("p", a).textContent = p.excerpt || (p.body || "").slice(0, 110);
    const open = () => {
      if (!p.body && safe(p.link_url)) { window.open(safe(p.link_url), "_blank", "noopener"); return; }
      $("#postTitle").textContent = p.title; $("#postDate").textContent = fmt(p.created_at);
      const im = $("#postImg"); im.hidden = !cover; if (cover) im.src = cover;
      const bd = $("#postBody"); bd.textContent = "";
      (p.body || "").split(/\n{2,}/).forEach(t => { const q = document.createElement("p"); q.textContent = t; bd.append(q); });
      const l = $("#postLink"); l.hidden = !safe(p.link_url); if (safe(p.link_url)) l.href = safe(p.link_url);
      dlg.hidden = false; document.body.classList.add("locked"); $("#postClose").focus();
    };
    a.addEventListener("click", open);
    a.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    grid.append(a);
  });
  const close = () => { dlg.hidden = true; document.body.classList.remove("locked"); };
  $("#postClose").addEventListener("click", close);
  dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !dlg.hidden) close(); });
  observe($$(".bcard", grid));
})();

/* ================= SOCIAL LINKS ================= */
(() => {
  const ICONS = {instagram:"📸", facebook:"👍", whatsapp:"💬", tiktok:"🎵", youtube:"▶️", x:"🐦", snapchat:"👻", telegram:"✈️", pinterest:"📌", linkedin:"💼", spotify:"🎧", email:"✉️", custom:"🔗"};
  const NAMES = {instagram:"Instagram", facebook:"Facebook", whatsapp:"WhatsApp", tiktok:"TikTok", youtube:"YouTube", x:"X", snapchat:"Snapchat", telegram:"Telegram", pinterest:"Pinterest", linkedin:"LinkedIn", spotify:"Spotify", email:"Email"};
  const box = $("#socials");
  const list = SOCIALS.filter(s => /^(https?:|mailto:|tel:)/i.test(s.url));
  if (!list.length) { box.hidden = true; return; }
  list.forEach(s => {
    const a = document.createElement("a");
    a.href = s.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.className = "soc";
    const label = s.label || NAMES[s.platform] || "Link";
    a.setAttribute("aria-label", label);
    a.innerHTML = `<span class="soc-i">${ICONS[s.platform] || "🔗"}</span><span class="soc-t"></span>`;
    $(".soc-t", a).textContent = label;
    box.append(a);
  });
})();

/* ================= INIT ================= */
setMode(mode);
observe($$(".h2, .lines, .letter, .finale h2"));
})();
