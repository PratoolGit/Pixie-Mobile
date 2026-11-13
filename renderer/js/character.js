// Pixie, animated from the ORIGINAL sticker art. 40 emotions = original illustration + procedural motion + props + particles + tint.
// Lip-sync swaps between the open- and closed-mouth illustrations driven by the voice level (with a small squash & stretch).
import { Voice } from './voice.js';
import { Sound } from './sound.js';
import { gust } from './bg.js';
import { haptic } from './platform.js';

// s = sprite, t = [open-mouth, closed-mouth] talk frames, m = motion [preset, a, b], fx = [[particle, every ms]], p = prop glyph, f = CSS filter
export const EM = {
  neutral: { s: 'peaceful', t: ['happy', 'peaceful'], m: ['breathe'], fx: [['flowers', 5000]] },
  happy: { s: 'happy', t: ['happy', 'peaceful'], m: ['bounce', 3, 7], fx: [['hearts', 2600]] },
  joyful: { s: 'happy', t: ['happy', 'peaceful'], m: ['bounce', 4.2, 13], fx: [['sparkles', 1000]] },
  laughing: { s: 'happy', t: ['happy', 'excited'], m: ['laugh'], fx: [['sparkles', 1400]] },
  excited: { s: 'excited', t: ['excited', 'happy'], m: ['bounce', 2.6, 20], fx: [['confetti', 1800]] },
  cheering: { s: 'excited', t: ['excited', 'happy'], m: ['bounce', 3.4, 26], fx: [['confetti', 900]] },
  greeting: { s: 'excited', t: ['excited', 'happy'], m: ['sway', 3.4, 5], fx: [['sparkles', 1200]] },
  proud: { s: 'peaceful', t: ['happy', 'peaceful'], m: ['puff', 1.6], fx: [['sparkles', 1400]], f: 'drop-shadow(0 0 14px #ffe08a)' },
  thankful: { s: 'happy', t: ['happy', 'peaceful'], m: ['nod', 1.5, 6], fx: [['hearts', 1500]] },
  love: { s: 'shy', t: ['surprised', 'shy'], m: ['float', 1.4, 7], fx: [['hearts', 700]], f: 'drop-shadow(0 0 16px #ff9bc4)' },
  flirty: { s: 'shy', t: ['happy', 'shy'], m: ['wiggle', 2.2, 4], fx: [['hearts', 1200]] },
  teasing: { s: 'happy', t: ['happy', 'peaceful'], m: ['wiggle', 3, 4], fx: [['sparkles', 1500]] },
  playful: { s: 'happy', t: ['happy', 'peaceful'], m: ['bounce', 5, 9], fx: [['notes', 900]] },
  shy: { s: 'shy', t: ['teary', 'shy'], m: ['sway', 1.8, 2.2], fx: [['hearts', 4000]] },
  blushing: { s: 'shy', t: ['teary', 'shy'], m: ['tremble'], fx: [['steam', 1500]], f: 'saturate(1.2)' },
  flustered: { s: 'shy', t: ['surprised', 'shy'], m: ['shake', 14, 3.5], fx: [['steam', 700], ['sweat', 1600]] },
  surprised: { s: 'surprised', t: ['surprised', 'surprised'], m: ['bounce', 1.1, 7], p: '❗' },
  shocked: { s: 'surprised', t: ['surprised', 'surprised'], m: ['shiver', 26, 3], p: '❗❗', fx: [['sweat', 1200]] },
  scared: { s: 'scared', t: ['scared', 'scared'], m: ['shiver', 28, 3], fx: [['sweat', 900]], f: 'brightness(.97)' },
  worried: { s: 'teary', t: ['teary', 'shy'], m: ['sway', 2.4, 2], fx: [['sweat', 2200]] },
  nervous: { s: 'scared', t: ['scared', 'shy'], m: ['wiggle', 8, 2], fx: [['sweat', 1800]] },
  sad: { s: 'sad', t: ['sad', 'teary'], m: ['droop'], p: '🌧️', f: 'saturate(.8) brightness(.97)' },
  crying: { s: 'sad', t: ['sad', 'teary'], m: ['sob', 5], fx: [['tears', 350]] },
  teary: { s: 'teary', t: ['teary', 'shy'], m: ['tremble'], fx: [['tears', 1400]] },
  lonely: { s: 'sad', t: ['sad', 'teary'], m: ['sway', .8, 2], f: 'saturate(.7) brightness(.96)' },
  angry: { s: 'angry', t: ['surprised', 'angry'], m: ['shake', 22, 3.5], p: '💢', f: 'drop-shadow(0 0 12px #ff7a7a)' },
  annoyed: { s: 'pouty', t: ['surprised', 'pouty'], m: ['shake', 4, 1.5], p: '💢' },
  pouty: { s: 'pouty', t: ['surprised', 'pouty'], m: ['puff', 2.2], fx: [['steam', 1300]] },
  jealous: { s: 'pouty', t: ['surprised', 'pouty'], m: ['wiggle', 3, 3], fx: [['steam', 1700]], f: 'hue-rotate(-8deg) saturate(1.1)' },
  confused: { s: 'confused', t: ['surprised', 'confused'], m: ['tilt', 8], p: '❓' },
  curious: { s: 'thinking', t: ['surprised', 'thinking'], m: ['tilt', -7], p: '❓' },
  thinking: { s: 'thinking', t: ['surprised', 'thinking'], m: ['sway', .9, 1.8], p: '💭' },
  idea: { s: 'excited', t: ['excited', 'happy'], m: ['bounce', 3, 10], p: '💡', fx: [['sparkles', 900]] },
  focused: { s: 'thinking', t: ['surprised', 'thinking'], m: ['breathe'], f: 'drop-shadow(0 0 14px #8fd8ff)' },
  working: { s: 'thinking', t: ['surprised', 'thinking'], m: ['nod', 5, 1.4], p: '⚙️', f: 'drop-shadow(0 0 10px #ffd0e6)' },
  listening: { s: 'peaceful', t: ['happy', 'peaceful'], m: ['lean', 4], p: '👂', fx: [['waves', 1100]] },
  success: { s: 'excited', t: ['excited', 'happy'], m: ['bounce', 3, 16], p: '✅', fx: [['confetti', 1300]] },
  oops: { s: 'confused', t: ['surprised', 'confused'], m: ['shake', 6, 2], p: '💦' },
  determined: { s: 'peaceful', t: ['happy', 'peaceful'], m: ['puff', 3], p: '🔥' },
  relieved: { s: 'peaceful', t: ['happy', 'peaceful'], m: ['droop'], fx: [['sparkles', 1600]], p: '😮‍💨' },
  sleepy: { s: 'sleepy', t: ['sleepy', 'sleepy'], m: ['nod', .9, 4], fx: [['zzz', 1800]] },
  yawning: { s: 'sleepy', t: ['sleepy', 'sleepy'], m: ['stretch'], fx: [['zzz', 1500]] },
  tired: { s: 'sleepy', t: ['sleepy', 'sleepy'], m: ['droop'], fx: [['zzz', 3000]], f: 'saturate(.85)' },
  sleeping: { s: 'sleepy', t: ['sleepy', 'sleepy'], m: ['float', .5, 3], fx: [['zzz', 1300]], f: 'brightness(.93) saturate(.9)' }
};
export const EMOTIONS = Object.keys(EM);
const ALIAS = { peaceful: 'neutral', adoring: 'love', pondering: 'thinking', cool: 'proud', sassy: 'teasing', terrified: 'scared', joy: 'joyful', mischievous: 'teasing', grumpy: 'annoyed', puzzled: 'confused', ecstatic: 'cheering', embarrassed: 'blushing', disappointed: 'sad', sobbing: 'crying', bored: 'tired' };
const norm = n => (EM[n] ? n : ALIAS[n] || 'neutral');
const SPRITES = ['happy', 'sad', 'angry', 'surprised', 'sleepy', 'excited', 'shy', 'confused', 'pouty', 'scared', 'teary', 'thinking', 'peaceful'];
const url = n => `/assets/emotions/${n}.png`;
const IMG = {}; SPRITES.forEach(n => { const i = new Image(); i.src = url(n); IMG[n] = i; });

