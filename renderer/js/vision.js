// Webcam hand + face tracking (MediaPipe Tasks, GPU with CPU fallback), One-Euro smoothing with per-hand identity,
// rotation-invariant gesture classification (3D joint angles from MediaPipe's metric world landmarks), gesture state machine
// and facial-expression detectors. Locked to the camera's own frame callback, adaptive frame budget, glove preview.
import { S } from './store.js';
import { IS_MOBILE } from './platform.js';
import { drawGloves } from './glove.js';
const W = 640, H = 480;
export const Vision = { ready: false, running: false, fps: 0, latency: 0, error: null, hands: 0, face: false, previewCanvas: null, video: null, userMood: 'neutral', mode: 'off', faceEvery: 3, faceFeat: [1, 1, 0, 1, 1, 1, 0, 0], cues: false };
const bus = new EventTarget();
export const on = (n, fn) => bus.addEventListener(n, e => fn(e.detail));
export const emit = (n, d = {}) => bus.dispatchEvent(new CustomEvent(n, { detail: d }));

// ---------- One-Euro filter. Units are percent-of-frame, so dx is %/s. `extra` lifts the cutoff for every joint of a fast-moving hand
// (fingers stay glued to the palm instead of swimming), while a still hand gets heavy smoothing = no jitter ----------
const alpha = (te, fc) => 1 / (1 + 1 / (2 * Math.PI * te * fc));
class OneEuro {
  constructor(fcmin = 1.3, beta = 0.12, dcut = 1) { Object.assign(this, { fcmin, beta, dcut, t: null, px: 0, x: 0, dx: 0 }); }
  reset() { this.t = null; }
  filter(v, t, extra = 0) {
    if (this.t === null) { this.t = t; this.px = this.x = v; this.dx = 0; return v; }
    const te = Math.max((t - this.t) / 1000, 1e-3), ad = alpha(te, this.dcut), raw = (v - this.px) / te;
    this.dx = ad * raw + (1 - ad) * this.dx;
    const a = alpha(te, this.fcmin + extra + this.beta * Math.abs(this.dx));
    this.x = a * v + (1 - a) * this.x; this.px = v; this.t = t; return this.x;
  }
}
const filters = [0, 1].map(() => Array.from({ length: 63 }, () => new OneEuro()));
const wfilters = [0, 1].map(() => Array.from({ length: 63 }, () => new OneEuro(2.2, .05)));   // world landmarks only feed the classifier
const faceFilters = Array.from({ length: 6 }, () => new OneEuro(1.5, 0.05));
const slotSeen = [0, 0];
function smoothHand(lm, k, t, wl) {
  if (t - slotSeen[k] > 220) { filters[k].forEach(f => f.reset()); wfilters[k].forEach(f => f.reset()); }
  slotSeen[k] = t;
  const w0 = lm[0], w9 = lm[9], size = Math.hypot((w0.x - w9.x) * 100, (w0.y - w9.y) * 100) || 10;
  const sp = Math.min(40, Math.abs(filters[k][0].dx) + Math.abs(filters[k][1].dx)) * .12 + 0;   // wrist speed -> hand-level cutoff boost
  const img = lm.map((p, i) => ({ x: filters[k][i * 3].filter(p.x * 100, t, sp) / 100, y: filters[k][i * 3 + 1].filter(p.y * 100, t, sp) / 100, z: filters[k][i * 3 + 2].filter(p.z * 100, t, sp) / 100 }));
  const world = wl ? wl.map((p, i) => ({ x: wfilters[k][i * 3].filter(p.x * 100, t) / 100, y: wfilters[k][i * 3 + 1].filter(p.y * 100, t) / 100, z: wfilters[k][i * 3 + 2].filter(p.z * 100, t) / 100 })) : null;
  return { lm: img, world, size };
}

