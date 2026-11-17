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
