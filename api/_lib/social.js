// Freunde, Chat, Geschenke und Gartenbesuche.
// Alles läuft über kurze Anfragen (kein Dauer-Server nötig): Der Browser fragt regelmäßig nach Neuem.
import crypto from 'node:crypto';
import { kv, toObject } from './kv.js';
import { K, UserError, getUser, nameKey, rateLimit } from './accounts.js';
import * as C from '../../js/config.js';
import * as G from '../../js/game.js';

const DAY = 86400;
const CHAT_KEEP = 200;           // Nachrichten je Unterhaltung
const CHAT_DAYS = 90;            // danach werden Unterhaltungen gelöscht
const MAX_TEXT = 300;
const MAX_INCOMING = 50;
const S = {
  friends: (u) => `bw:fr:${u}`,           // HASH Freund -> seit
  inReq: (u) => `bw:frin:${u}`,           // HASH Absender -> Zeit
  outReq: (u) => `bw:frout:${u}`,         // HASH Empfänger -> Zeit
  blocked: (u) => `bw:blk:${u}`,          // SET
  unread: (u) => `bw:unr:${u}`,           // HASH Freund -> Anzahl
  inbox: (u) => `bw:inbox:${u}`,          // LIST Geschenke, Hilfe, Likes
  online: (u) => `bw:on:${u}`,
  chat: (a, b) => `bw:chat:${a < b ? `${a}:${b}` : `${b}:${a}`}`,
  ban: (u) => `bw:ban:${u}`,
  day: (kind, ...ids) => `bw:d:${today()}:${kind}:${ids.join(':')}`,
  reports: 'bw:reports',
};
export { S as SK };
export const today = () => new Date().toISOString().slice(0, 10);
const isUid = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v);
const newId = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const nope = (msg, status = 400, code = 'invalid') => new UserError(status, code, msg);

