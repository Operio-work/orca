'use strict';
// Knowledge for agents (lib/kb.js): chunking with line numbers, BM25 ranking, incremental
// reindex, collections, path rules, HTML stripping, the PDF skip reason, and the hosted meaning
// search against a local fake embeddings API (never the real providers): hybrid ranking,
// fallback to keyword with a note, and the vector cache by chunk hash.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const K = require('../lib/kb');
const { createSkills } = require('../lib/skills');

const BUNDLED = path.join(__dirname, '..', 'skills');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-kb-'));
const mode = p => (fs.statSync(p).mode & 0o777).toString(8);
const noPdf = f => K.pdfToText(f, { bin: 'operio-orca-no-such-pdftotext' });

function setup(extra = {}) {
  const home = tmp();
  const configDir = path.join(home, '.config', 'operio-orca');
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  const logs = [];
  const kb = K.createKb({ configDir, log: (e, d) => logs.push([e, d]), pdf: noPdf, ...extra });
  return { home, configDir, kb, logs };
}

test('chunking keeps line numbers, the heading above, overlap, and cuts very long lines', () => {
  const lines = ['# Prices', ''];
  for (let i = 1; i <= 60; i++) lines.push(`Item ${i}: a plate of something good, served hot, ${i * 10} MXN.`);
  lines.push('', '## Hours', 'Open Monday to Saturday 9 to 21.');
  const chunks = K.chunkText(lines.join('\n'));
  assert.ok(chunks.length >= 3, 'several chunks');
  assert.equal(chunks[0].a, 1);
  assert.equal(chunks[0].heading, 'Prices');
  for (const c of chunks) {
    assert.ok(c.text.length <= K.CHUNK + 100, 'about chunk size');
    assert.equal(c.text.split('\n').length, c.b - c.a + 1, 'lines a-b match the text');
    assert.equal(c.text.split('\n')[0], lines[c.a - 1], 'line a is the first line');
  }
  for (let i = 1; i < chunks.length; i++) {
    assert.ok(chunks[i].a <= chunks[i - 1].b, 'consecutive chunks overlap');
    assert.ok(chunks[i].a > chunks[i - 1].a, 'and always move forward');
  }
  const last = chunks.at(-1);
  assert.equal(last.heading === 'Hours' || last.text.includes('## Hours'), true);
  assert.equal(last.b, lines.length);

  const long = K.chunkText('intro\n' + 'word '.repeat(1000) + '\nend');
  assert.ok(long.length >= 4);
  assert.ok(long.every(c => c.text.length <= K.CHUNK));
  assert.ok(long.some(c => c.a === 2 && c.b === 2), 'pieces of line 2 say line 2');
  assert.deepEqual(K.chunkText('\n\n  \n'), [], 'blank text → no chunks');
});

