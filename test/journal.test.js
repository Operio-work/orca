'use strict';
// Stop, End, the Journal and the deeper card history: lib/journal.js on its own, then the
// endpoints end to end against the real server.js with the fake herdr CLI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { createJournal, redact, dayOf } = require('../lib/journal');

// ─── lib/journal.js ───────────────────────────────────────────────────────────

test('journal: secrets are redacted before anything is written', () => {
  const out = redact('key sk-ant-api03-abcdefghijklmnopqrstuv, OPENAI_API_KEY=abcdef123456 and ghp_abcdefghijklmnopqrstuvwxyz123456 at https://bob:hunter22@example.com');
  assert.doesNotMatch(out, /abcdefghijklmnopqrstuv|abcdef123456|hunter22|ghp_abc/);
  assert.match(out, /\[secret\]/);
  assert.equal(redact('press Enter to go on'), 'press Enter to go on');
});

test('journal: append-only day files and snapshots, owner-only, digest and review', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-journal-'));
  const j = createJournal({ dir: path.join(dir, 'journal'), keepDays: 30 });
  j.write('agent.new', { who: 'local', agent: { name: 'alpha', terminal: 't1', kind: 'claude', cwd: '~/shop' }, kind: 'claude' });
  j.write('agent.prompt', { who: 'local', agent: { name: 'alpha', terminal: 't1' }, text: 'use AUTH_TOKEN=abcdefgh12345678 please' });
  const id = j.snapshot('alpha', '\x1b[32m●\x1b[0m done\nAPI_KEY=supersecretvalue\n');
  j.write('agent.job', { who: null, agent: { name: 'alpha', terminal: 't1' }, ask: 'fix it', said: 'fixed', secs: 90, out: id });
  j.write('agent.end', { who: 'local', agent: { name: 'alpha', terminal: 't1' }, mode: 'clean', out: id });

  const day = dayOf();
  const file = path.join(dir, 'journal', day + '.jsonl');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.join(dir, 'journal')).mode & 0o777, 0o700);
  const entries = j.readDay(day);
  assert.deepEqual(entries.map(e => e.event), ['agent.new', 'agent.prompt', 'agent.job', 'agent.end']);
  assert.doesNotMatch(JSON.stringify(entries), /abcdefgh12345678/);

  const snap = j.readSnapshot(id);
  assert.match(snap, /● done/);
  assert.doesNotMatch(snap, /supersecretvalue|\x1b/);
  assert.equal(j.readSnapshot('../../etc/passwd'), null);

  const d = j.buildDigest(day, () => 'You');
  assert.equal(d.final, false);
  assert.equal(d.counts.started, 1);
  assert.equal(d.counts.jobs, 1);
  assert.equal(d.counts.prompts, 1);
  assert.equal(d.agents[0].name, 'alpha');
  assert.equal(d.agents[0].ended.mode, 'clean');
  assert.match(j.digestMarkdown(d), /### alpha/);

  j.saveDigest(d);
  const r = j.review(day, 'You', 'all fine');
  assert.equal(r.reviewed.by, 'You');
  assert.equal(j.review(day, null).reviewed, null);
});

test('journal: housekeeping compresses old days and deletes days past keepDays', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-journal-'));
  const jdir = path.join(dir, 'journal');
  const j = createJournal({ dir: jdir, keepDays: 30 });
  const today = dayOf();
  const old = j.addDays(today, -10), ancient = j.addDays(today, -40);
  for (const day of [old, ancient]) fs.writeFileSync(path.join(jdir, day + '.jsonl'), JSON.stringify({ ts: Date.now(), event: 'agent.prompt', who: 'local' }) + '\n');
  j.housekeep(() => 'You');
  assert.ok(fs.existsSync(path.join(jdir, old + '.jsonl.gz')));
  assert.ok(!fs.existsSync(path.join(jdir, old + '.jsonl')));
  assert.ok(!fs.existsSync(path.join(jdir, ancient + '.jsonl')));
  assert.equal(j.readDay(old).length, 1); // still readable once gzipped
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(jdir, old + '.jsonl.gz'))).toString().split('\n').filter(Boolean).length, 1);
  assert.equal(j.readDigest(old).final, true); // a finished day gets its final digest
});

// ─── Endpoints, end to end ────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-home-'));
const CFG = path.join(HOME, '.config', 'operio-orca');
const FAKE = path.join(HOME, 'fake-herdr');
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `127.0.0.1:${PORT}`;
let child;

