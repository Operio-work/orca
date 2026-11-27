#!/usr/bin/env node
'use strict';

// ORCA by Operio — a self-hosted control panel for the AI agents running in herdr
// panes: see, name, tag, reply to and start agents, run scheduled routines, and get phone
// alerts when an agent finishes or needs you. Runs on herdr (Apache-2.0, herdr.dev); the
// server shells out to the `herdr` CLI (execFile, no shell). One dependency (web-push).
//
// Security: this TYPES INTO live agents and shells. It binds to 127.0.0.1 by default,
// answers only to known Host names (blocks DNS rebinding), requires a same-origin Origin on
// every state-changing request (blocks CSRF) and asks for confirmation before any shell.
// There is no login: anyone who can reach the port can drive your agents.

const http = require('http');
const PANEL_VERSION = require('./package.json').version;
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');
const { execFile } = require('child_process');
const webpush = require('web-push');
const guard = require('./lib/guard');
const routinesLib = require('./lib/routines');
const { Scheduler } = require('./lib/scheduler');
const cronLib = require('./lib/cron');
const { createJournal, redact } = require('./lib/journal');
const { createChat, findMentions, buildPrompt, cutReply, a2aPosts } = require('./lib/chat');
const { createTranslator, detectLang } = require('./lib/translate');
const { talkView } = require('./lib/talk');
const { createTemplates, TemplateError } = require('./lib/templates');
const { createSkills, SkillError } = require('./lib/skills');
const { createKb, KbError, installKnowledgeSkill } = require('./lib/kb');
const { createKbAccess, scopeOf: kbScopeOf } = require('./lib/kb-access');
const transcript = require('./lib/transcript');
const { createProfiles, ProfileError, reportsError, BUILTIN: PROFILE_TOOLS } = require('./lib/profiles');
const { readStarters, viewStarters, starterProfile } = require('./lib/starters');
const packsLib = require('./lib/packs');
const { createAccounts, AccountError } = require('./lib/accounts');
const { createTools, ToolError } = require('./lib/tools');
const { createBrowser } = require('./lib/browser');
const { createOllama } = require('./lib/ollama');
const opencodeTranscript = require('./lib/opencode-transcript');
const llm = require('./lib/llm');
const identity = require('./lib/identity');
const sleepState = require('./lib/sleep');

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
const LLM_FILE   = CFG.LLM_FILE; // the agents' API keys (lib/llm.js); values never leave the server
const CLI        = path.join(__dirname, 'bin', 'operio-orca');
const POLL_MS    = CFG.POLL_MS;
const MIN_WORK_MS = CFG.MIN_WORK_MS; // shorter turns don't alert
const FOLDERS = CFG.FOLDERS;
const KINDS = ['claude', 'codex', 'gemini', 'opencode', 'ollama', 'hermes', 'agy', 'shell'];
const KEYS  = ['enter', 'esc', 'ctrl+c', 'up', 'down', 'tab', '1', '2', '3'];
// Models an agent can be switched to from its card. Claude takes "/model <alias>" as a plain
// message and switches on the spot; the other kinds only have an on-screen picker, so none here.
// Local models (ollama kind) are whatever tool-capable models Ollama has right now (lib/ollama.js).
const MODELS = { claude: ['fable', 'opus', 'sonnet', 'haiku'], get ollama() { return ollama.models(); } };
const OLLAMA_OPENCODE = path.join(STATE_DIR, 'opencode-ollama.json');
const OPENCODE_DB = process.env.OPERIO_ORCA_OPENCODE_DB || path.join(process.env.XDG_DATA_HOME || path.join(HOME, '.local', 'share'), 'opencode', 'opencode.db');
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