// ---------- Text-Filter für den Chat ----------
// Links, E-Mail-Adressen und Telefonnummern werden entfernt (Schutz vor Betrug und für Kinder),
// grobe Schimpfwörter werden mit Sternchen ersetzt.
const BAD = ['fick', 'fuck', 'fotze', 'hurens', 'hure', 'wichser', 'arschloch', 'schlampe', 'nutte', 'missgeburt', 'spast', 'bitch', 'cunt', 'asshole', 'motherf', 'nigg', 'kanake', 'schwuchtel', 'retard', 'whore', 'slut'];
export function cleanText(v) {
  let t = String(v ?? '').normalize('NFC')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  if (!t) throw nope('Die Nachricht ist leer.');
  if (t.length > MAX_TEXT) t = t.slice(0, MAX_TEXT);
  t = t.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[Link entfernt]')
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, '[entfernt]')
    .replace(/\b[a-z0-9-]{2,}\.(?:de|com|net|org|io|app|me|gg|ly|xyz|info|eu|at|ch|tk|ru|co)\b(?:\/\S*)?/gi, '[Link entfernt]')
    .replace(/(?:\+|\b00)?\d[\d ()/.-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[entfernt]' : m));
  const low = t.toLowerCase();
  const marks = new Array(t.length).fill(false);
  for (const w of BAD) { let i = low.indexOf(w); while (i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = low.indexOf(w, i + 1); } }
  if (marks.some(Boolean)) t = [...t].map((c, i) => (marks[i] && /\S/.test(c) ? '*' : c)).join('');
  return t;
}

// ---------- Hilfen ----------
async function nameOf(uid) { return (await kv().cmd('HGET', K.user(uid), 'name')) || 'Unbekannt'; }
async function isFriend(a, b) { return Number(await kv().cmd('HEXISTS', S.friends(a), b)) === 1; }
async function mustBeFriend(a, b) { if (!isUid(b) || !(await isFriend(a, b))) throw nope('Ihr seid (noch) keine Freunde.', 403, 'not_friend'); }
async function chatBanned(uid) { return Number(await kv().cmd('EXISTS', S.ban(uid))) === 1; }

async function pushChat(from, to, msg) {
  const m = { i: newId(), f: from, ts: Date.now(), ...msg };
  const key = S.chat(from, to);
  await kv().pipe([
    ['RPUSH', key, JSON.stringify(m)],
    ['LTRIM', key, -CHAT_KEEP, -1],
    ['EXPIRE', key, CHAT_DAYS * DAY],
    ['HINCRBY', S.unread(to), from, 1],
  ]);
  return m;
}

async function pushInbox(to, item) {
  await kv().pipe([['RPUSH', S.inbox(to), JSON.stringify({ id: newId(), ts: Date.now(), ...item })], ['LTRIM', S.inbox(to), -100, -1], ['EXPIRE', S.inbox(to), 30 * DAY]]);
}

// Tageszähler: erhöht und prüft gegen ein Limit (zählt nicht, wenn das Limit erreicht ist)
async function dayCount(key, add, max) {
  const n = Number(await kv().cmd('INCRBY', key, add));
  if (n === add) await kv().cmd('EXPIRE', key, 2 * DAY);
  if (n > max) { await kv().cmd('INCRBY', key, -add); return false; }
  return true;
}

// ---------- Übersicht (wird regelmäßig abgefragt) ----------
export async function sync(uid, { pop = true } = {}) {
  const db = kv();
  const [fr, inc, out, unr, blk] = await db.pipe([
    ['HGETALL', S.friends(uid)], ['HGETALL', S.inReq(uid)], ['HGETALL', S.outReq(uid)], ['HGETALL', S.unread(uid)], ['SMEMBERS', S.blocked(uid)],
    ['SET', S.online(uid), '1', 'EX', 90],
  ]);
  const friends = toObject(fr) || {}, incoming = toObject(inc) || {}, outgoing = toObject(out) || {}, unread = toObject(unr) || {};
  const ids = [...new Set([...Object.keys(friends), ...Object.keys(incoming), ...Object.keys(outgoing), ...(blk || [])])].filter(isUid);
  const info = {};
  if (ids.length) {
    const rows = await db.pipe(ids.flatMap((id) => [['HMGET', K.user(id), 'name', 'lvl'], ['EXISTS', S.online(id)]]));
    ids.forEach((id, i) => { const [name, lvl] = rows[i * 2] || []; info[id] = { id, name: name || null, level: Number(lvl) || 1, online: Number(rows[i * 2 + 1]) === 1 }; });
  }
  const day = today();
  const [gifted, liked, helped] = ids.length ? await db.pipe([['SMEMBERS', `bw:d:${day}:gift:${uid}`], ['SMEMBERS', `bw:d:${day}:like:${uid}`], ['MGET', ...Object.keys(friends).filter(isUid).map((f) => `bw:d:${day}:help:${uid}:${f}`), 'x']]) : [[], [], []];
  const helpCount = {};
  Object.keys(friends).filter(isUid).forEach((f, i) => { helpCount[f] = Number((helped || [])[i]) || 0; });
  const list = (obj, extra) => Object.keys(obj).filter((id) => isUid(id) && info[id]?.name).map((id) => ({ ...info[id], since: Number(obj[id]) || 0, ...extra(id) }));
  const items = pop ? (await db.popList(S.inbox(uid), 50)).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean) : [];
  return {
    friends: list(friends, (id) => ({ unread: Number(unread[id]) || 0, gifted: (gifted || []).includes(id), liked: (liked || []).includes(id), helpLeft: Math.max(0, C.HELP.perDay - (helpCount[id] || 0)) }))
      .sort((a, b) => b.unread - a.unread || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'de')),
    incoming: list(incoming, () => ({})).sort((a, b) => b.since - a.since),
    outgoing: list(outgoing, () => ({})),
    blocked: (blk || []).filter((id) => info[id]?.name).map((id) => ({ id, name: info[id].name })),
    inbox: items,
    chatBanned: await chatBanned(uid),
  };
}

