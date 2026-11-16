'use strict';
// Knowledge for agents: a folder of the business's documents and a search over it, so agents
// answer from the business's own files (prices, hours, policies…) and cite where they read it.
//
//   <config>/knowledge/      the documents, any depth; a first-level subfolder is a "collection".
//                            .md .txt .csv .json .html/.htm (tags stripped) .pdf (pdftotext, if installed).
//                            ≤ 5 MB per file, ≤ 2,000 files; hidden files and links are ignored.
//   <config>/kb-index/       (mode 700) manifest.json + chunks/<id>.json (+ vectors-*.json, hosted)
//
// Search = BM25 over ~1,200-character chunks (150 overlap, with line numbers and the heading
// above them), plain JS, no database. Incremental: a cheap stat pass before every search, and
// only files whose size/mtime (then hash) changed are chunked again.
// Hosted panels with VOYAGE_API_KEY (preferred) or OPENAI_API_KEY in llm.env also rank by
// meaning (lib/kb-embed.js): hybrid = normalised BM25 + cosine. Vectors are cached by chunk
// hash; any embedding failure falls back to keyword results with a note. The free panel is
// keyword only, key or not.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const llm = require('./llm');
const { createEmbedder, PROVIDERS, cosine, toB64, fromB64 } = require('./kb-embed');

const PATH_RE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,199}$/;
const COLLECTION_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
const TYPES = { '.md': 'text', '.txt': 'text', '.csv': 'text', '.json': 'text', '.html': 'html', '.htm': 'html', '.pdf': 'pdf' };
const MAX_FILE = 5 * 1024 * 1024;
const MAX_FILES = 2000;
const MAX_DEPTH = 8;
const CHUNK = 1200, OVERLAP = 150;
const QUERY_MAX = 500;
const N_MAX = 20;
const EMBED_PER_SEARCH = 512;  // a search embeds at most this many new chunks; the rest wait
const SNIPPET = 600;
const K1 = 1.2, B = 0.75;
const W_KEYWORD = 0.45, W_MEANING = 0.55;
// A passage with no shared word counts only when it is close in meaning: at least MIN_COS, and
// within COS_WINDOW of the closest passage (unrelated text still has some similarity).
const MIN_COS = 0.3, COS_WINDOW = 0.1;

class KbError extends Error {
  constructor(code, status = 400, detail) { super(detail ? `${code}: ${detail}` : code); this.code = code; this.status = status; this.detail = detail; }
}

// A document path inside the knowledge folder: relative, no `..`, no hidden segments, a known type.
function checkPath(p, { type = true } = {}) {
  if (typeof p !== 'string' || !PATH_RE.test(p)) throw new KbError('bad_path', 400, String(p ?? '').slice(0, 80));
  const segs = p.split('/');
  if (segs.length > MAX_DEPTH || !segs.every(s => s && s !== '.' && s !== '..' && !s.startsWith('.') && s.trim() === s)) throw new KbError('bad_path', 400, p.slice(0, 80));
  if (type && !TYPES[path.extname(p).toLowerCase()]) throw new KbError('bad_type', 400, 'md, txt, csv, json, html or pdf');
  return p;
}
function checkCollection(c) {
  if (c == null || c === '') return null;
  if (typeof c !== 'string' || !COLLECTION_RE.test(c) || c.includes('..')) throw new KbError('bad_collection', 400, String(c).slice(0, 64));
  return c;
}
const collectionOf = rel => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : null);

// ─── Text ─────────────────────────────────────────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', copy: '©', reg: '®', euro: '€', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', iquest: '¿', iexcl: '¡' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return ENTITIES[e] ?? m;
  });
}
// Tags out, text in: script/style/comments dropped, block tags become line breaks, headings
// become "# …" lines (so chunks know their heading), entities decoded, blank runs squeezed.
function stripHtml(html) {
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, '\n');
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (m, n, inner) => `\n${'#'.repeat(Number(n))} ${inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}\n`);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(p|div|section|article|header|footer|main|nav|aside|li|ul|ol|tr|table|thead|tbody|blockquote|pre|dl|dt|dd|figure|figcaption|form|title)\b[^>]*>/gi, '\n');
  s = s.replace(/<\/?(td|th)\b[^>]*>/gi, ' ');
  s = s.replace(/<[^>]*>/g, '');
  s = decodeEntities(s);
  return s.split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const STOP = new Set(('a an and are as at be by for from has have how i in is it its of on or that the this to was what when where which who why will with you your do does can de del el la las los un una unos unas y o en es son por para con sin que se su sus al lo le les mi me te tu como cual cuando donde quien hay mas pero si no ya muy este esta estos estas ese esa').split(' '));
