// Pixie's brain: personality, action registry (local + API tasks), confirm-before-acting flow,
// offline command router, macros, and the primary -> fallback -> fallback2 -> offline model dispatcher.
import { S, routeChain, save } from './store.js';
import { speak, stopSpeaking, acknowledge, warmVoice } from './voice.js';
import { setEmotion, react, burst, shock, fallAsleep, EMOTIONS, setBusy } from './character.js';
import { record, chatBus, historyFor } from './chats.js';
import { Sound } from './sound.js';
import { Vision } from './vision.js';

export const Agent = { compact: false, caption: () => {}, expand: () => {}, openSettings: () => {}, confirmUI: () => {}, history: [], focusEnd: 0, token: 0, tasks: 0 };
const delay = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[(Math.random() * a.length) | 0];
const u = () => S.user || 'friend';
const nat = (name, args) => window.aether ? window.aether.agent(name, args) : Promise.resolve({ ok: false, error: 'desktop only' });
const hl = (rect, label) => window.aether?.hudSend({ t: 'highlight', rect, label, ms: 30000 });
const hlClear = () => window.aether?.hudSend({ t: 'clear' });
export const llmAvailable = () => routeChain('chat').length || routeChain('agent').length;

const shorten = t => { const one = (t.match(/^[^.!?~]+[.!?~]?/) || [t])[0].trim(), w = one.split(/\s+/); return w.length > 12 ? w.slice(0, 12).join(' ') + '…' : one; };
export async function say(text, emo = 'neutral', hold = 5000) { record('a', text); if (Agent.compact) text = shorten(text); setEmotion(emo, hold); Agent.caption(text); Agent.expand(); await speak(text, emo); }

// ---------- confirm-before-acting ----------
const P = { cur: null };
export const hasPending = () => !!P.cur;
export function resolvePending(yes) { const c = P.cur; if (!c) return false; P.cur = null; clearTimeout(c.t); Agent.confirmUI(false); if (yes === 2 && c.next) c.next(); else if (yes === true || yes === 1) c.yes(); else c.no?.(); return true; }
function ask(q, yes, no, next) { clearTimeout(P.cur?.t); P.cur = { yes, no, next, t: setTimeout(() => { P.cur = null; Agent.confirmUI(false); hlClear(); }, 45000) }; Agent.confirmUI(true); return say(q, 'curious', 0); }

