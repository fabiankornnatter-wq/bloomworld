// Tests der Spiellogik:  node --test tests/game.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import * as C from '../js/config.js';
import { LocalStore, SaveManager } from '../js/storage.js';

const T0 = new Date(2026, 8, 30, 10, 0, 0).getTime(); // Mittwoch, 30.9. (kein Event, kein Wochenende)
const OCT = new Date(2026, 9, 7, 10, 0, 0).getTime();  // Mittwoch, 7.10. (Herbstfest)
const never = () => 0.99;
const always = () => 0.0;
const memStore = () => { const mem = new Map(); return { mem, ls: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } }; };
const grow = (s, i, now) => G.bedInfo(s, i, now).remaining + 1;
const discover = (s, ...ids) => ids.forEach((id) => (s.collection[id] = { count: 1, shiny: 0 }));

test('neuer Spielstand: 50 Münzen, 6 offene + 9 gesperrte Beete', () => {
  const s = G.newState(T0);
  assert.equal(s.coins, 50);
  assert.equal(s.beds.length, 15);
  assert.equal(s.beds.filter((b) => !b.locked).length, 6);
});

test('pflanzen kostet Münzen und belegt das Beet', () => {
  const s = G.newState(T0);
  assert.ok(G.plant(s, 0, 'daisy', T0, never).ok);
  assert.equal(s.coins, 45);
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
  assert.equal(G.plant(s, 0, 'daisy', T0, never).code, 'noCoins');
  G.addCoins(s, -1000);
  assert.equal(s.coins, 0);
  for (const r of [G.unlockBed(s, 6), G.buyDeco(s, 'bench'), G.buyItem(s, 'fert'), G.buySprinkler(s, 0, T0)]) assert.ok(!r.ok);
  assert.equal(s.coins, 0);
});

test('ernten nach Wachstumszeit: Münzen, EP, Sammlung', () => {
  const s = G.newState(T0);
  G.plant(s, 1, 'tulip', T0, never);
  assert.equal(G.harvest(s, 1, T0 + 1000).code, 'notReady');
  const r = G.harvest(s, 1, T0 + C.SEEDS.tulip.growMs);
  assert.ok(r.ok);
  assert.equal(r.reward, 25);
  assert.equal(s.collection.tulip.count, 1);
});

test('Funkelblüte bringt dreifache Belohnung', () => {
  const s = G.newState(T0);
  G.plant(s, 0, 'daisy', T0, always);
  const r = G.harvest(s, 0, T0 + C.SEEDS.daisy.growMs);
  assert.equal(r.shiny, true);
  assert.equal(r.reward, 36);
  assert.equal(s.collection.daisy.shiny, 1);
});

test('Level 1–30 mit Belohnungen und Freischaltungen', () => {
  const s = G.newState(T0);
  assert.equal(C.LEVELS.length, 30);
  assert.equal(G.plant(s, 0, 'sunflower', T0, never).code, 'seedLocked');
  const ups = G.addXp(s, C.LEVELS[1]);
  assert.equal(s.level, 2);
  assert.ok(ups[0].unlocks.some((u) => u.id === 'sunflower'));
  assert.ok(G.plant(s, 0, 'sunflower', T0, never).ok);
  G.addXp(s, 1e9);
  assert.equal(s.level, 30);
  assert.equal(G.xpProgress(s).max, true);
  assert.equal(G.roadmap(s).length, 29);
});

test('Beete: Level-Grenze, Ausbau (mehr Münzen), Bewässerung (schneller)', () => {
  const s = G.newState(T0);
  s.coins = 10000;
  assert.equal(G.unlockBed(s, 9).code, 'level');
  assert.ok(G.unlockBed(s, 6).ok);
  assert.equal(G.buySprinkler(s, 0, T0).code, 'level');
  s.level = 9;
  assert.ok(G.unlockBed(s, 9).ok);
  G.plant(s, 0, 'tulip', T0, never);
  assert.ok(G.buySprinkler(s, 0, T0).ok);
  assert.equal(s.beds[0].dur, Math.round(C.SEEDS.tulip.growMs * 0.7));
  assert.ok(G.upgradeBed(s, 0).ok);
  assert.ok(G.upgradeBed(s, 0).ok);
  assert.equal(G.upgradeBed(s, 0).code, 'maxLevel');
  const r = G.harvest(s, 0, T0 + grow(s, 0, T0));
  assert.equal(r.reward, 50); // Prachtbeet ×2
});

