(async () => {
"use strict";

/* ================= BUILT-IN PHOTOS (only used if the database cannot be reached) ================= */
let P = [
  ["p11.jpg",240,486,"In blue, like my favourite sky"],["p06.jpg",388,600,"A bride I'll never stop dreaming of"],
  ["p02.jpg",312,408,"Pink saree, golden smile"],["p07.jpg",252,600,"That red lipstick"],["p14.jpg",640,250,"Boat rides & red silk"],
  ["p01.jpg",250,390,"Glasses on, heart off"],["p05.jpg",330,495,"Sunshine in yellow"],["p15.jpg",243,300,"Green and gold, all grace"],
  ["p08.jpg",253,476,"Soft eyes, softer heart"],["p04.jpg",565,312,"The eyes I get lost in"],["p12.jpg",226,350,"My favourite little smile"],
  ["p16.jpg",202,262,"Blue silk afternoon"],["p03.jpg",333,294,"Dark lips, bright soul"],["p17.jpg",640,272,"Three times as lovely"],
  ["p13.jpg",224,276,"Golden hour girl"],["p19.jpg",202,335,"Queen in red"],["p18.jpg",210,340,"Selfie with a secret"],
  ["p10.jpg",230,309,"Moonlight face"],["p20.jpg",228,300,"Looking at you, always"],["p09.jpg",228,276,"Peach & poetry"]
].map(([f,w,h,c]) => ({src:"img/"+f, w, h, cap:c}));

let COLLAGES = [
  {src:"img/bg.jpg",w:900,h:1599,cap:"Anamika: cutie collage"},{src:"img/anu-1.jpg",w:640,h:911,cap:"Happy Birthday, Dear Anu"},
  {src:"img/anu-4.jpg",w:640,h:1137,cap:"Every shade of you"},{src:"img/anu-2.jpg",w:640,h:936,cap:"Memories, part one"},
  {src:"img/anu-3.jpg",w:640,h:999,cap:"Memories, part two"},{src:"img/anu-5.jpg",w:640,h:1137,cap:"Memories, part three"},
  {src:"img/anu-6.jpg",w:640,h:1137,cap:"Memories, part four"}
];
/* null = "use the page's built-in picture", an array = "use exactly what the admin chose" */
let HERO = null, MARQUEE = null, REASONIMG = null, LETTER = null, SPOT = [];

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
   Everything below is managed from the admin panel. */
let POSTS = [], SOCIALS = [], SECTIONS = {};
const CFG = window.ANU_CONFIG;
try {
  if (CFG) {
    const get = t => fetch(CFG.url + "/rest/v1/" + t, {headers:{apikey:CFG.key, Authorization:"Bearer " + CFG.key}, signal:AbortSignal.timeout(4500)})
      .then(r => r.ok ? r.json() : Promise.reject(r.status));
    const [ph, po, so, se] = await Promise.all([
      get("photos?select=*&order=sort"),
      get("posts?select=*&published=eq.true&order=created_at.desc"),
      get("socials?select=*&order=sort"),
      get("sections?select=*")
    ]);
    const mapP = r => ({src:r.url, w:r.width || 300, h:r.height || 400, cap:r.caption || ""});
    const by = a => ph.filter(r => r.area === a).map(mapP);
    P = by("gallery"); COLLAGES = by("collage"); HERO = by("hero"); MARQUEE = by("marquee");
    REASONIMG = by("reasons"); LETTER = by("letter"); SPOT = by("spotlight");
    POSTS = po; SOCIALS = so;
    se.forEach(r => SECTIONS[r.key] = r.visible);
  }
} catch (e) { console.warn("Using built-in photos:", e); }

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
const safeUrl = u => /^(https?:|mailto:|tel:)/i.test(u || "") ? u : "";

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
  f.innerHTML = `<img src="${p.src}" alt="" width="${p.w}" height="${p.h}" loading="lazy" decoding="async" draggable="false"><figcaption class="cap"></figcaption>`;
  $("img", f).alt = p.cap; $(".cap", f).textContent = p.cap;
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
function hideSection(el){ if (el) el.hidden = true; }

/* ================= HERO PHOTOS ================= */
(() => {
  const stack = $("#heroStack"), figs = $$(".hs", stack);
  if (!HERO) return;                      // keep the built-in photos
  if (!HERO.length) { stack.hidden = true; return; }
  figs.forEach((f, i) => {
    const p = HERO[i];
    if (!p) { f.hidden = true; return; }
    const im = $("img", f); im.src = p.src; im.width = p.w; im.height = p.h;
    $("figcaption", f).textContent = p.cap;
  });
})();

/* ================= MARQUEE ================= */
(() => {
  const words = ["you", "my favourite view", "always", "Anu"];
  let items = MARQUEE ? MARQUEE : [P[0],P[2],P[5],P[9],P[6],P[13],P[3],P[11]].filter(Boolean).map((p,k) => ({...p, cap:words[k % words.length]}));
  const sec = $(".marquee");
  if (!items.length) { hideSection(sec); return; }
  while (items.length < 8) items = items.concat(items);
  const box = $("#mq");
  const build = () => items.forEach(p => {
    const im = document.createElement("img");
    im.src = p.src; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.width = p.w; im.height = p.h;
    box.append(im);
    if (p.cap) { const s = document.createElement("span"); s.textContent = p.cap; box.append(s); }
  });
  build(); build();                       // twice, so the loop is seamless
  box.style.animationDuration = Math.max(30, items.length * 7) + "s";
})();

/* ================= GALLERY MODES ================= */
const stage = $("#stage"), coverNav = $("#coverNav");
const MODES = ["heart","cover","masonry","polaroid","film"];
let mode = store.get("anu-mode");
if (!MODES.includes(mode)) mode = "heart";

const HEART = [".XX...XX.","XXXX.XXXX","XXXXXXXXX","XXXXXXXXX",".XXXXXXX.","..XXXXX..","...XXX...","....X...."];

const renders = {
  masonry(){ P.forEach((p,i) => stage.append(tile(p,i,P))); },
  polaroid(){
    P.forEach((p,i) => {
      const t = tile(p,i,P);
      t.style.setProperty("--rot", ((i*37)%11 - 5) + "deg");
      t.style.setProperty("--tape", ((i*53)%9 - 4) + "deg");
      stage.append(t);
    });
  },
  film(){ P.forEach((p,i) => stage.append(tile(p,i,P))); },
  heart(){
    let k = 0;
    HEART.join("").split("").forEach(c => {
      if (c === "X"){ const i = k++ % P.length; stage.append(tile(P[i], i, P)); }
      else { const b = document.createElement("div"); b.className = "blank"; stage.append(b); }
    });
  },
  cover(){
    P.forEach((p,i) => { const t = tile(p,i,P); $("img", t).loading = "eager"; stage.append(t); });
    coverStart();
  }
};

function setMode(m){
  if (!renders[m]) m = "heart";
  coverStop();
  mode = m; store.set("anu-mode", m);
  $$("#switch button").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === m));
  stage.className = "stage m-" + m;
  stage.innerHTML = "";
  renders[m]();
  coverNav.hidden = m !== "cover";
  if (m !== "cover" && m !== "film" && m !== "heart") observe($$(".tile", stage));
  if (!RM && m !== "cover"){ stage.classList.remove("swap"); void stage.offsetWidth; stage.classList.add("swap"); }
}
$("#switch").addEventListener("click", e => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  setMode(b.dataset.mode);
  const sw = $("#switch"), sl = b.offsetLeft - (sw.clientWidth - b.offsetWidth) / 2;
  sw.scrollTo({left: sl, behavior: "smooth"});
  const top = stage.getBoundingClientRect().top - sw.getBoundingClientRect().bottom - 16;
  if (top < 0) scrollBy({top, behavior: RM ? "auto" : "smooth"});
});

