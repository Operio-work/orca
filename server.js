#!/usr/bin/env node
'use strict';

// Free-ORCA by Operio — a self-hosted control panel for the AI agents running in herdr
// panes: see, name, tag, reply to and start agents, run scheduled routines, and get phone
// alerts when an agent finishes or needs you. Runs on herdr (Apache-2.0, herdr.dev); the
// server shells out to the `herdr` CLI (execFile, no shell). One dependency (web-push).
//
// Security: this TYPES INTO live agents and shells. It binds to 127.0.0.1 by default,
// answers only to known Host names (blocks DNS rebinding), requires a same-origin Origin on
// every state-changing request (blocks CSRF) and asks for confirmation before any shell.
// There is no login: anyone who can reach the port can drive your agents.

const http = require('http');
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFile } = require('child_process');
const webpush = require('web-push');
const guard = require('./lib/guard');
const routinesLib = require('./lib/routines');
const { Scheduler } = require('./lib/scheduler');
const cronLib = require('./lib/cron');

// ─── Config ───────────────────────────────────────────────────────────────────
const CFG = require('./lib/config').load();
const HOME  = CFG.HOME;
const expandHome = p => (p === '~' ? HOME : p.replace(/^~\//, HOME + '/'));
const shortHome  = p => (p || '').replace(HOME, '~');
const HOST  = CFG.HOST;
const PORT  = CFG.PORT;
const HERDR = fs.existsSync(CFG.HERDR) || !CFG.HERDR_FALLBACK ? CFG.HERDR : CFG.HERDR_FALLBACK;
const ALLOWED_HOSTS = guard.makeAllowed({ host: HOST, port: PORT, allowedHosts: CFG.ALLOWED_HOSTS });
const STATE_DIR  = CFG.CONFIG_DIR;
const STATE_FILE = CFG.STATE_FILE;
const VAPID_FILE = CFG.VAPID_FILE;
const POLL_MS    = CFG.POLL_MS;
const MIN_WORK_MS = CFG.MIN_WORK_MS; // shorter turns don't alert
const FOLDERS = CFG.FOLDERS;
const KINDS = ['claude', 'codex', 'opencode', 'hermes', 'agy', 'shell'];
const KEYS  = ['enter', 'esc', 'ctrl+c', 'up', 'down', 'tab', '1', '2', '3'];
const SHELL_UNLOCK_MS = CFG.SHELL_UNLOCK_MS;

const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  // style 'unsafe-inline' is for xterm.js (it sizes rows via injected styles); scripts stay strict 'self'.
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

const PANE_RE = /^w[A-Za-z0-9]+:p[A-Za-z0-9]+$/; // ids are base-36: w9 → wA
const TAB_RE  = /^w[A-Za-z0-9]+:t[A-Za-z0-9]+$/;
const WS_RE   = /^w[A-Za-z0-9]+$/;
const NAME_RE = /^[\p{L}\p{N} ._:-]{1,40}$/u;
const AGENT_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/; // herdr's own rule for agent names
const TAG_RE  = /^[\p{L}\p{N}_-]{1,20}$/u;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(event, data = {}) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + '\n');
}

// The UI never sees raw tool text: errors carry a short code the app turns into EN/ES copy.
// The raw detail (CLI stderr/JSON) goes to the log only.
class HttpError extends Error { constructor(status, code, detail) { super(code); this.status = status; this.code = code; this.detail = detail; } }
const HERDR_CODES = { agent_blocked: 'blocked', agent_not_found: 'gone', pane_not_found: 'gone', tab_not_found: 'tab_gone', workspace_not_found: 'ws_gone', agent_prompt_stalled: 'stalled', timeout: 'timeout' };

function herdr(args, timeout = 5000) {
  return new Promise((resolve, reject) => {
    execFile(HERDR, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      // herdr reports failures as JSON {error:{code,message}}: map the code, log the message.
      for (const raw of [stdout, stderr]) {
        if (!raw || raw[0] !== '{') continue;
        try {
          const j = JSON.parse(raw);
          if (j.error) return reject(new HttpError(409, HERDR_CODES[j.error.code] || 'workspace', j.error.message || j.error.code));
        } catch { /* not JSON */ }
      }
      if (err) return reject(new HttpError(502, 'unreachable', ((stderr || '') + (stdout || '')).trim().slice(0, 300) || err.message));
      resolve(stdout);
    });
  });
}
const herdrJson = async (args, timeout) => JSON.parse(await herdr(args, timeout));

function send(res, status, body, type = 'application/json') {
  const data = type === 'application/json' ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(data);
}

// ─── People: single user ──────────────────────────────────────────────────────
// Free-ORCA has no login system. Everyone who reaches the page is "you"; the shared
// "Team" claim is kept so an agent can be marked as company-wide work.
const loginOf = () => 'local';
const TEAM = 'team:all';
const TEAM_NAME = process.env.FREE_ORCA_TEAM || 'Team';
const YOU_NAME = process.env.FREE_ORCA_NAME || 'You';
function person(login) {
  if (login === TEAM) return { id: 'team', name: TEAM_NAME, initial: TEAM_NAME[0].toUpperCase(), slot: 0, team: true };
  return { id: 'local', name: YOU_NAME, initial: YOU_NAME[0].toUpperCase(), slot: 0 };
}

// Writes must come from this app's own origin (blocks cross-site form/fetch posts).
const sameOrigin = req => guard.sameOrigin(req, ALLOWED_HOSTS);

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > limit) { reject(new HttpError(413, 'too_long')); req.destroy(); } });
    req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { reject(new HttpError(400, 'bad_request')); } });
  });
}


// ─── State (tags + push subscriptions) ───────────────────────────────────────
// Tags are keyed by terminal_id: unique per terminal, so a recycled pane id never
// inherits another agent's tags.
let state = { tags: {}, tagColors: {}, subs: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* first run */ }

// ─── Crew: the names you reuse ────────────────────────────────────────────────
// Learned from renames (count + last use), with pins and hides; each name also remembers
// its usual tags, so a reused name brings them back on a new agent.
// state.names = { use: {name: {n, last}}, pinned, hidden, tags }.
state.names = { use: {}, pinned: [], hidden: [], tags: {}, ...(state.names || {}) };
function noteName(name) {
  if (!AGENT_NAME_RE.test(name)) return;
  const u = state.names.use[name] ||= { n: 0, last: 0 };
  u.n++; u.last = Date.now();
  state.names.hidden = state.names.hidden.filter(x => x !== name);
}
function crew(inUse) {
  const N = state.names;
  const score = n => { const u = N.use[n] || { n: 0, last: 0 }; return u.n * Math.pow(0.5, (Date.now() - u.last) / (14 * 864e5)); };
  const learned = Object.keys(N.use).filter(n => !N.pinned.includes(n) && !N.hidden.includes(n)).sort((a, b) => score(b) - score(a));
  return [...N.pinned, ...learned].slice(0, 12).map(name => ({ name, pinned: N.pinned.includes(name), inUse: inUse.has(name), tags: N.tags[name] || [] }));
}
// A name given to an agent: count it, and bring back its usual tags if the agent has none.
function applyName(terminal, name) {
  noteName(name);
  const remembered = (state.names.tags[name] || []).filter(tg => tg in state.tagColors); // forgotten tags stay gone
  if (terminal && remembered?.length && !(state.tags[terminal] || []).length) state.tags[terminal] = remembered;
  saveState();
}

function saveState() {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STATE_FILE);
}

// ─── Tag library: every tag ever created stays reusable until someone forgets it ─
// The library is state.tagColors (tag -> colour slot); tagUsed remembers when each was last
// put on an agent, so the picker can offer the most used and most recent first.
state.tagUsed = state.tagUsed || {};
const nextTagSlot = () => Object.values(state.tagColors).reduce((m, v) => Math.max(m, v + 1), 0);
function tagLibrary(agents) {
  const n = {};
  for (const a of agents) for (const tg of state.tags[a.terminal] || []) n[tg] = (n[tg] || 0) + 1; // open agents only
  return Object.keys(state.tagColors).map(tag => ({ tag, n: n[tag] || 0, last: state.tagUsed[tag] || 0 }));
}

// ─── Web Push (VAPID keys generated once, kept out of the repo) ──────────────
let vapid;
try { vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')); }
catch {
  vapid = webpush.generateVAPIDKeys();
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid), { mode: 0o600 });
  log('vapid.generated', { file: VAPID_FILE });
}
webpush.setVapidDetails(CFG.VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);

// Alert copy per subscriber language (EN/ES), no emoji.
const PUSH = {
  en: { blocked: n => `${n} needs you`, done: n => `${n} finished`, taken: n => `${n} was taken over`, assigned: n => `${n} is yours now`, handoff: n => `${n} finished — hand off?`, chatty: n => `${n}: link paused`, test: () => 'Free-ORCA alerts are on', testBody: 'You’ll hear when an agent finishes or needs you.' },
  es: { blocked: n => `${n} te necesita`, done: n => `${n} terminó`, taken: n => `${n} fue tomado`, assigned: n => `${n} ahora es tuyo`, handoff: n => `${n} terminó — ¿pasar el relevo?`, chatty: n => `${n}: enlace en pausa`, test: () => 'Alertas de Free-ORCA activas', testBody: 'Te avisaremos cuando un agente termine o te necesite.' },
};
function pushPayload(p, lang) {
  const L = PUSH[lang] || PUSH.en;
  return JSON.stringify({ ...p, title: L[p.kind](p.name), body: p.kind === 'test' ? L.testBody : p.body });
}

// only: a login — alerts for a claimed agent go to its holder's devices (and to devices
// subscribed before logins were recorded, which re-register with theirs on next open).
async function pushAll(payload, only = null) {
  if (!state.subs.length) return 0;
  const dead = [];
  let sent = 0;
  const subs = only ? state.subs.filter(x => !x.login || x.login === only) : state.subs;
  await Promise.all(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, pushPayload(payload, s.lang), { TTL: 600, urgency: 'high' })
    .then(() => { sent++; })
    .catch(e => {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
      else log('push.error', { status: e.statusCode, error: String(e.body || e.message).slice(0, 200) });
    })));
  if (dead.length) {
    state.subs = state.subs.filter(s => !dead.includes(s.endpoint));
    saveState();
    log('push.pruned', { count: dead.length });
  }
  log('push.sent', { kind: payload.kind, sent });
  return sent;
}

// ─── Agents ───────────────────────────────────────────────────────────────────
function shapeAgent(a) {
  return {
    pane: a.pane_id,
    tab: a.tab_id,
    terminal: a.terminal_id,
    name: a.name || null,
    agent: a.agent,
    status: a.agent_status,
    title: a.terminal_title_stripped || '',
    cwd: shortHome(a.foreground_cwd || a.cwd),
    focused: !!a.focused,
    tags: state.tags[a.terminal_id] || [],
    session: a.agent_session?.value || null,
    since: prev.get(a.pane_id)?.since || null, // ms epoch the current status began (poller-tracked)
    jobs: jobStats(a.terminal_id),
    fresh: isFresh(a.terminal_id), // finished a job nobody has opened yet (any device)
    claim: claimOf(a.terminal_id),
    seq: a.state_change_seq || 0, // herdr's change counter: higher = changed more recently
  };
}

