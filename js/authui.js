// Anmelde- und Registrierungsbildschirm (im Startbildschirm).
import { api } from './account.js';
import { PRIVACY_HTML } from './legal.js';
import * as I from './icons.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const rememberBox = '<label class="check remember"><input type="checkbox" name="remember" checked><span><b>Angemeldet bleiben</b> – du startest beim nächsten Mal direkt im Garten. Auf fremden Geräten ausschalten.</span></label>';

const pwField = (name, label, auto) => `<label class="fld"><span>${label}</span><span class="pw"><input type="password" name="${name}" autocomplete="${auto}" required minlength="8" maxlength="128"><button type="button" class="eye" data-eye aria-label="Passwort anzeigen">${I.eye}</button></span></label>`;

// Zeigt das Formular. onDone(user) nach erfolgreicher Anmeldung, onOffline() für Offline-Spiel.
export function showAuth({ onDone, onOffline, offline = false, reason = '', unlock, lastUser = null }) {
  const box = $('authBox');
  const tab = (localStorage_get('bw_has_account') ? 'login' : 'register');
  box.innerHTML = `
    <div class="authcard">
      ${offline ? `<div class="authwarn">${esc(reason || 'Der Spiel-Server ist gerade nicht erreichbar.')}</div>` : ''}
      <div class="tabs" role="tablist">
        <button type="button" data-tab="register" role="tab">Registrieren</button>
        <button type="button" data-tab="login" role="tab">Anmelden</button>
      </div>
      <form id="registerForm" novalidate>
        <label class="fld"><span>Spielername</span><input name="name" autocomplete="nickname" required minlength="3" maxlength="20" placeholder="z. B. Rosenfee"></label>
        <label class="fld"><span>E-Mail</span><input type="email" name="email" autocomplete="email" required maxlength="254" inputmode="email"></label>
        ${pwField('password', 'Passwort <small>(mind. 8 Zeichen)</small>', 'new-password')}
        <label class="check"><input type="checkbox" name="privacy" required><span>Ich habe die <button type="button" class="link" data-privacy>Datenschutzhinweise</button> gelesen.</span></label>
        ${rememberBox}
        <p class="ferr" role="alert"></p>
        <button class="btn big wide" type="submit">Konto erstellen</button>
      </form>
      <form id="loginForm" novalidate hidden>
        <label class="fld"><span>Spielername oder E-Mail</span><input name="login" autocomplete="username" required maxlength="254"></label>
        ${pwField('password', 'Passwort', 'current-password')}
        ${rememberBox}
        <p class="ferr" role="alert"></p>
        <button class="btn big wide" type="submit">Anmelden</button>
        <button type="button" class="link small" data-forgot>Passwort vergessen?</button>
      </form>
      <form id="forgotForm" novalidate hidden>
        <p class="fhint">Gib Spielername oder E-Mail ein. Du bekommst einen Code – per E-Mail oder vom BloomWorld-Team. Damit setzt du hier ein neues Passwort.</p>
        <label class="fld"><span>Spielername oder E-Mail</span><input name="login" autocomplete="username" required maxlength="254"></label>
        <div class="btnrow"><button type="button" class="btn small ghost" data-sendcode>Code anfordern</button></div>
        <label class="fld"><span>Code</span><input name="code" autocomplete="one-time-code" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="z. B. K7M2P9XQ"></label>
        ${pwField('password', 'Neues Passwort <small>(mind. 8 Zeichen)</small>', 'new-password')}
        <p class="ferr" role="alert"></p>
        <button class="btn big wide" type="submit">Passwort setzen</button>
        <button type="button" class="link small" data-back-login>Zurück zur Anmeldung</button>
      </form>
      <div class="privacy" hidden>${PRIVACY_HTML}<button type="button" class="btn small ghost" data-privacy-close>Zurück</button></div>
      ${offline ? (lastUser
        ? `<div class="offline"><p>Du kannst mit dem Stand von diesem Gerät weiterspielen. Sobald die Verbindung wieder da ist, wird er in dein Konto hochgeladen.</p><button type="button" class="btn small ghost" data-offline>Offline weiterspielen als ${esc(lastUser.name)}</button></div>`
        : `<div class="offline"><p>Du kannst trotzdem schon spielen. Dein Fortschritt bleibt auf diesem Gerät und wird übernommen, sobald du ein Konto erstellst.</p><button type="button" class="btn small ghost" data-offline>Offline spielen</button></div>`) : ''}
    </div>`;
  box.hidden = false;

  const forms = { login: $('loginForm'), register: $('registerForm'), forgot: $('forgotForm') };
  const setTab = (t) => {
    for (const b of box.querySelectorAll('.tabs [data-tab]')) { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t); }
    forms.login.hidden = t !== 'login'; forms.register.hidden = t !== 'register'; forms.forgot.hidden = t !== 'forgot';
    box.querySelector('.privacy').hidden = true;
  };
  setTab(tab);

  box.onclick = (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { setTab(t.dataset.tab); return; }
    const eye = e.target.closest('[data-eye]');
    if (eye) { const inp = eye.parentElement.querySelector('input'); inp.type = inp.type === 'password' ? 'text' : 'password'; eye.classList.toggle('on', inp.type === 'text'); return; }
    if (e.target.closest('[data-privacy]')) { e.preventDefault(); forms.login.hidden = forms.register.hidden = true; box.querySelector('.privacy').hidden = false; return; }
    if (e.target.closest('[data-privacy-close]')) { setTab('register'); return; }
    if (e.target.closest('[data-forgot]')) { setTab('forgot'); forms.forgot.querySelector('[name=login]').value = forms.login.querySelector('[name=login]').value; return; }
    if (e.target.closest('[data-sendcode]')) { sendCode(); return; }
    if (e.target.closest('[data-back-login]')) { setTab('login'); return; }
    if (e.target.closest('[data-offline]')) { unlock?.(); onOffline(); }
  };

  const sendCode = async () => {
    const f = forms.forgot, err = f.querySelector('.ferr'), btn = f.querySelector('[data-sendcode]');
    const login = f.querySelector('[name=login]').value.trim();
    if (!login) return (err.textContent = 'Bitte gib zuerst Spielername oder E-Mail ein.');
    btn.disabled = true; err.textContent = '';
    const r = await api.forgot(login);
    btn.disabled = false;
    if (!r.ok) return (err.textContent = r.message || 'Das hat nicht geklappt.');
    err.style.color = ''; err.textContent = r.mail ? 'Wenn es dieses Konto gibt, ist der Code jetzt per E-Mail unterwegs (auch im Spam-Ordner nachsehen). Er gilt 30 Minuten.' : 'Der E-Mail-Versand ist noch nicht eingerichtet. Bitte frag das BloomWorld-Team (z. B. über Freunde oder Social Media) nach einem Reset-Code – er gilt 30 Minuten.';
  };

  const submit = async (form, kind) => {
    const err = form.querySelector('.ferr');
    const btn = form.querySelector('button[type=submit]');
    const d = Object.fromEntries(new FormData(form));
    d.remember = !!form.querySelector('[name=remember]')?.checked;
    err.textContent = '';
    // Prüfung im Browser (der Server prüft zusätzlich)
    if (kind === 'register') {
      const name = String(d.name || '').trim();
      if (name.length < 3 || name.length > 20) return (err.textContent = 'Der Spielername muss 3 bis 20 Zeichen lang sein.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email || '').trim())) return (err.textContent = 'Bitte gib eine gültige E-Mail-Adresse ein.');
      if (String(d.password || '').length < 8) return (err.textContent = 'Das Passwort muss mindestens 8 Zeichen lang sein.');
      if (!d.privacy) return (err.textContent = 'Bitte bestätige die Datenschutzhinweise.');
    } else if (kind === 'forgot') {
      if (!String(d.login || '').trim() || !String(d.code || '').trim()) return (err.textContent = 'Bitte gib Spielername/E-Mail und den Code ein.');
      if (String(d.password || '').length < 8) return (err.textContent = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.');
    } else if (!String(d.login || '').trim() || !d.password) return (err.textContent = 'Bitte gib Spielername oder E-Mail und dein Passwort ein.');
    unlock?.();
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Einen Moment …';
    const r = kind === 'register' ? await api.register(d) : kind === 'forgot' ? await api.resetPassword(d) : await api.login(d);
    btn.disabled = false; btn.textContent = label;
    if (!r.ok) {
      err.textContent = r.message || 'Das hat nicht geklappt. Bitte versuche es noch einmal.';
      if (r.error === 'email_taken') { setTab('login'); forms.login.querySelector('[name=login]').value = String(d.email || ''); forms.login.querySelector('.ferr').textContent = r.message; }
      return;
    }
    localStorage_set('bw_has_account', '1');
    localStorage_set('bw_autostart', kind === 'forgot' || d.remember ? '1' : '0');
    box.hidden = true; box.innerHTML = '';
    onDone(r.user, kind === 'register');
  };
  forms.register.onsubmit = (e) => { e.preventDefault(); submit(forms.register, 'register'); };
  forms.login.onsubmit = (e) => { e.preventDefault(); submit(forms.login, 'login'); };
  forms.forgot.onsubmit = (e) => { e.preventDefault(); submit(forms.forgot, 'forgot'); };
}

export function hideAuth() { const b = $('authBox'); b.hidden = true; b.innerHTML = ''; }

function localStorage_get(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorage_set(k, v) { try { localStorage.setItem(k, v); } catch { /* egal */ } }