// herdr commands that only read. Anything else may change the agent list, so it drops the
// short listAgents cache below.
const HERDR_READS = new Set(['list', 'read', 'process-info', 'layout', 'get']);
// listAgents' shared result; gen goes up on every change so a read in flight is not kept.
const agentsList = { at: 0, list: null, flight: null, flightGen: -1, gen: 0 };
// Commands that leave the tabs' split layout as it is (typing, prompts, focus).
const HERDR_SAME_LAYOUT = new Set(['send-keys', 'send-text', 'prompt', 'focus']);
let layoutGen = 0;
function herdr(args, timeout = 5000) {
  if (!HERDR_READS.has(args[1])) {
    agentsList.at = 0; agentsList.gen++;
    if (!HERDR_SAME_LAYOUT.has(args[1])) layoutGen++;
  }
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

// ─── People ───────────────────────────────────────────────────────────────────
// ORCA has no login system. Everyone who reaches the page is "you"; the shared
// "Team" claim is kept so an agent can be marked as company-wide work.
// A hosted panel (ORCA Host) is the exception: ORCA Host signs who each request is from
// (lib/identity.js) with a secret only it and this panel hold, and the panel trusts that
// person: "h:<id>", with a name and a role. Nothing else can make the panel trust a person.
const ID_SECRET = CFG.HOSTED ? CFG.IDENTITY_SECRET : '';
// Secrets stay in this process: never passed on to herdr, the CLI or the agents it starts.
delete process.env.OPERIO_ORCA_IDENTITY_SECRET;
delete process.env.OPERIO_ORCA_TRANSLATE_KEY;
function loginOf(req) {
  if (!ID_SECRET || !req?.headers) return 'local';
  const p = identity.verify(ID_SECRET, req.headers[identity.HEADER]);
  if (!p) return 'local';
  const login = 'h:' + p.id;
  rememberPerson(login, p);
  return login;
}
// People seen through ORCA Host, kept so names survive a restart: login -> { name, role, operio, chat, at }.
function rememberPerson(login, p) {
  state.people = state.people || {};
  const cur = state.people[login];
  const now = Date.now();
  if (cur && cur.name === p.name && cur.role === p.role && cur.chat === p.chat && now - cur.at < 3600e3) return;
  state.people[login] = { name: p.name, role: p.role, operio: p.operio, chat: p.chat, at: now };
  saveState();
}
const hostPerson = login => (login.startsWith('h:') ? state.people?.[login] || null : null);
// Viewers (client_viewer) read and comment; everyone else can act on agents.
const canAct = login => hostPerson(login)?.role !== 'client_viewer';
// Agent logins (accounts) and MCP tools hold credentials: on a hosted panel only Operio sets them up.
const canManageLogins = login => !CFG.HOSTED || !!hostPerson(login)?.operio;
// Saved agents and workers: free = you; hosted = the client's admins and Operio.
const canSetupAgents = login => !CFG.HOSTED || !!hostPerson(login)?.operio || hostPerson(login)?.role === 'client_admin';
// Operio staff read a client's team chat only when the client lets them (ORCA Host sends it).
const chatAllowed = login => { const p = hostPerson(login); return !p || !p.operio || !!p.chat; };
const TEAM = 'team:all';
const TEAM_NAME = process.env.OPERIO_ORCA_TEAM || 'Team';
const YOU_NAME = process.env.OPERIO_ORCA_NAME || 'You';
// Other people by login, for the team chat: the demo's fictional teammates (ORCA Host only).
const others = new Map(); // login -> name
function person(login) {
  if (login === TEAM) return { id: 'team', name: TEAM_NAME, initial: TEAM_NAME[0].toUpperCase(), slot: 0, team: true };
  const hp = hostPerson(login);
  if (hp) {
    const name = hp.operio ? `Operio — ${hp.name}` : hp.name;
    return { id: login.replace(/[^a-z0-9]+/gi, '-'), name, initial: hp.name[0].toUpperCase(), slot: Object.keys(state.people).indexOf(login) + 1, viewer: hp.role === 'client_viewer' };
  }
  const name = others.get(login);
  if (name) return { id: login.replace(/[^a-z0-9]+/gi, '-'), name, initial: name[0].toUpperCase(), slot: [...others.keys()].indexOf(login) + 1 };
  return { id: 'local', name: YOU_NAME, initial: YOU_NAME[0].toUpperCase(), slot: 0 };
}

// Writes must come from this app's own origin (blocks cross-site form/fetch posts).
const sameOrigin = req => guard.sameOrigin(req, ALLOWED_HOSTS);

// ─── Journal: what you and your agents did, kept JOURNAL_DAYS (90) for review ─────
// Append-only daily files under <config>/journal, owner-only, with secrets redacted before
// they are written (lib/journal.js). Nothing leaves this computer.
const journal = createJournal({ dir: CFG.JOURNAL_DIR, log, keepDays: CFG.JOURNAL_DAYS });

// ─── Team chat (ORCA Host only): one thread per agent (by terminal) + one team room ─────
// lib/chat.js. Off (null) unless OPERIO_ORCA_HOSTED=1: the free panel has no chat UI or API.
// Prompt templates. Free panel: your own only. ORCA Host: also Company (admins edit) and Operio's
// library, which ORCA Host writes to operio-templates.json in the config folder (read-only here).
const templates = createTemplates({ dir: CFG.CONFIG_DIR, operioFile: path.join(CFG.CONFIG_DIR, 'operio-templates.json'), company: CFG.HOSTED, operio: CFG.HOSTED, log });
// Saved agents (profiles.js): instructions + skills + tools, started again and resumed. Admins edit;
// whoever may start an agent in the profile's folder may start it. One live copy per profile.
const profiles = createProfiles({ configDir: STATE_DIR, kinds: KINDS, models: MODELS, log });
// Several logins per agent kind (accounts.js): an account = its own config folder for that CLI.
const accounts = createAccounts({ configDir: STATE_DIR, home: HOME, log });
// MCP servers for saved agents (tools.js): catalogue + write-only secrets, admins only.
const tools = createTools({ configDir: STATE_DIR, log });
const browser = createBrowser({ configDir: STATE_DIR, appDir: __dirname });
// operio-orca browser on|off|test, run for the panel (admins). Output is plain text for the page.
function browserCli(args, timeout) {
  return new Promise(resolve => {
    execFile(process.execPath, [path.join(__dirname, 'lib', 'browser-cli.js'), args[0], STATE_DIR, __dirname, ...args.slice(1)],
      { timeout, maxBuffer: 1024 * 1024, env: { ...process.env, OPERIO_ORCA_BROWSER_PANEL: '1' } },
      (err, stdout, stderr) => resolve({ ok: !err, output: (String(stdout || '') + String(stderr || '')).replace(/\x1b\[[0-9;]*m/g, '').slice(-20000) }));
  });
}
const toolErr = e => { if (e instanceof ToolError) throw new HttpError(e.status, e.code, e.detail); throw e; };
const accountErr = e => { if (e instanceof AccountError) throw new HttpError(e.status, e.code); throw e; };
// Local models through Ollama on this computer (ollama.js), refreshed every 5 minutes.
const ollama = createOllama({ url: process.env.HERDR_WEB_OLLAMA_URL || 'http://127.0.0.1:11434', ctx: Number(process.env.HERDR_WEB_OLLAMA_CTX || 20480), configFile: OLLAMA_OPENCODE, log });
ollama.refresh();
setInterval(() => ollama.refresh(), 300e3).unref();
const profileErr = e => { if (e instanceof ProfileError) throw new HttpError(e.status, e.code, e.detail); throw e; };
const tplErr = e => { if (e instanceof TemplateError) throw new HttpError(e.status, e.code); throw e; };
// Skills (SKILL.md folders your agents read when a task matches; lib/skills.js). Free panel: the
// bundled open skills in <app>/skills, installed and removed from the Skills dialog. ORCA Host:
// Operio's gallery for this client (operio-skills.json); a client admin requests one and ORCA Host
// installs it through `operio-orca skills install` — the hosted panel never installs by itself.
const skills = createSkills({ home: CFG.HOME, configDir: CFG.CONFIG_DIR, bundledDir: path.join(__dirname, 'skills'), log });
// Starter agents (Operio /for roles), bundled with the app.
const STARTERS = readStarters(path.join(__dirname, 'starters'), log);
// Industry packs: put on this panel by ORCA Host (operio-orca packs add); read fresh on each list.
const PACKS_DIR = path.join(CFG.CONFIG_DIR, 'packs');
const readPacksNow = () => packsLib.readPacks(PACKS_DIR, STARTERS, log);
const skillErr = e => { if (e instanceof SkillError) throw new HttpError(e.status, e.code, e.detail); throw e; };
// Who may ask Operio for a skill on a hosted panel: the client's admins and Operio staff.
// (ORCA Host checks again before it records the request.)
const canRequestSkill = login => { const p = hostPerson(login); return !p || p.operio || p.role === 'client_admin'; };
// Knowledge for agents (lib/kb.js): documents in <config>/knowledge, searched by
// `operio-orca kb search`. Hosted panels with an embedding key (llm.env) also search by meaning.
// The first document installs the business-knowledge skill, so agents know the search exists.
// Who may add or remove documents: free = you; hosted = the client's admins and Operio staff.
const kb = createKb({ configDir: CFG.CONFIG_DIR, hosted: CFG.HOSTED, llmFile: CFG.LLM_FILE, log, onIndexed: () => installKnowledgeSkill(skills, log) });
const kbErr = e => { if (e instanceof KbError) throw new HttpError(e.status, e.code, e.detail); throw e; };
const canWriteKb = canRequestSkill;
// Per-agent access (lib/kb-access.js, <config>/kb-access.json): a collection is open to all
// agents unless an admin names the agents or tags that may search it. Agents ask over the
// agent socket (GET /kb-scope) when they run `kb search`. Scoping, not a security wall.
const kbAccess = createKbAccess({ configDir: CFG.CONFIG_DIR, log });
const kbScope = a => kbScopeOf(kbAccess.load(), { name: a.name, tags: state.tags[a.terminal] || [] }, kb.list().map(f => f.collection).filter(Boolean));
const KB_UPLOAD_MAX = Math.ceil(5 * 1024 * 1024 * 4 / 3) + 4096; // a 5 MB file as base64, plus the JSON around it
let chat = CFG.HOSTED ? createChat({ dir: CFG.CHAT_DIR, redact, log, keepDays: CFG.JOURNAL_DAYS }) : null;
// Chat translation EN ⇄ ES with a small model (lib/translate.js): anthropic | ollama | off.
// The model runs on the client's own Anthropic key: the one their Claude agents use (llm.env,
// set in ORCA Host → Model access), looked up on each use so a new or removed key counts at once.
const translateKey = (() => {
  let at = -1, key = '';
  return () => {
    if (CFG.TRANSLATE_KEY) return CFG.TRANSLATE_KEY;
    let m = 0;
    try { m = fs.statSync(LLM_FILE).mtimeMs; } catch { /* no llm.env */ }
    if (m !== at) { at = m; key = m ? llm.get(LLM_FILE, 'ANTHROPIC_API_KEY') : ''; }
    return key;
  };
})();
const translator = createTranslator({
  provider: chat ? CFG.TRANSLATE : 'off', model: CFG.TRANSLATE_MODEL, url: CFG.TRANSLATE_URL, dir: CFG.CHAT_DIR, log,
  apiKey: translateKey,
});
if (chat) {
  const prune = () => { try { chat.prune(); } catch (e) { log('chat.prune_failed', { error: String(e.message) }); } };
  prune();
  setInterval(prune, 6 * 3600e3).unref();
}
const agentCache = new Map(); // pane -> last shaped agent (refreshed by every listAgents)
function jAgent(x) {
  const a = typeof x === 'string' ? agentCache.get(x) || { pane: x } : x || {};
  const born = a.terminal && state.born?.[a.terminal];
  return { name: a.name || null, pane: a.pane || null, terminal: a.terminal || null, kind: born?.kind || a.kind || a.agent || null, cwd: a.cwd || null };
}
// who: a request or a login, or null for ORCA itself.
function jr(who, event, agent, detail = {}) {
  return journal.write(event, { who: who ? (typeof who === 'string' ? who : loginOf(who)) : null, agent: agent ? jAgent(agent) : undefined, ...detail });
}
// Errors are grouped: one entry per code+route per 10 minutes, with how many it stands for.
const errAgg = new Map(); // key -> { n, at }
function jError(pathname, code) {
  const route = pathname.replace(/\/api\/(agents|term)\/[^/]+/, '/api/$1/:pane');
  const key = code + ' ' + route;
  const g = errAgg.get(key) || { n: 0, at: 0 };
  g.n++;
  if (Date.now() - g.at >= 10 * 60e3) { journal.write('error', { who: null, code, path: route, n: g.n }); g.n = 0; g.at = Date.now(); }
  errAgg.set(key, g);
}

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
state.opencodeSessions = state.opencodeSessions || {};
state.sleeping = state.sleeping || {};

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
  en: { blocked: n => `${n} needs you`, done: n => `${n} finished`, taken: n => `${n} was taken over`, assigned: n => `${n} is yours now`, handoff: n => `${n} finished — hand off?`, chatty: n => `${n}: link paused`, mention: n => `${n} mentioned you`, reply: n => `${n} wrote`, agentReply: n => `${n} answered you`, room: 'Team', test: () => 'ORCA alerts are on', testBody: 'You’ll hear when an agent finishes or needs you.' },
  es: { blocked: n => `${n} te necesita`, done: n => `${n} terminó`, taken: n => `${n} fue tomado`, assigned: n => `${n} ahora es tuyo`, handoff: n => `${n} terminó — ¿pasar el relevo?`, chatty: n => `${n}: enlace en pausa`, mention: n => `${n} te mencionó`, reply: n => `${n} escribió`, agentReply: n => `${n} te respondió`, room: 'Equipo', test: () => 'Alertas de ORCA activas', testBody: 'Te avisaremos cuando un agente termine o te necesite.' },
};
// Language packs (public/i18n/<lang>.js, written for the browser) also carry the alert copy:
// read once at start in a sandbox, merged over English so a missing line stays English.
const LANGS = ['en', 'es'];
for (const f of (() => { try { return fs.readdirSync(path.join(PUBLIC, 'i18n')); } catch { return []; } })()) {
  const m = /^([a-z]{2})\.js$/.exec(f);
  if (!m) continue;
  try {
    const box = {};
    vm.runInNewContext(fs.readFileSync(path.join(PUBLIC, 'i18n', f), 'utf8'), { window: box, globalThis: box });
    if (box.ORCA_I18N?.server) { PUSH[m[1]] = { ...PUSH.en, ...box.ORCA_I18N.server }; LANGS.push(m[1]); }
  } catch (e) { log('i18n.pack_bad', { file: f, error: e.message }); }
}
function pushPayload(p, lang) {
  const L = PUSH[lang] || PUSH.en;
  const isChat = p.kind === 'mention' || p.kind === 'reply' || p.kind === 'agentReply';
  return JSON.stringify({ ...p, title: L[p.kind](p.name), body: p.kind === 'test' ? L.testBody : isChat ? `${p.room ? L.room : p.where}: ${p.text}` : p.body });
}

// only: a login — alerts for a claimed agent go to its holder's devices (and to devices
// subscribed before logins were recorded, which re-register with theirs on next open).
// strict: only that login's devices (chat: never someone else's phone). Devices without a login
// were subscribed on a single-user panel: they are "you".
async function pushAll(payload, only = null, strict = false) {
  if (!state.subs.length) return 0;
  const dead = [];
  let sent = 0;
  const subs = only ? state.subs.filter(x => (strict ? (x.login || 'local') === only : !x.login || x.login === only)) : state.subs;
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
function openCodeSession(a) {
  if (!['opencode', 'ollama'].includes(a.agent)) return null;
  const raw = a.agent_session?.value || null;
  const cwd = a.foreground_cwd || a.cwd;
  const directory = cwd ? path.resolve(expandHome(cwd)) : null;
  const saved = state.opencodeSessions[a.terminal];
  const session = raw || opencodeTranscript.findSession(OPENCODE_DB, {
    cwd: directory,
    since: prev.get(a.pane)?.since || state.born?.[a.terminal]?.at || null,
    kind: a.agent,
    known: saved?.directory === directory ? saved.session : null,
  });
  if (session && directory && (saved?.session !== session || saved?.directory !== directory)) {
    state.opencodeSessions[a.terminal] = { session, directory, kind: a.agent };
    saveState();
  }
  return session;
}

function shapeAgent(a) {
  const openCode = ['opencode', 'ollama'].includes(a.agent) ? openCodeSession(a) : null;
  const transcriptData = openCode ? opencodeTranscript.read(OPENCODE_DB, openCode) : null;
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
    model: state.models?.[a.terminal_id]?.model || null, // the last model picked from the card (not read from the agent)
    session: openCode || a.agent_session?.value || null,
    usage: transcriptData?.usage || null,
    profile: state.instances?.[a.terminal_id]?.profile || null, // started from a saved agent
    since: prev.get(a.pane_id)?.since || null, // ms epoch the current status began (poller-tracked)
    jobs: jobStats(a.terminal_id),
    fresh: isFresh(a.terminal_id), // finished a job nobody has opened yet (any device)
    claim: claimOf(a.terminal_id),
    seq: a.state_change_seq || 0, // herdr's change counter: higher = changed more recently
  };
}

// Workspace geometry for the map: every tab with its panes' real rectangles (agent or not).
let layoutCache = { at: 0, tabs: [], workspaces: [] };
let layoutFlight = null;
// tab id -> { key (its panes), gen, at, area, rects }: a tab's split layout is read again only
// when its panes change, after an ORCA change to the layout (layoutGen), or every LAYOUT_MAX_AGE
// (a resize done in the herdr window itself).
const tabLayouts = new Map();
const LAYOUT_MAX_AGE = 15e3;
const shapeWorkspace = w => ({ id: w.workspace_id, number: w.number, label: w.label || null });
function workspaceLayout() {
  if (Date.now() - layoutCache.at < 5000 && layoutCache.gen === layoutGen) return Promise.resolve(layoutCache);
  if (!layoutFlight) layoutFlight = readLayout().finally(() => { layoutFlight = null; });
  return layoutFlight;
}
async function readLayout() {
  const gen = layoutGen;
  const [wsOut, tabsOut, panesOut] = await Promise.all([herdrJson(['workspace', 'list']), herdrJson(['tab', 'list']), herdrJson(['pane', 'list'])]);
  const panes = panesOut.result?.panes || [];
  const now = Date.now();
  const tabList = tabsOut.result?.tabs || [];
  for (const id of tabLayouts.keys()) if (!tabList.some(t => t.tab_id === id)) tabLayouts.delete(id);
  const tabs = await Promise.all(tabList.map(async t => {
    const mine = panes.filter(p => p.tab_id === t.tab_id);
    const key = mine.map(p => p.pane_id).sort().join(',');
    let c = tabLayouts.get(t.tab_id);
    if (mine.length && (!c || c.key !== key || c.gen !== gen || now - c.at > LAYOUT_MAX_AGE)) {
      c = { key, gen, at: now, area: null, rects: [] };
      try {
        const l = (await herdrJson(['pane', 'layout', '--pane', mine[0].pane_id])).result?.layout;
        c.area = l?.area || null;
        c.rects = (l?.panes || []).map(p => ({ pane: p.pane_id, ...p.rect }));
        tabLayouts.set(t.tab_id, c);
      } catch { /* tab closed mid-read */ }
    }
    const area = mine.length ? c?.area || null : null, rects = mine.length ? c?.rects || [] : [];
    return {
      id: t.tab_id, ws: t.workspace_id, number: t.number, label: t.label || null, area,
      panes: rects.map(r => {
        const p = panes.find(x => x.pane_id === r.pane);
        return { pane: r.pane, x: r.x, y: r.y, w: r.width, h: r.height, agent: p?.agent || null, cwd: shortHome(p?.foreground_cwd || p?.cwd) };
      }),
    };
  }));
  layoutCache = { at: Date.now(), gen, tabs, workspaces: (wsOut.result?.workspaces || []).map(shapeWorkspace) };
  return layoutCache;
}

// The board (every device, every 3 s), the 4 s poll, the agent socket and the memory meter all
// ask for the agent list. Each herdr call is a process start, which costs the main thread a
// few ms at this app's size; so callers within LIST_TTL share one call (in flight or just done).
// Any herdr command that is not a read resets it (see herdr()). Each caller gets its own copies.
const LIST_TTL = 1000;
async function listAgents() {
  if (agentsList.list && Date.now() - agentsList.at < LIST_TTL) return agentsList.list.map(a => ({ ...a }));
  if (!agentsList.flight || agentsList.flightGen !== agentsList.gen) {
    const gen = agentsList.flightGen = agentsList.gen;
    const flight = agentsList.flight = (async () => {
      const out = await herdrJson(['agent', 'list']);
      const list = (out.result?.agents || []).map(shapeAgent)
        .sort((a, b) => a.tab.localeCompare(b.tab, 'en', { numeric: true }) || a.pane.localeCompare(b.pane));
      agentCache.clear();
      for (const a of list) agentCache.set(a.pane, a);
      // A change made while this read was in flight: the result is returned but not kept.
      if (agentsList.gen === gen) { agentsList.list = list; agentsList.at = Date.now(); }
      return list;
    })().finally(() => { if (agentsList.flight === flight) agentsList.flight = null; });
  }
  return (await agentsList.flight).map(a => ({ ...a }));
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
const deepRead = new Map(); // pane -> 'seq:status' of the last full history read (see /read)

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
// On a hosted panel: the people seen in the last 90 days (not "you", which is the box itself).
const hostLogins = () => Object.entries(state.people || {}).filter(([, p]) => Date.now() - p.at < 90 * 864e5).map(([l]) => l);
const PEOPLE_LOGINS = () => [...(ID_SECRET ? [] : ['local']), ...others.keys(), ...hostLogins(), TEAM];
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
  let sum = { ask: '', said: '' }, out = null, text = '';
  try {
    try { text = await herdr(['agent', 'read', a.pane, '--source', 'recent', '--lines', '300', '--format', 'text']); }
    catch { text = await herdr(['agent', 'read', a.pane, '--source', 'visible', '--format', 'text']); }
    sum = summarizeTurn(text);
    out = journal.snapshot(a.name || a.pane, text);
  } catch { /* pane gone: keep the job with the title only */ }
  const sent = sentAsk.get(a.terminal);
  if (!sum.ask && sent && (!from || sent.at >= from - 5000)) sum.ask = sent.text.replace(/\s+/g, ' ').slice(0, 160);
  sentAsk.delete(a.terminal);
  const job = { start: from, end, ask: sum.ask, said: sum.said, title: a.title || '' };
  const list = [job, ...(state.jobs[a.terminal] || [])].slice(0, JOBS_KEEP);
  state.jobs[a.terminal] = list;
  for (const [t, l] of Object.entries(state.jobs)) if (!l.length || end - l[0].end > JOB_TTL) delete state.jobs[t];
  saveState();
  const secs = from ? Math.round((end - from) / 1000) : null;
  log('agent.job', { pane: a.pane, secs });
  jr(null, 'agent.job', a, { ask: job.ask, said: job.said, title: job.title, secs, out });
  answerAsk(a, text, { from, end, out });
  offerHandoffs(a, job);
}

// ─── Answers: what an agent asks, and its reply chips ───────────────────────
// The reply-chips mod writes ~/.claude/orca/<pane>.json from inside Claude: the
// pending AskUserQuestion (exact options) and the latest reply chips. Without it
// (Codex, a permission prompt, an older session) the numbered menu on screen is read.
const ORCA_DIR = path.join(HOME, '.claude', 'orca');
const CLAUDE_PROJECTS = path.join(HOME, '.claude', 'projects');
function agentTranscript(a) {
  if (!a?.session) return null;
  if (a.agent === 'claude') {
    const file = transcript.findTranscript(CLAUDE_PROJECTS, a.session);
    if (!file) return null;
    try {
      const st = fs.statSync(file);
      return { blocks: transcript.readBlocks(file), rev: `${a.session}:${st.size}:${Math.round(st.mtimeMs)}` };
    } catch { return null; }
  }
  return ['opencode', 'ollama'].includes(a.agent) ? opencodeTranscript.read(OPENCODE_DB, a.session) : null;
}
const { chipsFor, lastReply, replyAfter, turnReply } = require('./chips');
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
  const openCode = opencodeTranscript.permissionMenu(text);
  if (openCode) return openCode;
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
    options: opts.filter(o => !/^(chat about this|type something\.?|escribe algo\.?)$/i.test(o.label)).map(o => ({ ...o, risky: RISKY.test(o.label) })),
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
state.born = state.born || {}; // terminal -> { at (first seen, null = before ORCA was watching), kind, seen }
const lastLive = new Map();    // terminal -> agent at the last poll
const missing = new Map();     // terminal -> polls it has been missing for
const ended = new Set();       // terminals ORCA itself ended (so they aren't also logged as gone)
async function poll() {
  let agents;
  try { agents = await listAgents(); } catch { return; }
  const now = Date.now();
  const seen = new Set();
  for (const a of agents) {
    seen.add(a.pane);
    if (state.sleeping[a.pane]) {
      prev.set(a.pane, { status: a.status, since: now });
      continue;
    }
    const p = prev.get(a.pane);
    // First look after a restart: the state's start is unknown, so no age is shown for it.
    if (!p) prev.set(a.pane, { status: a.status, since: polledOnce ? now : null });
    else if (p.status !== a.status) prev.set(a.pane, { status: a.status, since: now });
    // Job log: open on working, close on idle/done (very short turns are not jobs).
    if (a.status === 'working' && !work.has(a.pane)) work.set(a.pane, { from: p || polledOnce ? now : null });
    else if ((a.status === 'idle' || a.status === 'done') && work.has(a.pane)) {
      const { from } = work.get(a.pane);
      work.delete(a.pane);
      if (!from || now - from >= 5000 || askInFlight(a.terminal)) recordJob(a, from, now).catch(() => {});
    }
    if (!p || p.status === a.status) continue;
    const label = a.name || a.pane;
    const url = '/#' + encodeURIComponent(a.pane);
    if (a.status === 'blocked') {
      jr(null, 'agent.blocked', a, { title: a.title || '' });
      pushAll({ name: label, body: a.title || a.cwd, tag: a.pane, url, kind: 'blocked' }, holderLogin(a.terminal));
    } else if (p.status === 'working' && (a.status === 'idle' || a.status === 'done') && now - p.since >= MIN_WORK_MS) {
      pushAll({ name: label, body: a.title || a.cwd, tag: a.pane, url, kind: 'done' }, holderLogin(a.terminal));
    }
  }
  for (const pane of prev.keys()) if (!seen.has(pane)) prev.delete(pane);
  for (const pane of work.keys()) if (!seen.has(pane)) work.delete(pane);
  // Lifecycle by terminal (survives moves): first seen = born; missing twice in a row = gone.
  // An agent ORCA ended is journaled by the End action, not here.
  const live = new Set(agents.map(a => a.terminal));
  let bornChanged = false;
  for (const a of agents) {
    if (!state.born[a.terminal]) { state.born[a.terminal] = { at: polledOnce ? now : null, kind: a.agent }; bornChanged = true; }
    lastLive.set(a.terminal, a);
    missing.delete(a.terminal);
    // A saved agent's latest session, so Resume can pick up where it left off.
    const inst = state.instances[a.terminal];
    if (inst && a.session && state.profileSessions[inst.profile] !== a.session) { state.profileSessions[inst.profile] = a.session; bornChanged = true; }
  }
  for (const [t, a] of lastLive) {
    if (live.has(t)) continue;
    const n = (missing.get(t) || 0) + 1;
    if (n < 2) { missing.set(t, n); continue; } // one missed list can be a blip
    missing.delete(t); lastLive.delete(t);
    if (state.instances[t]) { profiles.cleanRun(state.instances[t].run || state.instances[t].profile); delete state.instances[t]; delete state.firstPrompts[t]; bornChanged = true; }
    if (ended.has(t)) { ended.delete(t); continue; }
    const b = state.born[t];
    jr(null, 'agent.gone', a, { ranFor: b?.at ? now - b.at : null });
  }
  // Births of terminals gone for over a day are forgotten (the journal keeps the history).
  for (const [t, b] of Object.entries(state.born)) if (!live.has(t) && !lastLive.has(t) && now - (b.seen || b.at || now) > 864e5) { delete state.born[t]; delete state.opencodeSessions[t]; bornChanged = true; }
  for (const t of live) if (state.born[t]) state.born[t].seen = now;
  if (bornChanged) saveState();
  polledOnce = true;
  try { linkProfileTeams(agents); } catch (e) { log('profile.team_error', { detail: e.message }); }
  sweepWorkers(agents);
  expireSpawns();
  deliverFirstPrompts(agents).catch(e => log('profile.deliver_error', { detail: e.detail || e.message }))
    .then(() => deliverQueued(agents)).catch(e => log('msg.deliver_error', { detail: e.detail || e.message }))
    .then(() => deliverAsks(agents)).catch(e => log('chat.deliver_error', { detail: e.detail || e.message }));
}
// Always track state (so the first alert after subscribing is correct); push only when subscribed.
setInterval(poll, POLL_MS);

// ─── Saved agents and workers: one start routine ─────────────────────────────
// Agents: one live copy, may resume. Workers: "<setup>-<n>", start with their task, end themselves.
async function startProfile(req, p, { task = null, leadTerminal = null, resume = false, tab } = {}) {
  const agents = await listAgents();
  let name = p.id, sessionId = null;
  if (p.type === 'agent') {
    if (agents.some(a => a.name === p.id || (state.instances[a.terminal]?.profile === p.id && state.instances[a.terminal]?.type !== 'worker'))) throw new HttpError(409, 'profile_running');
    sessionId = resume ? state.profileSessions[p.id] : null;
    if (resume && !sessionId) throw new HttpError(409, 'no_session');
  } else {
    if (!task) throw new HttpError(400, 'bad_task');
    if (liveWorkers() >= MAX_WORKERS) throw new HttpError(409, 'worker_limit');
    const taken = new Set(agents.map(a => a.name));
    let n = 1;
    while (taken.has(`${p.id}-${n}`)) n++;
    name = `${p.id}-${n}`.slice(0, 32);
  }
  const all = profiles.list();
  const leadAgent = leadTerminal ? agents.find(a => a.terminal === leadTerminal) : null;
  let mcp = null;
  if (p.kind === 'claude' && p.tools.mcp.length) {
    try { mcp = tools.writeRun(path.join(profiles.RUNS, name), p.tools.mcp, { browserSites: p.tools.browserSites || [] }); } catch (e) { profiles.cleanRun(name); toolErr(e); }
  }
  const run = profiles.buildRun(p, {
    mcpFile: mcp?.mcpFile, allow: mcp?.allow,
    name, skills: skills.list(), kb: kb.list().length > 0, resume: sessionId,
    lead: leadAgent ? nameOf(leadAgent) : p.type === 'worker' ? null : p.reportsTo,
    members: p.type === 'agent' ? all.filter(x => x.reportsTo === p.id).map(x => x.id) : [],
    workers: p.type === 'agent' ? p.spawn.profiles.filter(id => all.some(x => x.id === id && x.type === 'worker')) : [],
  });
  let r;
  try {
    r = await startAgent(req, { name, kind: p.kind, folder: p.folder, tab, model: p.model, account: p.account },
      { args: run.args, ro: [run.dir, skills.ROOT], envFiles: mcp?.envFile ? [mcp.envFile] : [],
        detail: { profile: p.id, rev: p.rev, resume: !!sessionId, ...(mcp ? { mcp: mcp.ids } : {}), ...(task ? { worker: true, task: task.slice(0, 300) } : {}) } });
  } catch (e) { profiles.cleanRun(name); throw e; }
  if (r.terminal) {
    state.instances[r.terminal] = {
      profile: p.id, rev: p.rev, type: p.type, run: name, lead: p.reportsTo || null, at: Date.now(), by: loginOf(req) || 'local',
      ...(p.type === 'worker' ? { task, leadTerminal, minutes: p.worker.maxMinutes, until: Date.now() + p.worker.maxMinutes * 60e3 } : {}),
    };
    // Non-Claude kinds read their instructions as the first message; a worker's task follows them.
    const first = [run.firstPrompt, task ? `[ORCA] Your task:\n${task}` : null].filter(Boolean).join('\n\n');
    if (first) state.firstPrompts[r.terminal] = { text: first, at: Date.now() };
    saveState();
  }
  return { ...r, name };
}

// ─── New agent ────────────────────────────────────────────────────────────────
// Who may start what: limited users only in their folders, always sandboxed (fail closed);
// a shell needs the PIN. `ro` = extra read-only paths the sandbox must show (a profile's files).
async function startAgent(req, body, { args = null, detail = {}, envFiles = [] } = {}) {
  const login = loginOf(req);
  if (!canAct(login)) throw new HttpError(403, 'read_only');
  // Another login for a kind (accounts.js): free = you; hosted = Operio manages them.
  if (body.account && body.account !== 'default' && !canManageLogins(login)) throw new HttpError(403, 'forbidden');
  if (String(body.kind || '') === 'shell') requireShell(); // a shell needs a fresh confirmation first
  const r = await newAgent(body, { args, envFiles });
  jr(req, r.shell ? 'shell.new' : 'agent.new', { name: r.name, pane: r.pane, terminal: r.terminal || null, cwd: r.cwd, agent: r.kind },
    { kind: r.kind, tab: body.tab || 'new', blocked: !!r.blocked, ...detail });
  return r;
}

function resolveFolder(input) {
  const abs = path.resolve(expandHome(String(input || '~').trim()));
  if (abs !== HOME && !abs.startsWith(HOME + path.sep)) throw new HttpError(400, 'folder_outside');
  let st;
  try { st = fs.statSync(abs); } catch { throw new HttpError(400, 'folder_missing'); }
  if (!st.isDirectory()) throw new HttpError(400, 'not_folder');
  return abs;
}

async function newAgent({ name, kind, folder, tab, model, account }, { prepare, args = null, envFiles = [] } = {}) {
  name = String(name || '').trim();
  if (!AGENT_NAME_RE.test(name)) throw new HttpError(400, 'bad_agent_name');
  if (!KINDS.includes(kind)) throw new HttpError(400, 'bad_kind');
  // Optional starting model (only kinds listed in MODELS; empty = the agent's own default).
  model = String(model || '');
  if (kind === 'ollama') {
    await ollama.fresh();
    const list = MODELS.ollama;
    if (!list.length) throw new HttpError(503, 'ollama_off');
    if (!model) model = list.includes(process.env.HERDR_WEB_OLLAMA_MODEL || 'qwen2.5:7b') ? (process.env.HERDR_WEB_OLLAMA_MODEL || 'qwen2.5:7b') : list[0];
  }
  if (model && !(MODELS[kind] || []).includes(model)) throw new HttpError(400, 'bad_request');
  let acct = null;
  try { acct = accounts.startFor(kind, account); } catch (e) { accountErr(e); }
  const cwd = resolveFolder(folder);

  let pane;
  if (!tab || tab === 'new') {
    let out;
    try {
      out = await herdrJson(['tab', 'create', '--cwd', cwd, '--label', name]);
    } catch (e) {
      // A fresh herdr has no workspace yet: the first agent opens one, named after its folder.
      if (e.code !== 'ws_gone') throw e;
      out = await herdrJson(['workspace', 'create', '--cwd', cwd, '--label', path.basename(cwd) || 'agents']);
      const t = out.result?.tab?.tab_id;
      if (t) await herdr(['tab', 'rename', t, name]).catch(() => {});
    }
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
  // Another account for this kind (this pane only): point the CLI at its folder, and load its API
  // key from the file (never typed, so it stays out of the screen and the shell history).
  if (acct) {
    const line = [...acct.exports.map(([k, v]) => `export ${k}=${shq1(v)}`), ...(acct.source ? [`set -a; . ${shq1(acct.source)}; set +a`] : [])].join('; ');
    if (line) { await herdr(['pane', 'send-text', pane, ` ${line}\r`]); await new Promise(r => setTimeout(r, 250)); }
  }
  // Secrets the agent's MCP servers use (its own run file, read from disk: never typed).
  for (const f of envFiles) { await herdr(['pane', 'send-text', pane, ` set -a; . ${shq1(f)}; set +a\r`]); await new Promise(r => setTimeout(r, 200)); }
  let startKind = kind, extra = [];
  if (kind === 'ollama') {
    let id;
    try { id = await ollama.prepare(model); } catch (e) { throw new HttpError(e.code === 'bad_model' ? 400 : 503, e.code === 'bad_model' ? 'bad_request' : 'ollama_off', e.message); }
    await herdr(['pane', 'send-text', pane, ` export OPENCODE_CONFIG=${shq1(OLLAMA_OPENCODE)}\r`]);
    await new Promise(r => setTimeout(r, 200));
    startKind = 'opencode'; extra = ['--', '-m', id];
  }
  if (prepare) await prepare(pane);
  // A plain shell: the pane is the result (named through its pane label).
  if (kind === 'shell') {
    await herdr(['pane', 'rename', pane, name]).catch(() => {});
    log('shell.new', { pane, name, cwd: shortHome(cwd), tab: tab || 'new' });
    layoutCache.at = 0;
    return { pane, shell: true, name, kind, cwd: shortHome(cwd) };
  }
  // Claude: a saved agent's own arguments (instructions, tools, MCP servers, model), else the picked model.
  if (kind === 'claude') {
    const a = args || (model ? ['--model', model] : []);
    if (a.length) extra = ['--', ...a];
  }
  let blocked = false;
  try {
    await herdr(['agent', 'start', name, '--kind', startKind, '--pane', pane, '--timeout', '60000', ...extra], 70000);
  } catch (e) {
    // Started but asking something first (e.g. Claude's "trust this folder?"): not a failure.
    if (e.code !== 'blocked' && !/blocked/i.test(e.detail || '')) throw e;
    blocked = true;
  }
  await herdr(['agent', 'rename', pane, name]).catch(() => {});
  let terminal = null;
  try { const pg = await herdrJson(['pane', 'get', pane]); terminal = pg.result?.pane?.terminal_id || null; applyName(terminal, name); } catch { applyName(null, name); }
  if (terminal) {
    state.born[terminal] = { at: Date.now(), kind, seen: Date.now() };
    if (model) { state.models = state.models || {}; state.models[terminal] = { model, at: Date.now() }; }
    saveState();
  }
  log('agent.new', { pane, name, kind, model: model || null, account: acct ? account : null, cwd: shortHome(cwd), tab: tab || 'new', blocked });
  layoutCache.at = 0;
  return { pane, blocked, terminal, name, kind, cwd: shortHome(cwd) };
}

// ─── Move an agent (its pane) to another place ───────────────────────────────
// The process keeps running; herdr gives the pane a new id. terminal_id stays, so tags
// follow. Moving the last pane out of a tab/workspace closes it (herdr does that).
//   { mode: 'split', tab }          beside the panes of an existing tab
//   { mode: 'beside', target, dir } next to one pane of another tab (dir: right | down)
//   { mode: 'swap', target }        trade places with a pane of the same tab
//   { mode: 'tab', workspace }      as a new tab in an existing workspace
//   { mode: 'workspace', label? }   as a new workspace
// Works for agents and plain shells alike (drag and drop on the map moves both).
// herdr only swaps inside one tab and ignores a move within the same tab, hence the split.
// herdr refuses to move or swap panes while the source or destination tab is zoomed: it answers
// changed:false and leaves everything where it was. Unzoom those tabs first; afterwards re-zoom the
// source tab on the same pane (unless that pane is the one that left). The destination stays unzoomed
// so the moved agent is visible.
async function unzoomTabs(paneIds) {
  const restore = [];
  const seen = new Set();
  for (const id of paneIds) {
    if (!id) continue;
    const l = (await herdrJson(['pane', 'layout', '--pane', id]).catch(() => null))?.result?.layout;
    if (!l || seen.has(l.tab_id)) continue;
    seen.add(l.tab_id);
    if (!l.zoomed) continue;
    await herdr(['pane', 'zoom', id, '--off']);
    restore.push({ tab: l.tab_id, pane: l.focused_pane_id });
  }
  return restore;
}
async function rezoom(restore, sourceTab, movedFrom) {
  for (const z of restore) {
    if (z.tab !== sourceTab || !z.pane || z.pane === movedFrom) continue;
    await herdr(['pane', 'zoom', z.pane, '--on']).catch(e => log('agent.move.rezoom_failed', { pane: z.pane, detail: e.detail }));
  }
}

async function moveAgent(pane, body) {
  const agents = await listAgents();
  const a = agents.find(x => x.pane === pane);
  const all = (await herdrJson(['pane', 'list'])).result?.panes || [];
  const me = all.find(p => p.pane_id === pane);
  if (!me) throw new HttpError(404, 'gone');
  const tabName = a?.name || 'shell';
  const mode = body.mode;
  if (mode === 'swap') {
    const target = all.find(p => p.pane_id === String(body.target || ''));
    if (!target) throw new HttpError(404, 'tab_gone');
    if (target.pane_id === pane) throw new HttpError(400, 'same_place');
    if (target.tab_id !== me.tab_id) throw new HttpError(400, 'bad_request');
    const zoomed = await unzoomTabs([pane]);
    const r = (await herdrJson(['pane', 'swap', '--source-pane', pane, '--target-pane', target.pane_id], 10000)).result?.swap || {};
    await rezoom(zoomed, me.tab_id, null);
    if (!r.changed) throw new HttpError(502, 'move_failed', 'swap did not change the layout');
    layoutCache.at = 0;
    log('agent.move', { from: pane, mode, with: target.pane_id, tab: me.tab_id });
    return { ok: true, pane, tab: me.tab_id, workspace: me.workspace_id, closedWorkspace: false };
  }
  const args = ['pane', 'move', pane];
  if (mode === 'split') {
    const tab = String(body.tab || '');
    if (!TAB_RE.test(tab)) throw new HttpError(400, 'bad_request');
    if (tab === me.tab_id) throw new HttpError(400, 'same_place');
    const inTab = all.filter(p => p.tab_id === tab);
    if (!inTab.length) throw new HttpError(404, 'tab_gone');
    args.push('--tab', tab, '--split', inTab.length % 2 ? 'right' : 'down', '--target-pane', inTab[inTab.length - 1].pane_id);
  } else if (mode === 'beside') {
    const target = all.find(p => p.pane_id === String(body.target || ''));
    if (!target) throw new HttpError(404, 'tab_gone');
    if (target.tab_id === me.tab_id) throw new HttpError(400, 'same_place');
    const dir = body.dir === 'down' ? 'down' : 'right';
    args.push('--tab', target.tab_id, '--split', dir, '--target-pane', target.pane_id);
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

  const destPane = mode === 'beside' ? String(body.target) : mode === 'split' ? args[args.indexOf('--target-pane') + 1] : null;
  const zoomed = await unzoomTabs([pane, destPane]);
  let r;
  try { r = (await herdrJson(args, 10000)).result?.move_result || {}; }
  catch (e) { await rezoom(zoomed, me.tab_id, null); throw e; }
  const moved = r.pane?.pane_id;
  // changed:false = herdr left the pane where it was; never report that as a move.
  if (!moved || r.changed === false || r.pane.tab_id === me.tab_id) {
    await rezoom(zoomed, me.tab_id, null);
    throw new HttpError(502, 'move_failed', JSON.stringify({ changed: r.changed, tab: r.pane?.tab_id }).slice(0, 300));
  }
  await rezoom(zoomed, me.tab_id, pane);
  // Keep the name and the status clock with the agent, not with the old pane id.
  if (a?.name) await herdr(['agent', 'rename', moved, a.name]).catch(e => log('agent.move.rename_failed', { pane: moved, detail: e.detail }));
  const p = prev.get(pane);
  if (p) { prev.set(moved, p); prev.delete(pane); }
  layoutCache.at = 0;
  log('agent.move', { from: pane, to: moved, mode, tab: r.pane.tab_id, closedTab: r.closed_tab_id || null, closedWorkspace: r.closed_workspace_id || null });
  return { ok: true, pane: moved, tab: r.pane.tab_id, workspace: r.pane.workspace_id, closedWorkspace: !!r.closed_workspace_id };
}

// ─── Stop and End ─────────────────────────────────────────────────────────────
// Stop: interrupt the current job, the agent stays (Esc; ⌃C once if it is still working —
// never twice, which quits Claude). End: save its output, ask it to quit with its own
// command, ⌃C⌃C if it ignores that, then close the pane (which kills whatever is left).
// Its folder, files and worktree are never touched.
const EXIT_CMD = { claude: '/exit', opencode: '/exit', codex: '/quit', hermes: '/exit', agy: '/exit' };
async function agentRunning(terminal) {
  try { return ((await herdrJson(['agent', 'list'])).result?.agents || []).find(x => x.terminal_id === terminal) || null; }
  catch { return { unknown: true }; } // can't tell: treat as still running
}
async function waitGone(terminal, tries) {
  for (let i = 0; i < tries; i++) { await sleep(500); if (!(await agentRunning(terminal))) return true; }
  return false;
}

// Interrupt keys per agent. opencode quits on a single ⌃C, so it only ever gets Esc Esc (its
// "press again to interrupt"). Claude stops on Esc; one ⌃C is a safe fallback there (two quit).
const STOP_KEYS = { opencode: ['esc', 'esc'] };
const CTRL_C_STOPS = new Set(['claude']);
async function stopAgent(a) {
  const keys = STOP_KEYS[a.agent] || ['esc'];
  for (const k of keys) { await herdr(['agent', 'send-keys', a.pane, k]); await sleep(250); }
  await sleep(1500);
  let now = await agentRunning(a.terminal);
  let how = keys.join('+');
  if (now?.agent_status === 'working' && CTRL_C_STOPS.has(a.agent)) {
    await herdr(['agent', 'send-keys', a.pane, 'ctrl+c']);
    how += '+ctrl+c';
    await sleep(1200);
    now = await agentRunning(a.terminal);
  }
  return { how, status: now?.agent_status || (now ? null : 'exited') };
}

const execFileP = (cmd, args, opts = {}) => new Promise(resolve => execFile(cmd, args, { timeout: 3000, maxBuffer: 1024 * 1024, ...opts }, (err, stdout) => resolve(err ? null : stdout)));

// ─── LLM keys: apply = `operio-orca llm apply` (the CLI knows the service and the pid) ─────
// The panel checks for busy agents first and answers 409 with their names; the CLI checks
// again (a race) and does the restart. Its last line says what happened; mapped to a code.
const LLM_RESULTS = [[/^restarted herdr/, 'restarted'], [/not running/, 'not_running'], [/not restarted|nothing restarted|not managed/, 'not_managed']];
function llmApply() {
  return new Promise(resolve => {
    const env = { ...process.env, OPERIO_ORCA_CONFIG_DIR: STATE_DIR, OPERIO_ORCA_HERDR_BIN: HERDR };
    execFile('bash', [CLI, 'llm', 'apply'], { env, timeout: 90000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const lines = ((stdout || '') + (stderr || '')).split('\n').map(l => l.replace(/^operio-orca: (?:ERROR: )?/, '').trim()).filter(Boolean);
      const line = lines.at(-1) || '';
      const busy = line.match(/^not now: (.+?) still working or waiting/);
      resolve({ ok: !err, line, busy: busy ? busy[1].split(', ') : null, result: (LLM_RESULTS.find(([re]) => re.test(line)) || [null, 'unknown'])[1] });
    });
  });
}
const WORKTREE_RE = /\/\.claude\/worktrees\/[^/]+|\/\.worktrees\/[^/]+/;

// What ending this agent would lose — shown in the confirm box before anything happens.
async function endCheck(a) {
  const abs = expandHome(a.cwd || '~');
  const [porcelain, layout] = await Promise.all([
    execFileP('git', ['-C', abs, 'status', '--porcelain', '--untracked-files=normal']),
    workspaceLayout().catch(() => null),
  ]);
  const byTerminal = new Map([...agentCache.values()].map(x => [x.terminal, x]));
  const linked = state.links.filter(l => l.from === a.terminal || l.to === a.terminal)
    .map(l => byTerminal.get(l.from === a.terminal ? l.to : l.from)).filter(Boolean).map(nameOf);
  const wt = abs.match(WORKTREE_RE);
  const tab = layout?.tabs.find(t => t.id === a.tab);
  const ws = (a.tab || '').split(':')[0];
  const lastInWs = !!tab && tab.panes.length <= 1 && layout.tabs.filter(t => t.ws === ws).length <= 1;
  const mem = memCache.data && Date.now() - memCache.at < 120e3 ? memCache.data.agents.find(r => r.pane === a.pane) : null;
  const born = state.born[a.terminal];
  return {
    name: a.name || a.pane, status: a.status,
    dirty: porcelain == null ? null : porcelain.split('\n').filter(Boolean).length, // null = not a git folder
    worktree: wt ? shortHome(abs.slice(0, wt.index + wt[0].length)) : null,
    linked, lastInWs, wsLabel: lastInWs ? (layout.workspaces.find(w => w.id === ws)?.label || null) : null,
    memKB: mem?.pss ?? null,
    ranFor: born?.at ? Date.now() - born.at : null,
  };
}

// Forget everything ORCA kept about a terminal; tell its linked agents.
function forgetTerminal(t, name, { quiet = false } = {}) {
  const mine = state.links.filter(l => l.from === t || l.to === t);
  const others = [...new Set(mine.map(l => (l.from === t ? l.to : l.from)))];
  state.links = state.links.filter(l => l.from !== t && l.to !== t);
  for (const l of mine) delete state.handoffs[l.id];
  for (const m of state.msgs) if (m.state === 'queued' && m.to === t) m.state = 'failed';
  for (const o of quiet ? [] : others) {
    try { queueMsg({ from: t, to: o, text: `[ORCA] Agent ${name} was ended. Your link with it is gone, and operio-orca-send can no longer reach it. No reply needed.`, via: 'intro' }); } catch { /* best effort */ }
  }
  for (const k of ['tags', 'claims', 'seen', 'jobs', 'born']) if (state[k]) delete state[k][t];
  sentAsk.delete(t);
  saveState();
  return others.length;
}

async function endAgent(a, _who, { quiet = false } = {}) {
  // 1. Keep its last output for the journal.
  let text = '';
  try { text = await herdr(['agent', 'read', a.pane, '--source', 'recent', '--lines', '400', '--format', 'text']); }
  catch { text = await visible(a.pane).catch(() => ''); }
  const out = journal.snapshot(a.name || a.pane, text);
  const last = summarizeTurn(text);
  ended.add(a.terminal);
  // 2. Ask it to quit the way it understands.
  let mode = 'forced';
  try {
    if (a.status === 'working' || a.status === 'blocked') { await herdr(['agent', 'send-keys', a.pane, 'esc']).catch(() => {}); await sleep(800); }
    const cmd = EXIT_CMD[a.agent];
    if (cmd) {
      await herdr(['agent', 'prompt', a.pane, cmd], 8000).catch(() => {});
      if (await waitGone(a.terminal, 10)) mode = 'clean';
    }
    if (mode === 'forced') {
      await herdr(['agent', 'send-keys', a.pane, 'ctrl+c']).catch(() => {});
      await sleep(250);
      await herdr(['agent', 'send-keys', a.pane, 'ctrl+c']).catch(() => {});
      if (await waitGone(a.terminal, 6)) mode = 'interrupted';
    }
  } catch (e) { log('agent.end_signal_failed', { pane: a.pane, detail: e.detail || e.message }); }
  // 3. Close the pane: whatever still runs there stops.
  let closed = true;
  try { await herdr(['pane', 'close', a.pane]); }
  catch (e) { closed = false; log('agent.end_close_failed', { pane: a.pane, detail: e.detail || e.message }); }
  if (!closed && mode === 'forced') { ended.delete(a.terminal); throw new HttpError(502, 'end_failed'); }
  // 4. Forget it and tell its links.
  const born = state.born[a.terminal];
  const ranFor = born?.at ? Date.now() - born.at : null;
  const jobs24 = jobStats(a.terminal).n;
  const notified = forgetTerminal(a.terminal, nameOf(a), { quiet });
  prev.delete(a.pane); work.delete(a.pane); agentCache.delete(a.pane);
  layoutCache.at = 0;
  log('agent.end', { pane: a.pane, mode, closed });
  return { mode, closed, out, ranFor, jobs24, notified, said: last.said };
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

const sleepTimers = new Map();
const wakingPanes = new Set();
const sleepingPanes = new Set();
function sleepingItem(a, entry) {
  return {
    id: a.pane,
    name: a.name || a.pane,
    paneId: a.pane,
    pid: entry.pids.at(-1),
    sleepingSince: entry.sleepingSince,
    wakeAt: entry.wakeAt || null,
  };
}
function clearSleepTimer(pane) {
  const timer = sleepTimers.get(pane);
  if (timer) clearTimeout(timer);
  sleepTimers.delete(pane);
}
function releaseSleep(pane) {
  const entry = state.sleeping[pane];
  if (!entry) return false;
  clearSleepTimer(pane);
  resumePids(entry.pids);
  delete state.sleeping[pane];
  saveState();
  return true;
}
function armSleepTimer(pane, wakeAt) {
  clearSleepTimer(pane);
  if (!wakeAt) return;
  const timer = setTimeout(() => {
    sleepTimers.delete(pane);
    wakeAgent(pane, { automatic: true }).catch(e => log('agent.wake_error', { pane, code: e.code || 'internal' }));
  }, Math.max(0, Date.parse(wakeAt) - Date.now()));
  timer.unref?.();
  sleepTimers.set(pane, timer);
}
function resumePids(pids) {
  for (const pid of [...pids].reverse()) {
    try { process.kill(pid, 'SIGCONT'); }
    catch (e) { if (e.code !== 'ESRCH') throw e; }
  }
}
async function wakeAgent(pane, { automatic = false } = {}) {
  if (wakingPanes.has(pane)) {
    if (!automatic) throw new HttpError(409, 'not_sleeping');
    return null;
  }
  const entry = state.sleeping[pane];
  if (!entry) {
    if (!automatic) throw new HttpError(409, 'not_sleeping');
    return null;
  }
  wakingPanes.add(pane);
  try {
    clearSleepTimer(pane);
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) {
      delete state.sleeping[pane]; saveState();
      if (!automatic) throw new HttpError(410, 'gone');
      return null;
    }
    try { resumePids(entry.pids); }
    catch (e) { throw new HttpError(410, 'gone', e.message); }
    delete state.sleeping[pane]; saveState();
    await sleep(2000);
    agentsList.at = 0;
    const resumed = (await listAgents()).find(x => x.pane === pane) || a;
    const streamErrored = resumed.streamError === true || resumed.stream_error === true || resumed.status === 'error';
    const nudged = sleepState.shouldNudge(entry.statusAtSleep, resumed.status, streamErrored);
    if (nudged) await herdr(['agent', 'prompt', pane, 'continue']).catch(e => log('agent.wake_nudge_failed', { pane, detail: e.detail || e.message }));
    log('agent.wake', { pane, nudged });
    return { agent: { id: pane, name: nameOf(a), state: 'active' }, nudged };
  } finally { wakingPanes.delete(pane); }
}
async function reconcileSleeping() {
  const hadEntries = Object.keys(state.sleeping).length > 0;
  let agents;
  for (let attempt = 0; attempt < (hadEntries ? 3 : 1); attempt++) {
    try { agents = await listAgents(); }
    catch (e) {
      if (attempt === (hadEntries ? 2 : 0)) {
        log('agent.sleep_reconcile_list_failed', { code: e.code || 'internal' });
        agents = [];
      }
    }
    if (agents?.length || !hadEntries || attempt === 2) break;
    await sleep(5000);
    agentsList.at = 0;
  }
  const livePanes = new Set(agents.map(a => a.pane));
  const plan = sleepState.reconcile(state.sleeping, livePanes, pid => {
    try { process.kill(Number(pid), 0); return true; }
    catch (e) { return e.code === 'EPERM'; }
  });
  let changed = false;
  for (const pane of plan.drop) { delete state.sleeping[pane]; changed = true; }
  for (const pane of plan.release) {
    try { resumePids(state.sleeping[pane].pids); delete state.sleeping[pane]; changed = true; }
    catch (e) { log('agent.sleep_release_failed', { pane, detail: e.message }); }
  }
  if (changed) saveState();
  for (const pane of plan.arm) armSleepTimer(pane, state.sleeping[pane].wakeAt);
  for (const pane of plan.wake) await wakeAgent(pane, { automatic: true }).catch(() => {});
}
async function sleepAgent(a, wakeInMinutes) {
  if (state.sleeping[a.pane] || sleepingPanes.has(a.pane)) throw new HttpError(409, 'already_sleeping');
  sleepingPanes.add(a.pane);
  try {
    const info = await herdrJson(['pane', 'process-info', '--pane', a.pane]).catch(() => null);
    const root = Number(info?.result?.process_info?.shell_pid);
    if (!Number.isInteger(root) || root < 1) throw new HttpError(410, 'gone');
    const { procs, children } = await procTable();
    if (!procs.has(root)) throw new HttpError(410, 'gone');
    const tree = [];
    const visit = (pid, depth) => {
      for (const child of children.get(pid) || []) visit(child, depth + 1);
      if (pid !== root) tree.push({ pid, depth });
    };
    visit(root, 0);
    if (!tree.length) throw new HttpError(410, 'gone');
    tree.sort((x, y) => x.depth - y.depth); // parents before children: no parent ever sees a child stop
    // The pane's shell is stopped FIRST. A running shell sees its foreground child stop,
    // takes the terminal back and resets it to cooked mode; on resume the agent is then
    // in the background, can't read input and the terminal's replies land in the shell.
    // resumePids() continues in reverse, so the shell (pids[0]) is resumed last.
    const pids = [];
    for (const pid of [root, ...tree.map(x => x.pid)]) {
      try { process.kill(pid, 'SIGSTOP'); pids.push(pid); }
      catch (e) { if (e.code !== 'ESRCH') { try { resumePids(pids); } catch {} throw new HttpError(502, 'sleep_failed', e.message); } }
    }
    if (pids.length < 2) { try { resumePids(pids); } catch {} throw new HttpError(410, 'gone'); }
    const wakeAt = wakeInMinutes == null ? null : new Date(Date.now() + wakeInMinutes * 60e3).toISOString();
    const entry = { pids, sleepingSince: new Date().toISOString(), wakeAt, statusAtSleep: a.status };
    state.sleeping[a.pane] = entry;
    saveState();
    if (wakeAt) armSleepTimer(a.pane, wakeAt);
    log('agent.sleep', { pane: a.pane, pidCount: pids.length, wakeAt });
    return sleepingItem(a, entry);
  } finally { sleepingPanes.delete(a.pane); }
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
//   talk:    either side may message the other with `operio-orca-send` (bin/operio-orca-send).
// Any link lets the two agents message each other; no link, no delivery. Messages queue
// until the receiver is idle, then arrive as a prompt. Text lives only in the state file
// (0600), never in the log. A link that passes LINK_HOURLY messages an hour is paused and
// a person is alerted: two agents must not keep each other busy in a loop.
state.links = state.links || [];       // { id, kind, from, to, at, by }
state.instances = state.instances || {};             // terminal -> { profile, rev, type, at, by } (saved agents running now)
state.profileSessions = state.profileSessions || {}; // profile id -> last agent session id (Resume)
state.firstPrompts = state.firstPrompts || {};       // terminal -> { text, at }: instructions for non-Claude kinds

// Non-Claude saved agents read their instructions as their first message: sent once the agent is
// idle (after a "trust this folder?" question is answered), dropped after an hour.
async function deliverFirstPrompts(agents) {
  let changed = false;
  for (const [t, f] of Object.entries(state.firstPrompts)) {
    const a = agents.find(x => x.terminal === t);
    if (!a || Date.now() - f.at > QUEUE_TTL) { if (Date.now() - f.at > QUEUE_TTL) { delete state.firstPrompts[t]; changed = true; } continue; }
    if (a.status !== 'idle' && a.status !== 'done') continue;
    try {
      await herdr(['agent', 'prompt', a.pane, f.text], 10000); delete state.firstPrompts[t]; changed = true; log('profile.instructions_sent', { pane: a.pane });
      const inst = state.instances[t];
      if (inst?.type === 'worker' && !inst.taskSentAt) { inst.taskSentAt = Date.now(); sentAsk.set(t, { text: inst.task.slice(0, 200), at: inst.taskSentAt }); }
    }
    catch (e) { log('profile.instructions_failed', { pane: a.pane, code: e.code }); }
  }
  if (changed) saveState();
}
state.handoffs = state.handoffs || {}; // link id -> { end, ask, said }
state.msgs = state.msgs || [];         // { id, from, to, text, at, via, state, sentAt? }
const LINK_KINDS = ['depends', 'talk', 'reports']; // reports: from = member, to = its lead (2 levels max)
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
      jr(null, 'msg.rate_limited', byTerminal?.get(from) || null, { to: byTerminal?.get(to) ? jAgent(byTerminal.get(to)) : undefined, perHour: LINK_HOURLY });
      throw new HttpError(429, 'rate_limited');
    }
  }
  const m = { id: newId(), from, to, text, at: Date.now(), via, state: 'queued' };
  state.msgs.push(m);
  saveState();
  log('msg.queued', { id: m.id, via, chars: text.length });
  mirrorToChat(m, byTerminal);
  return m;
}

// Agent ↔ agent messages also show in both agents' chat threads (as the sending agent, never
// parsed for mentions → they can't prompt anyone). Unread counts move; a push goes only to
// people who turned that thread on themselves. Best effort: the message itself already queued.
function mirrorToChat(m, byTerminal) {
  if (!chat) return; // free panel: no chat, the message stays in the agent's Messages and the Journal
  try {
    const from = byTerminal?.get(m.from), to = byTerminal?.get(m.to);
    for (const p of a2aPosts(m, { fromName: nameOf(from), toName: nameOf(to) })) {
      let msg;
      try { msg = chat.post(p.thread, p.by, p.text, [], p.x); } catch (e) { log('chat.a2a_failed', { code: e.code || 'error' }); continue; }
      const preview = msg.text.replace(/\s+/g, ' ').slice(0, 140);
      const where = p.x.a2a.dir === 'in' ? nameOf(to) : nameOf(from);
      for (const login of chat.explicitFollowers(p.thread)) {
        if (isViewing(login, p.thread)) continue;
        pushAll({ kind: 'reply', name: `${p.x.a2a.from} → ${p.x.a2a.to}`, where, room: false, text: preview,
          tag: 'chat-' + p.thread, url: '/#chat-' + encodeURIComponent(p.thread), thread: p.thread }, login, true).catch(() => {});
      }
    }
  } catch (e) { log('chat.a2a_failed', { code: 'error', detail: String(e.message) }); }
}

function deliveryText(m, from, to) {
  const sender = nameOf(from);
  if (m.via === 'agent') return `[ORCA] Message from agent ${sender}:\n${m.text}\n\n(Reply only if it helps the work: operio-orca-send ${sender} "…" — your links: operio-orca-send --list)`;
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
  if (state.instances[a.terminal]?.type === 'worker') return; // workers send their result themselves
  const down = state.links.filter(l => (l.kind === 'depends' || l.kind === 'reports') && l.from === a.terminal);
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
    `[ORCA] ${nameOf(up)} finished a job you depend on. ${who} approved handing it to you.`,
    h.ask ? `It was asked: ${h.ask}` : '',
    h.said ? `Its result: ${h.said}` : '',
    note ? `Note from ${who}: ${note}` : '',
    `Full output: operio-orca-send --last ${nameOf(up)} · ask it something: operio-orca-send ${nameOf(up)} "…"`,
    'Continue your work with this.',
  ].filter(Boolean).join('\n');
}

