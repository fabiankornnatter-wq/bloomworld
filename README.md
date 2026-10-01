# BloomWorld

Mobiles 3D-Garten- und Sammel-Browsergame. Pflanze Blumen, lass sie wachsen, ernte sie, verdiene Münzen und gestalte deinen Garten – mit echtem Tag-Nacht-Zyklus, Tieren und Deko.

## Spielen

- Läuft direkt im Browser (Handy, Tablet, Desktop), keine Installation nötig.
- Android: Seite in Chrome öffnen → Menü ⋮ → „Zum Startbildschirm hinzufügen“ → startet dann wie eine App im Vollbild.

## Funktionen

- 3D-Garten mit Hochbeeten, Haus, Teich, Wegen, Zaun, Hecken, Bäumen und Zierbeeten
- 6 Blumenarten mit Wachstumsstufen (wachsen auch offline weiter), seltene goldene Blüten (×3)
- Münzen (nie negativ), Level/EP, neue Beete freischalten
- Tagesaufgaben, tägliches Geschenk
- Tag-Nacht-Zyklus mit sichtbarem Lichtwechsel: Morgen (Tau), Tag, Abend (orange), Nacht (beleuchtete Fenster, Glühwürmchen)
- Tiere: Fuchs, Igel, Eule (nachts), Schmetterlinge (tags) – antippen zum Entdecken
- Sammlung (Blumen, goldene Blüten, Tiere, Deko), Shop (Deko, seltene Blumen, Tier-Skins), Events, Freunde
- Einstellungen: Zyklus (automatisch / immer Tag / immer Nacht / Geschwindigkeit), Grafik (Auto/Hoch/Mittel/Sparsam), Musik & Sound
- Speicherung im Browser, Übernahme alter Spielstände, Reparatur beschädigter Spielstände

## Technik

- Reines HTML/CSS/JavaScript (ES-Module), **keine externen Abhängigkeiten**, kein Build-Schritt
- Eigene kleine WebGL-Engine (`js/engine/`): Licht, weiche Schatten, Nebel, Himmel, Wind, Wasser
- Alle 3D-Modelle werden im Code erzeugt (`js/world/models.js`), Klänge und Musik per Web Audio (`js/audio.js`)
- Schrift: Poppins (SIL Open Font License), lokal eingebunden

```
index.html              Einstieg
manifest.webmanifest    App-Manifest (Startbildschirm)
vercel.json             Hosting-Konfiguration inkl. Sicherheits-Header
css/style.css           Oberfläche
js/main.js              Start, Spielschleife, Eingabe, Aktionen
js/game.js              Spiellogik (ohne Grafik, getestet)
js/config.js            Spieldaten: Saatgut, Preise, Aufgaben, Shop
js/storage.js           Speicher-Adapter (heute localStorage, später Supabase)
js/payments.js          Vorbereitung Monetarisierung (keine echten Zahlungen)
js/ui.js, js/icons.js   Oberfläche und Symbole
js/audio.js             Soundeffekte und Musik
js/engine/              WebGL-Renderer, Geometrie, Mathematik
js/world/               Szene, Modelle, Tag-Nacht
assets/                 Schriften und App-Icons
tests/                  Logik-Tests und Browser-Test
```

## Lokal starten und testen

```bash
npm run dev          # startet http://localhost:8080 (Python 3 nötig)
npm test             # Tests der Spiellogik (Node 18+)
python3 tests/e2e.py http://localhost:8080 ./screenshots   # Browser-Test (Playwright)
```

Mit `?debug=1` an der URL steht im Browser `window.BW` für Tests bereit.

## Veröffentlichen (Vercel)

Statisches Projekt – Vercel erkennt es ohne Einstellungen. `tests/` und `README.md` werden über `.vercelignore` nicht mit ausgeliefert.

## Nächste Ausbaustufen

- **Login & Cloud-Spielstand (Supabase):** `SupabaseStore` mit gleicher Schnittstelle wie `LocalStore` in `js/storage.js` (Vorlage ist im Code). Nur den öffentlichen anon-Key verwenden, Zugriff über Row Level Security absichern; in `vercel.json` die Supabase-Domain bei `connect-src` ergänzen.
- **Zahlungen:** über eine Vercel-Serverfunktion (z.B. Stripe Checkout). Geheime Schlüssel nur als Vercel-Umgebungsvariablen, nie im Frontend.
- **Belohnungsvideos, Saisonpass, Saison-Events:** Struktur in `js/config.js` und `js/payments.js` vorbereitet. Grundsatz: nur Deko/Komfort, kein Pay-to-win.