// ---------- geometry ----------
const d = (a, b) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function ang(a, b, c) {   // angle at b in degrees (3D)
  const x1 = a.x - b.x, y1 = a.y - b.y, z1 = a.z - b.z, x2 = c.x - b.x, y2 = c.y - b.y, z2 = c.z - b.z;
  const dot = x1 * x2 + y1 * y2 + z1 * z2, n = Math.hypot(x1, y1, z1) * Math.hypot(x2, y2, z2) || 1; return Math.acos(Math.max(-1, Math.min(1, dot / n))) * 57.2958;
}
const CHAINS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
function classify(h) {
  const lm = h.lm, P = h.world || lm, palm = d3(P[0], P[9]) || 1;
  // a finger counts as extended when it is straight (joint angles) and its tip is farther from the wrist than its middle joint
  const ext = CHAINS.map(([m, p, di, t]) => ang(P[m], P[p], P[t]) > 150 && ang(P[p], P[di], P[t]) > 140 && d3(P[t], P[0]) > d3(P[p], P[0]) * 1.05);
  const [ix, mi, ri, pk] = ext;
  const thumbOut = d3(P[4], P[5]) / palm > 0.62 && ang(P[2], P[3], P[4]) > 135;
  const pinch = d3(P[4], P[8]) / palm, curled3 = !mi && !ri && !pk, palmPx = d(lm[0], lm[9]) || 1;
  const info = { palm: palmPx, palmH: palmPx / H, pinch };
  let name = 'none';
  if (pinch < 0.3 && curled3) name = 'finger_heart';
  else if (pinch < 0.24) name = 'pinch';
  else if (ix && mi && ri && pk && thumbOut) name = info.palmH > 0.38 ? 'high_five' : 'open_palm';
  else if (!ix && !mi && !ri && !pk) name = thumbOut && lm[4].y < lm[3].y && lm[3].y < lm[2].y && lm[4].y < lm[0].y - (palmPx * 0.6) / H ? 'thumbs_up' : 'fist';
  else if (ix && mi && !ri && !pk) name = 'peace';
  else if (ix && curled3) name = 'point';
  return { name, ...info };
}

// ---------- gesture state machine: 240 ms hold to lock, 600 ms cooldown ----------
const HOLD = 240, COOLDOWN = 600;
const G = { cur: 'none', since: 0, fired: false, last: {}, fist: false, lostAt: 0 };
function gestureStep(name, now) {
  if (name !== G.cur) { G.cur = name; G.since = now; G.fired = false; }
  Vision.progress = name === 'none' ? 0 : Math.min(1, (now - G.since) / HOLD);
  if (G.fired || name === 'none' || now - G.since < HOLD) return;
  G.fired = true;
  if (now - (G.last[name] || 0) < COOLDOWN) return;
  G.last[name] = now;
  if (name === 'fist') { G.fist = true; emit('fist_start'); return; }
  emit('gesture', { name });
}
function fistRelease(name, now) {
  if (G.fist && name !== 'fist') { if (!G.lostAt) G.lostAt = now; if (now - G.lostAt > 160) { G.fist = false; G.lostAt = 0; emit('fist_end'); } }
  else G.lostAt = 0;
}

// ---------- face expression detectors ----------
const F = { base: null, n: 0, smileSince: 0, yawnSince: 0, droopSince: 0, last: {}, seenAt: 0 };
const cool = (k, ms, now) => (now - (F.last[k] || 0) > ms) && (F.last[k] = now, true);

