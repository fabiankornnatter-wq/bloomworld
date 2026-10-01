// BloomWorld – Start, Spielschleife, Eingabe und Spielaktionen.
import { World } from './world/scene.js';
import { environment } from './world/sky.js';
import * as G from './game.js';
import * as C from './config.js';
import { LocalStore, SaveManager, SAVE_KEY } from './storage.js';
import { Sound } from './audio.js';
import { UI, fmtTime } from './ui.js';
import * as Pay from './payments.js';
import * as I from './icons.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
let timeOffset = 0;
const now = () => Date.now() + timeOffset;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const coarse = matchMedia('(pointer: coarse)').matches;

const store = new LocalStore();
const sound = new Sound();
let state, world, ui, saver, migrated = false, started = false, freshSave = false;
// Zeitgesteuerte Effekte; beim Zurücksetzen werden alte verworfen
let gen = 0;
const later = (fn, ms) => { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); };

// ---------- Fehlerbehandlung ----------
let lastErr = 0;
function reportError(e) {
  console.error(e);
  if (!ui) { showFatal('Beim Laden ist ein Fehler aufgetreten. Bitte lade die Seite neu.', e); return; }
  if (Date.now() - lastErr > 8000) { lastErr = Date.now(); ui.toast('Ups, da hat etwas nicht geklappt. Dein Spielstand ist sicher gespeichert.', 'err'); }
}
addEventListener('error', (e) => reportError(e.error || e.message));
addEventListener('unhandledrejection', (e) => reportError(e.reason));

function showFatal(text, err) {
  $('loader').hidden = false;
  $('loader').classList.remove('done');
  $('lmsg').innerHTML = `<div class="err">${text}</div>`;
  $('playBtn').hidden = false;
  $('playBtn').textContent = 'Erneut versuchen';
  $('playBtn').onclick = () => location.reload();
  if (err) console.error(err);
}

function progress(p, msg) { $('lbar').style.width = p + '%'; if (msg) $('lmsg').textContent = msg; }

const resolveQuality = (q) => (q === 'auto' ? (coarse ? 'medium' : 'high') : q);

// ---------- Start ----------
async function boot() {
  $('bloomIcon').innerHTML = I.bloom;
  progress(10, 'Spielstand wird geladen …');
  let raw = null, loadFailed = false;
  try { raw = await store.load(); } catch (e) { loadFailed = true; console.warn(e); }
  const m = G.migrate(raw, now());
  state = m.state; migrated = m.migrated; freshSave = !raw || m.migrated || !!m.discarded;
  await nextFrame();
  progress(35, 'Garten wird gebaut …');
  await nextFrame();
  try {
    world = new World($('world'), resolveQuality(state.settings.quality));
  } catch (e) {
    if (e.code === 'WEBGL_UNAVAILABLE') showFatal('Dein Browser kann die 3D-Grafik (WebGL) leider nicht anzeigen. Bitte öffne BloomWorld in einem aktuellen Chrome und prüfe, ob die Hardwarebeschleunigung aktiviert ist.', e);
    else showFatal('Die Grafik konnte nicht gestartet werden. Bitte lade die Seite neu.', e);
    return;
  }
  progress(70, 'Blumen werden gemalt …');
  await nextFrame();
  const icons = world.makeIcons();
  ui = new UI({ state: () => state, now, icons, sound, act: actions, world });
  ui.init();
  saver = new SaveManager(store, () => state, {
    onError: () => ui.toast('Speichern nicht möglich. Ist der private Modus aktiv oder der Speicher voll?', 'err'),
    onConflict: () => adoptExternal(),
  });
  saver.setKnown(raw && raw.v === G.SAVE_VERSION ? raw.updatedAt : 0);
  world.syncDeco(state.deco);
  world.syncSkins(state.activeSkin);
  applySound();
  setupInput();
  progress(100, 'Bereit!');
  requestAnimationFrame(loop);
  $('playBtn').hidden = false;
  $('playBtn').onclick = start;
  if (loadFailed) ui.toast('Der alte Spielstand konnte nicht gelesen werden. Er wurde gesichert, es beginnt ein neuer Garten.', 'err');
  else if (store.volatile) ui.toast('Dein Browser blockiert das Speichern. Der Fortschritt geht beim Schließen verloren.', 'err');
  if (DEBUG) window.BW = { get state() { return state; }, world, ui, G, skip: (ms) => { timeOffset += ms; }, save: () => saver.flush(), actions };
}

