// Spieldaten von BloomWorld: Pflanzen, Zucht, Gegenstände, Beete, Level, Story, Events, Shop.
// Preise in Münzen sind Spielwährung. Echtgeld-Produkte sind nur vorbereitet (siehe payments.js).

const S = 1000, M = 60_000, H = 3_600_000;

// model = Grundform im 3D-Garten, look = Farben (siehe world/models.js)
// water = wie oft die Blume beim Wachsen gegossen werden muss (Beete mit Sprinkler gießen sich selbst)
export const SEEDS = {
  daisy:      { name: 'Gänse­blümchen', cost: 5,   growMs: 20 * S,  reward: 12,  xp: 2,  level: 1,  model: 'daisy', water: 0 },
  tulip:      { name: 'Tulpe',               cost: 10,  growMs: 45 * S,  reward: 25,  xp: 4,  level: 1,  model: 'tulip', water: 0 },
  cornflower: { name: 'Korn­blume',     cost: 15,  growMs: 75 * S,  reward: 40,  xp: 6,  level: 2,  model: 'cornflower', water: 0 },
  sunflower:  { name: 'Sonnen­blume',   cost: 20,  growMs: 2 * M,   reward: 55,  xp: 8,  level: 2,  model: 'sunflower', water: 1 },
  lavender:   { name: 'Lavendel',            cost: 35,  growMs: 4 * M,   reward: 95,  xp: 14, level: 3,  model: 'lavender', water: 1 },
  rose:       { name: 'Rose',                cost: 50,  growMs: 6 * M,   reward: 150, xp: 20, level: 4,  model: 'rose', rare: true, unlockCoins: 150, water: 1 },
  poppy:      { name: 'Mohn­blume',     cost: 40,  growMs: 5 * M,   reward: 120, xp: 17, level: 5,  model: 'poppy', water: 1 },
  orchid:     { name: 'Orchidee',            cost: 80,  growMs: 10 * M,  reward: 260, xp: 32, level: 6,  model: 'orchid', rare: true, unlockCoins: 300, water: 2 },
  lily:       { name: 'Lilie',               cost: 65,  growMs: 8 * M,   reward: 210, xp: 26, level: 8,  model: 'lily', water: 1 },
  hydrangea:  { name: 'Hor­tensie',     cost: 100, growMs: 14 * M,  reward: 360, xp: 40, level: 10, model: 'hydrangea', rare: true, unlockCoins: 600, water: 2 },
  // Langzeit-Blumen: wachsen Stunden, bringen pro Stunde mehr – ideal für Arbeit, Schule, Nacht
  dahlia:     { name: 'Dahlie',              cost: 150, growMs: 2 * H,   reward: 3200, xp: 120, level: 7,  model: 'dahlia', slow: true, water: 1 },
  peony:      { name: 'Pfingst­rose',   cost: 260, growMs: 4 * H,   reward: 7400, xp: 240, level: 9,  model: 'peony', slow: true, water: 1 },
  magnolia:   { name: 'Magnolie',            cost: 420, growMs: 8 * H,   reward: 17500, xp: 480, level: 11, model: 'magnolia', slow: true, water: 1 },
  moonflower: { name: 'Mond­winde',     cost: 600, growMs: 10 * H,  reward: 26000, xp: 700, level: 14, model: 'moonflower', slow: true, water: 0, nightOnly: true },
  // Züchtungen (im Gewächshaus)
  rainbowTulip:     { name: 'Regenbogen­tulpe',     cost: 25,  growMs: 90 * S,  reward: 70,   xp: 10,  level: 3,  model: 'tulip', bred: true, tier: 'selten', water: 0 },
  sunTulip:         { name: 'Sonnen­tulpe',         cost: 30,  growMs: 150 * S, reward: 90,   xp: 12,  level: 4,  model: 'tulip', bred: true, tier: 'selten', water: 1 },
  skyCornflower:    { name: 'Himmels­kornblume',    cost: 30,  growMs: 150 * S, reward: 95,   xp: 14,  level: 4,  model: 'cornflower', bred: true, tier: 'selten', water: 0 },
  goldRose:         { name: 'Goldene Rose',              cost: 70,  growMs: 8 * M,   reward: 260,  xp: 30,  level: 5,  model: 'rose', bred: true, tier: 'episch', water: 1 },
  firePoppy:        { name: 'Feuer­mohn',           cost: 60,  growMs: 7 * M,   reward: 230,  xp: 28,  level: 6,  model: 'poppy', bred: true, tier: 'episch', water: 1 },
  moonOrchid:       { name: 'Mond­orchidee',        cost: 100, growMs: 12 * M,  reward: 380,  xp: 40,  level: 6,  model: 'orchid', bred: true, tier: 'episch', water: 2 },
  northRose:        { name: 'Nordlicht-Rose',            cost: 110, growMs: 12 * M,  reward: 400,  xp: 42,  level: 7,  model: 'rose', bred: true, tier: 'episch', water: 2 },
  blackRose:        { name: 'Schwarze Rose',             cost: 120, growMs: 15 * M,  reward: 480,  xp: 50,  level: 8,  model: 'rose', bred: true, tier: 'episch', water: 2 },
  iceLily:          { name: 'Eis­lilie',            cost: 110, growMs: 12 * M,  reward: 430,  xp: 46,  level: 10, model: 'lily', bred: true, tier: 'episch', water: 2 },
  rainbowHydrangea: { name: 'Regenbogen­hortensie', cost: 140, growMs: 16 * M,  reward: 520,  xp: 55,  level: 11, model: 'hydrangea', bred: true, tier: 'episch', water: 2 },
  starRose:         { name: 'Sternen­rose',         cost: 250, growMs: 25 * M,  reward: 1100, xp: 120, level: 12, model: 'rose', bred: true, tier: 'legendär', water: 2 },
  dragonLily:       { name: 'Drachen­lilie',        cost: 160, growMs: 18 * M,  reward: 640,  xp: 70,  level: 13, model: 'lily', bred: true, tier: 'legendär', water: 2 },
  moonRose:         { name: 'Mondschein­rose',     cost: 200, growMs: 22 * M,  reward: 900,  xp: 95,  level: 12, model: 'rose', bred: true, tier: 'legendär', water: 2 },
  crystalRose:      { name: 'Kristall­rose',        cost: 320, growMs: 30 * M,  reward: 1500, xp: 160, level: 16, model: 'rose', bred: true, tier: 'legendär', water: 2 },
  // Event-Blumen: nur während „ihres“ Events pflanzbar, bringen doppelte Event-Währung, bleiben für immer in der Sammlung
  heartRose:     { name: 'Herz­rose',           cost: 45,  growMs: 5 * M,   reward: 140,  xp: 18, level: 3, model: 'rose',        event: 'valentine', water: 1 },
  daffodil:      { name: 'Oster­glocke',        cost: 20,  growMs: 2 * M,   reward: 60,   xp: 9,  level: 2, model: 'daffodil',    event: 'easter',    water: 0 },
  lilac:         { name: 'Flieder',                 cost: 60,  growMs: 8 * M,   reward: 220,  xp: 28, level: 4, model: 'hydrangea',   event: 'mothers',   water: 1 },
  hibiscus:      { name: 'Hibiskus',                cost: 40,  growMs: 4 * M,   reward: 110,  xp: 16, level: 3, model: 'poppy',       event: 'summer',    water: 1, dayOnly: true },
  chrysanthemum: { name: 'Chrysan­theme',      cost: 70,  growMs: 9 * M,   reward: 250,  xp: 32, level: 5, model: 'dahlia',      event: 'autumn',    water: 1 },
  marigold:      { name: 'Tagetes',                 cost: 35,  growMs: 3 * M,   reward: 90,   xp: 13, level: 2, model: 'dahlia',      event: 'halloween', water: 0 },
  poinsettia:    { name: 'Weihnachts­stern',   cost: 80,  growMs: 12 * M,  reward: 320,  xp: 38, level: 5, model: 'poinsettia',  event: 'winter',    water: 1 },
  sparkler:      { name: 'Funken­blume',        cost: 90,  growMs: 10 * M,  reward: 300,  xp: 36, level: 6, model: 'daisy',       event: 'newyear',   water: 1 },
  crocus:        { name: 'Krokus',                  cost: 12,  growMs: 40 * S,  reward: 30,   xp: 5,  level: 1, model: 'tulip',       event: 'spring',    water: 0 },
};
export const SEED_ORDER = ['daisy', 'tulip', 'cornflower', 'sunflower', 'lavender', 'rose', 'poppy', 'orchid', 'lily', 'hydrangea', 'dahlia', 'peony', 'magnolia', 'moonflower',
  'rainbowTulip', 'sunTulip', 'skyCornflower', 'goldRose', 'firePoppy', 'moonOrchid', 'northRose', 'blackRose', 'iceLily', 'rainbowHydrangea', 'starRose', 'dragonLily', 'moonRose', 'crystalRose',
  'crocus', 'daffodil', 'lilac', 'hibiscus', 'chrysanthemum', 'marigold', 'poinsettia', 'sparkler', 'heartRose'];
