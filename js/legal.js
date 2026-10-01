// Kurze Datenschutzhinweise für Konto, Spielstand und Freunde (im Spiel angezeigt).
export const PRIVACY_HTML = `
<div class="legal">
  <p><b>Was wird gespeichert?</b><br>Für dein Konto: Spielername, E-Mail-Adresse, dein Passwort (nur als sicher verschlüsselter Prüfwert, nie im Klartext) und dein Spielstand.</p>
  <p><b>Wozu?</b><br>Damit du dich anmelden kannst und dein Garten auf jedem Gerät derselbe ist.</p>
  <p><b>Freunde &amp; Chat</b><br>Deine Freunde sehen deinen Spielernamen, dein Level, ob du gerade online bist und deinen Garten, wenn sie dich besuchen – nie deine E-Mail-Adresse. Chat-Nachrichten gibt es nur zwischen bestätigten Freunden; sie werden höchstens 90 Tage gespeichert (die letzten 200 je Unterhaltung). Links, E-Mail-Adressen und Telefonnummern werden automatisch ausgeblendet. Gemeldete Nachrichten prüft der Betreiber des Spiels.</p>
  <p><b>Cookies</b><br>Nur ein technisch notwendiges Anmelde-Cookie („bw_session“). Keine Werbe- oder Tracking-Cookies.</p>
  <p><b>Wo?</b><br>Die Seite läuft bei Vercel, die Konto-Daten liegen in einer Redis-Datenbank des Hosting-Anbieters. Es gibt keine Weitergabe an Dritte zu Werbezwecken.</p>
  <p><b>Löschen</b><br>Du kannst dein Konto jederzeit unter Einstellungen → Konto löschen. Dabei werden alle Daten entfernt, auch Freundschaften und Chats.</p>
  <p><b>Auf diesem Gerät</b><br>Eine Kopie deines Spielstands und deine Einstellungen liegen zusätzlich im Speicher deines Browsers, damit das Spiel auch bei kurzer Funkstille weiterläuft.</p>
</div>`;