// Where the (closed) mouth sits on each illustration, as fractions of the sprite, measured from the artwork. Sprites that already
// show an open mouth, or hide the mouth behind hands, are lip-synced by swapping to the open-mouth drawing instead.
const ANCH = { peaceful: { x: .49, y: .625, w: .075 }, thinking: { x: .49, y: .62, w: .05 }, confused: { x: .55, y: .66, w: .045 }, pouty: { x: .47, y: .69, w: .055 }, angry: { x: .49, y: .72, w: .05 }, teary: { x: .52, y: .71, w: .055 },
  happy: { x: .52, y: .65, w: .075, pw: .072, ph: .05, cover: 1 }, excited: { x: .50, y: .57, w: .075, pw: .075, ph: .055, cover: 1 }, sad: { x: .50, y: .70, w: .085, pw: .085, ph: .06, cover: 1 } };
const skinCache = {};
function skin(name) {   // skin colour around the mouth: take the lightest samples on a ring (skin is lighter than outlines, blush and hair)
  if (skinCache[name]) return skinCache[name]; const im = IMG[name], a = ANCH[name]; let rgb = '253,232,226';
  try { const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const pts = [];
    for (let k = 0; k < 14; k++) { const an = k / 14 * 6.283, r = (a.pw || a.w * .9) * 1.5; const d = g.getImageData(Math.round((a.x + Math.cos(an) * r) * cv.width), Math.round((a.y + Math.sin(an) * r * 1.2) * cv.height), 1, 1).data; if (d[3] > 200) pts.push([d[0], d[1], d[2], d[0] + d[1] + d[2]]); }
    pts.sort((p, q) => q[3] - p[3]); const top = pts.slice(0, Math.max(1, Math.min(5, pts.length))); if (top.length) rgb = [0, 1, 2].map(i => Math.round(top.reduce((s, p) => s + p[i], 0) / top.length)).join(','); } catch {}
  return (skinCache[name] = rgb);
}
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