// One link between two live agents (a = from, b = to). Checks the rules, stores it, and tells both
// agents what they can now do (queued until each is idle; skipped when the pair was already linked).
function addLink(kind, a, b, { by, intro = true, agents }) {
  if (a.terminal === b.terminal) throw new HttpError(400, 'link_self');
  const existing = pairOf(a.terminal, b.terminal);
  if (existing.some(l => l.kind === kind && (kind === 'talk' || l.from === a.terminal))) throw new HttpError(409, 'link_exists');
  if (kind === 'depends' && makesCycle(a.terminal, b.terminal)) throw new HttpError(409, 'link_cycle');
  if (kind === 'reports') { const err = reportsError(state.links, a.terminal, b.terminal); if (err) throw new HttpError(409, err); }
  const l = { id: newId(), kind, from: a.terminal, to: b.terminal, at: Date.now(), by };
  state.links.push(l);
  saveState();
  log('link.add', { id: l.id, kind, from: a.pane, to: b.pane });
  if (intro && (!existing.length || kind === 'reports')) { // a reporting line is a new role: always say so
    const byTerminal = new Map(agents.map(x => [x.terminal, x]));
    const [ra, rb] = kind === 'talk' ? ['talk', 'talk'] : kind === 'reports' ? ['lead', 'member'] : ['upstream', 'downstream'];
    queueMsg({ from: b.terminal, to: a.terminal, text: introText(a, b, ra), via: 'intro' }, byTerminal);
    queueMsg({ from: a.terminal, to: b.terminal, text: introText(b, a, rb), via: 'intro' }, byTerminal);
  }
  return l;
}