// ---------- face cues: winks, double blink, brow raise, mouth open, nod, shake ----------
const Q = { bA: .27, bB: .27, state: 'none', since: 0, blinks: [], browBase: null, browSince: 0, mouthSince: 0, hist: [], last: {} };
const cue = (n, now, cd = 900) => { if (now - (Q.last[n] || 0) > cd) { Q.last[n] = now; emit('cue', { name: n }); } };
function revs(a) { let r = 0, pd = 0; for (let i = 1; i < a.length; i++) { const dd = a[i] - a[i - 1]; if (Math.abs(dd) < .012) continue; if (pd && Math.sign(dd) !== Math.sign(pd)) r++; pd = dd; } return r; }
function cueStep(lm, now) {
  const eA = d(lm[33], lm[133]) || 1, eB = d(lm[362], lm[263]) || 1, earA = d(lm[159], lm[145]) / eA, earB = d(lm[386], lm[374]) / eB;
  if (earA > Q.bA * .85) Q.bA += (earA - Q.bA) * .03; if (earB > Q.bB * .85) Q.bB += (earB - Q.bB) * .03;
  const cA = earA < Q.bA * .55, cB = earB < Q.bB * .55, st = cA && cB ? 'both' : cA ? 'A' : cB ? 'B' : 'none';
  if (st !== Q.state) {
    const dur = now - Q.since;
    if (Q.state !== 'none' && dur > 60 && dur < 900) {
      if (Q.state === 'both') { Q.blinks = Q.blinks.filter(t => now - t < 900); Q.blinks.push(now); if (Q.blinks.length >= 2) { Q.blinks = []; cue('double_blink', now, 1200); } }
      else if (dur > 100) cue(Q.state === 'A' ? 'wink_right' : 'wink_left', now, 700);
    }
    Q.state = st; Q.since = now;
  }
  const brow = (d(lm[105], lm[159]) / eA + d(lm[334], lm[386]) / eB) / 2;
  if (Q.browBase === null) Q.browBase = brow; if (brow < Q.browBase * 1.08) Q.browBase += (brow - Q.browBase) * .02;
  if (brow > Q.browBase * 1.2) { Q.browSince = Q.browSince || now; if (now - Q.browSince > 250) cue('brow_raise', now, 1500); } else Q.browSince = 0;
  const mar = d(lm[13], lm[14]) / (d(lm[78], lm[308]) || 1);
  if (mar > .5) { Q.mouthSince = Q.mouthSince || now; if (now - Q.mouthSince > 500) cue('mouth_open', now, 2000); } else Q.mouthSince = 0;
  const ew = Math.abs(lm[263].x - lm[33].x) || .1, yaw = (lm[1].x - (lm[33].x + lm[263].x) / 2) / ew, pit = (lm[1].y - (lm[33].y + lm[263].y) / 2) / ew;
  Q.hist.push({ t: now, yaw, pit }); while (Q.hist.length && now - Q.hist[0].t > 900) Q.hist.shift();
  if (Q.hist.length > 5) {
    const ys = Q.hist.map(h => h.yaw), ps = Q.hist.map(h => h.pit), rg = a => Math.max(...a) - Math.min(...a), ry = rg(ys), rp = rg(ps);
    if (revs(ps) >= 2 && rp > .05 && rp > ry * 1.3) { Q.hist = []; cue('head_nod', now, 1500); } else if (revs(ys) >= 2 && ry > .06 && ry > rp * 1.3) { Q.hist = []; cue('head_shake', now, 1500); }
  }
  Vision.faceFeat = [earA / Q.bA, earB / Q.bB, mar, (d(lm[61], lm[291]) / (d(lm[33], lm[263]) || 1)) / (F.base || 1), d(lm[105], lm[159]) / eA / Q.browBase, d(lm[334], lm[386]) / eB / Q.browBase, yaw, pit];
}
function faceStep(lm, now) {
  cueStep(lm, now);
  const eye = d(lm[33], lm[263]) || 1, smile = d(lm[61], lm[291]) / eye, mar = d(lm[13], lm[14]) / (d(lm[78], lm[308]) || 1);
  const ear = (d(lm[159], lm[145]) + d(lm[386], lm[374])) / (2 * (d(lm[33], lm[133]) || 1));
  if (F.n < 60) { F.base = ((F.base ?? smile) * F.n + smile) / (F.n + 1); F.n++; }
  else if (smile < F.base * 1.05) F.base += (smile - F.base) * 0.01;
  const happy = F.n >= 60 && smile > F.base * 1.18;
  F.smileSince = happy ? F.smileSince || now : 0;
  if (happy && now - F.smileSince > 450 && cool('smile', 25000, now)) emit('user_smile');
  F.yawnSince = mar > 0.62 ? F.yawnSince || now : 0;
  if (F.yawnSince && now - F.yawnSince > 1000 && cool('yawn', 60000, now)) emit('user_tired');
  F.droopSince = ear < 0.18 ? F.droopSince || now : 0;
  if (F.droopSince && now - F.droopSince > 1500 && cool('droop', 60000, now)) emit('user_tired');
  Vision.userMood = F.yawnSince || F.droopSince ? 'tired' : happy ? 'happy' : 'calm';
  const nx = faceFilters[0].filter(lm[1].x * 100, now) / 100, ny = faceFilters[1].filter(lm[1].y * 100, now) / 100;
  emit('face_pos', { x: (0.5 - nx) * 2, y: (ny - 0.5) * 2 });
}