export const EVENT_SEEDS = SEED_ORDER.filter((k) => SEEDS[k].event);
export const EVENT_TOKEN_MULT = 2; // Event-Blumen bringen doppelte Event-Währung
// Kurzbeschreibungen für die Detailansicht in der Sammlung
export const FLOWER_INFO = {
  daisy: 'Klein, fröhlich und unverwüstlich. Das Gänseblümchen wächst blitzschnell und braucht nie Wasser – perfekt für den Anfang.',
  tulip: 'Ein schlanker Kelch in kräftigem Pink. Tulpen sind die Eltern vieler bunter Züchtungen.',
  cornflower: 'Leuchtend blau mit fransigen Blütenblättern – früher wuchs sie wild zwischen den Kornfeldern.',
  sunflower: 'Dreht ihr großes Gesicht immer zur Sonne. Sie braucht einmal Wasser, um ihre volle Größe zu erreichen.',
  lavender: 'Duftende violette Ähren, die Bienen und Schmetterlinge anlocken. Ein Klassiker im Bauerngarten.',
  rose: 'Die Königin der Blumen. Ophelias Lieblingsblume und Ausgangspunkt der berühmtesten Züchtungen.',
  poppy: 'Hauchdünne rote Blütenblätter wie Seidenpapier, mit einem dunklen Herz in der Mitte.',
  orchid: 'Exotisch und anspruchsvoll: Die Orchidee möchte zweimal gegossen werden, dankt es aber mit hohem Ertrag.',
  lily: 'Sechs elegante Blütenblätter und lange Staubgefäße – Lilien sind die Grundlage für Eis- und Drachenlilie.',
  hydrangea: 'Hunderte kleine Blüten bilden eine große Kugel. Durstig, aber eine der ertragreichsten Gartenblumen.',
  dahlia: 'Die Dahlie lässt sich Zeit – zwei Stunden – und belohnt Geduld mit einer prächtigen Blütenkugel. Perfekt, wenn du zwischendurch etwas anderes vorhast.',
  peony: 'Vier Stunden Geduld, dann öffnet sich eine Blüte wie aus Seide. Die Pfingstrose ist die Lieblingsblume aller, die tagsüber arbeiten.',
  magnolia: 'Pflanz sie vor dem Schlafengehen: Die Magnolie blüht nach acht Stunden – und zahlt dafür wie ein ganzer Tag Gartenarbeit.',
  moonflower: 'Sie öffnet sich nur, wenn sie nachts gepflanzt wurde, und braucht zehn Stunden. Dafür braucht sie nie Wasser und leuchtet im Dunkeln.',
  heartRose: 'Tiefrot mit weißem Rand – die Rose der Herzblüte. Nur im Februar zu säen; verschenkt sie an Freunde, und sie bringt doppelt so viele Herzen.',
  daffodil: 'Die gelbe Trompete der Osterwiese. Wächst schnell, braucht kein Wasser und versteckt beim Ernten doppelt so viele Ostereier.',
  lilac: 'Duftende lila Rispen zum Muttertag. Wächst nur in der Muttertagswoche und bringt doppelt so viele Sträuße.',
  hibiscus: 'Die Blume der Tropen für das Sommerfest – leuchtend rot mit langem Stempel. Blüht nur tagsüber und sammelt doppelt Sonnenstrahlen.',
  chrysanthemum: 'Bronzefarbene Pompons für das Herbstfest. Jede Ernte bringt doppelt so viele Herbstblätter.',
  marigold: 'Orangefarbene Tagetes, die Blume der Gruselnacht – ihr Duft hält Geister fern. Doppelte Geisterlichter beim Ernten.',
  poinsettia: 'Der Weihnachtsstern des Wintermarkts: rote Sternblätter über dunklem Grün. Bringt doppelt so viele Schneeflocken.',
  sparkler: 'Die Funkenblume der Silvesterfunken: jedes Blütenblatt hat eine andere Farbe und glüht nachts. Doppelte Funken beim Ernten.',
  crocus: 'Der erste Bote des Frühlings – kleine lila Kelche, die schon nach 40 Sekunden blühen und doppelt so viele Knospen bringen.',
  rainbowTulip: 'Jedes Blütenblatt in einer anderen Farbe. Die erste Züchtung jeder Gärtnerin und jedes Gärtners.',
  sunTulip: 'Gelb mit feurig-orangen Spitzen – als hätte die Sonne selbst die Tulpe bemalt.',
  skyCornflower: 'So hellblau wie ein wolkenloser Sommerhimmel und kein bisschen durstig.',
  goldRose: 'Ihre Blüten schimmern wie echtes Gold. Ein Zeichen für großes gärtnerisches Können.',
  firePoppy: 'Glüht in Orange und Rot wie ein Lagerfeuer am Abend.',
  moonOrchid: 'Silbrig-violett und geheimnisvoll. Man sagt, sie leuchtet in klaren Vollmondnächten.',
  northRose: 'Violett und Rot verschwimmen wie Polarlichter am Nachthimmel.',
  blackRose: 'Tiefdunkel, fast schwarz. Sie entsteht nur, wenn die Kreuzung bei Nacht gelingt.',
  iceLily: 'Kühl schimmernd wie Raureif. Ihre Blütenblätter wirken wie aus Eis geschnitzt.',
  rainbowHydrangea: 'Eine Blütenkugel in allen Farben des Regenbogens – jede Blüte ein kleines Kunstwerk.',
  starRose: 'Golden glühend mit sternförmigem Schimmer. Nur Meistergärtner haben sie je gesehen.',
  dragonLily: 'Feurig rot mit dunklen Spitzen – wild, stolz und nur bei Nacht zu züchten.',
  moonRose: 'Silbern schimmernd wie Mondlicht. Sie entsteht nur in Vollmondnächten – ein echter Schatz für Nachtschwärmer.',
  crystalRose: 'Klar wie Kristall und funkelnd im Licht. Die Krönung jeder Sammlung.',
};

// Wann eine Blume Durst bekommt (Anteil der Wachstumszeit)
export const WATER_AT = { 1: [0.45], 2: [0.33, 0.66] };
export const BASE_SEEDS = SEED_ORDER.filter((k) => !SEEDS[k].bred && !SEEDS[k].event);
export const BRED_SEEDS = SEED_ORDER.filter((k) => SEEDS[k].bred);