// Workspace geometry for the map: every tab with its panes' real rectangles (agent or not).
let layoutCache = { at: 0, tabs: [], workspaces: [] };
const shapeWorkspace = w => ({ id: w.workspace_id, number: w.number, label: w.label || null });
async function workspaceLayout() {
  if (Date.now() - layoutCache.at < 5000) return layoutCache;
  const [wsOut, tabsOut, panesOut] = await Promise.all([herdrJson(['workspace', 'list']), herdrJson(['tab', 'list']), herdrJson(['pane', 'list'])]);
  const panes = panesOut.result?.panes || [];
  const tabs = await Promise.all((tabsOut.result?.tabs || []).map(async t => {
    const first = panes.find(p => p.tab_id === t.tab_id);
    let area = null, rects = [];
    if (first) {
      try {
        const l = (await herdrJson(['pane', 'layout', '--pane', first.pane_id])).result?.layout;
        area = l?.area || null;
        rects = (l?.panes || []).map(p => ({ pane: p.pane_id, ...p.rect }));
      } catch { /* tab closed mid-read */ }
    }
    return {
      id: t.tab_id, ws: t.workspace_id, number: t.number, label: t.label || null, area,
      panes: rects.map(r => {
        const p = panes.find(x => x.pane_id === r.pane);
        return { pane: r.pane, x: r.x, y: r.y, w: r.width, h: r.height, agent: p?.agent || null, cwd: shortHome(p?.foreground_cwd || p?.cwd) };
      }),
    };
  }));
  layoutCache = { at: Date.now(), tabs, workspaces: (wsOut.result?.workspaces || []).map(shapeWorkspace) };
  return layoutCache;
}

async function listAgents() {
  const out = await herdrJson(['agent', 'list']);
  return (out.result?.agents || []).map(shapeAgent)
    .sort((a, b) => a.tab.localeCompare(b.tab, 'en', { numeric: true }) || a.pane.localeCompare(b.pane));
}

// ─── Job log: every finished turn, per terminal ─────────────────────────────
// A job runs from the first 'working' to the next idle/done (a stop to ask you stays inside it).
// At the end the output is read once: the last prompt (❯ / ›) and the agent's last prose reply
// (● / •). Kept in the state file only (never in the log): newest first, JOBS_KEEP per agent.
state.jobs = state.jobs || {};
const JOBS_KEEP = 8;
const JOB_TTL = 14 * 864e5;
const sentAsk = new Map(); // terminal -> { text, at }: what ORCA sent, in case the output has no prompt line
const work = new Map();    // pane -> { from } while a job runs (from = null when the start is unknown)

state.seen = state.seen || {}; // terminal -> end of the last job someone opened
// Claims: who is on an agent (anyone can still act on it). terminal -> { login, at }. Never expire.
state.claims = state.claims || {};
function claimOf(terminal) {
  const c = state.claims[terminal];
  if (!c) return null;
  const p = person(c.login);
  const by = c.by && c.by !== c.login ? person(c.by) : null;
  return { id: p.id, name: p.name, initial: p.initial, slot: p.slot, team: !!p.team, at: c.at, by: by ? { id: by.id, name: by.name } : null };
}
// Everyone who can be assigned: the allowlist, plus named people.
const PEOPLE_LOGINS = () => ['local', TEAM];
// Whose devices get its alerts: the holder's; everyone's when unclaimed or the team's.
const holderLogin = terminal => { const l = state.claims[terminal]?.login; return l && l !== TEAM ? l : null; };
// Messaging or answering an agent nobody holds claims it for you (never steals one).
function autoClaim(terminal, login) {
  if (!terminal || !login || state.claims[terminal]) return;
  state.claims[terminal] = { login, at: Date.now() };
  saveState();
  log('agent.claim', { terminal, how: 'auto' });
}
function isFresh(terminal) {
  const end = state.jobs[terminal]?.[0]?.end;
  return !!end && end > (state.seen[terminal] || 0);
}

function jobStats(terminal) {
  const list = state.jobs[terminal] || [];
  const day = Date.now() - 864e5;
  const j = list[0];
  return { n: list.filter(x => x.end >= day).length, last: j?.end || null, said: j ? (j.said || j.title || '').slice(0, 240) : '', took: j?.start ? j.end - j.start : null };
}

