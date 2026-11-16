'use strict';
// node --test herdr-web/chat.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createChat, findMentions, buildPrompt, cutReply } = require('../lib/chat');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orca-chat-'));

test('post, list after, unread per person, read clears', () => {
  let t = 1000;
  const c = createChat({ dir: tmp(), now: () => t });
  const a = c.post('room', 'ana', 'hello');
  t = 2000;
  c.post('room', 'bo', 'hi @ana', ['ana']);
  assert.deepStrictEqual(c.list('room').map(m => m.text), ['hello', 'hi @ana']);
  assert.deepStrictEqual(c.list('room', { after: a.at }).map(m => m.text), ['hi @ana']);
  const s = c.summary('ana', ['room']).room;
  assert.strictEqual(s.unread, 1);
  assert.strictEqual(s.mention, true);
  assert.strictEqual(c.summary('bo', ['room']).room.unread, 0, 'own messages are never unread');
  c.markRead('ana', 'room', 2000);
  assert.strictEqual(c.summary('ana', ['room']).room.unread, 0);
});

test('times strictly increase within a thread', () => {
  const c = createChat({ dir: tmp(), now: () => 5 });
  const x = c.post('room', 'a', 'one');
  const y = c.post('room', 'a', 'two');
  assert.ok(y.at > x.at);
});

test('validation: bad thread, empty, too long', () => {
  const c = createChat({ dir: tmp() });
  assert.throws(() => c.post('../etc', 'a', 'x'), { code: 'bad_thread' });
  assert.throws(() => c.post('room', 'a', '   '), { code: 'empty' });
  assert.throws(() => c.post('room', 'a', 'x'.repeat(2001)), { code: 'too_long' });
});

test('delete: own within 5 min, not others, not late; shows up in list(after)', () => {
  let t = 0;
  const c = createChat({ dir: tmp(), now: () => t });
  const m = c.post('t-term_1', 'ana', 'oops');
  assert.throws(() => c.remove('t-term_1', m.id, 'bo'), { code: 'not_yours' });
  t = 60_000;
  c.remove('t-term_1', m.id, 'ana');
  const changed = c.list('t-term_1', { after: 30_000 });
  assert.strictEqual(changed.length, 1);
  assert.strictEqual(changed[0].deleted, true);
  assert.strictEqual(changed[0].text, '');
  const n = c.post('t-term_1', 'ana', 'late');
  t += 6 * 60_000;
  assert.throws(() => c.remove('t-term_1', n.id, 'ana'), { code: 'too_late' });
  c.remove('t-term_1', n.id, 'boss', true); // admins may always
});

test('survives a restart (files on disk), deletions included', () => {
  const dir = tmp();
  const c1 = createChat({ dir });
  c1.post('room', 'a', 'kept');
  const gone = c1.post('room', 'a', 'gone');
  c1.remove('room', gone.id, 'a');
  const c2 = createChat({ dir });
  assert.deepStrictEqual(c2.list('room').filter(m => !m.deleted).map(m => m.text), ['kept']);
});

test('prune drops messages older than keepDays and empty threads', () => {
  const dir = tmp();
  let t = 0;
  const c = createChat({ dir, keepDays: 1, now: () => t });
  c.post('t-old', 'a', 'old');
  t = 10;
  c.post('room', 'a', 'old room');
  t = 2 * 864e5;
  c.post('room', 'a', 'new');
  assert.strictEqual(c.prune(), 2);
  assert.ok(!fs.existsSync(path.join(dir, 't-old.jsonl')));
  assert.deepStrictEqual(createChat({ dir }).list('room').map(m => m.text), ['new']);
});

test('secrets are redacted before writing', () => {
  const dir = tmp();
  const c = createChat({ dir, redact: s => s.replace(/sk-\w+/g, '[secret]') });
  c.post('room', 'a', 'key sk-abcdef');
  assert.ok(!fs.readFileSync(path.join(dir, 'room.jsonl'), 'utf8').includes('sk-abcdef'));
});

test('findMentions: whole names, case-insensitive, accents', () => {
  const people = [{ login: 'ana@x', name: 'Ana' }, { login: 'mar@x', name: 'Martina' }, { login: 'jo@x', name: 'José' }];
  assert.deepStrictEqual(findMentions('@ana and @MARTINA look', people), ['ana@x', 'mar@x']);
  assert.deepStrictEqual(findMentions('email ana@x.com, @anabel', people), []);
  assert.deepStrictEqual(findMentions('gracias @José!', people), ['jo@x']);
});

