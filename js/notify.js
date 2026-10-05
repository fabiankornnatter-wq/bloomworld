// Benachrichtigungen: Glocke im Spiel, „Während du weg warst“, Push aufs Handy.
import * as C from './config.js';
import * as G from './game.js';
import { call } from './account.js';

const plain = (s) => String(s).replace(/­/g, '');
const pushApi = {
  info: () => call('/push', { timeout: 8000 }),
  subscribe: (sub) => call('/push', { method: 'POST', body: { action: 'subscribe', sub } }),
  unsubscribe: (endpoint) => call('/push', { method: 'POST', body: { action: 'unsubscribe', endpoint } }),
  test: () => call('/push', { method: 'POST', body: { action: 'test' } }),
  schedule: (items) => call('/push', { method: 'POST', body: { action: 'schedule', items }, keepalive: true }),
};

const b64ToArr = (s) => { const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

export class Notifier {
  constructor({ getState, now, onChange }) {
    this.getState = getState; this.now = now; this.onChange = onChange;
    this.items = [];      // { id, kind, icon, text, ts, read, act }
    this.seen = new Set();
    this.push = { supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, enabled: false, server: null, sub: null };
    this.lastSchedule = 0;
  }

  get unread() { return this.items.filter((x) => !x.read).length; }

  add(kind, text, { icon = 'bell', act = null, key = null } = {}) {
    const k = key || `${kind}:${text}`;
    if (this.seen.has(k)) return;
    this.seen.add(k);
    this.items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind, icon, text, ts: this.now(), read: false, act });
    if (this.items.length > 40) this.items.length = 40;
    this.onChange?.();
  }
  markRead() { this.items.forEach((x) => (x.read = true)); this.onChange?.(); }
  clear() { this.items = []; this.onChange?.(); }

  // Im Spiel: Zustand beobachten und bei Änderungen Einträge erzeugen
  tick(infos, s, now) {
    const ready = infos.filter((x) => x.ready).length, thirsty = infos.filter((x) => x.thirsty).length;
    if (ready && ready !== this._ready) this.add('ready', ready === 1 ? 'Eine Blume ist erntereif.' : `${ready} Blumen sind erntereif.`, { icon: 'flower', key: 'ready' + now.toString().slice(0, -5) + ready, act: 'garden' });
    if (thirsty && thirsty !== this._thirsty) this.add('thirsty', thirsty === 1 ? 'Eine Blume hat Durst.' : `${thirsty} Blumen haben Durst.`, { icon: 'drop', key: 'thirsty' + now.toString().slice(0, -5) + thirsty, act: 'garden' });
    this._ready = ready; this._thirsty = thirsty;
    const job = G.breedingInfo(s, now);
    if (job?.ready && this._job !== job.result) { this.add('breed', `Züchtung fertig: ${plain(C.SEEDS[job.result].name)}.`, { icon: 'greenhouse', key: 'breed' + job.start, act: 'breed' }); }
    this._job = job?.ready ? job.result : null;
    if (s.level >= C.TRADER.level) {
      const t = G.traderInfo(s, now), can = t.orders.filter((o) => o.can).length;
      if (can && can !== this._can) this.add('order', can === 1 ? 'Eine Bestellung kann geliefert werden.' : `${can} Bestellungen können geliefert werden.`, { icon: 'cart', key: 'order' + t.day.id + can, act: 'trader' });
      this._can = can;
    }
    for (const h of G.helperInfo(s, now)) {
      if (h.owned && h.uses && h.usable && h.ready && this._help?.[h.id] === false) this.add('helper', `${h.name} ist wieder bereit.`, { icon: 'gnome', key: 'helper' + h.id + h.ready, act: 'helpers' });
      (this._help ||= {})[h.id] = h.usable;
    }
    if (s.florist?.built) {
      const fr = s.florist.jobs.filter((j) => j.start + j.dur <= now).length;
      if (fr && fr !== this._fl) this.add('bouquet', fr === 1 ? 'Ein Strauß ist fertig gebunden.' : `${fr} Sträuße sind fertig gebunden.`, { icon: 'bouquet', key: 'bouquet' + fr + s.florist.jobs.map((j) => j.start).join(), act: 'florist' });
      this._fl = fr;
    }
  }

  // „Während du weg warst“: Vergleich des gespeicherten Standes mit jetzt
  awaySummary(s, savedAt, now) {
    if (!savedAt || now - savedAt < 20 * 60_000) return null;
    const infos = s.beds.map((_, i) => G.bedInfo(s, i, now));
    const ready = infos.filter((x) => x.ready).length, thirsty = infos.filter((x) => x.thirsty).length;
    const job = G.breedingInfo(s, now);
    const t = s.level >= C.TRADER.level ? G.traderInfo(s, now) : null;
    const lines = [];
    if (ready) lines.push({ icon: 'flower', text: ready === 1 ? 'Eine Blume ist erntereif' : `${ready} Blumen sind erntereif` });
    if (thirsty) lines.push({ icon: 'drop', text: thirsty === 1 ? 'Eine Blume hat Durst' : `${thirsty} Blumen haben Durst` });
    if (job?.ready) lines.push({ icon: 'greenhouse', text: `Züchtung fertig: ${plain(C.SEEDS[job.result].name)}` });
    if (t && t.orders.filter((o) => !o.done).length) lines.push({ icon: 'cart', text: `${t.orders.filter((o) => !o.done).length} Bestellungen beim Händler` });
    const fr = s.florist?.built ? s.florist.jobs.filter((j) => j.start + j.dur <= now).length : 0;
    if (fr) lines.push({ icon: 'bouquet', text: fr === 1 ? 'Ein Strauß ist fertig gebunden' : `${fr} Sträuße sind fertig gebunden` });
    const away = now - savedAt, h = Math.floor(away / 3600000), m = Math.floor((away % 3600000) / 60000);
    return { away: h ? `${h} Std ${m} Min` : `${m} Min`, lines };
  }

  // Dem Server melden, wann die nächste Erinnerung fällig ist (für Push, wenn das Spiel zu ist)
  async schedule(s, now, force = false) {
    if (!this.push.enabled || (!force && now - this.lastSchedule < 60_000)) return;
    this.lastSchedule = now;
    const items = [];
    let nextThirst = Infinity, nextReady = Infinity;
    for (const b of s.beds) {
      if (b.locked || !b.seed) continue;
      const g = G.growState(b, now);
      if (g.thirsty) continue;
      const pts = G.thirstPoints(b), next = pts[b.drinks || 0];
      if (next !== undefined) nextThirst = Math.min(nextThirst, b.plantedAt + g.dur * next);
      else if (g.p < 1) nextReady = Math.min(nextReady, b.plantedAt + g.dur);
    }
    if (Number.isFinite(nextThirst)) items.push({ kind: 'thirsty', at: nextThirst + 60_000 });
    if (Number.isFinite(nextReady)) items.push({ kind: 'ready', at: nextReady + 60_000 });
    const job = G.breedingInfo(s, now);
    if (job && !job.ready) items.push({ kind: 'breed', at: job.start + job.dur + 30_000 });
    if (s.level >= C.TRADER.level) { const d = new Date(now); d.setHours(24, 30, 0, 0); items.push({ kind: 'order', at: d.getTime() + 8 * 3600_000 }); }
    await pushApi.schedule(items);
  }

  // ---------- Push einrichten ----------
  async init(loggedIn) {
    if (!this.push.supported || !loggedIn) return;
    const r = await pushApi.info();
    this.push.server = r.ok ? !!r.enabled : false; this.push.key = r.ok ? r.key : '';
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      this.push.sub = sub; this.push.enabled = !!sub && Notification.permission === 'granted' && this.push.server;
      if (this.push.enabled) pushApi.subscribe(sub.toJSON());
    } catch { /* kein Service Worker (z. B. http) */ }
    this.onChange?.();
  }
  async enable() {
    if (!this.push.supported) return { ok: false, message: 'Dein Browser unterstützt keine Push-Benachrichtigungen.' };
    if (!this.push.server) return { ok: false, message: 'Push ist auf dem Server noch nicht eingerichtet.' };
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, message: 'Du hast Benachrichtigungen nicht erlaubt. Du kannst das in den Browser-Einstellungen ändern.' };
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToArr(this.push.key) }));
      const r = await pushApi.subscribe(sub.toJSON());
      if (!r.ok) return r;
      this.push.sub = sub; this.push.enabled = true; this.onChange?.();
      pushApi.test();
      return { ok: true };
    } catch (e) { return { ok: false, message: 'Push konnte nicht aktiviert werden: ' + (e?.message || e) }; }
  }
  async disable() {
    try { if (this.push.sub) { await pushApi.unsubscribe(this.push.sub.endpoint); await this.push.sub.unsubscribe(); } } catch { /* egal */ }
    this.push.sub = null; this.push.enabled = false; this.onChange?.();
  }
}
