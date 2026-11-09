// A small 5-field cron parser (minute hour day-of-month month day-of-week), evaluated in the
// server's local time zone. Supports *, lists (1,15), ranges (1-5), steps (*/15, 8-18/2) and
// 3-letter names for months (JAN) and weekdays (MON). Day-of-week 0 and 7 are both Sunday.
// As in classic cron, when both day-of-month and day-of-week are restricted, either may match.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FreeOrcaCron = factory(); // the browser: /cron.js, used by the Routines tab
})(typeof self !== 'undefined' ? self : this, () => {
'use strict';

const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'dom', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], base: 1 },
  { name: 'dow', min: 0, max: 7, names: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], base: 0 },
];

function num(token, f) {
  const t = token.toLowerCase();
  if (f.names) {
    const i = f.names.indexOf(t);
    if (i >= 0) return i + f.base;
  }
  if (!/^\d+$/.test(t)) throw new Error(`bad ${f.name} value "${token}"`);
  const n = Number(t);
  if (n < f.min || n > f.max) throw new Error(`${f.name} ${n} out of range ${f.min}-${f.max}`);
  return n;
}

function parseField(text, f) {
  const set = new Set();
  for (const part of text.split(',')) {
    if (!part) throw new Error(`empty item in ${f.name}`);
    const [rangePart, stepPart, extra] = part.split('/');
    if (extra !== undefined) throw new Error(`bad step in ${f.name}`);
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) < 1) throw new Error(`bad step in ${f.name}`);
      step = Number(stepPart);
    }
    let lo, hi;
    if (rangePart === '*') { lo = f.min; hi = f.max; }
    else if (rangePart.includes('-')) {
      const [a, b, more] = rangePart.split('-');
      if (more !== undefined) throw new Error(`bad range in ${f.name}`);
      lo = num(a, f); hi = num(b, f);
      if (lo > hi) throw new Error(`backwards range in ${f.name}`);
    } else {
      lo = num(rangePart, f);
      hi = stepPart !== undefined ? f.max : lo; // "5/10" = from 5 every 10
    }
    for (let v = lo; v <= hi; v += step) set.add(v);
  }
  if (f.name === 'dow' && set.has(7)) { set.delete(7); set.add(0); }
  return set;
}

const ALIASES = { '@hourly': '0 * * * *', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@weekly': '0 0 * * 0', '@monthly': '0 0 1 * *', '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *' };

function parse(expr) {
  const src = String(expr || '').trim();
  const text = ALIASES[src.toLowerCase()] || src;
  const parts = text.split(/\s+/);
  if (parts.length !== 5) throw new Error('cron needs 5 fields: minute hour day month weekday');
  const [minute, hour, dom, month, dow] = parts.map((p, i) => parseField(p, FIELDS[i]));
  return { minute, hour, dom, month, dow, domStar: parts[2] === '*', dowStar: parts[4] === '*' };
}

function isValid(expr) { try { parse(expr); return true; } catch { return false; } }

function dayMatches(c, d) {
  const domOk = c.dom.has(d.getDate());
  const dowOk = c.dow.has(d.getDay());
  if (c.domStar && c.dowStar) return true;
  if (c.domStar) return dowOk;
  if (c.dowStar) return domOk;
  return domOk || dowOk;
}

// The first minute strictly after `from` that matches. Returns a Date, or null if none
// within ~5 years (e.g. "0 0 31 2 *").
function nextRun(expr, from = new Date()) {
  const c = typeof expr === 'string' ? parse(expr) : expr;
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = from.getTime() + 5 * 366 * 864e5;
  while (d.getTime() <= limit) {
    if (!c.month.has(d.getMonth() + 1)) { d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0); continue; }
    if (!dayMatches(c, d)) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
    if (!c.hour.has(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
    if (!c.minute.has(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1, 0, 0); continue; }
    return d;
  }
  return null;
}

// ─── Plain-language schedules ────────────────────────────────────────────────
// The Routines tab offers a picker instead of a cron field. A picker value is
//   { freq: 'daily' | 'weekdays' | 'monsat' | 'weekly' | 'hourly', hour, minute, day }
// (day 0-6, Sunday = 0, only for weekly; hour is ignored for hourly). toCron() turns it into
// a cron line; fromCron() reads a cron line back into a picker value, or null when the
// picker can't express it (lists, steps, days of the month...): the UI then shows the
// summary plus the raw "Advanced" field.
const FREQS = ['daily', 'weekdays', 'monsat', 'weekly', 'hourly'];

function toCron(p) {
  if (!p || !FREQS.includes(p.freq)) throw new Error('unknown frequency');
  const int = (v, lo, hi, what) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`bad ${what}`);
    return n;
  };
  const m = int(p.minute, 0, 59, 'minute');
  if (p.freq === 'hourly') return `${m} * * * *`;
  const h = int(p.hour, 0, 23, 'hour');
  if (p.freq === 'daily') return `${m} ${h} * * *`;
  if (p.freq === 'weekdays') return `${m} ${h} * * 1-5`;
  if (p.freq === 'monsat') return `${m} ${h} * * 1-6`;
  return `${m} ${h} * * ${int(p.day, 0, 7, 'day') % 7}`;
}

