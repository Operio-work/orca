'use strict';
// Prompt templates: text a person drops into an agent's prompt box (never sent by itself).
//   personal — one person's own (per login; the free panel has only these)
//   company  — shared with everyone on this panel; admins add, edit and delete
//   operio   — Operio's library, written by ORCA Host into operio-templates.json; read-only here
// Storage: <dir>/templates.json (0600). The Operio file is re-read when its mtime changes.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TITLE_MAX = 80, BODY_MAX = 4000, PER_SCOPE = 200;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const LANGS = ['en', 'es'];

class TemplateError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

function clean(s, max) {
  return String(s ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// An Operio entry is bilingual: { id, en: { title, body }, es: { title, body }, tags? }.
// Returns one shaped for `lang`, falling back to the other language.
function pickLang(t, lang) {
  const order = [lang, ...LANGS.filter(l => l !== lang)];
  for (const l of order) {
    const v = t?.[l];
    if (v && typeof v.title === 'string' && typeof v.body === 'string' && v.title.trim() && v.body.trim()) {
      return { title: clean(v.title, TITLE_MAX), body: clean(v.body, BODY_MAX), lang: l };
    }
  }
  return null;
}

function createTemplates({ dir, operioFile = null, company = true, operio = true, now = () => Date.now(), log = () => {} }) {
  const FILE = path.join(dir, 'templates.json');
  let data = { personal: {}, company: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    data = { personal: raw.personal && typeof raw.personal === 'object' ? raw.personal : {}, company: Array.isArray(raw.company) ? raw.company : [] };
  } catch (e) { if (e.code !== 'ENOENT') log('templates.load_failed', { error: e.message }); }

  function save() {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, FILE);
  }

  let opCache = { mtime: -1, list: [] };
  function operioList() {
    if (!operio || !operioFile) return [];
    let st;
    try { st = fs.statSync(operioFile); } catch { opCache = { mtime: -1, list: [] }; return []; }
    if (st.mtimeMs === opCache.mtime) return opCache.list;
    let list = [];
    try {
      const raw = JSON.parse(fs.readFileSync(operioFile, 'utf8'));
      list = (Array.isArray(raw.templates) ? raw.templates : []).filter(t => ID_RE.test(String(t?.id || ''))).slice(0, 500);
    } catch (e) { log('templates.operio_bad', { error: e.message }); }
    opCache = { mtime: st.mtimeMs, list };
    return list;
  }

  const key = login => login || 'local';
  const mineOf = login => (data.personal[key(login)] ||= []);

  // Everything this person can use, in the UI language. canEdit marks rows they may change.
  function list(login, { lang = 'en', admin = false } = {}) {
    const shape = (t, scope, canEdit) => ({ id: t.id, scope, title: t.title, body: t.body, updatedAt: t.updatedAt || null, canEdit });
    return {
      personal: (data.personal[key(login)] || []).map(t => shape(t, 'personal', true)),
      company: company ? data.company.map(t => shape(t, 'company', admin)) : [],
      operio: operioList().map(t => {
        const v = pickLang(t, lang);
        return v ? { id: t.id, scope: 'operio', title: v.title, body: v.body, lang: v.lang, tags: Array.isArray(t.tags) ? t.tags.slice(0, 6).map(String) : [], canEdit: false } : null;
      }).filter(Boolean),
      canEditCompany: company && admin,
      scopes: ['personal', ...(company ? ['company'] : []), ...(operio && operioFile ? ['operio'] : [])],
    };
  }

  function bucket(login, scope, admin) {
    if (scope === 'personal') return mineOf(login);
    if (scope === 'company') {
      if (!company) throw new TemplateError('not_available', 404);
      if (!admin) throw new TemplateError('forbidden', 403);
      return data.company;
    }
    throw new TemplateError(scope === 'operio' ? 'read_only' : 'bad_scope', scope === 'operio' ? 403 : 400);
  }

  // Create (no id) or update (id) one template. Returns the saved row.
  function put(login, { id, scope, title, body }, { admin = false } = {}) {
    const list = bucket(login, scope, admin);
    const t = clean(title, TITLE_MAX), b = clean(body, BODY_MAX);
    if (!t) throw new TemplateError('title_required');
    if (!b) throw new TemplateError('body_required');
    let row;
    if (id) {
      row = list.find(x => x.id === id);
      if (!row) throw new TemplateError('not_found', 404);
      Object.assign(row, { title: t, body: b, updatedAt: now(), by: key(login) });
    } else {
      if (list.length >= PER_SCOPE) throw new TemplateError('too_many');
      row = { id: crypto.randomBytes(6).toString('base64url'), title: t, body: b, createdAt: now(), updatedAt: now(), by: key(login) };
      list.push(row);
    }
    save();
    log('templates.put', { scope, chars: b.length, update: !!id }); // never the text
    return { id: row.id, scope, title: row.title, body: row.body, updatedAt: row.updatedAt, canEdit: true };
  }

  function remove(login, { id, scope }, { admin = false } = {}) {
    const list = bucket(login, scope, admin);
    const i = list.findIndex(x => x.id === id);
    if (i < 0) throw new TemplateError('not_found', 404);
    list.splice(i, 1);
    save();
    log('templates.delete', { scope });
  }

  return { list, put, remove };
}

module.exports = { createTemplates, pickLang, TemplateError, TITLE_MAX, BODY_MAX };