/* ================= 3D CAROUSEL =================
   Position is a decimal ("2.35" = between card 2 and 3). Every frame we ease it toward the target and
   place only transform + opacity, so it stays smooth. It keeps turning by itself and never stops
   because of hover, tap or drag (it only waits a moment while the photo viewer is open). */
const AUTO_SECONDS = 3.2;
const cov = {pos:0, target:0, raf:0, last:0, timer:0, tiles:[], step:200, vis:true, drag:null, active:-1};
function covMeasure(){ const t = cov.tiles[0]; cov.step = Math.max(80, (t ? t.offsetWidth : 240) * .62); }
function covRender(){
  const n = cov.tiles.length, step = cov.step;
  const act = ((Math.round(cov.pos) % n) + n) % n;
  for (let i = 0; i < n; i++){
    const t = cov.tiles[i];
    let d = i - cov.pos; d -= n * Math.round(d / n);        // shortest way round the loop
    const a = Math.abs(d);
    if (a > 3.1){ if (t._v !== 0){ t.style.opacity = 0; t.style.visibility = "hidden"; t._v = 0; } continue; }
    const x = Math.sign(d) * (a <= 1 ? a * step : step + (a - 1) * step * .62);
    const ry = -Math.max(-1, Math.min(1, d)) * 48;
    const z = -Math.min(a, 2.6) * 120;
    const s = 1 - Math.min(a, 1) * .12;
    const o = a > 2.2 ? Math.max(0, 1 - (a - 2.2) / .9) : 1;
    t.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    t.style.opacity = o.toFixed(3);
    t.style.zIndex = 100 - Math.round(a * 10);
    if (t._v !== 1){ t.style.visibility = "visible"; t._v = 1; }
  }
  if (act !== cov.active){
    cov.active = act;
    cov.tiles.forEach((t,i) => t.classList.toggle("active", i === act));
    $("#cCount").textContent = (act + 1) + " / " + n;
  }
}
function covTick(ts){
  cov.raf = 0;
  if (mode !== "cover" || !cov.vis || !cov.tiles.length) return;
  const dt = cov.last ? Math.min(.05, (ts - cov.last) / 1000) : .016; cov.last = ts;
  if (!cov.drag){
    if (!RM && lb.hidden){ cov.timer += dt; if (cov.timer > AUTO_SECONDS){ cov.timer = 0; cov.target = Math.round(cov.target) + 1; } }
    cov.pos += (cov.target - cov.pos) * (RM ? 1 : 1 - Math.exp(-dt * 7));
    if (Math.abs(cov.target - cov.pos) < .0004) cov.pos = cov.target;
  }
  covRender();
  cov.raf = requestAnimationFrame(covTick);
}
function covKick(){ if (!cov.raf && mode === "cover" && cov.vis){ cov.last = 0; cov.raf = requestAnimationFrame(covTick); } }
function coverStart(){
  cov.tiles = $$(".tile", stage); cov.tiles.forEach(t => t._v = -1);
  cov.pos = cov.target = 0; cov.active = -1; cov.timer = 0; cov.drag = null;
  covMeasure(); covRender(); covKick();
}
function coverStop(){ cancelAnimationFrame(cov.raf); cov.raf = 0; cov.tiles = []; cov.drag = null; }
function coverGo(delta){ cov.target = Math.round(cov.target) + delta; cov.timer = 0; covKick(); }
$("#cPrev").addEventListener("click", () => coverGo(-1));
$("#cNext").addEventListener("click", () => coverGo(1));
if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { cov.vis = e.isIntersecting; covKick(); }, {rootMargin:"120px"}).observe(stage);
document.addEventListener("visibilitychange", () => { if (!document.hidden) covKick(); });

