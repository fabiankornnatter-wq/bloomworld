// Reine Spiellogik von BloomWorld – ohne Grafik und ohne Browser-Abhängigkeiten.
// Alle Funktionen verändern den übergebenen Spielstand und geben ein Ergebnis-Objekt zurück.
import * as C from './config.js';

export const SAVE_VERSION = 5;

export const ERR = {
  locked: 'Dieses Beet ist noch nicht freigeschaltet.',
  occupied: 'Hier wächst schon etwas.',
  unknown: 'Diese Pflanze gibt es nicht.',
  notReady: 'Die Blume wächst noch.',
  empty: 'Das Beet ist leer.',
  owned: 'Das hast du bereits.',
  invalid: 'Ungültige Auswahl.',
  claimed: 'Belohnung bereits abgeholt.',
  notDone: 'Die Aufgabe ist noch nicht erledigt.',
  noItem: 'Davon hast du nichts mehr. Im Shop unter „Bedarf“ gibt es Nachschub.',
  notGrowing: 'Hier wächst gerade keine Blume.',
  busy: 'Im Gewächshaus läuft schon eine Züchtung.',
  noRecipe: 'Diese Kreuzung ergibt keine neue Sorte. Probier eine andere Kombination!',
  noJob: 'Im Gewächshaus läuft gerade keine Züchtung.',
  maxLevel: 'Dieses Beet ist schon vollständig ausgebaut.',
  noSpace: 'Hier ist kein Platz – da steht schon etwas.',
  outside: 'Das liegt außerhalb deines Gartens.',
  maxLand: 'Dein Garten hat schon die volle Größe.',
  notThirsty: 'Diese Blume hat gerade keinen Durst.',
  thirsty: 'Diese Blume hat Durst – gieß sie zuerst.',
  maxDeco: 'Dein Garten ist voll mit Deko. Lagere etwas ein oder verkaufe es, bevor du Neues aufstellst.',
};

export function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const newBed = (i) => ({ locked: i >= C.STARTING_BEDS, seed: null, plantedAt: 0, dur: 0, shiny: false, var: 0, lvl: 1, sprinkler: false, drinks: 0, compost: false });

export function newState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    moves: 0, // Zähler für Spielaktionen (entscheidet bei Konflikten zwischen Geräten)
    coins: C.START_COINS,
    xp: 0,
    level: 1,
    beds: Array.from({ length: C.BED_COUNT }, (_, i) => newBed(i)),
    rareUnlocked: [],
    bred: [],
    selectedSeed: 'daisy',
    collection: {},
    deco: [],            // Deko-Arten, die man besitzt (Sammlung)
    decor: [],           // aufgestellte bzw. eingelagerte Deko-Teile: { id, x, z, r, stored }
    land: 0,             // Gartenerweiterung 0–3
    layout: { beds: C.DEFAULT_BEDS.map((p) => [...p]), gh: [...C.DEFAULT_GH] },
    skins: [],
    activeSkin: { fox: 'default', hedgehog: 'default' },
    items: Object.fromEntries(C.ITEM_ORDER.map((k) => [k, 0])),
    greenhouse: { unlocked: false, job: null },
    story: { ch: 0, q: 0, count: 0, intro: -1 },
    event: { id: null, year: 0, tokens: 0, total: 0, claimed: [] },
    tasks: { date: dayKey(now), progress: { plant: 0, harvest: 0, earn: 0, water: 0 }, claimed: [] },
    dailyGift: null,
    stats: { planted: 0, harvested: 0, earned: 0, shiny: 0, bred: 0, itemsUsed: 0, watered: 0, breedFailed: 0 },
    breedFails: {},      // Fehlversuche je Züchtung (machen den nächsten Versuch leichter)
    seenAnimals: [],
    tutorial: 0,
    settings: { cycle: 'auto', cycleMin: 8, cycleEpoch: now, quality: 'auto', music: true, musicVol: 0.5, sound: true, soundVol: 0.8 },
  };
}

const err = (code, extra = {}) => ({ ok: false, code, message: ERR[code] || code, ...extra });
const needLevel = (lvl, what) => err('level', { message: `${what} gibt es ab Level ${lvl}.`, level: lvl });

// ---------- Münzen, Gegenstände & Erfahrung ----------
export function addCoins(s, n) {
  n = Math.floor(Number(n) || 0);
  s.coins = Math.max(0, Math.floor(s.coins + n));
  if (n > 0) { s.stats.earned += n; s.tasks.progress.earn += n; track(s, 'earn', null, n); }
  return s.coins;
}

export function canAfford(s, n) { return s.coins >= n; }

function spend(s, n) {
  if (!Number.isFinite(n) || n < 0) return false;
  if (s.coins < n) return false;
  s.coins -= n;
  return true;
}

const noCoins = (s, n, what) => err('noCoins', { message: `Dir fehlen ${n - s.coins} Münzen für ${what}.`, missing: n - s.coins });

export function addItems(s, items = {}) {
  for (const [k, n] of Object.entries(items)) if (C.ITEMS[k]) s.items[k] = (s.items[k] || 0) + Math.max(0, Math.floor(n));
}

// Belohnung gutschreiben: { coins, xp, items, deco, skin }
export function grant(s, r = {}) {
  if (r.coins) addCoins(s, r.coins);
  if (r.items) addItems(s, r.items);
  if (r.deco && C.DECO[r.deco] && !s.deco.includes(r.deco)) { s.deco.push(r.deco); addDecor(s, r.deco); }
  if (r.skin && C.SKINS[r.skin] && !s.skins.includes(r.skin)) s.skins.push(r.skin);
  return r.xp ? addXp(s, r.xp) : [];
}

export function levelUnlocks(lvl) {
  const u = [];
  for (const k of C.BASE_SEEDS) {
    const d = C.SEEDS[k];
    if (d.level === lvl) u.push({ kind: 'seed', id: k, label: d.rare ? `${d.name} (im Shop freischaltbar)` : `${d.name} pflanzbar` });
  }
  for (const r of C.RECIPES) if (C.SEEDS[r.result].level === lvl) u.push({ kind: 'recipe', id: r.result, label: `Züchtung: ${C.SEEDS[r.result].name}` });
  C.BED_UNLOCK.forEach((b, i) => { if (b && b.level === lvl && lvl > 1) u.push({ kind: 'bed', id: i, label: b.land ? `Neues Beet (auf Erweiterung ${b.land})` : 'Neues Beet freischaltbar' }); });
  C.LAND.forEach((l, i) => { if (l.level === lvl) u.push({ kind: 'land', id: i, label: `Gartenerweiterung ${i}` }); });
  for (const k of C.DECO_ORDER) if (C.DECO[k].level === lvl && lvl > 1) u.push({ kind: 'deco', id: k, label: `Deko: ${C.DECO[k].name}` });
  for (const k of C.ITEM_ORDER) if (C.ITEMS[k].level === lvl && lvl > 1) u.push({ kind: 'item', id: k, label: `${C.ITEMS[k].name} im Shop` });
  if (C.SPRINKLER.level === lvl) u.push({ kind: 'feature', id: 'sprinkler', label: 'Automatische Bewässerung' });
  if (C.GREENHOUSE.level === lvl) u.push({ kind: 'feature', id: 'greenhouse', label: 'Gewächshaus restaurieren' });
  C.BED_LEVELS.forEach((b, i) => { if (b.level === lvl) u.push({ kind: 'feature', id: 'bed' + (i + 1), label: `Beet-Ausbau: ${b.name}` }); });
  // Doppelte Beet-Hinweise zusammenfassen
  const beds = u.filter((x) => x.kind === 'bed').length;
  return beds > 1 ? [...u.filter((x) => x.kind !== 'bed'), { kind: 'bed', label: `${beds} neue Beete freischaltbar` }] : u;
}

