// /api/auth – Registrieren, Anmelden, Abmelden, Konto löschen, aktueller Spieler.
import { kvConfigured } from './_lib/kv.js';
import { send, fail, readJson, cookies, sameOrigin, clientIp, sessionCookie, SESSION_COOKIE } from './_lib/http.js';
import * as A from './_lib/accounts.js';

const NOT_READY = 'Der Spiel-Server ist noch nicht fertig eingerichtet. Bitte versuche es später noch einmal.';

export default async function handler(req, res) {
  try {
    if (!kvConfigured()) return fail(res, 503, 'storage', NOT_READY);
    const token = cookies(req)[SESSION_COOKIE];

    if (req.method === 'GET') {
      const s = await A.sessionUser(token);
      // Nicht angemeldet ist kein Fehler: user = null
      return send(res, 200, { ok: true, user: s ? A.publicUser(s.uid, s.user) : null });
    }
    if (req.method !== 'POST') return fail(res, 405, 'method', 'Nicht erlaubt.', {});
    if (!sameOrigin(req)) return fail(res, 403, 'origin', 'Anfrage abgelehnt.');

    let body;
    try { body = await readJson(req); } catch (e) { return fail(res, e.status === 413 ? 413 : 400, 'body', 'Die Anfrage konnte nicht gelesen werden.'); }
    const ip = clientIp(req);

    switch (body.action) {
      case 'register': {
        await A.rateLimit('reg', ip, 8, 3600);
        const { uid, user } = await A.register(body);
        const t = await A.createSession(uid);
        return send(res, 201, { ok: true, user: A.publicUser(uid, user) }, { 'Set-Cookie': sessionCookie(req, t) });
      }
      case 'login': {
        await A.rateLimit('login-ip', ip, 40, 900);
        // Fehlversuche pro Konto: je Netzwerk eng begrenzt, insgesamt großzügiger (kein Aussperren durch Fremde)
        const target = await A.findLogin(body.login);
        if (target) { await A.rateCheck('fail-uid-ip', `${target}|${ip}`, 8); await A.rateCheck('fail-uid', target, 60); }
        let res1;
        try { res1 = await A.login(body); } catch (e) {
          if (target && e.code === 'bad_login') { await A.rateLimit('fail-uid-ip', `${target}|${ip}`, 1e9, 900); await A.rateLimit('fail-uid', target, 1e9, 900); }
          throw e;
        }
        const { uid, user } = res1;
        const t = await A.createSession(uid);
        return send(res, 200, { ok: true, user: A.publicUser(uid, user) }, { 'Set-Cookie': sessionCookie(req, t) });
      }
      case 'logout': {
        const s = await A.sessionUser(token);
        await A.endSession(token, s?.uid);
        return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, null) });
      }
      case 'delete': {
        const s = await A.sessionUser(token);
        if (!s) return fail(res, 401, 'not_logged_in', 'Bitte melde dich zuerst an.');
        await A.rateLimit('delete', s.uid, 8, 900);
        if (!(await A.verifyPassword(String(body.password ?? ''), s.user.pw))) return fail(res, 401, 'bad_password', 'Das Passwort stimmt nicht.');
        await A.deleteAccount(s.uid, s.user);
        return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, null) });
      }
      default:
        return fail(res, 400, 'action', 'Unbekannte Aktion.');
    }
  } catch (e) {
    if (e instanceof A.UserError) return fail(res, e.status, e.code, e.message);
    console.error('auth', e);
    return fail(res, 500, 'server', 'Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es gleich noch einmal.');
  }
}
