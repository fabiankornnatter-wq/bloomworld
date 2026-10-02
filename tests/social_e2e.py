"""Zwei Spieler im Browser: Freundschaft, Chat, Geschenk, Gartenbesuch mit Gießen, Herz, Melden, Admin-Ankündigung.
Aufruf: python3 tests/social_e2e.py <URL> <Screenshot-Ordner>   (lokal mit frischem node tests/devserver.mjs 8130)
"""
import sys, time
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8130').rstrip('/')
SH = (sys.argv[2] if len(sys.argv) > 2 else '.').rstrip('/') + '/'
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
res = []
def check(n, ok, d=''):
    res.append(bool(ok)); print(('OK   ' if ok else 'FEHL ') + n + (f'  [{d}]' if d else ''))

def register(pg, name, email):
    pg.goto(URL + '/?debug=1')
    pg.wait_for_selector('#authBox:not([hidden])', timeout=90000)
    pg.locator('#authBox [data-tab=register]').click()
    pg.fill('#registerForm [name=name]', name)
    pg.fill('#registerForm [name=email]', email)
    pg.fill('#registerForm [name=password]', 'blumen123')
    pg.check('#registerForm [name=privacy]')
    pg.locator('#registerForm button[type=submit]').click()
    pg.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=90000)
    pg.wait_for_timeout(800)
    pg.evaluate('BW.G.markIntroSeen(BW.state); BW.ui.modalQueue.length = 0; BW.ui.closeModal()')

def sync(pg):
    pg.evaluate('BW.hub.tick()'); pg.wait_for_timeout(900)

