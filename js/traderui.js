// Oberfläche des Blumenhändlers: Tages-Besonderheiten, Bestellungen, Blumenkorb, Ruf – und die Blumenbinderei (zweiter Reiter).
import * as C from './config.js';
import * as G from './game.js';
import * as I from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (src, size) => src.replace('<svg', `<svg style="width:${size}px;height:${size}px;flex:none"`);
const plain = (s) => String(s).replace(/­/g, '');
const REP_NAMES = ['Neue Kundschaft', 'Stammkundschaft', 'Lieblingsgärtnerei', 'Hoflieferant', 'Blumen-Legende'];
const GREET = ['Ah, schön dich zu sehen! Was hast du heute für mich?', 'Frische Blumen? Immer her damit!', 'Meine Kundschaft wartet schon auf deine Blüten.', 'Guten Tag! Der Karren ist leer – füll ihn mir!'];

export function pTrader(ui) {
  const s = ui.s, now = ui.api.now();
  if (s.level < C.TRADER.level) return `<div class="card center">${svg(I.cart, 80)}<h4>Der Blumenhändler kommt bald</h4><p>Ab Level ${C.TRADER.level} besucht dich ${C.TRADER.name} mit seinem Verkaufskarren.</p></div>`;
  const tabs = ui.tabs('trader', [['market', 'Händler', traderOnlyBadge(s, now)], ['florist', 'Binderei', G.floristBadge(s, now)]]);
  if ((ui.tab.trader || 'market') === 'florist') return tabs + pFlorist(ui);
  const t = G.traderInfo(s, now);
  const R = new Date(now).getDate() % GREET.length;
  let h = tabs + `<div class="card trhead"><img alt="" src="${ui.icons.animal.hedgehog}"><div class="grow"><small>${C.TRADER.name}</small><p class="say">„${GREET[R]}“</p></div></div>`;
  // Tages-Besonderheiten
  h += `<div class="sec">Heute beim Händler</div><div class="trspecials">
    <div class="card trday"><span class="trtag">${esc(t.day.name)}</span><p>${esc(t.day.desc)}</p></div>
    <div class="card trflower"><img alt="" src="${ui.icons.flower[t.flower]}"><div><span class="trtag gold">Tagesblume</span><p><b>${esc(plain(C.SEEDS[t.flower].name))}</b> bringt heute den <b>doppelten Preis</b>.</p></div></div>`;
  const o = t.offer;
  const oName = o.kind === 'deco' ? C.DECO[o.id].name : `${o.n}× ${C.ITEMS[o.id].name}`;
  const oIcon = o.kind === 'deco' ? `<img alt="" src="${ui.icons.deco[o.id]}">` : svg(I.ITEM[o.id], 56);
  h += `<div class="card troffer">${oIcon}<div class="grow"><span class="trtag pink">Tagesangebot −${Math.round(o.off * 100)} %</span><p><b>${esc(oName)}</b></p><p class="small"><s>${o.was}</s> → ${I.coin()} <b>${o.price}</b></p></div>${t.offerBought ? '<span class="okbadge">✓ Gekauft</span>' : `<button class="btn small pink" data-act="trOffer">${I.coin()} ${o.price}</button>`}</div>`;
  if (t.day.freeGift) h += `<div class="card trgift">${svg(I.gift, 52)}<div class="grow"><h4>Samstags-Geschenk</h4><p>${t.giftReady ? 'Ein kleines Dankeschön für deine Treue.' : 'Schon abgeholt – bis nächsten Samstag!'}</p></div>${t.giftReady ? '<button class="btn small" data-act="trGift">Abholen</button>' : ''}</div>`;
  h += '</div>';
  // Bestellungen
  const open = t.orders.filter((x) => !x.done).length;
  h += `<div class="sec">Bestellungen <small class="secsub">${open} offen</small></div>`;
  h += t.orders.map((od) => {
    const items = Object.entries(od.want).map(([k, q]) => {
      const have = od.special === 'shiny' ? s.basketShiny[k] || 0 : (s.basket[k] || 0) + (s.basketShiny[k] || 0);
      return `<span class="want ${have >= q ? 'ok' : ''}"><img alt="" src="${(od.special === 'shiny' ? ui.icons.shiny : ui.icons.flower)[k]}"><b>${Math.min(have, q)}/${q}</b><small>${esc(plain(C.SEEDS[k].name))}</small></span>`;
    }).join('');
    const reward = ui.chips({ coins: Math.round(od.coins * (1 + C.TRADER.repBonus[t.repLvl])), xp: od.xp, items: od.items || {} });
    const title = od.special === 'shiny' ? `${svg(I.sparkle, 18)} Sonderwunsch: Funkelblüte` : od.special === 'bred' ? `${svg(I.greenhouse, 18)} Sonderwunsch: Züchtung` : 'Bestellung';
    return `<div class="card order ${od.done ? 'done' : ''} ${od.special ? 'special' : ''}"><div class="otitle">${title}${od.done ? '<span class="okbadge">✓ Geliefert</span>' : ''}</div><div class="wants">${items}</div><div class="ofoot">${reward}${od.done ? '' : `<button class="btn small" data-act="trDeliver" data-id="${od.i}" ${od.can ? '' : 'disabled'}>Liefern</button>`}</div></div>`;
  }).join('') || '<div class="card center"><p>Heute keine Bestellungen.</p></div>';
  // Korb
  const entries = [...Object.entries(s.basketShiny).map(([k, n]) => [k, n, true]), ...Object.entries(s.basket).map(([k, n]) => [k, n, false])];
  h += `<div class="sec">Dein Blumenkorb</div><div class="card basket"><div class="row">${svg(I.basket, 48)}<div class="grow"><h4>${t.basket} / ${t.cap} Blumen</h4><div class="prog"><i style="width:${Math.min(100, (t.basket / t.cap) * 100)}%"></i></div><p class="small">Jede Ernte legt eine Blume in den Korb. ${t.basket >= t.cap ? '<b>Der Korb ist voll!</b> Verkaufe etwas, damit wieder Platz ist.' : ''}</p></div></div>
    ${basketUp(s)}
    ${entries.length ? `<div class="blist">${entries.map(([k, n, sh]) => { const p = G.sellPrice(s, k, sh, now); return `<div class="bitem">${sh ? '<i class="shy">✨</i>' : ''}<img alt="" src="${(sh ? ui.icons.shiny : ui.icons.flower)[k]}"><div class="grow"><b>${esc(plain(C.SEEDS[k].name))}${k === t.flower ? ' <span class="trtag gold mini">×2</span>' : ''}</b><small>${n}× · je ${I.coin()} ${p}</small></div><button class="btn small ghost" data-act="trSell" data-id="${k}" data-shiny="${sh ? 1 : 0}" data-n="1">1×</button>${n > 1 ? `<button class="btn small" data-act="trSell" data-id="${k}" data-shiny="${sh ? 1 : 0}" data-n="${n}">Alle · ${I.coin()} ${p * n}</button>` : ''}</div>`; }).join('')}</div>
    <button class="btn wide gold" data-act="trSellAll" style="margin-top:10px">${I.coin()} Alles verkaufen</button><p class="small center">Blumen für offene Bestellungen und Funkelblüten bleiben im Korb.</p>` : '<p class="small center" style="margin-top:8px">Noch leer – ernte Blumen im Garten.</p>'}</div>`;
  // Ruf
  const next = t.nextRep;
  h += `<div class="sec">Dein Ruf</div><div class="card rep"><div class="row"><span class="repstars">${'★'.repeat(t.repLvl + 1)}${'☆'.repeat(4 - t.repLvl)}</span><div class="grow"><h4>${REP_NAMES[t.repLvl]}</h4><p class="small">${next !== null ? `${t.rep} / ${next} Ruf-Punkte bis zur nächsten Stufe` : `${t.rep} Ruf-Punkte – höchste Stufe!`}</p>${next !== null ? `<div class="prog"><i style="width:${Math.min(100, ((t.rep - C.TRADER.rep[t.repLvl]) / (next - C.TRADER.rep[t.repLvl])) * 100)}%"></i></div>` : ''}</div></div>
    <p class="small">Jede Bestellung bringt Ruf (Sonderwünsche doppelt). Höhere Stufen: größerer Korb (+${C.TRADER.basket.at(-1) - C.TRADER.basket[0]} Plätze), bis zu +${Math.round(C.TRADER.repBonus.at(-1) * 100)} % auf alle Preise und ab Stufe 4 eine Bestellung mehr pro Tag.</p></div>`;
  // Bedarf
  h += `<div class="sec">Bedarf vom Karren</div><div class="grid3">${C.TRADER_ITEMS.map((k) => {
    const it = C.ITEMS[k], p = G.traderItemPrice(k, now), lv = s.level >= it.level;
    return `<div class="tile">${svg(I.ITEM[k], 54)}<b>${esc(it.name)}</b><small>Du hast ${s.items[k]}</small>${lv ? `<button class="btn small ${p < it.price ? 'pink' : ''}" data-act="trBuy" data-id="${k}">${I.coin()} ${p}${p < it.price ? ` <s>${it.price}</s>` : ''}</button>` : `<button class="btn small" disabled>ab Lv ${it.level}</button>`}</div>`;
  }).join('')}</div>`;
  return h;
}

