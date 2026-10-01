// Admin: Ankündigungen, gemeldete Nachrichten, Chat-Sperren, Statistik.
// Admin ist automatisch das älteste registrierte Konto (der Spielbetreiber). Diese Zuordnung wird
// einmal festgeschrieben und kann danach nicht mehr von anderen Konten übernommen werden.
import crypto from 'node:crypto';
import { kv, toObject } from './kv.js';
import { K, UserError, getUser } from './accounts.js';
import { SK, resetWords } from './social.js';
import * as C from '../../js/config.js';
import { subsOf, sendPush, pushConfigured } from './push.js';

// Push an alle Spieler mit Abo (höchstens 2.000 je Aufruf)
export async function pushAll(payload) {
  if (!pushConfigured()) return 0;
  const keys = (await scanAll('bw:push:*', 2000)).filter((k) => /^bw:push:[a-f0-9]{24}$/.test(k));
  let n = 0;
  for (const k of keys) {
    const uid = k.slice(8);
    for (const s of await subsOf(uid)) { const r = await sendPush(s, { title: 'BloomWorld', ...payload }); if (r.ok) n++; if (r.gone) await kv().cmd('HDEL', k, s.id); }
  }
  return n;
}

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
  n.pushed = await pushAll({ title: `📣 ${t}`, body: x.slice(0, 120), tag: 'news', url: '/?open=events' }).catch(() => 0);
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

const dayStr = (off = 0) => new Date(Date.now() - off * 86400000).toISOString().slice(0, 10);
export async function stats() {
  const [users, online] = await Promise.all([scanAll('bw:user:*'), scanAll('bw:on:*')]);
  const days = [0, 1, 2, 3, 4, 5, 6].map(dayStr);
  const r = await kv().pipe([
    ...days.map((d) => ['GET', `bw:stat:reg:${d}`]),
    ['PFCOUNT', `bw:stat:act:${days[0]}`],
    ['PFCOUNT', ...days.map((d) => `bw:stat:act:${d}`)],
    ['LLEN', FEEDBACK_KEY],
  ]);
  const reg = days.map((d, i) => ({ day: d, n: Number(r[i]) || 0 }));
  return { users: users.filter((k) => /^bw:user:[a-f0-9]{24}$/.test(k)).length, online: online.length, newToday: reg[0].n, new7: reg.reduce((a, x) => a + x.n, 0), activeToday: Number(r[7]) || 0, active7: Number(r[8]) || 0, feedback: Number(r[9]) || 0, reg };
}

// ---------- Geschenk an alle ----------
const GIFTALL_KEY = 'bw:giftall';
function cleanReward(b) {
  const coins = Math.max(0, Math.min(5000, Math.floor(Number(b.coins) || 0)));
  const items = {};
  for (const [k, n] of Object.entries(b.items || {})) { const v = Math.max(0, Math.min(50, Math.floor(Number(n) || 0))); if (v && C.ITEMS[k]) items[k] = v; }
  if (!coins && !Object.keys(items).length) throw new UserError(400, 'empty', 'Bitte gib Münzen oder Gegenstände an.');
  return { coins, items };
}
export async function giftAll(by, b) {
  const title = String(b.title ?? '').trim().slice(0, 60) || 'Geschenk vom BloomWorld-Team';
  const g = { id: Date.now().toString(36), ts: Date.now(), title, by, ...cleanReward(b) };
  await kv().pipe([['LPUSH', GIFTALL_KEY, JSON.stringify(g)], ['LTRIM', GIFTALL_KEY, 0, 19]]);
  g.pushed = await pushAll({ title: '🎁 Ein Geschenk wartet!', body: title, tag: 'gift', url: '/' }).catch(() => 0);
  return g;
}
export async function giftsAll() { return parse(await kv().cmd('LRANGE', GIFTALL_KEY, 0, 19)).map(({ raw, ...g }) => g); }
// Für einen Spieler: noch nicht abgeholte Team-Geschenke (nur, was nach der Registrierung verschickt wurde)
export async function pendingGifts(uid, created) {
  const list = await giftsAll();
  if (!list.length) return [];
  const claimed = new Set(await kv().cmd('SMEMBERS', `bw:gclaim:${uid}`) || []);
  const fresh = list.filter((g) => g.ts > (Number(created) || 0) && !claimed.has(g.id));
  if (fresh.length) await kv().pipe([['SADD', `bw:gclaim:${uid}`, ...fresh.map((g) => g.id)], ['EXPIRE', `bw:gclaim:${uid}`, 400 * 86400]]);
  return fresh.map((g) => ({ k: 'teamgift', id: 'g' + g.id, title: g.title, coins: g.coins, items: g.items }));
}

