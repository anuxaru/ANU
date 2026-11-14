/* Face lock for the admin panel (extra layer on top of email + password).
   It runs entirely in your browser: the camera picture is never uploaded or saved.
   Only a small list of numbers describing your face (a "template") is stored, and only your admin account can read it.
   Check: show your face, turn your head left and right (random order), look straight again. Your face must match at both ends. */
window.ANU_FACE = (() => {
  const V = "1.7.13", BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@" + V;
  const MATCH = 0.5;          // smaller = stricter (0.6 is the library's usual limit)
  const TURN = 0.11;          // how far the nose must move away from the middle of the face
  const STRAIGHT = 0.05;      // how close to the middle counts as "looking straight"
  let loading = null;

  function addScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = src; s.onload = res;
      s.onerror = () => rej(new Error("Could not load the face tools. Check your internet and try again."));
      document.head.append(s);
    });
  }
  function load() {
    if (loading) return loading;
    loading = (async () => {
      if (!window.faceapi) await addScript(BASE + "/dist/face-api.min.js");
      const M = BASE + "/model/";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(M),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(M),
        faceapi.nets.faceRecognitionNet.loadFromUri(M)
      ]);
    })().catch(e => { loading = null; throw e; });
    return loading;
  }

  // nose position inside the face: 0 = middle, + = nose towards the camera's right (your left), - = your right
  const yawOf = lm => {
    const p = lm.positions, nose = p[30], a = p[0], b = p[16];
    return (nose.x - (a.x + b.x) / 2) / Math.max(1, (b.x - a.x));
  };
  const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
  const best = (d, templates) => Math.min(...templates.map(t => dist(d, t)));
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* opts: { video, say(text, stepIndex), templates (verify), enroll (true/false), timeoutMs } */
  async function run(opts) {
    const { video, say } = opts, enroll = !!opts.enroll, templates = opts.templates || [];
    say("Loading… one moment", 0);
    await load();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser cannot use the camera here.");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) { throw new Error("Camera is blocked. Allow the camera for this site and try again."); }
    video.srcObject = stream; video.muted = true; video.setAttribute("playsinline", "");
    try { await video.play(); } catch (e) { /* autoplay will start */ }
    const det = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
    const t0 = Date.now(), limit = opts.timeoutMs || 25000, collected = [];
    const order = Math.random() < 0.5 ? ["left", "right"] : ["right", "left"];
    let phase = "front1", hold = 0, base = 0;
    const need = { front1: 3, turn1: 2, turn2: 2, front2: 3 };
    const isCancelled = () => opts.cancelled && opts.cancelled();
    try {
      for (;;) {
        if (isCancelled()) throw new Error("Cancelled");
        if (Date.now() - t0 > limit) throw new Error("That took too long. Try again.");
        const r = await faceapi.detectSingleFace(video, det).withFaceLandmarks(true);
        if (!r) { hold = 0; say("Show your face to the camera", phase.startsWith("turn") ? 2 : 0); await frame(); continue; }
        if (r.detection.box.width < video.videoWidth * 0.22) { hold = 0; say("Move a little closer", 0); await frame(); continue; }
        const dx = yawOf(r.landmarks);

        if (phase === "front1" || phase === "front2") {
          say("Look straight at the camera", phase === "front1" ? 0 : 3);
          // first check: close to the middle; last check: back to where you started
          if (Math.abs(phase === "front1" ? dx : dx - base) < (phase === "front1" ? 0.09 : STRAIGHT + 0.03)) hold++; else hold = 0;
          if (hold >= need[phase]) {
            const full = await faceapi.detectSingleFace(video, det).withFaceLandmarks(true).withFaceDescriptor();
            if (!full) { hold = 0; continue; }
            const d = Array.from(full.descriptor);
            if (!enroll && best(d, templates) > MATCH) throw new Error("This does not look like the saved face.");
            collected.push(d);
            if (phase === "front1") { base = dx; phase = "turn1"; hold = 0; }
            else {
              if (enroll) { await wait(500); const more = await faceapi.detectSingleFace(video, det).withFaceLandmarks(true).withFaceDescriptor(); if (more) collected.push(Array.from(more.descriptor)); }
              say("Face confirmed ✓", 4);
              return { ok: true, template: enroll ? collected.map(v => v.map(n => +n.toFixed(4))) : null };
            }
          }
        } else {
          const want = phase === "turn1" ? order[0] : order[1];
          const rel = dx - base;
          say(want === "left" ? "Turn your head to the left" : "Turn your head to the right", phase === "turn1" ? 1 : 2);
          const ok = want === "left" ? rel > TURN : rel < -TURN;       // see yawOf: your left = positive
          if (ok) hold++; else hold = 0;
          if (hold >= need[phase]) { phase = phase === "turn1" ? "turn2" : "front2"; hold = 0; }
        }
        await frame();
      }
    } finally {
      stream.getTracks().forEach(t => t.stop()); video.srcObject = null;
    }
  }

  return { load, run, _yawOf: yawOf, _dist: dist, MATCH };
})();