test('recipients: mentions always, holder + writers follow agent threads, room is opt-in, mute wins', () => {
  const c = createChat({ dir: tmp() });
  // Agent thread: holder hears without writing; writers hear; author never.
  c.post('t-x', 'bo', 'first');
  let m = c.post('t-x', 'ana', 'hello');
  assert.deepStrictEqual(c.recipients('t-x', m, { holder: 'sam' }).sort((a, b) => a.login.localeCompare(b.login)),
    [{ login: 'bo', kind: 'reply' }, { login: 'sam', kind: 'reply' }]);
  // Muted: no reply push, but a mention still gets through.
  c.setFollow('bo', 't-x', false);
  m = c.post('t-x', 'ana', 'hey @bo', ['bo']);
  assert.deepStrictEqual(c.recipients('t-x', m, { holder: 'sam' }).find(r => r.login === 'bo'), { login: 'bo', kind: 'mention' });
  m = c.post('t-x', 'ana', 'no mention');
  assert.ok(!c.recipients('t-x', m, { holder: 'sam' }).some(r => r.login === 'bo'));
  // Room: silent unless followed.
  c.post('room', 'bo', 'hi');
  m = c.post('room', 'ana', 'hi all');
  assert.deepStrictEqual(c.recipients('room', m), []);
  c.setFollow('sam', 'room', true);
  assert.deepStrictEqual(c.recipients('room', m), [{ login: 'sam', kind: 'reply' }]);
  assert.strictEqual(c.following('bo', 'room'), false);
  assert.strictEqual(c.following('sam', 't-x', 'sam'), true);
});

test('@agent asks: limits per person, per agent, queue; FIFO one in flight per agent', () => {
  let t = 1e9;
  const c = createChat({ dir: tmp(), now: () => t });
  const L = { perPerson: 5, perAgent: 5, queueMax: 5 };
  const add = (by, terminal) => { t += 1; return c.addAsk({ thread: 'room', msgId: 'm' + t, by, terminal, name: terminal, prompt: 'p' }); };
  for (let i = 0; i < 5; i++) { assert.strictEqual(c.askAllowed('ana', 'w' + i, L), null); add('ana', 'w' + i); }
  assert.strictEqual(c.askAllowed('ana', 'x', L), 'limit_person');
  assert.strictEqual(c.askAllowed('bo', 'w0', L), null);
  const c2 = createChat({ dir: tmp(), now: () => t });
  for (let i = 0; i < 5; i++) { t += 1; c2.addAsk({ thread: 'room', msgId: 'q' + i, by: 'p' + i, terminal: 'W', name: 'W', prompt: 'p' }); }
  assert.strictEqual(c2.askAllowed('zed', 'W', L), 'limit_agent');
  assert.strictEqual(c2.askAllowed('zed', 'W', { ...L, perAgent: 99 }), 'queue_full');
  const next = c2.nextAsks();
  assert.strictEqual(next.length, 1, 'one per agent');
  assert.strictEqual(next[0].msgId, 'q0', 'oldest first');
  c2.updateAsk(next[0].id, { state: 'sent', sentAt: t });
  assert.strictEqual(c2.nextAsks().length, 0, 'nothing while one is in flight');
  assert.strictEqual(c2.queuePos(c2.asksWhere(k => k.msgId === 'q2')[0]), 3);
  c2.updateAsk(next[0].id, { state: 'done' });
  assert.strictEqual(c2.asksWhere(k => k.id === next[0].id)[0].prompt, undefined, 'prompt dropped when finished');
  assert.strictEqual(c2.nextAsks()[0].msgId, 'q1');
  t += 3601e3;
  assert.strictEqual(c.askAllowed('ana', 'x', L), null, 'limits are per hour');
});

test('@agent context: last messages before it, oldest first, within the budget', () => {
  let t = 1;
  const c = createChat({ dir: tmp(), now: () => t++ });
  for (let i = 1; i <= 8; i++) c.post('t-abc', i % 2 ? 'ana' : 'bo', 'msg ' + i);
  const ask = c.post('t-abc', 'ana', '@Writer go');
  c.post('t-abc', 'bo', 'after');
  const ctx = c.contextFor('t-abc', ask.id, { max: 6, chars: 1500, nameOf: l => l.toUpperCase() });
  assert.deepStrictEqual(ctx, ['ANA: msg 3', 'BO: msg 4', 'ANA: msg 5', 'BO: msg 6', 'ANA: msg 7', 'BO: msg 8']);
  const small = c.contextFor('t-abc', ask.id, { max: 6, chars: 25, nameOf: l => l });
  assert.deepStrictEqual(small, ['ana: msg 7', 'bo: msg 8'], 'newest kept when cut');
});