// ---------- Freundschaften ----------
export async function request(uid, myName, targetName) {
  await rateLimit('friendreq', uid, 30, 3600);
  const t = String(targetName ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 20) throw nope('Gib den Spielernamen deines Freundes ein (3 bis 20 Zeichen).');
  const target = await kv().cmd('GET', K.name(nameKey(t)));
  if (!isUid(target) || !(await getUser(target))) throw nope('Diesen Spielernamen gibt es nicht. Achte auf die genaue Schreibweise.', 404, 'not_found');
  if (target === uid) throw nope('Das bist du selbst. 🙂');
  if (await isFriend(uid, target)) throw nope('Ihr seid schon Freunde.', 409, 'already');
  const [iBlocked, theyBlocked, nFriends] = await kv().pipe([['SISMEMBER', S.blocked(uid), target], ['SISMEMBER', S.blocked(target), uid], ['HLEN', S.friends(uid)]]);
  if (Number(iBlocked)) throw nope('Du hast diesen Spieler blockiert. Hebe die Blockierung zuerst auf.', 409, 'blocked');
  if (Number(nFriends) >= C.MAX_FRIENDS) throw nope(`Du hast schon ${C.MAX_FRIENDS} Freunde – mehr geht nicht.`, 409, 'full');
  // Hat der andere mich schon angefragt? Dann direkt Freunde.
  if (Number(await kv().cmd('HEXISTS', S.inReq(uid), target))) { await accept(uid, target); return { ok: true, friend: true, name: await nameOf(target) }; }
  // Blockiert: so tun, als wäre die Anfrage verschickt (verrät nichts)
  if (Number(theyBlocked)) return { ok: true, friend: false };
  if (Number(await kv().cmd('HLEN', S.inReq(target))) >= MAX_INCOMING) throw nope('Dieser Spieler hat gerade zu viele offene Anfragen. Versuche es später noch einmal.', 409, 'busy');
  const now = Date.now();
  await kv().pipe([['HSET', S.inReq(target), uid, now], ['HSET', S.outReq(uid), target, now]]);
  return { ok: true, friend: false, name: await nameOf(target) };
}

export async function accept(uid, from) {
  if (!isUid(from) || !Number(await kv().cmd('HEXISTS', S.inReq(uid), from))) throw nope('Diese Anfrage gibt es nicht mehr.', 404, 'gone');
  if (Number(await kv().cmd('HLEN', S.friends(uid))) >= C.MAX_FRIENDS) throw nope(`Du hast schon ${C.MAX_FRIENDS} Freunde – mehr geht nicht.`, 409, 'full');
  const now = Date.now();
  await kv().pipe([
    ['HSET', S.friends(uid), from, now], ['HSET', S.friends(from), uid, now],
    ['HDEL', S.inReq(uid), from], ['HDEL', S.outReq(from), uid], ['HDEL', S.inReq(from), uid], ['HDEL', S.outReq(uid), from],
  ]);
  await pushChat(uid, from, { k: 'sys', t: 'Ihr seid jetzt Freunde! 🌸' });
  return { ok: true };
}

export async function decline(uid, from) {
  if (!isUid(from)) throw nope('Ungültig.');
  await kv().pipe([['HDEL', S.inReq(uid), from], ['HDEL', S.outReq(from), uid]]);
  return { ok: true };
}

export async function cancel(uid, to) {
  if (!isUid(to)) throw nope('Ungültig.');
  await kv().pipe([['HDEL', S.outReq(uid), to], ['HDEL', S.inReq(to), uid]]);
  return { ok: true };
}

export async function remove(uid, other) {
  if (!isUid(other)) throw nope('Ungültig.');
  await kv().pipe([
    ['HDEL', S.friends(uid), other], ['HDEL', S.friends(other), uid],
    ['HDEL', S.unread(uid), other], ['HDEL', S.unread(other), uid], ['DEL', S.chat(uid, other)],
  ]);
  return { ok: true };
}

export async function block(uid, other) {
  if (!isUid(other) || other === uid) throw nope('Ungültig.');
  await remove(uid, other);
  await kv().pipe([['SADD', S.blocked(uid), other], ['HDEL', S.inReq(uid), other], ['HDEL', S.outReq(other), uid], ['HDEL', S.outReq(uid), other], ['HDEL', S.inReq(other), uid]]);
  return { ok: true };
}

export async function unblock(uid, other) {
  if (!isUid(other)) throw nope('Ungültig.');
  await kv().cmd('SREM', S.blocked(uid), other);
  return { ok: true };
}

