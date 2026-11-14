'use strict';
// The operio-orca CLI run from this checkout against a throwaway HOME: status wording without a
// service, open, logs, doctor, update --check (against a local copy of install.sh), backup and
// restore. herdr is never started (OPERIO_ORCA_SKIP_HERDR=1; the panel talks to the fake herdr).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'operio-orca');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-cli-'));
const PREFIX = path.join(HOME, 'prefix');
const CONFIG = path.join(HOME, 'cfg', 'operio-orca');
const FAKE = path.join(HOME, 'fake-herdr');
const TOOLS = path.join(HOME, 'tools');
const PORT = 21000 + Math.floor(Math.random() * 20000);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const installer = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
const pin = (k) => (installer.match(new RegExp(`^${k}="([^"]*)"`, 'm')) || [])[1];

const env = (extra = {}) => ({
  PATH: `${TOOLS}:${process.env.PATH}`, HOME, TMPDIR: HOME,
  OPERIO_ORCA_PREFIX: PREFIX, OPERIO_ORCA_CONFIG_DIR: CONFIG, OPERIO_ORCA_PORT: String(PORT),
  OPERIO_ORCA_SKIP_HERDR: '1', OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'), FAKE_HERDR_DIR: FAKE,
  OPERIO_ORCA_AGENT_SOCK: path.join(HOME, 'a.sock'),
  ...extra,
});
const run = (args, extra = {}, cwd = HOME, input) => {
  const r = spawnSync('bash', [CLI, ...args], { env: env(extra), cwd, encoding: 'utf8', timeout: 60000, input });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '' };
};
const mode = (p) => (fs.statSync(p).mode & 0o777).toString(8);
const healthz = () => new Promise(resolve => {
  http.get({ host: '127.0.0.1', port: PORT, path: '/healthz', headers: { Host: `127.0.0.1:${PORT}` } }, r => { r.resume(); resolve(r.statusCode); }).on('error', () => resolve(0));
});
const tarList = (file) => spawnSync('tar', ['-tzf', file], { encoding: 'utf8' }).stdout.trim().split('\n');
const stopPanel = () => { run(['stop']); try { process.kill(Number(fs.readFileSync(path.join(CONFIG, 'operio-orca.pid'), 'utf8'))); } catch { /* gone */ } };

