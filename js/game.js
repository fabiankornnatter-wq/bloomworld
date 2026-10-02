// Reine Spiellogik von BloomWorld – ohne Grafik und ohne Browser-Abhängigkeiten.
// Alle Funktionen verändern den übergebenen Spielstand und geben ein Ergebnis-Objekt zurück.
import * as C from './config.js';

export const SAVE_VERSION = 5;

// Vom Admin geschaltete Events (kommen vom Server; gelten für alle Spieler) und Händler-Angebot
let BOOSTS = {}, OFFER = null;
export function setBoosts(b, offer = null) { BOOSTS = b && typeof b === 'object' ? b : {}; OFFER = offer && typeof offer === 'object' ? offer : null; }
export const boost = (id) => (BOOSTS[id] && BOOSTS[id].end > Date.now() ? Number(BOOSTS[id].mult) || 2 : 1);
export const activeBoosts = () => Object.values(BOOSTS).filter((b) => b.end > Date.now());

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

const newBed = (i) => ({ locked: i >= C.STARTING_BEDS, seed: null, plantedAt: 0, dur: 0, shiny: false, var: 0, lvl: 1, size: 1, sprinkler: false, drinks: 0, compost: false });

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
    stats: { planted: 0, harvested: 0, earned: 0, shiny: 0, bred: 0, itemsUsed: 0, watered: 0, breedFailed: 0, orders: 0, sold: 0, special: 0, helped: 0, gifted: 0, liked: 0, friends: 0, petDays: 0 },
    weekly: { week: '', progress: {}, claimed: [], days: [], bonus: false },
    pets: { day: '', done: [], butterfly: '' },   // Tiere gestreichelt (je Tag), Schmetterling-Bonus-Tag
    surprise: { day: '', n: 0 },
    trader: { day: '', orders: [], rep: 0, gift: '', offer: '' },
    basket: {}, basketShiny: {},   // Blumenkorb für den Händler
    breedFails: {},      // Fehlversuche je Züchtung (machen den nächsten Versuch leichter)
    seenAnimals: [],
    tutorial: 0,
    tutorialDone: 0,
    seeds: {},           // Samen von Event-Blumen (auch nach dem Event säbar, tauschbar)
    achievements: [],    // abgeschlossene Erfolge
    titles: [], title: '',
    unlocked: [],        // exklusive Blumen aus dem Album
    settings: { cycle: 'real', rt: true, cycleMin: 8, cycleEpoch: now, quality: 'auto', music: true, musicVol: 0.5, sound: true, soundVol: 0.8 },
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
  if (r.seeds) addSeeds(s, r.seeds);
  if (r.title && C.TITLES[r.title] && !s.titles.includes(r.title)) { s.titles.push(r.title); if (!s.title) s.title = r.title; }
  if (r.unlock && C.SEEDS[r.unlock]?.exclusive && !s.unlocked.includes(r.unlock)) s.unlocked.push(r.unlock);
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
  s.xp += Math.max(0, Math.floor(n * boost('doubleXp')));
  const ups = [];
  while (s.level < C.MAX_LEVEL && s.xp >= C.LEVELS[s.level]) {
    s.level++;
    const reward = C.levelReward(s.level);
    grant(s, { coins: reward.coins, items: reward.items, deco: reward.deco, skin: reward.skin });
    ups.push({ level: s.level, reward: reward.coins, items: reward.items, deco: reward.deco, skin: reward.skin, unlocks: levelUnlocks(s.level) });
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
export function seedStatus(s, id, now = Date.now()) {
  const d = C.SEEDS[id];
  if (!d) return { available: false, reason: ERR.unknown };
  if (d.exclusive) return s.unlocked.includes(id) ? { available: true } : { available: false, reason: 'Belohnung aus dem Album', album: true };
  if (d.event) {
    const ev = activeEvent(now), n = seedCount(s, id);
    if (s.level < d.level) return { available: false, reason: `Ab Level ${d.level}`, level: d.level };
    if (ev && ev.id === d.event) return { available: true, event: d.event, seeds: n };
    if (n > 0) return { available: true, event: d.event, useSeed: true, seeds: n };
    const name = C.EVENTS.find((e) => e.id === d.event)?.name || 'Event';
    return { available: false, reason: `Nur beim Event „${name}“ – oder mit Samen aus der Tauschbörse`, event: d.event, trade: true };
  }
  if (d.bred) return s.bred.includes(id) ? { available: true } : { available: false, reason: 'Im Gewächshaus züchten', breed: true };
  if (d.rare) {
    if (s.rareUnlocked.includes(id)) return { available: true };
    if (s.level < d.level) return { available: false, reason: `Ab Level ${d.level}`, level: d.level };
    return { available: false, reason: `Im Shop freischalten (${d.unlockCoins} Münzen)`, shop: true };
  }
  if (s.level < d.level) return { available: false, reason: `Ab Level ${d.level}`, level: d.level };
  return { available: true };
}

// ---------- Samen von Event-Blumen ----------
export const seedCount = (s, k) => (s.seeds && s.seeds[k]) || 0;
export function addSeeds(s, seeds = {}) {
  for (const [k, n] of Object.entries(seeds || {})) if (C.SEEDS[k]?.event && n > 0) s.seeds[k] = (s.seeds[k] || 0) + Math.floor(n);
}
export function takeSeeds(s, k, n) {
  if (seedCount(s, k) < n) return false;
  s.seeds[k] -= n; if (s.seeds[k] <= 0) delete s.seeds[k];
  return true;
}
export const seedList = (s) => C.EVENT_SEEDS.filter((k) => seedCount(s, k) > 0).map((k) => ({ id: k, n: seedCount(s, k) }));

// Tauschbörse: lokale Prüfungen (der Server vermittelt, die Samen wandern über Inbox-Einträge)
export function tradeOfferCheck(s, give, giveN, want, wantN, openCount = 0) {
  if (!C.SEEDS[give]?.event || !C.SEEDS[want]?.event) return err('invalid', { message: 'Nur Samen von Event-Blumen lassen sich tauschen.' });
  if (give === want) return err('invalid', { message: 'Gleiche Blume gegen gleiche Blume? Das lohnt sich nicht. 🙂' });
  giveN = Math.floor(Number(giveN) || 0); wantN = Math.floor(Number(wantN) || 0);
  if (giveN < 1 || wantN < 1 || giveN > C.TRADE.maxN || wantN > C.TRADE.maxN) return err('invalid', { message: `1 bis ${C.TRADE.maxN} Samen je Seite.` });
  if (seedCount(s, give) < giveN) return err('invalid', { message: `Du hast nur ${seedCount(s, give)} Samen von ${C.SEEDS[give].name.replace(/­/g, '')}.` });
  if (openCount >= C.TRADE.maxOpen) return err('invalid', { message: `Höchstens ${C.TRADE.maxOpen} offene Angebote gleichzeitig.` });
  return { ok: true, give, giveN, want, wantN };
}
// Angebot wurde vom Server angenommen → eigene Samen sind reserviert (abgezogen)
export function tradeReserve(s, give, giveN) { return takeSeeds(s, give, giveN); }
// Fremdes Angebot annehmen: eigene Samen hergeben, fremde erhalten
export function tradeAcceptCheck(s, offer) {
  if (!offer || !C.SEEDS[offer.want]?.event || !C.SEEDS[offer.give]?.event) return err('invalid');
  if (seedCount(s, offer.want) < offer.wantN) return err('invalid', { message: `Dir fehlen ${offer.wantN - seedCount(s, offer.want)} Samen von ${C.SEEDS[offer.want].name.replace(/­/g, '')}.` });
  return { ok: true };
}
export function tradeComplete(s, offer, asOwner) {
  // asOwner: ich habe das Angebot erstellt und bekomme jetzt die gewünschten Samen; sonst: ich habe angenommen
  if (asOwner) addSeeds(s, { [offer.want]: offer.wantN });
  else { takeSeeds(s, offer.want, offer.wantN); addSeeds(s, { [offer.give]: offer.giveN }); }
  s.stats.trades = (s.stats.trades || 0) + 1;
}

// ---------- Album: Erfolge & Titel ----------
export function achievementList(s) {
  return C.ACHIEVEMENTS.map((a) => { const [have, need] = a.progress(s); return { ...a, have: Math.min(have, need), need, done: s.achievements.includes(a.id), ready: have >= need }; });
}
// Neue Erfolge prüfen und sofort belohnen; liefert die frisch erreichten
export function checkAchievements(s) {
  const out = [];
  for (const a of C.ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) continue;
    const [have, need] = a.progress(s);
    if (have < need) continue;
    s.achievements.push(a.id);
    const levelUps = grant(s, a.reward);
    out.push({ ...a, levelUps });
  }
  return out;
}
export function setTitle(s, id) {
  if (id && (!C.TITLES[id] || !s.titles.includes(id))) return err('invalid');
  s.title = id || '';
  return { ok: true };
}

