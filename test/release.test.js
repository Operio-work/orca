'use strict';
// install.sh pins the panel release; these must agree with the repository.
// (The tarball's own sha256 is checked by scripts/release.sh --check and the site build.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const installer = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const pin = (k) => (installer.match(new RegExp(`^${k}="([^"]*)"`, 'm')) || [])[1];

test('install.sh pins this version, a sha256 and HTTPS URLs', () => {
  assert.equal(pin('PANEL_VERSION'), pkg.version);
  assert.match(pin('PANEL_SHA256'), /^[0-9a-f]{64}$/);
  assert.equal(pin('PANEL_URL'), 'https://make.operio.work/releases/free-orca-${PANEL_VERSION}.tar.gz');
  assert.match(pin('PANEL_MIRROR_URL'), /^https:\/\/github\.com\/operio-work\/free-orca\/releases\/download\//);
  assert.doesNotMatch(installer, /FREE_ORCA_PANEL_SHA256/, 'the sha256 must not be overridable');
});

test('CHANGELOG.md has a dated entry for this version', () => {
  const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  assert.match(log, new RegExp(`^## \\[${pkg.version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'));
});
