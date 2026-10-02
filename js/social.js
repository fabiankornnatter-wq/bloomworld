// Freunde & Chat – Browser-Seite. Fragt regelmäßig beim eigenen Server nach Neuem (kein Dauer-Server nötig).
import { call } from './account.js';

const post = (action, body = {}, timeout = 12000) => call('/social', { method: 'POST', body: { action, ...body }, timeout });

export const socialApi = {
  sync: () => post('sync'),
  request: (name) => post('request', { name }),
  accept: (id) => post('accept', { id }),
  decline: (id) => post('decline', { id }),
  cancel: (id) => post('cancel', { id }),
  remove: (id) => post('remove', { id }),
  block: (id) => post('block', { id }),
  unblock: (id) => post('unblock', { id }),
  history: (id, after) => post('history', { id, after }),
  send: (id, text) => post('send', { id, text }),
  report: (id, msg, reason) => post('report', { id, msg, reason }),
  gift: (id, kind) => post('gift', { id, kind }),
  like: (id) => post('like', { id }),
  visit: (id) => post('visit', { id }),
  help: (id, beds) => post('help', { id, beds }),
  redeem: (code) => post('redeem', { code }),
  feedback: (d) => post('feedback', d),
  trades: (scope) => post('trades', { scope }),
  tradeOffer: (d) => post('tradeOffer', d),
  tradeCancel: (id) => post('tradeCancel', { id }),
  tradeAccept: (id) => post('tradeAccept', { id }),
  seedGift: (id, seed, n) => post('seedGift', { id, seed, n }),
};

export const adminApi = {
  overview: () => call('/admin', { method: 'POST', body: { action: 'overview' } }),
  post: (d) => call('/admin', { method: 'POST', body: { action: 'post', ...d } }),
  deleteNews: (id) => call('/admin', { method: 'POST', body: { action: 'deleteNews', id } }),
  resolve: (id) => call('/admin', { method: 'POST', body: { action: 'resolve', id } }),
  ban: (id, days, reason) => call('/admin', { method: 'POST', body: { action: 'ban', id, days, reason } }),
  unban: (id) => call('/admin', { method: 'POST', body: { action: 'unban', id } }),
  giftAll: (d) => call('/admin', { method: 'POST', body: { action: 'giftAll', ...d } }),
  createCode: (d) => call('/admin', { method: 'POST', body: { action: 'createCode', ...d } }),
  deleteCode: (code) => call('/admin', { method: 'POST', body: { action: 'deleteCode', code } }),
  deleteFeedback: (id) => call('/admin', { method: 'POST', body: { action: 'deleteFeedback', id } }),
  findPlayer: (q) => call('/admin', { method: 'POST', body: { action: 'findPlayer', q } }),
  grant: (d) => call('/admin', { method: 'POST', body: { action: 'grant', ...d } }),
  forceRename: (id, on) => call('/admin', { method: 'POST', body: { action: 'forceRename', id, on } }),
  resetCode: (id) => call('/admin', { method: 'POST', body: { action: 'resetCode', id } }),
  maintenance: (d) => call('/admin', { method: 'POST', body: { action: 'maintenance', ...d } }),
  boost: (id, hours, mult) => call('/admin', { method: 'POST', body: { action: 'boost', id, hours, mult } }),
  traderOffer: (d) => call('/admin', { method: 'POST', body: { action: 'traderOffer', ...d } }),
  legal: (key, text) => call('/admin', { method: 'POST', body: { action: 'legal', key, text } }),
  addWord: (word) => call('/admin', { method: 'POST', body: { action: 'addWord', word } }),
  removeWord: (word) => call('/admin', { method: 'POST', body: { action: 'removeWord', word } }),
  pushAll: (d) => call('/admin', { method: 'POST', body: { action: 'pushAll', ...d } }),
};
export const loadNews = () => call('/news', { timeout: 8000 });
export const loadLegal = (key) => call(`/news?legal=${key}`, { timeout: 8000 });

