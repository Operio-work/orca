'use strict';
// Saved agents ("profiles"): who an agent is (instructions), what it knows (skills), what it may use
// (tools) and who it reports to. One JSON file per profile in <config>/profiles (0600).
//   type 'agent'  reusable: saved, started again and resumed; one live copy at a time
//   type 'worker' temporary: started with a task, ends itself when done (P3)
// buildRun() turns a profile into the files + CLI args for one start, under <config>/runs/<id>/.
// Nothing outside <config> is ever written: never ~/.claude, never the user's folder.
const fs = require('fs');
const path = require('path');

const ID_RE = /^[a-z][a-z0-9_-]{0,31}$/;          // same rule as agent names
const SKILL_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;      // same rule as skill keys
const TYPES = ['agent', 'worker'];
// Built-in tool sets. Claude only; other kinds keep their CLI's defaults (the page says so).
//   noedit   no Edit/Write tools; the shell still runs (orca-kb, orca-send keep working)
//   readonly read and search only: no shell, so no orca-kb / orca-send either
const BUILTIN = {
  default: [],
  noedit: ['--disallowedTools', 'Edit,Write,NotebookEdit'],
  readonly: ['--tools', 'Read,Grep,Glob,WebFetch,WebSearch'],
};
const INSTR_MAX = 8000, LABEL_MAX = 60, FOLDER_MAX = 200, SKILLS_MAX = 20, MAX_PROFILES = 200;
const MINUTES = [5, 480], MINUTES_DEFAULT = 120, SPAWN_MAX = 6;

class ProfileError extends Error {
  constructor(code, status = 400, detail) { super(detail ? `${code}: ${detail}` : code); this.code = code; this.status = status; this.detail = detail; }
}
const bad = detail => new ProfileError('bad_profile', 400, detail);
const text = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const line = (v, max) => text(v, max * 2).replace(/\s+/g, ' ').trim().slice(0, max);