test.before(() => {
  fs.mkdirSync(CONFIG, { recursive: true, mode: 0o700 });
  fs.mkdirSync(FAKE, { recursive: true });
  fs.mkdirSync(PREFIX, { recursive: true });
  fs.mkdirSync(TOOLS, { recursive: true });
  fs.writeFileSync(path.join(CONFIG, 'env'), '# test settings\n', { mode: 0o600 });
  fs.mkdirSync(path.join(CONFIG, 'routines', 'demo-pack'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(CONFIG, 'routines', 'demo-pack', 'routine.json'), '{"id":"demo-pack"}\n', { mode: 0o600 });
  fs.mkdirSync(path.join(CONFIG, 'journal'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(CONFIG, 'journal', '2026-11-13.jsonl'), '{"t":1}\n', { mode: 0o600 });
  fs.mkdirSync(path.join(CONFIG, 'logs'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(CONFIG, 'logs', 'server.log'), 'panel log line one\npanel log line two\n', { mode: 0o600 });
  fs.writeFileSync(path.join(CONFIG, 'logs', 'routines.jsonl'), [
    JSON.stringify({ ts: '2026-11-13T08:00:00.000Z', run: 'r1', routine: 'morning-brief', state: 'started', trigger: 'manual' }),
    JSON.stringify({ ts: '2026-11-13T08:00:05.000Z', run: 'r1', routine: 'morning-brief', state: 'failed', error: 'no_agent', detail: 'no idle agent' }),
    JSON.stringify({ ts: '2026-11-13T09:00:00.000Z', run: 'r2', routine: 'review-reply-desk', state: 'draft_ready' }),
  ].join('\n') + '\n', { mode: 0o600 });
  fs.writeFileSync(path.join(PREFIX, 'manifest.json'), JSON.stringify({ panel: pkg.version, herdr: pin('HERDR_VERSION') }));
  // A browser opener that only records the URL it was given.
  fs.writeFileSync(path.join(TOOLS, 'xdg-open'), `#!/bin/sh\nprintf '%s\\n' "$1" > "${path.join(HOME, 'opened.txt')}"\n`, { mode: 0o755 });
});
test.after(() => {
  stopPanel();
  try { process.kill(Number(fs.readFileSync(path.join(CONFIG, 'herdr.pid'), 'utf8'))); } catch { /* none started */ }
  fs.rmSync(HOME, { recursive: true, force: true });
});

test('status without a service says the panel is started by hand', () => {
  const r = run(['status']);
  assert.notEqual(r.code, 0, 'stopped panel → non-zero');
  assert.match(r.out, /panel:\s+stopped/);
  assert.match(r.out, /service: none \(started by hand; after a reboot: operio-orca start\)/);
});

test('open hands the panel URL to the browser opener', () => {
  const r = run(['open']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, new RegExp(`opening http://127\\.0\\.0\\.1:${PORT}`));
  assert.equal(fs.readFileSync(path.join(HOME, 'opened.txt'), 'utf8').trim(), `http://127.0.0.1:${PORT}`);
});

test('logs: panel file, routines pretty-printed, missing herdr log', () => {
  let r = run(['logs']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /panel log: .*server\.log/);
  assert.match(r.out, /panel log line two/);
  r = run(['logs', 'panel', '-n', '1']);
  assert.doesNotMatch(r.out, /line one/);
  r = run(['logs', 'routines']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /2026-11-13 08:00:00  morning-brief  started \(manual\)/);
  assert.match(r.out, /morning-brief  failed  no_agent: no idle agent/);
  assert.match(r.out, /review-reply-desk  draft_ready/);
  r = run(['logs', 'herdr']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /no herdr log yet/);
  r = run(['logs', 'nope']);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /unknown logs option/);
});

test('doctor: stopped panel and a loose file mode fail with the fix; a healthy install passes', async () => {
  let r = run(['doctor']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /✓ Node\.js \d+/);
  assert.match(r.out, new RegExp(`✓ panel ${pkg.version.replace(/\./g, '\\.')} in `));
  assert.match(r.out, /· herdr checks skipped/);
  assert.match(r.out, new RegExp(`✗ panel not running \\(port ${PORT} is free\\)\\n\\s+fix: operio-orca start`));
  assert.match(r.out, /· no service: after a reboot run operio-orca start/);
  assert.match(r.out, /✓ settings folder .* \(mode 700\)/);
  assert.match(r.out, /✓ env \(mode 600\)/);
  assert.match(r.out, /✓ journal folder \(mode 700\)/);
  assert.match(r.out, /✓ listens on 127\.0\.0\.1 only/);
  assert.match(r.out, /✓ disk: \d+ MB free/);
  assert.match(r.out, /Send this output with any support request\.$/m);

  fs.chmodSync(path.join(CONFIG, 'env'), 0o644);
  fs.appendFileSync(path.join(CONFIG, 'env'), 'OPERIO_ORCA_ALLOWED_HOSTS=http://bad.example.com\n');
  r = run(['doctor']);
  assert.equal(r.code, 1);
  assert.match(r.out, new RegExp(`✗ env has mode 644\\n\\s+fix: chmod 600 ${path.join(CONFIG, 'env').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(r.out, /✗ OPERIO_ORCA_ALLOWED_HOSTS has an entry that is not a plain host name: http:\/\/bad\.example\.com/);
  fs.writeFileSync(path.join(CONFIG, 'env'), '# test settings\nOPERIO_ORCA_ALLOWED_HOSTS=my-laptop.example-tailnet.ts.net\n', { mode: 0o600 });
  fs.chmodSync(path.join(CONFIG, 'env'), 0o600);

  r = run(['start']);
  assert.equal(r.code, 0, r.out);
  assert.equal(await healthz(), 200);
  r = run(['doctor']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, new RegExp(`✓ panel answering at http://127\\.0\\.0\\.1:${PORT}`));
  assert.match(r.out, /✓ allowed hosts: my-laptop\.example-tailnet\.ts\.net/);
  assert.match(r.out, /✓ vapid\.json \(mode 600\)/, 'the panel created its push keys with mode 600');
  assert.doesNotMatch(r.out, /✗/);
});

test('update --check compares with the installer and installs nothing', async () => {
  // The file server is its own process: spawnSync below blocks this one.
  const srvDir = path.join(HOME, 'srv');
  fs.mkdirSync(srvDir, { recursive: true });
  const srv = spawn(process.execPath, ['-e',
    "const http=require('http'),fs=require('fs'),p=require('path');const d=process.argv[1];" +
    "http.createServer((q,s)=>{const f=p.join(d,'install.sh');if(q.url!=='/install.sh'||!fs.existsSync(f)){s.statusCode=404;return s.end('no')}s.setHeader('Content-Type','text/plain');s.end(fs.readFileSync(f))})" +
    ".listen(0,'127.0.0.1',function(){console.log(this.address().port)})", srvDir], { stdio: ['ignore', 'pipe', 'inherit'] });
  const sport = await new Promise(resolve => srv.stdout.once('data', d => resolve(Number(String(d).trim()))));
  const url = `http://127.0.0.1:${sport}/install.sh`;
  const serve = (text) => { if (text === null) fs.rmSync(path.join(srvDir, 'install.sh'), { force: true }); else fs.writeFileSync(path.join(srvDir, 'install.sh'), text); };
  try {
    serve(installer);
    let r = run(['update', '--check'], { OPERIO_ORCA_INSTALL_URL: url });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, new RegExp(`installed: panel ${pkg.version.replace(/\./g, '\\.')}, herdr ${pin('HERDR_VERSION').replace(/\./g, '\\.')}`));
    assert.match(r.out, new RegExp(`available: panel ${pkg.version.replace(/\./g, '\\.')}, herdr .* \\(panel sha256 ${pin('PANEL_SHA256').slice(0, 12)}`));
    assert.match(r.out, /up to date/);
    serve(installer.replace(/^PANEL_VERSION="[^"]*"/m, 'PANEL_VERSION="9.9.9"'));
    r = run(['update', '--check'], { OPERIO_ORCA_INSTALL_URL: url });
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /available: panel 9\.9\.9/);
    assert.match(r.out, /update available: run  operio-orca update/);
    serve(null);
    r = run(['update', '--check'], { OPERIO_ORCA_INSTALL_URL: url });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /could not download/);
    assert.ok(!fs.existsSync(path.join(PREFIX, 'app')), 'nothing was installed');
    r = run(['update', '--check'], { OPERIO_ORCA_INSTALL_URL: 'http://192.0.2.1/install.sh' });
    assert.equal(r.code, 1, 'plain http is only allowed to this computer');
  } finally { srv.kill(); }
});

test('backup writes a 0600 tar.gz without the logs; restore puts it back and keeps what was there', async () => {
  const before = fs.readFileSync(path.join(CONFIG, 'env'), 'utf8');
  let r = run(['backup']);
  assert.equal(r.code, 0, r.out);
  const defs = fs.readdirSync(HOME).filter(n => /^operio-orca-backup-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(n));
  assert.equal(defs.length, 1, 'default name (dated) in the current folder');
  const def = path.join(HOME, defs[0]);
  assert.equal(mode(def), '600');
  assert.match(r.out, /backup written: .*operio-orca-backup-.*\.tar\.gz \(.*, mode 600\)/);
  const members = tarList(def);
  for (const m of ['operio-orca/env', 'operio-orca/routines/demo-pack/routine.json', 'operio-orca/journal/2026-11-13.jsonl', 'operio-orca/vapid.json']) {
    assert.ok(members.includes(m), `${m} in the backup`);
  }
  assert.ok(!members.some(m => m.startsWith('operio-orca/logs')), 'logs are not in the backup');
  assert.ok(!members.some(m => m.endsWith('.pid')), 'the pid file is not in the backup');
  const named = path.join(HOME, 'named.tgz');
  r = run(['backup', 'named.tgz']);
  assert.equal(r.code, 0, r.out);
  assert.equal(mode(named), '600');

  // Running panel: restore refuses.
  assert.equal(await healthz(), 200);
  r = run(['restore', named]);
  assert.equal(r.code, 1);
  assert.match(r.out, /the panel is running; stop it first/);
  stopPanel();
  for (let i = 0; i < 20 && await healthz() === 200; i++) await new Promise(res => setTimeout(res, 100));

  // Change things, then restore.
  fs.appendFileSync(path.join(CONFIG, 'env'), 'OPERIO_ORCA_FOLDERS=~/changed\n');
  fs.rmSync(path.join(CONFIG, 'routines'), { recursive: true });
  fs.chmodSync(path.join(CONFIG, 'journal'), 0o755);
  r = run(['restore', named]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /restored .*named\.tgz into /);
  assert.equal(fs.readFileSync(path.join(CONFIG, 'env'), 'utf8'), before);
  assert.ok(fs.existsSync(path.join(CONFIG, 'routines', 'demo-pack', 'routine.json')));
  assert.equal(mode(CONFIG), '700');
  assert.equal(mode(path.join(CONFIG, 'journal')), '700');
  assert.equal(mode(path.join(CONFIG, 'env')), '600');
  assert.equal(mode(path.join(CONFIG, 'vapid.json')), '600');
  assert.ok(fs.existsSync(path.join(CONFIG, 'logs')), 'a fresh logs folder');
  const kept = fs.readdirSync(path.dirname(CONFIG)).filter(n => n.startsWith('operio-orca.before-restore-'));
  assert.equal(kept.length, 1, 'the previous folder is kept once');
  assert.match(fs.readFileSync(path.join(path.dirname(CONFIG), kept[0], 'env'), 'utf8'), /changed/);

  // Not a backup.
  const junk = path.join(HOME, 'junk.tgz');
  fs.mkdirSync(path.join(HOME, 'junkdir'), { recursive: true });
  fs.writeFileSync(path.join(HOME, 'junkdir', 'x.txt'), 'x');
  spawnSync('tar', ['-czf', junk, '-C', HOME, 'junkdir']);
  r = run(['restore', junk]);
  assert.equal(r.code, 1);
  assert.match(r.out, /is not an ORCA backup/);
});

// ─── llm: API keys for the agents in <config>/llm.env ─────────────────────────
const LLM = path.join(CONFIG, 'llm.env');
const KEY = 'sk-test-abcdefghijklmnop1234'; // the shape of a key, not one

test('llm: usage, set from stdin (never argv) into a 0600 file, list hides values, unset, doctor', () => {
  let r = run(['llm']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /operio-orca llm set NAME/);
  assert.match(r.out, /operio-orca llm test KIND/);
  assert.match(run(['help']).out, /operio-orca llm\s+API keys for your agents/);

  r = run(['llm', 'set', 'ANTHROPIC_API_KEY'], {}, HOME, KEY + '\n');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /saved ANTHROPIC_API_KEY \(\*\*\*\*1234\) in .*llm\.env \(mode 600\)/);
  assert.doesNotMatch(r.out, new RegExp(KEY), 'the value is never printed');
  assert.equal(mode(LLM), '600');
  assert.equal(fs.readFileSync(LLM, 'utf8').split('\n').filter(l => !l.startsWith('#')).join('\n').trim(), `ANTHROPIC_API_KEY=${KEY}`, 'one trailing newline stripped');
  r = run(['llm', 'set', 'OPENAI_BASE_URL'], {}, HOME, 'http://127.0.0.1:11434/v1');
  assert.equal(r.code, 0, r.out);
  r = run(['llm', 'set', 'ANTHROPIC_API_KEY'], {}, HOME, KEY + '5678\n');
  assert.equal(r.code, 0, r.out);
  assert.equal((fs.readFileSync(LLM, 'utf8').match(/^ANTHROPIC_API_KEY=/gm) || []).length, 1, 'set again replaces the line');

  // Refused: a value on the command line, an empty value, a bad name, a value with a space.
  r = run(['llm', 'set', 'OPENAI_API_KEY', KEY]);
  assert.equal(r.code, 1); assert.match(r.out, /never given on the command line/);
  r = run(['llm', 'set', 'OPENAI_API_KEY'], {}, HOME, '\n');
  assert.equal(r.code, 1); assert.match(r.out, /no value given/);
  r = run(['llm', 'set', 'openai_key'], {}, HOME, KEY);
  assert.equal(r.code, 1); assert.match(r.out, /NAME must be upper case/);
  r = run(['llm', 'set', 'OPENAI_API_KEY'], {}, HOME, 'two words');
  assert.equal(r.code, 1); assert.match(r.out, /cannot go in llm\.env/);
  assert.doesNotMatch(fs.readFileSync(LLM, 'utf8'), /OPENAI_API_KEY|two words/);

  r = run(['llm', 'list']);
  assert.equal(r.code, 0, r.out);
  assert.equal(r.stdout, 'OPENAI_BASE_URL  ****4/v1\nANTHROPIC_API_KEY  ****5678\n', 'file order; a name set again moves to the end');

  r = run(['doctor']);
  assert.match(r.out, /✓ llm\.env \(mode 600\): OPENAI_BASE_URL, ANTHROPIC_API_KEY/);
  fs.chmodSync(LLM, 0o644);
  r = run(['doctor']);
  assert.match(r.out, new RegExp(`✗ llm\\.env has mode 644 and holds API keys \\(OPENAI_BASE_URL, ANTHROPIC_API_KEY\\)\\n\\s+fix: chmod 600 ${LLM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.doesNotMatch(r.out, new RegExp(KEY));
  fs.chmodSync(LLM, 0o600);

  r = run(['llm', 'unset', 'OPENAI_BASE_URL']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /removed OPENAI_BASE_URL/);
  assert.match(run(['llm', 'unset', 'OPENAI_BASE_URL']).out, /was not set/);
  assert.match(run(['llm', 'list']).stdout, /^ANTHROPIC_API_KEY  \*\*\*\*5678\n$/);
  assert.equal(run(['llm', 'unset', 'ANTHROPIC_API_KEY']).code, 0);
  assert.match(run(['llm', 'list']).out, /no keys set/);
  assert.match(run(['llm', 'nope']).out, /unknown llm command: nope/);
});

test('llm apply: refuses while an agent works or waits, names it; idle with no pid on record says so', () => {
  const stateFile = path.join(FAKE, 'state.json');
  const st = { n: 2, agents: [
    { pane_id: 'w1:p1', tab_id: 'w1:t1', terminal_id: 'term1', name: 'alpha', agent: 'claude', agent_status: 'working', cwd: HOME },
    { pane_id: 'w1:p2', tab_id: 'w1:t2', terminal_id: 'term2', name: null, agent: 'codex', agent_status: 'blocked', cwd: HOME },
    { pane_id: 'w1:p3', tab_id: 'w1:t3', terminal_id: 'term3', name: 'gamma', agent: 'claude', agent_status: 'idle', cwd: HOME },
  ] };
  fs.writeFileSync(stateFile, JSON.stringify(st));
  let r = run(['llm', 'apply'], { OPERIO_ORCA_SKIP_HERDR: '0' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /not now: alpha, w1:p2 still working or waiting on you/);
  // With herdr checks skipped nothing is restarted either.
  r = run(['llm', 'apply']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /nothing restarted/);
  // Idle agents, SERVICE=none, herdr running but not started by ORCA: no pid to restart.
  st.agents.forEach(a => { a.agent_status = 'idle'; });
  fs.writeFileSync(stateFile, JSON.stringify(st));
  r = run(['llm', 'apply'], { OPERIO_ORCA_SKIP_HERDR: '0' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /herdr is running but ORCA did not start it \(no pid on record\), so it was not restarted/);
  assert.match(r.out, /herdr server stop/);
});

test('llm test: unknown kind, missing CLI, the key reaches the agent, a failure never shows the key', () => {
  fs.writeFileSync(path.join(TOOLS, 'claude'), '#!/bin/sh\n[ "$1" = -p ] || { echo "bad args: $*" >&2; exit 2; }\n' +
    'if [ -n "${ANTHROPIC_API_KEY:-}" ]; then echo ok; exit 0; fi\necho "Not logged in" >&2; exit 1\n', { mode: 0o755 });
  fs.writeFileSync(path.join(TOOLS, 'codex'), '#!/bin/sh\necho "auth error: invalid key $OPENAI_API_KEY for OPENAI_API_KEY=$OPENAI_API_KEY" >&2; exit 1\n', { mode: 0o755 });
  // Only the fakes plus what bash and node need: the real claude/gemini on this machine stay out.
  const PATH = [TOOLS, path.dirname(process.execPath), '/usr/bin', '/bin'].join(':');
  let r = run(['llm', 'test', 'foo'], { PATH });
  assert.equal(r.code, 1); assert.match(r.out, /unknown kind: foo \(claude, codex, opencode, gemini\)/);
  r = run(['llm', 'test'], { PATH });
  assert.equal(r.code, 1); assert.match(r.out, /usage: operio-orca llm test KIND/);
  r = run(['llm', 'test', 'gemini'], { PATH });
  assert.equal(r.code, 1); assert.equal(r.stdout, 'not installed: gemini\n');
  r = run(['llm', 'test', 'claude'], { PATH });
  assert.equal(r.code, 1, r.out); assert.equal(r.stdout, 'failed: Not logged in\n');
  run(['llm', 'set', 'ANTHROPIC_API_KEY'], {}, HOME, KEY);
  run(['llm', 'set', 'OPENAI_API_KEY'], {}, HOME, KEY);
  r = run(['llm', 'test', 'claude'], { PATH });
  assert.equal(r.code, 0, r.out); assert.equal(r.stdout, 'ok\n');
  r = run(['llm', 'test', 'codex'], { PATH });
  assert.equal(r.code, 1, r.out);
  assert.match(r.stdout, /^failed: auth error: invalid key \[secret\] for OPENAI_API_KEY=\[secret\]\n$/);
  assert.doesNotMatch(r.out, new RegExp(KEY));
});

test('start by hand records the herdr pid and loads llm.env into it; llm apply restarts it by that pid', async () => {
  // The panel is stopped and herdr checks are on: start brings up the sleepy herdr with the key.
  stopPanel();
  for (let i = 0; i < 20 && await healthz() === 200; i++) await new Promise(res => setTimeout(res, 100));
  const sleepy = { OPERIO_ORCA_SKIP_HERDR: '0', OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'sleepy-herdr') };
  let r = run(['start'], sleepy);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /starting a herdr server/);
  const pidFile = path.join(CONFIG, 'herdr.pid');
  const old = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.ok(old > 0);
  assert.equal(fs.readFileSync(path.join(FAKE, 'seen-key'), 'utf8').trim(), KEY, 'herdr started with the key in its environment');
  r = run(['llm', 'apply'], sleepy);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /restarted herdr \(pid \d+\); agents started from now on see the keys/);
  const now = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.notEqual(now, old);
  assert.throws(() => process.kill(old, 0), 'the old herdr is gone');
  process.kill(now, 0); // the new one is alive
  stopPanel();
  process.kill(now);
  for (let i = 0; i < 20; i++) { try { process.kill(now, 0); await new Promise(res => setTimeout(res, 100)); } catch { break; } }
  r = run(['llm', 'apply'], sleepy);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /herdr is not running; the keys load when it starts: operio-orca start/);
});