export function addXp(s, n) {
  s.xp += Math.max(0, Math.floor(n));
  const ups = [];
  while (s.level < C.MAX_LEVEL && s.xp >= C.LEVELS[s.level]) {
    s.level++;
    const reward = C.levelReward(s.level);
    addCoins(s, reward.coins);
    addItems(s, reward.items);
    ups.push({ level: s.level, reward: reward.coins, items: reward.items, unlocks: levelUnlocks(s.level) });
  }
  return ups;
}

export function xpProgress(s) {
  const cur = C.LEVELS[s.level - 1] ?? 0, next = C.LEVELS[s.level];
  if (next === undefined) return { level: s.level, frac: 1, have: s.xp - cur, need: 0, max: true };
  return { level: s.level, frac: Math.max(0, Math.min(1, (s.xp - cur) / (next - cur))), have: Math.max(0, s.xp - cur), need: next - cur, max: false };
}

export function roadmap(s) {
  const out = [];
  for (let l = 2; l <= C.MAX_LEVEL; l++) out.push({ level: l, reached: s.level >= l, reward: C.levelReward(l), unlocks: levelUnlocks(l) });
  return out;
}

// ---------- Saatgut ----------
export function seedStatus(s, id) {
  const d = C.SEEDS[id];
  if (!d) return { available: false, reason: ERR.unknown };
  if (d.bred) return s.bred.includes(id) ? { available: true } : { available: false, reason: 'Im Gewächshaus züchten', breed: true };
  if (d.rare) {
    if (s.rareUnlocked.includes(id)) return { available: true };
    if (s.level < d.level) return { available: false, reason: `Ab Level ${d.level}`, level: d.level };
    return { available: false, reason: `Im Shop freischalten (${d.unlockCoins} Münzen)`, shop: true };
  }
  if (s.level < d.level) return { available: false, reason: `Ab Level ${d.level}`, level: d.level };
  return { available: true };
}

// ---------- Wochenende & Events ----------
export const isWeekend = (now) => { const d = new Date(now).getDay(); return d === 0 || d === 6; };

function eventRange(ev, year) {
  const [sm, sd] = ev.start.split('-').map(Number), [em, ed] = ev.end.split('-').map(Number);
  return { start: new Date(year, sm - 1, sd, 0, 0, 0).getTime(), end: new Date(year, em - 1, ed, 23, 59, 59, 999).getTime() };
}

export function activeEvent(now) {
  const y = new Date(now).getFullYear();
  for (const ev of C.EVENTS) { const r = eventRange(ev, y); if (now >= r.start && now <= r.end) return { ...ev, ...r, year: y }; }
  return null;
}

export function upcomingEvents(now, n = 3) {
  const y = new Date(now).getFullYear(), list = [];
  for (const ev of C.EVENTS) for (const yy of [y, y + 1]) { const r = eventRange(ev, yy); if (r.start > now) { list.push({ ...ev, ...r, year: yy }); break; } }
  return list.sort((a, b) => a.start - b.start).slice(0, n);
}

export function ensureEvent(s, now) {
  const ev = activeEvent(now);
  if (!ev) return null;
  if (s.event.id !== ev.id || s.event.year !== ev.year) s.event = { id: ev.id, year: ev.year, tokens: 0, total: 0, claimed: [] };
  return ev;
}

export function eventTokensFor(reward) { return Math.min(6, 1 + Math.floor(reward / 60)); }

export function eventInfo(s, now) {
  const ev = ensureEvent(s, now);
  if (!ev) return { active: null, upcoming: upcomingEvents(now) };
  const milestones = ev.milestones.map((m, i) => ({ ...m, i, reached: s.event.total >= m.at, claimed: s.event.claimed.includes(i) }));
  return { active: ev, tokens: s.event.tokens, total: s.event.total, milestones, claimable: milestones.filter((m) => m.reached && !m.claimed).length, upcoming: upcomingEvents(now) };
}

export function claimEventMilestone(s, idx, now) {
  const ev = ensureEvent(s, now);
  if (!ev) return err('invalid', { message: 'Gerade läuft kein Event.' });
  const m = ev.milestones[idx];
  if (!m) return err('invalid');
  if (s.event.claimed.includes(idx)) return err('claimed');
  if (s.event.total < m.at) return err('notDone', { message: `Dafür brauchst du ${m.at} ${ev.token}.` });
  s.event.claimed.push(idx);
  const r = { ...m.reward };
  if (r.skin && s.skins.includes(r.skin)) { r.coins = (r.coins || 0) + 300; delete r.skin; }
  const levelUps = grant(s, r);
  return { ok: true, reward: r, levelUps };
}

export function buyEventItem(s, id, now) {
  const ev = ensureEvent(s, now);
  if (!ev) return err('invalid', { message: 'Gerade läuft kein Event.' });
  const it = ev.shop.find((x) => x.id === id);
  if (!it) return err('invalid');
  if (it.deco && s.deco.includes(it.deco)) return err('owned');
  if (s.event.tokens < it.price) return err('noTokens', { message: `Dir fehlen ${it.price - s.event.tokens} ${ev.token}.` });
  s.event.tokens -= it.price;
  grant(s, { items: it.items, deco: it.deco });
  return { ok: true };
}

// ---------- Beete ----------
export const growTime = (b, seedId) => Math.round(C.SEEDS[seedId].growMs * (b.sprinkler ? C.SPRINKLER.speed : 1));