const NOISE = /hook was skipped|^Compacted |sent the event on past it|^\w[\w.-]*\(/;
function oneLine(lines, i, max) {
  const out = [lines[i].replace(/^\s*[❯›>●•]\s+/, '')];
  for (let j = i + 1; j < lines.length && /^ {2,}\S/.test(lines[j]) && !/^\s*⎿/.test(lines[j]); j++) out.push(lines[j].trim());
  const text = out.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}
function summarizeTurn(text) {
  const lines = String(text || '').split('\n');
  const isAsk = l => /^[❯›]\s+\S/.test(l);
  const isSaid = l => /^[●•]\s+\S/.test(l) && !NOISE.test(l.replace(/^[●•]\s+/, ''));
  // The last prompt that has a reply after it (the live input line has none).
  let iAsk = -1;
  for (let i = lines.length - 1; i >= 0 && iAsk < 0; i--) if (isAsk(lines[i]) && lines.slice(i + 1).some(isSaid)) iAsk = i;
  let iSaid = -1;
  for (let i = lines.length - 1; i > iAsk; i--) if (isSaid(lines[i])) { iSaid = i; break; }
  return { ask: iAsk >= 0 ? oneLine(lines, iAsk, 160) : '', said: iSaid >= 0 ? oneLine(lines, iSaid, 240) : '' };
}

async function recordJob(a, from, end) {
  let sum = { ask: '', said: '' };
  try {
    let text;
    try { text = await herdr(['agent', 'read', a.pane, '--source', 'recent', '--lines', '200', '--format', 'text']); }
    catch { text = await herdr(['agent', 'read', a.pane, '--source', 'visible', '--format', 'text']); }
    sum = summarizeTurn(text);
  } catch { /* pane gone: keep the job with the title only */ }
  const sent = sentAsk.get(a.terminal);
  if (!sum.ask && sent && (!from || sent.at >= from - 5000)) sum.ask = sent.text.replace(/\s+/g, ' ').slice(0, 160);
  sentAsk.delete(a.terminal);
  const job = { start: from, end, ask: sum.ask, said: sum.said, title: a.title || '' };
  const list = [job, ...(state.jobs[a.terminal] || [])].slice(0, JOBS_KEEP);
  state.jobs[a.terminal] = list;
  for (const [t, l] of Object.entries(state.jobs)) if (!l.length || end - l[0].end > JOB_TTL) delete state.jobs[t];
  saveState();
  log('agent.job', { pane: a.pane, secs: from ? Math.round((end - from) / 1000) : null });
  offerHandoffs(a, job);
}

// ─── Answers: what an agent asks, and its reply chips ───────────────────────
// The reply-chips mod writes ~/.claude/orca/<pane>.json from inside Claude: the
// pending AskUserQuestion (exact options) and the latest reply chips. Without it
// (Codex, a permission prompt, an older session) the numbered menu on screen is read.
const ORCA_DIR = path.join(HOME, '.claude', 'orca');
const { chipsFor, lastReply } = require('./chips');
const screenChips = new Map(); // pane -> { key, chips }: worked out once per agent state
// Named by the Claude session id (survives the pane moving); older mods used the pane id.
function readHandoff(name) {
  try {
    const raw = fs.readFileSync(path.join(ORCA_DIR, name + '.json'), 'utf8');
    return raw.length > 65536 ? null : JSON.parse(raw);
  } catch { return null; }
}
function handoff(a) {
  const bySession = a.session && /^[A-Za-z0-9_-]{6,64}$/.test(a.session) ? readHandoff(a.session) : null;
  return bySession ? { ...bySession, own: true } : readHandoff(a.pane);
}
const RISKY = /don.t ask again|always allow|\bno\b|reject|deny|delete|remove|deploy|force/i;
// The last numbered menu on screen ("❯ 1. Yes", "  2. No, and tell Claude…").
function screenMenu(text) {
  const lines = String(text || '').split('\n').slice(-40);
  let opts = [], at = -1;
  lines.forEach((line, i) => {
    const m = line.match(/^[\s│|]*(?:[❯›>]\s*)?([1-9])[.)]\s+(.+?)\s*[│|]?\s*$/);
    if (!m) return;
    const n = +m[1];
    if (n === 1) { opts = []; at = i; }
    if (n === opts.length + 1) opts.push({ n, label: m[2].replace(/^\[[ ✔x]\]\s*/, '').trim() });
  });
  if (opts.length < 2) return null;
  let question = '';
  for (let i = at - 1; i >= Math.max(0, at - 8) && !question; i--) {
    const q = lines[i].replace(/^[\s│|●❯›>*-]+/, '').replace(/[│|]\s*$/, '').trim();
    if (q.length > 3 && /[?:]$/.test(q)) question = q;
  }
  return {
    question,
    options: opts.filter(o => !/^(chat about this|type something\.?)$/i.test(o.label)).map(o => ({ ...o, risky: RISKY.test(o.label) })),
  };
}
async function visible(pane) {
  try { return await herdr(['agent', 'read', pane, '--source', 'visible', '--format', 'text']); } catch { return ''; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function press(pane, ...keys) { for (const k of keys) { await herdr(['agent', 'send-keys', pane, k]); await sleep(220); } }

// ─── Alert poller: blocked = needs you; working → idle/done = finished ───────
const prev = new Map(); // pane -> { status, since }
let polledOnce = false;
async function poll() {
  let agents;
  try { agents = await listAgents(); } catch { return; }
  const now = Date.now();
  const seen = new Set();
  for (const a of agents) {
    seen.add(a.pane);
    const p = prev.get(a.pane);
    // First look after a restart: the state's start is unknown, so no age is shown for it.
    if (!p) prev.set(a.pane, { status: a.status, since: polledOnce ? now : null });
    else if (p.status !== a.status) prev.set(a.pane, { status: a.status, since: now });
    // Job log: open on working, close on idle/done (very short turns are not jobs).
    if (a.status === 'working' && !work.has(a.pane)) work.set(a.pane, { from: p || polledOnce ? now : null });
    else if ((a.status === 'idle' || a.status === 'done') && work.has(a.pane)) {
      const { from } = work.get(a.pane);
      work.delete(a.pane);
      if (!from || now - from >= 5000) recordJob(a, from, now).catch(() => {});
    }
    if (!p || p.status === a.status) continue;
    const label = a.name || a.pane;
    const url = '/#' + encodeURIComponent(a.pane);
    if (a.status === 'blocked') {
      pushAll({ name: label, body: a.title || a.cwd, tag: a.pane, url, kind: 'blocked' }, holderLogin(a.terminal));
    } else if (p.status === 'working' && (a.status === 'idle' || a.status === 'done') && now - p.since >= MIN_WORK_MS) {
      pushAll({ name: label, body: a.title || a.cwd, tag: a.pane, url, kind: 'done' }, holderLogin(a.terminal));
    }
  }
  for (const pane of prev.keys()) if (!seen.has(pane)) prev.delete(pane);
  for (const pane of work.keys()) if (!seen.has(pane)) work.delete(pane);
  polledOnce = true;
  deliverQueued(agents).catch(e => log('msg.deliver_error', { detail: e.detail || e.message }));
}
// Always track state (so the first alert after subscribing is correct); push only when subscribed.
setInterval(poll, POLL_MS);

// ─── New agent ────────────────────────────────────────────────────────────────
function resolveFolder(input) {
  const abs = path.resolve(expandHome(String(input || '~').trim()));
  if (abs !== HOME && !abs.startsWith(HOME + path.sep)) throw new HttpError(400, 'folder_outside');
  let st;
  try { st = fs.statSync(abs); } catch { throw new HttpError(400, 'folder_missing'); }
  if (!st.isDirectory()) throw new HttpError(400, 'not_folder');
  return abs;
}

async function newAgent({ name, kind, folder, tab }, { prepare } = {}) {
  name = String(name || '').trim();
  if (!AGENT_NAME_RE.test(name)) throw new HttpError(400, 'bad_agent_name');
  if (!KINDS.includes(kind)) throw new HttpError(400, 'bad_kind');
  const cwd = resolveFolder(folder);

  let pane;
  if (!tab || tab === 'new') {
    const out = await herdrJson(['tab', 'create', '--cwd', cwd, '--label', name]);
    pane = out.result?.root_pane?.pane_id;
  } else {
    if (!TAB_RE.test(tab)) throw new HttpError(400, 'bad_request');
    const panes = (await herdrJson(['pane', 'list'])).result?.panes || [];
    const inTab = panes.filter(p => p.tab_id === tab);
    if (!inTab.length) throw new HttpError(404, 'tab_gone');
    const base = inTab[inTab.length - 1].pane_id;
    const out = await herdrJson(['pane', 'split', base, '--direction', inTab.length % 2 ? 'right' : 'down', '--cwd', cwd]);
    pane = out.result?.pane?.pane_id || out.result?.pane_id;
  }
  if (!pane) throw new HttpError(502, 'start_failed', 'no pane id returned');
  await new Promise(r => setTimeout(r, 400)); // let the shell print its prompt
  if (prepare) await prepare(pane);
  // A plain shell: the pane is the result (named through its pane label).
  if (kind === 'shell') {
    await herdr(['pane', 'rename', pane, name]).catch(() => {});
    log('shell.new', { pane, name, cwd: shortHome(cwd), tab: tab || 'new' });
    layoutCache.at = 0;
    return { pane, shell: true };
  }
  let blocked = false;
  try {
    await herdr(['agent', 'start', name, '--kind', kind, '--pane', pane, '--timeout', '60000'], 70000);
  } catch (e) {
    // Started but asking something first (e.g. Claude's "trust this folder?"): not a failure.
    if (e.code !== 'blocked' && !/blocked/i.test(e.detail || '')) throw e;
    blocked = true;
  }
  await herdr(['agent', 'rename', pane, name]).catch(() => {});
  try { const pg = await herdrJson(['pane', 'get', pane]); applyName(pg.result?.pane?.terminal_id, name); } catch { applyName(null, name); }
  log('agent.new', { pane, name, kind, cwd: shortHome(cwd), tab: tab || 'new', blocked });
  layoutCache.at = 0;
  return { pane, blocked };
}

// ─── Move an agent (its pane) to another place ───────────────────────────────
// The process keeps running; herdr gives the pane a new id. terminal_id stays, so tags
// follow. Moving the last pane out of a tab/workspace closes it (herdr does that).
//   { mode: 'split', tab }          beside the panes of an existing tab
//   { mode: 'tab', workspace }      as a new tab in an existing workspace
//   { mode: 'workspace', label? }   as a new workspace
async function moveAgent(pane, body) {
  const agents = await listAgents();
  const a = agents.find(x => x.pane === pane);
  if (!a) throw new HttpError(404, 'gone');
  const tabName = a.name || 'agent';
  const args = ['pane', 'move', pane];
  const mode = body.mode;
  if (mode === 'split') {
    const tab = String(body.tab || '');
    if (!TAB_RE.test(tab)) throw new HttpError(400, 'bad_request');
    if (tab === a.tab) throw new HttpError(400, 'same_place');
    const inTab = ((await herdrJson(['pane', 'list'])).result?.panes || []).filter(p => p.tab_id === tab);
    if (!inTab.length) throw new HttpError(404, 'tab_gone');
    args.push('--tab', tab, '--split', inTab.length % 2 ? 'right' : 'down', '--target-pane', inTab[inTab.length - 1].pane_id);
  } else if (mode === 'tab') {
    const ws = String(body.workspace || '');
    if (!WS_RE.test(ws)) throw new HttpError(400, 'bad_request');
    args.push('--new-tab', '--workspace', ws, '--label', tabName);
  } else if (mode === 'workspace') {
    const label = String(body.label || '').trim() || tabName;
    if (!NAME_RE.test(label)) throw new HttpError(400, 'bad_name');
    args.push('--new-workspace', '--label', label, '--tab-label', tabName);
  } else throw new HttpError(400, 'bad_request');
  args.push('--no-focus');

  const r = (await herdrJson(args, 10000)).result?.move_result || {};
  const moved = r.pane?.pane_id;
  if (!moved) throw new HttpError(502, 'move_failed', JSON.stringify(r).slice(0, 300));
  // Keep the name and the status clock with the agent, not with the old pane id.
  if (a.name) await herdr(['agent', 'rename', moved, a.name]).catch(e => log('agent.move.rename_failed', { pane: moved, detail: e.detail }));
  const p = prev.get(pane);
  if (p) { prev.set(moved, p); prev.delete(pane); }
  layoutCache.at = 0;
  log('agent.move', { from: pane, to: moved, mode, tab: r.pane.tab_id, closedTab: r.closed_tab_id || null, closedWorkspace: r.closed_workspace_id || null });
  return { ok: true, pane: moved, tab: r.pane.tab_id, workspace: r.pane.workspace_id, closedWorkspace: !!r.closed_workspace_id };
}

// ─── Memory: RAM per agent + machine totals ─────────────────────────────────
// An agent's memory is its whole pane: the shell herdr started plus everything under it
// (the agent, its MCP servers, dev servers and tools it launched). PSS splits shared pages
// (the agent binary, libraries) fairly between processes, so the per-agent numbers add up
// to real usage instead of counting the same binary eleven times like RSS would.
// Pane → process: `herdr pane process-info` gives the pane's shell pid (follows moves);
// if that fails, a Claude agent is found through ~/.claude/sessions/<pid>.json (session id).
const SESSIONS_DIR = path.join(HOME, '.claude', 'sessions');
const MEM_TTL = 10000;
let memCache = { at: 0, data: null, pending: null };

const readText = f => fs.promises.readFile(f, 'utf8').catch(() => null);
const kbField = (text, key) => { const m = text && text.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm')); return m ? Number(m[1]) : 0; };

// No /proc (macOS): one `ps` call gives the same pid -> { ppid, comm } table.
function psTable() {
  return new Promise(resolve => {
    execFile('ps', ['-axo', 'pid=,ppid=,comm='], { maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
      const procs = new Map();
      if (!err) for (const line of out.split('\n')) {
        const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
        if (m) procs.set(Number(m[1]), { ppid: Number(m[2]), comm: path.basename(m[3].trim()) });
      }
      resolve(procs);
    });
  });
}

async function procTable() {
  let pids;
  try { pids = (await fs.promises.readdir('/proc')).filter(n => /^\d+$/.test(n)).map(Number); } catch { pids = null; }
  if (!pids || !pids.length) {
    const procs = await psTable();
    const children = new Map();
    for (const [pid, p] of procs) { if (!children.has(p.ppid)) children.set(p.ppid, []); children.get(p.ppid).push(pid); }
    return { procs, children };
  }
  const procs = new Map(); // pid -> { ppid, comm }
  await Promise.all(pids.map(async pid => {
    const s = await readText(`/proc/${pid}/stat`);
    if (!s) return;
    const close = s.lastIndexOf(')'); // comm may hold spaces and parens
    procs.set(pid, { comm: s.slice(s.indexOf('(') + 1, close), ppid: Number(s.slice(close + 2).split(' ')[1]) });
  }));
  const children = new Map();
  for (const [pid, p] of procs) { if (!children.has(p.ppid)) children.set(p.ppid, []); children.get(p.ppid).push(pid); }
  return { procs, children };
}

async function sessionPids() {
  const bySession = new Map();
  const files = await fs.promises.readdir(SESSIONS_DIR).catch(() => []);
  await Promise.all(files.filter(f => /^\d+\.json$/.test(f)).map(async f => {
    try { const j = JSON.parse(await readText(path.join(SESSIONS_DIR, f))); if (j.sessionId && j.pid) bySession.set(j.sessionId, j.pid); } catch { /* half-written */ }
  }));
  return bySession;
}

async function measureMemory() {
  if (DEMO) { // fictional, steady numbers: the demo's agents are scripts, not processes
    const agents = await listAgents();
    const rows = agents.map((a, i) => ({ pane: a.pane, name: a.name, agent: a.agent, pss: 182000 + ((i * 37) % 9) * 21000, swap: 0, procs: 3 }));
    return { at: Date.now(), agents: rows, total: { pss: rows.reduce((s, r) => s + r.pss, 0), swap: 0, procs: rows.length * 3 }, machine: { memTotal: 16777216, memUsed: 6501171, swapTotal: 2097152, swapUsed: 0 } };
  }
  const [agents, { procs, children }, bySession, meminfo] = await Promise.all([listAgents(), procTable(), sessionPids(), readText('/proc/meminfo')]);
  const isHerdr = pid => procs.get(pid)?.comm === 'herdr';
  // Pane roots: herdr's direct children. Walk up from a pid to the one whose parent is herdr.
  const rootOf = pid => {
    for (let p = pid, hops = 0; p > 1 && procs.has(p) && hops < 64; p = procs.get(p).ppid, hops++) if (isHerdr(procs.get(p).ppid)) return p;
    return procs.has(pid) ? pid : null;
  };
  const roots = new Map(); // pane -> root pid
  await Promise.all(agents.map(async a => {
    let root = null;
    try { root = (await herdrJson(['pane', 'process-info', '--pane', a.pane])).result?.process_info?.shell_pid || null; } catch { /* pane closed mid-read */ }
    if (!root || !procs.has(root)) { const pid = a.session && bySession.get(a.session); root = pid ? rootOf(pid) : null; }
    if (root) roots.set(a.pane, root);
  }));

  const tree = root => { const out = [], stack = [root]; while (stack.length) { const p = stack.pop(); out.push(p); stack.push(...(children.get(p) || [])); } return out; };
  const usage = async root => {
    let pss = 0, swap = 0, n = 0;
    await Promise.all(tree(root).map(async pid => {
      const r = await readText(`/proc/${pid}/smaps_rollup`);
      if (!r) return; // gone, or not ours
      pss += kbField(r, 'Pss'); swap += kbField(r, 'SwapPss'); n++;
    }));
    return { pss, swap, procs: n };
  };

  const rows = await Promise.all(agents.map(async a => {
    const root = roots.get(a.pane);
    return { pane: a.pane, name: a.name, agent: a.agent, ...(root ? await usage(root) : { pss: null, swap: null, procs: 0 }) };
  }));
  rows.sort((x, y) => (y.pss ?? -1) - (x.pss ?? -1));
  const sum = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const memTotal = kbField(meminfo, 'MemTotal'), swapTotal = kbField(meminfo, 'SwapTotal');
  return {
    at: Date.now(),
    agents: rows, // kB
    total: { pss: sum('pss'), swap: sum('swap'), procs: sum('procs') },
    machine: {
      memTotal, memUsed: memTotal - kbField(meminfo, 'MemAvailable'),
      swapTotal, swapUsed: swapTotal - kbField(meminfo, 'SwapFree'),
    },
  };
}

async function memory() {
  if (memCache.data && Date.now() - memCache.at < MEM_TTL) return memCache.data;
  if (!memCache.pending) {
    memCache.pending = measureMemory()
      .then(data => { memCache = { at: Date.now(), data, pending: null }; return data; })
      .catch(e => { memCache.pending = null; throw e; });
  }
  return memCache.pending;
}

// ─── Links: one agent depends on another, or two agents can talk ─────────────
// Kept by terminal id (follows moves; a recycled pane id never inherits a link).
//   depends: `to` waits on `from`. When `from` finishes a job, ORCA offers a hand-off and
//            nothing reaches `to` until a person taps Send (approval gate).
//   talk:    either side may message the other with `free-orca-send` (bin/free-orca-send).
// Any link lets the two agents message each other; no link, no delivery. Messages queue
// until the receiver is idle, then arrive as a prompt. Text lives only in the state file
// (0600), never in the log. A link that passes LINK_HOURLY messages an hour is paused and
// a person is alerted: two agents must not keep each other busy in a loop.
state.links = state.links || [];       // { id, kind, from, to, at, by }
state.handoffs = state.handoffs || {}; // link id -> { end, ask, said }
state.msgs = state.msgs || [];         // { id, from, to, text, at, via, state, sentAt? }
const LINK_KINDS = ['depends', 'talk'];
const MSG_MAX = 4000, MSG_KEEP = 300, MSG_TTL = 7 * 864e5, QUEUE_TTL = 3600e3;
const LINK_HOURLY = CFG.LINK_HOURLY;
const newId = () => crypto.randomBytes(6).toString('base64url');
const pairOf = (a, b) => state.links.filter(l => (l.from === a && l.to === b) || (l.from === b && l.to === a));
const nameOf = a => a?.name || a?.pane || '?';
const chattyAlerted = new Map(); // pair key -> last alert

function pruneMsgs() {
  const now = Date.now();
  state.msgs = state.msgs.filter(m => now - m.at < MSG_TTL).slice(-MSG_KEEP);
}
function linkKey(a, b) { return [a, b].sort().join('|'); }

// A depends cycle (A waits on B waits on A) would deadlock the hand-offs.
function makesCycle(from, to) {
  const seen = new Set(), stack = [from];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const l of state.links) if (l.kind === 'depends' && l.to === cur) stack.push(l.from);
  }
  return false;
}

// Messages that need someone (rate cap reached) alert the holder of either agent.
function queueMsg({ from, to, text, via }, byTerminal) {
  pruneMsgs();
  if (via === 'agent') {
    const key = linkKey(from, to);
    const hour = state.msgs.filter(m => m.via === 'agent' && linkKey(m.from, m.to) === key && Date.now() - m.at < 3600e3).length;
    if (hour >= LINK_HOURLY) {
      if (Date.now() - (chattyAlerted.get(key) || 0) > 3600e3) {
        chattyAlerted.set(key, Date.now());
        const a = byTerminal?.get(from), b = byTerminal?.get(to);
        pushAll({ name: `${nameOf(a)} ↔ ${nameOf(b)}`, body: `${LINK_HOURLY}/h`, tag: 'chatty-' + key, url: '/#' + encodeURIComponent(a?.pane || ''), kind: 'chatty' }).catch(() => {});
      }
      log('msg.rate_limited', { key });
      throw new HttpError(429, 'rate_limited');
    }
  }
  const m = { id: newId(), from, to, text, at: Date.now(), via, state: 'queued' };
  state.msgs.push(m);
  saveState();
  log('msg.queued', { id: m.id, via, chars: text.length });
  return m;
}

function deliveryText(m, from, to) {
  const sender = nameOf(from);
  if (m.via === 'agent') return `[Free-ORCA] Message from agent ${sender}:\n${m.text}\n\n(Reply only if it helps the work: free-orca-send ${sender} "…" — your links: free-orca-send --list)`;
  return m.text; // hand-offs and intros are written in full when queued
}

// Runs after each poll: one message per idle receiver per tick, oldest first.
let delivering = false; // the poller and a hand-off approval must never send the same message twice
async function deliverQueued(agents) {
  if (delivering) return;
  delivering = true;
  try { await deliverQueuedNow(agents); } finally { delivering = false; }
}
async function deliverQueuedNow(agents) {
  const queued = state.msgs.filter(m => m.state === 'queued');
  if (!queued.length) return;
  const byTerminal = new Map(agents.map(a => [a.terminal, a]));
  const busy = new Set();
  let changed = false;
  for (const m of queued) {
    if (busy.has(m.to)) continue;
    const to = byTerminal.get(m.to);
    if (!to || (to.status !== 'idle' && to.status !== 'done')) {
      if (Date.now() - m.at > QUEUE_TTL) { m.state = 'failed'; changed = true; log('msg.expired', { id: m.id }); }
      continue;
    }
    busy.add(m.to);
    const text = deliveryText(m, byTerminal.get(m.from) || { pane: '?' }, to);
    try {
      await herdr(['agent', 'prompt', to.pane, text.startsWith('-') ? ' ' + text : text], 10000);
      m.state = 'sent'; m.sentAt = Date.now(); changed = true;
      sentAsk.set(to.terminal, { text: m.via === 'agent' ? `${nameOf(byTerminal.get(m.from))}: ${m.text}` : m.text, at: m.sentAt });
      log('msg.sent', { id: m.id, to: to.pane });
    } catch (e) {
      if (!['blocked', 'stalled', 'timeout'].includes(e.code)) { m.state = 'failed'; changed = true; }
      log('msg.deliver_failed', { id: m.id, code: e.code, detail: e.detail });
    }
  }
  if (changed) saveState();
}

// A job finished: every agent that depends on this one gets a hand-off offer (one per link,
// the newest job replaces an unsent older offer).
function offerHandoffs(a, job) {
  const down = state.links.filter(l => l.kind === 'depends' && l.from === a.terminal);
  if (!down.length) return;
  for (const l of down) state.handoffs[l.id] = { end: job.end, ask: job.ask, said: job.said };
  saveState();
  listAgents().then(list => {
    const byTerminal = new Map(list.map(x => [x.terminal, x]));
    for (const l of down) {
      const b = byTerminal.get(l.to);
      if (!b) continue;
      pushAll({ name: nameOf(a), body: '→ ' + nameOf(b), tag: 'handoff-' + l.id, url: '/#' + encodeURIComponent(b.pane), kind: 'handoff' }, holderLogin(b.terminal)).catch(() => {});
    }
  }).catch(() => {});
  log('handoff.offered', { from: a.pane, count: down.length });
}

function handoffText(up, down, h, note, who) {
  return [
    `[Free-ORCA] ${nameOf(up)} finished a job you depend on. ${who} approved handing it to you.`,
    h.ask ? `It was asked: ${h.ask}` : '',
    h.said ? `Its result: ${h.said}` : '',
    note ? `Note from ${who}: ${note}` : '',
    `Full output: free-orca-send --last ${nameOf(up)} · ask it something: free-orca-send ${nameOf(up)} "…"`,
    'Continue your work with this.',
  ].filter(Boolean).join('\n');
}

function introText(me, other, relation) {
  const rel = { upstream: `${nameOf(other)} depends on your work: when you finish a job, a person may hand your result to it.`, downstream: `You depend on ${nameOf(other)}: when it finishes a job, a person may hand its result to you.`, talk: `You and ${nameOf(other)} can message each other.` }[relation];
  return `[Free-ORCA] You are now linked with agent ${nameOf(other)}. ${rel}\nMessage it: free-orca-send ${nameOf(other)} "…" · its latest output: free-orca-send --last ${nameOf(other)} · your links: free-orca-send --list\nOnly message it when it helps the work — never just to acknowledge. No reply needed to this note.`;
}

// For the page: links between live agents (by pane), open hand-offs, message counts.
function linksView(agents) {
  const byTerminal = new Map(agents.map(a => [a.terminal, a]));
  const links = state.links.filter(l => byTerminal.has(l.from) && byTerminal.has(l.to))
    .map(l => ({ id: l.id, kind: l.kind, from: byTerminal.get(l.from).pane, to: byTerminal.get(l.to).pane }));
  const handoffs = Object.entries(state.handoffs).map(([id, h]) => {
    const l = state.links.find(x => x.id === id);
    if (!l || !byTerminal.has(l.from) || !byTerminal.has(l.to)) return null;
    return { id, from: byTerminal.get(l.from).pane, to: byTerminal.get(l.to).pane, end: h.end, said: h.said, ask: h.ask };
  }).filter(Boolean);
  const day = Date.now() - 864e5;
  const msgs = {}; // pane -> { n24, queued }
  for (const m of state.msgs) {
    for (const t of [m.from, m.to]) {
      const a = byTerminal.get(t);
      if (!a) continue;
      const c = msgs[a.pane] ||= { n: 0, queued: 0 };
      if (m.at >= day) c.n++;
      if (m.state === 'queued' && t === m.to) c.queued++;
    }
  }
  return { links, handoffs, msgs };
}

// Drop links and offers whose agents are gone for good (terminal not seen for a day).
const lastSeenTerminal = new Map();
setInterval(async () => {
  let agents; try { agents = await listAgents(); } catch { return; }
  const now = Date.now();
  for (const a of agents) lastSeenTerminal.set(a.terminal, now);
  const gone = t => now - (lastSeenTerminal.get(t) ?? now) > 864e5;
  for (const l of state.links) if (!lastSeenTerminal.has(l.from)) lastSeenTerminal.set(l.from, now);
  for (const l of state.links) if (!lastSeenTerminal.has(l.to)) lastSeenTerminal.set(l.to, now);
  const before = state.links.length;
  state.links = state.links.filter(l => !gone(l.from) && !gone(l.to));
  for (const id of Object.keys(state.handoffs)) if (!state.links.some(l => l.id === id)) delete state.handoffs[id];
  if (state.links.length !== before) { saveState(); log('links.pruned', { removed: before - state.links.length }); }
}, 10 * 60e3);

// ─── Agent socket: what `free-orca-send` talks to ─────────────────────────────────
// A unix socket in the state dir (0600, same user only), never on the network. The caller
// sends its pid; ORCA walks up its process tree to find which agent it runs inside, and
// only delivers along that agent's links. Same-user processes could already drive herdr
// directly — the socket's job is to keep agents on their links and leave a record.
const AGENT_SOCK = CFG.AGENT_SOCK;
async function agentOfPid(pid) {
  if (!Number.isInteger(pid) || pid < 2) return null;
  const [agents, { procs }, bySession] = await Promise.all([listAgents(), procTable(), sessionPids()]);
  const chain = new Set();
  for (let p = pid; p > 1 && procs.has(p) && chain.size < 64; p = procs.get(p).ppid) chain.add(p);
  if (!chain.size) return null;
  const hit = agents.find(a => a.session && chain.has(bySession.get(a.session)));
  if (hit) return { me: hit, agents };
  for (const a of agents) {
    try {
      const sp = (await herdrJson(['pane', 'process-info', '--pane', a.pane])).result?.process_info?.shell_pid;
      if (sp && chain.has(sp)) return { me: a, agents };
    } catch { /* pane closed mid-read */ }
  }
  return null;
}
function findAgent(agents, who) {
  const s = String(who || '').trim();
  if (PANE_RE.test(s)) return agents.find(a => a.pane === s) || null;
  const named = agents.filter(a => a.name === s);
  if (named.length > 1) throw new HttpError(409, 'ambiguous');
  return named[0] || null;
}
function linksOf(me, agents) {
  const byTerminal = new Map(agents.map(a => [a.terminal, a]));
  return state.links.filter(l => l.from === me.terminal || l.to === me.terminal).map(l => {
    const other = byTerminal.get(l.from === me.terminal ? l.to : l.from);
    const relation = l.kind === 'talk' ? 'talks with' : l.to === me.terminal ? 'you depend on it' : 'depends on you';
    return other ? { name: nameOf(other), pane: other.pane, status: other.status, relation } : null;
  }).filter(Boolean);
}

const agentServer = http.createServer(async (req, res) => {
  const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  try {
    const url = new URL(req.url, 'http://local');
    const body = req.method === 'POST' ? await readBody(req, 24 * 1024) : {};
    const pid = Number(body.pid ?? url.searchParams.get('pid'));
    const found = await agentOfPid(pid);
    if (!found) throw new HttpError(403, 'not_an_agent');
    const { me, agents } = found;

    if (req.method === 'GET' && url.pathname === '/links') return reply(200, { me: { name: nameOf(me), pane: me.pane }, links: linksOf(me, agents) });

    if (req.method === 'GET' && url.pathname === '/last') {
      const other = findAgent(agents, url.searchParams.get('of'));
      if (!other) throw new HttpError(404, 'no_such_agent');
      if (!pairOf(me.terminal, other.terminal).length) throw new HttpError(403, 'not_linked');
      const lines = Math.min(Math.max(Number(url.searchParams.get('lines')) || 80, 10), 300);
      let text;
      try { text = await herdr(['agent', 'read', other.pane, '--source', 'recent', '--lines', String(lines), '--format', 'text']); }
      catch { text = await herdr(['agent', 'read', other.pane, '--source', 'visible', '--format', 'text']); }
      log('msg.read_last', { by: me.pane, of: other.pane });
      return reply(200, { name: nameOf(other), status: other.status, text });
    }

    if (req.method === 'POST' && url.pathname === '/send') {
      const other = findAgent(agents, body.to);
      if (!other) throw new HttpError(404, 'no_such_agent');
      if (other.terminal === me.terminal) throw new HttpError(400, 'self');
      if (!pairOf(me.terminal, other.terminal).length) throw new HttpError(403, 'not_linked');
      const text = String(body.text || '').replace(/\r\n/g, '\n').trim();
      if (!text) throw new HttpError(400, 'empty');
      if (text.length > MSG_MAX) throw new HttpError(400, 'too_long');
      const m = queueMsg({ from: me.terminal, to: other.terminal, text, via: 'agent' }, new Map(agents.map(a => [a.terminal, a])));
      return reply(200, { ok: true, id: m.id, to: nameOf(other), status: other.status, queued: other.status !== 'idle' && other.status !== 'done' });
    }
    throw new HttpError(404, 'not_found');
  } catch (e) {
    if (!e.code) log('agent_sock.error', { detail: e.message });
    return reply(e.status || 500, { error: e.code || 'internal' });
  }
});
fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
fs.mkdirSync(path.dirname(AGENT_SOCK), { recursive: true, mode: 0o700 });
try { fs.unlinkSync(AGENT_SOCK); } catch { /* not there */ }
// Agent-to-agent messaging is optional: if the socket can't be opened the panel still runs.
agentServer.on('error', e => log('agent_sock.error', { path: AGENT_SOCK, detail: e.message }));
agentServer.listen(AGENT_SOCK, () => {
  try { fs.chmodSync(AGENT_SOCK, 0o600); log('agent_sock.listen', { path: AGENT_SOCK }); }
  catch (e) { log('agent_sock.error', { path: AGENT_SOCK, detail: e.message }); agentServer.close(); }
});

// ─── Shell confirmation ───────────────────────────────────────────────────────
// Opening or creating a shell needs an explicit confirmation in the page ("this is a real
// shell on this computer"). A confirmation lasts SHELL_UNLOCK_MS, then it is asked again.
// This is a speed bump against mis-taps, not authentication: the guard is the network.
let shellUnlockedUntil = 0;
const shellUnlockedFor = () => shellUnlockedUntil > Date.now();
const shellAccess = () => ({ confirmed: shellUnlockedFor(), unlockedUntil: shellUnlockedUntil, unlockMs: SHELL_UNLOCK_MS });
function requireShell() { if (!shellUnlockedFor()) throw new HttpError(423, 'shell_locked'); }

// What the page may show (single user: everything).
function accessView() {
  return { admin: true, folders: null, shell: shellAccess() };
}
// ─── Terminal: mirror a pane into xterm.js in the browser ─────────────────────
// herdr can't attach a browser PTY to a plain shell, so ORCA sends the screen as ANSI and
// relays keystrokes. Shells only; typing into agents stays the panel's job.
async function termScreen(pane) {
  const g = (await herdrJson(['pane', 'get', pane])).result?.pane;
  if (!g) throw new HttpError(404, 'gone');
  // The terminal view zooms the pane, so it fills the tab's whole area — use that for cols/rows
  // (the pane's own rect still reports the small split size while zoomed). Fall back to the rect.
  let cols, rows = g.scroll?.viewport_rows;
  try {
    const l = (await herdrJson(['pane', 'layout', '--pane', pane])).result?.layout;
    const mine = l?.panes?.find(p => p.pane_id === pane)?.rect;
    const zoomed = l?.zoomed || (rows && l?.area && rows >= l.area.height); // viewport grew to the full area
    cols = zoomed ? l?.area?.width : mine?.width;
    rows = (zoomed ? l?.area?.height : mine?.height) || rows;
  } catch { /* defaults below */ }
  let text = '';
  try { text = await herdr(['pane', 'read', pane, '--source', 'visible', '--format', 'ansi']); } catch { /* transient */ }
  return { text, rows: rows || 40, cols: cols || 80, agent: g.agent || null };
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(req, res, url) {
  const { pathname } = url;

  // ── Terminal (shells): screen out, keys in. Needs a fresh shell confirmation.
  {
    const tm = pathname.match(/^\/api\/term\/([^/]+?)(\/input|\/zoom)?$/);
    if (tm) {
      const pane = decodeURIComponent(tm[1]);
      if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
      requireShell();
      if (req.method === 'GET' && !tm[2]) return send(res, 200, await termScreen(pane));
      // Zoom the pane to the full window so the mirror is readable (narrow splits are ~40 cols);
      // un-zoom on close. Doesn't change the active tab.
      if (req.method === 'POST' && tm[2] === '/zoom') {
        if (!sameOrigin(req)) return send(res, 403, { error: 'cross-origin' });
        const body = await readBody(req);
        await herdr(['pane', 'zoom', pane, body.on ? '--on' : '--off']).catch(() => {});
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && tm[2] === '/input') {
        if (!sameOrigin(req)) return send(res, 403, { error: 'cross-origin' });
        const body = await readBody(req);
        if (typeof body.text === 'string' && body.text) {
          if (body.text.length > 8192) throw new HttpError(400, 'too_long');
          await herdr(['pane', 'send-text', pane, body.text]);
        } else if (typeof body.key === 'string') {
          for (const k of body.key.split(/\s+/).filter(Boolean).slice(0, 8)) await herdr(['pane', 'send-keys', pane, k]);
        } else throw new HttpError(400, 'bad_request');
        return send(res, 200, { ok: true });
      }
      throw new HttpError(405, 'method');
    }
  }

  // ── Shell confirmation: the page asks "open a real shell?" and posts { confirm: true }.
  if (pathname === '/api/shell/state') return send(res, 200, shellAccess());
  if (req.method === 'POST' && pathname === '/api/shell/unlock') {
    const body = await readBody(req);
    if (body.confirm !== true) throw new HttpError(400, 'confirm_needed');
    shellUnlockedUntil = Date.now() + SHELL_UNLOCK_MS;
    log('shell.confirmed', { minutes: Math.round(SHELL_UNLOCK_MS / 60e3) });
    return send(res, 200, { ok: true, ...shellAccess() });
  }
  if (req.method === 'POST' && pathname === '/api/shell/lock') {
    shellUnlockedUntil = 0;
    log('shell.locked');
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/agents') {
    const [agents, layout] = await Promise.all([listAgents(), workspaceLayout().catch(() => ({ tabs: [], workspaces: [] }))]);
    return send(res, 200, { agents, tabs: layout.tabs, workspaces: layout.workspaces, tagColors: state.tagColors, tagLib: tagLibrary(agents), me: person(loginOf(req)), people: PEOPLE_LOGINS().map(person), ...linksView(agents), access: accessView(), now: Date.now() });
  }

  // Messages to and from one agent (newest last), for its panel.
  if (req.method === 'GET' && /^\/api\/agents\/[^/]+\/messages$/.test(pathname)) {
    const pane = decodeURIComponent(pathname.split('/')[3]);
    if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
    const agents = await listAgents();
    const a = agents.find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'not_found');
    const byTerminal = new Map(agents.map(x => [x.terminal, x]));
    const list = state.msgs.filter(m => m.from === a.terminal || m.to === a.terminal).slice(-15).map(m => ({
      id: m.id, at: m.at, via: m.via, state: m.state, out: m.from === a.terminal,
      other: (() => { const o = byTerminal.get(m.from === a.terminal ? m.to : m.from); return o ? { pane: o.pane, name: o.name } : null; })(),
      text: m.via === 'agent' ? m.text.slice(0, 600) : m.text.split('\n')[0].slice(0, 200),
    }));
    return send(res, 200, { messages: list });
  }

  if (req.method === 'GET' && pathname === '/api/memory') return send(res, 200, await memory());

  if (req.method === 'GET' && pathname === '/api/names') {
    const agents = await listAgents();
    return send(res, 200, { crew: crew(new Set(agents.map(a => a.name).filter(Boolean))) });
  }

  if (req.method === 'GET' && pathname === '/api/meta') {
    const [tabsOut, wsOut] = await Promise.all([herdrJson(['tab', 'list']), herdrJson(['workspace', 'list'])]);
    const tabs = (tabsOut.result?.tabs || []).map(t => ({ id: t.tab_id, ws: t.workspace_id, number: t.number, label: t.label || null }));
    const workspaces = (wsOut.result?.workspaces || []).map(shapeWorkspace);
    return send(res, 200, { vapidKey: vapid.publicKey, tabs, workspaces, folders: FOLDERS, kinds: KINDS, keys: KEYS, access: accessView() });
  }

  if (req.method === 'GET' && /^\/api\/agents\/[^/]+\/reply$/.test(pathname)) {
    const pane = decodeURIComponent(pathname.split('/')[3]);
    if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'not_found');
    const h = handoff(a);
    // A session's own file is always current; a pane-named one may be a previous agent's.
    const fresh = at => h?.own || !a.since || (at || 0) >= a.since - 60000;
    if (a.status === 'blocked') {
      if (h?.ask?.questions?.length && fresh(h.ask.at)) return send(res, 200, { ask: h.ask });
      const menu = screenMenu(await visible(pane));
      return send(res, 200, { screen: menu });
    }
    if (a.status === 'idle' || a.status === 'done') {
      if (Array.isArray(h?.chips) && fresh(h.updatedAt)) return send(res, 200, { chips: h.chips.slice(0, 10), from: 'mod' });
      // No mod in that session (started before it, or not Claude): read its last reply.
      const key = `${a.seq}:${a.since}`;
      let c = screenChips.get(pane);
      if (c?.key !== key) {
        let text = '';
        try { text = await herdr(['agent', 'read', pane, '--source', 'recent', '--lines', '160', '--format', 'text']); } catch { /* full-screen agent */ }
        const reply = lastReply(text);
        c = { key, chips: reply ? chipsFor(reply) : [] };
        if (text.trim()) screenChips.set(pane, c); // a failed read is retried on the next look
      }
      return send(res, 200, c.chips.length ? { chips: c.chips, from: 'screen' } : {});
    }
    return send(res, 200, {});
  }

  if (req.method === 'GET' && /^\/api\/agents\/[^/]+\/jobs$/.test(pathname)) {
    const pane = decodeURIComponent(pathname.split('/')[3]);
    if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'not_found');
    const w = work.get(pane);
    return send(res, 200, { jobs: state.jobs[a.terminal] || [], running: w ? { start: w.from } : null, now: Date.now() });
  }

  if (req.method === 'GET') {
    const m = pathname.match(/^\/api\/agents\/([^/]+)\/read$/);
    if (!m) return send(res, 404, { error: 'not found' });
    const pane = decodeURIComponent(m[1]);
    if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
    const lines = Math.min(Math.max(Number(url.searchParams.get('lines')) || 40, 5), 200);
    // Full-screen agents (alternate screen) can't have their history read while they work or
    // wait on a question; show what is on their screen instead of an error.
    let text;
    try { text = await herdr(['agent', 'read', pane, '--source', 'recent', '--lines', String(lines), '--format', 'text']); }
    catch (err) {
      if (!/alternate-screen|not idle|while .* is (working|blocked)/i.test(err.detail || err.message || '')) throw err;
      text = await herdr(['agent', 'read', pane, '--source', 'visible', '--format', 'text']);
    }
    return send(res, 200, { text });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) { log('write.denied', { path: pathname }); return send(res, 403, { error: 'cross-origin' }); }
  const body = await readBody(req);

  // ── Crew: pin / unpin / hide a name
  if (pathname === '/api/names') {
    const name = String(body.name || '').trim();
    if (!AGENT_NAME_RE.test(name) || !['pin', 'unpin', 'hide'].includes(body.action)) throw new HttpError(400, 'bad_request');
    const N = state.names;
    N.pinned = N.pinned.filter(x => x !== name);
    if (body.action === 'pin') { N.pinned.push(name); N.hidden = N.hidden.filter(x => x !== name); }
    if (body.action === 'hide') { if (!N.hidden.includes(name)) N.hidden.push(name); }
    saveState();
    log('names.' + body.action, { name });
    const agents = await listAgents();
    return send(res, 200, { crew: crew(new Set(agents.map(x => x.name).filter(Boolean))) });
  }

  // ── Push
  if (pathname === '/api/push/subscribe') {
    const sub = body.subscription;
    if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError(400, 'bad_request');
    const lang = body.lang === 'es' ? 'es' : 'en';
    state.subs = state.subs.filter(s => s.endpoint !== sub.endpoint).concat([{ endpoint: sub.endpoint, keys: sub.keys, lang }]);
    saveState();
    log('push.subscribe', { devices: state.subs.length });
    return send(res, 200, { ok: true, devices: state.subs.length });
  }
  if (pathname === '/api/push/unsubscribe') {
    state.subs = state.subs.filter(s => s.endpoint !== body.endpoint);
    saveState();
    return send(res, 200, { ok: true, devices: state.subs.length });
  }
  if (pathname === '/api/push/test') {
    const sent = await pushAll({ tag: 'test', url: '/', kind: 'test' });
    return send(res, 200, { ok: true, sent });
  }

  // ── Tag library: forget a tag no agent uses (tags are created by putting them on an agent)
  if (pathname === '/api/tags') {
    const tag = String(body.tag || '').trim().toLowerCase();
    if (!TAG_RE.test(tag)) throw new HttpError(400, 'bad_tags');
    if (body.action === 'forget') {
      const agents = await listAgents();
      if (agents.some(a => (state.tags[a.terminal] || []).includes(tag))) throw new HttpError(409, 'tag_in_use');
      for (const [k, list] of Object.entries(state.tags)) { const rest = list.filter(x => x !== tag); if (rest.length) state.tags[k] = rest; else delete state.tags[k]; }
      delete state.tagColors[tag];
      delete state.tagUsed[tag];
      // A remembered name must not bring a forgotten tag back.
      for (const [name, list] of Object.entries(state.names.tags)) {
        const rest = list.filter(x => x !== tag);
        if (rest.length) state.names.tags[name] = rest; else delete state.names.tags[name];
      }
      saveState();
      log('tag.forget', { tag });
      return send(res, 200, { ok: true, tagLib: tagLibrary(agents) });
    }
    throw new HttpError(400, 'bad_request');
  }

  // ── Links between agents (panes in, terminals stored)
  if (pathname === '/api/links') {
    const kind = body.kind;
    if (!LINK_KINDS.includes(kind) || !PANE_RE.test(body.from || '') || !PANE_RE.test(body.to || '')) throw new HttpError(400, 'bad_request');
    const agents = await listAgents();
    const a = agents.find(x => x.pane === body.from), b = agents.find(x => x.pane === body.to);
    if (!a || !b) throw new HttpError(404, 'gone');
    if (a.terminal === b.terminal) throw new HttpError(400, 'link_self');
    const existing = pairOf(a.terminal, b.terminal);
    if (existing.some(l => l.kind === kind && (kind === 'talk' || l.from === a.terminal))) throw new HttpError(409, 'link_exists');
    if (kind === 'depends' && makesCycle(a.terminal, b.terminal)) throw new HttpError(409, 'link_cycle');
    const l = { id: newId(), kind, from: a.terminal, to: b.terminal, at: Date.now(), by: 'local' };
    state.links.push(l);
    saveState();
    log('link.add', { id: l.id, kind, from: a.pane, to: b.pane });
    // Tell both agents what they can now do (queued until each is idle). Skipped when the pair was already linked.
    if (body.intro !== false && !existing.length) {
      const byTerminal = new Map(agents.map(x => [x.terminal, x]));
      queueMsg({ from: b.terminal, to: a.terminal, text: introText(a, b, kind === 'talk' ? 'talk' : 'upstream'), via: 'intro' }, byTerminal);
      queueMsg({ from: a.terminal, to: b.terminal, text: introText(b, a, kind === 'talk' ? 'talk' : 'downstream'), via: 'intro' }, byTerminal);
    }
    return send(res, 200, { ok: true, id: l.id });
  }
  if (pathname === '/api/links/delete') {
    const before = state.links.length;
    state.links = state.links.filter(l => l.id !== body.id);
    if (state.links.length === before) throw new HttpError(404, 'gone');
    delete state.handoffs[body.id];
    // Undelivered agent messages along a removed link are dropped with it.
    for (const m of state.msgs) if (m.state === 'queued' && m.via === 'agent' && !pairOf(m.from, m.to).length) m.state = 'failed';
    saveState();
    log('link.delete', { id: body.id });
    return send(res, 200, { ok: true });
  }
  // ── Hand-off: a person approves (send) or drops (dismiss) the offer
  if (pathname === '/api/handoffs') {
    const h = state.handoffs[body.id];
    const l = state.links.find(x => x.id === body.id);
    if (!h || !l) throw new HttpError(404, 'gone');
    if (body.action === 'dismiss') {
      delete state.handoffs[body.id];
      saveState();
      log('handoff.dismiss', { id: body.id });
      return send(res, 200, { ok: true });
    }
    if (body.action !== 'send') throw new HttpError(400, 'bad_request');
    const note = String(body.note || '').trim().slice(0, 1000);
    const agents = await listAgents();
    const byTerminal = new Map(agents.map(x => [x.terminal, x]));
    const up = byTerminal.get(l.from), down = byTerminal.get(l.to);
    if (!down) throw new HttpError(404, 'gone');
    const who = person(loginOf(req)).name;
    const m = queueMsg({ from: l.from, to: l.to, text: handoffText(up || { pane: '?' }, down, h, note, who), via: 'handoff' }, byTerminal);
    delete state.handoffs[body.id];
    saveState();
    autoClaim(down.terminal, loginOf(req));
    log('handoff.send', { id: body.id, to: down.pane, note: !!note });
    deliverQueued(agents).catch(() => {});
    return send(res, 200, { ok: true, id: m.id, queued: down.status !== 'idle' && down.status !== 'done' });
  }

  // ── New agent or shell
  if (pathname === '/api/agents/new') {
    // A shell needs a fresh confirmation first.
    if (String(body.kind || '') === 'shell') requireShell();
    return send(res, 200, await newAgent(body));
  }

  // ── Per-agent actions
  const m = pathname.match(/^\/api\/agents\/([^/]+)\/(rename|focus|zoom|prompt|keys|tags|move|seen|answer|claim)$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const pane = decodeURIComponent(m[1]);
  const action = m[2];
  if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');

  if (action === 'move') return send(res, 200, await moveAgent(pane, body));

  // Show: bring it to the front. If its tab is zoomed, un-zoom it, so you see exactly where it sits.
  if (action === 'focus') {
    await herdr(['agent', 'focus', pane]);
    let unzoomed = false;
    try {
      const lay = await herdrJson(['pane', 'layout', '--pane', pane]);
      if (lay?.result?.layout?.zoomed) { await herdr(['pane', 'zoom', pane, '--off']); unzoomed = true; }
    } catch (err) { log('agent.unzoom_failed', { pane, detail: err.detail || err.message }); }
    log('agent.focus', { pane, unzoomed });
    return send(res, 200, { ok: true, unzoomed });
  }

  // Zoom: same as focus, then the pane fills its tab (set, not toggled: pressing twice keeps it zoomed).
  if (action === 'zoom') {
    await herdr(['agent', 'focus', pane]);
    await herdr(['pane', 'zoom', pane, '--on']);
    log('agent.zoom', { pane });
    return send(res, 200, { ok: true });
  }

  if (action === 'rename') {
    if (body.clear) {
      await herdr(['agent', 'rename', pane, '--clear']);
      log('agent.rename', { pane, name: null });
      return send(res, 200, { ok: true, name: null });
    }
    const name = String(body.name || '').trim();
    if (!AGENT_NAME_RE.test(name)) throw new HttpError(400, 'bad_agent_name');
    await herdr(['agent', 'rename', pane, name]);
    const a = (await listAgents()).find(x => x.pane === pane);
    applyName(a?.terminal, name);
    log('agent.rename', { pane, name });
    return send(res, 200, { ok: true, name });
  }

  // Claim / release / take over. Anyone can still act on any agent; this only says who is on it.
  if (action === 'claim') {
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'gone');
    const me = loginOf(req);
    const cur = state.claims[a.terminal];
    const mode = body.mode;
    if (mode === 'release') {
      if (cur && cur.login !== me && cur.login !== TEAM) throw new HttpError(409, 'claimed_by_other');
      delete state.claims[a.terminal];
    } else if (mode === 'assign') {
      // Hand it to someone else (or to yourself): anyone on the team can assign.
      const to = PEOPLE_LOGINS().find(l => person(l).id === body.to);
      if (!to) throw new HttpError(400, 'bad_request');
      state.claims[a.terminal] = { login: to, at: Date.now(), by: me };
      const by = person(me).name;
      const url = '/#' + encodeURIComponent(a.pane);
      if (to !== me && to !== TEAM) pushAll({ name: a.name || a.pane, body: by, tag: 'assign-' + a.pane, url, kind: 'assigned' }, to).catch(() => {});
      if (cur && cur.login !== me && cur.login !== to) pushAll({ name: a.name || a.pane, body: by, tag: 'take-' + a.pane, url, kind: 'taken' }, cur.login).catch(() => {});
    } else if (mode === 'claim' || mode === 'take') {
      if (cur && cur.login !== me && mode !== 'take') throw new HttpError(409, 'claimed_by_other');
      state.claims[a.terminal] = { login: me, at: Date.now() };
      if (cur && cur.login !== me) {
        const p = person(me);
        pushAll({ name: a.name || a.pane, body: p.name, tag: 'take-' + a.pane, url: '/#' + encodeURIComponent(a.pane), kind: 'taken' }, cur.login).catch(() => {});
      }
    } else throw new HttpError(400, 'bad_request');
    saveState();
    log('agent.claim', { pane, mode });
    return send(res, 200, { ok: true, claim: claimOf(a.terminal) });
  }

  // Opened in any view: its latest job is no longer fresh.
  if (action === 'seen') {
    const t = (await herdrJson(['pane', 'get', pane])).result?.pane?.terminal_id;
    const end = t && state.jobs[t]?.[0]?.end;
    if (end && (state.seen[t] || 0) < end) { state.seen[t] = end; saveState(); }
    return send(res, 200, { ok: true });
  }

  if (action === 'prompt') {
    const text = String(body.text || '').replace(/\r\n/g, '\n').trim();
    if (!text) throw new HttpError(400, 'empty');
    if (text.length > 4000) throw new HttpError(400, 'too_long');
    // herdr has no `--` separator: a leading space stops a message like "-x" being read as a flag.
    await herdr(['agent', 'prompt', pane, text.startsWith('-') ? ' ' + text : text], 10000);
    log('agent.prompt', { pane, chars: text.length }); // never log the text itself
    const at = Date.now();
    const who = loginOf(req);
    herdrJson(['pane', 'get', pane]).then(pg => { const t = pg.result?.pane?.terminal_id; if (t) { sentAsk.set(t, { text, at }); autoClaim(t, who); } }).catch(() => {});
    return send(res, 200, { ok: true });
  }

  // Answer the agent's question. Keys proven on a live Claude dialog:
  // single choice = its number (moves on by itself); multi-select = each number, then Tab;
  // free text = the "Type something" number, the text, Enter; several questions end on a
  // review screen where 1 submits. The question must still be on screen, or nothing is sent.
  if (action === 'answer') {
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'gone');
    if (a.status !== 'blocked') throw new HttpError(409, 'not_asking');
    const screen = await visible(pane);
    autoClaim(a.terminal, loginOf(req));
    if (Number.isInteger(body.screen)) {
      const menu = screenMenu(screen);
      if (!menu?.options.some(o => o.n === body.screen)) throw new HttpError(409, 'question_gone');
      await press(pane, String(body.screen));
      log('agent.answer', { pane, kind: 'screen', n: body.screen });
      return send(res, 200, { ok: true });
    }
    const qs = handoff(a)?.ask?.questions;
    const answers = Array.isArray(body.answers) ? body.answers : [];
    if (!qs?.length) throw new HttpError(409, 'question_gone');
    if (answers.length !== qs.length) throw new HttpError(400, 'bad_request');
    // Compare without box lines and line breaks: the dialog wraps and frames long questions.
    const norm = x => String(x).replace(/[│|]/g, ' ').replace(/\s+/g, ' ').trim();
    const onScreen = norm(screen);
    if (!qs.some(q => onScreen.includes(norm(q.question).slice(0, 40)))) throw new HttpError(409, 'question_gone');
    // Check every answer before pressing anything.
    answers.forEach((ans, i) => {
      const q = qs[i];
      if (typeof ans?.other === 'string') {
        if (q.multiSelect || !ans.other.trim() || ans.other.length > 500) throw new HttpError(400, 'bad_request');
      } else {
        const pick = Array.isArray(ans?.pick) ? ans.pick : [];
        if (!pick.length || pick.some(n => !Number.isInteger(n) || n < 1 || n > q.options.length)) throw new HttpError(400, 'bad_request');
        if (!q.multiSelect && pick.length !== 1) throw new HttpError(400, 'bad_request');
      }
    });
    for (const [i, ans] of answers.entries()) {
      const q = qs[i];
      if (typeof ans.other === 'string') {
        await press(pane, String(q.options.length + 1));
        await herdr(['pane', 'send-text', pane, ans.other.replace(/\s+/g, ' ').trim()]);
        await sleep(200);
        await press(pane, 'enter');
      } else if (q.multiSelect) {
        await press(pane, ...[...new Set(ans.pick)].map(String), 'tab');
      } else {
        await press(pane, String(ans.pick[0]));
      }
      await sleep(400);
    }
    if (qs.length > 1 || qs.some(q => q.multiSelect)) {
      await sleep(300);
      if (/Ready to submit your answers\?/.test(await visible(pane))) await press(pane, '1');
    }
    log('agent.answer', { pane, kind: 'ask', questions: qs.length }); // never log the answer text
    return send(res, 200, { ok: true });
  }

  if (action === 'keys') {
    const key = String(body.key || '');
    if (!KEYS.includes(key)) throw new HttpError(400, 'bad_request');
    await herdr(['agent', 'send-keys', pane, key]);
    log('agent.keys', { pane, key });
    return send(res, 200, { ok: true });
  }

  // tags
  const tags = [...new Set((Array.isArray(body.tags) ? body.tags : []).map(t => String(t).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 6 || !tags.every(t => TAG_RE.test(t))) throw new HttpError(400, 'bad_tags');
  const agents = await listAgents();
  const a = agents.find(x => x.pane === pane);
  if (!a) throw new HttpError(404, 'gone');
  if (tags.length) state.tags[a.terminal] = tags; else delete state.tags[a.terminal];
  if (a.name && AGENT_NAME_RE.test(a.name)) { if (tags.length) state.names.tags[a.name] = tags; else delete state.names.tags[a.name]; }
  // Each new tag takes the next colour slot, so colours stay distinct and never shift.
  for (const tg of tags) { if (!(tg in state.tagColors)) state.tagColors[tg] = nextTagSlot(); state.tagUsed[tg] = Date.now(); }
  const live = new Set(agents.map(x => x.terminal)); // drop tags of closed terminals
  for (const k of Object.keys(state.tags)) if (!live.has(k)) delete state.tags[k];
  saveState();
  log('agent.tags', { pane, tags });
  return send(res, 200, { ok: true, tags });
}

// ─── Static ───────────────────────────────────────────────────────────────────
// Static files: compressed once (brotli, else gzip) and kept in memory per file version;
// an ETag lets the browser revalidate with a cheap 304. Fonts and the vendored three.js
// change only with a deploy that renames them, so they may be cached for long.
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.webmanifest', '.txt']);
const staticCache = new Map(); // file -> { tag, raw, br, gz }
function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  // The cron helpers are shared with the browser (the Routines tab's schedule picker).
  const file = rel === 'cron.js' ? path.join(__dirname, 'lib', 'cron.js') : path.resolve(PUBLIC, rel);
  if (rel !== 'cron.js' && !file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'not found', 'text/plain');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'not found', 'text/plain');
    const tag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: tag, Vary: 'Accept-Encoding', ...SECURITY_HEADERS };
    if (rel.startsWith('fonts/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    else if (rel.startsWith('vendor/')) headers['Cache-Control'] = 'public, max-age=604800';
    else headers['Cache-Control'] = 'no-cache'; // always revalidate; unchanged files answer 304
    if (req.headers['if-none-match'] === tag) { res.writeHead(304, headers); return res.end(); }
    const reply = entry => {
      const accept = String(req.headers['accept-encoding'] || '');
      let body = entry.raw;
      if (COMPRESSIBLE.has(ext) && entry.raw.length > 1024) {
        if (/\bbr\b/.test(accept)) { entry.br ||= zlib.brotliCompressSync(entry.raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } }); body = entry.br; headers['Content-Encoding'] = 'br'; }
        else if (/\bgzip\b/.test(accept)) { entry.gz ||= zlib.gzipSync(entry.raw, { level: 9 }); body = entry.gz; headers['Content-Encoding'] = 'gzip'; }
      }
      headers['Content-Length'] = body.length;
      res.writeHead(200, headers);
      res.end(body);
    };
    const hit = staticCache.get(file);
    if (hit && hit.tag === tag) return reply(hit);
    fs.readFile(file, (err2, raw) => {
      if (err2) return send(res, 404, 'not found', 'text/plain');
      const entry = { tag, raw };
      staticCache.set(file, entry);
      reply(entry);
    });
  });
}

