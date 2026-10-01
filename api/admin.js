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
    const L = (action, detail) => AD.log(me.user.name, action, detail);
    switch (b.action) {
      case 'overview': {
        const [news, reports, bans, stats, gifts, codes, feedback, pub, boosts, offer, legal, logs, words] = await Promise.all([AD.news(50), AD.reports(), AD.bans(), AD.stats(), AD.giftsAll(), AD.codes(), AD.feedback(), AD.getPublic(), AD.allBoosts(), AD.getTraderOffer(), AD.getLegal(), AD.logs(), AD.words()]);
        const { pushConfigured, generateVapid } = await import('./_lib/push.js');
        const pushStats = pushConfigured() ? { on: true } : { on: false, keys: generateVapid() };
        return send(res, 200, { ok: true, news, reports, bans, stats, gifts, codes, feedback, maint: pub.maint, boosts, offer, legal, logs, words, mail: !!process.env.RESEND_API_KEY, push: pushStats });
      }
      case 'post': { const item = await AD.postNews(me.user.name, b); await L('Ankündigung', item.title); return send(res, 200, { ok: true, item }); }
      case 'findPlayer': return send(res, 200, { ok: true, player: await AD.findPlayer(b.q) });
      case 'grant': { const r = await AD.grantPlayer(me.user.name, String(b.id || ''), b); await L('Gutschrift', `${b.id}: ${r.coins} Münzen ${JSON.stringify(r.items)}`); return send(res, 200, { ok: true }); }
      case 'forceRename': await AD.forceRename(String(b.id || ''), b.on !== false); await L('Name zurücksetzen', String(b.id || '')); return send(res, 200, { ok: true });
      case 'resetCode': { if (!(await A.getUser(String(b.id || '')))) return fail(res, 404, 'not_found', 'Spieler nicht gefunden.'); const code = await AD.makeResetCode(String(b.id)); await L('Reset-Code', String(b.id)); return send(res, 200, { ok: true, code }); }
      case 'maintenance': { const v = await AD.setMaintenance(b.on, b.text, b.until); await L('Wartung', v.on ? `an: ${v.text}` : 'aus'); return send(res, 200, { ok: true, maint: v }); }
      case 'boost': { const v = await AD.setBoost(String(b.id || ''), b.hours, b.mult); await L('Event-Schalter', `${b.id} ${v ? `${b.hours}h ×${v.mult}` : 'aus'}`); return send(res, 200, { ok: true, boost: v }); }
      case 'traderOffer': { const v = await AD.setTraderOffer(b); await L('Händler-Angebot', v ? `${v.kind} ${v.id} −${Math.round(v.off * 100)} %` : 'gelöscht'); return send(res, 200, { ok: true, offer: v }); }
      case 'legal': await AD.setLegal(String(b.key || ''), b.text); await L('Rechtstext', String(b.key || '')); return send(res, 200, { ok: true });
      case 'pushAll': { const t = String(b.title || '').trim().slice(0, 60), x = String(b.text || '').trim().slice(0, 150); if (!t || !x) return fail(res, 400, 'text', 'Titel und Text angeben.'); const n = await AD.pushAll({ title: t, body: x, tag: 'admin', url: '/' }); await L('Push an alle', `${t} (${n} Geräte)`); return send(res, 200, { ok: true, sent: n }); }
      case 'addWord': { const w = await AD.addWord(b.word); await L('Wortfilter +', w); return send(res, 200, { ok: true }); }
      case 'removeWord': await AD.removeWord(b.word); await L('Wortfilter −', String(b.word || '')); return send(res, 200, { ok: true });
      case 'deleteNews': return send(res, 200, { ok: await AD.deleteNews(String(b.id || '')) });
      case 'resolve': return send(res, 200, { ok: await AD.resolveReport(String(b.id || '')) });
      case 'giftAll': { const item = await AD.giftAll(me.user.name, b); await L('Geschenk an alle', `${item.title}: ${item.coins} Münzen`); return send(res, 200, { ok: true, item }); }
      case 'ban': await AD.ban(b.id, b.days, b.reason); await L('Chat-Sperre', `${b.id} ${b.days} Tage`); return send(res, 200, { ok: true });
      case 'createCode': return send(res, 200, { ok: true, item: await AD.createCode(b) });
      case 'deleteCode': await AD.deleteCode(b.code); return send(res, 200, { ok: true });
      case 'deleteFeedback': return send(res, 200, { ok: await AD.deleteFeedback(String(b.id || '')) });
      case 'unban': await AD.unban(String(b.id || '')); return send(res, 200, { ok: true });
      default: return fail(res, 400, 'action', 'Unbekannte Aktion.');
    }
  } catch (e) {
    if (e instanceof A.UserError) return fail(res, e.status, e.code, e.message);
    console.error('admin', e);
    return fail(res, 500, 'server', 'Auf dem Server ist ein Fehler aufgetreten.');
  }
}
