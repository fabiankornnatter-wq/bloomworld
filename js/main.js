// BloomWorld – Start, Anmeldung, Spielschleife, Eingabe und Spielaktionen.
import { World } from './world/scene.js';
import { environment } from './world/sky.js';
import * as G from './game.js';
import * as C from './config.js';
import { LocalStore, SaveManager, accountKey } from './storage.js';
import { api as Net, CloudSync } from './account.js';
import { SocialHub, socialApi, loadNews } from './social.js';
import { showAuth } from './authui.js';
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
const plain = (s) => String(s).replace(/­/g, '');

const sound = new Sound();
const guestStore = new LocalStore();
let store = null, state, world, ui, saver, cloud = null, user = null, icons;
let hub = null;    // Freunde & Chat (nur mit Konto)
let visit = null;  // Besuch im Garten eines Freundes: { id, name, state, skew, helpLeft, liked, queued }
let migrated = false, started = false, freshSave = false, entered = false;
// Zeitgesteuerte Effekte; beim Zurücksetzen werden alte verworfen
let gen = 0;
const later = (fn, ms) => { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); };

// ---------- Fehlerbehandlung ----------
let lastErr = 0;
function reportError(e) {
  console.error(e);
  if (!ui) { if (!entered) showFatal('Beim Laden ist ein Fehler aufgetreten. Bitte lade die Seite neu.', e); return; }
  if (Date.now() - lastErr > 8000) { lastErr = Date.now(); ui.toast('Ups, da hat etwas nicht geklappt. Dein Spielstand ist sicher gespeichert.', 'err'); }
}
addEventListener('error', (e) => reportError(e.error || e.message));
addEventListener('unhandledrejection', (e) => reportError(e.reason));

function showFatal(text, err) {
  $('loader').hidden = false;
  $('loader').classList.remove('done');
  $('authBox').hidden = true;
  $('lmsg').innerHTML = `<div class="err">${text}</div>`;
  $('playBtn').hidden = false;
  $('playBtn').textContent = 'Erneut versuchen';
  $('playBtn').onclick = () => location.reload();
  if (err) console.error(err);
}

function progress(p, msg) { $('lbar').style.width = p + '%'; if (msg !== undefined) $('lmsg').textContent = msg; }

const resolveQuality = (q) => (q === 'auto' ? (coarse ? 'medium' : 'high') : q);

// ---------- Start ----------
async function boot() {
  $('bloomIcon').innerHTML = I.bloom;
  progress(8, 'Verbindung wird hergestellt …');
  const mePromise = Net.me();
  await nextFrame();
  progress(25, 'Garten wird gebaut …');
  await nextFrame();
  try {
    world = new World($('world'), resolveQuality('auto'));
  } catch (e) {
    if (e.code === 'WEBGL_UNAVAILABLE') showFatal('Dein Browser kann die 3D-Grafik (WebGL) leider nicht anzeigen. Bitte öffne BloomWorld in einem aktuellen Chrome und prüfe, ob die Hardwarebeschleunigung aktiviert ist.', e);
    else showFatal('Die Grafik konnte nicht gestartet werden. Bitte lade die Seite neu.', e);
    return;
  }
  progress(60, 'Blumen werden gemalt …');
  await nextFrame();
  icons = world.makeIcons();
  requestAnimationFrame(loop);
  progress(85, 'Konto wird geprüft …');
  const me = await mePromise;
  // Gültige Sitzung: direkt in den Garten (abschaltbar in den Einstellungen)
  if (me.ok && me.user) await enter(me.user, autoStart(), false, true);
  else askLogin(me);
}

function autoStart() { try { return localStorage.getItem('bw_autostart') !== '0'; } catch { return true; } }

// Zuletzt angemeldeter Spieler (nur Name und Kennung) – für Offline-Spiel mit dem Konto-Stand dieses Geräts
const LAST_USER_KEY = 'bw_last_user';
const lastUser = () => { try { const u = JSON.parse(localStorage.getItem(LAST_USER_KEY)); return u && /^[a-f0-9]{24}$/.test(u.id) ? u : null; } catch { return null; } };
const setLastUser = (u) => { try { if (u) localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email })); else localStorage.removeItem(LAST_USER_KEY); } catch { /* egal */ } };

function askLogin(me) {
  progress(100, '');
  $('lbarWrap').hidden = true;
  const offline = !me.ok && me.status !== 401;
  const reason = me.status === 503 ? 'Die Anmeldung wird gerade eingerichtet und ist in Kürze möglich.' : me.message;
  const last = offline ? lastUser() : null;
  showAuth({
    offline, reason, lastUser: last,
    unlock: () => sound.unlock(),
    onDone: (u, isNew) => enter(u, true, isNew),
    onOffline: () => enter(last, true),
  });
}

// Neu laden, ohne einen Eintrag der Zurück-Taste übrig zu lassen
function reloadPage() {
  if (ui?.guard) {
    ui.ignorePop = true;
    addEventListener('popstate', () => location.reload(), { once: true });
    history.back();
    setTimeout(() => location.reload(), 700);
  } else location.reload();
}

