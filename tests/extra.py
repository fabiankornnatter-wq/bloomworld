import json
from playwright.sync_api import sync_playwright
SH = "/tmp/claude-0/-home-claude/976e62ea-8c11-5029-9a5e-7136e160fe6a/scratchpad/shots/"
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
res = []
def check(n, ok, d=''):
    res.append(ok); print(('OK   ' if ok else 'FEHL ') + n + (f'  [{d}]' if d else ''))

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    # 1) Querformat-Handy
    pg = b.new_page(viewport={'width': 740, 'height': 340}, is_mobile=True, has_touch=True)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/?debug=1')
    pg.wait_for_selector('#playBtn:not([hidden])', timeout=90000)
    pg.locator('#playBtn').scroll_into_view_if_needed()
    bb = pg.locator('#playBtn').bounding_box()
    check('Querformat: Spielen-Knopf erreichbar', bb and bb['y'] >= 0, str(bb))
    pg.locator('#playBtn').click(); pg.wait_for_timeout(800)
    pg.evaluate('BW.state.tutorial = 2; BW.ui.openSeedSheet(4)'); pg.wait_for_timeout(3500)
    top = pg.evaluate("document.querySelector('#sheet .inner').getBoundingClientRect().top")
    check('Querformat: Saat-Auswahl oben sichtbar', 0 <= top < 340, str(top))
    pg.screenshot(path=SH + 'land_sheet.png')
    pg.evaluate("BW.ui.closeSheet(); BW.ui.levelUp({level: 3, reward: 65, unlocks: ['lavender']})"); pg.wait_for_timeout(600)
    pg.locator('#modal [data-act="closeModal"].btn').scroll_into_view_if_needed()
    bb = pg.locator('#modal [data-act="closeModal"].btn').bounding_box()
    check('Querformat: Dialog-Knopf erreichbar', bb and bb['y'] + bb['height'] <= 340 and bb['y'] >= 0, str(bb))
    pg.screenshot(path=SH + 'land_modal.png')
    pg.locator('#modal [data-act="closeModal"].btn').click()
    check('Querformat: keine Fehler', not errs, '|'.join(errs))
    pg.close()

    # 2) Zurück-Taste, Tastatur, Grafik-Verlust, Mehrfach-Ernte, Reset
    pg = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/?debug=1')
    pg.wait_for_selector('#playBtn:not([hidden])', timeout=90000)
    pg.locator('#playBtn').click(); pg.wait_for_timeout(800)
    pg.locator('#nav [data-nav="shop"]').click(); pg.wait_for_timeout(400)
    pg.go_back(); pg.wait_for_timeout(600)
    check('Zurück-Taste schließt Shop, Spiel bleibt offen', pg.locator('#panel.open').count() == 0 and 'localhost' in pg.url)
    check('Geschlossenes Menü ist für Tastatur gesperrt', pg.evaluate("document.getElementById('panel').inert") is True)
    pg.evaluate('BW.ui.openSeedSheet(2)'); pg.wait_for_timeout(300)
    pg.go_back(); pg.wait_for_timeout(500)
    check('Zurück-Taste schließt Saat-Auswahl', pg.evaluate('BW.ui.sheetBed') == -1)
    # Mehrfach-Ernte mit Doppeltipp
    pg.evaluate('''() => { const s = BW.state; s.tutorial = 2; for (let i = 0; i < 6; i++) { s.beds[i].seed = 'daisy'; s.beds[i].plantedAt = Date.now() - 3600000; s.beds[i].golden = false; } }''')
    c0 = pg.evaluate('BW.state.coins')
    pg.evaluate('BW.actions.harvestAll(); BW.actions.harvestAll();'); pg.wait_for_timeout(300)
    c1 = pg.evaluate('BW.state.coins')
    toast = pg.locator('#toast').inner_text()
    check('Alle ernten: genau 6 × 12 Münzen, kein Fehler-Hinweis bei Doppeltipp', c1 - c0 == 72 and 'leer' not in toast, f'{c0}->{c1} toast={toast!r}')
    # Level-Aufstieg + Reset: kein verspäteter Dialog im neuen Spiel
    pg.evaluate('''() => { const s = BW.state; s.xp = 19; s.beds[0].seed = 'tulip'; s.beds[0].plantedAt = Date.now() - 3600000; BW.actions.harvest(0); BW.actions.reset(); }''')
    pg.wait_for_timeout(1600)
    check('Nach Reset kein alter Level-Dialog', pg.locator('#modal.open').count() == 0 and pg.evaluate('BW.state.level') == 1)
    check('Nach Reset Grafik wieder automatisch', pg.evaluate('BW.state.settings.quality') == 'auto')
    # Grafik-Verlust
    pg.evaluate("document.getElementById('world').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    pg.wait_for_timeout(800)
    vis = pg.evaluate("(() => { const l = document.getElementById('loader'); return !l.hidden && getComputedStyle(l).display !== 'none' && !document.getElementById('playBtn').hidden; })()")
    check('Grafik-Verlust zeigt Meldung mit „Erneut versuchen“', vis, pg.locator('#lmsg').inner_text()[:80])
    pg.screenshot(path=SH + 'ctxlost.png')
    check('Keine JS-Fehler', not errs, '|'.join(errs)[:300])
    pg.close()

    # 3) Zwei Tabs: alter Tab überschreibt keinen neueren Stand
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    A = ctx.new_page(); A.goto('http://localhost:8123/?debug=1'); A.wait_for_selector('#playBtn:not([hidden])', timeout=90000); A.locator('#playBtn').click()
    B = ctx.new_page(); B.goto('http://localhost:8123/?debug=1'); B.wait_for_selector('#playBtn:not([hidden])', timeout=90000); B.locator('#playBtn').click()
    B.evaluate('BW.state.coins = 772; BW.actions.setting("cycle", "day"); BW.save()'); B.wait_for_timeout(600)
    A.wait_for_timeout(600)
    a_coins = A.evaluate('BW.state.coins')
    A.close(); B.wait_for_timeout(300)
    stored = B.evaluate("JSON.parse(localStorage.getItem('bloomworld_save_v2')).coins")
    check('Zwei Tabs: Speicherstand bleibt der neuere (772)', stored == 772, f'gespeichert={stored}, Tab A übernahm={a_coins}')
    ctx.close()

    # 4) Gesperrter Speicher
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    pg.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });")
    pg.goto('http://localhost:8123/?debug=1')
    try:
        pg.wait_for_selector('#playBtn:not([hidden])', timeout=60000); ok = True
    except Exception:
        ok = False
    check('Gesperrter Speicher: Spiel startet trotzdem mit Hinweis', ok and 'blockiert' in pg.locator('#toast').inner_text(), pg.locator('#toast').inner_text()[:80] if ok else 'kein Start')
    ctx.close()
    b.close()
print(f'{sum(res)}/{len(res)} bestanden')
