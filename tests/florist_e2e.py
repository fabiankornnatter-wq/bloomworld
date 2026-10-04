# Blumenbinderei: einrichten, binden, abholen, Wunsch erfüllen, verkaufen.
# Aufruf: python3 tests/florist_e2e.py <URL> <Screenshot-Ordner>
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
    pg.evaluate("BW.G.markIntroSeen(BW.state); BW.ui.modalQueue.length = 0; BW.ui.closeModal(); BW.state.coins = 20000; BW.state.level = 8; BW.state.basket = { daisy: 8, cornflower: 4, tulip: 4, sunflower: 3 }; BW.ui.refresh()")
    pg.wait_for_timeout(800)
    pg.evaluate("BW.ui.nav('trader', 'florist')"); pg.wait_for_timeout(800)
    check('Reiter Binderei', 'Der alte Schuppen' in pg.locator('#panel').inner_text())
    pg.screenshot(path=OUT + 'florist_build.png')
    pg.locator('#panel [data-act=flBuild]').click(); pg.wait_for_timeout(800)
    check('Eingerichtet', pg.evaluate('BW.state.florist.built') and pg.evaluate('BW.state.florist.wishes.length') >= 2)
    pg.locator('#panel [data-act=flBind][data-id=meadow]').click(); pg.wait_for_timeout(800)
    check('Wiesenstrauß wird gebunden', pg.evaluate("BW.state.florist.jobs[0]?.b") == 'meadow' and pg.evaluate("BW.state.basket.daisy") == 4)
    check('Restzeit sichtbar', 'Noch' in pg.locator('#panel .flslot').first.inner_text())
    pg.screenshot(path=OUT + 'florist_binding.png')
    pg.evaluate("BW.skip(3 * 60_000)"); pg.wait_for_timeout(1500)
    check('Abzeichen am Händler', pg.locator('#traderBadge').inner_text().strip() not in ('', '0'))
    pg.locator('#panel [data-act=flCollect]').click(); pg.wait_for_timeout(800)
    check('Im Regal', pg.evaluate("BW.state.florist.stock.meadow") == 1 and pg.evaluate("BW.state.stats.bouquets") == 1)
    w = pg.evaluate("BW.state.florist.wishes[0].b")
    pg.evaluate(f"BW.state.florist.stock['{w}'] = (BW.state.florist.stock['{w}'] || 0) + 1; BW.ui.refresh()"); pg.wait_for_timeout(400)
    c0 = pg.evaluate('BW.state.coins')
    pg.locator('#panel [data-act=flWish][data-id="0"]').click(); pg.wait_for_timeout(800)
    check('Wunsch erfüllt', pg.evaluate("BW.state.florist.wishes[0].done") and pg.evaluate('BW.state.coins') > c0)
    pg.screenshot(path=OUT + 'florist_shop.png', full_page=True)
    if pg.evaluate("BW.state.florist.stock.meadow"):
        c1 = pg.evaluate('BW.state.coins')
        pg.locator('#panel [data-act=flSell][data-id=meadow]').first.click(); pg.wait_for_timeout(600)
        check('Strauß verkauft', pg.evaluate('BW.state.coins') > c1)
    pg.evaluate("BW.ui.nav('trader', 'market')"); pg.wait_for_timeout(600)
    check('Händler-Reiter weiterhin da', 'Bestellungen' in pg.locator('#panel').inner_text())
    check('Kein JS-Fehler', not errs, '; '.join(errs)[:300])
    b.close()
print(f'{sum(res)}/{len(res)} bestanden')
sys.exit(0 if all(res) else 1)