// ─── Routines ─────────────────────────────────────────────────────────────────
// Packs live in ROUTINES_DIR/<id>/routine.json; enabled/schedule choices and draft
// approvals in routines-state.json; every run is a JSON line in logs/routines.jsonl.
const RDIRS = { drafts: CFG.DRAFTS_DIR, reports: CFG.REPORTS_DIR };
let rstate = routinesLib.readState(CFG.ROUTINES_STATE);
const saveRstate = () => routinesLib.writeState(CFG.ROUTINES_STATE, rstate);
const RUNS_KEEP = 200;

// ─── Demo mode (`free-orca demo`) ─────────────────────────────────────────────
// Two fictional businesses played by demo/demo-herdr. Each client has its own routines,
// drafts and run log under CONFIG_DIR/clients/<id>/; switching client swaps them.
const DEMO = process.env.FREE_ORCA_DEMO === '1' && !!process.env.FREE_ORCA_DEMO_DIR;
const demoTl = DEMO ? require('./demo/timeline') : null;
const DEMO_CLIENTS = DEMO ? require('./demo/clients').CLIENTS.map(c => ({ id: c.id, name: c.name, short: c.short })) : [];
function useDemoClient(id) {
  const base = path.join(STATE_DIR, 'clients', id);
  Object.assign(CFG, {
    ROUTINES_DIR: path.join(base, 'routines'), ROUTINES_STATE: path.join(base, 'routines-state.json'),
    DRAFTS_DIR: path.join(base, 'drafts'), REPORTS_DIR: path.join(base, 'reports'), LOGS_DIR: path.join(base, 'logs'),
  });
  RDIRS.drafts = CFG.DRAFTS_DIR; RDIRS.reports = CFG.REPORTS_DIR;
  rstate = routinesLib.readState(CFG.ROUTINES_STATE);
  layoutCache.at = 0;
}
if (DEMO) useDemoClient(demoTl.loadState(process.env.FREE_ORCA_DEMO_DIR).client);

