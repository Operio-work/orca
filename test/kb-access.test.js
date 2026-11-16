'use strict';
// Knowledge per-agent access (lib/kb-access.js) and how `operio-orca kb search` applies it:
// rules, validation, the file (mode 600), search filtering, an explicit --collection refused,
// a person (no agent) and an unreachable panel both searching everything.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { createKb, KbError } = require('../lib/kb');
const { createKbAccess, validateAccess, mayUse, allowedCollections, scopeOf } = require('../lib/kb-access');
const cli = require('../lib/kb-cli');

const ROOT = path.join(__dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-kbacc-'));
const mode = p => (fs.statSync(p).mode & 0o777).toString(8);

const RULES = { collections: { hr: { agents: ['Payroll'], tags: [] }, prices: { agents: [], tags: ['sales', 'front'] } } };

test('rules: no entry = all agents; names and tags match without case; top-level documents are open', () => {
  const a = validateAccess(RULES);
  const sable = { name: 'sable', tags: ['Sales'] };
  const payroll = { name: 'payroll', tags: [] };
  const none = { name: null, tags: [] };
  assert.equal(mayUse(a, sable, 'menu'), true, 'no entry');
  assert.equal(mayUse(a, sable, 'prices'), true, 'by tag, any case');
  assert.equal(mayUse(a, sable, 'hr'), false);
  assert.equal(mayUse(a, payroll, 'hr'), true, 'by name, any case');
  assert.equal(mayUse(a, payroll, 'prices'), false);
  assert.equal(mayUse(a, none, null), true, 'top-level files have no collection');
  assert.equal(mayUse(a, none, 'hr'), false);
  assert.deepEqual(allowedCollections(a, sable, ['prices', 'hr', 'menu', 'menu']), ['menu', 'prices']);
  assert.deepEqual(scopeOf(a, sable, ['prices', 'menu']), { scope: ['menu', 'prices'], denied: ['hr'] }, 'a rule for a folder with no documents yet still denies');
  assert.deepEqual(scopeOf(a, { name: 'payroll', tags: ['front'] }, ['prices', 'hr']), { scope: 'all', denied: [] });
  assert.deepEqual(scopeOf(validateAccess(null), none, ['x']), { scope: 'all', denied: [] });
});

test('validation: normalised, empty rules dropped, duplicates folded, bad names refused', () => {
  assert.deepEqual(validateAccess({ collections: { b: { agents: [' sable ', 'SABLE'], tags: [] }, a: { agents: [], tags: [] }, c: {} } }),
    { collections: { b: { agents: ['sable'], tags: [] } } });
  assert.deepEqual(validateAccess({}), { collections: {} });
  const bad = [
    [], 'x', { collections: [] }, { collections: { '../x': { agents: ['a'] } } }, { collections: { '.hidden': { tags: ['a'] } } },
    { collections: { x: { agents: 'sable' } } }, { collections: { x: { tags: ['two words'] } } }, { collections: { x: { tags: ['x'.repeat(21)] } } },
    { collections: { x: { agents: ['a/b'] } } }, { collections: { x: { agents: [7] } } }, { collections: { x: [] } },
    { collections: { x: { agents: Array.from({ length: 101 }, (_, i) => `a${i}`) } } },
  ];
  for (const b of bad) assert.throws(() => validateAccess(b), KbError, JSON.stringify(b).slice(0, 80));
});

test('the file: missing = no rules; saved mode 600; set and clear one collection; a broken file = no rules + a log line', () => {
  const dir = tmp();
  const logs = [];
  const acc = createKbAccess({ configDir: dir, log: (e, d) => logs.push([e, d]) });
  assert.deepEqual(acc.load(), { collections: {} });
  assert.deepEqual(acc.set('hr', { agents: ['payroll'] }), { agents: ['payroll'], tags: [] });
  assert.equal(mode(acc.file), '600');
  acc.set('prices', { tags: ['sales'] });
  assert.deepEqual(Object.keys(acc.load().collections), ['hr', 'prices']);
  assert.equal(acc.set('hr', { agents: [], tags: [] }), null, 'empty lists = all agents again');
  assert.deepEqual(acc.load(), { collections: { prices: { agents: [], tags: ['sales'] } } });
  assert.throws(() => acc.set('../x', { tags: ['a'] }), /bad_collection/);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['kb-access.json'], 'no temp files left behind');
  fs.writeFileSync(acc.file, '{ nope');
  assert.deepEqual(acc.load(), { collections: {} });
  assert.equal(logs.at(-1)[0], 'kb.access_unreadable');
});

async function seeded() {
  const dir = tmp();
  const kb = createKb({ configDir: dir });
  await kb.add('prices/menu.md', '# Menu\n\nTacos al pastor 25 MXN. Our prices change in winter.\n');
  await kb.add('hr/salaries.md', '# Salaries\n\nThe cook earns 9,000 MXN a month; prices of uniforms are paid by us.\n');
  await kb.add('faq.md', 'Parking is free. Prices include tax.\n');
  return { dir, kb };
}