test('agent answers: stored with extras, never push recipients', () => {
  const c = createChat({ dir: tmp() });
  c.post('t-abc', 'ana', 'hi @Writer');
  const a = c.post('t-abc', 'agent:abc', 'done', [], { name: 'Writer', took: 5000 });
  assert.deepStrictEqual(a.x, { name: 'Writer', took: 5000 });
  const r = c.recipients('t-abc', c.post('t-abc', 'bo', 'thanks'));
  assert.deepStrictEqual(r.map(x => x.login), ['ana']);
});

test('buildPrompt names the place; cutReply keeps it under the limit', () => {
  const own = buildPrompt({ from: 'Sam', agentName: 'Writer', text: 'shorten it', context: ['Ana: too long'] });
  assert.match(own, /^\[ORCA team chat — your own thread, from Sam\.\]/);
  assert.match(own, /Ana: too long/);
  const room = buildPrompt({ from: 'Sam', agentName: 'Writer', where: 'the team room', text: 'x' });
  assert.match(room, /the team room/);
  assert.match(room, /@Writer/);
  assert.strictEqual(cutReply('short'), 'short');
  const long = ('line '.repeat(30) + '\n').repeat(40);
  const cut = cutReply(long, 2000);
  assert.ok(cut.length <= 2000 && cut.endsWith('…'));
});

test('agent answer read off the screen: a suggested prompt in the input box is not a new prompt', () => {
  const { replyAfter, turnReply } = require('../chips');
  const screen = [
    '❯ older prompt', '● older reply',
    '❯ [ORCA team chat — the team room, from Sam.]', '  Sam wrote:', '  @sable summary?',
    '● Line one of the answer.', '  - point a', '  - point b',
    '[ Explain 1 · x ] [ Wrap up ]',
    '✻ Brewed for 8s · done 1:17 PM',
    '────────', '❯ let\'s do phase 2', '────────',
  ].join('\n');
  assert.match(replyAfter(screen, '[ORCA team chat'), /^Line one of the answer\.\n- point a\n- point b/);
  assert.match(turnReply(screen), /^Line one of the answer\./);
  assert.strictEqual(replyAfter('❯ hello\n● hi', '[ORCA team chat'), '', 'no head → nothing');
  const next = screen.replace("❯ let's do phase 2", "❯ let's do phase 2\n● Phase 2 started.");
  assert.match(replyAfter(next, '[ORCA team chat'), /^Line one/, 'stops at the next prompt');
});

test('a2aPosts: one post per agent thread, as the sender, no mentions', () => {
  const { a2aPosts } = require('../lib/chat');
  const out = a2aPosts({ id: 'm1', from: 'tA', to: 'tB', text: 'please check @sam', via: 'agent' }, { fromName: 'Writer', toName: 'Reviewer' });
  assert.strictEqual(out.length, 2);
  assert.deepStrictEqual(out.map(p => [p.thread, p.by, p.x.a2a.dir]), [['t-tB', 'agent:tA', 'in'], ['t-tA', 'agent:tA', 'out']]);
  assert.strictEqual(out[0].x.a2a.to, 'Reviewer');
  assert.strictEqual(out[0].x.name, 'Writer');
});

test('a2aPosts: skips intros, self, empty; cuts long text', () => {
  const { a2aPosts } = require('../lib/chat');
  assert.deepStrictEqual(a2aPosts({ from: 'a', to: 'b', text: 'x', via: 'intro' }), []);
  assert.deepStrictEqual(a2aPosts({ from: 'a', to: 'a', text: 'x', via: 'agent' }), []);
  assert.deepStrictEqual(a2aPosts({ from: 'a', to: 'b', text: '  ', via: 'agent' }), []);
  const [p] = a2aPosts({ from: 'a', to: 'b', text: 'y'.repeat(5000), via: 'handoff' });
  assert.ok(p.text.length <= 2000);
  assert.strictEqual(p.x.a2a.via, 'handoff');
});

test('explicitFollowers: only people who turned the thread on', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const { createChat } = require('../lib/chat');
  const c = createChat({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'a2a-')) });
  c.post('t-x', 'bob', 'hello');           // bob wrote → implicit follower, not explicit
  c.setFollow('ann', 't-x', true);
  c.setFollow('cy', 't-x', false);
  assert.deepStrictEqual(c.explicitFollowers('t-x'), ['ann']);
});