// ---------- Wochenende & Events ----------
export const isWeekend = (now) => { const d = new Date(now).getDay(); return d === 0 || d === 6; };

// Ostersonntag (Gauß) und Muttertag (zweiter Sonntag im Mai) – für bewegliche Feiertage
export function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
export function mothersDay(y) { const d = new Date(y, 4, 1); return new Date(y, 4, 1 + ((7 - d.getDay()) % 7) + 7); }
const DAY = 86_400_000;
function eventRange(ev, year) {
  if (ev.anchor) {
    // beweglich: Tage relativ zu einem Stichtag
    const base = (ev.anchor === 'easter' ? easterSunday(year) : mothersDay(year)).getTime();
    const s0 = new Date(base + ev.from * DAY), e0 = new Date(base + ev.to * DAY);
    return { start: new Date(s0.getFullYear(), s0.getMonth(), s0.getDate()).getTime(), end: new Date(e0.getFullYear(), e0.getMonth(), e0.getDate(), 23, 59, 59, 999).getTime() };
  }
  const [sm, sd] = ev.start.split('-').map(Number), [em, ed] = ev.end.split('-').map(Number);
  const wrap = em < sm || (em === sm && ed < sd) ? 1 : 0; // über den Jahreswechsel
  return { start: new Date(year, sm - 1, sd, 0, 0, 0).getTime(), end: new Date(year + wrap, em - 1, ed, 23, 59, 59, 999).getTime() };
}

