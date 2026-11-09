'use strict';

// A small 5-field cron parser (minute hour day-of-month month day-of-week), evaluated in the
// server's local time zone. Supports *, lists (1,15), ranges (1-5), steps (*/15, 8-18/2) and
// 3-letter names for months (JAN) and weekdays (MON). Day-of-week 0 and 7 are both Sunday.
// As in classic cron, when both day-of-month and day-of-week are restricted, either may match.

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

module.exports = { parse, isValid, nextRun };