// ---------- screen control: find, highlight, confirm, click ----------
const STOP = /\b(the|a|an|on|button|icon|link|tab|option|menu|item|please|that|this|one|field|box|bar)\b/g;
const SYN = { submit: 'send', okay: 'ok', exit: 'close', quit: 'close', x: 'close', cancel: 'close', find: 'search', magnifier: 'search', login: 'sign in', signin: 'sign in', logon: 'sign in', signup: 'sign up', register: 'sign up', settings: 'settings', preferences: 'settings', options: 'settings', config: 'settings', accept: 'agree', subscribe: 'follow', like: 'like', save: 'save', download: 'download', next: 'next', previous: 'back', prev: 'back', return: 'back', go: 'go', play: 'play', pause: 'pause', refresh: 'reload', reload: 'reload' };
const tok = s => s.toLowerCase().replace(STOP, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map(w => SYN[w] || w).join(' ').split(/\s+/).filter(Boolean);
const bigr = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) || 0) + 1); return m; };
function dice(a, b) { const A = bigr(a), B = bigr(b); let h = 0, n = 0; A.forEach((v, k) => { n += v; if (B.has(k)) h += Math.min(v, B.get(k)); }); B.forEach(v => n += v); return n ? 2 * h / n : 0; }
const HINT = [[/\b(button|click|press|tap)\b/, 'Button'], [/\blink\b/, 'Hyperlink'], [/\btab\b/, 'TabItem'], [/\bmenu\b/, 'MenuItem'], [/\b(checkbox|check)\b/, 'CheckBox'], [/\b(box|field|bar|input)\b/, 'Edit']];
const ORD = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, last: -1, '1st': 0, '2nd': 1, '3rd': 2, '4th': 3, '5th': 4 };
// rank on-screen controls against what the user said: exact > contains > token overlap > fuzzy (STT slips), then bonuses for control type,
// size and visibility. "the second search button" picks the 2nd match; ties are broken top-to-bottom, left-to-right.
function rank(els, target) {
  const raw = target.toLowerCase(), ord = Object.keys(ORD).find(k => new RegExp('\\b' + k + '\\b').test(raw)), hint = (HINT.find(h => h[0].test(raw)) || [])[1];
  const tt = tok(target.replace(/\b(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\b/g, '')), tj = tt.join(' '); if (!tj) return [];
  let out = (els || []).map(e => { const n = (e.n || '').toLowerCase(), nj = tok(n).join(' '); if (!nj) return null;
    let sc = nj === tj ? 1 : (nj.includes(tj) || tj.includes(nj)) && Math.min(nj.length, tj.length) >= 3 ? .86 - Math.min(.2, Math.abs(nj.length - tj.length) / 80) : 0;
    if (!sc) { const nt = nj.split(' '), ov = tt.filter(t => nt.includes(t)).length / tt.length; sc = Math.max(ov * .8, dice(nj, tj) * .72); }
    if (sc < .45) return null;
    if (hint && e.t === hint) sc += .07; else if (hint && e.t && e.t !== hint && hint !== 'Edit') sc -= .03;
    if (e.t === 'Button' || e.t === 'Hyperlink' || e.t === 'MenuItem' || e.t === 'TabItem') sc += .02;
    if (e.w < 6 || e.h < 6) sc -= .15; else if (e.w > 700 && e.h > 400) sc -= .2;
    return { ...e, sc }; }).filter(Boolean).sort((a, b) => b.sc - a.sc || a.y - b.y || a.x - b.x);
  if (ord != null && out.length) { const top = out.filter(e => e.sc >= out[0].sc - .12).sort((a, b) => a.y - b.y || a.x - b.x), k = ORD[ord] < 0 ? top.length - 1 : Math.min(ORD[ord], top.length - 1); out = [top[k], ...out.filter(e => e !== top[k])]; }
  return out.slice(0, 6);
}
const kind = t => ({ Button: 'button', Hyperlink: 'link', MenuItem: 'menu item', TabItem: 'tab', CheckBox: 'checkbox', Edit: 'text box' }[t] || 'item');
const NOPHONE = r => r.error === 'Windows only' || /phone/i.test(r.error || '');
const phoneMsg = () => say(`I can't tap inside other apps from a phone yet, ${u()}. But I can open apps, search, set timers and take notes!`, 'confused', 5000);
async function tgt() { if (!document.hasFocus()) return undefined; const r = await nat('target'); return r.ok ? r.hwnd : undefined; }
async function clickUI(target) {
  await say(pick([`Sure! Let me find "${target}"~`, `Looking for "${target}"... one sec, ${u()}!`]), 'thinking', 0);
  const r = await nat('scan', { focus: true });
  if (!r.ok) return NOPHONE(r) ? phoneMsg() : say("I couldn't spot any window to click in. Open it first?", 'confused', 4000);
  const c = rank(r.els, target);
  if (!c.length) return say(`I can't find "${target}" in ${r.title || 'that window'}. Say it another way?`, 'confused', 4000);
  let i = 0;
  const offer = async () => { const e = c[i]; hl(e, e.n);
    await ask(`Use this ${kind(e.t)}, ${u()}? It says "${e.n.slice(0, 40)}".`,
      async () => { hlClear(); const k = await nat('click', { x: e.x + e.w / 2, y: e.y + e.h / 2, hwnd: r.hwnd, invoke: true }); say(k.ok ? pick(['Clicked it!', 'All done! Happy to help~']) : 'Hmm, that click did not land.', k.ok ? 'success' : 'oops', 3500); },
      async () => { i++; if (i < c.length) { await say('Okay, how about this one?', 'curious', 0); offer(); } else { hlClear(); say("Fine, I'll leave it alone~", 'neutral', 3000); } },
      async () => { i = (i + 1) % c.length; await say(i ? 'Next match!' : 'Back to the first one.', 'curious', 0); offer(); }); };
  return offer();
}
async function writeAtCursor(text, enter = false) {
  const r = await nat('scan', { focus: true });
  if (r.ok && r.focused && r.focused.w > 4) hl(r.focused, 'write here');
  const prev = text.length > 90 ? text.slice(0, 90) + '…' : text; Agent.caption(prev);
  return ask(`Should I write this where your cursor is, ${u()}?`,
    async () => { hlClear(); const k = await nat('paste', { text, hwnd: r.hwnd, enter }); say(k.ok ? pick(['Typed it in for you!', 'There you go! Anything else?']) : 'I could not type it there.', k.ok ? 'success' : 'oops', 3500); },
    () => { hlClear(); say('No problem, cancelled!', 'neutral', 3000); });
}

// ---------- LLM ----------
const SYSTEM = () => `You are Pixie, a warm, friendly, cheerful and sweet anime desktop companion and personal agent. You are caring, encouraging and playful, sometimes a little cheeky but always kind and respectful. The user's name is "${u()}". Be genuinely helpful, praise effort, and offer help. ${Agent.compact ? 'Reply in at most 8 words.' : 'Reply with at most two short sentences unless asked to write something.'} Respond ONLY with JSON: {"say":"...","emotion":"${EMOTIONS.join('|')}","actions":[]}. Each action is {"name":...,"args":{...}}. Available actions: open_app{app}, open_url{url}, web_search{query}, click_ui{target}, write_text{text}, compose_text{instruction}, press_keys{combo like ctrl+c}, scroll{direction up|down}, set_timer{minutes,label}, take_note{text}, open_folder{folder}, system{what: minimize_all|lock|battery}, media{key: volume_up|volume_down|volume_mute|media_play|media_next|media_prev}, screenshot{}, focus_mode{}, read_clipboard{}, summarize_selection{}, translate_selection{language}, rewrite_selection{style}, describe_screen{}, calculate{expr}. Only use actions when the user asks you to do something on the computer; chain at most 4. Pick an emotion that matches what you say.`;
const clean = t => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim();
// Waterfall with hedging: the next provider in the chain is started if the current one has not answered after 3.5 s (or fails),
// and the first good answer wins, so one slow provider no longer costs the full timeout.
async function completion(slot, messages, max = 400) {
  let chain = routeChain(slot); if (!chain.length) chain = routeChain(slot === 'chat' ? 'agent' : 'chat'); if (!chain.length) return null;
  const call = async c => { const r = await window.aether.fetch({ url: c.p.base.replace(/\/$/, '') + '/chat/completions', headers: c.p.apiKey ? { Authorization: 'Bearer ' + c.p.apiKey } : {}, timeout: c.p.timeout, json: { model: c.model, messages, temperature: .7, max_tokens: max } });
    if (r.ok) { try { const o = clean(JSON.parse(r.text).choices[0].message.content); if (o) return o; } catch {} } return null; };
  return new Promise(res => { let left = chain.length, done = false, started = 0;
    const fin = v => { if (!done) { done = true; res(v); } };
    const launch = () => { if (done || started >= chain.length) return; const c = chain[started++], hedge = setTimeout(launch, 3500);
      call(c).then(v => { clearTimeout(hedge); if (v) fin(v); else { launch(); } }).catch(() => { clearTimeout(hedge); launch(); }).finally(() => { if (!--left) fin(null); }); };
    launch(); });
}
async function plain(instruction, text, max = 500) { const o = await completion('chat', [{ role: 'system', content: 'Follow the instruction exactly. Output ONLY the result text, no preface, no quotes.' }, { role: 'user', content: `${instruction}\n\n${text}` }], max); return o ? o.trim() : null; }
async function selection() { const hwnd = await tgt(); const s = await nat('selection', { hwnd }); return s.ok ? { text: s.text, hwnd } : null; }
async function selTask(instr, replace) {
  if (!llmAvailable()) return needAI(); const s = await selection(); if (!s) return say(`I don't see any selected text. Highlight something first, ${u()}!`, 'confused', 4000);
  await say('On it, one sec~', 'thinking', 0); const out = await plain(instr, s.text, 700); if (!out) return say('My brain timed out, try again?', 'sad', 3000);
  if (!replace) return say(out.slice(0, 600), 'happy', 8000);
  Agent.caption(out.slice(0, 160)); return ask('Want me to swap your selection for this?', async () => { const k = await nat('paste', { text: out, hwnd: s.hwnd }); say(k.ok ? 'Swapped~' : 'Could not paste it.', k.ok ? 'happy' : 'sad', 3000); }, () => say('Okay, left it as is.', 'neutral', 3000));
}
async function describeScreen() {
  if (!routeChain('vision').length) return say(`I need a vision model for that, ${u()}. Add one under Task routing.`, 'confused', 5000);
  await say('Let me peek at your screen...', 'thinking', 0); const img = await window.aether.capture(); if (!img) return say('I could not grab the screen.', 'confused');
  const out = await completion('vision', [{ role: 'user', content: [{ type: 'text', text: 'In two short sentences, describe what is on this screen.' }, { type: 'image_url', image_url: { url: img } }] }], 200);
  return say(out ? out.replace(/\s+/g, ' ').slice(0, 400) : 'My vision model did not answer. Check the provider in Settings.', out ? 'happy' : 'confused', 8000);
}

// ---------- action registry (used by offline commands, LLM plans, macros and gesture bindings) ----------
const fixApp = a => String(a || '').toLowerCase().replace(/^(the|my|a)\s+/, '').trim();
const KEYMAP = { copy: 'ctrl+c', paste: 'ctrl+v', cut: 'ctrl+x', 'select all': 'ctrl+a', undo: 'ctrl+z', redo: 'ctrl+y', save: 'ctrl+s', 'new tab': 'ctrl+t', 'close tab': 'ctrl+w', refresh: 'f5', reload: 'f5', find: 'ctrl+f', 'go back': 'alt+left', 'go forward': 'alt+right', 'next tab': 'ctrl+tab', 'switch window': 'alt+tab', enter: 'enter', escape: 'esc', tab: 'tab', print: 'ctrl+p', 'new window': 'ctrl+n', 'zoom in': 'ctrl+up', 'full screen': 'f11' };
function focusMode() { Agent.focusEnd = Date.now() + 25 * 60000; Sound.whoosh(); shock(); const t = setInterval(() => { if (!Agent.focusEnd) return clearInterval(t); if (Date.now() >= Agent.focusEnd) { clearInterval(t); Agent.focusEnd = 0; Sound.celebrate(); Agent.tasks++; say(`Time's up, ${u()}! You were so good. Go stretch for me~`, 'cheering'); } }, 1000);
  return say(`Twenty-five minutes of deep focus, starting now, ${u()}. I'll guard the door~`, 'focused', 3000); }
function calc(expr) { let e = String(expr).toLowerCase().replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100*$2)').replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\b(times|multiplied by|x)\b/g, '*').replace(/\b(divided by|over)\b/g, '/').replace(/,/g, '').replace(/\bpercent\b/g, '/100');
  if (!/^[\d\s+\-*/().%]+$/.test(e)) return null; try { const v = Function('"use strict";return (' + e + ')')(); return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null; } catch { return null; } }
