// Speicher im Browser (localStorage). Mit Konto ist er die schnelle Sicherung auf dem Gerät;
// der eigentliche Spielstand liegt zusätzlich auf dem Server (siehe account.js, /api/save).
// Jedes Konto hat einen eigenen Schlüssel, der Gast-Spielstand liegt unter SAVE_KEY.

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

export const accountKey = (uid) => `bloomworld_u_${uid}`;
export const GUEST_MOVED_KEY = 'bloomworld_guest_moved';

export class LocalStore {
  constructor(storage, key = SAVE_KEY) {
    this.key = key;
    if (storage) { this.ls = storage; this.volatile = false; }
    else ({ ls: this.ls, volatile: this.volatile } = safeLocalStorage());
  }

  async load() {
    let raw = null;
    try {
      raw = this.ls.getItem(this.key) ?? (this.key === SAVE_KEY ? this.ls.getItem(LEGACY_KEY) : null);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      // Unlesbaren Spielstand sichern, bevor er überschrieben wird
      try { if (raw) this.ls.setItem(BACKUP_KEY, raw); } catch { /* egal */ }
      const err = new Error('LOAD_FAILED'); err.cause = e; throw err;
    }
  }

  // Zeitstempel des gespeicherten Standes (für Mehr-Tab-Schutz)
  peekUpdatedAt() {
    try { const raw = this.ls.getItem(this.key); return raw ? JSON.parse(raw).updatedAt || 0 : 0; } catch { return 0; }
  }

  async save(state) {
    try {
      this.ls.setItem(this.key, JSON.stringify(state));
      return true;
    } catch (e) {
      const err = new Error('SAVE_FAILED'); err.cause = e; throw err;
    }
  }

  async clear() {
    try { this.ls.removeItem(this.key); if (this.key === SAVE_KEY) this.ls.removeItem(LEGACY_KEY); } catch { /* ignorieren */ }
  }

  // Gast-Spielstand wurde in ein Konto übernommen: als Sicherung beiseitelegen
  async retire(backupKey = GUEST_MOVED_KEY) {
    try {
      const raw = this.ls.getItem(this.key) ?? this.ls.getItem(LEGACY_KEY);
      if (raw) this.ls.setItem(backupKey, raw);
      this.ls.removeItem(this.key); this.ls.removeItem(LEGACY_KEY);
    } catch { /* ignorieren */ }
  }
}

// Speichert gebündelt (nicht bei jedem Klick), nur wenn sich etwas geändert hat,
// und überschreibt nie einen neueren Stand aus einem anderen Tab/Fenster.
export class SaveManager {
  constructor(store, getState, { onError, onConflict } = {}) {
    this.store = store; this.getState = getState; this.onError = onError; this.onConflict = onConflict;
    this.timer = null; this.failed = false; this.dirty = false;
    this.known = 0; // updatedAt des Standes, den dieser Tab zuletzt geladen oder gespeichert hat
  }
  setKnown(t) { this.known = t || 0; }
  stop() { this.stopped = true; clearTimeout(this.timer); this.timer = null; }
  request() {
    if (this.stopped) return;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }
  flush(force = false) {
    clearTimeout(this.timer); this.timer = null;
    if (this.stopped || (!this.dirty && !force)) return;
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
