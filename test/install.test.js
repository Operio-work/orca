'use strict';
// install.sh on a Linux box without a systemd --user session (Ubuntu under WSL2 before systemd is
// turned on): the install must end with the panel running, started by hand, and print the recipe
// that makes it start with Ubuntu. Runs only when a local herdr binary matches the pinned sha256
// (nothing is downloaded by the tests); otherwise it is skipped.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const installer = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
const pin = (k) => (installer.match(new RegExp(`^${k}="([^"]*)"`, 'm')) || [])[1];
const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const want = pin(`HERDR_SHA256_linux_${arch}`);

function localHerdr() {
  if (process.platform !== 'linux' || !want) return null;
  const dirs = [path.join(os.homedir(), '.local', 'share', 'operio-orca', 'bin'), path.join(os.homedir(), '.local', 'bin'), ...(process.env.PATH || '').split(':')];
  for (const d of dirs) {
    const f = path.join(d, 'herdr');
    try {
      const real = fs.realpathSync(f);
      if (!fs.statSync(real).isFile()) continue;
      if (crypto.createHash('sha256').update(fs.readFileSync(real)).digest('hex') === want) return real;
    } catch { /* not here */ }
  }
  return null;
}
const herdr = localHerdr();

test('install.sh without systemd (WSL2) starts the panel by hand and prints the systemd recipe',
  { skip: herdr ? false : 'needs a local herdr binary with the pinned sha256', timeout: 240000 }, async () => {
    const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'oo-wsl-'));
    const PORT = 21000 + Math.floor(Math.random() * 20000);
    const CONFIG = path.join(HOME, '.config', 'operio-orca');
    const FAKE = path.join(HOME, 'fake-herdr');
    const TOOLS = path.join(HOME, 'tools');
    fs.mkdirSync(CONFIG, { recursive: true, mode: 0o700 });
    fs.mkdirSync(FAKE, { recursive: true });
    fs.mkdirSync(TOOLS, { recursive: true });
    fs.writeFileSync(path.join(CONFIG, 'env'), `OPERIO_ORCA_PORT=${PORT}\n`, { mode: 0o600 });
    fs.writeFileSync(path.join(TOOLS, 'systemctl'), '#!/bin/sh\nexit 1\n', { mode: 0o755 }); // no user session here
    const env = {
      PATH: `${TOOLS}:${process.env.PATH}`, HOME, TMPDIR: HOME, WSL_DISTRO_NAME: 'Ubuntu',
      OPERIO_ORCA_HERDR_FILE: herdr, // the installer verifies it against the pinned sha256
      // The panel started at the end talks to the fake herdr and never starts a real server.
      OPERIO_ORCA_SKIP_HERDR: '1', OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'), FAKE_HERDR_DIR: FAKE,
      OPERIO_ORCA_AGENT_SOCK: path.join(HOME, 'a.sock'),
      NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    };
    const cli = path.join(HOME, '.local', 'bin', 'operio-orca');
    const healthz = () => new Promise(resolve => {
      http.get({ host: '127.0.0.1', port: PORT, path: '/healthz', headers: { Host: `127.0.0.1:${PORT}` } }, r => { r.resume(); resolve(r.statusCode); }).on('error', () => resolve(0));
    });
    try {
      const r = spawnSync('bash', [path.join(ROOT, 'install.sh'), '--source', ROOT], { env, cwd: HOME, encoding: 'utf8', timeout: 200000 });
      const out = (r.stdout || '') + (r.stderr || '');
      assert.equal(r.status, 0, out);
      assert.match(out, /WSL without systemd: ORCA cannot start with Ubuntu yet/);
      assert.match(out, new RegExp(`running at http://127\\.0\\.0\\.1:${PORT}`), 'the install ends with the panel running');
      assert.match(out, /printf '\[boot\]\\nsystemd=true\\n' \| sudo tee -a \/etc\/wsl\.conf/);
      assert.match(out, /wsl --shutdown/);
      assert.match(out, /curl -fsSL https:\/\/make\.operio\.work\/install\.sh \| bash/);
      assert.match(fs.readFileSync(path.join(HOME, '.local', 'share', 'operio-orca', 'install.env'), 'utf8'), /^SERVICE="none"$/m);
      // Both units load the agents' API keys (operio-orca llm); "-" so a missing file is fine.
      for (const unit of ['operio-orca-herdr.service', 'operio-orca.service']) {
        const text = fs.readFileSync(path.join(HOME, '.config', 'systemd', 'user', unit), 'utf8');
        assert.match(text, /^EnvironmentFile=-%h\/\.config\/operio-orca\/llm\.env$/m, `${unit} loads llm.env`);
        assert.ok(text.indexOf('EnvironmentFile=') < text.indexOf('ExecStart='), `${unit}: EnvironmentFile before ExecStart`);
      }
      assert.match(out, /API keys:\s+operio-orca llm set ANTHROPIC_API_KEY/);
      assert.equal(await healthz(), 200);
      const st = spawnSync('bash', [cli, 'status'], { env, encoding: 'utf8' });
      assert.match(st.stdout, /service: none \(started by hand; after a reboot: operio-orca start\)/);
      assert.match(st.stdout, new RegExp(`panel:\\s+running at http://127\\.0\\.0\\.1:${PORT}`));
      const dr = spawnSync('bash', [cli, 'doctor'], { env, encoding: 'utf8' });
      assert.match(dr.stdout, /· no service \(WSL2 without systemd\)/);
    } finally {
      if (fs.existsSync(cli)) spawnSync('bash', [cli, 'stop'], { env, encoding: 'utf8' });
      try { process.kill(Number(fs.readFileSync(path.join(CONFIG, 'operio-orca.pid'), 'utf8'))); } catch { /* gone */ }
      fs.rmSync(HOME, { recursive: true, force: true });
    }
  });
