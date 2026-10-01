// /api/health – einfacher Statuscheck (ohne geheime Daten)
import { kvConfigured } from './_lib/kv.js';
import { send } from './_lib/http.js';

export default function handler(req, res) {
  send(res, 200, { ok: true, service: 'BloomWorld', storage: kvConfigured(), time: Date.now() });
}
