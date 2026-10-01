// Reine Spiellogik von BloomWorld – ohne Grafik und ohne Browser-Abhängigkeiten.
// Alle Funktionen verändern den übergebenen Spielstand und geben ein Ergebnis-Objekt zurück.
import * as C from './config.js';

export const SAVE_VERSION = 2;

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
};

export function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    coins: C.START_COINS,
    xp: 0,
    level: 1,
    beds: Array.from({ length: C.BED_COUNT }, (_, i) => ({ locked: i >= C.STARTING_BEDS, seed: null, plantedAt: 0, golden: false, var: 0 })),
    rareUnlocked: [],
    selectedSeed: 'daisy',
    collection: {},
    deco: [],
    skins: [],
    activeSkin: { fox: 'default', hedgehog: 'default' },
    tasks: { date: dayKey(now), progress: { plant: 0, harvest: 0, earn: 0 }, claimed: [] },
    dailyGift: null,
    stats: { planted: 0, harvested: 0, earned: 0, golden: 0 },
    seenAnimals: [],
    tutorial: 0,
    settings: { cycle: 'auto', cycleMin: 8, cycleEpoch: now, quality: 'auto', music: true, musicVol: 0.5, sound: true, soundVol: 0.8 },
  };
}

const err = (code, extra = {}) => ({ ok: false, code, message: ERR[code] || code, ...extra });