// ---------- Gutscheincodes ----------
const CODES_KEY = 'bw:codes';
const cleanCode = (c) => String(c ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
export async function createCode(b) {
  const code = cleanCode(b.code);
  if (code.length < 4) throw new UserError(400, 'code', 'Der Code braucht mindestens 4 Zeichen (Buchstaben, Zahlen, Bindestrich).');
  const days = Math.max(0, Math.min(365, Math.floor(Number(b.days) || 0)));
  const v = { code, ...cleanReward(b), max: Math.max(1, Math.min(100000, Math.floor(Number(b.max) || 100))), until: days ? Date.now() + days * 86400000 : 0, ts: Date.now() };
  if (Number(await kv().cmd('HSETNX', CODES_KEY, code, JSON.stringify(v))) !== 1) throw new UserError(409, 'exists', 'Diesen Code gibt es schon.');
  return v;
}
export async function codes() {
  const h = await kv().cmd('HGETALL', CODES_KEY);
  const o = Array.isArray(h) ? Object.fromEntries(h.reduce((a, x, i) => (i % 2 ? a : [...a, [x, h[i + 1]]]), [])) : h || {};
  const list = Object.values(o).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  const used = list.length ? await kv().pipe(list.map((c) => ['SCARD', `bw:code:${c.code}`])) : [];
  return list.map((c, i) => ({ ...c, used: Number(used[i]) || 0 })).sort((a, b) => b.ts - a.ts);
}
export async function deleteCode(code) { code = cleanCode(code); await kv().pipe([['HDEL', CODES_KEY, code], ['DEL', `bw:code:${code}`]]); }
export async function redeem(uid, raw) {
  const code = cleanCode(raw);
  const v = code && (await kv().cmd('HGET', CODES_KEY, code));
  let c = null; try { c = v ? JSON.parse(v) : null; } catch { c = null; }
  if (!c) throw new UserError(404, 'unknown', 'Diesen Gutscheincode gibt es nicht. Achte auf die Schreibweise.');
  if (c.until && Date.now() > c.until) throw new UserError(410, 'expired', 'Dieser Gutschein ist leider abgelaufen.');
  const key = `bw:code:${code}`;
  if (Number(await kv().cmd('SADD', key, uid)) !== 1) throw new UserError(409, 'used', 'Diesen Gutschein hast du schon eingelöst.');
  if (Number(await kv().cmd('SCARD', key)) > c.max) { await kv().cmd('SREM', key, uid); throw new UserError(410, 'full', 'Dieser Gutschein wurde schon zu oft eingelöst.'); }
  return { k: 'teamgift', id: 'c' + code, title: `Gutschein ${code}`, coins: c.coins, items: c.items };
}

// ---------- Feedback ----------
const FEEDBACK_KEY = 'bw:feedback';
export async function addFeedback(uid, name, b) {
  const text = String(b.text ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 1000);
  if (text.length < 3) throw new UserError(400, 'text', 'Bitte schreibe ein paar Worte.');
  const kind = ['bug', 'idea', 'other'].includes(b.kind) ? b.kind : 'other';
  const f = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), uid, name, kind, text, ver: String(b.ver || '').slice(0, 12), ua: String(b.ua || '').slice(0, 120) };
  await kv().pipe([['LPUSH', FEEDBACK_KEY, JSON.stringify(f)], ['LTRIM', FEEDBACK_KEY, 0, 299]]);
}
export async function feedback() { return parse(await kv().cmd('LRANGE', FEEDBACK_KEY, 0, 99)).map(({ raw, ...f }) => f); }
export async function deleteFeedback(id) {
  const item = parse(await kv().cmd('LRANGE', FEEDBACK_KEY, 0, -1)).find((f) => f.id === id);
  if (item) await kv().cmd('LREM', FEEDBACK_KEY, 1, item.raw);
  return !!item;
}

