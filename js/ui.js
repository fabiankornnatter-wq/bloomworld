// Oberfläche von BloomWorld: Kopfleiste, Menü, Beet-Blasen, Saat- und Pflege-Leiste,
// Panels (Aufgaben, Events, Sammlung, Shop, Freunde, Einstellungen, Gewächshaus), Dialoge, Hinweise.
import * as C from './config.js';
import * as G from './game.js';
import * as I from './icons.js';
import { formatEUR } from './payments.js';
import { PHASE_LABEL } from './world/sky.js';
import { PRIVACY_HTML } from './legal.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Math.floor(n).toLocaleString('de-DE');
const plain = (s) => String(s).replace(/­/g, '');
const svg = (src, size) => src.replace('<svg', `<svg style="width:${size}px;height:${size}px;flex:none"`);

export function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `0:${String(s).padStart(2, '0')}`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return `${m}:${String(r).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} Std ${m % 60} Min`;
}
const growLabel = (ms) => (ms < 60_000 ? `${ms / 1000} Sek` : `${Math.round(ms / 60_000)} Min`);
const daysLeft = (ms) => { const d = Math.ceil(ms / 86_400_000); return d <= 1 ? 'Letzter Tag!' : `Noch ${d} Tage`; };

const TIER = { selten: ['Selten', 't1'], episch: ['Episch', 't2'], legendär: ['Legendär', 't3'] };
const tierTag = (d) => (d.tier ? `<span class="tier ${TIER[d.tier][1]}">${TIER[d.tier][0]}</span>` : d.rare ? '<span class="tier t0">Selten</span>' : '');

const NAV_ITEMS = [['garden', 'Garten'], ['quests', 'Aufgaben'], ['events', 'Events'], ['collection', 'Sammlung'], ['shop', 'Shop'], ['friends', 'Freunde']];
const TITLES = { quests: 'Aufgaben', events: 'Events', collection: 'Sammlung', shop: 'Shop', friends: 'Freunde', settings: 'Einstellungen', breed: 'Gewächshaus' };
const GH = C.BED_COUNT; // Index der Gewächshaus-Blase

export class UI {
  constructor(api) {
    this.api = api; // { state, now, icons, sound, act, world, account, isNight }
    this.icons = api.icons;
    this.panel = null; this.tab = {};
    this.sheetBed = -1; this.sheetKind = null;
    this.mode = null; // Platzier-Modus: { kind: 'sprinkler'|'upgrade'|'item', id }
    this.bubbleKeys = [];
    this.toastTimer = null;
    this.modalQueue = [];
  }

  get s() { return this.api.state(); }