export function activeEvent(now) {
  const y = new Date(now).getFullYear();
  for (const ev of C.EVENTS) for (const yy of [y, y - 1]) { const r = eventRange(ev, yy); if (now >= r.start && now <= r.end) return { ...ev, ...r, year: yy }; }
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
  const evSeed = it.seedPack ? C.EVENT_SEEDS.find((k) => C.SEEDS[k].event === ev.id) : null;
  if (it.seedPack && !evSeed) return err('invalid');
  s.event.tokens -= it.price;
  grant(s, { items: it.items, deco: it.deco, seeds: evSeed ? { [evSeed]: C.SEED_PACK.n } : null });
  return { ok: true, seeds: evSeed ? { [evSeed]: C.SEED_PACK.n } : null };
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
  s.stats.watered++; s.tasks.progress.water++; weekly(s, now, 'water');
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
    } else if (it.k === 'teamgift') {
      const coins = Math.max(0, Math.min(5000, Math.floor(Number(it.coins) || 0)));
      const items = {};
      for (const [k, n] of Object.entries(it.items || {})) if (C.ITEMS[k]) items[k] = Math.max(0, Math.min(50, Math.floor(Number(n) || 0)));
      if (coins) addCoins(s, coins);
      addItems(s, items);
      out.push({ k: 'teamgift', title: String(it.title || 'Geschenk').slice(0, 60), coins, items });
    } else if (it.k === 'seeds' && C.SEEDS[it.seed]?.event) {
      const n = Math.max(1, Math.min(C.TRADE.maxN, Math.floor(Number(it.n) || 1)));
      addSeeds(s, { [it.seed]: n });
      out.push({ k: 'seeds', name: name(it), seed: it.seed, n });
    } else if (it.k === 'tradeDone' && it.offer) {
      const o = it.offer;
      if (C.SEEDS[o.want]?.event) { tradeComplete(s, { want: o.want, wantN: Math.max(1, Math.min(C.TRADE.maxN, Math.floor(Number(o.wantN) || 1))) }, true); out.push({ k: 'tradeDone', name: name(it), offer: o }); }
    } else if (it.k === 'tradeBack' && it.offer) {
      const o = it.offer;
      if (C.SEEDS[o.give]?.event) { addSeeds(s, { [o.give]: Math.max(1, Math.min(C.TRADE.maxN, Math.floor(Number(o.giveN) || 1))) }); out.push({ k: 'tradeBack', offer: o, reason: it.reason || 'expired' }); }
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
  const base = { i, lvl: b.lvl, size: b.size || 1, sprinkler: b.sprinkler };
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
  const st = seedStatus(s, seedId, now);
  if (!st.available) return err('seedLocked', { message: `${d.name.replace(/­/g, '')}: ${st.reason}.` });
  if (d.nightOnly && timeOfDay(cyclePhase(s, now)) !== 'night') return err('invalid', { message: `${d.name.replace(/­/g, '')} lässt sich nur nachts pflanzen.` });
  if (d.dayOnly && timeOfDay(cyclePhase(s, now)) === 'night') return err('invalid', { message: `${d.name.replace(/­/g, '')} lässt sich nur tagsüber pflanzen.` });
  if (!spend(s, d.cost)) return noCoins(s, d.cost, d.name.replace(/­/g, ''));
  if (st.useSeed) takeSeeds(s, seedId, 1);
  const chance = (C.SHINY_CHANCE + C.BED_LEVELS[b.lvl - 1].shiny) * (isWeekend(now) ? C.WEEKEND_BONUS.shinyFactor : 1) * boost('shinyDay') + (s.pets?.butterfly === dayKey(now) ? C.BUTTERFLY_SHINY : 0);
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
  const reward = Math.round(d.reward * C.BED_LEVELS[b.lvl - 1].mult * C.BED_SIZES[(b.size || 1) - 1].mult * (shiny ? C.SHINY_MULTIPLIER : 1) * (compost ? C.COMPOST_BONUS : 1) * boost('doubleCoins'));
  const xp = Math.round(d.xp * (shiny ? 2 : 1) * C.BED_SIZES[(b.size || 1) - 1].mult);
  b.seed = null; b.plantedAt = 0; b.dur = 0; b.shiny = false; b.drinks = 0; b.compost = false;
  addCoins(s, reward);
  const entry = (s.collection[seed] ||= { count: 0, shiny: 0 });
  entry.count++; if (shiny) { entry.shiny++; s.stats.shiny++; track(s, 'shiny', seed); }
  s.stats.harvested++; s.tasks.progress.harvest++; weekly(s, now, 'harvest');
  track(s, 'harvest', seed);
  let tokens = 0;
  const ev = ensureEvent(s, now);
  if (ev) { tokens = eventTokensFor(reward) * (d.event === ev.id ? C.EVENT_TOKEN_MULT : 1); s.event.tokens += tokens; s.event.total += tokens; }
  // Event-Blume während ihres Events: jede 3. Ernte bringt einen Samen (Funkelblüte: zwei)
  let seedsWon = 0;
  if (d.event && ev && ev.id === d.event && entry.count % C.SEED_EVERY === 0) { seedsWon = shiny ? 2 : 1; addSeeds(s, { [seed]: seedsWon }); }
  if (s.tutorial < 2) s.tutorial = 2;
  const basket = toBasket(s, seed, shiny);
  const levelUps = addXp(s, xp);
  return { ok: true, seed, reward, xp, shiny, compost, tokens, basket, levelUps, seedsWon };
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

// Beet vergrößern: braucht freien Platz rundherum
export function growBed(s, i) {
  const b = s.beds[i];
  if (!b || b.locked) return err('locked');
  const cur = b.size || 1;
  if (cur >= C.BED_SIZES.length) return err('maxLevel', { message: 'Dieses Beet hat schon die größte Größe.' });
  const next = C.BED_SIZES[cur];
  if (s.level < next.level) return needLevel(next.level, `Die Beetgröße „${next.name}“`);
  const p = s.layout.beds[i];
  const test = canPlace(s, { type: 'bed', i, size: cur + 1 }, p[0], p[1], p[2]);
  if (!test.ok) return err('noSpace', { message: 'Dafür ist rund um das Beet nicht genug Platz. Verschiebe es im Gestalten-Modus oder räume Deko weg.' });
  if (!spend(s, next.cost)) return noCoins(s, next.cost, `die Beetgröße „${next.name}“`);
  b.size = cur + 1;
  return { ok: true, name: next.name, size: b.size, plants: next.plants };
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

// Bedingungen der Zucht prüfen. ctx: { time: 'morning'|'day'|'evening'|'night', full: Vollmond? }
// (true/false wie früher = Nacht/Tag)
const breedCtx = (t) => (t && typeof t === 'object' ? t : { time: t === true ? 'night' : typeof t === 'string' ? t : 'day', full: false });
export function whenOk(r, ctx) {
  const c = breedCtx(ctx);
  return (!r.when || r.when === c.time) && (!r.moon || !!c.full);
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
  const ctx = breedCtx(night);
  if (r.when && r.when !== ctx.time) {
    const tip = r.when === 'night' ? 'Warte auf die Nacht oder stelle in den Einstellungen „Immer Nacht“ ein.' : 'Stelle in den Einstellungen die Tageszeit auf „Echtzeit“ oder „Schneller Zyklus“ und warte auf den passenden Moment.';
    return err('night', { message: `Diese Kreuzung gelingt ${C.WHEN_LABEL[r.when]}. ${tip}`, recipe: r });
  }
  if (r.moon && !ctx.full) return err('moon', { message: `Diese Kreuzung gelingt nur bei Vollmond. Nächster Vollmond: ${new Date(nextFullMoon(ctx.now || Date.now())).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}.`, recipe: r });
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
  s.stats.bred++; weekly(s, now, 'bred');
  const levelUps = addXp(s, 20 + d.xp);
  return { ok: true, seed: info.result, xp: 20 + d.xp, levelUps };
}

// ---------- Story ----------
function currentQuest(s) {
  const ch = C.STORY[s.story.ch];
  return ch ? ch.quests[s.story.q] : null;
}

function track(s, type, id, amount = 1) {
  if (amount === null) amount = 1;
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
    case 'sold': case 'orders': case 'special': case 'helped': case 'gifted': case 'liked': return [Math.min(goal.n, s.story.count), goal.n];
    case 'rep': return [Math.min(goal.n, repLevel(s)), goal.n];
    case 'friends': return [Math.min(goal.n, s.stats.friends || 0), goal.n];
    case 'petted': return [s.pets?.ever?.includes(goal.id) ? 1 : 0, 1];
    case 'petDays': return [Math.min(goal.n, s.stats.petDays || 0), goal.n];
    case 'lights': return [Math.min(goal.n, s.decor.filter((d) => !d.stored && C.LIGHTS[d.id]).length), goal.n];
    case 'land': return [Math.min(goal.n, s.land), goal.n];
    case 'collected': return [Math.min(goal.n, Object.values(s.collection).filter((e) => e.count > 0).length), goal.n];
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
  const [w, d] = ref.type === 'bed' ? C.bedSize(ref.size || s.beds[ref.i]?.size || 1) : ref.type === 'gh' ? C.GH_SIZE : C.DECO[ref.id ?? s.decor[ref.k]?.id]?.size || [1, 1];
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
  s.layout.beds.forEach((p, i) => { if (bedVisible(s, i) && !same(skip, { type: 'bed', i })) out.push({ r: RECT(p[0], p[1], footprint(s, { type: 'bed', i }, p[2])), what: 'bed' }); });
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
  ensureWeekly(s, now);
  if (!s.weekly.days.includes(k)) { s.weekly.days.push(k); s.weekly.progress.days = s.weekly.days.length; }
}

// ---------- Wochenziele (Montag bis Sonntag) ----------
export function weekKey(now) {
  const d = new Date(now); const day = (d.getDay() + 6) % 7; // Montag = 0
  d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day);
  return dayKey(d.getTime());
}
export function ensureWeekly(s, now) {
  const w = weekKey(now);
  if (!s.weekly || s.weekly.week !== w) s.weekly = { week: w, progress: {}, claimed: [], days: [], bonus: false };
}
function weekly(s, now, id, n = 1) { ensureWeekly(s, now); s.weekly.progress[id] = (s.weekly.progress[id] || 0) + n; }
export function weeklyList(s, now) {
  ensureWeekly(s, now);
  const list = C.WEEKLY_TASKS.map((t) => ({ ...t, have: Math.min(t.goal, s.weekly.progress[t.id] || 0), done: (s.weekly.progress[t.id] || 0) >= t.goal, claimed: s.weekly.claimed.includes(t.id) }));
  const end = new Date(s.weekly.week); end.setDate(end.getDate() + 7);
  return { tasks: list, allDone: list.every((t) => t.claimed), bonus: s.weekly.bonus, left: Math.max(0, end.getTime() - now) };
}
export function claimWeekly(s, id, now) {
  const { tasks } = weeklyList(s, now);
  if (id === 'bonus') {
    if (s.weekly.bonus) return err('claimed');
    if (!tasks.every((t) => t.claimed)) return err('notDone', { message: 'Erst alle Wochenziele abholen.' });
    s.weekly.bonus = true;
    const levelUps = grant(s, C.WEEKLY_BONUS);
    return { ok: true, reward: C.WEEKLY_BONUS, levelUps };
  }
  const t = tasks.find((x) => x.id === id);
  if (!t) return err('invalid');
  if (t.claimed) return err('claimed');
  if (!t.done) return err('notDone');
  s.weekly.claimed.push(id);
  const levelUps = grant(s, t.reward);
  return { ok: true, reward: t.reward, levelUps };
}
export const claimableWeekly = (s, now) => { const w = weeklyList(s, now); return w.tasks.filter((t) => t.done && !t.claimed).length + (w.allDone && !w.bonus ? 1 : 0); };

// Soziales fürs Wochenziel und die Story (vom Browser gemeldet)
export function socialEvent(s, kind, now, n = 1) {
  if (kind === 'helped' || kind === 'gifted') weekly(s, now, 'social', n);
  if (['helped', 'gifted', 'liked'].includes(kind)) { s.stats[kind] = (s.stats[kind] || 0) + n; track(s, kind, null, n); }
  if (kind === 'friends') s.stats.friends = Math.max(s.stats.friends || 0, n);
}

// ---------- Tiere streicheln ----------
export function pet(s, id, now, rand = Math.random) {
  const a = C.ANIMAL_GIFTS[id];
  if (!a) return err('invalid');
  const day = dayKey(now);
  if (!s.pets || s.pets.day !== day) s.pets = { ...(s.pets || {}), day, done: [] };
  if (!s.pets.ever) s.pets.ever = [];
  if (!s.pets.ever.includes(id)) s.pets.ever.push(id);
  track(s, 'petted', id);
  if (s.pets.done.includes(id)) return { ok: true, again: true };
  s.pets.done.push(id);
  if (s.pets.done.length === 1) s.stats.petDays = (s.stats.petDays || 0) + 1;
  const gift = a.gifts[Math.floor(rand() * a.gifts.length)];
  let levelUps = [];
  if (gift.shinyBoost) s.pets.butterfly = day;
  else levelUps = grant(s, gift);
  return { ok: true, gift, levelUps };
}

// ---------- Überraschungen ----------
export function rollSurprise(s, now, time, rand = Math.random) {
  const day = dayKey(now);
  if (!s.surprise || s.surprise.day !== day) s.surprise = { day, n: 0 };
  if (s.surprise.n >= 1) return null;
  const list = C.SURPRISES.filter((x) => (!x.night || time === 'night') && (!x.day || time !== 'night'));
  for (const x of list) if (rand() < x.chance) { s.surprise.n++; const levelUps = grant(s, x.reward); return { ...x, levelUps }; }
  return null;
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
  cycle: (v) => ['real', 'day', 'night'].includes(v), // 'day'/'night' nur zum Ansehen (Vorschau), Echtzeit ist die Regel
  quality: (v) => ['auto', 'high', 'medium', 'low'].includes(v),
  music: (v) => typeof v === 'boolean',
  sound: (v) => typeof v === 'boolean',
  musicVol: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
  soundVol: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
};


export function setSetting(s, key, value, now) {
  if (!SETTING_RULES[key] || !SETTING_RULES[key](value)) return err('invalid');
  if (key === 'cycle') s.settings.cycleEpoch = now;
  s.settings[key] = value;
  return { ok: true };
}

export function cyclePhase(s, now) {
  const st = s.settings;
  // Vorschau „Immer Tag/Nacht“ läuft nach 10 Minuten automatisch aus – Tag und Nacht folgen der echten Zeit
  if ((st.cycle === 'day' || st.cycle === 'night') && now - (st.cycleEpoch || 0) < PREVIEW_MS) return st.cycle === 'day' ? 0.3 : 0.82;
  return realPhase(now);
}
export const PREVIEW_MS = 10 * 60_000;
export const previewLeft = (s, now) => (s.settings.cycle === 'real' ? 0 : Math.max(0, PREVIEW_MS - (now - (s.settings.cycleEpoch || 0))));

// ---------- Echte Tageszeit: Sonnenstand und Mond ----------
const RAD = Math.PI / 180, DAY_MS = 86_400_000, J1970 = 2440587.5, J2000 = 2451545;
const toJ = (ms) => ms / DAY_MS + J1970, fromJ = (j) => (j - J1970) * DAY_MS;

// Längengrad grob aus der Zeitzone (Standardzeit, ohne Sommerzeit): Berlin ≈ 15° Ost
function guessLon(now) {
  const y = new Date(now).getFullYear();
  const std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
  return -std / 4;
}

// Sonnenaufgang, -untergang und bürgerliche Dämmerung (Sonne 6° unter dem Horizont) für den Tag von now
export function sunTimes(now, lat = C.SUN_LAT, lon = guessLon(now)) {
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  const n = Math.round(toJ(d.getTime()) - J2000 - 0.0009 + lon / 360);
  const Js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360;
  const Cc = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const L = (M + Cc + 180 + 102.9372) % 360;
  const Jt = J2000 + Js + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
  const dec = Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD));
  const w = (h) => { const c = (Math.sin(h * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec)); return Math.acos(Math.max(-1, Math.min(1, c))) / RAD; };
  const w0 = w(-0.833), w6 = w(-6);
  return { dawn: fromJ(Jt - w6 / 360), rise: fromJ(Jt - w0 / 360), noon: fromJ(Jt), set: fromJ(Jt + w0 / 360), dusk: fromJ(Jt + w6 / 360) };
}

