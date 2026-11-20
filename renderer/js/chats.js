// Chat history (ChatGPT-style): conversations are stored in the settings blob, so they survive restarts and sync to every window.
// A conversation is created lazily on the first message, titled from it, and can be reopened, renamed, deleted or searched.
import { S, save } from './store.js';
export const chatBus = new EventTarget();
const emit = n => chatBus.dispatchEvent(new Event(n));
const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const MAX_CHATS = 80, MAX_MSGS = 200;
export const chats = () => (Array.isArray(S.chats) ? S.chats : (S.chats = []));
export const current = () => chats().find(c => c.id === S.chatId) || null;
const title = t => { t = t.replace(/\s+/g, ' ').trim(); return t.length > 38 ? t.slice(0, 36).trim() + '…' : t || 'New chat'; };
function ensure() {
  let c = current();
  if (!c) { c = { id: uid(), title: 'New chat', created: Date.now(), updated: Date.now(), msgs: [] }; chats().unshift(c); S.chatId = c.id; if (chats().length > MAX_CHATS) chats().length = MAX_CHATS; emit('list'); }
  return c;
}
export function record(role, text) {   // role: 'u' (user) or 'a' (Pixie)
  text = String(text || '').trim(); if (!text) return;
  const c = ensure(); c.msgs.push({ r: role, t: text.slice(0, 1500), ts: Date.now() });
  if (c.msgs.length > MAX_MSGS) c.msgs.splice(0, c.msgs.length - MAX_MSGS);
  if (role === 'u' && c.title === 'New chat') c.title = title(text);
  c.updated = Date.now(); const i = chats().indexOf(c); if (i > 0) { chats().splice(i, 1); chats().unshift(c); }
  save(); emit('message'); emit('list');
}
export const newChat = () => { S.chatId = null; save(); emit('switch'); emit('list'); };
export function openChat(id) { if (chats().some(c => c.id === id)) { S.chatId = id; save(); emit('switch'); emit('list'); } }
export function renameChat(id, t) { const c = chats().find(x => x.id === id); if (c && t.trim()) { c.title = title(t); save(); emit('list'); } }
export function deleteChat(id) { S.chats = chats().filter(c => c.id !== id); if (S.chatId === id) { S.chatId = null; emit('switch'); } save(); emit('list'); }
export function clearAll() { S.chats = []; S.chatId = null; save(); emit('switch'); emit('list'); }
// recent turns in the format the model expects (assistant turns wrapped as the JSON reply format Pixie uses)
export const historyFor = (n = 8) => (current()?.msgs || []).slice(-n).map(m => m.r === 'u' ? { role: 'user', content: m.t } : { role: 'assistant', content: JSON.stringify({ say: m.t, emotion: 'happy', actions: [] }) });
