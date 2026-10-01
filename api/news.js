// /api/news – Ankündigungen und Update-Hinweise für alle Spieler (öffentlich lesbar).
import { kvConfigured } from './_lib/kv.js';
import { send, fail } from './_lib/http.js';
import { news, getPublic, getLegal } from './_lib/admin.js';
import { PRIVACY_HTML } from '../js/legal.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return fail(res, 405, 'method', 'Nicht erlaubt.');
    const url = new URL(req.url || '/', 'http://x');
    if (url.searchParams.get('legal')) {
      const key = url.searchParams.get('legal') === 'impressum' ? 'impressum' : 'datenschutz';
      const l = kvConfigured() ? await getLegal() : {};
      return send(res, 200, { ok: true, key, text: l[key] || '', fallback: key === 'datenschutz' ? PRIVACY_HTML : '' }, { 'Cache-Control': 'public, max-age=60' });
    }
    if (!kvConfigured()) return send(res, 200, { ok: true, news: [], boosts: {}, maint: null, offer: null, legal: {} });
    const [n, pub] = await Promise.all([news(20), getPublic()]);
    return send(res, 200, { ok: true, news: n, ...pub }, { 'Cache-Control': 'public, max-age=20, s-maxage=20' });
  } catch (e) {
    console.error('news', e);
    return fail(res, 500, 'server', 'Neuigkeiten konnten nicht geladen werden.');
  }
}