  init() {
    $('coinIcon').innerHTML = I.coin();
    $('gearBtn').innerHTML = I.gear;
    $('breedBtn').insertAdjacentHTML('afterbegin', I.greenhouse);
    $('centerBtn').insertAdjacentHTML('afterbegin', I.target);
    $('nav').innerHTML = NAV_ITEMS.map(([id, label]) => `<button data-nav="${id}" class="${id === 'garden' ? 'on' : ''}" aria-label="${label}">${I.NAV[id]}<span>${label}</span><i class="badge" id="badge-${id}" hidden></i></button>`).join('');
    $('bubbles').innerHTML = Array.from({ length: C.BED_COUNT + 1 }, (_, i) => `<div class="bub" id="bub${i}" hidden></div>`).join('');
    this.bubbles = Array.from({ length: C.BED_COUNT + 1 }, (_, i) => $('bub' + i));

    $('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b) this.nav(b.dataset.nav); });
    $('gearBtn').onclick = () => this.nav('settings');
    $('coinPlus').onclick = () => this.nav('shop', 'offers');
    $('lvl').onclick = () => this.nav('quests', 'levels');
    $('breedBtn').onclick = () => this.api.act.tapGreenhouse();
    $('centerBtn').onclick = () => { this.api.sound.play('tap'); this.api.world.resetView(); };
    $('harvestAll').onclick = () => this.api.act.harvestAll();
    $('quest').onclick = () => this.api.act.questTracker();
    for (const el of [$('panel'), $('sheet'), $('modal'), $('toast'), $('modeBar')]) el.addEventListener('click', (e) => this.onAct(e));
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    $('panel').addEventListener('input', (e) => this.onInput(e));
    for (const id of ['hud', 'side', 'nav']) $(id).hidden = false;
    $('sheet').addEventListener('wheel', (e) => { const row = e.target.closest('.seeds'); if (row && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    $('panel').inert = true; $('sheet').inert = true;
    this.refresh();
  }

  // ---------- Zurück-Taste (Android) und Escape ----------
  // Mehrere Änderungen im selben Moment werden gebündelt, und solange ein eigenes history.back()
  // unterwegs ist, wird nichts Neues eingetragen – sonst könnte die Zurück-Taste das Spiel verlassen.
  syncHistory() {
    if (this._hs) return;
    this._hs = setTimeout(() => { this._hs = null; this.doSyncHistory(); }, 0);
  }
  doSyncHistory() {
    if (this.ignorePop) {
      if (performance.now() - this.popSince < 1500) { this._hs = setTimeout(() => { this._hs = null; this.doSyncHistory(); }, 60); return; }
      this.ignorePop = false; // Rückmeldung blieb aus (z.B. eingebettete Ansicht)
    }
    const open = this.modalOpen || this.sheetBed >= 0 || !!this.panel || !!this.mode;
    try {
      if (open && !this.guard) { history.pushState({ bloomworld: 1 }, ''); this.guard = true; }
      else if (!open && this.guard) { this.guard = false; this.ignorePop = true; this.popSince = performance.now(); history.back(); }
    } catch { /* z.B. in eingebetteten Ansichten */ }
  }
  onPopState() {
    if (this.ignorePop) { this.ignorePop = false; this.syncHistory(); return; }
    this.guard = false;
    this.back();
  }
  back() {
    if (this.modalOpen) this.closeModal();
    else if (this.sheetBed >= 0) this.closeSheet();
    else if (this.panel) this.nav('garden');
    else if (this.mode) this.setMode(null);
    this.syncHistory();
  }

  // Liegt die Bildschirmposition auf einer Blase? (oberste zuerst)
  bubbleAt(x, y) {
    if (this.panel) return null;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const el = this.bubbles[i];
      if (el.hidden) continue;
      const box = el.firstElementChild;
      if (!box) continue;
      const r = box.getBoundingClientRect();
      if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 8) return i;
    }
    return null;
  }

  coveredFor(ms) { return !!this.panel && performance.now() - (this.panelSince || 0) > ms; }

  // ---------- Navigation ----------
  nav(id, tab) {
    this.api.sound.play('open');
    this.closeSheet();
    if (this.mode) this.setMode(null, true);
    if (id === 'garden') { this.closePanel(); return; }
    if (tab) this.tab[id] = tab;
    if (!this.panel) this.panelSince = performance.now();
    this.panel = id;
    this.renderPanel();
    $('panel').classList.add('open');
    $('panel').inert = false;
    $('panel').querySelector('.pbody')?.scrollTo(0, 0);
    this.markNav();
    this.syncHistory();
  }

  closePanel() { this.panel = null; $('panel').classList.remove('open'); $('panel').inert = true; this.markNav(); this.syncHistory(); }

  markNav() {
    const cur = this.panel || 'garden';
    for (const b of $('nav').querySelectorAll('button')) b.classList.toggle('on', b.dataset.nav === cur);
  }

  // ---------- Platzier-Modus (Bewässerung, Ausbau, Gegenstand auf ein Beet) ----------
  setMode(mode, silent) {
    this.mode = mode;
    const bar = $('modeBar');
    if (!mode) { bar.hidden = true; if (!silent) this.syncHistory(); this.bubbleKeys = []; return; }
    if (this.panel) this.closePanel();
    this.closeSheet();
    this.renderModeBar();
    bar.hidden = false;
    this.bubbleKeys = [];
    this.syncHistory();
  }

  renderModeBar() {
    const m = this.mode, s = this.s;
    if (!m) return;
    let icon, text;
    if (m.kind === 'sprinkler') { icon = I.drop; text = `Tippe auf ein Beet, um die Bewässerung zu installieren (${C.SPRINKLER.cost} Münzen).`; }
    else if (m.kind === 'upgrade') { icon = I.upgrade; text = 'Tippe auf ein Beet, das du ausbauen möchtest.'; }
    else { icon = I.ITEM[m.id]; text = `${C.ITEMS[m.id].name}: Tippe auf ein wachsendes Beet. Du hast noch ${s.items[m.id]}.`; }
    $('modeBar').innerHTML = `${svg(icon, 34)}<span>${esc(text)}</span><button class="btn small pink" data-act="endMode">Fertig</button>`;
  }

  // ---------- Aktualisierung ----------
  refresh() {
    const s = this.s, now = this.api.now();
    $('coins').textContent = num(s.coins);
    const xp = G.xpProgress(s);
    $('lvl').innerHTML = `${I.star(xp.level)}<small>${xp.max ? 'Max. Level' : `${num(xp.have)}/${num(xp.need)} EP`}</small><span class="xpbar"><i style="width:${(xp.frac * 100).toFixed(1)}%"></i></span>`;
    const st = G.storyStatus(s);
    const quests = G.claimableTasks(s) + (G.dailyGiftAvailable(s, now) ? 1 : 0) + (!st.finished && st.done ? 1 : 0);
    const ev = G.eventInfo(s, now);
    this.badge('quests', quests);
    this.badge('events', ev.active ? ev.claimable : 0);
    const job = G.breedingInfo(s, now);
    const bb = $('breedBadge');
    bb.textContent = job?.ready ? '!' : ''; bb.hidden = !job?.ready;
    this.renderQuest(st);
    if (this.mode) this.renderModeBar();
    if (this.panel) this.renderPanel(true);
    if (this.sheetBed >= 0) this.renderSheet();
  }

  badge(id, n) { const b = $('badge-' + id); if (b) { b.textContent = n || ''; b.hidden = !n; } }

  renderQuest(st = G.storyStatus(this.s)) {
    const el = $('quest');
    if (st.finished) { el.hidden = true; return; }
    const owl = this.icons.animal.owl;
    const key = `${st.ch}|${st.q}|${st.have}|${st.done}`;
    if (el.dataset.k !== key) {
      el.dataset.k = key;
      el.classList.toggle('done', st.done);
      el.innerHTML = `<img alt="" src="${owl}"><div class="qt"><small>Kapitel ${st.ch + 1} · ${st.done ? 'Geschafft!' : `${num(st.have)}/${num(st.need)}`}</small><b>${st.done ? 'Belohnung abholen' : esc(st.quest.text)}</b><span class="qbar"><i style="width:${(st.have / st.need) * 100}%"></i></span></div>`;
      el.setAttribute('aria-label', `Story-Aufgabe: ${st.quest.text}`);
    }
    el.hidden = false;
  }

  bumpCoins() { const p = $('coinPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }

  setTime(env) {
    const key = env.name;
    if (key === this._timeKey) return;
    this._timeKey = key;
    $('timePill').innerHTML = `${I.timeIcon[key]}<span>${PHASE_LABEL[key]}</span>`;
    $('timePill').setAttribute('aria-label', 'Tageszeit: ' + PHASE_LABEL[key]);
    $('timePill').title = PHASE_LABEL[key];
    if (this.panel === 'breed') this.renderPanel(true);
  }

  // ---------- Blasen über Beeten und Gewächshaus (jedes Bild) ----------
  frame(infos, now) {
    const hide = !!this.panel, s = this.s, m = this.mode;
    let ready = 0;
    // Gesperrte Beete: Preis nur bei den nächsten freischaltbaren zeigen
    const firstLevelLocked = infos.find((x) => x.locked && x.needLevel);
    infos.forEach((info, i) => {
      const el = this.bubbles[i];
      if (info.ready) ready++;
      let key = null, html, cls;
      if (m) {
        if (!info.locked) {
          if (m.kind === 'sprinkler' && !info.sprinkler) { key = 'MS'; cls = 'mode'; html = `<div class="b">${I.drop}${C.SPRINKLER.cost}</div>`; }
          else if (m.kind === 'upgrade' && info.lvl < C.BED_LEVELS.length) { const nx = C.BED_LEVELS[info.lvl]; key = 'MU' + info.lvl; cls = 'mode'; html = `<div class="b">${I.upgrade}${s.level < nx.level ? `Lv ${nx.level}` : num(nx.cost)}</div>`; }
          else if (m.kind === 'item' && info.seed && !info.ready && !(m.id === 'lucky' && info.shinyHidden)) { key = 'MI' + m.id; cls = 'mode'; html = `<div class="b">${I.ITEM[m.id]}</div>`; }
        }
      } else if (info.locked) {
        if (!info.needLevel || info === firstLevelLocked) { key = 'L' + info.price + '|' + info.needLevel; cls = 'locked'; html = `<div class="b">${I.lock}${info.needLevel ? `Lv ${info.needLevel}` : num(info.price)}</div>`; }
      } else if (info.empty) { key = 'E'; cls = 'empty'; html = '<div class="b">+</div>'; }
      else if (info.ready) { key = 'R' + info.seed + info.shiny; cls = 'ready' + (info.shiny ? ' gold' : ''); html = `<div class="b"><img alt="${esc(plain(C.SEEDS[info.seed].name))} ernten" src="${info.shiny ? this.icons.shiny[info.seed] : this.icons.flower[info.seed]}"></div>`; }
      else { const sec = Math.ceil(info.remaining / 1000); key = 'G' + sec + '|' + Math.round(info.progress * 40); cls = 'grow'; html = `<div class="b">${I.ring(info.progress)}${fmtTime(info.remaining)}</div>`; }
      this.placeBubble(el, i, key, cls, html, hide ? null : key && this.api.world.bedScreen(i, info.ready));
    });
    // Gewächshaus
    const gh = this.ghBubble(now, hide || !!m);
    this.placeBubble(this.bubbles[GH], GH, gh?.key, gh?.cls, gh?.html, gh && this.api.world.greenhouseScreen());

    const ha = $('harvestAll');
    const showAll = ready >= 2 && !hide && this.sheetBed < 0 && !m;
    if (showAll) { const t = `${I.coin()} Alle ernten (${ready})`; if (ha.dataset.t !== t) { ha.innerHTML = t; ha.dataset.t = t; } }
    ha.hidden = !showAll;
    this.updateHint(infos, hide);
    if (this.sheetKind === 'care' && this.sheetBed >= 0) this.tickCare(infos[this.sheetBed]);
  }

  placeBubble(el, i, key, cls, html, p) {
    if (!key || !p) { el.hidden = true; return; }
    if (this.bubbleKeys[i] !== key) { this.bubbleKeys[i] = key; el.className = 'bub ' + cls; el.innerHTML = html; }
    el.hidden = false;
    el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%)`;
  }

  ghBubble(now, hide) {
    if (hide) return null;
    const s = this.s;
    if (!s.greenhouse.unlocked) return s.level >= C.GREENHOUSE.level ? { key: 'GA', cls: 'gh alert', html: `<div class="b">${I.greenhouse}Restaurieren!</div>` } : null;
    const job = G.breedingInfo(s, now);
    if (!job) return { key: 'GI', cls: 'gh', html: `<div class="b">${I.greenhouse}Züchten</div>` };
    if (job.ready) return { key: 'GR' + job.result, cls: 'ready gold', html: `<div class="b"><img alt="Züchtung abholen" src="${this.icons.flower[job.result]}"></div>` };
    const sec = Math.ceil(job.remaining / 1000);
    return { key: 'GG' + sec, cls: 'grow', html: `<div class="b">${I.ring(job.progress)}${fmtTime(job.remaining)}</div>` };
  }

  updateHint(infos, hide) {
    const s = this.s, h = $('hint');
    let text = '';
    if (s.tutorial === 0) text = 'Tippe auf ein Beet mit <b>+</b>, um Blumen zu pflanzen.';
    else if (s.tutorial === 1) text = infos.some((x) => x.ready) ? 'Deine Blumen blühen! Tippe auf die Blüte über dem Beet, um zu ernten.' : 'Super! Die Blumen wachsen jetzt – auch wenn du das Spiel schließt. Tippe auf ein wachsendes Beet für Dünger.';
    const show = !!text && !hide && this.sheetBed < 0 && $('harvestAll').hidden && !this.mode;
    if (h.dataset.t !== text) { h.innerHTML = text; h.dataset.t = text; }
    h.hidden = !show;
  }

  // ---------- Leiste unten: Saatgut bzw. Beet-Pflege ----------
  openSheet(bed, kind) {
    this.sheetBed = bed; this.sheetKind = kind;
    this.openedAt = performance.now();
    this.renderSheet();
    const el = $('sheet');
    void el.offsetWidth;
    el.classList.add('open');
    el.inert = false;
    this.api.sound.play('open');
    this.syncHistory();
  }
  openSeedSheet(bed) { this.openSheet(bed, 'seed'); }

  closeSheet() {
    const was = this.sheetBed >= 0;
    this.sheetBed = -1; this.sheetKind = null;
    $('sheet').classList.remove('open'); $('sheet').inert = true;
    if (was) this.syncHistory();
  }

  renderSheet() {
    const html = this.sheetKind === 'care' ? this.careHtml(this.sheetBed) : this.seedHtml();
    if (html === null) { this.closeSheet(); return; }
    $('sheet').innerHTML = html;
  }

  seedHtml() {
    const s = this.s, i = this.sheetBed;
    const order = [...C.SEED_ORDER].sort((a, b) => (G.seedStatus(s, b).available ? 1 : 0) - (G.seedStatus(s, a).available ? 1 : 0));
    const cards = order.map((id) => {
      const d = C.SEEDS[id], st = G.seedStatus(s, id), afford = s.coins >= d.cost;
      const label = st.available ? `${I.coin()} ${d.cost}` : `${I.lock} ${esc(st.reason)}`;
      const act = st.available ? 'plant' : st.shop ? 'gotoShop' : st.breed ? 'gotoBreed' : 'seedLocked';
      return `<button class="seed ${st.available ? '' : 'lock'} ${d.rare || d.bred ? 'rare' : ''}" data-act="${act}" data-id="${id}" aria-label="${esc(plain(d.name))}">
        ${tierTag(d)}<img alt="" src="${this.icons.flower[id]}"><b>${esc(d.name)}</b>
        <span class="meta"><span>⏱ ${growLabel(G.growTime(s.beds[i] || {}, id))}</span><span>${I.coin()}${Math.round(d.reward * C.BED_LEVELS[(s.beds[i]?.lvl || 1) - 1].mult)}</span></span>
        <span class="price ${st.available && !afford ? 'poor' : ''}">${label}</span></button>`;
    }).join('');
    const empty = s.beds.filter((b) => !b.locked && !b.seed).length;
    const sel = C.SEEDS[s.selectedSeed] && G.seedStatus(s, s.selectedSeed).available ? s.selectedSeed : 'daisy';
    const allBtn = empty > 1 ? `<div class="all"><button class="btn small blue wide" data-act="plantAll" data-id="${sel}"><img alt="" src="${this.icons.flower[sel]}" style="width:28px;height:28px;margin:-4px 0"> Alle ${empty} freien Beete · ${I.coin()} ${C.SEEDS[sel].cost * empty}</button></div>` : '';
    const weekend = G.isWeekend(this.api.now()) ? `<div class="wknd">${svg(I.sparkle, 18)} Funkel-Wochenende: doppelte Chance auf Funkelblüten!</div>` : '';
    return `<div class="inner"><h3>Was möchtest du pflanzen? <button class="x" data-act="closeSheet" aria-label="Schließen">✕</button></h3>${weekend}<div class="seeds">${cards}</div>${allBtn}${this.bedTools(i)}</div>`;
  }

  // Bewässerung und Ausbau für ein Beet
  bedTools(i) {
    const s = this.s, b = s.beds[i];
    if (!b || b.locked) return '';
    const L = C.BED_LEVELS[b.lvl - 1];
    let spr;
    if (b.sprinkler) spr = `<span class="tool on">${I.drop}<span><b>Bewässerung</b><small>aktiv · wächst 30 % schneller</small></span></span>`;
    else if (s.level < C.SPRINKLER.level) spr = `<span class="tool off">${I.drop}<span><b>Bewässerung</b><small>ab Level ${C.SPRINKLER.level}</small></span></span>`;
    else spr = `<button class="tool" data-act="sprinkler" data-bed="${i}">${I.drop}<span><b>Bewässerung</b><small>30 % schneller · ${I.coin()} ${C.SPRINKLER.cost}</small></span></button>`;
    let up;
    if (b.lvl >= C.BED_LEVELS.length) up = `<span class="tool on">${I.upgrade}<span><b>${L.name}</b><small>voll ausgebaut · ×${String(L.mult).replace('.', ',')} Münzen</small></span></span>`;
    else {
      const nx = C.BED_LEVELS[b.lvl];
      const what = `×${String(nx.mult).replace('.', ',')} Münzen${nx.shiny ? ' · mehr Funkeln' : ''}`;
      up = s.level < nx.level
        ? `<span class="tool off">${I.upgrade}<span><b>${nx.name}</b><small>ab Level ${nx.level} · ${what}</small></span></span>`
        : `<button class="tool" data-act="upgradeBed" data-bed="${i}">${I.upgrade}<span><b>Zum ${nx.name}</b><small>${what} · ${I.coin()} ${num(nx.cost)}</small></span></button>`;
    }
    return `<div class="tools"><div class="tlab">${esc(L.name)}</div>${spr}${up}</div>`;
  }

  careHtml(i) {
    const s = this.s, info = G.bedInfo(s, i, this.api.now());
    if (!info || !info.seed) return null;
    const d = C.SEEDS[info.seed];
    this._careReady = info.ready;
    const items = ['fert', 'turbo', 'lucky'].map((k) => {
      const it = C.ITEMS[k], have = s.items[k];
      let dis = '', sub;
      if (s.level < it.level) { dis = 'disabled'; sub = `ab Level ${it.level}`; }
      else if (k === 'lucky' && info.shinyHidden) { dis = 'disabled'; sub = 'funkelt schon'; }
      else if (k !== 'lucky' && info.ready) { dis = 'disabled'; sub = 'schon reif'; }
      else sub = have ? 'Benutzen' : `Kaufen ${I.coin()} ${it.price}`;
      return `<button class="itembtn ${have ? '' : 'buy'}" data-act="${have ? 'useItem' : 'buyUse'}" data-id="${k}" data-bed="${i}" ${dis}>${I.ITEM[k]}<b>${esc(it.name)}</b><small>${sub}</small>${have ? `<span class="cnt">×${have}</span>` : ''}</button>`;
    }).join('');
    const extra = [info.shinyHidden ? `${svg(I.sparkle, 16)} wird eine Funkelblüte!` : '', info.sprinkler ? `${svg(I.drop, 16)} Bewässerung aktiv` : ''].filter(Boolean).join(' · ');
    return `<div class="inner care"><h3>${esc(d.name)} ${tierTag(d)}<button class="x" data-act="closeSheet" aria-label="Schließen">✕</button></h3>
      <div class="carehead"><img alt="" src="${info.shinyHidden && info.ready ? this.icons.shiny[info.seed] : this.icons.flower[info.seed]}"><div class="grow">
        <b id="careTime">${info.ready ? 'Erntereif!' : `Noch ${fmtTime(info.remaining)}`}</b><div class="prog"><i id="careBar" style="width:${(info.progress * 100).toFixed(1)}%"></i></div>
        <small>${extra || `Bringt ${num(Math.round(d.reward * C.BED_LEVELS[info.lvl - 1].mult))} Münzen`}</small></div>
        ${info.ready ? `<button class="btn" data-act="harvestBed" data-bed="${i}">Ernten</button>` : ''}</div>
      <div class="itemrow">${items}</div>${this.bedTools(i)}</div>`;
  }

  tickCare(info) {
    if (!info) return;
    if (!info.seed || info.ready !== this._careReady) { this.renderSheet(); return; }
    const t = $('careTime'), b = $('careBar');
    if (t && !info.ready) { const txt = `Noch ${fmtTime(info.remaining)}`; if (t.textContent !== txt) t.textContent = txt; }
    if (b) b.style.width = (info.progress * 100).toFixed(1) + '%';
  }

  // ---------- Panels ----------
  renderPanel(soft) {
    const id = this.panel;
    const body = { quests: () => this.pQuests(), events: () => this.pEvents(), collection: () => this.pCollection(), friends: () => this.pFriends(), shop: () => this.pShop(), settings: () => this.pSettings(), breed: () => this.pBreed() }[id]();
    const el = $('panel');
    const prevScroll = el.querySelector('.pbody')?.scrollTop || 0;
    el.innerHTML = `<div class="phead"><h2 class="outlined">${TITLES[id]}</h2><div class="pill">${I.coin()}<span>${num(this.s.coins)}</span></div><button class="x" data-act="closePanel" aria-label="Schließen">✕</button></div><div class="pbody">${body}</div>`;
    if (soft) el.querySelector('.pbody').scrollTop = prevScroll;
  }

  tabs(panel, list) {
    const cur = this.tab[panel] || list[0][0];
    return `<div class="tabs">${list.map(([k, l, n]) => `<button class="${k === cur ? 'on' : ''}" data-act="tab" data-panel="${panel}" data-id="${k}">${l}${n ? `<i class="dot">${n}</i>` : ''}</button>`).join('')}</div>`;
  }

  // Belohnungen als kleine Chips
  chips(r = {}, tokenName) {
    const out = [];
    if (r.coins) out.push(`<span class="chip">${I.coin()} ${num(r.coins)}</span>`);
    if (r.xp) out.push(`<span class="chip xp">+${r.xp} EP</span>`);
    for (const [k, n] of Object.entries(r.items || {})) if (n) out.push(`<span class="chip">${I.ITEM[k]} ${n}× ${esc(C.ITEMS[k].name)}</span>`);
    if (r.deco) out.push(`<span class="chip"><img alt="" src="${this.icons.deco[r.deco]}"> ${esc(C.DECO[r.deco].name)}</span>`);
    if (r.skin) out.push(`<span class="chip"><img alt="" src="${this.icons.skin[r.skin]}"> ${esc(C.SKINS[r.skin].name)}</span>`);
    if (r.tokens) out.push(`<span class="chip">${I.leaf()} ${r.tokens} ${esc(tokenName || '')}</span>`);
    return `<div class="chips">${out.join('')}</div>`;
  }

  // ----- Aufgaben: Story, Tagesaufgaben, Levelweg -----
  pQuests() {
    const s = this.s, now = this.api.now();
    const st = G.storyStatus(s);
    const daily = G.claimableTasks(s) + (G.dailyGiftAvailable(s, now) ? 1 : 0);
    const cur = this.tab.quests || 'story';
    let h = this.tabs('quests', [['story', 'Story', !st.finished && st.done ? 1 : 0], ['daily', 'Täglich', daily], ['levels', 'Levelweg']]);
    if (cur === 'story') h += this.storyHtml(st);
    else if (cur === 'daily') h += this.dailyHtml();
    else h += this.levelsHtml();
    return h;
  }

  storyHtml(st) {
    const owl = this.icons.animal.owl;
    if (st.finished) {
      return `<div class="card owlcard"><img alt="" src="${owl}"><div class="speech"><b>Alle ${C.STORY.length} Kapitel geschafft!</b><br>Dein Garten ist der schönste im ganzen Tal. Neue Kapitel folgen mit dem nächsten Update.</div></div>` + this.chapterList(C.STORY.length);
    }
    const ch = st.chapter;
    let h = `<div class="chhead"><small>Kapitel ${st.ch + 1} von ${C.STORY.length}</small><b>${esc(ch.title)}</b></div>`;
    h += `<div class="card owlcard"><img alt="Eule Ophelia" src="${owl}"><div class="speech">${esc(ch.intro)}</div></div>`;
    h += ch.quests.map((q, k) => {
      if (k < st.q) return `<div class="card quest done"><span class="qi">✓</span><div class="grow"><h4>${esc(q.text)}</h4></div></div>`;
      if (k > st.q) return `<div class="card quest next"><span class="qi">${k + 1}</span><div class="grow"><h4>${esc(q.text)}</h4>${this.chips(q.reward)}</div></div>`;
      return `<div class="card quest cur"><div class="row"><span class="qi">${k + 1}</span><div class="grow"><h4>${esc(q.text)}</h4>${this.chips(q.reward)}</div></div>
        <div class="row" style="margin-top:8px"><div class="prog grow"><i style="width:${(st.have / st.need) * 100}%"></i></div><b class="cnt">${num(st.have)}/${num(st.need)}</b>
        ${st.done ? '<button class="btn small" data-act="claimQuest">Abholen</button>' : this.questGo(q.goal)}</div></div>`;
    }).join('');
    return h + this.chapterList(st.ch);
  }

  // "Los"-Knopf, der direkt zum passenden Ort führt
  questGo(goal) {
    const map = { deco: ['shop', 'deco'], rare: ['shop', 'flowers'], greenhouse: ['breed'], breed: ['breed'], sprinkler: ['mode', 'sprinkler'], bedLevel: ['mode', 'upgrade'], beds: ['bed'], useItem: ['shop', 'supplies'] };
    const t = map[goal.type];
    if (!t) return '';
    return `<button class="btn small blue" data-act="go" data-id="${t.join(':')}">Los</button>`;
  }

  chapterList(curCh) {
    return `<div class="sec">Kapitel</div><div class="chlist">${C.STORY.map((c, k) => `<div class="chrow ${k < curCh ? 'done' : k === curCh ? 'cur' : ''}"><span>${k < curCh ? '✓' : k + 1}</span><b>${k <= curCh ? esc(c.title) : '???'}</b></div>`).join('')}</div>`;
  }

  dailyHtml() {
    const s = this.s, now = this.api.now();
    const tasks = G.taskList(s);
    let h = tasks.map((t) => `<div class="card"><div class="row"><div class="grow"><h4>${esc(t.label)}</h4><p>${num(t.have)} / ${num(t.goal)}</p>${this.chips({ coins: t.reward, xp: t.xp })}</div>
      ${t.claimed ? '<button class="btn small off" disabled>✓</button>' : `<button class="btn small" data-act="claim" data-id="${t.id}" ${t.done ? '' : 'disabled'}>Abholen</button>`}</div>
      <div class="prog"><i style="width:${(t.have / t.goal) * 100}%"></i></div></div>`).join('');
    const gift = G.dailyGiftAvailable(s, now);
    h += `<div class="card row">${svg(I.gift, 54)}<div class="grow"><h4>Tägliches Geschenk</h4><p>Jeden Tag ${C.DAILY_GIFT} Münzen gratis.</p></div><button class="btn small" data-act="gift" ${gift ? '' : 'disabled'}>${gift ? 'Abholen' : '✓ Heute'}</button></div>`;
    h += `<p class="note">Neue Tagesaufgaben gibt es jeden Tag um Mitternacht.</p>`;
    return h;
  }

  levelsHtml() {
    const s = this.s, xp = G.xpProgress(s);
    let h = `<div class="card lvcard"><span class="bigstar">${I.star(s.level)}</span><div class="grow"><h4>Level ${s.level}${xp.max ? ' – Maximum!' : ''}</h4><p>${xp.max ? 'Du hast alles erreicht.' : `Noch ${num(xp.need - xp.have)} EP bis Level ${s.level + 1}`}</p><div class="prog"><i style="width:${xp.frac * 100}%"></i></div></div></div>
      <p class="note" style="margin-bottom:12px">EP gibt es beim Ernten, für Story- und Tagesaufgaben und für neue Züchtungen.</p>`;
    h += G.roadmap(s).map((r) => {
      const unl = r.unlocks.map((u) => `<li>${this.unlockIcon(u)}<span>${esc(u.label)}</span></li>`).join('');
      return `<div class="lvrow ${r.reached ? 'done' : r.level === s.level + 1 ? 'next' : ''}"><span class="lvn">${r.reached ? '✓' : r.level}</span><div class="grow"><b>Level ${r.level}</b>${this.chips({ coins: r.reward.coins, items: r.reward.items })}${unl ? `<ul>${unl}</ul>` : ''}</div></div>`;
    }).join('');
    return h;
  }

  unlockIcon(u) {
    const ic = this.icons;
    if (u.kind === 'seed' || u.kind === 'recipe') return `<img alt="" src="${ic.flower[u.id]}">`;
    if (u.kind === 'bed') return `<img alt="" src="${ic.bed}">`;
    if (u.kind === 'item') return I.ITEM[u.id];
    if (u.id === 'sprinkler') return `<img alt="" src="${ic.sprinkler}">`;
    if (u.id === 'greenhouse') return `<img alt="" src="${ic.greenhouse}">`;
    if (u.id === 'bed2' || u.id === 'bed3') return `<img alt="" src="${ic.bedLvl[u.id === 'bed2' ? 2 : 3]}">`;
    return I.sparkle;
  }

  // ----- Events -----
  pEvents() {
    const s = this.s, now = this.api.now();
    const ev = G.eventInfo(s, now);
    let h = '';
    if (ev.active) {
      const a = ev.active;
      const next = ev.milestones.find((m) => !m.reached);
      h += `<div class="evbanner" style="--ev:${a.color}"><div class="evtop"><b>${esc(a.name)}</b><span>${daysLeft(a.end - now)}</span></div><p>${esc(a.desc)}</p>
        <div class="evtok">${svg(I.leaf(a.color), 44)}<div><b>${num(ev.tokens)}</b><small>${esc(a.token)} zum Ausgeben</small></div><div><b>${num(ev.total)}</b><small>insgesamt gesammelt</small></div></div>
        ${next ? `<div class="prog"><i style="width:${Math.min(100, (ev.total / next.at) * 100)}%"></i></div><small>Nächste Belohnung bei ${next.at} ${esc(a.token)}</small>` : '<small>Alle Belohnungen erreicht!</small>'}</div>`;
      h += `<div class="sec">Belohnungen</div>` + ev.milestones.map((m) => `<div class="card row ms ${m.claimed ? 'done' : m.reached ? 'ready' : ''}"><div class="msat">${svg(I.leaf(a.color), 26)}<b>${m.at}</b></div><div class="grow">${this.chips(m.reward)}</div>
        ${m.claimed ? '<button class="btn small off" disabled>✓</button>' : `<button class="btn small" data-act="milestone" data-id="${m.i}" ${m.reached ? '' : 'disabled'}>Abholen</button>`}</div>`).join('');
      h += `<div class="sec">Event-Shop</div><div class="grid2">` + a.shop.map((it) => {
        const owned = it.deco && s.deco.includes(it.deco);
        const icon = it.deco ? `<img alt="" src="${this.icons.deco[it.deco]}">` : svg(I.ITEM[Object.keys(it.items)[0]], 64);
        const label = it.deco ? C.DECO[it.deco].name : Object.entries(it.items).map(([k, n]) => `${n}× ${C.ITEMS[k].name}`).join(', ');
        return `<div class="tile">${icon}<b>${esc(label)}</b>${owned ? '<button class="btn small off" disabled>✓ Im Garten</button>' : `<button class="btn small" data-act="eventBuy" data-id="${it.id}" ${ev.tokens >= it.price ? '' : 'disabled'}>${svg(I.leaf(a.color), 20)} ${it.price}</button>`}</div>`;
      }).join('') + `</div><p class="note">${esc(a.token)} bekommst du bei jeder Ernte – je wertvoller die Blume, desto mehr.</p>`;
    } else {
      h += `<div class="card"><h4>Gerade läuft kein Saison-Event</h4><p>${ev.upcoming[0] ? `Das nächste Event „${esc(ev.upcoming[0].name)}“ startet am ${new Date(ev.upcoming[0].start).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}.` : ''}</p></div>`;
    }
    // Funkel-Wochenende
    const wk = G.isWeekend(now);
    const d = new Date(now), toSat = (6 - d.getDay() + 7) % 7;
    h += `<div class="sec">Jede Woche</div><div class="card row ${wk ? 'glow' : ''}">${svg(I.sparkle, 54)}<div class="grow"><h4>${C.WEEKEND_BONUS.name}${wk ? ' – jetzt aktiv!' : ''}</h4><p>Samstag und Sonntag ist die Chance auf Funkelblüten doppelt so hoch. ${wk ? 'Pflanze jetzt möglichst viel!' : toSat === 1 ? 'Morgen geht es los.' : `Noch ${toSat} Tage.`}</p></div></div>`;
    if (ev.upcoming.length) {
      h += `<div class="sec">Demnächst</div>` + ev.upcoming.filter((u) => !ev.active || u.id !== ev.active.id).map((u) => `<div class="card row"><span class="evdot" style="background:${u.color}"></span><div class="grow"><h4>${esc(u.name)}</h4><p>${new Date(u.start).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} – ${new Date(u.end).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} · ${esc(u.desc)}</p></div></div>`).join('');
    }
    h += `<div class="card row">${svg(I.pass, 56)}<div class="grow"><h4>Saisonpass</h4><p>Ein freiwilliger Saisonpass mit Deko-Belohnungen ist in Vorbereitung – ohne Spielvorteil.</p></div></div>`;
    return h;
  }

  // ----- Sammlung -----
  pCollection() {
    const s = this.s, cur = this.tab.collection || 'flowers';
    let h = this.tabs('collection', [['flowers', 'Blumen'], ['shiny', 'Funkeln'], ['animals', 'Tiere'], ['deco', 'Deko']]);
    if (cur === 'flowers') {
      const found = C.SEED_ORDER.filter((k) => s.collection[k]?.count).length;
      h += `<div class="card"><h4>${found} von ${C.SEED_ORDER.length} Blumen entdeckt</h4><p>Geerntet: ${num(s.stats.harvested)} · Gezüchtet: ${s.bred.length} von ${C.BRED_SEEDS.length}</p><div class="prog"><i style="width:${(found / C.SEED_ORDER.length) * 100}%"></i></div></div>`;
      const tile = (k) => {
        const e = s.collection[k], d = C.SEEDS[k];
        const sub = e?.count ? `${num(e.count)}× geerntet` : d.bred ? (s.bred.includes(k) ? 'Gezüchtet!' : 'Im Gewächshaus züchten') : 'Noch nicht geerntet';
        return `<div class="tile ${e?.count || s.bred.includes(k) ? '' : 'unknown'}">${tierTag(d)}<img alt="" src="${this.icons.flower[k]}"><b>${esc(d.name)}</b><small>${sub}</small></div>`;
      };
      h += `<div class="sec">Gartenblumen</div><div class="grid3">${C.BASE_SEEDS.map(tile).join('')}</div>`;
      h += `<div class="sec">Züchtungen</div><div class="grid3">${C.BRED_SEEDS.map(tile).join('')}</div>`;
      h += `<button class="btn wide" style="margin-top:14px" data-act="openBreed">${svg(I.greenhouse, 28)} Zum Gewächshaus</button>`;
    } else if (cur === 'shiny') {
      const n = C.SEED_ORDER.filter((k) => s.collection[k]?.shiny).length;
      h += `<div class="card row">${svg(I.sparkle, 54)}<div class="grow"><h4>Funkelblüten: ${n} von ${C.SEED_ORDER.length}</h4><p>Mit etwas Glück blüht eine Blume funkelnd. Sie glitzert im Beet und bringt die dreifache Belohnung. Glücksdünger, Prachtbeete und das Funkel-Wochenende erhöhen die Chance.</p></div></div><div class="grid3">`;
      h += C.SEED_ORDER.map((k) => { const e = s.collection[k]; return `<div class="tile ${e?.shiny ? '' : 'unknown'}"><img alt="" src="${this.icons.shiny[k]}"><b>${esc(C.SEEDS[k].name)}</b><small>${e?.shiny ? `${e.shiny}× gefunden` : '???'}</small></div>`; }).join('') + '</div>';
    } else if (cur === 'animals') {
      h += Object.entries(C.ANIMALS).map(([k, d]) => {
        const seen = s.seenAnimals.includes(k);
        const skins = Object.entries(C.SKINS).filter(([, v]) => v.animal === k);
        const skinBtns = skins.length ? `<div class="btnrow"><button class="btn small ${s.activeSkin[k] === 'default' ? 'off' : 'ghost'}" data-act="equip" data-animal="${k}" data-id="default">Standard</button>${skins.map(([sk, v]) => s.skins.includes(sk) ? `<button class="btn small ${s.activeSkin[k] === sk ? 'off' : 'ghost'}" data-act="equip" data-animal="${k}" data-id="${sk}">${esc(v.name)}</button>` : `<button class="btn small ghost" data-act="tab" data-panel="shop" data-id="animals">${I.lock.replace('class="lock"', 'style="width:16px;height:16px"')} ${esc(v.name)}</button>`).join('')}</div>` : '';
        const hint = k === 'butterfly' ? 'Halte am Tag Ausschau!' : k === 'owl' ? 'Sie zeigt sich nur nachts – tippe sie an.' : 'Tippe es im Garten an, um es zu entdecken.';
        return `<div class="card row"><img class="ic" alt="" src="${this.icons.animal[k]}" style="${seen ? '' : 'filter:brightness(0) opacity(.25)'}"><div class="grow"><h4>${esc(d.name)} ${seen ? '✓' : ''}</h4><p>${esc(d.desc)} ${seen ? '' : hint}</p>${skinBtns}</div></div>`;
      }).join('');
    } else {
      const own = C.ALL_DECO.filter((k) => s.deco.includes(k));
      h += own.length ? `<div class="grid3">${own.map((k) => `<div class="tile"><img alt="" src="${this.icons.deco[k]}"><b>${esc(C.DECO[k].name)}</b>${C.DECO[k].event ? '<small>Event-Deko</small>' : ''}</div>`).join('')}</div>` : `<div class="card"><h4>Noch keine Deko</h4><p>Im Shop findest du Laternen, Bänke, Kürbisse und mehr für deinen Garten.</p></div>`;
      h += `<button class="btn wide" style="margin-top:12px" data-act="tab" data-panel="shop" data-id="deco">Zum Deko-Shop</button>`;
    }
    return h;
  }

  // ----- Gewächshaus & Zucht -----
  pBreed() {
    const s = this.s, now = this.api.now(), night = this.api.isNight();
    if (!s.greenhouse.unlocked) {
      const lvOk = s.level >= C.GREENHOUSE.level;
      return `<div class="card ghcard"><img alt="" src="${this.icons.greenhouse}"><h4>Das alte Gewächshaus</h4><p>Hinter dem Haus steht Ophelias altes Gewächshaus. Restauriert kannst du darin zwei Blumen kreuzen und ganz neue Sorten züchten – wie die Nordlicht-Rose, die Schwarze Rose oder die legendäre Sternenrose.</p>
        <button class="btn big" data-act="restoreGH" ${lvOk ? '' : 'disabled'}>${lvOk ? `Restaurieren · ${I.coin()} ${C.GREENHOUSE.cost}` : `Ab Level ${C.GREENHOUSE.level}`}</button></div>` + this.recipeList(false, night);
    }
    const job = G.breedingInfo(s, now);
    let h = '';
    if (job) {
      const d = C.SEEDS[job.result];
      h += `<div class="card jobcard"><img alt="" src="${this.icons.flower[job.result]}" class="${job.ready ? '' : 'growing'}"><div class="grow"><small>${job.ready ? 'Fertig gezüchtet!' : 'Wird gezüchtet …'}</small><h4>${esc(d.name)} ${tierTag(d)}</h4>
        <div class="prog"><i style="width:${job.progress * 100}%"></i></div><p>${job.ready ? 'Hol deine neue Sorte ab – danach kannst du sie in jedes Beet pflanzen.' : `Noch ${fmtTime(job.remaining)}`}</p></div></div>
        <div class="btnrow center">${job.ready ? '<button class="btn big" data-act="collectBreed">Abholen</button>' : `<button class="btn ${s.items.boost ? 'gold' : 'ghost'}" data-act="boostBreed" ${s.level >= C.ITEMS.boost.level ? '' : 'disabled'}>${svg(I.ITEM.boost, 28)} ${s.items.boost ? `Beschleuniger benutzen (${s.items.boost})` : s.level >= C.ITEMS.boost.level ? `Beschleuniger ${I.coin()} ${C.ITEMS.boost.price}` : `Beschleuniger ab Lv ${C.ITEMS.boost.level}`}</button>`}</div>`;
    } else {
      h += `<div class="card row">${svg(night ? I.moonSmall : I.greenhouse, 50)}<div class="grow"><h4>Zuchtbuch</h4><p>Wähle eine Kreuzung. Beide Eltern-Blumen musst du schon einmal geerntet haben. ${night ? '<b>Es ist Nacht – jetzt gelingen auch Nachtzüchtungen.</b>' : ''}</p></div></div>`;
    }
    return h + this.recipeList(true, night, !!job);
  }

  recipeList(active, night, busy) {
    const s = this.s;
    return `<div class="sec">Kreuzungen</div>` + C.RECIPES.map((r, idx) => {
      const d = C.SEEDS[r.result], bred = s.bred.includes(r.result);
      const pa = G.discovered(s, r.a), pb = G.discovered(s, r.b);
      const reasons = [];
      if (!pa) reasons.push(`Ernte zuerst: ${plain(C.SEEDS[r.a].name)}`);
      if (!pb) reasons.push(`Ernte zuerst: ${plain(C.SEEDS[r.b].name)}`);
      if (s.level < d.level) reasons.push(`ab Level ${d.level}`);
      if (r.night && !night) reasons.push('nur nachts');
      const parent = (k, ok) => `<span class="par ${ok ? '' : 'miss'}"><img alt="" src="${this.icons.flower[k]}"><small>${esc(C.SEEDS[k].name)}</small></span>`;
      let btn;
      if (bred) btn = '<span class="okbadge">✓ Gezüchtet</span>';
      else if (!active) btn = '';
      else btn = `<button class="btn small" data-act="breed" data-id="${idx}" ${busy || reasons.length ? 'disabled' : ''}>Züchten · ${I.coin()} ${r.cost}</button>`;
      return `<div class="card recipe ${bred ? 'bred' : ''}"><div class="rline">${parent(r.a, pa)}<span class="plus">+</span>${parent(r.b, pb)}<span class="arrow">➜</span><span class="par res ${bred ? '' : 'unknown'}"><img alt="" src="${this.icons.flower[r.result]}"><small>${esc(d.name)}</small></span></div>
        <div class="rfoot">${tierTag(d)}<span class="meta">⏱ ${growLabel(r.ms)}${r.night ? ` · ${svg(I.moonSmall, 16)} nachts` : ''}</span>${reasons.length && !bred ? `<span class="why">${esc(reasons.join(' · '))}</span>` : `<span class="hint">${esc(r.hint)}</span>`}${btn}</div></div>`;
    }).join('');
  }

  // ----- Shop -----
  pShop() {
    const s = this.s, cur = this.tab.shop || 'offers', now = this.api.now();
    let h = this.tabs('shop', [['offers', 'Angebote'], ['supplies', 'Bedarf'], ['flowers', 'Blumen'], ['deco', 'Deko'], ['animals', 'Tiere']]);
    if (cur === 'offers') {
      const mid = new Date(now); mid.setHours(24, 0, 0, 0);
      const mins = Math.max(0, Math.floor((mid - now) / 60000));
      const left = `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
      const gift = G.dailyGiftAvailable(s, now);
      const B = C.IAP.bundle_deco;
      h += `<div class="offer"><div class="rainbow"></div><div class="timer">⏱ ${left}</div>
          <div class="items one"><div class="it">${I.gift}<b>${C.DAILY_GIFT} Münzen</b></div></div>
          <div class="ofoot"><div><div class="ribbon">♥ Gratis</div><div class="otitle">Tägliches<br>Geschenk</div></div>
          <button class="btn big" data-act="gift" ${gift ? '' : 'disabled'}>${gift ? 'Abholen' : 'Morgen wieder'}</button></div></div>
        <div class="offer rose"><div class="items">
          ${[['lantern', 'Laterne'], ['bench', 'Bank'], ['birdbath', 'Tränke'], ['flowerpots', 'Töpfe'], ['wheelbarrow', 'Karre']].map(([k, l]) => `<div class="it"><img alt="${l}" src="${this.icons.deco[k]}"><b>${l}</b></div>`).join('')}
          <div class="it"><img alt="Polarfuchs" src="${this.icons.skin.arctic}"><b>Polarfuchs</b></div></div>
          <div class="ofoot"><div><div class="ribbon">♥ Beliebt</div><div class="otitle">Deko-<br>Paket</div></div>
          <button class="btn big" data-act="iap" data-id="bundle_deco">${formatEUR(B.priceEUR)}</button></div></div>
        <div class="packs">${[['coins_small', I.coin()], ['coins_medium', I.coinPile()], ['coins_large', I.coinChest()]].map(([k, ic]) => {
          const p = C.IAP[k];
          return `<div class="pack">${p.tag ? `<span class="tag">${p.tag}</span>` : ''}${ic.replace('class="coin"', 'style="width:62px;height:62px"')}<b>${num(p.coins)}</b><button class="btn" data-act="iap" data-id="${k}">${formatEUR(p.priceEUR)}</button></div>`;
        }).join('')}</div>
        <button class="btn pink big morebtn" data-act="tab" data-panel="shop" data-id="supplies">Gartenbedarf <span style="font-size:30px;line-height:.8">+</span></button>
        <div class="card row" style="margin-top:18px">${svg(I.video, 56)}<div class="grow"><h4>Gratis-Münzen</h4><p>Freiwillig ein kurzes Video ansehen und ${C.REWARDED_VIDEO.reward} Münzen erhalten.</p></div><button class="btn small blue" data-act="video">Ansehen</button></div>
        <div class="card row">${svg(I.pass, 56)}<div class="grow"><h4>Saisonpass Herbst</h4><p>Exklusive Deko und Belohnungen für die Saison – kommt bald.</p></div><button class="btn small gold" data-act="info" data-id="pass">Info</button></div>
        <p class="note">Echtgeld-Käufe sind noch nicht aktiv. BloomWorld bleibt fair: Alles ist auch ohne Geld erreichbar, und es gibt keinen Wettbewerb gegen andere Spieler – kein Pay-to-win.</p>`;
    } else if (cur === 'supplies') {
      h += `<div class="sec" style="margin-top:4px">Dünger & Helfer</div>` + C.ITEM_ORDER.map((k) => {
        const it = C.ITEMS[k], lvOk = s.level >= it.level;
        return `<div class="card itemcard"><div class="row">${svg(I.ITEM[k], 60)}<div class="grow"><h4>${esc(it.name)} <span class="have">Du hast ${s.items[k]}</span></h4><p>${esc(it.desc)}</p></div></div>
          <div class="btnrow">${lvOk ? `<button class="btn small" data-act="buyItem" data-id="${k}">1× · ${I.coin()} ${it.price}</button>${it.pack ? `<button class="btn small blue" data-act="buyPack" data-id="${k}">${it.pack[0]}× · ${I.coin()} ${it.pack[1]} <i class="save">-${Math.round((1 - it.pack[1] / (it.price * it.pack[0])) * 100)} %</i></button>` : ''}${s.items[k] && k !== 'boost' ? `<button class="btn small ghost" data-act="itemMode" data-id="${k}">Benutzen</button>` : ''}${s.items[k] && k === 'boost' ? '<button class="btn small ghost" data-act="openBreed">Zum Gewächshaus</button>' : ''}` : `<button class="btn small" disabled>${I.lock.replace('class="lock"', 'style="width:16px;height:16px"')} ab Level ${it.level}</button>`}</div></div>`;
      }).join('');
      const unlocked = s.beds.filter((b) => !b.locked).length, spr = s.beds.filter((b) => b.sprinkler).length;
      const sprOk = s.level >= C.SPRINKLER.level;
      h += `<div class="sec">Garten-Ausbau</div>
        <div class="card itemcard"><div class="row"><img class="ic" alt="" src="${this.icons.sprinkler}"><div class="grow"><h4>Automatische Bewässerung <span class="have">${spr}/${unlocked} Beete</span></h4><p>Ein Sprinkler gießt das Beet von selbst – Blumen wachsen dort für immer 30 % schneller.</p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="sprinklerMode" ${sprOk && spr < unlocked ? '' : 'disabled'}>${sprOk ? `Installieren · ${I.coin()} ${C.SPRINKLER.cost} pro Beet` : `ab Level ${C.SPRINKLER.level}`}</button></div></div>
        <div class="card itemcard"><div class="row"><img class="ic" alt="" src="${this.icons.bedLvl[2]}"><div class="grow"><h4>Beete ausbauen</h4><p>${C.BED_LEVELS.slice(1).map((b) => `<b>${b.name}</b>: ×${String(b.mult).replace('.', ',')} Münzen${b.shiny ? ', mehr Funkelblüten' : ''} (ab Level ${b.level}, ${num(b.cost)} Münzen)`).join('<br>')}</p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="upgradeMode" ${s.level >= C.BED_LEVELS[1].level ? '' : 'disabled'}>${s.level >= C.BED_LEVELS[1].level ? 'Beet auswählen' : `ab Level ${C.BED_LEVELS[1].level}`}</button></div></div>
        <div class="card itemcard"><div class="row"><img class="ic" alt="" src="${this.icons.bed}"><div class="grow"><h4>Neue Beete <span class="have">${unlocked}/${C.BED_COUNT}</span></h4><p>Mehr Beete bedeuten mehr Blumen gleichzeitig. Neue Plätze werden mit steigendem Level freigeschaltet.</p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="showNextBed" ${unlocked < C.BED_COUNT ? '' : 'disabled'}>${unlocked < C.BED_COUNT ? 'Nächstes Beet zeigen' : 'Alle Beete frei'}</button></div></div>`;
      if (!s.greenhouse.unlocked) h += `<div class="card itemcard"><div class="row"><img class="ic" alt="" src="${this.icons.greenhouse}"><div class="grow"><h4>Gewächshaus</h4><p>Restaurieren, um neue Sorten zu züchten. Ab Level ${C.GREENHOUSE.level}.</p></div></div><div class="btnrow"><button class="btn small blue" data-act="openBreed">Ansehen</button></div></div>`;
    } else if (cur === 'flowers') {
      h += `<div class="sec" style="margin-top:4px">Seltene Blumen</div>` + C.BASE_SEEDS.filter((k) => C.SEEDS[k].rare).map((k) => {
        const d = C.SEEDS[k], own = s.rareUnlocked.includes(k), lvOk = s.level >= d.level;
        return `<div class="card row"><img class="ic" alt="" src="${this.icons.flower[k]}"><div class="grow"><h4>${esc(d.name)}</h4><p>Wächst ${growLabel(d.growMs)} · bringt ${d.reward} Münzen pro Ernte</p></div>${own ? '<button class="btn small off" disabled>✓ Frei</button>' : lvOk ? `<button class="btn small" data-act="unlockRare" data-id="${k}">${I.coin()} ${d.unlockCoins}</button>` : `<button class="btn small" disabled>Lv ${d.level}</button>`}</div>`;
      }).join('') + `<div class="sec">Saatgut nach Level</div>` + C.BASE_SEEDS.filter((k) => !C.SEEDS[k].rare).map((k) => {
        const d = C.SEEDS[k], ok = s.level >= d.level;
        return `<div class="card row"><img class="ic" alt="" src="${this.icons.flower[k]}"><div class="grow"><h4>${esc(d.name)}</h4><p>${ok ? 'Verfügbar' : `Ab Level ${d.level}`} · ${d.cost} Münzen Saatgut</p></div>${ok ? '<span style="font-size:22px">✓</span>' : I.lock.replace('class="lock"', 'style="width:28px;height:28px"')}</div>`;
      }).join('') + `<div class="sec">Züchtungen</div><div class="card row">${svg(I.greenhouse, 56)}<div class="grow"><h4>${s.bred.length} von ${C.BRED_SEEDS.length} gezüchtet</h4><p>Regenbogentulpe, Goldene Rose, Nordlicht-Rose, Schwarze Rose, Sternenrose und mehr gibt es nicht zu kaufen – du züchtest sie selbst im Gewächshaus.</p></div><button class="btn small blue" data-act="openBreed">Öffnen</button></div>`;
    } else if (cur === 'deco') {
      h += `<div class="grid2">` + C.DECO_ORDER.map((k) => {
        const d = C.DECO[k], own = s.deco.includes(k);
        return `<div class="tile"><img alt="" src="${this.icons.deco[k]}"><b>${esc(d.name)}${d.seasonal ? ' 🍂' : ''}</b><small>${esc(d.desc)}</small>${own ? '<button class="btn small off" disabled>✓ Im Garten</button>' : `<button class="btn small" data-act="buyDeco" data-id="${k}">${I.coin()} ${d.price}</button>`}</div>`;
      }).join('') + `</div><p class="note">Deko erscheint sofort in deinem Garten. Exklusive Deko gibt es bei Events.</p>`;
    } else {
      h += `<div class="grid2">` + Object.entries(C.SKINS).map(([k, d]) => {
        const own = s.skins.includes(k);
        return `<div class="tile"><img alt="" src="${this.icons.skin[k]}"><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>${own ? `<button class="btn small ${s.activeSkin[d.animal] === k ? 'off' : 'blue'}" data-act="equip" data-animal="${d.animal}" data-id="${k}" ${s.activeSkin[d.animal] === k ? 'disabled' : ''}>${s.activeSkin[d.animal] === k ? '✓ Aktiv' : 'Anziehen'}</button>` : `<button class="btn small" data-act="buySkin" data-id="${k}">${I.coin()} ${d.price}</button>`}</div>`;
      }).join('') + `</div><p class="note">Tier-Skins sind rein kosmetisch. Der Herbst-Igel ist auch eine Belohnung im Herbstfest.</p>`;
    }
    return h;
  }

  // ----- Freunde -----
  pFriends() {
    const s = this.s, acc = this.api.account();
    const me = acc.user ? `<div class="card row">${svg(I.user, 54)}<div class="grow"><small style="color:var(--muted)">Dein Spielername</small><h4 style="font-size:20px">${esc(acc.user.name)}</h4><p>Unter diesem Namen finden dich deine Freunde.</p></div></div>` : `<div class="card row">${svg(I.user, 54)}<div class="grow"><h4>Offline-Modus</h4><p>Melde dich an, um einen Spielernamen zu haben und deinen Garten auf allen Geräten zu spielen.</p></div><button class="btn small" data-act="login">Anmelden</button></div>`;
    return `${me}
      <div class="card" style="text-align:center">${svg(I.NAV.friends, 84)}<h4 style="font-size:19px">Gemeinsam gärtnern</h4><p>Gärten von Freunden besuchen, Blumen verschenken und gemeinsam Events meistern – das kommt in einem der nächsten Updates. Lade schon jetzt Freunde ein!</p>
        <button class="btn pink wide" style="margin-top:14px" data-act="share">Freunde einladen</button></div>
      <div class="sec">Dein Garten</div>
      <div class="grid2">
        <div class="tile"><span class="bigstar">${I.star(s.level)}</span><b>Level ${s.level}</b><small>${num(s.xp)} EP gesamt</small></div>
        <div class="tile"><img alt="" src="${this.icons.flower.daisy}" style="width:56px;height:56px"><b>${num(s.stats.harvested)}</b><small>Blumen geerntet</small></div>
        <div class="tile"><img alt="" src="${this.icons.shiny.rose}" style="width:56px;height:56px"><b>${num(s.stats.shiny)}</b><small>Funkelblüten</small></div>
        <div class="tile"><img alt="" src="${this.icons.flower.northRose}" style="width:56px;height:56px"><b>${s.bred.length} / ${C.BRED_SEEDS.length}</b><small>Züchtungen</small></div>
      </div>`;
  }

  // ----- Einstellungen -----
  pSettings() {
    const st = this.s.settings, acc = this.api.account();
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="set" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
    const LBL = { music: 'Musik', sound: 'Soundeffekte', musicVol: 'Musik-Lautstärke', soundVol: 'Effekt-Lautstärke', cycleMin: 'Länge eines Tages in Minuten' };
    const sw = (key) => `<button class="switch ${st[key] ? 'on' : ''}" role="switch" aria-checked="${!!st[key]}" data-act="toggle" data-key="${key}" aria-label="${LBL[key]}"></button>`;
    const range = (key, min, max, step, val, dis) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-key="${key}" style="--v:${((val - min) / (max - min)) * 100}%" ${dis ? 'disabled' : ''} aria-label="${LBL[key]}">`;
    const qd = { auto: 'Passt sich automatisch deinem Gerät an.', high: 'Schärfste Grafik mit weichen Schatten.', medium: 'Ausgewogen – gut für die meisten Handys.', low: 'Spart Akku: ohne Schatten, weniger Animation.' };
    const syncTxt = { saved: acc.lastSaved ? `In deinem Konto gespeichert (${new Date(acc.lastSaved).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr)` : 'In deinem Konto gespeichert', saving: 'Wird gespeichert …', offline: 'Keine Verbindung – wird später hochgeladen. Auf diesem Gerät ist alles gesichert.', error: 'Server-Speichern hat nicht geklappt – neuer Versuch läuft. Auf diesem Gerät ist alles gesichert.', auth: 'Bitte melde dich erneut an, damit dein Fortschritt hochgeladen wird.' };
    const account = acc.user
      ? `<div class="card set"><div class="lab">Konto</div><div class="row">${svg(I.user, 44)}<div class="grow"><h4>${esc(acc.user.name)}</h4><p>${esc(acc.user.email)}</p></div></div>
          <p class="sync">${svg(I.cloud, 22)} ${esc(syncTxt[acc.status] || syncTxt.saved)}</p>
          <div class="btnrow"><button class="btn small ghost" data-act="logout">Abmelden</button><button class="btn small red" data-act="deleteAccount">Konto löschen</button></div></div>`
      : `<div class="card set"><div class="lab">Konto</div><p>Du spielst offline. Dein Garten wird nur auf diesem Gerät gespeichert. Mit einem Konto ist er auf jedem Gerät verfügbar – dein bisheriger Fortschritt wird übernommen.</p><button class="btn small" style="align-self:flex-start" data-act="login">Anmelden oder registrieren</button></div>`;
    return `${account}
      <div class="card set"><div class="lab">Tageszeit</div>${seg('cycle', [['auto', 'Automatischer Zyklus'], ['day', 'Immer Tag'], ['night', 'Immer Nacht']])}
        <div class="lab" style="margin-top:6px">Zyklusgeschwindigkeit <small>1 Tag = ${st.cycleMin} Min</small></div>${range('cycleMin', 2, 30, 1, st.cycleMin, st.cycle !== 'auto')}
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:-6px"><span>schnell</span><span>langsam</span></div></div>
      <div class="card set"><div class="lab">Grafik &amp; Leistung</div>${seg('quality', [['auto', 'Auto'], ['high', 'Hoch'], ['medium', 'Mittel'], ['low', 'Sparsam']])}<p>${qd[st.quality]}</p></div>
      <div class="card set"><div class="lab">Musik ${sw('music')}</div>${range('musicVol', 0, 1, 0.05, st.musicVol, !st.music)}
        <div class="lab" style="margin-top:6px">Soundeffekte ${sw('sound')}</div>${range('soundVol', 0, 1, 0.05, st.soundVol, !st.sound)}</div>
      <div class="card set"><div class="lab">Spielstand</div><p>Wird automatisch gespeichert${acc.user ? ' – in deinem Konto und auf diesem Gerät' : ' – auf diesem Gerät'}.</p><button class="btn red small" style="align-self:flex-start;margin-top:6px" data-act="reset">Garten neu beginnen</button></div>
      <div class="btnrow center"><button class="btn small ghost" data-act="privacy">Datenschutz</button></div>
      <p class="note">BloomWorld · Version 3.0<br>Schrift: Poppins (SIL Open Font License)</p>`;
  }

  // ---------- Klicks in Panels, Leisten, Dialogen ----------
  onAct(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    // Schutz vor versehentlichen Doppel-Tipps direkt nach dem Öffnen
    if (performance.now() - (this.openedAt || 0) < 300 && el.closest('#sheet')) return;
    const { act: a, id } = el.dataset;
    const bed = el.dataset.bed !== undefined ? +el.dataset.bed : this.sheetBed;
    const A = this.api.act;
    switch (a) {
      case 'closePanel': this.nav('garden'); break;
      case 'closeSheet': this.closeSheet(); break;
      case 'closeModal': this.closeModal(); break;
      case 'tab': this.closeModal(); this.api.sound.play('tap'); this.tab[el.dataset.panel] = id; if (this.panel !== el.dataset.panel) this.nav(el.dataset.panel, id); else { this.renderPanel(); $('panel').querySelector('.pbody').scrollTo(0, 0); } break;
      case 'plant': A.plant(this.sheetBed, id); break;
      case 'plantAll': A.plantAll(id); break;
      case 'seedLocked': this.api.sound.play('error'); this.toast(`${plain(C.SEEDS[id].name)}: ${G.seedStatus(this.s, id).reason}.`, 'err'); break;
      case 'gotoShop': this.closeSheet(); this.nav('shop', 'flowers'); break;
      case 'gotoBreed': case 'openBreed': this.closeModal(); this.closeSheet(); this.nav('breed'); break;
      case 'harvestBed': this.closeSheet(); A.harvest(bed); break;
      case 'useItem': A.useItem(id, bed); break;
      case 'buyUse': A.buyAndUse(id, bed); break;
      case 'sprinkler': A.buySprinkler(bed); break;
      case 'upgradeBed': A.upgradeBed(bed); break;
      case 'buyItem': A.buyItem(id, false); break;
      case 'buyPack': A.buyItem(id, true); break;
      case 'itemMode': this.setMode({ kind: 'item', id }); break;
      case 'sprinklerMode': this.setMode({ kind: 'sprinkler' }); break;
      case 'upgradeMode': this.setMode({ kind: 'upgrade' }); break;
      case 'endMode': this.setMode(null); break;
      case 'showNextBed': A.showNextBed(); break;
      case 'restoreGH': A.restoreGreenhouse(); break;
      case 'breed': A.breed(+id); break;
      case 'collectBreed': A.collectBreed(); break;
      case 'boostBreed': A.boostBreed(); break;
      case 'claimQuest': A.claimQuest(); break;
      case 'go': A.go(id); break;
      case 'milestone': A.claimMilestone(+id); break;
      case 'eventBuy': A.buyEventItem(id); break;
      case 'gift': A.gift(); break;
      case 'iap': A.iap(id); break;
      case 'video': A.video(); break;
      case 'unlockRare': A.unlockRare(id); break;
      case 'buyDeco': A.buyDeco(id); break;
      case 'buySkin': A.buySkin(id); break;
      case 'equip': A.equip(el.dataset.animal, id); break;
      case 'claim': A.claim(id); break;
      case 'share': A.share(); break;
      case 'set': A.setting(el.dataset.key, el.dataset.val); break;
      case 'toggle': A.setting(el.dataset.key, !this.s.settings[el.dataset.key]); break;
      case 'reset': this.confirm({ title: 'Neu beginnen?', text: 'Dein ganzer Garten, alle Münzen, Züchtungen und die Sammlung werden gelöscht. Das kann nicht rückgängig gemacht werden.', ok: 'Ja, neu beginnen', okClass: 'red', onOk: () => A.reset() }); break;
      case 'info': this.modal({ title: 'Saisonpass', html: `${svg(I.pass, 96)}<p>Der Saisonpass kommt mit einem der nächsten Saison-Events. Er wird freiwillig sein und nur Deko und Komfort enthalten – kein Pay-to-win.</p>`, buttons: [['OK', 'closeModal', '']] }); break;
      case 'unlockBed': this.closeModal(); A.unlockBed(+id); break;
      case 'modalOk': { const f = this._onOk; this.closeModal(); f?.(); break; }
      case 'toastAct': this.hideToast(); this._toastAction?.(); break;
      case 'login': A.login(); break;
      case 'logout': this.confirm({ title: 'Abmelden?', text: 'Dein Spielstand ist in deinem Konto gespeichert. Du kannst dich jederzeit wieder anmelden.', ok: 'Abmelden', onOk: () => A.logout() }); break;
      case 'deleteAccount': this.deleteAccountDialog(); break;
      case 'confirmDelete': { const pw = $('delPw')?.value || ''; A.deleteAccount(pw); break; }
      case 'privacy': this.modal({ title: 'Datenschutz', html: PRIVACY_HTML, buttons: [['OK', 'closeModal', '']] }); break;
      case 'storyOk': this.closeModal(); A.storySeen(); break;
    }
  }

  onInput(e) {
    const el = e.target;
    if (el.type !== 'range') return;
    const v = parseFloat(el.value);
    el.style.setProperty('--v', ((v - el.min) / (el.max - el.min)) * 100 + '%');
    if (el.dataset.key === 'cycleMin') el.closest('.card').querySelector('.lab small').textContent = `1 Tag = ${v} Min`;
    this.api.act.setting(el.dataset.key, v, true);
  }

  // ---------- Dialoge (mit Warteschlange) ----------
  modal(opts) {
    if (opts.queue && this.modalOpen) { this.modalQueue.push(opts); return; }
    const { title, html, buttons = [], onOk, cls = '' } = opts;
    this._onOk = onOk;
    $('modal').innerHTML = `<div class="dlg ${cls}">${title ? `<div class="ttl">${esc(title)}</div>` : ''}<button class="x" data-act="closeModal" aria-label="Schließen">✕</button>${html}<div class="btns">${buttons.map(([l, act, c, extra = '']) => `<button class="btn ${c}" data-act="${act}" ${extra}>${l}</button>`).join('')}</div></div>`;
    $('modal').classList.add('open');
    this.syncHistory();
  }
  closeModal() {
    const was = this.modalOpen;
    $('modal').classList.remove('open'); this._onOk = null;
    if (this.modalQueue.length) { const next = this.modalQueue.shift(); setTimeout(() => this.modal(next), 220); return; }
    if (was) this.syncHistory();
  }
  get modalOpen() { return $('modal').classList.contains('open'); }
  get busy() { return this.modalOpen || this.modalQueue.length > 0; }

  confirm({ title, text, ok = 'OK', okClass = '', onOk }) {
    this.modal({ title, html: `<p>${esc(text)}</p>`, buttons: [['Abbrechen', 'closeModal', 'ghost'], [ok, 'modalOk', okClass]], onOk });
  }

  deleteAccountDialog() {
    this.modal({ title: 'Konto löschen', html: `<p>Dein Konto, dein Spielername und dein gesamter Spielstand werden <b>endgültig</b> gelöscht. Bitte gib zur Bestätigung dein Passwort ein.</p>
      <label class="fld"><span>Passwort</span><input type="password" id="delPw" autocomplete="current-password" maxlength="128"></label><p class="ferr" id="delErr" role="alert"></p>`,
    buttons: [['Abbrechen', 'closeModal', 'ghost'], ['Endgültig löschen', 'confirmDelete', 'red']] });
    setTimeout(() => $('delPw')?.focus(), 250);
  }
  deleteError(msg) { const e = $('delErr'); if (e) e.textContent = msg; }

  bedLockedDialog(i) {
    const s = this.s, u = C.BED_UNLOCK[i];
    if (s.level < u.level) {
      this.modal({ title: 'Neues Beet', html: `<img class="big" alt="" src="${this.icons.bed}"><p>Dieses Beet kannst du ab <b>Level ${u.level}</b> freischalten. Ernte Blumen und erledige Aufgaben, um aufzusteigen.</p><div class="big-num">${I.coin()} ${num(u.cost)}</div>`, buttons: [['Zu den Aufgaben', 'tab', 'blue', 'data-panel="quests" data-id="story"'], ['OK', 'closeModal', 'ghost']] });
      return;
    }
    const ok = s.coins >= u.cost;
    this.modal({ title: 'Neues Beet', html: `<img class="big" alt="" src="${this.icons.bed}"><p>Erweitere deinen Garten um ein weiteres Hochbeet.</p><div class="big-num">${I.coin()} ${num(u.cost)}</div>${ok ? '' : `<p style="color:#b3123a">Dir fehlen noch ${num(u.cost - s.coins)} Münzen.</p>`}`, buttons: ok ? [['Freischalten', 'unlockBed', '', `data-id="${i}"`]] : [['Zum Shop', 'tab', 'pink', 'data-panel="shop" data-id="offers"'], ['OK', 'closeModal', 'ghost']] });
  }

  levelUp(up) {
    const unlocks = up.unlocks.map((u) => `<li>${this.unlockIcon(u)}<span>${esc(u.label)}</span></li>`).join('');
    this.modal({ queue: true, title: `Level ${up.level}!`, html: `<span class="bigstar huge">${I.star(up.level)}</span><p>Glückwunsch! Dein Garten wächst.</p>${this.chips({ coins: up.reward, items: up.items })}${unlocks ? `<ul class="unl">${unlocks}</ul>` : ''}`, buttons: [['Weiter', 'closeModal', '']] });
  }

  owlDialog({ title, heading, text, reward, button = 'Weiter', act = 'closeModal', queue = true }) {
    this.modal({ queue, cls: 'owl', title, html: `${heading ? `<h3 class="dhead">${esc(heading)}</h3>` : ''}<div class="owlsay"><img alt="Eule Ophelia" src="${this.icons.animal.owl}"><div class="speech">${esc(text)}</div></div>${reward ? this.chips(reward) : ''}`, buttons: [[button, act, '']] });
  }

  storyIntro(st) {
    this.owlDialog({ title: `Kapitel ${st.ch + 1}`, heading: st.chapter.title, text: st.chapter.intro, button: 'Los geht\'s!', act: 'storyOk', queue: false });
  }

  // ---------- Hinweise ----------
  toast(msg, kind = '', action) {
    const t = $('toast');
    this._toastAction = action?.fn;
    t.className = 'open ' + kind;
    t.innerHTML = `<span>${msg}</span>${action ? `<button class="btn small pink" data-act="toastAct">${esc(action.label)}</button>` : ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), action ? 4200 : 2800);
  }
  hideToast() { $('toast').classList.remove('open'); }

  // fliegende Münzen vom Beet zur Münzanzeige (+ Event-Blätter)
  floatReward(i, amount, shiny, tokens, tokenColor) {
    const p = i === GH ? this.api.world.greenhouseScreen() : this.api.world.bedScreen(i);
    if (!p) return;
    const box = $('floaters');
    const label = document.createElement('div');
    label.className = 'fly' + (shiny ? ' gold' : '');
    label.innerHTML = `${amount ? `+${amount}${shiny ? ' ★' : ''}` : ''}${tokens ? `<span class="tok">${svg(I.leaf(tokenColor), 22)}+${tokens}</span>` : ''}`;
    box.appendChild(label);
    label.animate([{ transform: `translate(${p[0] - 24}px, ${p[1] - 10}px) scale(0.6)`, opacity: 0 }, { transform: `translate(${p[0] - 24}px, ${p[1] - 50}px) scale(1.15)`, opacity: 1, offset: 0.3 }, { transform: `translate(${p[0] - 24}px, ${p[1] - 90}px) scale(1)`, opacity: 0 }], { duration: 1300, easing: 'ease-out' }).onfinish = () => label.remove();
    if (!amount) return;
    const target = $('coinIcon').getBoundingClientRect();
    const n = Math.min(8, 3 + Math.floor(amount / 20));
    for (let k = 0; k < n; k++) {
      const c = document.createElement('div');
      c.className = 'flycoin'; c.innerHTML = I.coin('');
      box.appendChild(c);
      const sx = p[0] + (Math.random() - 0.5) * 60, sy = p[1] + (Math.random() - 0.5) * 30;
      const anim = c.animate([{ transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 }, { transform: `translate(${sx + (Math.random() - 0.5) * 40}px, ${sy - 40}px) scale(1.1)`, opacity: 1, offset: 0.25 }, { transform: `translate(${target.left}px, ${target.top}px) scale(0.8)`, opacity: 1 }], { duration: 700 + k * 70, easing: 'cubic-bezier(.5,0,.6,1)', delay: k * 40 });
      anim.onfinish = () => { c.remove(); if (k === n - 1) { this.bumpCoins(); this.api.sound.play('coin'); } };
    }
  }
}
