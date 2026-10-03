// Oberfläche von BloomWorld: Kopfleiste, Menü, Beet-Blasen, Saat- und Pflege-Leiste,
// Panels (Aufgaben, Events, Sammlung, Shop, Freunde, Einstellungen, Gewächshaus), Dialoge, Hinweise.
import * as C from './config.js';
import * as G from './game.js';
import * as I from './icons.js';
import { formatEUR } from './payments.js';
import { PHASE_LABEL } from './world/sky.js';
import { PRIVACY_HTML } from './legal.js';
import { Detail } from './detail.js';
import { pTrader, onTraderAct, traderBadge, TRADER_ACTS } from './traderui.js';
import { pTrade, onTradeAct, onTradeForm, loadTrades, TRADE_ACTS, seedGiftOptions } from './tradeui.js';
import { pFriends, pChat, chatTitle, pAdmin, onSocialAct, onSocialForm, updateChat, newsCard, avatar, SOCIAL_ACTS } from './friendsui.js';

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
const growLabel = (ms) => (ms < 60_000 ? `${ms / 1000} Sek` : ms < 3_600_000 ? `${Math.round(ms / 60_000)} Min` : `${Math.round(ms / 360_000) / 10} Std`.replace('.0 Std', ' Std').replace('.', ','));
const daysLeft = (ms) => { const d = Math.ceil(ms / 86_400_000); return d <= 1 ? 'Letzter Tag!' : `Noch ${d} Tage`; };

const TIER = { selten: ['Selten', 't1'], episch: ['Episch', 't2'], legendär: ['Legendär', 't3'] };
const tierTag = (d) => (d.tier ? `<span class="tier ${TIER[d.tier][1]}">${TIER[d.tier][0]}</span>` : d.rare ? '<span class="tier t0">Selten</span>' : '');

const NAV_ITEMS = [['garden', 'Garten'], ['quests', 'Aufgaben'], ['events', 'Events'], ['collection', 'Sammlung'], ['shop', 'Shop'], ['friends', 'Freunde']];
const TITLES = { quests: 'Aufgaben', events: 'Events', collection: 'Sammlung', shop: 'Shop', friends: 'Freunde', settings: 'Einstellungen', breed: 'Gewächshaus', chat: 'Chat', admin: 'Admin', trader: 'Händler', notify: 'Nachrichten', trade: 'Tauschbörse' };
const GH = C.BED_COUNT; // Index der Gewächshaus-Blase
const TH = C.BED_COUNT + 1 + C.TROPIC.pots; // Index der Tropenhaus-Blase
// Blasen-Index eines Beets/Topfs (Töpfe liegen hinter der Gewächshaus-Blase)
const bubIdx = (i) => (i < C.BED_COUNT ? i : i + 1);
export const bedIdxOfBubble = (b) => (b > GH ? b - 1 : b);

export class UI {
  constructor(api) {
    this.api = api; // { state, now, icons, sound, act, world, account, isNight }
    this.icons = api.icons;
    this.panel = null; this.tab = {};
    this.sheetBed = -1; this.sheetKind = null;
    this.mode = null; // Platzier-Modus: { kind: 'sprinkler'|'upgrade'|'item', id }
    this.detail = new Detail(this);
    this.bubbleKeys = [];
    this.toastTimer = null;
    this.modalQueue = [];
  }

  get s() { return this.api.state(); }