function basketUp(s) {
  const u = G.nextBasket(s);
  if (!u) return `<p class="small center" style="margin:6px 0 0">${svg(I.basket, 18)} Größter Korb gekauft – alle ${C.BASKET_UPGRADES.length} Erweiterungen.</p>`;
  const step = `Stufe ${(s.basketLvl || 0) + 1} von ${C.BASKET_UPGRADES.length}`;
  return `<div class="bup"><div class="grow"><b>Korb erweitern: +${u.add} Plätze</b><small>${step}</small></div>${s.level < u.level ? `<button class="btn small" disabled>ab Lv ${u.level}</button>` : `<button class="btn small" data-act="trBasket">${I.coin()} ${u.cost.toLocaleString('de-DE')}</button>`}</div>`;
}

// ---------- Blumenbinderei ----------
const need = (ui, s, d) => Object.entries(d.need).map(([k, q]) => {
  const have = s.basket[k] || 0;
  return `<span class="want ${have >= q ? 'ok' : ''}"><img alt="" src="${ui.icons.flower[k]}"><b>${Math.min(have, q)}/${q}</b><small>${esc(plain(C.SEEDS[k].name))}</small></span>`;
}).join('');

function pFlorist(ui) {
  const s = ui.s, now = ui.api.now(), F = C.FLORIST;
  if (s.level < F.level) return `<div class="card center">${svg(I.bouquet, 80)}<h4>Die ${F.name} öffnet bald</h4><p>Ab Level ${F.level} kannst du aus den Blumen in deinem Korb Sträuße binden – die sind viel mehr wert als einzelne Blüten.</p></div>`;
  const f = G.floristInfo(s, now);
  if (!f.built) {
    const ok = s.coins >= F.cost;
    return `<div class="card center flhead">${svg(I.bouquet, 84)}<h4>Der alte Schuppen</h4><p>Neben dem Karren von ${C.TRADER.name} steht ein leerer Schuppen. Richte dort eine <b>${F.name}</b> ein:</p>
      <ul class="unl"><li>💐 ${C.BOUQUET_ORDER.length} Sträuße aus den Blumen in deinem Korb</li><li>🪙 Ein Strauß bringt doppelt so viel wie seine Blumen einzeln</li><li>📮 Täglich Strauß-Wünsche aus dem Dorf – mit Ruf beim Händler</li><li>⏱ Binden braucht etwas Zeit, bis zu ${F.slots.length} Bindeplätze</li></ul>
      <button class="btn big" data-act="flBuild" ${ok ? '' : 'disabled'}>Einrichten · ${I.coin()} ${F.cost.toLocaleString('de-DE')}</button>${ok ? '' : `<p class="small" style="color:#b3123a">Dir fehlen noch ${(F.cost - s.coins).toLocaleString('de-DE')} Münzen.</p>`}</div>` + recipes(ui, s, f, true);
  }
  // Bindeplätze
  let h = `<div class="sec">Bindetisch <small class="secsub">${f.jobs.length} / ${f.slots} belegt</small></div><div class="flslots">`;
  for (let k = 0; k < f.slots; k++) {
    const j = f.jobs[k];
    if (!j) { h += `<div class="card flslot free">${svg(I.bouquet, 40)}<div class="grow"><b>Frei</b><small>Wähle unten einen Strauß zum Binden.</small></div></div>`; continue; }
    const d = C.BOUQUETS[j.b];
    h += `<div class="card flslot ${j.ready ? 'ready' : ''}">${svg(I.bouquet, 44)}<div class="grow"><b>${esc(d.name)}</b>${j.ready ? '<small>Fertig gebunden!</small>' : `<small data-fltime="${k}">Noch ${fmt(j.remaining)}</small>`}<div class="prog"><i data-flbar="${k}" style="width:${(j.progress * 100).toFixed(1)}%"></i></div></div></div>`;
  }
  const nx = f.next;
  if (nx) h += `<div class="bup"><div class="grow"><b>Weiterer Bindeplatz</b><small>Platz ${f.slots + 1} von ${C.FLORIST.slots.length}</small></div>${s.level < nx.level ? `<button class="btn small" disabled>ab Lv ${nx.level}</button>` : `<button class="btn small" data-act="flSlot">${I.coin()} ${nx.cost.toLocaleString('de-DE')}</button>`}</div>`;
  h += '</div>';
  if (f.ready) h += `<button class="btn wide gold" data-act="flCollect" style="margin:8px 0 4px">${svg(I.bouquet, 24)} ${f.ready === 1 ? 'Strauß' : `${f.ready} Sträuße`} abholen</button>`;
  // Wünsche
  const open = f.wishes.filter((w) => !w.done).length;
  h += `<div class="sec">Strauß-Wünsche <small class="secsub">${open} offen</small></div>`;
  h += f.wishes.map((w) => {
    const d = C.BOUQUETS[w.b], have = f.stock[w.b] || 0;
    return `<div class="card order flwish ${w.done ? 'done' : ''}"><div class="otitle">${esc(w.who)} <span class="why">${esc(w.why)}</span>${w.done ? '<span class="okbadge">✓ Erfüllt</span>' : ''}</div>
      <div class="row">${svg(I.bouquet, 46)}<div class="grow"><b>${esc(d.name)}</b><small>${have ? `Im Regal: ${have}` : 'Noch keiner im Regal'}</small></div></div>
      <div class="ofoot">${ui.chips({ coins: w.coins, xp: w.xp, items: w.items || {} })}${w.done ? '' : `<button class="btn small" data-act="flWish" data-id="${w.i}" ${w.can ? '' : 'disabled'}>Liefern</button>`}</div></div>`;
  }).join('') || '<div class="card center"><p>Heute keine Wünsche.</p></div>';
  // Regal
  const stock = Object.entries(f.stock);
  h += `<div class="sec">Dein Regal <small class="secsub">${f.stockN} / ${C.FLORIST.stockMax}</small></div><div class="card basket">`;
  h += stock.length ? `<div class="blist">${stock.map(([k, n]) => { const p = G.bouquetPrice(s, k); return `<div class="bitem">${svg(I.bouquet, 40)}<div class="grow"><b>${esc(C.BOUQUETS[k].name)}</b><small>${n}× · je ${I.coin()} ${p.toLocaleString('de-DE')}</small></div><button class="btn small ghost" data-act="flSell" data-id="${k}" data-n="1">1×</button>${n > 1 ? `<button class="btn small" data-act="flSell" data-id="${k}" data-n="${n}">Alle · ${I.coin()} ${(p * n).toLocaleString('de-DE')}</button>` : ''}</div>`; }).join('')}</div><p class="small center">${C.TRADER.name} kauft jeden Strauß – für Wünsche aus dem Dorf gibt es noch mehr.</p>`
    : '<p class="small center">Noch leer – binde deinen ersten Strauß.</p>';
  h += '</div>';
  return h + recipes(ui, s, f, false);
}

