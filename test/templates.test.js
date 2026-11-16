'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createTemplates, pickLang } = require('../lib/templates');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-'));

test('personal templates are per person and survive a restart', () => {
  const dir = tmp();
  const a = createTemplates({ dir });
  a.put('ann', { scope: 'personal', title: 'Shorten', body: 'Make it shorter.' });
  assert.strictEqual(a.list('ann').personal.length, 1);
  assert.strictEqual(a.list('bob').personal.length, 0);
  const b = createTemplates({ dir });
  assert.strictEqual(b.list('ann').personal[0].title, 'Shorten');
  assert.strictEqual((fs.statSync(path.join(dir, 'templates.json')).mode & 0o777), 0o600);
});

test('company: everyone reads, only admins write', () => {
  const t = createTemplates({ dir: tmp() });
  assert.throws(() => t.put('bob', { scope: 'company', title: 'x', body: 'y' }), { code: 'forbidden' });
  const row = t.put('ann', { scope: 'company', title: 'Weekly report', body: 'Write the weekly report.' }, { admin: true });
  assert.strictEqual(t.list('bob').company[0].canEdit, false);
  assert.strictEqual(t.list('ann', { admin: true }).company[0].canEdit, true);
  t.put('ann', { id: row.id, scope: 'company', title: 'Weekly', body: 'New body' }, { admin: true });
  assert.strictEqual(t.list('bob').company[0].body, 'New body');
  assert.throws(() => t.remove('bob', { id: row.id, scope: 'company' }), { code: 'forbidden' });
  t.remove('ann', { id: row.id, scope: 'company' }, { admin: true });
  assert.strictEqual(t.list('bob').company.length, 0);
});

test('free panel: company and operio are off', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'op.json'), JSON.stringify({ templates: [{ id: 'a', en: { title: 'T', body: 'B' } }] }));
  const t = createTemplates({ dir, operioFile: path.join(dir, 'op.json'), company: false, operio: false });
  const l = t.list('local', { admin: true });
  assert.deepStrictEqual(l.scopes, ['personal']);
  assert.strictEqual(l.operio.length, 0);
  assert.strictEqual(l.canEditCompany, false);
  assert.throws(() => t.put('local', { scope: 'company', title: 'x', body: 'y' }, { admin: true }), { code: 'not_available' });
});

test('operio library: read-only, bilingual with fallback, reloads on change', () => {
  const dir = tmp(), f = path.join(dir, 'operio-templates.json');
  fs.writeFileSync(f, JSON.stringify({ templates: [
    { id: 'rev', en: { title: 'Review reply', body: 'Reply to this review' }, es: { title: 'Responder reseña', body: 'Responde esta reseña' }, tags: ['gbp'] },
    { id: 'only-en', en: { title: 'EN only', body: 'Body' } },
    { id: 'bad id!', en: { title: 'x', body: 'y' } },
  ] }));
  const t = createTemplates({ dir, operioFile: f });
  const es = t.list('ann', { lang: 'es' }).operio;
  assert.deepStrictEqual(es.map(x => [x.id, x.title, x.lang]), [['rev', 'Responder reseña', 'es'], ['only-en', 'EN only', 'en']]);
  assert.throws(() => t.put('ann', { scope: 'operio', title: 'x', body: 'y' }, { admin: true }), { code: 'read_only' });
  fs.writeFileSync(f, JSON.stringify({ templates: [] }));
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(f, later, later);
  assert.strictEqual(t.list('ann').operio.length, 0);
});

test('validation: title and body required, trimmed and capped', () => {
  const t = createTemplates({ dir: tmp() });
  assert.throws(() => t.put('a', { scope: 'personal', title: ' ', body: 'b' }), { code: 'title_required' });
  assert.throws(() => t.put('a', { scope: 'personal', title: 't', body: '' }), { code: 'body_required' });
  assert.throws(() => t.put('a', { scope: 'nope', title: 't', body: 'b' }), { code: 'bad_scope' });
  const r = t.put('a', { scope: 'personal', title: 'x'.repeat(200), body: 'y'.repeat(5000) });
  assert.strictEqual(r.title.length, 80);
  assert.strictEqual(r.body.length, 4000);
});

test('pickLang falls back and rejects empty', () => {
  assert.strictEqual(pickLang({ es: { title: 'a', body: 'b' } }, 'en').lang, 'es');
  assert.strictEqual(pickLang({ en: { title: '', body: 'b' } }, 'en'), null);
});