async function demoApi(req, res, pathname) {
  if (!DEMO) return send(res, 200, { demo: false });
  const dir = process.env.FREE_ORCA_DEMO_DIR;
  if (req.method === 'GET' && pathname === '/api/demo') {
    const st = demoTl.loadState(dir);
    return send(res, 200, { demo: true, clients: DEMO_CLIENTS, active: st.client, speed: st.speed });
  }
  if (req.method === 'POST' && pathname === '/api/demo/client') {
    const body = await readBody(req);
    if (!DEMO_CLIENTS.some(c => c.id === body.client)) throw new HttpError(400, 'bad_request');
    const st = demoTl.loadState(dir);
    st.client = body.client;
    demoTl.saveState(dir, st);
    useDemoClient(body.client);
    log('demo.client', { client: body.client });
    return send(res, 200, { ok: true, active: body.client });
  }
  throw new HttpError(404, 'not_found');
}

function loadRoutines() {
  const { routines, invalid } = routinesLib.loadAll(CFG.ROUTINES_DIR);
  return { routines: routines.map(r => routinesLib.effective(r, rstate)), invalid };
}

function runLog(entry) {
  try { routinesLib.appendLog(CFG.LOGS_DIR, entry); } catch (e) { log('routine.log_error', { detail: e.message }); }
}