// Saved agents with a lead: when both run, link them (once per start). A rule clash (e.g. someone
// already linked the member to another lead by hand) is logged once and left as a person made it.
const teamSkipped = new Set();
function linkProfileTeams(agents) {
  const byProfile = new Map();
  for (const a of agents) { const i = state.instances[a.terminal]; if (i && i.type !== 'worker') byProfile.set(i.profile, a); }
  const byTerminal = new Map(agents.map(a => [a.terminal, a]));
  for (const a of agents) {
    const i = state.instances[a.terminal];
    const lead = i?.leadTerminal ? byTerminal.get(i.leadTerminal) : i?.lead && i.type !== 'worker' && byProfile.get(i.lead);
    if (!lead || state.links.some(l => l.kind === 'reports' && l.from === a.terminal && l.to === lead.terminal)) continue;
    const key = a.terminal + '>' + lead.terminal;
    if (teamSkipped.has(key)) continue;
    try { addLink('reports', a, lead, { by: 'orca', agents, intro: i.type !== 'worker' }); jr(null, 'link.add', a, { kind: 'reports', to: jAgent(lead), auto: true }); }
    catch (e) { teamSkipped.add(key); log('profile.team_skipped', { member: a.pane, lead: lead.pane, code: e.code }); }
  }
}

// ─── Workers: temporary agents that do one task, report and close ─────────────
// A worker starts with its task (first message). It is done when it goes back to waiting after
// working on that task, or when its time is up. Its final reply goes to its lead as a message
// (no approval needed: the lead asked for it, or a person started it for that lead), or to the
// person who started it; then ORCA closes it. Hard cap: MAX_WORKERS live at once.
const MAX_WORKERS = Number(process.env.HERDR_WEB_MAX_WORKERS || 6);
const SPAWN_TTL = 3600e3;
state.spawns = state.spawns || [];      // { id, lead: terminal, profile, task, at, state: pending|started|denied|expired }
const finishing = new Set();
const liveWorkers = () => Object.values(state.instances).filter(i => i.type === 'worker').length;

function sweepWorkers(agents) {
  const now = Date.now();
  for (const a of agents) {
    const i = state.instances[a.terminal];
    if (i?.type !== 'worker' || finishing.has(a.terminal)) continue;
    if (i.taskSentAt && a.status === 'working' && !i.sawWork) { i.sawWork = true; saveState(); }
    const done = i.taskSentAt && now - i.taskSentAt > 8000 && (a.status === 'done' || (a.status === 'idle' && i.sawWork));
    if (done) finishWorker(a, 'done');
    else if (i.until && now > i.until) finishWorker(a, 'timeout');
  }
}

// The worker's last reply: the session transcript (exact text), else the screen.
async function workerResult(a) {
  try {
    const say = agentTranscript(a)?.blocks?.filter(b => b.t === 'say').at(-1);
    if (say?.text) return say.text;
  } catch { /* fall back to the screen */ }
  try { return summarizeTurn(await herdr(['agent', 'read', a.pane, '--source', 'recent', '--lines', '300', '--format', 'text'])).said || ''; } catch { return ''; }
}

async function finishWorker(a, reason) {
  finishing.add(a.terminal);
  const i = state.instances[a.terminal];
  try {
    if (reason === 'timeout' && a.status === 'working') { await herdr(['agent', 'send-keys', a.pane, 'esc']).catch(() => {}); await sleep(1500); }
    const said = (await workerResult(a)).slice(0, 3800);
    const agents = await listAgents();
    const lead = i.leadTerminal && agents.find(x => x.terminal === i.leadTerminal);
    // The result starts on the first line: panels show a message's first line in lists.
    const head = reason === 'timeout' ? `[ORCA] Worker ${nameOf(a)} ran out of time (${i.minutes} min). Last reply:` : `[ORCA] Worker ${nameOf(a)} finished. Result:`;
    const text = `${head} ${said || '(no text reply)'}\n\nThe task was: ${i.task.slice(0, 300)}`;
    if (lead) {
      state.msgs.push({ id: newId(), from: a.terminal, fromName: nameOf(a), to: lead.terminal, text, at: Date.now(), via: 'handoff', state: 'queued' });
      mirrorToChat(state.msgs.at(-1), new Map(agents.map(x => [x.terminal, x])));
      saveState();
    } else {
      pushAll({ name: nameOf(a), body: (reason === 'timeout' ? '⏱ ' : '✓ ') + (said || i.task).replace(/\s+/g, ' ').slice(0, 140), tag: 'worker-' + a.terminal, url: '/journal.html', kind: 'done' }, i.by && i.by !== 'local' ? i.by : null).catch(() => {});
    }
    jr(null, 'worker.end', a, { reason, profile: i.profile, task: i.task.slice(0, 300), said: said.slice(0, 1500), to: lead ? jAgent(lead) : undefined, ranFor: Date.now() - i.at });
    await endAgent(a, 'orca', { quiet: true });
    if (lead) deliverQueued(agents).catch(() => {});
  } catch (e) {
    log('worker.finish_failed', { pane: a.pane, reason, detail: e.detail || e.message });
    if (i) i.until = Date.now() + 10 * 60e3; // try again later rather than every poll
  } finally { finishing.delete(a.terminal); }
}

function expireSpawns() {
  let changed = false;
  for (const r of state.spawns) if (r.state === 'pending' && Date.now() - r.at > SPAWN_TTL) { r.state = 'expired'; changed = true; queueMsgSafe(r.lead, `[ORCA] Your request for a ${r.profile} worker expired: nobody approved it within an hour. Ask again only if it still matters.`); }
  const before = state.spawns.length;
  state.spawns = state.spawns.filter(r => r.state === 'pending' || Date.now() - r.at < 864e5).slice(-100);
  if (changed || state.spawns.length !== before) saveState();
}
function queueMsgSafe(to, text) { try { queueMsg({ from: to, to, text, via: 'intro' }); } catch { /* best effort */ } }
// Who may approve a worker a lead asked for: the person holding the lead, else any admin.
const canApproveSpawn = (login, r) => { const h = holderLogin(r.lead); return h ? h === login : isAdmin(login); };
// Web browser approvals (forms level): an agent's click / Enter / submit waits here for a person.
// In memory only: after a restart the agent's proxy hears "gone" and sends nothing.
const BROWSER_ASK_TTL = 15 * 60e3;
const browserAsks = new Map(); // id -> { id, terminal, pane, name, tool, element, real, key, url, title, fields, shot, at, state }
function browserAsksFor(login, agents) {
  const live = new Set(agents.map(a => a.terminal));
  const out = [];
  for (const r of browserAsks.values()) {
    if (r.state === 'pending' && Date.now() - r.at > BROWSER_ASK_TTL) r.state = 'expired';
    if (r.state !== 'pending' && Date.now() - r.at > BROWSER_ASK_TTL + 10 * 60e3) { browserAsks.delete(r.id); continue; }
    if (r.state !== 'pending' || !live.has(r.terminal) || !canApproveSpawn(login, { lead: r.terminal })) continue;
    const { shot, terminal, ...view } = r;
    out.push({ ...view, hasShot: !!shot });
  }
  return out.sort((x, y) => x.at - y.at);
}

