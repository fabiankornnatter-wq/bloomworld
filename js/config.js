// Spieldaten von BloomWorld: Pflanzen, Zucht, Gegenstände, Beete, Level, Story, Events, Shop.
// Preise in Münzen sind Spielwährung. Echtgeld-Produkte sind nur vorbereitet (siehe payments.js).

const S = 1000, M = 60_000;

// model = Grundform im 3D-Garten, look = Farben (siehe world/models.js)
export const SEEDS = {
  daisy:     { name: 'Gänse­blümchen', cost: 5,   growMs: 20 * S,  reward: 12,   xp: 2,   level: 1, model: 'daisy' },
  tulip:     { name: 'Tulpe',              cost: 10,  growMs: 45 * S,  reward: 25,   xp: 4,   level: 1, model: 'tulip' },
  sunflower: { name: 'Sonnen­blume',  cost: 20,  growMs: 2 * M,   reward: 55,   xp: 8,   level: 2, model: 'sunflower' },
  lavender:  { name: 'Lavendel',           cost: 35,  growMs: 4 * M,   reward: 95,   xp: 14,  level: 3, model: 'lavender' },
  rose:      { name: 'Rose',               cost: 50,  growMs: 6 * M,   reward: 150,  xp: 20,  level: 4, model: 'rose', rare: true, unlockCoins: 150 },
  orchid:    { name: 'Orchidee',           cost: 80,  growMs: 10 * M,  reward: 260,  xp: 32,  level: 6, model: 'orchid', rare: true, unlockCoins: 300 },
  // Züchtungen (im Gewächshaus)
  rainbowTulip: { name: 'Regenbogen­tulpe', cost: 25,  growMs: 90 * S, reward: 70,   xp: 10,  level: 3,  model: 'tulip', bred: true, tier: 'selten' },
  sunTulip:     { name: 'Sonnen­tulpe',     cost: 30,  growMs: 150 * S, reward: 90,  xp: 12,  level: 4,  model: 'tulip', bred: true, tier: 'selten' },
  goldRose:     { name: 'Goldene Rose',          cost: 70,  growMs: 8 * M,  reward: 260,  xp: 30,  level: 5,  model: 'rose', bred: true, tier: 'episch' },
  moonOrchid:   { name: 'Mond­orchidee',    cost: 100, growMs: 12 * M, reward: 380,  xp: 40,  level: 6,  model: 'orchid', bred: true, tier: 'episch' },
  northRose:    { name: 'Nordlicht-Rose',        cost: 110, growMs: 12 * M, reward: 400,  xp: 42,  level: 7,  model: 'rose', bred: true, tier: 'episch' },
  blackRose:    { name: 'Schwarze Rose',         cost: 120, growMs: 15 * M, reward: 480,  xp: 50,  level: 8,  model: 'rose', bred: true, tier: 'episch' },
  starRose:     { name: 'Sternen­rose',     cost: 250, growMs: 25 * M, reward: 1100, xp: 120, level: 12, model: 'rose', bred: true, tier: 'legendär' },
};
export const SEED_ORDER = ['daisy', 'tulip', 'sunflower', 'lavender', 'rose', 'orchid', 'rainbowTulip', 'sunTulip', 'goldRose', 'moonOrchid', 'northRose', 'blackRose', 'starRose'];
export const BASE_SEEDS = SEED_ORDER.filter((k) => !SEEDS[k].bred);
export const BRED_SEEDS = SEED_ORDER.filter((k) => SEEDS[k].bred);