// Kreuzungen im Gewächshaus. Eltern müssen schon einmal geerntet worden sein.
export const RECIPES = [
  { a: 'tulip', b: 'daisy', result: 'rainbowTulip', diff: 1, cost: 60, ms: 3 * M, hint: 'Zwei Frühlingsblumen ergeben ein buntes Farbenspiel.' },
  { a: 'tulip', b: 'sunflower', result: 'sunTulip', when: 'day', diff: 1, cost: 80, ms: 4 * M, hint: 'Etwas Sonne macht Tulpen feurig.' },
  { a: 'rose', b: 'sunflower', result: 'goldRose', diff: 2, cost: 150, ms: 8 * M, hint: 'Die Rose liebt das Licht der Sonnenblume.' },
  { a: 'orchid', b: 'lavender', result: 'moonOrchid', when: 'night', diff: 2, cost: 200, ms: 10 * M, hint: 'Ein Duft wie eine sternklare Nacht.' },
  { a: 'rose', b: 'lavender', result: 'northRose', diff: 2, cost: 220, ms: 10 * M, hint: 'Violett und Rot tanzen wie Polarlichter.' },
  { a: 'rose', b: 'orchid', result: 'blackRose', when: 'night', diff: 3, cost: 250, ms: 12 * M, hint: 'Gelingt nur, wenn es Nacht ist.' },
  { a: 'northRose', b: 'blackRose', result: 'starRose', diff: 4, cost: 600, ms: 30 * M, hint: 'Die seltenste Rose von allen.' },
  { a: 'cornflower', b: 'lavender', result: 'skyCornflower', diff: 1, cost: 90, ms: 4 * M, hint: 'Blau wie ein wolkenloser Sommerhimmel.' },
  { a: 'poppy', b: 'sunflower', result: 'firePoppy', when: 'evening', diff: 2, cost: 180, ms: 8 * M, hint: 'Glüht wie ein Lagerfeuer am Abend.' },
  { a: 'lily', b: 'moonOrchid', result: 'iceLily', when: 'morning', diff: 3, cost: 300, ms: 12 * M, hint: 'Kühl schimmernd wie Raureif am frühen Morgen.' },
  { a: 'hydrangea', b: 'rainbowTulip', result: 'rainbowHydrangea', diff: 3, cost: 350, ms: 14 * M, hint: 'Hunderte kleine Blüten in allen Farben.' },
  { a: 'lily', b: 'blackRose', result: 'dragonLily', when: 'night', diff: 4, cost: 450, ms: 16 * M, hint: 'Gelingt nur nachts – feurig und geheimnisvoll.' },
  { a: 'moonOrchid', b: 'northRose', result: 'moonRose', when: 'night', moon: 'full', diff: 4, cost: 500, ms: 20 * M, hint: 'Blüht nur auf, wenn der Vollmond am Himmel steht.' },
  { a: 'starRose', b: 'iceLily', result: 'crystalRose', diff: 5, cost: 900, ms: 35 * M, hint: 'Die Krönung jeder Gärtnerin, jedes Gärtners.' },
];
export const GREENHOUSE = { cost: 400, level: 4 };

// ---------- Freunde ----------
// Geschenke: einmal am Tag pro Freund, kostenlos für den Schenkenden
export const GIFTS = {
  rain:    { item: 'rain', n: 1, label: 'Regenwolke' },
  fert:    { item: 'fert', n: 2, label: '2× Dünger' },
  compost: { item: 'compost', n: 1, label: 'Kompost' },
};
export const GIFT_XP = 5;                 // Dank fürs Schenken
export const HELP = { perDay: 5, coins: 5, xp: 3 };  // Blumen gießen bei Freunden: je Freund und Tag
export const LIKE = { coins: 10 };        // „Gefällt mir“ für einen Garten: Belohnung für den Besitzer
export const MAX_FRIENDS = 100;

// Zucht-Bedingungen: Tageszeit (morning = Sonnenaufgang/Morgen, day, evening = Abenddämmerung, night) und Mond
export const WHEN_LABEL = { morning: 'nur bei Sonnenaufgang', day: 'nur tagsüber', evening: 'nur in der Abenddämmerung', night: 'nur nachts' };
export const WHEN_SHORT = { morning: 'morgens', day: 'tagsüber', evening: 'abends', night: 'nachts' };

// Standort für echte Sonnenzeiten (Mitte Deutschlands; Längengrad wird aus der Zeitzone geschätzt)
export const SUN_LAT = 51.5;

// ---------- Blumenhändler ----------
export const TRADER = {
  name: 'Herr Igelmann', level: 2,
  orders: 3,               // Bestellungen pro Tag
  sellRate: 0.35,          // Verkauf aus dem Korb: Anteil der normalen Ernte-Belohnung
  orderRate: 0.9,          // Bestellungen: Anteil der Ernte-Belohnungen, plus Bonus
  dayFlowerMult: 2,        // Tagesblume: doppelter Preis
  shinySell: 2.5,          // Funkelblüten im Korb
  rep: [0, 5, 15, 30, 60], // Ruf-Stufen
  basket: [30, 40, 50, 65, 80],
  repBonus: [0, 0.05, 0.1, 0.15, 0.2],
  offerDiscount: 0.3,      // Tagesangebot
};
// Besonderheiten je Wochentag (0 = Sonntag)
export const TRADER_DAYS = [
  { id: 'sun', name: 'Sonntagsmarkt', desc: 'Alle Verkaufspreise +25 %.', sell: 1.25 },
  { id: 'mon', name: 'Montags-Mischung', desc: 'Heute gibt es eine Bestellung mehr.', extraOrder: 1 },
  { id: 'tue', name: 'Dünger-Dienstag', desc: 'Dünger, Kompost und Regenwolken 30 % günstiger.', itemDiscount: 0.3, items: ['fert', 'compost', 'rain'] },
  { id: 'wed', name: 'Wunsch-Mittwoch', desc: 'Sonderwünsche zahlen das Dreifache.', specialMult: 3 },
  { id: 'thu', name: 'Doppel-Donnerstag', desc: 'Doppelte Ruf-Punkte für jede Bestellung.', repMult: 2 },
  { id: 'fri', name: 'Funkel-Freitag', desc: 'Funkelblüten bringen den vierfachen Preis.', shinySell: 4 },
  { id: 'sat', name: 'Samen-Samstag', desc: 'Ein Gratis-Geschenk vom Händler und Deko 20 % günstiger.', freeGift: true, decoDiscount: 0.2 },
];
export const TRADER_ITEMS = ['fert', 'turbo', 'rain', 'compost', 'pollen'];

// Schwierigkeitsgrad der Züchtungen: Grund-Erfolgschance und wie oft jede Eltern-Blume
// schon geerntet sein muss. Misslingt eine Kreuzung, gibt es einen Teil der Kosten zurück
// und der nächste Versuch wird leichter (Erfahrung).
export const BREED_DIFF = [
  null,
  { name: 'Leicht', adj: 'leichte', chance: 1, harvests: 1 },
  { name: 'Mittel', adj: 'mittelschwere', chance: 0.8, harvests: 2 },
  { name: 'Schwer', adj: 'schwere', chance: 0.6, harvests: 4 },
  { name: 'Meisterhaft', adj: 'meisterhafte', chance: 0.4, harvests: 6 },
  { name: 'Legendär', adj: 'legendäre', chance: 0.25, harvests: 10 },
];
export const BREED_PITY = 0.15;      // +15 % je Fehlversuch derselben Kreuzung
export const BREED_REFUND = 0.4;     // 40 % der Kosten zurück, wenn es misslingt
export const BREED_POLLEN = 0.25;    // Zauberpollen: +25 %
// Aufgestellte Deko lockt Bestäuber an und hilft bei jeder Züchtung
export const BREED_HELPERS = { beehive: 0.1, insectHotel: 0.05 };

// Funkelblüten: seltene glitzernde Blüten mit dreifacher Belohnung
export const SHINY_CHANCE = 0.06;
export const SHINY_MULTIPLIER = 3;

