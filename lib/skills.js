'use strict';
// Skills: folders with a SKILL.md (front-matter name + description, then instructions) that
// agents read when a task matches. ORCA installs them and makes them visible to the agents:
//   <config>/skills/<key>/                 the installed copy, with .operio-skill.json (ours)
//   ~/.claude/skills/<key> → that folder   Claude Code (only a link we made is ever replaced)
//   ~/.codex/AGENTS.md, ~/.gemini/GEMINI.md  a managed block listing each skill, only when
//                                          that folder exists; the rest of the file is untouched
// Free panel: the bundled open skills in <app>/skills (catalog.json). ORCA Host: Operio's
// gallery for this client, written by `operio-orca skills catalog-set` to operio-skills.json;
// ORCA Host installs (`skills install`), the panel itself never does.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SEG_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$/;
const VERSION_RE = /^[0-9][0-9A-Za-z.-]{0,19}$/;
const MAX_FILES = 20, MAX_BYTES = 256 * 1024;
const MARKER = '.operio-skill.json';
const BLOCK_START = '<!-- operio-orca skills:start -->';
const BLOCK_END = '<!-- operio-orca skills:end -->';
const CATALOG_MAX_BYTES = 512 * 1024, CATALOG_MAX = 500;
const NAME_MAX = 80, SUMMARY_MAX = 400, NOTE_MAX = 500;
const LANGS = ['en', 'es'];
const REQUEST_STATUS = ['pending', 'rejected', 'failed'];

class SkillError extends Error {
  constructor(code, status = 400, detail) { super(detail ? `${code}: ${detail}` : code); this.code = code; this.status = status; this.detail = detail; }
}

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const oneLine = (v, max) => str(v, max * 2).replace(/\s+/g, ' ').trim().slice(0, max);

function checkKey(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) throw new SkillError('bad_key', 400, String(key ?? '').slice(0, 40));
  return key;
}

function checkVersion(v) {
  if (Number.isInteger(v) && v >= 1 && v < 1e9) return v;
  if (typeof v === 'string' && VERSION_RE.test(v)) return v;
  throw new SkillError('bad_version', 400, String(v ?? '').slice(0, 20));
}

// SKILL.md front-matter: `---`, `key: value` lines, `---`. Values may be quoted, or folded
// over indented lines (`description: >` …). Returns {} when there is none.
function parseFrontMatter(text) {
  const m = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(String(text || ''));
  if (!m) return {};
  const out = {};
  let cur = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
    if (kv) {
      cur = kv[1];
      let v = kv[2].trim();
      if (/^[>|][-+]?$/.test(v)) v = '';
      else if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) || (v.startsWith("'") && v.endsWith("'") && v.length > 1)) v = v.slice(1, -1);
      out[cur] = v;
    } else if (cur && /^\s+\S/.test(line)) {
      out[cur] = (out[cur] ? out[cur] + ' ' : '') + line.trim();
    }
  }
  return out;
}

// A bundle's files: { "SKILL.md": "...", "ref/x.md": "..." }. Relative paths only, no `..`,
// no dot-files (the marker is ours), text only, ≤ 20 files, ≤ 256 KB. Returns [[rel, text]].
function validateFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new SkillError('bad_files', 400, 'expected an object of path → text');
  const entries = Object.entries(files);
  if (!entries.length) throw new SkillError('no_skill_md');
  if (entries.length > MAX_FILES) throw new SkillError('too_many_files', 400, `max ${MAX_FILES}`);
  let total = 0;
  const seen = new Set();
  const out = [];
  for (const [rel, text] of entries) {
    if (typeof rel !== 'string' || !rel || rel.length > 200 || rel.includes('\\') || rel.startsWith('/')) throw new SkillError('bad_path', 400, String(rel).slice(0, 80));
    const segs = rel.split('/');
    if (segs.length > 4 || !segs.every(s => SEG_RE.test(s) && s !== '..' && s !== '.')) throw new SkillError('bad_path', 400, rel.slice(0, 80));
    if (seen.has(rel.toLowerCase())) throw new SkillError('bad_path', 400, `duplicate ${rel.slice(0, 80)}`);
    seen.add(rel.toLowerCase());
    if (typeof text !== 'string') throw new SkillError('bad_files', 400, `${rel.slice(0, 80)} is not text`);
    if (text.includes('\u0000')) throw new SkillError('bad_files', 400, `${rel.slice(0, 80)} is not text`);
    total += Buffer.byteLength(text);
    if (total > MAX_BYTES) throw new SkillError('too_large', 400, `max ${MAX_BYTES / 1024} KB`);
    out.push([rel, text]);
  }
  // A file and a folder of the same name can't both exist.
  for (const rel of seen) for (const other of seen) if (other !== rel && other.startsWith(rel + '/')) throw new SkillError('bad_path', 400, rel.slice(0, 80));
  const skillMd = out.find(([rel]) => rel === 'SKILL.md');
  if (!skillMd) throw new SkillError('no_skill_md');
  const fm = parseFrontMatter(skillMd[1]);
  if (!oneLine(fm.name, NAME_MAX) || !oneLine(fm.description, SUMMARY_MAX)) throw new SkillError('bad_front_matter', 400, 'SKILL.md needs name and description in its front-matter');
  return out;
}