// A run whose output file has appeared moves to "ready" (once), and that is logged.
function refreshRuns() {
  let changed = false;
  for (const [run, r] of Object.entries(rstate.runs)) {
    if (r.state === 'started' && fs.existsSync(r.out)) {
      r.state = r.approval === 'draft' ? 'ready' : 'done';
      r.readyAt = Date.now();
      changed = true;
      runLog({ run, routine: r.id, state: r.approval === 'draft' ? 'draft_ready' : 'report_ready', output: r.out });
    }
  }
  const ids = Object.keys(rstate.runs);
  if (ids.length > RUNS_KEEP) { for (const id of ids.sort().slice(0, ids.length - RUNS_KEEP)) delete rstate.runs[id]; changed = true; }
  if (changed) saveRstate();
}

async function uniqueAgentName(base) {
  const taken = new Set((await listAgents().catch(() => [])).map(a => a.name).filter(Boolean));
  const stem = base.slice(0, 26);
  if (!taken.has(stem)) return stem;
  for (let i = 2; i < 100; i++) if (!taken.has(`${stem}-${i}`)) return `${stem}-${i}`;
  return `${stem}-${crypto.randomBytes(2).toString('hex')}`;
}

// Start an agent pane for the routine and hand it the prompt. The prompt is queued and
// delivered when the agent is idle, so a first-run question (e.g. "trust this folder?")
// waits for you in the panel instead of swallowing the prompt.
async function fireRoutine(r, trigger) {
  const run = routinesLib.newRunId();
  const out = routinesLib.outputPath(RDIRS, r, run);
  const prompt = routinesLib.buildPrompt(r, out);
  fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
  rstate.runs[run] = { id: r.id, out, approval: r.approval, state: 'started', at: Date.now(), trigger };
  saveRstate();
  runLog({ run, routine: r.id, trigger, state: 'started', input: { agent: r.agent, cwd: r.cwd, schedule: r.schedule, approval: r.approval, prompt }, output: out });
  try {
    const name = await uniqueAgentName(r.id);
    const started = await newAgent({ name, kind: r.agent, folder: r.cwd });
    const pg = await herdrJson(['pane', 'get', started.pane]);
    const terminal = pg.result?.pane?.terminal_id;
    if (!terminal) throw new HttpError(502, 'start_failed', 'no terminal id');
    queueMsg({ from: terminal, to: terminal, text: prompt, via: 'routine' });
    rstate.runs[run].pane = started.pane;
    saveRstate();
    runLog({ run, routine: r.id, state: 'prompt_queued', pane: started.pane, blocked: !!started.blocked });
    listAgents().then(deliverQueued).catch(() => {});
    return { run, pane: started.pane, output: out };
  } catch (e) {
    rstate.runs[run].state = 'failed';
    saveRstate();
    runLog({ run, routine: r.id, state: 'failed', error: e.code || 'internal', detail: String(e.detail || e.message || '').slice(0, 300) });
    throw e;
  }
}