st = str(int(time.time()))[-5:]
A_NAME, B_NAME = 'Anna' + st, 'Ben' + st
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    A = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, bypass_csp=True).new_page()
    B = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, bypass_csp=True).new_page()
    errs = []
    for pg in (A, B): pg.on('pageerror', lambda e: errs.append(str(e)))
    register(A, A_NAME, f'anna{st}@example.com')
    check('Erstes Konto ist Admin', A.evaluate('BW.user.admin') is True)
    A.evaluate("BW.ui.nav('friends')")
    register(B, B_NAME, f'ben{st}@example.com')
    check('Zweites Konto ist kein Admin', B.evaluate('BW.user.admin') is False)

    # Anfrage per Spielername
    A.fill('#panel [name=fname]', B_NAME)
    A.locator('#panel form[data-form=addFriend] button[type=submit]').click(); A.wait_for_timeout(1200)
    check('Anfrage gesendet', 'gesendet' in A.locator('#toast').inner_text(), A.locator('#toast').inner_text()[:80])
    B.evaluate("BW.ui.nav('friends')"); sync(B)
    check('Freunde-Abzeichen zeigt Anfrage', B.locator('#badge-friends').inner_text() == '1')
    B.screenshot(path=SH + 's1_request.png')
    B.locator('#panel [data-act=frAccept]').click(); B.wait_for_timeout(1200)
    sync(A)
    check('Beide sind Freunde', A.locator('#panel .card.friend').count() == 1 and B.locator('#panel .card.friend').count() == 1)
    A.screenshot(path=SH + 's2_friends.png')

    # Chat
    A.locator('#panel [data-act=openChat]').click(); A.wait_for_timeout(1200)
    A.fill('#panel [name=msg]', 'Hallo Ben! Schau mal auf www.spam.de 🌸')
    A.locator('#panel form[data-form=chat] button[type=submit]').click(); A.wait_for_timeout(1000)
    mine = A.locator('#chatList .msg.mine').last.inner_text()
    check('Eigene Nachricht erscheint, Link gefiltert', 'Hallo Ben' in mine and 'spam' not in mine, mine)
    sync(B)
    check('Ungelesen-Zähler beim Freund', '1' in B.locator('#panel .card.friend .dot').inner_text())
    B.locator('#panel [data-act=openChat]').click(); B.wait_for_timeout(1500)
    check('Freund liest die Nachricht', 'Hallo Ben' in B.locator('#chatList').inner_text())
    B.fill('#panel [name=msg]', 'Hi Anna, gern!')
    B.locator('#panel form[data-form=chat] button[type=submit]').click()
    A.wait_for_function("document.getElementById('chatList').innerText.includes('Hi Anna')", timeout=15000)
    check('Antwort kommt automatisch an (ohne Neuladen)', True)
    A.screenshot(path=SH + 's3_chat.png')

    # Melden
    B.locator('#chatList .msg:not(.mine) [data-act=reportMsg]').first.click(); B.wait_for_timeout(400)
    B.locator('#modal [data-act=reportYes]').click(); B.wait_for_timeout(1200)
    check('Melden bestätigt', 'gemeldet' in B.locator('#modal').inner_text())
    B.evaluate('BW.ui.closeModal()')

    # Geschenk
    A.locator('#panel [data-act=giftMenu]').first.click(); A.wait_for_timeout(500)
    A.screenshot(path=SH + 's4_gift.png')
    A.locator('#modal [data-act=sendGift][data-kind=fert]').click(); A.wait_for_timeout(1500)
    fert0 = B.evaluate('BW.state.items.fert')
    sync(B); B.wait_for_timeout(600)
    check('Geschenk kommt an (2× Dünger)', B.evaluate('BW.state.items.fert') == fert0 + 2, f'{fert0} -> {B.evaluate("BW.state.items.fert")}')

    # Bens Garten mit durstiger Sonnenblume, Anna besucht und gießt
    B.evaluate("BW.ui.nav('garden'); BW.state.coins = 999; BW.state.level = 3; BW.actions.plant(0, 'sunflower'); BW.state.beds[0].plantedAt -= BW.state.beds[0].dur * 0.6; BW.cloud.flush()")
    B.wait_for_timeout(1500)
    B.evaluate("BW.ui.nav('settings')")
    coins0 = A.evaluate('BW.state.coins')
    A.evaluate("BW.ui.nav('friends')"); A.wait_for_timeout(500)
    A.locator('#panel [data-act=visit]').first.click()
    A.wait_for_function('BW.visit && !document.getElementById("visitBar").hidden', timeout=20000)
    A.wait_for_timeout(1500)
    check('Besuchsleiste zeigt Freund', B_NAME in A.locator('#visitBar').inner_text())
    check('Eigene Knöpfe beim Besuch ausgeblendet', A.locator('#side').is_hidden() and A.locator('#nav').is_hidden())
    A.wait_for_selector('#bub0.thirsty', timeout=10000)
    A.screenshot(path=SH + 's5_visit.png')
    A.evaluate('BW.actions.visitWater(0)'); A.wait_for_timeout(2500)
    check('Gießen beim Freund belohnt', A.evaluate('BW.state.coins') == coins0 + 5, f'{coins0} -> {A.evaluate("BW.state.coins")}')
    check('Durst-Blase verschwindet', A.locator('#bub0.thirsty:not([hidden])').count() == 0)
    A.locator('#visitBar [data-act=likeGarden]').click(); A.wait_for_timeout(1200)
    check('Herz verschenkt', A.locator('#visitBar [data-act=likeGarden]').is_disabled())
    B.evaluate("BW.ui.nav('garden')"); coinsB = B.evaluate('BW.state.coins')
    sync(B); B.wait_for_timeout(800)
    check('Freund: Blume gegossen und Herz-Münzen', B.evaluate('BW.state.beds[0].drinks') == 1 and B.evaluate('BW.state.coins') == coinsB + 10, f"drinks={B.evaluate('BW.state.beds[0].drinks')} coins {coinsB}->{B.evaluate('BW.state.coins')}")
    A.locator('#visitBar [data-act=endVisit]').click(); A.wait_for_timeout(1000)
    check('Zurück im eigenen Garten', A.evaluate('BW.visit') is None and A.locator('#nav').is_visible())

    # Admin: Meldung sehen, Ankündigung veröffentlichen
    A.evaluate("BW.ui.nav('settings')"); A.wait_for_timeout(400)
    check('Admin-Bereich in Einstellungen', A.locator('#panel [data-act=openAdmin]').count() == 1)
    A.locator('#panel [data-act=openAdmin]').click(); A.wait_for_timeout(1500)
    A.evaluate("BW.ui.tab.admin = 'reports'; BW.ui.renderPanel()"); A.wait_for_timeout(300)
    check('Admin sieht gemeldete Nachricht', 'Hallo Ben' in A.locator('#panel').inner_text())
    A.screenshot(path=SH + 's6_admin_reports.png')
    A.evaluate("BW.ui.tab.admin = 'news'; BW.ui.renderPanel()"); A.wait_for_timeout(300)
    A.fill('#panel [name=title]', 'Freunde sind da!')
    A.fill('#panel [name=text]', 'Ab sofort könnt ihr euch besuchen, schreiben und beschenken.')
    A.locator('#panel form[data-form=news] button[type=submit]').click(); A.wait_for_timeout(1500)
    check('Ankündigung veröffentlicht', 'Freunde sind da!' in A.locator('#panel').inner_text())
    A.screenshot(path=SH + 's7_admin_news.png')
    B.evaluate("localStorage.setItem('bw_news_seen', '1')")
    B.goto(URL + '/?debug=1')
    B.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=90000)
    B.wait_for_timeout(2500)
    mt = B.locator('#modal').inner_text() if B.evaluate('BW.ui.modalOpen') else ''
    if 'Freunde sind da' not in mt:
        B.evaluate('BW.ui.closeModal()'); B.wait_for_timeout(600)
        mt = B.locator('#modal').inner_text() if B.evaluate('BW.ui.modalOpen') else ''
    check('Spieler sieht Ankündigung beim Start', 'Freunde sind da' in mt, mt[:80])
    B.screenshot(path=SH + 's8_news.png')
    # Admin-Werkzeuge: Spieler suchen, Reset-Code, Wartung, Event, Rechtstext
    A.evaluate("BW.ui.nav('settings')"); A.wait_for_timeout(300)
    A.locator('#panel [data-act=openAdmin]').click(); A.wait_for_timeout(1200)
    A.evaluate("BW.ui.tab.admin = 'support'; BW.ui.renderPanel()"); A.wait_for_timeout(300)
    A.fill('#panel [name=q]', B_NAME); A.locator('#panel form[data-form=findPlayer] button[type=submit]').click(); A.wait_for_timeout(1000)
    check('Admin findet Spieler', B_NAME in A.locator('#panel .card.player').inner_text())
    A.locator('#panel [data-act=adminResetCode]').click(); A.wait_for_timeout(1000)
    code = A.locator('#panel .codebox .code').inner_text().strip()
    check('Reset-Code erzeugt', len(code) >= 6, code)
    A.screenshot(path=SH + 's9_admin_support.png')
    A.evaluate("BW.ui.tab.admin = 'tools'; BW.ui.renderPanel()"); A.wait_for_timeout(300)
    A.fill('#panel form[data-form=maint] [name=text]', 'Testwartung')
    A.locator('#panel form[data-form=maint] button[value="1"]').click(); A.wait_for_timeout(1200)
    A.locator('#panel form[data-form=boost][data-id=doubleXp] button[type=submit]').first.click(); A.wait_for_timeout(1200)
    check('Event-Schalter aktiv', 'aktiv bis' in A.locator('#panel form[data-form=boost][data-id=doubleXp]').inner_text())
    A.screenshot(path=SH + 's10_admin_tools.png')
    A.evaluate("BW.ui.tab.admin = 'legal'; BW.ui.renderPanel()"); A.wait_for_timeout(300)
    A.locator('#panel [data-act=adminTpl][data-id=impressum]').click(); A.wait_for_timeout(200)
    A.locator('#panel form[data-form=legal][data-id=impressum] button[type=submit]').click(); A.wait_for_timeout(1200)
    check('Impressum gespeichert', 'eigener Text' in A.locator('#panel form[data-form=legal][data-id=impressum]').inner_text())
    # Spieler B: Wartungsbanner + Event + Impressum + Passwort per Code zurücksetzen
    B.evaluate("BW.ui.closeModal(); BW.ui.nav('garden')"); B.goto(URL + '/?debug=1')
    B.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=90000); B.wait_for_timeout(3000)
    check('Spieler sieht Wartungshinweis', 'Testwartung' in B.locator('#maint').inner_text() and B.locator('#maint').is_visible())
    check('Event wirkt (doppelte EP)', B.evaluate('BW.G.boost("doubleXp")') == 2)
    B.evaluate("BW.ui.modalQueue.length = 0; BW.ui.closeModal(); BW.ui.nav('settings')"); B.wait_for_timeout(300)
    B.locator('#panel [data-act=legal][data-id=impressum]').click(); B.wait_for_timeout(2500)
    check('Impressum sichtbar', 'Angaben gemäß' in B.locator('#modal').inner_text(), B.locator('#modal').inner_text()[:80])
    B.screenshot(path=SH + 's11_impressum.png')
    B.evaluate("BW.ui.closeModal()")
    B.evaluate("BW.actions.logout()"); B.wait_for_selector('#authBox:not([hidden])', timeout=90000); B.wait_for_timeout(500)
    B.locator('#authBox .tabs [data-tab=login]').click(); B.locator('#authBox [data-forgot]').click(); B.wait_for_timeout(300)
    B.fill('#forgotForm [name=login]', B_NAME); B.fill('#forgotForm [name=code]', code); B.fill('#forgotForm [name=password]', 'neuespasswort1')
    B.screenshot(path=SH + 's12_forgot.png')
    B.locator('#forgotForm button[type=submit]').click()
    B.wait_for_function('window.BW && document.getElementById("loader").hidden', timeout=90000)
    check('Passwort per Code zurückgesetzt und angemeldet', B.evaluate('BW.user && BW.user.name') == B_NAME)
    A.evaluate("BW.ui.tab.admin = 'tools'; BW.ui.renderPanel()"); A.wait_for_timeout(300)
    A.locator('#panel form[data-form=maint] button[value="0"]').click(); A.wait_for_timeout(800)
    check('Kein JS-Fehler', not errs, '|'.join(errs)[:300])
    b.close()
print(f'{sum(res)}/{len(res)} bestanden')
sys.exit(0 if all(res) else 1)
