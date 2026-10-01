// /api/push – Push-Benachrichtigungen: öffentlicher Schlüssel, Abo anlegen/löschen, Erinnerungen planen.
import { kvConfigured, kv } from './_lib/kv.js';
import { send, fail, readJson, cookies, sameOrigin, SESSION_COOKIE } from './_lib/http.js';
import * as A from './_lib/accounts.js';
import * as P from './_lib/push.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return send(res, 200, { ok: true, enabled: P.pushConfigured(), key: P.publicKey() }, { 'Cache-Control': 'public, max-age=300' });
    if (req.method !== 'POST') return fail(res, 405, 'method', 'Nicht erlaubt.');
    if (!kvConfigured()) return fail(res, 503, 'storage', 'Der Spiel-Server ist noch nicht fertig eingerichtet.');
    if (!sameOrigin(req)) return fail(res, 403, 'origin', 'Anfrage abgelehnt.');
    const me = await A.sessionUser(cookies(req)[SESSION_COOKIE]);
    if (!me) return fail(res, 401, 'not_logged_in', 'Bitte melde dich an.');
    let b; try { b = await readJson(req); } catch { return fail(res, 400, 'body', 'Die Anfrage konnte nicht gelesen werden.'); }
    await A.rateLimit('push', me.uid, 60, 60);
    switch (b.action) {
      case 'subscribe': {
        if (!P.pushConfigured()) return fail(res, 503, 'off', 'Push ist auf dem Server noch nicht eingerichtet.');
        try { await P.subscribe(me.uid, b.sub); } catch { return fail(res, 400, 'sub', 'Ungültiges Abonnement.'); }
        return send(res, 200, { ok: true });
      }
      case 'unsubscribe': await P.unsubscribe(me.uid, b.endpoint); return send(res, 200, { ok: true });
      case 'test': { const n = await P.notify(me.uid, 'test', { body: 'Push funktioniert! Du bekommst jetzt Nachrichten aus deinem Garten. 🌸', tag: 'test', url: '/' }, { cooldownSec: 30 }); return send(res, 200, { ok: true, sent: n }); }
      case 'schedule': {
        // Der Browser meldet, wann die nächste Blume Durst hat / reif ist / die Züchtung fertig wird.
        // Ein Cron-Aufruf (/api/push?cron=1, Vercel Cron) verschickt fällige Erinnerungen.
        const items = Array.isArray(b.items) ? b.items.slice(0, 6) : [];
        const now = Date.now();
        const cmds = [['DEL', `bw:remind:${me.uid}`]];
        for (const it of items) {
          const at = Number(it.at);
          if (!['thirsty', 'ready', 'breed', 'order'].includes(it.kind) || !Number.isFinite(at) || at < now - 60_000 || at > now + 3 * 86400_000) continue;
          cmds.push(['HSET', `bw:remind:${me.uid}`, it.kind, String(Math.floor(at))]);
          cmds.push(['ZADD', 'bw:remind:due', String(Math.floor(at)), `${me.uid}:${it.kind}`]);
        }
        cmds.push(['EXPIRE', `bw:remind:${me.uid}`, 4 * 86400]);
        await kv().pipe(cmds);
        return send(res, 200, { ok: true });
      }
      default: return fail(res, 400, 'action', 'Unbekannte Aktion.');
    }
  } catch (e) {
    if (e instanceof A.UserError) return fail(res, e.status, e.code, e.message);
    console.error('push', e);
    return fail(res, 500, 'server', 'Fehler auf dem Server.');
  }
}
