// Konten, Passwörter und Anmeldungen.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { kv, toObject } from './kv.js';
import { sha256, randomToken, SESSION_DAYS } from './http.js';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

const K = {
  user: (uid) => `bw:user:${uid}`,
  email: (e) => `bw:email:${e}`,
  name: (n) => `bw:name:${n}`,
  sess: (h) => `bw:sess:${h}`,
  userSessions: (uid) => `bw:usess:${uid}`,
  save: (uid) => `bw:save:${uid}`,
  rate: (kind, key) => `bw:rl:${kind}:${sha256(String(key)).slice(0, 32)}`,
};
export { K };

export class UserError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// ---------- Eingaben prüfen ----------
export function cleanName(v) {
  const n = String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (n.length < 3 || n.length > 20) throw new UserError(400, 'name', 'Der Spielername muss 3 bis 20 Zeichen lang sein.');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*[\p{L}\p{N}]$/u.test(n)) throw new UserError(400, 'name', 'Der Spielername darf nur Buchstaben, Zahlen, Leerzeichen, Punkt, Bindestrich und Unterstrich enthalten.');
  return n;
}
export const nameKey = (n) => n.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');

export function cleanEmail(v) {
  const e = String(v ?? '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) throw new UserError(400, 'email', 'Bitte gib eine gültige E-Mail-Adresse ein.');
  return e;
}

export function checkPassword(pw) {
  pw = String(pw ?? '');
  if (pw.length < 8) throw new UserError(400, 'password', 'Das Passwort muss mindestens 8 Zeichen lang sein.');
  if (pw.length > 128) throw new UserError(400, 'password', 'Das Passwort darf höchstens 128 Zeichen lang sein.');
  return pw;
}

// ---------- Passwörter ----------
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') { await hashPassword(String(pw)); return false; }
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(String(pw), Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(key, expected);
}

// ---------- Begrenzung von Versuchen ----------
const RATE_MSG = 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann noch einmal.';

// Zählt einen Versuch (Zähler läuft nach windowSec ab – auch wenn einzelne Befehle scheitern)
export async function rateLimit(kind, key, max, windowSec) {
  const k = K.rate(kind, key);
  const [, n] = await kv().pipe([['SET', k, 0, 'EX', windowSec, 'NX'], ['INCR', k]]);
  if (Number(n) > max) throw new UserError(429, 'rate', RATE_MSG);
}
// Nur prüfen, ohne zu zählen
export async function rateCheck(kind, key, max) {
  const n = Number((await kv().cmd('GET', K.rate(kind, key))) || 0);
  if (n >= max) throw new UserError(429, 'rate', RATE_MSG);
}

// ---------- Konten ----------
export const publicUser = (uid, u) => ({ id: uid, name: u.name, email: u.email, created: Number(u.created) || 0 });

export async function getUser(uid) {
  if (!uid || !/^[a-f0-9]{24}$/.test(uid)) return null;
  return toObject(await kv().cmd('HGETALL', K.user(uid)));
}

export async function register({ name, email, password }) {
  name = cleanName(name); email = cleanEmail(email); password = checkPassword(password);
  const db = kv();
  const uid = crypto.randomBytes(12).toString('hex');
  const pw = await hashPassword(password);
  const created = Date.now();
  // Erst das Konto anlegen, dann E-Mail und Namen reservieren – bei Fehlern wird aufgeräumt
  await db.cmd('HSET', K.user(uid), 'name', name, 'email', email, 'pw', pw, 'created', created, 'rev', 0);
  let emailSet = false;
  try {
    if ((await db.cmd('SET', K.email(email), uid, 'NX')) === null) throw new UserError(409, 'email_taken', 'Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich einfach an.');
    emailSet = true;
    if ((await db.cmd('SET', K.name(nameKey(name)), uid, 'NX')) === null) throw new UserError(409, 'name_taken', 'Dieser Spielername ist schon vergeben. Probier einen anderen.');
  } catch (e) {
    try { await db.cmd('DEL', K.user(uid), ...(emailSet ? [K.email(email)] : [])); } catch { /* bestmöglich */ }
    throw e;
  }
  return { uid, user: { name, email, created } };
}

export async function findLogin(login) {
  const l = String(login ?? '').trim();
  if (!l) return null;
  const db = kv();
  const uid = l.includes('@') ? await db.cmd('GET', K.email(l.toLowerCase())) : await db.cmd('GET', K.name(nameKey(l.normalize('NFC').replace(/\s+/g, ' '))));
  return uid || null;
}

export async function login({ login: id, password }) {
  const uid = await findLogin(id);
  const u = uid ? await getUser(uid) : null;
  const ok = await verifyPassword(String(password ?? ''), u?.pw);
  if (!u || !ok) throw new UserError(401, 'bad_login', 'Spielername/E-Mail oder Passwort stimmt nicht.');
  return { uid, user: u };
}

// Neuer Spielername (z. B. nach Zurücksetzen durch den Admin)
export async function renameUser(uid, u, newName) {
  const name = cleanName(newName);
  const db = kv();
  if (nameKey(name) !== nameKey(u.name) && (await db.cmd('SET', K.name(nameKey(name)), uid, 'NX')) === null) throw new UserError(409, 'name_taken', 'Dieser Spielername ist schon vergeben. Probier einen anderen.');
  await db.pipe([['HSET', K.user(uid), 'name', name], ['HDEL', K.user(uid), 'mustRename'], ...(nameKey(name) !== nameKey(u.name) ? [['DEL', K.name(nameKey(u.name))]] : [])]);
  return name;
}

export async function setPassword(uid, pw) {
  const hash = await hashPassword(checkPassword(pw));
  const sessions = await kv().cmd('SMEMBERS', K.userSessions(uid));
  // alle anderen Sitzungen beenden
  await kv().pipe([['HSET', K.user(uid), 'pw', hash], ...(sessions || []).map((h) => ['DEL', K.sess(h)]), ['DEL', K.userSessions(uid)]]);
}

// Kurze Sitzung, wenn „Angemeldet bleiben“ aus ist
export const SHORT_SESSION = 12 * 3600;

export async function createSession(uid, remember = true) {
  const token = randomToken();
  const h = sha256(token);
  await kv().pipe([
    ['SET', K.sess(h), uid, 'EX', remember ? SESSION_DAYS * 86400 : SHORT_SESSION],
    ['SADD', K.userSessions(uid), h],
  ]);
  return token;
}

export async function sessionUser(token) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const uid = await kv().cmd('GET', K.sess(sha256(token)));
  if (!uid) return null;
  const u = await getUser(uid);
  return u ? { uid, user: u } : null;
}

// Wer regelmäßig spielt, bleibt angemeldet: lange Sitzungen werden nach einer Woche wieder
// auf die volle Laufzeit verlängert (kurze Sitzungen nie).
export async function renewSession(token) {
  if (!token || token.length < 20 || token.length > 100) return false;
  const key = K.sess(sha256(token));
  const ttl = Number(await kv().cmd('TTL', key));
  if (!(ttl > 2 * 86400 && ttl < (SESSION_DAYS - 7) * 86400)) return false;
  return Number(await kv().cmd('EXPIRE', key, SESSION_DAYS * 86400)) === 1;
}

export async function endSession(token, uid) {
  if (!token) return;
  const h = sha256(token);
  await kv().pipe([['DEL', K.sess(h)], ['SREM', K.userSessions(uid || 'none'), h]]);
}

export async function deleteAccount(uid, u) {
  const db = kv();
  const sessions = await db.cmd('SMEMBERS', K.userSessions(uid));
  await db.cmd('DEL', K.user(uid), K.save(uid), K.userSessions(uid), K.email(u.email), K.name(nameKey(u.name)), ...(sessions || []).map(K.sess));
}