test('search: excluded collections are left out before ranking, so n results still come back', async () => {
  const { kb } = await seeded();
  const all = await kb.search('prices', { n: 5 });
  assert.deepEqual(all.results.map(r => r.source).sort(), ['faq.md', 'hr/salaries.md', 'prices/menu.md']);
  const scoped = await kb.search('prices', { n: 2, exclude: ['hr'] });
  assert.deepEqual(scoped.results.map(r => r.source).sort(), ['faq.md', 'prices/menu.md']);
});

// A stand-in for the panel's agent socket: answers GET /kb-scope with what the test says.
function fakeSocket(dir, answer) {
  const sock = path.join(dir, 'agents.sock');
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url);
    const [status, body] = answer(req);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  return new Promise(resolve => server.listen(sock, () => resolve({ sock, seen, close: () => new Promise(r => server.close(r)) })));
}
const run = (dir, sock, args) => cli.main(['search', dir, ROOT, ...args], { HOME: dir, OPERIO_ORCA_AGENT_SOCK: sock });

test('kb search inside an agent: only its collections; an explicit --collection it may not use is refused', async () => {
  const { dir } = await seeded();
  const s = await fakeSocket(dir, () => [200, { me: { name: 'sable', pane: 'w1:p3' }, scope: ['prices'], denied: ['hr'] }]);
  try {
    let out = await run(dir, s.sock, ['prices']);
    assert.ok(!out.includes('hr/salaries.md'), out);
    assert.match(out, /prices\/menu\.md/);
    assert.match(out, /\(searched only the folders this agent may use\)/);
    assert.match(out, /Cite the source when you use it\.$/);
    assert.match(s.seen[0], new RegExp(`^/kb-scope\\?pid=${process.pid}$`), 'asks about its own process, like operio-orca-send');
    const j = JSON.parse(await run(dir, s.sock, ['salaries', '--json']));
    assert.deepEqual(j.results, []);
    assert.deepEqual(j.scope, { agent: { name: 'sable', pane: 'w1:p3' }, collections: ['prices'], denied: ['hr'], checked: true });
    await assert.rejects(run(dir, s.sock, ['salaries', '--collection', 'hr']), /may not search the folder "hr"/);
    out = JSON.parse(await run(dir, s.sock, ['tacos', '--collection', 'prices', '--json']));
    assert.equal(out.results[0].source, 'prices/menu.md');
  } finally { await s.close(); }
});

test('kb search by a person (not an agent) searches everything, with no note', async () => {
  const { dir } = await seeded();
  const s = await fakeSocket(dir, () => [403, { error: 'not_an_agent' }]);
  try {
    const out = await run(dir, s.sock, ['salaries']);
    assert.match(out, /hr\/salaries\.md/);
    assert.ok(!out.includes('could not check'));
    const j = JSON.parse(await run(dir, s.sock, ['salaries', '--json', '--collection', 'hr']));
    assert.deepEqual(j.scope, { agent: null, collections: 'all', denied: [], checked: true });
    assert.equal(j.note, undefined);
  } finally { await s.close(); }
});

test('kb search with the panel unreachable (no socket, or an error) searches everything and says so', async () => {
  const { dir } = await seeded();
  let out = await run(dir, path.join(dir, 'nothing-here.sock'), ['salaries']);
  assert.match(out, /hr\/salaries\.md/);
  assert.match(out, /\(could not check this agent's access; searched everything\)/);
  let j = JSON.parse(await run(dir, path.join(dir, 'nothing-here.sock'), ['salaries', '--json']));
  assert.deepEqual(j.scope, { agent: null, collections: 'all', denied: [], checked: false });
  assert.match(j.note, /could not check this agent's access/);
  out = await run(dir, path.join(dir, 'nothing-here.sock'), ['helicopter']);
  assert.match(out, /^Nothing found[^]*\(could not check this agent's access; searched everything\)\nSay so/);
  const s = await fakeSocket(dir, () => [500, { error: 'internal' }]);
  try {
    j = JSON.parse(await run(dir, s.sock, ['salaries', '--json']));
    assert.equal(j.scope.checked, false);
    assert.equal(j.results[0].source, 'hr/salaries.md');
  } finally { await s.close(); }
});

test('kb search - (question on stdin) still works with the access check, as a real process', async () => {
  const { dir } = await seeded();
  const s = await fakeSocket(dir, () => [200, { me: { name: 'sable', pane: 'w1:p3' }, scope: ['prices'], denied: ['hr'] }]);
  try {
    const out = await new Promise((resolve, reject) => {
      const c = spawn(process.execPath, [path.join(ROOT, 'lib', 'kb-cli.js'), 'search', dir, ROOT, '-', '--json'], { env: { PATH: process.env.PATH, HOME: dir, OPERIO_ORCA_AGENT_SOCK: s.sock } });
      let o = '', e = '';
      c.stdout.on('data', d => { o += d; });
      c.stderr.on('data', d => { e += d; });
      c.on('exit', code => (code === 0 ? resolve(o) : reject(new Error(e))));
      c.stdin.end('what do salaries and prices look like\n');
    });
    const j = JSON.parse(out);
    assert.ok(j.results.length >= 1);
    assert.ok(j.results.every(r => !r.source.startsWith('hr/')));
    assert.match(s.seen[0], /^\/kb-scope\?pid=\d+$/);
  } finally { await s.close(); }
});