// Phase des Spiel-Himmels aus der echten Uhrzeit: 0 = Sonnenaufgang, 0.35 = Mittag, 0.66 = Sonnenuntergang,
// 0.73 = Ende der Abenddämmerung, 0.96 = Beginn der Morgendämmerung
export function realPhase(now) {
  const t = sunTimes(now);
  const lerpP = (x, a, b, pa, pb) => pa + (pb - pa) * Math.max(0, Math.min(1, (x - a) / Math.max(1, b - a)));
  if (now >= t.rise && now < t.noon) return lerpP(now, t.rise, t.noon, 0, 0.35);
  if (now >= t.noon && now < t.set) return lerpP(now, t.noon, t.set, 0.35, 0.66);
  if (now >= t.set && now < t.dusk) return lerpP(now, t.set, t.dusk, 0.66, 0.73);
  if (now >= t.dawn && now < t.rise) return lerpP(now, t.dawn, t.rise, 0.96, 1) % 1;
  // Nacht: vom Ende der Abenddämmerung bis zur Morgendämmerung
  const dusk = now >= t.dusk ? t.dusk : sunTimes(now - DAY_MS).dusk;
  const dawn = now >= t.dusk ? sunTimes(now + DAY_MS).dawn : t.dawn;
  return lerpP(now, dusk, dawn, 0.73, 0.96);
}

