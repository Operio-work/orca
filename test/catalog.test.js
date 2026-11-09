'use strict';
// catalog/catalog.json is what make.operio.work renders. It must match catalog/schema.json,
// line up one-to-one with the free packs in routines/, and read fully in English and Spanish.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validate } = require('./json-schema');
const R = require('../lib/routines');

const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const catalog = read('catalog/catalog.json');
const schema = read('catalog/schema.json');
const entries = catalog.entries;
const free = entries.filter(e => e.tier === 'free');
const packs = fs.readdirSync(path.join(ROOT, 'routines'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

test('the schema checker itself catches mistakes', () => {
  const bad = JSON.parse(JSON.stringify(catalog));
  bad.entries[0].tier = 'premium';
  bad.entries[0].how.es.pop();
  delete bad.entries[1].name.es;
  bad.entries[2].extra = true;
  const m = entries.findIndex(e => e.tier === 'managed');
  bad.entries[m].pack = 'nope';
  const errs = validate(schema, bad).join('\n');
  for (const re of [/tier: "premium" is not one of/, /how\.es: fewer than 3/, /name: missing "es"/, /unexpected "extra"/, /matches a schema it must not/]) assert.match(errs, re);
  const noPack = JSON.parse(JSON.stringify(catalog));
  delete noPack.entries.find(e => e.tier === 'free').pack;
  assert.match(validate(schema, noPack).join('\n'), /missing "pack"/);
});

test('catalog.json is valid against schema.json', () => {
  assert.deepEqual(validate(schema, catalog), []);
});

test('23 entries: 5 free, 18 managed, unique ids', () => {
  assert.equal(entries.length, 23);
  assert.equal(free.length, 5);
  assert.equal(entries.filter(e => e.tier === 'managed').length, 18);
  assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
});

test('every free entry has its pack in routines/, and every pack has a free entry', () => {
  for (const e of free) {
    assert.ok(packs.includes(e.pack), `${e.id}: no routines/${e.pack}`);
    const v = R.validate(read(`routines/${e.pack}/routine.json`), e.pack);
    assert.ok(v.ok, `${e.pack}: ${v.errors.join('; ')}`);
    // The card and the pack tell the same story.
    assert.equal(v.routine.name.en, e.name.en, `${e.id} name.en`);
    assert.equal(v.routine.name.es, e.name.es, `${e.id} name.es`);
    assert.equal(e.trigger.kind === 'on-demand', v.routine.schedule === null, `${e.id}: on-demand card <-> pack without schedule`);
  }
  assert.deepEqual(free.map(e => e.pack).sort(), packs);
});

test('English and Spanish are both filled in everywhere', () => {
  const walk = (v, at) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`));
    if (v && typeof v === 'object') {
      if ('en' in v || 'es' in v) {
        for (const l of ['en', 'es']) {
          const s = v[l];
          const ok = Array.isArray(s) ? s.length && s.every(x => typeof x === 'string' && x.trim()) : typeof s === 'string' && s.trim();
          assert.ok(ok, `${at}.${l} is empty`);
        }
        if (Array.isArray(v.en)) assert.equal(v.en.length, v.es.length, `${at}: same number of steps`);
        assert.notEqual(JSON.stringify(v.en), JSON.stringify(v.es), `${at}: Spanish is a copy of English`);
      }
      for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`);
    }
  };
  walk(catalog, '$');
});

test('copy rules: one-sentence problems, no prices, no jargon, Pulse and factura', () => {
  const all = [];
  const collect = (v, at) => {
    if (typeof v === 'string') all.push([at, v]);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) collect(x, `${at}.${k}`);
  };
  collect(catalog, '$');
  const banned = /\b(llm|prompt|hallucinat\w*|alucinaci\w*|few-shot|latent|token|herdr|claude|codex|opencode|orca)\b|[$€]\s?\d|\b\d+\s?(mxn|usd|pesos|dollars|d[oó]lares)\b|\bprice:\s?\d/i;
  // The paid tier's product name is the one place the catalog may say ORCA.
  const tierName = /ORCA (Managed by|Gestionado por) Operio/g;
  for (const [at, s] of all) assert.doesNotMatch(s.replace(tierName, ''), banned, at);
  for (const e of entries) for (const l of ['en', 'es']) {
    assert.match(e.problem[l], /[.!?]$/, `${e.id} problem.${l} ends a sentence`);
    assert.doesNotMatch(e.problem[l].slice(0, -1), /[.!?]\s/, `${e.id} problem.${l} is one sentence`);
  }
  const pulse = entries.find(e => e.id === 'bilingual-social-week-planner');
  assert.match(pulse.outcome.en, /Operio Pulse/);
  assert.match(pulse.outcome.es, /Operio Pulse/);
  const factura = entries.find(e => e.id === 'factura-request-handler');
  assert.match(factura.name.en, /Mexico/);
  assert.match(JSON.stringify(factura), /CFDI/);
  assert.match(JSON.stringify(factura), /RFC/);
  // Free never sends to customers or posts publicly; paid upgrades are described, not priced.
  for (const e of free) assert.doesNotMatch(e.approval.en, /automatic|on its own/i, e.id);
  for (const id of ['review-reply-desk', 'weekly-owner-report', 'post-visit-thank-you']) assert.ok(entries.find(e => e.id === id).upgrade, `${id} upgrade`);
});
