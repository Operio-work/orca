'use strict';
// THIRD_PARTY_NOTICES.md must list every npm package the installer installs, every crate in
// herdr's release binary (as found by cargo-about, scripts/notices/herdr-<version>-crates.tsv),
// and every vendored file set in public/. Regenerate with: node scripts/notices.js [--herdr-src DIR]
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const notices = fs.readFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
const installer = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
const HERDR_VERSION = installer.match(/^HERDR_VERSION="([^"]+)"/m)[1];

function section(name) {
  const m = notices.match(new RegExp(`<!-- ${name}:begin[^>]*-->([\\s\\S]*?)<!-- ${name}:end -->`));
  assert.ok(m, `THIRD_PARTY_NOTICES.md has no ${name} section`);
  return m[1];
}
function rows(text, cols) {
  const out = new Map();
  for (const line of text.split('\n')) {
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < cols || cells[0] === '' || /^-+$/.test(cells[0]) || /^(Package|Crate)$/.test(cells[0])) continue;
    out.set(`${cells[0]}@${cells[1]}`, cells[2]);
  }
  return out;
}

// Permissive licenses (SPDX ids); anything else must be named in ALLOWED_EXCEPTIONS.
const PERMISSIVE = new Set(['MIT', 'Apache-2.0', 'Apache-2.0 WITH LLVM-exception', 'BSD-2-Clause', 'BSD-3-Clause',
  'ISC', 'Zlib', '0BSD', 'Unlicense', 'BSL-1.0', 'Unicode-DFS-2016', 'Unicode-3.0']);
const ALLOWED_EXCEPTIONS = new Map([['web-push', 'MPL-2.0']]); // unmodified, installed from npm
function permissive(expr) {
  // "A OR B": one permissive choice is enough. "A AND B": all must be permissive.
  return expr.replace(/[()]/g, '').split(/\s+OR\s+|\//).some(alt =>
    alt.split(/\s+AND\s+/).every(id => PERMISSIVE.has(id.trim())));
}

test('every npm package in package-lock.json is listed with its version and license', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const listed = rows(section('npm'), 3);
  const want = new Set();
  for (const [key, meta] of Object.entries(lock.packages)) {
    if (!key || meta.dev) continue;
    const name = key.replace(/^.*node_modules\//, '');
    want.add(`${name}@${meta.version}`);
    assert.ok(listed.has(`${name}@${meta.version}`), `${name} ${meta.version} is not in THIRD_PARTY_NOTICES.md`);
    const pkgFile = path.join(ROOT, key, 'package.json');
    if (fs.existsSync(pkgFile)) {
      const lic = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).license;
      assert.equal(listed.get(`${name}@${meta.version}`), lic, `${name}: license differs from its package.json`);
    }
  }
  assert.deepEqual([...listed.keys()].filter(k => !want.has(k)), [], 'listed packages that are not in the lock file');
});

test(`every crate cargo-about found in herdr ${HERDR_VERSION} is listed, with a license text`, () => {
  const tsvFile = path.join(ROOT, 'scripts', 'notices', `herdr-${HERDR_VERSION}-crates.tsv`);
  assert.ok(fs.existsSync(tsvFile), `missing ${path.relative(ROOT, tsvFile)}; run scripts/notices.js --herdr-src`);
  const found = new Map(fs.readFileSync(tsvFile, 'utf8').trim().split('\n').map(l => {
    const [name, version, license] = l.split('\t');
    return [`${name}@${version}`, license];
  }));
  assert.ok(found.size > 100, 'the crate list looks truncated');
  const body = section('crates');
  const listed = rows(body.split(/^Licenses in use:/m)[0], 3); // the table only, not the license texts
  assert.deepEqual([...found.keys()].filter(k => !listed.has(k)), [], 'crates missing from the table');
  assert.deepEqual([...listed.keys()].filter(k => !found.has(k)), [], 'crates in the table that cargo-about did not find');
  for (const [k, lic] of found) assert.equal(listed.get(k), lic, `${k}: license differs`);
  const usedBy = new Set();
  for (const m of body.matchAll(/^Used by: (.*)$/gm)) for (const c of m[1].split(', ')) usedBy.add(c.replace(' ', '@'));
  assert.deepEqual([...found.keys()].filter(k => !usedBy.has(k)), [], 'crates without a license text');
});

test('every vendored file set in public/ has its license shipped and is listed', () => {
  for (const dir of fs.readdirSync(path.join(ROOT, 'public', 'vendor'))) {
    assert.ok(notices.includes(`public/vendor/${dir}/`), `public/vendor/${dir} is not in THIRD_PARTY_NOTICES.md`);
    const files = fs.readdirSync(path.join(ROOT, 'public', 'vendor', dir));
    assert.ok(files.some(f => /^LICENSE/i.test(f)), `public/vendor/${dir} has no LICENSE file`);
  }
  const fonts = fs.readdirSync(path.join(ROOT, 'public', 'fonts'));
  for (const f of fonts.filter(f => f.endsWith('.woff2'))) {
    const family = f.startsWith('inter-') ? 'Inter' : f.startsWith('jetbrains-mono-') ? 'JetBrainsMono' : null;
    assert.ok(family, `unknown font ${f}: add it to THIRD_PARTY_NOTICES.md and this test`);
    assert.ok(fonts.includes(`LICENSE-${family}.txt`), `no license file for ${f}`);
    assert.ok(notices.includes(`public/fonts/LICENSE-${family}.txt`), `${family} is not in THIRD_PARTY_NOTICES.md`);
  }
});

test('every listed license is permissive, or a named exception', () => {
  const bad = [];
  for (const name of ['npm', 'crates']) {
    for (const [k, lic] of rows(section(name).split(/^Licenses in use:/m)[0], 3)) {
      const pkg = k.slice(0, k.lastIndexOf('@'));
      if (ALLOWED_EXCEPTIONS.get(pkg) === lic) continue;
      if (!permissive(lic)) bad.push(`${k}: ${lic}`);
    }
  }
  assert.deepEqual(bad, []);
});
