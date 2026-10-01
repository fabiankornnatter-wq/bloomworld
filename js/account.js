// Konto und Cloud-Spielstand – Browser-Seite.
// Hier stehen keine Schlüssel oder Zugangsdaten: Der Browser spricht nur mit den eigenen
// Server-Funktionen unter /api/*. Die Anmeldung läuft über ein geschütztes Cookie (HttpOnly).

const API = '/api';

const MSG = {
  network: 'Keine Verbindung zum Server. Prüfe deine Internetverbindung und versuche es noch einmal.',
  unavailable: 'Der Spiel-Server ist gerade nicht erreichbar.',
  timeout: 'Der Server antwortet gerade nicht. Bitte versuche es gleich noch einmal.',
};

export async function call(path, { method = 'GET', body, keepalive = false, timeout = 15000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(API + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive,
      signal: ctl.signal,
    });
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!data || typeof data !== 'object') {
      // z.B. eine Seite ohne Server-Funktionen (reine Vorschau) – dann ist offline spielen möglich
      return { ok: false, status: r.status, offline: true, error: 'unavailable', message: MSG.unavailable };
    }
    return { ...data, ok: r.ok && data.ok !== false, status: r.status, offline: r.status === 503 };
  } catch (e) {
    return { ok: false, status: 0, offline: true, error: e?.name === 'AbortError' ? 'timeout' : 'network', message: e?.name === 'AbortError' ? MSG.timeout : MSG.network };
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  me: () => call('/auth', { timeout: 9000 }),
  register: (d) => call('/auth', { method: 'POST', body: { action: 'register', name: d.name, email: d.email, password: d.password, remember: d.remember !== false } }),
  login: (d) => call('/auth', { method: 'POST', body: { action: 'login', login: d.login, password: d.password, remember: d.remember !== false } }),
  logout: () => call('/auth', { method: 'POST', body: { action: 'logout' } }),
  remove: (password) => call('/auth', { method: 'POST', body: { action: 'delete', password } }),
  load: () => call('/save'),
  push: (save, base, keepalive = false) => call('/save', { method: 'POST', body: { save, base }, keepalive }),
};

// Überträgt den Spielstand gebündelt auf den Server (höchstens alle MIN_GAP ms, zusätzlich beim
// Verlassen der Seite). Der lokale Speicher bleibt die schnelle Sicherung auf dem Gerät.
const MIN_GAP = 15_000;

export class CloudSync {
  constructor(getState, { onConflict, onRemote, onAuthLost, onStatus, onOutdated } = {}) {
    this.getState = getState;
    this.onConflict = onConflict; this.onRemote = onRemote; this.onAuthLost = onAuthLost; this.onStatus = onStatus; this.onOutdated = onOutdated;
    this.rev = 0; this.dirty = false; this.busy = false; this.again = false; this.timer = null;
    this.status = 'saved'; this.lastSaved = 0; this.lastPush = 0; this.stopped = false;
  }

  setStatus(s) { if (this.status !== s) { this.status = s; this.onStatus?.(s); } }

  request(delay = 2500) {
    if (this.stopped) return;
    this.dirty = true;
    if (!this.timer) this.timer = setTimeout(() => this.flush(), Math.max(delay, MIN_GAP - (Date.now() - this.lastPush)));
  }

  // Hat ein anderes Gerät inzwischen gespeichert? (z.B. wenn der Tab wieder sichtbar wird)
  async checkRemote() {
    if (this.stopped || this.busy) return;
    const rev0 = this.rev, push0 = this.lastPush;
    const r = await api.load();
    // Antwort veraltet, falls inzwischen selbst gespeichert wurde
    if (!r.ok || this.stopped || this.busy || this.rev !== rev0 || this.lastPush !== push0 || !(r.rev > this.rev)) return;
    if (this.dirty) {
      const keepLocal = this.onConflict ? this.onConflict(r.save) : true;
      this.rev = r.rev;
      if (keepLocal) { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 300); } else this.dirty = false;
    } else {
      this.rev = r.rev;
      if (r.save) this.onRemote?.(r.save);
    }
  }

  async flush({ keepalive = false } = {}) {
    clearTimeout(this.timer); this.timer = null;
    if (this.stopped || !this.dirty) return;
    if (this.busy) { this.again = true; return; }
    const s = this.getState();
    if (!s) return;
    this.busy = true; this.dirty = false; this.lastPush = Date.now();
    this.setStatus('saving');
    const r = await api.push(s, this.rev, keepalive);
    this.busy = false;
    if (r.ok) {
      this.rev = r.rev; this.lastSaved = Date.now();
      this.setStatus('saved');
    } else if (r.status === 409 && r.error === 'outdated') {
      this.stop();
      this.setStatus('error');
      this.onOutdated?.();
    } else if (r.status === 409) {
      // Auf einem anderen Gerät wurde gespeichert: neueren Stand behalten
      this.rev = Number.isFinite(r.rev) ? r.rev : this.rev;
      const keepLocal = this.onConflict ? this.onConflict(r.save) : true;
      if (keepLocal) { this.dirty = true; this.timer = setTimeout(() => this.flush(), 300); } else this.setStatus('saved');
    } else if (r.status === 401) {
      this.dirty = true;
      this.setStatus('auth');
      this.onAuthLost?.();
    } else {
      this.dirty = true;
      this.setStatus(r.offline || r.status === 0 ? 'offline' : 'error');
      this.timer = setTimeout(() => this.flush(), r.status === 429 ? 30_000 : 12_000);
    }
    if (this.again) { this.again = false; if (this.dirty && !this.timer) this.timer = setTimeout(() => this.flush(), 400); }
  }

  stop() { this.stopped = true; clearTimeout(this.timer); this.timer = null; }
}
