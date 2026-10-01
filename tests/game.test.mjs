// Tests der Spiellogik:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import * as C from '../js/config.js';
import { LocalStore } from '../js/storage.js';

const T0 = new Date(2026, 9, 1, 10, 0, 0).getTime();
const never = () => 0.99; // nie golden
const always = () => 0.0; // immer golden

test('neuer Spielstand: 50 Münzen, 6 offene + 3 gesperrte Beete', () => {
  const s = G.newState(T0);
  assert.equal(s.coins, 50);
  assert.equal(s.beds.filter((b) => !b.locked).length, 6);
  assert.equal(s.beds.filter((b) => b.locked).length, 3);
});

test('pflanzen kostet Münzen und belegt das Beet', () => {
  const s = G.newState(T0);
  const r = G.plant(s, 0, 'daisy', T0, never);
  assert.ok(r.ok);
  assert.equal(s.coins, 45);
  assert.equal(s.beds[0].seed, 'daisy');
  assert.equal(G.plant(s, 0, 'tulip', T0, never).code, 'occupied');
});

test('nur auf freigeschalteten Beeten pflanzen', () => {
  const s = G.newState(T0);
  assert.equal(G.plant(s, 8, 'daisy', T0, never).code, 'locked');
  assert.equal(G.plant(s, 99, 'daisy', T0, never).code, 'invalid');
  assert.equal(s.coins, 50);
});

test('Münzen werden nie negativ', () => {
  const s = G.newState(T0);
  s.coins = 3;
  const r = G.plant(s, 0, 'daisy', T0, never);
  assert.equal(r.code, 'noCoins');
  assert.equal(s.coins, 3);
  G.addCoins(s, -1000);
  assert.equal(s.coins, 0);
  assert.equal(G.unlockBed(s, 6).code, 'noCoins');
  assert.equal(G.buyDeco(s, 'bench').code, 'noCoins');
  assert.equal(s.coins, 0);
});

test('ernten erst nach Wachstumszeit, dann Belohnung + XP + Sammlung', () => {
  const s = G.newState(T0);
  G.plant(s, 1, 'tulip', T0, never);
  assert.equal(G.harvest(s, 1, T0 + 1000).code, 'notReady');
  const info = G.bedInfo(s, 1, T0 + C.SEEDS.tulip.growMs * 0.5);
  assert.equal(info.stage, 1);
  const r = G.harvest(s, 1, T0 + C.SEEDS.tulip.growMs);
  assert.ok(r.ok);
  assert.equal(r.reward, 25);
  assert.equal(s.coins, 50 - 10 + 25);
  assert.equal(s.collection.tulip.count, 1);
  assert.equal(s.beds[1].seed, null);
});

test('goldene Blume bringt dreifache Belohnung', () => {
  const s = G.newState(T0);
  G.plant(s, 0, 'daisy', T0, always);
  const r = G.harvest(s, 0, T0 + C.SEEDS.daisy.growMs);
  assert.equal(r.golden, true);
  assert.equal(r.reward, 36);
  assert.equal(s.collection.daisy.golden, 1);
});

test('Level-Aufstieg schaltet Sonnenblume frei', () => {
  const s = G.newState(T0);
  assert.equal(G.plant(s, 0, 'sunflower', T0, never).code, 'seedLocked');
  const ups = G.addXp(s, 25);
  assert.equal(s.level, 2);
  assert.deepEqual(ups[0].unlocks, ['sunflower']);
  assert.ok(G.plant(s, 0, 'sunflower', T0, never).ok);
});

test('seltene Blumen erst nach Freischaltung im Shop', () => {
  const s = G.newState(T0);
  s.coins = 1000;
  assert.equal(G.plant(s, 0, 'rose', T0, never).code, 'seedLocked');
  assert.ok(G.unlockRareSeed(s, 'rose').ok);
  assert.equal(s.coins, 850);
  assert.ok(G.plant(s, 0, 'rose', T0, never).ok);
  assert.equal(G.unlockRareSeed(s, 'rose').code, 'owned');
});

test('Beet freischalten', () => {
  const s = G.newState(T0);
  s.coins = 200;
  assert.ok(G.unlockBed(s, 6).ok);
  assert.equal(s.coins, 80);
  assert.ok(G.plant(s, 6, 'daisy', T0, never).ok);
});

test('Tagesaufgaben: Fortschritt, Abholen, Reset am nächsten Tag', () => {
  const s = G.newState(T0);
  s.coins = 1000;
  for (let i = 0; i < 5; i++) G.plant(s, i, 'daisy', T0, never);
  assert.equal(G.claimableTasks(s), 1);
  assert.ok(G.claimTask(s, 'plant', T0).ok);
  assert.equal(G.claimTask(s, 'plant', T0).code, 'claimed');
  assert.equal(G.claimTask(s, 'harvest', T0).code, 'notDone');
  G.ensureDaily(s, T0 + 86_400_000);
  assert.equal(s.tasks.claimed.length, 0);
});

