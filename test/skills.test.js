'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const S = require('../lib/skills');

const ROOT = path.join(__dirname, '..');
const BUNDLED = path.join(ROOT, 'skills');
const SKILL_MD = '---\nname: test-skill\ndescription: Does a test thing.\n---\n\n# Test\nDo it.\n';

function env() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'oo-skills-'));
  const configDir = path.join(home, '.config', 'operio-orca');
  return { home, configDir, skills: S.createSkills({ home, configDir, bundledDir: BUNDLED, now: () => 1000 }) };
}
const bundle = (over = {}) => ({ key: 'test-skill', version: 1, files: { 'SKILL.md': SKILL_MD, 'ref/notes.md': 'notes' }, ...over });

test('install: files, marker, Claude link; replace keeps one copy; remove cleans up', () => {
  const { home, configDir, skills } = env();
  const r = skills.install(bundle());
  assert.deepEqual([r.key, r.version, r.files], ['test-skill', 1, 2]);
  const dir = path.join(configDir, 'skills', 'test-skill');
  assert.equal(fs.readFileSync(path.join(dir, 'ref', 'notes.md'), 'utf8'), 'notes');
  const marker = JSON.parse(fs.readFileSync(path.join(dir, '.operio-skill.json'), 'utf8'));
  assert.deepEqual(marker, { key: 'test-skill', version: 1, installedAt: 1000, source: 'operio' });
  const link = path.join(home, '.claude', 'skills', 'test-skill');
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(fs.readlinkSync(link), dir);
  assert.equal(fs.statSync(path.join(dir, 'SKILL.md')).mode & 0o777, 0o600);

  skills.install(bundle({ version: 2, files: { 'SKILL.md': SKILL_MD } }));
  assert.ok(!fs.existsSync(path.join(dir, 'ref')), 'a replace drops files the new version no longer has');
  assert.deepEqual(skills.list().map(s => [s.key, s.version, s.name]), [['test-skill', 2, 'test-skill']]);
  assert.deepEqual(fs.readdirSync(path.join(configDir, 'skills')), ['test-skill'], 'no temp or old folders left');

  assert.deepEqual(skills.remove('test-skill'), { key: 'test-skill', removed: true });
  assert.ok(!fs.existsSync(dir));
  assert.ok(!fs.existsSync(link));
  assert.deepEqual(skills.remove('test-skill'), { key: 'test-skill', removed: false });
});

test("never replaces a ~/.claude/skills entry that isn't ours", () => {
  const { home, configDir, skills } = env();
  const mine = path.join(home, '.claude', 'skills', 'test-skill');
  fs.mkdirSync(mine, { recursive: true });
  fs.writeFileSync(path.join(mine, 'SKILL.md'), 'my own');
  assert.throws(() => skills.install(bundle()), { code: 'conflict' });
  assert.equal(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), 'my own');
  assert.ok(!fs.existsSync(path.join(configDir, 'skills', 'test-skill')), 'nothing installed on a conflict');

  // A link to somewhere else is not ours either.
  fs.rmSync(mine, { recursive: true });
  fs.symlinkSync(home, mine);
  assert.throws(() => skills.install(bundle()), { code: 'conflict' });
  assert.equal(fs.readlinkSync(mine), home);

  // A folder in our skills dir without our marker is left alone too.
  fs.rmSync(mine);
  fs.mkdirSync(path.join(configDir, 'skills', 'other'), { recursive: true });
  assert.throws(() => skills.install(bundle({ key: 'other' })), { code: 'not_ours' });
  assert.throws(() => skills.remove('other'), { code: 'not_ours' });
  assert.ok(fs.existsSync(path.join(configDir, 'skills', 'other')));
});

