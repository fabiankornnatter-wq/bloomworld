// Oberfläche für Freunde, Chat, Gartenbesuche und den Admin-Bereich.
import * as C from './config.js';
import * as I from './icons.js';
import { adminApi, socialApi } from './social.js';
import { AGB_TEXT, PRIVACY_TEXT, IMPRESSUM_TEXT } from './legaltexts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (src, size) => src.replace('<svg', `<svg style="width:${size}px;height:${size}px;flex:none"`);
const COLORS = ['#ff7cbd', '#9b6df0', '#5ab4ff', '#3fc28b', '#ffb03b', '#ff6a6a', '#2fb5b0', '#c86bd8'];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const avatar = (u, size = 44) => `<span class="avatar" style="--a:${COLORS[hash(u.id || u.name) % COLORS.length]};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px">${esc((u.name || '?').trim().charAt(0).toUpperCase())}</span>`;
const fmtClock = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function dayLabel(ts) {
  const d = new Date(ts), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Heute';
  if (d.toDateString() === y.toDateString()) return 'Gestern';
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}
const NEWS_KIND = { news: ['Neuigkeit', I.megaphone, '#ff7cbd'], update: ['Update', I.sparkle, '#9b6df0'], event: ['Event', I.gift, '#3fc28b'], maintenance: ['Wartung', I.gear, '#ffb03b'] };

// ---------- Freunde ----------
export function pFriends(ui) {
  const acc = ui.api.account(), hub = ui.api.social?.();
  if (!acc.user || !hub) {
    return `<div class="card row">${svg(I.user, 54)}<div class="grow"><h4>Offline-Modus</h4><p>Mit einem Konto kannst du Freunde finden, mit ihnen schreiben, Geschenke schicken und ihre Gärten besuchen.</p></div><button class="btn small" data-act="login">Anmelden</button></div>` + howTo();
  }
  const d = hub.data;
  let h = `<div class="card frme">${avatar({ id: acc.user.id, name: acc.user.name }, 54)}<div class="grow"><small>Dein Spielername</small><h4>${esc(acc.user.name)}</h4><p>Unter diesem Namen finden dich deine Freunde.</p></div><button class="btn small blue" data-act="share">Teilen</button></div>
    <form class="card addf" data-form="addFriend" autocomplete="off"><label class="fld"><span>Freund hinzufügen</span><input name="fname" maxlength="20" placeholder="Spielername eingeben" enterkeyhint="send" autocapitalize="off" spellcheck="false"></label><button class="btn" type="submit">Anfrage senden</button></form>`;
  if (!d) return h + `<div class="card center"><p>${hub.error ? esc(hub.error) : 'Freunde werden geladen …'}</p>${hub.error ? '<button class="btn small" data-act="socialRetry">Erneut versuchen</button>' : ''}</div>`;
  if (d.chatBanned) h += `<div class="card warn">${svg(I.shield, 36)}<p>Dein Chat ist wegen eines Regelverstoßes gesperrt. Geschenke und Gartenbesuche gehen weiterhin.</p></div>`;
  if (d.incoming.length) {
    h += `<div class="sec">Freundschaftsanfragen <i class="dot">${d.incoming.length}</i></div>` + d.incoming.map((f) => `<div class="card frow">${avatar(f)}<div class="grow"><h4>${esc(f.name)}</h4><small>Level ${f.level}</small></div><button class="btn small" data-act="frAccept" data-id="${f.id}">Annehmen</button><button class="btn small ghost" data-act="frDecline" data-id="${f.id}" aria-label="Ablehnen">✕</button></div>`).join('');
  }
  h += `<div class="sec">Deine Freunde${d.friends.length ? ` (${d.friends.length})` : ''}</div>`;
  if (!d.friends.length) h += `<div class="card center">${svg(I.NAV.friends, 72)}<h4>Noch keine Freunde</h4><p>Frag deine Freunde nach ihrem Spielernamen und schick ihnen oben eine Anfrage – oder teile deinen Namen.</p></div>`;
  h += d.friends.map((f) => `<div class="card friend">
      <div class="frow">${avatar(f)}<div class="grow"><h4>${esc(f.name)}</h4><small><i class="odot ${f.online ? 'on' : ''}"></i>${f.online ? 'Online' : 'Offline'} · Level ${f.level}</small></div><button class="more" data-act="frMenu" data-id="${f.id}" aria-label="Mehr">⋯</button></div>
      <div class="fbtns">
        <button class="btn small blue" data-act="openChat" data-id="${f.id}">${svg(I.chat, 22)} Chat${f.unread ? `<i class="dot">${f.unread}</i>` : ''}</button>
        <button class="btn small" data-act="visit" data-id="${f.id}">${svg(I.house, 22)} Besuchen</button>
        <button class="btn small pink" data-act="giftMenu" data-id="${f.id}" ${f.gifted ? 'disabled' : ''}>${svg(I.gift, 22)} ${f.gifted ? 'Geschenkt ✓' : 'Schenken'}</button>
      </div></div>`).join('');
  if (d.outgoing.length) h += `<div class="sec">Gesendete Anfragen</div>` + d.outgoing.map((f) => `<div class="card frow">${avatar(f, 36)}<div class="grow"><h4>${esc(f.name)}</h4><small>wartet auf Antwort</small></div><button class="btn small ghost" data-act="frCancel" data-id="${f.id}">Zurückziehen</button></div>`).join('');
  if (d.blocked.length) h += `<div class="sec">Blockiert</div>` + d.blocked.map((f) => `<div class="card frow">${avatar(f, 36)}<div class="grow"><h4>${esc(f.name)}</h4></div><button class="btn small ghost" data-act="frUnblock" data-id="${f.id}">Aufheben</button></div>`).join('');
  return h + howTo();
}

const howTo = () => `<div class="card tips"><h4>So hilft man sich in BloomWorld</h4>
  <p>${svg(I.gift, 22)} Jedem Freund einmal am Tag etwas schenken: Regenwolke, Dünger oder Kompost.</p>
  <p>${svg(I.drop, 22)} Beim Besuch bis zu ${C.HELP.perDay} durstige Blumen gießen – du bekommst je ${C.HELP.coins} Münzen.</p>
  <p>${svg(I.heart, 22)} „Gefällt mir“ schenkt deinem Freund ${C.LIKE.coins} Münzen.</p>
  <p>${svg(I.shield, 22)} Schreiben können nur bestätigte Freunde. Links und Telefonnummern werden ausgeblendet. Unpassende Nachrichten kannst du melden.</p></div>`;

