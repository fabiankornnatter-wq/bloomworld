// /api/cron – wird von Vercel Cron alle 10 Minuten aufgerufen (vercel.json) und schickt fällige Erinnerungen.
// Geschützt über CRON_SECRET (setzt Vercel automatisch) – ohne passenden Schlüssel passiert nichts.
import { kvConfigured, kv } from './_lib/kv.js';
import { send, fail } from './_lib/http.js';
import * as P from './_lib/push.js';
import * as AD from './_lib/admin.js';
import * as G from '../js/game.js';
import * as C from '../js/config.js';

// Event-Start und Event-Ende automatisch ankündigen (Ankündigung im Spiel + Push an alle, je einmal pro Event und Jahr)
async function eventAnnouncements(now) {
  const ev = G.activeEvent(now);
  const out = { started: 0, ending: 0 };
  if (!ev) return out;
  const seed = C.EVENT_SEEDS.find((k) => C.SEEDS[k].event === ev.id), seedName = seed ? C.SEEDS[seed].name.replace(/\u00ad/g, '') : null;
  const startKey = `bw:evann:${ev.id}:${ev.year}:start`, endKey = `bw:evann:${ev.id}:${ev.year}:end`;
  if (Number(await kv().cmd('SETNX', startKey, '1')) === 1) {
    await kv().cmd('EXPIRE', startKey, 400 * 86400);
    await AD.postNews('system', { kind: 'event', title: `${ev.name} hat begonnen! 🎉`, text: `${ev.desc} Sammle ${ev.token} bei jeder Ernte${seedName ? ` – und säe die Event-Blume ${seedName}: jede 3. Ernte bringt einen Samen für später.` : '.'} Das Event läuft bis ${new Date(ev.end).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}.` }).catch(() => null);
    out.started = 1;
  }
  const left = ev.end - now;
  if (left > 0 && left < 2 * 86400_000 && Number(await kv().cmd('SETNX', endKey, '1')) === 1) {
    await kv().cmd('EXPIRE', endKey, 400 * 86400);
    await AD.postNews('system', { kind: 'event', title: `${ev.name} endet bald ⏳`, text: `Nur noch bis ${new Date(ev.end).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}: Gib deine ${ev.token} im Event-Shop aus${seedName ? ` und hol dir noch Samen der ${seedName} – danach gibt es sie nur noch in der Tauschbörse` : ''}.` }).catch(() => null);
    out.ending = 1;
  }
  return out;
}

const TEXT = {
  thirsty: ['Deine Blumen haben Durst! 💧', 'Schau vorbei und gieß sie, damit sie weiterwachsen.'],
  ready: ['Blumen sind erntereif! 🌸', 'Deine Ernte wartet im Garten.'],
  breed: ['Züchtung fertig! 🧪', 'Im Gewächshaus wartet eine neue Sorte auf dich.'],
  order: ['Neue Bestellungen beim Händler 🛒', 'Herr Igelmann hat heute neue Aufträge für dich.'],
};

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return fail(res, 401, 'auth', 'Nicht erlaubt.');
  if (!kvConfigured()) return send(res, 200, { ok: true, sent: 0, skipped: 'kv_off' });
  try {
    const now = Date.now();
    const ann = await eventAnnouncements(now).catch((e) => { console.error('cron event', e); return null; });
    if (!P.pushConfigured()) return send(res, 200, { ok: true, sent: 0, skipped: 'push_off', ann });
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
    return send(res, 200, { ok: true, sent, due: due.length, ann });
  } catch (e) { console.error('cron', e); return fail(res, 500, 'server', 'Fehler.'); }
}
