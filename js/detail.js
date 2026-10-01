// Detailansicht für die Sammlung: drehbare 3D-Ansicht plus alle Infos zu Blume, Deko oder Tier.
import * as C from './config.js';
import * as G from './game.js';
import * as I from './icons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = (s) => String(s).replace(/­/g, '');
const svg = (src, size) => src.replace('<svg', `<svg style="width:${size}px;height:${size}px;flex:none"`);
const TIER = { selten: ['Selten', 't1'], episch: ['Episch', 't2'], legendär: ['Legendär', 't3'] };
const tierTag = (d) => (d.tier ? `<span class="tier ${TIER[d.tier][1]}">${TIER[d.tier][0]}</span>` : d.rare ? '<span class="tier t0">Selten</span>' : '');
const timeLabel = (ms) => { const s = Math.round(ms / 1000); if (s < 60) return `${s} Sek`; const m = Math.round(s / 60); return m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std ${m % 60 ? `${m % 60} Min` : ''}`.trim(); };
const stat = (label, value) => `<div><small>${label}</small><b>${value}</b></div>`;

const STAGES = [['sprout', 'Keimling', 0, false], ['grow', 'Wachsend', 2, false], ['bloom', 'Blüte', 3, false], ['shiny', 'Funkelblüte', 3, true]];

export class Detail {
  constructor(ui) { this.ui = ui; this.tt = null; this.raf = 0; }

  open(kind, id, opt = {}) {
    const ui = this.ui, s = ui.s;
    let html = '', title = '', known = true, buttons = [['Schließen', 'closeModal', 'ghost']], stage = 'bloom';
    if (kind === 'flower') {
      const d = C.SEEDS[id];
      if (!d) return;
      const e = s.collection[id] || { count: 0, shiny: 0 };
      known = e.count > 0 || s.bred.includes(id);
      stage = opt.shiny && e.shiny ? 'shiny' : 'bloom';
      title = plain(d.name);
      const water = d.water ? `${svg(I.drop, 18)} ${d.water}×` : 'nie';
      const recipe = C.RECIPES.find((r) => r.result === id);
      let how;
      if (recipe) {
        const ch = G.breedChance(s, recipe);
        how = `<div class="dline">${this.mini(recipe.a)}<span class="plus">+</span>${this.mini(recipe.b)}<span class="arrow">➜</span>${this.mini(id, true)}</div>
          <p><span class="diff d${ch.diff}">${'★'.repeat(ch.diff)}<b>${ch.name}</b></span> Im Gewächshaus züchten · Erfolgschance ${Math.round(ch.chance * 100)} %${recipe.when ? ` · ${C.WHEN_LABEL[recipe.when]}` : ''}${recipe.moon ? ' · nur bei Vollmond' : ''}${ch.harvests > 1 ? ` · jede Eltern-Blume ${ch.harvests}× geerntet` : ''}.</p>`;
      } else if (d.rare) how = `<p>Seltene Sorte: im Shop unter „Blumen“ für ${I.coin()} ${d.unlockCoins} freischalten (ab Level ${d.level}). Danach kannst du sie jederzeit pflanzen.</p>`;
      else how = `<p>Saatgut gibt es im Beet-Menü ${d.level > 1 ? `ab Level ${d.level}` : 'von Anfang an'}.</p>`;
      const uses = C.RECIPES.filter((r) => r.a === id || r.b === id);
      const usesHtml = uses.length ? `<div class="dsec">Elternteil für</div><div class="duses">${uses.map((r) => `<button class="duse" data-act="detail" data-kind="flower" data-id="${r.result}">${this.mini(r.result, true)}</button>`).join('')}</div>` : '';
      const stages = STAGES.map(([k, l, , sh]) => {
        const locked = sh && !e.shiny;
        return `<button class="${k === stage ? 'on' : ''}" data-act="detailStage" data-id="${k}" ${locked || !known ? 'disabled' : ''}>${sh ? svg(I.sparkle, 14) : ''}${l}</button>`;
      }).join('');
      html = `${this.viewer(known)}<div class="seg small dstage">${stages}</div>
        <div class="dhead">${tierTag(d)}${d.bred ? '<span class="tier t0" style="background:#8a5bd6">Züchtung</span>' : ''}</div>
        <p class="lore">${known ? esc(C.FLOWER_INFO[id] || '') : 'Diese Blume hast du noch nicht entdeckt. Wie sie wohl aussieht, wenn sie blüht?'}</p>
        <div class="statgrid">${stat('Wachstum', `⏱ ${timeLabel(d.growMs)}`)}${stat('Ertrag', `${I.coin()} ${d.reward}`)}${stat('Erfahrung', `+${d.xp} EP`)}${stat('Gießen', water)}${stat('Saatgut', `${I.coin()} ${d.cost}`)}${stat('Ab Level', d.level)}</div>
        <div class="dsec">Deine Sammlung</div><div class="dmine"><span>${I.coin()} ${e.count}× geerntet</span><span>${svg(I.sparkle, 18)} ${e.shiny}× Funkelblüte</span></div>
        <div class="dsec">So bekommst du sie</div>${how}${usesHtml}`;
      if (recipe && !s.bred.includes(id)) buttons = [['Zum Gewächshaus', 'openBreed', ''], ...buttons];
    } else if (kind === 'deco') {
      const d = C.DECO[id];
      if (!d) return;
      const n = s.decor.filter((x) => x.id === id), placed = n.filter((x) => !x.stored).length;
      known = s.deco.includes(id);
      title = d.name;
      const helper = C.BREED_HELPERS[id] ? `<p class="dperk">${svg(I.greenhouse, 20)} Hilft beim Züchten: +${Math.round(C.BREED_HELPERS[id] * 100)} % Erfolgschance, solange es im Garten steht.</p>` : '';
      html = `${this.viewer(true)}<p class="lore">${esc(d.desc || '')}</p>${helper}
        <div class="statgrid">${stat('Größe', `${d.size[0].toLocaleString('de-DE')} × ${d.size[1].toLocaleString('de-DE')} m`)}${stat('Preis', d.event ? 'Event' : `${I.coin()} ${d.price}`)}${stat('Ab Level', d.level || 1)}${stat('Im Garten', placed)}${stat('Im Lager', n.length - placed)}${stat('Verkauf', d.event ? '–' : `${I.coin()} ${Math.floor((d.price || 0) / 2)}`)}</div>`;
      if (!d.event) buttons = [[`Kaufen · ${I.coin()} ${d.price}`, 'buyDeco', '', `data-id="${id}" ${s.level < (d.level || 1) ? 'disabled' : ''}`], ...buttons];
      if (placed) buttons = [[`${svg(I.brush, 20)} Gestalten`, 'editStart', 'blue'], ...buttons];
    } else if (kind === 'animal') {
      const animal = C.SKINS[id]?.animal || id;
      const d = C.ANIMALS[animal];
      if (!d) return;
      known = s.seenAnimals.includes(animal);
      title = C.SKINS[id]?.name || d.name;
      const skins = Object.entries(C.SKINS).filter(([, v]) => v.animal === animal);
      const looks = skins.length ? `<div class="seg small dstage"><button class="${id === animal ? 'on' : ''}" data-act="detail" data-kind="animal" data-id="${animal}">Standard</button>${skins.map(([k, v]) => `<button class="${id === k ? 'on' : ''}" data-act="detail" data-kind="animal" data-id="${k}">${esc(v.name)}</button>`).join('')}</div>` : '';
      const skin = C.SKINS[id];
      const own = !skin || s.skins.includes(id);
      html = `${this.viewer(known)}${looks}<p class="lore">${known ? esc(skin?.desc || d.desc) : 'Noch nicht entdeckt. Halte im Garten die Augen offen!'}</p>
        ${skin ? `<div class="statgrid">${stat('Preis', `${I.coin()} ${skin.price}`)}${stat('Besitz', own ? 'Ja' : 'Nein')}${stat('Aktiv', s.activeSkin[animal] === id ? 'Ja' : 'Nein')}</div>` : ''}`;
      if (skin && own && s.activeSkin[animal] !== id) buttons = [['Anziehen', 'equip', '', `data-animal="${animal}" data-id="${id}"`], ...buttons];
      else if (skin && !own) buttons = [['Im Shop ansehen', 'tab', '', 'data-panel="shop" data-id="animals"'], ...buttons];
    } else return;

    ui.modal({ title, cls: 'detail', html, buttons, onClose: () => this.stop() });
    this.kind = kind; this.id = id; this.stage = stage;
    this.mount();
  }

  // Kleine Blumen-Vorschau (unentdeckt als Schatten)
  mini(id, result = false) {
    const s = this.ui.s, known = (s.collection[id]?.count || 0) > 0 || s.bred.includes(id);
    return `<span class="dmini ${known ? '' : 'unknown'} ${result ? 'res' : ''}"><img alt="" src="${this.ui.icons.flower[id]}"><small>${known || result ? esc(C.SEEDS[id].name) : '???'}</small></span>`;
  }

  viewer(known) {
    return `<div class="turn ${known ? '' : 'unknown'}"><canvas width="320" height="320" aria-label="3D-Ansicht – zum Drehen wischen"></canvas><span class="turnhint">${svg(I.rotate, 16)} Wischen zum Drehen</span></div>`;
  }

  setStage(k) {
    if (this.kind !== 'flower' || k === this.stage) return;
    this.stage = k;
    for (const b of document.querySelectorAll('#modal .dstage button')) b.classList.toggle('on', b.dataset.id === k);
    this.mount(this.pos);
  }

  // 3D-Ansicht starten: dreht sich langsam, mit dem Finger frei drehbar
  mount(pos = 0) {
    this.stop(true);
    const cv = document.querySelector('#modal .turn canvas');
    if (!cv) return;
    const st = STAGES.find((x) => x[0] === this.stage) || STAGES[2];
    const world = this.ui.api.world;
    this.tt = world.turntable(this.kind, this.id, this.kind === 'flower' ? { stage: st[2], shiny: st[3] } : {});
    if (!this.tt) return;
    const ctx = cv.getContext('2d'), tt = this.tt, N = tt.count;
    this.pos = pos;
    let last = performance.now(), drawn = -1, drag = null, vel = 0, idle = 0;
    const draw = () => {
      const i = ((Math.round(this.pos) % N) + N) % N;
      if (i === drawn) return;
      const f = tt.frame(i);
      if (!f) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(f, 0, 0, cv.width, cv.height);
      drawn = i;
    };
    const tick = (t) => {
      if (this.tt !== tt) return;
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (!drag) {
        if (Math.abs(vel) > 0.2) { this.pos += vel * dt; vel *= Math.pow(0.04, dt); }
        else if ((idle += dt) > 1.2) this.pos += dt * 9; // langsames Drehen, wenn niemand wischt
      }
      draw();
      this.raf = requestAnimationFrame(tick);
    };
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, p: this.pos, t: performance.now(), lx: e.clientX }; vel = 0; idle = 0; cv.parentElement.classList.add('used'); };
    cv.onpointermove = (e) => {
      if (!drag) return;
      const k = N / Math.max(120, cv.clientWidth) * 1.1;
      this.pos = drag.p - (e.clientX - drag.x) * k;
      const now = performance.now(), dtm = Math.max(1, now - drag.t);
      vel = -((e.clientX - drag.lx) * k) / (dtm / 1000);
      drag.t = now; drag.lx = e.clientX;
    };
    cv.onpointerup = cv.onpointercancel = () => { drag = null; idle = 0; vel = Math.max(-60, Math.min(60, vel)); };
    draw();
    this.raf = requestAnimationFrame(tick);
  }

  stop(keep) {
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.tt) { this.tt.dispose(); this.tt = null; }
    if (!keep) { this.kind = null; this.id = null; }
  }
}