const scheduler = new Scheduler({
  list: () => loadRoutines().routines,
  fire: fireRoutine,
  tickMs: CFG.ROUTINE_TICK_MS,
  log,
});

function runsView() {
  refreshRuns();
  return Object.entries(rstate.runs).sort((a, b) => b[1].at - a[1].at).slice(0, 50)
    .map(([run, r]) => ({ run, id: r.id, approval: r.approval, state: r.state, at: r.at, trigger: r.trigger, pane: r.pane || null, output: shortHome(r.out), decidedAt: r.decidedAt || null }));
}

async function routinesApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/routines') {
    const { routines, invalid } = loadRoutines();
    const list = routines.map(r => {
      const at = scheduler.nextFor(r);
      return { id: r.id, name: r.name, problem: r.problem, schedule: r.schedule, packSchedule: r.packSchedule, approval: r.approval, agent: r.agent, cwd: r.cwd, enabled: r.enabled, prompt: r.prompt, nextAt: at ? at.getTime() : null };
    });
    return send(res, 200, { routines: list, invalid, runs: runsView(), dir: shortHome(CFG.ROUTINES_DIR), now: Date.now() });
  }
  const dm = pathname.match(/^\/api\/routines\/runs\/([^/]+)(\/decide)?$/);
  if (dm) {
    const run = decodeURIComponent(dm[1]);
    if (!routinesLib.RUN_RE.test(run) || !rstate.runs[run]) throw new HttpError(404, 'not_found');
    refreshRuns();
    const r = rstate.runs[run];
    if (req.method === 'GET' && !dm[2]) {
      let text = '';
      try { text = fs.readFileSync(r.out, 'utf8').slice(0, 200 * 1024); } catch { /* not written yet */ }
      return send(res, 200, { run, id: r.id, state: r.state, approval: r.approval, output: shortHome(r.out), text });
    }
    if (req.method === 'POST' && dm[2]) {
      const body = await readBody(req);
      if (!['approve', 'reject'].includes(body.action)) throw new HttpError(400, 'bad_request');
      if (r.approval !== 'draft' || r.state !== 'ready') throw new HttpError(409, 'not_ready');
      r.state = body.action === 'approve' ? 'approved' : 'rejected';
      r.decidedAt = Date.now();
      saveRstate();
      runLog({ run, routine: r.id, state: r.state, output: r.out });
      return send(res, 200, { ok: true, state: r.state });
    }
    throw new HttpError(405, 'method');
  }
  const m = pathname.match(/^\/api\/routines\/([^/]+)\/(enable|schedule|run)$/);
  if (!m || req.method !== 'POST') throw new HttpError(404, 'not_found');
  const id = decodeURIComponent(m[1]);
  if (!routinesLib.ID_RE.test(id)) throw new HttpError(400, 'bad_request');
  const r = loadRoutines().routines.find(x => x.id === id);
  if (!r) throw new HttpError(404, 'not_found');
  const body = await readBody(req);
  const cur = rstate.routines[id] ||= {};
  if (m[2] === 'enable') {
    cur.enabled = body.enabled === true;
    saveRstate();
    log('routine.enable', { id, enabled: cur.enabled });
    runLog({ routine: id, state: cur.enabled ? 'enabled' : 'disabled' });
    return send(res, 200, { ok: true, enabled: cur.enabled });
  }
  if (m[2] === 'schedule') {
    const sched = String(body.schedule || '').trim();
    if (sched && !cronLib.isValid(sched)) throw new HttpError(400, 'bad_schedule');
    if (sched && sched !== r.packSchedule) cur.schedule = sched; else delete cur.schedule;
    saveRstate();
    log('routine.schedule', { id, schedule: cur.schedule || r.packSchedule });
    runLog({ routine: id, state: 'schedule_changed', schedule: cur.schedule || r.packSchedule });
    return send(res, 200, { ok: true, schedule: cur.schedule || r.packSchedule });
  }
  // run now
  return send(res, 200, { ok: true, ...(await fireRoutine(r, 'manual')) });
}