// ---------- Gießen ----------
// Zeitpunkte (Anteil am Wachstum), an denen die Blume Durst bekommt. Sprinkler-Beete gießen sich selbst.
export const thirstPoints = (b) => (b.sprinkler || !b.seed ? [] : C.WATER_AT[C.SEEDS[b.seed]?.water || 0] || []);
// Wachstum unter Berücksichtigung von Durst: Eine durstige Blume bleibt stehen, bis sie gegossen wird
export function growState(b, now) {
  const dur = b.dur || growTime(b, b.seed);
  const raw = (now - b.plantedAt) / dur;
  const next = thirstPoints(b)[b.drinks || 0];
  if (next !== undefined && raw >= next) return { p: next, thirsty: true, dur, remaining: Math.round(dur * (1 - next)) };
  const p = Math.max(0, Math.min(1, raw));
  return { p, thirsty: false, dur, remaining: Math.max(0, Math.round(dur - (now - b.plantedAt))) };
}

function waterBed(s, b, now) {
  const g = growState(b, now);
  if (!g.thirsty) return false;
  b.plantedAt = now - g.p * g.dur; // Wachstum geht ab hier weiter
  b.drinks = (b.drinks || 0) + 1;
  s.stats.watered++; s.tasks.progress.water++;
  track(s, 'water');
  return true;
}

export function water(s, i, now) {
  const b = s.beds[i];
  if (!b || b.locked || !b.seed) return err('notGrowing');
  if (!waterBed(s, b, now)) return err('notThirsty');
  return { ok: true };
}

// Post von Freunden anwenden: Geschenke, gegossene Blumen, „Gefällt mir“
export function applyInbox(s, items, now) {
  const out = [];
  const name = (x) => String(x?.name || 'Ein Freund').slice(0, 20);
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== 'object') continue;
    if (it.k === 'gift' && C.ITEMS[it.item]) {
      const n = Math.max(1, Math.min(5, Math.floor(Number(it.n) || 1)));
      addItems(s, { [it.item]: n });
      out.push({ k: 'gift', name: name(it), item: it.item, n });
    } else if (it.k === 'help' && Array.isArray(it.beds)) {
      const done = [];
      for (const i of it.beds.slice(0, C.HELP.perDay)) {
        const b = s.beds[i];
        if (!b || b.locked || !b.seed) continue;
        const g = growState(b, now);
        if (!g.thirsty) continue;
        b.plantedAt = now - g.p * g.dur; b.drinks = (b.drinks || 0) + 1;
        done.push(i);
      }
      out.push({ k: 'help', name: name(it), beds: done });
    } else if (it.k === 'like') {
      const coins = Math.max(0, Math.min(C.LIKE.coins, Math.floor(Number(it.coins) || 0)));
      if (coins) addCoins(s, coins);
      out.push({ k: 'like', name: name(it), coins });
    }
  }
  return out;
}

export const thirstyBeds = (s, now) => s.beds.map((b, i) => (!b.locked && b.seed && growState(b, now).thirsty ? i : -1)).filter((i) => i >= 0);

export function bedInfo(s, i, now) {
  const b = s.beds[i];
  if (!b) return null;
  const base = { i, lvl: b.lvl, sprinkler: b.sprinkler };
  if (!bedVisible(s, i)) return { ...base, locked: true, hidden: true, price: C.BED_UNLOCK[i].cost, needLevel: C.BED_UNLOCK[i].level, needLand: C.BED_UNLOCK[i].land };
  if (b.locked) { const u = C.BED_UNLOCK[i]; return { ...base, locked: true, price: u.cost, needLevel: s.level < u.level ? u.level : 0 }; }
  if (!b.seed) return { ...base, empty: true };
  const g = growState(b, now), p = g.p;
  let stage = 0;
  for (let k = 0; k < C.GROWTH_STAGE_AT.length; k++) if (p >= C.GROWTH_STAGE_AT[k]) stage = k;
  const ready = !g.thirsty && p >= 1;
  return { ...base, seed: b.seed, progress: p, stage, ready, thirsty: g.thirsty, remaining: g.remaining, shiny: b.shiny && ready, shinyHidden: b.shiny, compost: !!b.compost, waterLeft: thirstPoints(b).length - (b.drinks || 0), var: b.var };
}

export function plant(s, i, seedId, now, rand = Math.random) {
  const b = s.beds[i];
  if (!b) return err('invalid');
  if (b.locked) return err('locked');
  if (b.seed) return err('occupied');
  const d = C.SEEDS[seedId];
  if (!d) return err('unknown');
  const st = seedStatus(s, seedId);
  if (!st.available) return err('seedLocked', { message: `${d.name.replace(/­/g, '')}: ${st.reason}.` });
  if (!spend(s, d.cost)) return noCoins(s, d.cost, d.name.replace(/­/g, ''));
  const chance = (C.SHINY_CHANCE + C.BED_LEVELS[b.lvl - 1].shiny) * (isWeekend(now) ? C.WEEKEND_BONUS.shinyFactor : 1);
  b.seed = seedId; b.plantedAt = now; b.dur = growTime(b, seedId); b.shiny = rand() < chance; b.var = Math.floor(rand() * 1000); b.drinks = 0;
  s.stats.planted++; s.tasks.progress.plant++;
  track(s, 'plant', seedId);
  if (s.tutorial < 1) s.tutorial = 1;
  return { ok: true, seed: seedId, cost: d.cost };
}

export function harvest(s, i, now) {
  const b = s.beds[i];
  if (!b) return err('invalid');
  if (b.locked) return err('locked');
  if (!b.seed) return err('empty');
  const d = C.SEEDS[b.seed], g = growState(b, now);
  if (g.thirsty) return err('thirsty');
  if (g.p < 1) return err('notReady', { remaining: g.remaining });
  const shiny = !!b.shiny, seed = b.seed, compost = !!b.compost;
  const reward = Math.round(d.reward * C.BED_LEVELS[b.lvl - 1].mult * (shiny ? C.SHINY_MULTIPLIER : 1) * (compost ? C.COMPOST_BONUS : 1));
  const xp = d.xp * (shiny ? 2 : 1);
  b.seed = null; b.plantedAt = 0; b.dur = 0; b.shiny = false; b.drinks = 0; b.compost = false;
  addCoins(s, reward);
  const entry = (s.collection[seed] ||= { count: 0, shiny: 0 });
  entry.count++; if (shiny) { entry.shiny++; s.stats.shiny++; track(s, 'shiny', seed); }
  s.stats.harvested++; s.tasks.progress.harvest++;
  track(s, 'harvest', seed);
  let tokens = 0;
  const ev = ensureEvent(s, now);
  if (ev) { tokens = eventTokensFor(reward); s.event.tokens += tokens; s.event.total += tokens; }
  if (s.tutorial < 2) s.tutorial = 2;
  const levelUps = addXp(s, xp);
  return { ok: true, seed, reward, xp, shiny, compost, tokens, levelUps };
}

export function unlockBed(s, i) {
  const b = s.beds[i];
  if (!b) return err('invalid');
  if (!b.locked) return err('owned');
  const u = C.BED_UNLOCK[i];
  if (!bedVisible(s, i)) return err('land', { message: 'Dieses Beet liegt auf neuem Land. Erweitere zuerst deinen Garten.' });
  if (s.level < u.level) return needLevel(u.level, 'Dieses Beet');
  if (!spend(s, u.cost)) return noCoins(s, u.cost, 'dieses Beet');
  b.locked = false;
  return { ok: true, price: u.cost };
}