stage.addEventListener("dragstart", e => e.preventDefault());
stage.addEventListener("pointerdown", e => {
  if (mode !== "cover" || (e.pointerType === "mouse" && e.button !== 0)) return;
  cov.drag = {x:e.clientX, y:e.clientY, t0:cov.target, lx:e.clientX, lt:performance.now(), v:0, moved:false, vert:false};
  cov.timer = 0;
});
addEventListener("pointermove", e => {
  const d = cov.drag; if (!d || d.vert) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y;
  if (!d.moved){
    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)){ d.vert = true; return; }
    if (Math.abs(dx) < 5) return;
    d.moved = true;
  }
  const now = performance.now(), ms = Math.max(1, now - d.lt);
  d.v = .75 * d.v + .25 * (-(e.clientX - d.lx) / cov.step) / (ms / 1000);
  d.lx = e.clientX; d.lt = now;
  cov.target = d.t0 - dx / cov.step; cov.pos = cov.target; cov.timer = 0;
}, {passive:true});
function covEnd(){
  const d = cov.drag; if (!d) return;
  cov.drag = null; cov.timer = 0;
  if (d.moved){
    cov.target = Math.round(cov.target + Math.max(-2.5, Math.min(2.5, d.v * .2)));
    stage._dragged = true; setTimeout(() => stage._dragged = false, 80);
  }
  covKick();
}
addEventListener("pointerup", covEnd); addEventListener("pointercancel", covEnd);
stage.addEventListener("wheel", e => {
  if (mode !== "cover" || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault(); cov.target += e.deltaX / (cov.step * 2.2); cov.timer = 0; covKick();
}, {passive:false});
let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { if (mode === "cover"){ covMeasure(); covRender(); } }, 120); });