const SYNC_MS = 20_000, SYNC_CHAT_MS = 9_000, CHAT_MS = 3_000;

export class SocialHub {
  constructor({ onChange, onInbox, onAuthLost } = {}) {
    this.onChange = onChange; this.onInbox = onInbox; this.onAuthLost = onAuthLost;
    this.data = null; this.error = null; this.timer = null; this.stopped = true; this.busy = false;
    this.chat = null; this.chatTimer = null;
    this.onVis = () => { if (!document.hidden && !this.stopped) this.tick(); };
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    document.addEventListener('visibilitychange', this.onVis);
    this.tick();
  }

  stop() {
    this.stopped = true; clearTimeout(this.timer); this.closeChat();
    document.removeEventListener('visibilitychange', this.onVis);
  }

  schedule(ms) { clearTimeout(this.timer); if (!this.stopped) this.timer = setTimeout(() => this.tick(), ms); }

  async tick() {
    if (this.stopped) return;
    if (document.hidden) { this.schedule(SYNC_MS); return; }
    if (this.busy) return;
    this.busy = true;
    const r = await socialApi.sync();
    this.busy = false;
    if (r.ok) {
      this.data = r; this.error = null;
      if (this.chat) { const f = r.friends.find((x) => x.id === this.chat.id); if (f) f.unread = 0; }
      if (r.inbox?.length) this.onInbox?.(r.inbox);
      this.onChange?.('sync');
    } else if (r.status === 401) { this.onAuthLost?.(); }
    else { this.error = r.message; this.onChange?.('sync'); }
    this.schedule(this.chat ? SYNC_CHAT_MS : SYNC_MS);
  }

  get badge() {
    if (!this.data) return 0;
    return this.data.incoming.length + this.data.friends.reduce((n, f) => n + (f.unread || 0), 0);
  }

  friend(id) { return this.data?.friends.find((f) => f.id === id) || null; }

  // Eine Aktion ausführen und danach die Übersicht neu laden
  async act(fn, ...args) {
    const r = await socialApi[fn](...args);
    if (r.ok) this.tick();
    return r;
  }

  // ---------- Chat ----------
  openChat(id, name) {
    this.closeChat();
    this.chat = { id, name, msgs: [], after: 0, loaded: false, online: false };
    const f = this.friend(id); if (f) f.unread = 0;
    this.loadChat();
    this.chatTimer = setInterval(() => { if (!document.hidden) this.loadChat(); }, CHAT_MS);
  }

  closeChat() { clearInterval(this.chatTimer); this.chatTimer = null; this.chat = null; }

  async loadChat() {
    const c = this.chat;
    if (!c || c.busy) return;
    c.busy = true;
    const r = await socialApi.history(c.id, c.after);
    c.busy = false;
    if (this.chat !== c) return;
    if (!r.ok) { c.error = r.message; if (r.status === 403) this.closeChat(); this.onChange?.('chat'); return; }
    c.error = null;
    const known = new Set(c.msgs.map((m) => m.i));
    const fresh = r.messages.filter((m) => !known.has(m.i));
    c.msgs.push(...fresh);
    c.msgs.sort((a, b) => a.ts - b.ts);
    if (c.msgs.length > 120) c.msgs.splice(0, c.msgs.length - 120);
    if (c.msgs.length) c.after = c.msgs[c.msgs.length - 1].ts;
    c.online = r.online;
    const first = !c.loaded; c.loaded = true;
    if (fresh.length || first) this.onChange?.('chat', { fresh: fresh.length, first });
  }

  async send(text) {
    const c = this.chat;
    if (!c) return { ok: false };
    const r = await socialApi.send(c.id, text);
    if (r.ok && this.chat === c) {
      if (!c.msgs.some((m) => m.i === r.message.i)) c.msgs.push(r.message);
      c.after = Math.max(c.after, r.message.ts);
      this.onChange?.('chat', { fresh: 1, mine: true });
    }
    return r;
  }
}
