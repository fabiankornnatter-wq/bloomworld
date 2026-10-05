# Gartenhelfer: Knopf, freispielen, rufen, Hummel gießt, Restzeit, Pause.
# Aufruf: python3 tests/helper_e2e.py <URL> <Screenshot-Ordner>
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1].rstrip('/'); OUT = sys.argv[2].rstrip('/') + '/'
res = []
def check(n, ok, d=''):
    res.append(bool(ok)); print(('OK   ' if ok else 'FEHL ') + n + (f'  [{d}]' if d else ''))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, bypass_csp=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/api/**', lambda r: r.abort()); pg.goto(URL + '/?debug=1&notut=1')
    pg.wait_for_selector('#authBox [data-offline]', timeout=180000); pg.locator('#authBox [data-offline]').click()
    pg.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=120000); pg.wait_for_timeout(1500)
    check('Helfer-Knopf auf Level 1 versteckt', pg.locator('#helperBtn').is_hidden())
    pg.evaluate("BW.G.markIntroSeen(BW.state); BW.ui.modalQueue.length = 0; BW.ui.closeModal(); BW.state.coins = 20000; BW.state.level = 9; BW.ui.refresh()")
    pg.wait_for_timeout(800)
    check('Helfer-Knopf sichtbar mit Abzeichen', pg.locator('#helperBtn').is_visible() and pg.locator('#helperBadge').inner_text().strip() == '2')
    pg.locator('#helperBtn').click(); pg.wait_for_timeout(800)
    txt = pg.locator('#panel').inner_text()
    check('Fenster mit drei Helfern', 'Hummel Summsi' in txt and 'Gartenzwerg Gustav' in txt and 'Blütenfee Flora' in txt and 'ab Lv 13' in txt)
    pg.screenshot(path=OUT + 'helpers_locked.png')
    pg.locator('#panel [data-act=helperUnlock][data-id=bee]').click(); pg.wait_for_timeout(800)
    check('Hummel freigespielt', pg.evaluate('BW.state.helpers.bee.owned') and 'Hummel Summsi' in pg.locator('#modal').inner_text())
    # durstige Blume vorbereiten
    pg.evaluate("BW.state.beds[0].seed = null; BW.actions.plant(0, 'sunflower'); BW.skip(70_000)"); pg.wait_for_timeout(800)
    check('Sonnenblume hat Durst', pg.evaluate('BW.G.bedInfo(BW.state, 0, Date.now() + 70_000).thirsty'))
    pg.locator('#modal [data-act=helperCall]').click(); pg.wait_for_timeout(1200)
    check('Hummel im Einsatz', pg.evaluate('BW.G.activeHelpers(BW.state, Date.now() + 70_000).length') == 1)
    check('Hummel hat gegossen', pg.evaluate('BW.state.beds[0].drinks') == 1)
    check('Knopf zeigt Restzeit', ':' in pg.locator('#helperBtn span').inner_text())
    pg.evaluate("BW.ui.nav('helpers')"); pg.wait_for_timeout(1500)
    check('Restzeit im Fenster', 'Im Einsatz' in pg.locator('#panel').inner_text())
    pg.screenshot(path=OUT + 'helpers_active.png')
    pg.evaluate("BW.ui.closePanel()"); pg.wait_for_timeout(600); pg.screenshot(path=OUT + 'helpers_garden.png'); pg.evaluate("BW.ui.nav('helpers')"); pg.wait_for_timeout(600)
    pg.evaluate("BW.skip(16 * 60_000)"); pg.wait_for_timeout(2000)
    check('Danach Pause', 'Macht Pause' in pg.locator('#panel').inner_text() and pg.locator('#helperBtn span').inner_text() == 'Helfer')
    pg.evaluate("BW.skip(2 * 3600_000)"); pg.wait_for_timeout(1500)
    check('Wieder bereit', 'Bereit!' in pg.locator('#panel').inner_text())
    check('Kein JS-Fehler', not errs, '; '.join(errs)[:300])
    b.close()
print(f'{sum(res)}/{len(res)} bestanden')
sys.exit(0 if all(res) else 1)