const C = { name: 'sleeping', shown: '', open: false, openAt: 0, tx: 0, ty: 0, lx: 0, ly: 0, asleep: true, last: Date.now(), timer: null, fxT: [], pop: 0, t0: 0, talk: 0, nod: 0, kick: 0, pet: false, faceAt: 0, talking: false, bob: 0 };
const $ = id => document.getElementById(id);
const chars = () => document.querySelectorAll('img[data-char]');

function showSprite(name, fade) {
  if (name === C.shown) return; C.prev = C.shown; C.swapAt = performance.now(); C.fadeMs = fade ? 260 : 0; C.shown = name;
  const a = $('sprA'), b = $('sprB');
  if (a && b) { if (fade) { const act = a.classList.contains('on') ? a : b, nxt = act === a ? b : a; nxt.src = url(name); nxt.classList.add('on'); act.classList.remove('on'); } else (a.classList.contains('on') ? a : b).src = url(name); }
  chars().forEach(i => { i.src = url(name); });
}
export function setEmotion(name, holdMs = 0) {
  name = norm(name); clearTimeout(C.timer);
  if (name !== C.name) {
    C.name = name; const e = EM[name]; document.body.dataset.emotion = name; C.open = false; C.talking = false; showSprite(e.s, true); C.pop = performance.now();
    const ch = $('char'); if (ch) ch.style.setProperty('--f', e.f || 'none');
    const pr = $('prop'); if (pr) { pr.textContent = e.p || ''; pr.classList.remove('in'); void pr.offsetWidth; if (e.p) pr.classList.add('in'); }
    C.fxT.forEach(clearInterval); C.fxT = (e.fx || []).map(([k, ms]) => setInterval(() => burst(k, k === 'confetti' ? 6 : k === 'tears' ? 1 : 2), ms));
    if (e.fx && e.fx[0]) burst(e.fx[0][0], e.fx[0][0] === 'confetti' ? 10 : 3);
    if (name === 'excited' || name === 'cheering' || name === 'success' || name === 'greeting') gust(1);
  }
  if (holdMs) C.timer = setTimeout(() => setEmotion('neutral'), holdMs);
}
export const emotion = () => C.name;
export const isAsleep = () => C.asleep;

