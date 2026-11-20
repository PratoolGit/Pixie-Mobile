// ChatGPT-style sidebar: toggle button in the top-left corner of the dashboard. Opens a drawer with "New chat", "Chat" and the
// searchable, date-grouped chat history (open / rename / delete). Opening a chat shows its transcript in a panel; new messages stream into it live.
import { chats, current, newChat, openChat, renameChat, deleteChat, clearAll, chatBus } from './chats.js';
import { S } from './store.js';
import { Agent } from './router.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
const ICON = { side: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3.5"/><path d="M9.5 4v16"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chat: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  del: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>' };
let open = false, threadOpen = false, query = '', renaming = null, confirmDel = null, delT = null;

function group(c) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const age = Math.round((d0.getTime() - new Date(c.updated).setHours(0, 0, 0, 0)) / 864e5);
  return age <= 0 ? 'Today' : age === 1 ? 'Yesterday' : age <= 7 ? 'Previous 7 days' : age <= 30 ? 'Previous 30 days' : 'Older';
}
const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function renderList() {
  const list = $('sbList'); if (!list) return; const q = query.trim().toLowerCase();
  const all = chats().filter(c => !q || c.title.toLowerCase().includes(q) || c.msgs.some(m => m.t.toLowerCase().includes(q)));
  if (!all.length) { list.innerHTML = `<p class="sb-empty">${q ? 'No chats match.' : 'No chats yet. Say hi to Pixie!'}</p>`; return; }
  let html = '', last = '';
  for (const c of all) {
    const g = group(c); if (g !== last) { html += `<h6>${g}</h6>`; last = g; }
    const act = c.id === S.chatId;
    html += `<div class="sb-item ${act ? 'on' : ''}" data-id="${c.id}" tabindex="0" role="button">${renaming === c.id
      ? `<input class="sb-rename" value="${esc(c.title)}" maxlength="60" aria-label="Rename chat">`
      : `<span class="sb-title">${esc(c.title)}</span><span class="sb-acts"><button data-a="rename" title="Rename" aria-label="Rename">${ICON.edit}</button><button data-a="del" class="${confirmDel === c.id ? 'warn' : ''}" title="Delete" aria-label="Delete">${confirmDel === c.id ? 'Delete?' : ICON.del}</button></span>`}</div>`;
  }
  list.innerHTML = html;
  const inp = list.querySelector('.sb-rename'); if (inp) { inp.focus(); inp.select(); }
}
function renderThread() {
  const body = $('thBody'); if (!body) return; const c = current();
  $('thTitle').textContent = c ? c.title : 'New chat';
  if (!c || !c.msgs.length) { body.innerHTML = `<div class="th-empty"><b>Start a new conversation</b><span>Talk to Pixie or type below. This chat will be saved here.</span></div>`; return; }
  body.innerHTML = c.msgs.map(m => `<div class="msg ${m.r === 'u' ? 'me' : 'pix'}"><div class="bub">${esc(m.t)}</div><time>${fmtTime(m.ts)}</time></div>`).join('');
  body.scrollTop = body.scrollHeight;
}
function setOpen(v) { open = v; document.body.classList.toggle('side-open', v); $('sidebar').setAttribute('aria-hidden', !v); $('sideBtn').setAttribute('aria-expanded', v); if (v) { renderList(); setTimeout(() => $('sbSearch')?.blur(), 0); } }
function setThread(v) { threadOpen = v; document.body.classList.toggle('thread-open', v); if (v) renderThread(); }
const closeIfNarrow = () => { if (innerWidth < 900) setOpen(false); };

export function initSidebar() {
  const mk = (tag, attrs, html) => { const e = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (html) e.innerHTML = html; return e; };
  const btn = mk('button', { id: 'sideBtn', 'aria-label': 'Chats and history', title: 'Chats', 'aria-expanded': 'false', 'aria-controls': 'sidebar' }, ICON.side);
  const scrim = mk('div', { id: 'scrim' });
  const side = mk('aside', { id: 'sidebar', 'aria-label': 'Chat sidebar', 'aria-hidden': 'true' }, `
    <div class="sb-head"><b>Pixie</b><button id="sbClose" aria-label="Close sidebar">${ICON.side}</button></div>
    <div class="sb-menu"><button id="sbNew" class="sb-main">${ICON.plus}<span>New chat</span></button><button id="sbChat" class="sb-main">${ICON.chat}<span>Chat</span></button></div>
    <input id="sbSearch" type="search" placeholder="Search chats" aria-label="Search chats" autocomplete="off">
    <div class="sb-label">Chat history</div><div id="sbList" class="sb-list"></div>
    <div class="sb-foot"><button id="sbClear">Clear all chats</button></div>`);
  const thread = mk('section', { id: 'thread', 'aria-label': 'Conversation' }, `<header><b id="thTitle">New chat</b><button id="thClose" aria-label="Close conversation">×</button></header><div id="thBody"></div>`);
  document.body.append(btn, scrim, side, thread);

  btn.onclick = e => { e.stopPropagation(); setOpen(!open); };
  $('sbClose').onclick = scrim.onclick = () => setOpen(false);
  $('thClose').onclick = () => setThread(false);
  $('sbNew').onclick = () => { newChat(); setThread(false); closeIfNarrow(); $('chatInput')?.focus(); Agent.caption('New chat started. What shall we talk about?'); };
  $('sbChat').onclick = () => { setThread(!threadOpen || !current() ? true : false); closeIfNarrow(); };
  $('sbSearch').oninput = e => { query = e.target.value; renderList(); };
  $('sbClear').onclick = e => { const b = e.currentTarget; if (b.dataset.sure) { clearAll(); setThread(false); b.dataset.sure = ''; b.textContent = 'Clear all chats'; } else { b.dataset.sure = '1'; b.textContent = 'Tap again to confirm'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Clear all chats'; }, 3000); } };
  const list = $('sbList');
  list.addEventListener('click', e => {
    const it = e.target.closest('.sb-item'); if (!it || e.target.closest('.sb-rename')) return; const id = it.dataset.id, a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'rename') { renaming = id; renderList(); return; }
    if (a === 'del') { if (confirmDel === id) { confirmDel = null; deleteChat(id); } else { confirmDel = id; clearTimeout(delT); delT = setTimeout(() => { confirmDel = null; renderList(); }, 2500); renderList(); } return; }
    openChat(id); setThread(true); closeIfNarrow();
  });
  list.addEventListener('keydown', e => { const it = e.target.closest?.('.sb-item'); if (!it) return;
    if (e.target.classList.contains('sb-rename')) { if (e.key === 'Enter') { renameChat(it.dataset.id, e.target.value); renaming = null; renderList(); } else if (e.key === 'Escape') { renaming = null; renderList(); } return; }
    if (e.key === 'Enter') { openChat(it.dataset.id); setThread(true); closeIfNarrow(); } });
  list.addEventListener('focusout', e => { if (e.target.classList?.contains('sb-rename') && renaming) { const id = renaming; renaming = null; renameChat(id, e.target.value); renderList(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (open) setOpen(false); else if (threadOpen) setThread(false); } });
  chatBus.addEventListener('list', () => { if (open) renderList(); });
  chatBus.addEventListener('message', () => { if (threadOpen) renderThread(); });
  chatBus.addEventListener('switch', () => { if (threadOpen) renderThread(); });
}
