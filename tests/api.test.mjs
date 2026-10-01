// Tests für die Server-Funktionen (In-Memory-Speicher)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

// Standard: Test-Datenbank im Speicher. Mit BW_TEST_REDIS_URL=redis://… gegen einen echten Redis-Server.
if (process.env.BW_TEST_REDIS_URL) process.env.REDIS_URL = process.env.BW_TEST_REDIS_URL;
else process.env.BW_DEV_MEMORY_DB = '1';
const auth = (await import('../api/auth.js')).default;
const save = (await import('../api/save.js')).default;

function call(handler, { method = 'GET', body, cookie = '', origin = 'http://localhost:3000', ip = '1.2.3.4', ct = 'application/json' } = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.headers = { host: 'localhost:3000', cookie, 'content-type': ct, 'x-forwarded-for': ip, ...(origin ? { origin } : {}) };
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
      end: (txt) => resolve({ status: res.statusCode, headers, body: JSON.parse(txt) }),
    };
    handler(req, res);
  });
}
const cookieOf = (r) => (r.headers['set-cookie'] || '').split(';')[0];

test('Registrieren, Anmelden, Spielstand speichern und laden', async () => {
  const r = await call(auth, { method: 'POST', body: { action: 'register', name: 'Rosa Gärtnerin', email: 'Rosa@Example.com', password: 'blumen123' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.user.name, 'Rosa Gärtnerin');
  assert.equal(r.body.user.email, 'rosa@example.com');
  assert.match(r.headers['set-cookie'], /HttpOnly/);
  assert.match(r.headers['set-cookie'], /SameSite=Lax/);
  const c = cookieOf(r);

  const me = await call(auth, { cookie: c });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Rosa Gärtnerin');
  assert.equal(me.body.user.pw, undefined, 'Passwort-Hash darf nie herausgegeben werden');

  const empty = await call(save, { cookie: c });
  assert.equal(empty.body.save, null);
  assert.equal(empty.body.rev, 0);

  const s1 = await call(save, { method: 'POST', cookie: c, body: { save: { v: 3, coins: 99 }, base: 0 } });
  assert.equal(s1.status, 200);
  assert.equal(s1.body.rev, 1);
  const loaded = await call(save, { cookie: c });
  assert.equal(loaded.body.save.coins, 99);
  assert.equal(loaded.body.rev, 1);

  // Veralteter Stand -> Konflikt mit aktuellem Stand
  const stale = await call(save, { method: 'POST', cookie: c, body: { save: { v: 3, coins: 5 }, base: 0 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.save.coins, 99);
  assert.equal(stale.body.rev, 1);
  const forced = await call(save, { method: 'POST', cookie: c, body: { save: { v: 3, coins: 5 }, base: 0, force: true } });
  assert.equal(forced.body.rev, 2);
  // Spielstand einer älteren Spielversion darf einen neueren nicht überschreiben
  const old = await call(save, { method: 'POST', cookie: c, body: { save: { v: 2, coins: 1 }, base: 2 } });
  assert.equal(old.status, 409);
  assert.equal(old.body.error, 'outdated');

  // Abmelden -> Sitzung ungültig
  const out = await call(auth, { method: 'POST', cookie: c, body: { action: 'logout' } });
  assert.equal(out.status, 200);
  assert.equal((await call(auth, { cookie: c })).body.user, null);

  // Anmelden mit Name (Groß-/Kleinschreibung egal) und mit E-Mail
  const l1 = await call(auth, { method: 'POST', body: { action: 'login', login: 'rosa gärtnerin', password: 'blumen123' } });
  assert.equal(l1.status, 200, JSON.stringify(l1.body));
  const l2 = await call(auth, { method: 'POST', body: { action: 'login', login: 'ROSA@example.com', password: 'blumen123' } });
  assert.equal(l2.status, 200);
  const bad = await call(auth, { method: 'POST', body: { action: 'login', login: 'rosa@example.com', password: 'falsch123' } });
  assert.equal(bad.status, 401);
  assert.match(bad.body.message, /stimmt nicht/);
});

test('Eingaben werden geprüft und doppelte Konten verhindert', async () => {
  const mk = (b) => call(auth, { method: 'POST', body: { action: 'register', ...b }, ip: '9.9.9.' + Math.floor(Math.random() * 200) });
  assert.equal((await mk({ name: 'ab', email: 'a@b.de', password: '12345678' })).body.error, 'name');
  assert.equal((await mk({ name: 'Max', email: 'kein-mail', password: '12345678' })).body.error, 'email');
  assert.equal((await mk({ name: 'Max', email: 'max@b.de', password: 'kurz' })).body.error, 'password');
  assert.equal((await mk({ name: '<script>', email: 'x@b.de', password: '12345678' })).body.error, 'name');
  assert.equal((await mk({ name: 'Max', email: 'max@b.de', password: '12345678' })).status, 201);
  assert.equal((await mk({ name: 'Moritz', email: 'MAX@b.de', password: '12345678' })).body.error, 'email_taken');
  assert.equal((await mk({ name: 'MAX', email: 'max2@b.de', password: '12345678' })).body.error, 'name_taken');
  // Nach fehlgeschlagener Namensprüfung bleibt die E-Mail frei
  assert.equal((await mk({ name: 'Max Zwei', email: 'max2@b.de', password: '12345678' })).status, 201);
});

test('Schutz: fremde Herkunft, falscher Inhaltstyp, zu viele Versuche', async () => {
  const evil = await call(auth, { method: 'POST', origin: 'https://boese.example', body: { action: 'login', login: 'x', password: 'y' } });
  assert.equal(evil.status, 403);
  const form = await call(auth, { method: 'POST', ct: 'application/x-www-form-urlencoded', body: { action: 'login' } });
  assert.equal(form.status, 403);
  await call(auth, { method: 'POST', ip: '6.6.6.6', body: { action: 'register', name: 'Opfer', email: 'opfer@example.com', password: 'richtig123' } });
  let last;
  for (let i = 0; i < 10; i++) last = await call(auth, { method: 'POST', ip: '5.5.5.5', body: { action: 'login', login: 'opfer@example.com', password: 'raten' + i } });
  assert.equal(last.status, 429, 'Angreifer wird nach mehreren Fehlversuchen gebremst');
  const owner = await call(auth, { method: 'POST', ip: '8.8.8.8', body: { action: 'login', login: 'Opfer', password: 'richtig123' } });
  assert.equal(owner.status, 200, 'Besitzer aus einem anderen Netz wird nicht ausgesperrt');
  const noSession = await call(save, { method: 'POST', body: { save: { v: 3 }, base: 0 } });
  assert.equal(noSession.status, 401);
});

test('Konto löschen entfernt alles und gibt Name und E-Mail frei', async () => {
  const r = await call(auth, { method: 'POST', ip: '7.7.7.7', body: { action: 'register', name: 'Lilly', email: 'lilly@example.com', password: 'tulpen123' } });
  const c = cookieOf(r);
  await call(save, { method: 'POST', cookie: c, body: { save: { v: 3, coins: 1 }, base: 0 } });
  const wrong = await call(auth, { method: 'POST', cookie: c, body: { action: 'delete', password: 'falsch' } });
  assert.equal(wrong.status, 401);
  const del = await call(auth, { method: 'POST', cookie: c, body: { action: 'delete', password: 'tulpen123' } });
  assert.equal(del.status, 200);
  assert.equal((await call(auth, { cookie: c })).body.user, null);
  const again = await call(auth, { method: 'POST', ip: '7.7.7.8', body: { action: 'register', name: 'Lilly', email: 'lilly@example.com', password: 'tulpen123' } });
  assert.equal(again.status, 201);
  assert.equal((await call(save, { cookie: cookieOf(again) })).body.save, null);
});

test('Angemeldet bleiben: dauerhaftes oder Sitzungs-Cookie, Verlängerung', async () => {
  const r = await call(auth, { method: 'POST', ip: '9.9.9.1', body: { action: 'register', name: 'Merle Moos', email: 'merle@example.com', password: 'blumen123' } });
  assert.equal(r.status, 201);
  assert.match(r.headers['set-cookie'], /Max-Age=\d+/);
  const short = await call(auth, { method: 'POST', ip: '9.9.9.1', body: { action: 'login', login: 'Merle Moos', password: 'blumen123', remember: false } });
  assert.equal(short.status, 200);
  assert.doesNotMatch(short.headers['set-cookie'], /Max-Age/);
  const me = await call(auth, { cookie: cookieOf(short) });
  assert.equal(me.body.user.name, 'Merle Moos');
  assert.equal(me.headers['set-cookie'], undefined, 'kurze Sitzungen werden nicht verlängert');
  const me2 = await call(auth, { cookie: cookieOf(r) });
  assert.equal(me2.body.user.name, 'Merle Moos');
});

test('Push: Abo nur mit Schlüsseln, Erinnerungen planen, Cron geschützt', async () => {
  const push = (await import('../api/push.js')).default;
  const cron = (await import('../api/cron.js')).default;
  const r = await call(auth, { method: 'POST', body: { action: 'register', name: 'Pusher', email: 'push@example.com', password: 'blumen123' }, ip: '7.7.7.7' });
  const c = cookieOf(r);
  const info = await call(push, { method: 'GET' });
  assert.equal(info.body.enabled, false);
  assert.equal((await call(push, { method: 'POST', cookie: c, body: { action: 'subscribe', sub: { endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } } } })).status, 503);
  const now = Date.now();
  assert.equal((await call(push, { method: 'POST', cookie: c, body: { action: 'schedule', items: [{ kind: 'thirsty', at: now + 60000 }, { kind: 'hack', at: now }] } })).status, 200);
  process.env.CRON_SECRET = 's3cret';
  const reqNo = Readable.from([]); reqNo.method = 'GET'; reqNo.headers = { host: 'x' };
  const noAuth = await new Promise((resolve) => cron(reqNo, { statusCode: 200, setHeader() {}, end: (t) => resolve(JSON.parse(t)) }));
  assert.equal(noAuth.ok, false);
  const reqOk = Readable.from([]); reqOk.method = 'GET'; reqOk.headers = { host: 'x', authorization: 'Bearer s3cret' };
  const ok = await new Promise((resolve) => cron(reqOk, { statusCode: 200, setHeader() {}, end: (t) => resolve(JSON.parse(t)) }));
  assert.equal(ok.ok, true);
  assert.equal(ok.skipped, 'push_off');
});