// Beete: 24 Plätze, die ersten 6 sind frei. Weitere kosten Münzen und brauchen ein Level,
// die letzten 9 liegen auf neuem Land (Gartenerweiterung).
export const BED_COUNT = 24;
export const STARTING_BEDS = 6;
export const BED_UNLOCK = [
  null, null, null, null, null, null,
  { cost: 120, level: 1 }, { cost: 260, level: 2 }, { cost: 500, level: 3 },
  { cost: 700, level: 5 }, { cost: 900, level: 5 }, { cost: 1100, level: 6 },
  { cost: 1400, level: 8 }, { cost: 1700, level: 9 }, { cost: 2000, level: 10 },
  { cost: 2400, level: 11, land: 1 }, { cost: 2700, level: 12, land: 1 }, { cost: 3000, level: 12, land: 1 },
  { cost: 3600, level: 14, land: 2 }, { cost: 4000, level: 15, land: 2 }, { cost: 4400, level: 15, land: 2 },
  { cost: 5000, level: 18, land: 3 }, { cost: 5500, level: 19, land: 3 }, { cost: 6000, level: 20, land: 3 },
];

// ---------- Garten-Gestaltung ----------
// Gartenfläche: halbe Seitenlänge des eingezäunten Quadrats je Ausbaustufe
export const LAND = [
  { half: 10.2 },
  { half: 12.8, cost: 1200, level: 5 },
  { half: 15.4, cost: 3500, level: 9 },
  { half: 18.0, cost: 8000, level: 14 },
];
export const BED_SIZE = [2.4, 2.4];
export const GH_SIZE = [4.4, 3.8];
export const SNAP = 0.25;
// Startaufstellung [x, z, Drehung 0–3]
const BX = (c) => 0.4 + (c - 1) * 3.1, BZ = (r) => 1.0 + (r - 1) * 3.1;
export const DEFAULT_BEDS = [
  [BX(0), BZ(0)], [BX(1), BZ(0)], [BX(2), BZ(0)], [BX(0), BZ(1)], [BX(1), BZ(1)], [BX(2), BZ(1)], [BX(0), BZ(2)], [BX(1), BZ(2)], [BX(2), BZ(2)],
  [BX(-1), BZ(0)], [BX(-1), BZ(1)], [BX(-1), BZ(2)], [BX(3), BZ(0)], [BX(3), BZ(1)], [BX(3), BZ(2)],
  [10.0, BZ(0)], [10.0, BZ(1)], [10.0, BZ(2)],
  [-5.8, 12.6], [-2.7, 12.6], [3.5, 12.6],
  [-5.8, 15.3], [-2.7, 15.3], [3.5, 15.3],
].map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100, 0]);
export const DEFAULT_GH = [0, -7.35, 0];
// Feste Hindernisse (Haus, Teich, Bäume, Zierbeete): [x0, z0, x1, z1]
export const OBSTACLES = [
  [-8.6, -8.8, -3.4, -4.3],   // Haus
  [3.65, -9.8, 9.55, -5.2],   // Teich
  [-9.2, 7.5, -7.4, 9.3],     // Apfelbaum
  [-10.1, -9.7, -8.5, -8.1],  // Baum hinten links
  [-4.45, 6.95, -1.55, 9.85], // Zierbeet links
  [5.95, 6.75, 8.45, 9.25],   // Zierbeet rechts
  [-6.5, 6.9, -5.5, 7.7],     // Gießkanne
];
export const BED_LEVELS = [
  { name: 'Holzbeet', mult: 1, shiny: 0 },
  { name: 'Steinbeet', mult: 1.5, shiny: 0, cost: 300, level: 4 },
  { name: 'Prachtbeet', mult: 2, shiny: 0.05, cost: 900, level: 9 },
];
export const SPRINKLER = { cost: 250, level: 3, speed: 0.7 };
// Beet-Größe: mehr Pflanzen je Beet = mehr Ertrag je Ernte (Faktor), braucht mehr Platz im Garten
export const BED_SIZES = [
  { name: 'Klein', scale: 1, plants: 5, mult: 1 },
  { name: 'Mittel', scale: 1.25, plants: 7, mult: 1.4, cost: 450, level: 6 },
  { name: 'Groß', scale: 1.5, plants: 9, mult: 1.8, cost: 1300, level: 12 },
];
export const bedSize = (sz) => BED_SIZE.map((v) => v * (BED_SIZES[(sz || 1) - 1]?.scale || 1));

// Echtgeld-Angebote: erst später – solange false, zeigt das Spiel keinen Angebote-Tab und keinen Saisonpass
export const MONEY_ENABLED = false;

// Gartenbedarf (Verbrauchsgegenstände)
export const ITEMS = {
  fert:  { name: 'Dünger', desc: 'Lässt eine Blume sofort ein gutes Stück wachsen (+50 %).', price: 30, pack: [5, 120], level: 1 },
  turbo: { name: 'Turbo-Dünger', desc: 'Die Blume ist sofort erntereif.', price: 90, pack: [5, 380], level: 3 },
  lucky: { name: 'Glücksdünger', desc: 'Die Blume blüht garantiert als Funkelblüte (×3).', price: 150, level: 5 },
  boost: { name: 'Zuchtbeschleuniger', desc: 'Beendet eine laufende Züchtung sofort.', price: 120, level: 5 },
  rain:  { name: 'Regenwolke', desc: 'Gießt sofort alle durstigen Blumen im Garten.', price: 60, pack: [5, 250], level: 3 },
  compost: { name: 'Kompost', desc: 'Die nächste Ernte dieses Beetes bringt 50 % mehr Münzen.', price: 70, pack: [5, 300], level: 4 },
  pollen: { name: 'Zauberpollen', desc: 'Erhöht die Erfolgschance einer Züchtung um 25 %.', price: 110, pack: [3, 280], level: 6 },
};
export const ITEM_ORDER = ['fert', 'turbo', 'lucky', 'boost', 'rain', 'compost', 'pollen'];
export const COMPOST_BONUS = 1.5;

export const START_COINS = 50;

// Level 1–30: benötigte Erfahrung (gesamt)
export const MAX_LEVEL = 30;
export const LEVELS = (() => {
  const a = [0];
  for (let l = 1; l < MAX_LEVEL; l++) a.push(a[l - 1] + Math.round((18 * Math.pow(l, 1.5) + 10) / 5) * 5);
  return a;
})();
// Besondere Level-Geschenke: Deko, Skins und Item-Pakete – jedes Level fühlt sich wie ein Meilenstein an
export const LEVEL_SPECIAL = {
  2: { items: { fert: 3 } },
  3: { deco: 'pinwheel', items: { turbo: 1 } },
  4: { items: { rain: 2 } },
  5: { deco: 'lantern', items: { lucky: 1 } },
  6: { items: { compost: 2, turbo: 1 } },
  7: { deco: 'birdhouse' },
  8: { items: { turbo: 2, pollen: 1 } },
  9: { deco: 'torch', items: { rain: 2 } },
  10: { deco: 'bench', items: { lucky: 2, boost: 1 } },
  11: { items: { compost: 2, rain: 2 } },
  12: { deco: 'insectHotel', items: { pollen: 1 } },
  13: { items: { turbo: 3 } },
  14: { deco: 'birdbath', items: { compost: 2 } },
  15: { skin: 'arctic', items: { lucky: 2, pollen: 2 } },
  16: { items: { compost: 3, rain: 2 } },
  17: { deco: 'lampPost', items: { turbo: 2 } },
  18: { items: { turbo: 3, rain: 3, boost: 1 } },
  19: { deco: 'tableSet' },
  20: { skin: 'autumn', deco: 'stringLights', items: { lucky: 3, pollen: 2 } },
  21: { items: { compost: 3, turbo: 2 } },
  22: { deco: 'arch', items: { rain: 3 } },
  23: { items: { lucky: 2, pollen: 2 } },
  24: { items: { turbo: 4, compost: 3 } },
  25: { deco: 'fountain', items: { lucky: 3, boost: 2 } },
  26: { items: { rain: 4, pollen: 2 } },
  27: { items: { turbo: 4, compost: 4 } },
  28: { deco: 'beehive', items: { lucky: 3 } },
  29: { items: { turbo: 5, pollen: 3 } },
  30: { items: { lucky: 5, pollen: 5, boost: 3, compost: 5 } },
};
export function levelReward(lvl) {
  const sp = LEVEL_SPECIAL[lvl] || {};
  const items = { ...(sp.items || {}) };
  if (lvl % 2 === 0) items.fert = (items.fert || 0) + 2;
  const coins = 40 + lvl * 30 + (lvl % 5 === 0 ? lvl * 40 : 0) + (lvl === 30 ? 3000 : 0);
  const r = { coins, items };
  if (sp.deco) r.deco = sp.deco;
  if (sp.skin) r.skin = sp.skin;
  return r;
}

