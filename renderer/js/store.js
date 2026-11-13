// Settings, provider vault and task routing. Persisted through the main process (keys encrypted).
export const PRESETS = [
  { id: 'offline', name: 'Local Offline Engine', base: '', builtin: true, models: [] },
  { id: 'freellm', name: 'FreeLLMAPI Router', base: 'http://localhost:8080/v1', models: ['auto'] },
  { id: 'hf', name: 'Hugging Face Router', base: 'https://router.huggingface.co/v1', models: ['meta-llama/Llama-3.3-70B-Instruct'] },
  { id: 'groq', name: 'Groq Cloud (free tier)', base: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'whisper-large-v3-turbo', 'meta-llama/llama-4-scout-17b-16e-instruct'] },
  { id: 'nvidia', name: 'NVIDIA NIM (build.nvidia.com, free credits)', base: 'https://integrate.api.nvidia.com/v1', timeout: 25000, keyUrl: 'build.nvidia.com', keyHint: 'nvapi-…',
    note: 'Free hosted models from NVIDIA. Get a key (starts with nvapi-) at build.nvidia.com ▸ any model ▸ “Get API key”. Chat, agent and vision slots all work; press “Fetch models” to load the full live catalogue. Reasoning models (deepseek-r1, nemotron-ultra) think first, so prefer the non-reasoning ones for snappy replies.',
    models: ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-405b-instruct', 'meta/llama-4-maverick-17b-128e-instruct', 'meta/llama-4-scout-17b-16e-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct', 'nvidia/llama-3.3-nemotron-super-49b-v1', 'nvidia/llama-3.3-nemotron-super-49b-v1.5', 'nvidia/llama-3.1-nemotron-ultra-253b-v1', 'nvidia/nemotron-nano-12b-v2-vl',
      'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'deepseek-ai/deepseek-v3.1', 'deepseek-ai/deepseek-r1', 'qwen/qwen3-235b-a22b', 'qwen/qwen2.5-coder-32b-instruct', 'moonshotai/kimi-k2-instruct',
      'mistralai/mistral-large-2-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1', 'google/gemma-3-27b-it', 'microsoft/phi-4-multimodal-instruct', 'meta/llama-3.2-90b-vision-instruct', 'meta/llama-3.2-11b-vision-instruct', 'microsoft/phi-3.5-vision-instruct'] },
  { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', models: ['meta-llama/llama-3.3-70b-instruct:free'] },
  { id: 'ollama', name: 'Ollama Local', base: 'http://localhost:11434/v1', models: ['llama3.2', 'llava'] },
  { id: 'voice', name: 'Edge-TTS / Kokoro Local', base: 'http://localhost:8880/v1', models: ['kokoro', 'tts-1'] }
];
export const SLOTS = [
  { id: 'agent', label: 'Agentic tool-calling & OS automation' }, { id: 'vision', label: 'Screen vision (VLM)' }, { id: 'chat', label: 'Companion chat & personality' },
  { id: 'tts', label: 'Voice synthesis (extra TTS server)' }, { id: 'stt', label: 'Speech recognition (wake word & voice)' }
];
export const LEVELS = ['primary', 'fallback', 'fallback2'];
// Five cute Google voices. Cloud = Google Cloud TTS (needs a key, best quality). Free = Google Translate voice (no key), pitch-lifted in the player.
export const VOICES = [
  { id: 'mochi', name: 'Mochi', desc: 'Soft & sweet, young US voice', cloud: { name: 'en-US-Neural2-H', lang: 'en-US', pitch: 9, rate: 1.08 }, free: { tld: 'com', speed: 1.14 } },
  { id: 'bubbles', name: 'Bubbles', desc: 'Bright, bubbly and very high', cloud: { name: 'en-US-Neural2-F', lang: 'en-US', pitch: 12, rate: 1.05 }, free: { tld: 'com', speed: 1.24 } },
  { id: 'candy', name: 'Candy', desc: 'Playful, a little sassy', cloud: { name: 'en-US-Wavenet-H', lang: 'en-US', pitch: 7, rate: 1.12 }, free: { tld: 'com', speed: 1.17 } },
  { id: 'berry', name: 'Berry', desc: 'Sweet British girl', cloud: { name: 'en-GB-Neural2-A', lang: 'en-GB', pitch: 8, rate: 1.08 }, free: { tld: 'co.uk', speed: 1.14 } },
  { id: 'sprinkle', name: 'Sprinkle', desc: 'Cheeky Aussie sparkle', cloud: { name: 'en-AU-Neural2-A', lang: 'en-AU', pitch: 8, rate: 1.1 }, free: { tld: 'com.au', speed: 1.16 } }
];
const route = (p, f, f2) => ({ primary: p, fallback: f, fallback2: f2 || { provider: 'offline', model: '' } });
const off = { provider: 'offline', model: '' };
export const defaults = () => ({
  chats: [], chatId: null, user: 'friend', lang: 'en', care: true, camera: true, worker: true, hud: false, wake: true, gloves: true,
  voice: { engine: 'free', preset: 'mochi', googleKey: '', pitch: 1, rate: 1, volume: 1, remoteVoice: 'af_heart', sysFallback: !!window.Capacitor?.isNativePlatform?.() },
  faceId: { threshold: 0.8 }, bindings: [], macros: [],
  providers: PRESETS.map(p => ({ ...p, apiKey: '', timeout: p.timeout || 15000 })),
  routing: {
    agent: route({ provider: 'groq', model: 'llama-3.3-70b-versatile' }, { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' }, { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct' }),
    chat: route({ provider: 'groq', model: 'llama-3.3-70b-versatile' }, { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' }, { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct' }),
    vision: route({ provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' }, { provider: 'nvidia', model: 'meta/llama-3.2-90b-vision-instruct' }),
    tts: route(off, off), stt: route({ provider: 'groq', model: 'whisper-large-v3-turbo' }, { provider: 'groq', model: 'whisper-large-v3' })
  }
});
export const S = defaults();
let saveTimer = null; const listeners = new Set(); export const onChange = fn => listeners.add(fn);
function merge(saved) {
  if (!saved) return; const d = defaults();
  Object.assign(S, d, saved, { voice: { ...d.voice, ...(saved.voice || {}) }, faceId: { ...d.faceId, ...(saved.faceId || {}) } });
  const have = new Set((saved.providers || []).map(p => p.id));
  S.providers = [...(saved.providers || []).map(p => { const pre = d.providers.find(x => x.id === p.id); return pre ? { ...p, models: [...new Set([...(pre.models || []), ...(p.models || [])])], note: pre.note, keyUrl: pre.keyUrl, keyHint: pre.keyHint } : p; }), ...d.providers.filter(p => !have.has(p.id))];
  if (!Array.isArray(S.chats)) S.chats = [];
  S.routing = Object.fromEntries(SLOTS.map(s => [s.id, { ...d.routing[s.id], ...((saved.routing || {})[s.id] || {}) }]));
  S.routing = Object.fromEntries(Object.entries(S.routing).map(([k, r]) => [k, Object.fromEntries(Object.entries(r).map(([l, v]) => [l, v && v.provider && !S.providers.some(p => p.id === v.provider) ? { provider: 'offline', model: '' } : v]))]));
}
export async function loadStore() {
  try { merge(window.aether ? await window.aether.getSettings() : JSON.parse(localStorage.getItem('pixie') || 'null')); } catch {}
  window.aether?.onSettings(s => { merge(s); listeners.forEach(f => f()); });
}
export function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { window.aether ? window.aether.setSettings(S) : localStorage.setItem('pixie', JSON.stringify(S)); }, 250); }
export const provider = id => S.providers.find(p => p.id === id);
export const isOffline = id => !id || id === 'offline';
const needsKey = b => !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(b);
// Waterfall chain: primary -> fallback -> fallback2, skipping offline entries and cloud providers with no key.
export function routeChain(slot) {
  const r = S.routing[slot] || {};
  return LEVELS.map(l => r[l]).filter(x => x && !isOffline(x.provider)).map(x => ({ ...x, p: provider(x.provider) }))
    .filter(x => x.p && x.p.base && (!needsKey(x.p.base) || x.p.apiKey));
}
export const exportRouting = () => JSON.stringify({ providers: S.providers.map(p => ({ ...p, apiKey: '' })), routing: S.routing }, null, 2);
export function importRouting(text) {
  const j = JSON.parse(text);
  (j.providers || []).forEach(p => { const o = provider(p.id); if (o) Object.assign(o, p, { apiKey: o.apiKey }); else S.providers.push({ ...p, apiKey: '' }); });
  if (j.routing) S.routing = { ...S.routing, ...j.routing }; save();
}
