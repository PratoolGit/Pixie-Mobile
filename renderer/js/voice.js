// Speech output with real-time lip-sync, and always-on listening.
//  Output : cached + parallel-prefetched TTS, gapless Web Audio playback, audio-driven viseme analysis (open / wide / round)
//           with output-latency compensation, text-driven mouth as fallback, instant "acknowledge" filler to hide thinking time.
//  Input  : AudioWorklet voice-activity detection (32 ms frames, short hang-over, silence trimmed) -> Whisper-compatible STT -> wake word.
import { S, routeChain, VOICES } from './store.js';

export const speechEvents = new EventTarget();                      // 'start' | 'end' | 'pending'
export const Voice = { speaking: false, pending: false, level: 0, viseme: 'SIL', mouth: { open: 0, wide: .4, round: 0 }, onset: false, lastEnd: 0, mode: 'none' };
const emit = n => speechEvents.dispatchEvent(new Event(n));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const b64Blob = (b64, type) => new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type });

let ctxA = null, master = null, ana = null, token = 0;
const Q = { active: new Set(), nextT: 0, sessions: 0, waiters: new Set(), filler: false };
function aCtx() {
  if (!ctxA) {
    ctxA = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctxA.createGain(); ana = ctxA.createAnalyser(); ana.fftSize = 1024; ana.smoothingTimeConstant = .15;
    master.connect(ana); ana.connect(ctxA.destination);
  }
  if (ctxA.state === 'suspended') ctxA.resume().catch(() => {});
  return ctxA;
}
export const resumeAudio = () => { try { aCtx(); } catch {} };

