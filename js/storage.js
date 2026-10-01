// Speicher-Adapter. Heute: Browser-Speicher (localStorage).
// Später kann ein SupabaseStore mit derselben Schnittstelle (load/save/clear/peek) eingesetzt werden,
// z.B. für Login und Cloud-Spielstände. Zugangsdaten gehören NICHT in den Code, sondern in
// Vercel-Umgebungsvariablen bzw. die öffentliche Supabase-"anon"-Konfiguration mit Row Level Security.

export const SAVE_KEY = 'bloomworld_save_v2';
const LEGACY_KEY = 'bloomworld_v1';
const BACKUP_KEY = 'bloomworld_backup';

// Ersatzspeicher, falls der Browser localStorage blockiert (z.B. Website-Daten gesperrt)
class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

function safeLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    const probe = '__bw_probe__';
    ls.setItem(probe, '1'); ls.removeItem(probe);
    return { ls, volatile: false };
  } catch {
    return { ls: new MemoryStorage(), volatile: true };
  }
}

export class LocalStore {
  constructor(storage) {
    if (storage) { this.ls = storage; this.volatile = false; }
    else ({ ls: this.ls, volatile: this.volatile } = safeLocalStorage());
  }

  async load() {
    let raw = null;
    try {
      raw = this.ls.getItem(SAVE_KEY) ?? this.ls.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      // Unlesbaren Spielstand sichern, bevor er überschrieben wird
      try { if (raw) this.ls.setItem(BACKUP_KEY, raw); } catch { /* egal */ }
      const err = new Error('LOAD_FAILED'); err.cause = e; throw err;
    }
  }

  // Zeitstempel des gespeicherten Standes (für Mehr-Tab-Schutz)
  peekUpdatedAt() {
    try { const raw = this.ls.getItem(SAVE_KEY); return raw ? JSON.parse(raw).updatedAt || 0 : 0; } catch { return 0; }
  }

  async save(state) {
    try {
      this.ls.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      const err = new Error('SAVE_FAILED'); err.cause = e; throw err;
    }
  }

  async clear() {
    try { this.ls.removeItem(SAVE_KEY); this.ls.removeItem(LEGACY_KEY); } catch { /* ignorieren */ }
  }
}

// Vorlage für später (nicht aktiv):
// export class SupabaseStore {
//   constructor(client, userId) { this.client = client; this.userId = userId; }
//   async load() { const { data } = await this.client.from('saves').select('data').eq('user_id', this.userId).single(); return data?.data ?? null; }
//   async save(state) { await this.client.from('saves').upsert({ user_id: this.userId, data: state, updated_at: new Date().toISOString() }); return true; }
//   async clear() { await this.client.from('saves').delete().eq('user_id', this.userId); }
// }

// Speichert gebündelt (nicht bei jedem Klick), nur wenn sich etwas geändert hat,
// und überschreibt nie einen neueren Stand aus einem anderen Tab/Fenster.
export class SaveManager {
  constructor(store, getState, { onError, onConflict } = {}) {
    this.store = store; this.getState = getState; this.onError = onError; this.onConflict = onConflict;
    this.timer = null; this.failed = false; this.dirty = false;
    this.known = 0; // updatedAt des Standes, den dieser Tab zuletzt geladen oder gespeichert hat
  }
  setKnown(t) { this.known = t || 0; }
  request() {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }
  flush(force = false) {
    clearTimeout(this.timer); this.timer = null;
    if (!this.dirty && !force) return;
    const s = this.getState();
    if (!s) return;
    const stored = this.store.peekUpdatedAt ? this.store.peekUpdatedAt() : 0;
    if (!force && stored > this.known) {
      // Ein anderes Fenster hat inzwischen gespeichert – dessen Stand übernehmen statt überschreiben
      this.dirty = false;
      this.onConflict?.();
      return;
    }
    s.updatedAt = Math.max(Date.now(), stored + 1);
    this.known = s.updatedAt;
    this.dirty = false;
    // localStorage ist synchron – so ist der Stand auch beim sofortigen Schließen sicher.
    this.store.save(s).then(() => { this.failed = false; }).catch((e) => { if (!this.failed) this.onError?.(e); this.failed = true; this.dirty = true; });
  }
}
