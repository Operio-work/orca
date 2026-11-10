'use strict';
// Reader view (public/reader.js): the terminal mirror laid out as a conversation.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/reader');

test('reader: your messages, replies, tool work and a question menu each land in the right block', () => {
  const text = [
    '❯ draft the weekly specials',
    '',
    '● Read(menu.md)',
    '  ⎿  Read 40 lines',
    '',
    '● Drafted three specials for the week.',
    '  Each one uses what is in stock.',
    '',
    '❯ 1. Post them',
    '  2. Keep as draft',
    '',
    '────────────────────────────────────────',
    '❯ unsent draft',
    '────────────────────────────────────────',
  ].join('\n');
  const blocks = R.parse(text);
  assert.deepEqual(blocks.map(b => b.t), ['you', 'tools', 'say', 'say']);
  assert.match(blocks[0].lines.join(' '), /draft the weekly specials/);
  assert.equal(blocks[3].plain, true); // the menu reads as the agent's, not as yours
  assert.doesNotMatch(JSON.stringify(blocks), /unsent draft/);
});
