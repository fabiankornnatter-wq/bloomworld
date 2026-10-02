// /api/auth – Registrieren, Anmelden, Abmelden, Konto löschen, aktueller Spieler.
import { kvConfigured, kv } from './_lib/kv.js';
import { send, fail, readJson, cookies, sameOrigin, clientIp, sessionCookie, SESSION_COOKIE } from './_lib/http.js';
import * as A from './_lib/accounts.js';
import { isAdmin } from './_lib/admin.js';
import { purgeUser } from './_lib/social.js';

const pub = async (uid, user) => ({ ...A.publicUser(uid, user), admin: await isAdmin(uid), mustRename: user.mustRename === '1' });

// Passwort-Reset per E-Mail, wenn ein Mail-Dienst hinterlegt ist (RESEND_API_KEY + MAIL_FROM in den Vercel-Umgebungsvariablen)
async function sendResetMail(to, code) {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM || 'BloomWorld <onboarding@resend.dev>';
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject: 'BloomWorld: Passwort zurücksetzen', text: `Hallo!\n\nDein Code zum Zurücksetzen des Passworts lautet: ${code}\n\nEr ist 30 Minuten gültig. Gib ihn im Spiel unter „Passwort vergessen“ ein. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.\n\nDein BloomWorld-Team` }) });
  return r.ok;
}

const NOT_READY = 'Der Spiel-Server ist noch nicht fertig eingerichtet. Bitte versuche es später noch einmal.';

export default async function handler(req, res) {
  try {
    if (!kvConfigured()) return fail(res, 503, 'storage', NOT_READY);
    const token = cookies(req)[SESSION_COOKIE];

    if (req.method === 'GET') {
      const s = await A.sessionUser(token);
      // Nicht angemeldet ist kein Fehler: user = null
      if (!s) return send(res, 200, { ok: true, user: null });
      let renewed = false;
      try { renewed = await A.renewSession(token); } catch { /* nicht schlimm */ }
      return send(res, 200, { ok: true, user: await pub(s.uid, s.user) }, renewed ? { 'Set-Cookie': sessionCookie(req, token) } : {});
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
        try { await A.setReferrer(uid, body.ref); } catch { /* Einladung ist optional */ }
        try { const k = `bw:stat:reg:${new Date().toISOString().slice(0, 10)}`; await kv().pipe([['INCR', k], ['EXPIRE', k, 400 * 86400]]); } catch { /* Statistik */ }
        const remember = body.remember !== false;
        const t = await A.createSession(uid, remember);
        return send(res, 201, { ok: true, user: await pub(uid, user) }, { 'Set-Cookie': sessionCookie(req, t, remember) });
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
        const remember = body.remember !== false;
        const t = await A.createSession(uid, remember);
        return send(res, 200, { ok: true, user: await pub(uid, user) }, { 'Set-Cookie': sessionCookie(req, t, remember) });
      }
      case 'rename': {
        const s = await A.sessionUser(token);
        if (!s) return fail(res, 401, 'not_logged_in', 'Bitte melde dich zuerst an.');
        await A.rateLimit('rename', s.uid, 5, 3600);
        const name = await A.renameUser(s.uid, s.user, body.name);
        return send(res, 200, { ok: true, user: await pub(s.uid, { ...s.user, name, mustRename: '0' }) });
      }
      case 'forgot': {
        await A.rateLimit('forgot-ip', ip, 10, 3600);
        const uid = await A.findLogin(body.login);
        const u = uid ? await A.getUser(uid) : null;
        // Immer dieselbe Antwort, damit niemand Konten erraten kann
        if (u) {
          await A.rateLimit('forgot-uid', uid, 3, 3600);
          const { makeResetCode } = await import('./_lib/admin.js');
          const code = await makeResetCode(uid);
          let sent = false; try { sent = await sendResetMail(u.email, code); } catch (e) { console.error('mail', e); }
          return send(res, 200, { ok: true, mail: sent });
        }
        return send(res, 200, { ok: true, mail: !!process.env.RESEND_API_KEY });
      }
      case 'resetPassword': {
        await A.rateLimit('reset-ip', ip, 20, 3600);
        const uid = await A.findLogin(body.login);
        const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const { sha256 } = await import('./_lib/http.js');
        const hit = uid && code.length >= 6 ? await kv().cmd('GET', `bw:pwreset:${sha256(uid + ':' + code)}`) : null;
        if (!hit || hit !== uid) return fail(res, 401, 'bad_code', 'Der Code ist falsch oder abgelaufen.');
        await A.setPassword(uid, body.password);
        await kv().cmd('DEL', `bw:pwreset:${sha256(uid + ':' + code)}`);
        const u = await A.getUser(uid);
        const t = await A.createSession(uid, true);
        return send(res, 200, { ok: true, user: await pub(uid, u) }, { 'Set-Cookie': sessionCookie(req, t, true) });
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
        try { await purgeUser(s.uid); } catch (e) { console.error('purge', e); }
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