test('Tagesgeschenk einmal pro Tag', () => {
  const s = G.newState(T0);
  assert.ok(G.claimDailyGift(s, T0).ok);
  assert.equal(G.claimDailyGift(s, T0 + 1000).code, 'claimed');
  assert.ok(G.claimDailyGift(s, T0 + 86_400_000).ok);
});

test('Deko und Skins kaufen, Skin wechseln', () => {
  const s = G.newState(T0);
  s.coins = 1000;
  assert.ok(G.buyDeco(s, 'bench').ok);
  assert.equal(G.buyDeco(s, 'bench').code, 'owned');
  assert.ok(G.buySkin(s, 'arctic').ok);
  assert.equal(s.activeSkin.fox, 'arctic');
  assert.ok(G.equipSkin(s, 'fox', 'default').ok);
  assert.equal(G.equipSkin(s, 'fox', 'autumn').code, 'invalid');
});

test('Einstellungen werden geprüft; Zyklusgeschwindigkeit behält die Tageszeit', () => {
  const s = G.newState(T0);
  assert.equal(G.setSetting(s, 'cycle', 'banana', T0).code, 'invalid');
  const t = T0 + 123_456;
  const p1 = G.cyclePhase(s, t);
  G.setSetting(s, 'cycleMin', 3, t);
  assert.ok(Math.abs(G.cyclePhase(s, t) - p1) < 1e-9);
  G.setSetting(s, 'cycle', 'night', t);
  assert.equal(G.cyclePhase(s, t), 0.82);
});

test('Speichern und Laden über LocalStore (Neuladen verliert nichts)', async () => {
  const mem = new Map();
  const ls = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const store = new LocalStore(ls);
  const s = G.newState(T0);
  G.plant(s, 2, 'tulip', T0, never);
  s.coins = 777;
  await store.save(s);
  const { state } = G.migrate(await store.load(), T0 + 5000);
  assert.equal(state.coins, 777);
  assert.equal(state.beds[2].seed, 'tulip');
  assert.equal(state.beds[2].plantedAt, T0);
});

test('alter Prototyp-Spielstand (v1) wird übernommen', () => {
  const old = { v: 1, coins: 140, own: ['daisy', 'tulip', 'rose'], col: { daisy: 4, sun: 2 }, deco: ['lantern'], set: { mode: 'night', low: true, music: true, snd: true } };
  const { state, migrated } = G.migrate(old, T0);
  assert.ok(migrated);
  assert.equal(state.coins, 140);
  assert.deepEqual(state.rareUnlocked, ['rose']);
  assert.equal(state.collection.sunflower.count, 2);
  assert.equal(state.settings.cycle, 'night');
  assert.equal(state.settings.quality, 'low');
});

test('kaputter Spielstand wird repariert statt abzustürzen', () => {
  const bad = { v: 2, coins: -50, xp: 'x', level: 999, beds: [{ seed: 'gift' }], settings: { cycle: 7 } };
  const { state } = G.migrate(bad, T0);
  assert.equal(state.coins, 50);
  assert.equal(state.beds.length, 9);
  assert.equal(state.level, C.LEVELS.length);
  assert.equal(state.settings.cycle, 'auto');
});

test('Reparatur: Sammlung als Zahl, fehlende Aufgaben-Werte, Text in Statistik, fremder Skin', () => {
  const bad = { v: 2, coins: 20, collection: { daisy: 3, banana: 1 }, tasks: { date: 'x', progress: { plant: 1 }, claimed: [] }, stats: { harvested: '10' }, skins: [], activeSkin: { fox: 'arctic' } };
  const { state } = G.migrate(bad, T0);
  assert.deepEqual(state.collection, { daisy: { count: 3, golden: 0 } });
  assert.equal(state.stats.harvested, 10);
  assert.equal(state.activeSkin.fox, 'default');
  assert.ok(Number.isFinite(state.tasks.progress.harvest));
  G.plant(state, 0, 'daisy', T0, never);
  const r = G.harvest(state, 0, T0 + C.SEEDS.daisy.growMs);
  assert.ok(r.ok);
  assert.equal(state.collection.daisy.count, 4);
  assert.equal(state.stats.harvested, 11);
});

test('Mehr-Tab-Schutz: älterer Tab überschreibt keinen neueren Stand', async () => {
  const { SaveManager } = await import('../js/storage.js');
  const mem = new Map();
  const ls = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const store = new LocalStore(ls);
  const a = G.newState(T0), b = G.newState(T0);
  let conflict = 0;
  const sa = new SaveManager(store, () => a, { onConflict: () => conflict++ });
  const sb = new SaveManager(store, () => b);
  b.coins = 772; sb.request(); sb.flush();
  sa.flush(); // Tab A ohne Änderungen: speichert nichts
  assert.equal(JSON.parse(mem.get('bloomworld_save_v2')).coins, 772);
  a.coins = 1; sa.request(); sa.flush(); // Tab A mit Änderung, kennt aber den neueren Stand nicht
  assert.equal(JSON.parse(mem.get('bloomworld_save_v2')).coins, 772);
  assert.equal(conflict, 1);
});