function start() {
  if (started) return;
  started = true;
  sound.unlock();
  sound.play('open');
  $('loader').classList.add('done');
  setTimeout(() => { $('loader').hidden = true; }, 600);
  if (migrated) ui.toast('Willkommen zurück! Dein bisheriger Spielstand wurde übernommen.', 'good');
  if (freshSave) saver.request();
}

function applySound() {
  const st = state.settings;
  sound.set({ musicOn: st.music, soundOn: st.sound, musicVol: st.musicVol, soundVol: st.soundVol });
}

// ---------- Spielschleife ----------
let last = performance.now(), hudTick = 1, perf = { t: 0, frames: 0, checks: 0 }, dayTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const real = Math.max(0, (t - last) / 1000);
  const dt = Math.min(0.05, real);
  last = t;
  const n = now();
  G.ensureDaily(state, n);
  const infos = state.beds.map((_, i) => G.bedInfo(state, i, n));
  const env = environment(G.cyclePhase(state, n));
  if (!ui.coveredFor(300)) {
    world.syncBeds(infos);
    world.update(dt, env);
    world.render(env);
  }
  ui.frame(infos, n);
  hudTick += real;
  if (hudTick > 0.5) {
    hudTick = 0;
    ui.setTime(env);
    sound.night = env.name === 'night';
  }
  // Schmetterling gilt als entdeckt, wenn man ihn eine Weile am Tag sieht
  if (started && env.name !== 'night') { dayTime += dt; if (dayTime > 12 && !state.seenAnimals.includes('butterfly')) discover('butterfly'); }
  autoQuality(dt);
}

function autoQuality(dt) {
  if (state.settings.quality !== 'auto' || !started || document.hidden) return;
  perf.t += dt; perf.frames++;
  if (perf.t < 4) return;
  const fps = perf.frames / perf.t;
  perf.t = 0; perf.frames = 0; perf.checks++;
  if (fps < 30 && world.r.quality !== 'low') {
    world.r.setQuality(world.r.quality === 'high' ? 'medium' : 'low');
    console.info('Grafik automatisch reduziert auf', world.r.quality, `(${fps.toFixed(0)} FPS)`);
  }
}