// Tageszeit-Name wie am Himmel (Morgen, Tag, Abend, Nacht)
export function timeOfDay(phase) {
  if (phase < 0.15 || phase >= 0.95) return 'morning';
  if (phase < 0.55) return 'day';
  if (phase < 0.7) return 'evening';
  return 'night';
}

// Mondphase 0 = Neumond, 0.5 = Vollmond
const SYNODIC = 29.530588853, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
export const moonPhase = (now) => ((((now - NEW_MOON) / DAY_MS / SYNODIC) % 1) + 1) % 1;
export const isFullMoon = (now) => Math.abs(moonPhase(now) - 0.5) < 0.055;
export function nextFullMoon(now) {
  if (isFullMoon(now)) return now;
  let p = moonPhase(now);
  const days = ((0.5 - 0.055 - p + 1) % 1) * SYNODIC;
  return now + days * DAY_MS;
}

// ---------- Blumenhändler ----------
// Einfacher Zufall mit festem Startwert: alle Spieler sehen am selben Tag dieselben Besonderheiten
function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const pick = (R, list) => list[Math.floor(R() * list.length)];

export const traderDay = (now) => C.TRADER_DAYS[new Date(now).getDay()];
export const repLevel = (s) => { let l = 0; C.TRADER.rep.forEach((t, i) => { if ((s.trader?.rep || 0) >= t) l = i; }); return l; };
export const basketCap = (s) => C.TRADER.basket[repLevel(s)];
export const basketCount = (s) => Object.values(s.basket || {}).reduce((a, b) => a + b, 0) + Object.values(s.basketShiny || {}).reduce((a, b) => a + b, 0);