function req(method, p, { host = BASE, origin, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { Host: host, 'Content-Type': 'application/json' };
    if (origin) headers.Origin = origin;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers }, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(buf); } catch { /* text */ } resolve({ status: res.statusCode, json, text: buf, headers: res.headers }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const post = (p, body = {}, origin = `http://${BASE}`) => req('POST', p, { origin, body });
const get = p => req('GET', p);
const fakeState = () => JSON.parse(fs.readFileSync(path.join(FAKE, 'state.json'), 'utf8'));
function setAgent(pane, fields) {
  const st = fakeState();
  Object.assign(st.agents.find(x => x.pane_id === pane), fields);
  fs.writeFileSync(path.join(FAKE, 'state.json'), JSON.stringify(st));
}
const jsonl = f => { try { return fs.readFileSync(path.join(FAKE, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } };
async function newAgent(name) {
  const r = await post('/api/agents/new', { kind: 'claude', name, folder: '~' });
  assert.equal(r.status, 200, r.text);
  return r.json.pane;
}

test.before(async () => {
  fs.mkdirSync(FAKE, { recursive: true });
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { PATH: process.env.PATH, HOME, OPERIO_ORCA_PORT: String(PORT), OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'), FAKE_HERDR_DIR: FAKE, OPERIO_ORCA_POLL_MS: '200' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', c => { out += c; if (out.includes('"event":"listen"')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code + ' ' + out)));
  });
});
test.after(() => { child?.kill(); });

test('stop, end and journal review are writes: they need a same-origin Origin', async () => {
  const pane = await newAgent('guarded');
  for (const p of [`/api/agents/${pane}/stop`, `/api/agents/${pane}/end`, '/api/journal/review']) {
    assert.equal((await req('POST', p, { body: {} })).status, 403, p);
    assert.equal((await post(p, {}, 'http://evil.example')).status, 403, p);
  }
  assert.equal((await req('GET', '/api/journal', { host: 'evil.example' })).status, 421);
  assert.ok(fakeState().agents.some(a => a.pane_id === pane), 'nothing was ended');
});

test('stop interrupts a working agent with Esc and leaves it running', async () => {
  const pane = await newAgent('stopper');
  setAgent(pane, { agent_status: 'working' });
  const r = await post(`/api/agents/${pane}/stop`);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.how, 'esc');
  assert.equal(r.json.status, 'idle');
  assert.ok(jsonl('keys.jsonl').some(k => k.pane === pane && k.key === 'esc'));
  assert.ok(!jsonl('keys.jsonl').some(k => k.pane === pane && k.key === 'ctrl+c'));
  assert.ok(fakeState().agents.some(a => a.pane_id === pane), 'the agent stays');
  assert.equal((await post('/api/agents/w1:p999/stop')).status, 404);
});

test('end: the check says what would be lost, then the agent quits with /exit and its pane closes', async () => {
  const a = await newAgent('ender');
  const b = await newAgent('partner');
  assert.equal((await post('/api/links', { kind: 'talk', from: a, to: b, intro: false })).status, 200);
  assert.equal((await post(`/api/agents/${a}/tags`, { tags: ['shop'] })).status, 200);
  fs.writeFileSync(path.join(FAKE, `out-${a.replace(':', '-')}.txt`), '❯ fix the menu\n● Fixed the menu. DB_PASSWORD=abcdefgh12345678\n');

  const c = await get(`/api/agents/${a}/endcheck`);
  assert.equal(c.status, 200, c.text);
  assert.equal(c.json.name, 'ender');
  assert.deepEqual(c.json.linked, ['partner']);
  assert.equal(c.json.dirty, null); // HOME is not a git folder

  const r = await post(`/api/agents/${a}/end`);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.mode, 'clean');
  assert.equal(r.json.closed, true);
  assert.ok(jsonl('prompts.jsonl').some(p => p.pane === a && p.text === '/exit'));
  assert.ok(!fakeState().agents.some(x => x.pane_id === a));
  const ag = (await get('/api/agents')).json;
  assert.ok(!ag.agents.some(x => x.pane === a));
  assert.ok(!ag.links.some(l => l.from === a || l.to === a), 'its links are gone');
  assert.ok(ag.journal && typeof ag.journal.toReview === 'number');

  // The journal has the end, with its saved output (redacted).
  const jr = await get('/api/journal');
  assert.equal(jr.status, 200);
  const end = jr.json.entries.find(e => e.event === 'agent.end' && e.agent?.name === 'ender');
  assert.ok(end, 'agent.end is journaled');
  assert.equal(end.group, 'lifecycle');
  assert.equal(end.who.name, 'You');
  assert.ok(end.out);
  const out = await get('/api/journal/out?id=' + encodeURIComponent(end.out));
  assert.equal(out.status, 200);
  assert.match(out.text, /Fixed the menu/);
  assert.doesNotMatch(out.text, /abcdefgh12345678/);
  assert.equal((await get('/api/journal/out?id=..%2F..%2Fstate.json')).status, 404);
});