// Spielstand für Konto (oder offline) laden und das Spiel vorbereiten
async function enter(u, autoStart, isNew = false, resumed = false) {
  if (entered) return;
  entered = true;
  user = u;
  $('lbarWrap').hidden = false;
  progress(92, 'Spielstand wird geladen …');
  let raw = null, srvRev = 0, needPush = false, fromGuest = false, loadFailed = false, serverOk = true;
  if (u) {
    store = new LocalStore(null, accountKey(u.id));
    let cached = null;
    try { cached = await store.load(); } catch (e) { loadFailed = true; console.warn(e); }
    const srv = await Net.load();
    if (srv.status === 401) { entered = false; user = null; askLogin({ status: 401 }); return; }
    serverOk = srv.ok;
    const server = srv.ok ? srv.save : null;
    srvRev = srv.ok ? srv.rev : 0;
    if (server && cached) raw = newerSave(cached, server) === cached && cached.updatedAt !== server.updatedAt ? cached : server;
    else raw = server || cached;
    // Neues Konto: bisherigen Garten von diesem Gerät übernehmen
    if (!raw && srv.ok) { try { const g = await guestStore.load(); if (g) { raw = g; fromGuest = true; } } catch { /* egal */ } }
    needPush = !!raw && raw !== server;
  } else {
    store = guestStore;
    try { raw = await store.load(); } catch (e) { loadFailed = true; console.warn(e); }
  }
  if (raw && raw.v > G.SAVE_VERSION) { showFatal('Es gibt eine neue Version von BloomWorld. Bitte lade die Seite neu.'); return; }
  const m = G.migrate(raw, now());
  state = m.state; migrated = m.migrated && !fromGuest;
  if (u) setLastUser(u);
  freshSave = !raw || m.migrated || !!m.discarded || fromGuest;

  saver = new SaveManager(store, () => state, {
    onError: () => ui?.toast('Speichern auf diesem Gerät nicht möglich. Ist der private Modus aktiv oder der Speicher voll?', 'err'),
    onConflict: () => adoptExternal(),
  });
  saver.setKnown(store.peekUpdatedAt());
  if (u) {
    cloud = new CloudSync(() => state, {
      onConflict: (server) => {
        if (server && newerSave(state, server) === server) { adoptState(server, 'Du hast auf einem anderen Gerät weitergespielt – dieser Stand wurde übernommen.', true); return false; }
        return true;
      },
      onRemote: (server) => adoptState(server, 'Dein Spielstand vom anderen Gerät wurde geladen.'),
      onOutdated: () => ui?.toast('Es gibt eine neue Version von BloomWorld. Bitte lade die Seite neu.', 'err', { label: 'Neu laden', fn: () => reloadPage() }),
      onAuthLost: () => ui?.toast('Deine Anmeldung ist abgelaufen. Dein Fortschritt ist auf diesem Gerät gesichert.', 'err', { label: 'Anmelden', fn: () => relogin() }),
      onStatus: () => { if (ui?.panel === 'settings') ui.refresh(); },
    });
    cloud.rev = srvRev;
  }
  if (fromGuest) await guestStore.retire();

  world.r.setQuality(resolveQuality(state.settings.quality));
  world.syncLayout(state);
  world.syncSkins(state.activeSkin);
  world.syncGreenhouse(state.greenhouse.unlocked);
  if (u && serverOk) {
    hub = new SocialHub({
      onChange: (kind, info) => ui?.socialChanged(kind, info),
      onInbox: (items) => receiveInbox(items),
      onAuthLost: () => hub?.stop(),
    });
  }
  ui = new UI({ state: () => state, now, icons, sound, act: actions, world, account: () => ({ user, status: cloud?.status, lastSaved: cloud?.lastSaved }), isNight, social: () => hub, visiting: () => visit });
  ui.init();
  applySound();
  setupInput();
  if (DEBUG) window.BW = { get state() { return state; }, world, ui, G, skip: (ms) => { timeOffset += ms; }, save: () => saver.flush(), actions, get cloud() { return cloud; }, get user() { return user; }, get hub() { return hub; }, get visit() { return visit; } };

  if (needPush || freshSave) persist(false);
  progress(100, 'Bereit!');
  const notes = [];
  if (fromGuest) notes.push(['Dein bisheriger Garten wurde in dein Konto übernommen.', 'good']);
  else if (migrated) notes.push(['Willkommen zurück! Dein Spielstand wurde auf die neue Version gebracht.', 'good']);
  if (loadFailed) notes.push(['Der gespeicherte Stand auf diesem Gerät war beschädigt und wurde gesichert.', 'err']);
  if (u && !serverOk) notes.push(['Server gerade nicht erreichbar – du spielst mit dem Stand von diesem Gerät. Er wird später hochgeladen.', 'err']);
  if (!u && store.volatile) notes.push(['Dein Browser blockiert das Speichern. Der Fortschritt geht beim Schließen verloren.', 'err']);
  if (isNew) notes.unshift([`Willkommen, ${escapeHtml(u.name)}! Dein Konto ist bereit.`, 'good']);
  else if (resumed && autoStart && u) notes.unshift([`Willkommen zurück, ${escapeHtml(u.name)}!`, 'good']);
  const showNotes = () => notes.forEach(([t, k], i) => setTimeout(() => ui.toast(t, k), 400 + i * 3000));

  if (autoStart) { start(); showNotes(); return; }
  // Angemeldet zurück: ein Tipp auf „Spielen“ schaltet auch den Ton frei
  $('userLine').innerHTML = u ? `Angemeldet als <b>${escapeHtml(u.name)}</b> · <button class="link" id="switchUser">Abmelden</button>` : '';
  $('userLine').hidden = !u;
  $('playBtn').hidden = false;
  $('playBtn').onclick = () => { start(); showNotes(); };
  const sw = $('switchUser');
  if (sw) sw.onclick = () => actions.logout();
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function start() {
  if (started) return;
  started = true;
  sound.unlock();
  // Ohne Tipp (automatischer Start) gibt der Browser den Ton erst beim ersten Berühren frei
  addEventListener('pointerdown', () => sound.unlock(), { once: true, capture: true });
  sound.play('open');
  $('loader').classList.add('done');
  setTimeout(() => { $('loader').hidden = true; }, 600);
  hub?.start();
  showNews();
}

// Ankündigungen vom BloomWorld-Team: neue werden einmal beim Start gezeigt
const NEWS_SEEN = 'bw_news_seen';
async function showNews() {
  const r = await loadNews();
  if (!r.ok || !Array.isArray(r.news)) return;
  ui.news = r.news;
  if (!r.news.length) return;
  let seen = 0; try { seen = Number(localStorage.getItem(NEWS_SEEN)) || 0; } catch { /* egal */ }
  // Neue Spieler sehen nur die neueste Meldung, alle anderen alles seit dem letzten Besuch (höchstens 3)
  const fresh = r.news.filter((n) => n.ts > seen).slice(0, seen ? 3 : 1);
  try { localStorage.setItem(NEWS_SEEN, String(r.news[0].ts)); } catch { /* egal */ }
  if (fresh.length) ui.modal({ queue: true, title: fresh.length > 1 ? 'Neuigkeiten' : 'Neuigkeit', cls: 'newsdlg', html: fresh.map((n) => ui.newsHtml(n)).join(''), buttons: [['Super!', 'closeModal', '']] });
  if (ui.panel === 'events') ui.renderPanel(true);
}

// Post von Freunden: Geschenke, Hilfe beim Gießen, Herzen
function receiveInbox(items) {
  if (!state) return;
  const ev = G.applyInbox(state, items, now());
  if (!ev.length) return;
  ev.forEach((e, k) => later(() => {
    if (e.k === 'gift') { sound.play('buy'); ui.toast(`🎁 ${escapeHtml(e.name)} hat dir ${e.n}× ${C.ITEMS[e.item].name} geschenkt!`, 'good'); }
    else if (e.k === 'help') {
      if (!visit) e.beds.forEach((i) => world.burst(i, 'water'));
      if (e.beds.length) { sound.play('water'); ui.toast(`💧 ${escapeHtml(e.name)} hat ${e.beds.length === 1 ? 'eine Blume' : `${e.beds.length} Blumen`} in deinem Garten gegossen!`, 'good'); }
    } else if (e.k === 'like') { sound.play('magic'); ui.toast(`💖 ${escapeHtml(e.name)} findet deinen Garten wunderschön!${e.coins ? ` +${e.coins} Münzen` : ''}`, 'good'); ui.bumpCoins(); }
  }, k * 3200));
  changed();
}

function applySound() {
  const st = state.settings;
  sound.set({ musicOn: st.music, soundOn: st.sound, musicVol: st.musicVol, soundVol: st.soundVol });
}

const isNight = () => !!state && environment(G.cyclePhase(state, now())).name === 'night';

// ---------- Spielschleife ----------
let last = performance.now(), hudTick = 1, perf = { t: 0, frames: 0, checks: 0 }, dayTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const real = Math.max(0, (t - last) / 1000);
  const dt = Math.min(0.05, real);
  last = t;
  if (!state) return; // vor der Anmeldung verdeckt der Startbildschirm den Garten
  const n = now();
  G.ensureDaily(state, n);
  const shown = visit ? visit.state : state, vn = visit ? Date.now() + visit.skew : n;
  const infos = shown.beds.map((_, i) => G.bedInfo(shown, i, vn));
  const env = environment(G.cyclePhase(state, n));
  if (drag?.moved) dragEdgePan(dt);
  if (!ui.coveredFor(300)) {
    world.syncBeds(infos);
    world.update(dt, env);
    world.render(env);
  }
  ui.frame(infos, visit ? vn : n);
  hudTick += real;
  if (hudTick > 0.5) {
    hudTick = 0;
    ui.setTime(env);
    sound.night = env.name === 'night';
    storyCheck();
  }
  if (started && env.name !== 'night') { dayTime += dt; if (dayTime > 12 && !state.seenAnimals.includes('butterfly')) discover('butterfly'); }
  autoQuality(dt);
}