// ---------- Münzen & XP ----------
export function addCoins(s, n) {
  n = Math.floor(Number(n) || 0);
  s.coins = Math.max(0, Math.floor(s.coins + n));
  if (n > 0) { s.stats.earned += n; s.tasks.progress.earn += n; }
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

export function addXp(s, n) {
  s.xp += Math.max(0, Math.floor(n));
  const ups = [];
  while (s.level < C.LEVELS.length && s.xp >= C.LEVELS[s.level]) {
    s.level++;
    const reward = C.LEVEL_REWARD(s.level);
    addCoins(s, reward);
    ups.push({ level: s.level, reward, unlocks: Object.keys(C.SEEDS).filter((k) => !C.SEEDS[k].rare && C.SEEDS[k].level === s.level) });
  }
  return ups;
}

export function xpProgress(s) {
  const cur = C.LEVELS[s.level - 1] ?? 0, next = C.LEVELS[s.level];
  if (next === undefined) return { level: s.level, frac: 1, have: s.xp - cur, need: 0, max: true };
  return { level: s.level, frac: Math.min(1, (s.xp - cur) / (next - cur)), have: s.xp - cur, need: next - cur, max: false };
}

// ---------- Saatgut ----------
export function seedStatus(s, id) {
  const d = C.SEEDS[id];
  if (!d) return { available: false, reason: ERR.unknown };
  if (d.rare && !s.rareUnlocked.includes(id)) return { available: false, reason: `Im Shop freischalten (${d.unlockCoins} Münzen)`, shop: true };
  if (s.level < d.level) return { available: false, reason: `Ab Level ${d.level}`, level: d.level };
  return { available: true };
}

// ---------- Beete ----------
export function bedInfo(s, i, now) {
  const b = s.beds[i];
  if (!b) return null;
  if (b.locked) return { i, locked: true, price: C.BED_UNLOCK_COST[i] };
  if (!b.seed) return { i, empty: true };
  const d = C.SEEDS[b.seed];
  const p = Math.max(0, Math.min(1, (now - b.plantedAt) / d.growMs));
  let stage = 0;
  for (let k = 0; k < C.GROWTH_STAGE_AT.length; k++) if (p >= C.GROWTH_STAGE_AT[k]) stage = k;
  return { i, seed: b.seed, progress: p, stage, ready: p >= 1, remaining: Math.max(0, d.growMs - (now - b.plantedAt)), golden: b.golden && p >= 1, var: b.var };
}

export function plant(s, i, seedId, now, rand = Math.random) {
  const b = s.beds[i];
  if (!b) return err('invalid');
  if (b.locked) return err('locked');
  if (b.seed) return err('occupied');
  const d = C.SEEDS[seedId];
  if (!d) return err('unknown');
  const st = seedStatus(s, seedId);
  if (!st.available) return err('seedLocked', { message: `${d.name}: ${st.reason}.` });
  if (!spend(s, d.cost)) return noCoins(s, d.cost, d.name);
  b.seed = seedId; b.plantedAt = now; b.golden = rand() < C.GOLDEN_CHANCE; b.var = Math.floor(rand() * 1000);
  s.stats.planted++; s.tasks.progress.plant++;
  if (s.tutorial < 1) s.tutorial = 1;
  return { ok: true, seed: seedId, cost: d.cost };
}

export function harvest(s, i, now) {
  const b = s.beds[i];
  if (!b) return err('invalid');
  if (b.locked) return err('locked');
  if (!b.seed) return err('empty');
  const d = C.SEEDS[b.seed];
  if (now - b.plantedAt < d.growMs) return err('notReady', { remaining: d.growMs - (now - b.plantedAt) });
  const golden = !!b.golden, seed = b.seed;
  const reward = d.reward * (golden ? C.GOLDEN_MULTIPLIER : 1);
  const xp = d.xp * (golden ? 2 : 1);
  b.seed = null; b.plantedAt = 0; b.golden = false;
  addCoins(s, reward);
  const entry = (s.collection[seed] ||= { count: 0, golden: 0 });
  entry.count++; if (golden) { entry.golden++; s.stats.golden++; }
  s.stats.harvested++; s.tasks.progress.harvest++;
  if (s.tutorial < 2) s.tutorial = 2;
  const levelUps = addXp(s, xp);
  return { ok: true, seed, reward, xp, golden, levelUps };
}

export function unlockBed(s, i) {
  const b = s.beds[i];
  if (!b) return err('invalid');
  if (!b.locked) return err('owned');
  const price = C.BED_UNLOCK_COST[i];
  if (!spend(s, price)) return noCoins(s, price, 'dieses Beet');
  b.locked = false;
  return { ok: true, price };
}

// ---------- Shop (nur Spielwährung) ----------
export function unlockRareSeed(s, id) {
  const d = C.SEEDS[id];
  if (!d || !d.rare) return err('invalid');
  if (s.rareUnlocked.includes(id)) return err('owned');
  if (!spend(s, d.unlockCoins)) return noCoins(s, d.unlockCoins, d.name);
  s.rareUnlocked.push(id);
  return { ok: true };
}

export function buyDeco(s, id) {
  const d = C.DECO[id];
  if (!d) return err('invalid');
  if (s.deco.includes(id)) return err('owned');
  if (!spend(s, d.price)) return noCoins(s, d.price, d.name);
  s.deco.push(id);
  return { ok: true };
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
  if (s.tasks.date !== k) s.tasks = { date: k, progress: { plant: 0, harvest: 0, earn: 0 }, claimed: [] };
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

export function setSetting(s, key, value, now) {
  if (!SETTING_RULES[key] || !SETTING_RULES[key](value)) return err('invalid');
  if (key === 'cycleMin') {
    // Phase beibehalten, nur Geschwindigkeit ändern
    const p = cyclePhase(s, now);
    s.settings.cycleMin = value;
    s.settings.cycleEpoch = now - (p - CYCLE_OFFSET) * value * 60_000;
    return { ok: true };
  }
  s.settings[key] = value;
  return { ok: true };
}

const CYCLE_OFFSET = 0.04; // Spiel startet am frühen Morgen

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
    s.coins = Math.max(0, Math.floor(Number(raw.coins) || 0)) || base.coins;
    if (raw.col && typeof raw.col === 'object') for (const [k, n] of Object.entries(raw.col)) {
      const id = k === 'sun' ? 'sunflower' : k === 'lotus' ? 'orchid' : k;
      if (C.SEEDS[id]) s.collection[id] = { count: Math.max(0, Math.floor(n) || 0), golden: 0 };
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
  if (raw.v === SAVE_VERSION) return { state: repair({ ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) }, stats: { ...base.stats, ...(raw.stats || {}) }, activeSkin: { ...base.activeSkin, ...(raw.activeSkin || {}) } }, now), migrated: false };
  return { state: base, migrated: false, discarded: true };
}