// ---------------------------------------------------------------- mouth model ----------------------------------------------------------------
// Audio-driven: time-domain energy gives how far the mouth opens; the balance of low / mid / high formant bands gives its shape.
const M = { hist: [], textT0: 0, textDur: 0, phon: null, last: 0, lastOnset: 0, prevLevel: 0, raf: 0, td: null, fd: null };
const VOW = { a: [.95, .35, 0], e: [.6, .85, 0], i: [.35, 1, 0], o: [.75, 0, .85], u: [.42, 0, 1], y: [.4, .8, 0] };
function toPhon(text) {
  const out = []; let total = 0;
  for (const ch of text.toLowerCase()) {
    let p, w;
    if (VOW[ch]) { p = VOW[ch]; w = 1.7; } else if ('bmp'.includes(ch)) { p = [0, .3, 0]; w = .7; } else if ('fv'.includes(ch)) { p = [.18, .7, 0]; w = .8; }
    else if ('wq'.includes(ch)) { p = [.3, 0, .9]; w = .9; } else if (/[a-z]/.test(ch)) { p = [.3, .5, 0]; w = .8; }
    else if (/[.!?,~;:]/.test(ch)) { p = [0, .4, 0]; w = 3; } else { p = [0, .4, 0]; w = 1.1; }
    out.push({ o: p[0], w: p[1], r: p[2], d: w }); total += w;
  }
  return { list: out, total };
}
function textTarget(now) {
  const el = now - M.textT0; if (!M.phon || el < 0) return [0, .4, 0];
  let acc = 0; const k = el / M.textDur * M.phon.total;
  for (const s of M.phon.list) { acc += s.d; if (acc >= k) return [s.o, s.w, s.r]; }
  return [0, .4, 0];
}
function mouthTick(now) {
  M.raf = requestAnimationFrame(mouthTick);
  const m = Voice.mouth; let tgt = [0, .4, 0];
  if (Voice.mode === 'audio' && ana) {
    M.td ||= new Float32Array(ana.fftSize); M.fd ||= new Uint8Array(ana.frequencyBinCount);
    ana.getFloatTimeDomainData(M.td); let s = 0; for (let i = 0; i < M.td.length; i++) s += M.td[i] * M.td[i]; const rms = Math.sqrt(s / M.td.length);
    ana.getByteFrequencyData(M.fd); const bin = ctxA.sampleRate / ana.fftSize, band = (a, b) => { let t = 0, n = 0; for (let i = Math.floor(a / bin); i <= Math.floor(b / bin) && i < M.fd.length; i++) { t += M.fd[i]; n++; } return t / Math.max(1, n) / 255; };
    const lo = band(180, 550), mid = band(550, 1250), hi = band(1250, 3300), tot = lo + mid + hi + 1e-4;
    const lvl = clamp(rms * 8.5), open = clamp(Math.pow(lvl, .78) * 1.08);
    const wide = clamp((hi / tot - .26) * 2.6), round = clamp((lo / tot - .4) * 2.8);
    tgt = [lvl < .06 ? 0 : open, wide, lvl < .06 ? 0 : round];
    if (lvl - M.prevLevel > .2 && lvl > .3 && now - M.lastOnset > 170) { Voice.onset = true; M.lastOnset = now; }
    M.prevLevel = lvl; Voice.level += (lvl - Voice.level) * .5;
    // the analyser hears the sound before the speaker plays it: replay the mouth with that output latency so lips and sound line up
    M.hist.push({ t: now, v: tgt }); const lat = ((ctxA.outputLatency || ctxA.baseLatency || .02) * 1000) + 12;
    while (M.hist.length > 2 && M.hist[1].t <= now - lat) M.hist.shift(); tgt = M.hist[0].v;
  } else if (Voice.mode === 'text') { tgt = textTarget(now); Voice.level += (tgt[0] - Voice.level) * .5; if (Math.sin(now / 90) > .98) Voice.onset = true; }
  else if (Voice.pending) tgt = [.1 + .06 * Math.sin(now / 160), .45, 0];   // a tiny breath-in while the voice is being fetched
  const a = tgt[0] > m.open ? .7 : .32;
  m.open += (tgt[0] - m.open) * a; m.wide += (tgt[1] - m.wide) * .35; m.round += (tgt[2] - m.round) * .35;
  Voice.viseme = m.open < .1 ? 'SIL' : m.round > .45 ? (m.open > .5 ? 'O' : 'U') : m.wide > .55 ? (m.open > .45 ? 'E' : 'I') : 'A';
  if (!Voice.speaking && !Voice.pending && m.open < .01) { cancelAnimationFrame(M.raf); M.raf = 0; m.open = 0; Voice.level = 0; }
}
const startMouth = () => { if (!M.raf) M.raf = requestAnimationFrame(mouthTick); };
function setPending(v) { if (Voice.pending === v) return; Voice.pending = v; emit('pending'); if (v) startMouth(); }
function begin(mode) { Voice.mode = mode; setPending(false); if (!Voice.speaking) { Voice.speaking = true; emit('start'); } startMouth(); }
let finishing = false;
function finish() { if (finishing || !Voice.speaking) return; finishing = true; Voice.speaking = false; Voice.mode = 'none'; Voice.lastEnd = Date.now(); Voice.viseme = 'SIL'; M.hist.length = 0; emit('end'); finishing = false; }
function checkDone() { if (!Q.active.size && !Q.sessions) finish(); }
export function stopSpeaking() {
  token++; Q.filler = false;
  for (const s of Q.active) { s.onended = null; try { s.stop(); } catch {} } Q.active.clear(); Q.nextT = 0;
  try { speechSynthesis.cancel(); } catch {}
  Q.waiters.forEach(r => r()); Q.waiters.clear(); setPending(false);
  if (Voice.speaking) finish();
}

