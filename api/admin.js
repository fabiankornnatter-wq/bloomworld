// /api/admin – nur für das Admin-Konto: Ankündigungen, Meldungen, Chat-Sperren, Statistik.
import { kvConfigured } from './_lib/kv.js';
import { send, fail, readJson, cookies, sameOrigin, SESSION_COOKIE } from './_lib/http.js';
import * as A from './_lib/accounts.js';
import * as AD from './_lib/admin.js';

export default async function handler(req, res) {
  try {
    if (!kvConfigured()) return fail(res, 503, 'storage', 'Der Spiel-Server ist noch nicht fertig eingerichtet.');
    if (req.method !== 'POST') return fail(res, 405, 'method', 'Nicht erlaubt.');
    if (!sameOrigin(req)) return fail(res, 403, 'origin', 'Anfrage abgelehnt.');
    const me = await A.sessionUser(cookies(req)[SESSION_COOKIE]);
    if (!me) return fail(res, 401, 'not_logged_in', 'Bitte melde dich an.');
    if (!(await AD.isAdmin(me.uid))) return fail(res, 403, 'forbidden', 'Nur für den Admin.');
    let b;
    try { b = await readJson(req); } catch { return fail(res, 400, 'body', 'Die Anfrage konnte nicht gelesen werden.'); }
    await A.rateLimit('admin', me.uid, 120, 60);
    switch (b.action) {
      case 'overview': {
        const [news, reports, bans, stats] = await Promise.all([AD.news(50), AD.reports(), AD.bans(), AD.stats()]);
        return send(res, 200, { ok: true, news, reports, bans, stats });
      }
      case 'post': return send(res, 200, { ok: true, item: await AD.postNews(me.user.name, b) });
      case 'deleteNews': return send(res, 200, { ok: await AD.deleteNews(String(b.id || '')) });
      case 'resolve': return send(res, 200, { ok: await AD.resolveReport(String(b.id || '')) });
      case 'ban': await AD.ban(b.id, b.days, b.reason); return send(res, 200, { ok: true });
      case 'unban': await AD.unban(String(b.id || '')); return send(res, 200, { ok: true });
      default: return fail(res, 400, 'action', 'Unbekannte Aktion.');
    }
  } catch (e) {
    if (e instanceof A.UserError) return fail(res, e.status, e.code, e.message);
    console.error('admin', e);
    return fail(res, 500, 'server', 'Auf dem Server ist ein Fehler aufgetreten.');
  }
}