test('html: script, style and tags out; headings kept as # lines; entities decoded', () => {
  const t = K.stripHtml('<html><head><title>T</title><style>p{color:red}</style><script>alert(1)</script></head><body><h2>Refund <b>policy</b></h2><p>Within 7&nbsp;days &amp; with the receipt.</p><!-- hidden --><ul><li>Cash</li><li>Card</li></ul><p>Precio: 25&#36; &aacute;</p></body></html>');
  assert.doesNotMatch(t, /<|alert|color:red|hidden/);
  assert.match(t, /^## Refund policy$/m);
  assert.match(t, /Within 7 days & with the receipt\./);
  assert.match(t, /^Cash$/m);
  assert.match(t, /Precio: 25\$ á/);
});

test('paths: relative, no .., no hidden parts, known types only', () => {
  for (const ok of ['menu.md', 'prices/2026 menu.pdf', 'a/b/c.csv', 'FAQ.HTML', 'x_y-z.json']) assert.equal(K.checkPath(ok), ok);
  for (const bad of ['../x.md', 'a/../b.md', '/etc/passwd.md', '.env.md', 'a/.git/x.md', 'a//b.md', ' lead.md', 'a/ b.md', 'x\\y.md', 'café.md', '', 'a/b/', 'x'.repeat(205) + '.md']) {
    assert.throws(() => K.checkPath(bad), e => e.code === 'bad_path', bad);
  }
  for (const bad of ['run.sh', 'x.exe', 'noext', 'photo.png']) assert.throws(() => K.checkPath(bad), e => e.code === 'bad_type', bad);
  assert.equal(K.checkCollection('prices'), 'prices');
  assert.equal(K.checkCollection(''), null);
  assert.throws(() => K.checkCollection('../x'), e => e.code === 'bad_collection');
});

test('keyword search: BM25 ranks the right document first, accents and plurals folded, sources cited', async () => {
  const { kb } = setup();
  await kb.add('info/hours.md', '# Hours\n\nWe are open Monday to Saturday from 9:00 to 21:00.\nClosed on Sundays and holidays.\n');
  await kb.add('info/menu.md', '# Menu\n\nTacos al pastor 25 MXN.\nQuesadillas 40 MXN.\nAgua de horchata 20 MXN.\n');
  await kb.add('info/politicas.md', '# Políticas\n\nDevoluciones dentro de 7 días con el ticket.\nNo hay reembolsos en efectivo.\n');
  let r = await kb.search('are you open on sunday?');
  assert.equal(r.mode, 'keyword');
  assert.equal(r.results[0].source, 'info/hours.md');
  assert.equal(r.results[0].lines, '1-4');
  assert.match(r.results[0].snippet, /Closed on Sundays/);
  assert.ok(r.results[0].score > 0);
  r = await kb.search('price of quesadilla');
  assert.equal(r.results[0].source, 'info/menu.md');
  r = await kb.search('politica de devolucion'); // no accents in the question
  assert.equal(r.results[0].source, 'info/politicas.md');
  r = await kb.search('helicopter rental');
  assert.deepEqual(r.results, [], 'nothing matches → nothing returned');
  r = await kb.search('MXN', { n: 1 });
  assert.equal(r.results.length, 1);
  await assert.rejects(kb.search('   '), e => e.code === 'empty_query');
});

test('collections: --collection limits the search to one first-level folder', async () => {
  const { kb } = setup();
  await kb.add('prices/menu.md', 'Delivery costs 30 MXN.\n');
  await kb.add('policies/delivery.md', 'Delivery is free over 300 MXN within 5 km.\n');
  await kb.add('notes.md', 'Delivery driver: Luis.\n');
  assert.equal((await kb.search('delivery')).results.length, 3);
  assert.deepEqual((await kb.search('delivery', { collection: 'policies' })).results.map(x => x.source), ['policies/delivery.md']);
  assert.deepEqual((await kb.search('delivery', { collection: 'nope' })).results, []);
  await assert.rejects(kb.search('delivery', { collection: '../x' }), e => e.code === 'bad_collection');
  assert.deepEqual((await kb.status()).collections, ['policies', 'prices']);
});

test('incremental: only changed files are chunked again; removed files leave the index; modes 600/700', async () => {
  const { kb, configDir } = setup();
  const docs = path.join(configDir, 'knowledge');
  await kb.add('a.md', 'alpha one\n');
  await kb.add('b.md', 'bravo two\n');
  await kb.add('c/c.md', 'charlie three\n');
  const chunkFiles = () => Object.fromEntries(fs.readdirSync(path.join(configDir, 'kb-index', 'chunks')).map(f => [f, fs.statSync(path.join(configDir, 'kb-index', 'chunks', f)).mtimeMs]));
  const before = chunkFiles();
  let r = await kb.refresh();
  assert.deepEqual([r.changed, r.removed, r.unchanged], [[], [], 3], 'nothing changed → nothing re-read');

  fs.writeFileSync(path.join(docs, 'b.md'), 'bravo two, now with delta\n');
  fs.utimesSync(path.join(docs, 'b.md'), new Date(), new Date(Date.now() + 5000));
  fs.rmSync(path.join(docs, 'c'), { recursive: true });
  fs.writeFileSync(path.join(docs, '.hidden.md'), 'secret\n');
  fs.writeFileSync(path.join(docs, 'photo.png'), 'x');
  // Same bytes, new mtime: hashed, not chunked again.
  fs.utimesSync(path.join(docs, 'a.md'), new Date(), new Date(Date.now() + 9000));
  r = await kb.refresh();
  assert.deepEqual(r.changed.sort(), ['b.md', 'photo.png']);
  assert.deepEqual(r.removed, ['c/c.md']);
  const after = chunkFiles();
  assert.equal(Object.keys(after).length, 2, 'c.md\'s chunks are gone');
  const unchangedA = Object.keys(before).find(f => after[f] === before[f]);
  assert.ok(unchangedA, 'a.md\'s chunk file was not rewritten');
  assert.equal((await kb.search('delta')).results[0].source, 'b.md');
  assert.deepEqual((await kb.search('secret')).results, [], 'hidden files are ignored');
  const png = kb.list().find(f => f.path === 'photo.png');
  assert.deepEqual([png.status, png.reason], ['skipped', 'unsupported type']);

  r = await kb.reindex({ full: true });
  assert.deepEqual(r.changed.sort(), ['a.md', 'b.md'], '--full reads every document again');
  assert.equal(mode(path.join(configDir, 'kb-index')), '700');
  assert.equal(mode(path.join(configDir, 'kb-index', 'chunks')), '700');
  assert.equal(mode(path.join(configDir, 'kb-index', 'manifest.json')), '600');
  for (const f of fs.readdirSync(path.join(configDir, 'kb-index', 'chunks'))) assert.equal(mode(path.join(configDir, 'kb-index', 'chunks', f)), '600');
  assert.equal(mode(path.join(docs, 'b.md')), '600');
  assert.equal(mode(docs), '700');
});

test('add / remove: limits, empty folders cleaned, never outside the folder', async () => {
  const { kb, configDir } = setup();
  await assert.rejects(kb.add('../escape.md', 'x'), e => e.code === 'bad_path');
  await assert.rejects(kb.add('x.sh', 'x'), e => e.code === 'bad_type');
  await assert.rejects(kb.add('big.txt', Buffer.alloc(K.MAX_FILE + 1, 97)), e => e.code === 'too_large');
  await assert.rejects(kb.add('empty.txt', ''), e => e.code === 'empty_file');
  let r = await kb.add('deep/er/doc.txt', 'hello');
  assert.deepEqual([r.status, r.chunks, r.replaced], ['indexed', 1, false]);
  r = await kb.add('deep/er/doc.txt', 'hello again');
  assert.equal(r.replaced, true);
  r = await kb.remove('deep/er/doc.txt');
  assert.deepEqual([r.removed, r.bytes], [true, 11]);
  assert.ok(!fs.existsSync(path.join(configDir, 'knowledge', 'deep')), 'empty folders removed');
  assert.ok(fs.existsSync(path.join(configDir, 'knowledge')), 'the folder itself stays');
  assert.equal((await kb.remove('deep/er/doc.txt')).removed, false);
  assert.deepEqual(kb.list(), []);
});

test('pdf: without pdftotext the file is listed as skipped with the reason', async () => {
  const { kb } = setup();
  const r = await kb.add('docs/menu.pdf', Buffer.from('%PDF-1.4\n%fake\n'));
  assert.deepEqual([r.status, r.reason, r.chunks], ['skipped', 'pdftotext not installed', 0]);
  const s = await kb.status();
  assert.deepEqual([s.files, s.indexed, s.skipped], [1, 0, 1]);
});

test('the first indexed document installs business-knowledge once; a foreign one is left alone', async () => {
  // Normal: installed, and not again after the person removes it.
  {
    const home = tmp();
    const configDir = path.join(home, '.config', 'operio-orca');
    const skills = createSkills({ home, configDir, bundledDir: BUNDLED });
    const logs = [];
    const log = (e, d) => logs.push([e, d]);
    const kb = K.createKb({ configDir, log, pdf: noPdf, onIndexed: () => K.installKnowledgeSkill(skills, log) });
    await kb.add('docs/a.pdf', Buffer.from('%PDF')); // skipped: not a document yet
    assert.ok(!fs.existsSync(path.join(home, '.claude', 'skills', 'business-knowledge')));
    await kb.add('a.md', 'hello');
    const link = path.join(home, '.claude', 'skills', 'business-knowledge');
    assert.equal(fs.readlinkSync(link), path.join(configDir, 'skills', 'business-knowledge'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(configDir, 'skills', 'business-knowledge', '.operio-skill.json'), 'utf8')).source, 'bundled');
    skills.remove('business-knowledge');
    await kb.add('b.md', 'more');
    assert.ok(!fs.existsSync(link), 'only the first time');
    await kb.remove('a.md');
    await kb.remove('b.md');
  }
  // Foreign: a business-knowledge folder that isn't ORCA's stays; the upload still works.
  {
    const home = tmp();
    const configDir = path.join(home, '.config', 'operio-orca');
    const foreign = path.join(home, '.claude', 'skills', 'business-knowledge');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'mine');
    const skills = createSkills({ home, configDir, bundledDir: BUNDLED });
    const logs = [];
    const log = (e, d) => logs.push([e, d]);
    const kb = K.createKb({ configDir, log, onIndexed: () => K.installKnowledgeSkill(skills, log) });
    const r = await kb.add('a.md', 'hello');
    assert.equal(r.status, 'indexed');
    assert.equal(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8'), 'mine');
    assert.ok(logs.some(([e]) => e === 'kb.skill_skipped'));
  }
});

