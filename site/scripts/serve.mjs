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
  '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8'
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
  const type = TYPES[path.extname(hit)] || 'application/octet-stream';
  const size = fs.statSync(hit).size;
  // Byte ranges, like nginx, so the demo video can seek.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start < 0) start = 0;
    if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }).end(); return; }
    res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    fs.createReadStream(hit, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
  fs.createReadStream(hit).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving build/ on http://127.0.0.1:${port}`));