// ---------- Spieler-Support ----------
const maskEmail = (e) => { const [a, b] = String(e || '').split('@'); return a && b ? `${a.slice(0, 2)}${'*'.repeat(Math.max(1, a.length - 2))}@${b}` : '—'; };
export async function findPlayer(q) {
  const { findLogin } = await import('./accounts.js');
  const uid = await findLogin(q);
  const u = uid ? await getUser(uid) : null;
  if (!u) throw new UserError(404, 'not_found', 'Kein Spieler mit diesem Namen oder dieser E-Mail.');
  const [friends, ban, seen, mustRename] = await kv().pipe([['HLEN', SK.friends(uid)], ['GET', SK.ban(uid)], ['GET', `bw:seen:${uid}`], ['HGET', K.user(uid), 'mustRename']]);
  return { id: uid, name: u.name, email: maskEmail(u.email), created: Number(u.created) || 0, level: Number(u.lvl) || 1, saveAt: Number(u.saveAt) || 0, lastSeen: Number(seen) || 0, friends: Number(friends) || 0, banned: !!ban, mustRename: mustRename === '1', admin: await isAdmin(uid) };
}

export async function grantPlayer(by, uid, b) {
  if (!(await getUser(uid))) throw new UserError(404, 'not_found', 'Spieler nicht gefunden.');
  const r = cleanReward(b);
  const title = String(b.title ?? '').trim().slice(0, 60) || 'Gutschrift vom BloomWorld-Team';
  await kv().pipe([['RPUSH', SK.inbox(uid), JSON.stringify({ id: 's' + Date.now().toString(36), ts: Date.now(), k: 'teamgift', title, ...r })], ['LTRIM', SK.inbox(uid), -100, -1], ['EXPIRE', SK.inbox(uid), 30 * 86400]]);
  return r;
}

export async function forceRename(uid, on = true) {
  if (await isAdmin(uid)) throw new UserError(400, 'self', 'Nicht beim Admin-Konto.');
  if (on) await kv().cmd('HSET', K.user(uid), 'mustRename', '1'); else await kv().cmd('HDEL', K.user(uid), 'mustRename');
}

