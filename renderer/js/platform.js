// Platform layer. On desktop (Electron) the preload script already provides window.aether.
// On Android (Capacitor APK) or in a plain browser, this file installs a compatible window.aether
// so every other module runs unchanged: settings storage, network proxy (native HTTP, no CORS), phone actions.
const Cap = window.Capacitor;
export const NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
export const DESKTOP = !!window.aether;
export const IS_MOBILE = !DESKTOP && (NATIVE || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer:coarse)').matches && Math.min(innerWidth, innerHeight) < 820));
export const PLUGIN = n => { try { return Cap?.Plugins?.[n] || null; } catch { return null; } };
document.documentElement.classList.add(DESKTOP ? 'desktop' : 'mobile');
if (IS_MOBILE) document.documentElement.classList.add('touch');

export const haptic = (ms = 12) => { try { const H = PLUGIN('Haptics'); if (H) H.vibrate({ duration: ms }); else navigator.vibrate?.(ms); } catch {} };

const b64ToBlob = (b64, type) => new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type });
const hudListeners = new Set();

// ---------------- phone actions (what Windows does through UI Automation, a phone does through intents) ----------------
const PKG = { spotify: 'com.spotify.music', youtube: 'com.google.android.youtube', whatsapp: 'com.whatsapp', chrome: 'com.android.chrome', gmail: 'com.google.android.gm', maps: 'com.google.android.apps.maps',
  instagram: 'com.instagram.android', telegram: 'org.telegram.messenger', discord: 'com.discord', netflix: 'com.netflix.mediaclient', facebook: 'com.facebook.katana', twitter: 'com.twitter.android', x: 'com.twitter.android',
  reddit: 'com.reddit.frontpage', amazon: 'com.amazon.mShop.android.shopping', photos: 'com.google.android.apps.photos', drive: 'com.google.android.apps.docs', calculator: 'com.google.android.calculator',
  clock: 'com.google.android.deskclock', calendar: 'com.google.android.calendar', camera: 'com.android.camera', playstore: 'com.android.vending', store: 'com.android.vending', snapchat: 'com.snapchat.android',
  zoom: 'us.zoom.videomeetings', teams: 'com.microsoft.teams', slack: 'com.Slack', linkedin: 'com.linkedin.android', pinterest: 'com.pinterest', tiktok: 'com.zhiliaoapp.musically', phone: 'tel:', messages: 'sms:' };
const SITES = { youtube: 'https://youtube.com', google: 'https://google.com', github: 'https://github.com', gmail: 'https://mail.google.com', twitter: 'https://x.com', x: 'https://x.com', reddit: 'https://reddit.com',
  netflix: 'https://netflix.com', maps: 'https://maps.google.com', chatgpt: 'https://chatgpt.com', instagram: 'https://instagram.com', facebook: 'https://facebook.com', linkedin: 'https://linkedin.com',
  amazon: 'https://amazon.com', wikipedia: 'https://wikipedia.org', drive: 'https://drive.google.com', whatsapp: 'https://web.whatsapp.com', spotify: 'https://open.spotify.com' };
async function openUrl(url) {
  const L = PLUGIN('AppLauncher'), B = PLUGIN('Browser');
  try { if (L) { await L.openUrl({ url }); return { ok: true }; } } catch {}
  try { if (B && /^https?:/.test(url)) { await B.open({ url }); return { ok: true }; } } catch {}
  const w = window.open(url, '_blank'); return { ok: !!w || !NATIVE };
}
const noPhone = { ok: false, error: 'Not available on phone' };
let timerId = 1;
async function notify(title, body, inMs = 150) {
  const N = PLUGIN('LocalNotifications');
  try { if (N) { const p = await N.requestPermissions().catch(() => ({})); if (p.display === 'denied') return { ok: false, error: 'no notification permission' };
    await N.schedule({ notifications: [{ id: (timerId++ % 2000000000) + Math.floor(Math.random() * 1000), title, body, schedule: { at: new Date(Date.now() + inMs), allowWhileIdle: true } }] }); return { ok: true }; } } catch {}
  try { if ('Notification' in window) { if (Notification.permission !== 'granted') await Notification.requestPermission(); if (Notification.permission === 'granted') { setTimeout(() => new Notification(title, { body }), inMs); return { ok: true }; } } } catch {}
  return { ok: false, error: 'notifications unavailable' };
}
async function phoneAgent(name, a = {}) {
  switch (name) {
    case 'open_url': return /^https?:\/\//i.test(a.url || '') ? openUrl(a.url) : { ok: false, error: 'bad url' };
    case 'web_search': return openUrl('https://www.google.com/search?q=' + encodeURIComponent(a.query || ''));
    case 'open_app': {
      const k = String(a.app || '').toLowerCase().replace(/[^a-z0-9]/g, ''), p = PKG[k];
      if (p) { const r = await openUrl(p); if (r.ok) return { ok: true, kind: 'app' }; }
      if (SITES[k]) return { ...(await openUrl(SITES[k])), kind: 'site' };
      return { ok: false, error: 'unknown app' };
    }
    case 'note': { const line = `[${new Date().toLocaleString()}] ${a.text || ''}\n`;
      try { const F = PLUGIN('Filesystem'); if (F) { try { await F.appendFile({ path: 'Pixie/notes.txt', directory: 'DOCUMENTS', data: line, encoding: 'utf8', recursive: true }); } catch { await F.appendFile({ path: 'Pixie/notes.txt', directory: 'DATA', data: line, encoding: 'utf8', recursive: true }); } return { ok: true }; } } catch {}
      try { localStorage.setItem('pixie-notes', (localStorage.getItem('pixie-notes') || '') + line); return { ok: true }; } catch { return { ok: false, error: 'storage' }; } }
    case 'notify': return notify(String(a.title || 'Pixie'), String(a.body || ''));
    case 'timer': return notify(String(a.title || 'Pixie'), String(a.body || 'Timer done'), Math.max(500, (+a.ms || 60000)));
    case 'clipboard_read': try { const C = PLUGIN('Clipboard'); const t = C ? (await C.read()).value : await navigator.clipboard.readText(); return { ok: true, text: String(t || '').slice(0, 4000) }; } catch { return { ok: true, text: '' }; }
    case 'clipboard_write': try { const C = PLUGIN('Clipboard'); if (C) await C.write({ string: String(a.text || '') }); else await navigator.clipboard.writeText(String(a.text || '')); return { ok: true }; } catch { return { ok: false }; }
    case 'system': if (a.what === 'battery') { try { const b = await navigator.getBattery(); return { ok: true, pct: Math.round(b.level * 100), charging: b.charging }; } catch { return { ok: true, pct: null }; } } return noPhone;
    default: return noPhone;   // click / key / scroll / scan / paste / selection / screenshot / folders need a desktop
  }
}

