// Admin: Ankündigungen, gemeldete Nachrichten, Chat-Sperren, Statistik.
// Admin ist automatisch das älteste registrierte Konto (der Spielbetreiber). Diese Zuordnung wird
// einmal festgeschrieben und kann danach nicht mehr von anderen Konten übernommen werden.
import { kv } from './kv.js';
import { K, UserError, getUser } from './accounts.js';
import { SK } from './social.js';

const ADMIN_KEY = 'bw:admin';
const NEWS_KEY = 'bw:news';
const KINDS = ['news', 'update', 'event', 'maintenance'];
let cache = { uid: null, at: 0 };

async function scanAll(pattern, limit = 20000) {
  const out = [];
  let cursor = '0', rounds = 0;
  do {
    const r = await kv().cmd('SCAN', cursor, 'MATCH', pattern, 'COUNT', 1000);
    cursor = String(r?.[0] ?? '0');
    for (const k of r?.[1] || []) out.push(String(k));
    rounds++;
  } while (cursor !== '0' && out.length < limit && rounds < 200);
  return out;
}

async function oldestAccount() {
  const keys = (await scanAll('bw:user:*')).filter((k) => /^bw:user:[a-f0-9]{24}$/.test(k));
  if (!keys.length) return null;
  const created = await kv().pipe(keys.map((k) => ['HGET', k, 'created']));
  let best = null, bestT = Infinity;
  keys.forEach((k, i) => { const t = Number(created[i]); if (Number.isFinite(t) && t < bestT) { bestT = t; best = k.slice(8); } });
  return best;
}

export async function adminUid() {
  if (cache.uid && Date.now() - cache.at < 60_000) return cache.uid;
  let uid = await kv().cmd('GET', ADMIN_KEY);
  if (!uid) {
    const oldest = await oldestAccount();
    if (oldest) { await kv().cmd('SET', ADMIN_KEY, oldest, 'NX'); uid = await kv().cmd('GET', ADMIN_KEY); }
  }
  if (uid && !(await getUser(uid))) uid = null; // Konto gelöscht
  cache = { uid: uid || null, at: Date.now() };
  return cache.uid;
}

export async function isAdmin(uid) {
  try { return !!uid && (await adminUid()) === uid; } catch { return false; }
}

const parse = (list) => (list || []).map((x) => { try { return { raw: x, ...JSON.parse(x) }; } catch { return null; } }).filter(Boolean);

// ---------- Ankündigungen (für alle sichtbar) ----------
export async function news(limit = 20) {
  return parse(await kv().cmd('LRANGE', NEWS_KEY, 0, limit - 1)).map(({ raw, ...n }) => n);
}

export async function postNews(by, { title, text, kind }) {
  const t = String(title ?? '').trim().slice(0, 70), x = String(text ?? '').trim().slice(0, 1200);
  if (t.length < 2) throw new UserError(400, 'title', 'Bitte gib einen Titel ein.');
  if (x.length < 2) throw new UserError(400, 'text', 'Bitte schreibe einen Text.');
  const n = { id: Date.now().toString(36), ts: Date.now(), title: t, text: x, kind: KINDS.includes(kind) ? kind : 'news', by };
  await kv().pipe([['LPUSH', NEWS_KEY, JSON.stringify(n)], ['LTRIM', NEWS_KEY, 0, 49]]);
  return n;
}

export async function deleteNews(id) {
  const item = parse(await kv().cmd('LRANGE', NEWS_KEY, 0, -1)).find((n) => n.id === id);
  if (item) await kv().cmd('LREM', NEWS_KEY, 1, item.raw);
  return !!item;
}

// ---------- Meldungen & Sperren ----------
export async function reports() {
  return parse(await kv().cmd('LRANGE', SK.reports, 0, 99)).map(({ raw, ...r }) => r);
}

export async function resolveReport(id) {
  const item = parse(await kv().cmd('LRANGE', SK.reports, 0, -1)).find((r) => r.id === id);
  if (item) await kv().cmd('LREM', SK.reports, 1, item.raw);
  return !!item;
}

export async function ban(uid, days, reason) {
  if (!/^[a-f0-9]{24}$/.test(String(uid))) throw new UserError(400, 'invalid', 'Ungültig.');
  if (await isAdmin(uid)) throw new UserError(400, 'self', 'Das Admin-Konto kann nicht gesperrt werden.');
  const d = Math.max(0, Math.min(3650, Math.floor(Number(days) || 0)));
  const val = JSON.stringify({ reason: String(reason || '').slice(0, 200), ts: Date.now(), days: d });
  if (d > 0) await kv().cmd('SET', SK.ban(uid), val, 'EX', d * 86400);
  else await kv().cmd('SET', SK.ban(uid), val);
}

export async function unban(uid) { await kv().cmd('DEL', SK.ban(uid)); }

export async function bans() {
  const keys = await scanAll('bw:ban:*', 500);
  if (!keys.length) return [];
  const rows = await kv().pipe(keys.flatMap((k) => [['GET', k], ['HGET', K.user(k.slice(7)), 'name']]));
  return keys.map((k, i) => { let v = {}; try { v = JSON.parse(rows[i * 2]); } catch { /* egal */ } return { id: k.slice(7), name: rows[i * 2 + 1] || '?', ...v }; });
}

export async function stats() {
  const [users, online] = await Promise.all([scanAll('bw:user:*'), scanAll('bw:on:*')]);
  return { users: users.filter((k) => /^bw:user:[a-f0-9]{24}$/.test(k)).length, online: online.length };
}
