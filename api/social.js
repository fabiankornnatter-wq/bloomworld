// /api/social – Freunde, Chat, Geschenke und Gartenbesuche (nur für angemeldete Spieler).
import { kvConfigured } from './_lib/kv.js';
import { send, fail, readJson, cookies, sameOrigin, SESSION_COOKIE } from './_lib/http.js';
import * as A from './_lib/accounts.js';
import * as S from './_lib/social.js';

export default async function handler(req, res) {
  try {
    if (!kvConfigured()) return fail(res, 503, 'storage', 'Der Spiel-Server ist noch nicht fertig eingerichtet.');
    if (req.method !== 'POST') return fail(res, 405, 'method', 'Nicht erlaubt.');
    if (!sameOrigin(req)) return fail(res, 403, 'origin', 'Anfrage abgelehnt.');
    const me = await A.sessionUser(cookies(req)[SESSION_COOKIE]);
    if (!me) return fail(res, 401, 'not_logged_in', 'Bitte melde dich an, um Freunde zu finden.');
    let b;
    try { b = await readJson(req); } catch (e) { return fail(res, e.status === 413 ? 413 : 400, 'body', 'Die Anfrage konnte nicht gelesen werden.'); }
    await A.rateLimit('social', me.uid, 240, 60);
    const uid = me.uid, name = me.user.name;
    let r;
    switch (b.action) {
      case 'sync': r = { ok: true, ...(await S.sync(uid)) }; break;
      case 'request': r = await S.request(uid, name, b.name); break;
      case 'accept': r = await S.accept(uid, b.id); break;
      case 'decline': r = await S.decline(uid, b.id); break;
      case 'cancel': r = await S.cancel(uid, b.id); break;
      case 'remove': r = await S.remove(uid, b.id); break;
      case 'block': r = await S.block(uid, b.id); break;
      case 'unblock': r = await S.unblock(uid, b.id); break;
      case 'history': r = await S.history(uid, b.id, b.after); break;
      case 'send': r = await S.send(uid, b.id, b.text); break;
      case 'report': r = await S.report(uid, name, b.id, b.msg, b.reason); break;
      case 'gift': r = await S.gift(uid, name, b.id, b.kind); break;
      case 'like': r = await S.like(uid, name, b.id); break;
      case 'visit': r = await S.visit(uid, b.id); break;
      case 'help': r = await S.help(uid, name, b.id, b.beds); break;
      default: return fail(res, 400, 'action', 'Unbekannte Aktion.');
    }
    return send(res, 200, r);
  } catch (e) {
    if (e instanceof A.UserError) return fail(res, e.status, e.code, e.message);
    console.error('social', e);
    return fail(res, 500, 'server', 'Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es gleich noch einmal.');
  }
}
