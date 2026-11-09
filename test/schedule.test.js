'use strict';
// Plain-language schedules: picker value <-> cron line, and the summaries the Routines tab shows.
const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('../lib/cron');

test('picker -> cron -> picker round-trips for every frequency', () => {
  const values = [
    { freq: 'daily', hour: 9, minute: 0 },
    { freq: 'daily', hour: 0, minute: 5 },
    { freq: 'weekdays', hour: 7, minute: 30 },
    { freq: 'monsat', hour: 7, minute: 30 },
    { freq: 'monsat', hour: 23, minute: 59 },
    { freq: 'hourly', minute: 15 },
    { freq: 'hourly', minute: 0 },
    ...[0, 1, 2, 3, 4, 5, 6].map(day => ({ freq: 'weekly', hour: 8, minute: 0, day })),
  ];
  for (const v of values) {
    const line = cron.toCron(v);
    assert.equal(cron.isValid(line), true, line);
    assert.deepEqual(cron.fromCron(line), v, line);
  }
});

test('picker -> cron produces the expected lines', () => {
  assert.equal(cron.toCron({ freq: 'monsat', hour: 7, minute: 30 }), '30 7 * * 1-6');
  assert.equal(cron.toCron({ freq: 'weekdays', hour: '18', minute: '05' }), '5 18 * * 1-5');
  assert.equal(cron.toCron({ freq: 'weekly', hour: 8, minute: 0, day: 7 }), '0 8 * * 0'); // 7 = Sunday
  assert.equal(cron.toCron({ freq: 'hourly', hour: 99, minute: 45 }), '45 * * * *'); // hour ignored
  for (const bad of [{ freq: 'yearly', hour: 1, minute: 0 }, { freq: 'daily', hour: 24, minute: 0 }, { freq: 'daily', hour: 1, minute: 60 }, { freq: 'weekly', hour: 1, minute: 0 }, { freq: 'daily', hour: 1.5, minute: 0 }, null]) {
    assert.throws(() => cron.toCron(bad), JSON.stringify(bad));
  }
});

test('cron -> picker reads equivalent spellings', () => {
  assert.deepEqual(cron.fromCron('0 13 * * mon-fri'), { freq: 'weekdays', hour: 13, minute: 0 });
  assert.deepEqual(cron.fromCron('0 13 * * 1,2,3,4,5'), { freq: 'weekdays', hour: 13, minute: 0 });
  assert.deepEqual(cron.fromCron('30 07 * * MON-SAT'), { freq: 'monsat', hour: 7, minute: 30 });
  assert.deepEqual(cron.fromCron('0 8 * * 0-6'), { freq: 'daily', hour: 8, minute: 0 });
  assert.deepEqual(cron.fromCron('0 8 * * 7'), { freq: 'weekly', hour: 8, minute: 0, day: 0 });
  assert.deepEqual(cron.fromCron('0 8 * * FRI'), { freq: 'weekly', hour: 8, minute: 0, day: 5 });
  assert.deepEqual(cron.fromCron('@daily'), { freq: 'daily', hour: 0, minute: 0 });
  assert.deepEqual(cron.fromCron('@hourly'), { freq: 'hourly', minute: 0 });
  assert.deepEqual(cron.fromCron('@weekly'), { freq: 'weekly', hour: 0, minute: 0, day: 0 });
});

test('cron the picker cannot express -> null', () => {
  for (const e of ['0 9 1,15 * *', '*/15 * * * *', '0 8-18 * * *', '0 8,12 * * *', '0 8 * 1 *', '0 8 * * 1,3', '15 * * * 1-5', '* 8 * * *', '@monthly', 'nonsense', '']) {
    assert.equal(cron.fromCron(e), null, e);
  }
});

test('summaries in English and Spanish', () => {
  const cases = [
    ['30 7 * * 1-6', 'Mon–Sat at 7:30', 'Lun–Sáb a las 7:30'],
    ['0 9 * * 1-5', 'Mon–Fri at 9:00', 'Lun–Vie a las 9:00'],
    ['0 9 * * *', 'Every day at 9:00', 'Todos los días a las 9:00'],
    ['0 8 * * 1', 'Every Monday at 8:00', 'Cada lunes a las 8:00'],
    ['45 18 * * 6', 'Every Saturday at 18:45', 'Cada sábado a las 18:45'],
    ['30 1 * * *', 'Every day at 1:30', 'Todos los días a la 1:30'],
    ['5 * * * *', 'Every hour at :05', 'Cada hora, al minuto 05'],
    ['0 9 1,15 * *', 'Custom: 0 9 1,15 * *', 'Personalizado: 0 9 1,15 * *'],
  ];
  for (const [e, en, es] of cases) {
    assert.equal(cron.summary(e), en, e);
    assert.equal(cron.summary(e, 'es'), es, e);
  }
});

test('every expressible summary matches the cron that produced it', () => {
  for (let day = 0; day < 7; day++) {
    const line = cron.toCron({ freq: 'weekly', hour: 10, minute: 0, day });
    assert.equal(cron.summary(line), `Every ${cron.DAY_NAMES.en[day]} at 10:00`);
  }
});

test('next run as a short weekday and time', () => {
  const at = new Date(2026, 10, 10, 7, 30); // Tuesday
  assert.equal(cron.shortWhen(at), 'Tue 7:30');
  assert.equal(cron.shortWhen(at, 'es'), 'mar 7:30');
  assert.equal(cron.shortWhen(cron.nextRun('30 7 * * 1-6', new Date(2026, 10, 9, 8, 0))), 'Tue 7:30');
});
