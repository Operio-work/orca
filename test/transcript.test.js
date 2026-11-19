'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { blocks } = require('../lib/transcript');
const { chipsFor } = require('../chips');

const u = content => ({ type: 'user', message: { role: 'user', content } });
const as = content => ({ type: 'assistant', message: { role: 'assistant', content } });

test('keeps the exact text and folds tool calls', () => {
  const b = blocks([
    u('Fix the **reader**\nplease'),
    as([{ type: 'thinking', thinking: 'x' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls', description: 'List files' } }]),
    u([{ type: 'tool_result', tool_use_id: 't1', content: 'a' }]),
    as([{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/home/u/x/app.js' } }]),
    as([{ type: 'text', text: 'Done.\n\n- one\n- two' }]),
  ]);
  assert.deepStrictEqual(b.map(x => x.t), ['you', 'tools', 'say']);
  assert.strictEqual(b[0].text, 'Fix the **reader**\nplease');
  assert.deepStrictEqual(b[1].items, [{ name: 'Bash', what: 'List files' }, { name: 'Read', what: 'app.js' }]);
  assert.strictEqual(b[2].text, 'Done.\n\n- one\n- two');
});

test('drops CLI bookkeeping, sidechains and meta; shows slash commands', () => {
  const b = blocks([
    u('<local-command-stdout>ok</local-command-stdout>'),
    u('<command-name>/clear</command-name><command-args></command-args>'),
    { ...u('hidden'), isMeta: true },
    { ...as([{ type: 'text', text: 'sub' }]), isSidechain: true },
    u('hi <system-reminder>secret</system-reminder>'),
  ]);
  assert.deepStrictEqual(b, [{ t: 'you', text: '/clear' }, { t: 'you', text: 'hi' }]);
});

test('an unanswered AskUserQuestion becomes a trailing ask block', () => {
  const q = [{ question: 'Which?', header: 'H', options: [{ label: 'A' }, { label: 'B' }] }];
  const open = blocks([as([{ type: 'tool_use', id: 'q1', name: 'AskUserQuestion', input: { questions: q } }])]);
  assert.deepStrictEqual(open.at(-1), { t: 'ask', questions: q });
  const answered = blocks([as([{ type: 'tool_use', id: 'q1', name: 'AskUserQuestion', input: { questions: q } }]), u([{ type: 'tool_result', tool_use_id: 'q1', content: 'A' }])]);
  assert.notStrictEqual(answered.at(-1).t, 'ask');
});

test('chips: open questions get no Yes/No and no Explain chips', () => {
  const reply = 'Open points:\n1. TikTok: is the app approved yet?\n2. Approval wording: week or month?\n\nYour decisions:\n- Tiles: Reel covers (recommended), or static images?\n- Timing: one hour or 3 days?';
  const keys = chipsFor(reply).map(c => c.key);
  assert.ok(!keys.includes('yes') && !keys.some(k => k.startsWith('explain')));
  assert.ok(keys.includes('rec'));
  assert.deepStrictEqual(chipsFor('Fixed. Want me to deploy it now?').map(c => c.key).slice(0, 2), ['yes', 'no']);
  assert.ok(!chipsFor('Staging or prod?').some(c => c.key === 'yes'));
});
test('messages typed while busy show; a compaction is a marker; failed calls are marked', () => {
  const b = blocks([
    u('first'),
    { type: 'attachment', attachment: { type: 'queued_command', prompt: 'also check the tests', commandMode: 'prompt' } },
    { type: 'attachment', attachment: { type: 'queued_command', prompt: '<task-notification>x</task-notification>', commandMode: 'task-notification', isMeta: true } },
    { ...u('This session is being continued from a previous conversation…'), isCompactSummary: true },
    as([{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'rm x' } }, { type: 'tool_use', id: 'b2', name: 'Read', input: { file_path: '/a/b.js' } }]),
    u([{ type: 'tool_result', tool_use_id: 'b1', content: 'denied', is_error: true }, { type: 'tool_result', tool_use_id: 'b2', content: 'ok' }]),
  ]);
  assert.deepStrictEqual(b.map(x => x.t), ['you', 'you', 'note', 'tools']);
  assert.strictEqual(b[1].text, 'also check the tests');
  assert.deepStrictEqual(b[3].items, [{ name: 'Bash', what: 'rm x', err: true }, { name: 'Read', what: 'b.js' }]);
});

test('readBlocks: reads the whole file, then only what was added; a half-written line waits', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { readBlocks } = require('../lib/transcript');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tr-')), 's.jsonl');
  const line = e => JSON.stringify(e) + '\n';
  // Far more than the old 4 MB tail: early messages must still be there.
  const big = 'x'.repeat(200000);
  let body = line(u('the very first message'));
  for (let i = 0; i < 30; i++) body += line(as([{ type: 'tool_use', id: 'k' + i, name: 'Bash', input: { command: 'echo ' + i } }])) + line(u([{ type: 'tool_result', tool_use_id: 'k' + i, content: big }]));
  fs.writeFileSync(f, body);
  let b = readBlocks(f);
  assert.strictEqual(b[0].text, 'the very first message');
  assert.strictEqual(b[1].items.length, 30);
  const half = line(as([{ type: 'text', text: 'Done — ünïcode ✓' }]));
  fs.appendFileSync(f, half.slice(0, 20));
  b = readBlocks(f);
  assert.strictEqual(b.at(-1).t, 'tools');
  fs.appendFileSync(f, half.slice(20));
  b = readBlocks(f);
  assert.strictEqual(b.at(-1).text, 'Done — ünïcode ✓');
  assert.strictEqual(b.at(-1).n, 2);
  // A replaced, shorter file is read again from the start.
  fs.writeFileSync(f, line(u('new session')));
  assert.deepStrictEqual(readBlocks(f).map(x => x.text), ['new session']);
});