test('Dünger, Turbo-Dünger, Glücksdünger', () => {
  const s = G.newState(T0);
  s.coins = 5000; s.level = 5;
  assert.equal(G.useItem(s, 'fert', 0, T0).code, 'noItem');
  assert.ok(G.buyItem(s, 'fert', true).ok);
  assert.equal(s.items.fert, 5);
  G.plant(s, 0, 'lavender', T0, never);
  assert.ok(G.useItem(s, 'fert', 0, T0).ok);
  assert.ok(Math.abs(G.bedInfo(s, 0, T0).progress - 0.5) < 0.01);
  G.buyItem(s, 'turbo'); G.buyItem(s, 'lucky');
  assert.ok(G.useItem(s, 'lucky', 0, T0).ok);
  assert.ok(G.useItem(s, 'turbo', 0, T0).ok);
  assert.ok(G.bedInfo(s, 0, T0).ready);
  assert.equal(G.useItem(s, 'fert', 0, T0).code, 'invalid');
  assert.equal(G.harvest(s, 0, T0).shiny, true);
});

test('Zucht: Gewächshaus, Rezept, Eltern nötig, Nacht-Bedingung', () => {
  const s = G.newState(T0);
  s.coins = 5000;
  assert.equal(G.unlockGreenhouse(s).code, 'level');
  s.level = 8;
  assert.ok(G.unlockGreenhouse(s).ok);
  assert.equal(G.breedCheck(s, 'tulip', 'daisy', false).ok, false); // noch nie geerntet
  discover(s, 'tulip', 'daisy', 'rose', 'orchid');
  assert.equal(G.breedCheck(s, 'tulip', 'rose', false).code, 'noRecipe');
  assert.equal(G.breedCheck(s, 'rose', 'orchid', false).code, 'night');
  assert.ok(G.startBreeding(s, 'daisy', 'tulip', T0, false).ok);
  assert.equal(G.startBreeding(s, 'rose', 'orchid', T0, true).code, 'busy');
  assert.equal(G.collectBreeding(s, T0 + 1000).code, 'notReady');
  s.items.boost = 1;
  assert.ok(G.useItem(s, 'boost', -1, T0).ok);
  const r = G.collectBreeding(s, T0);
  assert.equal(r.seed, 'rainbowTulip');
  assert.ok(G.plant(s, 0, 'rainbowTulip', T0, never).ok);
  assert.equal(G.breedCheck(s, 'tulip', 'daisy', false).code, 'owned');
  assert.ok(G.startBreeding(s, 'orchid', 'rose', T0, true).ok);
});

test('Story: Aufgaben zählen, Abholen, nächstes Kapitel', () => {
  const s = G.newState(T0);
  s.coins = 1000;
  let st = G.storyStatus(s);
  assert.equal(st.ch, 0); assert.equal(st.showIntro, true);
  G.markIntroSeen(s);
  assert.equal(G.claimQuest(s).code, 'notDone');
  for (let i = 0; i < 3; i++) G.plant(s, i, 'daisy', T0, never);
  st = G.storyStatus(s);
  assert.equal(st.done, true);
  const r = G.claimQuest(s);
  assert.ok(r.ok);
  assert.equal(s.items.fert, 1);
  assert.equal(G.storyStatus(s).quest.goal.type, 'useItem');
  // Kapitel überspringen bis zum Ende
  s.story.ch = C.STORY.length - 1; s.story.q = C.STORY.at(-1).quests.length - 1; s.story.count = 3;
  assert.ok(G.claimQuest(s).chapterDone);
  assert.equal(G.storyStatus(s).finished, true);
});

test('Herbstfest: Blätter beim Ernten, Meilensteine, Event-Shop', () => {
  const s = G.newState(OCT);
  assert.equal(G.activeEvent(T0), null);
  assert.equal(G.activeEvent(OCT).id, 'autumn');
  s.coins = 1000;
  G.plant(s, 0, 'daisy', OCT, never);
  const r = G.harvest(s, 0, OCT + 30_000);
  assert.ok(r.tokens >= 1);
  s.event.total = 25; s.event.tokens = 25;
  assert.ok(G.claimEventMilestone(s, 0, OCT).ok);
  assert.equal(G.claimEventMilestone(s, 0, OCT).code, 'claimed');
  assert.equal(G.claimEventMilestone(s, 1, OCT).code, 'notDone');
  assert.ok(G.buyEventItem(s, 'fert3', OCT).ok);
  assert.equal(s.event.tokens, 10);
  // Neues Jahr: Event startet neu
  G.ensureEvent(s, new Date(2027, 9, 2).getTime());
  assert.equal(s.event.total, 0);
});

test('Funkel-Wochenende verdoppelt die Chance', () => {
  const sat = new Date(2026, 9, 3, 12).getTime();
  assert.equal(G.isWeekend(sat), true);
  const s = G.newState(sat);
  G.plant(s, 0, 'daisy', sat, () => 0.1); // 10 % < 12 % am Wochenende
  assert.equal(s.beds[0].shiny, true);
  const s2 = G.newState(T0);
  G.plant(s2, 0, 'daisy', T0, () => 0.1);
  assert.equal(s2.beds[0].shiny, false);
});