export function buySprinkler(s, i, now) {
  const b = s.beds[i];
  if (!b || b.locked) return err('locked');
  if (b.sprinkler) return err('owned');
  if (s.level < C.SPRINKLER.level) return needLevel(C.SPRINKLER.level, 'Die Bewässerung');
  if (!spend(s, C.SPRINKLER.cost)) return noCoins(s, C.SPRINKLER.cost, 'die Bewässerung');
  if (b.seed) {
    const p = growState(b, now).p; // auch eine durstige Blume wächst ab jetzt weiter
    b.sprinkler = true;
    b.dur = growTime(b, b.seed);
    b.plantedAt = now - p * b.dur;
  } else b.sprinkler = true;
  return { ok: true };
}

export function upgradeBed(s, i) {
  const b = s.beds[i];
  if (!b || b.locked) return err('locked');
  if (b.lvl >= C.BED_LEVELS.length) return err('maxLevel');
  const next = C.BED_LEVELS[b.lvl];
  if (s.level < next.level) return needLevel(next.level, `Das ${next.name}`);
  if (!spend(s, next.cost)) return noCoins(s, next.cost, `das ${next.name}`);
  b.lvl++;
  return { ok: true, name: next.name, lvl: b.lvl };
}

// ---------- Gartenbedarf ----------
export function buyItem(s, id, pack = false) {
  const d = C.ITEMS[id];
  if (!d) return err('invalid');
  if (s.level < d.level) return needLevel(d.level, d.name);
  const [n, price] = pack && d.pack ? d.pack : [1, d.price];
  if (!spend(s, price)) return noCoins(s, price, d.name);
  s.items[id] += n;
  return { ok: true, n };
}

export function useItem(s, id, i, now) {
  if (!C.ITEMS[id]) return err('invalid');
  if (!s.items[id]) return err('noItem');
  if (id === 'pollen') return err('invalid', { message: 'Zauberpollen benutzt du im Gewächshaus beim Starten einer Züchtung.' });
  if (id === 'boost') {
    const job = s.greenhouse.job;
    if (!job) return err('noJob');
    if (now - job.start >= job.dur) return err('invalid', { message: 'Die Züchtung ist schon fertig.' });
    job.start = now - job.dur;
  } else if (id === 'rain') {
    // Regenwolke: alle durstigen Blumen auf einmal
    const list = thirstyBeds(s, now);
    if (!list.length) return err('invalid', { message: 'Gerade hat keine Blume Durst.' });
    for (const k of list) waterBed(s, s.beds[k], now);
  } else {
    const b = s.beds[i];
    if (!b || b.locked || !b.seed) return err('notGrowing');
    const g = growState(b, now), done = !g.thirsty && g.p >= 1;
    if (id === 'lucky') {
      if (b.shiny) return err('invalid', { message: 'Diese Blume wird schon eine Funkelblüte.' });
      b.shiny = true;
    } else if (id === 'compost') {
      if (b.compost) return err('invalid', { message: 'In diesem Beet ist schon Kompost.' });
      b.compost = true;
    } else {
      if (done) return err('invalid', { message: 'Die Blume ist schon erntereif.' });
      if (id === 'fert') {
        if (g.thirsty) return err('thirsty');
        b.plantedAt = Math.max(now - g.dur, b.plantedAt - g.dur * 0.5);
      }
      if (id === 'turbo') { b.plantedAt = now - g.dur; b.drinks = thirstPoints(b).length; }
    }
  }
  s.items[id]--;
  s.stats.itemsUsed++;
  track(s, 'useItem', id);
  return { ok: true };
}

// ---------- Gewächshaus & Zucht ----------
export function unlockGreenhouse(s) {
  if (s.greenhouse.unlocked) return err('owned');
  if (s.level < C.GREENHOUSE.level) return needLevel(C.GREENHOUSE.level, 'Das Gewächshaus');
  if (!spend(s, C.GREENHOUSE.cost)) return noCoins(s, C.GREENHOUSE.cost, 'das Gewächshaus');
  s.greenhouse.unlocked = true;
  return { ok: true };
}

export function findRecipe(a, b) {
  return C.RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;
}

export const discovered = (s, id) => (s.collection[id]?.count || 0) > 0;
export const harvestCount = (s, id) => s.collection[id]?.count || 0;
export const breedDiff = (r) => C.BREED_DIFF[r?.diff] || C.BREED_DIFF[1];

// Erfolgschance einer Kreuzung (0..1) mit allen Boni
export function breedChance(s, r, { pollen = false } = {}) {
  const D = breedDiff(r);
  const fails = s.breedFails?.[r.result] || 0;
  let helpers = 0;
  for (const [id, v] of Object.entries(C.BREED_HELPERS)) if (s.decor.some((d) => d.id === id && !d.stored)) helpers += v;
  const bonus = fails * C.BREED_PITY + helpers + (pollen ? C.BREED_POLLEN : 0);
  return { chance: Math.min(1, D.chance + bonus), base: D.chance, fails, helpers, pollen: pollen ? C.BREED_POLLEN : 0, diff: r.diff || 1, name: D.name, harvests: D.harvests };
}

export function breedCheck(s, a, b, night) {
  if (!s.greenhouse.unlocked) return err('invalid', { message: 'Restauriere zuerst das Gewächshaus.' });
  if (s.greenhouse.job) return err('busy');
  if (!a || !b) return err('invalid', { message: 'Wähle zwei Blumen aus.' });
  if (!discovered(s, a) || !discovered(s, b)) return err('invalid', { message: 'Du kannst nur Blumen kreuzen, die du schon geerntet hast.' });
  const r = findRecipe(a, b);
  if (!r) return err('noRecipe');
  const d = C.SEEDS[r.result];
  if (s.bred.includes(r.result)) return err('owned', { message: `${d.name.replace(/­/g, '')} hast du schon gezüchtet.`, recipe: r });
  if (s.level < d.level) return needLevel(d.level, `Die Züchtung ${d.name.replace(/­/g, '')}`);
  if (r.night && !night) return err('night', { message: 'Diese Kreuzung gelingt nur nachts. Warte auf die Nacht oder stelle in den Einstellungen „Immer Nacht“ ein.', recipe: r });
  const need = breedDiff(r).harvests;
  const short = [a, b].filter((k) => harvestCount(s, k) < need);
  if (short.length) return err('harvests', { message: `Für diese ${breedDiff(r).adj} Züchtung brauchst du jede Eltern-Blume ${need}× geerntet. Noch nötig: ${short.map((k) => `${C.SEEDS[k].name.replace(/­/g, '')} (${harvestCount(s, k)}/${need})`).join(' und ')}.`, recipe: r });
  return { ok: true, recipe: r };
}

