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