function recipes(ui, s, f, preview) {
  let h = `<div class="sec">Straußbuch <small class="secsub">Blumen aus deinem Korb</small></div><p class="small center">Funkelblüten werden nie verbunden – die bleiben für Sonderwünsche im Korb.</p>`;
  h += f.recipes.map((r) => {
    let btn;
    if (r.locked) btn = `<button class="btn small" disabled>ab Lv ${r.level}</button>`;
    else if (preview) btn = '';
    else if (!f.free) btn = '<button class="btn small" disabled>Tisch belegt</button>';
    else btn = `<button class="btn small ${r.can ? '' : 'ghost'}" data-act="flBind" data-id="${r.id}" ${r.can ? '' : 'disabled'}>Binden · ${fmt(r.ms)}</button>`;
    return `<div class="card order flrecipe ${r.locked ? 'locked' : ''}"><div class="otitle">${svg(I.bouquet, 22)} ${esc(r.name)}</div><p class="small">${esc(r.desc)}</p><div class="wants">${need(ui, s, r)}</div>
      <div class="ofoot"><span class="small">Wert ${I.coin()} <b>${r.price.toLocaleString('de-DE')}</b> · +${r.xp} EP · ${fmt(r.ms)}</span>${btn}</div></div>`;
  }).join('');
  return h;
}