export function giftDialog(ui, id) {
  const f = ui.api.social().friend(id);
  if (!f) return;
  ui.modal({ title: 'Geschenk schicken', cls: 'giftdlg', html: `<p>Was möchtest du <b>${esc(f.name)}</b> schenken? Es kostet dich nichts – einmal am Tag pro Freund.</p>
    <div class="giftopts">${Object.entries(C.GIFTS).map(([k, g]) => `<button class="giftopt" data-act="sendGift" data-id="${id}" data-kind="${k}">${svg(I.ITEM[g.item], 54)}<b>${esc(g.label)}</b><small>${esc(C.ITEMS[g.item].desc)}</small></button>`).join('')}</div>`, buttons: [['Abbrechen', 'closeModal', 'ghost']] });
}

export function friendMenu(ui, id) {
  const f = ui.api.social().friend(id);
  if (!f) return;
  ui.modal({ title: f.name, html: `${avatar(f, 70)}<p>Level ${f.level} · ${f.online ? 'gerade online' : 'offline'}</p>`, buttons: [['Garten besuchen', 'visit', '', `data-id="${id}"`], ['Als Freund entfernen', 'frRemove', 'ghost', `data-id="${id}"`], ['Blockieren', 'frBlock', 'red', `data-id="${id}"`]] });
}

// ---------- Chat ----------
export function chatTitle(ui) { return esc(ui.api.social()?.chat?.name || 'Chat'); }

export function pChat(ui) {
  const hub = ui.api.social(), c = hub?.chat;
  if (!c) return '<div class="card center"><p>Kein Chat geöffnet.</p></div>';
  const f = hub.friend(c.id) || { id: c.id, name: c.name };
  const banned = hub.data?.chatBanned;
  return `<div class="chatwrap">
    <div class="chathead">${avatar(f, 40)}<div class="grow"><b>${esc(f.name)}</b><small id="chatOnline"><i class="odot ${c.online ? 'on' : ''}"></i>${c.online ? 'Online' : 'Offline'}</small></div>
      <button class="btn small" data-act="visit" data-id="${c.id}" aria-label="Garten besuchen">${svg(I.house, 22)}</button>
      <button class="btn small pink" data-act="giftMenu" data-id="${c.id}" aria-label="Geschenk schicken" ${f.gifted ? 'disabled' : ''}>${svg(I.gift, 22)}</button></div>
    <div class="chatlist" id="chatList">${chatMessages(ui)}</div>
    ${banned ? '<div class="chatbar banned">Dein Chat ist gesperrt.</div>' : `<form class="chatbar" data-form="chat" autocomplete="off"><input name="msg" maxlength="300" placeholder="Nachricht schreiben …" enterkeyhint="send" aria-label="Nachricht"><button class="btn send" type="submit" aria-label="Senden">${svg(I.sendIcon, 22)}</button></form>`}
  </div>`;
}

export function chatMessages(ui) {
  const hub = ui.api.social(), c = hub?.chat, me = ui.api.account().user;
  if (!c) return '';
  if (!c.loaded) return '<p class="chatempty">Nachrichten werden geladen …</p>';
  if (c.error && !c.msgs.length) return `<p class="chatempty">${esc(c.error)}</p>`;
  if (!c.msgs.length) return `<p class="chatempty">Sag ${esc(c.name)} Hallo! 👋</p>`;
  let lastDay = '';
  return c.msgs.map((m) => {
    const day = dayLabel(m.ts);
    const sep = day !== lastDay ? `<div class="chatday">${day}</div>` : '';
    lastDay = day;
    const mine = m.f === me?.id;
    if (m.k === 'msg') {
      return `${sep}<div class="msg ${mine ? 'mine' : ''}"><div class="bubble">${esc(m.t)}<time>${fmtClock(m.ts)}</time></div>${mine ? '' : `<button class="rep" data-act="reportMsg" data-id="${esc(m.i)}" aria-label="Nachricht melden" title="Melden">${svg(I.flag, 14)}</button>`}</div>`;
    }
    let t;
    const n = Number(m.x) || 1;
    if (m.k === 'gift') t = mine ? `Du hast ${esc(c.name)} ${esc(C.GIFTS[m.x]?.label || 'etwas')} geschenkt.` : `${esc(c.name)} hat dir ${esc(C.GIFTS[m.x]?.label || 'etwas')} geschenkt.`;
    else if (m.k === 'help') t = mine ? `Du hast ${n === 1 ? 'eine Blume' : `${n} Blumen`} bei ${esc(c.name)} gegossen.` : `${esc(c.name)} hat ${n === 1 ? 'eine Blume' : `${n} Blumen`} in deinem Garten gegossen.`;
    else if (m.k === 'like') t = mine ? `Dir gefällt der Garten von ${esc(c.name)}.` : `${esc(c.name)} findet deinen Garten wunderschön!`;
    else t = esc(m.t);
    const icon = { gift: I.gift, help: I.drop, like: I.heart }[m.k] || I.sparkle;
    return `${sep}<div class="msg sys"><span>${svg(icon, 18)} ${t}</span></div>`;
  }).join('');
}

// Liste neu zeichnen, ohne das Eingabefeld anzufassen
export function updateChat(ui, info = {}) {
  const list = document.getElementById('chatList');
  if (!list) return;
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  list.innerHTML = chatMessages(ui);
  const c = ui.api.social()?.chat;
  const on = document.getElementById('chatOnline');
  if (on && c) on.innerHTML = `<i class="odot ${c.online ? 'on' : ''}"></i>${c.online ? 'Online' : 'Offline'}`;
  if (info.first || info.mine || nearBottom) list.scrollTop = list.scrollHeight;
}

// ---------- Neuigkeiten für alle ----------
export function newsCard(n, full = true) {
  const [label, icon, color] = NEWS_KIND[n.kind] || NEWS_KIND.news;
  return `<div class="card news" style="--nc:${color}"><div class="nhead">${svg(icon, 26)}<span class="nkind">${label}</span><time>${new Date(n.ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</time></div><h4>${esc(n.title)}</h4>${full ? `<p>${esc(n.text).replace(/\n/g, '<br>')}</p>` : ''}</div>`;
}