// Neues Story-Kapitel? Ophelia stellt es vor, sobald nichts anderes offen ist
function storyCheck() {
  if (!started || ui.busy || ui.panel || ui.sheetBed >= 0 || ui.mode) return;
  const st = G.storyStatus(state);
  if (st.finished || !st.showIntro) return;
  G.markIntroSeen(state);
  persist(false);
  ui.storyIntro(st);
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
    if (pts.size === 1) {
      g = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), moved: false };
      // Gestalten: Objekt unter dem Finger greifen
      if (ui?.edit && started) { const ref = world.pickEditable(e.clientX, e.clientY, state); if (ref) { dragStart(ref, e.clientX, e.clientY); g.drag = true; } }
    } else if (pts.size === 2 && g) { if (g.drag) dragEnd(true); g.drag = false; g.pinch = dist(); g.moved = true; }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !g) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.drag) { if (drag) { drag.px = e.clientX; drag.py = e.clientY; } if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) { g.moved = true; dragMove(e.clientX, e.clientY); } return; }
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
    if (g?.drag) { dragEnd(e.type !== 'pointerup'); g = pts.size ? g : null; if (g) g.drag = false; return; }
    if (g && !g.moved && pts.size === 0 && e.type === 'pointerup' && performance.now() - g.t0 < 650) tap(e.clientX, e.clientY);
    if (pts.size === 0) g = null;
    else if (g) { const p = [...pts.values()][0]; g.lx = p.x; g.ly = p.y; g.pinch = 0; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); world.zoomBy(e.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  // Kein „Geister-Klick“ nach dem Tippen: sonst träfe er die gerade geöffnete Leiste
  cv.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); flushAll(); showFatal('Die Grafik wurde vom Gerät kurz unterbrochen. Tippe auf „Erneut versuchen“ – dein Spielstand ist gespeichert.'); });
  addEventListener('resize', () => world.r.resize());
  // Die Spielfläche darf nie verrutschen (z.B. durch Fokus oder scrollIntoView)
  $('app').addEventListener('scroll', (e) => { if (e.target.scrollTop || e.target.scrollLeft) e.target.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flushAll(true); sound.suspend(); } else if (started) { sound.resume(); cloud?.checkRemote(); }
  });
  addEventListener('pagehide', () => flushAll(true));
  // Anderes Fenster/Tab mit demselben Spielstand hat gespeichert -> übernehmen statt überschreiben
  addEventListener('storage', (e) => { if (e.key === store.key && e.newValue) adoptExternal(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ui.back();
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  addEventListener('popstate', () => ui.onPopState());
}

function flushAll(leaving) { saver?.flush(); cloud?.flush({ keepalive: !!leaving }); }

// ---------- Gestalten: Ziehen & Ablegen ----------
let drag = null;
const sameRef = (a, b) => a && b && a.type === b.type && a.i === b.i && a.k === b.k;
function showSel() {
  const e = ui.edit;
  if (!e?.sel) { world.hideMarker(); return; }
  const [w, d] = G.footprint(state, e.sel, e.pos[2]);
  world.showMarker(e.pos[0], e.pos[1], w, d, e.valid);
}
function editSelect(ref) {
  if (!ui.edit) return;
  if (ui.edit.sel && !sameRef(ui.edit.sel, ref)) actions.editDeselect();
  const p = G.objectPos(state, ref);
  if (!p) return;
  Object.assign(ui.edit, { sel: ref, pos: [...p], orig: [...p], valid: true });
  sound.play('tap');
  showSel();
  ui.renderEditBar();
}
function dragStart(ref, px, py) {
  if (!sameRef(ui.edit.sel, ref)) editSelect(ref);
  const gp = world.groundAt(px, py), e = ui.edit;
  drag = { off: gp ? [e.pos[0] - gp[0], e.pos[1] - gp[1]] : [0, 0], moved: false };
}
function dragMove(px, py) {
  const e = ui.edit;
  if (!drag || !e?.sel) return;
  const gp = world.groundAt(px, py);
  if (!gp) return;
  const snap = (v) => Math.round(v / C.SNAP) * C.SNAP;
  const x = snap(gp[0] + drag.off[0]), z = snap(gp[1] + drag.off[1]);
  if (x === e.pos[0] && z === e.pos[1]) return;
  drag.moved = true;
  e.pos = [x, z, e.pos[2]];
  const ok = G.canPlace(state, e.sel, x, z, e.pos[2]).ok;
  if (ok !== e.valid) { e.valid = ok; ui.renderEditBar(); }
  world.preview(e.sel, x, z, e.pos[2], 0.3); // beim Tragen leicht angehoben
  showSel();
}
// Am Bildschirmrand mitscrollen, damit man Dinge weit tragen kann
function dragEdgePan(dt) {
  if (!drag || !drag.px) return;
  const W = innerWidth, m = 34, sp = 480 * dt;
  const bottom = Math.min($('editBar').getBoundingClientRect().top || innerHeight, innerHeight - 90) - 6;
  let dx = 0, dy = 0;
  if (drag.px < m) dx = sp; else if (drag.px > W - m) dx = -sp;
  if (drag.py < 100) dy = sp; else if (drag.py > bottom) dy = -sp;
  if (!dx && !dy) return;
  world.pan(dx, dy);
  world.camAnim = null;
  dragMove(drag.px, drag.py);
}
function dragEnd(cancel) {
  const d = drag;
  drag = null;
  if (!d || !d.moved || !ui.edit?.sel) return;
  if (cancel) { const e = ui.edit; e.pos = [...e.orig]; e.valid = true; world.preview(e.sel, ...e.orig); showSel(); ui.renderEditBar(); return; }
  commitMove();
}
function commitMove() {
  const e = ui.edit;
  const r = G.moveObject(state, e.sel, e.pos[0], e.pos[1], e.pos[2]);
  if (r.ok) {
    e.orig = [...e.pos]; e.valid = true;
    if (r.moved) { sound.play('plant'); world.burstAt(e.pos[0], e.pos[1]); }
    changed();
  } else {
    sound.play('error');
    ui.toast(r.message, 'err');
    e.pos = [...e.orig]; e.valid = true;
    world.preview(e.sel, ...e.orig);
  }
  showSel();
  ui.renderEditBar();
}

function tap(x, y) {
  if (!started) return;
  if (ui.edit) {
    // Antippen im Gestalten-Modus: auswählen oder abwählen
    const ref = world.pickEditable(x, y, state);
    if (ref) editSelect(ref); else actions.editDeselect();
    return;
  }
  const b = ui.bubbleAt(x, y);
  if (visit) {
    // Zu Besuch: nur Blumen gießen und Tiere streicheln
    if (b !== null && b < C.BED_COUNT) { actions.visitWater(b); return; }
    const h = world.pick(x, y);
    if (h?.type === 'bed') actions.visitWater(h.index);
    else if (h?.type === 'animal') { world.poke(h.id); sound.play('animal'); }
    return;
  }
  if (b !== null) { if (b === C.BED_COUNT) actions.tapGreenhouse(); else actions.tapBed(b); return; }
  const hit = world.pick(x, y);
  if (!hit || hit.type === 'ground') { if (ui.sheetBed >= 0) ui.closeSheet(); return; }
  if (hit.type === 'bed') actions.tapBed(hit.index);
  else if (hit.type === 'greenhouse') actions.tapGreenhouse();
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

// ---------- Speichern ----------
function persist(countMove = true) { if (countMove) state.moves = (state.moves || 0) + 1; saver.request(); cloud?.request(); }

// Welcher von zwei Spielständen ist weiter? Mehr Spielaktionen gewinnen, bei Gleichstand der neuere.
function newerSave(a, b) {
  const ma = a?.moves || 0, mb = b?.moves || 0;
  if (ma !== mb) return ma > mb ? a : b;
  return (a?.updatedAt || 0) >= (b?.updatedAt || 0) ? a : b;
}
function changed() { persist(); if (!visit) world.syncLayout(state); ui.refresh(); }
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
    if (!pendingLevel) pendingLevel = { level: up.level, reward: 0, items: {}, unlocks: [] };
    pendingLevel.level = Math.max(pendingLevel.level, up.level);
    pendingLevel.reward += up.reward;
    for (const [k, v] of Object.entries(up.items || {})) pendingLevel.items[k] = (pendingLevel.items[k] || 0) + v;
    pendingLevel.unlocks.push(...up.unlocks);
  }
  clearTimeout(levelTimer);
  const g = gen;
  levelTimer = setTimeout(() => { if (g !== gen || !pendingLevel) return; const up = pendingLevel; pendingLevel = null; sound.play('level'); ui.levelUp(up); ui.refresh(); }, 900);
}

function syncWorld() {
  if (visit) { visit = null; ui.setVisit(null); }
  world.syncLayout(state);
  world.syncSkins(state.activeSkin);
  world.syncGreenhouse(state.greenhouse.unlocked);
  world.r.setQuality(resolveQuality(state.settings.quality));
  applySound();
}

function adoptState(raw, msg, backupLocal) {
  if (raw && raw.v > G.SAVE_VERSION) { cloud?.stop(); ui.toast('Es gibt eine neue Version von BloomWorld. Bitte lade die Seite neu.', 'err', { label: 'Neu laden', fn: () => reloadPage() }); return; }
  // Den eigenen, verworfenen Stand zur Sicherheit auf dem Gerät aufheben
  if (backupLocal) { try { localStorage.setItem('bloomworld_conflict_backup', JSON.stringify(state)); } catch { /* egal */ } }
  gen++;
  state = G.migrate(raw, now()).state;
  saver.flush(true);
  syncWorld();
  if (ui.mode) ui.setMode(null);
  ui.closeSheet();
  ui.refresh();
  if (msg) ui.toast(msg);
}

async function adoptExternal() {
  try {
    const raw = await store.load();
    if (!raw) return;
    gen++;
    state = G.migrate(raw, now()).state;
    saver.setKnown(raw.updatedAt || 0);
    syncWorld();
    ui.refresh();
    ui.toast('Dein Spielstand wurde aus einem anderen Fenster übernommen.');
  } catch (e) { console.warn(e); }
}

function relogin() { flushAll(); setTimeout(() => reloadPage(), 300); }

const eventColor = () => G.activeEvent(now())?.color;
const firstLockedBed = () => state.beds.findIndex((b) => b.locked);

const actions = {
  tapBed(i) {
    const info = G.bedInfo(state, i, now());
    if (!info) return;
    if (ui.mode) return actions.modeTap(i, info);
    if (info.locked) { sound.play('tap'); ui.closeSheet(); ui.bedLockedDialog(i); }
    else if (info.empty) ui.openSheet(i, 'seed');
    else if (info.ready) actions.harvest(i);
    else if (info.thirsty && ui.sheetBed !== i) actions.water(i);
    else ui.openSheet(i, 'care');
  },

  water(i) {
    const first = !state.stats.watered;
    const r = G.water(state, i, now());
    if (!r.ok) return fail(r);
    world.burst(i, 'water');
    sound.play('water');
    if (first) ui.toast('Gegossen! Die Blume wächst weiter. Ein Sprinkler gießt ein Beet automatisch.', 'good');
    changed();
  },

  useRain() {
    const list = G.thirstyBeds(state, now());
    if (!state.items.rain) { const b = G.buyItem(state, 'rain'); if (!b.ok) return fail(b); }
    const r = G.useItem(state, 'rain', -1, now());
    if (!r.ok) { changed(); return fail(r); }
    list.forEach((i, k) => later(() => world.burst(i, 'water'), k * 90));
    sound.play('water');
    ui.toast(`Regenwolke! ${list.length === 1 ? 'Eine Blume' : `${list.length} Blumen`} gegossen.`, 'good');
    changed();
  },

  // Platzier-Modus: Bewässerung, Ausbau oder Gegenstand aufs angetippte Beet
  modeTap(i, info) {
    const m = ui.mode;
    if (info.locked) { sound.play('error'); ui.toast('Dieses Beet ist noch nicht freigeschaltet.', 'err'); return; }
    if (m.kind === 'sprinkler') {
      if (info.sprinkler) { ui.toast('Hier ist schon eine Bewässerung installiert.'); return; }
      if (actions.buySprinkler(i) && !state.beds.some((b) => !b.locked && !b.sprinkler)) ui.setMode(null);
    } else if (m.kind === 'upgrade') {
      if (actions.upgradeBed(i) && !state.beds.some((b) => !b.locked && b.lvl < C.BED_LEVELS.length)) ui.setMode(null);
    } else if (m.kind === 'item') {
      if (actions.useItem(m.id, i) && !state.items[m.id]) ui.setMode(null);
    }
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
    let n = 0, lastErr = null;
    state.beds.forEach((b, i) => {
      if (b.locked || b.seed) return;
      const r = G.plant(state, i, seed, now());
      if (r.ok) { n++; world.burst(i, 'plant'); } else lastErr = r;
    });
    if (!n) return fail(lastErr || { message: 'Kein freies Beet.' });
    state.selectedSeed = seed;
    sound.play('plant');
    ui.closeSheet();
    ui.toast(lastErr ? `${n} Beete bepflanzt – für mehr fehlen Münzen.` : `${n} Beete bepflanzt!`, 'good');
    changed();
  },

  harvest(i) {
    const r = G.harvest(state, i, now());
    if (!r.ok) return fail(r);
    world.burst(i, 'harvest', r.seed);
    sound.play(r.shiny ? 'gold' : 'harvest');
    ui.floatReward(i, r.reward, r.shiny, r.tokens, eventColor());
    if (r.shiny) ui.toast(`Funkelblüte: ${plain(C.SEEDS[r.seed].name)}! Dreifache Belohnung.`, 'good');
    changed();
    afterLevelUps(r.levelUps);
  },

  harvestAll() {
    const n = now();
    const ready = state.beds.map((_, i) => G.bedInfo(state, i, n)).filter((x) => x && x.ready).map((x) => x.i);
    if (!ready.length) return;
    let shiny = 0;
    const ups = [], color = eventColor();
    ready.forEach((i, k) => {
      const r = G.harvest(state, i, n);
      if (!r.ok) return;
      if (r.shiny) shiny++;
      ups.push(...r.levelUps);
      later(() => { world.burst(i, 'harvest', r.seed); ui.floatReward(i, r.reward, r.shiny, r.tokens, color); }, k * 140);
    });
    sound.play(shiny ? 'gold' : 'harvest');
    if (shiny) ui.toast(shiny > 1 ? `${shiny} Funkelblüten! Dreifache Belohnung.` : 'Eine Funkelblüte! Dreifache Belohnung.', 'good');
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

  showNextBed() {
    const i = firstLockedBed();
    if (i < 0) return;
    ui.nav('garden');
    world.focusBed(i);
    const u = C.BED_UNLOCK[i];
    ui.toast(state.level < u.level ? `Dieses Beet gibt es ab Level ${u.level} für ${u.cost} Münzen.` : `Tippe auf das Beet, um es für ${u.cost} Münzen freizuschalten.`);
  },

  buySprinkler(i) {
    const r = G.buySprinkler(state, i, now());
    if (!r.ok) { fail(r); return false; }
    sound.play('water');
    world.burst(i, 'water');
    ui.toast('Bewässerung installiert – dieses Beet wächst jetzt 30 % schneller!', 'good');
    changed();
    return true;
  },

  upgradeBed(i) {
    const r = G.upgradeBed(state, i);
    if (!r.ok) { fail(r); return false; }
    sound.play('unlock');
    world.burst(i, 'plant');
    ui.toast(`Ausgebaut zum ${r.name}! Mehr Münzen pro Ernte.`, 'good');
    changed();
    return true;
  },

  useItem(id, i) {
    const r = G.useItem(state, id, i, now());
    if (!r.ok) { fail(r); return false; }
    sound.play(id === 'lucky' ? 'magic' : 'plant');
    world.burst(i, id === 'lucky' ? 'magic' : 'plant');
    const msg = { fert: 'Dünger wirkt – die Blume wächst ein gutes Stück!', turbo: 'Turbo! Die Blume ist sofort erntereif.', lucky: 'Glücksdünger – diese Blume wird funkeln!', compost: 'Kompost eingearbeitet – die nächste Ernte bringt 50 % mehr Münzen!' }[id];
    ui.toast(msg, 'good');
    changed();
    return true;
  },

  buyAndUse(id, i) {
    if (id === 'rain') return actions.useRain();
    const b = G.buyItem(state, id);
    if (!b.ok) return fail(b);
    if (id === 'boost') return actions.boostBreed();
    if (!actions.useItem(id, i)) changed();
  },

  buyItem(id, pack) {
    const r = G.buyItem(state, id, pack);
    if (!r.ok) return fail(r);
    sound.play('buy');
    ui.toast(`${r.n}× ${C.ITEMS[id].name} gekauft.`, 'good');
    changed();
  },

  // ----- Gewächshaus -----
  tapGreenhouse() {
    const job = G.breedingInfo(state, now());
    if (job?.ready) actions.collectBreed();
    else { sound.play('tap'); ui.closeSheet(); ui.nav('breed'); }
  },

  restoreGreenhouse() {
    const r = G.unlockGreenhouse(state);
    if (!r.ok) return fail(r);
    world.syncGreenhouse(true);
    sound.play('unlock');
    ui.toast('Das Gewächshaus glänzt wie neu! Jetzt kannst du Blumen kreuzen.', 'good');
    changed();
  },

  breed(idx) {
    const rc = C.RECIPES[idx];
    if (!rc) return;
    const pollen = !!ui.pollenOn && state.items.pollen > 0;
    const r = G.startBreeding(state, rc.a, rc.b, now(), isNight(), { pollen });
    if (!r.ok) return fail(r);
    if (pollen && !state.items.pollen) ui.pollenOn = false;
    sound.play('magic');
    ui.toast(`Züchtung gestartet: ${plain(C.SEEDS[r.result].name)} – fertig in ${fmtTime(rc.ms)}.${r.chance < 1 ? ` Erfolgschance ${Math.round(r.chance * 100)} %.` : ''}`, 'good');
    changed();
  },

  boostBreed() {
    if (!state.items.boost) { const b = G.buyItem(state, 'boost'); if (!b.ok) return fail(b); }
    const r = G.useItem(state, 'boost', -1, now());
    if (!r.ok) { changed(); return fail(r); }
    sound.play('magic');
    ui.toast('Die Züchtung ist fertig!', 'good');
    changed();
  },

  collectBreed() {
    const r = G.collectBreeding(state, now());
    if (!r.ok) return fail(r);
    const d = C.SEEDS[r.seed];
    if (r.failed) {
      sound.play('error');
      ui.modal({ queue: true, cls: 'failed', title: 'Nicht gelungen', html: `<img class="big fail" alt="" src="${icons.flower[r.seed]}"><p>Die Kreuzung hat diesmal nicht geklappt – <b>${d.name}</b> ist leider nicht entstanden. Du bekommst einen Teil der Kosten zurück.</p>${ui.chips({ coins: r.refund, xp: r.xp })}<p class="small">Aus Fehlern lernt man: Beim nächsten Versuch liegt die Chance bei <b>${Math.round(r.next * 100)} %</b>.</p>`, buttons: [['Nochmal versuchen', 'openBreed', ''], ['Okay', 'closeModal', 'ghost']] });
      ui.bumpCoins();
      changed();
      afterLevelUps(r.levelUps);
      return;
    }
    sound.play('level');
    ui.modal({ queue: true, title: 'Neue Sorte!', html: `<img class="big" alt="" src="${icons.flower[r.seed]}"><p><b>${d.name}</b> ist gezüchtet! Du kannst sie ab jetzt in jedes Beet pflanzen.</p>${ui.chips({ xp: r.xp })}`, buttons: [['Jetzt pflanzen', 'closeModal', '']] });
    changed();
    afterLevelUps(r.levelUps);
  },

  // ----- Freunde -----
  giftSent(r, name, kind) {
    sound.play('buy');
    const ups = G.grant(state, { xp: r.xp || 0 });
    ui.toast(`Geschenk an ${escapeHtml(name || 'deinen Freund')} verschickt: ${C.GIFTS[kind]?.label || ''}. +${r.xp || 0} EP fürs Schenken!`, 'good');
    changed();
    afterLevelUps(ups);
  },

  // Garten eines Freundes besuchen (Multiplayer)
  async visit(id) {
    if (!hub) return fail({ message: 'Melde dich an, um Freunde zu besuchen.' });
    if (ui.edit) actions.exitEdit(true);
    ui.closeModal(); ui.closeSheet(); ui.nav('garden');
    ui.toast('Garten wird geladen …');
    const r = await socialApi.visit(id);
    if (!r.ok) return fail(r);
    const g = r.garden;
    const vs = G.newState(Date.now());
    Object.assign(vs, { level: g.level, land: g.land, layout: g.layout, beds: g.beds, decor: g.decor, greenhouse: g.greenhouse, activeSkin: g.activeSkin });
    const fixed = G.migrate(vs, Date.now()).state;
    visit = { id, name: g.name, level: g.level, collected: g.collected, bred: g.bred, state: fixed, skew: g.serverNow - Date.now(), helpLeft: r.helpLeft, liked: r.liked, queued: [], timer: null };
    world.syncLayout(fixed); world.syncSkins(fixed.activeSkin); world.syncGreenhouse(fixed.greenhouse.unlocked);
    world.resetView();
    ui.setVisit(visit);
    sound.play('open');
    const thirsty = G.thirstyBeds(fixed, Date.now() + visit.skew).length;
    ui.toast(thirsty && visit.helpLeft ? `Willkommen im Garten von ${escapeHtml(g.name)}! ${thirsty === 1 ? 'Eine Blume hat' : `${thirsty} Blumen haben`} Durst – tippe zum Gießen.` : `Willkommen im Garten von ${escapeHtml(g.name)}!`, 'good');
  },

  endVisit() {
    if (!visit) return;
    actions.flushHelp();
    visit = null;
    syncWorld();
    world.resetView();
    ui.setVisit(null);
    sound.play('tap');
  },

  visitWater(i) {
    const v = visit;
    if (!v) return;
    const vn = Date.now() + v.skew;
    const info = G.bedInfo(v.state, i, vn);
    if (!info || !info.thirsty) { if (info?.seed) ui.toast(info.ready ? 'Diese Blume ist erntereif – das macht dein Freund selbst.' : 'Diese Blume hat gerade keinen Durst.'); return; }
    if (v.helpLeft <= 0) { sound.play('error'); ui.toast(`Du hast heute schon ${C.HELP.perDay} Blumen bei ${escapeHtml(v.name)} gegossen. Morgen wieder!`, 'err'); return; }
    // Sofort sichtbar gießen, dann gesammelt an den Server schicken
    const b = v.state.beds[i], g = G.growState(b, vn);
    b.plantedAt = vn - g.p * g.dur; b.drinks = (b.drinks || 0) + 1;
    v.helpLeft--; v.queued.push(i);
    world.burst(i, 'water'); sound.play('water');
    ui.setVisit(v);
    clearTimeout(v.timer); v.timer = setTimeout(() => actions.flushHelp(), 700);
  },

  async flushHelp() {
    const v = visit;
    if (!v || !v.queued.length) return;
    clearTimeout(v.timer);
    const beds = v.queued.splice(0);
    const r = await socialApi.help(v.id, beds);
    if (!r.ok) { fail(r); return; }
    if (visit === v) { v.helpLeft = r.helpLeft; ui.setVisit(v); }
    const ups = G.grant(state, { coins: r.coins, xp: r.xp });
    ui.toast(`Danke fürs Gießen! +${r.coins} Münzen, +${r.xp} EP`, 'good');
    ui.bumpCoins();
    changed();
    afterLevelUps(ups);
  },

  async likeGarden() {
    const v = visit;
    if (!v || v.liked) return;
    const r = await socialApi.like(v.id);
    if (!r.ok) return fail(r);
    v.liked = true;
    if (visit === v) ui.setVisit(v);
    sound.play('magic');
    ui.toast(`💖 Du hast ${escapeHtml(v.name)} ein Herz geschenkt – dein Freund bekommt ${C.LIKE.coins} Münzen.`, 'good');
    hub?.tick();
  },

  // ----- Story -----
  questTracker() {
    const st = G.storyStatus(state);
    if (!st.finished && st.done) actions.claimQuest();
    else ui.nav('quests', 'story');
  },

  claimQuest() {
    const r = G.claimQuest(state);
    if (!r.ok) return fail(r);
    sound.play('buy');
    ui.bumpCoins();
    if (r.reward.skin) world.syncSkins(state.activeSkin);
    ui.owlDialog({ title: r.chapterDone ? 'Kapitel geschafft!' : 'Aufgabe erledigt!', heading: r.chapterDone ? r.chapterTitle : '', text: r.say || (r.chapterDone ? `„${r.chapterTitle}“ ist abgeschlossen. Wunderbar gemacht!` : 'Prima, weiter so! Hier ist deine Belohnung.'), reward: r.reward });
    changed();
    afterLevelUps(r.levelUps);
  },

  storySeen() { G.markIntroSeen(state); persist(false); },

  go(target) {
    const [a, b] = String(target).split(':');
    if (a === 'shop') ui.nav('shop', b);
    else if (a === 'breed') ui.nav('breed');
    else if (a === 'bed') actions.showNextBed();
    else if (a === 'edit') actions.toggleEdit(true);
    else if (a === 'mode') {
      if (b === 'sprinkler' && state.level < C.SPRINKLER.level) return fail({ message: `Die Bewässerung gibt es ab Level ${C.SPRINKLER.level}.` });
      if (b === 'upgrade' && state.level < C.BED_LEVELS[1].level) return fail({ message: `Den Beet-Ausbau gibt es ab Level ${C.BED_LEVELS[1].level}.` });
      ui.setMode({ kind: b });
    }
  },

  // ----- Events -----
  claimMilestone(i) {
    const r = G.claimEventMilestone(state, i, now());
    if (!r.ok) return fail(r);
    world.syncSkins(state.activeSkin);
    sound.play('buy');
    ui.toast('Event-Belohnung abgeholt!', 'good');
    changed();
    afterLevelUps(r.levelUps);
  },

  buyEventItem(id) {
    const r = G.buyEventItem(state, id, now());
    if (!r.ok) return fail(r);
    sound.play('buy');
    ui.toast('Eingetauscht!', 'good');
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
    ui.toast(`${plain(C.SEEDS[id].name)} freigeschaltet – jetzt im Beet pflanzbar!`, 'good');
    changed();
  },

  buyDeco(id) {
    const r = G.buyDeco(state, id, null);
    if (!r.ok) return fail(r);
    sound.play('buy');
    changed();
    const d = state.decor[r.k];
    if (d.stored) ui.toast(`${C.DECO[id].name} liegt im Lager – im Garten ist gerade kein Platz frei.`, 'good', { label: 'Gestalten', fn: () => actions.toggleEdit(true) });
    else ui.toast(`${C.DECO[id].name} steht jetzt in deinem Garten!`, 'good', { label: 'Verschieben', fn: () => { actions.toggleEdit(true); editSelect({ type: 'deco', k: r.k }); world.focus(d.x, d.z, 0.8); } });
  },

  // ----- Gestalten -----
  toggleEdit(on) {
    if (visit) return;
    if (ui.edit && on !== true) return actions.exitEdit();
    if (ui.edit) return;
    ui.closeSheet(); ui.closeModal();
    if (ui.panel) ui.closePanel();
    if (ui.mode) ui.setMode(null, true);
    ui.edit = { sel: null };
    sound.play('open');
    ui.renderEditBar();
    ui.syncHistory();
  },

  exitEdit(silent) {
    if (!ui.edit) return;
    if (ui.edit.sel) actions.editDeselect();
    ui.edit = null;
    world.hideMarker();
    ui.renderEditBar();
    if (!silent) { sound.play('tap'); ui.syncHistory(); }
  },

  editDeselect() {
    const e = ui.edit;
    if (!e?.sel) return;
    if (!e.valid) { world.preview(e.sel, ...e.orig); }
    e.sel = null;
    world.hideMarker();
    ui.renderEditBar();
  },

  editRotate() {
    const e = ui.edit;
    if (!e?.sel) return;
    const r = (e.pos[2] + 1) % 4;
    let spot = G.canPlace(state, e.sel, e.pos[0], e.pos[1], r).ok ? [e.pos[0], e.pos[1], r] : null;
    if (!spot) { const f = G.findSpot(state, e.sel, [e.pos[0], e.pos[1]], r); if (f && Math.hypot(f[0] - e.pos[0], f[1] - e.pos[1]) < 3) spot = f; }
    if (!spot) return fail({ message: 'Zum Drehen ist hier nicht genug Platz.' });
    e.pos = spot;
    commitMove();
  },

  editStoreSel() {
    const e = ui.edit;
    if (!e?.sel || e.sel.type !== 'deco') return;
    const r = G.storeDeco(state, e.sel.k);
    if (!r.ok) return fail(r);
    e.sel = null;
    world.hideMarker();
    sound.play('tap');
    ui.toast('Eingelagert. Du findest es unter „Lager“.', 'good');
    changed();
  },

  storePlace(k) {
    const r = G.placeDeco(state, k, [world.cam.target[0], world.cam.target[2]]);
    if (!r.ok) return fail(r);
    sound.play('plant');
    ui.closeSheet();
    changed();
    if (!ui.edit) actions.toggleEdit(true);
    editSelect({ type: 'deco', k });
  },

  storeSell(k) {
    const d = state.decor[k];
    if (!d) return;
    ui.confirm({ title: 'Verkaufen?', text: `${C.DECO[d.id].name} für ${Math.floor((C.DECO[d.id].price || 0) / 2)} Münzen verkaufen?`, ok: 'Verkaufen', onOk: () => {
      const r = G.sellDeco(state, k);
      if (!r.ok) return fail(r);
      if (ui.edit) { ui.edit.sel = null; world.hideMarker(); }
      sound.play('buy');
      changed();
    } });
  },

  expandLand() {
    const r = G.expandLand(state);
    if (!r.ok) return fail(r);
    sound.play('unlock');
    changed();
    world.focus(0.4, 0.4, Math.min(1.3, r.half / 10.2));
    ui.toast('Dein Garten ist gewachsen! Mehr Platz für Deko und neue Beete.', 'good');
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
    const name = user ? ` Mein Spielername: ${user.name}` : '';
    const data = { title: 'BloomWorld', text: `Komm mit in meinen Garten bei BloomWorld! 🌸${name}`, url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(`${data.text} ${url}`);
      ui.toast('Kopiert – schick es deinen Freunden!', 'good');
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
    persist(false);
    if (!live) ui.refresh();
  },

  reset() {
    gen++; pendingLevel = null; clearTimeout(levelTimer); dayTime = 0;
    // Aktionszähler weiterführen, damit kein älterer Stand eines anderen Geräts den Neubeginn überschreibt
    const moves = (state.moves || 0) + 1;
    state = G.newState(now());
    state.moves = moves;
    store.clear().finally(() => { saver.flush(true); cloud?.request(500); });
    syncWorld();
    world.resetView();
    ui.closeModal();
    ui.nav('garden');
    ui.refresh();
    ui.toast('Neuer Garten – viel Spaß!', 'good');
  },

  // ----- Konto -----
  login() { flushAll(); reloadPage(); },

  async logout() {
    if (cloud) {
      for (let i = 0; i < 40 && cloud.busy; i++) await new Promise((r) => setTimeout(r, 100));
      cloud.dirty = true; await cloud.flush(); cloud.stop();
    }
    saver?.flush();
    hub?.stop();
    await Net.logout();
    setLastUser(null);
    reloadPage();
  },

  async deleteAccount(pw) {
    if (!pw) { ui.deleteError('Bitte gib dein Passwort ein.'); return; }
    const r = await Net.remove(pw);
    if (!r.ok) { ui.deleteError(r.message || 'Das hat nicht geklappt.'); return; }
    cloud?.stop();
    saver.stop();
    await store.clear();
    setLastUser(null);
    ui.closeModal();
    ui.toast('Dein Konto wurde gelöscht.', 'good');
    setTimeout(() => reloadPage(), 1200);
  },
};

boot().catch((e) => showFatal('BloomWorld konnte nicht starten. Bitte lade die Seite neu.', e));
