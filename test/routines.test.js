'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../lib/routines');

const good = () => ({
  id: 'review-reply-desk',
  name: { en: 'Review Reply Desk', es: 'Respuestas a reseñas' },
  problem: { en: 'Reviews sit unanswered.', es: 'Las reseñas se quedan sin respuesta.' },
  prompt: 'Draft replies.',
  schedule: '0 9 * * *',
  approval: 'draft',
  agent: 'claude',
  cwd: '~',
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'free-orca-test-'));
const writePack = (dir, folder, obj) => {
  fs.mkdirSync(path.join(dir, folder), { recursive: true });
  fs.writeFileSync(path.join(dir, folder, 'routine.json'), typeof obj === 'string' ? obj : JSON.stringify(obj));
};

test('a complete pack validates; cwd defaults to ~', () => {
  const v = R.validate(good(), 'review-reply-desk');
  assert.equal(v.ok, true, v.errors.join('; '));
  const noCwd = good(); delete noCwd.cwd;
  assert.equal(R.validate(noCwd).routine.cwd, '~');
});

test('each field is checked', () => {
  const cases = [
    [o => { o.id = 'Bad Id'; }, /id must match/],
    [o => { o.name = { en: 'Only English' }; }, /name needs/],
    [o => { o.problem = 'text'; }, /problem needs/],
    [o => { o.prompt = '  '; }, /prompt is required/],
    [o => { o.prompt = 'x'.repeat(R.PROMPT_MAX + 1); }, /prompt is longer/],
    [o => { o.schedule = 'every morning'; }, /schedule must be/],
    [o => { o.approval = 'auto-send'; }, /approval must be/],
    [o => { o.agent = 'gpt'; }, /agent must be/],
    [o => { o.cwd = ''; }, /cwd must be/],
  ];
  for (const [mutate, re] of cases) {
    const o = good(); mutate(o);
    const v = R.validate(o);
    assert.equal(v.ok, false);
    assert.match(v.errors.join('\n'), re);
  }
  assert.equal(R.validate(null).ok, false);
  assert.equal(R.validate([]).ok, false);
  assert.match(R.validate(good(), 'other-folder').errors.join(), /must match its folder name/);
});

test('loadAll returns good packs and explains the bad ones', () => {
  const dir = tmp();
  writePack(dir, 'review-reply-desk', good());
  writePack(dir, 'broken-json', '{ nope');
  writePack(dir, 'wrong-folder', good());
  fs.mkdirSync(path.join(dir, 'empty-folder'));
  fs.writeFileSync(path.join(dir, 'stray-file.json'), '{}');
  const { routines, invalid } = R.loadAll(dir);
  assert.deepEqual(routines.map(r => r.id), ['review-reply-desk']);
  const byId = Object.fromEntries(invalid.map(x => [x.id, x.errors.join()]));
  assert.match(byId['broken-json'], /not valid JSON/);
  assert.match(byId['wrong-folder'], /folder name/);
  assert.match(byId['empty-folder'], /no routine.json/);
  assert.deepEqual(R.loadAll(path.join(dir, 'missing')), { routines: [], invalid: [] });
});

test('the shipped example packs are valid and bilingual', () => {
  const { routines, invalid } = R.loadAll(path.join(__dirname, '..', 'routines'));
  assert.deepEqual(invalid, []);
  assert.equal(routines.length, 3);
  assert.ok(routines.some(r => r.approval === 'draft'), 'at least one draft-approval example');
  for (const r of routines) for (const f of ['name', 'problem']) for (const l of ['en', 'es']) assert.ok(r[f][l].length > 5, `${r.id} ${f}.${l}`);
});

test('state overrides: enabled and schedule; pack files untouched', () => {
  const dir = tmp();
  const file = path.join(dir, 'routines-state.json');
  const st = R.readState(file);
  assert.deepEqual(st, { routines: {}, runs: {} });
  const r = R.validate(good()).routine;
  assert.equal(R.effective(r, st).enabled, false); // packs are off until turned on
  st.routines[r.id] = { enabled: true, schedule: '15 8 * * *' };
  R.writeState(file, st);
  const e = R.effective(r, R.readState(file));
  assert.equal(e.enabled, true);
  assert.equal(e.schedule, '15 8 * * *');
  assert.equal(e.packSchedule, '0 9 * * *');
  assert.equal((fs.statSync(file).mode & 0o777).toString(8), '600');
});

test('run ids, output paths, prompt and the JSON-lines log', () => {
  const dir = tmp();
  const run = R.newRunId(new Date(2026, 10, 8, 9, 5, 7));
  assert.match(run, /^20261108-090507-[0-9a-f]{4}$/);
  assert.match(run, R.RUN_RE);
  const r = R.validate(good()).routine;
  const out = R.outputPath({ drafts: path.join(dir, 'drafts'), reports: path.join(dir, 'reports') }, r, run);
  assert.equal(out, path.join(dir, 'drafts', r.id, run + '.md'));
  const report = { ...r, approval: 'none' };
  assert.equal(R.outputPath({ drafts: 'D', reports: 'P' }, report, run), path.join('P', r.id, run + '.md'));
  const p = R.buildPrompt(r, out);
  assert.ok(p.includes(r.prompt) && p.includes(out) && /DRAFT/.test(p) && /Do not send/.test(p));
  R.appendLog(path.join(dir, 'logs'), { run, routine: r.id, state: 'started', input: { prompt: 'x' }, output: out });
  R.appendLog(path.join(dir, 'logs'), { run, routine: r.id, state: 'draft_ready', output: out });
  fs.appendFileSync(path.join(dir, 'logs', 'routines.jsonl'), '{"torn');
  const lines = R.readLog(path.join(dir, 'logs'));
  assert.deepEqual(lines.map(l => l.state), ['started', 'draft_ready']);
  assert.ok(lines.every(l => l.ts && l.run === run && l.output === out));
});