// ─── Catalogues ───────────────────────────────────────────────────────────────
function normLang(e, i, key) {
  const out = {};
  for (const l of LANGS) {
    const name = oneLine(e?.[l]?.name, NAME_MAX), summary = oneLine(e?.[l]?.summary, SUMMARY_MAX);
    if (name && summary) out[l] = { name, summary };
  }
  if (!LANGS.some(l => out[l])) throw new SkillError('bad_catalog', 400, `skill ${i + 1} (${key}): needs a name and summary in en or es`);
  return out;
}
const normTags = tags => (Array.isArray(tags) ? tags.slice(0, 6).map(x => oneLine(x, 24)).filter(Boolean) : []);

// The hosted catalogue ORCA Host sends for this client. Throws on anything malformed.
function normalizeCatalog(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.skills)) throw new SkillError('bad_catalog', 400, 'expected {"skills": [...]}');
  if (raw.skills.length > CATALOG_MAX) throw new SkillError('bad_catalog', 400, `too many skills (max ${CATALOG_MAX})`);
  const seen = new Set();
  const skills = raw.skills.map((s, i) => {
    const key = String(s?.key ?? '');
    if (!KEY_RE.test(key)) throw new SkillError('bad_catalog', 400, `skill ${i + 1}: bad key "${key.slice(0, 40)}"`);
    if (seen.has(key)) throw new SkillError('bad_catalog', 400, `skill ${i + 1}: duplicate key "${key}"`);
    seen.add(key);
    let version;
    try { version = checkVersion(s.version); } catch { throw new SkillError('bad_catalog', 400, `skill "${key}": bad version`); }
    let request = null;
    if (s.request != null) {
      const st = String(s.request.status || '');
      if (!REQUEST_STATUS.includes(st)) throw new SkillError('bad_catalog', 400, `skill "${key}": bad request status "${st.slice(0, 20)}"`);
      const at = s.request.at;
      request = { status: st, at: typeof at === 'number' && Number.isFinite(at) ? at : typeof at === 'string' ? at.slice(0, 40) : null };
      const note = str(s.request.note, NOTE_MAX);
      if (note) request.note = note;
    }
    return { key, version, ...normLang(s, i, key), tags: normTags(s.tags), request };
  });
  return { version: 1, updatedAt: Number(raw.updatedAt) || Date.parse(raw.updatedAt) || Date.now(), skills };
}

// The bundled catalogue (<app>/skills/catalog.json): { skills: [{ key, version?, en, es, tags }] }.
// Lenient: a bad entry is skipped, not fatal (log says which).
function readBundledCatalog(dir, log = () => {}) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') log('skills.bundled_bad', { error: e.message }); return []; }
  const out = [];
  (Array.isArray(raw?.skills) ? raw.skills : []).forEach((s, i) => {
    try {
      const key = checkKey(s?.key);
      out.push({ key, version: s.version == null ? 1 : checkVersion(s.version), ...normLang(s, i, key), tags: normTags(s.tags), request: null });
    } catch (e) { log('skills.bundled_entry_bad', { index: i, error: e.message }); }
  });
  return out;
}

function readHostedCatalog(file, log = () => {}) {
  try { return normalizeCatalog(JSON.parse(fs.readFileSync(file, 'utf8'))).skills; }
  catch (e) { if (e.code !== 'ENOENT') log('skills.catalog_bad', { error: e.message }); return []; }
}

// ─── Managed block in AGENTS.md / GEMINI.md ───────────────────────────────────
function renderBlock(skills) {
  if (!skills.length) return '';
  const lines = [BLOCK_START, '## Skills installed by ORCA', ''];
  for (const s of skills) {
    lines.push(`- **${oneLine(s.name, NAME_MAX).replace(/\*/g, '')}** — ${oneLine(s.description, SUMMARY_MAX).replace(/\.$/, '')}. When a task matches, read ${path.join(s.dir, 'SKILL.md')} first.`);
  }
  lines.push(BLOCK_END);
  return lines.join('\n');
}