// ---------- Eingabe: Tippen, Wischen, Zoomen ----------
function setupInput() {
  const cv = $('world');
  const pts = new Map();
  let g = null;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch { /* egal */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) g = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), moved: false };
    else if (pts.size === 2 && g) { g.pinch = dist(); g.moved = true; }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !g) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 9) g.moved = true;
      if (g.moved) world.pan(e.clientX - g.lx, e.clientY - g.ly);
      g.lx = e.clientX; g.ly = e.clientY;
    } else if (pts.size === 2 && g.pinch) {
      const d = dist();
      world.zoomBy(g.pinch / d);
      g.pinch = d;
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (g && !g.moved && pts.size === 0 && e.type === 'pointerup' && performance.now() - g.t0 < 650) tap(e.clientX, e.clientY);
    if (pts.size === 0) g = null;
    else if (g) { const p = [...pts.values()][0]; g.lx = p.x; g.ly = p.y; g.pinch = 0; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); world.zoomBy(e.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  // Wischen, das auf einer Blase beginnt, soll ebenfalls die Kamera bewegen
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); saver?.flush(); showFatal('Die Grafik wurde vom Gerät kurz unterbrochen. Tippe auf „Erneut versuchen“ – dein Spielstand ist gespeichert.'); });
  addEventListener('resize', () => world.r.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saver.flush(); sound.suspend(); } else if (started) sound.resume();
  });
  addEventListener('pagehide', () => saver.flush());
  // Anderes Fenster/Tab hat gespeichert -> übernehmen statt später zu überschreiben
  addEventListener('storage', (e) => { if (e.key === SAVE_KEY && e.newValue) adoptExternal(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') ui.back(); });
  // Android-Zurück-Taste schließt Menüs statt das Spiel zu verlassen
  addEventListener('popstate', () => ui.onPopState());
}

function tap(x, y) {
  if (!started) return;
  const b = ui.bubbleAt(x, y);
  if (b !== null) { actions.tapBed(b); return; }
  const hit = world.pick(x, y);
  if (!hit || hit.type === 'ground') { if (ui.sheetBed >= 0) ui.closeSheet(); return; }
  if (hit.type === 'bed') actions.tapBed(hit.index);
  else if (hit.type === 'animal') {
    world.poke(hit.id);
    sound.play('animal');
    if (!state.seenAnimals.includes(hit.id)) discover(hit.id);
  }
}

function discover(id) {
  state.seenAnimals.push(id);
  ui.toast(`Neu entdeckt: ${C.ANIMALS[id].name}! Schau in deine Sammlung.`, 'good');
  changed();
}

// ---------- Aktionen ----------
function changed() { saver.request(); ui.refresh(); }
function fail(r) {
  sound.play('error');
  if (r.code === 'noCoins') ui.toast(r.message, 'err', { label: 'Shop', fn: () => ui.nav('shop', 'offers') });
  else ui.toast(r.message, 'err');
}
// Mehrere Level-Aufstiege werden zu einem Dialog zusammengefasst
let pendingLevel = null, levelTimer = null;
function afterLevelUps(ups) {
  if (!ups || !ups.length) return;
  for (const up of ups) {
    if (!pendingLevel) pendingLevel = { level: up.level, reward: 0, unlocks: [] };
    pendingLevel.level = Math.max(pendingLevel.level, up.level);
    pendingLevel.reward += up.reward;
    pendingLevel.unlocks.push(...up.unlocks);
  }
  clearTimeout(levelTimer);
  const g = gen;
  levelTimer = setTimeout(() => { if (g !== gen || !pendingLevel) return; const up = pendingLevel; pendingLevel = null; sound.play('level'); ui.levelUp(up); }, 900);
}

async function adoptExternal() {
  try {
    const raw = await store.load();
    if (!raw) return;
    gen++;
    state = G.migrate(raw, now()).state;
    saver.setKnown(raw.updatedAt || 0);
    world.syncDeco(state.deco);
    world.syncSkins(state.activeSkin);
    world.r.setQuality(resolveQuality(state.settings.quality));
    applySound();
    ui.refresh();
    ui.toast('Dein Spielstand wurde aus einem anderen Fenster übernommen.');
  } catch (e) { console.warn(e); }
}

const actions = {
  tapBed(i) {
    const info = G.bedInfo(state, i, now());
    if (!info) return;
    if (info.locked) { sound.play('tap'); ui.closeSheet(); ui.bedLockedDialog(i); }
    else if (info.empty) { ui.openSeedSheet(i); }
    else if (info.ready) actions.harvest(i);
    else { sound.play('tap'); ui.closeSheet(); ui.toast(`${C.SEEDS[info.seed].name} wächst noch – fertig in ${fmtTime(info.remaining)}.`); }
  },

  plant(i, seed) {
    if (i < 0) return;
    const r = G.plant(state, i, seed, now());
    if (!r.ok) return fail(r);
    state.selectedSeed = seed;
    world.burst(i, 'plant');
    sound.play('plant');
    ui.closeSheet();
    changed();
  },

  plantAll(seed) {
    let n = 0, last = null;
    state.beds.forEach((b, i) => {
      if (b.locked || b.seed) return;
      const r = G.plant(state, i, seed, now());
      if (r.ok) { n++; world.burst(i, 'plant'); } else last = r;
    });
    if (!n) return fail(last || { message: 'Kein freies Beet.' });
    state.selectedSeed = seed;
    sound.play('plant');
    ui.closeSheet();
    ui.toast(last ? `${n} Beete bepflanzt – für mehr fehlen Münzen.` : `${n} Beete bepflanzt!`, 'good');
    changed();
  },

  harvest(i) {
    const r = G.harvest(state, i, now());
    if (!r.ok) return fail(r);
    world.burst(i, 'harvest', r.seed);
    sound.play(r.golden ? 'gold' : 'harvest');
    ui.floatReward(i, r.reward, r.golden);
    if (r.golden) ui.toast(`Goldene ${C.SEEDS[r.seed].name}! Dreifache Belohnung.`, 'good');
    changed();
    afterLevelUps(r.levelUps);
  },

  harvestAll() {
    const n = now();
    const ready = state.beds.map((_, i) => G.bedInfo(state, i, n)).filter((x) => x && x.ready).map((x) => x.i);
    if (!ready.length) return;
    let golden = 0;
    const ups = [];
    ready.forEach((i, k) => {
      const r = G.harvest(state, i, n);
      if (!r.ok) return;
      if (r.golden) golden++;
      ups.push(...r.levelUps);
      later(() => { world.burst(i, 'harvest', r.seed); ui.floatReward(i, r.reward, r.golden); }, k * 140);
    });
    sound.play(golden ? 'gold' : 'harvest');
    if (golden) ui.toast(golden > 1 ? `${golden} goldene Blüten! Dreifache Belohnung.` : 'Eine goldene Blüte! Dreifache Belohnung.', 'good');
    changed();
    afterLevelUps(ups);
  },

  unlockBed(i) {
    const r = G.unlockBed(state, i);
    if (!r.ok) return fail(r);
    sound.play('unlock');
    world.burst(i, 'plant');
    ui.toast('Neues Beet freigeschaltet!', 'good');
    changed();
  },

  gift() {
    const r = G.claimDailyGift(state, now());
    if (!r.ok) return fail(r);
    sound.play('buy');
    ui.toast(`+${r.reward} Münzen – bis morgen!`, 'good');
    ui.bumpCoins();
    changed();
  },

  async iap(id) {
    const r = await Pay.purchase(id);
    sound.play('tap');
    ui.modal({ title: 'Bald verfügbar', html: `${I.coinChest().replace('<svg', '<svg style="width:96px;height:86px"')}<p>${r.message}</p>`, buttons: [['OK', 'closeModal', '']] });
  },

  async video() {
    const r = await Pay.showRewardedVideo();
    sound.play('tap');
    ui.modal({ title: 'Gratis-Münzen', html: `${I.video.replace('<svg', '<svg style="width:96px;height:96px"')}<p>${r.message}</p>`, buttons: [['OK', 'closeModal', '']] });
  },

  unlockRare(id) {
    const r = G.unlockRareSeed(state, id);
    if (!r.ok) return fail(r);
    sound.play('buy');
    ui.toast(`${C.SEEDS[id].name} freigeschaltet – jetzt im Beet pflanzbar!`, 'good');
    changed();
  },

  buyDeco(id) {
    const r = G.buyDeco(state, id);
    if (!r.ok) return fail(r);
    world.syncDeco(state.deco);
    sound.play('buy');
    ui.toast(`${C.DECO[id].name} steht jetzt in deinem Garten!`, 'good', { label: 'Ansehen', fn: () => { ui.nav('garden'); const o = world.deco[id][0]; world.focus(o.model[12], o.model[14], 0.75); } });
    changed();
  },

  buySkin(id) {
    const r = G.buySkin(state, id);
    if (!r.ok) return fail(r);
    world.syncSkins(state.activeSkin);
    sound.play('buy');
    ui.toast(`${C.SKINS[id].name} gekauft und angezogen!`, 'good');
    changed();
  },

  equip(animal, id) {
    const r = G.equipSkin(state, animal, id);
    if (!r.ok) return fail(r);
    world.syncSkins(state.activeSkin);
    sound.play('tap');
    changed();
  },

  claim(id) {
    const r = G.claimTask(state, id, now());
    if (!r.ok) return fail(r);
    sound.play('buy');
    ui.toast(`Aufgabe erledigt: +${r.reward} Münzen`, 'good');
    ui.bumpCoins();
    changed();
    afterLevelUps(r.levelUps);
  },

  async share() {
    const url = location.origin + location.pathname;
    const data = { title: 'BloomWorld', text: 'Komm mit in meinen Garten bei BloomWorld! 🌸', url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      ui.toast('Link kopiert – schick ihn deinen Freunden!', 'good');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      ui.toast(`Teile diesen Link: ${url}`);
    }
  },

  setting(key, val, live) {
    if (['cycleMin', 'musicVol', 'soundVol'].includes(key)) val = Number(val);
    const r = G.setSetting(state, key, val, now());
    if (!r.ok) return fail({ message: 'Diese Einstellung ist ungültig.' });
    if (key === 'quality') world.r.setQuality(resolveQuality(val));
    if (['music', 'sound', 'musicVol', 'soundVol'].includes(key)) { applySound(); if (key === 'sound' && val) sound.play('tap'); }
    if (!live) sound.play('tap');
    saver.request();
    if (!live) ui.refresh();
  },

  reset() {
    gen++; pendingLevel = null; clearTimeout(levelTimer); dayTime = 0;
    state = G.newState(now());
    store.clear().finally(() => saver.flush(true));
    world.syncDeco(state.deco);
    world.syncSkins(state.activeSkin);
    world.r.setQuality(resolveQuality(state.settings.quality));
    applySound();
    world.resetView();
    ui.closeModal();
    ui.nav('garden');
    ui.refresh();
    ui.toast('Spielstand gelöscht – viel Spaß mit deinem neuen Garten!', 'good');
  },
};

boot().catch((e) => showFatal('BloomWorld konnte nicht starten. Bitte lade die Seite neu.', e));
