// Tests für Freunde, Chat, Geschenke, Gartenbesuche und Admin (In-Memory-Speicher oder echter Redis)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

if (process.env.BW_TEST_REDIS_URL) process.env.REDIS_URL = process.env.BW_TEST_REDIS_URL;
else process.env.BW_DEV_MEMORY_DB = '1';
const auth = (await import('../api/auth.js')).default;
const save = (await import('../api/save.js')).default;
const social = (await import('../api/social.js')).default;
const admin = (await import('../api/admin.js')).default;
const newsApi = (await import('../api/news.js')).default;
const G = await import('../js/game.js');
const { cleanText } = await import('../api/_lib/social.js');

function call(handler, { method = 'POST', body, cookie = '', ip = '5.6.7.8' } = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.headers = { host: 'localhost:3000', cookie, 'content-type': 'application/json', 'x-forwarded-for': ip, origin: 'http://localhost:3000' };
  return new Promise((resolve) => {
    const headers = {};
    const res = { statusCode: 200, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end: (t) => resolve({ status: res.statusCode, headers, body: JSON.parse(t) }) };
    handler(req, res);
  });
}
const tag = Date.now().toString(36).slice(-5);
async function register(name) {
  const r = await call(auth, { body: { action: 'register', name: name + tag, email: `${name}${tag}@example.com`, password: 'blumen123' }, ip: '10.0.0.' + Math.floor(Math.random() * 200) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { cookie: (r.headers['set-cookie'] || '').split(';')[0], id: r.body.user.id, name: r.body.user.name, admin: r.body.user.admin };
}
const soc = (u, body) => call(social, { cookie: u.cookie, body });

test('Textfilter: Links, Kontaktdaten und Schimpfwörter', () => {
  assert.equal(cleanText('  Hallo   du  '), 'Hallo du');
  assert.match(cleanText('schau auf https://evil.example/x'), /\[Link entfernt\]/);
  assert.match(cleanText('www.test.de oder test.com'), /^\[Link entfernt\] oder \[Link entfernt\]$/);
  assert.match(cleanText('mail an a.b@c.de'), /\[entfernt\]/);
  assert.match(cleanText('ruf an 0171 2345678'), /\[entfernt\]/);
  assert.equal(cleanText('Treffen am 01.10.2026'), 'Treffen am 01.10.2026');
  assert.equal(cleanText('du Arschloch'), 'du *********');
  assert.equal(cleanText('x'.repeat(400)).length, 300);
  assert.throws(() => cleanText('   '));
});

test('Freunde, Chat, Geschenk, Besuch, Gießen, Melden, Admin, Sperren, Löschen', async () => {
  const anna = await register('Anna'), ben = await register('Ben'), cara = await register('Cara');
  // Admin ist das älteste Konto (bei echtem Redis mit Altbestand evtl. ein anderes)
  if (!process.env.BW_TEST_REDIS_URL || process.env.BW_TEST_FRESH) assert.equal(anna.admin, true);
  assert.equal(ben.admin, false);

  // Anfrage per Spielername, annehmen
  let r = await soc(anna, { action: 'request', name: ben.name.toUpperCase() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await soc(anna, { action: 'request', name: 'Gibtsnicht' + tag })).status, 404);
  assert.equal((await soc(anna, { action: 'request', name: anna.name })).status, 400);
  let sb = (await soc(ben, { action: 'sync' })).body;
  assert.equal(sb.incoming.length, 1);
  assert.equal(sb.incoming[0].name, anna.name);
  assert.equal(sb.incoming[0].email, undefined);
  assert.equal((await soc(ben, { action: 'accept', id: anna.id })).status, 200);
  const sa = (await soc(anna, { action: 'sync' })).body;
  assert.equal(sa.friends.length, 1);
  assert.equal(sa.friends[0].id, ben.id);
  assert.equal(sa.friends[0].online, true);

  // Chat mit Filter, ungelesen-Zähler
  r = await soc(anna, { action: 'send', id: ben.id, text: 'Hi Ben! Komm auf www.böse.de du Arschloch' });
  assert.equal(r.status, 200);
  assert.doesNotMatch(r.body.message.t, /böse|Arschloch/);
  sb = (await soc(ben, { action: 'sync' })).body;
  assert.equal(sb.friends[0].unread, 1);
  const h = (await soc(ben, { action: 'history', id: anna.id })).body;
  assert.equal(h.messages.at(-1).t.startsWith('Hi Ben!'), true);
  assert.equal((await soc(ben, { action: 'sync' })).body.friends[0].unread, 0);
  assert.equal((await soc(cara, { action: 'send', id: anna.id, text: 'hallo' })).status, 403, 'nur Freunde dürfen schreiben');

  // Melden -> Admin sieht es
  const msgId = h.messages.at(-1).i;
  assert.equal((await soc(ben, { action: 'report', id: anna.id, msg: msgId })).status, 200);
  if (!process.env.BW_TEST_REDIS_URL || process.env.BW_TEST_FRESH) {
    const ov = await call(admin, { cookie: anna.cookie, body: { action: 'overview' } });
    assert.equal(ov.status, 200);
    assert.ok(ov.body.reports.some((x) => x.target === anna.id && x.reporter === ben.id));
    assert.ok(ov.body.stats.users >= 3);
  }
  assert.equal((await call(admin, { cookie: ben.cookie, body: { action: 'overview' } })).status, 403);

  // Geschenk: einmal am Tag
  r = await soc(anna, { action: 'gift', id: ben.id, kind: 'fert' });
  assert.equal(r.status, 200);
  assert.equal((await soc(anna, { action: 'gift', id: ben.id, kind: 'rain' })).status, 409);
  sb = (await soc(ben, { action: 'sync' })).body;
  const giftItem = sb.inbox.find((x) => x.k === 'gift');
  assert.equal(giftItem.item, 'fert');
  assert.equal(giftItem.n, 2);
  assert.equal((await soc(ben, { action: 'sync' })).body.inbox.length, 0, 'Postfach wird geleert');

  // Annas Garten mit durstiger Sonnenblume speichern, Ben besucht und gießt
  const now = Date.now();
  const st = G.newState(now - 600000); st.coins = 500; st.level = 3;
  assert.ok(G.plant(st, 0, 'sunflower', now - 70000, () => 0.99).ok);
  assert.ok(G.plant(st, 1, 'daisy', now - 5000, () => 0.99).ok);
  assert.equal((await call(save, { cookie: anna.cookie, body: { save: st, base: 0 } })).status, 200);
  const v = await soc(ben, { action: 'visit', id: anna.id });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal(v.body.garden.name, anna.name);
  assert.equal(v.body.garden.beds[0].seed, 'sunflower');
  assert.equal(v.body.garden.email, undefined);
  assert.equal(v.body.helpLeft, 5);
  r = await soc(ben, { action: 'help', id: anna.id, beds: [0, 1, 99] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.beds, [0]);
  assert.equal(r.body.coins, 5);
  assert.equal((await soc(ben, { action: 'help', id: anna.id, beds: [1] })).status, 409, 'Gänseblümchen hat keinen Durst');
  assert.equal((await soc(ben, { action: 'like', id: anna.id })).status, 200);
  assert.equal((await soc(ben, { action: 'like', id: anna.id })).status, 409);
  const ia = (await soc(anna, { action: 'sync' })).body;
  assert.deepEqual(ia.inbox.find((x) => x.k === 'help').beds, [0]);
  assert.equal(ia.inbox.find((x) => x.k === 'like').coins, 10);
  assert.equal((await soc(ben, { action: 'sync' })).body.friends[0].level, 3, 'Level kommt aus dem Spielstand');
  assert.equal((await soc(cara, { action: 'visit', id: anna.id })).status, 403);

  // Ankündigungen
  if (!process.env.BW_TEST_REDIS_URL || process.env.BW_TEST_FRESH) {
    assert.equal((await call(admin, { cookie: anna.cookie, body: { action: 'post', title: 'Willkommen!', text: 'Version 3.3 ist da.', kind: 'update' } })).status, 200);
    const n = await call(newsApi, { method: 'GET' });
    assert.equal(n.body.news[0].title, 'Willkommen!');
    assert.equal(n.body.news[0].kind, 'update');
    // Chat-Sperre
    assert.equal((await call(admin, { cookie: anna.cookie, body: { action: 'ban', id: ben.id, days: 1, reason: 'Test' } })).status, 200);
    assert.equal((await soc(ben, { action: 'send', id: anna.id, text: 'hallo' })).status, 403);
    assert.equal((await soc(ben, { action: 'sync' })).body.chatBanned, true);
    assert.equal((await call(admin, { cookie: anna.cookie, body: { action: 'unban', id: ben.id } })).status, 200);
    assert.equal((await soc(ben, { action: 'send', id: anna.id, text: 'wieder da' })).status, 200);
  }
  assert.equal((await call(admin, { cookie: ben.cookie, body: { action: 'post', title: 'Hack', text: 'x' } })).status, 403);

  // Blockieren: Freundschaft weg, neue Anfragen kommen nicht an
  assert.equal((await soc(ben, { action: 'block', id: anna.id })).status, 200);
  assert.equal((await soc(anna, { action: 'sync' })).body.friends.length, 0);
  assert.equal((await soc(anna, { action: 'request', name: ben.name })).status, 200);
  assert.equal((await soc(ben, { action: 'sync' })).body.incoming.length, 0);
  assert.equal((await soc(ben, { action: 'sync' })).body.blocked[0].id, anna.id);

  // Konto löschen räumt Freundschaften auf
  await soc(cara, { action: 'request', name: anna.name });
  await soc(anna, { action: 'accept', id: cara.id });
  assert.equal((await soc(anna, { action: 'sync' })).body.friends.length, 1);
  assert.equal((await call(auth, { cookie: cara.cookie, body: { action: 'delete', password: 'blumen123' } })).status, 200);
  assert.equal((await soc(anna, { action: 'sync' })).body.friends.length, 0);
});