/* tile click → photo viewer (or bring the side card to the middle) */
function onTile(e){
  const t = e.target.closest(".tile"); if (!t) return;
  const i = +t.dataset.i;
  if (mode === "cover" && t.closest("#stage") && cov.tiles.length){
    const n = cov.tiles.length, cur = Math.round(cov.target);
    let d = (((i - cur) % n) + n) % n; if (d > n / 2) d -= n;
    if (d !== 0){ cov.target = cur + d; cov.timer = 0; covKick(); return; }
  }
  openLb(t._list, i);
}
document.addEventListener("click", e => { if (stage._dragged){ stage._dragged = false; return; } onTile(e); });
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("tile")){ e.preventDefault(); onTile(e); }
  if (lb.hidden && mode === "cover" && stage.contains(document.activeElement)){
    if (e.key === "ArrowLeft") coverGo(-1);
    if (e.key === "ArrowRight") coverGo(1);
  }
});

/* ================= SPOTLIGHT (single big photos) ================= */
(() => {
  const sec = $("#spotlight"), box = $("#spotStage"), dots = $("#spotDots");
  if (!SPOT.length){ sec.hidden = true; return; }
  sec.hidden = false;
  let cur = 0;
  SPOT.forEach((p, i) => {
    const f = document.createElement("figure"); f.className = "sp-slide" + (i === 0 ? " on" : "");
    f.innerHTML = `<img class="sp-bg" alt="" aria-hidden="true"><img class="sp-fg" alt=""><figcaption></figcaption>`;
    $(".sp-bg", f).src = p.src; $(".sp-fg", f).src = p.src; $(".sp-fg", f).alt = p.cap; $("figcaption", f).textContent = p.cap;
    if (!p.cap) $("figcaption", f).hidden = true;
    f.addEventListener("click", () => openLb(SPOT, i));
    box.append(f);
    const d = document.createElement("button"); d.type = "button"; d.setAttribute("aria-label", "Photo " + (i + 1));
    d.className = i === 0 ? "on" : ""; d.addEventListener("click", () => go(i, true));
    dots.append(d);
  });
  const slides = $$(".sp-slide", box), dts = $$("button", dots);
  function go(n){ cur = (n + SPOT.length) % SPOT.length; slides.forEach((s,k) => s.classList.toggle("on", k === cur)); dts.forEach((s,k) => s.classList.toggle("on", k === cur)); }
  if (SPOT.length > 1 && !RM) setInterval(() => { if (!document.hidden && lb.hidden) go(cur + 1); }, 4500);  // never paused by hover or touch
  dots.hidden = SPOT.length < 2;
  observe([box]);
})();

/* ================= COLLAGES ================= */
const cWrap = $("#collages");
COLLAGES.forEach((p,i) => cWrap.append(tile(p,i,COLLAGES)));
if (!COLLAGES.length) hideSection(cWrap.closest("section")); else observe($$(".tile", cWrap));

/* ================= REASONS ================= */
const rg = $("#reasonGrid");
REASONS.forEach(([h,t,img],i) => {
  const b = document.createElement("button");
  b.className = "flip";
  b.setAttribute("aria-label", h + ": flip card");
  const pic = REASONIMG ? (REASONIMG[i] && REASONIMG[i].src) : "img/" + img;
  b.innerHTML = `<div class="flip-in">
    <div class="face front">${pic ? `<img alt="" loading="lazy" decoding="async">` : ""}<h3><small>reason ${i+1}</small><span class="rt"></span></h3></div>
    <div class="face back"><span class="num">${i+1}</span><p class="rp"></p></div></div>`;
  if (pic) $("img", b).src = pic;
  $(".rt", b).textContent = h; $(".rp", b).textContent = t;
  b.addEventListener("click", () => { b.classList.toggle("on"); if (b.classList.contains("on")) burstAt(b); });
  rg.append(b);
});
observe($$(".flip", rg));

