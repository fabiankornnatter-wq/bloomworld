// Oberfläche der Gartenhelfer: freispielen, rufen, Wirkdauer und Abklingzeit.
import * as C from './config.js';
import * as G from './game.js';
import * as I from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (src, size) => src.replace('<svg', `<svg style="width:${size}px;height:${size}px;flex:none"`);
const num = (n) => n.toLocaleString('de-DE');

// 1:05:09 / 12:34 / 0:45
export function clock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
const dur = (ms) => { const m = Math.round(ms / 60_000); return m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ''}` : `${m} Min.`; };

export function pHelpers(ui) {
  const s = ui.s, now = ui.api.now();
  let h = `<div class="card row">${svg(I.gnome, 54)}<div class="grow"><h4>Deine Gartenhelfer</h4><p class="small">Ruf einen Helfer, und er packt eine Weile mit an. Danach braucht er eine Pause. Jeder Einsatz macht ihn erfahrener: <b>länger im Einsatz, kürzere Pause</b>.</p></div></div>`;
  for (const x of G.helperInfo(s, now)) {
    const stars = `<span class="hstars">${'★'.repeat(x.lvl)}${'☆'.repeat(x.maxLvl - x.lvl)}</span>`;
    let state, btn = '';
    if (!x.owned) {
      if (s.level < x.level) { state = `<small>Ab Level ${x.level}</small>`; btn = `<button class="btn small" disabled>ab Lv ${x.level}</button>`; }
      else { state = '<small>Bereit zum Freispielen</small>'; btn = `<button class="btn small" data-act="helperUnlock" data-id="${x.id}" ${s.coins >= x.cost ? '' : 'disabled'}>${I.coin()} ${num(x.cost)}</button>`; }
    } else if (x.active) {
      state = `<small class="hon">Im Einsatz · noch <b data-hleft="${x.id}">${clock(x.left)}</b></small><div class="prog"><i data-hbar="${x.id}" style="width:${((x.left / x.dur) * 100).toFixed(1)}%"></i></div>`;
    } else if (x.cooling) {
      state = `<small>Macht Pause · wieder bereit in <b data-hcd="${x.id}">${clock(x.cdLeft)}</b></small>`;
      btn = '<button class="btn small" disabled>Pause</button>';
    } else {
      state = '<small class="hready">Bereit!</small>';
      btn = `<button class="btn small gold" data-act="helperCall" data-id="${x.id}">Rufen</button>`;
    }
    const next = x.owned ? (x.nextAt !== null ? `Stufe ${x.lvl + 1} nach ${x.nextAt - x.uses} weiteren Einsätzen` : 'Höchste Stufe erreicht') : '';
    h += `<div class="card helper ${x.active ? 'active' : ''} ${x.owned ? '' : 'locked'}"><div class="hrow">${svg(I.helperIcon[x.id], 62)}<div class="grow"><span class="trtag">${esc(x.role)}</span><h4>${esc(x.name)} ${x.owned ? stars : ''}</h4>${state}</div>${btn}</div>
      <p class="small">${esc(x.desc)}</p><p class="small hmeta">⏱ ${dur(x.dur)} im Einsatz · 💤 ${dur(x.cd)} Pause${next ? ` · ${next}` : ''}</p></div>`;
  }
  return h;
}

// Restzeiten im offenen Fenster auffrischen
export function tickHelpers(ui) {
  if (ui.panel !== 'helpers') return;
  for (const x of G.helperInfo(ui.s, ui.api.now())) {
    const l = document.querySelector(`[data-hleft="${x.id}"]`), b = document.querySelector(`[data-hbar="${x.id}"]`), c = document.querySelector(`[data-hcd="${x.id}"]`);
    if ((l && !x.active) || (c && !x.cooling)) { ui.renderPanel(true); return; }
    if (l) l.textContent = clock(x.left);
    if (b) b.style.width = ((x.left / x.dur) * 100).toFixed(1) + '%';
    if (c) c.textContent = clock(x.cdLeft);
  }
}

// Seitenknopf: Abzeichen (bereite Helfer) und Restzeit des aktiven Helfers
export function helperButton(ui) {
  const s = ui.s, now = ui.api.now(), btn = document.getElementById('helperBtn');
  if (!btn) return;
  btn.hidden = s.level < C.HELPERS.bee.level && !C.HELPER_ORDER.some((k) => s.helpers[k].owned);
  const act = G.activeHelpers(s, now).sort((a, b) => b.left - a.left)[0];
  const label = act ? clock(act.left) : 'Helfer';
  const span = btn.querySelector('span'); if (span.textContent !== label) span.textContent = label;
  btn.classList.toggle('busy', !!act);
  const icon = act ? act.id : 'gnome';
  if (btn.dataset.icon !== icon) { btn.dataset.icon = icon; btn.querySelector('svg')?.remove(); btn.insertAdjacentHTML('afterbegin', I.helperIcon[icon]); }
  const n = G.helpersReady(s, now) + C.HELPER_ORDER.filter((k) => !s.helpers[k].owned && s.level >= C.HELPERS[k].level).length;
  const b = document.getElementById('helperBadge'); b.textContent = n || ''; b.hidden = !n;
}

export const HELPER_ACTS = new Set(['helperUnlock', 'helperCall']);
export function onHelperAct(ui, a, el) {
  if (a === 'helperUnlock') ui.api.act.helperUnlock(el.dataset.id);
  else if (a === 'helperCall') ui.api.act.helperCall(el.dataset.id);
}
