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
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const BINARY = /\.(png|woff2|ico|jpg|gif)$/i;

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

test('the only Operio link is the public make.operio.work site', () => {
  const hits = [];
  for (const f of files(ROOT)) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/https?:\/\/[a-z0-9.-]*operio\.work[^\s"'`)<]*/gi)) {
      if (!/^https:\/\/make\.operio\.work(\/|$)/i.test(m[0])) hits.push(`${path.relative(ROOT, f)}: ${m[0]}`);
    }
  }
  assert.deepEqual(hits, []);
});