export const DAILY_TASKS = [
  { id: 'plant', label: 'Pflanze 5 Blumen', goal: 5, reward: 25, xp: 5 },
  { id: 'harvest', label: 'Ernte 5 Blumen', goal: 5, reward: 40, xp: 8 },
  { id: 'earn', label: 'Verdiene 150 Münzen', goal: 150, reward: 60, xp: 10 },
  { id: 'water', label: 'Gieße 5 Blumen', goal: 5, reward: 30, xp: 6 },
];
export const DAILY_GIFT = 50;

// Wochenziele: Montag bis Sonntag, größere Belohnungen für regelmäßiges Spielen
export const WEEKLY_TASKS = [
  { id: 'harvest', label: 'Ernte 60 Blumen', goal: 60, reward: { coins: 300, xp: 60 } },
  { id: 'orders', label: 'Liefere 8 Bestellungen beim Händler', goal: 8, reward: { coins: 400, xp: 80, items: { compost: 2 } } },
  { id: 'water', label: 'Gieße 25 Blumen', goal: 25, reward: { coins: 200, xp: 40, items: { rain: 1 } } },
  { id: 'bred', label: 'Schließe 2 Züchtungen ab', goal: 2, reward: { coins: 500, xp: 100, items: { pollen: 1 } } },
  { id: 'days', label: 'Spiele an 5 Tagen', goal: 5, reward: { coins: 350, xp: 70, items: { lucky: 1 } } },
  { id: 'social', label: 'Hilf Freunden 10× (gießen oder schenken)', goal: 10, reward: { coins: 250, xp: 50 } },
];
export const WEEKLY_BONUS = { coins: 1000, xp: 200, items: { turbo: 2 } }; // alle Wochenziele geschafft

// Tiere: Nutzen und Geschenke (Streicheln einmal je Tier und Tag)
export const ANIMAL_GIFTS = {
  hedgehog: { name: 'Igel', desc: 'Buddelt beim Streicheln gern etwas aus.', gifts: [{ coins: 40 }, { coins: 60 }, { items: { fert: 1 } }, { items: { compost: 1 } }, { coins: 25, items: { fert: 1 } }] },
  fox: { name: 'Fuchs', desc: 'Bringt Fundstücke aus dem Wald.', gifts: [{ coins: 50 }, { items: { rain: 1 } }, { items: { turbo: 1 } }, { coins: 80 }, { items: { pollen: 1 } }] },
  owl: { name: 'Eule Ophelia', desc: 'Erzählt nachts Geschichten und schenkt Weisheit (EP).', gifts: [{ xp: 40 }, { xp: 60 }, { xp: 50, coins: 30 }] },
  butterfly: { name: 'Schmetterling', desc: 'Bestäubt deine Blumen: heute +5 % Funkel-Chance.', gifts: [{ shinyBoost: 1 }] },
};
export const BUTTERFLY_SHINY = 0.05;

// Seltene Überraschungen im Garten (höchstens eine pro Tag; Chance je Spielminute)
export const SURPRISES = [
  { id: 'star', name: 'Sternschnuppe', chance: 0.02, night: true, reward: { coins: 120, xp: 30 }, say: 'Eine Sternschnuppe! Wünsch dir was … und nimm die Münzen, die sie hinterlassen hat.' },
  { id: 'rainbow', name: 'Regenbogen', chance: 0.015, day: true, reward: { items: { lucky: 1 } }, say: 'Ein Regenbogen über deinem Garten! Am Ende lag ein Glücksdünger.' },
  { id: 'bee', name: 'Bienenschwarm', chance: 0.02, day: true, reward: { items: { pollen: 1 } }, say: 'Ein Bienenschwarm hat deinen Garten besucht und Zauberpollen dagelassen.' },
  { id: 'coin', name: 'Vergrabener Schatz', chance: 0.012, reward: { coins: 250 }, say: 'Der Igel hat beim Buddeln ein altes Münzsäckchen gefunden!' },
  { id: 'peddler', name: 'Wanderhändlerin', chance: 0.01, reward: { items: { rain: 2, compost: 1 } }, say: 'Eine Wanderhändlerin kam vorbei und hat dir aus Dankbarkeit für den schönen Garten etwas geschenkt.' },
];

