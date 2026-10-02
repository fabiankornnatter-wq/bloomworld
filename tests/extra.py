"""Zusatztests: Querformat, Zurück-Taste, Doppeltipps, Reset, Grafik-Verlust, mehrere Tabs,
gesperrter Speicher, zwei Geräte mit demselben Konto.
Aufruf: python3 tests/extra.py <URL> <Screenshot-Ordner>   (lokal mit node tests/devserver.mjs 8130)
"""
import sys, time
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8130').rstrip('/')
SH = (sys.argv[2] if len(sys.argv) > 2 else '.').rstrip('/') + '/'
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
res = []


def check(n, ok, d=''):
    res.append(bool(ok)); print(('OK   ' if ok else 'FEHL ') + n + (f'  [{d}]' if d else ''))


def start_offline(pg):
    pg.bring_to_front()
    pg.route('**/api/**', lambda r: r.abort())
    pg.goto(URL + '/?debug=1&notut=1')
    pg.wait_for_selector('#authBox [data-offline]', timeout=90000)
    pg.locator('#authBox [data-offline]').click()
    pg.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=60000)
    pg.wait_for_timeout(700)
    pg.evaluate('BW.G.markIntroSeen(BW.state); BW.state.tutorialDone = 1; BW.ui.closeModal()')
    pg.wait_for_timeout(400)


def login(pg, ident, pw, register=None):
    pg.goto(URL + '/?debug=1&notut=1')
    pg.wait_for_selector('#authBox:not([hidden])', timeout=90000)
    if register:
        pg.locator('#authBox [data-tab=register]').click()
        pg.fill('#registerForm [name=name]', register)
        pg.fill('#registerForm [name=email]', ident)
        pg.fill('#registerForm [name=password]', pw)
        pg.check('#registerForm [name=privacy]')
        pg.locator('#registerForm button[type=submit]').click()
    else:
        pg.locator('#authBox [data-tab=login]').click()
        pg.fill('#loginForm [name=login]', ident)
        pg.fill('#loginForm [name=password]', pw)
        pg.locator('#loginForm button[type=submit]').click()
    pg.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=60000)
    pg.wait_for_timeout(700)
    pg.evaluate('BW.G.markIntroSeen(BW.state); BW.state.tutorialDone = 1; BW.ui.closeModal()')
    pg.wait_for_timeout(400)


