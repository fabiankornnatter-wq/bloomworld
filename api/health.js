// /api/health – einfacher Statuscheck (ohne geheime Daten)
import { kv, kvConfigured, kvVarNames, kvSource, kvSchemes } from './_lib/kv.js';
import { send } from './_lib/http.js';

// Statusprüfung: zeigt nur, OB eine Datenbank verbunden ist und wie die Variablen HEISSEN – nie deren Werte
export default async function handler(req, res) {
  let reachable = null, writable = null, scripts = null, error = null;
  if (kvConfigured()) {
    try {
      reachable = (await kv().cmd('PING')) === 'PONG';
      // Schreiben und Lua-Skripte prüfen (Spielstände nutzen beides)
      const t = String(Date.now());
      await kv().cmd('SET', 'bw:health', t, 'EX', 60);
      writable = (await kv().cmd('GET', 'bw:health')) === t;
      scripts = Number(await kv().cmd('EVAL', 'return 7', 0)) === 7;
    } catch (e) { error = String(e.message || e).replace(/[^\w .:-]/g, '').slice(0, 80); }
  }
  send(res, 200, { ok: true, service: 'BloomWorld', version: '3.2.0', storage: kvConfigured(), reachable, writable, scripts, error, source: kvSource(), vars: kvSchemes(), time: Date.now() });
}