// Kosmetische Dekoration – frei im Garten aufstellbar, mehrfach kaufbar. Kein Spielvorteil.
// size = Grundfläche [Breite, Tiefe] für die Platzprüfung
export const DECO = {
  pathStone:   { name: 'Trittsteine',   price: 15,  level: 1, size: [1.5, 1.1], desc: 'Zwei flache Steine für eigene Wege.' },
  hedgeBlock:  { name: 'Heckenstück',   price: 40,  level: 1, size: [1.8, 0.8], desc: 'Grüne Hecke zum Abgrenzen und Gestalten.' },
  flowerpots:  { name: 'Blumentöpfe',   price: 60,  level: 1, size: [1.2, 1.2], desc: 'Drei bunte Töpfe.' },
  lantern:     { name: 'Gartenlaterne', price: 80,  level: 1, size: [0.5, 0.5], desc: 'Leuchtet nachts warm am Weg.' },
  planter:     { name: 'Blumenkübel',   price: 90,  level: 2, size: [1.0, 1.0], desc: 'Großer Kübel voller Blüten.' },
  birdhouse:   { name: 'Vogelhaus',     price: 110, level: 2, size: [0.7, 0.7], desc: 'Ein Zuhause für Gartenvögel.' },
  bench:       { name: 'Gartenbank',    price: 120, level: 1, size: [1.9, 0.8], desc: 'Ein Platz zum Ausruhen.' },
  birdbath:    { name: 'Vogeltränke',   price: 150, level: 2, size: [1.2, 1.2], desc: 'Steinerne Tränke für Gartenbesucher.' },
  beehive:     { name: 'Bienenstock',   price: 160, level: 6, size: [1.0, 1.0], desc: 'Fleißige Bienen summen um die Blüten.' },
  pumpkins:    { name: 'Herbstkürbisse', price: 180, level: 1, size: [1.5, 1.4], desc: 'Saison-Deko für den Herbst.', seasonal: 'autumn' },
  wheelbarrow: { name: 'Schubkarre',    price: 200, level: 3, size: [1.9, 0.8], desc: 'Voller Blumen.' },
  tableSet:    { name: 'Gartentisch',   price: 260, level: 4, size: [2.1, 2.1], desc: 'Tisch, zwei Stühle und ein Sonnenschirm.' },
  arch:        { name: 'Rosenbogen',    price: 320, level: 5, size: [2.2, 0.7], desc: 'Weißer Bogen mit rankenden Rosen.' },
  fountain:    { name: 'Springbrunnen', price: 600, level: 8, size: [2.0, 2.0], desc: 'Plätschernder Brunnen als Mittelpunkt.' },
  pinwheel:    { name: 'Windspiel',     price: 45,  level: 1, size: [0.5, 0.5], desc: 'Buntes Windrad, das sich im Wind dreht.' },
  hoseReel:    { name: 'Schlauchwagen', price: 70,  level: 2, size: [0.9, 0.7], desc: 'Gartenschlauch auf der Trommel.' },
  rainBarrel:  { name: 'Regentonne',    price: 90,  level: 3, size: [0.9, 0.9], desc: 'Sammelt Regenwasser zum Gießen.' },
  compostBin:  { name: 'Kompostkiste',  price: 100, level: 4, size: [1.2, 1.2], desc: 'Aus Gartenabfällen wird gute Erde.' },
  insectHotel: { name: 'Insektenhotel', price: 130, level: 4, size: [0.9, 0.6], desc: 'Zuhause für Wildbienen und Marienkäfer.' },
  groundLights: { name: 'Pilzleuchten', price: 50, level: 1, size: [0.8, 0.8], desc: 'Kleine leuchtende Pilze – erhellen nachts den Boden.' },
  torch:        { name: 'Gartenfackel', price: 70, level: 2, size: [0.4, 0.4], desc: 'Flackert warm in der Dämmerung.' },
  lampPost:     { name: 'Doppel-Laterne', price: 180, level: 4, size: [0.7, 0.5], desc: 'Hell und elegant – beleuchtet einen großen Bereich.' },
  stringLights: { name: 'Lichterkette', price: 220, level: 6, size: [2.4, 0.5], desc: 'Warme Lichter für gemütliche Abende.' },
  pumpkinLantern: { name: 'Kürbislaterne', size: [1.1, 1.1], desc: 'Exklusiv vom Herbstfest. Leuchtet nachts.', event: 'autumn' },
  leafPile:    { name: 'Laubhaufen', size: [1.6, 1.5], desc: 'Exklusiv vom Herbstfest.', event: 'autumn' },
  heartBalloons: { name: 'Herzballons', size: [0.7, 0.7], desc: 'Drei rote Herzballons – exklusiv zur Herzblüte.', event: 'valentine' },
  loveSeat:    { name: 'Herzbank', size: [1.9, 0.8], desc: 'Bank mit Herz-Lehne für zwei – exklusiv zur Herzblüte.', event: 'valentine' },
  eggBasket:   { name: 'Osterkorb', size: [0.9, 0.9], desc: 'Korb voller bunter Eier – exklusiv zur Osterwiese.', event: 'easter' },
  eggTree:     { name: 'Eierbaum', size: [1.1, 1.1], desc: 'Zweige mit bemalten Eiern – exklusiv zur Osterwiese.', event: 'easter' },
  bouquetVase: { name: 'Blumenstrauß', size: [0.7, 0.7], desc: 'Vase mit üppigem Strauß – exklusiv zum Muttertag.', event: 'mothers' },
  parasol:     { name: 'Sonnenschirm', size: [1.6, 1.6], desc: 'Gestreifter Schirm mit Liegestuhl – exklusiv vom Sommerfest.', event: 'summer' },
  ghostLantern: { name: 'Geisterlicht', size: [0.8, 0.8], desc: 'Freundlicher Geist, der nachts leuchtet – exklusiv zur Gruselnacht.', event: 'halloween' },
  cauldron:    { name: 'Hexenkessel', size: [1.0, 1.0], desc: 'Blubbert grün und leuchtet – exklusiv zur Gruselnacht.', event: 'halloween' },
  fireworks:   { name: 'Raketenkiste', size: [1.0, 0.8], desc: 'Funkelnde Raketen – exklusiv von den Silvesterfunken.', event: 'newyear' },
  snowman:     { name: 'Schneemann', size: [0.9, 0.9], desc: 'Mit Möhre und Schal – exklusiv vom Wintermarkt.', event: 'winter' },
  xmasTree:    { name: 'Tannenbaum', size: [1.3, 1.3], desc: 'Geschmückt mit Lichtern und Kugeln – exklusiv vom Wintermarkt.', event: 'winter' },
};
export const DECO_ORDER = ['pathStone', 'groundLights', 'pinwheel', 'hedgeBlock', 'flowerpots', 'hoseReel', 'lantern', 'torch', 'lampPost', 'planter', 'rainBarrel', 'compostBin', 'birdhouse', 'bench', 'insectHotel', 'birdbath', 'beehive', 'pumpkins', 'wheelbarrow', 'stringLights', 'tableSet', 'arch', 'fountain'];
export const ALL_DECO = [...DECO_ORDER, 'pumpkinLantern', 'leafPile', 'heartBalloons', 'loveSeat', 'eggBasket', 'eggTree', 'bouquetVase', 'parasol', 'ghostLantern', 'cauldron', 'fireworks', 'snowman', 'xmasTree'];
export const MAX_DECO = 80; // Deko-Teile insgesamt (Leistung auf dem Handy)
// Bevorzugte Plätze (Übernahme alter Spielstände, erste Käufe)
export const DECO_PLACE = {
  lantern: [[1.9, 8.2, 0], [-2.9, -4.6, 0]],
  flowerpots: [[-8.6, -3.7, 0]],
  bench: [[6.6, -4.75, 2]],
  birdbath: [[-8.6, 1.0, 0]],
  wheelbarrow: [[4.6, 8.2, 0]],
  pumpkins: [[-8.6, -2.0, 0]],
  pumpkinLantern: [[-0.9, 8.0, 0]],
  leafPile: [[3.6, 6.4, 0]],
};

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
    { text: 'Gestalte deinen Garten: Verschiebe ein Beet oder eine Deko (Knopf „Gestalten“).', goal: { type: 'move', n: 1 }, reward: { coins: 60, xp: 15 }, say: 'So gefällt mir das! Dein Garten, deine Ordnung.' },
  ] },
  { title: 'Wasser marsch!', intro: 'Blumen wachsen schneller, wenn sie immer genug Wasser haben. Eine automatische Bewässerung wäre jetzt genau richtig.', quests: [
    { text: 'Erreiche Level 3.', goal: { type: 'level', n: 3 }, reward: { coins: 50, xp: 10 } },
    { text: 'Installiere eine automatische Bewässerung (Beet antippen).', goal: { type: 'sprinkler', n: 1 }, reward: { coins: 100, xp: 30 }, say: 'Hörst du das leise Plätschern? Dieses Beet wächst jetzt 30 % schneller.' },
    { text: 'Ernte 3 Lavendel.', goal: { type: 'harvest', seed: 'lavender', n: 3 }, reward: { coins: 120, xp: 30, items: { turbo: 1 } } },
    { text: 'Verdiene 500 Münzen.', goal: { type: 'earn', n: 500 }, reward: { coins: 150, xp: 40 } },
    { text: 'Gieße 3 durstige Blumen (Tropfen über dem Beet antippen).', goal: { type: 'water', n: 3 }, reward: { coins: 60, xp: 20, items: { rain: 1 } }, say: 'Durstige Blumen wachsen erst weiter, wenn sie Wasser bekommen. Beete mit Sprinkler gießen sich ganz von selbst!' },
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
    { text: 'Ernte 3 Sternenrosen.', goal: { type: 'harvest', seed: 'starRose', n: 3 }, reward: { coins: 1500, xp: 300, items: { turbo: 3, lucky: 2 } }, say: 'Der schönste Garten im ganzen Tal – dank dir!' },
  ] },
  { title: 'Wunder der Zucht', intro: 'In meinem alten Notizbuch stehen noch Kreuzungen, die niemand geschafft hat: Feuermohn, Eislilie … und die sagenhafte Kristallrose.', quests: [
    { text: 'Ernte 3 Lilien.', goal: { type: 'harvest', seed: 'lily', n: 3 }, reward: { coins: 300, xp: 60, items: { compost: 2 } } },
    { text: 'Züchte den Feuermohn (Mohnblume + Sonnenblume).', goal: { type: 'breed', seed: 'firePoppy' }, reward: { coins: 400, xp: 90 } },
    { text: 'Züchte die Eislilie (Lilie + Mondorchidee).', goal: { type: 'breed', seed: 'iceLily' }, reward: { coins: 600, xp: 120, items: { rain: 3 } }, say: 'Sie glitzert wie Raureif – fast zu schön, um wahr zu sein.' },
    { text: 'Züchte die Kristallrose (Sternenrose + Eislilie).', goal: { type: 'breed', seed: 'crystalRose' }, reward: { coins: 2500, xp: 400, items: { lucky: 3, turbo: 3 } }, say: 'Die Kristallrose! Ich habe sie mein ganzes Leben gesucht. Danke!' },
  ] },
  { title: 'Der Händler kommt', intro: 'Hörst du das Rattern? Herr Igelmann ist mit seinem Karren da. Er kauft Blumen und hat jeden Tag etwas Besonderes dabei.', quests: [
    { text: 'Verkaufe 10 Blumen aus deinem Korb an den Händler.', goal: { type: 'sold', n: 10 }, reward: { coins: 100, xp: 30 }, say: 'Er zahlt gut – und für die Tagesblume sogar doppelt!' },
    { text: 'Liefere 3 Bestellungen.', goal: { type: 'orders', n: 3 }, reward: { coins: 250, xp: 60, items: { compost: 2 } } },
    { text: 'Erfülle einen Sonderwunsch (Funkelblüte oder Züchtung).', goal: { type: 'special', n: 1 }, reward: { coins: 400, xp: 90, items: { lucky: 1 } }, say: 'Davon erzählt er jetzt im ganzen Tal!' },
    { text: 'Erreiche beim Händler die Ruf-Stufe „Stammkundschaft“.', goal: { type: 'rep', n: 1 }, reward: { coins: 300, xp: 80 }, say: 'Dein Korb ist jetzt größer. Die Leute mögen dich!' },
  ] },
  { title: 'Geduld zahlt sich aus', intro: 'Manche Blumen lassen sich Zeit – und belohnen dich dafür königlich. Pflanz sie, bevor du zur Arbeit gehst oder schlafen legst.', quests: [
    { text: 'Pflanze eine Dahlie (wächst 2 Stunden).', goal: { type: 'plant', seed: 'dahlia', n: 1 }, reward: { coins: 150, xp: 40 } },
    { text: 'Ernte 2 Dahlien.', goal: { type: 'harvest', seed: 'dahlia', n: 2 }, reward: { coins: 500, xp: 120 }, say: 'Siehst du? Warten lohnt sich. Pro Stunde bringt sie mehr als jede schnelle Blume.' },
    { text: 'Ernte eine Pfingstrose (4 Stunden).', goal: { type: 'harvest', seed: 'peony', n: 1 }, reward: { coins: 800, xp: 150, items: { compost: 3 } } },
    { text: 'Erreiche Level 11.', goal: { type: 'level', n: 11 }, reward: { coins: 400, xp: 0 }, say: 'Jetzt kannst du die Magnolie pflanzen – die blüht über Nacht.' },
  ] },
  { title: 'Nachbarn', intro: 'Ein Garten ist schöner, wenn man ihn teilt. Im Tal gibt es andere Gärtnerinnen und Gärtner – besuch sie doch mal!', quests: [
    { text: 'Füge einen Freund hinzu (Menü „Freunde“, Spielername eingeben).', goal: { type: 'friends', n: 1 }, reward: { coins: 150, xp: 40 }, say: 'Wenn du noch niemanden kennst: Teile deinen Spielernamen!' },
    { text: 'Besuche den Garten eines Freundes und gieße 3 Blumen.', goal: { type: 'helped', n: 3 }, reward: { coins: 200, xp: 60 } },
    { text: 'Schicke einem Freund ein Geschenk.', goal: { type: 'gifted', n: 1 }, reward: { coins: 150, xp: 40, items: { rain: 1 } } },
    { text: 'Gib einem Garten ein Herz.', goal: { type: 'liked', n: 1 }, reward: { coins: 100, xp: 30 }, say: 'Freundschaft lässt Gärten doppelt blühen.' },
  ] },
  { title: 'Die Tiere des Gartens', intro: 'Fuchs, Igel und Schmetterling sind nicht nur zum Anschauen da. Wer sie streichelt, bekommt kleine Geschenke.', quests: [
    { text: 'Streichle den Igel (antippen).', goal: { type: 'petted', id: 'hedgehog' }, reward: { coins: 80, xp: 20 }, say: 'Er buddelt gern etwas für dich aus!' },
    { text: 'Streichle den Fuchs.', goal: { type: 'petted', id: 'fox' }, reward: { coins: 80, xp: 20 } },
    { text: 'Streichle an 3 verschiedenen Tagen ein Tier.', goal: { type: 'petDays', n: 3 }, reward: { coins: 250, xp: 60, items: { fert: 3 } } },
    { text: 'Lass dich vom Schmetterling bestäuben (am Tag antippen).', goal: { type: 'petted', id: 'butterfly' }, reward: { coins: 150, xp: 40, items: { lucky: 1 } }, say: 'Heute funkeln deine Blumen öfter!' },
  ] },
  { title: 'Licht in der Nacht', intro: 'Wenn es dunkel wird, zeigt der Garten ein zweites Gesicht. Lass ihn leuchten!', quests: [
    { text: 'Stelle 3 Lichtquellen auf (Laterne, Fackel, Pilzleuchten …).', goal: { type: 'lights', n: 3 }, reward: { coins: 200, xp: 50 } },
    { text: 'Züchte den Feuermohn in der Abenddämmerung.', goal: { type: 'breed', seed: 'firePoppy' }, reward: { coins: 300, xp: 80 } },
    { text: 'Pflanze nachts eine Mondwinde (10 Stunden, braucht kein Wasser).', goal: { type: 'plant', seed: 'moonflower', n: 1 }, reward: { coins: 300, xp: 80 } },
    { text: 'Ernte eine Mondwinde.', goal: { type: 'harvest', seed: 'moonflower', n: 1 }, reward: { coins: 1200, xp: 250, items: { pollen: 2 } }, say: 'Sie leuchtet wie ein kleiner Mond. Wunderschön.' },
  ] },
  { title: 'Vollmondnacht', intro: 'Alle 29 Tage steht der Vollmond am Himmel. Nur dann gelingt die seltenste Rose, die ich kenne.', quests: [
    { text: 'Züchte die Mondorchidee (nachts).', goal: { type: 'breed', seed: 'moonOrchid' }, reward: { coins: 300, xp: 80 } },
    { text: 'Ernte 6 Nordlicht-Rosen.', goal: { type: 'harvest', seed: 'northRose', n: 6 }, reward: { coins: 600, xp: 120 } },
    { text: 'Züchte die Mondscheinrose (Mondorchidee + Nordlicht-Rose, bei Vollmond).', goal: { type: 'breed', seed: 'moonRose' }, reward: { coins: 2000, xp: 400, items: { lucky: 2 } }, say: 'In all meinen Jahren habe ich das nur einmal gesehen. Du bist eine wahre Mondgärtnerin … ein wahrer Mondgärtner!' },
  ] },
  { title: 'Meisterschaft', intro: 'Dein Garten ist berühmt. Zeit, ihn zu vollenden.', quests: [
    { text: 'Erweitere deinen Garten auf die volle Größe.', goal: { type: 'land', n: 3 }, reward: { coins: 800, xp: 200 } },
    { text: 'Baue 6 Beete zu Prachtbeeten aus.', goal: { type: 'bedLevel', lvl: 3, n: 6 }, reward: { coins: 1000, xp: 250 } },
    { text: 'Entdecke 24 verschiedene Blumen.', goal: { type: 'collected', n: 24 }, reward: { coins: 1500, xp: 300, items: { turbo: 3 } } },
    { text: 'Erreiche Level 20.', goal: { type: 'level', n: 20 }, reward: { coins: 2000, xp: 0, items: { lucky: 3, pollen: 3 } }, say: 'Ich bin so stolz auf dich. Dieser Garten ist das Schönste, was ich je gesehen habe.' },
  ] },
  { title: 'Ophelias Geheimnis', intro: 'Ich habe dir noch nie erzählt, warum ich diesen Garten so lange bewacht habe … Komm nachts zu mir.', quests: [
    { text: 'Besuche Ophelia nachts (antippen).', goal: { type: 'petted', id: 'owl' }, reward: { coins: 200, xp: 60 }, say: 'Vor langer Zeit hat hier jemand die Kristallrose gepflanzt – für mich. Ich wartete, dass sie wiederkommt. Jetzt weiß ich: Der Garten gehört dem, der ihn liebt.' },
    { text: 'Ernte 3 Kristallrosen.', goal: { type: 'harvest', seed: 'crystalRose', n: 3 }, reward: { coins: 3000, xp: 500 } },
    { text: 'Liefere 25 Bestellungen beim Händler.', goal: { type: 'orders', n: 25 }, reward: { coins: 2500, xp: 400, items: { compost: 5 } } },
    { text: 'Erreiche Level 25.', goal: { type: 'level', n: 25 }, reward: { coins: 5000, xp: 0, items: { lucky: 5, turbo: 5, pollen: 5 } }, say: 'Danke, dass du geblieben bist. Dieser Garten – und ich – gehören jetzt zu dir. Für immer.' },
  ] },
];

