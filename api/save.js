// /api/save – Spielstand des angemeldeten Spielers laden und speichern.
import { kv, kvConfigured } from './_lib/kv.js';
import { send, fail, readJson, cookies, sameOrigin, SESSION_COOKIE } from './_lib/http.js';
import * as A from './_lib/accounts.js';

const MAX_SAVE = 200 * 1024;

export default async function handler(req, res) {
  try {
    if (!kvConfigured()) return fail(res, 503, 'storage', 'Der Spiel-Server ist noch nicht fertig eingerichtet.');
    const s = await A.sessionUser(cookies(req)[SESSION_COOKIE]);
    if (!s) return fail(res, 401, 'not_logged_in', 'Bitte melde dich erneut an.');

    if (req.method === 'GET') {
      const raw = await kv().cmd('GET', A.K.save(s.uid));
      let save = null;
      try { save = raw ? JSON.parse(raw) : null; } catch { save = null; }
      return send(res, 200, { ok: true, save, rev: Number(s.user.rev) || 0 });
    }
    if (req.method !== 'POST') return fail(res, 405, 'method', 'Nicht erlaubt.');
    if (!sameOrigin(req)) return fail(res, 403, 'origin', 'Anfrage abgelehnt.');
    await A.rateLimit('save', s.uid, 90, 60);

    let body;
    try { body = await readJson(req); } catch (e) { return fail(res, e.status === 413 ? 413 : 400, 'body', 'Der Spielstand konnte nicht gelesen werden.'); }
    const save = body.save;
    if (!save || typeof save !== 'object' || Array.isArray(save) || !Number.isFinite(save.v)) return fail(res, 400, 'invalid', 'Ungültiger Spielstand.');
    const data = JSON.stringify(save);
    if (data.length > MAX_SAVE) return fail(res, 413, 'too_big', 'Der Spielstand ist zu groß.');
    const base = Number.isFinite(body.base) ? body.base : -1;
    const r = await kv().casSave(A.K.user(s.uid), A.K.save(s.uid), base, data, Date.now(), body.force === true, Math.floor(save.v));
    if (r.code === -1) return fail(res, 401, 'not_logged_in', 'Dieses Konto gibt es nicht mehr.');
    if (r.code === -2) return fail(res, 409, 'outdated', 'Es gibt eine neue Version von BloomWorld. Bitte lade die Seite neu.', { rev: r.rev });
    if (!r.ok) {
      // Ein anderes Gerät hat inzwischen gespeichert: aktuellen Stand mitschicken
      const raw = await kv().cmd('GET', A.K.save(s.uid));
      let cur = null; try { cur = raw ? JSON.parse(raw) : null; } catch { cur = null; }
      return send(res, 409, { ok: false, error: 'conflict', message: 'Auf einem anderen Gerät wurde weitergespielt.', save: cur, rev: r.rev });
    }
    // Level für die Freundesliste merken
    if (Number.isFinite(save.level)) { try { await A.referralCheck(s.uid, Math.floor(save.level)); } catch { /* optional */ } }
    if (Number.isFinite(save.level)) { try { await kv().cmd('HSET', A.K.user(s.uid), 'lvl', Math.max(1, Math.min(999, Math.floor(save.level))), 'title', typeof save.title === 'string' ? save.title.slice(0, 24) : ''); } catch { /* nicht wichtig */ } }
    return send(res, 200, { ok: true, rev: r.rev });
  } catch (e) {
    if (e instanceof A.UserError) return fail(res, e.status, e.code, e.message);
    console.error('save', e);
    return fail(res, 500, 'server', 'Speichern auf dem Server fehlgeschlagen. Dein Fortschritt ist auf diesem Gerät gesichert.');
  }
}
