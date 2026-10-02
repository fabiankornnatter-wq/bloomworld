"""BloomWorld Ende-zu-Ende-Test (Playwright, Chromium mit Software-WebGL).

Aufruf:  python3 tests/e2e.py <URL> <Screenshot-Ordner> [BreitexHöhe]
Lokal:   node tests/devserver.mjs 8130   (Server mit Test-Datenbank im Speicher)
Prüft: Registrieren, Story, Pflanzen, Pflege (Dünger), Ernten, Event-Blätter, Bewässerung, Beet-Ausbau,
Gewächshaus & Zucht, Shop, Menüs, Einstellungen, Tag/Nacht, Abmelden + Anmelden mit Spielstand vom Server,
Offline-Modus, keine JavaScript-Fehler, keine leeren Knöpfe, nichts abgeschnitten.
"""
import sys, json, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1].rstrip('/')
OUT = sys.argv[2].rstrip('/') + '/'
W, H = (int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '390x844').split('x'))
results, errors = [], []
STAMP = str(int(time.time() * 1000))[-7:]
NAME, EMAIL, PW = 'Testgarten' + STAMP[-4:], f'test{STAMP}@example.com', 'blumen123'


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('OK   ' if ok else 'FEHL ') + name + (f'  [{detail}]' if detail else ''))


