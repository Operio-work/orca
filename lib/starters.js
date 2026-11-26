'use strict';
// Starter agents: ready-made saved agents bundled with ORCA (<app>/starters/starters.json), based on
// the roles on the Operio website (/for pages). Adding one = install its bundled skills + save it as a profile.
// { starters: [{ id, look, icon, skills: [key], en: { label, summary, instructions }, es: {…} }] }

const fs = require('fs');
const path = require('path');

const ID_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const LANGS = ['en', 'es'];
const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

function readStarters(dir, log = () => {}) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(path.join(dir, 'starters.json'), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') log('starters.bad', { error: e.message }); return []; }
  const out = [];
  for (const s of Array.isArray(raw?.starters) ? raw.starters : []) {
    if (!ID_RE.test(String(s?.id)) || !LANGS.every(l => s[l]?.label && s[l]?.instructions)) { log('starters.entry_bad', { id: String(s?.id ?? '') }); continue; }
    const lang = l => ({ label: str(s[l].label, 60), summary: str(s[l].summary, 300), instructions: str(s[l].instructions, 8000) });
    out.push({
      id: s.id, look: str(s.look, 20), icon: str(s.icon, 8),
      skills: (Array.isArray(s.skills) ? s.skills : []).map(String).filter(k => KEY_RE.test(k)).slice(0, 20),
      en: lang('en'), es: lang('es'),
    });
  }
  return out;
}

// What the Saved agents dialog shows: one language, and whether a saved agent already has that id.
function viewStarters(list, { lang = 'en', taken = new Set() } = {}) {
  const l = LANGS.includes(lang) ? lang : 'en';
  return list.map(s => ({ id: s.id, look: s.look, icon: s.icon, skills: s.skills, label: s[l].label, summary: s[l].summary, added: taken.has(s.id) }));
}

// The profile a starter becomes. `installed` = skill keys available on this panel (others are left out).
function starterProfile(s, { lang = 'en', kind = 'claude', installed = null } = {}) {
  const l = LANGS.includes(lang) ? lang : 'en';
  const skills = installed ? s.skills.filter(k => installed.has(k)) : s.skills;
  return { id: s.id, type: 'agent', label: s[l].label, kind, model: '', folder: '~', instructions: s[l].instructions, skills, tools: { builtin: 'default', mcp: [] }, create: true };
}

module.exports = { readStarters, viewStarters, starterProfile };