const single = (text, f) => {
  if (!/^[a-z0-9]+$/i.test(text)) return null;
  try { return num(text, f); } catch { return null; }
};
const sameSet = (set, list) => set.size === list.length && list.every(v => set.has(v));

function fromCron(expr) {
  const src = String(expr || '').trim();
  const text = ALIASES[src.toLowerCase()] || src;
  const parts = text.split(/\s+/);
  if (parts.length !== 5) return null;
  let c;
  try { c = parse(text); } catch { return null; }
  const [min, hour, dom, month, dow] = parts;
  if (dom !== '*' || month !== '*') return null;
  const minute = single(min, FIELDS[0]);
  if (minute === null) return null;
  if (hour === '*') return dow === '*' ? { freq: 'hourly', minute } : null;
  const h = single(hour, FIELDS[1]);
  if (h === null) return null;
  if (dow === '*') return { freq: 'daily', hour: h, minute };
  if (sameSet(c.dow, [1, 2, 3, 4, 5])) return { freq: 'weekdays', hour: h, minute };
  if (sameSet(c.dow, [1, 2, 3, 4, 5, 6])) return { freq: 'monsat', hour: h, minute };
  if (sameSet(c.dow, [0, 1, 2, 3, 4, 5, 6])) return { freq: 'daily', hour: h, minute };
  if (c.dow.size === 1) return { freq: 'weekly', hour: h, minute, day: [...c.dow][0] };
  return null;
}

const DAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
};
const DAY_NAMES = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
};
const pad2 = n => String(n).padStart(2, '0');
const clock = (h, m) => `${h}:${pad2(m)}`;
// Spanish says "a la 1:30" but "a las 7:30".
const atEs = (h, m) => `${h === 1 ? 'a la' : 'a las'} ${clock(h, m)}`;

// "Mon–Sat at 7:30" / "Lun–Sáb a las 7:30". Crons the picker can't express get
// "Custom: <cron>" / "Personalizado: <cron>".
function summary(expr, lang = 'en') {
  const es = lang === 'es';
  const p = fromCron(expr);
  if (!p) return `${es ? 'Personalizado' : 'Custom'}: ${String(expr || '').trim()}`;
  const { hour: h, minute: m } = p;
  if (p.freq === 'hourly') return es ? `Cada hora, al minuto ${pad2(m)}` : `Every hour at :${pad2(m)}`;
  if (es) {
    if (p.freq === 'daily') return `Todos los días ${atEs(h, m)}`;
    if (p.freq === 'weekdays') return `Lun–Vie ${atEs(h, m)}`;
    if (p.freq === 'monsat') return `Lun–Sáb ${atEs(h, m)}`;
    return `Cada ${DAY_NAMES.es[p.day]} ${atEs(h, m)}`;
  }
  if (p.freq === 'daily') return `Every day at ${clock(h, m)}`;
  if (p.freq === 'weekdays') return `Mon–Fri at ${clock(h, m)}`;
  if (p.freq === 'monsat') return `Mon–Sat at ${clock(h, m)}`;
  return `Every ${DAY_NAMES.en[p.day]} at ${clock(h, m)}`;
}

// A run time as "Tue 7:30" / "mar 7:30".
function shortWhen(date, lang = 'en') {
  const d = date instanceof Date ? date : new Date(date);
  return `${(DAYS[lang] || DAYS.en)[d.getDay()]} ${clock(d.getHours(), d.getMinutes())}`;
}

return { parse, isValid, nextRun, FREQS, toCron, fromCron, summary, shortWhen, DAY_NAMES };
});