// ---------------------------------------------------------------- synthesis (cached, parallel) ----------------------------------------------------------------
const cache = new Map(), ready = new Map();
const vkey = t => [S.voice.engine, S.voice.preset, S.voice.pitch, S.voice.rate, t].join('|');
async function fetchAudio(text) {
  const ve = VOICES.find(x => x.id === S.voice.preset) || VOICES[0];
  if (S.voice.engine === 'cloud' && S.voice.googleKey) {
    const c = ve.cloud, r = await window.aether.fetch({ url: 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(S.voice.googleKey), timeout: 9000,
      json: { input: { text }, voice: { languageCode: c.lang, name: c.name }, audioConfig: { audioEncoding: 'MP3', pitch: clamp(c.pitch + (S.voice.pitch - 1) * 10, -20, 20), speakingRate: clamp(c.rate * S.voice.rate, .5, 2) } } });
    if (r.ok) { try { return { blob: b64Blob(JSON.parse(r.text).audioContent, 'audio/mpeg'), rate: 1 }; } catch {} }
  }
  const f = ve.free, one = async tld => window.aether.fetch({ url: `https://translate.google.${tld}/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(text)}`, binary: true, timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  let r = await one(f.tld); if (!r.ok && f.tld !== 'com') r = await one('com');
  if (r.ok && r.b64) return { blob: b64Blob(r.b64, 'audio/mpeg'), rate: f.speed * S.voice.rate * S.voice.pitch };
  return null;
}
async function fetchRemote(text) {
  for (const c of routeChain('tts')) {
    const r = await window.aether.fetch({ url: c.p.base.replace(/\/$/, '') + '/audio/speech', headers: c.p.apiKey ? { Authorization: 'Bearer ' + c.p.apiKey } : {}, timeout: Math.min(c.p.timeout, 9000), binary: true, json: { model: c.model || 'tts-1', input: text, voice: S.voice.remoteVoice, response_format: 'mp3' } });
    if (r.ok) return { blob: b64Blob(r.b64, r.type || 'audio/mpeg'), rate: 1 };
  }
  return null;
}
function synth(text) {
  const k = vkey(text); if (cache.has(k)) return cache.get(k);
  const p = (async () => (await fetchRemote(text)) || (await fetchAudio(text)))().catch(() => null);
  cache.set(k, p); p.then(r => { if (r) ready.set(k, r); else cache.delete(k); });
  if (cache.size > 80) { const old = cache.keys().next().value; cache.delete(old); ready.delete(old); }
  return p;
}
// first chunk is kept short so sound starts sooner; the rest are synthesised in parallel while the first one plays
function chunks(text) {
  const sents = text.replace(/\s+/g, ' ').match(/[^.!?~]+[.!?~]*/g) || [text], out = [];
  let cur = '';
  for (let s of sents) {
    s = s.trim(); if (!s) continue;
    while (s.length > 170) { const cut = s.lastIndexOf(' ', 150); out.push(s.slice(0, cut > 40 ? cut : 150).trim()); s = s.slice(cut > 40 ? cut : 150).trim(); }
    if (!out.length && !cur && s.length > 70) { const m = /^(.{25,70}?[,;:])\s/.exec(s); if (m) { out.push(m[1]); s = s.slice(m[0].length); } }
    if ((cur + ' ' + s).trim().length > 120) { if (cur) out.push(cur); cur = s; } else cur = (cur + ' ' + s).trim();
  }
  if (cur) out.push(cur); return out.length ? out : [text];
}
const decode = async blob => aCtx().decodeAudioData(await blob.arrayBuffer());
function playBuffer(buf, rate) {
  const ctx = aCtx(); master.gain.value = S.voice.volume;
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = clamp(rate, .6, 2); src.connect(master);
  const t = Math.max(ctx.currentTime + .012, Q.nextT); src.start(t); Q.nextT = t + buf.duration / src.playbackRate.value;
  Q.active.add(src); begin('audio'); src.onended = () => { Q.active.delete(src); if (!Q.active.size) Q.filler = false; checkDone(); }; return src;
}
function speakSystem(text, my) {
  return new Promise(res => {
    try {
      const u = new SpeechSynthesisUtterance(text), vs = speechSynthesis.getVoices(), v = vs.find(x => /en/i.test(x.lang) && /female|zira|samantha|aria|jenny|google (us|uk)/i.test(x.name)) || vs.find(x => /^en/i.test(x.lang));
      if (v) u.voice = v; u.lang = v?.lang || 'en-US'; u.pitch = clamp(1.5 * S.voice.pitch, .5, 2); u.rate = clamp(1.05 * S.voice.rate, .5, 2); u.volume = S.voice.volume;
      M.phon = toPhon(text); M.textDur = Math.max(600, text.length * 62 / u.rate); M.textT0 = performance.now();
      u.onstart = () => { M.textT0 = performance.now(); begin('text'); };
      u.onboundary = e => { if (e.charIndex != null && text.length) M.textT0 = performance.now() - M.textDur * (e.charIndex / text.length); };
      u.onend = u.onerror = () => { Q.waiters.delete(res); res(); };
      Q.waiters.add(res); speechSynthesis.speak(u); setTimeout(() => { if (!Voice.speaking && my === token) { begin('text'); } }, 600);
    } catch { res(); }
  });
}
function textOnly(text, my) {   // silent fallback: lips still move for the length of the sentence, caption still shows
  return new Promise(res => {
    M.phon = toPhon(text); M.textDur = Math.max(700, text.length * 62); M.textT0 = performance.now(); begin('text'); Q.waiters.add(res);
    setTimeout(() => { Q.waiters.delete(res); res(); }, M.textDur);
  });
}

export async function speak(text) {
  text = (text || '').replace(/[♪♥✦★*_`#]/g, '').trim(); if (!text) return;
  const ctx = aCtx(), keep = Q.filler && Q.nextT > ctx.currentTime + .02;
  if (!keep) stopSpeaking();
  const my = ++token, parts = chunks(text); Q.sessions++; setPending(true);
  const jobs = parts.map((p, i) => (i < 3 ? synth(p) : null));
  let last = null;
  try {
    for (let i = 0; i < parts.length; i++) {
      if (i + 3 < parts.length) jobs[i + 3] = synth(parts[i + 3]);
      const res = await (jobs[i] || synth(parts[i])); if (my !== token) return;
      if (res) { let buf; try { buf = await decode(res.blob); } catch { buf = null; } if (my !== token) return; if (buf) { last = playBuffer(buf, res.rate); continue; } }
      if (last) { await new Promise(r => { Q.waiters.add(r); const o = last.onended; last.onended = () => { o?.(); r(); }; }); last = null; if (my !== token) return; }
      if (S.voice.sysFallback && 'speechSynthesis' in window) await speakSystem(parts[i], my); else await textOnly(parts[i], my);
      if (my !== token) return;
    }
    if (last) await new Promise(r => { Q.waiters.add(r); const o = last.onended; last.onended = () => { o?.(); r(); }; });
  } finally { Q.sessions--; if (my === token) { setPending(false); checkDone(); } }
}

// quick backchannel ("Mm-hm!") played only if it is already cached, so it never adds delay itself
const FILLERS = ['Mm-hm!', 'Okay!', 'Sure!', 'Let me see...', 'One sec!'];
export const warmVoice = () => { FILLERS.forEach(synth); };
export async function acknowledge() {
  if (Voice.speaking || Voice.pending) return false;
  const t = FILLERS[(Math.random() * FILLERS.length) | 0], r = ready.get(vkey(t)); if (!r) return false;
  try { const buf = await decode(r.blob); if (Voice.speaking) return false; Q.filler = true; playBuffer(buf, r.rate); return true; } catch { return false; }
}

// ---------------------------------------------------------------- always-on listening ----------------------------------------------------------------
export const Ear = { on: false, status: 'off', awakeUntil: 0, onText: null, onStatus: null, stream: null, shortOk: () => false };
const GREET = new Set(['hello', 'hi', 'hey', 'yo', 'ok', 'okay', 'hallo', 'hullo', 'helo', 'hay', 'aye', 'hello,', 'a']);
const PIXIE = new Set(['pixie', 'pixi', 'pixy', 'picky', 'pickie', 'pixel', 'pizzy', 'pitzi', 'piksi', 'fixie', 'pixies', 'pixiee', 'pitsy', 'pixey', 'pixxie', 'pissy', 'pixieee', 'bixie', 'pixy.', 'pexi', 'pixa']);
const JUNK = /^(thank you\.?|thanks for watching\.?|thanks for watching!?|you\.?|bye\.?|\.+|um+\.?|uh+\.?|so\.?|okay\.?|oh\.?|hmm+\.?|mm+\.?|the\.?|subtitles by.*|please subscribe.*)$/i;
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const isPixie = w => !!w && (PIXIE.has(w) || 1 - lev(w, 'pixie') / Math.max(w.length, 5) >= .6);
function findWake(t) { const w = t.split(/\s+/).map(x => x.toLowerCase().replace(/[^a-z']/g, '')); for (let i = 0; i < w.length; i++) { if (GREET.has(w[i]) && isPixie(w[i + 1])) return i + 2; if (i === 0 && isPixie(w[0])) return 1; } return -1; }
export const isWake = t => findWake(t) >= 0;
export const stripWake = t => { const k = findWake(t); return k < 0 ? t : t.split(/\s+/).slice(k).join(' ').replace(/^[,.!?\s-]+/, '').trim(); };
function setStatus(s) { Ear.status = s; Ear.onStatus?.(s); }
const wav = (f32, rate) => { const b = new ArrayBuffer(44 + f32.length * 2), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + f32.length * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, f32.length * 2, true);
  for (let i = 0; i < f32.length; i++) v.setInt16(44 + i * 2, clamp(f32[i], -1, 1) * 32767, true); return b; };
const toB64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
// clean-up before recognition: remove rumble (high-pass ~90 Hz) and normalise level so quiet voices are recognised as well as loud ones
export function prepare(f, rate = 16000) {
  const a = Math.exp(-2 * Math.PI * 90 / rate), out = new Float32Array(f.length); let y = 0, x1 = 0, peak = 0;
  for (let i = 0; i < f.length; i++) { y = a * (y + f[i] - x1); x1 = f[i]; out[i] = y; const p = Math.abs(y); if (p > peak) peak = p; }
  const g = peak > .004 ? Math.min(10, .9 / peak) : 1; for (let i = 0; i < out.length; i++) out[i] *= g; return out;
}
const vocab = () => `Pixie. Hello Pixie. ${S.user}. Spotify, YouTube, Chrome, Notepad, WhatsApp, click, button, scroll, screenshot, timer, search. ${(S.macros || []).slice(0, 6).map(m => m.phrase).join('. ')}`.slice(0, 380);

export async function transcribe(buf) {
  const b64 = toB64(buf);
  for (const c of routeChain('stt')) {
    const fields = { model: c.model || 'whisper-large-v3-turbo', response_format: 'verbose_json', temperature: '0', prompt: vocab() }; if (S.lang && S.lang !== 'auto') fields.language = S.lang;
    const r = await window.aether.fetch({ url: c.p.base.replace(/\/$/, '') + '/audio/transcriptions', headers: c.p.apiKey ? { Authorization: 'Bearer ' + c.p.apiKey } : {}, timeout: Math.min(c.p.timeout, 9000), audioB64: b64, audioType: 'audio/wav', audioName: 'speech.wav', fields });
    if (!r.ok) continue;
    try { const j = JSON.parse(r.text), segs = j.segments;
      if (Array.isArray(segs) && segs.length) return segs.filter(x => !(x.no_speech_prob > .6 || x.avg_logprob < -1.15 || x.compression_ratio > 2.6)).map(x => x.text).join(' ').trim();   // drop hallucinated / low-confidence segments
      return (j.text || '').trim(); } catch {}
  }
  return null;
}

const WORKLET = `class V extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(512);this.n=0}process(i){const x=i[0]&&i[0][0];if(!x)return true;for(let k=0;k<x.length;k++){this.b[this.n++]=x[k];if(this.n===512){this.port.postMessage(this.b.slice(0));this.n=0}}return true}}registerProcessor('vad',V)`;
export async function startEar() {
  if (Ear.on) return true;
  if (!routeChain('stt').length) { setStatus('needs-key'); return false; }
  try {
    const RATE = 16000, ctx = new AudioContext({ sampleRate: RATE, latencyHint: 'interactive' });
    Ear.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(Ear.stream), mute = ctx.createGain(); mute.gain.value = 0; mute.connect(ctx.destination);
    let floor = .004, speech = [], pre = [], inSpeech = false, lastLoud = 0, lastLoudIdx = 0, startT = 0, run = 0, inflight = 0, chain = Promise.resolve();
    const FRAME_MS = 512 / RATE * 1000;
    const onFrame = d => {
      const now = performance.now(); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; const rms = Math.sqrt(s / d.length);
      if (Voice.speaking || Date.now() - Voice.lastEnd < 380) { speech = []; inSpeech = false; run = 0; return; }   // do not hear herself
      const loud = rms > Math.max(.011, floor * 3); if (!loud) floor += (rms - floor) * .012; run = loud ? run + 1 : 0;
      if (loud && run >= 2) { if (!inSpeech) { inSpeech = true; startT = now; speech = pre.slice(); } lastLoud = now; lastLoudIdx = speech.length; }
      if (inSpeech) { speech.push(d); const silent = now - lastLoud, dur = lastLoud - startT, hang = dur > 2200 ? 640 : dur > 900 ? 520 : 440;   // short phrases end sooner = faster reply
        if (silent > hang || now - startT > 12000) { inSpeech = false; const chunk = speech.slice(0, lastLoudIdx + 6); speech = []; if (dur > (Ear.shortOk() ? 140 : 240)) flush(chunk); } }
      else { pre.push(d); if (pre.length > 14) pre.shift(); }
    };
    let node = null;
    try { const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })); await ctx.audioWorklet.addModule(url); node = new AudioWorkletNode(ctx, 'vad', { numberOfOutputs: 1, outputChannelCount: [1] }); node.port.onmessage = e => onFrame(e.data); src.connect(node); node.connect(mute); }
    catch { const proc = ctx.createScriptProcessor(1024, 1, 1); proc.onaudioprocess = e => { const d = e.inputBuffer.getChannelData(0); onFrame(new Float32Array(d.subarray(0, 512))); onFrame(new Float32Array(d.subarray(512, 1024))); }; src.connect(proc); proc.connect(mute); node = proc; }
    Ear.on = true; Ear.ctx = ctx; Ear.node = node; setStatus('listening');
    const c0 = routeChain('stt')[0]; if (c0) window.aether.fetch({ url: c0.p.base.replace(/\/$/, '') + '/models', headers: c0.p.apiKey ? { Authorization: 'Bearer ' + c0.p.apiKey } : {}, timeout: 5000 }).catch(() => {});   // pre-open the TLS connection
    function flush(chunk) {   // capture keeps running while earlier clips are still being transcribed; results are delivered in order
      inflight++; setStatus('thinking');
      const n = chunk.reduce((a, c) => a + c.length, 0), all = new Float32Array(n); let o = 0; chunk.forEach(c => { all.set(c, o); o += c.length; });
      const job = transcribe(wav(prepare(all, RATE), RATE));
      chain = chain.then(async () => { try { const text = await job; if (text && !JUNK.test(text.trim())) Ear.onText?.(text.trim()); else if (text === null) setStatus('error'); } catch {} inflight--; if (Ear.on && !inflight) setStatus('listening'); });
    }
    return true;
  } catch (e) { setStatus(/denied|NotAllowed/i.test(e.name + e.message) ? 'denied' : 'error'); return false; }
}
export function stopEar() { Ear.on = false; try { Ear.node?.disconnect(); } catch {} Ear.stream?.getTracks().forEach(t => t.stop()); Ear.ctx?.close().catch(() => {}); setStatus('off'); }