export function startBreeding(s, a, b, now, night, { pollen = false, rand = Math.random } = {}) {
  const c = breedCheck(s, a, b, night);
  if (!c.ok) return c;
  const r = c.recipe;
  if (pollen && !s.items.pollen) return err('noItem');
  const ch = breedChance(s, r, { pollen });
  if (!spend(s, r.cost)) return noCoins(s, r.cost, 'diese Züchtung');
  if (pollen) { s.items.pollen--; s.stats.itemsUsed++; track(s, 'useItem', 'pollen'); }
  // Das Ergebnis steht beim Start fest; gezeigt wird es erst beim Abholen.
  const success = ch.chance >= 1 || rand() < ch.chance;
  s.greenhouse.job = { a, b, result: r.result, start: now, dur: r.ms, chance: ch.chance, success, cost: r.cost };
  return { ok: true, result: r.result, chance: ch.chance };
}

export function breedingInfo(s, now) {
  const job = s.greenhouse.job;
  if (!job) return null;
  const p = Math.max(0, Math.min(1, (now - job.start) / job.dur));
  return { ...job, progress: p, ready: p >= 1, remaining: Math.max(0, job.dur - (now - job.start)) };
}

export function collectBreeding(s, now) {
  const info = breedingInfo(s, now);
  if (!info) return err('noJob');
  if (!info.ready) return err('notReady', { message: 'Die Züchtung braucht noch etwas Zeit.' });
  s.greenhouse.job = null;
  const d = C.SEEDS[info.result];
  if (info.success === false) {
    // Misslungen: ein Teil der Kosten zurück, Erfahrung macht den nächsten Versuch leichter
    s.breedFails[info.result] = (s.breedFails[info.result] || 0) + 1;
    s.stats.breedFailed++;
    const refund = Math.round((info.cost || 0) * C.BREED_REFUND);
    s.coins += refund;
    const levelUps = addXp(s, 5);
    const r = C.RECIPES.find((x) => x.result === info.result);
    return { ok: true, failed: true, seed: info.result, refund, xp: 5, next: r ? breedChance(s, r).chance : 1, levelUps };
  }
  if (!s.bred.includes(info.result)) s.bred.push(info.result);
  s.stats.bred++;
  const levelUps = addXp(s, 20 + d.xp);
  return { ok: true, seed: info.result, xp: 20 + d.xp, levelUps };
}

// ---------- Story ----------
function currentQuest(s) {
  const ch = C.STORY[s.story.ch];
  return ch ? ch.quests[s.story.q] : null;
}

function track(s, type, id, amount = 1) {
  const q = s.story && currentQuest(s);
  if (!q || q.goal.type !== type) return;
  if (q.goal.seed && q.goal.seed !== id) return;
  if (q.goal.item && q.goal.item !== id) return;
  s.story.count += amount;
}

function questProgress(s, goal) {
  switch (goal.type) {
    case 'plant': case 'harvest': case 'useItem': case 'shiny': case 'earn': case 'water': return [Math.min(goal.n, s.story.count), goal.n];
    case 'level': return [Math.min(goal.n, s.level), goal.n];
    case 'beds': return [Math.min(goal.n, s.beds.filter((b) => !b.locked).length), goal.n];
    case 'deco': return [Math.min(goal.n, s.deco.length), goal.n];
    case 'move': return [Math.min(goal.n, s.story.count), goal.n];
    case 'greenhouse': return [s.greenhouse.unlocked ? 1 : 0, 1];
    case 'breed': return [s.bred.includes(goal.seed) ? 1 : 0, 1];
    case 'rare': return [s.rareUnlocked.includes(goal.seed) ? 1 : 0, 1];
    case 'sprinkler': return [Math.min(goal.n, s.beds.filter((b) => b.sprinkler).length), goal.n];
    case 'bedLevel': return [Math.min(goal.n, s.beds.filter((b) => b.lvl >= goal.lvl).length), goal.n];
    case 'animal': return [s.seenAnimals.includes(goal.id) ? 1 : 0, 1];
    default: return [0, 1];
  }
}

export function storyStatus(s) {
  const chapter = C.STORY[s.story.ch];
  if (!chapter) return { finished: true, chapters: C.STORY.length };
  const quest = chapter.quests[s.story.q];
  const [have, need] = questProgress(s, quest.goal);
  return { finished: false, ch: s.story.ch, q: s.story.q, chapter, quest, have, need, done: have >= need, showIntro: s.story.intro < s.story.ch, chapters: C.STORY.length };
}

export function markIntroSeen(s) { s.story.intro = Math.max(s.story.intro, s.story.ch); }

export function claimQuest(s) {
  const st = storyStatus(s);
  if (st.finished) return err('invalid', { message: 'Alle Kapitel sind abgeschlossen.' });
  if (!st.done) return err('notDone');
  const levelUps = grant(s, st.quest.reward);
  s.story.q++;
  s.story.count = 0;
  let chapterDone = false;
  if (s.story.q >= st.chapter.quests.length) { s.story.ch++; s.story.q = 0; chapterDone = true; }
  return { ok: true, reward: st.quest.reward, say: st.quest.say, chapterDone, chapterTitle: st.chapter.title, levelUps };
}

// ---------- Shop (nur Spielwährung) ----------
export function unlockRareSeed(s, id) {
  const d = C.SEEDS[id];
  if (!d || !d.rare) return err('invalid');
  if (s.rareUnlocked.includes(id)) return err('owned');
  if (s.level < d.level) return needLevel(d.level, d.name);
  if (!spend(s, d.unlockCoins)) return noCoins(s, d.unlockCoins, d.name);
  s.rareUnlocked.push(id);
  return { ok: true };
}

export function buyDeco(s, id, near) {
  const d = C.DECO[id];
  if (!d || !d.price) return err('invalid');
  if (s.level < (d.level || 1)) return needLevel(d.level, d.name);
  if (s.decor.length >= C.MAX_DECO) return err('maxDeco');
  if (!spend(s, d.price)) return noCoins(s, d.price, d.name);
  if (!s.deco.includes(id)) s.deco.push(id);
  const k = addDecor(s, id, near);
  return { ok: true, k, stored: s.decor[k].stored };
}

// ---------- Garten gestalten ----------
export const landHalf = (s) => C.LAND[s.land].half;
// Bereich, in dem Dinge stehen dürfen (Rand für Zaun, Hecke und Blumenrabatte)
export function gardenBounds(s) { const G = landHalf(s); return [-G + 0.8, -G + 0.8, G - 1.5, G - 1.5]; }
export const bedVisible = (s, i) => { const u = C.BED_UNLOCK[i]; return !u || !u.land || s.land >= u.land; };
const RECT = (x, z, [w, d]) => [x - w / 2, z - d / 2, x + w / 2, z + d / 2];
const EPS = 1e-6;
const hits = (a, b) => a[0] < b[2] - EPS && b[0] < a[2] - EPS && a[1] < b[3] - EPS && b[1] < a[3] - EPS;

