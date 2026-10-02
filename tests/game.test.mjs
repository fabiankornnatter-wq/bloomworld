// Tests der Spiellogik:  node --test tests/game.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import * as C from '../js/config.js';
import { LocalStore, SaveManager } from '../js/storage.js';

const T0 = new Date(2026, 8, 2, 10, 0, 0).getTime(); // Mittwoch, 2.9. (kein Event, kein Wochenende)
const OCT = new Date(2026, 9, 7, 10, 0, 0).getTime();  // Mittwoch, 7.10. (Herbstfest)
const never = () => 0.99;
const always = () => 0.0;
const memStore = () => { const mem = new Map(); return { mem, ls: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } }; };
const grow = (s, i, now) => G.bedInfo(s, i, now).remaining + 1;
const discover = (s, ...ids) => ids.forEach((id) => (s.collection[id] = { count: 1, shiny: 0 }));

test('neuer Spielstand: 50 Münzen, 6 offene + 18 gesperrte Beete', () => {
  const s = G.newState(T0);
  assert.equal(s.coins, 50);
  assert.equal(s.beds.length, 24);
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
  G.plant(s, 0, 'cornflower', T0, never);
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
  // Schwarze Rose ist „Schwer“: jede Eltern-Blume muss 4× geerntet sein
  assert.equal(G.startBreeding(s, 'orchid', 'rose', T0, true).code, 'harvests');
  s.collection.rose.count = 4; s.collection.orchid.count = 4;
  assert.ok(G.startBreeding(s, 'orchid', 'rose', T0, true, { rand: always }).ok);
});

