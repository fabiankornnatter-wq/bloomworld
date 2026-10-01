// Schlüssel-Wert-Speicher für Konten und Spielstände.
// Produktion: Upstash Redis, über den Vercel Marketplace mit dem Projekt verbunden.
// Die Zugangsdaten stehen ausschließlich in den Umgebungsvariablen des Vercel-Projekts
// (KV_REST_API_URL / KV_REST_API_TOKEN bzw. UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) –
// niemals im Code und niemals im Browser.
// Lokale Tests: In-Memory-Speicher, nur wenn BW_DEV_MEMORY_DB=1 gesetzt ist.

// Vercel kann den Namen der Variablen mit einem frei wählbaren Präfix versehen (z. B. STORAGE_KV_REST_API_URL).
// Deshalb werden alle passenden Namen gesucht – die Werte bleiben auf dem Server.
const URL_RE = /(^|_)(KV_REST_API_URL|REDIS_REST_URL|REST_API_URL)$/;
function findRest() {
  const env = process.env;
  const names = Object.keys(env).filter((k) => URL_RE.test(k) && /^https:\/\//.test(env[k] || '')).sort((a, b) => a.length - b.length);
  for (const n of names) {
    const tokenName = n.replace(/_URL$/, '_TOKEN');
    if (env[tokenName]) return { url: env[n].replace(/\/+$/, ''), token: env[tokenName], source: n };
  }
  return null;
}
const restUrl = () => findRest()?.url || '';
const restToken = () => findRest()?.token || '';
const memoryMode = () => process.env.BW_DEV_MEMORY_DB === '1';

export const kvConfigured = () => memoryMode() || !!findRest();
// Nur die NAMEN der Speicher-Variablen (nie die Werte) – zur Fehlersuche
export const kvVarNames = () => Object.keys(process.env).filter((k) => /KV|REDIS|UPSTASH|STORAGE/.test(k)).sort();
export const kvSource = () => (memoryMode() ? 'memory' : findRest()?.source || null);

// Spielstand nur speichern, wenn das Konto noch existiert, die Revision passt (Schutz vor Überschreiben
// von einem anderen Gerät) und der Spielstand nicht von einer älteren Spielversion stammt.
// Rückgabe: {1, rev} gespeichert · {0, rev} Konflikt · {-1, 0} Konto gelöscht · {-2, rev} veraltete Version
const CAS_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return {-1, 0} end
local cur = tonumber(redis.call('HGET', KEYS[1], 'rev') or '0')
local sv = tonumber(redis.call('HGET', KEYS[1], 'sv') or '0')
if tonumber(ARGV[5]) < sv then return {-2, cur} end
if ARGV[4] ~= '1' and cur ~= tonumber(ARGV[1]) then return {0, cur} end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('HSET', KEYS[1], 'rev', cur + 1, 'saveAt', ARGV[3], 'sv', ARGV[5])
return {1, cur + 1}`;

class UpstashKV {
  async req(path, body) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(restUrl() + path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${restToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) throw new Error(`KV_HTTP_${r.status}`);
      return j;
    } finally { clearTimeout(t); }
  }
  async cmd(...args) {
    const j = await this.req('', args.map(String));
    if (j.error) throw new Error('KV_ERROR ' + j.error);
    return j.result;
  }
  async pipe(cmds) {
    const j = await this.req('/pipeline', cmds.map((c) => c.map(String)));
    return j.map((x) => { if (x.error) throw new Error('KV_ERROR ' + x.error); return x.result; });
  }
  async casSave(userKey, saveKey, base, data, now, force, version) {
    const r = await this.cmd('EVAL', CAS_SCRIPT, 2, userKey, saveKey, base, data, now, force ? '1' : '0', version);
    return { code: Number(r[0]), ok: Number(r[0]) === 1, rev: Number(r[1]) };
  }
}

// Kleiner Ersatz für Redis – nur für lokale Tests
class MemoryKV {
  constructor() { this.m = new Map(); this.exp = new Map(); }
  alive(k) {
    const e = this.exp.get(k);
    if (e !== undefined && e <= Date.now()) { this.m.delete(k); this.exp.delete(k); }
    return this.m.has(k);
  }
  async cmd(name, ...a) {
    const n = String(name).toUpperCase();
    const k = a[0] !== undefined ? String(a[0]) : '';
    const has = this.alive(k);
    switch (n) {
      case 'PING': return 'PONG';
      case 'GET': return has ? this.m.get(k) : null;
      case 'SET': {
        const opts = a.slice(2).map((x) => String(x).toUpperCase());
        if (opts.includes('NX') && has) return null;
        this.m.set(k, String(a[1])); this.exp.delete(k);
        const ex = opts.indexOf('EX');
        if (ex >= 0) this.exp.set(k, Date.now() + Number(a[2 + ex + 1]) * 1000);
        return 'OK';
      }
      case 'DEL': { let c = 0; for (const x of a) { if (this.alive(String(x))) c++; this.m.delete(String(x)); this.exp.delete(String(x)); } return c; }
      case 'INCR': { const v = (has ? Number(this.m.get(k)) : 0) + 1; this.m.set(k, String(v)); return v; }
      case 'EXPIRE': if (!has) return 0; this.exp.set(k, Date.now() + Number(a[1]) * 1000); return 1;
      case 'HSET': { const h = has ? this.m.get(k) : new Map(); for (let i = 1; i < a.length; i += 2) h.set(String(a[i]), String(a[i + 1])); this.m.set(k, h); return 1; }
      case 'HGET': return has ? (this.m.get(k).get(String(a[1])) ?? null) : null;
      case 'HGETALL': return has ? [...this.m.get(k)].flat() : [];
      case 'SADD': { const s = has ? this.m.get(k) : new Set(); for (const x of a.slice(1)) s.add(String(x)); this.m.set(k, s); return 1; }
      case 'SREM': { if (has) for (const x of a.slice(1)) this.m.get(k).delete(String(x)); return 1; }
      case 'SMEMBERS': return has ? [...this.m.get(k)] : [];
      default: throw new Error('MemoryKV: unbekannter Befehl ' + n);
    }
  }
  async pipe(cmds) { const out = []; for (const c of cmds) out.push(await this.cmd(...c)); return out; }
  async casSave(userKey, saveKey, base, data, now, force, version) {
    if (!this.alive(userKey)) return { code: -1, ok: false, rev: 0 };
    const cur = Number((await this.cmd('HGET', userKey, 'rev')) || 0);
    const sv = Number((await this.cmd('HGET', userKey, 'sv')) || 0);
    if (Number(version) < sv) return { code: -2, ok: false, rev: cur };
    if (!force && cur !== Number(base)) return { code: 0, ok: false, rev: cur };
    await this.cmd('SET', saveKey, data);
    await this.cmd('HSET', userKey, 'rev', cur + 1, 'saveAt', now, 'sv', version);
    return { code: 1, ok: true, rev: cur + 1 };
  }
}

let instance = null;
export function kv() {
  if (!instance) instance = memoryMode() ? (globalThis.__bwMemoryKV ||= new MemoryKV()) : new UpstashKV();
  return instance;
}

// Redis liefert HGETALL als Liste [feld, wert, feld, wert, …]
export function toObject(list) {
  if (!list) return null;
  if (!Array.isArray(list)) return Object.keys(list).length ? list : null;
  if (!list.length) return null;
  const o = {};
  for (let i = 0; i < list.length; i += 2) o[list[i]] = list[i + 1];
  return o;
}
