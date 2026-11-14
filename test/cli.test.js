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
const run = (args, extra = {}, cwd = HOME) => {
  const r = spawnSync('bash', [CLI, ...args], { env: env(extra), cwd, encoding: 'utf8', timeout: 60000 });
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
test.after(() => { stopPanel(); fs.rmSync(HOME, { recursive: true, force: true }); });

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