function introText(me, other, relation) {
  const rel = {
    upstream: `${nameOf(other)} depends on your work: when you finish a job, a person may hand your result to it.`,
    downstream: `You depend on ${nameOf(other)}: when it finishes a job, a person may hand its result to you.`,
    talk: `You and ${nameOf(other)} can message each other.`,
    lead: `You report to ${nameOf(other)}: send it your results and questions; when you finish a job, a person may hand your result to it.`,
    member: `${nameOf(other)} reports to you: when it finishes a job, a person may hand its result to you, and you can give it work.`,
  }[relation];
  return `[ORCA] You are now linked with agent ${nameOf(other)}. ${rel}\nMessage it: operio-orca-send ${nameOf(other)} "…" · its latest output: operio-orca-send --last ${nameOf(other)} · your links: operio-orca-send --list\nOnly message it when it helps the work — never just to acknowledge. No reply needed to this note.`;
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
  return { links, handoffs, msgs, talk: talkView(state.msgs, byTerminal, day) };
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

// ─── Agent socket: what `operio-orca-send` talks to ─────────────────────────────────
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
  // Not a Claude session we know: match the pane's shell. A pane keeps its shell for life, so
  // it is asked once per pane (one process start each), not once per pane per call.
  for (const [pane, sp] of shellPids) if (!procs.has(sp) || !agents.some(a => a.pane === pane)) shellPids.delete(pane);
  for (const a of agents) { const sp = shellPids.get(a.pane); if (sp && chain.has(sp)) return { me: a, agents }; }
  for (const a of agents) {
    if (shellPids.has(a.pane)) continue;
    try {
      const sp = (await herdrJson(['pane', 'process-info', '--pane', a.pane])).result?.process_info?.shell_pid;
      if (sp) shellPids.set(a.pane, sp);
      if (sp && chain.has(sp)) return { me: a, agents };
    } catch { /* pane closed mid-read */ }
  }
  return null;
}
const shellPids = new Map(); // pane -> its shell's pid
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
    const relation = l.kind === 'talk' ? 'talks with' : l.kind === 'reports' ? (l.from === me.terminal ? 'your lead' : 'reports to you')
      : l.to === me.terminal ? 'you depend on it' : 'depends on you';
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

    // Which Knowledge collections this agent may search (`operio-orca kb search` asks first).
    if (req.method === 'GET' && url.pathname === '/kb-scope') return reply(200, { me: { name: nameOf(me), pane: me.pane }, ...kbScope(me) });

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

    // A lead asks for a temporary worker; a person approves it in ORCA first.
    if (req.method === 'POST' && url.pathname === '/spawn') {
      const mine = state.instances[me.terminal];
      if (!mine || mine.type !== 'agent') throw new HttpError(403, 'spawn_not_allowed');
      const lp = profiles.get(mine.profile);
      const want = String(body.profile || '');
      if (!lp?.spawn.profiles.includes(want) || profiles.get(want)?.type !== 'worker') throw new HttpError(403, 'spawn_not_allowed');
      const task = String(body.text || '').trim();
      if (!task) throw new HttpError(400, 'empty');
      if (task.length > 4000) throw new HttpError(400, 'too_long');
      const open = state.spawns.filter(r => r.lead === me.terminal && r.state === 'pending').length
        + Object.values(state.instances).filter(i => i.type === 'worker' && i.leadTerminal === me.terminal).length;
      if (open >= lp.spawn.max) throw new HttpError(429, 'spawn_limit');
      const r = { id: newId(), lead: me.terminal, profile: want, task, at: Date.now(), state: 'pending' };
      state.spawns.push(r); saveState();
      const holder = holderLogin(me.terminal);
      pushAll({ name: nameOf(me), body: `wants a ${want} worker: ${task.replace(/\s+/g, ' ').slice(0, 120)}`, tag: 'spawn-' + r.id, url: '/#spawn', kind: 'blocked' }, holder).catch(() => {});
      jr(null, 'spawn.request', me, { profile: want, task: task.slice(0, 300) });
      return reply(200, { ok: true, pending: true });
    }
    // Web browser (forms level): ask a person before a submit; the proxy polls for the answer.
    if (req.method === 'POST' && url.pathname === '/browser/ask') {
      if (CFG.HOSTED || browser.read().level !== 'forms') throw new HttpError(403, 'forms_off');
      if ([...browserAsks.values()].filter(r => r.terminal === me.terminal && r.state === 'pending').length >= 3) throw new HttpError(429, 'too_many');
      const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001F]/g, ' ').slice(0, n);
      let shot = body.shot ? path.resolve(String(body.shot)) : null;
      if (shot && (!shot.startsWith(path.join(STATE_DIR) + path.sep) || !/\.png$/.test(shot) || !fs.existsSync(shot))) shot = null;
      const r = {
        id: newId(), terminal: me.terminal, pane: me.pane, name: nameOf(me), at: Date.now(), state: 'pending',
        tool: str(body.tool, 40).replace(/^browser_/, ''), element: str(body.element, 200), real: body.real ? str(body.real, 200) : null,
        key: body.key ? str(body.key, 30) : null, url: str(body.url, 500), title: str(body.title, 200), shot,
        fields: (Array.isArray(body.fields) ? body.fields : []).slice(0, 30).map(f => ({ label: str(f.label, 120), value: f.hidden ? '••••••' : str(f.value, 500), hidden: !!f.hidden })),
      };
      browserAsks.set(r.id, r);
      const holder = holderLogin(me.terminal);
      pushAll({ name: nameOf(me), body: `wants to ${r.tool === 'click' ? `click ${r.real || r.element || 'a button'}` : 'send a form'} on ${r.url.replace(/^https?:\/\//, '').slice(0, 80)}`, tag: 'browser-' + r.id, url: '/#browser', kind: 'blocked' }, holder).catch(() => {});
      jr(null, 'browser.ask', me, { tool: r.tool, url: r.url, element: r.real || r.element, fields: r.fields.length });
      return reply(200, { id: r.id });
    }
    if (req.method === 'GET' && url.pathname === '/browser/ask') {
      const r = browserAsks.get(String(url.searchParams.get('id') || ''));
      if (!r || r.terminal !== me.terminal) throw new HttpError(404, 'gone');
      if (r.state === 'pending' && Date.now() - r.at > BROWSER_ASK_TTL) r.state = 'expired';
      return reply(200, { state: r.state });
    }
    if (req.method === 'POST' && url.pathname === '/browser/ask-expire') {
      const r = browserAsks.get(String(body.id || ''));
      if (r && r.terminal === me.terminal && r.state === 'pending') { r.state = 'expired'; jr(null, 'browser.expired', me, { tool: r.tool, url: r.url }); }
      return reply(200, { ok: true });
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
      jr(null, 'msg.agent', me, { to: jAgent(other), text: text.slice(0, 1500) });
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
function accessView(login = 'local') {
  return { admin: canAct(login), folders: null, shell: shellAccess() };
}
// ─── Terminal: mirror a pane into xterm.js in the browser ─────────────────────
// herdr can't attach a browser PTY to a plain shell, so ORCA sends the screen as ANSI and
// relays keystrokes. Shells only; typing into agents stays the panel's job.
// Pane size changes rarely; the screen every poll. Size is cached 1.5 s so a poll is one herdr call.
const termSize = new Map(); // pane -> { at, cols, rows }
async function termScreen(pane) {
  const hit = termSize.get(pane);
  if (hit && Date.now() - hit.at < 1500) {
    let text = '';
    try { text = await herdr(['pane', 'read', pane, '--source', 'visible', '--format', 'ansi']); } catch { /* transient */ }
    return { text, cols: hit.cols, rows: hit.rows };
  }
  const out = await termScreenFull(pane);
  termSize.set(pane, { at: Date.now(), cols: out.cols, rows: out.rows });
  return out;
}
async function termScreenFull(pane) {
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

// ─── Journal API: timeline, saved output, export, daily review ────────────────
const GROUPS = {
  lifecycle: ['agent.new', 'agent.end', 'agent.gone', 'agent.stop', 'agent.move', 'agent.rename', 'agent.claim', 'agent.tags', 'agent.model', 'shell.new'],
  work: ['browser.open', 'agent.prompt', 'chat.prompt', 'agent.answer', 'agent.keys', 'agent.job', 'agent.blocked'],
  coordination: ['worker.end', 'spawn.request', 'spawn.approve', 'spawn.deny', 'profile.save', 'profile.delete', 'account.add', 'account.key', 'account.rename', 'account.remove', 'link.add', 'link.delete', 'handoff.send', 'handoff.dismiss', 'msg.agent', 'msg.rate_limited'],
  security: ['browser.ask', 'browser.approve', 'browser.decline', 'browser.expired', 'browser.level', 'browser.blocked', 'browser.refused', 'browser.on', 'browser.off', 'browser.reset', 'tool.save', 'tool.remove', 'secret.set', 'shell.open', 'shell.close', 'shell.unlock', 'shell.lock', 'access.denied'],
  errors: ['error'],
};
const groupOf = ev => Object.keys(GROUPS).find(g => GROUPS[g].includes(ev)) || 'other';
const brief = l => { const p = person(l); return { id: p.id, name: p.name, slot: p.slot }; };
function shapeEntry(e) {
  const { who, holder, ...rest } = e;
  return { ...rest, group: groupOf(e.event), who: who ? brief(who) : null };
}
// One line of plain English per entry (the export and the search).
function describe(e) {
  const who = e.who ? person(e.who).name : 'ORCA';
  const ag = e.agent ? (e.agent.name || e.agent.pane || '?') : '';
  const to = e.to ? (e.to.name || e.to.pane || '?') : '';
  const min = ms => (ms == null ? '' : ` after ${Math.max(1, Math.round(ms / 60e3))} min`);
  switch (e.event) {
    case 'agent.new': return `${who} ${e.resume ? 'resumed' : 'started'} ${ag} (${e.kind}${e.profile ? `, saved agent ${e.profile} v${e.rev}` : ''}) in ${e.agent?.cwd || '?'}`;
    case 'profile.save': return `${who} saved the agent setup ${e.profile} v${e.rev} (${e.kind}, ${e.skills} skill(s), tools ${e.tools})`;
    case 'profile.delete': return `${who} deleted the agent setup ${e.profile}`;
    case 'account.add': return `${who} added the ${e.kind} account “${e.label}”`;
    case 'worker.end': return `Worker ${ag} ${e.reason === 'timeout' ? 'ran out of time' : 'finished'}${e.to ? ` and reported to ${e.to.name || e.to.pane}` : ''}: ${e.said || '(no text)'}`;
    case 'spawn.request': return `${ag} asked for a ${e.profile} worker: ${e.task}`;
    case 'spawn.approve': return `${who} approved ${ag}'s request: worker ${e.worker} started`;
    case 'spawn.deny': return `${who} declined ${ag}'s request for a ${e.profile} worker`;
    case 'tool.save': return `${who} saved the ${e.type} tool ${e.tool}`;
    case 'tool.remove': return `${who} removed the tool ${e.tool}`;
    case 'secret.set': return `${who} ${e.cleared ? 'cleared' : 'set'} the secret ${e.name}`;
    case 'account.key': return `${who} set the API key of the ${e.kind} account “${e.label}”`;
    case 'account.rename': return `${who} renamed a ${e.kind} account to “${e.label}”`;
    case 'account.remove': return `${who} removed the ${e.kind} account “${e.label}”`;
    case 'shell.new': return `${who} opened a new shell ${ag} in ${e.agent?.cwd || '?'}`;
    case 'agent.end': return `${who} ended ${ag} (${e.mode})${min(e.ranFor)}${e.said ? ` — last reply: ${e.said}` : ''}`;
    case 'agent.gone': return `${ag} exited on its own${min(e.ranFor)}`;
    case 'agent.stop': return `${who} stopped ${ag} (${e.how})`;
    case 'agent.move': return `${who} moved ${ag} (${e.mode})`;
    case 'agent.rename': return `${who} renamed ${e.was || ag} to ${e.name || '(no name)'}`;
    case 'agent.claim': return `${who} ${{ claim: 'claimed', release: 'released', take: 'took over', assign: 'assigned' }[e.mode] || e.mode} ${ag}${e.to ? ` to ${e.to}` : ''}`;
    case 'agent.tags': return `${who} tagged ${ag}: ${(e.tags || []).join(', ') || '(none)'}`;
    case 'agent.model': return `${who} switched ${ag} to ${e.model}`;
    case 'agent.prompt': return `${who} → ${ag}: ${e.text}`;
    case 'chat.prompt': return `${who} → ${ag} (team chat): ${e.text}`;
    case 'chat.prompt': return `${who} → ${ag} (team chat): ${e.text}`;
    case 'agent.answer': return `${who} answered ${ag}${e.question ? ` “${e.question}”` : ''}: ${(e.picked || []).join(' / ')}`;
    case 'agent.keys': return `${who} pressed ${e.key} on ${ag}`;
    case 'agent.job': return `${ag} finished a job${e.secs != null ? ` (${Math.max(1, Math.round(e.secs / 60))} min)` : ''}${e.ask ? ` — asked: ${e.ask}` : ''}${e.said ? ` — reply: ${e.said}` : ''}`;
    case 'agent.blocked': return `${ag} needs you${e.title ? `: ${e.title}` : ''}`;
    case 'link.add': return `${who} linked ${ag} → ${to} (${e.kind})`;
    case 'link.delete': return `${who} removed the link ${ag} → ${to}`;
    case 'handoff.send': return `${who} handed ${ag}'s result to ${to}${e.note ? ` — note: ${e.note}` : ''}`;
    case 'handoff.dismiss': return `${who} dismissed the hand-off ${ag} → ${to}`;
    case 'msg.agent': return `${ag} messaged ${to}: ${e.text}`;
    case 'template.save': return `${who} ${e.update ? 'edited' : 'added'} a ${e.scope} prompt template “${e.title}”`;
    case 'template.delete': return `${who} deleted a ${e.scope} prompt template`;
    case 'skill.install': return `${who} installed the skill ${e.key} v${e.version}`;
    case 'skill.remove': return `${who} removed the skill ${e.key}`;
    case 'kb.add': return `${who} ${e.replaced ? 'replaced' : 'added'} the document ${e.path} (${e.bytes} bytes) in Knowledge`;
    case 'kb.remove': return `${who} removed the document ${e.path} from Knowledge`;
    case 'kb.access': return e.agents || e.tags ? `${who} limited the Knowledge folder ${e.collection} to ${e.agents} agent name(s) and ${e.tags} tag(s)` : `${who} opened the Knowledge folder ${e.collection} to all agents`;
    case 'msg.rate_limited': return `Link ${ag} ↔ ${to} paused (over ${e.perHour} messages/hour)`;
    case 'shell.open': return `${who} opened the shell ${ag || e.agent?.pane || ''}`;
    case 'shell.close': return `${who} closed the shell ${ag || e.agent?.pane || ''}`;
    case 'shell.unlock': return `${who} allowed shells for ${e.minutes} min`;
    case 'shell.lock': return `${who} locked shells again`;
    case 'access.denied': return `${who} was refused (${e.code})${ag ? ` on ${ag}` : ''} ${e.path || ''}`.trim();
    case 'error': return `Error ${e.code} on ${e.path} ×${e.n}`;
    case 'browser.open': return `${ag || 'An agent'} opened ${e.url} in the web browser`;
    case 'browser.blocked': return `${ag || 'An agent'} tried to open ${e.url}; ORCA refused (${e.reason})`;
    case 'browser.refused': return `${ag || 'An agent'} asked the web browser for ${e.tool}; ORCA refused (read only)`;
    case 'browser.ask': return `${ag || 'An agent'} asked to ${e.tool} ${e.element || ''} on ${e.url}`;
    case 'browser.approve': return `${who} approved ${ag}'s ${e.tool} on ${e.url}`;
    case 'browser.decline': return `${who} declined ${ag}'s ${e.tool} on ${e.url}`;
    case 'browser.expired': return `${ag}'s ${e.tool} on ${e.url} was not answered in time; nothing was sent`;
    case 'browser.level': return `${who} set the web browser to ${e.level === 'forms' ? 'form filling (each submit needs approval)' : 'read only'}`;
    case 'browser.on': return `The web browser was turned on (${e.level === 'forms' ? 'form filling' : 'read only'})`;
    case 'browser.off': return 'The web browser was turned off';
    case 'browser.reset': return 'The web browser profile was wiped';
    default: return `${who} ${e.event}${ag ? ` ${ag}` : ''}`;
  }
}

let toReview = 0;
function countToReview() {
  try { toReview = journal.listDigests().filter(d => d.final && !d.reviewed && (d.agents.length || d.counts.prompts || d.counts.security)).length; } catch { /* first run */ }
}
const nameOfWho = l => person(l).name;
function digestFor(day) {
  if (day === journal.dayOf()) return journal.buildDigest(day, nameOfWho); // today: always live
  return journal.readDigest(day) || journal.buildDigest(day, nameOfWho);
}

async function journalApi(req, res, url) {
  const { pathname } = url;
  const q = k => url.searchParams.get(k) || '';
  const today = journal.dayOf();

  if (req.method === 'GET' && pathname === '/api/journal') {
    const day = journal.DAY_RE.test(q('day')) ? q('day') : today;
    const span = Math.min(Math.max(Number(q('days')) || 1, 1), 31); // days back from `day`, for an agent's history
    let raw = [];
    for (let i = 0; i < span; i++) raw = raw.concat(journal.readDay(journal.addDays(day, -i)));
    const visible = raw.map(shapeEntry);
    const people = new Map(), agentsSeen = new Map();
    for (const e of visible) {
      if (e.who) people.set(e.who.id, e.who);
      for (const a of [e.agent, e.to]) if (a?.terminal || a?.pane) agentsSeen.set(a.terminal || a.pane, { key: a.terminal || a.pane, name: a.name || a.pane });
    }
    const term = q('terminal'), whoId = q('who'), group = q('group'), text = q('q').toLowerCase().slice(0, 100);
    let list = visible.filter(e =>
      (!term || e.agent?.terminal === term || e.agent?.pane === term || e.to?.terminal === term) &&
      (!whoId || e.who?.id === whoId) &&
      (!group || e.group === group) &&
      (!text || (describe({ ...e, who: null }) + ' ' + (e.who?.name || '')).toLowerCase().includes(text)));
    const total = list.length;
    const limit = Math.min(Math.max(Number(q('limit')) || 500, 1), 2000);
    list = list.sort((a, b) => b.ts - a.ts).slice(0, limit);
    return send(res, 200, {
      day, days: journal.days(), today, total, limit,
      entries: list,
      people: [...people.values()], agents: [...agentsSeen.values()].sort((a, b) => a.name.localeCompare(b.name)),
      admin: true, me: brief(loginOf(req)), keepDays: CFG.JOURNAL_DAYS,
    });
  }

  if (req.method === 'GET' && pathname === '/api/journal/out') {
    const text = journal.readSnapshot(q('id'));
    if (text == null) throw new HttpError(404, 'gone');
    return send(res, 200, text, 'text/plain; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/api/journal/export') {
    const day = journal.DAY_RE.test(q('day')) ? q('day') : today;
    const entries = journal.readDay(day);
    const md = journal.digestMarkdown(digestFor(day)) + '\n---\n\n' + journal.dayMarkdown(day, entries, describe);
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="orca-journal-${day}.md"`, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
    return res.end(md);
  }

  if (req.method === 'GET' && pathname === '/api/journal/digests') {
    const stored = journal.listDigests().filter(d => d.day !== today);
    const live = journal.days().includes(today) ? [digestFor(today)] : [];
    const list = [...live, ...stored].map(d => ({ day: d.day, final: d.final, counts: d.counts, reviewed: d.reviewed, agents: d.agents.length, people: d.people.map(p => p.name), generatedAt: d.generatedAt }));
    return send(res, 200, { digests: list, toReview, today });
  }
  if (req.method === 'GET' && pathname === '/api/journal/digest') {
    const day = q('day');
    if (!journal.DAY_RE.test(day)) throw new HttpError(400, 'bad_request');
    return send(res, 200, digestFor(day));
  }
  // Mark a finished day reviewed (or reopen it). Writes pass the server's same-origin check.
  if (req.method === 'POST' && pathname === '/api/journal/review') {
    const body = await readBody(req);
    const day = String(body.day || '');
    if (!journal.DAY_RE.test(day)) throw new HttpError(400, 'bad_request');
    if (day >= today) throw new HttpError(409, 'not_final');
    if (!journal.readDigest(day)) journal.saveDigest(journal.buildDigest(day, nameOfWho));
    const d = journal.review(day, body.undo ? null : person(loginOf(req)).name, String(body.note || '').slice(0, 500));
    if (!d) throw new HttpError(404, 'gone');
    jr(req, body.undo ? 'journal.unreview' : 'journal.review', null, { day });
    countToReview();
    return send(res, 200, { ok: true, reviewed: d.reviewed, toReview });
  }
  throw new HttpError(404, 'not_found');
}

// Today's digest is refreshed every 5 min; past days are finalised (and old files compressed
// or deleted) at start and on the first tick after midnight. A server down at midnight
// catches up on the next start.
let lastHousekeep = '';
function journalTick() {
  const today = journal.dayOf();
  try {
    if (today !== lastHousekeep) { journal.housekeep(nameOfWho); lastHousekeep = today; }
    if (journal.days().includes(today)) journal.saveDigest(journal.buildDigest(today, nameOfWho));
  } catch (e) { log('journal.tick_failed', { detail: e.message }); }
  countToReview();
}
setTimeout(journalTick, 3000).unref();
setInterval(journalTick, 5 * 60e3).unref();

// ─── Team chat API (ORCA Host only) ─────────────────────────────────────────────
// Who wrote it = the panel's person (one "you" on a single-user panel; ORCA Host passes each
// signed-in person). Everyone who reaches the panel can act on every agent, so every agent's
// thread is open to them; threads of agents that ended stay readable until the 90-day prune.
// The access seams below (canSeeAgent, requireActOn, isAdmin) are where roles plug in.
const chatWho = login => login || 'local';
const isAdmin = login => canAct(login);
const canSeeAgent = () => true;
async function requireActOn(login) { if (!canAct(login)) throw new HttpError(403, 'read_only'); }
function chatView(login, agents) {
  if (!chat || !chatAllowed(login)) return null;
  const seen = agents.filter(a => a.terminal && canSeeAgent(login, a));
  const s = chat.summary(chatWho(login), ['room', ...seen.map(a => 't-' + a.terminal)]);
  const byPane = {};
  for (const a of seen) { const x = s['t-' + a.terminal]; if (x?.n) byPane[a.pane] = x; }
  return { room: s.room, byPane, translate: translator.enabled };
}
async function chatThread(login, id, write) {
  if (!chat.valid(id)) throw new HttpError(400, 'bad_request');
  if (id === 'room') return { id, kind: 'room', live: true };
  const a = (await listAgents()).find(x => x.terminal === id.slice(2));
  // Seeing an agent is enough to read and comment on its thread; sending it work is checked per @agent.
  if (a) { if (!canSeeAgent(login, a)) throw new HttpError(404, 'gone'); return { id, kind: 'agent', live: true, pane: a.pane, name: a.name, agent: a.agent }; }
  if (!isAdmin(login)) throw new HttpError(404, 'gone');
  if (write) throw new HttpError(409, 'ended');
  return { id, kind: 'agent', live: false, pane: null, name: null };
}
function shapeChat(m, who) {
  const agent = isAgentBy(m.by);
  const x = m.x || {};
  return {
    id: m.id, at: m.at, who: agent ? { id: m.by, name: x.name || 'agent', agent: true } : brief(m.by), mine: m.by === who,
    text: m.deleted || x.empty ? '' : m.text, deleted: !!m.deleted, lang: m.deleted || x.empty ? null : detectLang(m.text),
    mentionsMe: m.mentions.includes(who), canDelete: !m.deleted && m.by === who && Date.now() - m.at < chat.DELETE_WINDOW,
    ...(agent && !x.a2a ? { answer: { to: x.ask || null, took: x.took ?? null, out: x.out || null, empty: !!x.empty } } : {}),
    ...(x.a2a ? { a2a: { from: x.a2a.from, to: x.a2a.to, dir: x.a2a.dir, via: x.a2a.via } } : {}),
  };
}
const chatRate = new Map(); // login -> recent post times (max 20 a minute)
const trRate = new Map();   // login -> recent translation requests (max 60 a minute)
const chatViewing = new Map(); // login -> { id, at }: the thread open on a visible page (polled every 2 s)
const isViewing = (login, id) => { const v = chatViewing.get(login); return !!v && v.id === id && Date.now() - v.at < 7000; };
function chatHolder(thread) {
  if (thread.kind !== 'agent') return null;
  return holderLogin(thread.id.slice(2));
}
function notifyChat(thread, msg) {
  const holder = chatHolder(thread);
  const to = chat.recipients(thread.id, msg, { holder }).filter(r => !isViewing(r.login, thread.id) && chatAllowed(r.login));
  const text = msg.text.replace(/\s+/g, ' ').slice(0, 140);
  for (const r of to) {
    pushAll({ kind: r.kind, name: person(msg.by).name, where: thread.name || 'agent', room: thread.id === 'room', text,
      tag: 'chat-' + thread.id, url: '/#chat-' + encodeURIComponent(thread.id), thread: thread.id }, r.login, true).catch(() => {});
  }
  if (to.length) log('chat.notify', { thread: thread.id, to: to.length });
}
// ── @agent: a chat message sent to an agent as a prompt, its answer posted back.
// Limits per person/agent per hour and a queue per agent.
const ASK = {
  perPerson: CFG.CHAT_ASKS_PERSON,
  perAgent: CFG.CHAT_ASKS_AGENT,
  queueMax: CFG.CHAT_QUEUE,
  queueTtl: 2 * 3600e3,   // queued this long without the agent going idle → expired
  peek: 8e3,              // sent, agent idle, no turn seen (shorter than a poll) → read the screen
  noAnswer: 90e3,         // … and give up after this long
  replyMax: 2000,
};
const ASK_HEAD = '[ORCA team chat';
const CHIP_ROW = /^\s*(\[ [^\]]+ \]\s*)+$/;
const isAgentBy = by => typeof by === 'string' && by.startsWith('agent:');
const chatName = (by, m) => (isAgentBy(by) ? m?.x?.name || 'agent' : person(by).name);
const askInFlight = terminal => !!chat && chat.asksWhere(k => k.terminal === terminal && k.state === 'sent').length > 0;
// Named live agents this person can see, as mention targets (a person's name wins a clash).
function agentTargets(login, agents) {
  const names = new Set(PEOPLE_LOGINS().map(l => person(l).name.toLowerCase()));
  return agents.filter(a => a.name && a.terminal && !names.has(a.name.toLowerCase()) && canSeeAgent(login, a))
    .map(a => ({ login: a.terminal, name: a.name, a }));
}
async function queueAsks(login, who, thread, msg, text) {
  const agents = await listAgents();
  const targets = agentTargets(login, agents);
  const hit = findMentions(text, targets);
  const out = [];
  for (const terminal of hit.slice(0, 3)) {
    const { a } = targets.find(x => x.login === terminal);
    try { await requireActOn(login, a.pane); } catch { out.push({ name: a.name, state: 'refused', reason: 'no_access' }); continue; }
    const reason = chat.askAllowed(who, terminal, ASK);
    if (reason) { out.push({ name: a.name, state: 'refused', reason }); continue; }
    const own = thread.id === 't-' + terminal;
    const where = own ? null : thread.id === 'room' ? 'the team room' : `the thread of agent "${thread.name || 'another agent'}"`;
    const prompt = buildPrompt({
      from: person(who).name, agentName: a.name, where, text: msg.text, replyMax: ASK.replyMax,
      context: chat.contextFor(thread.id, msg.id, { max: 6, chars: 1500, nameOf: chatName }),
    });
    const k = chat.addAsk({ thread: thread.id, msgId: msg.id, by: who, terminal, name: a.name, prompt });
    log('chat.ask', { thread: thread.id, to: a.pane });
    out.push({ name: a.name, state: 'queued', id: k.id });
  }
  if (out.some(x => x.state === 'queued')) deliverAsks(agents).catch(e => log('chat.deliver_error', { detail: e.detail || e.message }));
  return out;
}
let askDelivering = false;
async function deliverAsks(agents) {
  if (!chat || askDelivering || delivering) return; // link messages go first; the next poll retries
  askDelivering = true;
  try { await deliverAsksNow(agents); } finally { askDelivering = false; }
}
async function deliverAsksNow(agents) {
  const now = Date.now();
  const byTerminal = new Map(agents.map(a => [a.terminal, a]));
  const gone = t => !byTerminal.has(t) && !lastLive.has(t);
  // In flight: the agent ended, or finished without a turn we saw.
  for (const k of chat.asksWhere(x => x.state === 'sent')) {
    const a = byTerminal.get(k.terminal);
    if (gone(k.terminal)) { failAsk(k, 'gone'); continue; }
    if (!a || work.has(a.pane) || (a.status !== 'idle' && a.status !== 'done') || now - k.sentAt < ASK.peek) continue;
    let text = '';
    try { text = await herdr(['agent', 'read', a.pane, '--source', 'recent', '--lines', '300', '--format', 'text']); } catch { /* full-screen agent */ }
    if (k.state !== 'sent') continue; // the job log answered it meanwhile
    if (!answerAsk(a, text, { from: k.sentAt, end: now, out: null }) && now - k.sentAt > ASK.noAnswer) failAsk(k, 'no_answer');
  }
  for (const k of chat.nextAsks()) {
    const a = byTerminal.get(k.terminal);
    if (gone(k.terminal)) { failAsk(k, 'gone'); continue; }
    if (!a || a.status !== 'idle' && a.status !== 'done' || work.has(a.pane)) {
      if (now - k.at > ASK.queueTtl) failAsk(k, 'expired');
      continue;
    }
    if ((sentAsk.get(a.terminal)?.at || 0) > now - 15e3) continue; // someone just sent it work
    try {
      await herdr(['agent', 'prompt', a.pane, k.prompt], 10000);
    } catch (e) {
      if (!['blocked', 'stalled', 'timeout'].includes(e.code)) failAsk(k, 'send_failed');
      log('chat.ask_failed', { pane: a.pane, code: e.code });
      continue;
    }
    const at = Date.now();
    const msg = chat.list(k.thread).find(m => m.id === k.msgId);
    chat.updateAsk(k.id, { state: 'sent', sentAt: at });
    sentAsk.set(a.terminal, { text: `${person(k.by).name} (chat): ${(msg?.text || '').replace(/\s+/g, ' ')}`, at });
    autoClaim(a.terminal, k.by);
    log('chat.ask_sent', { pane: a.pane, waited: Math.round((at - k.at) / 1000) });
    jr(k.by, 'chat.prompt', a, { text: msg?.text || '', thread: k.thread === 'room' ? 'room' : k.thread === 't-' + a.terminal ? 'own' : 'other' });
  }
}
function failAsk(k, reason) {
  chat.updateAsk(k.id, { state: 'failed', reason, endAt: Date.now() });
  log('chat.ask_' + reason, { thread: k.thread });
}
// A turn ended on an agent with a chat ask in flight: post its reply (the prose after our prompt).
// Returns true when an answer was posted.
function answerAsk(a, text, { from, end, out }) {
  if (!chat) return false;
  const k = chat.asksWhere(x => x.terminal === a.terminal && x.state === 'sent')[0];
  if (!k || k.sentAt > end) return false; // that turn ended before the ask went out
  // The reply after our prompt; a long turn may have scrolled the prompt off: then the turn's
  // last reply (only when it is a recorded turn, which started after the ask was sent).
  const raw = String(text || '').includes(ASK_HEAD) ? replyAfter(text, ASK_HEAD) : out ? turnReply(text) : '';
  // Drop the reply-chips row the ORCA mod prints under a reply ("[ Explain 1 · … ] [ Wrap up ]").
  const reply = cutReply(raw.split('\n').filter(l => !CHIP_ROW.test(l)).join('\n').trim(), ASK.replyMax);
  if (!reply) return false; // not readable yet (a busy screen, a partial read): the 8 s peek retries until 90 s
  let msg;
  try {
    msg = chat.post(k.thread, 'agent:' + a.terminal, reply, [], { name: a.name || k.name, ask: k.msgId, out: out || null, took: end - k.sentAt });
  } catch (e) { log('chat.answer_failed', { code: e.code }); return false; }
  chat.updateAsk(k.id, { state: 'done', endAt: Date.now(), answer: msg.id });
  log('chat.answer', { thread: k.thread, chars: reply.length });
  if (!isViewing(k.by, k.thread)) {
    pushAll({ kind: 'agentReply', name: a.name || k.name || 'agent', where: a.name || 'agent', room: k.thread === 'room',
      text: reply.replace(/\s+/g, ' ').slice(0, 140), tag: 'chat-' + k.thread, url: '/#chat-' + encodeURIComponent(k.thread), thread: k.thread }, k.by, true).catch(() => {});
  }
  return true;
}
function shapeAsks(id, who) {
  const day = Date.now() - 864e5;
  return chat.asksWhere(k => k.thread === id && k.at >= day).map(k => ({
    msg: k.msgId, name: k.name, state: k.state, reason: k.reason || null, mine: k.by === who,
    pos: k.state === 'queued' ? chat.queuePos(k) : null, answer: k.answer || null,
  }));
}

async function chatApi(req, res, url) {
  if (!chat || !chatAllowed(loginOf(req))) return send(res, 404, { error: 'not found' }); // the free panel has no chat
  const m = url.pathname.match(/^\/api\/chat\/([^/]+)(\/read|\/delete|\/follow|\/translate)?$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const login = loginOf(req);
  const who = chatWho(login);
  const id = decodeURIComponent(m[1]);
  if (req.method === 'GET' && !m[2]) {
    const thread = await chatThread(login, id, false);
    thread.following = chat.following(who, id, chatHolder(thread));
    if (url.searchParams.get('open') === '1') chatViewing.set(who, { id, at: Date.now() });
    const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
    return send(res, 200, { thread, messages: chat.list(id, { after }).map(x => shapeChat(x, who)), asks: shapeAsks(id, who), now: Date.now() });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) { log('write.denied', { path: url.pathname }); return send(res, 403, { error: 'cross-origin' }); }
  const body = await readBody(req);
  if (m[2] === '/read') {
    await chatThread(login, id, false);
    chat.markRead(who, id, Math.min(Number(body.at) || Date.now(), Date.now()));
    return send(res, 200, { ok: true });
  }
  if (m[2] === '/follow') {
    await chatThread(login, id, false);
    chat.setFollow(who, id, !!body.on);
    return send(res, 200, { ok: true, following: !!body.on });
  }
  if (m[2] === '/translate') {
    await chatThread(login, id, false);
    if (!translator.enabled) throw new HttpError(404, 'translate_off');
    const msg = chat.get(id, String(body.id || ''));
    if (!msg || msg.deleted || msg.x?.empty) throw new HttpError(404, 'not_found');
    const to = body.to === 'es' ? 'es' : 'en';
    const now = Date.now();
    const recent = (trRate.get(who) || []).filter(t => now - t < 60e3);
    if (recent.length >= 60) throw new HttpError(429, 'slow_down');
    recent.push(now); trRate.set(who, recent);
    try { return send(res, 200, { id: msg.id, to, ...(await translator.translate(msg.id, msg.text, to)) }); }
    catch (e) { throw new HttpError(e.code === 'translate_off' ? 404 : 502, e.code === 'translate_key' ? 'translate_key' : 'translate_failed'); }
  }
  if (m[2] === '/delete') {
    await chatThread(login, id, false);
    try { chat.remove(id, String(body.id || ''), who, false); }
    catch (e) { throw new HttpError(e.code === 'not_found' ? 404 : 403, e.code || 'bad_request'); }
    return send(res, 200, { ok: true });
  }
  const thread = await chatThread(login, id, true);
  const now = Date.now();
  const recent = (chatRate.get(who) || []).filter(t => now - t < 60e3);
  if (recent.length >= 20) throw new HttpError(429, 'slow_down');
  recent.push(now); chatRate.set(who, recent);
  const people = PEOPLE_LOGINS().filter(l => l !== TEAM && chatAllowed(l)).map(l => ({ login: l, name: person(l).name }));
  let msg;
  try { msg = chat.post(id, who, body.text, findMentions(body.text, people).filter(l => l !== who)); }
  catch (e) { throw new HttpError(400, e.code || 'bad_request'); }
  notifyChat(thread, msg);
  let asks = [];
  try { asks = await queueAsks(login, who, thread, msg, body.text); }
  catch (e) { log('chat.ask_error', { detail: e.detail || e.message }); }
  return send(res, 200, { ok: true, thread, message: shapeChat(msg, who), asks, askState: shapeAsks(id, who) });
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(req, res, url) {
  const { pathname } = url;
  if (pathname.startsWith('/api/chat/')) return chatApi(req, res, url);

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
        termSize.delete(pane);
        jr(req, body.on ? 'shell.open' : 'shell.close', agentCache.get(pane) || { pane }, {});
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
    jr(req, 'shell.unlock', null, { minutes: Math.round(SHELL_UNLOCK_MS / 60e3) });
    return send(res, 200, { ok: true, ...shellAccess() });
  }
  if (req.method === 'POST' && pathname === '/api/shell/lock') {
    shellUnlockedUntil = 0;
    log('shell.locked');
    jr(req, 'shell.lock', null, {});
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/templates') {
    const login = loginOf(req);
    return send(res, 200, templates.list(chatWho(login), { lang: url.searchParams.get('lang') === 'es' ? 'es' : 'en', admin: isAdmin(login) }));
  }

  // Admin page: what each section shows on this panel, plus People & access and security status.
  // Same sections in every ORCA; SAMIX (this panel) shows all of them, editable by admins.
  if (req.method === 'GET' && pathname === '/api/admin') {
    const login = loginOf(req);
    if (!canSetupAgents(login)) throw new HttpError(403, 'forbidden');
    // Same sections as every ORCA: free = one person (no People); hosted = people live in ORCA Host,
    // and logins/MCP tools are Operio's to set up.
    return send(res, 200, {
      edition: CFG.HOSTED ? 'hosted' : 'free', me: login || null,
      sections: { people: false, agents: true, accounts: canManageLogins(login), tools: canManageLogins(login), skills: true, knowledge: true, templates: true, routines: true, keys: canManageLogins(login), activity: true, security: true },
      security: { pushDevices: state.subs.length, hosted: CFG.HOSTED },
      counts: { tools: tools.list().length, profiles: profiles.list().length, accounts: accounts.list().filter(x => x.id !== 'default').length, skills: skills.list().length, docs: kb.list().length, routines: (() => { try { return loadRoutines().routines.length; } catch { return null; } })() },
    });
  }

  // The screenshot on a browser approval card (only to people who may answer it).
  if (req.method === 'GET' && pathname === '/api/browser/shot') {
    const r = browserAsks.get(String(url.searchParams.get('id') || ''));
    if (!r || !r.shot || !canApproveSpawn(loginOf(req), { lead: r.terminal })) throw new HttpError(404, 'not_found');
    let png;
    try { png = fs.readFileSync(r.shot); } catch { throw new HttpError(404, 'not_found'); }
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(png);
  }

  // Tools (admins): MCP servers saved agents can use, and which secrets they still need.
  if (req.method === 'GET' && pathname === '/api/tools') {
    if (!canManageLogins(loginOf(req))) throw new HttpError(403, 'forbidden');
    return send(res, 200, { browser: CFG.HOSTED ? null : browser.status(), tools: tools.view(), secrets: tools.secretNames(), usedBy: Object.fromEntries(tools.list().map(t => [t.id, profiles.list().filter(p => p.tools.mcp.includes(t.id)).map(p => p.id)])) });
  }

  // Accounts (admins): several logins per agent kind, with the command that signs each one in.
  if (req.method === 'GET' && pathname === '/api/accounts') {
    if (!canManageLogins(loginOf(req))) throw new HttpError(403, 'forbidden');
    return send(res, 200, { accounts: accounts.list() });
  }

  if (req.method === 'GET' && pathname === '/api/profiles') {
    const login = loginOf(req);
    const live = new Map();
    const workers = {};
    const agentsNow = await listAgents();
    for (const a of agentsNow) {
      const i = state.instances[a.terminal];
      if (!i) continue;
      if (i.type === 'worker') (workers[i.profile] ||= []).push({ pane: a.pane, name: a.name, status: a.status, until: i.until, task: i.task.slice(0, 160) });
      else live.set(i.profile, { pane: a.pane, status: a.status });
    }
    const byT = new Map(agentsNow.map(a => [a.terminal, a]));
    const spawns = state.spawns.filter(r => r.state === 'pending' && byT.has(r.lead))
      .map(r => ({ id: r.id, lead: nameOf(byT.get(r.lead)), leadPane: byT.get(r.lead).pane, profile: r.profile, label: profiles.get(r.profile)?.label || r.profile, task: r.task, at: r.at, canApprove: canApproveSpawn(login, r) }));
    return send(res, 200, {
      profiles: profiles.list().map(p => ({ ...p, running: live.get(p.id) || null, workers: workers[p.id] || [], canResume: !!state.profileSessions[p.id] })),
      mcp: isAdmin(login) ? tools.view().map(t => ({ id: t.id, name: t.name, ready: !t.missing.length })) : [],
      spawns, leads: agentsNow.filter(a => a.agent).map(a => ({ pane: a.pane, name: nameOf(a) })), maxWorkers: MAX_WORKERS,
      canEdit: canSetupAgents(login), kinds: KINDS.filter(k => k !== 'shell'), models: MODELS, tools: Object.keys(PROFILE_TOOLS),
      accounts: isAdmin(login) ? accounts.list().map(({ id, kind, label, signedIn, key }) => ({ id, kind, label, signedIn, key })) : [],
      skills: skills.list().map(s => ({ key: s.key, name: s.name })),
      packs: canSetupAgents(login) ? packsLib.viewPacks(readPacksNow(), { lang: url.searchParams.get('lang') === 'es' ? 'es' : 'en', taken: new Set(profiles.list().map(p => p.id)) }) : [],
      starters: canSetupAgents(login) ? viewStarters(STARTERS, { lang: url.searchParams.get('lang') === 'es' ? 'es' : 'en', taken: new Set(profiles.list().map(p => p.id)) }) : [],
    });
  }

  if (req.method === 'GET' && pathname === '/api/skills') {
    return send(res, 200, skills.view({ hosted: CFG.HOSTED, lang: url.searchParams.get('lang') === 'es' ? 'es' : 'en', canRequest: canRequestSkill(loginOf(req)) }));
  }

  if (req.method === 'GET' && pathname === '/api/kb') {
    let status;
    try { status = await kb.status(); } catch (e) { kbErr(e); }
    return send(res, 200, { mode: CFG.HOSTED ? 'hosted' : 'local', canWrite: canWriteKb(loginOf(req)), status, files: kb.list() });
  }
  if (req.method === 'GET' && pathname === '/api/kb/search') {
    const q = url.searchParams;
    // &as=<pane or name>: what that agent would get (its access applied), for the test search.
    let scope = null;
    if (q.get('as')) {
      const a = findAgent(await listAgents(), q.get('as'));
      if (!a) throw new HttpError(404, 'no_such_agent');
      const sc = kbScope(a);
      scope = { agent: { name: nameOf(a), pane: a.pane }, collections: sc.scope, denied: sc.denied }; // as `kb search --json` says it
      if (q.get('collection') && scope.denied.includes(q.get('collection'))) throw new HttpError(403, 'kb_denied', q.get('collection'));
    }
    let r;
    try { r = await kb.search(q.get('q') || '', { n: Number(q.get('n')) || 5, collection: q.get('collection') || null, exclude: scope?.denied }); }
    catch (e) { kbErr(e); }
    return send(res, 200, scope ? { ...r, scope } : r);
  }
  // Per-agent access: everyone sees it (and the agents and tags to pick from); admins change it.
  if (req.method === 'GET' && pathname === '/api/kb/access') {
    const agents = await listAgents();
    return send(res, 200, {
      canWrite: canWriteKb(loginOf(req)),
      access: kbAccess.load(),
      collections: [...new Set(kb.list().map(f => f.collection).filter(Boolean))].sort(),
      agents: agents.map(a => ({ name: a.name, pane: a.pane, tags: state.tags[a.terminal] || [] })),
      tags: Object.keys(state.tagColors).sort(),
    });
  }

  if (req.method === 'GET' && pathname === '/api/agents') {
    const [agents, layout] = await Promise.all([listAgents(), workspaceLayout().catch(() => ({ tabs: [], workspaces: [] }))]);
    const liveSleeping = agents.filter(a => state.sleeping[a.pane]);
    const sleeping = liveSleeping.map(a => sleepingItem(a, state.sleeping[a.pane]));
    const withState = agents.map(a => ({ ...a, state: state.sleeping[a.pane] ? 'sleeping' : 'active' }));
    return send(res, 200, { agents: withState, sleeping, tabs: layout.tabs, workspaces: layout.workspaces, mapOrder: state.mapOrder || [], tagColors: state.tagColors, tagLib: tagLibrary(agents), me: person(loginOf(req)), people: PEOPLE_LOGINS().map(person), ...linksView(agents), browserAsks: browserAsksFor(loginOf(req), agents), chat: chatView(loginOf(req), agents), access: accessView(loginOf(req)), journal: { toReview }, now: Date.now() });
  }

  if (req.method === 'GET' && pathname === '/api/agents/sleeping') {
    const agents = await listAgents();
    return send(res, 200, agents.filter(a => state.sleeping[a.pane]).map(a => sleepingItem(a, state.sleeping[a.pane])));
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
      other: (() => { const o = byTerminal.get(m.from === a.terminal ? m.to : m.from); return o ? { pane: o.pane, name: o.name } : m.fromName && m.from !== a.terminal ? { pane: null, name: m.fromName } : null; })(),
      text: m.via === 'agent' ? m.text.slice(0, 600) : m.text.split('\n')[0].slice(0, 200),
    }));
    return send(res, 200, { messages: list });
  }

  // ── End: what would be lost (the confirm box shows it before anything is sent)
  if (req.method === 'GET' && /^\/api\/agents\/[^/]+\/endcheck$/.test(pathname)) {
    const pane = decodeURIComponent(pathname.split('/')[3]);
    if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'gone');
    return send(res, 200, await endCheck(a));
  }

  // ── Journal
  if (pathname === '/api/journal' || pathname.startsWith('/api/journal/')) return journalApi(req, res, url);

  if (req.method === 'GET' && pathname === '/api/memory') return send(res, 200, await memory());

  if (req.method === 'GET' && pathname === '/api/names') {
    const agents = await listAgents();
    return send(res, 200, { crew: crew(new Set(agents.map(a => a.name).filter(Boolean))) });
  }

  // Claude and OpenCode-family agents have a transcript Reader; others use the pane screen.
  if (req.method === 'GET' && /^\/api\/agents\/[^/]+\/transcript$/.test(pathname)) {
    const pane = decodeURIComponent(pathname.split('/')[3]);
    if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
    await requireActOn(loginOf(req), pane);
    const a = agentCache.get(pane) || (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'not_found');
    const data = agentTranscript(a);
    if (!data) return send(res, 200, { blocks: null });
    let blocks = data.blocks;
    let rev = data.rev;
    if (['opencode', 'ollama'].includes(a.agent) && ['blocked', 'idle'].includes(a.status)) {
      const menu = screenMenu(await visible(pane));
      const menuKey = menu?.options.map(o => `${o.n}:${o.label}`).join('|') || '';
      rev += `:${a.status}:${a.seq}:${crypto.createHash('sha256').update(menuKey).digest('hex').slice(0, 12)}`;
      if (menu?.options.length && blocks.at(-1)?.t !== 'ask') {
        blocks = [...blocks, { t: 'ask', questions: [{ permission: true, options: menu.options.map(({ label }) => ({ label })) }] }];
      }
    }
    if (url.searchParams.get('rev') === rev) return send(res, 200, { same: true, rev });
    // since=N (same session): only blocks numbered N and up (the last one the panel has may have
    // grown). Falls back to everything when N is older than what is kept.
    const since = Number(url.searchParams.get('since'));
    const sameSession = String(url.searchParams.get('rev') || '').startsWith(a.session + ':');
    const first = blocks.find(b => b.n != null);
    if (sameSession && Number.isInteger(since) && since >= 0 && first && since >= first.n) {
      return send(res, 200, { since, blocks: blocks.filter(b => b.n == null || b.n >= since), rev });
    }
    return send(res, 200, { blocks, rev });
  }

  // ── ORCA Artifacts link (operio-orca artifact setup): the app's address only, never the token.
  if (req.method === 'GET' && pathname === '/api/artifacts') {
    let url = null;
    try { url = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'artifacts.json'), 'utf8')).url || null; } catch { /* not set up */ }
    if (url && !/^https?:\/\//.test(url)) url = null;
    return send(res, 200, { url });
  }

  if (req.method === 'GET' && pathname === '/api/meta') {
    const [tabsOut, wsOut] = await Promise.all([herdrJson(['tab', 'list']), herdrJson(['workspace', 'list'])]);
    const tabs = (tabsOut.result?.tabs || []).map(t => ({ id: t.tab_id, ws: t.workspace_id, number: t.number, label: t.label || null }));
    const workspaces = (wsOut.result?.workspaces || []).map(shapeWorkspace);
    await ollama.fresh();
    const login = loginOf(req);
    const accs = canAct(login) ? accounts.list().map(({ id, kind, label, signedIn, key }) => ({ id, kind, label, signedIn, key })) : [];
    return send(res, 200, { version: PANEL_VERSION, vapidKey: vapid.publicKey, tabs, workspaces, folders: FOLDERS, kinds: KINDS, keys: KEYS, models: MODELS, accounts: accs, access: accessView(login) });
  }

  // ── LLM keys: names and last 4 characters only; the values stay in llm.env (0600).
  if (req.method === 'GET' && pathname === '/api/llm') {
    return send(res, 200, { keys: llm.list(LLM_FILE), file: shortHome(LLM_FILE), demo: DEMO });
  }

  if (req.method === 'GET' && /^\/api\/agents\/[^/]+\/reply$/.test(pathname)) {
    const pane = decodeURIComponent(pathname.split('/')[3]);
    if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'not_found');
    const h = handoff(a);
    // A session's own file is always current; a pane-named one may be a previous agent's.
    const fresh = at => h?.own || !a.since || (at || 0) >= a.since - 60000;
    // Session transcripts know unanswered questions and the exact last reply.
    const tb = agentTranscript(a)?.blocks || null;
    const tAsk = tb?.at(-1)?.t === 'ask' ? tb.at(-1).questions : null;
    if (a.status === 'blocked') {
      if (h?.ask?.questions?.length && fresh(h.ask.at)) return send(res, 200, { ask: h.ask });
      if (tAsk) return send(res, 200, { ask: { questions: tAsk } });
      const menu = screenMenu(await visible(pane));
      return send(res, 200, { screen: menu });
    }
    if (a.status === 'idle' || a.status === 'done') {
      // A menu can be open while herdr reports idle (plan approval, a picker, a question the
      // hook didn't flag): offer it as buttons whenever the selection cursor is on screen.
      if (tAsk) return send(res, 200, { ask: { questions: tAsk } });
      const scr = await visible(pane);
      if (/^[\s│|]*❯\s*[1-9][.)]\s/m.test(scr.split('\n').slice(-25).join('\n'))) {
        const menu = screenMenu(scr);
        if (menu) return send(res, 200, { screen: menu, open: true });
      }
      const said = tb ? [...tb].reverse().find(b => b.t === 'say' || b.t === 'you') : null;
      if (said?.t === 'say') {
        const chips = chipsFor(said.text);
        return send(res, 200, chips.length ? { chips: chips.slice(0, 10), from: 'transcript' } : {});
      }
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
    const lines = Math.min(Math.max(Number(url.searchParams.get('lines')) || 40, 5), 2000);
    // A deep read of an idle full-screen agent (Claude Code) makes herdr scroll its transcript
    // up and back down, which shows in the terminal as a scrolling mess on every poll.
    // So read the history once per agent state; while nothing changed and this browser already
    // holds it (have=1), send only the screen and let the panel merge it.
    const ag = agentCache.get(pane);
    const key = ag ? `${ag.seq}:${ag.status}` : '';
    // screen=1: the Reader already has the transcript; only the screen (context bar, recap) is needed.
    if (url.searchParams.get('screen') === '1' || (url.searchParams.get('have') === '1' && key && deepRead.get(pane) === key)) {
      return send(res, 200, { text: await herdr(['agent', 'read', pane, '--source', 'visible', '--format', 'text']) });
    }
    // Full-screen agents (alternate screen) can't have their history read while they work or
    // wait on a question; show what is on their screen instead of an error.
    let text;
    // herdr now and then answers a deep read with only the screen; retry and keep the longest.
    try {
      const read = () => herdr(['agent', 'read', pane, '--source', 'recent', '--lines', String(lines), '--format', 'text']);
      text = await read();
      for (let i = 0; i < 2 && lines > 120 && text.split('\n').length < Math.min(lines, 120); i++) {
        const again = await read();
        if (again.length > text.length) text = again;
      }
      if (key) deepRead.set(pane, key);
    }
    catch (err) {
      if (!/alternate-screen|not idle|while .* is (working|blocked)/i.test(err.detail || err.message || '')) throw err;
      text = await herdr(['agent', 'read', pane, '--source', 'visible', '--format', 'text']);
    }
    return send(res, 200, { text });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  // Asking Operio for a skill is answered by ORCA Host in its proxy, never by the panel.
  if (pathname === '/api/skills/request') return send(res, 404, { error: 'not found' });
  if (!sameOrigin(req)) { log('write.denied', { path: pathname }); return send(res, 403, { error: 'cross-origin' }); }
  const body = await readBody(req, pathname === '/api/kb/upload' ? KB_UPLOAD_MAX : undefined);

  // ── Knowledge (documents for agents; content is never journaled, only path + bytes)
  if (pathname === '/api/kb/upload' || pathname === '/api/kb/remove') {
    if (!canWriteKb(loginOf(req))) throw new HttpError(403, 'admins_only');
    const rel = String(body.path || '');
    if (pathname === '/api/kb/upload') {
      let data;
      if (typeof body.base64 === 'string') data = Buffer.from(body.base64, 'base64');
      else if (typeof body.text === 'string') data = Buffer.from(body.text, 'utf8');
      else throw new HttpError(400, 'bad_request', 'text or base64');
      let r;
      try { r = await kb.add(rel, data); } catch (e) { kbErr(e); }
      jr(req, 'kb.add', null, { path: r.path, bytes: r.bytes, replaced: r.replaced || undefined });
      // Hosted with a key: prepare the meaning search now, so the first search is quick.
      if (kb.semantic().on) kb.embedPending().catch(e => log('kb.embed_failed', { code: e.code || 'error' }));
      return send(res, 200, { ok: true, ...r });
    }
    let r;
    try { r = await kb.remove(rel); } catch (e) { kbErr(e); }
    if (r.removed) jr(req, 'kb.remove', null, { path: r.path, bytes: r.bytes });
    return send(res, 200, { ok: true, removed: r.removed });
  }

  // ── Knowledge access: { collection, agents: [names], tags: [tags] } (both empty = all agents).
  // Journal: the collection and how many names/tags, never the names themselves.
  if (pathname === '/api/kb/access') {
    if (!canWriteKb(loginOf(req))) throw new HttpError(403, 'admins_only');
    let rule;
    try { rule = kbAccess.set(String(body.collection ?? ''), { agents: body.agents, tags: body.tags }); } catch (e) { kbErr(e); }
    jr(req, 'kb.access', null, { collection: String(body.collection), agents: rule?.agents.length || 0, tags: rule?.tags.length || 0 });
    return send(res, 200, { ok: true, collection: body.collection, rule, access: kbAccess.load() });
  }

  // ── Skills (free panel only: install / remove a bundled skill)
  if (pathname === '/api/skills/install' || pathname === '/api/skills/remove') {
    if (CFG.HOSTED) return send(res, 404, { error: 'not found' });
    const key = String(body.key || '');
    if (pathname === '/api/skills/install') {
      let r;
      try { r = skills.installBundled(key); } catch (e) { skillErr(e); }
      jr(req, 'skill.install', null, { key: r.key, version: r.version, files: r.files, bytes: r.bytes });
      return send(res, 200, { ok: true, key: r.key, version: r.version });
    }
    let r;
    try { r = skills.remove(key); } catch (e) { skillErr(e); }
    if (r.removed) jr(req, 'skill.remove', null, { key: r.key });
    return send(res, 200, { ok: true, removed: r.removed });
  }

  // ── Prompt templates (fill the prompt box; never sent by themselves)
  if (pathname === '/api/templates') {
    const login = loginOf(req);
    try {
      const row = templates.put(chatWho(login), { id: body.id ? String(body.id) : null, scope: String(body.scope || ''), title: body.title, body: body.body }, { admin: isAdmin(login) });
      jr(req, 'template.save', null, { scope: row.scope, title: row.title, update: !!body.id });
      return send(res, 200, { ok: true, template: row });
    } catch (e) { tplErr(e); }
  }
  if (pathname === '/api/templates/delete') {
    const login = loginOf(req);
    try { templates.remove(chatWho(login), { id: String(body.id || ''), scope: String(body.scope || '') }, { admin: isAdmin(login) }); }
    catch (e) { tplErr(e); }
    jr(req, 'template.delete', null, { scope: String(body.scope || '') });
    return send(res, 200, { ok: true });
  }

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
    const lang = LANGS.includes(body.lang) ? body.lang : 'en';
    state.subs = state.subs.filter(s => s.endpoint !== sub.endpoint).concat([{ endpoint: sub.endpoint, keys: sub.keys, lang, login: loginOf(req) }]);
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

  // ── LLM keys (localhost + same origin like every write; the value is never logged or echoed)
  if (pathname === '/api/llm/set' || pathname === '/api/llm/unset') {
    if (DEMO) throw new HttpError(403, 'demo');
    const name = String(body.name || '').trim();
    try {
      if (pathname === '/api/llm/set') llm.set(LLM_FILE, name, String(body.value ?? ''));
      else llm.unset(LLM_FILE, name);
    } catch (e) { throw new HttpError(400, 'llm_' + e.message); }
    const ev = pathname === '/api/llm/set' ? 'llm.set' : 'llm.unset';
    log(ev, { name });
    jr(req, ev, null, { name });
    return send(res, 200, { ok: true, keys: llm.list(LLM_FILE) });
  }
  if (pathname === '/api/llm/apply') {
    if (DEMO) throw new HttpError(403, 'demo');
    const busy = (await listAgents()).filter(a => a.status === 'working' || a.status === 'blocked').map(a => a.name || a.pane);
    if (busy.length) { log('llm.apply_busy', { agents: busy }); return send(res, 409, { error: 'busy', agents: busy }); }
    const r = await llmApply();
    if (!r.ok) {
      if (r.busy) { log('llm.apply_busy', { agents: r.busy }); return send(res, 409, { error: 'busy', agents: r.busy }); }
      throw new HttpError(502, 'apply_failed', r.line);
    }
    log('llm.apply', { result: r.result });
    jr(req, 'llm.apply', null, { result: r.result });
    return send(res, 200, { ok: true, result: r.result, detail: r.line });
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
    const l = addLink(kind, a, b, { by: loginOf(req) || 'local', intro: body.intro !== false, agents });
    jr(req, 'link.add', a, { kind, to: jAgent(b) });
    return send(res, 200, { ok: true, id: l.id });
  }
  if (pathname === '/api/links/delete') {
    const gone = state.links.find(l => l.id === body.id);
    const before = state.links.length;
    state.links = state.links.filter(l => l.id !== body.id);
    if (state.links.length === before) throw new HttpError(404, 'gone');
    delete state.handoffs[body.id];
    // Undelivered agent messages along a removed link are dropped with it.
    for (const m of state.msgs) if (m.state === 'queued' && m.via === 'agent' && !pairOf(m.from, m.to).length) m.state = 'failed';
    saveState();
    log('link.delete', { id: body.id });
    { const byT = new Map([...agentCache.values()].map(x => [x.terminal, x])); jr(req, 'link.delete', byT.get(gone?.from) || null, { kind: gone?.kind, to: byT.get(gone?.to) ? jAgent(byT.get(gone.to)) : undefined }); }
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
      { const byT = new Map([...agentCache.values()].map(x => [x.terminal, x])); jr(req, 'handoff.dismiss', byT.get(l.from) || null, { to: byT.get(l.to) ? jAgent(byT.get(l.to)) : undefined }); }
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
    jr(req, 'handoff.send', up || null, { to: jAgent(down), note, said: h.said });
    deliverQueued(agents).catch(() => {});
    return send(res, 200, { ok: true, id: m.id, queued: down.status !== 'idle' && down.status !== 'done' });
  }

  // ── Map order: the order of the tab boxes on the map. herdr can't reorder tabs or
  // workspaces, so this is ORCA's own order; the desktop keeps its own.
  if (pathname === '/api/map/order') {
    const order = Array.isArray(body.order) ? body.order.map(String) : null;
    if (!order || order.length > 300 || !order.every(id => TAB_RE.test(id))) throw new HttpError(400, 'bad_request');
    state.mapOrder = [...new Set(order)];
    saveState();
    log('map.order', { n: state.mapOrder.length });
    return send(res, 200, { ok: true, mapOrder: state.mapOrder });
  }

  // ── Rename a workspace or a tab (herdr renames it, so the desktop shows the same name)
  const rn = pathname.match(/^\/api\/(workspaces|tabs)\/([^/]+)\/rename$/);
  if (rn) {
    const id = decodeURIComponent(rn[2]);
    const ws = rn[1] === 'workspaces';
    if (!(ws ? WS_RE : TAB_RE).test(id)) throw new HttpError(400, 'bad_request');
    const name = String(body.label || '').trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(name)) throw new HttpError(400, 'bad_name');
    await herdr([ws ? 'workspace' : 'tab', 'rename', id, name], 10000);
    layoutCache.at = 0;
    log(ws ? 'workspace.rename' : 'tab.rename', { id, name });
    return send(res, 200, { ok: true, id, label: name });
  }

  // ── New agent or shell
  if (pathname === '/api/agents/new') {
    const r = await startAgent(req, body);
    return send(res, 200, { pane: r.pane, blocked: r.blocked, shell: r.shell });
  }

  // ── Web browser approvals: the person holding the agent (else an admin) approves or declines
  if (pathname === '/api/browser/approve' || pathname === '/api/browser/decline') {
    const r = browserAsks.get(String(body.id || ''));
    if (!r || r.state !== 'pending' || Date.now() - r.at > BROWSER_ASK_TTL) throw new HttpError(404, 'gone');
    if (!canApproveSpawn(loginOf(req), { lead: r.terminal })) throw new HttpError(403, 'forbidden');
    const ok = pathname.endsWith('/approve');
    r.state = ok ? 'approved' : 'declined';
    jr(req, ok ? 'browser.approve' : 'browser.decline', r.pane, { tool: r.tool, url: r.url, element: r.real || r.element });
    return send(res, 200, { ok: true });
  }

  // ── Web browser (admins, not on hosted panels): turn on / off, or open a test page
  if (pathname === '/api/browser') {
    if (CFG.HOSTED || !canManageLogins(loginOf(req))) throw new HttpError(403, 'forbidden');
    const action = String(body.action || '');
    if (action === 'on' || action === 'off') {
      const r = await browserCli([action], 5 * 60e3);
      if (r.ok) jr(req, 'browser.' + action, null, action === 'on' ? { level: browser.read().level === 'forms' ? 'forms' : 'read' } : {});
      return send(res, 200, { ok: r.ok, output: r.output, browser: browser.status() });
    }
    if (action === 'forms') {
      const st = browser.read();
      if (!st.enabled) throw new HttpError(409, 'browser_off');
      const level = body.on ? 'forms' : 'read';
      browser.save({ ...st, level });
      jr(req, 'browser.level', null, { level });
      return send(res, 200, { ok: true, browser: browser.status() });
    }
    if (action === 'test') {
      const url = String(body.url || '').trim().slice(0, 500);
      if (!/^https?:\/\/\S+$/i.test(url)) throw new HttpError(400, 'bad_url');
      const r = await browserCli(['test', url], 3 * 60e3);
      return send(res, 200, { ok: r.ok, output: r.output });
    }
    throw new HttpError(400, 'bad_action');
  }

  // ── Tools (admins): save / remove an MCP server, set or clear a secret (value never comes back)
  if (pathname === '/api/tools' || pathname === '/api/tools/delete' || pathname === '/api/tools/secret') {
    if (!canManageLogins(loginOf(req))) throw new HttpError(403, 'forbidden');
    try {
      if (pathname === '/api/tools') { const t = tools.put(body); jr(req, 'tool.save', null, { tool: t.id, type: t.type }); }
      else if (pathname === '/api/tools/delete') {
        const id = String(body.id || '');
        if (profiles.list().some(p => p.tools.mcp.includes(id))) throw new HttpError(409, 'tool_in_use');
        if (tools.remove(id)) jr(req, 'tool.remove', null, { tool: id });
      } else { tools.setSecret(String(body.name || ''), body.value); jr(req, 'secret.set', null, { name: String(body.name || '').slice(0, 64), cleared: !body.value }); }
    } catch (e) { toolErr(e); }
    return send(res, 200, { ok: true });
  }

  // ── Accounts (admins): add / rename / remove a login for an agent kind
  if (pathname === '/api/accounts' || pathname === '/api/accounts/key' || pathname === '/api/accounts/rename' || pathname === '/api/accounts/delete') {
    if (!canManageLogins(loginOf(req))) throw new HttpError(403, 'forbidden');
    let r;
    try {
      if (pathname === '/api/accounts') { r = accounts.add({ kind: String(body.kind || ''), label: body.label, key: body.key || null }); jr(req, 'account.add', null, { kind: r.kind, label: r.label, key: !!body.key }); }
      else if (pathname === '/api/accounts/key') { r = accounts.setKey(String(body.id || ''), body.key); jr(req, 'account.key', null, { kind: r.kind, label: r.label }); r = { id: r.id, kind: r.kind, label: r.label }; }
      else if (pathname === '/api/accounts/rename') { accounts.rename(String(body.kind || ''), String(body.id || ''), body.label); jr(req, 'account.rename', null, { kind: body.kind, label: String(body.label || '').slice(0, 60) }); }
      else {
        if (profiles.list().some(p => p.account === body.id)) throw new HttpError(409, 'account_in_use');
        r = accounts.remove(String(body.id || ''));
        if (r) jr(req, 'account.remove', null, { kind: r.kind, label: r.label });
      }
    } catch (e) { accountErr(e); }
    return send(res, 200, { ok: true, account: r || null });
  }

  // ── Saved agents (profiles): admins save/delete; start = the same rules as a new agent.
  if (pathname === '/api/profiles') {
    if (!canSetupAgents(loginOf(req))) throw new HttpError(403, 'forbidden');
    let p;
    try { p = profiles.put(body, loginOf(req) || 'local'); } catch (e) { profileErr(e); }
    jr(req, 'profile.save', null, { profile: p.id, rev: p.rev, kind: p.kind, type: p.type, skills: p.skills.length, tools: p.tools.builtin });
    return send(res, 200, { ok: true, profile: p });
  }
  // Install an industry pack ORCA Host put here: its agents (existing ones kept), templates and
  // examples (never overwriting a file) and its routines (switched off; an existing one is kept).
  // Its skills came with the pack (operio-orca packs add); the panel never installs them here.
  if (pathname === '/api/profiles/pack') {
    if (!canSetupAgents(loginOf(req))) throw new HttpError(403, 'forbidden');
    const pk = readPacksNow().find(x => x.id === String(body.id || ''));
    if (!pk) throw new HttpError(404, 'gone');
    const lang = body.lang === 'es' ? 'es' : 'en';
    const have = new Set(skills.list().map(x => x.key));
    const added = [], kept = [];
    for (const a of pk.agents) {
      try { profiles.put(packsLib.packProfile(a, { lang, installed: have }), loginOf(req) || 'local'); added.push(a.id); }
      catch (e) { if (e instanceof ProfileError && e.code === 'profile_exists') kept.push(a.id); else profileErr(e); }
    }
    let files = [], routines = [];
    try { files = packsLib.copyFiles(pk, CFG.HOME); routines = packsLib.writeRoutines(pk, CFG.ROUTINES_DIR); }
    catch (e) { log('pack.files_failed', { pack: pk.id, error: e.message }); throw new HttpError(500, 'pack_files', e.message); }
    jr(req, 'pack.install', null, { pack: pk.id, agents: added, kept, files: files.length, routines });
    return send(res, 200, { ok: true, agents: added, kept, files: files.length, routines, folder: pk.folder });
  }
  // Add a starter agent: install its bundled skills (free panel only), then save it as a saved agent.
  if (pathname === '/api/profiles/starter') {
    if (!canSetupAgents(loginOf(req))) throw new HttpError(403, 'forbidden');
    const st = STARTERS.find(x => x.id === String(body.id || ''));
    if (!st) throw new HttpError(404, 'gone');
    const lang = body.lang === 'es' ? 'es' : 'en';
    const have = new Set(skills.list().map(x => x.key));
    if (!CFG.HOSTED) {
      for (const key of st.skills) {
        if (have.has(key)) continue;
        try { const r = skills.installBundled(key); have.add(r.key); jr(req, 'skill.install', null, { key: r.key, version: r.version, files: r.files, bytes: r.bytes, starter: st.id }); }
        catch (e) { log('starter.skill_failed', { starter: st.id, key, error: e.message }); }
      }
    }
    let p;
    try { p = profiles.put(starterProfile(st, { lang, installed: have }), loginOf(req) || 'local'); } catch (e) { profileErr(e); }
    jr(req, 'profile.save', null, { profile: p.id, rev: p.rev, kind: p.kind, type: p.type, skills: p.skills.length, tools: p.tools.builtin, starter: st.id });
    return send(res, 200, { ok: true, profile: p });
  }
  if (pathname === '/api/profiles/delete') {
    if (!canSetupAgents(loginOf(req))) throw new HttpError(403, 'forbidden');
    const id = String(body.id || '');
    if (Object.values(state.instances).some(i => i.profile === id)) throw new HttpError(409, 'profile_running');
    if (profiles.list().some(x => x.reportsTo === id)) throw new HttpError(409, 'has_members');
    let removed;
    try { removed = profiles.remove(id); } catch (e) { profileErr(e); }
    if (removed) { delete state.profileSessions[id]; saveState(); jr(req, 'profile.delete', null, { profile: id }); }
    return send(res, 200, { ok: true, removed });
  }
  if (pathname === '/api/profiles/start') {
    const p = profiles.get(String(body.id || ''));
    if (!p) throw new HttpError(404, 'gone');
    if (p.type !== 'agent') throw new HttpError(400, 'bad_request'); // workers start with a task: /api/workers
    const r = await startProfile(req, p, { resume: !!body.resume, tab: body.tab });
    return send(res, 200, { pane: r.pane, blocked: r.blocked });
  }
  // A person starts a worker: a worker setup + its task, optionally for a running lead (pane).
  if (pathname === '/api/workers') {
    const p = profiles.get(String(body.profile || ''));
    if (!p || p.type !== 'worker') throw new HttpError(404, 'gone');
    const task = String(body.task || '').trim();
    if (!task || task.length > 4000) throw new HttpError(400, 'bad_task');
    let leadTerminal = null;
    if (body.lead) {
      const lead = (await listAgents()).find(a => a.pane === body.lead);
      if (!lead) throw new HttpError(404, 'gone');
      await requireActOn(loginOf(req), lead.pane);
      leadTerminal = lead.terminal;
    } else if (p.reportsTo) {
      // No lead picked: the setup's own lead, when it is running.
      for (const [t, i] of Object.entries(state.instances)) if (i.profile === p.reportsTo && i.type === 'agent') leadTerminal = t;
    }
    const r = await startProfile(req, p, { task, leadTerminal, tab: body.tab });
    return send(res, 200, { pane: r.pane, blocked: r.blocked, name: r.name });
  }
  // A lead's request for a worker: the person holding the lead (else an admin) approves or denies.
  if (pathname === '/api/spawns/approve' || pathname === '/api/spawns/deny') {
    const login = loginOf(req);
    const r = state.spawns.find(x => x.id === body.id && x.state === 'pending');
    if (!r) throw new HttpError(404, 'gone');
    if (!canApproveSpawn(login, r)) throw new HttpError(403, 'forbidden');
    const lead = (await listAgents()).find(a => a.terminal === r.lead);
    if (pathname.endsWith('/deny')) {
      r.state = 'denied'; saveState();
      queueMsgSafe(r.lead, `[ORCA] Your request for a ${r.profile} worker was not approved. Carry on without it, or ask the person why.`);
      jr(req, 'spawn.deny', lead || null, { profile: r.profile, task: r.task.slice(0, 300) });
      return send(res, 200, { ok: true });
    }
    if (!lead) { r.state = 'expired'; saveState(); throw new HttpError(409, 'lead_gone'); }
    const p = profiles.get(r.profile);
    if (!p || p.type !== 'worker') throw new HttpError(404, 'gone');
    const w = await startProfile(req, p, { task: r.task, leadTerminal: r.lead });
    r.state = 'started'; r.worker = w.name; saveState();
    queueMsgSafe(r.lead, `[ORCA] Approved: worker ${w.name} is on your task. Its result comes back to you when it finishes; no need to check on it.`);
    jr(req, 'spawn.approve', lead, { profile: r.profile, worker: w.name, task: r.task.slice(0, 300) });
    return send(res, 200, { ok: true, pane: w.pane, name: w.name });
  }


  // ── Per-agent actions
  const m = pathname.match(/^\/api\/agents\/([^/]+)\/(rename|focus|zoom|prompt|keys|tags|move|seen|answer|claim|stop|end|model|sleep|wake|finish)$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const pane = decodeURIComponent(m[1]);
  const action = m[2];
  if (!PANE_RE.test(pane)) throw new HttpError(400, 'bad_request');

  if (action === 'move') {
    const before = jAgent(pane);
    const r = await moveAgent(pane, body);
    jr(req, 'agent.move', { ...before, pane: r.pane }, { from: pane, mode: body.mode, closedWorkspace: r.closedWorkspace });
    return send(res, 200, r);
  }

  // Stop interrupts the job (the agent stays); End saves its output, asks it to quit, closes its pane.
  // Switch the agent's model. Only while it is free: a slash command sent mid-job would queue
  // behind the job, and one sent into a question would be typed as its answer.
  if (action === 'model') {
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'gone');
    const model = String(body.model || '');
    if (!MODELS[a.agent]) throw new HttpError(409, 'no_models');
    if (!MODELS[a.agent].includes(model)) throw new HttpError(400, 'bad_request');
    if (a.status === 'blocked') throw new HttpError(409, 'blocked');
    if (a.status === 'working') throw new HttpError(409, 'busy');
    await herdr(['agent', 'prompt', pane, '/model ' + model], 10000);
    state.models = state.models || {};
    state.models[a.terminal] = { model, at: Date.now() };
    saveState();
    log('agent.model', { pane, model });
    jr(req, 'agent.model', a, { model });
    return send(res, 200, { ok: true, model });
  }

  if (action === 'sleep') {
    const minutes = sleepState.wakeInMinutes(body);
    if (minutes === undefined) throw new HttpError(400, 'bad_request');
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'not_found');
    const agent = await sleepAgent(a, minutes);
    jr(req, 'agent.sleep', a, { wakeAt: agent.wakeAt });
    return send(res, 200, { agent });
  }

  if (action === 'wake') {
    const result = await wakeAgent(pane);
    jr(req, 'agent.wake', { pane: result.agent.id, name: result.agent.name }, { nudged: result.nudged });
    return send(res, 200, result);
  }

  if (action === 'finish') {
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'not_found');
    if (state.sleeping[pane]) releaseSleep(pane);
    const snap = jAgent(a);
    const r = await endAgent(a);
    jr(req, 'agent.end', snap, { mode: r.mode, closed: r.closed, out: r.out, ranFor: r.ranFor, jobs24: r.jobs24, linksNotified: r.notified, said: r.said, wasStatus: a.status });
    return send(res, 200, { id: pane, state: 'terminated' });
  }

  if (action === 'stop' || action === 'end') {
    const a = (await listAgents()).find(x => x.pane === pane);
    if (!a) throw new HttpError(404, 'gone');
    if (state.sleeping[pane]) releaseSleep(pane);
    if (action === 'stop') {
      const r = await stopAgent(a);
      jr(req, 'agent.stop', a, { how: r.how, wasStatus: a.status, status: r.status });
      log('agent.stop', { pane, how: r.how });
      return send(res, 200, { ok: true, ...r });
    }
    const snap = jAgent(a);
    const r = await endAgent(a);
    jr(req, 'agent.end', snap, { mode: r.mode, closed: r.closed, out: r.out, ranFor: r.ranFor, jobs24: r.jobs24, linksNotified: r.notified, said: r.said, wasStatus: a.status });
    return send(res, 200, { ok: true, mode: r.mode, closed: r.closed });
  }

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
      jr(req, 'agent.rename', pane, { name: null, was: agentCache.get(pane)?.name || null });
      return send(res, 200, { ok: true, name: null });
    }
    const name = String(body.name || '').trim();
    if (!AGENT_NAME_RE.test(name)) throw new HttpError(400, 'bad_agent_name');
    await herdr(['agent', 'rename', pane, name]);
    const a = (await listAgents()).find(x => x.pane === pane);
    applyName(a?.terminal, name);
    log('agent.rename', { pane, name });
    jr(req, 'agent.rename', a || pane, { name });
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
    jr(req, 'agent.claim', a, { mode, to: mode === 'assign' ? person(state.claims[a.terminal]?.login).name : undefined });
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
    log('agent.prompt', { pane, chars: text.length }); // never log the text itself (the journal keeps it, redacted)
    jr(req, 'agent.prompt', pane, { text });
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
    // Idle with a menu on screen counts too (see /reply); the screen check below is the guard.
    if (a.status === 'working') throw new HttpError(409, 'not_asking');
    const screen = await visible(pane);
    autoClaim(a.terminal, loginOf(req));
    if (Number.isInteger(body.screen)) {
      const menu = screenMenu(screen);
      if (!menu?.options.some(o => o.n === body.screen)) throw new HttpError(409, 'question_gone');
      if (menu.keyMode === 'opencode-choice') await press(pane, ...Array(Math.max(0, body.screen - 1)).fill('right'), 'enter');
      else await press(pane, String(body.screen));
      log('agent.answer', { pane, kind: 'screen', n: body.screen });
      jr(req, 'agent.answer', a, { question: menu.question, picked: [menu.options.find(o => o.n === body.screen)?.label || String(body.screen)] });
      return send(res, 200, { ok: true });
    }
    let qs = handoff(a)?.ask?.questions;
    if (!qs?.length && (a.agent === 'claude' || ['opencode', 'ollama'].includes(a.agent)) && a.session) {
      try { const tb = agentTranscript(a)?.blocks; if (tb?.at(-1)?.t === 'ask') qs = tb.at(-1).questions; } catch { /* none */ }
    }
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
    jr(req, 'agent.answer', a, { question: qs.map(q => q.question).join(' / '), picked: answers.map((ans, i) => typeof ans.other === 'string' ? ans.other : ans.pick.map(n => qs[i].options[n - 1]?.label || n).join(', ')) });
    return send(res, 200, { ok: true });
  }

  if (action === 'keys') {
    const key = String(body.key || '');
    if (!KEYS.includes(key)) throw new HttpError(400, 'bad_request');
    await herdr(['agent', 'send-keys', pane, key]);
    log('agent.keys', { pane, key });
    jr(req, 'agent.keys', pane, { key });
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
  for (const k of Object.keys(state.models || {})) if (!live.has(k)) delete state.models[k];
  saveState();
  log('agent.tags', { pane, tags });
  jr(req, 'agent.tags', a, { tags });
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

// ─── Demo mode (`operio-orca demo`) ─────────────────────────────────────────────
// Two fictional businesses played by demo/demo-herdr. Each client has its own routines,
// drafts and run log under CONFIG_DIR/clients/<id>/; switching client swaps them.
const DEMO = process.env.OPERIO_ORCA_DEMO === '1' && !!process.env.OPERIO_ORCA_DEMO_DIR;
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
  if (CFG.HOSTED) { // each business has its own team chat and fictional teammates
    chat = createChat({ dir: path.join(base, 'chat'), redact, log, keepDays: CFG.JOURNAL_DAYS });
    others.clear();
    for (const [login, name] of Object.entries(require('./demo/chat').PEOPLE[id] || {})) others.set(login, name);
  }
}
if (DEMO) useDemoClient(demoTl.loadState(process.env.OPERIO_ORCA_DEMO_DIR).client);

async function demoApi(req, res, pathname) {
  if (!DEMO) return send(res, 200, { demo: false });
  const dir = process.env.OPERIO_ORCA_DEMO_DIR;
  if (req.method === 'GET' && pathname === '/api/demo') {
    const st = demoTl.loadState(dir);
    return send(res, 200, { demo: true, clients: DEMO_CLIENTS, active: st.client, speed: st.speed, lang: st.lang || 'en' });
  }
  if (req.method === 'POST' && pathname === '/api/demo/client') {
    const body = await readBody(req);
    if (!DEMO_CLIENTS.some(c => c.id === body.client)) throw new HttpError(400, 'bad_request');
    const st = demoTl.loadState(dir);
    st.client = body.client;
    demoTl.saveState(dir, st);
    useDemoClient(body.client);
    // The demo's agents changed without a herdr command: drop the shared list and layout.
    agentsList.at = 0; agentsList.gen++; layoutGen++;
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
    // Tools the pack asks for (Claude only), written like a saved agent's run files.
    let mcp = null;
    if (r.agent === 'claude' && r.tools?.length) {
      try { mcp = tools.writeRun(path.join(profiles.RUNS, name), r.tools); } catch (e) { toolErr(e); }
    }
    const started = await newAgent({ name, kind: r.agent, folder: r.cwd },
      mcp ? { args: ['--mcp-config', mcp.mcpFile, ...(mcp.allow.length ? ['--allowedTools', mcp.allow.join(',')] : [])], envFiles: mcp.envFile ? [mcp.envFile] : [] } : {});
    if (mcp) runLog({ run, routine: r.id, state: 'tools', tools: mcp.ids });
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
    if (!r.packSchedule) throw new HttpError(409, 'on_demand');
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
  // A viewer on a hosted panel writes in the team chat and turns alerts on; nothing else.
  if (req.method !== 'GET' && req.method !== 'HEAD' && !canAct(loginOf(req)) && !/^\/api\/(chat\/|push\/(un)?subscribe$)/.test(url.pathname)) {
    log('write.denied', { path: url.pathname, why: 'viewer' });
    return send(res, 403, { error: 'read_only' });
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
      if (e.code === 'shell_locked') {
        const pm = url.pathname.match(/^\/api\/(?:agents|term)\/([^/]+)/);
        const pane = pm ? decodeURIComponent(pm[1]) : null;
        jr(req, 'access.denied', pane && PANE_RE.test(pane) ? pane : null, { code: e.code, path: url.pathname.replace(/\/api\/(agents|term)\/[^/]+/, '/api/$1/:pane') });
      } else if (status >= 500 || !e.code) jError(url.pathname, e.code || 'internal');
      return send(res, status, { error: e.code || 'internal' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed', 'text/plain');
  serveStatic(req, res, url.pathname);
});

if (!guard.isLoopbackBind(HOST)) {
  const bar = '!'.repeat(78);
  for (const line of [bar,
    `WARNING: ORCA is listening on ${HOST}, not 127.0.0.1.`,
    'There is NO login. Anyone who can reach this address and port can type into your agents',
    'and open shells on this computer as you. Only do this on a network you fully trust,',
    'and prefer `tailscale serve` or `ssh -L` to a localhost bind instead.',
    bar]) process.stderr.write(line + '\n');
  log('listen.exposed', { host: HOST });
}

server.listen(PORT, HOST, () => {
  log('listen', { host: HOST, port: PORT, demo: DEMO || undefined, herdr: HERDR, allowedHosts: [...ALLOWED_HOSTS.names, ...ALLOWED_HOSTS.pinned], pushDevices: state.subs.length });
  reconcileSleeping().catch(e => log('agent.sleep_reconcile_error', { code: e.code || 'internal' }));
  scheduler.start();
});