// ---------- Admin ----------
export function pAdmin(ui) {
  const cur = ui.tab.admin || 'news', d = ui.adminData;
  let h = `<div class="admtabs">${[['news', 'News'], ['gifts', 'Geschenke'], ['support', 'Spieler'], ['tools', 'Events & Wartung'], ['legal', 'Rechtliches'], ['feedback', `Feedback${d?.feedback?.length ? ` (${d.feedback.length})` : ''}`], ['reports', `Meldungen${d?.reports?.length ? ` (${d.reports.length})` : ''}`], ['players', 'Statistik'], ['push', 'Push'], ['log', 'Protokoll']].map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" data-act="tab" data-panel="admin" data-id="${k}">${l}</button>`).join('')}</div>`;
  if (!d) {
    if (!ui.adminLoading) loadAdmin(ui);
    return h + `<div class="card center"><p>${ui.adminError ? esc(ui.adminError) : 'Wird geladen …'}</p>${ui.adminError ? '<button class="btn small" data-act="adminReload">Erneut laden</button>' : ''}</div>`;
  }
  if (cur === 'news') {
    h += `<form class="card adminform" data-form="news" autocomplete="off">
      <h4>${svg(I.megaphone, 28)} Neue Ankündigung</h4>
      <div class="seg small kinds">${Object.entries(NEWS_KIND).map(([k, [l]], i) => `<label><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <label class="fld"><span>Titel</span><input name="title" maxlength="70" required placeholder="z. B. Neues Update: Freunde & Chat"></label>
      <label class="fld"><span>Text</span><textarea name="text" maxlength="1200" rows="5" required placeholder="Was gibt es Neues?"></textarea></label>
      <p class="small">Alle Spieler sehen die Ankündigung beim nächsten Öffnen des Spiels und unter „Events“.</p>
      <button class="btn wide" type="submit">Veröffentlichen</button></form>`;
    h += `<div class="sec">Veröffentlicht (${d.news.length})</div>` + (d.news.length ? d.news.map((n) => `${newsCard(n)}<div class="btnrow right"><button class="btn small ghost" data-act="adminDelNews" data-id="${esc(n.id)}">Löschen</button></div>`).join('') : '<div class="card center"><p>Noch keine Ankündigungen.</p></div>');
  } else if (cur === 'gifts') {
    const itemInputs = ['fert', 'rain', 'compost', 'turbo', 'lucky', 'pollen', 'boost'].map((k) => `<label class="iin">${svg(I.ITEM[k], 30)}<input type="number" name="i_${k}" min="0" max="50" placeholder="0" aria-label="${esc(C.ITEMS[k].name)}"></label>`).join('');
    h += `<form class="card adminform" data-form="giftAll" autocomplete="off"><h4>${svg(I.gift, 28)} Geschenk an alle Spieler</h4>
      <p class="small">Jeder Spieler mit Konto bekommt es beim nächsten Öffnen (z. B. als Entschuldigung nach einer Störung oder zum Feiern).</p>
      <label class="fld"><span>Titel</span><input name="title" maxlength="60" placeholder="z. B. Danke fürs Spielen!"></label>
      <label class="fld"><span>Münzen</span><input type="number" name="coins" min="0" max="5000" placeholder="0"></label>
      <div class="iinputs">${itemInputs}</div>
      <button class="btn wide pink" type="submit">An alle verschicken</button></form>`;
    h += d.gifts.length ? `<div class="sec">Verschickt</div>` + d.gifts.map((g) => `<div class="card"><small>${new Date(g.ts).toLocaleString('de-DE')}</small><h4>${esc(g.title)}</h4>${ui.chips({ coins: g.coins, items: g.items })}</div>`).join('') : '';
    h += `<form class="card adminform" data-form="createCode" autocomplete="off"><h4>${svg(I.sparkle, 28)} Gutscheincode erstellen</h4>
      <p class="small">Zum Teilen auf Social Media. Spieler lösen ihn in den Einstellungen ein – jeder nur einmal.</p>
      <label class="fld"><span>Code</span><input name="code" maxlength="20" placeholder="z. B. HERBST2026" autocapitalize="characters" spellcheck="false"></label>
      <div class="grid2"><label class="fld"><span>Wie oft einlösbar</span><input type="number" name="max" min="1" max="100000" value="100"></label><label class="fld"><span>Gültig (Tage, 0 = immer)</span><input type="number" name="days" min="0" max="365" value="14"></label></div>
      <label class="fld"><span>Münzen</span><input type="number" name="coins" min="0" max="5000" placeholder="0"></label>
      <div class="iinputs">${itemInputs}</div>
      <button class="btn wide" type="submit">Code erstellen</button></form>`;
    h += d.codes.length ? `<div class="sec">Gutscheine</div>` + d.codes.map((c) => `<div class="card frow"><div class="grow"><h4 class="code">${esc(c.code)}</h4><small>${c.used} / ${c.max} eingelöst · ${c.until ? (Date.now() > c.until ? 'abgelaufen' : `bis ${new Date(c.until).toLocaleDateString('de-DE')}`) : 'unbegrenzt'}</small>${ui.chips({ coins: c.coins, items: c.items })}</div><button class="btn small ghost" data-act="adminDelCode" data-id="${esc(c.code)}">Löschen</button></div>`).join('') : '';
  } else if (cur === 'support') {
    const p = ui.adminPlayer;
    h += `<form class="card adminform" data-form="findPlayer" autocomplete="off"><h4>${svg(I.user, 26)} Spieler suchen</h4><div class="row"><input name="q" maxlength="254" placeholder="Spielername oder E-Mail" autocapitalize="off" spellcheck="false" aria-label="Spieler suchen"><button class="btn small" type="submit">Suchen</button></div></form>`;
    if (p) {
      const f = (t) => (t ? new Date(t).toLocaleString('de-DE') : '–');
      const itemInputs = ['fert', 'rain', 'compost', 'turbo', 'lucky', 'pollen', 'boost'].map((k) => `<label class="iin">${svg(I.ITEM[k], 30)}<input type="number" name="i_${k}" min="0" max="50" placeholder="0" aria-label="${esc(C.ITEMS[k].name)}"></label>`).join('');
      h += `<div class="card player">${avatar(p, 54)}<div class="grow"><h4>${esc(p.name)} ${p.admin ? '<span class="tier t0">Admin</span>' : ''}${p.banned ? '<span class="tier t0" style="background:#d62c2c">Chat gesperrt</span>' : ''}${p.mustRename ? '<span class="tier t0" style="background:#f0a810">Name zurückgesetzt</span>' : ''}</h4>
          <p class="small">E-Mail ${esc(p.email)} · Level ${p.level} · ${p.friends} Freunde</p><p class="small">Registriert ${f(p.created)} · zuletzt online ${f(p.lastSeen)} · gespeichert ${f(p.saveAt)}</p></div></div>
        <form class="card adminform" data-form="grant" data-id="${p.id}" autocomplete="off"><h4>${svg(I.gift, 24)} Gutschrift (Support)</h4><p class="small">Kommt beim nächsten Öffnen als Geschenk an – z. B. wenn durch einen Fehler etwas verloren ging.</p>
          <label class="fld"><span>Titel</span><input name="title" maxlength="60" placeholder="z. B. Entschädigung für den Fehler"></label>
          <label class="fld"><span>Münzen</span><input type="number" name="coins" min="0" max="5000" placeholder="0"></label><div class="iinputs">${itemInputs}</div>
          <button class="btn small" type="submit">Gutschreiben</button></form>
        <div class="card"><h4>Konto-Werkzeuge</h4><div class="btnrow wrap">
          ${p.admin ? '' : `<button class="btn small ${p.mustRename ? 'ghost' : ''}" data-act="adminRename" data-id="${p.id}" data-on="${p.mustRename ? '0' : '1'}">${p.mustRename ? 'Namensreset aufheben' : 'Spielername zurücksetzen'}</button>`}
          <button class="btn small blue" data-act="adminResetCode" data-id="${p.id}">Passwort-Reset-Code</button>
          ${p.admin ? '' : (p.banned ? `<button class="btn small ghost" data-act="adminUnban" data-id="${p.id}">Chat entsperren</button>` : `<button class="btn small red" data-act="adminBan" data-id="${p.id}" data-days="7">Chat 7 Tage sperren</button>`)}
        </div>${ui.adminCode ? `<div class="codebox"><small>Reset-Code für ${esc(p.name)} (30 Min gültig) – dem Spieler mitteilen:</small><b class="code">${esc(ui.adminCode)}</b></div>` : ''}<p class="small">Beim Namensreset muss der Spieler beim nächsten Start einen neuen Namen wählen. Passwort und E-Mail siehst du nie.</p></div>`;
    }
  } else if (cur === 'tools') {
    const m = d.maint;
    h += `<form class="card adminform" data-form="maint" autocomplete="off"><h4>${svg(I.gear, 26)} Wartungsmodus ${m ? '<span class="tier t0" style="background:#f0a810">AN</span>' : ''}</h4>
      <p class="small">Zeigt allen Spielern oben einen Hinweis. Das Spiel läuft weiter.</p>
      <label class="fld"><span>Hinweis</span><input name="text" maxlength="200" value="${esc(m?.text || '')}" placeholder="z. B. Heute 22–23 Uhr kurze Wartung"></label>
      <label class="fld"><span>Dauer in Stunden (0 = bis du ihn ausschaltest)</span><input type="number" name="hours" min="0" max="168" value="2"></label>
      <div class="btnrow"><button class="btn small" type="submit" name="on" value="1">Einschalten</button>${m ? '<button class="btn small ghost" type="submit" name="on" value="0">Ausschalten</button>' : ''}</div></form>`;
    const B = [['doubleXp', 'Doppelte Erfahrung'], ['doubleCoins', 'Doppelte Münzen'], ['shinyDay', 'Funkel-Tag (doppelte Funkel-Chance)'], ['traderSale', 'Händler zahlt mehr']];
    const act = Object.fromEntries((d.boosts || []).map((b) => [b.id, b]));
    h += `<div class="card adminform"><h4>${svg(I.sparkle, 26)} Event-Schalter</h4><p class="small">Gelten sofort für alle Spieler, mit Ende nach der gewählten Zeit.</p>${B.map(([id, name]) => { const a = act[id] && act[id].end > Date.now() ? act[id] : null; return `<form class="boostrow" data-form="boost" data-id="${id}"><b>${name}</b>${a ? `<small>aktiv bis ${new Date(a.end).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · ×${a.mult}</small>` : '<small>aus</small>'}<span class="bctl"><input type="number" name="hours" min="1" max="336" value="24" aria-label="Stunden"><span>h ×</span><input type="number" name="mult" min="1.5" max="4" step="0.5" value="2" aria-label="Faktor"><button class="btn small" type="submit">${a ? 'Verlängern' : 'Start'}</button>${a ? '<button class="btn small ghost" type="submit" name="stop" value="1">Stopp</button>' : ''}</span></form>`; }).join('')}</div>`;
    const items = C.TRADER_ITEMS.map((k) => `<option value="item:${k}">${esc(C.ITEMS[k].name)}</option>`).join('') + C.DECO_ORDER.map((k) => `<option value="deco:${k}">Deko: ${esc(C.DECO[k].name)}</option>`).join('');
    h += `<form class="card adminform" data-form="offer" autocomplete="off"><h4>${svg(I.cart, 26)} Händler-Tagesangebot ${d.offer ? '<span class="tier t0" style="background:#8b5fd6">heute gesetzt</span>' : ''}</h4><p class="small">Ersetzt heute das zufällige Tagesangebot für alle.</p>
      <label class="fld"><span>Gegenstand</span><select name="what">${items}</select></label>
      <div class="grid2"><label class="fld"><span>Anzahl (nur Bedarf)</span><input type="number" name="n" min="1" max="10" value="3"></label><label class="fld"><span>Rabatt %</span><input type="number" name="off" min="5" max="90" value="40"></label></div>
      <div class="btnrow"><button class="btn small" type="submit">Setzen</button>${d.offer ? '<button class="btn small ghost" type="submit" name="clear" value="1">Zurück auf Zufall</button>' : ''}</div></form>`;
    h += `<form class="card adminform" data-form="word" autocomplete="off"><h4>${svg(I.shield, 26)} Schimpfwort-Filter</h4><p class="small">Zusätzliche Wörter, die im Chat durch Sternchen ersetzt werden (ohne Groß/Klein).</p><div class="row"><input name="word" maxlength="40" placeholder="Wort" autocapitalize="off"><button class="btn small" type="submit">Hinzufügen</button></div>
      <div class="chips">${(d.words || []).map((w) => `<span class="chip">${esc(w)} <button type="button" class="x-mini" data-act="adminDelWord" data-id="${esc(w)}" aria-label="entfernen">✕</button></span>`).join('') || '<span class="small">Noch keine eigenen Wörter.</span>'}</div></form>`;
    h += `<div class="card"><h4>E-Mail-Versand</h4><p class="small">${d.mail ? '✅ Eingerichtet – Passwort-Reset-Codes gehen per E-Mail raus.' : 'Noch nicht eingerichtet. Dafür in den Vercel-Projekteinstellungen die Umgebungsvariablen <b>RESEND_API_KEY</b> (Schlüssel von resend.com) und <b>MAIL_FROM</b> (Absender, z. B. BloomWorld &lt;noreply@deine-domain.de&gt;) anlegen. Bis dahin erzeugst du Reset-Codes unter „Spieler“.'}</p></div>`;
  } else if (cur === 'legal') {
    const L = d.legal || {};
    const tplImp = `Angaben gemäß § 5 DDG\n\n[Vor- und Nachname]\n[Straße Hausnummer]\n[PLZ Ort]\nDeutschland\n\nKontakt\nE-Mail: [deine E-Mail]\n\nVerantwortlich für den Inhalt: [Name]\n\nStreitschlichtung: Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.`;
    const tplDs = `Datenschutzerklärung für BloomWorld\n\n1. Verantwortlicher\n[Name, Anschrift, E-Mail]\n\n2. Welche Daten verarbeitet werden\n- Konto: Spielername, E-Mail-Adresse, Passwort (nur als verschlüsselter Prüfwert), Zeitpunkt der Registrierung.\n- Spielstand: dein Garten, Münzen, Sammlung, Einstellungen.\n- Freunde & Chat: Freundesliste, Chat-Nachrichten (höchstens 90 Tage, die letzten 200 je Unterhaltung), Geschenke, Gartenbesuche, Online-Status.\n- Technisch: IP-Adresse in Server-Protokollen des Hosters (kurzfristig, zur Abwehr von Missbrauch), Anmelde-Cookie „bw_session“.\n- Feedback und Meldungen, wenn du sie absendest.\n\n3. Zwecke und Rechtsgrundlagen\nBereitstellung des Spiels und deines Kontos (Art. 6 Abs. 1 lit. b DSGVO), Sicherheit und Missbrauchsabwehr (Art. 6 Abs. 1 lit. f DSGVO).\n\n4. Hosting und Dienstleister\nDie Seite läuft bei Vercel Inc. (Server-Region Frankfurt), die Datenbank bei [Redis-Anbieter laut Vercel-Marketplace]. Mit diesen Anbietern bestehen Auftragsverarbeitungsverträge. [Falls E-Mail-Versand aktiv: Passwort-Reset-E-Mails werden über Resend versendet.]\n\n5. Cookies und lokaler Speicher\nNur ein technisch notwendiges Anmelde-Cookie und der lokale Browserspeicher für deinen Spielstand. Keine Werbe- oder Tracking-Cookies, keine Analyse-Dienste.\n\n6. Speicherdauer\nKonto und Spielstand bis zur Löschung deines Kontos (jederzeit in den Einstellungen). Chat-Nachrichten höchstens 90 Tage. Protokolle des Hosters nach dessen Fristen.\n\n7. Deine Rechte\nAuskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie Beschwerde bei einer Aufsichtsbehörde. Schreib dazu an [E-Mail].\n\n8. Kinder\nBloomWorld richtet sich an Spieler ab 16 Jahren. Jüngere Spieler brauchen die Zustimmung der Eltern für ein Konto.\n\n9. Käufe\nDerzeit gibt es keine Echtgeld-Käufe. Sobald es sie gibt, wird diese Erklärung ergänzt.\n\nStand: ${new Date().toLocaleDateString('de-DE')}`;
    h += `<div class="card"><h4>${svg(I.shield, 26)} Impressum &amp; Datenschutz</h4><p class="small">Pflicht in Deutschland, sobald das Spiel öffentlich ist. Trage deine Angaben ein – die Vorlagen helfen beim Start, ersetzen aber keine Rechtsberatung. Spieler finden die Texte unter Einstellungen.</p></div>`;
    void tplImp; void tplDs;
    h += `<div class="card"><p class="small">Solange du nichts speicherst, sehen Spieler die eingebaute Vorlage mit Platzhaltern in [eckigen Klammern]. Klicke „Vorlage einfügen“, ersetze die Platzhalter durch deine Angaben und speichere.</p></div>`;
    for (const [key, title, tpl] of [['impressum', 'Impressum', IMPRESSUM_TEXT], ['datenschutz', 'Datenschutzerklärung', PRIVACY_TEXT], ['agb', 'Nutzungsbedingungen (AGB)', AGB_TEXT]]) {
      h += `<form class="card adminform" data-form="legal" data-id="${key}" autocomplete="off"><h4>${title} ${L[key] ? '<span class="tier t0" style="background:#3fa52b">eigener Text</span>' : '<span class="tier t0" style="background:#f0a810">Vorlage mit Platzhaltern</span>'}</h4>
        <textarea name="text" rows="10" maxlength="20000" placeholder="Hier den Text eintragen …">${esc(L[key] || '')}</textarea>
        <div class="btnrow"><button class="btn small" type="submit">Speichern</button>${L[key] ? '' : `<button class="btn small ghost" type="button" data-act="adminTpl" data-id="${key}">Vorlage einfügen</button>`}</div><textarea hidden class="tpl">${esc(tpl)}</textarea></form>`;
    }
  } else if (cur === 'push') {
    const p = d.push || {};
    h += p.on ? `<form class="card adminform" data-form="pushAll" autocomplete="off"><h4>${svg(I.bell, 26)} Push an alle Spieler</h4><p class="small">Geht an jedes Gerät, auf dem Spieler Push eingeschaltet haben. Ankündigungen und „Geschenk an alle“ lösen automatisch eine Push aus.</p>
        <label class="fld"><span>Titel</span><input name="title" maxlength="60" placeholder="z. B. Funkel-Wochenende!"></label>
        <label class="fld"><span>Text</span><input name="text" maxlength="150" placeholder="Kurz und knackig"></label>
        <button class="btn wide pink" type="submit">Jetzt senden</button></form>`
      : `<div class="card adminform"><h4>${svg(I.bell, 26)} Push einrichten (einmalig)</h4><p class="small">Push ist noch aus. So schaltest du es ein – dauert 5 Minuten:</p>
        <ol class="steps"><li>Öffne dein Vercel-Projekt → <b>Settings → Environment Variables</b>.</li><li>Lege diese drei Variablen an (Werte unten kopieren; beim nächsten Laden dieser Seite werden neue erzeugt, also <b>jetzt</b> kopieren):</li></ol>
        <div class="codebox"><small>VAPID_PUBLIC_KEY</small><b class="code small">${esc(p.keys?.publicKey || '')}</b></div>
        <div class="codebox"><small>VAPID_PRIVATE_KEY (geheim – nur in Vercel eintragen)</small><b class="code small">${esc(p.keys?.privateKey || '')}</b></div>
        <div class="codebox"><small>VAPID_SUBJECT</small><b class="code small">mailto:deine@e-mail.de</b></div>
        <ol class="steps" start="3"><li>Danach in Vercel auf <b>Redeploy</b> klicken (Deployments → ⋯ → Redeploy).</li><li>Fertig. Spieler schalten Push unter der Glocke ein. Erinnerungen (Durst, reif, Züchtung) verschickt ein Zeitplan alle 10 Minuten (Vercel Cron, ist schon eingerichtet).</li></ol></div>`;
  } else if (cur === 'log') {
    h += (d.logs || []).length ? `<div class="card"><table class="logtab">${d.logs.map((l) => `<tr><td><small>${new Date(l.ts).toLocaleString('de-DE')}</small></td><td><b>${esc(l.action)}</b></td><td>${esc(l.detail)}</td></tr>`).join('')}</table></div>` : '<div class="card center"><p>Noch keine Einträge.</p></div>';
  } else if (cur === 'feedback') {
    const KIND = { bug: ['Fehler', '#ff6a6a'], idea: ['Idee', '#3fc28b'], other: ['Sonstiges', '#8b5fd6'] };
    h += d.feedback.length ? d.feedback.map((f) => `<div class="card fb"><div class="nhead"><span class="nkind" style="background:${KIND[f.kind]?.[1] || '#8b5fd6'}">${KIND[f.kind]?.[0] || 'Feedback'}</span><small>${esc(f.name)} · ${new Date(f.ts).toLocaleString('de-DE')}</small></div><p class="fbtext">${esc(f.text).replace(/\n/g, '<br>')}</p><div class="btnrow right"><button class="btn small ghost" data-act="adminDelFeedback" data-id="${esc(f.id)}">Erledigt</button></div></div>`).join('')
      : `<div class="card center">${svg(I.megaphone, 60)}<h4>Noch kein Feedback</h4><p>Spieler können dir unter Einstellungen → „Feedback an das Team“ schreiben.</p></div>`;
  } else if (cur === 'reports') {
    h += d.reports.length ? d.reports.map((r) => `<div class="card report"><small>${new Date(r.ts).toLocaleString('de-DE')} · gemeldet von <b>${esc(r.reporterName)}</b></small>
      <h4>${esc(r.targetName)} schrieb:</h4><blockquote>${esc(r.text)}</blockquote>
      <div class="btnrow"><button class="btn small ghost" data-act="adminResolve" data-id="${esc(r.id)}">Erledigt</button><button class="btn small" data-act="adminBan" data-id="${esc(r.target)}" data-days="7" data-report="${esc(r.id)}">Chat 7 Tage sperren</button><button class="btn small red" data-act="adminBan" data-id="${esc(r.target)}" data-days="0" data-report="${esc(r.id)}">Dauerhaft sperren</button></div></div>`).join('')
      : `<div class="card center">${svg(I.shield, 60)}<h4>Alles ruhig</h4><p>Keine gemeldeten Nachrichten.</p></div>`;
  } else {
    const st = d.stats, max = Math.max(1, ...st.reg.map((x) => x.n));
    h += `<div class="grid3 stats"><div class="tile"><b class="big">${st.users}</b><small>Spieler gesamt</small></div><div class="tile"><b class="big">${st.online}</b><small>gerade online</small></div><div class="tile"><b class="big">${st.activeToday}</b><small>heute aktiv</small></div><div class="tile"><b class="big">${st.active7}</b><small>aktiv (7 Tage)</small></div><div class="tile"><b class="big">${st.newToday}</b><small>neu heute</small></div><div class="tile"><b class="big">${st.new7}</b><small>neu (7 Tage)</small></div></div>
      <div class="card"><h4>Neue Spieler pro Tag</h4><div class="bars">${[...st.reg].reverse().map((x) => `<div class="bar"><i style="height:${Math.round((x.n / max) * 100)}%"></i><b>${x.n}</b><small>${new Date(x.day).toLocaleDateString('de-DE', { weekday: 'short' })}</small></div>`).join('')}</div></div>`;
    h += `<div class="sec">Chat-Sperren</div>` + (d.bans.length ? d.bans.map((b) => `<div class="card frow">${avatar(b, 36)}<div class="grow"><h4>${esc(b.name)}</h4><small>${b.days ? `${b.days} Tage` : 'dauerhaft'} · ${esc(b.reason || '')}</small></div><button class="btn small ghost" data-act="adminUnban" data-id="${b.id}">Entsperren</button></div>`).join('') : '<div class="card center"><p>Niemand ist gesperrt.</p></div>');
    h += `<div class="card"><p class="small">Admin ist automatisch das zuerst registrierte Konto. Die Daten der Spieler (E-Mail, Passwort) siehst du hier bewusst nicht.</p></div>`;
  }
  return h;
}

