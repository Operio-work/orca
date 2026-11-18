'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createProfiles, validate, instructionsFor } = require('../lib/profiles');

const KINDS = ['claude', 'codex', 'shell'];
const MODELS = { claude: ['sonnet', 'opus'] };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prof-'));
const store = dir => createProfiles({ configDir: dir, kinds: KINDS, models: MODELS });
const base = { id: 'sales-lead', kind: 'claude', instructions: 'You lead sales.' };
const code = (fn, c) => assert.throws(fn, e => e.detail === c || e.code === c);

test('validate fills defaults', () => {
  const p = validate(base, { kinds: KINDS, models: MODELS });
  assert.deepStrictEqual([p.type, p.label, p.folder, p.tools.builtin, p.reportsTo, p.worker.maxMinutes], ['agent', 'sales-lead', '~', 'default', null, 120]);
});

test('validate rejects bad input', () => {
  const v = x => validate({ ...base, ...x }, { kinds: KINDS, models: MODELS });
  code(() => v({ id: 'Bad Name' }), 'id');
  code(() => v({ kind: 'shell' }), 'kind');
  code(() => v({ kind: 'nope' }), 'kind');
  code(() => v({ model: 'gpt' }), 'model');
  code(() => v({ kind: 'codex', model: 'sonnet' }), 'model');
  code(() => v({ type: 'boss' }), 'type');
  code(() => v({ skills: ['../x'] }), 'skills');
  code(() => v({ tools: { builtin: 'all' } }), 'tools');
  code(() => v({ reportsTo: 'sales-lead' }), 'reportsTo');
  code(() => v({ worker: { maxMinutes: 1 } }), 'maxMinutes');
  code(() => v({ instructions: 'x'.repeat(8001) }), 'instructions too long');
  code(() => v({ folder: '~/a\n~/b' }), 'folder');
});

test('put saves 0600, bumps rev, refuses stale and duplicate creates', () => {
  const dir = tmp(); const s = store(dir);
  const a = s.put(base, 'sam');
  assert.strictEqual(a.rev, 1);
  assert.strictEqual(fs.statSync(path.join(dir, 'profiles', 'sales-lead.json')).mode & 0o777, 0o600);
  assert.strictEqual(s.put({ ...base, label: 'Sales', rev: 1 }, 'sam').rev, 2);
  code(() => s.put({ ...base, rev: 1 }, 'sam'), 'stale');
  code(() => s.put({ ...base, create: true }, 'sam'), 'profile_exists');
  assert.strictEqual(store(dir).get('sales-lead').label, 'Sales');
  assert.strictEqual(s.list().length, 1);
});

test('a broken file is skipped, not fatal', () => {
  const dir = tmp(); const s = store(dir);
  s.put(base, 'sam');
  fs.writeFileSync(path.join(dir, 'profiles', 'broken.json'), '{');
  assert.deepStrictEqual(s.list().map(p => p.id), ['sales-lead']);
  assert.strictEqual(s.get('../etc'), null);
});

test('remove deletes the profile and its run files', () => {
  const dir = tmp(); const s = store(dir);
  const p = s.put(base, 'sam');
  s.buildRun(p);
  assert.ok(fs.existsSync(path.join(dir, 'runs', 'sales-lead')));
  assert.strictEqual(s.remove('sales-lead'), true);
  assert.strictEqual(s.remove('sales-lead'), false);
  assert.ok(!fs.existsSync(path.join(dir, 'runs', 'sales-lead')));
});

test('claude: instructions as a system prompt file, tools, model, resume', () => {
  const dir = tmp(); const s = store(dir);
  const p = s.put({ ...base, model: 'sonnet', tools: { builtin: 'noedit' } }, 'sam');
  const r = s.buildRun(p, { resume: 'abc123-def' });
  const file = path.join(dir, 'runs', 'sales-lead', 'instructions.md');
  assert.deepStrictEqual(r.args, ['--append-system-prompt-file', file, '--disallowedTools', 'Edit,Write,NotebookEdit', '--model', 'sonnet', '--resume', 'abc123-def']);
  assert.strictEqual(r.firstPrompt, null);
  assert.match(fs.readFileSync(file, 'utf8'), /You lead sales\./);
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  assert.ok(!s.buildRun(p, { resume: 'x; rm -rf ~' }).args.includes('--resume'));
});

test('other kinds: instructions as the first message, no args', () => {
  const s = store(tmp());
  const r = s.buildRun(s.put({ ...base, kind: 'codex' }, 'sam'));
  assert.deepStrictEqual(r.args, []);
  assert.match(r.firstPrompt, /^\[ORCA\] Your instructions/);
  assert.match(r.firstPrompt, /You lead sales\./);
});

