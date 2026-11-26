'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readStarters, viewStarters, starterProfile } = require('../lib/starters');
const { validate } = require('../lib/profiles');
const S = require('../lib/skills');

const ROOT = path.join(__dirname, '..');
const list = readStarters(path.join(ROOT, 'starters'));

test('every bundled starter is valid in both languages and uses only bundled skills', () => {
  const bundled = new Set(S.readBundledCatalog(path.join(ROOT, 'skills')).map(s => s.key));
  assert.deepEqual(list.map(s => s.id), ['communicator', 'writer', 'researcher', 'reporter', 'chaser']);
  for (const s of list) {
    for (const l of ['en', 'es']) {
      const p = validate(starterProfile(s, { lang: l }), { kinds: ['claude'] });
      assert.equal(p.label, s[l].label);
      assert.ok(p.instructions.length > 200, `${s.id}/${l} has real instructions`);
    }
    for (const k of s.skills) assert.ok(bundled.has(k), `${s.id} needs bundled skill ${k}`);
  }
});

test('a starter leaves out skills this panel does not have; the view marks added ones', () => {
  const w = list.find(s => s.id === 'writer');
  assert.deepEqual(starterProfile(w, { installed: new Set(['template-fill']) }).skills, ['template-fill']);
  const v = viewStarters(list, { lang: 'es', taken: new Set(['writer']) });
  assert.equal(v.find(s => s.id === 'writer').added, true);
  assert.equal(v.find(s => s.id === 'chaser').label, 'Seguimiento');
  assert.equal(viewStarters(list, { lang: 'xx' })[0].label, 'Communicator');
});
