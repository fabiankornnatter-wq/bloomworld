// /api/cron – wird von Vercel Cron alle 10 Minuten aufgerufen (vercel.json) und schickt fällige Erinnerungen.
// Geschützt über CRON_SECRET (setzt Vercel automatisch) – ohne passenden Schlüssel passiert nichts.
import { kvConfigured, kv } from './_lib/kv.js';
import { send, fail } from './_lib/http.js';
import * as P from './_lib/push.js';

const TEXT = {
  thirsty: ['Deine Blumen haben Durst! 💧', 'Schau vorbei und gieß sie, damit sie weiterwachsen.'],
  ready: ['Blumen sind erntereif! 🌸', 'Deine Ernte wartet im Garten.'],
  breed: ['Züchtung fertig! 🧪', 'Im Gewächshaus wartet eine neue Sorte auf dich.'],
  order: ['Neue Bestellungen beim Händler 🛒', 'Herr Igelmann hat heute neue Aufträge für dich.'],
};

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return fail(res, 401, 'auth', 'Nicht erlaubt.');
  if (!kvConfigured() || !P.pushConfigured()) return send(res, 200, { ok: true, sent: 0, skipped: 'push_off' });
  try {
    const now = Date.now();
    const due = (await kv().cmd('ZRANGEBYSCORE', 'bw:remind:due', '-inf', String(now), 'LIMIT', '0', '200')) || [];
    let sent = 0;
    for (const key of due) {
      const [uid, kind] = String(key).split(':');
      await kv().cmd('ZREM', 'bw:remind:due', key);
      // Noch gültig? (Spieler könnte inzwischen selbst gegossen haben – dann wurde der Eintrag neu gesetzt)
      const planned = Number(await kv().cmd('HGET', `bw:remind:${uid}`, kind));
      if (!planned || planned > now + 60_000) continue;
      await kv().cmd('HDEL', `bw:remind:${uid}`, kind);
      const [title, body] = TEXT[kind] || ['BloomWorld', 'Es gibt Neues in deinem Garten.'];
      sent += await P.notify(uid, kind, { title, body, tag: kind, url: '/' }, { cooldownSec: 2 * 3600 });
    }
    return send(res, 200, { ok: true, sent, due: due.length });
  } catch (e) { console.error('cron', e); return fail(res, 500, 'server', 'Fehler.'); }
}