export function footprint(s, ref, r) {
  const [w, d] = ref.type === 'bed' ? C.BED_SIZE : ref.type === 'gh' ? C.GH_SIZE : C.DECO[ref.id ?? s.decor[ref.k]?.id]?.size || [1, 1];
  return r % 2 ? [d, w] : [w, d];
}
export function objectPos(s, ref) {
  if (ref.type === 'bed') return s.layout.beds[ref.i];
  if (ref.type === 'gh') return s.layout.gh;
  const d = s.decor[ref.k];
  return d ? [d.x, d.z, d.r] : null;
}
const same = (a, b) => a && b && a.type === b.type && (a.type === 'gh' || (a.type === 'bed' ? a.i === b.i : a.k === b.k));

// Alle belegten Flächen (außer dem Objekt „skip“)
export function occupied(s, skip) {
  const out = C.OBSTACLES.map((r) => ({ r, what: 'fixed' }));
  s.layout.beds.forEach((p, i) => { if (bedVisible(s, i) && !same(skip, { type: 'bed', i })) out.push({ r: RECT(p[0], p[1], footprint(s, { type: 'bed' }, p[2])), what: 'bed' }); });
  if (!same(skip, { type: 'gh' })) { const g = s.layout.gh; out.push({ r: RECT(g[0], g[1], footprint(s, { type: 'gh' }, g[2])), what: 'gh' }); }
  s.decor.forEach((d, k) => { if (!d.stored && !same(skip, { type: 'deco', k })) out.push({ r: RECT(d.x, d.z, footprint(s, { type: 'deco', id: d.id }, d.r)), what: 'deco' }); });
  return out;
}

export function canPlace(s, ref, x, z, r = 0) {
  if (![x, z].every(Number.isFinite) || ![0, 1, 2, 3].includes(r)) return err('invalid');
  const rect = RECT(x, z, footprint(s, ref, r));
  const b = gardenBounds(s);
  if (rect[0] < b[0] - EPS || rect[1] < b[1] - EPS || rect[2] > b[2] + EPS || rect[3] > b[3] + EPS) return err('outside');
  if (occupied(s, ref).some((o) => hits(rect, o.r))) return err('noSpace');
  return { ok: true };
}

export function moveObject(s, ref, x, z, r = 0) {
  if (ref.type === 'bed' && (!s.layout.beds[ref.i] || !bedVisible(s, ref.i))) return err('invalid');
  if (ref.type === 'deco' && (!s.decor[ref.k] || s.decor[ref.k].stored)) return err('invalid');
  const c = canPlace(s, ref, x, z, r);
  if (!c.ok) return c;
  const old = objectPos(s, ref);
  const moved = old[0] !== x || old[1] !== z || old[2] !== r;
  if (ref.type === 'deco') Object.assign(s.decor[ref.k], { x, z, r });
  else if (ref.type === 'gh') s.layout.gh = [x, z, r];
  else s.layout.beds[ref.i] = [x, z, r];
  if (moved) track(s, 'move');
  return { ok: true, moved };
}

// Freien Platz suchen: spiralförmig um „near“, im Raster SNAP
export function findSpot(s, ref, near = [0.4, 1], r = 0) {
  const step = 0.5, b = gardenBounds(s), maxR = Math.ceil((b[2] - b[0]) / step);
  const snap = (v) => Math.round(v / C.SNAP) * C.SNAP;
  const cx = snap(near[0]), cz = snap(near[1]);
  for (let ring = 0; ring <= maxR; ring++) {
    for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      const x = cx + dx * step, z = cz + dz * step;
      if (canPlace(s, ref, x, z, r).ok) return [x, z, r];
    }
  }
  return null;
}

// Neues Deko-Teil: bevorzugter Platz, sonst nächster freier, sonst ins Lager
export function addDecor(s, id, near) {
  const k = s.decor.length;
  s.decor.push({ id, x: 0, z: 0, r: 0, stored: true });
  const ref = { type: 'deco', k };
  const prefs = (C.DECO_PLACE[id] || []).filter((p) => canPlace(s, ref, p[0], p[1], p[2]).ok);
  const spot = (!near && prefs[0]) || findSpot(s, ref, near || (C.DECO_PLACE[id]?.[0]) || [0.4, 6.5], 0);
  if (spot) Object.assign(s.decor[k], { x: spot[0], z: spot[1], r: spot[2], stored: false });
  return k;
}

export function storeDeco(s, k) {
  const d = s.decor[k];
  if (!d) return err('invalid');
  d.stored = true;
  return { ok: true };
}

export function placeDeco(s, k, near) {
  const d = s.decor[k];
  if (!d || !d.stored) return err('invalid');
  const spot = findSpot(s, { type: 'deco', k }, near || [0.4, 6.5], 0);
  if (!spot) return err('noSpace', { message: 'Im Garten ist gerade kein Platz frei. Verschiebe oder lagere zuerst etwas ein – oder erweitere deinen Garten.' });
  Object.assign(d, { x: spot[0], z: spot[1], r: spot[2], stored: false });
  return { ok: true, pos: spot };
}

// Eingelagerte Deko zurückgeben: halber Preis zurück
export function sellDeco(s, k) {
  const d = s.decor[k];
  if (!d) return err('invalid');
  const price = C.DECO[d.id]?.price || 0;
  const back = Math.floor(price / 2);
  s.decor.splice(k, 1);
  if (back) addCoins(s, back);
  return { ok: true, coins: back };
}

export function expandLand(s) {
  const next = C.LAND[s.land + 1];
  if (!next) return err('maxLand');
  if (s.level < next.level) return needLevel(next.level, 'Die nächste Gartenerweiterung');
  if (!spend(s, next.cost)) return noCoins(s, next.cost, 'die Gartenerweiterung');
  s.land++;
  return { ok: true, land: s.land, half: next.half };
}

export function buySkin(s, id) {
  const d = C.SKINS[id];
  if (!d) return err('invalid');
  if (s.skins.includes(id)) return err('owned');
  if (!spend(s, d.price)) return noCoins(s, d.price, d.name);
  s.skins.push(id);
  s.activeSkin[d.animal] = id;
  return { ok: true };
}

export function equipSkin(s, animal, id) {
  if (id !== 'default' && (!s.skins.includes(id) || C.SKINS[id]?.animal !== animal)) return err('invalid');
  s.activeSkin[animal] = id;
  return { ok: true };
}

// ---------- Tägliches ----------
export function ensureDaily(s, now) {
  const k = dayKey(now);
  if (s.tasks.date !== k) s.tasks = { date: k, progress: { plant: 0, harvest: 0, earn: 0, water: 0 }, claimed: [] };
}

