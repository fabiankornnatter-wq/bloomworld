"""BloomWorld Ende-zu-Ende-Test (Playwright, Chromium mit Software-WebGL).

Aufruf:  python3 tests/e2e.py <URL> <Screenshot-Ordner> [BreitexHöhe]
Prüft: Start, Pflanzen, Wachsen, Ernten, Menüs, Einstellungen, Tag/Nacht, Speichern beim Neuladen,
Fehlermeldungen, keine JavaScript-Fehler, keine leeren Knöpfe, nichts abgeschnitten.
"""
import sys, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1].rstrip('/')
OUT = sys.argv[2].rstrip('/') + '/'
W, H = (int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '390x844').split('x'))
results, errors = [], []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('OK   ' if ok else 'FEHL ') + name + (f'  [{detail}]' if detail else ''))


with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    mobile = W < 700
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile,
                        user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' if mobile else None)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    tag = f'{W}x{H}'

    def shot(n):
        pg.screenshot(path=f'{OUT}{tag}_{n}.png')

    def click(sel):
        pg.locator(sel).first.click()
        pg.wait_for_timeout(350)

    def tap_bed(i):
        pt = pg.evaluate(f'BW.world.bedCenterScreen({i})')
        x, y = pt[0], pt[1]
        hit = pg.evaluate(f'(() => {{ const e = document.elementFromPoint({x},{y}); return e.id || (e.closest("[id]") || {{}}).id; }})()')
        if hit != 'world':
            print('     Hinweis: Tipp-Punkt verdeckt von', hit)
        if mobile:
            pg.touchscreen.tap(x, y)
        else:
            pg.mouse.click(x, y)
        pg.wait_for_timeout(900)

    pg.goto(URL + '/?debug=1')
    pg.wait_for_selector('#playBtn:not([hidden])', timeout=90000)
    check('Ladebildschirm zeigt Spielen-Knopf', pg.locator('#playBtn').is_visible())
    shot('01_loader')
    click('#playBtn')
    pg.wait_for_timeout(900)
    shot('02_garden')
    check('Startmünzen 50', pg.evaluate('BW.state.coins') == 50, str(pg.evaluate('BW.state.coins')))

    # Pflanzen über Antippen eines Beetes
    tap_bed(4)
    try:
        pg.wait_for_selector('#sheet.open', timeout=5000)
    except Exception:
        pass
    check('Saat-Auswahl öffnet sich', pg.locator('#sheet.open').count() == 1)
    shot('03_sheet')
    click('#sheet .seed[data-id="daisy"]')
    check('Gänseblümchen gepflanzt', pg.evaluate('BW.state.beds[4].seed') == 'daisy')
    check('Münzen abgezogen', pg.evaluate('BW.state.coins') == 45)

    # gesperrte Pflanze und gesperrtes Beet
    tap_bed(0)
    click('#sheet .seed[data-id="sunflower"]')
    check('Fehlermeldung bei gesperrter Pflanze', 'Level' in pg.locator('#toast').inner_text())
    click('#sheet .seed[data-id="tulip"]')
    tap_bed(7)
    try:
        pg.wait_for_selector('#modal.open', timeout=5000)
    except Exception:
        pass
    check('Dialog für gesperrtes Beet', pg.locator('#modal.open').count() == 1)
    shot('04_locked')
    click('#modal [data-act="closeModal"]')
    check('Pflanzen auf gesperrtem Beet unmöglich', pg.evaluate('BW.state.beds[7].seed') is None)

    # Wachsen lassen und ernten
    pg.evaluate('BW.skip(25000)')
    pg.wait_for_timeout(600)
    shot('05_ready')
    check('Erntebereit-Blase sichtbar', pg.locator('#bub4.ready').count() == 1)
    coins = pg.evaluate('BW.state.coins')
    tap_bed(4)
    pg.wait_for_timeout(1300)
    check('Ernte bringt Münzen', pg.evaluate('BW.state.coins') > coins, f"{coins} -> {pg.evaluate('BW.state.coins')}")
    check('Sammlung gezählt', pg.evaluate('BW.state.collection.daisy && BW.state.collection.daisy.count') == 1)
    shot('06_harvested')

    # Alle Menüs
    for nav in ['collection', 'events', 'friends', 'shop']:
        click(f'#nav [data-nav="{nav}"]')
        check(f'Panel {nav} offen', pg.locator('#panel.open').count() == 1)
        shot(f'07_{nav}')
    for t in ['flowers', 'deco', 'animals']:
        click(f'#panel [data-act="tab"][data-id="{t}"]')
        shot(f'08_shop_{t}')
    # Deko kaufen ohne genug Geld -> Fehlermeldung, Münzen bleiben >= 0
    pg.evaluate('BW.state.coins = 10')
    click('#panel [data-act="tab"][data-id="deco"]')
    click('#panel [data-act="buyDeco"][data-id="bench"]')
    check('Kein Kauf ohne Münzen', 'bench' not in pg.evaluate('BW.state.deco') and pg.evaluate('BW.state.coins') == 10)
    pg.evaluate('BW.state.coins = 1000')
    click('#panel [data-act="tab"][data-id="deco"]')
    click('#panel [data-act="buyDeco"][data-id="lantern"]')
    check('Laterne gekauft', 'lantern' in pg.evaluate('BW.state.deco'))
    click('#panel [data-act="tab"][data-id="offers"]')
    click('#panel [data-act="gift"]')
    check('Tägliches Geschenk', pg.evaluate('BW.state.coins') == 1000 - 80 + 50, str(pg.evaluate('BW.state.coins')))
    click('#panel [data-act="iap"]')
    check('Echtgeld-Angebot zeigt Hinweis', 'nicht aktiv' in pg.locator('#modal').inner_text())
    click('#modal [data-act="closeModal"]')

    # Einstellungen
    click('#nav [data-nav="garden"]')
    click('#gearBtn')
    shot('09_settings')
    click('#panel [data-act="set"][data-key="cycle"][data-val="night"]')
    check('Immer Nacht gesetzt', pg.evaluate('BW.state.settings.cycle') == 'night')
    click('#nav [data-nav="garden"]')
    pg.wait_for_timeout(500)
    shot('10_night')
    check('Zeitanzeige Nacht', 'Nacht' in (pg.locator('#timePill').get_attribute('aria-label') or ''))
    click('#gearBtn')
    click('#panel [data-act="set"][data-key="cycle"][data-val="day"]')
    click('#panel [data-act="set"][data-key="quality"][data-val="low"]')
    check('Grafik sparsam', pg.evaluate('BW.world.r.quality') == 'low')
    click('#panel [data-act="toggle"][data-key="music"]')
    check('Musik umschaltbar', pg.evaluate('BW.state.settings.music') is False)
    click('#panel [data-act="set"][data-key="quality"][data-val="auto"]')
    click('#panel [data-act="set"][data-key="cycle"][data-val="auto"]')
    click('#nav [data-nav="garden"]')

    # leere Knöpfe?
    empty = pg.evaluate('''() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && !b.innerText.trim() && !b.querySelector('svg,img') && !b.getAttribute('aria-label') && !b.classList.contains('switch')).map(b => b.outerHTML.slice(0, 80))''')
    check('Keine leeren Knöpfe', not empty, json.dumps(empty)[:200])
    # abgeschnitten? (sichtbare Elemente außerhalb des Bildschirms)
    off = pg.evaluate(f'''() => [...document.querySelectorAll('#hud *, #nav button')].filter(e => {{ const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > {W} + 1 || r.bottom > {H} + 1); }}).map(e => e.id || e.className).slice(0, 5)''')
    check('Nichts abgeschnitten (HUD/Menü)', not off, json.dumps(off))

    # Neuladen: Spielstand bleibt
    tap_bed(1)
    check('Saat-Auswahl für Beet 2', pg.evaluate('BW.ui.sheetBed') == 1, str(pg.evaluate('BW.ui.sheetBed')))
    click('#sheet .seed[data-id="tulip"]')
    check('Tulpe in Beet 2', pg.evaluate('BW.state.beds[1].seed') == 'tulip')
    pg.evaluate('BW.save()')
    snap = pg.evaluate('({c: BW.state.coins, b: BW.state.beds[1].seed, d: BW.state.deco.slice()})')
    pg.reload()
    pg.wait_for_selector('#playBtn:not([hidden])', timeout=90000)
    click('#playBtn')
    after = pg.evaluate('({c: BW.state.coins, b: BW.state.beds[1].seed, d: BW.state.deco.slice()})')
    check('Spielstand nach Neuladen gleich', snap == after, f'{snap} / {after}')
    pg.wait_for_timeout(500)
    shot('11_reloaded')
    check('Keine JavaScript-Fehler', not errors, ' | '.join(errors)[:400])
    b.close()

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} Prüfungen bestanden')
sys.exit(1 if failed else 0)