// ---- particles & props ----
const G = { hearts: ['♥', '♡', '♥'], sparkles: ['✦', '✧', '★'], confetti: ['●', '▲', '■', '✿'], zzz: ['z', 'Z', 'z'], flowers: ['✿', '❀'], notes: ['♪', '♫'], steam: ['☁'], sweat: ['💧'], tears: ['💧'], waves: ['((', '(('] };
const COL = ['#ff8fb4', '#ffb3c9', '#ffd66e', '#b9a8ff', '#8fd8ff', '#ff9bd0'];
export function burst(kind = 'hearts', n = 8, origin = null) {
  const layer = $('fx'); if (!layer) return; const r = layer.getBoundingClientRect(), g = G[kind] || G.hearts, fall = kind === 'sweat' || kind === 'tears';
  const ox = origin ? origin.x - r.left : r.width * (kind === 'tears' ? .5 : .5), oy = origin ? origin.y - r.top : r.height * (fall ? .46 : .4);
  for (let i = 0; i < n; i++) {
    if (layer.childElementCount > 60) layer.firstChild.remove();
    const e = document.createElement('span'); e.className = 'p p-' + kind; e.textContent = g[i % g.length];
    const side = kind === 'tears' ? (i % 2 ? 1 : -1) * 36 : (Math.random() - .5) * 150;
    e.style.cssText = `left:${ox + side}px;top:${oy}px;color:${kind === 'zzz' ? '#9b8be0' : COL[(Math.random() * COL.length) | 0]};font-size:${kind === 'zzz' ? 18 + i * 5 : 14 + Math.random() * 18}px;--dx:${fall ? side * .1 : (Math.random() - .5) * 240}px;--dy:${fall ? 90 + Math.random() * 40 : -(70 + Math.random() * 180)}px;--rot:${(Math.random() - .5) * 90}deg;animation-delay:${i * 40}ms`;
    layer.appendChild(e); setTimeout(() => e.remove(), 2700 + i * 40);
  }
}
export function shock() { const l = $('fx'); if (!l) return; const e = document.createElement('span'); e.className = 'shock'; l.appendChild(e); setTimeout(() => e.remove(), 900); }
export function reactionFx(name) { const f = EM[norm(name)]?.fx; if (f?.[0]) burst(f[0][0], 10); }
export function react(name, holdMs = 4200) { setEmotion(name, holdMs); reactionFx(name); touch(); }