  init() {
    $('coinIcon').innerHTML = I.coin();
    $('gearBtn').innerHTML = I.gear;
    $('breedBtn').insertAdjacentHTML('afterbegin', I.greenhouse);
    $('editBtn').insertAdjacentHTML('afterbegin', I.brush);
    $('editBtn').onclick = () => this.api.act.toggleEdit();
    $('centerBtn').insertAdjacentHTML('afterbegin', I.target);
    $('nav').innerHTML = NAV_ITEMS.map(([id, label]) => `<button data-nav="${id}" class="${id === 'garden' ? 'on' : ''}" aria-label="${label}">${I.NAV[id]}<span>${label}</span><i class="badge" id="badge-${id}" hidden></i></button>`).join('');
    const nb = C.BED_COUNT + 2 + C.TROPIC.pots;
    $('bubbles').innerHTML = Array.from({ length: nb }, (_, i) => `<div class="bub" id="bub${i}" hidden></div>`).join('');
    this.bubbles = Array.from({ length: nb }, (_, i) => $('bub' + i));

    $('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b) this.nav(b.dataset.nav); });
    $('gearBtn').onclick = () => this.nav('settings');
    $('coinPlus').onclick = () => this.nav('shop', C.MONEY_ENABLED ? 'offers' : 'daily');
    $('lvl').onclick = () => this.nav('quests', 'levels');
    $('breedBtn').onclick = () => this.api.act.tapGreenhouse();
    $('traderBtn').insertAdjacentHTML('afterbegin', I.cart);
    $('bellBtn').insertAdjacentHTML('afterbegin', I.bell);
    $('bellBtn').onclick = () => this.nav('notify');
    $('traderBtn').onclick = () => this.nav('trader');
    $('centerBtn').onclick = () => { this.api.sound.play('tap'); this.api.world.resetView(); };
    $('harvestAll').onclick = () => (this.haRain ? this.api.act.useRain() : this.api.act.harvestAll());
    $('quest').onclick = () => this.api.act.questTracker();
    for (const el of [$('panel'), $('sheet'), $('modal'), $('toast'), $('modeBar'), $('editBar'), $('visitBar'), $('tropicBar')]) el.addEventListener('click', (e) => this.onAct(e));
    document.addEventListener('submit', (e) => { const f = e.target.closest?.('form[data-form]'); if (!f) return; e.preventDefault(); const sb = e.submitter; if (sb?.name) f.dataset[sb.name] = sb.value; else { delete f.dataset.on; delete f.dataset.stop; delete f.dataset.clear; } if (f.dataset.form === 'tradeOffer') onTradeForm(this, f); else onSocialForm(this, f); });
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    $('panel').addEventListener('input', (e) => this.onInput(e));
    for (const id of ['hud', 'side', 'nav']) $(id).hidden = false;
    $('sheet').addEventListener('wheel', (e) => { const row = e.target.closest('.seeds'); if (row && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    $('panel').inert = true; $('sheet').inert = true;
    this.refresh();
  }

  // ---------- Zurück-Taste (Android) und Escape ----------
  // Zurück-Taste (Android): Solange etwas offen ist, liegt ein „Wächter“-Eintrag im Verlauf.
  // Er wird beim Schließen über die Oberfläche NICHT wieder entfernt (kein history.back()),
  // so gibt es keine Wettläufe mit verspäteten popstate-Ereignissen. Ist nichts mehr offen,
  // verbraucht ein Druck auf Zurück nur den Wächter – der nächste verlässt die Seite.
  get anyOpen() { return this.modalOpen || this.sheetBed >= 0 || !!this.sheetKind || !!this.panel || !!this.mode || !!this.edit || !!this.visit; }
  syncHistory() {
    if (this.anyOpen && !this.guard) {
      try { history.pushState({ bloomworld: 1 }, ''); this.guard = true; } catch { /* z.B. in eingebetteten Ansichten */ }
    }
  }
  onPopState() {
    if (this.ignorePop) return;
    this.guard = false;
    if (this.anyOpen) this.back();
  }
  back() {
    if (this.modalOpen) this.closeModal();
    else if (this.sheetBed >= 0 || this.sheetKind) this.closeSheet();
    else if (this.panel === 'chat') this.nav('friends');
    else if (this.panel) this.nav('garden');
    else if (this.mode) this.setMode(null);
    else if (this.api.visiting?.()) this.api.act.endVisit();
    else if (this.edit) { if (this.edit.sel) this.api.act.editDeselect(); else this.api.act.exitEdit(); }
    this.syncHistory();
  }

  // Liegt die Bildschirmposition auf einer Blase? (oberste zuerst)
  bubbleAt(x, y) {
    if (this.panel || this.edit) return null;
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
    if (id === 'trade') setTimeout(() => loadTrades(this, true), 0);
    this.api.sound.play('open');
    this.closeSheet();
    if (this.mode) this.setMode(null, true);
    if (this.edit) this.api.act.exitEdit(true);
    if (this.panel === 'chat' && id !== 'chat') this.api.social?.()?.closeChat();
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

  closePanel() { if (this.panel === 'chat') this.api.social?.()?.closeChat(); this.panel = null; $('panel').classList.remove('open'); $('panel').inert = true; this.markNav(); this.syncHistory(); }

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
    if (m.kind === 'sprinkler') { icon = I.drop; text = `Tippe auf ein Beet, um die Bewässerung zu installieren (${num(G.sprinklerCost(this.s))} Münzen).`; }
    else if (m.kind === 'upgrade') { icon = I.upgrade; text = 'Tippe auf ein Beet, das du ausbauen möchtest.'; }
    else if (m.kind === 'grow') { icon = I.expand; text = 'Tippe auf ein Beet, das du vergrößern möchtest (braucht freien Platz rundherum).'; }
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
    const quests = G.claimableTasks(s) + (G.dailyGiftAvailable(s, now) ? 1 : 0) + (!st.finished && st.done ? 1 : 0) + G.claimableWeekly(s, now);
    const ev = G.eventInfo(s, now);
    this.badge('quests', quests);
    this.badge('events', ev.active ? ev.claimable : 0);
    const job = G.breedingInfo(s, now);
    const bb = $('breedBadge');
    bb.textContent = job?.ready ? '!' : ''; bb.hidden = !job?.ready;
    $('traderBtn').hidden = s.level < C.TRADER.level;
    const tb = traderBadge(s, now), tbe = $('traderBadge');
    tbe.textContent = tb || ''; tbe.hidden = !tb;
    this.renderQuest(st);
    if (this.mode) this.renderModeBar();
    if (this.panel) this.renderPanel(true);
    if (this.sheetBed >= 0 || this.sheetKind) this.renderSheet();
    if (this.edit) this.renderEditBar();
  }

  // ---------- Gestalten ----------
  renderEditBar() {
    const e = this.edit, s = this.s, bar = $('editBar');
    if (!e) { bar.hidden = true; return; }
    const stored = s.decor.filter((d) => d.stored).length;
    let html;
    if (!e.sel) {
      html = `<div class="eb-msg">${svg(I.hand, 30)}<span>Tippe ein Beet, das Gewächshaus oder eine Deko an und <b>ziehe</b> es an einen neuen Platz.</span></div>
        <div class="eb-btns"><button class="ebtn" data-act="editStore">${I.crate}<span>Lager${stored ? ` (${stored})` : ''}</span></button><button class="ebtn" data-act="editShop">${I.NAV.shop}<span>Deko kaufen</span></button><button class="ebtn" data-act="editLand">${I.expand}<span>Vergrößern</span></button><button class="btn small pink" data-act="editDone">Fertig</button></div>`;
    } else {
      const name = this.objName(e.sel);
      html = `<div class="eb-msg">${svg(e.valid ? I.hand : I.lock, 30)}<span><b>${esc(name)}</b><br>${e.valid ? 'Ziehen zum Verschieben' : 'Hier ist kein Platz'}</span></div>
        <div class="eb-btns"><button class="ebtn" data-act="editRotate">${I.rotate}<span>Drehen</span></button>${e.sel.type === 'deco' ? `<button class="ebtn" data-act="editStoreSel">${I.crate}<span>Einlagern</span></button>` : ''}<button class="ebtn" data-act="editDeselect">✓<span>Ablegen</span></button><button class="btn small pink" data-act="editDone">Fertig</button></div>`;
    }
    if (bar.dataset.h !== html) { bar.innerHTML = html; bar.dataset.h = html; }
    bar.hidden = false;
  }

  objName(ref) {
    const s = this.s;
    if (ref.type === 'gh') return 'Gewächshaus';
    if (ref.type === 'bed') { const b = s.beds[ref.i]; return b.locked ? 'Verwildertes Beet' : `${C.BED_LEVELS[b.lvl - 1].name}${b.seed ? ' · ' + plain(C.SEEDS[b.seed].name) : ''}`; }
    return C.DECO[s.decor[ref.k]?.id]?.name || 'Deko';
  }

  storeHtml() {
    const s = this.s;
    const groups = {};
    s.decor.forEach((d, k) => { if (d.stored) (groups[d.id] ||= []).push(k); });
    const ids = Object.keys(groups);
    const body = ids.length ? `<div class="storelist">${ids.map((id) => {
      const d = C.DECO[id], k = groups[id][0];
      return `<div class="sitem"><img alt="" src="${this.icons.deco[id]}"><div class="grow"><b>${esc(d.name)}</b><small>${groups[id].length}× im Lager</small></div>
        <div class="sbtns"><button class="btn small" data-act="storePlace" data-id="${k}">Aufstellen</button>${d.price ? `<button class="btn small ghost" data-act="storeSell" data-id="${k}">Verkaufen ${I.coin()} ${Math.floor(d.price / 2)}</button>` : ''}</div></div>`;
    }).join('')}</div>` : `<p class="empty">Dein Lager ist leer. Wähle im Gestalten-Modus eine Deko aus und tippe auf „Einlagern“, um Platz zu schaffen.</p>`;
    return `<div class="inner"><h3>Lager <button class="x" data-act="closeSheet" aria-label="Schließen">✕</button></h3>${body}
      <div class="all"><button class="btn small blue wide" data-act="editShop">Neue Deko kaufen</button></div></div>`;
  }

  landDialog() {
    const s = this.s, cur = C.LAND[s.land], next = C.LAND[s.land + 1];
    const size = (l) => `${Math.round(l.half * 2)} × ${Math.round(l.half * 2)} m`;
    if (!next) { this.modal({ title: 'Garten vergrößern', html: `${svg(I.expand, 90)}<p>Dein Garten hat schon die volle Größe (${size(cur)}). Wunderbar!</p>`, buttons: [['OK', 'closeModal', '']] }); return; }
    const newBeds = C.BED_UNLOCK.filter((b) => b && b.land === s.land + 1).length;
    const lvOk = s.level >= next.level, coinOk = s.coins >= next.cost;
    this.modal({ title: 'Garten vergrößern', html: `${svg(I.expand, 90)}<p>Der Zaun wandert nach außen: <b>${size(cur)}</b> → <b>${size(next)}</b>.<br>Mehr Platz für Deko und ${newBeds} neue Beete.</p><div class="big-num">${I.coin()} ${num(next.cost)}</div>${lvOk ? (coinOk ? '' : `<p style="color:#b3123a">Dir fehlen noch ${num(next.cost - s.coins)} Münzen.</p>`) : `<p style="color:#b3123a">Ab Level ${next.level}.</p>`}`,
      buttons: lvOk && coinOk ? [['Vergrößern', 'expandLand', '']] : [['OK', 'closeModal', 'ghost']] });
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
  // ---------- Benachrichtigungen ----------
  notifyChanged() {
    const n = this.api.notify?.();
    const b = $('bellBadge'), u = n ? n.unread : 0;
    b.textContent = u || ''; b.hidden = !u;
    if (this.panel === 'notify' || this.panel === 'settings') this.renderPanel(true);
  }

  pNotify() {
    const n = this.api.notify?.(), acc = this.api.account();
    if (!n) return '<div class="card center"><p>Keine Benachrichtigungen.</p></div>';
    const ICONS = { bell: I.bell, flower: this.icons.flower.daisy, drop: I.drop, greenhouse: I.greenhouse, cart: I.cart, gift: I.gift, chat: I.chat, friend: I.NAV.friends, news: I.megaphone, star: I.sparkle };
    const ic = (k) => (ICONS[k] || I.bell).startsWith('data:') ? `<img alt="" src="${ICONS[k]}">` : svg(ICONS[k] || I.bell, 30);
    const fmt = (ts) => { const d = this.api.now() - ts; return d < 60_000 ? 'gerade eben' : d < 3600_000 ? `vor ${Math.floor(d / 60_000)} Min` : d < 86400_000 ? `vor ${Math.floor(d / 3600_000)} Std` : new Date(ts).toLocaleDateString('de-DE'); };
    const p = n.push;
    const pushCard = !acc.user ? '' : `<div class="card pushcard"><div class="row">${svg(I.bell, 40)}<div class="grow"><h4>Push aufs Handy</h4><p>${!p.supported ? 'Dein Browser unterstützt keine Push-Nachrichten. Als installierte App klappt es auf Android.' : p.server === false ? 'Auf dem Server noch nicht eingerichtet.' : p.enabled ? 'An – du bekommst Nachrichten, wenn Blumen Durst haben, reif sind, die Züchtung fertig ist, Freunde schreiben oder schenken.' : 'Erfahre auch bei geschlossenem Spiel, wenn deine Blumen Durst haben, reif sind oder Freunde dir schreiben.'}</p></div></div>
      ${p.supported && p.server !== false ? `<div class="btnrow">${p.enabled ? '<button class="btn small ghost" data-act="pushOff">Ausschalten</button><button class="btn small" data-act="pushTest">Test senden</button>' : '<button class="btn small" data-act="pushOn">Einschalten</button>'}</div>` : ''}</div>`;
    const list = n.items.length ? n.items.map((x) => `<button class="card note ${x.read ? '' : 'new'}" data-act="noteGo" data-id="${x.act || ''}">${ic(x.icon)}<div class="grow"><b>${esc(x.text)}</b><small>${fmt(x.ts)}</small></div></button>`).join('') : `<div class="card center">${svg(I.bell, 60)}<h4>Alles ruhig</h4><p>Hier siehst du, wenn Blumen Durst haben oder reif sind, Züchtungen fertig sind, Bestellungen warten, Freunde schreiben oder schenken.</p></div>`;
    setTimeout(() => n.markRead(), 400);
    return `${pushCard}<div class="sec">Zuletzt</div>${list}${n.items.length ? '<div class="btnrow center"><button class="btn small ghost" data-act="noteClear">Liste leeren</button></div>' : ''}`;
  }

  // Wartungshinweis vom Team (oben im Bild)
  setMaint(m) {
    const el = $('maint');
    if (!m) { el.hidden = true; return; }
    const until = m.until ? ` (bis ${new Date(m.until).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr)` : '';
    el.innerHTML = `${svg(I.gear, 22)}<span><b>Wartung${until}:</b> ${esc(m.text || 'Es kann kurz zu Störungen kommen. Dein Fortschritt wird auf diesem Gerät gesichert.')}</span>`;
    el.hidden = false;
  }

  boostCards() {
    const list = Object.values(this.boosts || {}).filter((b) => b.end > Date.now());
    if (!list.length) return '';
    const NAMES = { doubleXp: ['Doppelte Erfahrung', I.xp], doubleCoins: ['Doppelte Münzen', I.coinPile()], shinyDay: ['Funkel-Tag', I.sparkle], traderSale: ['Händler zahlt mehr', I.cart] };
    return `<div class="sec">Gerade aktiv</div>` + list.map((b) => { const [n, ic] = NAMES[b.id] || [b.id, I.sparkle]; const left = b.end - Date.now(); const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000); return `<div class="card row boost">${svg(ic, 44)}<div class="grow"><h4>${n} ×${b.mult}</h4><p>Noch ${h ? `${h} Std ` : ''}${m} Min – für alle Spieler.</p></div></div>`; }).join('');
  }

  // Besuch bei einem Freund: Leiste oben, eigene Knöpfe ausblenden
  newsHtml(n) { return newsCard(n); }

  setVisit(v) {
    this.visit = v;
    document.body.classList.toggle('visiting', !!v);
    const bar = $('visitBar');
    this.bubbleKeys = [];
    if (!v) { bar.hidden = true; bar.innerHTML = ''; this.syncHistory(); this.refresh(); return; }
    const f = { id: v.id, name: v.name };
    bar.innerHTML = `<div class="vtop">${avatar(f, 42)}<div class="grow"><small>Zu Besuch bei</small><b>${esc(v.name)}</b><small>Level ${v.level} · ${v.collected} Blumen entdeckt</small></div>
        <button class="btn small home" data-act="endVisit">${svg(I.house, 22)} Nach Hause</button></div>
      <div class="vbtns"><span class="vwater">${svg(I.drop, 20)} ${v.helpLeft ? `Noch ${v.helpLeft}× gießen` : 'Heute genug gegossen'}</span>
        <button class="btn small pink" data-act="likeGarden" ${v.liked ? 'disabled' : ''}>${svg(I.heart, 20)} ${v.liked ? 'Gefällt dir' : 'Gefällt mir'}</button>
        <button class="btn small" data-act="giftMenu" data-id="${v.id}" ${this.api.social?.()?.friend(v.id)?.gifted ? 'disabled' : ''}>${svg(I.gift, 20)}</button>
        <button class="btn small blue" data-act="openChat" data-id="${v.id}">${svg(I.chat, 20)}</button></div>`;
    bar.hidden = false;
    this.syncHistory();
  }

  visitFrame(infos) {
    const v = this.visit, hide = !!this.panel;
    infos.forEach((info, i) => {
      let key = null, cls, html;
      if (!info.hidden && !info.locked && info.thirsty && v.helpLeft > 0) { key = 'VT'; cls = 'thirsty'; html = `<div class="b">${I.drop}Gießen</div>`; }
      this.placeBubble(this.bubbles[i], i, key, cls, html, hide ? null : key && this.api.world.bedScreen(i, false));
    });
    this.placeBubble(this.bubbles[GH], GH, null);
    $('harvestAll').hidden = true; $('hint').hidden = true;
  }

  frame(infos, now) {
    if (this.visit) { this.visitFrame(infos); return; }
    const hide = !!this.panel || !!this.edit, s = this.s, m = this.mode;
    let ready = 0, thirsty = 0;
    // Gesperrte Beete: Preis nur bei den nächsten freischaltbaren zeigen
    const firstLevelLocked = infos.find((x) => x.locked && x.needLevel && !x.inside);
    const inside = !!this.api.world.inside;
    infos.forEach((info, i) => {
      const el = this.bubbles[bubIdx(i)];
      if (!el) return;
      if (info.ready) ready++;
      let key = null, html, cls;
      if (info.hidden || !!info.inside !== inside) { /* Beet auf noch nicht gekauftem Land – oder gerade nicht in dieser Ansicht */ }
      else if (m) {
        if (!info.locked) {
          if (m.kind === 'sprinkler' && !info.sprinkler) { key = 'MS'; cls = 'mode'; html = `<div class="b">${I.drop}${num(G.sprinklerCost(s))}</div>`; }
          else if (m.kind === 'upgrade' && info.lvl < C.BED_LEVELS.length) { const nx = C.BED_LEVELS[info.lvl]; key = 'MU' + info.lvl; cls = 'mode'; html = `<div class="b">${I.upgrade}${s.level < nx.level ? `Lv ${nx.level}` : num(G.bedLevelCost(s, info.lvl + 1))}</div>`; }
          else if (m.kind === 'grow' && (info.size || 1) < C.BED_SIZES.length) { const nx = C.BED_SIZES[info.size || 1]; key = 'MG' + (info.size || 1); cls = 'mode'; html = `<div class="b">${I.expand}${s.level < nx.level ? `Lv ${nx.level}` : num(G.bedSizeCost(s, (info.size || 1) + 1))}</div>`; }
          else if (m.kind === 'item' && info.seed && (m.id === 'compost' ? !info.compost : !info.ready && !(m.id === 'lucky' && info.shinyHidden) && !(m.id === 'fert' && info.thirsty))) { key = 'MI' + m.id; cls = 'mode'; html = `<div class="b">${I.ITEM[m.id]}</div>`; }
        }
      } else if (info.locked) {
        if (info.inside ? i === C.BED_COUNT + s.tropic.open : (!info.needLevel || info === firstLevelLocked)) { key = 'L' + info.price + '|' + info.needLevel; cls = 'locked'; html = `<div class="b">${I.lock}${info.needLevel ? `Lv ${info.needLevel}` : num(info.price)}</div>`; }
      } else if (info.empty) { key = 'E'; cls = 'empty'; html = '<div class="b">+</div>'; }
      else if (info.ready) { key = 'R' + info.seed + info.shiny; cls = 'ready' + (info.shiny ? ' gold' : ''); html = `<div class="b"><img alt="${esc(plain(C.SEEDS[info.seed].name))} ernten" src="${info.shiny ? this.icons.shiny[info.seed] : this.icons.flower[info.seed]}"></div>`; }
      else if (info.thirsty) { thirsty++; key = 'T'; cls = 'thirsty'; html = `<div class="b">${I.drop}Gießen</div>`; }
      else { const sec = Math.ceil(info.remaining / 1000); key = 'G' + sec + '|' + Math.round(info.progress * 40); cls = 'grow'; html = `<div class="b">${I.ring(info.progress)}${fmtTime(info.remaining)}</div>`; }
      this.placeBubble(el, bubIdx(i), key, cls, html, hide ? null : key && this.api.world.bedScreen(i, info.ready));
    });
    // Gewächshaus und Tropenhaus (nur draußen)
    const gh = inside ? null : this.ghBubble(now, hide || !!m);
    this.placeBubble(this.bubbles[GH], GH, gh?.key, gh?.cls, gh?.html, gh && this.api.world.greenhouseScreen());
    const th = inside ? null : this.tropicBubble(infos, hide || !!m);
    this.placeBubble(this.bubbles[TH], TH, th?.key, th?.cls, th?.html, th && this.api.world.tropicScreen());

    const ha = $('harvestAll');
    const free = !hide && this.sheetBed < 0 && !m;
    const showAll = free && ready >= 2, showRain = free && !showAll && thirsty >= 2 && s.items.rain > 0;
    if (showAll || showRain) {
      const t = showAll ? `${I.coin()} Alle ernten (${ready})` : `${svg(I.ITEM.rain, 30)} Regenwolke (${thirsty} durstig)`;
      if (ha.dataset.t !== t) { ha.innerHTML = t; ha.dataset.t = t; ha.classList.toggle('blue', showRain); ha.classList.toggle('gold', !showRain); }
    }
    ha.hidden = !(showAll || showRain);
    this.haRain = showRain;
    this.updateHint(infos, hide);
    if (this.sheetKind === 'care' && this.sheetBed >= 0) this.tickCare(infos[this.sheetBed]);
  }

  placeBubble(el, i, key, cls, html, p) {
    if (!key || !p) { el.hidden = true; return; }
    if (this.bubbleKeys[i] !== key) { this.bubbleKeys[i] = key; el.className = 'bub ' + cls; el.innerHTML = html; }
    el.hidden = false;
    el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%)`;
  }

  tropicDialog() {
    const s = this.s, t = s.tropic, ok = s.coins >= C.TROPIC.cost;
    if (t.built) { this.api.act.enterTropic(); return; }
    if (s.level < C.TROPIC.level) { this.modal({ title: C.TROPIC.name, html: `<p>🌴 Vor dem Zaun steht ein verfallenes Glashaus. Ab <b>Level ${C.TROPIC.level}</b> kannst du es als ${C.TROPIC.name} wieder aufbauen – mit Pflanztöpfen, in denen Blumen nie Durst haben, Tag und Nacht wachsen und 20 % schneller sind. Nur dort gedeihen tropische Blumen wie Lotus, Frangipani und Protea.</p>`, buttons: [['OK', 'closeModal', '']] }); return; }
    this.modal({ title: `${C.TROPIC.name} bauen`, html: `<p>🌴 Repariere das alte Glashaus und mach ein ${C.TROPIC.name} daraus:</p><ul class="unl"><li>🌺 6 tropische Blumen, die nur dort wachsen</li><li>💧 Blumen haben drinnen nie Durst</li><li>🌙 Nachtblumen wachsen auch tagsüber (Kunstlicht)</li><li>⏱ 20 % schnelleres Wachstum</li><li>🪴 ${C.TROPIC.start} Töpfe zum Start, bis zu ${C.TROPIC.pots} ausbaubar</li></ul><div class="big-num">${I.coin()} ${num(C.TROPIC.cost)}</div>${ok ? '' : `<p style="color:#b3123a">Dir fehlen noch ${num(C.TROPIC.cost - s.coins)} Münzen.</p>`}`, buttons: ok ? [['Bauen', 'buildTropic', '']] : [['Zum Händler', 'openTrader', 'pink'], ['OK', 'closeModal', 'ghost']] });
  }

  tropicBubble(infos, hide) {
    if (hide) return null;
    const s = this.s, t = s.tropic;
    if (!t.built) return s.level >= C.TROPIC.level ? { key: 'TB', cls: 'gh alert', html: `<div class="b">🌴 ${C.TROPIC.name} bauen</div>` } : { key: 'TL', cls: 'locked', html: `<div class="b">${I.lock}Lv ${C.TROPIC.level}</div>` };
    const ready = infos.filter((x) => x.inside && x.ready).length;
    if (ready) return { key: 'TR' + ready, cls: 'ready gold', html: `<div class="b">🌴 ${ready} reif</div>` };
    return { key: 'TI', cls: 'gh', html: `<div class="b">🌴 Betreten</div>` };
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
    if (this.api.world.inside) hide = true;
    if (s.tutorial === 0) text = 'Tippe auf ein Beet mit <b>+</b>, um Blumen zu pflanzen.';
    else if (!s.stats.watered && infos.some((x) => x.thirsty)) text = 'Eine Blume hat <b>Durst</b>! Tippe auf den Tropfen über dem Beet, um sie zu gießen. Mit Sprinkler gießt sich ein Beet von selbst.';
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
    const was = this.sheetBed >= 0 || !!this.sheetKind;
    this.sheetBed = -1; this.sheetKind = null;
    $('sheet').classList.remove('open'); $('sheet').inert = true;
    if (was) this.syncHistory();
  }

  renderSheet() {
    const html = this.sheetKind === 'care' ? this.careHtml(this.sheetBed) : this.sheetKind === 'store' ? this.storeHtml() : this.seedHtml();
    if (html === null) { this.closeSheet(); return; }
    $('sheet').innerHTML = html;
  }

  seedHtml() {
    const s = this.s, i = this.sheetBed, bed = G.bedOf(s, i) || {}, inside = !!bed.inside, nowT = this.api.now();
    const order = C.SEED_ORDER.filter((id) => (!C.SEEDS[id].event || G.seedStatus(s, id, nowT, inside).available) && (!C.SEEDS[id].tropic || inside)).sort((a, b) => (G.seedStatus(s, b, nowT, inside).available ? 1 : 0) - (G.seedStatus(s, a, nowT, inside).available ? 1 : 0) || (inside ? (C.SEEDS[b].tropic ? 1 : 0) - (C.SEEDS[a].tropic ? 1 : 0) : 0));
    const cards = order.map((id) => {
      const d = C.SEEDS[id], st = G.seedStatus(s, id, nowT, inside), afford = s.coins >= d.cost;
      const label = st.available ? `${I.coin()} ${d.cost}` : `${I.lock} ${esc(st.reason)}`;
      const act = st.available ? 'plant' : st.shop ? 'gotoShop' : st.breed ? 'gotoBreed' : 'seedLocked';
      const nightLock = d.nightOnly && this.api.breedCtx?.().time !== 'night';
      return `<button class="seed ${st.available ? '' : 'lock'} ${d.rare || d.bred ? 'rare' : ''} ${d.slow ? 'slow' : ''} ${d.event ? 'evseed' : ''}" data-act="${act}" data-id="${id}" aria-label="${esc(plain(d.name))}">
        ${tierTag(d)}${d.tropic ? '<span class="tier tev">🌴 Tropen</span>' : ''}${d.event ? (st.useSeed ? `<span class="tier tev">🌱 ${st.seeds} Samen</span>` : `<span class="tier tev">🎉 Event ×2${st.seeds ? ` · ${st.seeds} 🌱` : ''}</span>`) : ''}${d.slow ? `<span class="tier tslow">${nightLock && !inside ? '🌙 nachts' : '⏳ Geduld'}</span>` : ''}<img alt="" src="${this.icons.flower[id]}" style="background:${this.icons.flowerBg[id]}"><b>${esc(d.name)}</b>
        <span class="meta"><span>⏱ ${growLabel(G.growTime(bed, id))}</span><span>${I.coin()}${Math.round(d.reward * C.BED_LEVELS[(bed.lvl || 1) - 1].mult)}</span>${d.water && !bed.sprinkler && !inside ? `<span class="wneed" title="Muss ${d.water}× gegossen werden">${I.drop}${d.water}</span>` : ''}</span>
        <span class="price ${st.available && !afford ? 'poor' : ''}">${label}</span></button>`;
    }).join('');
    const empty = inside ? s.tropic.pots.slice(0, s.tropic.open).filter((b) => !b.seed).length : s.beds.filter((b) => !b.locked && !b.seed).length;
    const sel = C.SEEDS[s.selectedSeed] && G.seedStatus(s, s.selectedSeed, nowT, inside).available && !(C.SEEDS[s.selectedSeed].tropic && !inside) ? s.selectedSeed : 'daisy';
    const allBtn = empty > 1 ? `<div class="all"><button class="btn small blue wide" data-act="plantAll" data-id="${sel}"><img alt="" src="${this.icons.flower[sel]}" style="width:28px;height:28px;margin:-4px 0"> Alle ${empty} freien Beete · ${I.coin()} ${C.SEEDS[sel].cost * empty}</button></div>` : '';
    const weekend = G.isWeekend(this.api.now()) ? `<div class="wknd">${svg(I.sparkle, 18)} Funkel-Wochenende: doppelte Chance auf Funkelblüten!</div>` : '';
    return `<div class="inner"><h3>Was möchtest du pflanzen? <button class="x" data-act="closeSheet" aria-label="Schließen">✕</button></h3>${weekend}<div class="seeds">${cards}</div>${allBtn}${this.bedTools(i)}</div>`;
  }

  // Bewässerung und Ausbau für ein Beet
  bedTools(i) {
    const s = this.s, b = G.bedOf(s, i);
    if (!b || b.locked) return '';
    const L = C.BED_LEVELS[b.lvl - 1];
    let spr;
    if (b.sprinkler) spr = `<span class="tool on">${I.drop}<span><b>Bewässerung</b><small>aktiv · wächst 30 % schneller</small></span></span>`;
    else if (s.level < C.SPRINKLER.level) spr = `<span class="tool off">${I.drop}<span><b>Bewässerung</b><small>ab Level ${C.SPRINKLER.level}</small></span></span>`;
    else spr = `<button class="tool" data-act="sprinkler" data-bed="${i}">${I.drop}<span><b>Bewässerung</b><small>30 % schneller · ${I.coin()} ${num(G.sprinklerCost(s))}</small></span></button>`;
    let up;
    if (b.lvl >= C.BED_LEVELS.length) up = `<span class="tool on">${I.upgrade}<span><b>${L.name}</b><small>voll ausgebaut · ×${String(L.mult).replace('.', ',')} Münzen</small></span></span>`;
    else {
      const nx = C.BED_LEVELS[b.lvl];
      const what = `×${String(nx.mult).replace('.', ',')} Münzen${nx.shiny ? ' · mehr Funkeln' : ''}`;
      up = s.level < nx.level
        ? `<span class="tool off">${I.upgrade}<span><b>${nx.name}</b><small>ab Level ${nx.level} · ${what}</small></span></span>`
        : `<button class="tool" data-act="upgradeBed" data-bed="${i}">${I.upgrade}<span><b>Zum ${nx.name}</b><small>${what} · ${I.coin()} ${num(G.bedLevelCost(s, b.lvl + 1))}</small></span></button>`;
    }
    let gr;
    const sz = b.size || 1, SZ = C.BED_SIZES[sz - 1];
    if (sz >= C.BED_SIZES.length) gr = `<span class="tool on">${I.expand}<span><b>Größe: ${SZ.name}</b><small>${SZ.plants} Pflanzen · ×${String(SZ.mult).replace('.', ',')} Ertrag</small></span></span>`;
    else {
      const nx = C.BED_SIZES[sz];
      gr = s.level < nx.level
        ? `<span class="tool off">${I.expand}<span><b>Größe: ${nx.name}</b><small>ab Level ${nx.level} · ${nx.plants} Pflanzen</small></span></span>`
        : `<button class="tool" data-act="growBed" data-bed="${i}">${I.expand}<span><b>Vergrößern: ${nx.name}</b><small>${nx.plants} Pflanzen · ×${String(nx.mult).replace('.', ',')} Ertrag · ${I.coin()} ${num(G.bedSizeCost(s, sz + 1))}</small></span></button>`;
    }
    return `<div class="tools"><div class="tlab">${esc(L.name)} · ${SZ.name}</div>${spr}${up}${gr}</div>`;
  }

  careHtml(i) {
    const s = this.s, info = G.bedInfo(s, i, this.api.now());
    if (!info || !info.seed) return null;
    const d = C.SEEDS[info.seed];
    this._careReady = info.ready; this._careThirsty = info.thirsty;
    const items = ['fert', 'turbo', 'lucky', 'compost'].map((k) => {
      const it = C.ITEMS[k], have = s.items[k];
      let dis = '', sub;
      if (s.level < it.level) { dis = 'disabled'; sub = `ab Level ${it.level}`; }
      else if (k === 'lucky' && info.shinyHidden) { dis = 'disabled'; sub = 'funkelt schon'; }
      else if (k === 'compost' && info.compost) { dis = 'disabled'; sub = 'ist drin'; }
      else if ((k === 'fert' || k === 'turbo') && info.ready) { dis = 'disabled'; sub = 'schon reif'; }
      else if (k === 'fert' && info.thirsty) { dis = 'disabled'; sub = 'erst gießen'; }
      else sub = have ? 'Benutzen' : `Kaufen ${I.coin()} ${it.price}`;
      return `<button class="itembtn ${have ? '' : 'buy'}" data-act="${have ? 'useItem' : 'buyUse'}" data-id="${k}" data-bed="${i}" ${dis}>${I.ITEM[k]}<b>${esc(it.name)}</b><small>${sub}</small>${have ? `<span class="cnt">×${have}</span>` : ''}</button>`;
    }).join('');
    const extra = [info.shinyHidden ? `${svg(I.sparkle, 16)} wird eine Funkelblüte!` : '', info.sprinkler ? `${svg(I.drop, 16)} Sprinkler gießt automatisch` : info.waterLeft > 0 && !info.thirsty ? `${svg(I.drop, 16)} braucht noch ${info.waterLeft}× Wasser` : '', info.compost ? `${svg(I.ITEM.compost, 16)} Kompost: +50 %` : ''].filter(Boolean).join(' · ');
    return `<div class="inner care"><h3>${esc(d.name)} ${tierTag(d)}<button class="x" data-act="closeSheet" aria-label="Schließen">✕</button></h3>
      <div class="carehead"><img alt="" src="${info.shinyHidden && info.ready ? this.icons.shiny[info.seed] : this.icons.flower[info.seed]}"><div class="grow">
        <b id="careTime">${info.ready ? 'Erntereif!' : info.thirsty ? 'Durst!' : `Noch ${fmtTime(info.remaining)}`}</b><div class="prog"><i id="careBar" style="width:${(info.progress * 100).toFixed(1)}%"></i></div>
        <small>${extra || `Bringt ${num(Math.round(d.reward * C.BED_LEVELS[info.lvl - 1].mult))} Münzen`}</small></div>
        ${info.ready ? `<button class="btn" data-act="harvestBed" data-bed="${i}">Ernten</button>` : info.thirsty ? `<button class="btn blue" data-act="waterBed" data-bed="${i}">${svg(I.drop, 22)} Gießen</button>` : ''}</div>
      <div class="itemrow">${items}</div>${this.bedTools(i)}</div>`;
  }

  tickCare(info) {
    if (!info) return;
    if (!info.seed || info.ready !== this._careReady || info.thirsty !== this._careThirsty) { this.renderSheet(); return; }
    const t = $('careTime'), b = $('careBar');
    if (t && !info.ready && !info.thirsty) { const txt = `Noch ${fmtTime(info.remaining)}`; if (t.textContent !== txt) t.textContent = txt; }
    if (b) b.style.width = (info.progress * 100).toFixed(1) + '%';
  }

  // ---------- Panels ----------
  renderPanel(soft) {
    const id = this.panel;
    const el = $('panel');
    // Im Chat nur die Nachrichten auffrischen – das Eingabefeld bleibt unberührt
    if (soft && id === 'chat' && $('chatList')) { updateChat(this); const p = el.querySelector('.pill span'); if (p) p.textContent = num(this.s.coins); return; }
    const body = { quests: () => this.pQuests(), events: () => this.pEvents(), collection: () => this.pCollection(), friends: () => pFriends(this), shop: () => this.pShop(), settings: () => this.pSettings(), breed: () => this.pBreed(), chat: () => pChat(this), admin: () => pAdmin(this), trader: () => pTrader(this), notify: () => this.pNotify(), trade: () => pTrade(this) }[id]();
    const prevScroll = el.querySelector('.pbody')?.scrollTop || 0;
    // Eingaben (z. B. halb getippter Spielername) beim Neuzeichnen behalten
    const keep = {}; let focus = null;
    const kid = (inp) => `${inp.closest('form')?.dataset.form || ''}|${inp.closest('form')?.dataset.id || ''}|${inp.name}`;
    for (const inp of el.querySelectorAll('input[name], textarea[name]')) { if (inp.type === 'radio') { if (inp.checked) keep[`${kid(inp)}=${inp.value}`] = true; } else if (inp.value) keep[kid(inp)] = inp.value; }
    if (document.activeElement?.name && el.contains(document.activeElement)) focus = kid(document.activeElement);
    el.classList.toggle('chatmode', id === 'chat');
    el.innerHTML = `<div class="phead"><h2 class="outlined">${id === 'chat' ? chatTitle(this) : TITLES[id]}</h2><div class="pill">${I.coin()}<span>${num(this.s.coins)}</span></div><button class="x" data-act="closePanel" aria-label="Schließen">✕</button></div><div class="pbody">${body}</div>`;
    for (const inp of el.querySelectorAll('input[name], textarea[name]')) {
      const k = kid(inp);
      if (inp.type === 'radio') { if (Object.keys(keep).some((x) => x.startsWith(k + '='))) inp.checked = !!keep[`${k}=${inp.value}`]; } else if (keep[k] !== undefined) inp.value = keep[k];
      if (focus === k) inp.focus({ preventScroll: true });
    }
    if (soft) el.querySelector('.pbody').scrollTop = prevScroll;
    if (id === 'chat') updateChat(this, { first: true });
  }

  // Neues von Freunden (vom SocialHub)
  socialChanged(kind, info) {
    const hub = this.api.social?.();
    this.badge('friends', hub ? hub.badge : 0);
    const n = this.api.notify?.();
    if (n && hub?.data && kind === 'sync') {
      for (const f of hub.data.incoming) n.add('friend', `${f.name} möchte mit dir befreundet sein.`, { icon: 'friend', act: 'friends', key: 'req' + f.id });
      for (const f of hub.data.friends) if (f.unread && hub.chat?.id !== f.id) n.add('chat', `${f.name} hat dir geschrieben.`, { icon: 'chat', act: 'friends', key: 'chat' + f.id + f.unread });
    }
    if (this.visit && kind === 'sync') this.setVisit(this.visit);
    if (this.panel === 'friends' && kind === 'sync') this.renderPanel(true);
    else if (this.panel === 'chat') { if (!hub?.chat) { this.toast('Dieser Chat ist nicht mehr verfügbar.', 'err'); this.nav('friends'); } else if (kind === 'chat') updateChat(this, info); }
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
    for (const [k, n] of Object.entries(r.seeds || {})) if (n && C.SEEDS[k]) out.push(`<span class="chip"><img alt="" src="${this.icons.flower[k]}"> ${n}× ${esc(plain(C.SEEDS[k].name))}-Samen</span>`);
    if (r.title && C.TITLES[r.title]) out.push(`<span class="chip">🏷️ Titel „${esc(C.TITLES[r.title])}“</span>`);
    return `<div class="chips">${out.join('')}</div>`;
  }

  // ----- Aufgaben: Story, Tagesaufgaben, Levelweg -----
  pQuests() {
    const s = this.s, now = this.api.now();
    const st = G.storyStatus(s);
    const daily = G.claimableTasks(s) + (G.dailyGiftAvailable(s, now) ? 1 : 0);
    const cur = this.tab.quests || 'story';
    let h = this.tabs('quests', [['story', 'Story', !st.finished && st.done ? 1 : 0], ['daily', 'Täglich', daily], ['weekly', 'Woche', G.claimableWeekly(s, now)], ['levels', 'Levelweg']]);
    if (cur === 'story') h += this.storyHtml(st);
    else if (cur === 'daily') h += this.dailyHtml();
    else if (cur === 'weekly') h += this.weeklyHtml();
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
    const map = { deco: ['shop', 'deco'], rare: ['shop', 'flowers'], greenhouse: ['breed'], breed: ['breed'], sprinkler: ['mode', 'sprinkler'], bedLevel: ['mode', 'upgrade'], beds: ['bed'], useItem: ['shop', 'supplies'], move: ['edit'] };
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

  weeklyHtml() {
    const s = this.s, now = this.api.now();
    const w = G.weeklyList(s, now);
    const d = Math.floor(w.left / 86400000), hh = Math.floor((w.left % 86400000) / 3600000);
    let h = `<div class="card row">${svg(I.target, 46)}<div class="grow"><h4>Wochenziele</h4><p>Größere Belohnungen für regelmäßiges Spielen. Noch ${d ? `${d} Tage ${hh} Std` : `${hh} Std`} bis zur neuen Woche.</p></div></div>`;
    h += w.tasks.map((t) => `<div class="card"><div class="row"><div class="grow"><h4>${esc(t.label)}</h4><p>${num(t.have)} / ${num(t.goal)}</p>${this.chips(t.reward)}</div>
      ${t.claimed ? '<button class="btn small off" disabled>✓</button>' : `<button class="btn small" data-act="claimWeekly" data-id="${t.id}" ${t.done ? '' : 'disabled'}>Abholen</button>`}</div>
      <div class="prog"><i style="width:${(t.have / t.goal) * 100}%"></i></div></div>`).join('');
    h += `<div class="card ${w.allDone && !w.bonus ? 'glow' : ''}"><div class="row">${svg(I.coinChest(), 54)}<div class="grow"><h4>Wochenbonus</h4><p>Alle sechs Ziele geschafft:</p>${this.chips(C.WEEKLY_BONUS)}</div>${w.bonus ? '<button class="btn small off" disabled>✓</button>' : `<button class="btn small gold" data-act="claimWeekly" data-id="bonus" ${w.allDone ? '' : 'disabled'}>Abholen</button>`}</div></div>`;
    return h;
  }

  levelsHtml() {
    const s = this.s, xp = G.xpProgress(s);
    let h = `<div class="card lvcard"><span class="bigstar">${I.star(s.level)}</span><div class="grow"><h4>Level ${s.level}${xp.max ? ' – Maximum!' : ''}</h4><p>${xp.max ? 'Du hast alles erreicht.' : `Noch ${num(xp.need - xp.have)} EP bis Level ${s.level + 1}`}</p><div class="prog"><i style="width:${xp.frac * 100}%"></i></div></div></div>
      <p class="note" style="margin-bottom:12px">EP gibt es beim Ernten, für Story- und Tagesaufgaben und für neue Züchtungen.</p>`;
    h += G.roadmap(s).map((r) => {
      const unl = r.unlocks.map((u) => `<li>${this.unlockIcon(u)}<span>${esc(u.label)}</span></li>`).join('');
      return `<div class="lvrow ${r.reached ? 'done' : r.level === s.level + 1 ? 'next' : ''}"><span class="lvn">${r.reached ? '✓' : r.level}</span><div class="grow"><b>Level ${r.level}</b>${this.chips(r.reward)}${unl ? `<ul>${unl}</ul>` : ''}</div></div>`;
    }).join('');
    return h;
  }

  unlockIcon(u) {
    const ic = this.icons;
    if (u.kind === 'seed' || u.kind === 'recipe') return `<img alt="" src="${ic.flower[u.id]}">`;
    if (u.kind === 'bed') return `<img alt="" src="${ic.bed}">`;
    if (u.kind === 'item') return I.ITEM[u.id];
    if (u.kind === 'deco') return `<img alt="" src="${ic.deco[u.id]}">`;
    if (u.kind === 'land') return I.expand;
    if (u.id === 'sprinkler') return `<img alt="" src="${ic.sprinkler}">`;
    if (u.id === 'greenhouse') return `<img alt="" src="${ic.greenhouse}">`;
    if (/^bed[2-5]$/.test(u.id)) return `<img alt="" src="${ic.bedLvl[+u.id.slice(3)]}">`;
    return I.sparkle;
  }

  // ----- Events -----
  pEvents() {
    const s = this.s, now = this.api.now();
    const ev = G.eventInfo(s, now);
    let h = '';
    h += this.boostCards();
    if (this.news?.length) h += `<div class="sec">Neuigkeiten</div>${this.news.slice(0, 3).map((n) => newsCard(n)).join('')}`;
    if (ev.active) {
      const a = ev.active;
      const next = ev.milestones.find((m) => !m.reached);
      h += `<div class="evbanner" style="--ev:${a.color}"><div class="evtop"><b>${esc(a.name)}</b><span>${daysLeft(a.end - now)}</span></div><p>${esc(a.desc)}</p>
        <div class="evtok">${svg(I.leaf(a.color), 44)}<div><b>${num(ev.tokens)}</b><small>${esc(a.token)} zum Ausgeben</small></div><div><b>${num(ev.total)}</b><small>insgesamt gesammelt</small></div></div>
        ${next ? `<div class="prog"><i style="width:${Math.min(100, (ev.total / next.at) * 100)}%"></i></div><small>Nächste Belohnung bei ${next.at} ${esc(a.token)}</small>` : '<small>Alle Belohnungen erreicht!</small>'}</div>`;
      const evSeed = C.EVENT_SEEDS.find((k) => C.SEEDS[k].event === a.id);
      if (evSeed) { const d = C.SEEDS[evSeed], st = G.seedStatus(s, evSeed, now); h += `<div class="sec">Event-Blume</div><div class="card row glow"><img alt="" src="${this.icons.flower[evSeed]}" style="width:72px;height:72px;background:${this.icons.flowerBg[evSeed]}"><div class="grow"><h4>${esc(d.name)} <span class="tier tev">×2 ${esc(a.token)}</span></h4><p>Nur während „${esc(a.name)}“ zu säen (${I.coin()} ${d.cost}, ${growLabel(d.growMs)}). Jede Ernte bringt doppelt so viele ${esc(a.token)} – und die Blume bleibt für immer in deiner Sammlung.</p>${st.available ? '' : `<p class="note">${esc(st.reason)}</p>`}</div></div>`; }
      h += `<div class="sec">Belohnungen</div>` + ev.milestones.map((m) => `<div class="card row ms ${m.claimed ? 'done' : m.reached ? 'ready' : ''}"><div class="msat">${svg(I.leaf(a.color), 26)}<b>${m.at}</b></div><div class="grow">${this.chips(m.reward)}</div>
        ${m.claimed ? '<button class="btn small off" disabled>✓</button>' : `<button class="btn small" data-act="milestone" data-id="${m.i}" ${m.reached ? '' : 'disabled'}>Abholen</button>`}</div>`).join('');
      h += `<div class="sec">Event-Shop</div><div class="grid2">` + a.shop.map((it) => {
        const owned = it.deco && s.deco.includes(it.deco);
        const packSeed = it.seedPack ? C.EVENT_SEEDS.find((k) => C.SEEDS[k].event === a.id) : null;
        if (it.seedPack && !packSeed) return '';
        const icon = packSeed ? `<img alt="" src="${this.icons.flower[packSeed]}" style="background:${this.icons.flowerBg[packSeed]};border-radius:50%">` : it.deco ? `<img alt="" src="${this.icons.deco[it.deco]}">` : svg(I.ITEM[Object.keys(it.items)[0]], 64);
        const label = packSeed ? `${C.SEED_PACK.n}× ${plain(C.SEEDS[packSeed].name)}-Samen` : it.deco ? C.DECO[it.deco].name : Object.entries(it.items).map(([k, n]) => `${n}× ${C.ITEMS[k].name}`).join(', ');
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
    if (C.MONEY_ENABLED) h += `<div class="card row">${svg(I.pass, 56)}<div class="grow"><h4>Saisonpass</h4><p>Ein freiwilliger Saisonpass mit Deko-Belohnungen ist in Vorbereitung – ohne Spielvorteil.</p></div></div>`;
    return h;
  }

  // ----- Sammlung -----
  pCollection() {
    const s = this.s, cur = this.tab.collection || 'flowers';
    const ready = G.achievementList(s).filter((a) => a.ready && !a.done).length;
    let h = this.tabs('collection', [['flowers', 'Blumen'], ['shiny', 'Funkeln'], ['animals', 'Tiere'], ['deco', 'Deko'], ['album', 'Album', ready]]);
    if (cur === 'flowers') {
      const found = C.SEED_ORDER.filter((k) => s.collection[k]?.count).length;
      h += `<div class="card"><h4>${found} von ${C.SEED_ORDER.length} Blumen entdeckt</h4><p>Geerntet: ${num(s.stats.harvested)} · Gezüchtet: ${s.bred.length} von ${C.BRED_SEEDS.length}</p><div class="prog"><i style="width:${(found / C.SEED_ORDER.length) * 100}%"></i></div></div>`;
      const tile = (k) => {
        const e = s.collection[k], d = C.SEEDS[k];
        const sub = e?.count ? `${num(e.count)}× geerntet` : d.bred ? (s.bred.includes(k) ? 'Gezüchtet!' : 'Im Gewächshaus züchten') : 'Noch nicht geerntet';
        const known = e?.count || s.bred.includes(k);
        return `<div class="tile tap ${known ? '' : 'unknown'}" role="button" tabindex="0" data-act="detail" data-kind="flower" data-id="${k}">${tierTag(d)}<img alt="" src="${this.icons.flower[k]}" ${known ? `style="background:${this.icons.flowerBg[k]}"` : ''}><b>${esc(d.name)}</b><small>${sub}</small></div>`;
      };
      h += `<p class="hintline">${svg(I.eye, 18)} Tippe eine Blume an, um sie dir in 3D genauer anzusehen.</p><div class="sec">Gartenblumen</div><div class="grid3">${C.BASE_SEEDS.map(tile).join('')}</div>`;
      h += `<div class="sec">Züchtungen</div><div class="grid3">${C.BRED_SEEDS.map(tile).join('')}</div>`;
      const evName = (k) => C.EVENTS.find((e) => e.id === C.SEEDS[k].event)?.name || '';
      const evTile = (k) => tile(k).replace('<small>Noch nicht geerntet</small>', `<small>Nur beim Event „${esc(evName(k))}“</small>`);
      h += `<div class="sec">Event-Blumen</div><p class="hintline">Jede Jahreszeit und jeder Anlass hat eine eigene Blume. Sie lässt sich nur während des Events säen, bringt dort doppelte Event-Währung und bleibt für immer in deiner Sammlung.</p><div class="grid3">${C.EVENT_SEEDS.map(evTile).join('')}</div>`;
      h += `<button class="btn wide" style="margin-top:14px" data-act="openBreed">${svg(I.greenhouse, 28)} Zum Gewächshaus</button>`;
    } else if (cur === 'shiny') {
      const n = C.SEED_ORDER.filter((k) => s.collection[k]?.shiny).length;
      h += `<div class="card row">${svg(I.sparkle, 54)}<div class="grow"><h4>Funkelblüten: ${n} von ${C.SEED_ORDER.length}</h4><p>Mit etwas Glück blüht eine Blume funkelnd. Sie glitzert im Beet und bringt die dreifache Belohnung. Glücksdünger, Prachtbeete und das Funkel-Wochenende erhöhen die Chance.</p></div></div><div class="grid3">`;
      h += C.SEED_ORDER.map((k) => { const e = s.collection[k]; return `<div class="tile tap ${e?.shiny ? '' : 'unknown'}" role="button" tabindex="0" data-act="detail" data-kind="flower" data-shiny="1" data-id="${k}"><span class="shinywrap ${e?.shiny ? 'on' : ''}"><img alt="" src="${this.icons.shiny[k]}" ${e?.shiny ? `style="background:${this.icons.shinyBg[k]}"` : ''}></span><b>${esc(C.SEEDS[k].name)}</b><small>${e?.shiny ? `${e.shiny}× gefunden` : '???'}</small></div>`; }).join('') + '</div>';
    } else if (cur === 'album') {
      h += this.albumHtml();
    } else if (cur === 'animals') {
      h += Object.entries(C.ANIMALS).map(([k, d]) => {
        const seen = s.seenAnimals.includes(k);
        const skins = Object.entries(C.SKINS).filter(([, v]) => v.animal === k);
        const skinBtns = skins.length ? `<div class="btnrow"><button class="btn small ${s.activeSkin[k] === 'default' ? 'off' : 'ghost'}" data-act="equip" data-animal="${k}" data-id="default">Standard</button>${skins.map(([sk, v]) => s.skins.includes(sk) ? `<button class="btn small ${s.activeSkin[k] === sk ? 'off' : 'ghost'}" data-act="equip" data-animal="${k}" data-id="${sk}">${esc(v.name)}</button>` : `<button class="btn small ghost" data-act="tab" data-panel="shop" data-id="animals">${I.lock.replace('class="lock"', 'style="width:16px;height:16px"')} ${esc(v.name)}</button>`).join('')}</div>` : '';
        const hint = k === 'butterfly' ? 'Halte am Tag Ausschau!' : k === 'owl' ? 'Sie zeigt sich nur nachts – tippe sie an.' : 'Tippe es im Garten an, um es zu entdecken.';
        return `<div class="card row"><button class="icbtn" data-act="detail" data-kind="animal" data-id="${k}" aria-label="${esc(d.name)} ansehen"><img class="ic" alt="" src="${this.icons.animal[k]}" style="${seen ? '' : 'filter:brightness(0) opacity(.25)'}"><i>${svg(I.eye, 16)}</i></button><div class="grow"><h4>${esc(d.name)} ${seen ? '✓' : ''}</h4><p>${esc(d.desc)} ${seen ? '' : hint}</p>${skinBtns}</div></div>`;
      }).join('');
    } else {
      const count = (k) => s.decor.filter((d) => d.id === k).length;
      h += `<div class="card"><h4>${s.deco.length} von ${C.ALL_DECO.length} Deko-Arten gesammelt</h4><p>${s.decor.filter((d) => !d.stored).length} Teile im Garten · ${s.decor.filter((d) => d.stored).length} im Lager</p><div class="prog"><i style="width:${(s.deco.length / C.ALL_DECO.length) * 100}%"></i></div></div>`;
      h += `<div class="grid3">${C.ALL_DECO.map((k) => { const n = count(k), own = s.deco.includes(k); return `<div class="tile tap ${own ? '' : 'unknown'}" role="button" tabindex="0" data-act="detail" data-kind="deco" data-id="${k}"><img alt="" src="${this.icons.deco[k]}"><b>${esc(C.DECO[k].name)}</b><small>${own ? `${n}× im Besitz` : C.DECO[k].event ? 'Event-Deko' : 'Noch nicht gekauft'}</small></div>`; }).join('')}</div>`;
      h += `<div class="btnrow center"><button class="btn" data-act="tab" data-panel="shop" data-id="deco">Zum Deko-Shop</button><button class="btn blue" data-act="editStart">${svg(I.brush, 24)} Gestalten</button></div>`;
    }
    return h;
  }

  // ----- Gewächshaus & Zucht -----
  pBreed() {
    const s = this.s, now = this.api.now(), night = this.api.breedCtx();
    if (!s.greenhouse.unlocked) {
      const lvOk = s.level >= C.GREENHOUSE.level;
      return `<div class="card ghcard"><img alt="" src="${this.icons.greenhouse}"><h4>Das alte Gewächshaus</h4><p>Hinter dem Haus steht Ophelias altes Gewächshaus. Restauriert kannst du darin zwei Blumen kreuzen und ganz neue Sorten züchten – wie die Nordlicht-Rose, die Schwarze Rose oder die legendäre Sternenrose.</p>
        <button class="btn big" data-act="restoreGH" ${lvOk ? '' : 'disabled'}>${lvOk ? `Restaurieren · ${I.coin()} ${C.GREENHOUSE.cost}` : `Ab Level ${C.GREENHOUSE.level}`}</button></div>` + this.recipeList(false, night);
    }
    const job = G.breedingInfo(s, now);
    let h = '';
    if (job) {
      const d = C.SEEDS[job.result], sure = job.chance >= 1, pct = Math.round(job.chance * 100);
      h += `<div class="card jobcard"><img alt="" src="${this.icons.flower[job.result]}" class="${job.ready ? '' : 'growing'}"><div class="grow"><small>${job.ready ? (sure ? 'Fertig gezüchtet!' : 'Fertig – ob es geklappt hat?') : 'Wird gezüchtet …'}</small><h4>${esc(d.name)} ${tierTag(d)}</h4>
        <div class="prog"><i style="width:${job.progress * 100}%"></i></div><p>${job.ready ? (sure ? 'Hol deine neue Sorte ab – danach kannst du sie in jedes Beet pflanzen.' : `Erfolgschance ${pct} %. Schau nach, ob die Kreuzung gelungen ist!`) : `Noch ${fmtTime(job.remaining)}${sure ? '' : ` · Erfolgschance ${pct} %`}`}</p></div></div>
        <div class="btnrow center">${job.ready ? `<button class="btn big" data-act="collectBreed">${sure ? 'Abholen' : 'Nachsehen'}</button>` : `<button class="btn ${s.items.boost ? 'gold' : 'ghost'}" data-act="boostBreed" ${s.level >= C.ITEMS.boost.level ? '' : 'disabled'}>${svg(I.ITEM.boost, 28)} ${s.items.boost ? `Beschleuniger benutzen (${s.items.boost})` : s.level >= C.ITEMS.boost.level ? `Beschleuniger ${I.coin()} ${C.ITEMS.boost.price}` : `Beschleuniger ab Lv ${C.ITEMS.boost.level}`}</button>`}</div>`;
    } else {
      const tl = { morning: 'Sonnenaufgang', day: 'Tag', evening: 'Abenddämmerung', night: 'Nacht' }[night.time];
      const mp = G.moonPhase(now), moon = night.full ? 'Vollmond 🌕' : mp < 0.03 || mp > 0.97 ? 'Neumond 🌑' : mp < 0.5 ? 'zunehmender Mond 🌒' : 'abnehmender Mond 🌘';
      h += `<div class="card row">${svg(night.time === 'night' ? I.moonSmall : I.greenhouse, 50)}<div class="grow"><h4>Zuchtbuch</h4><p>Jetzt: <b>${tl}</b> · ${moon}. Manche Kreuzungen gelingen nur zu bestimmten Tageszeiten oder bei Vollmond. Schwere Züchtungen können misslingen – dann gibt es 40 % zurück.</p></div></div>`;
      h += this.breedHelpers();
    }
    return h + this.recipeList(true, night, !!job);
  }

  // Zauberpollen-Schalter und Bestäuber-Boni im Gewächshaus
  breedHelpers() {
    const s = this.s, it = C.ITEMS.pollen;
    if (s.items.pollen <= 0) this.pollenOn = false;
    const placed = Object.entries(C.BREED_HELPERS).filter(([id]) => s.decor.some((d) => d.id === id && !d.stored));
    const helpers = placed.length
      ? placed.map(([id, v]) => `<span class="chip"><img alt="" src="${this.icons.deco[id]}"> ${esc(C.DECO[id].name)} +${Math.round(v * 100)} %</span>`).join('')
      : '<span class="tip">Tipp: Ein Bienenstock (+10 %) oder Insektenhotel (+5 %) im Garten hilft beim Bestäuben.</span>';
    let pollen;
    if (s.level < it.level) pollen = `<button class="btn small" disabled>${svg(I.ITEM.pollen, 22)} Zauberpollen ab Level ${it.level}</button>`;
    else if (s.items.pollen > 0) pollen = `<button class="btn small ${this.pollenOn ? 'gold' : 'ghost'}" data-act="togglePollen" aria-pressed="${!!this.pollenOn}">${svg(I.ITEM.pollen, 22)} Zauberpollen ${this.pollenOn ? 'an' : 'aus'} · ${s.items.pollen}×</button>`;
    else pollen = `<button class="btn small blue" data-act="buyItem" data-id="pollen">${svg(I.ITEM.pollen, 22)} Zauberpollen · ${I.coin()} ${it.price}</button>`;
    return `<div class="card helpers"><div class="hrow">${pollen}<span class="small">+25 % Erfolgschance für die nächste Züchtung</span></div><div class="chips">${helpers}</div></div>`;
  }

  recipeList(active, night, busy) {
    const s = this.s;
    const pollen = !!this.pollenOn && s.items.pollen > 0;
    return `<div class="sec">Kreuzungen</div>` + C.RECIPES.map((r, idx) => {
      const d = C.SEEDS[r.result], bred = s.bred.includes(r.result);
      const ch = G.breedChance(s, r, { pollen });
      const need = ch.harvests;
      const ca = G.harvestCount(s, r.a), cb = G.harvestCount(s, r.b);
      const reasons = [];
      for (const [k, c] of [[r.a, ca], [r.b, cb]]) {
        if (!c) reasons.push(`Ernte zuerst: ${plain(C.SEEDS[k].name)}`);
        else if (c < need) reasons.push(`${plain(C.SEEDS[k].name)} ${c}/${need}× geerntet`);
      }
      if (s.level < d.level) reasons.push(`ab Level ${d.level}`);
      if (r.when && r.when !== night.time) reasons.push(C.WHEN_LABEL[r.when]);
      if (r.moon && !night.full) reasons.push(`nur bei Vollmond (ab ${new Date(G.nextFullMoon(this.api.now())).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })})`);
      const parent = (k, c) => `<span class="par ${c >= need ? '' : 'miss'}"><img alt="" src="${this.icons.flower[k]}"><small>${esc(C.SEEDS[k].name)}</small>${need > 1 && !bred ? `<i class="cnt ${c >= need ? 'ok' : ''}">${Math.min(c, need)}/${need}</i>` : ''}</span>`;
      const pct = Math.round(ch.chance * 100);
      const diff = `<span class="diff d${ch.diff}" title="Schwierigkeit">${'★'.repeat(ch.diff)}<b>${ch.name}</b></span>`;
      const chance = bred ? '' : `<span class="chance ${pct >= 100 ? 'sure' : pct >= 60 ? 'ok' : 'low'}">${pct} %${ch.fails ? ` <small>(+${Math.round(ch.fails * C.BREED_PITY * 100)} % Erfahrung)</small>` : ''}</span>`;
      let btn;
      if (bred) btn = '<span class="okbadge">✓ Gezüchtet</span>';
      else if (!active) btn = '';
      else btn = `<button class="btn small" data-act="breed" data-id="${idx}" ${busy || reasons.length ? 'disabled' : ''}>Züchten · ${I.coin()} ${r.cost}</button>`;
      return `<div class="card recipe ${bred ? 'bred' : ''}"><div class="rline">${parent(r.a, ca)}<span class="plus">+</span>${parent(r.b, cb)}<span class="arrow">➜</span><span class="par res ${bred ? '' : 'unknown'}"><img alt="" src="${this.icons.flower[r.result]}"><small>${esc(d.name)}</small></span></div>
        <div class="rfoot">${diff}${chance}${tierTag(d)}<span class="meta">⏱ ${growLabel(r.ms)}${r.when ? ` · ${svg(r.when === 'night' ? I.moonSmall : r.when === 'morning' ? I.sunrise : r.when === 'evening' ? I.sunset : I.sun, 16)} ${C.WHEN_SHORT[r.when]}` : ''}${r.moon ? ' · 🌕 Vollmond' : ''}</span>${reasons.length && !bred ? `<span class="why">${esc(reasons.join(' · '))}</span>` : `<span class="hint">${esc(r.hint)}</span>`}${btn}</div></div>`;
    }).join('');
  }

  // ----- Shop -----
  pShop() {
    const s = this.s, cur = this.tab.shop || (C.MONEY_ENABLED ? 'offers' : 'supplies'), now = this.api.now();
    const tabs = C.MONEY_ENABLED ? [['offers', 'Angebote'], ['supplies', 'Bedarf'], ['flowers', 'Blumen'], ['deco', 'Deko'], ['animals', 'Tiere']] : [['supplies', 'Bedarf'], ['flowers', 'Blumen'], ['deco', 'Deko'], ['animals', 'Tiere'], ['daily', 'Täglich']];
    let h = this.tabs('shop', tabs);
    if (cur === 'daily' || (cur === 'offers' && !C.MONEY_ENABLED)) {
      // Ohne Echtgeld: hier nur das Tagesgeschenk und der Hinweis auf Händler und Aufgaben
      const gift = G.dailyGiftAvailable(s, now);
      h += `<div class="card row">${svg(I.gift, 54)}<div class="grow"><h4>Tägliches Geschenk</h4><p>Jeden Tag ${C.DAILY_GIFT} Münzen gratis.</p></div><button class="btn small" data-act="gift" ${gift ? '' : 'disabled'}>${gift ? 'Abholen' : '✓ Heute'}</button></div>
        <div class="card row">${svg(I.cart, 54)}<div class="grow"><h4>Münzen verdienen</h4><p>Blumen beim Händler verkaufen, Bestellungen liefern, Tages- und Wochenziele erfüllen, Freunden helfen. In BloomWorld gibt es nichts zu kaufen, was dir einen Vorteil bringt.</p></div></div>`;
    } else if (cur === 'offers') {
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
          <div class="btnrow">${lvOk ? `<button class="btn small" data-act="buyItem" data-id="${k}">1× · ${I.coin()} ${it.price}</button>${it.pack ? `<button class="btn small blue" data-act="buyPack" data-id="${k}">${it.pack[0]}× · ${I.coin()} ${it.pack[1]} <i class="save">-${Math.round((1 - it.pack[1] / (it.price * it.pack[0])) * 100)} %</i></button>` : ''}${s.items[k] && !['boost', 'rain', 'pollen'].includes(k) ? `<button class="btn small ghost" data-act="itemMode" data-id="${k}">Benutzen</button>` : ''}${s.items[k] && k === 'rain' ? '<button class="btn small ghost" data-act="useRain">Benutzen</button>' : ''}${s.items[k] && (k === 'boost' || k === 'pollen') ? '<button class="btn small ghost" data-act="openBreed">Zum Gewächshaus</button>' : ''}` : `<button class="btn small" disabled>${I.lock.replace('class="lock"', 'style="width:16px;height:16px"')} ab Level ${it.level}</button>`}</div></div>`;
      }).join('');
      const unlocked = s.beds.filter((b) => !b.locked).length, spr = s.beds.filter((b) => b.sprinkler).length;
      const sprOk = s.level >= C.SPRINKLER.level;
      h += `<div class="sec">Garten-Ausbau</div>
        <div class="card itemcard"><div class="row"><img class="ic" alt="" src="${this.icons.sprinkler}"><div class="grow"><h4>Automatische Bewässerung <span class="have">${spr}/${unlocked} Beete</span></h4><p>Ein Sprinkler gießt das Beet von selbst – Blumen wachsen dort für immer 30 % schneller.</p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="sprinklerMode" ${sprOk && spr < unlocked ? '' : 'disabled'}>${sprOk ? `Installieren · ab ${I.coin()} ${num(G.sprinklerCost(s))} pro Beet` : `ab Level ${C.SPRINKLER.level}`}</button></div></div>
        <div class="card itemcard"><div class="row"><img class="ic" alt="" src="${this.icons.bedLvl[2]}"><div class="grow"><h4>Beete ausbauen</h4><p>${C.BED_LEVELS.slice(1).map((b) => `<b>${b.name}</b>: ×${String(b.mult).replace('.', ',')} Münzen${b.shiny ? ', mehr Funkelblüten' : ''} (ab Level ${b.level}, ab ${num(b.cost)} Münzen)`).join('<br>')}<br><small>Jedes weitere Beet derselben Stufe kostet 10 % mehr.</small></p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="upgradeMode" ${s.level >= C.BED_LEVELS[1].level ? '' : 'disabled'}>${s.level >= C.BED_LEVELS[1].level ? 'Beet auswählen' : `ab Level ${C.BED_LEVELS[1].level}`}</button></div></div>
        <div class="card itemcard"><div class="row">${svg(I.expand, 60)}<div class="grow"><h4>Beete vergrößern</h4><p>Mehr Pflanzen in einem Beet: ${C.BED_SIZES.slice(1).map((b) => `<b>${b.name}</b>: ${b.plants} Pflanzen, ×${String(b.mult).replace('.', ',')} Ertrag (ab Level ${b.level}, ab ${num(b.cost)} Münzen)`).join('<br>')}<br>Braucht freien Platz rund um das Beet.</p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="growMode" ${s.level >= C.BED_SIZES[1].level ? '' : 'disabled'}>${s.level >= C.BED_SIZES[1].level ? 'Beet auswählen' : `ab Level ${C.BED_SIZES[1].level}`}</button></div></div>
        <div class="card itemcard"><div class="row"><img class="ic" alt="" src="${this.icons.bed}"><div class="grow"><h4>Neue Beete <span class="have">${unlocked}/${C.BED_COUNT}</span></h4><p>Mehr Beete bedeuten mehr Blumen gleichzeitig. Neue Plätze gibt es mit steigendem Level und auf neuem Land.</p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="showNextBed" ${s.beds.some((b, i) => b.locked && G.bedVisible(s, i)) ? '' : 'disabled'}>${s.beds.some((b, i) => b.locked && G.bedVisible(s, i)) ? 'Nächstes Beet zeigen' : unlocked < C.BED_COUNT ? 'Erst Garten vergrößern' : 'Alle Beete frei'}</button></div></div>
        <div class="card itemcard"><div class="row">${svg(I.expand, 60)}<div class="grow"><h4>Garten vergrößern <span class="have">Stufe ${s.land}/${C.LAND.length - 1}</span></h4><p>Der Zaun wandert nach außen: mehr Platz für Deko und neue Beete.</p></div></div>
          <div class="btnrow"><button class="btn small blue" data-act="editLand" ${C.LAND[s.land + 1] ? '' : 'disabled'}>${C.LAND[s.land + 1] ? `Vergrößern · ${I.coin()} ${num(C.LAND[s.land + 1].cost)}` : 'Volle Größe'}</button></div></div>`;
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
      h += `<div class="card row">${svg(I.brush, 48)}<div class="grow"><h4>Gestalte deinen Garten</h4><p>Deko kannst du mehrfach kaufen und im Gestalten-Modus frei verschieben, drehen und einlagern.</p></div><button class="btn small blue" data-act="editStart">Gestalten</button></div>`;
      h += `<div class="grid2">` + C.DECO_ORDER.map((k) => {
        const d = C.DECO[k], n = s.decor.filter((x) => x.id === k).length, lvOk = s.level >= (d.level || 1);
        return `<div class="tile">${n ? `<span class="owned">${n}×</span>` : ''}<img class="tapimg" alt="${esc(d.name)} ansehen" src="${this.icons.deco[k]}" data-act="detail" data-kind="deco" data-id="${k}"><b>${esc(d.name)}${d.seasonal ? ' 🍂' : ''}</b><small>${esc(d.desc)}</small>${C.BREED_HELPERS[k] ? `<small class="perk">+${Math.round(C.BREED_HELPERS[k] * 100)} % Zuchterfolg</small>` : ''}${lvOk ? `<button class="btn small" data-act="buyDeco" data-id="${k}">${I.coin()} ${d.price}</button>` : `<button class="btn small" disabled>${I.lock.replace('class="lock"', 'style="width:16px;height:16px"')} Level ${d.level}</button>`}</div>`;
      }).join('') + `</div><p class="note">Neue Deko wird automatisch auf einen freien Platz gestellt. Exklusive Deko gibt es bei Events.</p>`;
    } else {
      h += `<div class="grid2">` + Object.entries(C.SKINS).map(([k, d]) => {
        const own = s.skins.includes(k);
        return `<div class="tile"><img class="tapimg" alt="${esc(d.name)} ansehen" src="${this.icons.skin[k]}" data-act="detail" data-kind="animal" data-id="${k}"><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>${own ? `<button class="btn small ${s.activeSkin[d.animal] === k ? 'off' : 'blue'}" data-act="equip" data-animal="${d.animal}" data-id="${k}" ${s.activeSkin[d.animal] === k ? 'disabled' : ''}>${s.activeSkin[d.animal] === k ? '✓ Aktiv' : 'Anziehen'}</button>` : `<button class="btn small" data-act="buySkin" data-id="${k}">${I.coin()} ${d.price}</button>`}</div>`;
      }).join('') + `</div><p class="note">Tier-Skins sind rein kosmetisch. Der Herbst-Igel ist auch eine Belohnung im Herbstfest.</p>`;
    }
    return h;
  }

  // ----- Freunde -----
  // ----- Einstellungen -----
  pSettings() {
    const st = this.s.settings, acc = this.api.account();
    let autoOn = true; try { autoOn = localStorage.getItem('bw_autostart') !== '0'; } catch { /* egal */ }
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="set" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
    const LBL = { music: 'Musik', sound: 'Soundeffekte', musicVol: 'Musik-Lautstärke', soundVol: 'Effekt-Lautstärke' };
    const sw = (key) => `<button class="switch ${st[key] ? 'on' : ''}" role="switch" aria-checked="${!!st[key]}" data-act="toggle" data-key="${key}" aria-label="${LBL[key]}"></button>`;
    const range = (key, min, max, step, val, dis) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-key="${key}" style="--v:${((val - min) / (max - min)) * 100}%" ${dis ? 'disabled' : ''} aria-label="${LBL[key]}">`;
    const qd = { auto: 'Passt sich automatisch deinem Gerät an.', high: 'Schärfste Grafik mit weichen Schatten.', medium: 'Ausgewogen – gut für die meisten Handys.', low: 'Spart Akku: ohne Schatten, weniger Animation.' };
    const syncTxt = { saved: acc.lastSaved ? `In deinem Konto gespeichert (${new Date(acc.lastSaved).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr)` : 'In deinem Konto gespeichert', saving: 'Wird gespeichert …', offline: 'Keine Verbindung – wird später hochgeladen. Auf diesem Gerät ist alles gesichert.', error: 'Server-Speichern hat nicht geklappt – neuer Versuch läuft. Auf diesem Gerät ist alles gesichert.', auth: 'Bitte melde dich erneut an, damit dein Fortschritt hochgeladen wird.' };
    const account = acc.user
      ? `<div class="card set"><div class="lab">Konto</div><div class="row">${svg(I.user, 44)}<div class="grow"><h4>${esc(acc.user.name)}</h4><p>${esc(acc.user.email)}</p></div></div>
          <p class="sync">${svg(I.cloud, 22)} ${esc(syncTxt[acc.status] || syncTxt.saved)}</p>
          <div class="lab" style="margin-top:4px">Direkt in den Garten starten <button class="switch ${autoOn ? 'on' : ''}" role="switch" aria-checked="${autoOn}" data-act="autostart" aria-label="Direkt in den Garten starten"></button></div>
          <p>Du bleibst auf diesem Gerät angemeldet und landest beim Öffnen sofort in deinem Garten.</p>
          <div class="btnrow"><button class="btn small ghost" data-act="logout">Abmelden</button><button class="btn small red" data-act="deleteAccount">Konto löschen</button></div></div>`
      : `<div class="card set"><div class="lab">Konto</div><p>Du spielst offline. Dein Garten wird nur auf diesem Gerät gespeichert. Mit einem Konto ist er auf jedem Gerät verfügbar – dein bisheriger Fortschritt wird übernommen.</p><button class="btn small" style="align-self:flex-start" data-act="login">Anmelden oder registrieren</button></div>`;
    const admin = acc.user?.admin ? `<div class="card set admincard"><div class="lab">${svg(I.shield, 28)} Admin-Bereich</div><p>Ankündigungen und Update-Hinweise für alle Spieler schreiben, gemeldete Nachrichten prüfen und Chats sperren.</p><button class="btn small" style="align-self:flex-start" data-act="openAdmin">Admin-Bereich öffnen</button></div>` : '';
    const extra = acc.user ? `<div class="card set invite"><div class="lab">${svg(I.NAV.friends, 26)} Freunde einladen</div><p>Teile deinen Einladungslink. Sobald dein Freund Level 5 erreicht, bekommt ihr <b>beide</b> 300 Münzen, 3× Dünger und 1× Turbo-Dünger.</p><button class="btn small blue" data-act="share">Link teilen</button></div>
      <form class="card set codeform" data-form="redeem" autocomplete="off"><div class="lab">${svg(I.gift, 26)} Gutschein einlösen</div><div class="row"><input name="code" maxlength="20" placeholder="CODE" autocapitalize="characters" spellcheck="false" aria-label="Gutscheincode"><button class="btn small" type="submit">Einlösen</button></div></form>
      <form class="card set fbform" data-form="feedback" autocomplete="off"><div class="lab">${svg(I.megaphone, 26)} Feedback an das Team</div>
        <div class="seg small kinds">${[['bug', 'Fehler'], ['idea', 'Idee'], ['other', 'Sonstiges']].map(([k, l], i) => `<label><input type="radio" name="kind" value="${k}" ${i === 1 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <textarea name="text" maxlength="1000" rows="3" placeholder="Was ist dir aufgefallen? Was wünschst du dir?" aria-label="Feedback"></textarea>
        <button class="btn small" type="submit" style="align-self:flex-start">Senden</button></form>` : '';
    return `${account}${admin}${extra}
      <div class="card set"><div class="lab">Tageszeit</div>${(() => { const t = G.sunTimes(this.api.now()), f = (x) => new Date(x).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); return `<p>Tag und Nacht folgen der echten Uhrzeit – mit Morgen- und Abenddämmerung. Heute: Dämmerung ab ${f(t.dawn)}, ${svg(I.sunrise, 18)} ${f(t.rise)}, ${svg(I.sunset, 18)} ${f(t.set)}, dunkel ab ${f(t.dusk)}. Nachts leuchten Laternen, Fackeln und Lichterketten.</p>`; })()}
        <div class="lab" style="margin-top:6px">Vorschau <small>10 Minuten, dann wieder Echtzeit</small></div>${seg('cycle', [['real', 'Aus'], ['day', 'Tag ansehen'], ['night', 'Nacht ansehen']])}</div>
      <div class="card set"><div class="lab">Grafik &amp; Leistung</div>${seg('quality', [['auto', 'Auto'], ['high', 'Hoch'], ['medium', 'Mittel'], ['low', 'Sparsam']])}<p>${qd[st.quality]}</p></div>
      <div class="card set"><div class="lab">Musik ${sw('music')}</div>${range('musicVol', 0, 1, 0.05, st.musicVol, !st.music)}
        <div class="lab" style="margin-top:6px">Soundeffekte ${sw('sound')}</div>${range('soundVol', 0, 1, 0.05, st.soundVol, !st.sound)}</div>
      <div class="card set"><div class="lab">Spielstand</div><p>Wird automatisch gespeichert${acc.user ? ' – in deinem Konto und auf diesem Gerät' : ' – auf diesem Gerät'}.</p><button class="btn red small" style="align-self:flex-start;margin-top:6px" data-act="reset">Garten neu beginnen</button></div>
      <div class="card set"><div class="lab">Als App auf dem Handy</div><p>${standalone ? 'BloomWorld läuft als App. 🌸' : 'Mit eigenem Symbol auf dem Startbildschirm, ohne Browserleiste.'}</p>${standalone ? '' : '<button class="btn small" style="align-self:flex-start;margin-top:6px" data-act="install">Zum Startbildschirm hinzufügen</button>'}</div>
      <div class="btnrow center"><button class="btn small ghost" data-act="legal" data-id="impressum">Impressum</button><button class="btn small ghost" data-act="legal" data-id="datenschutz">Datenschutz</button><button class="btn small ghost" data-act="legal" data-id="agb">AGB</button></div>
      <p class="note">BloomWorld · Version 3.12<br>Schrift: Poppins (SIL Open Font License)</p>`;
  }

  // ---------- Klicks in Panels, Leisten, Dialogen ----------
  onAct(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    // Schutz vor versehentlichen Doppel-Tipps direkt nach dem Öffnen
    if (performance.now() - (this.openedAt || 0) < 300 && el.closest('#sheet')) return;
    const { act: a, id } = el.dataset;
    const bed = el.dataset.bed !== undefined ? +el.dataset.bed : this.sheetBed;
    if (SOCIAL_ACTS.has(a)) { onSocialAct(this, a, el); return; }
    if (TRADE_ACTS.has(a)) { onTradeAct(this, a, el); return; }
    if (TRADER_ACTS.has(a)) { onTraderAct(this, a, el); return; }
    const A = this.api.act;
    switch (a) {
      case 'closePanel': this.nav(this.panel === 'chat' ? 'friends' : 'garden'); break;
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
      case 'waterBed': A.water(bed); break;
      case 'endVisit': A.endVisit(); break;
      case 'likeGarden': A.likeGarden(); break;
      case 'autostart': { let on = true; try { on = localStorage.getItem('bw_autostart') === '0'; localStorage.setItem('bw_autostart', on ? '1' : '0'); } catch { /* egal */ } this.api.sound.play('tap'); this.toast(on ? 'Du startest ab jetzt direkt im Garten.' : 'Beim Öffnen siehst du wieder zuerst den Startbildschirm.'); this.renderPanel(true); break; }
      case 'togglePollen': this.pollenOn = !this.pollenOn; this.api.sound.play('tap'); this.renderPanel(true); break;
      case 'useRain': A.useRain(); break;
      case 'buyUse': A.buyAndUse(id, bed); break;
      case 'sprinkler': A.buySprinkler(bed); break;
      case 'upgradeBed': A.upgradeBed(bed); break;
      case 'growBed': A.growBed(bed); break;
      case 'openTrader': this.closeModal(); this.nav('trader'); break;
      case 'growMode': this.setMode({ kind: 'grow' }); break;
      case 'buyItem': A.buyItem(id, false); break;
      case 'buyPack': A.buyItem(id, true); break;
      case 'itemMode': this.setMode({ kind: 'item', id }); break;
      case 'sprinklerMode': this.setMode({ kind: 'sprinkler' }); break;
      case 'upgradeMode': this.setMode({ kind: 'upgrade' }); break;
      case 'endMode': this.setMode(null); break;
      case 'showNextBed': A.showNextBed(); break;
      case 'editStart': this.closeModal(); A.toggleEdit(true); break;
      case 'detail': this.api.sound.play('tap'); this.detail.open(el.dataset.kind, id, { shiny: el.dataset.shiny === '1' }); break;
      case 'detailStage': this.api.sound.play('tap'); this.detail.setStage(id); break;
      case 'editDone': A.exitEdit(); break;
      case 'editDeselect': A.editDeselect(); break;
      case 'editRotate': A.editRotate(); break;
      case 'editStoreSel': A.editStoreSel(); break;
      case 'editStore': this.openSheet(-1, 'store'); break;
      case 'editShop': this.closeSheet(); this.nav('shop', 'deco'); break;
      case 'editLand': this.landDialog(); break;
      case 'expandLand': this.closeModal(); A.expandLand(); break;
      case 'storePlace': A.storePlace(+id); break;
      case 'storeSell': A.storeSell(+id); break;
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
      case 'equip': A.equip(el.dataset.animal, id); if (this.modalOpen && this.detail.kind === 'animal') this.detail.open('animal', id); break;
      case 'claim': A.claim(id); break;
      case 'claimWeekly': A.claimWeekly(id); break;
      case 'share': A.share(); break;
      case 'set': A.setting(el.dataset.key, el.dataset.val); break;
      case 'toggle': A.setting(el.dataset.key, !this.s.settings[el.dataset.key]); break;
      case 'reset': this.confirm({ title: 'Neu beginnen?', text: 'Dein ganzer Garten, alle Münzen, Züchtungen und die Sammlung werden gelöscht. Das kann nicht rückgängig gemacht werden.', ok: 'Ja, neu beginnen', okClass: 'red', onOk: () => A.reset() }); break;
      case 'info': this.modal({ title: 'Saisonpass', html: `${svg(I.pass, 96)}<p>Der Saisonpass kommt mit einem der nächsten Saison-Events. Er wird freiwillig sein und nur Deko und Komfort enthalten – kein Pay-to-win.</p>`, buttons: [['OK', 'closeModal', '']] }); break;
      case 'unlockBed': this.closeModal(); A.unlockBed(+id); break;
      case 'unlockPot': this.closeModal(); A.unlockPot(+id); break;
      case 'buildTropic': this.closeModal(); A.buildTropic(); break;
      case 'enterTropic': this.closeModal(); A.enterTropic(); break;
      case 'exitTropic': A.exitTropic(); break;
      case 'modalOk': { const f = this._onOk; this.closeModal(); f?.(); break; }
      case 'toastAct': this.hideToast(); this._toastAction?.(); break;
      case 'login': A.login(); break;
      case 'logout': this.confirm({ title: 'Abmelden?', text: 'Dein Spielstand ist in deinem Konto gespeichert. Du kannst dich jederzeit wieder anmelden.', ok: 'Abmelden', onOk: () => A.logout() }); break;
      case 'deleteAccount': this.deleteAccountDialog(); break;
      case 'confirmDelete': { const pw = $('delPw')?.value || ''; A.deleteAccount(pw); break; }
      case 'privacy': this.modal({ title: 'Datenschutz', html: PRIVACY_HTML, buttons: [['OK', 'closeModal', '']] }); break;
      case 'legal': A.legal(id); break;
      case 'pushOn': A.pushOn(); break;
      case 'pushOff': A.pushOff(); break;
      case 'pushTest': A.pushTest(); break;
      case 'noteGo': if (id === 'garden') this.nav('garden'); else if (id === 'album') this.nav('collection', 'album'); else if (id) this.nav(id); break;
      case 'setTitle': A.setTitle(id); break;
      case 'openFeedback': this.closeModal(); this.nav('settings'); setTimeout(() => { const t = document.querySelector('#panel form[data-form=feedback] textarea, #panel form[data-form=feedback] input[name=text]'); t?.scrollIntoView({ block: 'center' }); t?.focus(); }, 350); break;
      case 'noteClear': this.api.notify?.().clear(); this.renderPanel(true); break;
      case 'install': A.install(); break;
      case 'storyOk': this.closeModal(); A.storySeen(); break;
    }
  }

  onInput(e) {
    const el = e.target;
    if (el.type !== 'range') return;
    const v = parseFloat(el.value);
    el.style.setProperty('--v', ((v - el.min) / (el.max - el.min)) * 100 + '%');
    this.api.act.setting(el.dataset.key, v, true);
  }

  // ---------- Dialoge (mit Warteschlange) ----------
  modal(opts) {
    if (opts.queue && this.modalOpen) { this.modalQueue.push(opts); return; }
    const { title, html, buttons = [], onOk, cls = '' } = opts;
    this._onOk = onOk;
    const prev = this._onClose; this._onClose = opts.onClose || null; prev?.();
    $('modal').innerHTML = `<div class="dlg ${cls}">${title ? `<div class="ttl">${esc(title)}</div>` : ''}<button class="x" data-act="closeModal" aria-label="Schließen">✕</button>${html}<div class="btns">${buttons.map(([l, act, c, extra = '']) => `<button class="btn ${c}" data-act="${act}" ${extra}>${l}</button>`).join('')}</div></div>`;
    $('modal').classList.add('open');
    this.syncHistory();
  }
  closeModal() {
    const was = this.modalOpen;
    $('modal').classList.remove('open'); this._onOk = null;
    const fn = this._onClose; this._onClose = null; fn?.();
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
    const s = this.s;
    if (i >= C.BED_COUNT) {
      const k = i - C.BED_COUNT, cost = C.TROPIC.potCost[k], lvl = C.TROPIC.potLevel[k], ok = s.coins >= cost;
      if (k !== s.tropic.open) { this.toast('Schalte die Töpfe der Reihe nach frei.', ''); return; }
      if (s.level < lvl) { this.modal({ title: 'Neuer Topf', html: `<p>Diesen Pflanztopf kannst du ab <b>Level ${lvl}</b> freischalten.</p><div class="big-num">${I.coin()} ${num(cost)}</div>`, buttons: [['OK', 'closeModal', 'ghost']] }); return; }
      this.modal({ title: 'Neuer Topf', html: `<p>Noch ein Pflanztopf im ${C.TROPIC.name}: nie Durst, Tag und Nacht, 20 % schneller.</p><div class="big-num">${I.coin()} ${num(cost)}</div>${ok ? '' : `<p style="color:#b3123a">Dir fehlen noch ${num(cost - s.coins)} Münzen.</p>`}`, buttons: ok ? [['Freischalten', 'unlockPot', '', `data-id="${k}"`]] : [['Zum Händler', 'openTrader', 'pink'], ['OK', 'closeModal', 'ghost']] });
      return;
    }
    const u = C.BED_UNLOCK[i];
    if (s.level < u.level) {
      this.modal({ title: 'Neues Beet', html: `<img class="big" alt="" src="${this.icons.bed}"><p>Dieses Beet kannst du ab <b>Level ${u.level}</b> freischalten. Ernte Blumen und erledige Aufgaben, um aufzusteigen.</p><div class="big-num">${I.coin()} ${num(u.cost)}</div>`, buttons: [['Zu den Aufgaben', 'tab', 'blue', 'data-panel="quests" data-id="story"'], ['OK', 'closeModal', 'ghost']] });
      return;
    }
    const ok = s.coins >= u.cost;
    this.modal({ title: 'Neues Beet', html: `<img class="big" alt="" src="${this.icons.bed}"><p>Erweitere deinen Garten um ein weiteres Hochbeet.</p><div class="big-num">${I.coin()} ${num(u.cost)}</div>${ok ? '' : `<p style="color:#b3123a">Dir fehlen noch ${num(u.cost - s.coins)} Münzen.</p>`}`, buttons: ok ? [['Freischalten', 'unlockBed', '', `data-id="${i}"`]] : [['Zum Händler', 'openTrader', 'pink'], ['OK', 'closeModal', 'ghost']] });
  }

  levelUp(up) {
    const unlocks = up.unlocks.map((u) => `<li>${this.unlockIcon(u)}<span>${esc(u.label)}</span></li>`).join('');
    this.modal({ queue: true, title: `Level ${up.level}!`, html: `<span class="bigstar huge">${I.star(up.level)}</span><p>Glückwunsch! Dein Garten wächst.</p>${this.chips({ coins: up.reward, items: up.items })}${(up.gifts || []).map((g) => `<p class="lvgift">🎁 Geschenk: ${this.chips(g)}</p>`).join('')}${unlocks ? `<ul class="unl">${unlocks}</ul>` : ''}`, buttons: [['Weiter', 'closeModal', '']] });
  }

  albumIcon(a, size = 56) {
    const [kind, id] = a.icon.split(':');
    if (kind === 'flower') return `<img alt="" src="${this.icons.flower[id]}" style="width:${size}px;height:${size}px;background:${this.icons.flowerBg[id]};border-radius:50%">`;
    if (kind === 'deco') return `<img alt="" src="${this.icons.deco[id]}" style="width:${size}px;height:${size}px">`;
    if (kind === 'animal') return `<img alt="" src="${this.icons.animal[id]}" style="width:${size}px;height:${size}px">`;
    return svg(I[a.icon] || I.sparkle, size);
  }
  albumHtml() {
    const s = this.s, list = G.achievementList(s);
    const done = list.filter((a) => a.done).length;
    let h = `<div class="card"><h4>Ophelias Album: ${done} von ${list.length} Erfolgen</h4><p>Sammle Blumen, Funkelblüten, Deko und Tiere – jeder Erfolg bringt eine Belohnung und einen Titel für deinen Namen.</p><div class="prog"><i style="width:${(done / list.length) * 100}%"></i></div></div>`;
    if (s.titles.length) h += `<div class="card set"><div class="lab">${svg(I.sparkle, 24)} Dein Titel</div><div class="titles"><button class="tag ${!s.title ? 'on' : ''}" data-act="setTitle" data-id="">Kein Titel</button>${s.titles.map((t) => `<button class="tag ${s.title === t ? 'on' : ''}" data-act="setTitle" data-id="${t}">${esc(C.TITLES[t])}</button>`).join('')}</div><p class="note">Der Titel steht in der Freundesliste neben deinem Namen.</p></div>`;
    h += list.map((a) => `<div class="card ach ${a.done ? 'done' : ''}">${this.albumIcon(a)}<div class="grow"><h4>${esc(a.name)}${a.done ? ' ✓' : ''}</h4><p>${esc(a.desc)}</p><div class="prog"><i style="width:${(a.have / a.need) * 100}%"></i></div><small>${a.have} / ${a.need}</small>${this.chips({ coins: a.reward.coins, items: a.reward.items, deco: a.reward.deco, skin: a.reward.skin })}${a.reward.title ? `<span class="chip">🏷️ Titel „${esc(C.TITLES[a.reward.title])}“</span>` : ''}${a.reward.unlock ? `<span class="chip"><img alt="" src="${this.icons.flower[a.reward.unlock]}"> ${esc(plain(C.SEEDS[a.reward.unlock].name))}</span>` : ''}</div></div>`).join('');
    return h;
  }
  feedbackAsk() {
    this.owlDialog({ title: 'Kurze Frage', heading: 'Wie gefällt dir BloomWorld?', text: 'Du spielst jetzt schon eine Weile – was fehlt dir, was nervt? Zwei Sätze reichen, ich lese alles.', button: 'Feedback schreiben', act: 'openFeedback', queue: true });
  }
  achievementDialog(a) {
    this.modal({ queue: true, cls: 'owl', title: 'Erfolg!', html: `<h3 class="dhead">${esc(a.name)}</h3><div class="achbig">${this.albumIcon(a, 96)}</div><p>${esc(a.desc)}</p>${this.chips({ coins: a.reward.coins, items: a.reward.items, deco: a.reward.deco, skin: a.reward.skin })}${a.reward.title ? `<p class="lvgift">🏷️ Neuer Titel: <b>${esc(C.TITLES[a.reward.title])}</b></p>` : ''}${a.reward.unlock ? `<p class="lvgift">🌸 Neue Blume: <b>${esc(plain(C.SEEDS[a.reward.unlock].name))}</b></p>` : ''}`, buttons: [['Zum Album', 'noteGo', '', 'data-id="album"'], ['Super!', 'closeModal', '']] });
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
