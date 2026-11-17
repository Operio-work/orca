'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createTools, validate } = require('../lib/tools');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tools-'));
const code = (fn, c) => assert.throws(fn, e => e.code === c || e.detail === c);
const GH = { id: 'github', name: 'GitHub', type: 'http', url: 'https://api.example.com/mcp/', headers: { Authorization: 'Bearer ${GH_TOKEN}' } };
const FS = { id: 'notes', type: 'stdio', command: 'npx', args: ['-y', 'some-mcp', '--dir', '/home/u/notes'], env: { API_KEY: '${NOTES_KEY}' } };

test('validate: stdio and http shapes, bad input refused', () => {
  assert.deepStrictEqual(validate(FS).args, FS.args);
  assert.strictEqual(validate(GH).headers.Authorization, 'Bearer ${GH_TOKEN}');
  code(() => validate({ ...FS, id: 'Bad Id' }), 'id');
  code(() => validate({ ...FS, type: 'sse' }), 'type');
  code(() => validate({ ...FS, command: '' }), 'command');
  code(() => validate({ ...FS, args: ['a\nb'] }), 'args');
  code(() => validate({ ...GH, url: 'ftp://x' }), 'url');
  assert.throws(() => validate({ ...FS, env: { PATH: '/evil' } }), e => e.code === 'bad_tool');
  assert.throws(() => validate({ ...FS, env: { LD_PRELOAD: 'x' } }), e => e.code === 'bad_tool');
});

test('secrets: 0600, write-only view shows what is missing, quotes survive', () => {
  const dir = tmp(); const t = createTools({ configDir: dir });
  t.put(GH); t.put(FS);
  assert.deepStrictEqual(t.view().map(x => [x.id, x.missing]), [['github', ['GH_TOKEN']], ['notes', ['NOTES_KEY']]]);
  t.setSecret('GH_TOKEN', "it's-a-token");
  assert.strictEqual(fs.statSync(t.SECRETS).mode & 0o777, 0o600);
  assert.deepStrictEqual(t.secretNames(), ['GH_TOKEN']);
  assert.ok(!JSON.stringify(t.view()).includes("it's-a-token"));
  code(() => t.setSecret('PATH', 'x'), 'bad_secret_name');
  code(() => t.setSecret('A', 'x\ny'), 'bad_secret');
  t.setSecret('GH_TOKEN', '');
  assert.deepStrictEqual(t.secretNames(), []);
});

test('run files: only the chosen servers and only their secrets', () => {
  const dir = tmp(); const t = createTools({ configDir: dir });
  t.put(GH); t.put(FS);
  t.setSecret('GH_TOKEN', "tok'en"); t.setSecret('NOTES_KEY', 'nk'); t.setSecret('OTHER', 'never-shared');
  const run = path.join(dir, 'runs', 'a');
  const r = t.writeRun(run, ['github', 'gone']);
  assert.deepStrictEqual(r.ids, ['github']);
  const conf = JSON.parse(fs.readFileSync(r.mcpFile, 'utf8'));
  assert.deepStrictEqual(Object.keys(conf.mcpServers), ['github']);
  assert.strictEqual(conf.mcpServers.github.headers.Authorization, 'Bearer ${GH_TOKEN}'); // filled by Claude from env
  const env = fs.readFileSync(r.envFile, 'utf8');
  assert.strictEqual(env, "GH_TOKEN='tok'\\''en'\n");
  assert.strictEqual(fs.statSync(r.envFile).mode & 0o777, 0o600);
  assert.strictEqual(t.writeRun(run, ['nothing']), null);
  t.setSecret('NOTES_KEY', '');
  code(() => t.writeRun(run, ['notes']), 'secret_missing');
});
