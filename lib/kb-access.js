'use strict';
// Knowledge — which agents search which collection (a first-level folder of <config>/knowledge).
//
//   <config>/kb-access.json (mode 600)
//   { "collections": { "<collection>": { "agents": ["names"], "tags": ["tags"] } } }
//
// A collection with no entry is open to all agents. With an entry, an agent may search it when its
// name is in `agents` or it carries one of `tags` (both compared without case). Documents at the
// top of the knowledge folder (no collection) are open to everyone. A person running
// `operio-orca kb search` (not inside an agent) always searches everything.
//
// This scopes what the search returns. It is not a security wall: an agent running as the same
// user could still open the files directly.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { KbError, COLLECTION_RE } = require('./kb');

const FILE = 'kb-access.json';
const MAX_COLLECTIONS = 200;
const MAX_ENTRIES = 100;           // names (or tags) per collection
const NAME_RE = /^[\p{L}\p{N} ._:-]{1,40}$/u; // an agent name, as the panel accepts it
const TAG_RE = /^[\p{L}\p{N}_-]{1,20}$/u;      // a tag, as the panel accepts it

const empty = () => ({ collections: {} });

function cleanList(v, what, re) {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new KbError('bad_access', 400, `${what} must be a list`);
  const out = [];
  const seen = new Set();
  for (const x of v) {
    const s = typeof x === 'string' ? x.trim() : '';
    if (!s || !re.test(s)) throw new KbError('bad_access', 400, `${what}: ${String(x).slice(0, 64)}`);
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  if (out.length > MAX_ENTRIES) throw new KbError('bad_access', 400, `${what}: max ${MAX_ENTRIES}`);
  return out;
}

function checkName(c) {
  if (typeof c !== 'string' || !COLLECTION_RE.test(c) || c.includes('..')) throw new KbError('bad_collection', 400, String(c ?? '').slice(0, 64));
  return c;
}

// One collection's rule → { agents, tags }, or null when it is open to all agents
// (no entry, or both lists empty).
function validateRule(rule) {
  if (rule == null) return null;
  if (typeof rule !== 'object' || Array.isArray(rule)) throw new KbError('bad_access', 400, 'rule must be an object');
  const agents = cleanList(rule.agents, 'agents', NAME_RE);
  const tags = cleanList(rule.tags, 'tags', TAG_RE);
  return agents.length || tags.length ? { agents, tags } : null;
}

// The whole file → normalised { collections: { name: { agents, tags } } } (open collections dropped).
function validateAccess(obj) {
  if (obj == null) return empty();
  if (typeof obj !== 'object' || Array.isArray(obj)) throw new KbError('bad_access', 400, 'not an object');
  const src = obj.collections ?? {};
  if (typeof src !== 'object' || Array.isArray(src)) throw new KbError('bad_access', 400, 'collections must be an object');
  const names = Object.keys(src);
  if (names.length > MAX_COLLECTIONS) throw new KbError('bad_access', 400, `max ${MAX_COLLECTIONS} collections`);
  const out = empty();
  for (const c of names.sort()) {
    checkName(c);
    const r = validateRule(src[c]);
    if (r) out.collections[c] = r;
  }
  return out;
}

// May this agent ({ name, tags }) search this collection? null collection = top-level documents.
function mayUse(access, agent, collection) {
  if (!collection) return true;
  const r = access?.collections?.[collection];
  if (!r) return true;
  const name = String(agent?.name || '').toLowerCase();
  if (name && r.agents.some(a => a.toLowerCase() === name)) return true;
  const tags = new Set((agent?.tags || []).map(t => String(t).toLowerCase()));
  return r.tags.some(t => tags.has(t.toLowerCase()));
}

// The collections (of allCollections) this agent may search.
function allowedCollections(access, agent, allCollections) {
  return [...new Set(allCollections || [])].filter(c => mayUse(access, agent, c)).sort();
}

// What an agent gets: 'all', or the collections it may and may not search. `denied` lists every
// restricted collection it is kept out of, including ones that have no documents yet, so a
// caller that filters by `denied` is right even when a folder appears after the answer.
function scopeOf(access, agent, allCollections) {
  const known = [...new Set([...(allCollections || []), ...Object.keys(access?.collections || {})])].sort();
  const denied = known.filter(c => !mayUse(access, agent, c));
  if (!denied.length) return { scope: 'all', denied: [] };
  return { scope: known.filter(c => !denied.includes(c)), denied };
}

function createKbAccess({ configDir, log = () => {} }) {
  const file = path.join(configDir, FILE);

  function load() {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return empty(); throw e; }
    try { return validateAccess(JSON.parse(raw)); }
    catch (e) {
      // A broken file must not stop the panel or the search: it counts as "no rules" (as before
      // any rule was set) and the log says so. Scoping is a focus tool, so open is the safe side.
      log('kb.access_unreadable', { detail: String(e.code || e.message).slice(0, 120) });
      return empty();
    }
  }

  function save(obj) {
    const clean = validateAccess(obj);
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    const tmp = path.join(configDir, `.${FILE}.${crypto.randomBytes(3).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', { mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, file);
    return clean;
  }

  // Set (or clear, with empty lists) one collection's rule; returns the stored rule or null.
  function set(collection, rule) {
    checkName(collection);
    const cur = load();
    const r = validateRule(rule);
    if (r) cur.collections[collection] = r; else delete cur.collections[collection];
    save(cur);
    return r;
  }

  return { load, save, set, file };
}

module.exports = { createKbAccess, validateAccess, validateRule, mayUse, allowedCollections, scopeOf, FILE };