// ---- motion presets: return [x, y, rotation(deg), scaleX, scaleY] ----
function motion(m, t, lvl) {
  const [p, a, b] = m, S = Math.sin, A = Math.abs, pi = Math.PI;
  switch (p) {
    case 'bounce': { const k = A(S(t * a * pi / 2)); return [0, -k * b, S(t * a * pi / 2) * 1.2, 1 + (1 - k) * .02, 1 - (1 - k) * .03]; }
    case 'laugh': return [S(t * 9) * 1.5, -A(S(t * 9)) * 6, S(t * 9) * 2.4, 1, 1];
    case 'shake': return [S(t * a) * b, 0, S(t * a * .5) * b * .25, 1, 1];
    case 'shiver': return [S(t * a) * b, S(t * a * 1.3) * b * .5, 0, 1, 1];
    case 'sway': return [S(t * a * .7) * 3, S(t * a * 1.4) * 1.5, S(t * a) * b, 1, 1];
    case 'wiggle': return [S(t * a) * 3, -A(S(t * a)) * 2, S(t * a) * b, 1, 1];
    case 'nod': return [0, S(t * a * 2) * b * .6, S(t * a * 2) * b * .5, 1, 1 + S(t * a * 2) * .01];
    case 'tilt': return [0, S(t * 1.6) * 2, a + S(t * 1.6) * 2, 1, 1];
    case 'sob': return [0, A(S(t * a)) * -5, S(t * a * .5) * 1.2, 1 + S(t * a) * .012, 1 - S(t * a) * .012];
    case 'puff': return [0, 0, 0, 1 + S(t * a) * .03, 1 + S(t * a) * .03];
    case 'stretch': return [0, 0, 0, 1 - (S(t * .9) + 1) * .02, 1 + (S(t * .9) + 1) * .06];
    case 'lean': return [S(t * 1.2) * 2 + a, 2, a, 1, 1];
    case 'float': return [S(t * a * .6) * 4, S(t * a) * b, S(t * a * .6) * 1.5, 1, 1];
    case 'tremble': return [S(t * 40) * 1.2, S(t * 33) * .8, S(t * .9) * 1.2, 1, 1];
    case 'droop': return [0, 10 + S(t * 1.2) * 2, S(t * .8) * 1.4, 1, .975];
    default: return [S(t * .7) * 1.2, S(t * 2) * 3, S(t * .9) * 1.2, 1, 1 + S(t * 2) * .008];
  }
}
export function lookAt(x, y, src = 'face') { if (src === 'face') C.faceAt = performance.now(); else if (performance.now() - C.faceAt < 1800) return; C.tx = x; C.ty = y; }
export const setBusy = v => document.body.classList.toggle('busy', !!v);
export function poke(strength = 1) { C.kick = Math.min(1.5, C.kick + strength); }
export function touch() { C.last = Date.now(); if (C.asleep) wakeUp(); }
const IDLE = [['curious', 2400], ['happy', 2200], ['shy', 2000], ['thinking', 2600], ['proud', 2200], ['greeting', 2200]];
// ---------------------------------------------------------------------------------------------------------------------------
// LIVE RENDERER. The sprite is drawn to a canvas in 32 horizontal strips every frame, so the original artwork itself moves
// continuously (never a frozen picture): hair/head sway, breathing in the chest, head nod on stressed syllables, jaw drop with the
// voice, plus a real drawn mouth (open / wide / round visemes) on top. It also keeps her alive while she is silent or "thinking".
// ---------------------------------------------------------------------------------------------------------------------------
let mcv = null, mg = null, mdpr = 1;
const STRIPS = 32;
function ensureMouthCanvas() {
  const el = $('char'); if (!el || mcv) return;
  mcv = document.createElement('canvas'); mcv.id = 'liveCv'; mcv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1'; el.appendChild(mcv); mg = mcv.getContext('2d');
  const fit = () => { mdpr = Math.min(2, devicePixelRatio || 1); mcv.width = Math.round(el.clientWidth * mdpr); mcv.height = Math.round(el.clientHeight * mdpr); }; fit(); new ResizeObserver(fit).observe(el);
}
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
function geo(name, cw, ch) { const im = IMG[name]; if (!im || !im.naturalWidth) return null; const bh = ch * .98, sc = Math.min(cw / im.naturalWidth, bh / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc; return { im, w, h, x0: (cw - w) / 2, y0: ch * .02 + (bh - h) }; }
// one displaced strip row: returns [dx, dy, scaleX] for a height fraction f (0 = top of head, 1 = bottom of the sprite)
function warp(f, L) {
  const head = Math.pow(1 - f, 1.5), body = smooth(.45, .95, f);
  const dx = L.sway * head + Math.sin(L.t * 1.9 + f * 5.5) * L.wave * head * (f < .45 ? 1 : .3) + L.lean * smooth(.2, 1, 1 - f);
  const dy = L.bob * smooth(.62, 0, f) * (1 - body) - L.breath * body * (1 - smooth(.9, 1, f)) + L.jaw * smooth(L.jy - .02, L.jy + .1, f) * (1 - smooth(.78, .95, f));
  return [dx, dy, 1 + L.puff * body];
}
function drawLive(now, t, speaking, m, name) {
  const el = $('char'), cw = el.clientWidth, ch = el.clientHeight; mg.setTransform(mdpr, 0, 0, mdpr, 0, 0); mg.clearRect(0, 0, cw, ch);
  const g0 = geo(name, cw, ch); if (!g0) return; el.classList.add('live');
  const a = ANCH[name], u = g0.w / 100, tk = C.talk, lv = speaking ? m.open : 0;
  const L = { t, sway: (Math.sin(t * 1.25) * 1.1 + Math.sin(t * 2.4 + 1) * .5) * u * (.8 + tk * 1.1 + (document.body.classList.contains('busy') ? .6 : 0)), wave: .45 * u * (1 + tk),
    lean: C.pet ? 1.5 * u : 0, bob: (C.nod * 2.6 - lv * 1.4 + Math.sin(t * 6.5) * .25 * tk) * u, breath: (Math.sin(t * 1.8) * .5 + .5) * .9 * u, puff: Math.sin(t * 1.8 - .4) * .006,
    jaw: lv * g0.h * .013 + (a ? 0 : 0), jy: a ? a.y : .66 };
  const k = C.fadeMs ? clamp((now - C.swapAt) / C.fadeMs) : 1, layers = k < 1 && C.prev && IMG[C.prev]?.naturalWidth ? [[C.prev, 1], [name, k]] : [[name, 1]];
  layers.forEach(([nm, al]) => { const g = nm === name ? g0 : geo(nm, cw, ch); if (!g) return; const nh = g.im.naturalHeight, nw = g.im.naturalWidth, sh = nh / STRIPS; mg.globalAlpha = al;
    const wp = []; for (let k = 0; k <= STRIPS; k++) wp.push(warp(k / STRIPS, L));
    for (let i = 0; i < STRIPS; i++) { const A = wp[i], B = wp[i + 1], rh = g.h / STRIPS, sx = (A[2] + B[2]) / 2, top = g.y0 + i * rh + A[1], hgt = rh + (B[1] - A[1]);   // each strip is stretched to meet the next one: no seams
      mg.drawImage(g.im, 0, i * sh, nw, Math.min(sh + 1, nh - i * sh), g.x0 + (A[0] + B[0]) / 2 - g.w * (sx - 1) / 2, top, g.w * sx, hgt + .8); } });
  mg.globalAlpha = 1;
  // real mouth on top (follows the same warp so it stays glued to the face)
  if (a && speaking && m.open >= (a.cover ? 0 : .05)) { const [dx, dy] = warp(a.y, L); drawMouth(name, m, g0, dx, dy); }
}
// continuous mouth (open / wide / round) drawn over the face in the art's own colours
function drawMouth(name, m, g, ox, oy) {
  const a = ANCH[name], px = g.x0 + a.x * g.w + ox, py = g.y0 + a.y * g.h + oy, mw = a.w * g.w, o = Math.max(m.open, a.cover ? .06 : 0);
  const k = a.cover ? 1 : clamp((o - .04) * 9), sk = skin(name);
  mg.save(); mg.filter = `blur(${Math.max(1, (a.pw || a.w) * g.w * .22)}px)`; mg.fillStyle = `rgba(${sk},${k})`; mg.beginPath(); mg.ellipse(px, py, a.pw ? a.pw * g.w : mw * .9, a.ph ? a.ph * g.w : mw * .58, 0, 0, 7); mg.fill(); mg.restore();   // hides the drawn mouth
  const hw = mw * (.46 + .36 * m.wide - .2 * m.round), hh = mw * (.1 + .8 * o * (1 - .3 * m.wide) + .12 * m.round * o), top = py - hh * .22;
  mg.save(); mg.globalAlpha = k; mg.lineJoin = 'round'; mg.lineWidth = Math.max(1, mw * .07); mg.strokeStyle = '#6b3446'; mg.fillStyle = '#d9566b';
  mg.beginPath(); mg.moveTo(px - hw, top); mg.quadraticCurveTo(px, top - hh * .3, px + hw, top); mg.bezierCurveTo(px + hw * .92, top + hh * 1.15, px - hw * .92, top + hh * 1.15, px - hw, top); mg.closePath(); mg.fill();
  mg.save(); mg.clip(); mg.fillStyle = '#ff9aa6'; mg.beginPath(); mg.ellipse(px, top + hh * .95, hw * .62, hh * .5, 0, 0, 7); mg.fill();
  if (o > .45) { mg.fillStyle = '#fff4ef'; mg.fillRect(px - hw * .7, top - 1, hw * 1.4, hh * .2); } mg.restore();
  mg.stroke(); mg.restore();
}

export function startLoop() {
  const el = $('char'); let idleAt = performance.now() + 15000; ensureMouthCanvas();
  const loop = now => {
    const t = now / 1000, e = EM[C.name]; C.lx += (C.tx - C.lx) * .1; C.ly += (C.ty - C.ly) * .1;
    const speaking = Voice.speaking, m = Voice.mouth, lvl = speaking ? Voice.level : 0;
    C.talk += ((speaking ? 1 : 0) - C.talk) * .14; C.kick *= .9; C.nod *= .9;
    let [x, y, r, sx, sy] = motion(e.m, t, lvl);
    // entry pop + poke squish
    const age = now - C.pop; if (age < 420) { const k = age / 420, pop = 1 + Math.sin(k * Math.PI) * .07 * (1 - k); sx *= pop; sy *= pop; }
    if (C.kick > .02) { const q = Math.sin(now / 38) * C.kick; sy *= 1 - q * .05; sx *= 1 + q * .035; y += C.kick * -4; r += q * 1.4; }
    if (C.pet) { y += 3; sx *= 1.015; sy *= 1.015; r += Math.sin(t * 5) * 1.1; }
    // ---- lip-sync: sprites with a measured mouth get the drawn viseme mouth (no swapping); the rest swap to their open-mouth drawing ----
    if (speaking) {
      if (Voice.onset) { Voice.onset = false; C.nod = Math.min(1.4, C.nod + .8); }
      const frame = ANCH[e.s] ? e.s : e.t[1];
      if (!C.talking) { C.talking = true; C.open = false; showSprite(frame, false); }
      if (ANCH[frame]) { if (C.shown !== frame && !C.open) showSprite(frame, false); }
      else { const thr = C.open ? .22 : .38, want = m.open > thr; if (want !== C.open && now - C.openAt > 55) { C.open = want; C.openAt = now; showSprite(want ? e.t[0] : frame, false); } }
    } else if (C.talking) { C.talking = false; C.open = false; showSprite(e.s, false); C.nod = 1.1; }
    if (mcv) drawLive(now, t, speaking && !!ANCH[C.shown], m, C.shown || e.s);
    // ---- speaking body language: head bob on stress, sway, jaw-drop squash, little emphasis hops ----
    const tk = C.talk;
    if (tk > .01) {
      y += tk * (-m.open * 3.6 + C.nod * 3.2 + Math.sin(t * 7.3) * .5); r += tk * (Math.sin(t * 2.2) * .9 + Math.sin(t * 3.9) * .45 + C.nod * Math.sin(t * 9) * .7); x += tk * Math.sin(t * 1.6) * 1.6;
      sy *= 1 + tk * (m.open * .034 + C.nod * .012); sx *= 1 - tk * (m.open * .014) + tk * m.round * .004;
    }
    // thinking / waiting for the answer: gentle sway, so the latency never looks like a freeze
    if (document.body.classList.contains('busy') && !speaking) { r += Math.sin(t * 2.6) * 1.3; y += Math.sin(t * 5.2) * 1.2; }
    const tf = `translate(${(x + C.lx * 10).toFixed(1)}px, ${(y + C.ly * 5).toFixed(1)}px) rotate(${(r + C.lx * 2.5).toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    if (el) el.style.transform = tf;
    wraps.forEach(w => { w.style.transform = `translate(${(x * .45).toFixed(1)}px, ${(y * .45).toFixed(1)}px) rotate(${(r * .8).toFixed(2)}deg) scale(${(1 + (sx - 1) * .6).toFixed(3)}, ${(1 + (sy - 1) * .8).toFixed(3)})`; });
    if (!C.asleep && Date.now() - C.last > 240000) fallAsleep();
    if (!C.asleep && C.name === 'neutral' && !speaking && now > idleAt) { const [n, ms] = IDLE[(Math.random() * IDLE.length) | 0]; setEmotion(n, ms); idleAt = now + 14000 + Math.random() * 14000; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
const wraps = []; export const registerWrap = el => { if (el) wraps.push(el); };

// ---- touch & pointer: tap = giggle + squish, triple tap = flustered, hold = head pats, pointer = eyes follow ----
const TAPS = [['happy', 'hearts'], ['shy', 'hearts'], ['excited', 'sparkles'], ['laughing', 'sparkles'], ['blushing', 'hearts'], ['playful', 'notes']];
export function initTouch() {
  const st = $('stage'); if (!st) return; let down = null, taps = [], hold = null, petT = null, ti = 0;
  const origin = e => ({ x: e.clientX, y: e.clientY });
  st.addEventListener('pointerdown', e => { touch(); down = { t: performance.now(), x: e.clientX, y: e.clientY }; Sound.resume();
    hold = setTimeout(() => { C.pet = true; setEmotion('love', 0); haptic(20); burst('hearts', 4, origin(e)); petT = setInterval(() => { burst('hearts', 2, origin(e)); haptic(8); }, 520); }, 520); });
  const end = e => { clearTimeout(hold); clearInterval(petT); petT = null;
    if (C.pet) { C.pet = false; setEmotion('blushing', 2600); return; }
    if (!down) return; const dt = performance.now() - down.t, moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (dt < 320 && moved < 14) { const n = performance.now(); taps = taps.filter(x => n - x < 900); taps.push(n); poke(1); haptic(10); Sound.pop();
      if (taps.length >= 3) { taps = []; setEmotion('flustered', 2400); burst('steam', 3, origin(e)); burst('hearts', 8, origin(e)); }
      else { const [emo, fx] = TAPS[ti++ % TAPS.length]; setEmotion(emo, 2200); burst(fx, 4, origin(e)); } } };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end); st.addEventListener('pointerleave', () => { clearTimeout(hold); clearInterval(petT); if (C.pet) { C.pet = false; setEmotion('neutral'); } });
  window.addEventListener('pointermove', e => { const r = st.getBoundingClientRect(); lookAt(clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2), -1, 1), clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight / 2), -1, 1), 'pointer'); });
}
export function fallAsleep() { C.asleep = true; setEmotion('sleeping'); document.body.classList.add('asleep'); }
export function startAsleep() { C.asleep = true; C.name = ''; setEmotion('sleeping'); document.body.classList.add('asleep'); }
let wakeHandler = null; export const onWake = fn => (wakeHandler = fn);
export function wakeUp() {
  if (!C.asleep) return; C.asleep = false; C.last = Date.now(); document.body.classList.remove('asleep'); Sound.wake();
  setEmotion('yawning');
  setTimeout(() => { setEmotion('surprised'); Sound.pop(); burst('sparkles', 10); }, 1300);
  setTimeout(() => { setEmotion('excited'); burst('hearts', 12); wakeHandler?.(); }, 2100);
  setTimeout(() => setEmotion('happy', 3500), 4800);
}
