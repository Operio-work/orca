'use strict';
// Nothing private may ship: internal hostnames, people's logins, private tooling or home
// paths. Terms are assembled from parts so this file never matches itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TERMS = [
  ['mega', 'byteisland'], ['ric', 'ardo'], ['syst', '3m64'], ['tailc', '302b8'], ['free', 'llm'],
  ['bw', 'rap'], ['paper', 'clip'], ['/home', '/sam'], ['gm', 'ail'],
].map(p => p.join(''));
// site/build and site/.svelte-kit are generated from files this test already reads.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'build', '.svelte-kit']);
const BINARY = /\.(png|webp|woff2|ico|jpg|gif)$/i;

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (e.isFile() && !BINARY.test(e.name)) yield p;
  }
}

test('no private strings anywhere in the repository', () => {
  const hits = [];
  for (const f of files(ROOT)) {
    const text = fs.readFileSync(f, 'utf8').toLowerCase();
    for (const term of TERMS) if (text.includes(term)) hits.push(`${path.relative(ROOT, f)}: ${term}`);
  }
  assert.deepEqual(hits, []);
});

// The panel links only to make.operio.work. The website (site/) may also send visitors to
// Operio's public contact form and the public operio.work home and partner pages.
const SITE_LINKS = /^https:\/\/(talk\.operio\.work|operio\.work(\/es)?(\/partners)?)\/?$/i;

test('the only Operio links are public pages', () => {
  const hits = [];
  for (const f of files(ROOT)) {
    const rel = path.relative(ROOT, f);
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/https?:\/\/[a-z0-9.-]*operio\.work[^\s"'`)<]*/gi)) {
      if (/^https:\/\/make\.operio\.work(?![a-z0-9.-])/i.test(m[0])) continue;
      if (rel.startsWith('site' + path.sep) && SITE_LINKS.test(m[0])) continue;
      hits.push(`${rel}: ${m[0]}`);
    }
  }
  assert.deepEqual(hits, []);
});