test('Zucht-Schwierigkeit: Chance, Fehlversuch, Erstattung, Erfahrung, Pollen, Bienen', () => {
  const s = G.newState(T0);
  s.coins = 20000; s.level = 12; s.greenhouse.unlocked = true;
  discover(s, 'rose', 'orchid', 'lavender');
  for (const k of ['rose', 'orchid', 'lavender']) s.collection[k].count = 6;
  const black = C.RECIPES.find((r) => r.result === 'blackRose');
  const easy = C.RECIPES.find((r) => r.result === 'rainbowTulip');
  assert.equal(G.breedChance(s, easy).chance, 1);
  assert.equal(G.breedChance(s, black).chance, 0.6);
  assert.equal(G.breedChance(s, black).name, 'Schwer');
  // misslingt (Zufall 0.99 > 0.6)
  const coins0 = s.coins;
  assert.ok(G.startBreeding(s, 'rose', 'orchid', T0, true, { rand: () => 0.99 }).ok);
  assert.equal(s.coins, coins0 - black.cost);
  const r = G.collectBreeding(s, T0 + black.ms);
  assert.ok(r.ok && r.failed);
  assert.equal(r.refund, Math.round(black.cost * C.BREED_REFUND));
  assert.ok(!s.bred.includes('blackRose'));
  assert.equal(s.breedFails.blackRose, 1);
  assert.equal(s.stats.breedFailed, 1);
  assert.ok(Math.abs(r.next - 0.75) < 1e-9);
  // Bienenstock aufstellen (+10 %), Zauberpollen (+25 %) → sicher
  s.decor.push({ id: 'beehive', x: 5, z: 5, r: 0, stored: false });
  assert.ok(Math.abs(G.breedChance(s, black).chance - 0.85) < 1e-9);
  assert.equal(G.startBreeding(s, 'rose', 'orchid', T0, true, { pollen: true }).code, 'noItem');
  s.items.pollen = 1;
  assert.equal(G.breedChance(s, black, { pollen: true }).chance, 1);
  assert.ok(G.startBreeding(s, 'rose', 'orchid', T0, true, { pollen: true, rand: () => 0.999 }).ok);
  assert.equal(s.items.pollen, 0);
  const ok = G.collectBreeding(s, T0 + black.ms);
  assert.ok(ok.ok && !ok.failed && s.bred.includes('blackRose'));
  // Pollen lässt sich nicht im Beet benutzen; Speicherstand übersteht Reparatur
  s.items.pollen = 1;
  assert.equal(G.useItem(s, 'pollen', 0, T0).ok, false);
  const back = G.migrate(JSON.parse(JSON.stringify(s)), T0).state;
  assert.equal(back.breedFails.blackRose, 1);
  assert.equal(back.items.pollen, 1);
  // alle Rezepte haben einen gültigen Schwierigkeitsgrad
  for (const rc of C.RECIPES) assert.ok(C.BREED_DIFF[rc.diff], rc.result);
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
  s.story.ch = C.STORY.length - 1; s.story.q = C.STORY.at(-1).quests.length - 1; s.level = 25;
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

test('Einstellungen geprüft; Tag/Nacht-Vorschau läuft nach 10 Minuten aus', () => {
  const s = G.newState(T0);
  assert.equal(G.setSetting(s, 'cycle', 'banana', T0).code, 'invalid');
  assert.equal(G.setSetting(s, 'cycle', 'auto', T0).code, 'invalid', 'Schnellzyklus gibt es nicht mehr');
  assert.ok(G.setSetting(s, 'cycle', 'night', T0).ok);
  assert.equal(G.cyclePhase(s, T0 + 60_000), 0.82);
  assert.equal(G.cyclePhase(s, T0 + 11 * 60_000), G.realPhase(T0 + 11 * 60_000), 'danach Echtzeit');
  assert.equal(G.migrate(JSON.parse(JSON.stringify(s)), T0 + 11 * 60_000).state.settings.cycle, 'real');
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

test('Spielstand v2 wird übernommen (goldene -> Funkelblüten, 24 Beete, Rose bleibt)', () => {
  const v2 = { v: 2, coins: 777, xp: 140, level: 4, rareUnlocked: ['rose'], beds: Array.from({ length: 9 }, (_, i) => ({ locked: i >= 6, seed: i === 0 ? 'rose' : null, plantedAt: T0, golden: i === 0, var: 3 })), collection: { daisy: { count: 4, golden: 2 } }, stats: { golden: 2, harvested: 9 }, deco: ['bench'], settings: { cycle: 'night' } };
  const { state, migrated } = G.migrate(v2, T0);
  assert.ok(migrated);
  assert.equal(state.coins, 777);
  assert.equal(state.level, 4);
  assert.equal(state.beds.length, 24);
  assert.equal(state.beds[0].shiny, true);
  assert.equal(state.decor.length, 1);
  assert.equal(state.decor[0].stored, false);
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
  assert.equal(state.beds.length, 24);
  assert.equal(state.level, 30);
  assert.deepEqual(state.items, { fert: 0, turbo: 0, lucky: 0, boost: 0, rain: 0, compost: 0, pollen: 0 });
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

// ---------- Garten gestalten ----------
const allValid = (s) => {
  const refs = [{ type: 'gh' }, ...s.layout.beds.map((_, i) => ({ type: 'bed', i })).filter((r) => G.bedVisible(s, r.i)), ...s.decor.map((d, k) => ({ type: 'deco', k })).filter((r) => !s.decor[r.k].stored)];
  return refs.filter((r) => { const p = G.objectPos(s, r); return !G.canPlace(s, r, p[0], p[1], p[2]).ok; });
};

test('Startaufstellung und alle Ausbaustufen ohne Überschneidungen', () => {
  const s = G.newState(T0);
  assert.deepEqual(allValid(s), []);
  for (const id of C.ALL_DECO) for (const p of C.DECO_PLACE[id] || []) assert.ok(G.canPlace(s, { type: 'deco', id }, p[0], p[1], p[2]).ok, id);
  for (let l = 1; l < C.LAND.length; l++) { s.land = l; assert.deepEqual(allValid(s), [], 'Land ' + l); }
});

test('Beet verschieben: frei ok, auf anderes Beet oder außerhalb nicht', () => {
  const s = G.newState(T0);
  s.story = { ch: 1, q: 4, count: 0, intro: 1 };
  const free = G.findSpot(s, { type: 'bed', i: 0 }, [0, 7]);
  assert.ok(free);
  const r = G.moveObject(s, { type: 'bed', i: 0 }, free[0], free[1], 1);
  assert.ok(r.ok && r.moved);
  assert.deepEqual(s.layout.beds[0], [free[0], free[1], 1]);
  assert.equal(G.storyStatus(s).done, true, 'Story-Aufgabe „verschieben“ zählt');
  const onOther = G.moveObject(s, { type: 'bed', i: 1 }, s.layout.beds[2][0], s.layout.beds[2][1], 0);
  assert.equal(onOther.code, 'noSpace');
  assert.equal(G.moveObject(s, { type: 'bed', i: 1 }, 30, 0, 0).code, 'outside');
  assert.equal(G.moveObject(s, { type: 'gh' }, -6, -6.5, 0).code, 'noSpace', 'nicht aufs Haus');
});

test('Deko mehrfach kaufen, einlagern, aufstellen, verkaufen', () => {
  const s = G.newState(T0);
  s.coins = 5000; s.level = 10;
  const a = G.buyDeco(s, 'lantern'), b = G.buyDeco(s, 'lantern'), c = G.buyDeco(s, 'fountain');
  assert.ok(a.ok && b.ok && c.ok);
  assert.equal(s.decor.length, 3);
  assert.deepEqual(s.deco.sort(), ['fountain', 'lantern']);
  assert.deepEqual(allValid(s), []);
  assert.ok(G.storeDeco(s, 2).ok);
  assert.equal(s.decor[2].stored, true);
  assert.ok(G.placeDeco(s, 2, [0, 6]).ok);
  assert.deepEqual(allValid(s), []);
  const coins = s.coins;
  assert.equal(G.sellDeco(s, 2).coins, 300);
  assert.equal(s.coins, coins + 300);
  s.level = 1;
  assert.equal(G.buyDeco(s, 'fountain').code, 'level');
});

test('Garten erweitern: Level, Kosten, neue Beete werden sichtbar', () => {
  const s = G.newState(T0);
  s.coins = 99999;
  assert.equal(G.expandLand(s).code, 'level');
  s.level = 12;
  assert.equal(G.bedInfo(s, 15, T0).hidden, true);
  assert.equal(G.unlockBed(s, 15).code, 'land');
  assert.ok(G.expandLand(s).ok);
  assert.equal(s.land, 1);
  assert.equal(G.bedInfo(s, 15, T0).hidden, undefined);
  assert.ok(G.unlockBed(s, 15).ok);
  assert.ok(G.canPlace(s, { type: 'deco', id: 'bench' }, 0.4, 10.5, 0).ok, 'neuer Platz vorne');
});

test('Spielstand v3 wird auf frei verschiebbare Deko umgestellt', () => {
  const v3 = { ...G.newState(T0), v: 3, deco: ['lantern', 'bench', 'leafPile'] };
  delete v3.decor; delete v3.layout; delete v3.land;
  const { state, migrated } = G.migrate(v3, T0);
  assert.ok(migrated);
  assert.equal(state.v, G.SAVE_VERSION);
  assert.deepEqual(state.decor.map((d) => d.id).sort(), ['bench', 'lantern', 'lantern', 'leafPile']);
  assert.ok(state.decor.every((d) => !d.stored));
  assert.deepEqual(allValid(state), []);
});

// ---------- Gießen, Kompost, Regenwolke ----------
test('Durstige Blumen wachsen erst nach dem Gießen weiter, Sprinkler gießt selbst', () => {
  const s = G.newState(T0);
  s.coins = 9999; s.level = 10;
  G.plant(s, 0, 'lavender', T0, never);           // muss einmal gegossen werden (bei 45 %)
  const dur = C.SEEDS.lavender.growMs;
  let info = G.bedInfo(s, 0, T0 + dur * 0.8);
  assert.equal(info.thirsty, true);
  assert.ok(Math.abs(info.progress - 0.45) < 1e-9, 'bleibt bei 45 % stehen');
  assert.equal(G.bedInfo(s, 0, T0 + dur * 5).ready, false, 'auch nach langer Zeit nicht reif');
  assert.equal(G.harvest(s, 0, T0 + dur * 5).code, 'thirsty');
  assert.equal(G.useItem(s, 'fert', 0, T0).code, 'noItem');
  const t1 = T0 + dur * 5;
  assert.ok(G.water(s, 0, t1).ok);
  assert.equal(s.stats.watered, 1);
  assert.equal(s.tasks.progress.water, 1);
  assert.equal(G.water(s, 0, t1).code, 'notThirsty');
  assert.equal(G.bedInfo(s, 0, t1 + dur * 0.5).ready, false);
  assert.equal(G.bedInfo(s, 0, t1 + dur * 0.56).ready, true, 'restliche 55 % wachsen nach dem Gießen');
  // Sprinkler: nie Durst
  s.beds[1].sprinkler = true;
  G.plant(s, 1, 'orchid', T0, never);
  s.rareUnlocked.push('orchid'); G.plant(s, 1, 'orchid', T0, never);
  assert.equal(G.bedInfo(s, 1, T0 + 1e9).ready, true);
  // Sprinkler nachrüsten: durstige Blume wächst sofort weiter
  G.plant(s, 2, 'sunflower', T0, never);
  const sd = C.SEEDS.sunflower.growMs;
  assert.equal(G.bedInfo(s, 2, T0 + sd).thirsty, true);
  assert.ok(G.buySprinkler(s, 2, T0 + sd).ok);
  assert.equal(G.bedInfo(s, 2, T0 + sd).thirsty, false);
});

test('Regenwolke gießt alle, Kompost bringt +50 %, Turbo überspringt Durst', () => {
  const s = G.newState(T0);
  s.coins = 9999; s.level = 10;
  G.plant(s, 0, 'sunflower', T0, never); G.plant(s, 1, 'lavender', T0, never);
  const late = T0 + 10 * 60_000;
  assert.equal(G.thirstyBeds(s, late).length, 2);
  G.buyItem(s, 'rain');
  assert.ok(G.useItem(s, 'rain', -1, late).ok);
  assert.equal(G.thirstyBeds(s, late).length, 0);
  assert.equal(G.useItem(s, 'rain', -1, late).code, 'noItem');
  G.buyItem(s, 'compost'); G.buyItem(s, 'turbo');
  assert.ok(G.useItem(s, 'compost', 0, late).ok);
  assert.equal(G.bedInfo(s, 0, late).compost, true);
  const r = G.harvest(s, 0, late + 10 * 60_000);
  assert.equal(r.reward, Math.round(C.SEEDS.sunflower.reward * 1.5));
  G.plant(s, 0, 'orchid', T0, never); s.rareUnlocked.push('orchid'); G.plant(s, 0, 'orchid', late, never);
  assert.ok(G.useItem(s, 'turbo', 0, late).ok);
  assert.equal(G.bedInfo(s, 0, late).ready, true);
});

test('Post von Freunden: Geschenk, Gießen, Gefällt mir – mit Grenzen', () => {
  const s = G.newState(T0);
  s.coins = 500; s.level = 3;
  assert.ok(G.plant(s, 0, 'sunflower', T0, never).ok);
  const dur = s.beds[0].dur;
  const now = T0 + dur * 0.6;
  assert.equal(G.bedInfo(s, 0, now).thirsty, true);
  const coins = s.coins;
  const ev = G.applyInbox(s, [
    { k: 'gift', item: 'fert', n: 2, name: 'Lena' },
    { k: 'gift', item: 'gold', n: 99 },
    { k: 'help', beds: [0, 1, 7], name: 'Ben' },
    { k: 'like', coins: 9999, name: 'Mia' },
    null, 'kaputt',
  ], now);
  assert.equal(s.items.fert, 2);
  assert.equal(G.bedInfo(s, 0, now).thirsty, false);
  assert.equal(s.beds[0].drinks, 1);
  assert.equal(s.coins, coins + C.LIKE.coins);
  assert.deepEqual(ev.map((e) => e.k), ['gift', 'help', 'like']);
  assert.deepEqual(ev[1].beds, [0]);
});

test('Echtzeit: Sonnenzeiten, Dämmerung, Tageszeiten, Mond', () => {
  process.env.TZ = process.env.TZ || 'Europe/Berlin';
  const at = (iso) => new Date(iso).getTime();
  const sum = G.sunTimes(at('2026-06-21T12:00:00+02:00'));
  const win = G.sunTimes(at('2026-12-21T12:00:00+01:00'));
  const h = (t) => new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
  // Sommer: Aufgang ca. 3:00–3:30 UTC, Untergang ca. 19:30–20:00 UTC (Mitte Deutschlands)
  assert.ok(h(sum.rise) > 2.5 && h(sum.rise) < 4, `Sommer-Aufgang ${h(sum.rise)}`);
  assert.ok(h(sum.set) > 19 && h(sum.set) < 20.5, `Sommer-Untergang ${h(sum.set)}`);
  assert.ok(h(win.rise) > 6.5 && h(win.rise) < 7.8, `Winter-Aufgang ${h(win.rise)}`);
  assert.ok(h(win.set) > 14.8 && h(win.set) < 16, `Winter-Untergang ${h(win.set)}`);
  assert.ok(sum.dawn < sum.rise && sum.dusk > sum.set);
  // Phasen im Tagesverlauf (Winter)
  const ph = (t) => G.timeOfDay(G.realPhase(t));
  assert.equal(ph(win.noon), 'day');
  assert.equal(ph(win.rise + 10 * 60_000), 'morning');
  assert.equal(ph(win.set + 20 * 60_000), 'evening');
  assert.equal(ph(win.dusk + 2 * 3600_000), 'night');
  assert.equal(ph(win.dawn + 5 * 60_000), 'morning');
  // stetig: keine Sprünge
  for (let t = at('2026-03-01T00:00:00Z'); t < at('2026-03-02T00:00:00Z'); t += 600_000) {
    const p = G.realPhase(t);
    assert.ok(p >= 0 && p < 1, `Phase ${p}`);
  }
  // neuer Spielstand startet in Echtzeit; alte „automatisch“-Stände werden einmal umgestellt
  assert.equal(G.newState(T0).settings.cycle, 'real');
  const old = G.newState(T0); old.settings.cycle = 'auto'; delete old.settings.rt;
  assert.equal(G.migrate(JSON.parse(JSON.stringify(old)), T0).state.settings.cycle, 'real', 'alter Schnellzyklus wird Echtzeit');
  // Vollmond 2026-10-26 (ungefähr)
  assert.ok(G.isFullMoon(at('2026-10-26T12:00:00Z')));
  assert.ok(!G.isFullMoon(at('2026-10-12T12:00:00Z')));
  const nf = G.nextFullMoon(at('2026-10-12T12:00:00Z'));
  assert.ok(G.isFullMoon(nf + 3600_000) && nf > at('2026-10-20T00:00:00Z') && nf < at('2026-10-28T00:00:00Z'));
});

test('Zucht-Bedingungen: Morgen, Abend, Nacht, Vollmond', () => {
  const s = G.newState(T0);
  s.coins = 99999; s.level = 20; s.greenhouse.unlocked = true;
  for (const k of ['lily', 'moonOrchid', 'poppy', 'sunflower', 'northRose']) s.collection[k] = { count: 10, shiny: 0 };
  assert.equal(G.breedCheck(s, 'lily', 'moonOrchid', { time: 'night' }).code, 'night');
  assert.ok(G.breedCheck(s, 'lily', 'moonOrchid', { time: 'morning' }).ok);
  assert.ok(G.breedCheck(s, 'poppy', 'sunflower', { time: 'evening' }).ok);
  assert.equal(G.breedCheck(s, 'poppy', 'sunflower', true).code, 'night');
  assert.equal(G.breedCheck(s, 'moonOrchid', 'northRose', { time: 'night', full: false, now: T0 }).code, 'moon');
  assert.ok(G.breedCheck(s, 'moonOrchid', 'northRose', { time: 'night', full: true }).ok);
});

test('Händler: Korb, Bestellungen, Tagesblume, Besonderheiten, Ruf', () => {
  const day = new Date('2026-10-01T10:00:00').getTime(); // Donnerstag
  const s = G.newState(day);
  s.coins = 5000; s.level = 5; s.tutorial = 2;
  // Ernten füllen den Korb
  assert.ok(G.plant(s, 0, 'daisy', day - 60_000, never).ok);
  assert.ok(G.harvest(s, 0, day).basket);
  assert.equal(s.basket.daisy, 1);
  const info = G.traderInfo(s, day);
  assert.equal(info.day.id, 'thu');
  assert.ok(info.orders.length >= 3);
  assert.equal(info.cap, C.TRADER.basket[0]);
  // gleiche Besonderheiten für alle am selben Tag
  assert.equal(G.dayFlower(s, day), G.dayFlower(G.migrate(JSON.parse(JSON.stringify(s)), day).state, day));
  // Bestellung erfüllen
  const o = info.orders.find((x) => !x.special);
  for (const [k, q] of Object.entries(o.want)) s.basket[k] = (s.basket[k] || 0) + q;
  const coins = s.coins;
  const r = G.deliverOrder(s, o.i, day);
  assert.ok(r.ok, r.message);
  assert.equal(s.coins, coins + r.coins);
  assert.equal(s.trader.rep, 2, 'Donnerstag zählt doppelt');
  assert.equal(G.deliverOrder(s, o.i, day).code, 'claimed');
  // Verkaufen
  s.basket.daisy = 4;
  const p = G.sellPrice(s, 'daisy', false, day);
  assert.ok(p >= 1);
  const sold = G.sellFlowers(s, 'daisy', false, 2, day);
  assert.equal(sold.coins, p * 2);
  assert.equal(s.basket.daisy, 2);
  // Korb voll -> nichts mehr hinein
  s.basket.tulip = 200;
  assert.ok(G.plant(s, 1, 'daisy', day - 60_000, never).ok);
  assert.equal(G.harvest(s, 1, day).basket, false);
  // Neuer Tag -> neue Bestellungen; Samstag Geschenk
  const sat = new Date('2026-10-03T10:00:00').getTime();
  assert.equal(G.traderInfo(s, sat).day.id, 'sat');
  assert.ok(G.claimTraderGift(s, sat).ok);
  assert.equal(G.claimTraderGift(s, sat).code, 'claimed');
  // Tagesangebot nur einmal
  s.coins = 99999;
  assert.ok(G.buyTraderOffer(s, sat).ok);
  assert.equal(G.buyTraderOffer(s, sat).code, 'claimed');
  // Dienstag: Dünger günstiger
  const tue = new Date('2026-10-06T10:00:00').getTime();
  assert.ok(G.traderItemPrice('fert', tue) < C.ITEMS.fert.price);
  assert.ok(G.buyFromTrader(s, 'fert', tue).ok);
  // Speichern/Laden
  const back = G.migrate(JSON.parse(JSON.stringify(s)), sat).state;
  assert.equal(back.trader.rep, 2);
  assert.equal(back.basket.daisy, 2);
});


test('Wochenziele, Tiere streicheln, Überraschungen, Nacht-Blume', () => {
  const mon = new Date('2026-10-05T10:00:00').getTime(); // Montag
  const s = G.newState(mon);
  s.coins = 9999; s.level = 14;
  G.ensureDaily(s, mon);
  assert.equal(G.weeklyList(s, mon).tasks.find((t) => t.id === 'days').have, 1);
  G.ensureDaily(s, mon + 86400000);
  assert.equal(s.weekly.progress.days, 2);
  // Ernten zählt
  for (let i = 0; i < 3; i++) { G.plant(s, i, 'daisy', mon, never); G.harvest(s, i, mon + 60000); }
  assert.equal(s.weekly.progress.harvest, 3);
  s.weekly.progress.harvest = 60;
  assert.equal(G.claimWeekly(s, 'harvest', mon).ok, true);
  assert.equal(G.claimWeekly(s, 'harvest', mon).code, 'claimed');
  assert.equal(G.claimWeekly(s, 'bonus', mon).code, 'notDone');
  // neue Woche setzt zurück
  G.ensureDaily(s, mon + 8 * 86400000);
  assert.equal(s.weekly.claimed.length, 0);
  // Tiere
  const r = G.pet(s, 'hedgehog', mon, () => 0);
  assert.ok(r.ok && r.gift.coins === 40);
  assert.equal(G.pet(s, 'hedgehog', mon).again, true, 'nur einmal am Tag');
  assert.ok(G.pet(s, 'butterfly', mon).ok);
  assert.equal(s.pets.butterfly, G.dayKey(mon));
  assert.equal(s.stats.petDays, 1);
  assert.equal(G.pet(s, 'fox', mon + 86400000).ok, true);
  assert.equal(s.stats.petDays, 2);
  // Überraschung höchstens einmal am Tag
  assert.ok(G.rollSurprise(s, mon, 'night', () => 0));
  assert.equal(G.rollSurprise(s, mon, 'night', () => 0), null);
  // Mondwinde nur nachts
  s.settings.cycle = 'day'; s.settings.cycleEpoch = mon;
  assert.equal(G.plant(s, 5, 'moonflower', mon, never).ok, false);
  s.settings.cycle = 'night';
  assert.ok(G.plant(s, 5, 'moonflower', mon, never).ok);
  assert.equal(s.beds[5].dur, 10 * 3600000);
  const back = G.migrate(JSON.parse(JSON.stringify(s)), mon).state;
  assert.equal(back.pets.ever.length, 3);
});

test('Beete vergrößern: Platzprüfung, mehr Ertrag, Speichern', () => {
  const s = G.newState(T0);
  s.coins = 9999; s.level = 12;
  assert.ok(G.growBed(s, 0).ok, 'Mittel passt ins Standard-Raster');
  assert.equal(s.beds[0].size, 2);
  assert.ok(G.growBed(s, 0).ok, 'Groß passt am Rand noch');
  // Nachbarbeet kann jetzt nicht mehr groß werden – zu wenig Platz
  G.growBed(s, 1);
  assert.equal(G.growBed(s, 1).code, 'noSpace', 'zwei große Beete nebeneinander passen nicht');
  assert.equal(G.growBed(s, 0).code, 'maxLevel');
  assert.deepEqual(G.footprint(s, { type: 'bed', i: 0 }, 0), [2.4 * 1.5, 2.4 * 1.5]);
  // Ertrag ×1,8
  assert.ok(G.plant(s, 0, 'daisy', T0, never).ok);
  const r = G.harvest(s, 0, T0 + 60000);
  assert.equal(r.reward, Math.round(12 * 1.8));
  const back = G.migrate(JSON.parse(JSON.stringify(s)), T0).state;
  assert.equal(back.beds[0].size, 3);
  assert.equal(back.beds[1].size, 1);
});

test('Anlass-Events: Ostern beweglich, Gruselnacht, Silvester über den Jahreswechsel', () => {
  assert.equal(G.easterSunday(2026).getDate(), 5); assert.equal(G.easterSunday(2027).getDate(), 28);
  assert.equal(G.mothersDay(2026).getDate(), 10);
  assert.equal(G.activeEvent(new Date(2026, 2, 29).getTime()).id, 'easter');
  assert.equal(G.activeEvent(new Date(2027, 2, 20).getTime()).id, 'easter');
  assert.equal(G.activeEvent(new Date(2026, 9, 31).getTime()).id, 'halloween');
  assert.equal(G.activeEvent(new Date(2027, 0, 2).getTime()).id, 'newyear');
  assert.equal(G.activeEvent(new Date(2027, 0, 20).getTime()), null);
  for (const ev of C.EVENTS) for (const m of ev.milestones) if (m.reward.deco) assert.ok(C.DECO[m.reward.deco], `${ev.id}: Deko ${m.reward.deco} fehlt`);
  for (const ev of C.EVENTS) for (const it of ev.shop) if (it.deco) assert.ok(C.DECO[it.deco]);
});

test('Level-Belohnungen: Deko und Skins als Geschenk', () => {
  const s = G.newState(T0);
  s.xp = C.LEVELS[4]; // Level 5 erreicht
  const ups = G.addXp(s, 0);
  assert.equal(s.level, 5);
  assert.ok(s.deco.includes('lantern') && s.deco.includes('pinwheel'));
  assert.ok(ups.find((u) => u.level === 5).deco === 'lantern');
  for (let l = 2; l <= C.MAX_LEVEL; l++) { const r = C.levelReward(l); assert.ok(r.coins > 0); if (r.deco) assert.ok(C.DECO[r.deco]); if (r.skin) assert.ok(C.SKINS[r.skin]); }
});

test('Event-Blumen: nur während des Events säbar, doppelte Event-Währung, nicht beim Händler', () => {
  const s = G.newState(T0); s.coins = 5000; s.level = 10;
  assert.equal(G.seedStatus(s, 'chrysanthemum', T0).available, false);
  assert.ok(G.seedStatus(s, 'chrysanthemum', T0).reason.includes('Herbstfest'));
  assert.equal(G.plant(s, 0, 'chrysanthemum', T0, never).ok, false);
  assert.ok(G.seedStatus(s, 'chrysanthemum', OCT).available);
  assert.ok(G.plant(s, 0, 'chrysanthemum', OCT, never).ok);
  G.plant(s, 1, 'daisy', OCT, never);
  const r1 = G.harvest(s, 1, OCT + 30_000);
  s.beds[0].drinks = 9;
  const r0 = G.harvest(s, 0, OCT + 60 * 60_000);
  assert.ok(r0.tokens >= 2 * r1.tokens, `${r0.tokens} vs ${r1.tokens}`);
  assert.ok(s.collection.chrysanthemum.count === 1);
  for (const k of C.EVENT_SEEDS) { assert.ok(C.EVENTS.find((e) => e.id === C.SEEDS[k].event), k); assert.ok(C.FLOWER_INFO[k], 'Info ' + k); }
  assert.equal(C.EVENT_SEEDS.length, C.EVENTS.length);
});

test('Samen: jede 3. Event-Ernte, Samenpaket im Event-Shop, Säen nach dem Event, Tausch', () => {
  const s = G.newState(OCT); s.coins = 9000; s.level = 10;
  for (let k = 0; k < 3; k++) { assert.ok(G.plant(s, 0, 'chrysanthemum', OCT, () => 0.9).ok); s.beds[0].drinks = 9; G.harvest(s, 0, OCT + 60 * 60_000); }
  assert.equal(G.seedCount(s, 'chrysanthemum'), 1);
  s.event.tokens = 100;
  assert.ok(G.buyEventItem(s, 'seeds', OCT).ok);
  assert.equal(G.seedCount(s, 'chrysanthemum'), 4);
  // Nach dem Event: nur mit Samen
  const DEC = new Date(2026, 10, 20, 10).getTime();
  assert.equal(G.activeEvent(DEC), null);
  assert.ok(G.seedStatus(s, 'chrysanthemum', DEC).useSeed);
  assert.ok(G.plant(s, 1, 'chrysanthemum', DEC, () => 0.9).ok);
  assert.equal(G.seedCount(s, 'chrysanthemum'), 3);
  // Tausch
  assert.equal(G.tradeOfferCheck(s, 'chrysanthemum', 2, 'marigold', 1).ok, true);
  assert.equal(G.tradeOfferCheck(s, 'chrysanthemum', 5, 'marigold', 1).ok, false);
  assert.ok(G.tradeReserve(s, 'chrysanthemum', 2)); assert.equal(G.seedCount(s, 'chrysanthemum'), 1);
  G.applyInbox(s, [{ k: 'tradeDone', name: 'Anna', offer: { give: 'chrysanthemum', giveN: 2, want: 'marigold', wantN: 1 } }], DEC);
  assert.equal(G.seedCount(s, 'marigold'), 1); assert.equal(s.stats.trades, 1);
  G.applyInbox(s, [{ k: 'tradeBack', offer: { give: 'chrysanthemum', giveN: 2 } }, { k: 'seeds', name: 'Bob', seed: 'heartRose', n: 2 }], DEC);
  assert.equal(G.seedCount(s, 'chrysanthemum'), 3); assert.equal(G.seedCount(s, 'heartRose'), 2);
  const r = G.repair(JSON.parse(JSON.stringify(s)), DEC);
  assert.deepEqual(r.seeds, s.seeds);
});

test('Album: Erfolge, Titel, exklusive Blume', () => {
  const s = G.newState(T0); s.coins = 100;
  assert.equal(G.checkAchievements(s).length, 0);
  for (const k of C.SEED_ORDER.slice(0, 10)) s.collection[k] = { count: 1, shiny: 0 };
  const got = G.checkAchievements(s);
  assert.equal(got[0].id, 'disc10'); assert.ok(s.coins >= 400);
  assert.equal(G.checkAchievements(s).length, 0);
  for (const k of C.SEED_ORDER) if (!C.SEEDS[k].exclusive) s.collection[k] = { count: 1, shiny: 0 };
  const all = G.checkAchievements(s).map((a) => a.id);
  assert.ok(all.includes('complete') && all.includes('garden') && all.includes('events'));
  assert.ok(s.unlocked.includes('opheliaBloom') && s.deco.includes('goldenBench') && s.titles.includes('ophelia'));
  assert.ok(G.seedStatus(s, 'opheliaBloom', T0).available);
  assert.ok(G.setTitle(s, 'jahresgaertner').ok); assert.equal(G.setTitle(s, 'meisterzuechter').ok, false);
  assert.ok(G.achievementList(s).every((a) => a.need > 0));
});