with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    mobile = W < 700
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile, bypass_csp=True,
                        user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' if mobile else None)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    # 401 beim absichtlich falschen Passwort ist erwartet
    pg.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' and 'status of 401' not in m.text else None)
    tag = f'{W}x{H}'
    ev = pg.evaluate

    def shot(n):
        pg.screenshot(path=f'{OUT}{tag}_{n}.png')

    def click(sel, wait=400):
        # force: einige Knöpfe pulsieren (Animation) und gelten sonst als „nicht stabil“
        pg.locator(sel).first.click(force=sel in ('#quest',) or '.ready' in sel)
        pg.wait_for_timeout(wait)

    def tap_at(x, y, wait=900):
        if mobile:
            pg.touchscreen.tap(x, y)
        else:
            pg.mouse.click(x, y)
        pg.wait_for_timeout(wait)

    def tap_bed(i, wait=900):
        pt = ev(f'BW.world.bedCenterScreen({i})')
        hit = ev(f'(() => {{ const e = document.elementFromPoint({pt[0]},{pt[1]}); return e.id || (e.closest("[id]") || {{}}).id; }})()')
        if hit != 'world':
            print('     Hinweis: Tipp-Punkt verdeckt von', hit)
        tap_at(pt[0], pt[1], wait)

    def settle():
        # Kamera-Fahrten abwarten (Software-Grafik im Test ist sehr langsam)
        pg.wait_for_function('!BW.world.camAnim', timeout=90000)
        pg.wait_for_timeout(200)

    def close_modals():
        for _ in range(6):
            if ev('BW.ui.modalOpen'):
                click('#modal .dlg .x', 450)
        pg.wait_for_timeout(300)

    def wait_game():
        pg.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=60000)
        pg.wait_for_timeout(800)

    # ---------- Registrieren ----------
    pg.goto(URL + '/?debug=1')
    pg.wait_for_selector('#authBox:not([hidden])', timeout=90000)
    check('Anmeldebildschirm erscheint', pg.locator('#registerForm').is_visible())
    shot('01_auth')
    pg.fill('#registerForm [name=name]', NAME)
    pg.fill('#registerForm [name=email]', EMAIL)
    pg.fill('#registerForm [name=password]', 'kurz')
    pg.check('#registerForm [name=privacy]')
    click('#registerForm button[type=submit]')
    check('Fehlermeldung bei zu kurzem Passwort', '8 Zeichen' in pg.locator('#registerForm .ferr').inner_text())
    pg.fill('#registerForm [name=password]', PW)
    click('#registerForm button[type=submit]', 200)
    wait_game()
    check('Nach Registrierung im Spiel', ev('BW.user && BW.user.name') == NAME, str(ev('BW.user')))
    pg.wait_for_timeout(1500)
    check('Tutorial beim ersten Start', pg.locator('#tut').count() == 1 and 'Garten' in pg.locator('#tut .tut-text').inner_text())
    shot('02_tutorial')
    click('#tut [data-tut=skip]', 1500)
    check('Tutorial übersprungen', pg.locator('#tut').count() == 0 and ev('BW.state.tutorialDone') == 1)
    check('Story-Einleitung von Ophelia', ev('BW.ui.modalOpen') and 'Ophelia' in pg.locator('#modal').inner_text())
    shot('02_intro')
    click('#modal [data-act=storyOk]', 500)
    check('Startmünzen 50', ev('BW.state.coins') == 50, str(ev('BW.state.coins')))
    check('24 Beete, 6 frei', ev('BW.state.beds.length') == 24 and ev('BW.state.beds.filter(b => !b.locked).length') == 6)
    check('Story-Anzeige sichtbar', pg.locator('#quest').is_visible())
    shot('03_garden')

    # ---------- Pflanzen ----------
    tap_bed(4)
    check('Saat-Auswahl öffnet sich', pg.locator('#sheet.open').count() == 1)
    check('Pflege-Werkzeuge im Saat-Menü', pg.locator('#sheet .tools').count() == 1)
    shot('04_seeds')
    click('#sheet [data-act=plant][data-id=daisy]', 600)
    check('Gänseblümchen gepflanzt', ev('BW.state.beds[4].seed') == 'daisy')
    check('Münzen abgezogen', ev('BW.state.coins') == 45)
    check('Story zählt mit (1/3)', ev('BW.state.story.count') == 1)
    tap_bed(1)
    click('#sheet [data-act=plantAll]', 700)
    check('Alle freien Beete bepflanzt', ev('BW.state.beds.filter(b => !b.locked && b.seed).length') == 6, str(ev('BW.state.beds.map(b => b.seed)')))
    check('Story-Aufgabe 1 erledigt', ev('BW.G.storyStatus(BW.state).done') is True)

    # Pflege-Leiste eines wachsenden Beetes
    tap_bed(0)
    check('Pflege-Leiste öffnet sich', ev('BW.ui.sheetKind') == 'care')
    shot('05_care')
    click('#sheet .x', 400)

    # Story-Belohnung über die Anzeige oben
    click('#quest', 700)
    check('Story-Belohnung im Dialog', ev('BW.ui.modalOpen') and 'Dünger' in pg.locator('#modal').inner_text())
    shot('06_story_reward')
    close_modals()
    check('Dünger erhalten', ev('BW.state.items.fert') == 1)

    # Dünger benutzen (Aufgabe 2)
    ev('BW.state.beds[2].plantedAt = Date.now(); BW.state.beds[2].dur = 60000')  # sicher noch wachsend (Software-Grafik ist langsam)
    tap_bed(2)
    before = ev('BW.state.beds[2].plantedAt')
    click('#sheet [data-act=useItem][data-id=fert]', 600)
    check('Dünger wirkt', ev('BW.state.beds[2].plantedAt') < before and ev('BW.state.items.fert') == 0)
    check('Story-Aufgabe 2 erledigt', ev('BW.G.storyStatus(BW.state).done') is True)
    if ev('BW.ui.sheetBed') >= 0:
        click('#sheet .x', 400)
    click('#quest', 600)
    close_modals()

    # ---------- Ernten + Herbstfest-Blätter ----------
    ev('BW.skip(25000)')
    pg.wait_for_timeout(900)
    check('Erntebereit-Blase sichtbar', pg.locator('#bub4.ready').count() == 1)
    shot('07_ready')
    coins = ev('BW.state.coins')
    click('#harvestAll', 1500)
    check('Alle ernten bringt Münzen', ev('BW.state.coins') > coins, f"{coins} -> {ev('BW.state.coins')}")
    check('Sammlung gezählt', (ev('BW.state.collection.daisy && BW.state.collection.daisy.count') or 0) >= 5)
    active = ev('!!BW.G.activeEvent(Date.now())')
    if active:
        check('Event-Blätter gesammelt', ev('BW.state.event.tokens') > 0, str(ev('BW.state.event')))
    close_modals()

    # ---------- Gesperrtes Beet ----------
    tap_bed(8)
    check('Dialog für gesperrtes Beet', ev('BW.ui.modalOpen'))
    close_modals()

    # ---------- Aufsteigen (Testhilfe) und neue Systeme ----------
    ev('BW.G.addXp(BW.state, 900); BW.G.addCoins(BW.state, 5000); BW.ui.refresh()')
    pg.wait_for_timeout(1500)
    close_modals()
    lvl = ev('BW.state.level')
    check('Level gestiegen', lvl >= 5, str(lvl))

    # Bedarf-Shop: Dünger-Paket kaufen
    click('#nav [data-nav=shop]', 600)
    click('#panel [data-act=tab][data-id=supplies]', 500)
    shot('08_shop_supplies')
    f0 = ev('BW.state.items.fert')
    click('#panel [data-act=buyPack][data-id=fert]', 500)
    check('Dünger-Paket gekauft', ev('BW.state.items.fert') == f0 + 5)
    # Bewässerung über den Platzier-Modus
    click('#panel [data-act=sprinklerMode]', 700)
    check('Platzier-Modus aktiv', pg.locator('#modeBar').is_visible())
    shot('09_mode')
    tap_bed(3)
    check('Bewässerung installiert', ev('BW.state.beds[3].sprinkler') is True)
    click('#modeBar [data-act=endMode]', 400)
    # Beet ausbauen über Pflege-Leiste
    tap_bed(3)
    if ev('BW.ui.sheetBed') == 3:
        click('#sheet [data-act=upgradeBed]', 600)
    check('Beet zum Steinbeet ausgebaut', ev('BW.state.beds[3].lvl') == 2, str(ev('BW.state.beds[3]')))
    if ev('BW.ui.sheetBed') >= 0:
        click('#sheet .x', 400)

    # Neues Beet freischalten
    tap_bed(6)
    if ev('BW.ui.modalOpen'):
        click('#modal [data-act=unlockBed]', 600)
    check('Beet 7 freigeschaltet', ev('BW.state.beds[6].locked') is False)

    # ---------- Gewächshaus & Zucht ----------
    ev("BW.state.collection.tulip = BW.state.collection.tulip || {count: 1, shiny: 0}; BW.ui.refresh()")
    click('#breedBtn', 700)
    check('Gewächshaus-Panel offen', ev('BW.ui.panel') == 'breed')
    click('#panel [data-act=restoreGH]', 700)
    check('Gewächshaus restauriert', ev('BW.state.greenhouse.unlocked') is True)
    shot('10_greenhouse')
    click('#panel [data-act=breed][data-id="0"]', 700)
    check('Züchtung läuft', ev('BW.state.greenhouse.job && BW.state.greenhouse.job.result') == 'rainbowTulip')
    click('#panel .x', 500)
    ev('BW.skip(200000)')
    pg.wait_for_timeout(2500)
    check('Gewächshaus-Blase zeigt fertige Züchtung', pg.locator(f'#bub24.ready').count() == 1)
    shot('11_breed_ready')
    tap_at(*ev("(() => { const r = document.querySelector('#bub24 .b').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()"))
    check('Regenbogentulpe gezüchtet', 'rainbowTulip' in ev('BW.state.bred'))
    check('Dialog „Neue Sorte“', ev('BW.ui.modalOpen') and 'Regenbogen' in pg.locator('#modal').inner_text().replace('­', ''))
    shot('12_new_variety')
    close_modals()

    # ---------- Gestalten: verschieben, drehen, Deko, Lager, Vergrößern ----------
    click('#editBtn', 600)
    check('Gestalten-Modus aktiv', pg.locator('#editBar').is_visible() and ev('!!BW.ui.edit'))
    target = ev("BW.G.findSpot(BW.state, {type: 'bed', i: 0}, [-1.5, 6.5])")
    ev(f"BW.world.focus(({target[0]} - 2.7) / 2, ({target[1]} - 2.1) / 2, 1.25)")
    settle()
    src = ev('BW.world.bedCenterScreen(0)')
    dst = ev(f'BW.world.screenOf([{target[0]} + 0.3, 0.56, {target[1]} + 0.3])')
    pg.mouse.move(src[0], src[1]); pg.mouse.down(); pg.wait_for_timeout(120)
    for k in range(1, 21):
        pg.mouse.move(src[0] + (dst[0] - src[0]) * k / 20, src[1] + (dst[1] - src[1]) * k / 20); pg.wait_for_timeout(30)
    # Perspektive: nachjustieren, bis die Vorschau auf dem Ziel liegt (so wie ein Spieler es am Bildschirm sieht)
    mx, my = dst
    for _ in range(8):
        pos = ev('BW.ui.edit && BW.ui.edit.pos')
        if not pos or (abs(pos[0] - target[0]) < 0.3 and abs(pos[1] - target[1]) < 0.3): break
        a = ev(f'BW.world.screenOf([{pos[0]}, 0, {pos[1]}])'); bq = ev(f'BW.world.screenOf([{target[0]}, 0, {target[1]}])')
        mx += bq[0] - a[0]; my += bq[1] - a[1]
        pg.mouse.move(mx, my); pg.wait_for_timeout(120)
    shot('12b_drag')
    pg.mouse.up(); pg.wait_for_timeout(600)
    moved = ev('BW.state.layout.beds[0]')
    check('Beet per Ziehen verschoben', abs(moved[0] - target[0]) < 0.6 and abs(moved[1] - target[1]) < 0.6, f'{moved} / Ziel {target}')
    check('Neue Position ist gültig', ev('(() => { const p = BW.state.layout.beds[0]; return BW.G.canPlace(BW.state, {type: "bed", i: 0}, p[0], p[1], p[2]).ok; })()'))
    click('#editBar [data-act=editRotate]', 500)
    check('Beet gedreht', ev('BW.state.layout.beds[0][2]') == 1)
    click('#editBar [data-act=editDeselect]', 300)
    n0 = ev('BW.state.decor.length')
    click('#editBar [data-act=editShop]', 600)
    click('#panel [data-act=buyDeco][data-id=bench]', 600)
    click('#panel [data-act=buyDeco][data-id=bench]', 600)
    check('Deko mehrfach gekauft', ev('BW.state.decor.length') == n0 + 2 and ev("BW.state.decor.filter(d => d.id === 'bench' && !d.stored).length") >= 2)
    click('#panel .x', 500)
    click('#editBtn', 500)
    k = ev('BW.state.decor.length - 1')
    ev(f"BW.world.focus(BW.state.decor[{k}].x, BW.state.decor[{k}].z, 0.8)")
    settle()
    pt = ev(f'BW.world.screenOf([BW.state.decor[{k}].x, 0.5, BW.state.decor[{k}].z])')
    tap_at(pt[0], pt[1], 600)
    check('Deko angetippt und ausgewählt', ev('BW.ui.edit && BW.ui.edit.sel && BW.ui.edit.sel.type') == 'deco', str(ev('BW.ui.edit && BW.ui.edit.sel')))
    shot('12c_deco_selected')
    if ev('BW.ui.edit && BW.ui.edit.sel && BW.ui.edit.sel.type') == 'deco':
        click('#editBar [data-act=editStoreSel]', 500)
    check('Deko eingelagert', ev('BW.state.decor.filter(d => d.stored).length') >= 1)
    click('#editBar [data-act=editStore]', 600)
    shot('12d_store')
    click('#sheet [data-act=storePlace]', 700)
    check('Deko aus dem Lager aufgestellt', ev('BW.state.decor.filter(d => d.stored).length') == 0)
    click('#editBar [data-act=editDeselect]', 300)
    click('#editBar [data-act=editLand]', 600)
    click('#modal [data-act=expandLand]', 1500)
    check('Garten vergrößert', ev('BW.state.land') == 1)
    shot('12e_land')
    click('#editBar [data-act=editDone]', 500)
    check('Gestalten-Modus beendet', not ev('BW.ui.edit') and pg.locator('#editBar').is_hidden())

    # ---------- Alle Menüs ----------
    panels = [('quests', ['story', 'daily', 'levels']), ('events', []), ('collection', ['flowers', 'shiny', 'animals', 'deco']), ('shop', ['supplies', 'flowers', 'deco', 'animals', 'daily']), ('friends', [])]
    for nav, tabs in panels:
        click(f'#nav [data-nav={nav}]', 600)
        check(f'Menü {nav} offen', ev('BW.ui.panel') == nav)
        shot(f'13_{nav}')
        for t in tabs:
            click(f'#panel [data-act=tab][data-id={t}]', 450)
            shot(f'13_{nav}_{t}')
    # Event-Meilenstein
    if active:
        ev('BW.state.event.total = Math.max(BW.state.event.total, 25); BW.state.event.tokens = Math.max(BW.state.event.tokens, 50); BW.ui.refresh()')
        click('#nav [data-nav=events]', 600)
        click('#panel [data-act=milestone][data-id="0"]', 600)
        check('Event-Belohnung abgeholt', 0 in ev('BW.state.event.claimed'))
        click('#panel [data-act=eventBuy][data-id=leafPile]', 600)
        check('Laubhaufen eingetauscht', 'leafPile' in ev('BW.state.deco'))
    # Echtgeld ausgeblendet (MONEY_ENABLED=false), Beete vergrößern
    click('#nav [data-nav=shop]', 500)
    check('Kein Echtgeld-Tab im Shop', pg.locator('#panel [data-act=tab][data-id=offers]').count() == 0 and 'Saisonpass' not in pg.locator('#panel').inner_text())
    ev('BW.state.coins += 2000; BW.state.level = Math.max(BW.state.level, 6); BW.ui.refresh()')
    r = ev('(() => { for (let i = 0; i < 6; i++) { const r = BW.actions.growBed(i); if (r) return i; } return -1; })()')
    check('Beet vergrößert (Mittel)', r >= 0 and ev(f'BW.state.beds[{r}].size') == 2, str(r))
    shot('13_bed_medium')
    close_modals()
    close_modals()

    # ---------- Einstellungen ----------
    click('#panel .x', 500)
    click('#gearBtn', 600)
    check('Konto in Einstellungen', NAME in pg.locator('#panel').inner_text())
    click('#panel [data-act=set][data-key=cycle][data-val=night]', 500)
    check('Immer Nacht gesetzt', ev('BW.state.settings.cycle') == 'night')
    click('#panel [data-act=set][data-key=quality][data-val=low]', 500)
    check('Grafik sparsam', ev('BW.world.r.quality') == 'low')
    shot('14_settings')
    click('#panel .x', 900)
    pg.wait_for_timeout(700)
    check('Zeitanzeige Nacht', 'Nacht' in (pg.locator('#timePill').get_attribute('aria-label') or ''))
    shot('15_night')

    # ---------- Oberfläche: nichts leer oder abgeschnitten ----------
    empty = ev("""[...document.querySelectorAll('button')].filter(b => b.offsetParent && !b.innerText.trim() && !b.querySelector('svg,img') && !b.getAttribute('aria-label')).map(b => b.outerHTML.slice(0, 80))""")
    check('Keine leeren Knöpfe', not empty, json.dumps(empty)[:200])
    off = ev("""(() => { const out = []; for (const el of document.querySelectorAll('#hud > *, #nav button, #side button, #quest')) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push(el.id || el.className); } return out; })()""")
    check('Nichts abgeschnitten (HUD/Menü)', not off, json.dumps(off))

    # ---------- Speichern auf dem Server, Abmelden, Anmelden ----------
    ev('BW.save(); BW.cloud.flush()')
    pg.wait_for_timeout(2500)
    snap = ev('JSON.stringify([BW.state.coins, BW.state.level, BW.state.bred, BW.state.beds.map(b => b.seed), BW.state.items])')
    server = ev("fetch('/api/save').then(r => r.json()).then(j => JSON.stringify([j.save.coins, j.save.level, j.save.bred, j.save.beds.map(b => b.seed), j.save.items]))")
    check('Spielstand liegt auf dem Server', server == snap, f'{server[:120]} / {snap[:120]}')
    # Gerätespeicher löschen -> Stand muss vom Server kommen
    ev('localStorage.clear()')
    if ev('BW.ui.panel'):
        click('#panel .x', 500)
    click('#gearBtn', 500)
    click('#panel [data-act=logout]', 400)
    click('#modal [data-act=modalOk]', 200)
    pg.wait_for_selector('#authBox:not([hidden])', timeout=60000)
    check('Nach Abmelden wieder Anmeldebildschirm', True)
    click('#authBox [data-tab=login]', 300)
    pg.fill('#loginForm [name=login]', NAME.lower())
    pg.fill('#loginForm [name=password]', 'falsch999')
    click('#loginForm button[type=submit]', 1200)
    check('Falsches Passwort wird abgelehnt', 'stimmt nicht' in pg.locator('#loginForm .ferr').inner_text())
    pg.fill('#loginForm [name=password]', PW)
    click('#loginForm button[type=submit]', 200)
    wait_game()
    after = ev('JSON.stringify([BW.state.coins, BW.state.level, BW.state.bred, BW.state.beds.map(b => b.seed), BW.state.items])')
    check('Spielstand nach Anmelden vom Server gleich', snap == after, f'{snap[:100]} / {after[:100]}')
    close_modals()
    shot('16_after_login')

    check('Keine JavaScript-Fehler', not errors, ' | '.join(errors)[:400])

    # ---------- Offline-Modus (Server nicht erreichbar) ----------
    ctx.close()
    ctx2 = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile, bypass_csp=True)
    pg2 = ctx2.new_page()
    pg2.route('**/api/**', lambda route: route.abort())
    pg2.goto(URL + '/?debug=1')
    pg2.wait_for_selector('#authBox [data-offline]', timeout=90000)
    check('Offline: Hinweis und „Offline spielen“', pg2.locator('#authBox .authwarn').is_visible())
    pg2.screenshot(path=f'{OUT}{tag}_17_offline.png')
    pg2.locator('#authBox [data-offline]').click()
    pg2.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=60000)
    check('Offline-Spiel startet', pg2.evaluate('BW.user') is None and pg2.evaluate('BW.state.coins') == 50)
    ctx2.close()
    b.close()

ok = sum(1 for _, o, _ in results if o)
print(f'\n{ok}/{len(results)} Prüfungen bestanden')
sys.exit(0 if ok == len(results) else 1)