export async function loadAdmin(ui) {
  ui.adminLoading = true; ui.adminError = null;
  const r = await adminApi.overview();
  ui.adminLoading = false;
  if (r.ok) ui.adminData = r; else ui.adminError = r.message || 'Laden fehlgeschlagen.';
  if (ui.panel === 'admin') ui.renderPanel(true);
}

// ---------- Aktionen ----------
export const SOCIAL_ACTS = new Set(['socialRetry', 'frAccept', 'frDecline', 'frCancel', 'frUnblock', 'frMenu', 'frRemove', 'frRemoveYes', 'frBlock', 'frBlockYes', 'openChat', 'giftMenu', 'sendGift', 'reportMsg', 'reportYes', 'visit', 'openAdmin', 'adminReload', 'adminDelNews', 'adminResolve', 'adminBan', 'adminUnban', 'adminDelCode', 'adminDelFeedback', 'adminRename', 'adminResetCode', 'adminDelWord', 'adminTpl']);

export async function onSocialAct(ui, a, el) {
  const hub = ui.api.social?.(), id = el.dataset.id, A = ui.api.act;
  const done = (r, okMsg) => { if (r.ok) { if (okMsg) ui.toast(okMsg, 'good'); ui.api.sound.play('buy'); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Das hat nicht geklappt.', 'err'); } ui.renderPanel(true); return r.ok; };
  switch (a) {
    case 'socialRetry': hub?.tick(); return true;
    case 'frAccept': done(await hub.act('accept', id), 'Ihr seid jetzt Freunde!'); return true;
    case 'frDecline': done(await hub.act('decline', id)); return true;
    case 'frCancel': done(await hub.act('cancel', id), 'Anfrage zurückgezogen.'); return true;
    case 'frUnblock': done(await hub.act('unblock', id), 'Blockierung aufgehoben.'); return true;
    case 'frMenu': friendMenu(ui, id); return true;
    case 'frRemove': {
      const f = hub.friend(id);
      ui.modal({ title: 'Freund entfernen?', html: `<p>Möchtest du <b>${esc(f?.name)}</b> wirklich aus deiner Freundesliste entfernen? Euer Chat wird gelöscht.</p>`, buttons: [['Entfernen', 'frRemoveYes', 'red', `data-id="${id}"`], ['Abbrechen', 'closeModal', 'ghost']] });
      return true;
    }
    case 'frRemoveYes': ui.closeModal(); done(await hub.act('remove', id), 'Freund entfernt.'); return true;
    case 'frBlock': {
      const f = hub.friend(id);
      ui.modal({ title: 'Blockieren?', html: `<p><b>${esc(f?.name)}</b> wird aus deinen Freunden entfernt und kann dir keine Anfragen oder Nachrichten mehr schicken.</p>`, buttons: [['Blockieren', 'frBlockYes', 'red', `data-id="${id}"`], ['Abbrechen', 'closeModal', 'ghost']] });
      return true;
    }
    case 'frBlockYes': ui.closeModal(); if (hub.chat?.id === id) hub.closeChat(); done(await hub.act('block', id), 'Blockiert.'); if (ui.panel === 'chat') ui.nav('friends'); return true;
    case 'openChat': {
      const f = hub.friend(id);
      if (!f) return true;
      ui.closeModal();
      hub.openChat(id, f.name);
      ui.nav('chat');
      return true;
    }
    case 'giftMenu': giftDialog(ui, id); return true;
    case 'sendGift': {
      ui.closeModal();
      const r = await hub.act('gift', id, el.dataset.kind);
      if (r.ok) A.giftSent(r, hub.friend(id)?.name, el.dataset.kind); else done(r);
      ui.renderPanel(true);
      return true;
    }
    case 'reportMsg': {
      ui.modal({ title: 'Nachricht melden?', html: '<p>Die Nachricht wird an das BloomWorld-Team geschickt und geprüft. Du kannst den Spieler zusätzlich blockieren.</p>', buttons: [['Melden', 'reportYes', 'red', `data-id="${esc(id)}"`], ['Abbrechen', 'closeModal', 'ghost']] });
      return true;
    }
    case 'reportYes': {
      ui.closeModal();
      const c = hub.chat;
      if (!c) return true;
      const r = await hub.act('report', c.id, id, '');
      if (r.ok) ui.modal({ title: 'Danke!', html: `${svg(I.shield, 70)}<p>Die Nachricht wurde gemeldet. Möchtest du ${esc(c.name)} auch blockieren?</p>`, buttons: [['Blockieren', 'frBlockYes', 'red', `data-id="${c.id}"`], ['Nein, danke', 'closeModal', 'ghost']] });
      else done(r);
      return true;
    }
    case 'visit': ui.closeModal(); A.visit(id); return true;
    case 'openAdmin': ui.adminData = null; ui.nav('admin'); return true;
    case 'adminReload': ui.adminData = null; ui.renderPanel(true); return true;
    case 'adminDelNews': if (done(await adminApi.deleteNews(id), 'Ankündigung gelöscht.')) await loadAdmin(ui); return true;
    case 'adminResolve': if (done(await adminApi.resolve(id), 'Meldung erledigt.')) await loadAdmin(ui); return true;
    case 'adminBan': {
      const days = Number(el.dataset.days) || 0;
      const r = await adminApi.ban(id, days, 'Gemeldete Nachricht');
      if (done(r, days ? `Chat für ${days} Tage gesperrt.` : 'Chat dauerhaft gesperrt.')) { if (el.dataset.report) await adminApi.resolve(el.dataset.report); await loadAdmin(ui); }
      return true;
    }
    case 'adminRename': if (done(await adminApi.forceRename(id, el.dataset.on === '1'), el.dataset.on === '1' ? 'Der Spieler muss beim nächsten Start einen neuen Namen wählen.' : 'Namensreset aufgehoben.')) { ui.adminPlayer = (await adminApi.findPlayer(ui.adminPlayer?.name))?.player || ui.adminPlayer; await loadAdmin(ui); } return true;
    case 'adminResetCode': { const r = await adminApi.resetCode(id); if (r.ok) { ui.adminCode = r.code; ui.api.sound.play('buy'); ui.renderPanel(true); } else done(r); return true; }
    case 'adminDelWord': if (done(await adminApi.removeWord(id))) await loadAdmin(ui); return true;
    case 'adminTpl': { const f = el.closest('form'); const t = f.querySelector('[name=text]'); if (!t.value.trim()) t.value = f.querySelector('.tpl').value; t.focus(); return true; }
    case 'adminDelCode': if (done(await adminApi.deleteCode(id), 'Gutschein gelöscht.')) await loadAdmin(ui); return true;
    case 'adminDelFeedback': if (done(await adminApi.deleteFeedback(id), 'Erledigt.')) await loadAdmin(ui); return true;
    case 'adminUnban': if (done(await adminApi.unban(id), 'Sperre aufgehoben.')) await loadAdmin(ui); return true;
    default: return false;
  }
}

export async function onSocialForm(ui, form) {
  const hub = ui.api.social?.();
  const kind = form.dataset.form;
  const btn = form.querySelector('[type=submit]');
  if (kind === 'addFriend') {
    const inp = form.querySelector('[name=fname]');
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    btn.disabled = true;
    const r = await hub.act('request', name);
    btn.disabled = false;
    if (r.ok) { inp.value = ''; ui.api.sound.play('buy'); ui.toast(r.friend ? `Du und ${r.name} seid jetzt Freunde!` : `Anfrage an ${r.name || name} gesendet.`, 'good'); }
    else { ui.api.sound.play('error'); ui.toast(r.message || 'Das hat nicht geklappt.', 'err'); }
    ui.renderPanel(true);
  } else if (kind === 'chat') {
    const inp = form.querySelector('[name=msg]');
    const text = inp.value.trim();
    if (!text) return;
    btn.disabled = true;
    const r = await hub.send(text);
    btn.disabled = false;
    if (r.ok) { inp.value = ''; ui.api.sound.play('tap'); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Nachricht konnte nicht gesendet werden.', 'err'); }
    inp.focus();
  } else if (kind === 'giftAll' || kind === 'createCode') {
    const d = Object.fromEntries(new FormData(form));
    const items = {};
    for (const [k, v] of Object.entries(d)) if (k.startsWith('i_') && Number(v) > 0) items[k.slice(2)] = Number(v);
    const body = { title: d.title, code: d.code, coins: Number(d.coins) || 0, items, max: Number(d.max) || 0, days: Number(d.days) || 0 };
    const go = async () => {
      btn.disabled = true;
      const r = kind === 'giftAll' ? await adminApi.giftAll(body) : await adminApi.createCode(body);
      btn.disabled = false;
      if (r.ok) { form.reset(); ui.api.sound.play('level'); ui.toast(kind === 'giftAll' ? 'Geschenk verschickt – alle Spieler bekommen es beim nächsten Öffnen.' : `Gutschein ${r.item.code} erstellt.`, 'good'); await loadAdmin(ui); }
      else { ui.api.sound.play('error'); ui.toast(r.message || 'Das hat nicht geklappt.', 'err'); }
    };
    if (kind === 'giftAll') ui.confirm({ title: 'An alle verschicken?', text: `Jeder Spieler bekommt ${body.coins} Münzen${Object.keys(items).length ? ` und ${Object.entries(items).map(([k, n]) => `${n}× ${C.ITEMS[k].name}`).join(', ')}` : ''}. Das lässt sich nicht zurücknehmen.`, ok: 'Ja, verschicken', okClass: 'pink', onOk: go });
    else go();
  } else if (kind === 'findPlayer') {
    const q = form.querySelector('[name=q]').value.trim();
    if (!q) return;
    btn.disabled = true; const r = await adminApi.findPlayer(q); btn.disabled = false;
    if (r.ok) { ui.adminPlayer = r.player; ui.adminCode = null; ui.renderPanel(true); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Nicht gefunden.', 'err'); }
  } else if (kind === 'grant') {
    const d = Object.fromEntries(new FormData(form)); const items = {};
    for (const [k, v] of Object.entries(d)) if (k.startsWith('i_') && Number(v) > 0) items[k.slice(2)] = Number(v);
    btn.disabled = true; const r = await adminApi.grant({ id: form.dataset.id, title: d.title, coins: Number(d.coins) || 0, items }); btn.disabled = false;
    if (r.ok) { form.reset(); ui.api.sound.play('level'); ui.toast('Gutschrift verschickt.', 'good'); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Das hat nicht geklappt.', 'err'); }
  } else if (kind === 'maint') {
    const on = form.dataset.on !== '0';
    const d = Object.fromEntries(new FormData(form));
    const hours = Number(d.hours) || 0;
    const r = await adminApi.maintenance({ on, text: d.text, until: on && hours ? Date.now() + hours * 3600_000 : 0 });
    if (r.ok) { ui.api.sound.play('buy'); ui.toast(on ? 'Wartungshinweis ist an.' : 'Wartungshinweis ist aus.', 'good'); await loadAdmin(ui); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Fehler.', 'err'); }
  } else if (kind === 'boost') {
    const d = Object.fromEntries(new FormData(form));
    const stop = form.dataset.stop === '1';
    const r = await adminApi.boost(form.dataset.id, stop ? 0 : Number(d.hours) || 24, Number(d.mult) || 2);
    if (r.ok) { ui.api.sound.play('level'); ui.toast(stop ? 'Event beendet.' : 'Event läuft – alle Spieler sehen es in wenigen Minuten.', 'good'); await loadAdmin(ui); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Fehler.', 'err'); }
  } else if (kind === 'offer') {
    const d = Object.fromEntries(new FormData(form));
    const [k, id] = String(d.what || '').split(':');
    const r = await adminApi.traderOffer(form.dataset.clear === '1' ? { clear: true } : { kind: k, id, n: Number(d.n) || 1, off: (Number(d.off) || 30) / 100 });
    if (r.ok) { ui.api.sound.play('buy'); ui.toast('Tagesangebot gespeichert.', 'good'); await loadAdmin(ui); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Fehler.', 'err'); }
  } else if (kind === 'pushAll') {
    const d = Object.fromEntries(new FormData(form));
    btn.disabled = true; const r = await adminApi.pushAll(d); btn.disabled = false;
    if (r.ok) { form.reset(); ui.api.sound.play('level'); ui.toast(`Push an ${r.sent} Geräte gesendet.`, 'good'); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Fehler.', 'err'); }
  } else if (kind === 'word') {
    const w = form.querySelector('[name=word]').value.trim();
    if (!w) return;
    const r = await adminApi.addWord(w);
    if (r.ok) { form.reset(); await loadAdmin(ui); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Fehler.', 'err'); }
  } else if (kind === 'legal') {
    btn.disabled = true; const r = await adminApi.legal(form.dataset.id, form.querySelector('[name=text]').value); btn.disabled = false;
    if (r.ok) { ui.api.sound.play('buy'); ui.toast('Gespeichert – ab sofort für alle sichtbar.', 'good'); await loadAdmin(ui); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Fehler.', 'err'); }
  } else if (kind === 'redeem') {
    const inp = form.querySelector('[name=code]');
    if (!inp.value.trim()) { inp.focus(); return; }
    btn.disabled = true;
    const r = await socialApi.redeem(inp.value);
    btn.disabled = false;
    if (r.ok) { inp.value = ''; ui.api.act.redeemed(r.item); } else { ui.api.sound.play('error'); ui.toast(r.message || 'Der Code hat nicht geklappt.', 'err'); }
  } else if (kind === 'feedback') {
    const d = Object.fromEntries(new FormData(form));
    if (String(d.text || '').trim().length < 3) { form.querySelector('textarea').focus(); return; }
    btn.disabled = true;
    const r = await socialApi.feedback({ text: d.text, kind: d.kind, ver: '3.4', ua: navigator.userAgent });
    btn.disabled = false;
    if (r.ok) { form.reset(); ui.api.sound.play('buy'); ui.toast('Danke für dein Feedback! Das Team liest jede Nachricht.', 'good'); }
    else { ui.api.sound.play('error'); ui.toast(r.message || 'Senden fehlgeschlagen.', 'err'); }
  } else if (kind === 'news') {
    const d = Object.fromEntries(new FormData(form));
    btn.disabled = true;
    const r = await adminApi.post(d);
    btn.disabled = false;
    if (r.ok) { form.reset(); ui.toast('Ankündigung veröffentlicht – alle Spieler sehen sie beim nächsten Start.', 'good'); ui.api.sound.play('level'); await loadAdmin(ui); }
    else { ui.api.sound.play('error'); ui.toast(r.message || 'Veröffentlichen fehlgeschlagen.', 'err'); }
  }
}
