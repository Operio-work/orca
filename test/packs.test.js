'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readStarters } = require('../lib/starters');
const P = require('../lib/packs');
const { validate } = require('../lib/profiles');

const ROOT = path.join(__dirname, '..');
const starters = readStarters(path.join(ROOT, 'starters'));
const bundle = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'demo-pack.json'), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orca-packs-'));

test('a bundle is checked before anything is written: paths, ids, agents, routines', () => {
  const bad = (fn, re) => { const b = bundle(); fn(b); assert.throws(() => P.checkBundle(b, starters), re); };
  bad(b => { b.files['../evil.md'] = 'x'; }, /bad file path/);
  bad(b => { b.files['templates/.hidden'] = 'x'; }, /bad file path/);
  bad(b => { b.files['other/x.md'] = 'x'; }, /bad file path/);
  bad(b => { b.files['templates/bin.md'] = 'a\u0000b'; }, /not a text file/);
  bad(b => { b.pack.id = 'other'; }, /bad pack id/);
  bad(b => { b.pack.folder = '/etc'; }, /folder/);
  bad(b => { b.pack.agents[0].base = 'nobody'; }, /unknown starter/);
  bad(b => { b.pack.routines[0].schedule = 'every day'; }, /routine/);
  assert.doesNotThrow(() => P.checkBundle(bundle(), starters));
});

test('add stores the pack and installs its skills; add again replaces it; remove takes it off the list', () => {
  const dir = tmp(), packsDir = path.join(dir, 'packs');
  const installed = [];
  const r = P.addBundle(bundle(), { packsDir, starters, installSkill: s => { installed.push(s.key); return { key: s.key }; } });
  assert.deepEqual([r.id, r.files, r.skills], ['demo-bakery', 2, ['test-cakes']]);
  assert.deepEqual(installed, ['test-cakes']);
  assert.ok(fs.existsSync(path.join(packsDir, 'demo-bakery', 'templates', 'cake-quote.md')));
  const b2 = bundle(); b2.version = '2'; delete b2.files['examples/README.md'];
  P.addBundle(b2, { packsDir, starters, installSkill: s => ({ key: s.key }) });
  assert.ok(!fs.existsSync(path.join(packsDir, 'demo-bakery', 'examples', 'README.md')), 'replaced, not merged');
  assert.deepEqual(P.listPacks(packsDir), [{ id: 'demo-bakery', version: '2' }]);
  const [pk] = P.readPacks(packsDir, starters);
  for (const a of pk.agents) for (const l of ['en', 'es']) validate(P.packProfile(a, { lang: l }), { kinds: ['claude'] });
  assert.match(pk.agents[0].en.instructions, /^## This business\n\nYou work for a bakery/);
  assert.equal(P.removePack('demo-bakery', packsDir), true);
  assert.equal(P.removePack('demo-bakery', packsDir), false);
  assert.deepEqual(P.listPacks(packsDir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