// ---------- model loading and main loop ----------
// Worker mode: each camera frame becomes an ImageBitmap that is *transferred* (zero-copy) to a background worker running MediaPipe,
// so the UI thread never blocks. If the worker cannot start, or keeps failing, MediaPipe runs on the main thread instead.
let hand = null, face = null, stream = null, lastTs = 0, frameN = 0, handsSeen = false, fpsCount = 0, fpsT = 0, lastLat = 0;
let worker = null, busy = false, workerErrors = 0; const votes = [];
const base = new URL('/vendor/', location.href).href;
export const HAND_OPTS = { numHands: 2, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 };

async function initMain() {
  if (hand) return;
  let mod; try { mod = await import(base + 'vision_bundle.mjs'); } catch { mod = await import(base + 'vision_bundle.mjs.js'); }
  const files = await mod.FilesetResolver.forVisionTasks(base + 'wasm');
  const make = async (Klass, file, extra) => {
    for (const delegate of ['GPU', 'CPU']) {
      try { return await Klass.createFromOptions(files, { baseOptions: { modelAssetPath: base + 'models/' + file, delegate }, runningMode: 'VIDEO', ...extra }); }
      catch (e) { if (delegate === 'CPU') throw e; }
    }
  };
  hand = await make(mod.HandLandmarker, 'hand_landmarker.task', HAND_OPTS);
  face = await make(mod.FaceLandmarker, 'face_landmarker.task', { numFaces: 1 });
}
function initWorker() {
  return new Promise(res => {
    try {
      const w = new Worker(new URL('/js/vision.worker.js', location.href).href);
      const to = setTimeout(() => { w.terminate(); res(false); }, 20000);
      w.onmessage = e => {
        if (e.data.type === 'ready') { clearTimeout(to); worker = w; w.onmessage = onWorker; res(true); }
        else if (e.data.type === 'error') { clearTimeout(to); w.terminate(); res(false); }
      };
      w.onerror = () => { clearTimeout(to); res(false); };
      w.postMessage({ type: 'init', base, opts: HAND_OPTS });
    } catch { res(false); }
  });
}
async function dropToMainThread() {
  worker?.terminate(); worker = null; busy = false;
  try { await initMain(); Vision.mode = 'main thread'; } catch (e) { Vision.error = e.message; Vision.running = false; }
}
function onWorker(e) {
  const m = e.data;
  if (m.type === 'result') { busy = false; workerErrors = 0; process(m.hands, m.faceRun, m.face, performance.now() - m.t); }
  else if (m.type === 'frameerror') { busy = false; if (++workerErrors > 5) dropToMainThread(); }
}

