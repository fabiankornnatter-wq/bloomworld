// Tauschbörse: Samen von Event-Blumen anbieten, tauschen und verschenken.
import * as C from './config.js';
import * as G from './game.js';
import * as I from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (src, size) => src.replace('<svg', `<svg style="width:${size}px;height:${size}px;flex:none"`);
const plain = (s) => String(s).replace(/­/g, '');
const name = (k) => plain(C.SEEDS[k]?.name || k);
const evName = (k) => C.EVENTS.find((e) => e.id === C.SEEDS[k]?.event)?.name || '';

// Angebote im Zwischenspeicher (werden beim Öffnen und nach jeder Aktion geladen)
export const tradeState = { offers: null, open: 0, scope: 'all', loading: false, error: '', loadedAt: 0 };

export async function loadTrades(ui, force) {
  const hub = ui.api.social?.();
  if (!hub || tradeState.loading) return;
  if (!force && Date.now() - tradeState.loadedAt < 15_000) return;
  tradeState.loading = true; tradeState.error = '';
  try {
    const r = await hub.act('trades', tradeState.scope);
    if (r.ok) { tradeState.offers = r.offers; tradeState.open = r.open; tradeState.loadedAt = Date.now(); }
    else tradeState.error = r.message || 'Die Tauschbörse ist gerade nicht erreichbar.';
  } catch { tradeState.error = 'Die Tauschbörse ist gerade nicht erreichbar.'; }
  tradeState.loading = false;
  if (ui.panel === 'trade') ui.renderPanel(true);
}

const seedImg = (ui, k, size = 44) => `<img alt="" src="${ui.icons.flower[k]}" style="width:${size}px;height:${size}px;background:${ui.icons.flowerBg[k]};border-radius:50%">`;

export function pTrade(ui) {
  const s = ui.s, acc = ui.api.account(), hub = ui.api.social?.();
  const bag = G.seedList(s);
  let h = `<div class="card tips trintro">${svg(I.cart, 40)}<div><h4>Samen tauschen</h4><p>Event-Blumen bringen während ihres Events Samen (jede ${C.SEED_EVERY}. Ernte, Funkelblüten doppelt; Samenpakete im Event-Shop). Mit Samen kannst du die Blume <b>jederzeit</b> säen – auch nach dem Event. Hier tauschst du Samen mit anderen Gärtnern, damit dein Album voll wird.</p></div></div>`;
  h += `<div class="sec">Dein Samenbeutel</div>`;
  h += bag.length ? `<div class="seedbag">${bag.map((x) => `<div class="seedchip">${seedImg(ui, x.id, 40)}<b>${x.n}×</b><small>${esc(name(x.id))}</small></div>`).join('')}</div>`
    : `<div class="card center"><p>Noch keine Samen. Säe und ernte die Event-Blume des laufenden Events, dann füllt sich der Beutel.</p></div>`;
  if (!acc.user || !hub) return h + `<div class="card row">${svg(I.user, 54)}<div class="grow"><h4>Offline-Modus</h4><p>Zum Tauschen brauchst du ein Konto – dann siehst du die Angebote aller Gärtner.</p></div><button class="btn small" data-act="login">Anmelden</button></div>`;
  // Angebot erstellen
  const wants = C.EVENT_SEEDS.map((k) => `<option value="${k}">${esc(name(k))} (${esc(evName(k))})</option>`).join('');
  h += `<form class="card tradeform" data-form="tradeOffer" autocomplete="off"><div class="lab">${svg(I.gift, 24)} Neues Tauschangebot</div>
    <div class="trrow"><label class="fld"><span>Ich gebe</span><select name="give" ${bag.length ? '' : 'disabled'}>${bag.map((x) => `<option value="${x.id}">${esc(name(x.id))} (${x.n} im Beutel)</option>`).join('') || '<option>– keine Samen –</option>'}</select></label><label class="fld num"><span>Anzahl</span><input name="giveN" type="number" min="1" max="${C.TRADE.maxN}" value="1" inputmode="numeric"></label></div>
    <div class="trrow"><label class="fld"><span>Ich suche</span><select name="want">${wants}</select></label><label class="fld num"><span>Anzahl</span><input name="wantN" type="number" min="1" max="${C.TRADE.maxN}" value="1" inputmode="numeric"></label></div>
    <label class="chk"><input type="checkbox" name="friendsOnly"> Nur für meine Freunde sichtbar</label>
    <p class="note">Deine Samen werden so lange zurückgelegt, bis jemand annimmt oder du das Angebot zurückziehst (spätestens nach ${C.TRADE.days} Tagen kommen sie zurück). Offene Angebote: ${tradeState.open} von ${C.TRADE.maxOpen}.</p>
    <button class="btn" type="submit" ${bag.length ? '' : 'disabled'}>Angebot einstellen</button></form>`;
  // Angebote
  h += `<div class="sec">Angebote <span class="seg small"><button class="${tradeState.scope === 'all' ? 'on' : ''}" data-act="tradeScope" data-id="all">Alle</button><button class="${tradeState.scope === 'friends' ? 'on' : ''}" data-act="tradeScope" data-id="friends">Freunde</button></span></div>`;
  if (tradeState.error) h += `<div class="card center"><p>${esc(tradeState.error)}</p><button class="btn small" data-act="tradeReload">Erneut laden</button></div>`;
  else if (!tradeState.offers) h += `<div class="card center"><p>Angebote werden geladen …</p></div>`;
  else if (!tradeState.offers.length) h += `<div class="card center">${svg(I.cart, 60)}<h4>Noch keine Angebote</h4><p>Sei der Erste – oder frag deine Freunde, welche Samen sie übrig haben.</p></div>`;
  else h += tradeState.offers.map((o) => {
    const can = G.tradeAcceptCheck(s, o);
    return `<div class="card trade ${o.mine ? 'mine' : ''}"><div class="trline"><span class="trside">${seedImg(ui, o.give)}<b>${o.giveN}× ${esc(name(o.give))}</b></span><span class="arrow">⇄</span><span class="trside">${seedImg(ui, o.want)}<b>${o.wantN}× ${esc(name(o.want))}</b></span></div>
      <div class="trmeta"><small>${o.mine ? 'Dein Angebot' : `von ${esc(o.name)}`}${o.friendsOnly ? ' · nur Freunde' : ''} · ${new Date(o.ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</small>
      ${o.mine ? `<button class="btn small ghost" data-act="tradeCancel" data-id="${esc(o.id)}">Zurückziehen</button>` : `<button class="btn small" data-act="tradeAccept" data-id="${esc(o.id)}" ${can.ok ? '' : 'disabled'} title="${can.ok ? '' : esc(can.message || '')}">Tauschen</button>`}</div>
      ${!o.mine && !can.ok ? `<p class="note">${esc(can.message || '')}</p>` : ''}</div>`;
  }).join('');
  h += `<p class="note">Freunden kannst du Samen auch direkt schenken: Freunde → Schenken → Samen.</p>`;
  return h;
}

