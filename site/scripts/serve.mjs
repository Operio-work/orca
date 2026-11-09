#!/usr/bin/env node
// Serve build/ the way deploy/nginx-make.operio.work.conf does, for local checks:
// exact file, then <path>.html, then 404; a trailing slash gets one 301 to the bare path.
// usage: node scripts/serve.mjs [port]   (binds 127.0.0.1 only)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');
const port = Number(process.argv[2] || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.sh': 'text/plain; charset=utf-8',
  '.gz': 'application/gzip', '.sha256': 'text/plain; charset=utf-8'
};

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p.includes('..')) { res.writeHead(400).end(); return; }
  if (p.length > 1 && p.endsWith('/')) {
    res.writeHead(301, { location: p.replace(/\/+$/, '') + url.search }).end();
    return;
  }
  const candidates = p === '/' ? ['/index.html'] : [p, p + '.html'];
  const hit = candidates.map((c) => path.join(root, c)).find(isFile);
  if (!hit) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(hit)] || 'application/octet-stream' });
  fs.createReadStream(hit).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving build/ on http://127.0.0.1:${port}`));