// ─── Server ───────────────────────────────────────────────────────────────────
// Every request: the Host must be a name we answer to (DNS rebinding). Every request that
// changes something: a same-origin Origin (CSRF). Static GETs only need the Host check.
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (!guard.hostAllowed(req.headers.host, ALLOWED_HOSTS)) {
    log('http.bad_host', { host: String(req.headers.host || '').slice(0, 100) });
    return send(res, 421, 'unknown host', 'text/plain');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    log('write.denied', { path: url.pathname });
    return send(res, 403, { error: 'cross-origin' });
  }
  if (url.pathname === '/healthz') return send(res, 200, { ok: true });
  if (url.pathname.startsWith('/api/')) {
    try {
      if (url.pathname.startsWith('/api/routines')) return await routinesApi(req, res, url.pathname);
      if (url.pathname === '/api/demo' || url.pathname.startsWith('/api/demo/')) return await demoApi(req, res, url.pathname);
      return await api(req, res, url);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 409 || !e.code) log('api.error', { path: url.pathname, code: e.code, detail: e.detail || e.message });
      return send(res, status, { error: e.code || 'internal' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed', 'text/plain');
  serveStatic(req, res, url.pathname);
});

if (!guard.isLoopbackBind(HOST)) {
  const bar = '!'.repeat(78);
  for (const line of [bar,
    `WARNING: Free-ORCA is listening on ${HOST}, not 127.0.0.1.`,
    'There is NO login. Anyone who can reach this address and port can type into your agents',
    'and open shells on this computer as you. Only do this on a network you fully trust,',
    'and prefer `tailscale serve` or `ssh -L` to a localhost bind instead.',
    bar]) process.stderr.write(line + '\n');
  log('listen.exposed', { host: HOST });
}

server.listen(PORT, HOST, () => {
  log('listen', { host: HOST, port: PORT, demo: DEMO || undefined, herdr: HERDR, allowedHosts: [...ALLOWED_HOSTS.names, ...ALLOWED_HOSTS.pinned], pushDevices: state.subs.length });
  scheduler.start();
});