export const ACT = {
  open_app: async a => { const app = fixApp(a.app); const r = /\.[a-z]{2,}$/i.test(app) ? await nat('open_url', { url: 'https://' + app }) : await nat('open_app', { app: app.replace(/[^a-z0-9]/g, '') }); return say(r.ok ? pick([`Opening ${app}~`, `${app}, coming right up!`]) : `I don't know how to open ${app} yet.`, r.ok ? 'success' : 'oops', 3000); },
  open_url: async a => { const r = await nat('open_url', { url: a.url }); return say(r.ok ? 'Opening that for you~' : 'That link looks odd.', r.ok ? 'success' : 'oops', 3000); },
  web_search: async a => { await nat('web_search', { query: a.query }); return say(`Searching "${a.query}"~`, 'thinking', 3000); },
  click_ui: async a => clickUI(a.target), write_text: async a => writeAtCursor(String(a.text || ''), !!a.enter),
  compose_text: async a => { if (!llmAvailable()) return needAI(); await say(pick(['Ooh, let me write something nice for you~', "Give me just a moment, I'll make it good!"]), 'thinking', 0);
    const t = await plain(`Write the following. Output only the text itself: ${a.instruction}`, '', 700); return t ? writeAtCursor(t) : say('My brain timed out, try again?', 'sad', 3000); },
  press_keys: async a => { const hwnd = await tgt(); const r = await nat('key', { combo: a.combo, hwnd }); return say(r.ok ? 'Done~' : `I couldn't press ${a.combo}.`, r.ok ? 'success' : 'oops', 2000); },
  scroll: async a => { const r = await nat('scroll', { amount: a.direction === 'up' ? 480 : -480 }); return say(r.ok ? 'Scrolling~' : 'Could not scroll.', 'neutral', 1800); },
  set_timer: async a => { const m = Math.max(.1, Number(a.minutes) || 1), label = a.label || 'your timer'; setTimeout(() => { Sound.celebrate(); nat('notify', { title: 'Pixie', body: label }); say(`Ding ding! ${label}, ${u()}!`, 'excited'); }, m * 60000); return say(`Timer set for ${m < 1 ? Math.round(m * 60) + ' seconds' : m + ' minutes'}~`, 'happy', 3000); },
  take_note: async a => { const r = await nat('note', { text: a.text }); return say(r.ok ? 'Noted and saved in Documents, Pixie, notes.' : 'I could not save that.', r.ok ? 'success' : 'oops', 3500); },
  open_folder: async a => { const r = await nat('open_folder', { folder: a.folder }); return say(r.ok ? `Opening ${a.folder}~` : 'I do not know that folder.', r.ok ? 'success' : 'oops', 2500); },
  system: async a => { if (a.what === 'battery') { const r = await nat('system', a); return say(r.pct == null ? "No battery here, you're plugged into the wall~" : `You're at ${r.pct} percent${r.charging ? ' and charging' : ''}.`, 'neutral', 4000); }
    const r = await nat('system', a); return say(r.ok ? (a.what === 'lock' ? 'Locking up, goodnight~' : 'Poof, all clear!') : 'That did not work.', r.ok ? 'success' : 'oops', 3000); },
  media: async a => { const r = await nat('key', { key: a.key }); return say(r.ok ? 'Got it~' : 'Could not do that.', r.ok ? 'success' : 'oops', 1800); },
  screenshot: async () => { const r = await nat('screenshot'); return say(r.ok ? 'Click! Saved in Pictures, Pixie.' : 'Screenshot failed.', r.ok ? 'success' : 'oops', 3000); },
  focus_mode: async () => focusMode(), read_clipboard: async () => { const r = await nat('clipboard_read'); return say(r.text ? `You copied: ${r.text.slice(0, 300)}` : 'Your clipboard is empty, silly.', 'neutral', 7000); },
  summarize_selection: async () => selTask('Summarize this text in 2-3 short sentences.'), translate_selection: async a => selTask(`Translate this text into ${a.language || 'English'}.`, true),
  rewrite_selection: async a => selTask(`Rewrite this text ${a.style ? 'in a ' + a.style + ' style' : 'to be clearer and fix grammar'}.`, true), describe_screen: async () => describeScreen(),
  calculate: async a => { const v = calc(a.expr); return say(v === null ? "Hmm, my math brain couldn't parse that." : `That's ${v}.`, v === null ? 'confused' : 'happy', 4000); }
};
for (const k of Object.keys(ACT)) { const f = ACT[k]; ACT[k] = async a => { if (!['focus_mode', 'click_ui', 'write_text', 'compose_text'].includes(k)) setEmotion('working'); return f(a); }; }
export async function runActions(list) { for (const a of (list || []).slice(0, 4)) { const f = ACT[a?.name]; if (f) await f(a.args || {}); } }
export async function runBinding(a) {
  const v = a.value || ''; ({ say: () => say(v, 'happy'), emotion: () => { react(v || 'happy', 4000); }, command: () => dispatchAgentTask(v), open: () => ACT.open_app({ app: v }), url: () => ACT.open_url({ url: v }),
    key: () => ACT.press_keys({ combo: v }), webhook: () => window.aether.fetch({ url: v, method: 'POST', json: { source: 'pixie', time: Date.now() }, timeout: 8000 }) }[a.type] || (() => {}))();
}