// Reset-Code fürs Passwort (30 Minuten gültig); wird per E-Mail verschickt oder vom Admin weitergegeben
export async function makeResetCode(uid) {
  const { sha256 } = await import('./http.js');
  const code = Array.from(crypto.randomBytes(8), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
  await kv().cmd('SET', `bw:pwreset:${sha256(uid + ':' + code)}`, uid, 'EX', 1800);
  return code;
}

// ---------- Wartungsmodus, Event-Schalter, Händler-Angebot ----------
const MAINT_KEY = 'bw:maint', BOOST_KEY = 'bw:boosts', OFFER_KEY = 'bw:traderoffer', LEGAL_KEY = 'bw:legal', LOG_KEY = 'bw:adminlog', WORDS_KEY = 'bw:badwords';
const BOOSTS = ['doubleXp', 'shinyDay', 'traderSale', 'doubleCoins'];

export async function setMaintenance(on, text, until) {
  const v = { on: !!on, text: String(text ?? '').trim().slice(0, 200), until: Number(until) || 0, ts: Date.now() };
  await kv().cmd('SET', MAINT_KEY, JSON.stringify(v));
  return v;
}
export async function getPublic() {
  const [m, b, o, l] = await kv().pipe([['GET', MAINT_KEY], ['HGETALL', BOOST_KEY], ['GET', OFFER_KEY], ['HGETALL', LEGAL_KEY]]);
  const J = (x, d) => { try { return x ? JSON.parse(x) : d; } catch { return d; } };
  const maint = J(m, null);
  const bh = toObject(b) || {}, now = Date.now();
  const boosts = {};
  for (const [k, v] of Object.entries(bh)) { const x = J(v, null); if (x && x.start <= now && x.end > now) boosts[k] = x; }
  const offer = J(o, null);
  const legal = toObject(l) || {};
  return { maint: maint && maint.on && (!maint.until || maint.until > now) ? maint : null, boosts, offer: offer && offer.day === new Date().toISOString().slice(0, 10) ? offer : null, legal: { impressum: !!legal.impressum, datenschutz: !!legal.datenschutz } };
}
export async function setBoost(id, hours, mult) {
  if (!BOOSTS.includes(id)) throw new UserError(400, 'invalid', 'Unbekannter Event-Schalter.');
  const h = Math.max(0, Math.min(14 * 24, Number(hours) || 0));
  if (!h) { await kv().cmd('HDEL', BOOST_KEY, id); return null; }
  const v = { id, start: Date.now(), end: Date.now() + h * 3600_000, mult: Math.max(1, Math.min(4, Number(mult) || 2)) };
  await kv().cmd('HSET', BOOST_KEY, id, JSON.stringify(v));
  return v;
}
export async function allBoosts() { const h = toObject(await kv().cmd('HGETALL', BOOST_KEY)) || {}; return Object.values(h).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean); }
export async function setTraderOffer(b) {
  if (!b || b.clear) { await kv().cmd('DEL', OFFER_KEY); return null; }
  const kind = b.kind === 'deco' ? 'deco' : 'item';
  const id = String(b.id || '');
  if (kind === 'deco' ? !C.DECO[id] || C.DECO[id].event : !C.ITEMS[id]) throw new UserError(400, 'invalid', 'Unbekannter Gegenstand.');
  const n = kind === 'deco' ? 1 : Math.max(1, Math.min(10, Math.floor(Number(b.n) || 1)));
  const was = kind === 'deco' ? C.DECO[id].price : C.ITEMS[id].price * n;
  const off = Math.max(0.05, Math.min(0.9, Number(b.off) || 0.3));
  const v = { kind, id, n, was, off, price: Math.max(1, Math.round(was * (1 - off))), day: new Date().toISOString().slice(0, 10) };
  await kv().cmd('SET', OFFER_KEY, JSON.stringify(v), 'EX', 2 * 86400);
  return v;
}
export async function getTraderOffer() { try { const v = JSON.parse(await kv().cmd('GET', OFFER_KEY)); return v && v.day === new Date().toISOString().slice(0, 10) ? v : null; } catch { return null; } }

// ---------- Rechtstexte ----------
export async function setLegal(key, text) {
  if (!['impressum', 'datenschutz'].includes(key)) throw new UserError(400, 'invalid', 'Unbekannt.');
  const t = String(text ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 20000);
  if (t) await kv().cmd('HSET', LEGAL_KEY, key, t); else await kv().cmd('HDEL', LEGAL_KEY, key);
}
export async function getLegal() { return toObject(await kv().cmd('HGETALL', LEGAL_KEY)) || {}; }

// ---------- Protokoll & Wortfilter ----------
export async function log(by, action, detail = '') {
  try { await kv().pipe([['LPUSH', LOG_KEY, JSON.stringify({ ts: Date.now(), by, action, detail: String(detail).slice(0, 200) })], ['LTRIM', LOG_KEY, 0, 299]]); } catch { /* egal */ }
}
export async function logs() { return parse(await kv().cmd('LRANGE', LOG_KEY, 0, 99)).map(({ raw, ...l }) => l); }
export async function addWord(w) { const x = String(w ?? '').trim().toLowerCase().slice(0, 40); if (x.length < 2) throw new UserError(400, 'word', 'Mindestens 2 Zeichen.'); await kv().cmd('SADD', WORDS_KEY, x); resetWords(); return x; }
export async function removeWord(w) { await kv().cmd('SREM', WORDS_KEY, String(w ?? '').trim().toLowerCase()); resetWords(); }
export async function words() { return (await kv().cmd('SMEMBERS', WORDS_KEY)) || []; }
