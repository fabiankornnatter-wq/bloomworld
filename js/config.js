// Spieldaten von BloomWorld: Saatgut, Beete, Shop, Aufgaben, Level.
// Preise in Münzen sind Spielwährung. Echtgeld-Produkte sind nur vorbereitet (siehe payments.js).

export const SEEDS = {
  daisy:     { name: 'Gänse\u00adblümchen', cost: 5,  growMs: 20_000,  reward: 12,  xp: 2,  level: 1, rare: false },
  tulip:     { name: 'Tulpe',         cost: 10, growMs: 45_000,  reward: 25,  xp: 4,  level: 1, rare: false },
  sunflower: { name: 'Sonnen\u00adblume',   cost: 20, growMs: 120_000, reward: 55,  xp: 8,  level: 2, rare: false },
  lavender:  { name: 'Lavendel',      cost: 35, growMs: 240_000, reward: 95,  xp: 14, level: 3, rare: false },
  rose:      { name: 'Rose',          cost: 50, growMs: 360_000, reward: 150, xp: 20, level: 1, rare: true, unlockCoins: 150 },
  orchid:    { name: 'Orchidee',      cost: 80, growMs: 600_000, reward: 260, xp: 32, level: 1, rare: true, unlockCoins: 300 },
};
export const SEED_ORDER = ['daisy', 'tulip', 'sunflower', 'lavender', 'rose', 'orchid'];

// Chance auf eine goldene (seltene) Blüte beim Ernten
export const GOLDEN_CHANCE = 0.06;
export const GOLDEN_MULTIPLIER = 3;

export const BED_COUNT = 9;
export const STARTING_BEDS = 6;
export const BED_UNLOCK_COST = [0, 0, 0, 0, 0, 0, 120, 260, 500];

export const START_COINS = 50;

// XP bis zum nächsten Level
export const LEVELS = [0, 20, 60, 130, 230, 370, 560, 800, 1100, 1500, 2000, 2600, 3300, 4100, 5000];
export const LEVEL_REWARD = (lvl) => 20 + lvl * 15;

export const DAILY_TASKS = [
  { id: 'plant', label: 'Pflanze 5 Blumen', goal: 5, reward: 25, xp: 5 },
  { id: 'harvest', label: 'Ernte 5 Blumen', goal: 5, reward: 40, xp: 8 },
  { id: 'earn', label: 'Verdiene 150 Münzen', goal: 150, reward: 60, xp: 10 },
];
export const DAILY_GIFT = 50;

// Kosmetische Dekoration – erscheint im Garten. Kein Spielvorteil.
export const DECO = {
  lantern:     { name: 'Gartenlaterne', price: 80,  desc: 'Leuchtet nachts warm am Weg.' },
  flowerpots:  { name: 'Blumentöpfe',   price: 60,  desc: 'Drei bunte Töpfe am Haus.' },
  bench:       { name: 'Gartenbank',    price: 120, desc: 'Ein Platz zum Ausruhen am Teich.' },
  birdbath:    { name: 'Vogeltränke',   price: 150, desc: 'Steinerne Tränke für Gartenbesucher.' },
  wheelbarrow: { name: 'Schubkarre',    price: 200, desc: 'Voller Blumen, neben den Beeten.' },
  pumpkins:    { name: 'Herbstkürbisse', price: 180, desc: 'Saison-Deko für den Herbst.', seasonal: 'autumn' },
};
export const DECO_ORDER = ['lantern', 'flowerpots', 'bench', 'birdbath', 'wheelbarrow', 'pumpkins'];

// Tier-Skins – rein kosmetisch
export const SKINS = {
  arctic: { name: 'Polarfuchs', animal: 'fox', price: 400, desc: 'Weißes Winterfell für deinen Fuchs.' },
  autumn: { name: 'Herbst-Igel', animal: 'hedgehog', price: 250, desc: 'Ein buntes Herbstblatt auf dem Rücken.' },
};

export const ANIMALS = {
  fox: { name: 'Fuchs', desc: 'Streift tagsüber durch den Garten.' },
  hedgehog: { name: 'Igel', desc: 'Schnüffelt gern zwischen den Beeten.' },
  butterfly: { name: 'Schmetterling', desc: 'Flattert bei Tag über die Blüten.' },
  owl: { name: 'Eule', desc: 'Wacht nachts auf dem Torpfosten.' },
};

// Echtgeld-Produkte (nur Vorschau, Zahlungen noch nicht aktiv)
export const IAP = {
  coins_small:  { name: '500 Münzen',  coins: 500,  priceEUR: 1.99 },
  coins_medium: { name: '3.000 Münzen', coins: 3000, priceEUR: 8.99, tag: 'Beliebt' },
  coins_large:  { name: '8.000 Münzen', coins: 8000, priceEUR: 17.99, tag: 'Bester Wert' },
  bundle_deco: { name: 'Deko-Paket', priceEUR: 6.99, includes: ['lantern', 'bench', 'birdbath', 'flowerpots', 'wheelbarrow', 'skin:arctic'], cosmetic: true },
  season_pass: { name: 'Saisonpass Herbst', priceEUR: 4.99 },
};

export const REWARDED_VIDEO = { reward: 25, perDay: 3 };

export const GROWTH_STAGE_AT = [0, 0.25, 0.6, 1.0]; // Fortschritt -> Stufe 0..3