/* ================= LETTER STAMP ================= */
(() => {
  const st = $(".stamp"); if (!st || !LETTER) return;
  if (!LETTER.length){ st.hidden = true; return; }
  const im = $("img", st); im.src = LETTER[0].src; im.width = LETTER[0].w; im.height = LETTER[0].h;
})();

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
function closeLb(){ lb.hidden = true; document.body.classList.remove("locked"); lastFocus && lastFocus.focus && lastFocus.focus({preventScroll:true}); covKick(); }
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
  if (e.key === "Tab"){
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
  const end = () => {
    if (x0 === null) return;
    if (Math.abs(moved) > 45) onSwipe(moved < 0 ? 1 : -1);
    else if (onMove) onMove(0);
    x0 = null;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/* ================= BLOG ================= */
(() => {
  const sec = $("#blog"), grid = $("#blogGrid");
  if (!POSTS.length){ sec.hidden = true; return; }
  const dlg = $("#post");
  const fmt = d => new Date(d).toLocaleDateString(undefined, {year:"numeric", month:"long", day:"numeric"});
  POSTS.forEach(p => {
    const a = document.createElement("article");
    a.className = "bcard"; a.tabIndex = 0; a.setAttribute("role", "button");
    const cover = safeUrl(p.cover_url);
    a.innerHTML = (cover ? `<img alt="" loading="lazy" decoding="async">` : `<div class="bph">♡</div>`) +
      `<div class="bbody"><small></small><h3></h3><p></p></div>`;
    if (cover) $("img", a).src = cover;
    $("small", a).textContent = fmt(p.created_at);
    $("h3", a).textContent = p.title; $("p", a).textContent = p.excerpt || (p.body || "").slice(0, 110);
    const open = () => {
      if (!p.body && safeUrl(p.link_url)){ window.open(safeUrl(p.link_url), "_blank", "noopener"); return; }
      $("#postTitle").textContent = p.title; $("#postDate").textContent = fmt(p.created_at);
      const im = $("#postImg"); im.hidden = !cover; if (cover) im.src = cover;
      const bd = $("#postBody"); bd.textContent = "";
      (p.body || "").split(/\n{2,}/).forEach(t => { const q = document.createElement("p"); q.textContent = t; bd.append(q); });
      const l = $("#postLink"); l.hidden = !safeUrl(p.link_url); if (safeUrl(p.link_url)) l.href = safeUrl(p.link_url);
      dlg.hidden = false; document.body.classList.add("locked"); $("#postClose").focus();
    };
    a.addEventListener("click", open);
    a.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); } });
    grid.append(a);
  });
  const close = () => { dlg.hidden = true; document.body.classList.remove("locked"); };
  $("#postClose").addEventListener("click", close);
  dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !dlg.hidden) close(); });
  observe($$(".bcard", grid));
})();

/* ================= SOCIAL LINKS (real icons in the theme colour) ================= */
(() => {
  const box = $("#socials"), I = window.ANU_ICONS;
  const list = SOCIALS.filter(s => safeUrl(s.url));
  if (!list.length || !I){ box.hidden = true; return; }
  list.forEach(s => {
    const a = document.createElement("a");
    a.href = s.url; a.className = "soc";
    if (!/^(mailto:|tel:)/i.test(s.url)){ a.target = "_blank"; a.rel = "noopener noreferrer"; }
    const label = s.label || I.NAME[s.platform] || "Link";
    a.setAttribute("aria-label", label);
    a.append(I.el(s.platform));
    const t = document.createElement("span"); t.textContent = label; a.append(t);
    box.append(a);
  });
})();