// Kreuzungen im Gewächshaus. Eltern müssen schon einmal geerntet worden sein.
export const RECIPES = [
  { a: 'tulip', b: 'daisy', result: 'rainbowTulip', cost: 60, ms: 3 * M, hint: 'Zwei Frühlingsblumen ergeben ein buntes Farbenspiel.' },
  { a: 'tulip', b: 'sunflower', result: 'sunTulip', cost: 80, ms: 4 * M, hint: 'Etwas Sonne macht Tulpen feurig.' },
  { a: 'rose', b: 'sunflower', result: 'goldRose', cost: 150, ms: 8 * M, hint: 'Die Rose liebt das Licht der Sonnenblume.' },
  { a: 'orchid', b: 'lavender', result: 'moonOrchid', cost: 200, ms: 10 * M, hint: 'Ein Duft wie eine sternklare Nacht.' },
  { a: 'rose', b: 'lavender', result: 'northRose', cost: 220, ms: 10 * M, hint: 'Violett und Rot tanzen wie Polarlichter.' },
  { a: 'rose', b: 'orchid', result: 'blackRose', cost: 250, ms: 12 * M, night: true, hint: 'Gelingt nur, wenn es Nacht ist.' },
  { a: 'northRose', b: 'blackRose', result: 'starRose', cost: 600, ms: 30 * M, hint: 'Die seltenste Rose von allen.' },
];
export const GREENHOUSE = { cost: 400, level: 4 };

// Funkelblüten: seltene glitzernde Blüten mit dreifacher Belohnung
export const SHINY_CHANCE = 0.06;
export const SHINY_MULTIPLIER = 3;

// Beete: 15 Plätze, die ersten 6 sind frei. Weitere kosten Münzen und brauchen ein Level.
export const BED_COUNT = 15;
export const STARTING_BEDS = 6;
export const BED_UNLOCK = [
  null, null, null, null, null, null,
  { cost: 120, level: 1 }, { cost: 260, level: 2 }, { cost: 500, level: 3 },
  { cost: 700, level: 5 }, { cost: 900, level: 5 }, { cost: 1100, level: 6 },
  { cost: 1400, level: 8 }, { cost: 1700, level: 9 }, { cost: 2000, level: 10 },
];
export const BED_LEVELS = [
  { name: 'Holzbeet', mult: 1, shiny: 0 },
  { name: 'Steinbeet', mult: 1.5, shiny: 0, cost: 300, level: 4 },
  { name: 'Prachtbeet', mult: 2, shiny: 0.05, cost: 900, level: 9 },
];
export const SPRINKLER = { cost: 250, level: 3, speed: 0.7 };

// Gartenbedarf (Verbrauchsgegenstände)
export const ITEMS = {
  fert:  { name: 'Dünger', desc: 'Lässt eine Blume sofort ein gutes Stück wachsen (+50 %).', price: 30, pack: [5, 120], level: 1 },
  turbo: { name: 'Turbo-Dünger', desc: 'Die Blume ist sofort erntereif.', price: 90, pack: [5, 380], level: 3 },
  lucky: { name: 'Glücksdünger', desc: 'Die Blume blüht garantiert als Funkelblüte (×3).', price: 150, level: 5 },
  boost: { name: 'Zuchtbeschleuniger', desc: 'Beendet eine laufende Züchtung sofort.', price: 120, level: 5 },
};
export const ITEM_ORDER = ['fert', 'turbo', 'lucky', 'boost'];

export const START_COINS = 50;

// Level 1–30: benötigte Erfahrung (gesamt)
export const MAX_LEVEL = 30;
export const LEVELS = (() => {
  const a = [0];
  for (let l = 1; l < MAX_LEVEL; l++) a.push(a[l - 1] + Math.round((18 * Math.pow(l, 1.5) + 10) / 5) * 5);
  return a;
})();
export function levelReward(lvl) {
  const items = {};
  if (lvl % 3 === 0) items.fert = 2;
  if (lvl % 5 === 0) items.turbo = 1;
  if (lvl % 10 === 0) items.lucky = 1;
  return { coins: 20 + lvl * 15, items };
}

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
  wheelbarrow: { name: 'Schubkarre',    price: 200, desc: 'Voller Blumen, vorn im Garten.' },
  pumpkins:    { name: 'Herbstkürbisse', price: 180, desc: 'Saison-Deko für den Herbst.', seasonal: 'autumn' },
  pumpkinLantern: { name: 'Kürbislaterne', desc: 'Exklusiv vom Herbstfest. Leuchtet nachts.', event: 'autumn' },
  leafPile:    { name: 'Laubhaufen', desc: 'Exklusiv vom Herbstfest.', event: 'autumn' },
};
export const DECO_ORDER = ['lantern', 'flowerpots', 'bench', 'birdbath', 'wheelbarrow', 'pumpkins'];
export const ALL_DECO = [...DECO_ORDER, 'pumpkinLantern', 'leafPile'];