// ---------- intro + offline commands ----------
async function intro() {
  const my = ++Agent.token, alive = () => my === Agent.token; Sound.wake(); Agent.expand(9000); react('greeting', 4500);
  await say(`Hi ${u()}! I'm Pixie, your friendly desktop buddy. I'm so happy to meet you!`, 'excited'); if (!alive()) return;
  await say('I can see your hands and face, hear you when you say hello Pixie, and help by clicking, typing, searching and opening things.', 'happy'); if (!alive()) return;
  burst('hearts', 12); Sound.chime(); await say('Show me a finger heart any time, I love those! So, what shall we do together?', 'love');
}
const FEEL = { cheer: ['Hey {u}, you are doing better than you think. I am proud of you!', 'Come here, {u}. Deep breath with me. You have totally got this!', 'Tired? That is okay. Sip some water, stretch a bit, and I will cheer you on!'] };
const COMMANDS = [
  [/\b(introduce yourself|run intro|who are you|what are you|tell me about yourself)\b/, () => intro()],
  [/\b(status report|diagnostics?|system status)\b/, () => say(`Tracking at ${Vision.fps} frames per second, ${Vision.latency} milliseconds latency, ${Vision.mode}. You look ${Vision.userMood}, and we have finished ${Agent.tasks} tasks today. Great teamwork!`, 'happy', 7000)],
  [/\b(stop|cancel|end) (the )?(timer|focus)/, () => { Agent.focusEnd = 0; return say('Timer stopped~', 'neutral', 2500); }],
  [/\b(focus mode|lock in|start (the |a )?(timer|pomodoro)|pomodoro|deep work)\b/, () => ACT.focus_mode()],
  [/\b(cheer me up|i'?m (so |really )?(tired|sad|stressed|down|exhausted|bored)|give me (some )?love|motivate me)\b/, () => { react('happy', 6000); burst('hearts', 24); Sound.chime(); return say(pick(FEEL.cheer).replace('{u}', u()), 'adoring', 7000); }],
  [/\b(take|grab|capture) (a )?screen ?shot\b|^screenshot$/, () => ACT.screenshot()],
  [/\b(what'?s|what is|describe|look at|read) (on )?(my |the )?screen\b/, () => ACT.describe_screen()],
  [/\b(summari[sz]e)\b.*\b(this|that|selection|selected|text|it)\b|\bsummari[sz]e (my )?selection\b/, () => ACT.summarize_selection()],
  [/\btranslate (this|that|selection|the selected text)(?: (?:to|into) (\w+))?/, m => ACT.translate_selection({ language: m[2] })],
  [/\b(rewrite|fix|improve|proofread) (this|that|my selection|the selected text|my text)\b/, () => ACT.rewrite_selection({})],
  [/\bread (my |the )?clipboard\b|\bwhat did i copy\b/, () => ACT.read_clipboard()],
  [/\b(volume up|louder|turn (it )?up)\b/, async () => { for (let i = 0; i < 5; i++) await nat('key', { key: 'volume_up' }); return say('Louder, got it~', 'happy', 1800); }],
  [/\b(volume down|quieter|turn (it )?down)\b/, async () => { for (let i = 0; i < 5; i++) await nat('key', { key: 'volume_down' }); return say('Shhh, quieter~', 'neutral', 1800); }],
  [/\b(mute|unmute)\b/, () => ACT.media({ key: 'volume_mute' })], [/\b(next (song|track)|skip (this )?(song|track))\b/, () => ACT.media({ key: 'media_next' })],
  [/\b(previous (song|track)|go back a song)\b/, () => ACT.media({ key: 'media_prev' })], [/\b(pause|play|resume) (the )?(music|song|media|video)\b/, () => ACT.media({ key: 'media_play' })],
  [/\b(minimi[sz]e (everything|all)|show (the )?desktop)\b/, () => ACT.system({ what: 'minimize_all' })], [/\block (my |the )?(screen|computer|pc)\b/, () => ACT.system({ what: 'lock' })],
  [/\bbattery\b/, () => ACT.system({ what: 'battery' })], [/\bopen (my |the )?(documents|downloads|desktop|pictures|music|videos)( folder)?\b/, m => ACT.open_folder({ folder: m[2] })],
  [/\b(set (a |the )?timer|remind me) (?:for |in )?(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour)s?(?: (?:to|that|about) (.+))?/, m => ACT.set_timer({ minutes: +m[3] * (/^s/.test(m[4]) ? 1 / 60 : /^h/.test(m[4]) ? 60 : 1), label: m[5] ? 'Reminder: ' + m[5] : 'Your timer is done' })],
  [/^(?:please )?(?:take a note|note down|note that|remember that|make a note)[:,]?\s*(.+)$/, m => ACT.take_note({ text: m[1] })],
  [/^(?:please )?(?:scroll|go) (up|down)\b/, m => ACT.scroll({ direction: m[1] })], [/^(?:please )?page (up|down)\b/, m => ACT.scroll({ direction: m[1] })],
  [/^(?:please )?(?:press|hit)\s+((?:(?:ctrl|control|alt|shift)\s*(?:\+|plus)?\s*)+(?:[a-z0-9]|f\d{1,2}|enter|tab|esc|escape|delete|backspace|up|down|left|right|home|end|space))$/, m => ACT.press_keys({ combo: m[1].replace(/\s*plus\s*|\s+/g, '+').replace(/\+\+/g, '+') })],
  [new RegExp('^(?:please )?(?:press |hit |do )?(' + Object.keys(KEYMAP).join('|') + ')( that| it)?$'), m => ACT.press_keys({ combo: KEYMAP[m[1]] })],
  [/^(?:please )?(?:click|tap|press|hit|select|choose)\s+(?:on |the )?(.+?)(?: button| link| icon)?$/, m => ACT.click_ui({ target: m[1] })],
  [/^(?:please )?(?:write|compose|draft|generate|create)\s+(?:me\s+)?(?:an?|the|some)\s+(.+)$/, m => ACT.compose_text({ instruction: m[0].replace(/^please /, '') })],
  [/^(?:please )?(?:type|write|enter|dictate|input)\s+(.+)$/, m => ACT.write_text({ text: m[1] })],
  [/^(?:please )?search(?: for)?\s+(.+)$|^google\s+(.+)$|^look up\s+(.+)$/, m => ACT.web_search({ query: m[1] || m[2] || m[3] })],
  [/^(?:please )?play\s+(.+?)(?:\s+on youtube)?$/, m => ACT.open_url({ url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(m[1]) })],
  [/^(?:please )?(?:go to|visit|browse to)\s+(\S+\.\S+)$/, m => ACT.open_url({ url: 'https://' + m[1].replace(/^https?:\/\//, '') })],
  [/^(?:please )?(?:open|launch|start|run)\s+(?!settings\b)(.+)$/, m => ACT.open_app({ app: m[1] })],
  [/\b(open|show) (the )?(settings|studio|configuration)\b|\bconfigure (api|apis|providers?)\b/, () => { Agent.openSettings(); return say('Here are my settings!', 'happy', 3000); }],
  [/\bwhat('?s| is) the (time|date)\b|\bwhat time is it\b|\bwhat day is it\b/, () => { const n = new Date(); return say(`It's ${n.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} on ${n.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}.`, 'happy'); }],
  [/\b(tell me a joke|joke)\b/, () => say(pick(['Why do programmers love dark mode? Because light attracts bugs!', 'I told my computer I needed a break, and it sent me a cat video. Best reply ever!']), 'laughing')],
  [/^(stop|quiet|be quiet|shush|enough)\b/, () => { Agent.token++; stopSpeaking(); setEmotion('neutral'); }],
  [/\b(go to sleep|good ?night|sleep now|take a nap)\b/, async () => { await say(`Good night, ${u()}... sleep well. See you soon! zzz...`, 'sleepy', 0); fallAsleep(); }],
  [/\b(thank you|thanks)\b/, () => say(pick([`You're so welcome, ${u()}!`, 'Anytime! I love helping you.']), 'happy')],
  [/\b(you'?re|you are) (so |very )?(cute|pretty|adorable|amazing|the best|nice|kind|great)\b|\bi love you\b/, () => { burst('hearts', 12); Sound.chime(); return say(pick(["Aww, you're making me blush! Thank you!", 'That is so sweet, ' + u() + '! You are wonderful too!']), 'blushing', 6000); }],
  [/\bhow are you\b|\bhow'?s it going\b/, () => say(`I'm great, especially now that you're here, ${u()}! How is your day going?`, 'happy')],
  [/\b(i had a (bad|rough|hard) day|i'?m having a (bad|rough|hard) day)\b/, () => say(`Oh no, I'm sorry, ${u()}. I'm here with you. Want to take a little break together?`, 'worried', 7000)],
  [/\b(good|great|awesome|fine|wonderful) (day|today)\b|\bi'?m (good|great|happy|fine)\b/, () => { burst('sparkles', 10); return say('Yay, I love hearing that! Let us make it even better!', 'joyful'); }],
  [/^(?:call me|my name is|i am called|you can call me)\s+([a-z][a-z' ]{1,20})$/, m => { S.user = m[1].trim().replace(/\b\w/g, c => c.toUpperCase()); save(); return say(`Nice to meet you, ${S.user}! I'll call you that from now on.`, 'excited'); }],
  [/^(hi|hello|hey|yaho|good (morning|afternoon|evening))\b/, () => { react('greeting', 3500); return say(pick([`Hi ${u()}! So good to see you!`, `Hello ${u()}! What can I do for you?`]), 'greeting'); }],
  [/\bwhat can you do\b|^help$/, () => say('I can open apps and sites, search, click buttons, type for you, scroll, set timers, take notes, and summarize or translate your selected text. Just say hello Pixie!', 'happy', 9000)],
  [/^(?:what is|what's|calculate|compute|how much is)\s+(.+?)\??$/, m => { const v = calc(m[1]); return v === null ? null : ACT.calculate({ expr: m[1] }); }]
];
function offline(text) { const t = text.toLowerCase().replace(/[?!.,]+$/g, '').trim(); for (const [re, fn] of COMMANDS) { const m = re.exec(t); if (m) return () => fn(m, t); } return null; }
const dsc = (a, b) => dice(a.toLowerCase(), b.toLowerCase());
function macro(text) { const t = text.toLowerCase().replace(/[?!.,]+$/g, '').trim(); return (S.macros || []).find(m => m.phrase && (t === m.phrase.toLowerCase() || t.includes(m.phrase.toLowerCase()) || dsc(t, m.phrase) >= .85)); }
function parsePlan(txt) { try { return JSON.parse(txt); } catch {} const m = /\{[\s\S]*\}/.exec(txt); if (m) { try { return JSON.parse(m[0]); } catch {} } return { say: txt.replace(/```[a-z]*|```/g, '').trim(), emotion: 'happy', actions: [] }; }

// ---------- entry point ----------
export async function dispatchAgentTask(input) {
  const text = (input || '').trim(); if (!text) return; Agent.expand(); Agent.caption('You: ' + text);
  const t = text.toLowerCase().replace(/[?!.,]+$/g, '').trim();
  if (P.cur) { if (/^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|confirm|please|correct|that one|right)\b/.test(t)) return resolvePending(true); if (/^(next|another|other|show (me )?(the )?next|skip)\b/.test(t)) return resolvePending(2); if (/^(no|nope|nah|cancel|don'?t|wrong|not that)\b/.test(t)) return resolvePending(false); resolvePending(false); hlClear(); }
  record('u', text);
  const mac = macro(text); if (mac) return runBinding(mac.action);
  const off = offline(text); if (off) { const r = off(); if (r !== null && r !== undefined) return r; }
  if (llmAvailable()) {
    setEmotion('thinking'); Agent.history.push({ role: 'user', content: text }); Agent.history = Agent.history.slice(-8); setBusy(true);
    const fill = setTimeout(() => acknowledge(), 650);   // a quick "Mm-hm!" only if the answer is slow, so waiting never feels like a freeze
    const out = await completion(/\b(open|launch|search|click|type|write|press|scroll|take|set|remind|find|go to|play|close|minimi)/i.test(text) ? 'agent' : 'chat', [{ role: 'system', content: SYSTEM() }, ...Agent.history], 260); clearTimeout(fill); setBusy(false);
    if (out) { const p = parsePlan(out); Agent.history.push({ role: 'assistant', content: out }); const emo = EMOTIONS.includes(p.emotion) ? p.emotion : 'happy';
      if (p.say) await say(p.say, emo, 6000); await runActions(p.actions); return; }
  }
  return say(llmAvailable() ? `I'm having a little trouble thinking, ${u()}. Could you try again?` : `I only know my built-in tricks offline, ${u()}. Add a free Groq key in Settings and I can help with anything!`, 'worried', 6000);
}
chatBus.addEventListener('switch', () => { Agent.history = historyFor(8); });
setTimeout(() => { try { warmVoice(); } catch {} }, 4000);
export const focusLeft = () => Agent.focusEnd ? Math.max(0, Math.round((Agent.focusEnd - Date.now()) / 1000)) : 0;
