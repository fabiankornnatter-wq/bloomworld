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

test('Admin: Geschenk an alle, Gutscheine, Feedback, Statistik', async () => {
  const ov0 = async (u) => (await call(admin, { cookie: u.cookie, body: { action: 'overview' } }));
  const boss = await register('Boss');
  // Admin ist das älteste Konto – in diesem Testlauf ggf. ein anderes; Admin-Teil nur mit frischer Datenbank
  if (!boss.admin && process.env.BW_TEST_REDIS_URL && !process.env.BW_TEST_FRESH) return;
  const adminUser = boss.admin ? boss : null;
  const player = await register('Pia');
  // Admin aus vorherigem Test finden (Anna ist das älteste Konto der Speicher-Datenbank)
  const any = adminUser || (await (async () => { const r = await call(auth, { body: { action: 'login', login: 'Anna' + tag, password: 'blumen123' }, ip: '10.9.9.9' }); return r.status === 200 ? { cookie: (r.headers['set-cookie'] || '').split(';')[0] } : null; })());
  if (!any) return;
  assert.equal((await call(admin, { cookie: any.cookie, body: { action: 'giftAll', title: 'Sorry!', coins: 200, items: { fert: 3, gold: 9 } } })).status, 200);
  const s1 = (await soc(player, { action: 'sync' })).body;
  const g = s1.inbox.find((x) => x.k === 'teamgift');
  assert.equal(g.coins, 200);
  assert.deepEqual(g.items, { fert: 3 });
  assert.equal((await soc(player, { action: 'sync' })).body.inbox.filter((x) => x.k === 'teamgift').length, 0, 'nur einmal');
  // Gutschein
  assert.equal((await call(admin, { cookie: any.cookie, body: { action: 'createCode', code: 'herbst-2026', coins: 50, items: { rain: 2 }, max: 1, days: 3 } })).status, 200);
  assert.equal((await call(admin, { cookie: any.cookie, body: { action: 'createCode', code: 'HERBST-2026', coins: 1 } })).status, 409);
  let r = await soc(player, { action: 'redeem', code: ' herbst-2026 ' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.item.coins, 50);
  assert.equal((await soc(player, { action: 'redeem', code: 'HERBST-2026' })).status, 409);
  assert.equal((await soc(boss, { action: 'redeem', code: 'HERBST-2026' })).status, 410, 'Limit erreicht');
  assert.equal((await soc(player, { action: 'redeem', code: 'GIBTSNICHT' })).status, 404);
  // Feedback
  assert.equal((await soc(player, { action: 'feedback', kind: 'idea', text: 'Mehr Tiere bitte!' })).status, 200);
  const ov = await ov0(any);
  assert.equal(ov.status, 200);
  assert.ok(ov.body.feedback.some((f) => f.text === 'Mehr Tiere bitte!' && f.kind === 'idea'));
  assert.ok(ov.body.codes.some((c) => c.code === 'HERBST-2026' && c.used === 1));
  assert.ok(ov.body.stats.newToday >= 2);
  assert.ok(ov.body.stats.activeToday >= 1);
  assert.equal((await call(admin, { cookie: player.cookie, body: { action: 'giftAll', coins: 5 } })).status, 403);
});

test('Admin-Werkzeuge: Spieler-Support, Namensreset, Passwort-Reset, Wartung, Events, Rechtstexte, Wortfilter, Protokoll', async () => {
  const fresh = !process.env.BW_TEST_REDIS_URL || process.env.BW_TEST_FRESH;
  if (!fresh) return;
  const r0 = await call(auth, { body: { action: 'login', login: 'Anna' + tag, password: 'blumen123' }, ip: '10.9.9.8' });
  const adm = { cookie: (r0.headers['set-cookie'] || '').split(';')[0] };
  const kim = await register('Kim');
  const A = (body) => call(admin, { cookie: adm.cookie, body });
  // Spieler suchen + Gutschrift
  let r = await A({ action: 'findPlayer', q: kim.name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.player.id, kim.id);
  assert.doesNotMatch(r.body.player.email, /^kim/, 'E-Mail nur maskiert');
  assert.equal((await A({ action: 'grant', id: kim.id, title: 'Sorry', coins: 77, items: { rain: 1 } })).status, 200);
  const inbox = (await soc(kim, { action: 'sync' })).body.inbox.find((x) => x.k === 'teamgift');
  assert.equal(inbox.coins, 77);
  // Namensreset
  assert.equal((await A({ action: 'forceRename', id: kim.id })).status, 200);
  const me = await call(auth, { method: 'GET', cookie: kim.cookie });
  assert.equal(me.body.user.mustRename, true);
  assert.equal((await call(auth, { cookie: kim.cookie, body: { action: 'rename', name: 'Anna' + tag } })).status, 409);
  r = await call(auth, { cookie: kim.cookie, body: { action: 'rename', name: 'Kimi' + tag } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.name, 'Kimi' + tag);
  assert.equal(r.body.user.mustRename, false);
  assert.equal((await call(auth, { body: { action: 'login', login: 'Kimi' + tag, password: 'blumen123' }, ip: '10.9.9.7' })).status, 200);
  assert.equal((await call(auth, { body: { action: 'login', login: 'Kim' + tag, password: 'blumen123' }, ip: '10.9.9.7' })).status, 401, 'alter Name frei');
  // Passwort-Reset mit Admin-Code
  r = await A({ action: 'resetCode', id: kim.id });
  assert.equal(r.status, 200);
  assert.equal((await call(auth, { body: { action: 'resetPassword', login: 'Kimi' + tag, code: 'FALSCH99', password: 'neuespw123' }, ip: '10.9.9.6' })).status, 401);
  r = await call(auth, { body: { action: 'resetPassword', login: 'Kimi' + tag, code: r.body.code.toLowerCase(), password: 'neuespw123' }, ip: '10.9.9.6' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await call(auth, { body: { action: 'login', login: 'Kimi' + tag, password: 'neuespw123' }, ip: '10.9.9.5' })).status, 200);
  assert.equal((await call(auth, { method: 'GET', cookie: kim.cookie })).body.user, null, 'alte Sitzung beendet');
  assert.equal((await call(auth, { body: { action: 'forgot', login: 'Kimi' + tag }, ip: '10.9.9.4' })).body.mail, false);
  // Wartung, Events, Händler-Angebot
  assert.equal((await A({ action: 'maintenance', on: true, text: 'Kurze Wartung', until: Date.now() + 3600_000 })).status, 200);
  assert.equal((await A({ action: 'boost', id: 'doubleXp', hours: 2, mult: 2 })).status, 200);
  assert.equal((await A({ action: 'boost', id: 'hack', hours: 2 })).status, 400);
  assert.equal((await A({ action: 'traderOffer', kind: 'item', id: 'fert', n: 3, off: 0.5 })).status, 200);
  const n = await call(newsApi, { method: 'GET' });
  assert.equal(n.body.maint.text, 'Kurze Wartung');
  assert.equal(n.body.boosts.doubleXp.mult, 2);
  assert.equal(n.body.offer.price, 45);
  assert.equal((await A({ action: 'maintenance', on: false })).status, 200);
  assert.equal((await call(newsApi, { method: 'GET' })).body.maint, null);
  // Rechtstexte + Wortfilter
  assert.equal((await A({ action: 'legal', key: 'impressum', text: 'Max Muster\nMusterweg 1' })).status, 200);
  const req = Readable.from([]); req.method = 'GET'; req.url = '/api/news?legal=impressum'; req.headers = { host: 'localhost:3000' };
  const leg = await new Promise((resolve) => { const res = { statusCode: 200, setHeader() {}, end: (t) => resolve(JSON.parse(t)) }; newsApi(req, res); });
  assert.equal(leg.text, 'Max Muster\nMusterweg 1');
  const reqA = Readable.from([]); reqA.method = 'GET'; reqA.url = '/api/news?legal=agb'; reqA.headers = { host: 'localhost:3000' };
  const agb = await new Promise((resolve) => { const res = { statusCode: 200, setHeader() {}, end: (t) => resolve(JSON.parse(t)) }; newsApi(reqA, res); });
  assert.match(agb.text, /Nutzungsbedingungen/);
  assert.equal(agb.custom, false, 'Vorlage, solange nichts gespeichert');
  assert.equal((await A({ action: 'addWord', word: 'Blubberwort' })).status, 200);
  const ben = { cookie: (await call(auth, { body: { action: 'login', login: 'Ben' + tag, password: 'blumen123' }, ip: '10.9.9.3' })).headers['set-cookie'].split(';')[0] };
  await soc(adm, { action: 'request', name: 'Ben' + tag }); // Ben hatte Anna blockiert -> bleibt blockiert; Test über Kim
  const kimNew = { cookie: (await call(auth, { body: { action: 'login', login: 'Kimi' + tag, password: 'neuespw123' }, ip: '10.9.9.2' })).headers['set-cookie'].split(';')[0] };
  await soc(kimNew, { action: 'request', name: 'Ben' + tag }); await soc(ben, { action: 'accept', id: kim.id });
  const msg = await soc(kimNew, { action: 'send', id: (await soc(kimNew, { action: 'sync' })).body.friends[0].id, text: 'so ein blubberwort' });
  assert.equal(msg.status, 200, JSON.stringify(msg.body));
  assert.equal(msg.body.message.t, 'so ein ***********');
  const ov = await A({ action: 'overview' });
  assert.ok(ov.body.logs.some((l) => l.action === 'Rechtstext'));
  assert.ok(ov.body.words.includes('blubberwort'));
});

test('Tauschbörse: Angebot, Liste, Annehmen, Abbrechen, Samen-Geschenk', async () => {
  const dora = await register('Dora'), emil = await register('Emil');
  let r = await soc(dora, { action: 'tradeOffer', give: 'marigold', giveN: 2, want: 'heartRose', wantN: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const id = r.body.offer.id;
  assert.equal((await soc(dora, { action: 'tradeOffer', give: 'marigold', giveN: 2, want: 'marigold', wantN: 1 })).status, 400);
  assert.equal((await soc(dora, { action: 'tradeOffer', give: 'daisy', giveN: 2, want: 'heartRose', wantN: 1 })).status, 400);
  let list = (await soc(emil, { action: 'trades' })).body;
  const mine = list.offers.find((o) => o.id === id);
  assert.ok(mine && !mine.mine && mine.name === dora.name);
  assert.equal((await soc(dora, { action: 'trades' })).body.open, 1);
  // eigenes Angebot nicht annehmbar, fremdes schon
  assert.equal((await soc(dora, { action: 'tradeAccept', id })).status, 400);
  r = await soc(emil, { action: 'tradeAccept', id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.offer.give, 'marigold');
  assert.equal((await soc(emil, { action: 'tradeAccept', id })).status, 404);
  // Dora bekommt die Samen über die Inbox
  const sb = (await soc(dora, { action: 'sync' })).body;
  const done = sb.inbox.find((x) => x.k === 'tradeDone');
  assert.ok(done && done.offer.want === 'heartRose' && done.name === emil.name);
  // Nur-Freunde-Angebot und Abbrechen
  r = await soc(dora, { action: 'tradeOffer', give: 'crocus', giveN: 1, want: 'lilac', wantN: 1, friendsOnly: true });
  assert.equal((await soc(emil, { action: 'tradeAccept', id: r.body.offer.id })).status, 403);
  assert.equal((await soc(emil, { action: 'tradeCancel', id: r.body.offer.id })).status, 403);
  assert.equal((await soc(dora, { action: 'tradeCancel', id: r.body.offer.id })).status, 200);
  assert.equal((await soc(dora, { action: 'trades' })).body.open, 0);
  // Samen schenken nur unter Freunden
  assert.equal((await soc(dora, { action: 'seedGift', id: emil.id, seed: 'crocus', n: 2 })).status, 403);
  await soc(dora, { action: 'request', name: emil.name }); await soc(emil, { action: 'accept', id: dora.id });
  assert.equal((await soc(dora, { action: 'seedGift', id: emil.id, seed: 'crocus', n: 2 })).status, 200);
  const se = (await soc(emil, { action: 'sync' })).body;
  assert.ok(se.inbox.find((x) => x.k === 'seeds' && x.seed === 'crocus' && x.n === 2));
});