export async function startVision(video) {
  if (Vision.running) return true;
  try {
    if (!worker && !hand) {
      if (S.worker && await initWorker()) Vision.mode = 'background worker';
      else { await initMain(); Vision.mode = 'main thread'; }
    }
    Vision.ready = true;
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: W }, height: { ideal: H }, frameRate: { ideal: IS_MOBILE ? 30 : 60 } }, audio: false });
    video.srcObject = stream; await video.play(); Vision.video = video;
    Vision.running = true; Vision.error = null; schedule(video); return true;
  } catch (e) { Vision.error = e.message || String(e); Vision.running = false; return false; }
}
export function stopVision() {
  Vision.running = false; Vision.hands = 0; Vision.face = false;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
}
export async function restartVision() {   // used when the worker option is toggled
  const v = Vision.video; stopVision(); worker?.terminate(); worker = null; hand = face = null; Vision.ready = false; busy = false;
  if (v) await startVision(v);
}
function schedule(v) {
  if (!Vision.running) return;
  if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => tick(v)); else requestAnimationFrame(() => tick(v));
}
function tick(v) {
  if (!Vision.running) return;
  const now = performance.now(), idle = !Vision.hands && !Vision.face;
  const minGap = idle ? 70 : worker ? (IS_MOBILE ? 24 : 12) : (IS_MOBILE ? 36 : 24);   // ~14 fps while nobody is there, 40-80 fps when someone is
  if (now - lastTs >= minGap && v.readyState >= 2) {
    lastTs = Math.max(now, lastTs + 1); frameN++;
    // adaptive budget: the face model is the expensive one, so it runs less often when frames get slow and more often when there is headroom
    if (frameN % 30 === 0) { const lo = Vision.cues ? 2 : 3; Vision.faceEvery = Vision.latency > 45 ? Math.min(6, Vision.faceEvery + 1) : Vision.latency < 22 ? Math.max(lo, Vision.faceEvery - 1) : Vision.faceEvery; }
    const wantFace = frameN % Vision.faceEvery === 0;
    if (worker) {
      if (!busy) { busy = true; (IS_MOBILE ? createImageBitmap(v, { resizeWidth: 480, resizeHeight: 360 }) : createImageBitmap(v)).then(bm => worker.postMessage({ type: 'frame', bm, ts: lastTs, face: wantFace, t: now }, [bm])).catch(() => { busy = false; }); }
    } else if (hand) {
      try {
        const t0 = performance.now(), hr = hand.detectForVideo(v, lastTs);
        let fl = null; if (wantFace) { const fr = face.detectForVideo(v, lastTs + 0.5); fl = fr.faceLandmarks?.[0] || null; }
        process((hr.landmarks || []).map((lm, i) => ({ lm, world: hr.worldLandmarks?.[i], label: hr.handedness?.[i]?.[0]?.categoryName, score: hr.handedness?.[i]?.[0]?.score })), wantFace, fl, performance.now() - t0);
      } catch (e) { Vision.error = e.message; }
    }
  }
  schedule(v);
}

function process(handsRaw, faceRun, fl, ms) {
  const now = performance.now(), used = [false, false];
  const hs = handsRaw.slice(0, 2).map((h, i) => {   // slot by handedness so each hand keeps its own filters even if MediaPipe reorders them
    let k = h.label === 'Left' ? 0 : h.label === 'Right' ? 1 : i; if (used[k]) k = 1 - k; used[k] = true;
    return { ...smoothHand(h.lm, k, now, h.world), label: h.label, score: h.score, slot: k };
  });
  Vision.hands = hs.length;
  if (hs.length && !handsSeen) { handsSeen = true; emit('hand_enter'); } else if (!hs.length) { handsSeen = false; }
  if (hs.length) {
    const names = hs.map(classify);
    if (names.length === 2 && names.every(n => n.name === 'open_palm' || n.name === 'high_five')) gestureStep('veto', now);
    else { const best = names.find(n => n.name !== 'none') || names[0]; votes.push(best.name); if (votes.length > 5) votes.shift(); const cnt = {}; votes.forEach(v => cnt[v] = (cnt[v] || 0) + 1); const win = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; gestureStep(win, now); fistRelease(win, now); }
  } else { votes.length = 0; gestureStep('none', now); fistRelease('none', now); }
  emit('hand_frame', { hands: hs, lms: hs.map(h => h.lm), gesture: G.cur, t: now });
  if (faceRun) {
    if (fl) { faceStep(fl, now); if (!Vision.face && now - F.seenAt > 20000 && F.seenAt) emit('user_arrive'); Vision.face = true; F.seenAt = now; emit('face_lm', fl); }
    else if (now - F.seenAt > 1500) Vision.face = false;
  }
  Vision.latency = Math.round(ms); lastLat = ms;
  if (Vision.previewCanvas && Vision.video) drawPreview(Vision.video, hs, fl);
  fpsCount++; if (now - fpsT > 1000) { Vision.fps = fpsCount; fpsCount = 0; fpsT = now; }
}

function drawPreview(v, hands, fl) {
  const c = Vision.previewCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
  g.save(); g.translate(w, 0); g.scale(-1, 1);
  const vw = v.videoWidth || 4, vh = v.videoHeight || 3, s = Math.max(w / vw, h / vh); g.drawImage(v, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);   // cover-fit, not stretched
  g.fillStyle = 'rgba(255,170,200,.8)';
  if (fl) for (let i = 0; i < fl.length; i += 4) g.fillRect(fl[i].x * w, fl[i].y * h, 1.5, 1.5);
  drawGloves(g, hands, w, h, { mirror: false });
  g.restore();
}
