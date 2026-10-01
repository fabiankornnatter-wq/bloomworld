// /api/health – einfacher Statuscheck (ohne geheime Daten)
import { kv, kvConfigured, kvVarNames, kvSource } from './_lib/kv.js';
import { send } from './_lib/http.js';

// Statusprüfung: zeigt nur, OB eine Datenbank verbunden ist und wie die Variablen HEISSEN – nie deren Werte
export default async function handler(req, res) {
  let reachable = null;
  if (kvConfigured()) { try { reachable = (await kv().cmd('PING')) === 'PONG'; } catch { reachable = false; } }
  send(res, 200, { ok: true, service: 'BloomWorld', storage: kvConfigured(), reachable, source: kvSource(), vars: kvVarNames(), time: Date.now() });
}