// Tier-Skins – rein kosmetisch
export const SKINS = {
  arctic: { name: 'Polarfuchs', animal: 'fox', price: 400, desc: 'Weißes Winterfell für deinen Fuchs.' },
  autumn: { name: 'Herbst-Igel', animal: 'hedgehog', price: 250, desc: 'Ein buntes Herbstblatt auf dem Rücken.' },
};

export const ANIMALS = {
  fox: { name: 'Fuchs', desc: 'Streift durch den Garten.' },
  hedgehog: { name: 'Igel', desc: 'Schnüffelt gern zwischen den Beeten.' },
  butterfly: { name: 'Schmetterling', desc: 'Flattert bei Tag über die Blüten.' },
  owl: { name: 'Eule Ophelia', desc: 'Wacht nachts auf dem Torpfosten und erzählt dir die Geschichte des Gartens.' },
};

// ---------- Story: Eule Ophelia führt durch 7 Kapitel ----------
// Zieltypen: plant/harvest/useItem/shiny/earn zählen ab Start der Aufgabe,
// level/beds/deco/greenhouse/breed/rare/sprinkler/bedLevel/animal prüfen den aktuellen Stand.
export const STORY = [
  { title: 'Ein Garten erwacht', intro: 'Hallo, ich bin Ophelia! Ich habe lange auf diesen Garten aufgepasst. Er ist etwas verwildert – hilfst du mir, ihn wieder zum Blühen zu bringen?', quests: [
    { text: 'Pflanze 3 Gänseblümchen.', goal: { type: 'plant', seed: 'daisy', n: 3 }, reward: { coins: 30, xp: 10, items: { fert: 1 } }, say: 'Wunderbar! Hier, nimm etwas Dünger – probier ihn gleich aus.' },
    { text: 'Benutze einen Dünger auf einem wachsenden Beet.', goal: { type: 'useItem', item: 'fert', n: 1 }, reward: { coins: 30, xp: 10 }, say: 'Siehst du, wie schnell das ging? Dünger hilft, wenn es eilt.' },
    { text: 'Ernte 5 Blumen.', goal: { type: 'harvest', n: 5 }, reward: { coins: 40, xp: 15 }, say: 'Die ersten Münzen! Damit kannst du neues Saatgut kaufen.' },
    { text: 'Erreiche Level 2.', goal: { type: 'level', n: 2 }, reward: { coins: 60, items: { fert: 2 } }, say: 'Level 2 – jetzt kannst du Sonnenblumen pflanzen.' },
  ] },
  { title: 'Bunte Beete', intro: 'Ein Garten braucht Farben! Lass uns mehr Blumen anpflanzen und den Garten vergrößern.', quests: [
    { text: 'Pflanze 3 Tulpen.', goal: { type: 'plant', seed: 'tulip', n: 3 }, reward: { coins: 40, xp: 15 } },
    { text: 'Schalte ein weiteres Beet frei.', goal: { type: 'beds', n: 7 }, reward: { coins: 60, xp: 20 }, say: 'Mehr Platz für mehr Blumen!' },
    { text: 'Ernte 3 Sonnenblumen.', goal: { type: 'harvest', seed: 'sunflower', n: 3 }, reward: { coins: 80, xp: 25, items: { fert: 2 } } },
    { text: 'Stelle eine Deko in deinen Garten (Shop → Deko).', goal: { type: 'deco', n: 1 }, reward: { coins: 80, xp: 20 }, say: 'Hübsch! Der Fuchs schaut sich das schon neugierig an.' },
  ] },
  { title: 'Wasser marsch!', intro: 'Blumen wachsen schneller, wenn sie immer genug Wasser haben. Eine automatische Bewässerung wäre jetzt genau richtig.', quests: [
    { text: 'Erreiche Level 3.', goal: { type: 'level', n: 3 }, reward: { coins: 50, xp: 10 } },
    { text: 'Installiere eine automatische Bewässerung (Beet antippen).', goal: { type: 'sprinkler', n: 1 }, reward: { coins: 100, xp: 30 }, say: 'Hörst du das leise Plätschern? Dieses Beet wächst jetzt 30 % schneller.' },
    { text: 'Ernte 3 Lavendel.', goal: { type: 'harvest', seed: 'lavender', n: 3 }, reward: { coins: 120, xp: 30, items: { turbo: 1 } } },
    { text: 'Verdiene 500 Münzen.', goal: { type: 'earn', n: 500 }, reward: { coins: 150, xp: 40 } },
  ] },
  { title: 'Das alte Gewächshaus', intro: 'Hinter dem Haus steht ein altes Gewächshaus. Dort habe ich früher neue Blumensorten gezüchtet. Bringen wir es wieder in Schuss?', quests: [
    { text: 'Erreiche Level 4.', goal: { type: 'level', n: 4 }, reward: { coins: 80, xp: 10 } },
    { text: 'Restauriere das Gewächshaus (antippen).', goal: { type: 'greenhouse' }, reward: { coins: 150, xp: 40 }, say: 'Es funkelt wie neu! Kreuze zwei Blumen, die du schon geerntet hast.' },
    { text: 'Züchte die Regenbogentulpe (Tulpe + Gänseblümchen).', goal: { type: 'breed', seed: 'rainbowTulip' }, reward: { coins: 120, xp: 50, items: { turbo: 1 } }, say: 'Eine eigene Sorte! Du kannst sie ab jetzt in jedes Beet pflanzen.' },
    { text: 'Ernte 3 Regenbogentulpen.', goal: { type: 'harvest', seed: 'rainbowTulip', n: 3 }, reward: { coins: 200, xp: 50 } },
  ] },
  { title: 'Rosenzeit', intro: 'Rosen sind die Königinnen jedes Gartens – und die Grundlage für die schönsten Züchtungen.', quests: [
    { text: 'Schalte die Rose frei (Shop → Blumen).', goal: { type: 'rare', seed: 'rose' }, reward: { coins: 100, xp: 40 } },
    { text: 'Ernte 3 Rosen.', goal: { type: 'harvest', seed: 'rose', n: 3 }, reward: { coins: 200, xp: 60 } },
    { text: 'Baue ein Beet zum Steinbeet aus (Beet antippen).', goal: { type: 'bedLevel', lvl: 2, n: 1 }, reward: { coins: 150, xp: 50 }, say: 'Ein Steinbeet bringt 50 % mehr Münzen pro Ernte.' },
    { text: 'Züchte die Goldene Rose (Rose + Sonnenblume).', goal: { type: 'breed', seed: 'goldRose' }, reward: { coins: 300, xp: 80, items: { lucky: 1 } }, say: 'Gold wie die Abendsonne! Probier den Glücksdünger aus.' },
  ] },
  { title: 'Nachtblüher', intro: 'Manche Blumen zeigen ihr Geheimnis nur im Mondlicht. Besuch mich doch mal nachts!', quests: [
    { text: 'Tippe nachts auf mich, Ophelia (Torpfosten).', goal: { type: 'animal', id: 'owl' }, reward: { coins: 100, xp: 30 }, say: 'Huhu! Schön, dass du da bist. In Nächten wie dieser gelingen besondere Züchtungen.' },
    { text: 'Schalte die Orchidee frei.', goal: { type: 'rare', seed: 'orchid' }, reward: { coins: 150, xp: 50 } },
    { text: 'Züchte die Schwarze Rose (Rose + Orchidee, nur nachts).', goal: { type: 'breed', seed: 'blackRose' }, reward: { coins: 400, xp: 100 } },
    { text: 'Züchte die Nordlicht-Rose (Rose + Lavendel).', goal: { type: 'breed', seed: 'northRose' }, reward: { coins: 400, xp: 100, items: { turbo: 2 } }, say: 'Sie schimmert in der Nacht wie der Himmel im hohen Norden.' },
  ] },
  { title: 'Das große Blumenfest', intro: 'Bald ist das große Blumenfest im Tal. Zeig allen, was in deinem Garten blüht – mit der legendären Sternenrose!', quests: [
    { text: 'Ernte eine Funkelblüte.', goal: { type: 'shiny', n: 1 }, reward: { coins: 200, xp: 60 } },
    { text: 'Erreiche Level 12.', goal: { type: 'level', n: 12 }, reward: { coins: 300, xp: 0 } },
    { text: 'Züchte die Sternenrose (Nordlicht-Rose + Schwarze Rose).', goal: { type: 'breed', seed: 'starRose' }, reward: { coins: 800, xp: 200 }, say: 'Ich habe so lange auf diesen Moment gewartet …' },
    { text: 'Ernte 3 Sternenrosen.', goal: { type: 'harvest', seed: 'starRose', n: 3 }, reward: { coins: 1500, xp: 300, items: { turbo: 3, lucky: 2 } }, say: 'Der schönste Garten im ganzen Tal – dank dir! Neue Kapitel folgen bald.' },
  ] },
];

