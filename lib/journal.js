'use strict';

// ORCA journal: an append-only record of what you and your agents did, kept for review.
//
//   journal/YYYY-MM-DD.jsonl[.gz]     one JSON entry per line (gzipped after GZIP_AFTER days)
//   journal/out/YYYY-MM-DD/<id>.txt.gz  saved pane output (end of a job, an agent ended)
//   journal/digest/YYYY-MM-DD.json    the day's summary + who reviewed it
//
// Days are local server days (TZ of the process). Everything is 0600 in a 0700 dir and
// is never served raw: the API shapes entries first. Text passes through redact() before it is written, so keys and
// tokens never reach the disk. Files older than KEEP_DAYS are deleted.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const GZIP_AFTER = 7;          // days: older day files are compressed
const OUT_MAX = 64 * 1024;     // bytes of pane output kept per snapshot (the tail)
const TEXT_MAX = 4000;         // chars of any single text field

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const OUT_ID_RE = /^\d{4}-\d{2}-\d{2}\/[a-z0-9_-]{1,80}\.txt\.gz$/;

// ─── Redaction: never write a secret ─────────────────────────────────────────
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[private key]'],
  [/\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{16,}/g, '[secret]'],
  [/\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/g, '[secret]'],
  [/\bglpat-[A-Za-z0-9_-]{16,}/g, '[secret]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '[secret]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[secret]'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '[secret]'],
  [/\bgsk_[A-Za-z0-9]{20,}/g, '[secret]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[token]'],
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/-]{16,}=*/gi, '$1 [secret]'],
  // Env style NAME_KEY=value (upper case only, so prose like "keys: Enter" is left alone)
  [/\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIALS?)[A-Z0-9_]*)(\s*=\s*["']?)[^\s"',;]{6,}/g, '$1$2[secret]'],
  // Any *_API_KEY, *_TOKEN or *_SECRET name (llm.env names, any case), with = or :
  [/\b([A-Za-z0-9_]*_(?:api_key|token|secret))(\s*[=:]\s*["']?)[^\s"',;]{6,}/gi, '$1$2[secret]'],
  // JSON style "api_key": "value"
  [/(["'][A-Za-z0-9_-]*(?:key|token|secret|password|passwd|credentials?)[A-Za-z0-9_-]*["']\s*:\s*["'])[^"']{6,}/gi, '$1[secret]'],
  // Prose style "password: hunter22", "api key = abc…"
  [/\b((?:api[ _-]?key|access[ _-]?token|auth[ _-]?token|secret|password|passwd)\s*[=:]\s*)[^\s"',;]{6,}/gi, '$1[secret]'],
  // URLs with a password in them: scheme://user:pass@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]{3,}@/gi, '$1[secret]@'],
  // Long hex (keys, not 40-char git SHAs)
  [/\b[a-f0-9]{48,}\b/gi, '[secret]'],
];
function redact(text) {
  let s = String(text ?? '');
  for (const [re, rep] of SECRET_PATTERNS) s = s.replace(re, rep);
  return s;
}
const clip = (s, max = TEXT_MAX) => { s = String(s ?? ''); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
const stripAnsi = s => String(s || '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g, '');

// ─── Days (local time) ───────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
function dayOf(ts = Date.now()) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dayStart(day) { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
function addDays(day, n) { const t = new Date(dayStart(day)); t.setDate(t.getDate() + n); return dayOf(t.getTime()); }

function createJournal({ dir, log = () => {}, keepDays = 90 }) {
  const KEEP_DAYS = Math.max(1, Number(keepDays) || 90);
  const OUT_DIR = path.join(dir, 'out');
  const DIGEST_DIR = path.join(dir, 'digest');
  const mk = d => fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  mk(dir); mk(OUT_DIR); mk(DIGEST_DIR);

  const dayFile = day => path.join(dir, day + '.jsonl');

  // ── Write
  // entry: { event, who?, agent?: {...}, ...detail }. Strings are redacted and clipped.
  function clean(v, depth = 0) {
    if (typeof v === 'string') return clip(redact(v));
    if (Array.isArray(v)) return v.slice(0, 50).map(x => clean(x, depth + 1));
    if (v && typeof v === 'object' && depth < 4) {
      const o = {};
      for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = clean(x, depth + 1);
      return o;
    }
    return v;
  }
  function write(event, data = {}) {
    const ts = Date.now();
    const entry = { ts, id: crypto.randomBytes(5).toString('hex'), event, ...clean(data) };
    try {
      fs.appendFileSync(dayFile(dayOf(ts)), JSON.stringify(entry) + '\n', { mode: 0o600 });
    } catch (e) { log('journal.write_failed', { detail: e.message }); }
    return entry;
  }

  // ── Output snapshots
  function snapshot(name, text) {
    const body = redact(stripAnsi(text)).replace(/[ \t]+$/gm, '').replace(/\n{4,}/g, '\n\n\n').trim();
    if (!body) return null;
    const tail = Buffer.byteLength(body) > OUT_MAX ? '… (earlier output cut)\n' + Buffer.from(body).subarray(-OUT_MAX).toString('utf8') : body;
    const day = dayOf();
    const d = new Date();
    const slug = String(name || 'agent').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 40) || 'agent';
    const id = `${day}/${slug}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${crypto.randomBytes(3).toString('hex')}.txt.gz`;
    try {
      mk(path.join(OUT_DIR, day));
      fs.writeFileSync(path.join(OUT_DIR, id), zlib.gzipSync(tail), { mode: 0o600 });
      return id;
    } catch (e) { log('journal.snapshot_failed', { detail: e.message }); return null; }
  }
  function readSnapshot(id) {
    if (!OUT_ID_RE.test(String(id || ''))) return null;
    try { return zlib.gunzipSync(fs.readFileSync(path.join(OUT_DIR, id))).toString('utf8'); } catch { return null; }
  }

  // ── Read
  function readDay(day) {
    if (!DAY_RE.test(day)) return [];
    let raw = '';
    try { raw = fs.readFileSync(dayFile(day), 'utf8'); }
    catch { try { raw = zlib.gunzipSync(fs.readFileSync(dayFile(day) + '.gz')).toString('utf8'); } catch { return []; } }
    const out = [];
    for (const line of raw.split('\n')) { if (!line) continue; try { out.push(JSON.parse(line)); } catch { /* torn line */ } }
    return out;
  }
  function days() {
    return [...new Set(fs.readdirSync(dir).map(f => f.match(/^(\d{4}-\d{2}-\d{2})\.jsonl(?:\.gz)?$/)?.[1]).filter(Boolean))].sort().reverse();
  }

  // ── Digest: the day in one page, for a person to review
  const digestFile = day => path.join(DIGEST_DIR, day + '.json');
  function readDigest(day) { try { return JSON.parse(fs.readFileSync(digestFile(day), 'utf8')); } catch { return null; } }
  function saveDigest(d) {
    const tmp = digestFile(d.day) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, digestFile(d.day));
  }

  // nameOf(who) -> display name
  function buildDigest(day, nameOf) {
    const entries = readDay(day);
    const agents = new Map(); // terminal (or pane) -> row
    const rowFor = a => {
      const key = a?.terminal || a?.pane || '?';
      if (!agents.has(key)) agents.set(key, { terminal: a?.terminal || null, name: a?.name || a?.pane || '?', kind: a?.kind || null, cwd: a?.cwd || null, started: null, ended: null, jobs: [], prompts: 0, people: new Set(), blocked: 0 });
      const r = agents.get(key);
      if (a?.name) r.name = a.name;
      if (a?.kind && !r.kind) r.kind = a.kind;
      if (a?.cwd && !r.cwd) r.cwd = a.cwd;
      return r;
    };
    const people = new Map();
    const personRow = login => { const n = nameOf(login); if (!people.has(n)) people.set(n, { name: n, actions: 0, prompts: 0, started: 0, ended: 0 }); return people.get(n); };
    const counts = { started: 0, ended: 0, gone: 0, jobs: 0, prompts: 0, answers: 0, stops: 0, handoffs: 0, messages: 0, security: 0, errors: 0 };
    const security = [], errors = new Map();
    for (const e of entries) {
      const p = e.who ? personRow(e.who) : null;
      if (p) p.actions++;
      const r = e.agent ? rowFor(e.agent) : null;
      if (r && p) r.people.add(p.name);
      switch (e.event) {
        case 'agent.new': counts.started++; if (p) p.started++; if (r) r.started = { at: e.ts, by: p?.name || null }; break;
        case 'agent.end': counts.ended++; if (p) p.ended++; if (r) r.ended = { at: e.ts, by: p?.name || null, mode: e.mode, out: e.out || null }; break;
        case 'agent.gone': counts.gone++; if (r && !r.ended) r.ended = { at: e.ts, by: null, mode: 'gone' }; break;
        case 'agent.job': counts.jobs++; if (r) r.jobs.push({ at: e.ts, ask: e.ask || '', said: e.said || '', secs: e.secs ?? null, out: e.out || null }); break;
        case 'agent.prompt': case 'chat.prompt': counts.prompts++; if (p) p.prompts++; if (r) r.prompts++; break;
        case 'agent.answer': counts.answers++; break;
        case 'agent.stop': counts.stops++; break;
        case 'agent.blocked': if (r) r.blocked++; break;
        case 'handoff.send': counts.handoffs++; break;
        case 'msg.agent': counts.messages++; break;
        case 'error': { counts.errors += e.n || 1; const k = `${e.code || 'internal'} ${e.path || ''}`; errors.set(k, (errors.get(k) || 0) + (e.n || 1)); break; }
        default:
          if (e.event.startsWith('shell.') || e.event.startsWith('access.')) {
            counts.security++;
            if (e.event !== 'shell.open' && e.event !== 'shell.close') security.push({ at: e.ts, event: e.event, who: p?.name || null, detail: e.code || e.path || '', minutes: e.minutes, agent: e.agent?.name || null });
          }
      }
    }
    const agentRows = [...agents.values()]
      .filter(r => r.started || r.ended || r.jobs.length || r.prompts)
      .map(r => ({ ...r, people: [...r.people] }))
      .sort((x, y) => (y.jobs.length - x.jobs.length) || x.name.localeCompare(y.name));
    const prev = readDigest(day);
    return {
      day, generatedAt: Date.now(), final: day < dayOf(), counts,
      people: [...people.values()].sort((a, b) => b.actions - a.actions),
      agents: agentRows,
      security: security.slice(-50),
      errors: [...errors.entries()].map(([k, n]) => ({ what: k.trim(), n })).sort((a, b) => b.n - a.n).slice(0, 20),
      reviewed: prev?.reviewed || null,
    };
  }

  function digestMarkdown(d) {
    const t = ts => { const x = new Date(ts); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };
    const c = d.counts;
    const L = [`# ORCA journal — ${d.day}`, ''];
    L.push(`- Agents started: ${c.started} · ended: ${c.ended} · exited on their own: ${c.gone}`);
    L.push(`- Jobs finished: ${c.jobs} · prompts sent: ${c.prompts} · answers: ${c.answers} · stops: ${c.stops}`);
    L.push(`- Hand-offs: ${c.handoffs} · agent messages: ${c.messages} · security events: ${c.security} · errors: ${c.errors}`);
    if (d.reviewed) L.push(`- Reviewed by ${d.reviewed.by} at ${new Date(d.reviewed.at).toLocaleString()}${d.reviewed.note ? ` — ${d.reviewed.note}` : ''}`);
    if (d.people.length) { L.push('', '## People', ''); for (const p of d.people) L.push(`- **${p.name}**: ${p.actions} actions, ${p.prompts} prompts, ${p.started} started, ${p.ended} ended`); }
    if (d.agents.length) {
      L.push('', '## Agents', '');
      for (const a of d.agents) {
        const bits = [a.kind, a.cwd].filter(Boolean).join(' · ');
        L.push(`### ${a.name}${bits ? ` (${bits})` : ''}`);
        if (a.started) L.push(`- Started ${t(a.started.at)}${a.started.by ? ` by ${a.started.by}` : ''}`);
        if (a.ended) L.push(`- ${a.ended.mode === 'gone' ? 'Exited' : 'Ended'} ${t(a.ended.at)}${a.ended.by ? ` by ${a.ended.by}` : ''}${a.ended.mode && a.ended.mode !== 'gone' ? ` (${a.ended.mode})` : ''}`);
        if (a.people.length) L.push(`- People: ${a.people.join(', ')}`);
        for (const j of a.jobs) L.push(`- ${t(j.at)}${j.secs != null ? ` (${Math.round(j.secs / 60) || '<1'} min)` : ''}: ${j.ask ? `asked “${j.ask}” → ` : ''}${j.said || '(no reply text)'}`);
        L.push('');
      }
    }
    if (d.security.length) { L.push('## Security', ''); for (const s of d.security) L.push(`- ${t(s.at)} ${s.event}${s.who ? ` · ${s.who}` : ''}${s.detail ? ` · ${s.detail}` : ''}`); L.push(''); }
    if (d.errors.length) { L.push('## Errors', ''); for (const e of d.errors) L.push(`- ${e.what} ×${e.n}`); L.push(''); }
    return L.join('\n');
  }

  function dayMarkdown(day, entries, describe) {
    const L = [`# ORCA journal — ${day} (all entries)`, ''];
    for (const e of entries) { const x = new Date(e.ts); L.push(`- ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())} ${describe(e)}`); }
    return L.join('\n') + '\n';
  }

  // ── Housekeeping: compress old days, delete past KEEP_DAYS, write missing digests
  function housekeep(nameOf) {
    const today = dayOf();
    const cutoff = addDays(today, -KEEP_DAYS);
    const gzBefore = addDays(today, -GZIP_AFTER);
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})\.jsonl(\.gz)?$/);
      if (!m) continue;
      const p = path.join(dir, f);
      if (m[1] < cutoff) { fs.rmSync(p, { force: true }); continue; }
      if (!m[2] && m[1] < gzBefore) {
        try { fs.writeFileSync(p + '.gz', zlib.gzipSync(fs.readFileSync(p)), { mode: 0o600 }); fs.rmSync(p); } catch (e) { log('journal.gzip_failed', { detail: e.message }); }
      }
    }
    for (const d of fs.readdirSync(OUT_DIR)) if (DAY_RE.test(d) && d < cutoff) fs.rmSync(path.join(OUT_DIR, d), { recursive: true, force: true });
    for (const f of fs.readdirSync(DIGEST_DIR)) { const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/); if (m && m[1] < cutoff) fs.rmSync(path.join(DIGEST_DIR, f), { force: true }); }
    // A finished day with entries gets its final digest (catches days the server was down at midnight).
    for (const day of days()) {
      if (day >= today) continue;
      const d = readDigest(day);
      if (!d || !d.final) saveDigest(buildDigest(day, nameOf));
    }
  }

  function listDigests() {
    return fs.readdirSync(DIGEST_DIR).map(f => f.match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1]).filter(Boolean).sort().reverse().map(readDigest).filter(Boolean);
  }
  function review(day, by, note) {
    const d = readDigest(day);
    if (!d) return null;
    d.reviewed = by ? { by, at: Date.now(), note: clip(redact(note || ''), 500) } : null;
    saveDigest(d);
    return d;
  }

  return { write, snapshot, readSnapshot, readDay, days, buildDigest, saveDigest, readDigest, listDigests, review, digestMarkdown, dayMarkdown, housekeep, dayOf, addDays, DAY_RE };
}

module.exports = { createJournal, redact, stripAnsi, dayOf };