// ─── Meaning search (hosted) against a fake embeddings API ────────────────────
// Each text becomes a 4-number vector by topic, so "when do you open" lands next to the
// "Horario" document although they share no word.
const TOPICS = [/open|close|hour|horario|abrimos|cerramos|when/i, /price|cost|mxn|precio|cuesta/i, /refund|return|devolu|reembolso/i, /parking|estacionamiento/i];
const vec = s => TOPICS.map(re => (re.test(s) ? 1 : 0.01));

function fakeApi() {
  const calls = [];
  let fail = 0;
  const server = http.createServer((req, res) => {
    let buf = '';
    req.on('data', c => { buf += c; });
    req.on('end', () => {
      const body = JSON.parse(buf);
      calls.push({ url: req.url, auth: req.headers.authorization, body });
      if (fail) { res.writeHead(fail, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ detail: 'boom' })); }
      const input = Array.isArray(body.input) ? body.input : [body.input];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: input.map((t, i) => ({ object: 'embedding', index: i, embedding: vec(t) })), model: body.model, usage: { total_tokens: 1 } }));
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    server, calls, url: `http://127.0.0.1:${server.address().port}/v1/embeddings`, setFail: s => { fail = s; },
  })));
}

async function hostedKb(api, keys, extra = {}) {
  const s = setup({ hosted: true, ...extra });
  const llmFile = path.join(s.configDir, 'llm.env');
  fs.writeFileSync(llmFile, keys, { mode: 0o600 });
  s.kb = K.createKb({ configDir: s.configDir, hosted: true, llmFile, log: (e, d) => s.logs.push([e, d]), pdf: noPdf, env: { OPERIO_ORCA_KB_VOYAGE_URL: api.url, OPERIO_ORCA_KB_OPENAI_URL: api.url }, ...extra });
  await s.kb.add('info/horario.md', '# Horario\n\nAbrimos de lunes a sábado de 9 a 21 h. Domingo cerramos.\n');
  await s.kb.add('info/precios.md', '# Precios\n\nTacos 25 MXN. Quesadillas 40 MXN.\n');
  await s.kb.add('info/parking.md', '# Estacionamiento\n\nHay estacionamiento gratis atrás del local.\n');
  return s;
}