// Input from the page (or a file) → a clean profile. kinds/models come from the server's lists.
// "https://www.Example.com/menu" → "example.com" (a site covers its subdomains, www included). Anything that is not a host name is kept as typed and refused.
const SITE_RE = /^(?=.{3,253}$)[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?)+$/;
function siteHost(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  try { return new URL(/^[a-z]+:\/\//.test(s) ? s : 'https://' + s).hostname.replace(/^www\./, ''); } catch { return s; }
}

function validate(input, { kinds, models = {} }) {
  const p = input && typeof input === 'object' ? input : {};
  const id = String(p.id ?? '');
  if (!ID_RE.test(id)) throw bad('id');
  const type = p.type == null ? 'agent' : String(p.type);
  if (!TYPES.includes(type)) throw bad('type');
  const kind = String(p.kind ?? '');
  if (!kinds.includes(kind) || kind === 'shell') throw bad('kind');
  const model = String(p.model ?? '');
  // Local models come and go with Ollama: checked when the agent starts, not here.
  if (model && kind !== 'ollama' && !(models[kind] || []).includes(model)) throw bad('model');
  const folder = text(p.folder || '~', FOLDER_MAX);
  if (folder.includes('\n')) throw bad('folder');
  const instructions = text(p.instructions, INSTR_MAX + 1);
  if (instructions.length > INSTR_MAX) throw bad('instructions too long');
  const skills = Array.isArray(p.skills) ? [...new Set(p.skills.map(String))] : [];
  if (skills.length > SKILLS_MAX || skills.some(k => !SKILL_RE.test(k))) throw bad('skills');
  const builtin = String(p.tools?.builtin || 'default');
  if (!(builtin in BUILTIN)) throw bad('tools');
  const mcp = Array.isArray(p.tools?.mcp) ? [...new Set(p.tools.mcp.map(String))] : [];
  if (mcp.length > 20 || mcp.some(x => !/^[a-z0-9][a-z0-9-]{0,39}$/.test(x))) throw bad('tools');
  const mcpOnly = !!p.tools?.mcpOnly;
  // Web browser: sites this agent may open (empty = any public site). Host names only.
  const sites = (Array.isArray(p.tools?.browserSites) ? p.tools.browserSites : []).map(siteHost).filter(Boolean);
  const browserSites = [...new Set(sites)];
  if (browserSites.length > 20 || browserSites.some(h => !SITE_RE.test(h))) throw bad('browserSites');
  const reportsTo = p.reportsTo ? String(p.reportsTo) : null;
  if (reportsTo && (!ID_RE.test(reportsTo) || reportsTo === id)) throw bad('reportsTo');
  const account = p.account && p.account !== 'default' ? String(p.account) : '';
  if (account && !/^[a-z0-9]{8}$/.test(account)) throw bad('account');
  const mm = Number(p.worker?.maxMinutes ?? MINUTES_DEFAULT);
  if (!Number.isInteger(mm) || mm < MINUTES[0] || mm > MINUTES[1]) throw bad('maxMinutes');
  // Which worker setups this agent may ask for (a person approves each one). Workers never spawn.
  const sp = p.spawn && type === 'agent' ? p.spawn : {};
  const spawnProfiles = Array.isArray(sp.profiles) ? [...new Set(sp.profiles.map(String))] : [];
  if (spawnProfiles.length > 10 || spawnProfiles.some(x => !ID_RE.test(x) || x === id)) throw bad('spawn');
  const spawnMax = Number(sp.max ?? 2);
  if (!Number.isInteger(spawnMax) || spawnMax < 1 || spawnMax > SPAWN_MAX) throw bad('spawn');
  return {
    v: 1, id, type, label: line(p.label, LABEL_MAX) || id, kind, model, account, folder, instructions, skills,
    tools: { builtin, mcp, mcpOnly, browserSites }, reportsTo, worker: { maxMinutes: mm }, spawn: { profiles: spawnProfiles, max: spawnMax },
  };
}

// The instructions file every start gets: the profile's own text + an ORCA footer (who it is,
// who it works with, its skills with paths). `skills` = installed ones [{ key, name, description, dir }].
function instructionsFor(p, { skills = [], lead = null, members = [], kb = false, name = p.id, workers = [] } = {}) {
  const out = [p.instructions || `You are ${p.label}.`, '', '---', '## ORCA', '',
    `You are the agent "${name}"${p.label !== name ? ` (${p.label})` : ''} on the ORCA panel.`];
  if (p.type === 'worker') {
    out.push(`You are a temporary worker: do the one task you are given, then stop. ORCA closes you when you finish (or after ${p.worker.maxMinutes} minutes).`,
      lead ? `Your final reply is sent to "${lead}" automatically, so make it complete: the result itself, not a summary of what you did. Don't message it before then unless you are stuck.`
        : 'Your final reply is saved for the person who started you, so make it complete: the result itself.');
    lead = null; // no "message your lead" line below: the final reply is the report
  }
  if (lead) out.push(`You report to the agent "${lead}". Send it your results and questions: orca-send ${lead} "…" (works while it is running; orca-send --team shows who is).`);
  if (members.length) out.push(`These agents report to you: ${members.join(', ')}. When one finishes a job, a person may hand you its result. Message one: orca-send <name> "…" — orca-send --team shows who is running.`);
  const mine = p.skills.map(k => skills.find(s => s.key === k)).filter(Boolean);
  if (mine.length) {
    out.push('', 'Skills for your work — when a task matches, read the SKILL.md first:');
    for (const s of mine) out.push(`- ${line(s.name, 80) || s.key} — ${line(s.description, 300).replace(/\.$/, '')}: ${path.join(s.dir, 'SKILL.md')}`);
  }
  if (workers.length) out.push('', `You can ask for a temporary worker for a self-contained task: orca-send --spawn <setup> "the task, with everything it needs". A person approves it first; the worker's final reply comes back to you. Setups: ${workers.join(', ')}.`);
  if (kb) out.push('', 'Business documents (prices, hours, policies…): orca-kb search "…" before stating a fact about the business.');
  return out.join('\n') + '\n';
}

// Reporting lines are 2 levels at most: a lead reports to no one, a member has no members, a member
// has one lead. `links` = [{ kind, from, to }] with from = member, to = lead. Returns an error code or null.
function reportsError(links, member, lead) {
  if (member === lead) return 'link_self';
  const reports = links.filter(l => l.kind === 'reports');
  if (reports.some(l => l.from === member)) return 'has_lead';
  if (reports.some(l => l.from === lead)) return 'lead_has_lead';
  if (reports.some(l => l.to === member)) return 'member_has_members';
  return null;
}
// The same rules for saved agents (reportsTo by id). `all` = every saved profile, `p` = the one being saved.
function profileTeamError(all, p) {
  if (!p.reportsTo) return null;
  const lead = all.find(x => x.id === p.reportsTo);
  if (!lead) return 'lead_missing';
  if (lead.reportsTo) return 'lead_has_lead';
  if (all.some(x => x.reportsTo === p.id && x.id !== p.id)) return 'member_has_members';
  return null;
}

function createProfiles({ configDir, kinds, models = {}, now = () => Date.now(), log = () => {} }) {
  const DIR = path.join(configDir, 'profiles');
  const RUNS = path.join(configDir, 'runs');
  const fileOf = id => path.join(DIR, id + '.json');
  const writeFile = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, data, { mode: 0o600 });
    fs.renameSync(tmp, file);
  };

  function read(id) {
    try {
      const raw = JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
      return { ...validate(raw, { kinds, models }), by: String(raw.by || ''), at: Number(raw.at) || 0, rev: Number(raw.rev) || 1 };
    } catch (e) { if (e.code !== 'ENOENT') log('profile.bad', { id, error: e.message }); return null; }
  }
  function list() {
    let names = [];
    try { names = fs.readdirSync(DIR); } catch { return []; }
    return names.filter(f => f.endsWith('.json')).map(f => read(f.slice(0, -5))).filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  const get = id => (ID_RE.test(String(id)) ? read(id) : null);

  // Save. `rev` (when sent) must match the stored one, so two editors can't overwrite each other.
  function put(input, by) {
    const p = validate(input, { kinds, models });
    const prev = read(p.id);
    const team = profileTeamError(list(), p);
    if (team) throw new ProfileError(team, 409);
    if (input.create && prev) throw new ProfileError('profile_exists', 409);
    if (prev && input.rev != null && Number(input.rev) !== prev.rev) throw new ProfileError('stale', 409);
    if (!prev && list().length >= MAX_PROFILES) throw new ProfileError('too_many', 400);
    const row = { ...p, by: String(by || ''), at: now(), rev: prev ? prev.rev + 1 : 1 };
    writeFile(fileOf(p.id), JSON.stringify(row, null, 2) + '\n');
    return row;
  }
  function remove(id) {
    if (!ID_RE.test(String(id))) throw bad('id');
    try { fs.unlinkSync(fileOf(id)); } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
    cleanRun(id);
    return true;
  }

  // Files + agent CLI args for one start. Claude reads the instructions as part of its system
  // prompt; other kinds get them as their first message (firstPrompt).
  // ctx.name = the instance name (a worker is "<setup>-<n>"); files go to runs/<name>.
  function buildRun(p, ctx = {}) {
    const dir = path.join(RUNS, ctx.name || p.id);
    const body = instructionsFor(p, ctx);
    const file = path.join(dir, 'instructions.md');
    writeFile(file, body);
    if (p.kind !== 'claude') return { dir, args: [], firstPrompt: `[ORCA] Your instructions for this session. Follow them from now on; no reply needed.\n\n${body}` };
    const args = ['--append-system-prompt-file', file, ...BUILTIN[p.tools.builtin]];
    // MCP servers picked for this setup (run files written by tools.js); "only these" drops the user's own.
    if (ctx.mcpFile) args.push('--mcp-config', ctx.mcpFile, ...(p.tools.mcpOnly ? ['--strict-mcp-config'] : []));
    if (ctx.allow?.length) args.push('--allowedTools', ctx.allow.join(','));
    if (p.model) args.push('--model', p.model);
    if (ctx.resume && /^[A-Za-z0-9_-]{6,64}$/.test(ctx.resume)) args.push('--resume', ctx.resume);
    return { dir, args, firstPrompt: null };
  }
  function cleanRun(id) {
    if (ID_RE.test(String(id))) fs.rmSync(path.join(RUNS, id), { recursive: true, force: true });
  }

  return { list, get, put, remove, buildRun, cleanRun, DIR, RUNS };
}

module.exports = { createProfiles, validate, instructionsFor, reportsError, profileTeamError, ProfileError, ID_RE, BUILTIN, INSTR_MAX };
