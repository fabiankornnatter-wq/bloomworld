// Lokaler Testserver: liefert die Dateien aus und führt /api/* wie auf Vercel aus.
// Nutzt einen In-Memory-Speicher statt Redis. Start: node tests/devserver.mjs [port]
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.BW_DEV_MEMORY_DB ??= '1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 8123);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const vercel = JSON.parse(await fs.readFile(path.join(root, 'vercel.json'), 'utf8'));
const globalHeaders = vercel.headers.find((h) => h.source === '/(.*)')?.headers || [];

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    for (const h of globalHeaders) res.setHeader(h.key, h.value);
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
      const file = path.join(root, 'api', name + '.js');
      try { await fs.access(file); } catch { res.statusCode = 404; return res.end('Not found'); }
      req.query = Object.fromEntries(url.searchParams);
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  } catch (e) {
    if (!res.headersSent) { res.statusCode = e.code === 'ENOENT' ? 404 : 500; }
    res.end(e.code === 'ENOENT' ? 'Not found' : 'Error');
    if (e.code !== 'ENOENT') console.error(e);
  }
}).listen(port, () => console.log(`BloomWorld Testserver: http://localhost:${port}`));