test('hosted + Voyage key: hybrid search finds meaning without shared words; key sent only as Bearer; cache by chunk hash', async () => {
  const api = await fakeApi();
  try {
    const { kb, logs, configDir } = await hostedKb(api, 'VOYAGE_API_KEY=pa-test-secret-123456\n');
    assert.deepEqual(kb.semantic(), { on: true, provider: 'voyage', model: 'voyage-4-lite' });
    const kw = await K.createKb({ configDir, pdf: noPdf }).search('when do you open'); // the free panel: keyword only
    assert.equal(kw.mode, 'keyword');
    assert.ok(!kw.results.some(x => x.source === 'info/horario.md'), 'no shared word → keyword misses it');

    const r = await kb.search('when do you open');
    assert.equal(r.mode, 'hybrid');
    assert.equal(r.note, undefined);
    assert.deepEqual(r.results.map(x => x.source), ['info/horario.md'], 'unrelated passages are not padded in');
    const docCalls = api.calls.filter(c => c.body.input_type === 'document');
    const qCalls = api.calls.filter(c => c.body.input_type === 'query');
    assert.equal(docCalls.length, 1);
    assert.equal(docCalls[0].body.input.length, 3, 'three chunks embedded in one batch');
    assert.equal(docCalls[0].body.model, 'voyage-4-lite');
    assert.deepEqual(qCalls[0].body.input, ['when do you open']);
    assert.ok(api.calls.every(c => c.auth === 'Bearer pa-test-secret-123456'));
    const vf = fs.readdirSync(path.join(configDir, 'kb-index')).find(f => f.startsWith('vectors-voyage-'));
    assert.equal(mode(path.join(configDir, 'kb-index', vf)), '600');

    // Second search: only the question is embedded.
    api.calls.length = 0;
    await kb.search('how much is a taco');
    assert.deepEqual(api.calls.map(c => c.body.input_type), ['query']);

    // One file changes: only its new chunk is embedded.
    api.calls.length = 0;
    await kb.add('info/precios.md', '# Precios\n\nTacos 30 MXN. Quesadillas 45 MXN.\n');
    const r2 = await kb.search('how much is a taco');
    assert.equal(r2.results[0].source, 'info/precios.md');
    const d2 = api.calls.filter(c => c.body.input_type === 'document');
    assert.equal(d2.length, 1);
    assert.equal(d2[0].body.input.length, 1);
    assert.match(d2[0].body.input[0], /Tacos 30 MXN/);
    assert.ok(!JSON.stringify(logs).includes('pa-test-secret'), 'the key is never logged');
  } finally { api.server.close(); }
});