// ---------- Events (jährlich, Datum MM-TT, lokale Zeit) ----------
export const EVENTS = [
  { id: 'autumn', name: 'Herbstfest', start: '10-01', end: '10-31', token: 'Herbstblätter', color: '#e8641f',
    desc: 'Sammle beim Ernten Herbstblätter und tausche sie gegen exklusive Belohnungen.',
    milestones: [
      { at: 20, reward: { coins: 100 } },
      { at: 50, reward: { items: { fert: 3 } } },
      { at: 100, reward: { deco: 'pumpkinLantern' } },
      { at: 180, reward: { items: { turbo: 2 } } },
      { at: 300, reward: { skin: 'autumn', coins: 300 } },
    ],
    shop: [
      { id: 'leafPile', deco: 'leafPile', price: 40 },
      { id: 'fert3', items: { fert: 3 }, price: 15 },
      { id: 'turbo1', items: { turbo: 1 }, price: 25 },
      { id: 'lucky1', items: { lucky: 1 }, price: 45 },
    ] },
  { id: 'winter', name: 'Wintermarkt', start: '12-01', end: '12-31', token: 'Schneeflocken', color: '#4aa3ff',
    desc: 'Gemütliche Winterwochen mit Lichterketten und Belohnungen.',
    milestones: [{ at: 20, reward: { coins: 100 } }, { at: 60, reward: { items: { fert: 3 } } }, { at: 150, reward: { items: { turbo: 2 } } }, { at: 300, reward: { coins: 600, items: { lucky: 1 } } }],
    shop: [{ id: 'fert3', items: { fert: 3 }, price: 15 }, { id: 'turbo1', items: { turbo: 1 }, price: 25 }] },
  { id: 'spring', name: 'Frühlingsblüte', start: '03-15', end: '04-15', token: 'Knospen', color: '#ff6fa0',
    desc: 'Der Garten erwacht – doppelt so viele Knospen für frühe Gärtner.',
    milestones: [{ at: 20, reward: { coins: 100 } }, { at: 60, reward: { items: { fert: 3 } } }, { at: 150, reward: { items: { turbo: 2 } } }, { at: 300, reward: { coins: 600, items: { lucky: 1 } } }],
    shop: [{ id: 'fert3', items: { fert: 3 }, price: 15 }, { id: 'turbo1', items: { turbo: 1 }, price: 25 }] },
  { id: 'summer', name: 'Sommerfest', start: '07-01', end: '07-31', token: 'Sonnenstrahlen', color: '#ffb81c',
    desc: 'Lange Sommertage und warme Nächte im Garten.',
    milestones: [{ at: 20, reward: { coins: 100 } }, { at: 60, reward: { items: { fert: 3 } } }, { at: 150, reward: { items: { turbo: 2 } } }, { at: 300, reward: { coins: 600, items: { lucky: 1 } } }],
    shop: [{ id: 'fert3', items: { fert: 3 }, price: 15 }, { id: 'turbo1', items: { turbo: 1 }, price: 25 }] },
];
// Jedes Wochenende: doppelte Chance auf Funkelblüten
export const WEEKEND_BONUS = { name: 'Funkel-Wochenende', shinyFactor: 2 };

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