// Lower case, accents folded (precio = precío), letters/digits only, stop words out, a light
// plural strip (prices → price, servicios → servicio, policies → policy).
function tokenize(text) {
  const out = [];
  const s = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const m of s.matchAll(/[\p{L}\p{N}]+/gu)) {
    let w = m[0];
    if (w.length < 2 && !/\d/.test(w)) continue;
    if (STOP.has(w)) continue;
    if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    out.push(w);
  }
  return out;
}

// Lines → chunks of ~CHUNK characters that overlap by ~OVERLAP, each with its first and last
// line number (1-based) and the nearest markdown heading at or above its first line.
function chunkText(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const headingAt = [];
  let heading = '';
  const pieces = []; // { line, text }
  lines.forEach((l, i) => {
    const h = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(l);
    if (h) heading = h[1].slice(0, 120);
    headingAt[i + 1] = heading;
    if (l.length <= CHUNK) { pieces.push({ line: i + 1, text: l }); return; }
    // A very long line (minified text, a PDF paragraph): cut at spaces into chunk-sized parts.
    let rest = l;
    while (rest.length > CHUNK) {
      let cut = rest.lastIndexOf(' ', CHUNK);
      if (cut < CHUNK / 2) cut = CHUNK;
      pieces.push({ line: i + 1, text: rest.slice(0, cut) });
      rest = rest.slice(cut).replace(/^ +/, '');
    }
    if (rest) pieces.push({ line: i + 1, text: rest });
  });

  const chunks = [];
  let start = 0;
  while (start < pieces.length) {
    let end = start, size = 0;
    while (end < pieces.length && (end === start || size + pieces[end].text.length + 1 <= CHUNK)) { size += pieces[end].text.length + 1; end++; }
    const part = pieces.slice(start, end);
    const first = part.findIndex(p => p.text.trim());
    if (first >= 0) {
      let last = part.length - 1;
      while (!part[last].text.trim()) last--;
      const body = part.slice(first, last + 1);
      const txt = body.map(p => p.text).join('\n');
      chunks.push({ a: body[0].line, b: body.at(-1).line, heading: headingAt[body[0].line] || '', text: txt, hash: crypto.createHash('sha256').update(txt).digest('hex').slice(0, 24) });
    }
    if (end >= pieces.length) break;
    // Step back over the last few pieces for the overlap, but always move forward.
    let back = end, ov = 0;
    while (back - 1 > start && ov + pieces[back - 1].text.length + 1 <= OVERLAP) { back--; ov += pieces[back].text.length + 1; }
    start = back > start ? back : end;
  }
  return chunks;
}

function snippetOf(text, terms) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= SNIPPET) return flat;
  const low = flat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let at = -1;
  for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  let from = at > 150 ? flat.lastIndexOf(' ', at - 150) + 1 : 0;
  if (flat.length - from < SNIPPET) from = Math.max(0, flat.length - SNIPPET);
  const out = flat.slice(from, from + SNIPPET);
  return (from > 0 ? '…' : '') + out + (from + SNIPPET < flat.length ? '…' : '');
}