test('footer: lead, members, installed skills with paths, knowledge', () => {
  const p = validate({ ...base, skills: ['gbp-audit', 'gone'] }, { kinds: KINDS, models: MODELS });
  const out = instructionsFor(p, { lead: 'boss', members: ['r1', 'r2'], kb: true,
    skills: [{ key: 'gbp-audit', name: 'GBP audit', description: 'Checks a profile.', dir: '/c/skills/gbp-audit' }] });
  assert.match(out, /report to the agent "boss"/);
  assert.match(out, /r1, r2/);
  assert.match(out, /GBP audit — Checks a profile: \/c\/skills\/gbp-audit\/SKILL\.md/);
  assert.doesNotMatch(out, /gone/);
  assert.match(out, /orca-kb search/);
});

test('readonly: only read/search tools, no shell', () => {
  const s = store(tmp());
  const r = s.buildRun(s.put({ ...base, tools: { builtin: 'readonly' } }, 'sam'));
  assert.deepStrictEqual(r.args.slice(2), ['--tools', 'Read,Grep,Glob,WebFetch,WebSearch']);
});

const { reportsError, profileTeamError } = require('../lib/profiles');
test('reporting lines: two levels, one lead each', () => {
  const L = [{ kind: 'reports', from: 'm1', to: 'lead' }, { kind: 'talk', from: 'x', to: 'y' }];
  assert.strictEqual(reportsError(L, 'm2', 'lead'), null);
  assert.strictEqual(reportsError(L, 'm1', 'other'), 'has_lead');
  assert.strictEqual(reportsError(L, 'x', 'm1'), 'lead_has_lead');
  assert.strictEqual(reportsError(L, 'lead', 'boss'), 'member_has_members');
  assert.strictEqual(reportsError(L, 'x', 'y'), null); // talk links don't count
  assert.strictEqual(reportsError(L, 'x', 'x'), 'link_self');
});

test('saved agents: reportsTo follows the same rules', () => {
  const s = store(tmp());
  s.put({ ...base, id: 'lead' }, 'sam');
  s.put({ ...base, id: 'm1', reportsTo: 'lead' }, 'sam');
  code(() => s.put({ ...base, id: 'm2', reportsTo: 'nobody' }, 'sam'), 'lead_missing');
  code(() => s.put({ ...base, id: 'm2', reportsTo: 'm1' }, 'sam'), 'lead_has_lead');
  code(() => s.put({ ...base, id: 'lead', reportsTo: 'm1' }, 'sam'), 'lead_has_lead');
  s.put({ ...base, id: 'boss' }, 'sam');
  code(() => s.put({ ...base, id: 'lead', reportsTo: 'boss' }, 'sam'), 'member_has_members');
  assert.strictEqual(profileTeamError(s.list(), { id: 'm1', reportsTo: 'lead' }), null);
});

test('workers: instructions say temporary + report goes to the lead; agents may list worker setups', () => {
  const w = validate({ ...base, id: 'researcher', type: 'worker', worker: { maxMinutes: 30 } }, { kinds: KINDS, models: MODELS });
  assert.deepStrictEqual(w.spawn, { profiles: [], max: 2 });
  const out = instructionsFor(w, { lead: 'boss', name: 'researcher-2' });
  assert.match(out, /agent "researcher-2"/);
  assert.match(out, /temporary worker/);
  assert.match(out, /sent to "boss" automatically/);
  assert.doesNotMatch(out, /orca-send boss/);
  const a = validate({ ...base, spawn: { profiles: ['researcher'], max: 3 } }, { kinds: KINDS, models: MODELS });
  assert.match(instructionsFor(a, { workers: ['researcher'] }), /orca-send --spawn <setup>.*Setups: researcher/s);
  assert.throws(() => validate({ ...base, spawn: { profiles: ['sales-lead'] } }, { kinds: KINDS, models: MODELS }), e => e.detail === 'spawn');
  assert.throws(() => validate({ ...base, spawn: { max: 9 } }, { kinds: KINDS, models: MODELS }), e => e.detail === 'spawn');
  const s = store(tmp());
  const r = s.buildRun(s.put({ ...base, id: 'researcher', type: 'worker' }, 'sam'), { name: 'researcher-1' });
  assert.match(r.dir, /runs\/researcher-1$/);
});

test('mcp: ids validated; claude gets --mcp-config, strict only when "only these"', () => {
  const s = store(tmp());
  assert.throws(() => s.put({ ...base, tools: { mcp: ['Bad Id'] } }, 'sam'), e => e.detail === 'tools');
  const p = s.put({ ...base, tools: { builtin: 'default', mcp: ['github'], mcpOnly: true, browserSites: [] } }, 'sam');
  assert.deepStrictEqual(p.tools, { builtin: 'default', mcp: ['github'], mcpOnly: true, browserSites: [] });
  const r = s.buildRun(p, { mcpFile: '/x/mcp.json' });
  assert.deepStrictEqual(r.args.slice(2), ['--mcp-config', '/x/mcp.json', '--strict-mcp-config']);
  assert.ok(!s.buildRun({ ...p, tools: { ...p.tools, mcpOnly: false } }, { mcpFile: '/x/mcp.json' }).args.includes('--strict-mcp-config'));
});
