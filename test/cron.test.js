'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('../lib/cron');
const { Scheduler } = require('../lib/scheduler');

const at = (y, mo, d, h, mi, s = 0) => new Date(y, mo - 1, d, h, mi, s);
const next = (expr, from) => cron.nextRun(expr, from);

test('valid and invalid expressions', () => {
  for (const e of ['* * * * *', '30 7 * * 1-6', '*/15 8-18 * * *', '0 9 1,15 * *', '0 8 * * MON', '0 0 1 JAN *', '@daily', '0 0 * * 7']) assert.equal(cron.isValid(e), true, e);
  for (const e of ['', '* * * *', '60 * * * *', '* 24 * * *', '* * 0 * *', '* * * 13 *', '* * * * 8', '*/0 * * * *', '5-1 * * * *', 'a b c d e', '1,,2 * * * *']) assert.equal(cron.isValid(e), false, e);
});

test('next run: daily and weekday schedules', () => {
  assert.deepEqual(next('30 7 * * *', at(2026, 11, 8, 7, 29, 30)), at(2026, 11, 8, 7, 30));
  assert.deepEqual(next('30 7 * * *', at(2026, 11, 8, 7, 30)), at(2026, 11, 9, 7, 30)); // strictly after
  // 2026-11-08 is a Sunday: Mon-Sat skips to Monday.
  assert.deepEqual(next('30 7 * * 1-6', at(2026, 11, 8, 6, 0)), at(2026, 11, 9, 7, 30));
  assert.deepEqual(next('0 8 * * MON', at(2026, 11, 9, 8, 0)), at(2026, 11, 16, 8, 0));
  assert.deepEqual(next('0 0 * * 7', at(2026, 11, 8, 12, 0)), at(2026, 11, 15, 0, 0)); // 7 = Sunday
});

test('next run: steps, lists, month boundaries and leap day', () => {
  assert.deepEqual(next('*/15 * * * *', at(2026, 11, 8, 10, 46)), at(2026, 11, 8, 11, 0));
  assert.deepEqual(next('0 9 1,15 * *', at(2026, 11, 15, 9, 0)), at(2026, 12, 1, 9, 0));
  assert.deepEqual(next('0 0 31 * *', at(2026, 11, 1, 0, 0)), at(2026, 12, 31, 0, 0));
  assert.deepEqual(next('0 12 29 2 *', at(2026, 3, 1, 0, 0)), at(2028, 2, 29, 12, 0));
  assert.deepEqual(next('59 23 31 12 *', at(2026, 12, 31, 23, 58)), at(2026, 12, 31, 23, 59));
  assert.equal(next('0 0 31 2 *', at(2026, 1, 1, 0, 0)), null);
});

test('day-of-month OR day-of-week when both are restricted (classic cron)', () => {
  // The 13th, or any Friday: from Sunday 2026-11-08 the first match is Friday 2026-11-13.
  assert.deepEqual(next('0 10 13 * 5', at(2026, 11, 8, 0, 0)), at(2026, 11, 13, 10, 0));
  assert.deepEqual(next('0 10 13 * 5', at(2026, 11, 13, 11, 0)), at(2026, 11, 20, 10, 0));
});

test('scheduler fires a due routine once and plans the following run', async () => {
  let now = at(2026, 11, 9, 7, 29, 50);
  const fired = [];
  const routines = [{ id: 'brief', schedule: '30 7 * * *', enabled: true }, { id: 'off', schedule: '* * * * *', enabled: false }];
  const s = new Scheduler({ list: () => routines, fire: async r => { fired.push(r.id); }, now: () => now });
  await s.tick();
  assert.deepEqual(fired, []);
  assert.deepEqual(s.nextFor(routines[0]), at(2026, 11, 9, 7, 30));
  assert.equal(s.nextFor(routines[1]), null); // disabled never runs
  now = at(2026, 11, 9, 7, 30, 10);
  await s.tick();
  await s.tick();
  assert.deepEqual(fired, ['brief']);
  assert.deepEqual(s.nextFor(routines[0]), at(2026, 11, 10, 7, 30));
});

test('scheduler skips runs missed while stopped and follows schedule edits', async () => {
  const fired = [];
  const r = { id: 'x', schedule: '0 * * * *', enabled: true };
  let now = at(2026, 11, 9, 10, 30);
  const s = new Scheduler({ list: () => [r], fire: async x => { fired.push(x.id); }, now: () => now });
  await s.tick();
  now = at(2026, 11, 9, 15, 30); // five hours later: one run, not five
  await s.tick(); await s.tick();
  assert.deepEqual(fired, ['x']);
  r.schedule = '45 15 * * *';
  assert.deepEqual(s.nextFor(r, now), at(2026, 11, 9, 15, 45));
});

test('a failing fire is logged and does not stop the scheduler', async () => {
  const logs = [];
  let now = at(2026, 11, 9, 10, 0, 30);
  const s = new Scheduler({ list: () => [{ id: 'bad', schedule: '* * * * *', enabled: true }], fire: async () => { throw new Error('boom'); }, now: () => now, log: (e, d) => logs.push([e, d.id]) });
  await s.tick();
  now = at(2026, 11, 9, 10, 1, 30);
  await s.tick();
  assert.deepEqual(logs, [['routine.fire_error', 'bad']]);
});
