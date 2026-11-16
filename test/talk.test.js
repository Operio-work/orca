'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { talkView } = require('../lib/talk');

const byTerminal = new Map([['t1', { pane: 'p1' }], ['t2', { pane: 'p2' }], ['t3', { pane: 'p3' }]]);

test('groups both directions into one pair and keeps the latest sender', () => {
  const out = talkView([
    { from: 't1', to: 't2', at: 100, via: 'agent', state: 'sent' },
    { from: 't2', to: 't1', at: 200, via: 'agent', state: 'queued' },
  ], byTerminal, 0);
  assert.deepStrictEqual(out, [{ a: 'p1', b: 'p2', n: 2, queued: 1, lastAt: 200, lastFrom: 'p2', lastTo: 'p1' }]);
});

test('skips intros, old messages, unknown and self messages', () => {
  const out = talkView([
    { from: 't1', to: 't2', at: 100, via: 'intro', state: 'sent' },
    { from: 't1', to: 't3', at: 5, via: 'agent', state: 'sent' },
    { from: 't1', to: 'gone', at: 100, via: 'agent', state: 'sent' },
    { from: 't1', to: 't1', at: 100, via: 'agent', state: 'sent' },
    { from: 't3', to: 't2', at: 100, via: 'handoff', state: 'sent' },
  ], byTerminal, 50);
  assert.deepStrictEqual(out, [{ a: 'p2', b: 'p3', n: 1, queued: 0, lastAt: 100, lastFrom: 'p3', lastTo: 'p2' }]);
});

test('never carries message text', () => {
  const [p] = talkView([{ from: 't1', to: 't2', at: 1, via: 'agent', state: 'sent', text: 'secret' }], byTerminal, 0);
  assert.ok(!JSON.stringify(p).includes('secret'));
});
