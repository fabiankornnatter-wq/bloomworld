# BloomWorld

Mobiles 3D-Garten- und Sammel-Browsergame. Pflanze Blumen, züchte neue Sorten, erledige Ophelias Story-Aufgaben, sammle Event-Belohnungen und baue deinen Garten aus – mit Tag-Nacht-Zyklus, Tieren, Deko und eigenem Spielerkonto.

## Spielen

- Läuft direkt im Browser (Handy, Tablet, Desktop), keine Installation nötig.
- Android: Seite in Chrome öffnen → Menü ⋮ → „Zum Startbildschirm hinzufügen“ → startet dann wie eine App im Vollbild.
- Beim ersten Start: Konto erstellen (Spielername, E-Mail, Passwort). Der Garten liegt dann auf dem Server und ist auf jedem Gerät derselbe. Ist der Server nicht erreichbar, kann offline weitergespielt werden.

## Funktionen

- **Konto:** Registrieren, Anmelden (Spielername oder E-Mail), Abmelden, Konto löschen. Spielstand auf dem Server, Kopie auf dem Gerät, Abgleich zwischen Geräten.
- **Garten:** 15 Hochbeete (6 frei, weitere mit Münzen + Level), Ausbau zum Steinbeet (×1,5) und Prachtbeet (×2, mehr Funkelblüten), automatische Bewässerung (Sprinkler, +30 % Tempo).
- **Blumen:** 6 Gartenblumen + 7 Züchtungen (Regenbogentulpe, Sonnentulpe, Goldene Rose, Mondorchidee, Nordlicht-Rose, Schwarze Rose – nur nachts –, legendäre Sternenrose). Funkelblüten (×3).
- **Gewächshaus:** restaurieren und Blumen kreuzen (Zuchtbuch mit Rezepten).
- **Gartenbedarf:** Dünger, Turbo-Dünger, Glücksdünger, Zuchtbeschleuniger (einzeln oder im Paket).
- **Level 1–30** mit Belohnungen und Freischaltungen (Levelweg), **Story** in 7 Kapiteln mit Eule Ophelia, Tagesaufgaben, tägliches Geschenk.
- **Events:** Herbstfest (Oktober) mit Herbstblättern, Meilensteinen und Event-Shop; Wintermarkt, Frühlingsblüte, Sommerfest; jedes Wochenende Funkel-Wochenende.
- Tag-Nacht-Zyklus (Morgen mit Tau, Tag, Abend, Nacht mit beleuchteten Fenstern und Glühwürmchen), Tiere (Fuchs, Igel, Eule, Schmetterlinge), Sammlung, Shop, Einstellungen.
- Monetarisierung nur vorbereitet (kosmetische Pakete, Münzen, Belohnungsvideos, Saisonpass) – **kein Pay-to-win**, keine echten Zahlungen aktiv.

## Technik

- HTML/CSS/JavaScript (ES-Module) im Browser, **keine externen Abhängigkeiten**, kein Build-Schritt
- Eigene kleine WebGL-Engine (`js/engine/`), alle 3D-Modelle im Code (`js/world/models.js`)
- Server-Funktionen auf Vercel (`api/`), Datenbank: Upstash Redis über den Vercel Marketplace
- Sicherheit: Passwörter mit scrypt gehasht, Anmeldung per HttpOnly-/Secure-/SameSite-Cookie, Schutz gegen fremde Seiten (CSRF), Begrenzung von Anmeldeversuchen, **keine Schlüssel im Code oder im Browser** – die Zugangsdaten der Datenbank stehen nur in den Umgebungsvariablen des Vercel-Projekts (`KV_REST_API_URL`, `KV_REST_API_TOKEN`; alternativ `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

```
index.html                Einstieg
vercel.json               Hosting-Konfiguration inkl. Sicherheits-Header
api/auth.js               Registrieren, Anmelden, Abmelden, Konto löschen
api/save.js               Spielstand laden/speichern (mit Konfliktschutz)
api/health.js             Statusprüfung
api/_lib/                 Datenbank, Konten, Hilfsfunktionen
js/main.js                Start, Anmeldung, Spielschleife, Eingabe, Aktionen
js/game.js                Spiellogik (ohne Grafik, getestet)
js/config.js              Spieldaten: Blumen, Zucht, Beete, Gegenstände, Level, Story, Events, Shop
js/account.js             Konto- und Cloud-Speicher (Browser-Seite)
js/authui.js, legal.js    Anmeldebildschirm, Datenschutzhinweise
js/storage.js             Speicher auf dem Gerät
js/ui.js, js/icons.js     Oberfläche und Symbole
js/engine/, js/world/     WebGL-Renderer, Szene, Modelle, Tag-Nacht
tests/                    Logik-, Server- und Browser-Tests, lokaler Testserver
```

## Lokal starten und testen

```bash
npm run dev          # http://localhost:8080 inkl. Server-Funktionen (Test-Datenbank im Speicher)
npm test             # Spiellogik + Server-Funktionen (Node 20+)
python3 tests/e2e.py http://localhost:8080 ./screenshots           # Browser-Test (Playwright)
python3 tests/extra.py http://localhost:8080 ./screenshots         # Zusatztests
```

Mit `?debug=1` an der URL steht im Browser `window.BW` für Tests bereit.

## Veröffentlichen (Vercel)

1. Repository in Vercel importieren (Framework: „Other“, keine Build-Einstellungen nötig).
2. Im Projekt unter **Storage** eine Upstash-Redis-Datenbank anlegen und mit dem Projekt verbinden – Vercel setzt die Umgebungsvariablen selbst.
3. Jeder Push auf `main` wird automatisch veröffentlicht.

Ohne verbundene Datenbank startet das Spiel trotzdem und bietet „Offline spielen“ an.

## Nächste Ausbaustufen

- Passwort-Zurücksetzen per E-Mail (z. B. über einen E-Mail-Dienst; Schlüssel nur als Vercel-Umgebungsvariable)
- Freunde: Gärten besuchen, Geschenke, gemeinsame Events
- Echte Zahlungen (Stripe oder Google Play Billing) und Belohnungsvideos – nur Deko/Komfort
- Spielstand-Prüfung auf dem Server (Schutz vor Manipulation), sobald es Ranglisten oder Handel gibt