// ---------------- network proxy ----------------
async function netFetch(o) {
  const t0 = Date.now(), ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), o.timeout || 15000);
  try {
    const headers = { ...(o.headers || {}) };
    if (o.audioB64) {   // multipart speech upload: the WebView's own fetch (Groq allows browser CORS)
      const fd = new FormData(); fd.append('file', b64ToBlob(o.audioB64, o.audioType || 'audio/wav'), o.audioName || 'audio.wav');
      for (const [k, v] of Object.entries(o.fields || {})) fd.append(k, v);
      const r = await fetch(o.url, { method: 'POST', headers, body: fd, signal: ctrl.signal });
      return { ok: r.ok, status: r.status, ms: Date.now() - t0, text: await r.text() };
    }
    const H = NATIVE ? PLUGIN('CapacitorHttp') : null;
    if (H) {   // native HTTP stack: no CORS, so Google's TTS endpoint and any custom server work
      if (o.json) headers['Content-Type'] = 'application/json';
      const r = await H.request({ url: o.url, method: o.method || (o.json ? 'POST' : 'GET'), headers, data: o.json, responseType: o.binary ? 'blob' : 'text', connectTimeout: o.timeout || 15000, readTimeout: o.timeout || 15000 });
      const ok = r.status >= 200 && r.status < 300, ct = r.headers?.['Content-Type'] || r.headers?.['content-type'] || '';
      if (o.binary) return { ok, status: r.status, ms: Date.now() - t0, b64: typeof r.data === 'string' ? r.data : '', type: ct };
      return { ok, status: r.status, ms: Date.now() - t0, text: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) };
    }
    const hasBody = !!o.json; if (hasBody) headers['Content-Type'] = 'application/json'; delete headers['User-Agent'];
    const r = await fetch(o.url, { method: o.method || (hasBody ? 'POST' : 'GET'), headers, body: hasBody ? JSON.stringify(o.json) : undefined, signal: ctrl.signal });
    if (o.binary) { const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); return { ok: r.ok, status: r.status, ms: Date.now() - t0, b64: btoa(s), type: r.headers.get('content-type') }; }
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, text: await r.text() };
  } catch (err) { return { ok: false, status: 0, error: err.name === 'AbortError' ? 'timeout' : String(err.message || err) }; }
  finally { clearTimeout(timer); }
}

function grabCamera() {   // "describe my screen" on a phone looks through the camera instead
  const v = document.getElementById('cam'); if (!v || !v.videoWidth) return null;
  const c = document.createElement('canvas'), k = Math.min(1, 960 / v.videoWidth); c.width = v.videoWidth * k; c.height = v.videoHeight * k; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .7);
}

if (!DESKTOP) {
  const KEY = 'pixie';
  window.aether = {
    platform: NATIVE ? 'android' : 'web',
    getSettings: async () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
    setSettings: async s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} return true; },
    onSettings: () => {}, isActive: async () => true, onActive: () => {},
    fetch: netFetch, agent: (name, args) => phoneAgent(name, args), capture: async () => grabCamera(),
    islandIgnore: () => {}, restore: () => window.dispatchEvent(new Event('pixie:restore')),
    hudSet: () => {}, hudSend: m => hudListeners.forEach(f => f(m)), onHud: cb => hudListeners.add(cb)
  };
}
