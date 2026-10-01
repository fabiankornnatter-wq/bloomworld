// Oberfläche für Freunde, Chat, Gartenbesuche und den Admin-Bereich.
import * as C from './config.js';
import * as I from './icons.js';
import { adminApi } from './social.js';

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
  let h = ui.tabs('admin', [['news', 'Ankündigungen'], ['reports', 'Meldungen', d?.reports?.length || 0], ['players', 'Spieler']]);
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
  } else if (cur === 'reports') {
    h += d.reports.length ? d.reports.map((r) => `<div class="card report"><small>${new Date(r.ts).toLocaleString('de-DE')} · gemeldet von <b>${esc(r.reporterName)}</b></small>
      <h4>${esc(r.targetName)} schrieb:</h4><blockquote>${esc(r.text)}</blockquote>
      <div class="btnrow"><button class="btn small ghost" data-act="adminResolve" data-id="${esc(r.id)}">Erledigt</button><button class="btn small" data-act="adminBan" data-id="${esc(r.target)}" data-days="7" data-report="${esc(r.id)}">Chat 7 Tage sperren</button><button class="btn small red" data-act="adminBan" data-id="${esc(r.target)}" data-days="0" data-report="${esc(r.id)}">Dauerhaft sperren</button></div></div>`).join('')
      : `<div class="card center">${svg(I.shield, 60)}<h4>Alles ruhig</h4><p>Keine gemeldeten Nachrichten.</p></div>`;
  } else {
    h += `<div class="grid2"><div class="tile"><b class="big">${d.stats.users}</b><small>Spieler mit Konto</small></div><div class="tile"><b class="big">${d.stats.online}</b><small>gerade online</small></div></div>`;
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
export const SOCIAL_ACTS = new Set(['socialRetry', 'frAccept', 'frDecline', 'frCancel', 'frUnblock', 'frMenu', 'frRemove', 'frRemoveYes', 'frBlock', 'frBlockYes', 'openChat', 'giftMenu', 'sendGift', 'reportMsg', 'reportYes', 'visit', 'openAdmin', 'adminReload', 'adminDelNews', 'adminResolve', 'adminBan', 'adminUnban']);

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
  } else if (kind === 'news') {
    const d = Object.fromEntries(new FormData(form));
    btn.disabled = true;
    const r = await adminApi.post(d);
    btn.disabled = false;
    if (r.ok) { form.reset(); ui.toast('Ankündigung veröffentlicht – alle Spieler sehen sie beim nächsten Start.', 'good'); ui.api.sound.play('level'); await loadAdmin(ui); }
    else { ui.api.sound.play('error'); ui.toast(r.message || 'Veröffentlichen fehlgeschlagen.', 'err'); }
  }
}
