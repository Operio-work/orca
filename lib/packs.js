'use strict';
// Industry packs: <config>/packs/<id>/pack.json + templates/ + examples/, put there by ORCA Host
// (operio-orca packs add, a bundle on stdin). The free panel ships none; Operio's packs are private.
// One tap installs a pack: its agents (saved agents built on the starter agents, with an
// industry focus), its routines (written to your own routines folder, switched off), and its
// templates and example documents (copied to the pack's folder, never overwriting a file).
//
//   { id, icon, look, folder: "~/orca-desk/<id>", en: { name, summary }, es: {…},
//     agents: [{ id, base?: <starter id>, look, skills?: [], en: { label, summary, focus | instructions }, es: {…} }],
//     routines: [<routine.json objects, see routines.js>] }

const fs = require('fs');
const path = require('path');
const routinesLib = require('./routines');


const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
const LANGS = ['en', 'es'];
const FOCUS = { en: '## This business', es: '## Este negocio' };

// Packs with their agents resolved against the starters ({ id, skills, en/es: { instructions } }).
function readPacks(dir, starters, log = () => {}) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of names.sort()) {
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(dir, name, 'pack.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') log('packs.bad', { pack: name, error: e.message }); continue; }
    try { out.push(resolve(p, name, path.join(dir, name), starters)); }
    catch (e) { log('packs.bad', { pack: name, error: e.message }); }
  }
  return out;
}

function resolve(p, name, root, starters) {
  if (p.id !== name || !ID_RE.test(p.id)) throw new Error('id must match the folder');
  if (!LANGS.every(l => p[l]?.name && p[l]?.summary)) throw new Error('name and summary in en and es');
  if (typeof p.folder !== 'string' || !/^~\/[A-Za-z0-9._/-]+$/.test(p.folder) || p.folder.includes('..')) throw new Error('folder must be ~/…');
  const agents = (p.agents || []).map(a => {
    if (!ID_RE.test(a.id)) throw new Error(`agent id ${a.id}`);
    const base = a.base ? starters.find(s => s.id === a.base) : null;
    if (a.base && !base) throw new Error(`agent ${a.id}: unknown starter ${a.base}`);
    const lang = l => {
      const v = a[l] || {};
      if (!v.label || !v.summary) throw new Error(`agent ${a.id}: label and summary in ${l}`);
      const instructions = base ? `${FOCUS[l]}\n\n${v.focus || ''}\n\n${base[l].instructions}` : v.instructions;
      if (!instructions || (base && !v.focus)) throw new Error(`agent ${a.id}: instructions in ${l}`);
      return { label: v.label, summary: v.summary, instructions };
    };
    return { id: a.id, look: a.look || base?.look || '', skills: a.skills || base?.skills || [], en: lang('en'), es: lang('es') };
  });
  const routines = (p.routines || []).map(r => {
    const v = routinesLib.validate(r, r.id);
    if (v.errors?.length) throw new Error(`routine ${r.id}: ${v.errors.join('; ')}`);
    return r;
  });
  const files = sub => { try { return fs.readdirSync(path.join(root, sub)).filter(f => !f.startsWith('.')).sort(); } catch { return []; } };
  return { id: p.id, icon: p.icon || '', look: p.look || '', folder: p.folder, en: p.en, es: p.es, agents, routines, templates: files('templates'), examples: files('examples'), root };
}

// What the Saved agents dialog shows. A pack is "installed" when all its agents are saved.
function viewPacks(packs, { lang = 'en', taken = new Set() } = {}) {
  const l = LANGS.includes(lang) ? lang : 'en';
  return packs.map(p => ({
    id: p.id, icon: p.icon, look: p.look, name: p[l].name, summary: p[l].summary, folder: p.folder,
    agents: p.agents.map(a => ({ id: a.id, label: a[l].label, look: a.look })),
    routines: p.routines.map(r => r.name[l]), templates: p.templates.length,
    installed: p.agents.every(a => taken.has(a.id)),
  }));
}

// The saved agent one pack agent becomes. `installed` = skill keys on this panel (others left out).
function packProfile(a, { lang = 'en', installed = null } = {}) {
  const l = LANGS.includes(lang) ? lang : 'en';
  return { id: a.id, type: 'agent', label: a[l].label, kind: 'claude', model: '', folder: '~', instructions: a[l].instructions, skills: installed ? a.skills.filter(k => installed.has(k)) : a.skills, tools: { builtin: 'default', mcp: [] }, create: true };
}

