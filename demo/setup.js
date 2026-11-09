#!/usr/bin/env node
'use strict';
// Prepares the folder `free-orca demo` runs from. Never touches the real config:
//
//   <root>/                       default ~/.config/free-orca-demo (marked with .free-orca-demo)
//     herdr-state.json            the scripted timeline (demo/timeline.js)
//     home/                       HOME for the demo panel: the businesses' folders, and
//       .config/free-orca/        its config dir (state, VAPID keys, per-client routines)
//
//   node demo/setup.js --root <dir> [--reset] [--restart] [--speed N] [--paths]
//     --reset    wipe and seed everything again (routines, history, drafts, timeline)
//     --restart  restart the agents' timeline from zero (keeps routines and your approvals)
//     --speed N  timeline speed (implies --restart)
//     --paths    print KEY=value lines for the launcher (HOME, config dir)

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const tl = require('./timeline');
const cron = require('../lib/cron');
const { CLIENTS, ROUTINES, ROUTINE_CHOICES, HISTORY, DRAFTS } = require('./clients');

const APP = path.join(__dirname, '..');
const MARK = '.free-orca-demo';

function parseArgs(argv) {
  const o = { root: path.join(os.homedir(), '.config', 'free-orca-demo'), reset: false, restart: false, speed: null, paths: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') o.root = path.resolve(argv[++i]);
    else if (a === '--reset') o.reset = true;
    else if (a === '--restart') o.restart = true;
    else if (a === '--paths') o.paths = true;
    else if (a === '--speed') {
      const s = Number(argv[++i]);
      if (!(s >= 0.25 && s <= 20)) throw new Error('--speed must be a number from 0.25 to 20');
      o.speed = s; o.restart = true;
    } else throw new Error(`unknown option: ${a}`);
  }
  return o;
}

const layout = root => {
  const home = path.join(root, 'home');
  return { root, home, config: path.join(home, '.config', 'free-orca') };
};

const pad = n => String(n).padStart(2, '0');
function runId(at, salt) {
  const d = new Date(at);
  const hex = crypto.createHash('sha1').update(salt).digest('hex').slice(0, 4);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${hex}`;
}

// When a schedule fired before `now`, newest first (looks back up to 40 days).
function pastRuns(schedule, now) {
  const out = [];
  for (let at = cron.nextRun(schedule, new Date(now - 40 * 864e5)); at && at.getTime() < now; at = cron.nextRun(schedule, at)) out.unshift(at.getTime());
  return out;
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', { mode: 0o600 });
}

function seedClient(L, c, now) {
  const base = path.join(L.config, 'clients', c.id);
  const packs = [];
  for (const id of fs.readdirSync(path.join(APP, 'routines')).sort()) {
    const raw = JSON.parse(fs.readFileSync(path.join(APP, 'routines', id, 'routine.json'), 'utf8'));
    writeJson(path.join(base, 'routines', id, 'routine.json'), raw);
    packs.push(raw);
  }
  for (const raw of ROUTINES[c.id] || []) {
    writeJson(path.join(base, 'routines', raw.id, 'routine.json'), raw);
    packs.push(raw);
  }
  const rstate = { routines: JSON.parse(JSON.stringify(ROUTINE_CHOICES[c.id] || {})), runs: {} };
  const log = [];
  (HISTORY[c.id] || []).forEach(([id, nth, state, trigger], i) => {
    const pack = packs.find(p => p.id === id);
    const schedule = rstate.routines[id]?.schedule || pack.schedule;
    // The nth most recent time its schedule fired (a manual run: 25 minutes after it).
    const at = pastRuns(schedule, now)[nth] + (trigger === 'manual' ? 25 * 60e3 : 0) + 7000 + i * 1000;
    const run = runId(at, `${c.id}/${id}/${i}`);
    const out = path.join(base, pack.approval === 'draft' ? 'drafts' : 'reports', id, run + '.md');
    fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
    fs.writeFileSync(out, DRAFTS[`${id}@${c.id}`] || `# ${pack.name.en}\n\nDemo output. Nothing was sent.\n`, { mode: 0o600 });
    const r = { id, out, approval: pack.approval, state, at, trigger, readyAt: at + 4 * 60e3 };
    if (state === 'approved' || state === 'rejected') r.decidedAt = at + 70 * 60e3;
    rstate.runs[run] = r;
    const ts = t => new Date(t).toISOString();
    log.push({ ts: ts(at), run, routine: id, trigger, state: 'started', output: out });
    log.push({ ts: ts(r.readyAt), run, routine: id, state: pack.approval === 'draft' ? 'draft_ready' : 'report_ready', output: out });
    if (r.decidedAt) log.push({ ts: ts(r.decidedAt), run, routine: id, state, output: out });
  });
  writeJson(path.join(base, 'routines-state.json'), rstate);
  fs.mkdirSync(path.join(base, 'logs'), { recursive: true, mode: 0o700 });
  log.sort((x, y) => x.ts.localeCompare(y.ts));
  fs.writeFileSync(path.join(base, 'logs', 'routines.jsonl'), log.map(l => JSON.stringify(l)).join('\n') + '\n', { mode: 0o600 });
  fs.mkdirSync(path.join(L.home, c.folder), { recursive: true });
}

function seed(L, { speed = 1 } = {}) {
  const now = Date.now();
  fs.mkdirSync(L.root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(L.root, MARK), 'Free-ORCA demo folder: fictional data only. Safe to delete.\n');
  fs.mkdirSync(path.join(L.home, 'free-orca-desk'), { recursive: true });
  for (const c of CLIENTS) seedClient(L, c, now);
  tl.saveState(L.root, tl.freshState({ speed, now }));
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const L = layout(o.root);
  const exists = fs.existsSync(L.root);
  if (exists && !fs.existsSync(path.join(L.root, MARK)) && fs.readdirSync(L.root).length) {
    throw new Error(`${L.root} exists and is not a Free-ORCA demo folder; refusing to touch it`);
  }
  if (o.reset || !fs.existsSync(path.join(L.root, MARK))) {
    if (fs.existsSync(path.join(L.root, MARK))) fs.rmSync(L.root, { recursive: true, force: true });
    seed(L, { speed: o.speed || 1 });
  } else if (o.restart) {
    const st = tl.loadState(L.root);
    tl.saveState(L.root, tl.freshState({ speed: o.speed || st.speed || 1, client: st.client }));
  }
  if (o.paths) {
    const st = tl.loadState(L.root);
    process.stdout.write(`DEMO_HOME=${L.home}\nDEMO_CONFIG=${L.config}\nDEMO_SPEED=${st.speed}\n`);
  }
}

if (require.main === module) {
  try { main(); } catch (e) { process.stderr.write(`free-orca demo: ${e.message}\n`); process.exit(1); }
}

module.exports = { layout, seed, parseArgs, MARK };