export function taskList(s) {
  return C.DAILY_TASKS.map((t) => ({ ...t, have: Math.min(t.goal, s.tasks.progress[t.id] || 0), done: (s.tasks.progress[t.id] || 0) >= t.goal, claimed: s.tasks.claimed.includes(t.id) }));
}

export function claimableTasks(s) { return taskList(s).filter((t) => t.done && !t.claimed).length; }

export function claimTask(s, id, now) {
  ensureDaily(s, now);
  const t = taskList(s).find((x) => x.id === id);
  if (!t) return err('invalid');
  if (t.claimed) return err('claimed');
  if (!t.done) return err('notDone');
  s.tasks.claimed.push(id);
  addCoins(s, t.reward);
  const levelUps = addXp(s, t.xp);
  return { ok: true, reward: t.reward, levelUps };
}

export function dailyGiftAvailable(s, now) { return s.dailyGift !== dayKey(now); }

export function claimDailyGift(s, now) {
  if (!dailyGiftAvailable(s, now)) return err('claimed', { message: 'Das Geschenk von heute hast du schon abgeholt. Morgen gibt es ein neues!' });
  s.dailyGift = dayKey(now);
  addCoins(s, C.DAILY_GIFT);
  return { ok: true, reward: C.DAILY_GIFT };
}

// ---------- Einstellungen ----------
const SETTING_RULES = {
  cycle: (v) => ['auto', 'day', 'night'].includes(v),
  cycleMin: (v) => Number.isFinite(v) && v >= 2 && v <= 30,
  quality: (v) => ['auto', 'high', 'medium', 'low'].includes(v),
  music: (v) => typeof v === 'boolean',
  sound: (v) => typeof v === 'boolean',
  musicVol: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
  soundVol: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
};

const CYCLE_OFFSET = 0.04; // Spiel startet am frühen Morgen

export function setSetting(s, key, value, now) {
  if (!SETTING_RULES[key] || !SETTING_RULES[key](value)) return err('invalid');
  if (key === 'cycleMin') {
    const p = cyclePhase(s, now);
    s.settings.cycleMin = value;
    s.settings.cycleEpoch = now - (p - CYCLE_OFFSET) * value * 60_000;
    return { ok: true };
  }
  s.settings[key] = value;
  return { ok: true };
}

export function cyclePhase(s, now) {
  const st = s.settings;
  if (st.cycle === 'day') return 0.3;
  if (st.cycle === 'night') return 0.82;
  const len = st.cycleMin * 60_000;
  return ((((now - st.cycleEpoch) / len + CYCLE_OFFSET) % 1) + 1) % 1;
}

// ---------- Laden, Prüfen, Übernehmen ----------
export function migrate(raw, now = Date.now()) {
  const base = newState(now);
  if (!raw || typeof raw !== 'object') return { state: base, migrated: false };
  if (raw.v === 1) {
    // Prototyp-Spielstand übernehmen
    const s = base;
    s.decor = undefined; // wird in repair aus den Deko-Arten aufgebaut
    s.coins = Math.max(0, Math.floor(Number(raw.coins) || 0)) || base.coins;
    if (raw.col && typeof raw.col === 'object') for (const [k, n] of Object.entries(raw.col)) {
      const id = k === 'sun' ? 'sunflower' : k === 'lotus' ? 'orchid' : k;
      if (C.SEEDS[id]) s.collection[id] = { count: Math.max(0, Math.floor(n) || 0), shiny: 0 };
    }
    if (Array.isArray(raw.own)) { if (raw.own.includes('rose')) s.rareUnlocked.push('rose'); if (raw.own.includes('lotus')) s.rareUnlocked.push('orchid'); }
    if (Array.isArray(raw.deco) && raw.deco.includes('lantern')) s.deco.push('lantern');
    if (raw.set) {
      if (['auto', 'day', 'night'].includes(raw.set.mode)) s.settings.cycle = raw.set.mode;
      if (raw.set.low) s.settings.quality = 'low';
      s.settings.music = !!raw.set.music; s.settings.sound = raw.set.snd !== false;
    }
    return { state: repair(s, now), migrated: true };
  }
  if (raw.v === 2) {
    // Version 2 -> 3: goldene Blüten heißen jetzt Funkelblüten, 6 neue Beete, neue Systeme
    const s = { ...base, ...raw };
    s.beds = Array.isArray(raw.beds) ? raw.beds.map((b) => ({ ...newBed(0), ...b, shiny: !!(b && b.golden), lvl: 1, sprinkler: false })) : base.beds;
    s.collection = {};
    if (raw.collection && typeof raw.collection === 'object') for (const [k, e] of Object.entries(raw.collection)) s.collection[k] = typeof e === 'number' ? e : { count: e?.count, shiny: e?.golden ?? e?.shiny };
    s.stats = { ...base.stats, ...(raw.stats || {}), shiny: raw.stats?.golden ?? 0 };
    s.settings = { ...base.settings, ...(raw.settings || {}) };
    s.activeSkin = { ...base.activeSkin, ...(raw.activeSkin || {}) };
    // Fortschritt in der Story grob übernehmen: erfahrene Spieler starten nicht bei null
    s.story = { ...base.story };
    s.decor = undefined; s.layout = undefined; s.land = 0;
    s.v = SAVE_VERSION;
    return { state: repair(s, now), migrated: true };
  }
  if (raw.v === 3 || raw.v === 4 || raw.v === SAVE_VERSION) {
    const s = { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) }, stats: { ...base.stats, ...(raw.stats || {}) }, activeSkin: { ...base.activeSkin, ...(raw.activeSkin || {}) } };
    // Version 3 -> 4: frei verschiebbarer Garten, Deko als einzelne Teile
    if (raw.v === 3) { s.decor = undefined; s.layout = undefined; s.land = 0; }
    return { state: repair(s, now), migrated: raw.v === 3 };
  }
  return { state: base, migrated: false, discarded: true };
}

