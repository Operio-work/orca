'use strict';

// Routine packs: ~/.config/operio-orca/routines/<id>/routine.json
//
//   {
//     "id": "morning-brief",                       // = folder name, [a-z][a-z0-9-]{1,31}
//     "name":    { "en": "...", "es": "..." },
//     "problem": { "en": "...", "es": "..." },
//     "prompt":  "What the agent should do",
//     "schedule": "30 7 * * 1-6",                  // 5-field cron, server local time;
//                                                  // leave it out (or null) for an on-demand pack
//     "approval": "draft" | "none",                // draft = output waits for your approval
//     "agent":   "claude" | "codex" | "opencode",
//     "cwd":     "~"                               // folder the agent starts in (inside HOME)
//   }
//
// Pack files are never rewritten by the panel. Your choices (enabled, schedule override) and
// the draft approvals live in routines-state.json; every run is a JSON line in logs/.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cron = require('./cron');

const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
const AGENTS = ['claude', 'codex', 'opencode'];
const APPROVALS = ['draft', 'none'];
const PROMPT_MAX = 3000;

function bilingual(v, field, errors) {
  if (!v || typeof v !== 'object' || typeof v.en !== 'string' || !v.en.trim() || typeof v.es !== 'string' || !v.es.trim()) {
    errors.push(`${field} needs non-empty "en" and "es" text`);
    return null;
  }
  if (v.en.length > 300 || v.es.length > 300) errors.push(`${field} is longer than 300 characters`);
  return { en: v.en.trim(), es: v.es.trim() };
}

// Returns { ok, routine, errors }. dirName, when given, must equal the id.
function validate(raw, dirName) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, routine: null, errors: ['routine.json must be a JSON object'] };
  const id = raw.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) errors.push('id must match [a-z][a-z0-9-]{1,31}');
  else if (dirName && id !== dirName) errors.push(`id "${id}" must match its folder name "${dirName}"`);
  const name = bilingual(raw.name, 'name', errors);
  const problem = bilingual(raw.problem, 'problem', errors);
  if (typeof raw.prompt !== 'string' || !raw.prompt.trim()) errors.push('prompt is required');
  else if (raw.prompt.length > PROMPT_MAX) errors.push(`prompt is longer than ${PROMPT_MAX} characters`);
  // No schedule = on demand: it only runs when you press Run now.
  const onDemand = raw.schedule === undefined || raw.schedule === null;
  if (!onDemand && (typeof raw.schedule !== 'string' || !cron.isValid(raw.schedule))) errors.push('schedule must be a valid 5-field cron expression, or left out for an on-demand routine');
  if (!APPROVALS.includes(raw.approval)) errors.push('approval must be "draft" or "none"');
  if (!AGENTS.includes(raw.agent)) errors.push(`agent must be one of ${AGENTS.join(', ')}`);
  if (raw.cwd !== undefined && (typeof raw.cwd !== 'string' || !raw.cwd.trim())) errors.push('cwd must be a folder path');
  if (errors.length) return { ok: false, routine: null, errors };
  return {
    ok: true,
    errors: [],
    routine: { id, name, problem, prompt: raw.prompt.trim(), schedule: onDemand ? null : raw.schedule.trim(), approval: raw.approval, agent: raw.agent, cwd: (raw.cwd || '~').trim() },
  };
}

// Every pack folder in dir: { routines: [...], invalid: [{ id, errors }] }.
function loadAll(dir) {
  const routines = [], invalid = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { routines, invalid }; }
  for (const e of entries.filter(x => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, e.name, 'routine.json');
    let raw;
    try {
      const text = fs.readFileSync(file, 'utf8');
      if (text.length > 64 * 1024) { invalid.push({ id: e.name, errors: ['routine.json is larger than 64 KB'] }); continue; }
      raw = JSON.parse(text);
    } catch (err) {
      invalid.push({ id: e.name, errors: [err.code === 'ENOENT' ? 'no routine.json' : 'routine.json is not valid JSON'] });
      continue;
    }
    const v = validate(raw, e.name);
    if (v.ok) routines.push(v.routine); else invalid.push({ id: e.name, errors: v.errors });
  }
  return { routines, invalid };
}

// ── State: enabled / schedule overrides / drafts ─────────────────────────────
function readState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { routines: s.routines || {}, runs: s.runs || {} };
  } catch { return { routines: {}, runs: {} }; }
}
function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// The routine as the panel uses it: pack + your choices. An on-demand pack (schedule null)
// ignores any stored schedule override and never runs on its own.
function effective(r, state) {
  const s = state.routines[r.id] || {};
  return { ...r, enabled: !!s.enabled, schedule: r.schedule ? (s.schedule || r.schedule) : null, packSchedule: r.schedule };
}

// ── Runs ─────────────────────────────────────────────────────────────────────
const newRunId = (now = new Date()) => {
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}-${crypto.randomBytes(2).toString('hex')}`;
};
const RUN_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;

function outputPath(dirs, r, runId) {
  return path.join(r.approval === 'draft' ? dirs.drafts : dirs.reports, r.id, runId + '.md');
}

// What the agent is told. The output path is absolute so it can't land anywhere else.
function buildPrompt(r, out) {
  const tail = r.approval === 'draft'
    ? `This is a DRAFT for the owner to review and approve. Do not send, post, publish or email anything yourself, and do not contact anyone.`
    : `This is an internal report. Do not send, post, publish or email anything.`;
  return [
    `[ORCA routine: ${r.name.en}]`,
    r.prompt,
    '',
    `When you are done, write your result as Markdown to this file (create the folder if needed): ${out}`,
    tail,
  ].join('\n');
}

// One JSON object per line, appended. Never holds secrets; the prompt is the pack's own text.
function appendLog(logsDir, entry) {
  fs.mkdirSync(logsDir, { recursive: true, mode: 0o700 });
  fs.appendFileSync(path.join(logsDir, 'routines.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 });
}

function readLog(logsDir, limit = 200) {
  let text = '';
  try { text = fs.readFileSync(path.join(logsDir, 'routines.jsonl'), 'utf8'); } catch { return []; }
  const lines = text.split('\n').filter(Boolean).slice(-limit);
  const out = [];
  for (const l of lines) { try { out.push(JSON.parse(l)); } catch { /* torn line */ } }
  return out;
}

module.exports = { ID_RE, AGENTS, APPROVALS, PROMPT_MAX, RUN_RE, validate, loadAll, readState, writeState, effective, newRunId, outputPath, buildPrompt, appendLog, readLog };