export const TRADE_ACTS = new Set(['tradeScope', 'tradeReload', 'tradeCancel', 'tradeAccept', 'openTrade', 'sendSeeds']);

export async function onTradeAct(ui, a, el) {
  const hub = ui.api.social?.(), id = el.dataset.id, s = ui.s;
  const fail = (r) => { ui.api.sound.play('error'); ui.toast(r?.message || 'Das hat nicht geklappt.', 'err'); };
  switch (a) {
    case 'openTrade': ui.nav('trade'); return true;
    case 'tradeScope': tradeState.scope = id; tradeState.loadedAt = 0; ui.renderPanel(true); loadTrades(ui, true); return true;
    case 'tradeReload': loadTrades(ui, true); return true;
    case 'tradeCancel': {
      el.disabled = true;
      const r = await hub.act('tradeCancel', id);
      if (r.ok) { G.addSeeds(s, { [r.offer.give]: r.offer.giveN }); ui.api.act.afterTrade(); ui.toast('Angebot zurückgezogen – die Samen sind wieder im Beutel.', 'good'); }
      else if (r.code === 'gone') { ui.toast('Das Angebot wurde gerade angenommen – die Samen kommen gleich per Nachricht.', ''); }
      else fail(r);
      loadTrades(ui, true); return true;
    }
    case 'tradeAccept': {
      const o = tradeState.offers?.find((x) => x.id === id);
      const c = G.tradeAcceptCheck(s, o);
      if (!c.ok) { fail(c); return true; }
      el.disabled = true;
      const r = await hub.act('tradeAccept', id);
      if (r.ok) { G.tradeComplete(s, r.offer, false); ui.api.act.afterTrade(); ui.api.sound.play('buy'); ui.toast(`🔄 Getauscht! ${r.offer.giveN}× ${name(r.offer.give)}-Samen sind jetzt in deinem Beutel.`, 'good'); }
      else fail(r);
      loadTrades(ui, true); return true;
    }
    case 'sendSeeds': {
      const seed = el.dataset.seed, n = Math.max(1, Math.min(C.TRADE.maxN, Number(el.dataset.n) || 1));
      if (G.seedCount(s, seed) < n) { fail({ message: 'So viele Samen hast du nicht.' }); return true; }
      ui.closeModal();
      const r = await hub.act('seedGift', id, seed, n);
      if (r.ok) { G.takeSeeds(s, seed, n); ui.api.act.afterTrade(); ui.api.sound.play('buy'); ui.toast(`🌱 ${n}× ${name(seed)}-Samen an ${esc(hub.friend(id)?.name || 'deinen Freund')} geschickt!`, 'good'); }
      else fail(r);
      ui.renderPanel(true); return true;
    }
  }
  return false;
}

export async function onTradeForm(ui, form) {
  const hub = ui.api.social?.(), s = ui.s;
  const give = form.give.value, want = form.want.value, giveN = Number(form.giveN.value), wantN = Number(form.wantN.value), friendsOnly = form.friendsOnly.checked;
  const c = G.tradeOfferCheck(s, give, giveN, want, wantN, tradeState.open);
  if (!c.ok) { ui.api.sound.play('error'); ui.toast(c.message, 'err'); return; }
  const btn = form.querySelector('[type=submit]'); btn.disabled = true;
  const r = await hub.act('tradeOffer', { give: c.give, giveN: c.giveN, want: c.want, wantN: c.wantN, friendsOnly });
  btn.disabled = false;
  if (r.ok) { G.tradeReserve(s, c.give, c.giveN); ui.api.act.afterTrade(); ui.api.sound.play('buy'); ui.toast('Angebot eingestellt! Du bekommst eine Nachricht, sobald jemand tauscht.', 'good'); }
  else { ui.api.sound.play('error'); ui.toast(r.message || 'Das hat nicht geklappt.', 'err'); }
  loadTrades(ui, true);
}

// Samen-Geschenk im Geschenk-Dialog
export function seedGiftOptions(ui, id) {
  const bag = G.seedList(ui.s);
  if (!bag.length) return '';
  return `<div class="sec">Samen schenken</div><div class="giftopts">${bag.map((x) => `<button class="giftopt" data-act="sendSeeds" data-id="${id}" data-seed="${x.id}" data-n="1">${seedImg(ui, x.id, 50)}<b>1× ${esc(name(x.id))}-Samen</b><small>Du hast ${x.n}. Samen sind unbegrenzt verschenkbar.</small></button>`).join('')}</div>`;
}