// ---------- Chat ----------
export async function history(uid, other, after = 0) {
  await mustBeFriend(uid, other);
  const raw = await kv().cmd('LRANGE', S.chat(uid, other), -80, -1);
  await kv().cmd('HDEL', S.unread(uid), other);
  const msgs = (raw || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter((m) => m && m.ts > (Number(after) || 0));
  const online = Number(await kv().cmd('EXISTS', S.online(other))) === 1;
  return { ok: true, messages: msgs, online };
}

export async function send(uid, other, text) {
  await mustBeFriend(uid, other);
  if (await chatBanned(uid)) throw nope('Dein Chat wurde wegen eines Verstoßes gegen die Regeln gesperrt.', 403, 'banned');
  await rateLimit('chat', uid, 20, 60);
  await rateLimit('chatday', uid, 500, DAY);
  const t = cleanText(text);
  const m = await pushChat(uid, other, { k: 'msg', t });
  return { ok: true, message: m };
}

export async function report(uid, myName, other, msgId, reason) {
  if (!isUid(other)) throw nope('Ungültig.');
  await rateLimit('report', uid, 20, DAY);
  const raw = await kv().cmd('LRANGE', S.chat(uid, other), 0, -1);
  const msg = (raw || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).find((m) => m && m.i === msgId && m.f === other);
  if (!msg) throw nope('Diese Nachricht gibt es nicht mehr.', 404, 'gone');
  const r = { id: newId(), ts: Date.now(), reporter: uid, reporterName: myName, target: other, targetName: await nameOf(other), text: msg.t, msgTs: msg.ts, reason: String(reason || '').slice(0, 200) };
  await kv().pipe([['LPUSH', S.reports, JSON.stringify(r)], ['LTRIM', S.reports, 0, 499]]);
  return { ok: true };
}

// ---------- Geschenke, Hilfe, Gefällt mir ----------
export async function gift(uid, myName, other, kind) {
  await mustBeFriend(uid, other);
  const g = C.GIFTS[kind];
  if (!g) throw nope('Dieses Geschenk gibt es nicht.');
  const sentKey = `bw:d:${today()}:gift:${uid}`;
  if (Number(await kv().cmd('SISMEMBER', sentKey, other))) throw nope('Du hast diesem Freund heute schon etwas geschenkt. Morgen wieder!', 409, 'already');
  if (!(await dayCount(S.day('giftin', other), 1, 30))) throw nope('Dein Freund hat heute schon sehr viele Geschenke bekommen. Morgen wieder!', 409, 'full');
  await kv().pipe([['SADD', sentKey, other], ['EXPIRE', sentKey, 2 * DAY]]);
  await pushInbox(other, { k: 'gift', from: uid, name: myName, item: g.item, n: g.n });
  await pushChat(uid, other, { k: 'gift', t: `hat dir ${g.label} geschenkt.`, x: kind });
  return { ok: true, xp: C.GIFT_XP };
}

export async function like(uid, myName, other) {
  await mustBeFriend(uid, other);
  const key = `bw:d:${today()}:like:${uid}`;
  if (Number(await kv().cmd('SISMEMBER', key, other))) throw nope('Dir gefällt dieser Garten heute schon. 💖', 409, 'already');
  await kv().pipe([['SADD', key, other], ['EXPIRE', key, 2 * DAY]]);
  const paid = await dayCount(S.day('likein', other), 1, 20);
  await pushInbox(other, { k: 'like', from: uid, name: myName, coins: paid ? C.LIKE.coins : 0 });
  await pushChat(uid, other, { k: 'like', t: 'findet deinen Garten wunderschön! 💖' });
  return { ok: true };
}

// Öffentliche Ansicht eines Freundesgartens (ohne Konto- oder Kaufdaten)
export async function visit(uid, other) {
  await mustBeFriend(uid, other);
  const [raw, user] = await Promise.all([kv().cmd('GET', K.save(other)), getUser(other)]);
  if (!user) throw nope('Diesen Spieler gibt es nicht mehr.', 404, 'gone');
  let save = null; try { save = raw ? JSON.parse(raw) : null; } catch { save = null; }
  const now = Date.now();
  const s = G.migrate(save, now).state;
  const helpUsed = Number(await kv().cmd('GET', `bw:d:${today()}:help:${uid}:${other}`)) || 0;
  const liked = Number(await kv().cmd('SISMEMBER', `bw:d:${today()}:like:${uid}`, other)) === 1;
  return {
    ok: true,
    garden: {
      id: other, name: user.name, level: s.level, land: s.land, layout: s.layout,
      beds: s.beds.map((b) => ({ locked: b.locked, seed: b.seed, plantedAt: b.plantedAt, dur: b.dur, lvl: b.lvl, sprinkler: b.sprinkler, drinks: b.drinks, var: b.var, shiny: b.shiny, compost: false })),
      decor: s.decor.filter((d) => !d.stored), greenhouse: { unlocked: s.greenhouse.unlocked, job: null }, activeSkin: s.activeSkin,
      collected: Object.values(s.collection).filter((e) => e.count > 0).length, bred: s.bred.length,
      savedAt: Number(user.saveAt) || 0, serverNow: now,
    },
    helpLeft: Math.max(0, C.HELP.perDay - helpUsed), liked,
  };
}

// Blumen im Garten eines Freundes gießen. Der Server prüft, welche Blumen laut letztem
// Spielstand Durst haben; der Besitzer bekommt die Hilfe beim nächsten Abruf gutgeschrieben.
export async function help(uid, myName, other, beds) {
  await mustBeFriend(uid, other);
  if (!Array.isArray(beds) || !beds.length) throw nope('Wähle Blumen zum Gießen.');
  const want = [...new Set(beds.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < C.BED_COUNT))].slice(0, C.HELP.perDay);
  const raw = await kv().cmd('GET', K.save(other));
  let save = null; try { save = raw ? JSON.parse(raw) : null; } catch { save = null; }
  const s = G.migrate(save, Date.now()).state;
  const thirsty = new Set(G.thirstyBeds(s, Date.now()));
  const ok = want.filter((i) => thirsty.has(i));
  if (!ok.length) throw nope('Diese Blumen haben gerade keinen Durst mehr.', 409, 'not_thirsty');
  const key = `bw:d:${today()}:help:${uid}:${other}`;
  const used = Number(await kv().cmd('GET', key)) || 0;
  const n = Math.min(ok.length, C.HELP.perDay - used);
  if (n <= 0) throw nope(`Du hast heute schon ${C.HELP.perDay} Blumen bei diesem Freund gegossen. Morgen wieder!`, 409, 'limit');
  if (!(await dayCount(key, n, C.HELP.perDay))) throw nope('Für heute ist genug gegossen. Morgen wieder!', 409, 'limit');
  const done = ok.slice(0, n);
  await pushInbox(other, { k: 'help', from: uid, name: myName, beds: done });
  await pushChat(uid, other, { k: 'help', t: `hat ${done.length === 1 ? 'eine Blume' : `${done.length} Blumen`} in deinem Garten gegossen. 💧`, x: done.length });
  return { ok: true, beds: done, coins: done.length * C.HELP.coins, xp: done.length * C.HELP.xp, helpLeft: C.HELP.perDay - used - n };
}

// ---------- Konto löschen: alle Verbindungen entfernen ----------
export async function purgeUser(uid) {
  const db = kv();
  const [fr, inc, out] = await db.pipe([['HGETALL', S.friends(uid)], ['HGETALL', S.inReq(uid)], ['HGETALL', S.outReq(uid)]]);
  const cmds = [];
  for (const f of Object.keys(toObject(fr) || {})) cmds.push(['HDEL', S.friends(f), uid], ['HDEL', S.unread(f), uid], ['DEL', S.chat(uid, f)]);
  for (const f of Object.keys(toObject(inc) || {})) cmds.push(['HDEL', S.outReq(f), uid]);
  for (const f of Object.keys(toObject(out) || {})) cmds.push(['HDEL', S.inReq(f), uid]);
  cmds.push(['DEL', S.friends(uid), S.inReq(uid), S.outReq(uid), S.blocked(uid), S.unread(uid), S.inbox(uid), S.online(uid), S.ban(uid)]);
  await db.pipe(cmds);
}