// Beschädigte oder manipulierte Werte reparieren, statt abzustürzen
export function repair(s, now) {
  const base = newState(now);
  const num = (v, d, min = 0) => (Number.isFinite(v) && v >= min ? Math.floor(v) : d);
  s.coins = num(s.coins, base.coins);
  s.xp = num(s.xp, 0);
  s.level = Math.min(C.LEVELS.length, Math.max(1, num(s.level, 1, 1)));
  if (!Array.isArray(s.beds) || s.beds.length !== C.BED_COUNT) s.beds = base.beds;
  s.beds = s.beds.map((b, i) => {
    const ok = b && typeof b === 'object';
    const seed = ok && C.SEEDS[b.seed] ? b.seed : null;
    return { locked: ok ? !!b.locked : i >= C.STARTING_BEDS, seed, plantedAt: seed ? num(b.plantedAt, now) : 0, golden: seed ? !!b.golden : false, var: ok ? num(b.var, 0) : 0 };
  });
  for (const k of ['rareUnlocked', 'deco', 'skins', 'seenAnimals']) if (!Array.isArray(s[k])) s[k] = [];
  s.rareUnlocked = s.rareUnlocked.filter((k) => C.SEEDS[k]?.rare);
  s.deco = s.deco.filter((k) => C.DECO[k]);
  s.skins = s.skins.filter((k) => C.SKINS[k]);
  const col = s.collection && typeof s.collection === 'object' ? s.collection : {};
  s.collection = {};
  for (const [k, e] of Object.entries(col)) {
    if (!C.SEEDS[k]) continue;
    if (typeof e === 'number') s.collection[k] = { count: num(e, 0), golden: 0 };
    else if (e && typeof e === 'object') s.collection[k] = { count: num(e.count, 0), golden: num(e.golden, 0) };
  }
  const st = s.stats && typeof s.stats === 'object' ? s.stats : {};
  s.stats = {};
  for (const k of Object.keys(base.stats)) s.stats[k] = num(Number(st[k]), 0);
  const skins = s.activeSkin && typeof s.activeSkin === 'object' ? s.activeSkin : {};
  s.activeSkin = {};
  for (const animal of Object.keys(base.activeSkin)) {
    const id = skins[animal];
    s.activeSkin[animal] = id && s.skins.includes(id) && C.SKINS[id]?.animal === animal ? id : 'default';
  }
  if (!C.SEEDS[s.selectedSeed]) s.selectedSeed = 'daisy';
  if (!s.tasks || typeof s.tasks !== 'object' || !s.tasks.progress || typeof s.tasks.progress !== 'object') s.tasks = base.tasks;
  for (const k of Object.keys(base.tasks.progress)) s.tasks.progress[k] = num(Number(s.tasks.progress[k]), 0);
  if (!Array.isArray(s.tasks.claimed)) s.tasks.claimed = [];
  if (typeof s.tasks.date !== 'string') s.tasks.date = base.tasks.date;
  if (s.dailyGift !== null && typeof s.dailyGift !== 'string') s.dailyGift = null;
  s.tutorial = Math.min(2, num(s.tutorial, 0));
  for (const [k, rule] of Object.entries(SETTING_RULES)) if (!rule(s.settings[k])) s.settings[k] = base.settings[k];
  if (!Number.isFinite(s.settings.cycleEpoch)) s.settings.cycleEpoch = now;
  ensureDaily(s, now);
  s.v = SAVE_VERSION;
  return s;
}
