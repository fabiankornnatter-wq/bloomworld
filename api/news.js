// /api/news – Ankündigungen und Update-Hinweise für alle Spieler (öffentlich lesbar).
import { kvConfigured } from './_lib/kv.js';
import { send, fail } from './_lib/http.js';
import { news } from './_lib/admin.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return fail(res, 405, 'method', 'Nicht erlaubt.');
    if (!kvConfigured()) return send(res, 200, { ok: true, news: [] });
    return send(res, 200, { ok: true, news: await news(20) }, { 'Cache-Control': 'public, max-age=20, s-maxage=20' });
  } catch (e) {
    console.error('news', e);
    return fail(res, 500, 'server', 'Neuigkeiten konnten nicht geladen werden.');
  }
}
