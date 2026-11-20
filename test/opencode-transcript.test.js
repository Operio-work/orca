'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch { /* Node 20: reader uses screen fallback */ }
const reader = require('../lib/opencode-transcript');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-transcript-'));
  const file = path.join(dir, 'opencode.db');
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE session (
    id TEXT PRIMARY KEY, directory TEXT, time_created INTEGER, time_updated INTEGER, model TEXT,
    tokens_input INTEGER, tokens_output INTEGER, tokens_reasoning INTEGER, tokens_cache_read INTEGER, tokens_cache_write INTEGER
  );
  CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT);
  CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT);`);
  const session = db.prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  session.run('ses_old123', '/work/project', 1000, 2000, JSON.stringify({ providerID: 'opencode' }), 10, 2, 0, 0, 0);
  session.run('ses_ollama1', '/work/project', 9000, 9000, JSON.stringify({ providerID: 'ollama' }), 2, 1, 0, 0, 0);
  session.run('ses_open123', '/work/project', 10000, 12000, JSON.stringify({ providerID: 'opencode' }), 42, 9, 3, 4, 1);
  const message = db.prepare('INSERT INTO message VALUES (?, ?, ?, ?)');
  const part = db.prepare('INSERT INTO part VALUES (?, ?, ?, ?, ?, ?)');
  const add = (id, role, ts, items, extra = {}) => {
    message.run(id, 'ses_open123', ts, JSON.stringify({ role, ...extra }));
    for (const [i, data] of items.entries()) part.run(`${id}-p${i}`, id, 'ses_open123', ts + i, ts + i, JSON.stringify(data));
  };
  add('m1', 'user', 11000, [{ type: 'text', text: 'Check the project' }]);
  add('m2', 'assistant', 11100, [
    { type: 'reasoning', text: 'private reasoning is omitted' },
    { type: 'text', text: 'I will inspect it.' },
    { type: 'tool', tool: 'read', state: { status: 'completed', input: { filePath: 'README.md' }, title: 'README.md', output: 'private tool output' } },
    { type: 'tool', tool: 'bash', state: { status: 'error', input: { command: 'npm test' }, error: 'failed' } },
  ]);
  add('m3', 'assistant', 11200, [
    { type: 'tool', tool: 'question', state: { status: 'running', input: { questions: [{ header: 'Choice', question: 'Which branch?', options: [{ label: 'Main', description: 'Stable' }, { label: 'Feature' }] }] } } },
  ]);
  db.prepare('UPDATE session SET time_updated = 12000 WHERE id = ?').run('ses_open123');
  db.close();
  return { dir, file };
}

test('Node without node:sqlite returns no session data so callers keep using the screen Reader', () => {
  let loads = 0;
  const fallback = reader.createReader({ loadSqlite() { loads++; throw new Error('module unavailable'); } });
  assert.equal(loads, 0, 'SQLite is loaded lazily');
  assert.equal(fallback.findSession('/unused/opencode.db', { cwd: '/work/project' }), null);
  assert.equal(fallback.read('/unused/opencode.db', 'ses_open123'), null);
  assert.equal(loads, 0, 'missing files do not attempt to load SQLite');
  const file = path.join(os.tmpdir(), `missing-opencode-db-${process.pid}`);
  fs.writeFileSync(file, 'fixture');
  try {
    assert.equal(fallback.read(file, 'ses_open123'), null);
    assert.equal(loads, 1);
  } finally { fs.rmSync(file, { force: true }); }
});

test('maps a session by directory and start time, including Ollama sessions', { skip: !DatabaseSync }, () => {
  const f = fixture();
  try {
    assert.equal(reader.findSession(f.file, { cwd: '/work/project', since: 8000, kind: 'opencode' }), 'ses_open123');
    assert.equal(reader.findSession(f.file, { cwd: '/work/project', since: 8000, kind: 'ollama' }), 'ses_ollama1');
    assert.equal(reader.findSession(f.file, { cwd: '/work/project', since: 8000, kind: 'opencode', known: 'ses_old123' }), 'ses_old123');
    assert.equal(reader.findSession(f.file, { cwd: '/elsewhere', since: 8000, kind: 'opencode' }), null);
  } finally { reader.close(f.file); fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('reads transcript blocks, unanswered questions, errors, stable delta ids and token totals', { skip: !DatabaseSync }, () => {
  const f = fixture();
  try {
    const first = reader.read(f.file, 'ses_open123');
    assert.deepEqual(first.blocks.map(b => b.t), ['you', 'say', 'tools', 'ask']);
    assert.equal(first.blocks[0].text, 'Check the project');
    assert.equal(first.blocks[1].text, 'I will inspect it.');
    assert.deepEqual(first.blocks[2].items, [
      { name: 'Read', what: 'README.md' },
      { name: 'Bash', what: 'npm test', err: true },
      { name: 'Question', what: '' },
    ]);
    assert.deepEqual(first.blocks.at(-1).questions[0], {
      question: 'Which branch?', header: 'Choice', options: [{ label: 'Main', description: 'Stable' }, { label: 'Feature' }],
    });
    assert.deepEqual(first.usage, { input: 42, output: 9, total: 51 });
    assert.equal(first.blocks.some(b => JSON.stringify(b).includes('private reasoning')), false);
    assert.equal(first.blocks.some(b => JSON.stringify(b).includes('private tool output')), false);
    assert.strictEqual(reader.read(f.file, 'ses_open123'), first);
    const db = new DatabaseSync(f.file);
    db.prepare('INSERT INTO message VALUES (?, ?, ?, ?)').run('m4', 'ses_open123', 13000, JSON.stringify({ role: 'assistant' }));
    db.prepare('INSERT INTO part VALUES (?, ?, ?, ?, ?, ?)').run('m4-p0', 'm4', 'ses_open123', 13001, 13001, JSON.stringify({ type: 'text', text: 'Finished.' }));
    db.prepare('UPDATE session SET time_updated = 13001, tokens_input = 50, tokens_output = 10 WHERE id = ?').run('ses_open123');
    db.close();
    const next = reader.read(f.file, 'ses_open123');
    assert.notEqual(next.rev, first.rev);
    assert.deepEqual(next.blocks.slice(0, 2).map(b => b.n), first.blocks.slice(0, 2).map(b => b.n));
    assert.equal(next.blocks.at(-2).text, 'Finished.');
    assert.deepEqual(next.usage, { input: 50, output: 10, total: 60 });
  } finally { reader.close(f.file); fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('recognizes OpenCode permission and confirmation menus in key order', () => {
  const first = reader.permissionMenu('Permission required\nAllow once\nAllow always\nReject');
  assert.equal(first.keyMode, 'opencode-choice');
  assert.deepEqual(first.options.map(o => [o.n, o.label]), [[1, 'Allow once'], [2, 'Allow always'], [3, 'Reject']]);
  assert.equal(first.options[1].risky, true);
  const confirm = reader.permissionMenu('This will allow the following patterns until OpenCode is restarted\nConfirm\nCancel');
  assert.deepEqual(confirm.options.map(o => [o.n, o.label]), [[1, 'Confirm'], [2, 'Cancel']]);
  assert.equal(reader.permissionMenu('ordinary output'), null);
});