test('keys, paths and sizes are checked before anything is written', () => {
  const { configDir, skills } = env();
  for (const key of ['', 'Upper', '-lead', 'a/b', '..', 'x'.repeat(41)]) assert.throws(() => skills.install(bundle({ key })), { code: 'bad_key' }, key);
  for (const p of ['../evil.md', '/abs.md', 'a/../../b.md', '.hidden', 'ref/.operio-skill.json', 'a\\b.md', './x.md'])
    assert.throws(() => skills.install(bundle({ files: { 'SKILL.md': SKILL_MD, [p]: 'x' } })), { code: 'bad_path' }, p);
  assert.throws(() => skills.install(bundle({ files: { 'notes.md': 'x' } })), { code: 'no_skill_md' });
  assert.throws(() => skills.install(bundle({ files: { 'SKILL.md': '# no front-matter' } })), { code: 'bad_front_matter' });
  const many = { 'SKILL.md': SKILL_MD };
  for (let i = 0; i < 20; i++) many[`f${i}.md`] = 'x';
  assert.throws(() => skills.install(bundle({ files: many })), { code: 'too_many_files' });
  assert.throws(() => skills.install(bundle({ files: { 'SKILL.md': SKILL_MD, 'big.md': 'x'.repeat(256 * 1024) } })), { code: 'too_large' });
  assert.throws(() => skills.install(bundle({ files: { 'SKILL.md': SKILL_MD, 'bin.dat': 'a\u0000b' } })), { code: 'bad_files' });
  assert.throws(() => skills.install(bundle({ version: 0 })), { code: 'bad_version' });
  assert.throws(() => skills.remove('../x'), { code: 'bad_key' });
  assert.ok(!fs.existsSync(path.join(configDir, 'skills')) || fs.readdirSync(path.join(configDir, 'skills')).length === 0);
});

test('Codex/Gemini: managed block only when the folder exists; the rest of the file is kept', () => {
  const { home, skills } = env();
  fs.mkdirSync(path.join(home, '.codex'));
  const agents = path.join(home, '.codex', 'AGENTS.md');
  const mine = '# My rules\n\nAlways be brief.\n';
  fs.writeFileSync(agents, mine);
  skills.install(bundle());
  skills.install(bundle({ key: 'second', files: { 'SKILL.md': '---\nname: Second\ndescription: "Another one."\n---\n' } }));
  let text = fs.readFileSync(agents, 'utf8');
  assert.ok(text.startsWith(mine), 'the owner\'s text stays first, untouched');
  assert.equal(text.split(S.BLOCK_START).length, 2, 'one block');
  assert.match(text, /- \*\*Second\*\* — Another one\. When a task matches, read .*second\/SKILL\.md first\./);
  assert.match(text, /- \*\*test-skill\*\* — Does a test thing\./);
  fs.writeFileSync(agents, text + '\n## Added later by hand\n');
  skills.remove('second');
  text = fs.readFileSync(agents, 'utf8');
  assert.ok(text.startsWith(mine) && text.endsWith('\n## Added later by hand\n'));
  assert.doesNotMatch(text, /Second/);
  skills.remove('test-skill');
  assert.equal(fs.readFileSync(agents, 'utf8'), mine + '\n## Added later by hand\n');
  assert.ok(!fs.existsSync(path.join(home, '.gemini')), 'no ~/.gemini made when Gemini is not there');
});

test('rewriteBlock: add, replace and drop leave every other byte alone', () => {
  const block = `${S.BLOCK_START}\nx\n${S.BLOCK_END}`;
  assert.equal(S.rewriteBlock('', block), block + '\n');
  assert.equal(S.rewriteBlock('a\n', block), `a\n\n${block}\n`);
  const withBlock = `top\n\n${block}\nbottom\n`;
  assert.equal(S.rewriteBlock(withBlock, `${S.BLOCK_START}\ny\n${S.BLOCK_END}`), `top\n\n${S.BLOCK_START}\ny\n${S.BLOCK_END}\nbottom\n`);
  assert.equal(S.rewriteBlock(withBlock, ''), 'top\nbottom\n');
  assert.equal(S.rewriteBlock(S.rewriteBlock('a\n', block), ''), 'a\n');
});