function pdfToText(file, { timeout = 30000, bin = 'pdftotext' } = {}) {
  return new Promise(resolve => {
    execFile(bin, ['-layout', file, '-'], { timeout, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => {
      if (err?.code === 'ENOENT') return resolve({ skip: 'pdftotext not installed' });
      if (err?.killed) return resolve({ skip: 'pdf took too long to read' });
      if (err) return resolve({ skip: 'pdf could not be read' });
      const text = String(stdout).replace(/\f/g, '');
      resolve(text.trim() ? { text } : { skip: 'pdf has no text (scanned?)' });
    });
  });
}

// ─── The store ────────────────────────────────────────────────────────────────
// hosted: semantic search allowed (OPERIO_ORCA_HOSTED=1). llmFile: where VOYAGE_API_KEY /
// OPENAI_API_KEY live (read on every use). onIndexed(): called once, the first time the folder
// has an indexed document (ORCA installs the business-knowledge skill then).
function createKb({ configDir, hosted = false, llmFile = path.join(configDir, 'llm.env'), env = process.env, log = () => {}, onIndexed = null, pdf = pdfToText, fetchImpl, now = () => Date.now() }) {
  const DOCS = path.join(configDir, 'knowledge');
  const INDEX = path.join(configDir, 'kb-index');
  const CHUNKS = path.join(INDEX, 'chunks');
  const MANIFEST = path.join(INDEX, 'manifest.json');

  let manifest = null;
  const corpus = new Map(); // rel -> [{ a, b, heading, text, hash, tf: Map, len }]
  let queue = Promise.resolve(); // refreshes run one at a time

  const mkdir = d => { fs.mkdirSync(d, { recursive: true, mode: 0o700 }); try { fs.chmodSync(d, 0o700); } catch { /* not ours */ } };
  function writeJson(file, obj) {
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, file);
  }
  function loadManifest() {
    if (manifest) return manifest;
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { manifest = null; }
    if (!manifest || typeof manifest.files !== 'object') manifest = { version: 1, files: {}, indexedAt: null, skillOffered: false };
    return manifest;
  }
  const idOf = rel => crypto.createHash('sha1').update(rel).digest('hex').slice(0, 20);

  function prep(c) {
    const tf = new Map();
    const toks = tokenize((c.heading ? c.heading + '\n' : '') + c.text);
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    return { ...c, tf, len: toks.length };
  }
  function chunksOf(rel) {
    if (corpus.has(rel)) return corpus.get(rel);
    const e = manifest.files[rel];
    let list = [];
    if (e?.status === 'indexed') {
      try { list = JSON.parse(fs.readFileSync(path.join(CHUNKS, e.id + '.json'), 'utf8')).chunks.map(prep); }
      catch { e.mtimeMs = -1; } // chunk file lost: re-read on the next refresh
    }
    corpus.set(rel, list);
    return list;
  }

  // Every document file under the folder: [{ rel, abs, st }], sorted, hidden names and links skipped.
  function walk() {
    const out = [];
    (function go(dir, rel, depth) {
      let ents;
      try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
      for (const d of ents.sort((x, y) => (x.name < y.name ? -1 : 1))) {
        if (d.name.startsWith('.')) continue;
        const r = rel ? `${rel}/${d.name}` : d.name;
        const abs = path.join(dir, d.name);
        if (d.isDirectory()) { if (depth < MAX_DEPTH - 1) go(abs, r, depth + 1); }
        else if (d.isFile()) { try { out.push({ rel: r, abs, st: fs.statSync(abs) }); } catch { /* gone */ } }
      }
    })(DOCS, '', 0);
    return out;
  }

  async function extract(abs, type) {
    if (type === 'pdf') return pdf(abs);
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return { skip: 'not a text file' };
    const text = buf.toString('utf8').replace(/^﻿/, '');
    return { text: type === 'html' ? stripHtml(text) : text };
  }

  // The stat pass. full: chunk everything again. retry: try skipped files again (pdftotext may
  // have been installed since). Returns what changed, for the CLI and the tests.
  async function refreshNow({ full = false, retry = false } = {}) {
    const m = loadManifest();
    const seen = new Set();
    const changed = [], removed = [];
    let unchanged = 0, dirty = false;
    const files = walk();
    for (let i = 0; i < files.length; i++) {
      const { rel, abs, st } = files[i];
      seen.add(rel);
      const prev = m.files[rel];
      const type = TYPES[path.extname(rel).toLowerCase()];
      let skip = null;
      let ok = true;
      try { checkPath(rel, { type: false }); } catch { ok = false; }
      if (!ok) skip = 'name not allowed';
      else if (!type) skip = 'unsupported type';
      else if (i >= MAX_FILES) skip = 'over 2,000 files';
      else if (st.size > MAX_FILE) skip = 'too large (max 5 MB)';
      if (skip) {
        if (prev?.status !== 'skipped' || prev.reason !== skip || prev.size !== st.size) {
          if (prev?.id) { try { fs.unlinkSync(path.join(CHUNKS, prev.id + '.json')); } catch { /* none */ } }
          m.files[rel] = { size: st.size, mtimeMs: st.mtimeMs, hash: null, status: 'skipped', reason: skip, chunks: 0 };
          corpus.set(rel, []);
          changed.push(rel); dirty = true;
        } else unchanged++;
        continue;
      }
      const again = full || (retry && prev?.status === 'skipped');
      if (!again && prev && prev.size === st.size && prev.mtimeMs === st.mtimeMs) { unchanged++; continue; }
      let buf;
      try { buf = fs.readFileSync(abs); } catch { continue; }
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      if (!again && prev && prev.hash === hash) { prev.mtimeMs = st.mtimeMs; prev.size = st.size; dirty = true; unchanged++; continue; }
      const r = await extract(abs, type);
      const id = idOf(rel);
      if (r.skip) {
        try { fs.unlinkSync(path.join(CHUNKS, id + '.json')); } catch { /* none */ }
        m.files[rel] = { size: st.size, mtimeMs: st.mtimeMs, hash, status: 'skipped', reason: r.skip, chunks: 0 };
        corpus.set(rel, []);
      } else {
        const chunks = chunkText(r.text);
        mkdir(INDEX); mkdir(CHUNKS);
        writeJson(path.join(CHUNKS, id + '.json'), { path: rel, chunks });
        m.files[rel] = { size: st.size, mtimeMs: st.mtimeMs, hash, status: 'indexed', reason: null, chunks: chunks.length, id };
        corpus.set(rel, chunks.map(prep));
      }
      changed.push(rel); dirty = true;
    }
    for (const rel of Object.keys(m.files)) {
      if (seen.has(rel)) continue;
      const e = m.files[rel];
      if (e.id) { try { fs.unlinkSync(path.join(CHUNKS, e.id + '.json')); } catch { /* none */ } }
      delete m.files[rel];
      corpus.delete(rel);
      removed.push(rel); dirty = true;
    }
    if (dirty || full) {
      m.indexedAt = now();
      mkdir(INDEX);
      writeJson(MANIFEST, m);
    }
    if (!m.skillOffered && Object.values(m.files).some(e => e.status === 'indexed')) {
      m.skillOffered = true;
      mkdir(INDEX);
      writeJson(MANIFEST, m);
      if (onIndexed) { try { await onIndexed(); } catch (e) { log('kb.on_indexed_failed', { error: String(e.message).slice(0, 200) }); } }
    }
    if (changed.length || removed.length) log('kb.reindex', { changed: changed.length, removed: removed.length, unchanged });
    return { changed, removed, unchanged };
  }
  const refresh = opts => (queue = queue.then(() => refreshNow(opts), () => refreshNow(opts)));

  // ─── Semantic ──────────────────────────────────────────────────────────────
  function semantic() {
    if (!hosted) return { on: false, why: 'free' };
    let provider = null;
    let key = '';
    for (const p of ['voyage', 'openai']) {
      key = llm.get(llmFile, PROVIDERS[p].keyName);
      if (key) { provider = p; break; }
    }
    if (!provider) return { on: false, why: 'no_key' };
    const model = String(env.OPERIO_ORCA_KB_MODEL || '').trim() || PROVIDERS[provider].model;
    return { on: true, provider, model, key };
  }
  const publicSemantic = s => (s.on ? { on: true, provider: s.provider, model: s.model } : { on: false, why: s.why });
  const vecFile = s => path.join(INDEX, `vectors-${s.provider}-${s.model.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
  function loadVectors(s) {
    try { const j = JSON.parse(fs.readFileSync(vecFile(s), 'utf8')); if (j && typeof j.v === 'object') return j; } catch { /* none yet */ }
    return { v: {} };
  }

  // Embed the chunks that have no vector yet (by hash), at most `limit`. Throws on failure.
  async function embedPendingWith(s, limit = Infinity) {
    const cache = loadVectors(s);
    const want = new Map(); // hash -> text
    for (const rel of Object.keys(manifest.files)) for (const c of chunksOf(rel)) want.set(c.hash, c.text);
    const missing = [...want.keys()].filter(h => !cache.v[h]);
    const todo = missing.slice(0, limit);
    let embedded = 0;
    if (todo.length) {
      const emb = createEmbedder({ provider: s.provider, key: s.key, model: s.model, env, fetchImpl });
      const vecs = await emb.embed(todo.map(h => (want.get(h) || '').slice(0, 8000)), 'document');
      todo.forEach((h, i) => { cache.v[h] = toB64(vecs[i]); });
      embedded = todo.length;
      log('kb.embedded', { provider: s.provider, model: s.model, chunks: embedded });
    }
    // Keep only vectors of chunks that still exist.
    let pruned = 0;
    for (const h of Object.keys(cache.v)) if (!want.has(h)) { delete cache.v[h]; pruned++; }
    if (embedded || pruned) { mkdir(INDEX); writeJson(vecFile(s), cache); }
    return { cache, embedded, waiting: missing.length - todo.length };
  }
  async function embedPending({ limit = Infinity } = {}) {
    await refresh();
    const s = semantic();
    if (!s.on) return { on: false, why: s.why, embedded: 0 };
    const r = await embedPendingWith(s, limit);
    return { on: true, embedded: r.embedded, waiting: r.waiting };
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  async function search(query, { n = 5, collection = null } = {}) {
    const q = String(query ?? '').replace(/\s+/g, ' ').trim().slice(0, QUERY_MAX);
    if (!q) throw new KbError('empty_query');
    const want = Math.min(Math.max(Math.floor(Number(n)) || 5, 1), N_MAX);
    const coll = checkCollection(collection);
    await refresh();

    const docs = [];
    for (const rel of Object.keys(manifest.files).sort()) {
      if (coll && collectionOf(rel) !== coll) continue;
      for (const c of chunksOf(rel)) docs.push({ rel, c });
    }
    const terms = [...new Set(tokenize(q))];
    const N = docs.length;
    const avg = N ? docs.reduce((s, d) => s + d.c.len, 0) / N : 0;
    const df = new Map(terms.map(t => [t, 0]));
    for (const d of docs) for (const t of terms) if (d.c.tf.has(t)) df.set(t, df.get(t) + 1);
    const kw = docs.map(d => {
      let s = 0;
      for (const t of terms) {
        const f = d.c.tf.get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
        s += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.c.len / (avg || 1))));
      }
      return s;
    });

    let mode = 'keyword', note, scores = kw.slice(), keep = kw.map(s => s > 0);
    const s = semantic();
    if (s.on && N) {
      try {
        const { cache, waiting } = await embedPendingWith(s, EMBED_PER_SEARCH);
        const emb = createEmbedder({ provider: s.provider, key: s.key, model: s.model, env, fetchImpl });
        const [qv] = await emb.embed([q], 'query');
        const max = Math.max(...kw, 0);
        const cos = docs.map(d => { const v = cache.v[d.c.hash]; return v ? cosine(qv, fromB64(v)) : 0; });
        const floor = Math.max(MIN_COS, Math.max(...cos) - COS_WINDOW);
        scores = docs.map((d, i) => {
          keep[i] = kw[i] > 0 || cos[i] >= floor;
          return W_KEYWORD * (max ? kw[i] / max : 0) + W_MEANING * Math.max(0, cos[i]);
        });
        mode = 'hybrid';
        if (waiting) note = `${waiting} newer passages are still being prepared for meaning search; they match by keyword for now`;
      } catch (e) {
        note = `meaning search unavailable (${e.code || 'error'}) — keyword results only`;
        log('kb.semantic_failed', { provider: s.provider, code: e.code || 'error', detail: String(e.detail || '').slice(0, 160) });
      }
    }

    const order = docs.map((d, i) => i).filter(i => keep[i]).sort((x, y) => scores[y] - scores[x]);
    const results = order.slice(0, want).map(i => {
      const { rel, c } = docs[i];
      return { source: rel, lines: `${c.a}-${c.b}`, score: Math.round(scores[i] * 1000) / 1000, snippet: snippetOf(c.text, terms) };
    });
    return note ? { results, mode, note } : { results, mode };
  }

  // ─── Files ─────────────────────────────────────────────────────────────────
  function list() {
    const m = loadManifest();
    return Object.keys(m.files).sort().map(rel => {
      const e = m.files[rel];
      return { path: rel, collection: collectionOf(rel), bytes: e.size, chunks: e.chunks || 0, status: e.status, reason: e.reason || null };
    });
  }

  async function status() {
    await refresh();
    const files = list();
    return {
      files: files.length,
      indexed: files.filter(f => f.status === 'indexed').length,
      skipped: files.filter(f => f.status === 'skipped').length,
      chunks: files.reduce((n, f) => n + f.chunks, 0),
      bytes: files.reduce((n, f) => n + f.bytes, 0),
      collections: [...new Set(files.map(f => f.collection).filter(Boolean))].sort(),
      semantic: publicSemantic(semantic()),
      lastIndexed: manifest.indexedAt || null,
    };
  }

  // Write knowledge/<rel> (0600, folders 0700), then index it. data: Buffer or string.
  async function add(rel, data) {
    checkPath(rel);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data ?? ''), 'utf8');
    if (!buf.length) throw new KbError('empty_file');
    if (buf.length > MAX_FILE) throw new KbError('too_large', 413, 'max 5 MB');
    const abs = path.join(DOCS, ...rel.split('/'));
    if (!abs.startsWith(DOCS + path.sep)) throw new KbError('bad_path', 400, rel);
    await refresh();
    if (!manifest.files[rel] && Object.keys(manifest.files).length >= MAX_FILES) throw new KbError('too_many_files', 409, `max ${MAX_FILES}`);
    // Every folder on the way must be a real folder (not a link, not a file).
    let dir = DOCS;
    mkdir(DOCS);
    for (const seg of rel.split('/').slice(0, -1)) {
      dir = path.join(dir, seg);
      let st = null;
      try { st = fs.lstatSync(dir); } catch { /* new */ }
      if (st && !st.isDirectory()) throw new KbError('bad_path', 409, `${seg} is not a folder`);
      if (!st) fs.mkdirSync(dir, { mode: 0o700 });
    }
    let cur = null;
    try { cur = fs.lstatSync(abs); } catch { /* new */ }
    if (cur && !cur.isFile()) throw new KbError('bad_path', 409, 'not a file');
    const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${crypto.randomBytes(3).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, buf, { mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, abs);
    await refresh();
    const e = list().find(f => f.path === rel);
    return { ...e, replaced: !!cur };
  }

  async function remove(rel) {
    checkPath(rel, { type: false });
    const abs = path.join(DOCS, ...rel.split('/'));
    let st = null;
    try { st = fs.lstatSync(abs); } catch { /* not there */ }
    if (!st || !st.isFile()) return { path: rel, removed: false };
    fs.unlinkSync(abs);
    // Drop folders the file leaves empty (never the knowledge folder itself).
    for (let d = path.dirname(abs); d.startsWith(DOCS + path.sep); d = path.dirname(d)) {
      try { fs.rmdirSync(d); } catch { break; }
    }
    await refresh();
    return { path: rel, removed: true, bytes: st.size };
  }

  async function reindex({ full = false } = {}) {
    const r = await refresh({ full, retry: true });
    return r;
  }

  return { search, list, status, add, remove, reindex, refresh, embedPending, semantic: () => publicSemantic(semantic()), DOCS, INDEX };
}

// The bundled business-knowledge skill tells agents the search exists. Installed (source
// "bundled") the first time the folder has a document; a business-knowledge skill that isn't
// ORCA's is left alone (log line), and nothing here ever fails an upload.
const KNOWLEDGE_SKILL = 'business-knowledge';
function installKnowledgeSkill(skills, log = () => {}) {
  try {
    if (skills.list().some(s => s.key === KNOWLEDGE_SKILL)) return 'present';
    skills.installBundled(KNOWLEDGE_SKILL);
    log('kb.skill_installed', { key: KNOWLEDGE_SKILL });
    return 'installed';
  } catch (e) {
    if (e.code === 'conflict' || e.code === 'not_ours') {
      log('kb.skill_skipped', { key: KNOWLEDGE_SKILL, reason: 'a skill of that name that is not ORCA\'s is already there' });
      return 'skipped';
    }
    log('kb.skill_failed', { key: KNOWLEDGE_SKILL, error: String(e.code || e.message).slice(0, 120) });
    return 'failed';
  }
}

module.exports = {
  createKb, installKnowledgeSkill, KNOWLEDGE_SKILL, KbError, checkPath, checkCollection, chunkText, tokenize, stripHtml, snippetOf, pdfToText,
  PATH_RE, COLLECTION_RE, TYPES, MAX_FILE, MAX_FILES, CHUNK, OVERLAP,
};