// Sorten, die der Spieler gerade anbauen kann
function growable(s) {
  return C.SEED_ORDER.filter((k) => { const d = C.SEEDS[k]; if (d.event) return false; return d.bred ? s.bred.includes(k) : d.level <= s.level && (!d.rare || s.rareUnlocked.includes(k)); });
}

// Tagesblume: wird heute doppelt bezahlt
export function dayFlower(s, now) {
  const R = seeded('flower' + dayKey(now));
  const list = growable(s).filter((k) => !C.SEEDS[k].bred);
  return list.length ? pick(R, list) : 'daisy';
}

// Neue Bestellungen für den Tag (abhängig von dem, was der Spieler anbauen kann)
function makeOrders(s, now) {
  const day = dayKey(now), R = seeded('orders' + day + (s.level >= 10 ? 'b' : s.level >= 5 ? 'm' : 'a'));
  const td = traderDay(now);
  const list = growable(s);
  const base = list.filter((k) => !C.SEEDS[k].bred);
  const n = C.TRADER.orders + (td.extraOrder || 0) + (repLevel(s) >= 3 ? 1 : 0);
  const orders = [];
  for (let i = 0; i < n; i++) {
    const kinds = Math.min(base.length, 1 + Math.floor(R() * Math.min(3, 1 + s.level / 4)));
    const want = {};
    const pool = [...base];
    for (let k = 0; k < kinds; k++) {
      const sd = pool.splice(Math.floor(R() * pool.length), 1)[0];
      if (!sd) break;
      const cheap = C.SEEDS[sd].growMs <= 2 * 60_000;
      want[sd] = (cheap ? 3 : 1) + Math.floor(R() * (cheap ? 4 : 3));
    }
    const value = Object.entries(want).reduce((a, [k, q]) => a + C.SEEDS[k].reward * q, 0);
    const xp = Math.round(Object.entries(want).reduce((a, [k, q]) => a + C.SEEDS[k].xp * q, 0) * 0.5) + 5;
    const bonus = R() < 0.4 ? { [pick(R, ['fert', 'fert', 'rain', 'compost', 'turbo'])]: 1 } : null;
    orders.push({ id: `${day}-${i}`, want, coins: Math.round(value * C.TRADER.orderRate), xp, items: bonus, done: false });
  }
  // Sonderwunsch: eine Funkelblüte oder eine Züchtung
  const bred = list.filter((k) => C.SEEDS[k].bred);
  const shinyOk = Object.keys(s.collection).some((k) => s.collection[k]?.shiny);
  if (bred.length || shinyOk) {
    const useBred = bred.length && (!shinyOk || R() < 0.5);
    const seed = useBred ? pick(R, bred) : pick(R, base);
    const mult = (useBred ? 1.6 : 1.2) * (td.specialMult || 1);
    orders.push({ id: `${day}-x`, special: useBred ? 'bred' : 'shiny', want: { [seed]: 1 }, coins: Math.round(C.SEEDS[seed].reward * (useBred ? 1 : C.SHINY_MULTIPLIER) * mult), xp: 15 + C.SEEDS[seed].xp, items: { [useBred ? 'pollen' : 'lucky']: 1 }, done: false });
  }
  return orders;
}

export function ensureTrader(s, now) {
  const day = dayKey(now);
  if (!s.trader || typeof s.trader !== 'object') s.trader = { day: '', orders: [], rep: 0, gift: '', offer: '' };
  if (s.trader.day !== day || (!s.trader.orders.length && s.level >= C.TRADER.level)) Object.assign(s.trader, { day, orders: s.level >= C.TRADER.level ? makeOrders(s, now) : [], gift: s.trader.gift === day ? day : '', offer: '' });
  return s.trader;
}

// Verkaufspreis einer Blume aus dem Korb
export function sellPrice(s, seed, shiny, now) {
  const d = C.SEEDS[seed]; if (!d) return 0;
  const td = traderDay(now);
  let p = d.reward * C.TRADER.sellRate * (td.sell || 1) * (1 + C.TRADER.repBonus[repLevel(s)]) * boost('traderSale');
  if (seed === dayFlower(s, now)) p *= C.TRADER.dayFlowerMult;
  if (shiny) p *= td.shinySell || C.TRADER.shinySell;
  return Math.max(1, Math.round(p));
}

// Tagesangebot: ein Gegenstand oder eine Deko günstiger
export function traderOffer(s, now) {
  if (OFFER && OFFER.day === dayKey(now) && (OFFER.kind === 'deco' ? C.DECO[OFFER.id] : C.ITEMS[OFFER.id])) return { kind: OFFER.kind, id: OFFER.id, n: OFFER.n || 1, price: OFFER.price, was: OFFER.was, off: OFFER.off, admin: true };
  const R = seeded('offer' + dayKey(now));
  const deco = C.DECO_ORDER.filter((k) => (C.DECO[k].level || 1) <= Math.max(s.level, 1) && !C.DECO[k].event);
  const useDeco = R() < 0.5 && deco.length;
  const td = traderDay(now);
  if (useDeco) {
    const id = pick(R, deco), d = C.DECO[id];
    const off = Math.max(C.TRADER.offerDiscount, td.decoDiscount || 0);
    return { kind: 'deco', id, price: Math.round(d.price * (1 - off)), was: d.price, off };
  }
  const id = pick(R, C.TRADER_ITEMS.filter((k) => C.ITEMS[k].level <= Math.max(s.level, 1)));
  const n = id === 'pollen' || id === 'turbo' ? 2 : 3;
  const was = C.ITEMS[id].price * n;
  return { kind: 'item', id, n, price: Math.round(was * (1 - C.TRADER.offerDiscount)), was, off: C.TRADER.offerDiscount };
}

// Händler-Preise für Bedarf (Dienstag günstiger)
export function traderItemPrice(id, now) {
  const td = traderDay(now);
  const it = C.ITEMS[id];
  return Math.round(it.price * (td.items?.includes(id) ? 1 - td.itemDiscount : 1));
}