// Restzeiten im offenen Reiter auffrischen, ohne die Liste neu zu zeichnen
export function tickFlorist(ui) {
  if (ui.panel !== 'trader' || ui.tab.trader !== 'florist') return;
  const now = ui.api.now();
  ui.s.florist.jobs.forEach((j, k) => {
    const t = document.querySelector(`[data-fltime="${k}"]`), b = document.querySelector(`[data-flbar="${k}"]`);
    const txt = `Noch ${fmt(Math.max(0, j.start + j.dur - now))}`;
    if (t && t.textContent !== txt) t.textContent = txt;
    if (b) b.style.width = (Math.min(1, (now - j.start) / j.dur) * 100).toFixed(1) + '%';
  });
}

function fmt(ms) {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec} s`;
  const m = Math.ceil(sec / 60);
  if (m < 60) return `${m} Min.`;
  return `${Math.floor(m / 60)} Std. ${m % 60 ? `${m % 60} Min.` : ''}`.trim();
}

export const TRADER_ACTS = new Set(['trBasket', 'trDeliver', 'trSell', 'trSellAll', 'trOffer', 'trGift', 'trBuy', 'flBuild', 'flSlot', 'flBind', 'flCollect', 'flSell', 'flWish']);

export function onTraderAct(ui, a, el) {
  const A = ui.api.act, id = el.dataset.id;
  switch (a) {
    case 'trBasket': A.trBasket(); break;
    case 'trDeliver': A.trDeliver(+id); break;
    case 'trSell': A.trSell(id, el.dataset.shiny === '1', +el.dataset.n || 1); break;
    case 'trSellAll': A.trSellAll(); break;
    case 'trOffer': A.trOffer(); break;
    case 'trGift': A.trGift(); break;
    case 'trBuy': A.trBuy(id); break;
    case 'flBuild': A.flBuild(); break;
    case 'flSlot': A.flSlot(); break;
    case 'flBind': A.flBind(id); break;
    case 'flCollect': A.flCollect(); break;
    case 'flSell': A.flSell(id, +el.dataset.n || 1); break;
    case 'flWish': A.flWish(+id); break;
  }
}

// Abzeichen am Händler-Knopf: lieferbare Bestellungen + Geschenk + fertige Sträuße und erfüllbare Wünsche
function traderOnlyBadge(s, now) {
  const t = G.traderInfo(s, now);
  return t.orders.filter((o) => o.can).length + (t.giftReady ? 1 : 0) + (t.basket >= t.cap ? 1 : 0);
}
export function traderBadge(s, now) {
  if (s.level < C.TRADER.level) return 0;
  return traderOnlyBadge(s, now) + G.floristBadge(s, now);
}
