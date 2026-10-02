// Mini-Tutorial für neue Spieler: abgedunkelter Bildschirm, ein Ausschnitt bleibt hell, Ophelia erklärt.
// Läuft nur beim allerersten Start (tutorial < 2) und lässt sich jederzeit überspringen.
const $ = (id) => document.getElementById(id);

// Schritte: target = Funktion, die ein Element oder ein Rechteck liefert; done = wann weiter
const STEPS = [
  { id: 'bed', text: 'Das ist dein Garten! Tippe auf das Beet mit dem <b>+</b>, um deine erste Blume zu pflanzen.', target: (api) => api.firstEmptyBubble(), done: (api) => api.ui.sheetKind === 'seed' || api.state.stats.planted > 0 },
  { id: 'seed', text: 'Wähle das <b>Gänseblümchen</b> – es wächst in 20 Sekunden und braucht kein Wasser.', target: () => $('sheet')?.querySelector('[data-id="daisy"]'), done: (api) => api.state.stats.planted > 0, skipIf: (api) => api.state.stats.planted > 0 },
  { id: 'wait', text: 'Super! Die Blume wächst jetzt – auch wenn du das Spiel schließt. Pflanz ruhig noch ein paar, dann warten wir kurz auf die Ernte.', target: (api) => api.firstGrowingBubble(), done: (api) => api.state.stats.harvested > 0 || api.readyCount() > 0, pad: 30 },
  { id: 'harvest', text: 'Sie blüht! Tippe auf die <b>Blüte</b> über dem Beet, um zu ernten. Dafür gibt es Münzen und Erfahrung.', target: (api) => api.firstReadyBubble(), done: (api) => api.state.stats.harvested > 0, pad: 30 },
  { id: 'coins', text: 'Deine Münzen stehen hier oben. Damit kaufst du Saatgut, neue Beete und Deko.', target: () => $('coinPill'), done: null, pad: 10 },
  { id: 'quests', text: 'Ich gebe dir Aufgaben – die Belohnungen helfen am Anfang sehr. Tippe hier, wenn du nicht weiterweißt.', target: () => $('quest'), done: null, pad: 10 },
  { id: 'water', text: 'Manche Blumen bekommen <b>Durst</b>: Dann erscheint ein Tropfen über dem Beet – antippen und sie wächst weiter. Viel Spaß in deinem Garten! 🌸', target: null, done: null },
];

export class Tutorial {
  constructor(api) { this.api = api; this.step = -1; this.el = null; this.raf = 0; }

  get active() { return this.step >= 0; }

  start() {
    if (this.active) return;
    const el = document.createElement('div');
    el.id = 'tut';
    el.innerHTML = `<div class="tut-hole"></div><div class="tut-card"><img alt="" class="tut-owl"><div class="tut-text"></div><div class="tut-btns"><button class="btn small ghost" data-tut="skip">Überspringen</button><button class="btn small" data-tut="next">Weiter</button></div></div>`;
    el.querySelector('.tut-owl').src = this.api.owlIcon;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tut]');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.tut === 'skip') this.end(true); else this.next();
    });
    document.body.appendChild(el);
    this.el = el;
    this.step = -1;
    this.next();
    const tick = () => { if (!this.active) return; this.layout(); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }

  next() {
    let s = this.step + 1;
    while (STEPS[s] && STEPS[s].skipIf?.(this.api)) s++;
    if (!STEPS[s]) { this.end(false); return; }
    this.step = s;
    const st = STEPS[s];
    this.el.querySelector('.tut-text').innerHTML = st.text;
    this.el.querySelector('[data-tut=next]').hidden = !!st.done; // bei Aktions-Schritten geht es automatisch weiter
    this.el.classList.toggle('free', !st.target);
    this.layout(true);
  }

  // Loch um das Ziel legen; Karte oben oder unten davon
  layout(force) {
    const st = STEPS[this.step];
    if (!st) return;
    if (st.done && st.done(this.api)) { this.next(); return; }
    const hole = this.el.querySelector('.tut-hole'), card = this.el.querySelector('.tut-card');
    const t = st.target ? st.target(this.api) : null;
    let r = null;
    if (t instanceof Element) { if (!t.hidden) r = t.getBoundingClientRect(); }
    else if (Array.isArray(t)) r = { left: t[0] - 40, top: t[1] - 60, width: 80, height: 80 };
    if (!r || r.width === 0) { hole.style.display = 'none'; card.style.top = ''; card.style.bottom = '18%'; return; }
    const pad = st.pad ?? 8;
    hole.style.display = '';
    Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const below = r.top + r.height / 2 < innerHeight * 0.45;
    if (below) { card.style.top = `${Math.min(innerHeight - 200, r.top + r.height + pad + 14)}px`; card.style.bottom = ''; }
    else { card.style.bottom = `${Math.max(90, innerHeight - r.top + pad + 14)}px`; card.style.top = ''; }
    void force;
  }

  end(skipped) {
    cancelAnimationFrame(this.raf);
    this.step = -1;
    this.el?.remove(); this.el = null;
    this.api.onEnd?.(skipped);
  }
}