/* ================= LIVE CHAT ================= */
(() => {
  const wrap = $("#chat"); if (!CFG || !window.ANU_ICONS) return;
  if (SECTIONS.chat === false) return;
  wrap.hidden = false;
  $("#chatIco").style.setProperty("--i", 'url("' + ANU_ICONS.url("chat") + '")');
  const fab = $("#chatFab"), panel = $("#chatPanel"), log = $("#chatLog"), form = $("#chatForm"), text = $("#chatText"),
        nameIn = $("#chatName"), note = $("#chatNote"), dot = $("#chatDot");
  let token = store.get("anu-chat-token");
  if (!token || token.length < 20){
    token = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)) + Math.random().toString(36).slice(2, 12);
    store.set("anu-chat-token", token);
  }
  nameIn.value = store.get("anu-chat-name") || "";
  let msgs = [], open = false, seen = +(store.get("anu-chat-seen") || 0), timer = 0, busy = false;
  const rpc = (fn, body) => fetch(CFG.url + "/rest/v1/rpc/" + fn, {method:"POST",
    headers:{apikey:CFG.key, Authorization:"Bearer " + CFG.key, "Content-Type":"application/json"}, body:JSON.stringify(body)})
    .then(async r => { if (!r.ok){ let m = ""; try{ m = (await r.json()).message; }catch(e){} throw new Error(m || "Could not reach chat"); } return r.status === 204 ? null : r.json(); });
  const fmtT = d => new Date(d).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  function draw(){
    log.textContent = "";
    const hi = document.createElement("div"); hi.className = "cm them"; hi.textContent = "Hi! Write me a message here and I will reply as soon as I see it ♡"; log.append(hi);
    msgs.forEach(m => {
      const d = document.createElement("div"); d.className = "cm " + (m.sender === "visitor" ? "me" : "them");
      d.textContent = m.body; const s = document.createElement("small"); s.textContent = fmtT(m.created_at); d.append(s); log.append(d);
    });
    log.scrollTop = log.scrollHeight;
  }
  const adminCount = () => msgs.filter(m => m.sender === "admin").length;
  function updateDot(){
    const n = adminCount() - seen;
    dot.hidden = open || n <= 0; dot.textContent = n > 9 ? "9+" : String(n);
  }
  async function pull(){
    if (busy) return; busy = true;
    try {
      const rows = await rpc("chat_fetch", {p_token:token});
      const changed = rows.length !== msgs.length || (rows.length && rows[rows.length - 1].id !== (msgs[msgs.length - 1] || {}).id);
      msgs = rows;
      if (open){ seen = adminCount(); store.set("anu-chat-seen", String(seen)); }
      if (changed && open) draw();
      updateDot();
    } catch (e) { /* offline, try again later */ }
    busy = false;
  }
  function schedule(){
    clearTimeout(timer);
    if (!document.hidden && (open || msgs.length)) timer = setTimeout(async () => { await pull(); schedule(); }, open ? 2500 : 10000);
  }
  function setOpen(v){
    open = v; panel.hidden = !v; fab.setAttribute("aria-expanded", String(v));
    if (v){ seen = adminCount(); store.set("anu-chat-seen", String(seen)); draw(); updateDot(); pull(); text.focus(); }
    schedule();
  }
  fab.addEventListener("click", () => setOpen(!open));
  $("#chatClose").addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && open && lb.hidden) setOpen(false); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden){ pull(); schedule(); } });
  text.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const body = text.value.trim(); if (!body) return;
    const nm = nameIn.value.trim(); store.set("anu-chat-name", nm);
    note.textContent = "";
    text.value = "";
    msgs.push({id:"tmp" + Date.now(), sender:"visitor", body, created_at:new Date().toISOString()}); draw();
    try { await rpc("chat_send", {p_token:token, p_name:nm, p_body:body}); note.textContent = "Sent ♡"; pull(); schedule(); }
    catch (err) { note.textContent = err.message || "Could not send, please try again"; msgs.pop(); draw(); text.value = body; }
  });
  pull().then(schedule);
})();

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
  if (e.target.closest("button,a,.tile,#lb,.flip,#chat,.sp-slide,.m-cover")) return;
  burstAt(e.clientX, e.clientY);
});

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
  const N = innerWidth < 600 ? 12 : 24;
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

/* ================= SHOW / HIDE SECTIONS (switches in the admin panel) ================= */
(() => {
  Object.entries(SECTIONS).forEach(([key, visible]) => {
    if (visible === false) $$(`[data-section="${key}"]`).forEach(el => el.hidden = true);
  });
})();

/* ================= INIT ================= */
if (P.length) setMode(mode); else hideSection($("#gallery"));
observe($$(".h2, .lines, .letter, .finale h2"));
// hide menu links that point to a hidden section
$$(".nav nav a").forEach(a => { const s = $(a.getAttribute("href")); if (s && s.hidden) a.hidden = true; });
})();