export function traderInfo(s, now) {
  const t = ensureTrader(s, now);
  const td = traderDay(now), lvl = repLevel(s);
  return {
    open: s.level >= C.TRADER.level, day: td, flower: dayFlower(s, now), offer: traderOffer(s, now), offerBought: t.offer === t.day,
    giftReady: !!td.freeGift && t.gift !== t.day,
    orders: t.orders.map((o, i) => ({ ...o, i, can: !o.done && canDeliver(s, o) })),
    basket: basketCount(s), cap: basketCap(s), rep: t.rep, repLvl: lvl, nextRep: C.TRADER.rep[lvl + 1] ?? null,
  };
}

function canDeliver(s, o) {
  return Object.entries(o.want).every(([k, q]) => (o.special === 'shiny' ? s.basketShiny[k] || 0 : (s.basket[k] || 0) + (s.basketShiny[k] || 0)) >= q);
}

// Ernte in den Korb legen (wenn Platz ist)
function toBasket(s, seed, shiny) {
  if (s.level < C.TRADER.level || basketCount(s) >= basketCap(s)) return false;
  const box = shiny ? s.basketShiny : s.basket;
  box[seed] = (box[seed] || 0) + 1;
  return true;
}

export function deliverOrder(s, i, now) {
  const t = ensureTrader(s, now);
  const o = t.orders[i];
  if (!o) return err('invalid');
  if (o.done) return err('claimed', { message: 'Diese Bestellung hast du schon geliefert.' });
  if (!canDeliver(s, o)) return err('invalid', { message: 'Dafür fehlen noch Blumen in deinem Korb.' });
  for (const [k, q] of Object.entries(o.want)) {
    let left = q;
    if (o.special !== 'shiny') { const n = Math.min(left, s.basket[k] || 0); s.basket[k] = (s.basket[k] || 0) - n; left -= n; }
    if (left) s.basketShiny[k] -= left;
    if (!s.basket[k]) delete s.basket[k];
    if (!s.basketShiny[k]) delete s.basketShiny[k];
  }
  o.done = true;
  const lvl0 = repLevel(s);
  t.rep += (o.special ? 2 : 1) * (traderDay(now).repMult || 1);
  const coins = Math.round(o.coins * (1 + C.TRADER.repBonus[lvl0]));
  addCoins(s, coins);
  if (o.items) addItems(s, o.items);
  s.stats.orders = (s.stats.orders || 0) + 1; weekly(s, now, 'orders');
  if (o.special) { s.stats.special = (s.stats.special || 0) + 1; track(s, 'special'); }
  track(s, 'orders');
  const levelUps = addXp(s, o.xp);
  return { ok: true, coins, xp: o.xp, items: o.items, repUp: repLevel(s) > lvl0 ? repLevel(s) : 0, levelUps };
}

export function sellFlowers(s, seed, shiny, n, now) {
  const box = shiny ? s.basketShiny : s.basket;
  const have = box[seed] || 0;
  n = Math.min(have, Math.max(1, Math.floor(n) || 1));
  if (!have) return err('invalid', { message: 'Davon ist nichts im Korb.' });
  const coins = sellPrice(s, seed, shiny, now) * n;
  box[seed] = have - n; if (!box[seed]) delete box[seed];
  addCoins(s, coins);
  s.stats.sold = (s.stats.sold || 0) + n; track(s, 'sold', null, n);
  return { ok: true, coins, n };
}

export function sellAll(s, now) {
  let coins = 0, n = 0;
  const day = dayFlower(s, now);
  // Was für offene Bestellungen gebraucht wird, bleibt im Korb
  const keep = {};
  for (const o of ensureTrader(s, now).orders) if (!o.done && !o.special) for (const [k, q] of Object.entries(o.want)) keep[k] = (keep[k] || 0) + q;
  for (const [k, q] of Object.entries({ ...s.basket })) {
    const sell = Math.max(0, q - (keep[k] || 0));
    if (sell) { const r = sellFlowers(s, k, false, sell, now); coins += r.coins; n += r.n; }
  }
  void day;
  if (!n) return err('invalid', { message: 'Im Korb ist nichts zu verkaufen (Blumen für offene Bestellungen bleiben drin).' });
  return { ok: true, coins, n };
}

export function buyTraderOffer(s, now) {
  const t = ensureTrader(s, now), o = traderOffer(s, now);
  if (t.offer === t.day) return err('claimed', { message: 'Das Tagesangebot hast du heute schon gekauft.' });
  if (!spend(s, o.price)) return noCoins(s, o.price, 'das Angebot');
  t.offer = t.day;
  if (o.kind === 'deco') { if (!s.deco.includes(o.id)) s.deco.push(o.id); const k = addDecor(s, o.id); return { ok: true, ...o, k }; }
  addItems(s, { [o.id]: o.n });
  return { ok: true, ...o };
}

export function buyFromTrader(s, id, now) {
  const it = C.ITEMS[id];
  if (!it || !C.TRADER_ITEMS.includes(id)) return err('invalid');
  if (s.level < it.level) return needLevel(it.level, it.name);
  const price = traderItemPrice(id, now);
  if (!spend(s, price)) return noCoins(s, price, it.name);
  s.items[id]++;
  return { ok: true, price };
}

