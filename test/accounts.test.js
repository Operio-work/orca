'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAccounts } = require('../lib/accounts');

const KEY = 'AIzaFakeKeyForTests_0123456789abcdef';
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-'));
  const home = path.join(root, 'home'), cfg = path.join(root, 'cfg');
  fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(home, '.gemini', 'settings.json'), '{"security":{"auth":{"selectedType":"oauth-personal"}},"ui":{"theme":"x"}}');
  fs.writeFileSync(path.join(home, '.gemini', 'GEMINI.md'), '# skills');
  fs.writeFileSync(path.join(home, '.codex', 'AGENTS.md'), '# skills');
  return { home, cfg, acc: createAccounts({ configDir: cfg, home }) };
}

test('defaults: login kinds show their sign-in state; gemini has no usable default', () => {
  const { acc } = setup();
  assert.deepStrictEqual(acc.list().map(a => [a.kind, a.id, a.signedIn]), [['claude', 'default', false], ['codex', 'default', false], ['agy', 'default', null]]);
  assert.strictEqual(acc.startFor('codex', 'default'), null);
  assert.throws(() => acc.startFor('gemini', 'default'), e => e.code === 'needs_account');
});

test('login account: own 0700 folder, settings carried over, sign-in command', () => {
  const { acc, home } = setup();
  const a = acc.add({ kind: 'codex', label: '  work  ' });
  assert.strictEqual(a.label, 'work');
  const s = acc.startFor('codex', a.id);
  const dir = s.exports[0][1];
  assert.deepStrictEqual([s.exports[0][0], s.source, s.args], ['CODEX_HOME', null, []]);
  assert.strictEqual(fs.statSync(dir).mode & 0o777, 0o700);
  assert.strictEqual(fs.readlinkSync(path.join(dir, 'AGENTS.md')), path.join(home, '.codex', 'AGENTS.md'));
  const row = acc.list().find(x => x.id === a.id);
  assert.strictEqual(row.signedIn, false);
  assert.match(row.login, /^CODEX_HOME=\S+ codex login$/);
});

test('gemini key account: api-key auth, key file 0600, key never listed', () => {
  const { acc } = setup();
  assert.throws(() => acc.add({ kind: 'gemini', label: 'g', key: 'short' }), e => e.code === 'bad_key');
  const a = acc.add({ kind: 'gemini', label: 'second', key: KEY });
  const s = acc.startFor('gemini', a.id);
  const dir = s.exports[0][1];
  assert.strictEqual(s.exports[0][0], 'GEMINI_CLI_HOME');
  const set = JSON.parse(fs.readFileSync(path.join(dir, '.gemini', 'settings.json'), 'utf8'));
  assert.deepStrictEqual([set.security.auth.selectedType, set.ui.theme], ['gemini-api-key', 'x']);
  assert.strictEqual(fs.statSync(s.source).mode & 0o777, 0o600);
  assert.strictEqual(fs.readFileSync(s.source, 'utf8'), `GEMINI_API_KEY=${KEY}\n`);
  const row = acc.list().find(x => x.id === a.id);
  assert.deepStrictEqual([row.signedIn, row.key, row.login], [true, true, null]);
  assert.ok(!JSON.stringify(acc.list()).includes(KEY));
});

test('one Google key account runs gemini and agy', () => {
  const { acc } = setup();
  const a = acc.add({ kind: 'gemini', label: 'zen' });
  assert.throws(() => acc.startFor('agy', a.id), e => e.code === 'needs_key');
  const row = acc.list().find(x => x.id === a.id);
  assert.deepStrictEqual([row.kind, row.signedIn, row.kinds], ['gemini', false, ['gemini', 'agy']]);
  assert.strictEqual(acc.list().filter(x => x.id === a.id).length, 1);
  acc.setKey(a.id, KEY);
  const s = acc.startFor('agy', a.id);
  assert.deepStrictEqual(s.exports, []);
  assert.strictEqual(s.args[0], '--settings');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(s.args[1], 'utf8')), { modelProvider: 'gemini' });
  assert.strictEqual(acc.startFor('gemini', a.id).exports[0][0], 'GEMINI_CLI_HOME');
  assert.throws(() => acc.startFor('codex', a.id), e => e.code === 'bad_account');
  assert.throws(() => acc.setKey(a.id, 'has spaces in it and is long enough'), e => e.code === 'bad_key');
});

test('rules: kind must match, names unique per kind, remove deletes the folder', () => {
  const { acc } = setup();
  const a = acc.add({ kind: 'codex', label: 'work' });
  assert.throws(() => acc.startFor('claude', a.id), e => e.code === 'bad_account');
  assert.throws(() => acc.add({ kind: 'codex', label: 'WORK' }), e => e.code === 'account_exists');
  assert.throws(() => acc.add({ kind: 'nope', label: 'x' }), e => e.code === 'bad_kind');
  assert.throws(() => acc.add({ kind: 'codex', label: ' ' }), e => e.code === 'account_name');
  assert.throws(() => acc.add({ kind: 'codex', label: 'k', key: KEY }), e => e.code === 'bad_key');
  acc.rename('codex', 'default', 'main');
  assert.throws(() => acc.add({ kind: 'codex', label: 'main' }), e => e.code === 'account_exists');
  const dir = acc.startFor('codex', a.id).exports[0][1];
  assert.ok(acc.remove(a.id));
  assert.ok(!fs.existsSync(dir));
  assert.strictEqual(acc.remove(a.id), false);
});