test('journal: timeline filters, history per agent, export, and reviewing only finished days', async () => {
  const pane = await newAgent('writer');
  assert.equal((await post(`/api/agents/${pane}/prompt`, { text: 'write the weekly specials' })).status, 200);
  const term = fakeState().agents.find(x => x.pane_id === pane).terminal_id;

  const all = (await get('/api/journal')).json;
  assert.equal(all.admin, true);
  assert.ok(all.days.includes(all.today));
  assert.ok(all.entries.some(e => e.event === 'agent.prompt' && e.text === 'write the weekly specials'));

  const hist = (await get(`/api/journal?terminal=${encodeURIComponent(term)}&days=7&limit=60`)).json;
  assert.ok(hist.entries.length >= 2);
  assert.ok(hist.entries.every(e => e.agent?.terminal === term || e.to?.terminal === term));
  assert.deepEqual([...new Set(hist.entries.map(e => e.event))].sort(), ['agent.new', 'agent.prompt']);

  const work = (await get('/api/journal?group=work&q=specials')).json;
  assert.ok(work.entries.length >= 1 && work.entries.every(e => e.group === 'work'));

  const md = await get('/api/journal/export');
  assert.equal(md.status, 200);
  assert.match(md.headers['content-disposition'], /orca-journal-\d{4}-\d{2}-\d{2}\.md/);
  assert.match(md.text, /You → writer: write the weekly specials/);

  const digests = (await get('/api/journal/digests')).json;
  assert.ok(digests.digests.some(d => d.day === digests.today && !d.final));
  assert.equal((await get('/api/journal/digest?day=' + digests.today)).json.counts.prompts >= 1, true);
  assert.equal((await post('/api/journal/review', { day: digests.today })).status, 409); // not over yet
  assert.equal((await post('/api/journal/review', { day: 'nope' })).status, 400);

  // A finished day can be reviewed and reopened.
  const jdir = path.join(CFG, 'journal');
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return dayOf(d.getTime()); })();
  fs.writeFileSync(path.join(jdir, yesterday + '.jsonl'), JSON.stringify({ ts: Date.now() - 864e5, id: 'x', event: 'agent.prompt', who: 'local', agent: { name: 'old', terminal: 'tz' }, text: 'hi' }) + '\n');
  const rv = await post('/api/journal/review', { day: yesterday, note: 'checked' });
  assert.equal(rv.status, 200, rv.text);
  assert.equal(rv.json.reviewed.by, 'You');
  assert.equal(rv.json.reviewed.note, 'checked');
  assert.equal((await post('/api/journal/review', { day: yesterday, undo: true })).json.reviewed, null);
});

test('history depth: the card can read up to 2000 lines and a short deep read is retried', async () => {
  const pane = await newAgent('deep');
  const p = `out-${pane.replace(':', '-')}.txt`;
  fs.writeFileSync(path.join(FAKE, p), Array.from({ length: 1500 }, (_, i) => `line ${i + 1}`).join('\n'));
  const r = await get(`/api/agents/${pane}/read?lines=1000`);
  assert.equal(r.status, 200);
  const lines = r.json.text.split('\n');
  assert.equal(lines.length, 1000);
  assert.equal(lines.at(-1), 'line 1500');
  assert.equal((await get(`/api/agents/${pane}/read?lines=99999`)).json.text.split('\n').length, 1500); // capped at 2000

  // herdr answering with just the screen: two more tries, the longest answer wins.
  fs.writeFileSync(path.join(FAKE, p), 'only the screen');
  const before = jsonl('reads.jsonl').filter(x => x.pane === pane).length;
  assert.equal((await get(`/api/agents/${pane}/read?lines=1000`)).json.text, 'only the screen');
  assert.equal(jsonl('reads.jsonl').filter(x => x.pane === pane).length - before, 3);
  // Short reads never retry.
  const before2 = jsonl('reads.jsonl').filter(x => x.pane === pane).length;
  await get(`/api/agents/${pane}/read?lines=80`);
  assert.equal(jsonl('reads.jsonl').filter(x => x.pane === pane).length - before2, 1);
});

test('the journal lives in the config folder, owner-only', () => {
  const jdir = path.join(CFG, 'journal');
  assert.equal(fs.statSync(jdir).mode & 0o777, 0o700);
  const today = fs.readdirSync(jdir).find(f => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.startsWith(dayOf()));
  assert.ok(today);
  assert.equal(fs.statSync(path.join(jdir, today)).mode & 0o777, 0o600);
});