export function claimTraderGift(s, now) {
  const t = ensureTrader(s, now);
  if (!traderDay(now).freeGift) return err('invalid', { message: 'Geschenke gibt es samstags.' });
  if (t.gift === t.day) return err('claimed', { message: 'Das Geschenk von heute hast du schon.' });
  t.gift = t.day;
  const R = seeded('gift' + t.day);
  const items = pick(R, [{ fert: 3 }, { rain: 2 }, { compost: 2 }, { fert: 2, rain: 1 }]);
  addItems(s, items);
  return { ok: true, items };
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
    s.settings.rt = false;
    return { state: repair(s, now), migrated: true };
  }
  if (raw.v === 2) {
    // Version 2 -> 3: goldene Blüten heißen jetzt Funkelblüten, 6 neue Beete, neue Systeme
    const s = { ...base, ...raw };
    s.beds = Array.isArray(raw.beds) ? raw.beds.map((b) => ({ ...newBed(0), ...b, shiny: !!(b && b.golden), lvl: 1, sprinkler: false })) : base.beds;
    s.collection = {};
    if (raw.collection && typeof raw.collection === 'object') for (const [k, e] of Object.entries(raw.collection)) s.collection[k] = typeof e === 'number' ? e : { count: e?.count, shiny: e?.golden ?? e?.shiny };
    s.stats = { ...base.stats, ...(raw.stats || {}), shiny: raw.stats?.golden ?? 0 };
    s.settings = { ...base.settings, rt: false, ...(raw.settings || {}) };
    s.activeSkin = { ...base.activeSkin, ...(raw.activeSkin || {}) };
    // Fortschritt in der Story grob übernehmen: erfahrene Spieler starten nicht bei null
    s.story = { ...base.story };
    s.decor = undefined; s.layout = undefined; s.land = 0;
    s.v = SAVE_VERSION;
    return { state: repair(s, now), migrated: true };
  }
  if (raw.v === 3 || raw.v === 4 || raw.v === SAVE_VERSION) {
    const s = { ...base, ...raw, settings: { ...base.settings, rt: false, ...(raw.settings || {}) }, stats: { ...base.stats, ...(raw.stats || {}) }, activeSkin: { ...base.activeSkin, ...(raw.activeSkin || {}) } };
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
      size: ok ? Math.min(C.BED_SIZES.length, Math.max(1, num(b.size, 1, 1))) : 1,
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
  // Händler & Korb
  const tr = obj(s.trader) ? s.trader : {};
  const okOrder = (o) => obj(o) && obj(o.want) && Object.keys(o.want).every((k) => C.SEEDS[k]) && Number.isFinite(o.coins);
  s.trader = { day: typeof tr.day === 'string' ? tr.day : '', orders: Array.isArray(tr.orders) ? tr.orders.filter(okOrder).slice(0, 8).map((o) => ({ id: String(o.id), want: Object.fromEntries(Object.entries(o.want).map(([k, q]) => [k, num(Number(q), 1, 1)])), coins: num(o.coins, 0), xp: num(Number(o.xp), 0), items: obj(o.items) ? Object.fromEntries(Object.entries(o.items).filter(([k]) => C.ITEMS[k])) : null, special: o.special === 'shiny' || o.special === 'bred' ? o.special : undefined, done: !!o.done })) : [], rep: num(Number(tr.rep), 0), gift: typeof tr.gift === 'string' ? tr.gift : '', offer: typeof tr.offer === 'string' ? tr.offer : '' };
  for (const key of ['basket', 'basketShiny']) {
    const b0 = obj(s[key]) ? s[key] : {};
    s[key] = {};
    for (const [k, n] of Object.entries(b0)) if (C.SEEDS[k] && Number.isFinite(n) && n > 0) s[key][k] = Math.min(200, Math.floor(n));
  }
  const wk = obj(s.weekly) ? s.weekly : {};
  s.weekly = { week: typeof wk.week === 'string' ? wk.week : '', progress: obj(wk.progress) ? Object.fromEntries(Object.entries(wk.progress).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, Math.max(0, Math.floor(v))])) : {}, claimed: Array.isArray(wk.claimed) ? wk.claimed.filter((x) => typeof x === 'string') : [], days: Array.isArray(wk.days) ? wk.days.filter((x) => typeof x === 'string').slice(0, 7) : [], bonus: !!wk.bonus };
  const pt = obj(s.pets) ? s.pets : {};
  s.pets = { day: typeof pt.day === 'string' ? pt.day : '', done: Array.isArray(pt.done) ? pt.done.filter((x) => C.ANIMAL_GIFTS[x]) : [], butterfly: typeof pt.butterfly === 'string' ? pt.butterfly : '', ever: Array.isArray(pt.ever) ? pt.ever.filter((x) => C.ANIMAL_GIFTS[x]) : [] };
  const sp = obj(s.surprise) ? s.surprise : {};
  s.surprise = { day: typeof sp.day === 'string' ? sp.day : '', n: num(Number(sp.n), 0) };
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
  s.tutorialDone = num(s.tutorialDone, 0);
  const seeds = {}; for (const [k, n] of Object.entries(obj(s.seeds) ? s.seeds : {})) if (C.SEEDS[k]?.event && num(Number(n), 0) > 0) seeds[k] = Math.floor(num(Number(n), 0)); s.seeds = seeds;
  s.achievements = Array.isArray(s.achievements) ? s.achievements.filter((k) => C.ACHIEVEMENTS.some((a) => a.id === k)) : [];
  s.titles = [...new Set((Array.isArray(s.titles) ? s.titles : []).filter((k) => C.TITLES[k]))];
  s.title = C.TITLES[s.title] && s.titles.includes(s.title) ? s.title : '';
  s.unlocked = Array.isArray(s.unlocked) ? s.unlocked.filter((k) => C.SEEDS[k]?.exclusive) : [];
  s.stats.trades = num(Number(s.stats.trades), 0);
  if (!obj(s.settings)) s.settings = { ...base.settings };
  for (const [k, rule] of Object.entries(SETTING_RULES)) if (!rule(s.settings[k])) s.settings[k] = base.settings[k];
  // Einmalig: automatischer Zyklus wird zu Echtzeit (Tag & Nacht wie draußen)
  s.settings.rt = true;
  if (!['real', 'day', 'night'].includes(s.settings.cycle)) s.settings.cycle = 'real';
  if (s.settings.cycle !== 'real' && now - (s.settings.cycleEpoch || 0) >= PREVIEW_MS) s.settings.cycle = 'real';
  if (!Number.isFinite(s.settings.cycleEpoch)) s.settings.cycleEpoch = now;
  ensureDaily(s, now);
  delete s.golden;
  s.v = SAVE_VERSION;
  return s;
}
