// Hilfsfunktionen für die Server-Funktionen (Node-Laufzeit auf Vercel).
import crypto from 'node:crypto';

export const MAX_BODY = 256 * 1024;

export function send(res, status, obj, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}

export const fail = (res, status, error, message, extra = {}) => send(res, status, { ok: false, error, message, ...extra });

export async function readJson(req) {
  let b = req.body;
  if (b !== undefined && b !== null) {
    if (Buffer.isBuffer(b)) b = b.toString('utf8');
    if (typeof b === 'string') { if (b.length > MAX_BODY) throw httpError(413); return b ? JSON.parse(b) : {}; }
    if (typeof b === 'object') return b;
  }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw httpError(413); chunks.push(c); }
  const txt = Buffer.concat(chunks).toString('utf8');
  return txt ? JSON.parse(txt) : {};
}

export function httpError(status) { const e = new Error('HTTP_' + status); e.status = status; return e; }

export function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* fremdes, kaputtes Cookie ignorieren */ }
  }
  return out;
}

const hostOf = (req) => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
export const isLocal = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hostOf(req));

// Schutz gegen fremde Webseiten (CSRF): nur JSON und nur von der eigenen Adresse
export function sameOrigin(req) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.toLowerCase().startsWith('application/json')) return false;
  const origin = req.headers.origin;
  if (!origin) return true; // z.B. ältere Browser; SameSite-Cookie schützt zusätzlich
  try { return new URL(origin).host.toLowerCase() === hostOf(req); } catch { return false; }
}

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xf || String(req.headers['x-real-ip'] || '') || req.socket?.remoteAddress || 'unknown';
  // IPv6: ein Anschluss hat meist ein ganzes /64-Netz – danach begrenzen
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
}

export const SESSION_COOKIE = 'bw_session';
export const SESSION_DAYS = 60;

// persist = false: Cookie gilt nur bis zum Schließen des Browsers („Angemeldet bleiben“ aus)
export function sessionCookie(req, token, persist = true) {
  const secure = isLocal(req) ? '' : '; Secure';
  if (!token) return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${persist ? `; Max-Age=${SESSION_DAYS * 86400}` : ''}${secure}`;
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