test('Tagesaufgaben und Tagesgeschenk', () => {
  const s = G.newState(T0);
  s.coins = 1000;
  for (let i = 0; i < 5; i++) G.plant(s, i, 'daisy', T0, never);
  assert.ok(G.claimTask(s, 'plant', T0).ok);
  assert.equal(G.claimTask(s, 'plant', T0).code, 'claimed');
  assert.ok(G.claimDailyGift(s, T0).ok);
  assert.equal(G.claimDailyGift(s, T0 + 1000).code, 'claimed');
  G.ensureDaily(s, T0 + 86_400_000);
  assert.equal(s.tasks.claimed.length, 0);
});

test('Einstellungen geprüft; Zyklusgeschwindigkeit behält Tageszeit', () => {
  const s = G.newState(T0);
  assert.equal(G.setSetting(s, 'cycle', 'banana', T0).code, 'invalid');
  const t = T0 + 123_456, p1 = G.cyclePhase(s, t);
  G.setSetting(s, 'cycleMin', 3, t);
  assert.ok(Math.abs(G.cyclePhase(s, t) - p1) < 1e-9);
});

test('Speichern/Laden über LocalStore', async () => {
  const { ls } = memStore();
  const store = new LocalStore(ls);
  const s = G.newState(T0);
  G.plant(s, 2, 'tulip', T0, never);
  s.items.turbo = 4; s.bred.push('goldRose');
  await store.save(s);
  const { state } = G.migrate(await store.load(), T0 + 5000);
  assert.equal(state.beds[2].seed, 'tulip');
  assert.equal(state.items.turbo, 4);
  assert.deepEqual(state.bred, ['goldRose']);
});

test('Spielstand v2 wird übernommen (goldene -> Funkelblüten, 15 Beete, Rose bleibt)', () => {
  const v2 = { v: 2, coins: 777, xp: 140, level: 4, rareUnlocked: ['rose'], beds: Array.from({ length: 9 }, (_, i) => ({ locked: i >= 6, seed: i === 0 ? 'rose' : null, plantedAt: T0, golden: i === 0, var: 3 })), collection: { daisy: { count: 4, golden: 2 } }, stats: { golden: 2, harvested: 9 }, deco: ['bench'], settings: { cycle: 'night' } };
  const { state, migrated } = G.migrate(v2, T0);
  assert.ok(migrated);
  assert.equal(state.coins, 777);
  assert.equal(state.level, 4);
  assert.equal(state.beds.length, 15);
  assert.equal(state.beds[0].shiny, true);
  assert.equal(state.collection.daisy.shiny, 2);
  assert.equal(state.stats.shiny, 2);
  assert.equal(state.settings.cycle, 'night');
  state.level = 2; // auch unter Level 4 bleibt die freigeschaltete Rose pflanzbar
  assert.equal(G.seedStatus(state, 'rose').available, true);
});

test('Prototyp-Spielstand (v1) wird übernommen', () => {
  const { state, migrated } = G.migrate({ v: 1, coins: 140, own: ['rose'], col: { daisy: 4, sun: 2 }, set: { mode: 'night', low: true } }, T0);
  assert.ok(migrated);
  assert.equal(state.coins, 140);
  assert.equal(state.collection.sunflower.count, 2);
  assert.equal(state.settings.quality, 'low');
});

test('kaputter Spielstand wird repariert statt abzustürzen', () => {
  const bad = { v: 3, coins: -50, xp: 'x', level: 999, beds: [{ seed: 'gift' }], items: { fert: -3, turbo: 'viele' }, greenhouse: { unlocked: true, job: { result: 'banana' } }, story: { ch: 99 }, event: 'kaputt', collection: { daisy: 3, banana: 1 }, stats: { harvested: '10' }, activeSkin: { fox: 'arctic' } };
  const { state } = G.migrate(bad, T0);
  assert.equal(state.coins, 50);
  assert.equal(state.beds.length, 15);
  assert.equal(state.level, 30);
  assert.deepEqual(state.items, { fert: 0, turbo: 0, lucky: 0, boost: 0 });
  assert.equal(state.greenhouse.job, null);
  assert.equal(G.storyStatus(state).finished, true);
  assert.deepEqual(state.collection, { daisy: { count: 3, shiny: 0 } });
  assert.equal(state.stats.harvested, 10);
  assert.equal(state.activeSkin.fox, 'default');
});

test('Mehr-Tab-Schutz: älterer Tab überschreibt keinen neueren Stand', () => {
  const { mem, ls } = memStore();
  const store = new LocalStore(ls);
  const a = G.newState(T0), b = G.newState(T0);
  let conflict = 0;
  const sa = new SaveManager(store, () => a, { onConflict: () => conflict++ });
  const sb = new SaveManager(store, () => b);
  b.coins = 772; sb.request(); sb.flush();
  sa.flush();
  a.coins = 1; sa.request(); sa.flush();
  assert.equal(JSON.parse(mem.get('bloomworld_save_v2')).coins, 772);
  assert.equal(conflict, 1);
});