with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)

    # 1) Querformat-Handy
    ctx = b.new_context(viewport={'width': 740, 'height': 340}, is_mobile=True, has_touch=True, bypass_csp=True)
    pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/api/**', lambda r: r.abort())
    pg.goto(URL + '/?debug=1&notut=1')
    pg.wait_for_selector('#authBox [data-offline]', timeout=90000)
    pg.locator('#authBox [data-offline]').scroll_into_view_if_needed()
    bb = pg.locator('#authBox [data-offline]').bounding_box()
    check('Querformat: Offline-Knopf erreichbar', bb and bb['y'] >= 0, str(bb))
    pg.screenshot(path=SH + 'land_auth.png')
    pg.locator('#authBox [data-offline]').click()
    pg.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=60000)
    pg.wait_for_timeout(600)
    pg.evaluate('BW.G.markIntroSeen(BW.state); BW.state.tutorialDone = 1; BW.ui.closeModal(); BW.state.tutorial = 2; BW.ui.openSeedSheet(4)'); pg.wait_for_timeout(1500)
    top = pg.evaluate("document.querySelector('#sheet .inner').getBoundingClientRect().top")
    check('Querformat: Saat-Auswahl oben sichtbar', 0 <= top < 340, str(top))
    pg.screenshot(path=SH + 'land_sheet.png')
    pg.evaluate("BW.ui.closeSheet(); BW.ui.levelUp({level: 3, reward: 65, items: {fert: 2}, unlocks: [{kind: 'seed', id: 'lavender', label: 'Lavendel pflanzbar'}]})"); pg.wait_for_timeout(600)
    pg.locator('#modal [data-act="closeModal"].btn').scroll_into_view_if_needed()
    bb = pg.locator('#modal [data-act="closeModal"].btn').bounding_box()
    check('Querformat: Dialog-Knopf erreichbar', bb and bb['y'] + bb['height'] <= 340 and bb['y'] >= 0, str(bb))
    pg.screenshot(path=SH + 'land_modal.png')
    pg.locator('#modal [data-act="closeModal"].btn').click()
    check('Querformat: keine Fehler', not errs, '|'.join(errs))
    ctx.close()

    # 2) Zurück-Taste, Platzier-Modus, Doppeltipps, Reset, Grafik-Verlust
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, bypass_csp=True)
    pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    start_offline(pg)
    pg.locator('#nav [data-nav="shop"]').click(); pg.wait_for_timeout(400)
    pg.go_back(); pg.wait_for_timeout(600)
    check('Zurück-Taste schließt Shop, Spiel bleibt offen', pg.locator('#panel.open').count() == 0 and 'localhost' in pg.url)
    check('Geschlossenes Menü ist für Tastatur gesperrt', pg.evaluate("document.getElementById('panel').inert") is True)
    pg.evaluate('BW.ui.openSeedSheet(2)'); pg.wait_for_timeout(300)
    pg.go_back(); pg.wait_for_timeout(500)
    check('Zurück-Taste schließt Saat-Auswahl', pg.evaluate('BW.ui.sheetBed') == -1)
    pg.evaluate("BW.state.level = 5; BW.ui.setMode({kind: 'sprinkler'})"); pg.wait_for_timeout(300)
    pg.go_back(); pg.wait_for_timeout(500)
    check('Zurück-Taste beendet Platzier-Modus', pg.evaluate('BW.ui.mode') is None and pg.locator('#modeBar').is_hidden())
    pg.evaluate("BW.actions.toggleEdit(true)"); pg.wait_for_timeout(300)
    pg.go_back(); pg.wait_for_timeout(500)
    check('Zurück-Taste beendet Gestalten-Modus', pg.evaluate('BW.ui.edit') is None and pg.locator('#editBar').is_hidden())
    # Tippen auf ein Beet darf nicht durch die sich öffnende Leiste hindurch pflanzen
    pg.evaluate('BW.state.level = 1; BW.state.tutorial = 2; BW.ui.refresh()')
    for i in (4, 1):
        pt = pg.evaluate(f'BW.world.bedCenterScreen({i})')
        pg.touchscreen.tap(pt[0], pt[1]); pg.wait_for_timeout(900)
        if i == 4:
            pg.locator('#sheet [data-act=plant][data-id=daisy]').click(); pg.wait_for_timeout(600)
    check('Kein Geister-Tipp in der Saat-Auswahl', pg.evaluate('BW.state.beds[1].seed') is None and pg.evaluate('BW.ui.sheetBed') == 1)
    pg.evaluate('BW.ui.closeSheet()')
    # Mehrfach-Ernte mit Doppeltipp
    pg.evaluate('''() => { const s = BW.state; for (let i = 0; i < 6; i++) { s.beds[i].seed = 'daisy'; s.beds[i].plantedAt = Date.now() - 3600000; s.beds[i].dur = 20000; s.beds[i].shiny = false; s.beds[i].lvl = 1; } }''')
    c0 = pg.evaluate('BW.state.coins')
    pg.evaluate('BW.actions.harvestAll(); BW.actions.harvestAll();'); pg.wait_for_timeout(300)
    c1 = pg.evaluate('BW.state.coins')
    toast = pg.locator('#toast').inner_text()
    check('Alle ernten: genau 6 × 12 Münzen, kein Fehler-Hinweis bei Doppeltipp', c1 - c0 == 72 and 'leer' not in toast, f'{c0}->{c1} toast={toast!r}')
    # Level-Aufstieg + Reset: kein verspäteter Dialog im neuen Spiel
    pg.evaluate('''() => { const s = BW.state; s.xp = 29; s.beds[0].seed = 'tulip'; s.beds[0].plantedAt = Date.now() - 3600000; s.beds[0].dur = 45000; BW.actions.harvest(0); BW.actions.reset(); }''')
    pg.wait_for_timeout(1600)
    check('Nach Reset kein alter Level-Dialog', not pg.evaluate('BW.ui.modalOpen') or 'Kapitel' in pg.locator('#modal').inner_text(), pg.locator('#modal').inner_text()[:60])
    check('Nach Reset Level 1 und Grafik automatisch', pg.evaluate('BW.state.level') == 1 and pg.evaluate('BW.state.settings.quality') == 'auto')
    pg.evaluate("document.getElementById('world').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    pg.wait_for_timeout(800)
    vis = pg.evaluate("(() => { const l = document.getElementById('loader'); return !l.hidden && getComputedStyle(l).display !== 'none' && !document.getElementById('playBtn').hidden; })()")
    check('Grafik-Verlust zeigt Meldung mit „Erneut versuchen“', vis, pg.locator('#lmsg').inner_text()[:80])
    check('Keine JS-Fehler', not errs, '|'.join(errs)[:300])
    ctx.close()

    # 3) Zwei Tabs (offline): alter Tab überschreibt keinen neueren Stand
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True)
    A = ctx.new_page(); start_offline(A)
    A.evaluate("BW.ui.nav('shop')")  # Menü offen = Tab A rendert nicht (Software-Grafik ist sonst zu langsam für zwei Tabs)
    B = ctx.new_page(); start_offline(B)
    B.evaluate('BW.state.coins = 772; BW.actions.setting("cycle", "day"); BW.save()'); B.wait_for_timeout(600)
    A.wait_for_timeout(600)
    a_coins = A.evaluate('BW.state.coins')
    A.close(); B.wait_for_timeout(300)
    stored = B.evaluate("JSON.parse(localStorage.getItem('bloomworld_save_v2')).coins")
    check('Zwei Tabs: Speicherstand bleibt der neuere (772)', stored == 772, f'gespeichert={stored}, Tab A übernahm={a_coins}')
    ctx.close()

    # 4) Gesperrter Speicher
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True)
    pg = ctx.new_page()
    pg.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });")
    try:
        start_offline(pg); pg.wait_for_timeout(600); ok = True
    except Exception as e:
        ok = False; print(e)
    check('Gesperrter Speicher: Spiel startet trotzdem mit Hinweis', ok and 'blockiert' in pg.locator('#toast').inner_text(), pg.locator('#toast').inner_text()[:80] if ok else 'kein Start')
    ctx.close()

    # 5) Zwei Geräte, ein Konto: neuerer Stand gewinnt, nichts geht verloren
    st = str(int(time.time() * 1000))[-6:]
    email, name = f'geraet{st}@example.com', 'Zwei' + st
    A = b.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True).new_page()
    login(A, email, 'tulpen123', register=name)
    A.evaluate("BW.ui.nav('settings')")  # Tab A pausiert das Rendern (entlastet die Software-Grafik)
    B = b.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True).new_page()
    login(B, name, 'tulpen123')
    A.evaluate('BW.state.coins = 500; BW.actions.setting("cycle", "day"); BW.cloud.flush()'); A.wait_for_timeout(1500)
    B.evaluate('BW.state.coins = 321; BW.actions.setting("cycle", "night"); BW.cloud.flush()'); B.wait_for_timeout(2500)
    srv = B.evaluate("fetch('/api/save').then(r => r.json()).then(j => j.save.coins)")
    check('Zwei Geräte: neuerer Stand liegt auf dem Server', srv == 321, str(srv))
    # Gerät A wird wieder geöffnet (Tab sichtbar) -> lädt den neueren Stand
    A.evaluate('BW.cloud.checkRemote()'); A.wait_for_timeout(2000)
    check('Zwei Geräte: älteres Gerät übernimmt den neueren Stand', A.evaluate('BW.state.coins') == 321, str(A.evaluate('BW.state.coins')))
    # Beide spielen gleichzeitig: Stand mit mehr Spielaktionen gewinnt
    A.evaluate('for (let i = 0; i < 5; i++) BW.actions.setting("musicVol", 0.1 * i); BW.state.coins = 999; BW.cloud.flush()'); A.wait_for_timeout(2000)
    B.evaluate('BW.state.coins = 1; BW.actions.setting("soundVol", 0.4); BW.cloud.flush()'); B.wait_for_timeout(2500)
    check('Zwei Geräte: Stand mit mehr Fortschritt gewinnt', B.evaluate('BW.state.coins') == 999 and B.evaluate("fetch('/api/save').then(r => r.json()).then(j => j.save.coins)") == 999, str(B.evaluate('BW.state.coins')))
    # 6) Angemeldet bleiben: Neu laden startet direkt im Garten
    B.goto(URL + '/?debug=1&notut=1')
    B.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=90000)
    check('Angemeldet bleiben: direkt im Garten ohne Anmeldung', B.locator('#authBox').is_hidden() and B.evaluate('BW.user && BW.user.name') == name)
    A.context.close(); B.context.close()

    # 7) Gießen, Regenwolke, Zucht-Schwierigkeit
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, bypass_csp=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    start_offline(pg)
    pg.evaluate("BW.state.coins = 20000; BW.state.level = 12; BW.state.tutorial = 2; BW.actions.plant(0, 'sunflower'); BW.actions.plant(1, 'sunflower'); BW.actions.plant(2, 'sunflower')")
    dur = pg.evaluate('BW.state.beds[0].dur')
    pg.evaluate(f'BW.skip({dur} * 0.6)'); pg.wait_for_timeout(1200)
    check('Gießen: Durst-Blase erscheint', pg.locator('#bub0.thirsty').count() == 1 and 'Gießen' in pg.locator('#bub0').inner_text())
    pg.evaluate('BW.actions.tapBed(0)'); pg.wait_for_timeout(500)
    check('Gießen: Antippen gießt die Blume', pg.evaluate('BW.state.beds[0].drinks') == 1 and pg.evaluate('BW.state.stats.watered') == 1)
    pg.evaluate('BW.state.items.rain = 1')
    ha = pg.locator('#harvestAll')
    try: ha.wait_for(state='visible', timeout=8000)
    except Exception: pass
    check('Regenwolke-Knopf bei mehreren durstigen Blumen', ha.is_visible() and 'Regenwolke' in ha.inner_text(), ha.inner_text() if ha.is_visible() else 'unsichtbar')
    ha.click(); pg.wait_for_timeout(600)
    check('Regenwolke gießt alle', pg.evaluate('BW.state.beds[1].drinks + BW.state.beds[2].drinks') == 2 and pg.evaluate('BW.state.items.rain') == 0)
    pg.evaluate("BW.state.greenhouse.unlocked = true; for (const k of ['rose', 'orchid']) BW.state.collection[k] = { count: 5, shiny: 0 }; BW.state.items.pollen = 2; BW.ui.nav('breed')"); pg.wait_for_timeout(900)
    txt = pg.locator('#panel').inner_text()
    check('Zuchtbuch zeigt Schwierigkeit und Chance', pg.locator('#panel .diff.d3').count() >= 1 and pg.locator('#panel .diff.d5').count() == 1 and '60 %' in txt, txt[:120])
    pg.locator('#panel [data-act=togglePollen]').click(); pg.wait_for_timeout(500)
    check('Zauberpollen erhöht die Chance (+25 %)', '85 %' in pg.locator('#panel').inner_text())
    pg.screenshot(path=SH + 'x_breed_difficulty.png')
    pg.evaluate("BW.state.greenhouse.job = { a: 'rose', b: 'orchid', result: 'blackRose', start: 0, dur: 1000, chance: 0.6, success: false, cost: 250 }; BW.actions.collectBreed()"); pg.wait_for_timeout(700)
    mt = pg.locator('#modal').inner_text()
    check('Misslungene Züchtung: Hinweis, Erstattung, bessere Chance', 'Nicht gelungen' in mt and '75 %' in mt and 'blackRose' not in pg.evaluate('BW.state.bred'), mt[:100])
    pg.screenshot(path=SH + 'x_breed_failed.png')
    check('Gießen/Zucht: keine JS-Fehler', not errs, '|'.join(errs)[:300])
    b.close()
print(f'{sum(res)}/{len(res)} bestanden')
sys.exit(0 if all(res) else 1)
