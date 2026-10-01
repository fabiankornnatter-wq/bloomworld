// /api/health – einfacher Statuscheck (ohne geheime Daten)
import { kv, kvConfigured, kvVarNames, kvSource, kvSchemes } from './_lib/kv.js';
import { send } from './_lib/http.js';

// Statusprüfung: zeigt nur, OB eine Datenbank verbunden ist und wie die Variablen HEISSEN – nie deren Werte
export default async function handler(req, res) {
  let reachable = null, error = null;
  if (kvConfigured()) { try { reachable = (await kv().cmd('PING')) === 'PONG'; } catch (e) { reachable = false; error = String(e.message || e).replace(/[^\w .:-]/g, '').slice(0, 80); } }
  send(res, 200, { ok: true, service: 'BloomWorld', version: '3.1.2', storage: kvConfigured(), reachable, error, source: kvSource(), vars: kvSchemes(), time: Date.now() });
}
