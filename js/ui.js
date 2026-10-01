// Oberfläche von BloomWorld: Kopfleiste, Menü, Saat-Auswahl, Panels, Dialoge, Hinweise.
import * as C from './config.js';
import * as G from './game.js';
import * as I from './icons.js';
import { formatEUR } from './payments.js';
import { PHASE_LABEL } from './world/sky.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Math.floor(n).toLocaleString('de-DE');

export function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `0:${String(s).padStart(2, '0')}`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return `${m}:${String(r).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} Std ${m % 60} Min`;
}
const growLabel = (ms) => (ms < 60_000 ? `${ms / 1000} Sek` : `${Math.round(ms / 60_000)} Min`);

const NAV_ITEMS = [
  ['garden', 'Garten'], ['collection', 'Sammlung'], ['events', 'Events'], ['friends', 'Freunde'], ['shop', 'Shop'],
];

export class UI {
  constructor(api) {
    this.api = api; // { state, now, icons, sound, act, world }
    this.icons = api.icons;
    this.panel = null; this.tab = {};
    this.sheetBed = -1;
    this.bubbleKeys = [];
    this.toastTimer = null;
    this.modalStack = [];
  }

  get s() { return this.api.state(); }

  init() {
    $('coinIcon').innerHTML = I.coin();
    $('gearBtn').innerHTML = I.gear;
    $('tasksBtn').insertAdjacentHTML('afterbegin', I.tasksIcon);
    $('centerBtn').insertAdjacentHTML('afterbegin', I.target);
    $('nav').innerHTML = NAV_ITEMS.map(([id, label]) => `<button data-nav="${id}" class="${id === 'garden' ? 'on' : ''}" aria-label="${label}">${I.NAV[id]}<span>${label}</span>${id === 'events' ? '<i class="badge" id="navBadge" hidden></i>' : ''}</button>`).join('');
    // Beet-Blasen
    const bub = $('bubbles');
    bub.innerHTML = Array.from({ length: C.BED_COUNT }, (_, i) => `<div class="bub" id="bub${i}" data-bed="${i}" hidden></div>`).join('');
    this.bubbles = Array.from({ length: C.BED_COUNT }, (_, i) => $('bub' + i));

    // Ereignisse
    $('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b) this.nav(b.dataset.nav); });
    $('gearBtn').onclick = () => this.nav('settings');
    $('coinPlus').onclick = () => this.nav('shop', 'offers');
    $('lvl').onclick = () => this.showLevelInfo();
    $('tasksBtn').onclick = () => this.nav('events');
    $('centerBtn').onclick = () => { this.api.sound.play('tap'); this.api.world.resetView(); };
    $('harvestAll').onclick = () => this.api.act.harvestAll();
    for (const el of [$('panel'), $('sheet'), $('modal'), $('toast')]) el.addEventListener('click', (e) => this.onAct(e));
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    $('panel').addEventListener('input', (e) => this.onInput(e));
    for (const id of ['hud', 'side', 'nav']) $(id).hidden = false;
    // Senkrechtes Mausrad scrollt die Saatgut-Leiste waagerecht (Desktop)
    $('sheet').addEventListener('wheel', (e) => { const row = e.target.closest('.seeds'); if (row && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    $('panel').inert = true; $('sheet').inert = true;
    this.refresh();
  }

  // ---------- Zurück-Taste (Android) und Escape ----------
  // Solange ein Menü, Dialog oder die Saat-Auswahl offen ist, liegt ein Eintrag im Verlauf.
  syncHistory() {
    const open = this.modalOpen || this.sheetBed >= 0 || !!this.panel;
    try {
      if (open && !this.guard) { history.pushState({ bloomworld: 1 }, ''); this.guard = true; }
      else if (!open && this.guard) { this.guard = false; this.ignorePop = true; history.back(); }
    } catch { /* z.B. in eingebetteten Ansichten */ }
  }
  onPopState() {
    if (this.ignorePop) { this.ignorePop = false; return; }
    this.guard = false;
    this.back();
  }
  back() {
    if (this.modalOpen) this.closeModal();
    else if (this.sheetBed >= 0) this.closeSheet();
    else if (this.panel) this.nav('garden');
    this.syncHistory();
  }

  // Liegt die Bildschirmposition auf einer Beet-Blase? (oberste zuerst)
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

  // Verdeckt ein Vollbild-Menü seit mindestens ms Millisekunden den Garten?
  coveredFor(ms) { return !!this.panel && performance.now() - (this.panelSince || 0) > ms; }

  // ---------- Navigation ----------
  nav(id, tab) {
    this.api.sound.play('open');
    this.closeSheet();
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

  // ---------- Aktualisierung ----------
  refresh() {
    const s = this.s;
    $('coins').textContent = num(s.coins);
    const xp = G.xpProgress(s);
    $('lvl').innerHTML = `${I.star(xp.level)}<small>${xp.max ? 'Max. Level' : `${xp.have}/${xp.need} EP`}</small><span class="xpbar"><i style="width:${(xp.frac * 100).toFixed(1)}%"></i></span>`;
    const n = G.claimableTasks(s) + (G.dailyGiftAvailable(s, this.api.now()) ? 1 : 0);
    for (const id of ['tasksBadge', 'navBadge']) { const b = $(id); if (b) { b.textContent = n || ''; b.hidden = !n; } }
    if (this.panel) this.renderPanel(true);
    if (this.sheetBed >= 0) this.renderSheet();
  }

  bumpCoins() { const p = $('coinPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }

  setTime(env) {
    const key = env.name;
    if (key === this._timeKey) return;
    this._timeKey = key;
    $('timePill').innerHTML = `${I.timeIcon[key]}<span>${PHASE_LABEL[key]}</span>`;
    $('timePill').setAttribute('aria-label', 'Tageszeit: ' + PHASE_LABEL[key]);
    $('timePill').title = PHASE_LABEL[key];
  }

  // Positionen und Inhalte der Blasen über den Beeten (jedes Bild)
  frame(infos, now) {
    const hide = !!this.panel;
    let ready = 0;
    infos.forEach((info, i) => {
      const el = this.bubbles[i];
      if (info.ready) ready++;
      const p = !hide && this.api.world.bedScreen(i, info.ready);
      if (!p) { el.hidden = true; return; }
      let key, html, cls;
      if (info.locked) { key = 'L' + info.price; cls = 'locked'; html = `<div class="b">${I.lock}${num(info.price)}</div>`; }
      else if (info.empty) { key = 'E'; cls = 'empty'; html = '<div class="b">+</div>'; }
      else if (info.ready) { key = 'R' + info.seed + info.golden; cls = 'ready' + (info.golden ? ' gold' : ''); html = `<div class="b"><img alt="${esc(C.SEEDS[info.seed].name)} ernten" src="${info.golden ? this.icons.golden[info.seed] : this.icons.flower[info.seed]}"></div>`; }
      else { const sec = Math.ceil(info.remaining / 1000); key = 'G' + sec + '|' + Math.round(info.progress * 40); cls = 'grow'; html = `<div class="b">${I.ring(info.progress)}${fmtTime(info.remaining)}</div>`; }
      if (this.bubbleKeys[i] !== key) { this.bubbleKeys[i] = key; el.className = 'bub ' + cls; el.innerHTML = html; }
      el.hidden = false;
      el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%)`;
    });
    const ha = $('harvestAll');
    const showAll = ready >= 2 && !hide && this.sheetBed < 0;
    if (showAll) { const t = `${I.coin()} Alle ernten (${ready})`; if (ha.dataset.t !== t) { ha.innerHTML = t; ha.dataset.t = t; } }
    ha.hidden = !showAll;
    this.updateHint(infos, hide);
    void now;
  }

  updateHint(infos, hide) {
    const s = this.s, h = $('hint');
    let text = '';
    if (s.tutorial === 0) text = 'Tippe auf ein Beet mit <b>+</b>, um Blumen zu pflanzen.';
    else if (s.tutorial === 1) text = infos.some((x) => x.ready) ? 'Deine Blumen blühen! Tippe auf die Blüte über dem Beet, um zu ernten.' : 'Super! Die Blumen wachsen jetzt – auch wenn du das Spiel schließt.';
    const show = !!text && !hide && this.sheetBed < 0 && $('harvestAll').hidden;
    if (h.dataset.t !== text) { h.innerHTML = text; h.dataset.t = text; }
    h.hidden = !show;
  }

  // ---------- Saat-Auswahl ----------
  openSeedSheet(bed) {
    this.sheetBed = bed;
    this.renderSheet();
    const el = $('sheet');
    void el.offsetWidth; // Layout erzwingen, damit die Animation startet
    el.classList.add('open');
    el.inert = false;
    this.api.sound.play('open');
    this.syncHistory();
  }

  closeSheet() {
    const was = this.sheetBed >= 0;
    this.sheetBed = -1; $('sheet').classList.remove('open'); $('sheet').inert = true;
    if (was) this.syncHistory();
  }

  renderSheet() {
    const s = this.s;
    const cards = C.SEED_ORDER.map((id) => {
      const d = C.SEEDS[id], st = G.seedStatus(s, id), afford = s.coins >= d.cost;
      const label = st.available ? `${I.coin()} ${d.cost}` : `${I.lock} ${esc(st.reason)}`;
      return `<button class="seed ${st.available ? '' : 'lock'} ${d.rare ? 'rare' : ''}" data-act="${st.available ? 'plant' : st.shop ? 'gotoShop' : 'seedLocked'}" data-id="${id}" aria-label="${esc(d.name)}">
        ${d.rare ? '<span class="tag">Selten</span>' : ''}<img alt="" src="${this.icons.flower[id]}"><b>${esc(d.name)}</b>
        <span class="meta"><span>⏱ ${growLabel(d.growMs)}</span><span>${I.coin()}${d.reward}</span></span>
        <span class="price" style="${st.available && !afford ? 'background:linear-gradient(#ff8d8d,#d62c2c);border-color:#9e1b1b' : ''}">${label}</span></button>`;
    }).join('');
    const empty = s.beds.filter((b) => !b.locked && !b.seed).length;
    const sel = C.SEEDS[s.selectedSeed] && G.seedStatus(s, s.selectedSeed).available ? s.selectedSeed : 'daisy';
    const allBtn = empty > 1 ? `<div class="all"><button class="btn small blue wide" data-act="plantAll" data-id="${sel}"><img alt="" src="${this.icons.flower[sel]}" style="width:28px;height:28px;margin:-4px 0"> Alle ${empty} freien Beete bepflanzen · ${I.coin()} ${C.SEEDS[sel].cost * empty}</button></div>` : '';
    $('sheet').innerHTML = `<div class="inner"><h3>Was möchtest du pflanzen? <button class="x" data-act="closeSheet" aria-label="Schließen">✕</button></h3><div class="seeds">${cards}</div>${allBtn}</div>`;
  }

  // ---------- Panels ----------
  renderPanel(soft) {
    const id = this.panel;
    const titles = { collection: 'Sammlung', events: 'Events', friends: 'Freunde', shop: 'Shop', settings: 'Einstellungen' };
    const body = { collection: () => this.pCollection(), events: () => this.pEvents(), friends: () => this.pFriends(), shop: () => this.pShop(), settings: () => this.pSettings() }[id]();
    const el = $('panel');
    const prevScroll = el.querySelector('.pbody')?.scrollTop || 0;
    el.innerHTML = `<div class="phead"><h2 class="outlined">${titles[id]}</h2><div class="pill">${I.coin()}<span>${num(this.s.coins)}</span></div><button class="x" data-act="closePanel" aria-label="Schließen">✕</button></div><div class="pbody">${body}</div>`;
    if (soft) el.querySelector('.pbody').scrollTop = prevScroll;
  }

  tabs(panel, list) {
    const cur = this.tab[panel] || list[0][0];
    return `<div class="tabs">${list.map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" data-act="tab" data-panel="${panel}" data-id="${k}">${l}</button>`).join('')}</div>`;
  }

  pShop() {
    const s = this.s, cur = this.tab.shop || 'offers', now = this.api.now();
    let h = this.tabs('shop', [['offers', 'Angebote'], ['flowers', 'Blumen'], ['deco', 'Deko'], ['animals', 'Tiere']]);
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
          <div class="it"><img alt="Laterne" src="${this.icons.deco.lantern}"><b>Laterne</b></div>
          <div class="it"><img alt="Gartenbank" src="${this.icons.deco.bench}"><b>Bank</b></div>
          <div class="it"><img alt="Vogeltränke" src="${this.icons.deco.birdbath}"><b>Tränke</b></div>
          <div class="it"><img alt="Blumentöpfe" src="${this.icons.deco.flowerpots}"><b>Töpfe</b></div>
          <div class="it"><img alt="Schubkarre" src="${this.icons.deco.wheelbarrow}"><b>Karre</b></div>
          <div class="it"><img alt="Polarfuchs" src="${this.icons.skin.arctic}"><b>Polarfuchs</b></div></div>
          <div class="ofoot"><div><div class="ribbon">♥ Beliebt</div><div class="otitle">Deko-<br>Paket</div></div>
          <button class="btn big" data-act="iap" data-id="bundle_deco">${formatEUR(B.priceEUR)}</button></div></div>
        <div class="packs">${[['coins_small', I.coin()], ['coins_medium', I.coinPile()], ['coins_large', I.coinChest()]].map(([k, ic]) => {
          const p = C.IAP[k];
          return `<div class="pack">${p.tag ? `<span class="tag">${p.tag}</span>` : ''}${ic.replace('class="coin"', 'style="width:62px;height:62px"')}<b>${num(p.coins)}</b><button class="btn" data-act="iap" data-id="${k}">${formatEUR(p.priceEUR)}</button></div>`;
        }).join('')}</div>
        <button class="btn pink big morebtn" data-act="tab" data-panel="shop" data-id="flowers">Mehr Angebote <span style="font-size:30px;line-height:.8">+</span></button>
        <div class="card row" style="margin-top:18px">${I.video.replace('<svg', '<svg style="width:56px;height:56px;flex:none"')}<div class="grow"><h4>Gratis-Münzen</h4><p>Freiwillig ein kurzes Video ansehen und ${C.REWARDED_VIDEO.reward} Münzen erhalten.</p></div><button class="btn small blue" data-act="video">Ansehen</button></div>
        <div class="card row">${I.pass.replace('<svg', '<svg style="width:56px;height:56px;flex:none"')}<div class="grow"><h4>Saisonpass Herbst</h4><p>Exklusive Deko und Belohnungen für die Saison – kommt bald.</p></div><button class="btn small gold" data-act="info" data-id="pass">Info</button></div>
        <p class="note">Echtgeld-Käufe sind noch nicht aktiv. BloomWorld bleibt fair: Alles ist auch ohne Geld erreichbar, und es gibt keinen Wettbewerb gegen andere Spieler – kein Pay-to-win.</p>`;
    } else if (cur === 'flowers') {
      h += `<div class="sec">Seltene Blumen</div>` + C.SEED_ORDER.filter((k) => C.SEEDS[k].rare).map((k) => {
        const d = C.SEEDS[k], own = s.rareUnlocked.includes(k);
        return `<div class="card row"><img class="ic" alt="" src="${this.icons.flower[k]}"><div class="grow"><h4>${esc(d.name)}</h4><p>Wächst ${growLabel(d.growMs)} · bringt ${d.reward} Münzen pro Ernte</p></div>${own ? '<button class="btn small off" disabled>✓ Freigeschaltet</button>' : `<button class="btn small" data-act="unlockRare" data-id="${k}">${I.coin()} ${d.unlockCoins}</button>`}</div>`;
      }).join('') + `<div class="sec">Saatgut nach Level</div>` + C.SEED_ORDER.filter((k) => !C.SEEDS[k].rare).map((k) => {
        const d = C.SEEDS[k], ok = s.level >= d.level;
        return `<div class="card row"><img class="ic" alt="" src="${this.icons.flower[k]}"><div class="grow"><h4>${esc(d.name)}</h4><p>${ok ? 'Verfügbar' : `Ab Level ${d.level}`} · ${d.cost} Münzen Saatgut</p></div>${ok ? '<span style="font-size:22px">✓</span>' : I.lock.replace('class="lock"', 'style="width:28px;height:28px"')}</div>`;
      }).join('');
    } else if (cur === 'deco') {
      h += `<div class="grid2">` + C.DECO_ORDER.map((k) => {
        const d = C.DECO[k], own = s.deco.includes(k);
        return `<div class="tile"><img alt="" src="${this.icons.deco[k]}"><b>${esc(d.name)}${d.seasonal ? ' 🍂' : ''}</b><small>${esc(d.desc)}</small>${own ? '<button class="btn small off" disabled>✓ Im Garten</button>' : `<button class="btn small" data-act="buyDeco" data-id="${k}">${I.coin()} ${d.price}</button>`}</div>`;
      }).join('') + `</div><p class="note">Deko erscheint sofort in deinem Garten.</p>`;
    } else {
      h += `<div class="grid2">` + Object.entries(C.SKINS).map(([k, d]) => {
        const own = s.skins.includes(k);
        return `<div class="tile"><img alt="" src="${this.icons.skin[k]}"><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>${own ? `<button class="btn small ${s.activeSkin[d.animal] === k ? 'off' : 'blue'}" data-act="equip" data-animal="${d.animal}" data-id="${k}" ${s.activeSkin[d.animal] === k ? 'disabled' : ''}>${s.activeSkin[d.animal] === k ? '✓ Aktiv' : 'Anziehen'}</button>` : `<button class="btn small" data-act="buySkin" data-id="${k}">${I.coin()} ${d.price}</button>`}</div>`;
      }).join('') + `</div><p class="note">Tier-Skins sind rein kosmetisch. Weitere Skins folgen mit den Saison-Events.</p>`;
    }
    return h;
  }

  pCollection() {
    const s = this.s, cur = this.tab.collection || 'flowers';
    let h = this.tabs('collection', [['flowers', 'Blumen'], ['animals', 'Tiere'], ['deco', 'Deko']]);
    if (cur === 'flowers') {
      const found = C.SEED_ORDER.filter((k) => s.collection[k]?.count).length;
      h += `<div class="card"><h4>${found} von ${C.SEED_ORDER.length} Blumen entdeckt</h4><p>Geerntet: ${num(s.stats.harvested)} · Goldene Blüten: ${num(s.stats.golden)}</p><div class="prog"><i style="width:${(found / C.SEED_ORDER.length) * 100}%"></i></div></div><div class="grid3">`;
      h += C.SEED_ORDER.map((k) => {
        const e = s.collection[k], d = C.SEEDS[k];
        return `<div class="tile ${e?.count ? '' : 'unknown'}"><img alt="" src="${this.icons.flower[k]}"><b>${esc(d.name)}</b><small>${e?.count ? `${num(e.count)}× geerntet` : 'Noch nicht geerntet'}</small>${e?.golden ? `<small class="gold">★ ${e.golden}× golden</small>` : ''}</div>`;
      }).join('') + `</div><div class="sec">Goldene Blüten</div><div class="card"><p>Mit etwas Glück blüht eine Blume golden. Sie funkelt im Beet und bringt die dreifache Belohnung.</p></div><div class="grid3">` + C.SEED_ORDER.map((k) => {
        const e = s.collection[k];
        return `<div class="tile ${e?.golden ? '' : 'unknown'}"><img alt="" src="${this.icons.golden[k]}"><small>${e?.golden ? 'Gefunden!' : '???'}</small></div>`;
      }).join('') + '</div>';
    } else if (cur === 'animals') {
      h += Object.entries(C.ANIMALS).map(([k, d]) => {
        const seen = s.seenAnimals.includes(k);
        const skins = Object.entries(C.SKINS).filter(([, v]) => v.animal === k);
        const skinBtns = skins.length ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn small ${s.activeSkin[k] === 'default' ? 'off' : 'ghost'}" data-act="equip" data-animal="${k}" data-id="default">Standard</button>${skins.map(([sk, v]) => s.skins.includes(sk) ? `<button class="btn small ${s.activeSkin[k] === sk ? 'off' : 'ghost'}" data-act="equip" data-animal="${k}" data-id="${sk}">${esc(v.name)}</button>` : `<button class="btn small ghost" data-act="tab" data-panel="shop" data-id="animals">${I.lock.replace('class="lock"', 'style="width:16px;height:16px"')} ${esc(v.name)}</button>`).join('')}</div>` : '';
        return `<div class="card row"><img class="ic" alt="" src="${this.icons.animal[k]}" style="${seen ? '' : 'filter:brightness(0) opacity(.25)'}"><div class="grow"><h4>${esc(d.name)} ${seen ? '✓' : ''}</h4><p>${esc(d.desc)} ${seen ? '' : k === 'butterfly' ? 'Halte am Tag Ausschau!' : 'Tippe es im Garten an, um es zu entdecken.'}</p>${skinBtns}</div></div>`;
      }).join('');
    } else {
      const own = C.DECO_ORDER.filter((k) => s.deco.includes(k));
      h += own.length ? `<div class="grid3">${own.map((k) => `<div class="tile"><img alt="" src="${this.icons.deco[k]}"><b>${esc(C.DECO[k].name)}</b></div>`).join('')}</div>` : `<div class="card"><h4>Noch keine Deko</h4><p>Im Shop findest du Laternen, Bänke, Kürbisse und mehr für deinen Garten.</p></div>`;
      h += `<button class="btn wide" style="margin-top:8px" data-act="tab" data-panel="shop" data-id="deco">Zum Deko-Shop</button>`;
    }
    return h;
  }

  pEvents() {
    const s = this.s, now = this.api.now();
    const tasks = G.taskList(s);
    let h = `<div class="sec" style="margin-top:4px">Tagesaufgaben</div>`;
    h += tasks.map((t) => `<div class="card"><div class="row"><div class="grow"><h4>${esc(t.label)}</h4><p>${num(t.have)} / ${num(t.goal)} · Belohnung ${t.reward} Münzen + ${t.xp} EP</p></div>
      ${t.claimed ? '<button class="btn small off" disabled>✓ Erledigt</button>' : `<button class="btn small" data-act="claim" data-id="${t.id}" ${t.done ? '' : 'disabled'}>${I.coin()} ${t.reward}</button>`}</div>
      <div class="prog"><i style="width:${(t.have / t.goal) * 100}%"></i></div></div>`).join('');
    const gift = G.dailyGiftAvailable(s, now);
    h += `<div class="card row">${I.gift.replace('<svg', '<svg style="width:54px;height:54px;flex:none"')}<div class="grow"><h4>Tägliches Geschenk</h4><p>Jeden Tag ${C.DAILY_GIFT} Münzen gratis.</p></div><button class="btn small" data-act="gift" ${gift ? '' : 'disabled'}>${gift ? 'Abholen' : '✓ Heute'}</button></div>`;
    h += `<p class="note">Neue Aufgaben gibt es jeden Tag um Mitternacht.</p>`;
    h += `<div class="sec">Saison-Event</div><div class="card row"><img class="ic" alt="" src="${this.icons.deco.pumpkins}"><div class="grow"><h4>Herbstfest 🍂</h4><p>Bald: ein Herbst-Event mit Sonderaufgaben und Kürbis-Belohnungen. Die Herbstkürbisse gibt es schon jetzt im Deko-Shop.</p></div></div>`;
    h += `<div class="card row">${I.pass.replace('<svg', '<svg style="width:56px;height:56px;flex:none"')}<div class="grow"><h4>Saisonpass</h4><p>Ein freiwilliger Saisonpass mit Deko-Belohnungen ist in Vorbereitung.</p></div></div>`;
    return h;
  }

  pFriends() {
    const s = this.s;
    return `<div class="card" style="text-align:center">${I.NAV.friends.replace('<svg', '<svg style="width:90px;height:90px"')}<h4 style="font-size:20px">Gemeinsam gärtnern</h4><p>Bald kannst du die Gärten deiner Freunde besuchen, Blumen verschenken und gemeinsam Events meistern. Dafür kommt ein Login mit Cloud-Speicherstand.</p>
      <button class="btn pink wide" style="margin-top:14px" data-act="share">Freunde einladen</button></div>
      <div class="sec">Dein Garten</div>
      <div class="grid2">
        <div class="tile"><span class="bigstar">${I.star(s.level)}</span><b>Level ${s.level}</b><small>${num(s.xp)} EP gesamt</small></div>
        <div class="tile"><img alt="" src="${this.icons.flower.daisy}" style="width:56px;height:56px"><b>${num(s.stats.harvested)}</b><small>Blumen geerntet</small></div>
        <div class="tile"><img alt="" src="${this.icons.golden.rose}" style="width:56px;height:56px"><b>${num(s.stats.golden)}</b><small>Goldene Blüten</small></div>
        <div class="tile"><img alt="" src="${this.icons.deco.bench}" style="width:56px;height:56px"><b>${s.deco.length} / ${C.DECO_ORDER.length}</b><small>Deko im Garten</small></div>
      </div>
      <p class="note">Dein Spielstand wird zurzeit auf diesem Gerät gespeichert.</p>`;
  }

  pSettings() {
    const st = this.s.settings;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="set" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
    const LBL = { music: 'Musik', sound: 'Soundeffekte', musicVol: 'Musik-Lautstärke', soundVol: 'Effekt-Lautstärke', cycleMin: 'Länge eines Tages in Minuten' };
    const sw = (key) => `<button class="switch ${st[key] ? 'on' : ''}" role="switch" aria-checked="${!!st[key]}" data-act="toggle" data-key="${key}" aria-label="${LBL[key]}"></button>`;
    const range = (key, min, max, step, val, dis) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-key="${key}" style="--v:${((val - min) / (max - min)) * 100}%" ${dis ? 'disabled' : ''} aria-label="${LBL[key]}">`;
    const qd = { auto: 'Passt sich automatisch deinem Gerät an.', high: 'Schärfste Grafik mit weichen Schatten.', medium: 'Ausgewogen – gut für die meisten Handys.', low: 'Spart Akku: ohne Schatten, weniger Animation.' };
    return `<div class="card set"><div class="lab">Tageszeit</div>${seg('cycle', [['auto', 'Automatischer Zyklus'], ['day', 'Immer Tag'], ['night', 'Immer Nacht']])}
        <div class="lab" style="margin-top:6px">Zyklusgeschwindigkeit <small>1 Tag = ${st.cycleMin} Min</small></div>${range('cycleMin', 2, 30, 1, st.cycleMin, st.cycle !== 'auto')}
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:-6px"><span>schnell</span><span>langsam</span></div></div>
      <div class="card set"><div class="lab">Grafik &amp; Leistung</div>${seg('quality', [['auto', 'Auto'], ['high', 'Hoch'], ['medium', 'Mittel'], ['low', 'Sparsam']])}<p>${qd[st.quality]}</p></div>
      <div class="card set"><div class="lab">Musik ${sw('music')}</div>${range('musicVol', 0, 1, 0.05, st.musicVol, !st.music)}
        <div class="lab" style="margin-top:6px">Soundeffekte ${sw('sound')}</div>${range('soundVol', 0, 1, 0.05, st.soundVol, !st.sound)}</div>
      <div class="card set"><div class="lab">Spielstand</div><p>Wird automatisch in diesem Browser gespeichert. Ein Cloud-Speicher mit Login ist vorbereitet.</p><button class="btn red small" style="align-self:flex-start;margin-top:6px" data-act="reset">Spielstand löschen</button></div>
      <p class="note">BloomWorld · Version 1.0<br>Schrift: Poppins (SIL Open Font License)</p>`;
  }

  // ---------- Klicks in Panels, Sheet, Dialogen ----------
  onAct(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const { act: a, id } = el.dataset;
    const A = this.api.act;
    switch (a) {
      case 'closePanel': this.nav('garden'); break;
      case 'closeSheet': this.closeSheet(); break;
      case 'closeModal': this.closeModal(); break;
      case 'tab': this.closeModal(); this.api.sound.play('tap'); this.tab[el.dataset.panel] = id; if (this.panel !== el.dataset.panel) this.nav(el.dataset.panel, id); else this.renderPanel(); $('panel').querySelector('.pbody').scrollTo(0, 0); break;
      case 'plant': A.plant(this.sheetBed, id); break;
      case 'plantAll': A.plantAll(id); break;
      case 'seedLocked': this.api.sound.play('error'); this.toast(`${C.SEEDS[id].name}: ${G.seedStatus(this.s, id).reason}.`, 'err'); break;
      case 'gotoShop': this.closeSheet(); this.nav('shop', 'flowers'); break;
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
      case 'reset': this.confirm({ title: 'Spielstand löschen?', text: 'Dein ganzer Garten, alle Münzen und die Sammlung werden gelöscht. Das kann nicht rückgängig gemacht werden.', ok: 'Ja, löschen', okClass: 'red', onOk: () => A.reset() }); break;
      case 'info': this.modal({ title: 'Saisonpass', html: `${I.pass.replace('<svg', '<svg style="width:96px;height:96px"')}<p>Der Saisonpass kommt mit dem ersten Saison-Event. Er wird freiwillig sein und nur Deko und Komfort enthalten – kein Pay-to-win.</p>`, buttons: [['OK', 'closeModal', '']] }); break;
      case 'unlockBed': this.closeModal(); A.unlockBed(+id); break;
      case 'modalOk': { const f = this._onOk; this.closeModal(); f?.(); break; }
      case 'toastAct': this.hideToast(); this._toastAction?.(); break;
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

  // ---------- Dialoge ----------
  modal({ title, html, buttons = [], onOk }) {
    this._onOk = onOk;
    $('modal').innerHTML = `<div class="dlg">${title ? `<div class="ttl">${esc(title)}</div>` : ''}<button class="x" data-act="closeModal" aria-label="Schließen">✕</button>${html}<div class="btns">${buttons.map(([l, act, cls, extra = '']) => `<button class="btn ${cls}" data-act="${act}" ${extra}>${l}</button>`).join('')}</div></div>`;
    $('modal').classList.add('open');
    this.syncHistory();
  }
  closeModal() {
    const was = this.modalOpen;
    $('modal').classList.remove('open'); this._onOk = null;
    if (was) this.syncHistory();
  }
  get modalOpen() { return $('modal').classList.contains('open'); }

  confirm({ title, text, ok = 'OK', okClass = '', onOk }) {
    this.modal({ title, html: `<p>${esc(text)}</p>`, buttons: [['Abbrechen', 'closeModal', 'ghost'], [ok, 'modalOk', okClass]], onOk });
  }

  bedLockedDialog(i) {
    const price = C.BED_UNLOCK_COST[i], ok = this.s.coins >= price;
    this.modal({ title: 'Neues Beet', html: `<img class="big" alt="" src="${this.icons.bed}"><p>Erweitere deinen Garten um ein weiteres Hochbeet.</p><div class="big-num">${I.coin()} ${num(price)}</div>${ok ? '' : `<p style="color:#b3123a">Dir fehlen noch ${num(price - this.s.coins)} Münzen.</p>`}`, buttons: ok ? [['Freischalten', 'unlockBed', '', `data-id="${i}"`]] : [['Zum Shop', 'tab', 'pink', 'data-panel="shop" data-id="offers"'], ['OK', 'closeModal', 'ghost']] });
  }

  levelUp(up) {
    const unlocks = up.unlocks.map((k) => `<div class="it" style="display:inline-flex"><img alt="" src="${this.icons.flower[k]}" style="width:80px;height:80px"><b style="font-size:16px">${esc(C.SEEDS[k].name)} freigeschaltet!</b></div>`).join('');
    this.modal({ title: `Level ${up.level}!`, html: `<span class="bigstar huge">${I.star(up.level)}</span><p>Glückwunsch! Dein Garten wächst.</p><div class="big-num">+${up.reward} ${I.coin()}</div>${unlocks}`, buttons: [['Weiter', 'closeModal', '']] });
  }

  showLevelInfo() {
    const xp = G.xpProgress(this.s);
    const next = Object.entries(C.SEEDS).find(([, d]) => !d.rare && d.level > this.s.level);
    this.modal({ title: `Level ${xp.level}`, html: `<p>${xp.max ? 'Du hast das höchste Level erreicht!' : `Noch <b>${xp.need - xp.have} EP</b> bis Level ${xp.level + 1}.`}<br>EP bekommst du beim Ernten und für Tagesaufgaben.</p>${next ? `<div class="it" style="display:inline-flex"><img alt="" src="${this.icons.flower[next[0]]}" style="width:72px;height:72px"><b style="font-size:15px">Ab Level ${next[1].level}: ${esc(next[1].name)}</b></div>` : ''}`, buttons: [['OK', 'closeModal', '']] });
  }

  // ---------- Hinweise ----------
  toast(msg, kind = '', action) {
    const t = $('toast');
    this._toastAction = action?.fn;
    t.className = 'open ' + kind;
    t.innerHTML = `<span>${msg}</span>${action ? `<button class="btn small pink" data-act="toastAct">${esc(action.label)}</button>` : ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), action ? 4200 : 2600);
  }
  hideToast() { $('toast').classList.remove('open'); }

  // fliegende Münzen vom Beet zur Münzanzeige
  floatReward(i, amount, golden) {
    const p = this.api.world.bedScreen(i);
    if (!p) return;
    const box = $('floaters');
    const label = document.createElement('div');
    label.className = 'fly' + (golden ? ' gold' : '');
    label.innerHTML = `+${amount}${golden ? ' ★' : ''}`;
    box.appendChild(label);
    label.animate([{ transform: `translate(${p[0] - 24}px, ${p[1] - 10}px) scale(0.6)`, opacity: 0 }, { transform: `translate(${p[0] - 24}px, ${p[1] - 50}px) scale(1.15)`, opacity: 1, offset: 0.3 }, { transform: `translate(${p[0] - 24}px, ${p[1] - 90}px) scale(1)`, opacity: 0 }], { duration: 1200, easing: 'ease-out' }).onfinish = () => label.remove();
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