// ---------- Events (jährlich, Datum MM-TT, lokale Zeit) ----------
// Saison-Events und Anlässe im Jahreslauf. Feste Daten als 'MM-TT'; bewegliche über anchor (easter/mothers) + Tage davor/danach.
// Reihenfolge = Vorrang bei Überschneidung (Anlässe vor Jahreszeiten).
const MS = (list) => list.map(([at, reward]) => ({ at, reward }));
const SHOP_BASIC = [{ id: 'fert3', items: { fert: 3 }, price: 15 }, { id: 'turbo1', items: { turbo: 1 }, price: 25 }, { id: 'lucky1', items: { lucky: 1 }, price: 45 }];
export const EVENTS = [
  { id: 'valentine', name: 'Herzblüte', start: '02-07', end: '02-16', token: 'Herzen', color: '#ff4d7a',
    desc: 'Valentinstag im Garten: Herzen sammeln, Freunde beschenken und ein Herzballon-Bund als Deko.',
    milestones: MS([[15, { coins: 120 }], [40, { items: { fert: 3 } }], [90, { deco: 'heartBalloons' }], [160, { items: { lucky: 1, turbo: 2 } }], [260, { deco: 'loveSeat', coins: 400 }]]),
    shop: [{ id: 'heartBalloons', deco: 'heartBalloons', price: 45 }, ...SHOP_BASIC] },
  { id: 'easter', name: 'Osterwiese', anchor: 'easter', from: -10, to: 1, token: 'Ostereier', color: '#ffb81c',
    desc: 'Bunte Eier verstecken sich in jeder Ernte. Sammle sie für Osterkorb und Eierbaum.',
    milestones: MS([[15, { coins: 120 }], [40, { items: { rain: 2 } }], [90, { deco: 'eggBasket' }], [160, { items: { lucky: 1, compost: 2 } }], [260, { deco: 'eggTree', coins: 400 }]]),
    shop: [{ id: 'eggBasket', deco: 'eggBasket', price: 45 }, ...SHOP_BASIC] },
  { id: 'mothers', name: 'Muttertag', anchor: 'mothers', from: -6, to: 1, token: 'Sträuße', color: '#ff7eb6',
    desc: 'Eine Woche voller Blumensträuße – und ein Dankeschön für die beste Gärtnerin.',
    milestones: MS([[15, { coins: 120 }], [40, { items: { fert: 3 } }], [90, { deco: 'bouquetVase' }], [160, { items: { lucky: 1, pollen: 1 } }]]),
    shop: [{ id: 'bouquetVase', deco: 'bouquetVase', price: 45 }, ...SHOP_BASIC] },
  { id: 'halloween', name: 'Gruselnacht', start: '10-24', end: '11-02', token: 'Geisterlichter', color: '#8d4dff',
    desc: 'Freundliche Geister, leuchtende Kessel und Süßes statt Saures – schaurig schön bei Nacht.',
    milestones: MS([[15, { coins: 120 }], [40, { items: { turbo: 2 } }], [90, { deco: 'ghostLantern' }], [160, { items: { lucky: 1, boost: 1 } }], [260, { deco: 'cauldron', coins: 400 }]]),
    shop: [{ id: 'ghostLantern', deco: 'ghostLantern', price: 45 }, ...SHOP_BASIC] },
  { id: 'newyear', name: 'Silvesterfunken', start: '12-27', end: '01-03', token: 'Funken', color: '#ffd23f',
    desc: 'Das Jahr endet mit Feuerwerk über dem Garten. Sammle Funken für die Raketenkiste.',
    milestones: MS([[15, { coins: 150 }], [40, { items: { turbo: 2 } }], [90, { deco: 'fireworks' }], [160, { items: { lucky: 2 } }], [260, { coins: 800, items: { pollen: 2 } }]]),
    shop: [{ id: 'fireworks', deco: 'fireworks', price: 45 }, ...SHOP_BASIC] },
  { id: 'spring', name: 'Frühlingsblüte', start: '03-01', end: '03-20', token: 'Knospen', color: '#ff6fa0',
    desc: 'Der Garten erwacht – doppelt so viele Knospen für frühe Gärtner.',
    milestones: MS([[20, { coins: 100 }], [60, { items: { fert: 3 } }], [150, { items: { turbo: 2 } }], [300, { coins: 600, items: { lucky: 1 } }]]),
    shop: SHOP_BASIC },
  { id: 'summer', name: 'Sommerfest', start: '07-01', end: '07-31', token: 'Sonnenstrahlen', color: '#ffb81c',
    desc: 'Lange Sommertage und warme Nächte im Garten – mit Sonnenschirm und Limonade.',
    milestones: MS([[20, { coins: 100 }], [60, { items: { fert: 3 } }], [150, { deco: 'parasol' }], [300, { coins: 600, items: { lucky: 1 } }]]),
    shop: [{ id: 'parasol', deco: 'parasol', price: 60 }, ...SHOP_BASIC] },
  { id: 'autumn', name: 'Herbstfest', start: '09-20', end: '10-23', token: 'Herbstblätter', color: '#e8641f',
    desc: 'Sammle beim Ernten Herbstblätter und tausche sie gegen exklusive Belohnungen.',
    milestones: MS([[20, { coins: 100 }], [50, { items: { fert: 3 } }], [100, { deco: 'pumpkinLantern' }], [180, { items: { turbo: 2 } }], [300, { skin: 'autumn', coins: 300 }]]),
    shop: [{ id: 'leafPile', deco: 'leafPile', price: 40 }, ...SHOP_BASIC] },
  { id: 'winter', name: 'Wintermarkt', start: '12-01', end: '12-26', token: 'Schneeflocken', color: '#4aa3ff',
    desc: 'Adventszeit mit Lichterglanz: Schmücke den Garten mit Tannenbaum und Schneemann.',
    milestones: MS([[20, { coins: 100 }], [60, { items: { fert: 3 } }], [120, { deco: 'snowman' }], [200, { items: { turbo: 2, lucky: 1 } }], [320, { deco: 'xmasTree', coins: 600 }]]),
    shop: [{ id: 'snowman', deco: 'snowman', price: 50 }, ...SHOP_BASIC] },
];
// Jedes Wochenende: doppelte Chance auf Funkelblüten
// Lichtquellen im Garten (Höhe und Reichweite in Metern) – leuchten automatisch ab der Dämmerung
export const LIGHTS = { lantern: [1.7, 5], torch: [1.1, 4], lampPost: [2.0, 6.5], groundLights: [0.3, 3.2], stringLights: [1.75, 5.5], pumpkinLantern: [0.5, 3.5], ghostLantern: [0.9, 4], cauldron: [0.7, 3.5], xmasTree: [1.2, 5], fireworks: [0.6, 3] };

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