// Beschädigte oder manipulierte Werte reparieren, statt abzustürzen
export function repair(s, now) {
  const base = newState(now);
  const num = (v, d, min = 0) => (Number.isFinite(v) && v >= min ? Math.floor(v) : d);
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  s.coins = num(s.coins, base.coins);
  s.moves = num(s.moves, 0);
  s.xp = num(s.xp, 0);
  s.level = Math.min(C.MAX_LEVEL, Math.max(1, num(s.level, 1, 1)));
  // Level passend zur Erfahrung (z.B. nach Änderung der Levelkurve)
  while (s.level < C.MAX_LEVEL && s.xp >= C.LEVELS[s.level]) s.level++;
  const beds = Array.isArray(s.beds) ? s.beds.slice(0, C.BED_COUNT) : [];
  while (beds.length < C.BED_COUNT) beds.push(newBed(beds.length));
  s.beds = beds.map((b, i) => {
    const ok = obj(b);
    const seed = ok && C.SEEDS[b.seed] ? b.seed : null;
    const bed = {
      locked: i < C.STARTING_BEDS ? false : ok ? !!b.locked : true,
      seed, plantedAt: seed ? num(b.plantedAt, now) : 0, dur: 0,
      shiny: seed ? !!(b.shiny ?? b.golden) : false, var: ok ? num(b.var, 0) : 0,
      lvl: ok ? Math.min(C.BED_LEVELS.length, Math.max(1, num(b.lvl, 1, 1))) : 1,
      sprinkler: ok ? !!b.sprinkler : false,
      drinks: ok ? Math.min(2, num(b.drinks, 0)) : 0,
      compost: seed && ok ? !!b.compost : false,
    };
    if (seed) bed.dur = num(b.dur, 0, 1) || growTime(bed, seed);
    return bed;
  });
  for (const k of ['rareUnlocked', 'deco', 'skins', 'seenAnimals', 'bred']) if (!Array.isArray(s[k])) s[k] = [];
  s.rareUnlocked = [...new Set(s.rareUnlocked.filter((k) => C.SEEDS[k]?.rare))];
  s.bred = [...new Set(s.bred.filter((k) => C.SEEDS[k]?.bred))];
  s.deco = [...new Set(s.deco.filter((k) => C.DECO[k]))];
  // Garten-Layout
  s.land = Math.min(C.LAND.length - 1, num(s.land, 0));
  const lay = obj(s.layout) ? s.layout : {};
  const pos = (p, d) => (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1], [0, 1, 2, 3].includes(p[2]) ? p[2] : 0] : [...d]);
  s.layout = { beds: C.DEFAULT_BEDS.map((d, i) => pos(Array.isArray(lay.beds) ? lay.beds[i] : null, d)), gh: pos(lay.gh, C.DEFAULT_GH) };
  if (!Array.isArray(s.decor)) {
    // Übernahme: jede Deko-Art an ihre bisherigen Plätze
    s.decor = [];
    for (const id of s.deco) for (let n = 0; n < Math.max(1, (C.DECO_PLACE[id] || []).length); n++) addDecor(s, id);
  } else {
    s.decor = s.decor.filter((d) => obj(d) && C.DECO[d.id]).slice(0, C.MAX_DECO).map((d) => ({ id: d.id, x: Number.isFinite(d.x) ? d.x : 0, z: Number.isFinite(d.z) ? d.z : 0, r: [0, 1, 2, 3].includes(d.r) ? d.r : 0, stored: !!d.stored || !Number.isFinite(d.x) || !Number.isFinite(d.z) }));
  }
  for (const d of s.decor) if (!s.deco.includes(d.id)) s.deco.push(d.id);
  s.skins = [...new Set(s.skins.filter((k) => C.SKINS[k]))];
  s.seenAnimals = [...new Set(s.seenAnimals.filter((k) => C.ANIMALS[k]))];
  const col = obj(s.collection) ? s.collection : {};
  s.collection = {};
  for (const [k, e] of Object.entries(col)) {
    if (!C.SEEDS[k]) continue;
    if (typeof e === 'number') s.collection[k] = { count: num(e, 0), shiny: 0 };
    else if (obj(e)) s.collection[k] = { count: num(Number(e.count), 0), shiny: num(Number(e.shiny ?? e.golden), 0) };
  }
  const st = obj(s.stats) ? s.stats : {};
  s.stats = {};
  for (const k of Object.keys(base.stats)) s.stats[k] = num(Number(st[k]), 0);
  const skins = obj(s.activeSkin) ? s.activeSkin : {};
  s.activeSkin = {};
  for (const animal of Object.keys(base.activeSkin)) {
    const id = skins[animal];
    s.activeSkin[animal] = id && s.skins.includes(id) && C.SKINS[id]?.animal === animal ? id : 'default';
  }
  const items = obj(s.items) ? s.items : {};
  s.items = {};
  for (const k of C.ITEM_ORDER) s.items[k] = num(Number(items[k]), 0);
  const gh = obj(s.greenhouse) ? s.greenhouse : {};
  const job = obj(gh.job) && C.SEEDS[gh.job.result]?.bred ? { a: gh.job.a, b: gh.job.b, result: gh.job.result, start: num(gh.job.start, now), dur: num(gh.job.dur, 60_000, 1), chance: Math.min(1, Math.max(0, Number(gh.job.chance) || 1)), success: gh.job.success !== false, cost: num(Number(gh.job.cost), 0) } : null;
  const bf = obj(s.breedFails) ? s.breedFails : {};
  s.breedFails = {};
  for (const [k, n] of Object.entries(bf)) if (C.SEEDS[k]?.bred && Number.isFinite(n) && n > 0) s.breedFails[k] = Math.min(20, Math.floor(n));
  s.greenhouse = { unlocked: !!gh.unlocked, job: gh.unlocked ? job : null };
  const story = obj(s.story) ? s.story : {};
  s.story = { ch: Math.min(C.STORY.length, num(story.ch, 0)), q: num(story.q, 0), count: num(Number(story.count), 0), intro: Number.isFinite(story.intro) ? Math.floor(story.intro) : -1 };
  if (C.STORY[s.story.ch] && s.story.q >= C.STORY[s.story.ch].quests.length) s.story.q = 0;
  const ev = obj(s.event) ? s.event : {};
  s.event = { id: typeof ev.id === 'string' ? ev.id : null, year: num(ev.year, 0), tokens: num(Number(ev.tokens), 0), total: num(Number(ev.total), 0), claimed: Array.isArray(ev.claimed) ? ev.claimed.filter(Number.isInteger) : [] };
  if (!C.SEEDS[s.selectedSeed]) s.selectedSeed = 'daisy';
  if (!obj(s.tasks) || !obj(s.tasks.progress)) s.tasks = base.tasks;
  for (const k of Object.keys(base.tasks.progress)) s.tasks.progress[k] = num(Number(s.tasks.progress[k]), 0);
  if (!Array.isArray(s.tasks.claimed)) s.tasks.claimed = [];
  if (typeof s.tasks.date !== 'string') s.tasks.date = base.tasks.date;
  if (s.dailyGift !== null && typeof s.dailyGift !== 'string') s.dailyGift = null;
  s.tutorial = Math.min(2, num(s.tutorial, 0));
  if (!obj(s.settings)) s.settings = { ...base.settings };
  for (const [k, rule] of Object.entries(SETTING_RULES)) if (!rule(s.settings[k])) s.settings[k] = base.settings[k];
  if (!Number.isFinite(s.settings.cycleEpoch)) s.settings.cycleEpoch = now;
  ensureDaily(s, now);
  delete s.golden;
  s.v = SAVE_VERSION;
  return s;
}
