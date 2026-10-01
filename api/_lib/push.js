// Web-Push ohne Fremdpakete: VAPID-Signatur (ES256) und Verschlüsselung (aes128gcm) mit Node-Bordmitteln.
// Schlüssel liegen nur in Vercel-Umgebungsvariablen: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url), VAPID_SUBJECT (mailto:…).
import crypto from 'node:crypto';
import { kv } from './kv.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const publicKey = () => process.env.VAPID_PUBLIC_KEY || '';

// Hilfe für den Admin: ein Schlüsselpaar erzeugen (wird nicht gespeichert – nur angezeigt)
export function generateVapid() {
  const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const raw = pub.export({ format: 'jwk' }), rp = priv.export({ format: 'jwk' });
  const pubRaw = Buffer.concat([Buffer.from([4]), fromB64u(raw.x), fromB64u(raw.y)]);
  return { publicKey: b64u(pubRaw), privateKey: rp.d };
}

function privateKeyObject() {
  const d = process.env.VAPID_PRIVATE_KEY, pub = fromB64u(process.env.VAPID_PUBLIC_KEY);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
}

function vapidHeaders(endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || 'mailto:admin@example.com' }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKeyObject(), dsaEncoding: 'ieee-p1363' });
  return { Authorization: `vapid t=${header}.${payload}.${b64u(sig)}, k=${process.env.VAPID_PUBLIC_KEY}` };
}

const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

// Nachricht nach RFC 8291 (aes128gcm) verschlüsseln
function encrypt(sub, data) {
  const p256dh = fromB64u(sub.keys.p256dh), auth = fromB64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const local = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(p256dh);
  const salt = crypto.randomBytes(16);
  const ikm = hkdf(auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), p256dh, local]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(data), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.concat([salt, Buffer.from([0, 0, 16, 0]), Buffer.from([local.length]), local]);
  return Buffer.concat([header, body]);
}

export async function sendPush(sub, payload) {
  if (!pushConfigured() || !sub?.endpoint) return { ok: false, gone: false };
  try {
    const body = encrypt(sub, JSON.stringify(payload));
    const r = await fetch(sub.endpoint, { method: 'POST', headers: { ...vapidHeaders(sub.endpoint), 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', TTL: '86400', Urgency: 'normal' }, body });
    return { ok: r.ok, gone: r.status === 404 || r.status === 410 };
  } catch (e) { console.error('push', e); return { ok: false, gone: false }; }
}

// ---------- Abonnements je Spieler (mehrere Geräte) ----------
const K = (uid) => `bw:push:${uid}`;
export async function subscribe(uid, sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('bad_sub');
  const id = crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 16);
  await kv().pipe([['HSET', K(uid), id, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, ts: Date.now() })], ['EXPIRE', K(uid), 400 * 86400]]);
  return id;
}
export async function unsubscribe(uid, endpoint) {
  const id = crypto.createHash('sha256').update(String(endpoint || '')).digest('hex').slice(0, 16);
  await kv().cmd('HDEL', K(uid), id);
}
export async function subsOf(uid) {
  const h = await kv().cmd('HGETALL', K(uid));
  const o = Array.isArray(h) ? h.reduce((a, x, i) => (i % 2 ? a : { ...a, [x]: h[i + 1] }), {}) : h || {};
  return Object.entries(o).map(([id, v]) => { try { return { id, ...JSON.parse(v) }; } catch { return null; } }).filter(Boolean);
}

// An einen Spieler schicken (alle Geräte); höchstens eine Push je Art und Stunde, damit es nicht nervt
export async function notify(uid, kind, payload, { cooldownSec = 3600 } = {}) {
  if (!pushConfigured()) return 0;
  const gate = `bw:pushgate:${uid}:${kind}`;
  if (cooldownSec && (await kv().cmd('SET', gate, '1', 'EX', cooldownSec, 'NX')) === null) return 0;
  const subs = await subsOf(uid);
  let n = 0;
  for (const s of subs) {
    const r = await sendPush(s, { title: 'BloomWorld', ...payload });
    if (r.ok) n++;
    if (r.gone) await kv().cmd('HDEL', K(uid), s.id);
  }
  return n;
}