test('hosted: an embedding failure falls back to keyword results with a note; OpenAI used when it is the only key', async () => {
  const api = await fakeApi();
  try {
    const { kb, logs } = await hostedKb(api, 'OPENAI_API_KEY=sk-test-secret-abcdef\n');
    assert.deepEqual(kb.semantic(), { on: true, provider: 'openai', model: 'text-embedding-3-small' });
    api.setFail(500);
    const r = await kb.search('tacos price');
    assert.equal(r.mode, 'keyword');
    assert.match(r.note, /meaning search unavailable \(http_error\)/);
    assert.equal(r.results[0].source, 'info/precios.md');
    assert.ok(logs.some(([e, d]) => e === 'kb.semantic_failed' && d.code === 'http_error'));
    api.setFail(401);
    assert.match((await kb.search('tacos')).note, /bad_key/);
    api.setFail(0);
    api.calls.length = 0;
    const ok = await kb.search('tacos price');
    assert.equal(ok.mode, 'hybrid');
    assert.ok(api.calls.every(c => c.body.input_type === undefined && c.body.model === 'text-embedding-3-small'), 'OpenAI requests carry no input_type');
    assert.ok(!JSON.stringify(logs).includes('sk-test-secret'));
  } finally { api.server.close(); }
});

test('meaning search is off on the free panel (even with a key), and when hosted without a key', async () => {
  const api = await fakeApi();
  try {
    const { configDir } = setup();
    fs.writeFileSync(path.join(configDir, 'llm.env'), 'VOYAGE_API_KEY=pa-x\n', { mode: 0o600 });
    const free = K.createKb({ configDir, env: { OPERIO_ORCA_KB_VOYAGE_URL: api.url } });
    await free.add('a.md', 'tacos');
    assert.deepEqual(free.semantic(), { on: false, why: 'free' });
    assert.equal((await free.search('tacos')).mode, 'keyword');
    const hostedNoKey = setup({ hosted: true }).kb;
    assert.deepEqual(hostedNoKey.semantic(), { on: false, why: 'no_key' });
    assert.equal(api.calls.length, 0, 'the API was never called');
    const custom = K.createKb({ configDir, hosted: true, env: { OPERIO_ORCA_KB_MODEL: 'voyage-4' } });
    assert.deepEqual(custom.semantic(), { on: true, provider: 'voyage', model: 'voyage-4' });
  } finally { api.server.close(); }
});