// Copy templates/ and examples/ into the pack folder; existing files are kept. Returns copied names.
function copyFiles(p, home) {
  const dest = path.join(home, p.folder.slice(2));
  const done = [];
  for (const [sub, list] of [['templates', p.templates], ['examples', p.examples]]) {
    const to = path.join(dest, sub);
    fs.mkdirSync(to, { recursive: true });
    for (const f of list) {
      const target = path.join(to, f);
      if (fs.existsSync(target)) continue;
      fs.copyFileSync(path.join(p.root, sub, f), target);
      done.push(`${sub}/${f}`);
    }
  }
  for (const d of ['inbox', 'drafts']) fs.mkdirSync(path.join(dest, d), { recursive: true });
  return done;
}

// Write the pack's routines into your own routines folder (switched off); an existing one is kept.
function writeRoutines(p, dir) {
  const done = [];
  for (const r of p.routines) {
    const file = path.join(dir, r.id, 'routine.json');
    if (fs.existsSync(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
    done.push(r.id);
  }
  return done;
}

// ─── Bundles (ORCA Host → operio-orca packs add) ─────────────────────────────
// { id, version, pack: <pack.json>, files: { "templates/x.md": "…", "examples/y.csv": "…" },
//   skills: [{ key, version, files }] }  — text files only, relative, no hidden names.
const FILE_RE = /^(templates|examples)\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;
const MAX_FILES = 40, MAX_FILE = 256 * 1024, MAX_TOTAL = 1024 * 1024;

function checkBundle(b, starters) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('bundle must be a JSON object');
  if (!ID_RE.test(String(b.id)) || b.pack?.id !== b.id) throw new Error('bad pack id');
  const files = b.files && typeof b.files === 'object' ? Object.entries(b.files) : [];
  if (files.length > MAX_FILES) throw new Error(`too many files (max ${MAX_FILES})`);
  let total = 0;
  for (const [f, text] of files) {
    if (!FILE_RE.test(f)) throw new Error(`bad file path: ${f}`);
    if (typeof text !== 'string' || text.includes('\u0000')) throw new Error(`not a text file: ${f}`);
    const n = Buffer.byteLength(text);
    if (n > MAX_FILE) throw new Error(`file too large: ${f}`);
    total += n;
  }
  if (total > MAX_TOTAL) throw new Error('bundle too large');
  if (b.skills != null && !Array.isArray(b.skills)) throw new Error('skills must be a list');
  resolve(b.pack, b.id, '/nonexistent', starters); // agents, routines, folder: same rules as the panel
  return { files, skills: b.skills || [] };
}

// Install or replace one pack's definition and files (the client's saved agents, routines and
// copied files are theirs and stay). `installSkill(bundle)` installs each skill the pack brings.
function addBundle(b, { packsDir, starters, installSkill }) {
  const { files, skills } = checkBundle(b, starters);
  const done = skills.map(s => installSkill(s));
  const dir = path.join(packsDir, b.id), tmp = dir + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(tmp, 'pack.json'), JSON.stringify({ ...b.pack, version: String(b.version || '1') }, null, 2) + '\n', { mode: 0o600 });
  for (const [f, text] of files) {
    fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(tmp, f), text, { mode: 0o600 });
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  return { id: b.id, version: String(b.version || '1'), files: files.length, skills: done.map(r => r.key) };
}

function removePack(id, packsDir) {
  if (!ID_RE.test(String(id))) throw new Error('bad pack id');
  const dir = path.join(packsDir, id);
  if (!fs.existsSync(path.join(dir, 'pack.json'))) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

function listPacks(packsDir) {
  let names = [];
  try { names = fs.readdirSync(packsDir); } catch { return []; }
  const out = [];
  for (const n of names.sort()) {
    try { const p = JSON.parse(fs.readFileSync(path.join(packsDir, n, 'pack.json'), 'utf8')); if (p.id === n) out.push({ id: n, version: String(p.version || '1') }); } catch { /* not a pack */ }
  }
  return out;
}

module.exports = { readPacks, viewPacks, packProfile, copyFiles, writeRoutines, checkBundle, addBundle, removePack, listPacks };