// Replace (or add, or drop) our block; every other byte of the file stays as it was.
function rewriteBlock(text, block) {
  text = String(text || '');
  const a = text.indexOf(BLOCK_START);
  const b = a < 0 ? -1 : text.indexOf(BLOCK_END, a);
  if (a >= 0 && b >= 0) {
    const before = text.slice(0, a), after = text.slice(b + BLOCK_END.length);
    if (block) return before + block + after;
    // Drop the block and the blank line we put in front of it.
    return before.replace(/\n\n$/, '\n') + after.replace(/^\n/, '');
  }
  if (!block) return text;
  if (!text) return block + '\n';
  return text + (text.endsWith('\n') ? '\n' : '\n\n') + block + '\n';
}

// ─── The store ────────────────────────────────────────────────────────────────
function createSkills({ home, configDir, bundledDir = null, now = () => Date.now(), log = () => {} }) {
  const ROOT = path.join(configDir, 'skills');
  const CLAUDE_DIR = path.join(home, '.claude', 'skills');
  const CATALOG_FILE = path.join(configDir, 'operio-skills.json');
  const BLOCK_FILES = [[path.join(home, '.codex'), 'AGENTS.md'], [path.join(home, '.gemini'), 'GEMINI.md']];

  const dirOf = key => path.join(ROOT, key);
  const lstat = p => { try { return fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };

  function readMarker(key) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dirOf(key), MARKER), 'utf8'));
      return m && m.key === key ? m : null;
    } catch { return null; }
  }

  // Ours = a symlink whose target lies inside <config>/skills/.
  function linkIsOurs(link) {
    let target;
    try { target = fs.readlinkSync(link); } catch { return false; }
    const abs = path.resolve(path.dirname(link), target);
    return abs.startsWith(ROOT + path.sep);
  }

  function claudeLinkState(key) {
    const link = path.join(CLAUDE_DIR, key);
    const st = lstat(link);
    if (!st) return 'none';
    return st.isSymbolicLink() && linkIsOurs(link) ? 'ours' : 'foreign';
  }

  function list() {
    let names = [];
    try { names = fs.readdirSync(ROOT); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const out = [];
    for (const key of names.sort()) {
      if (!KEY_RE.test(key)) continue;
      const m = readMarker(key);
      if (!m) continue;
      let fm = {};
      try { fm = parseFrontMatter(fs.readFileSync(path.join(dirOf(key), 'SKILL.md'), 'utf8')); } catch { /* listed without a name */ }
      out.push({ key, version: m.version, installedAt: m.installedAt, source: m.source, name: oneLine(fm.name, NAME_MAX) || key, description: oneLine(fm.description, SUMMARY_MAX), dir: dirOf(key) });
    }
    return out;
  }

  function syncBlocks() {
    const block = renderBlock(list());
    for (const [dir, name] of BLOCK_FILES) {
      if (!lstat(dir)?.isDirectory()) continue;
      const file = path.join(dir, name);
      let text = '';
      try { text = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') { log('skills.block_unreadable', { file: name, error: e.code }); continue; } }
      const next = rewriteBlock(text, block);
      if (next === text) continue;
      if (!next.trim()) {
        try { fs.unlinkSync(file); } catch { /* gone already */ } // the file held only our block
        continue;
      }
      fs.writeFileSync(file, next, { mode: 0o644 }); // through a symlink, if it is one
    }
  }

  // bundle = { key, version, files }. Replaces an earlier install of ours; refuses anything else.
  function install(bundle, { source = 'operio' } = {}) {
    if (!bundle || typeof bundle !== 'object') throw new SkillError('bad_request', 400, 'expected {key, version, files}');
    const key = checkKey(bundle.key);
    const version = checkVersion(bundle.version);
    const files = validateFiles(bundle.files);
    const dest = dirOf(key);
    if (lstat(dest) && !readMarker(key)) throw new SkillError('not_ours', 409, `${dest} exists and was not installed by ORCA`);
    if (claudeLinkState(key) === 'foreign') throw new SkillError('conflict', 409, `${path.join(CLAUDE_DIR, key)} already exists and is not ORCA's`);

    fs.mkdirSync(ROOT, { recursive: true, mode: 0o700 });
    const tmp = path.join(ROOT, `.${key}.tmp-${crypto.randomBytes(4).toString('hex')}`);
    try {
      fs.mkdirSync(tmp, { mode: 0o700 });
      for (const [rel, text] of files) {
        const p = path.join(tmp, ...rel.split('/'));
        fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
        fs.writeFileSync(p, text, { mode: 0o600 });
      }
      fs.writeFileSync(path.join(tmp, MARKER), JSON.stringify({ key, version, installedAt: now(), source: source === 'bundled' ? 'bundled' : 'operio' }) + '\n', { mode: 0o600 });
      const old = lstat(dest) ? path.join(ROOT, `.${key}.old-${crypto.randomBytes(4).toString('hex')}`) : null;
      if (old) fs.renameSync(dest, old);
      fs.renameSync(tmp, dest);
      if (old) fs.rmSync(old, { recursive: true, force: true });
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw e;
    }

    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    const link = path.join(CLAUDE_DIR, key);
    if (claudeLinkState(key) === 'ours') fs.unlinkSync(link);
    fs.symlinkSync(dest, link);
    syncBlocks();
    const bytes = files.reduce((n, [, t]) => n + Buffer.byteLength(t), 0);
    log('skills.install', { key, version, files: files.length, bytes, source });
    return { key, version, files: files.length, bytes };
  }

  function remove(key) {
    checkKey(key);
    const dest = dirOf(key);
    const ours = !!readMarker(key);
    if (lstat(dest) && !ours) throw new SkillError('not_ours', 409, `${dest} was not installed by ORCA`);
    if (claudeLinkState(key) === 'ours') fs.unlinkSync(path.join(CLAUDE_DIR, key));
    if (!ours) { syncBlocks(); return { key, removed: false }; }
    fs.rmSync(dest, { recursive: true, force: true });
    syncBlocks();
    log('skills.remove', { key });
    return { key, removed: true };
  }

  // A bundled skill's files, read from <app>/skills/<key>/ (same limits as any bundle).
  function bundledFiles(key) {
    checkKey(key);
    if (!bundledDir) throw new SkillError('not_found', 404);
    const base = path.join(bundledDir, key);
    if (!lstat(base)?.isDirectory()) throw new SkillError('not_found', 404);
    const files = {};
    let n = 0;
    (function walk(dir, rel) {
      for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
        if (d.name.startsWith('.')) continue;
        const r = rel ? `${rel}/${d.name}` : d.name;
        if (d.isDirectory()) walk(path.join(dir, d.name), r);
        else if (d.isFile()) {
          if (++n > MAX_FILES) throw new SkillError('too_many_files');
          files[r] = fs.readFileSync(path.join(dir, d.name), 'utf8');
        }
      }
    })(base, '');
    return files;
  }

  function installBundled(key) {
    const entry = readBundledCatalog(bundledDir || '', log).find(s => s.key === key);
    if (!entry) throw new SkillError('not_found', 404);
    return install({ key, version: entry.version, files: bundledFiles(key) }, { source: 'bundled' });
  }

  function setCatalog(raw) {
    const cat = normalizeCatalog(raw);
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    const tmp = CATALOG_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cat), { mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, CATALOG_FILE);
    return cat;
  }

  // What the panel's Skills dialog shows. Installed skills missing from the catalogue are
  // listed too, so they can still be seen (and, on the free panel, removed).
  function view({ hosted = false, lang = 'en', canRequest = false } = {}) {
    const cat = hosted ? readHostedCatalog(CATALOG_FILE, log) : readBundledCatalog(bundledDir || '', log);
    const installed = new Map(list().map(s => [s.key, s]));
    const pick = s => s[lang] || s[LANGS.find(l => s[l])];
    const items = cat.map(s => {
      const v = pick(s), inst = installed.get(s.key);
      installed.delete(s.key);
      return { key: s.key, name: v.name, summary: v.summary, tags: s.tags, version: s.version, installed: inst ? { version: inst.version } : null, request: inst ? null : s.request, source: inst ? inst.source : (hosted ? 'operio' : 'bundled') };
    });
    for (const s of installed.values()) {
      items.push({ key: s.key, name: s.name, summary: s.description, tags: [], version: s.version, installed: { version: s.version }, request: null, source: s.source });
    }
    return { mode: hosted ? 'hosted' : 'local', canRequest: !!(hosted && canRequest), items };
  }

  return { install, remove, list, installBundled, setCatalog, view, syncBlocks, ROOT, CLAUDE_DIR, CATALOG_FILE };
}

module.exports = {
  createSkills, SkillError, parseFrontMatter, validateFiles, normalizeCatalog, readBundledCatalog,
  renderBlock, rewriteBlock, KEY_RE, MAX_FILES, MAX_BYTES, BLOCK_START, BLOCK_END,
};