test('hosted catalogue: validated, saved 0600, shown with request states; a bad one never replaces a good one', () => {
  const { configDir, skills } = env();
  const cat = { updatedAt: 5, skills: [
    { key: 'review-reply-drafts', version: 3, en: { name: 'Review replies', summary: 'Drafts replies.' }, es: { name: 'Respuestas', summary: 'Redacta respuestas.' }, tags: ['reviews'], request: null },
    { key: 'asked', version: 1, en: { name: 'Asked', summary: 'S' }, tags: [], request: { status: 'pending', at: '2026-11-16T10:00:00Z' } },
    { key: 'no-thanks', version: 1, es: { name: 'No', summary: 'S' }, request: { status: 'rejected', note: 'Not for this business', at: 1 } },
  ] };
  skills.setCatalog(cat);
  const file = path.join(configDir, 'operio-skills.json');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).version, 1);
  assert.throws(() => skills.setCatalog({ skills: [{ key: 'Bad Key', version: 1, en: { name: 'a', summary: 'b' } }] }), { code: 'bad_catalog' });
  assert.throws(() => skills.setCatalog({ skills: [{ key: 'x', version: 1, en: { name: 'a', summary: 'b' }, request: { status: 'maybe' } }] }), { code: 'bad_catalog' });
  assert.throws(() => skills.setCatalog({ nope: 1 }), { code: 'bad_catalog' });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).skills.length, 3);

  skills.install({ key: 'review-reply-drafts', version: 3, files: { 'SKILL.md': SKILL_MD } });
  const v = skills.view({ hosted: true, lang: 'es', canRequest: true });
  assert.equal(v.mode, 'hosted');
  assert.equal(v.canRequest, true);
  assert.deepEqual(v.items.map(i => [i.key, i.name, i.installed, i.request?.status || null]), [
    ['review-reply-drafts', 'Respuestas', { version: 3 }, null],
    ['asked', 'Asked', null, 'pending'],
    ['no-thanks', 'No', null, 'rejected'],
  ]);
  assert.equal(v.items[2].request.note, 'Not for this business');
  assert.equal(skills.view({ hosted: false, canRequest: true }).canRequest, false, 'the free panel never requests');
});

test('bundled catalogue: every entry has its folder with a valid SKILL.md, EN and ES', () => {
  const cat = JSON.parse(fs.readFileSync(path.join(BUNDLED, 'catalog.json'), 'utf8'));
  const dirs = fs.readdirSync(BUNDLED, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
  assert.deepEqual(cat.skills.map(s => s.key).sort(), dirs);
  assert.equal(S.readBundledCatalog(BUNDLED).length, cat.skills.length);
  for (const s of cat.skills) {
    for (const l of ['en', 'es']) assert.ok(s[l]?.name && s[l]?.summary, `${s.key}: ${l}`);
    const files = { 'SKILL.md': fs.readFileSync(path.join(BUNDLED, s.key, 'SKILL.md'), 'utf8') };
    S.validateFiles(files);
    assert.equal(S.parseFrontMatter(files['SKILL.md']).name, s.key);
    assert.match(files['SKILL.md'], /never (post|send)/i, `${s.key} must say it never sends`);
  }
});

test('free panel: install a bundled skill by key; unknown keys are refused', () => {
  const { home, skills } = env();
  const r = skills.installBundled('weekly-owner-summary');
  assert.equal(r.version, 1);
  assert.ok(fs.lstatSync(path.join(home, '.claude', 'skills', 'weekly-owner-summary')).isSymbolicLink());
  const v = skills.view({ lang: 'en' });
  assert.equal(v.mode, 'local');
  const it = v.items.find(i => i.key === 'weekly-owner-summary');
  assert.deepEqual([it.installed, it.source, it.name], [{ version: 1 }, 'bundled', 'Weekly owner summary']);
  assert.throws(() => skills.installBundled('nope'), { code: 'not_found' });
  assert.throws(() => skills.installBundled('../lib'), { code: 'not_found' });
});

test('parseFrontMatter: quotes and folded values', () => {
  assert.deepEqual(S.parseFrontMatter('---\nname: "A b"\ndescription: >\n  one\n  two\n---\nbody'), { name: 'A b', description: 'one two' });
  assert.deepEqual(S.parseFrontMatter('no front matter'), {});
});
