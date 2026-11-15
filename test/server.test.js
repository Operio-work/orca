'use strict';
// End to end against the real server.js, with a fake herdr CLI and a throwaway HOME:
// the Host/Origin guard over HTTP, the shell confirmation, and a draft routine from
// "run now" to approval.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-home-'));
const CFG = path.join(HOME, '.config', 'operio-orca');
const FAKE = path.join(HOME, 'fake-herdr');
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `127.0.0.1:${PORT}`;
let child;
let serverLog = ''; // everything the server printed (its JSON log): secrets must never be in it

function req(method, p, { host = BASE, origin, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { Host: host, 'Content-Type': 'application/json' };
    if (origin) headers.Origin = origin;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers }, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(buf); } catch { /* text */ } resolve({ status: res.statusCode, json, text: buf }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const post = (p, body, origin = `http://${BASE}`) => req('POST', p, { origin, body });
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out'); await new Promise(r => setTimeout(r, 100)); } };

test.before(async () => {
  fs.mkdirSync(FAKE, { recursive: true });
  fs.mkdirSync(path.join(CFG, 'routines'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'routines', 'review-reply-desk'), path.join(CFG, 'routines', 'review-reply-desk'), { recursive: true });
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { PATH: process.env.PATH, HOME, OPERIO_ORCA_PORT: String(PORT), OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'), FAKE_HERDR_DIR: FAKE, OPERIO_ORCA_POLL_MS: '200' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', c => { out += c; serverLog += c; if (out.includes('"event":"listen"')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code + ' ' + out)));
  });
});
test.after(() => { child?.kill(); });

test('serves the page on localhost names only', async () => {
  assert.equal((await req('GET', '/')).status, 200);
  assert.equal((await req('GET', '/', { host: `localhost:${PORT}` })).status, 200);
  assert.equal((await req('GET', '/', { host: 'evil.example' })).status, 421);
  assert.equal((await req('GET', '/api/routines', { host: `rebound.evil.example:${PORT}` })).status, 421);
  const page = (await req('GET', '/')).text;
  assert.match(page, /ORCA/);
  assert.match(page, /https:\/\/make\.operio\.work/);
});

test('writes need a same-origin Origin', async () => {
  assert.equal((await req('POST', '/api/shell/unlock', { body: { confirm: true } })).status, 403);
  assert.equal((await post('/api/shell/unlock', { confirm: true }, 'http://evil.example')).status, 403);
  assert.equal((await post('/api/shell/unlock', { confirm: true }, `http://localhost:${PORT}`)).status, 403); // Host was 127.0.0.1
});

test('shells need a confirmation first', async () => {
  assert.equal((await req('GET', '/api/term/w1:p1')).status, 423);
  assert.equal((await post('/api/agents/new', { kind: 'shell', name: 'sh', folder: '~' })).status, 423);
  assert.equal((await post('/api/shell/unlock', {})).status, 400);
  const ok = await post('/api/shell/unlock', { confirm: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.confirmed, true);
  assert.equal((await post('/api/shell/lock', {})).status, 200);
  assert.equal((await req('GET', '/api/shell/state')).json.confirmed, false);
});

test('a draft routine runs, reaches the agent, and waits for approval', async () => {
  const list = (await req('GET', '/api/routines')).json;
  assert.deepEqual(list.routines.map(r => [r.id, r.enabled]), [['review-reply-desk', false]]);
  assert.equal((await post('/api/routines/review-reply-desk/enable', { enabled: true })).json.enabled, true);
  assert.ok((await req('GET', '/api/routines')).json.routines[0].nextAt > Date.now());
  assert.equal((await post('/api/routines/review-reply-desk/schedule', { schedule: 'tomorrow' })).status, 400);
  assert.equal((await post('/api/routines/review-reply-desk/schedule', { schedule: '15 8 * * *' })).json.schedule, '15 8 * * *');

  const run = await post('/api/routines/review-reply-desk/run', {});
  assert.equal(run.status, 200, run.text);
  const out = run.json.output;
  assert.ok(out.startsWith(path.join(CFG, 'drafts', 'review-reply-desk')));

  // The prompt is delivered to the new agent once it is idle.
  const prompts = path.join(FAKE, 'prompts.jsonl');
  const sent = await until(() => fs.existsSync(prompts) && fs.readFileSync(prompts, 'utf8').trim().split('\n').map(JSON.parse));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].pane, run.json.pane);
  assert.ok(sent[0].text.includes(out) && sent[0].text.includes('Review Reply Desk'));

  // Not approvable before the agent writes the draft.
  assert.equal((await post(`/api/routines/runs/${run.json.run}/decide`, { action: 'approve' })).status, 409);
  fs.writeFileSync(out, '# Draft replies\n');
  const ready = (await req('GET', '/api/routines')).json.runs.find(r => r.run === run.json.run);
  assert.equal(ready.state, 'ready');
  assert.equal((await req('GET', `/api/routines/runs/${run.json.run}`)).json.text, '# Draft replies\n');
  assert.equal((await post(`/api/routines/runs/${run.json.run}/decide`, { action: 'approve' })).json.state, 'approved');
  assert.equal((await post(`/api/routines/runs/${run.json.run}/decide`, { action: 'reject' })).status, 409);

  const states = fs.readFileSync(path.join(CFG, 'logs', 'routines.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    .filter(l => l.run === run.json.run).map(l => l.state);
  assert.deepEqual(states, ['started', 'prompt_queued', 'draft_ready', 'approved']);
});

test('an on-demand routine has no schedule, cannot be given one, and runs when asked', async () => {
  fs.cpSync(path.join(ROOT, 'routines', 'showing-day-pack'), path.join(CFG, 'routines', 'showing-day-pack'), { recursive: true });
  const r = (await req('GET', '/api/routines')).json.routines.find(x => x.id === 'showing-day-pack');
  assert.equal(r.schedule, null);
  assert.equal(r.packSchedule, null);
  assert.equal(r.nextAt, null);
  assert.equal((await post('/api/routines/showing-day-pack/enable', { enabled: true })).status, 200);
  assert.equal((await req('GET', '/api/routines')).json.routines.find(x => x.id === 'showing-day-pack').nextAt, null);
  const bad = await post('/api/routines/showing-day-pack/schedule', { schedule: '0 9 * * *' });
  assert.equal(bad.status, 409);
  assert.equal(bad.json.error, 'on_demand');
  const run = await post('/api/routines/showing-day-pack/run', {});
  assert.equal(run.status, 200, run.text);
  assert.ok(run.json.output.startsWith(path.join(CFG, 'reports', 'showing-day-pack')));
});

test('VAPID keys are generated on first run, owner-only', () => {
  const f = path.join(CFG, 'vapid.json');
  assert.ok(JSON.parse(fs.readFileSync(f, 'utf8')).publicKey);
  assert.equal((fs.statSync(f).mode & 0o777).toString(8), '600');
});

test('the first agent on a fresh herdr opens a workspace for itself', async () => {
  const f = path.join(FAKE, 'state.json');
  const st = JSON.parse(fs.readFileSync(f, 'utf8'));
  fs.writeFileSync(f, JSON.stringify({ ...st, noWorkspace: true }));
  const r = await post('/api/agents/new', { kind: 'claude', name: 'first', folder: '~' });
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.pane);
  const ws = fs.readFileSync(path.join(FAKE, 'workspaces.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(ws.length, 1);
  assert.equal(ws[0].cwd, HOME);
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).noWorkspace, undefined);
});

test("an agent's history is read once per state; after that only its screen", async () => {
  const f = path.join(FAKE, 'state.json');
  const st = JSON.parse(fs.readFileSync(f, 'utf8'));
  const pane = 'w1:p90';
  st.agents.push({ pane_id: pane, tab_id: 'w1:t90', terminal_id: 'term90', name: 'deep', agent: 'claude', agent_status: 'idle', state_change_seq: 5, cwd: HOME });
  fs.writeFileSync(f, JSON.stringify(st));
  await until(async () => (await req('GET', '/api/agents')).json?.agents?.some(a => a.pane === pane));
  const log = path.join(FAKE, 'reads.jsonl');
  const sources = () => fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.pane === pane).map(r => r.source);
  const read = have => req('GET', `/api/agents/${encodeURIComponent(pane)}/read?lines=40${have ? '&have=1' : ''}`);
  assert.equal((await read(false)).status, 200);
  assert.equal((await read(true)).status, 200);
  assert.deepEqual(sources(), ['recent', 'visible'], 'same state + have=1 reads only the screen');
  assert.equal((await read(false)).status, 200);
  assert.equal(sources().at(-1), 'recent', 'without have=1 the history is read again');
  const st2 = JSON.parse(fs.readFileSync(f, 'utf8'));
  st2.agents.find(a => a.pane_id === pane).state_change_seq = 6;
  fs.writeFileSync(f, JSON.stringify(st2));
  await until(async () => (await req('GET', '/api/agents')).json?.agents?.find(a => a.pane === pane)?.seq === 6);
  assert.equal((await read(true)).status, 200);
  assert.equal(sources().at(-1), 'recent', 'a new state reads the history again');
});

test('/api/meta reports the panel version', async () => {
  const r = await req('GET', '/api/meta');
  assert.equal(r.status, 200);
  assert.equal(r.json.version, require('../package.json').version);
});

test("a Claude agent's model is switched from its card, only while it is free", async () => {
  const f = path.join(FAKE, 'state.json');
  const st = JSON.parse(fs.readFileSync(f, 'utf8'));
  st.agents.push(
    { pane_id: 'w1:p91', tab_id: 'w1:t91', terminal_id: 'term91', name: 'free', agent: 'claude', agent_status: 'idle', cwd: HOME },
    { pane_id: 'w1:p92', tab_id: 'w1:t92', terminal_id: 'term92', name: 'busy', agent: 'claude', agent_status: 'working', cwd: HOME },
    { pane_id: 'w1:p93', tab_id: 'w1:t93', terminal_id: 'term93', name: 'other', agent: 'codex', agent_status: 'idle', cwd: HOME },
  );
  fs.writeFileSync(f, JSON.stringify(st));
  await until(async () => (await req('GET', '/api/agents')).json?.agents?.some(a => a.pane === 'w1:p93'));
  const model = (pane, m) => post(`/api/agents/${encodeURIComponent(pane)}/model`, { model: m });
  assert.deepEqual((await req('GET', '/api/meta')).json.models.claude.includes('sonnet'), true);
  assert.equal((await model('w1:p91', 'not-a-model')).status, 400);
  assert.equal((await model('w1:p92', 'sonnet')).json.error, 'busy');
  assert.equal((await model('w1:p93', 'sonnet')).json.error, 'no_models');
  const ok = await model('w1:p91', 'sonnet');
  assert.equal(ok.status, 200);
  const sent = fs.readFileSync(path.join(FAKE, 'prompts.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(p => p.pane === 'w1:p91');
  assert.deepEqual(sent.map(p => p.text), ['/model sonnet']);
  const agents = (await req('GET', '/api/agents')).json.agents;
  assert.equal(agents.find(a => a.pane === 'w1:p91').model, 'sonnet');
  assert.equal(agents.find(a => a.pane === 'w1:p92').model, null);
});

test('LLM keys: set writes llm.env 0600, the API and log never carry the value, unset, apply refuses while an agent works', async () => {
  const KEY = 'sk-test-abcdefghijklmnop1234'; // the shape of a key, not one
  const f = path.join(CFG, 'llm.env');
  let r = await req('GET', '/api/llm');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.keys, []);
  assert.equal(r.json.demo, false);
  assert.equal(r.json.file, '~/.config/operio-orca/llm.env');
  // Writes need a same-origin Origin, like every other write.
  assert.equal((await req('POST', '/api/llm/set', { body: { name: 'ANTHROPIC_API_KEY', value: KEY } })).status, 403);
  assert.ok(!fs.existsSync(f));

  r = await post('/api/llm/set', { name: 'ANTHROPIC_API_KEY', value: KEY + '\n' });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.keys, [{ name: 'ANTHROPIC_API_KEY', hint: '****1234' }]);
  assert.equal((fs.statSync(f).mode & 0o777).toString(8), '600');
  assert.match(fs.readFileSync(f, 'utf8'), new RegExp(`^ANTHROPIC_API_KEY=${KEY}$`, 'm'), 'one trailing newline dropped');
  assert.equal((await post('/api/llm/set', { name: 'bad name', value: KEY })).json.error, 'llm_bad_name');
  assert.equal((await post('/api/llm/set', { name: 'OPENAI_API_KEY', value: '' })).json.error, 'llm_empty');
  assert.equal((await post('/api/llm/set', { name: 'OPENAI_API_KEY', value: 'two words' })).json.error, 'llm_bad_value');
  assert.equal((await post('/api/llm/set', { name: 'OPENAI_BASE_URL', value: 'http://127.0.0.1:11434/v1' })).status, 200);
  r = await req('GET', '/api/llm');
  assert.deepEqual(r.json.keys, [{ name: 'ANTHROPIC_API_KEY', hint: '****1234' }, { name: 'OPENAI_BASE_URL', hint: '****4/v1' }]);
  assert.doesNotMatch(r.text, new RegExp(KEY), 'values never come back');
  await until(() => serverLog.includes('"event":"llm.set"'));
  assert.doesNotMatch(serverLog, new RegExp(KEY), 'the value is not in the server log');

  // Apply: an agent is still working (from the model test), so nothing is restarted.
  r = await post('/api/llm/apply', {});
  assert.equal(r.status, 409, r.text);
  assert.equal(r.json.error, 'busy');
  assert.ok(r.json.agents.includes('busy'), `names the agent: ${r.text}`);
  // All idle: the CLI runs; this herdr is the fake and was not started by ORCA (no pid), so it says so.
  const stf = path.join(FAKE, 'state.json');
  const st = JSON.parse(fs.readFileSync(stf, 'utf8'));
  st.agents.forEach(a => { a.agent_status = 'idle'; });
  fs.writeFileSync(stf, JSON.stringify(st));
  await until(async () => !(await req('GET', '/api/agents')).json.agents.some(a => a.status === 'working' || a.status === 'blocked'));
  r = await post('/api/llm/apply', {});
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result, 'not_managed');
  assert.match(r.json.detail, /no pid on record/);

  r = await post('/api/llm/unset', { name: 'ANTHROPIC_API_KEY' });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.keys, [{ name: 'OPENAI_BASE_URL', hint: '****4/v1' }]);
  assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /ANTHROPIC_API_KEY/);
  assert.equal((await post('/api/llm/unset', { name: 'ANTHROPIC_API_KEY' })).status, 200, 'unset is idempotent');
  assert.equal((await post('/api/llm/unset', { name: 'nope' })).json.error, 'llm_bad_name');
  assert.equal((fs.statSync(f).mode & 0o777).toString(8), '600');
});

test('the map order is saved and comes back with the agents', async () => {
  assert.equal((await post('/api/map/order', { order: ['w1:t2', 'w1:t1', 'w1:t2'] })).status, 200);
  const r = await req('GET', '/api/agents');
  assert.deepEqual(r.json.mapOrder, ['w1:t2', 'w1:t1']); // duplicates dropped, order kept
  assert.equal((await post('/api/map/order', { order: ['not a tab'] })).status, 400);
  assert.equal((await post('/api/map/order', { order: 'w1:t1' })).status, 400);
});

test('renaming a workspace or tab checks the id and the name before calling herdr', async () => {
  assert.equal((await post('/api/workspaces/w1/rename', { label: 'bad/name' })).json.error, 'bad_name');
  assert.equal((await post('/api/workspaces/nope/rename', { label: 'Office' })).json.error, 'bad_request');
  assert.equal((await post('/api/tabs/w1/rename', { label: 'Office' })).json.error, 'bad_request'); // a workspace id is not a tab id
});

test('a new agent can start on a model; a model its kind does not take is refused', async () => {
  const bad = await post('/api/agents/new', { name: 'm-bad', kind: 'claude', folder: '~', tab: 'new', model: 'gpt' });
  assert.equal(bad.status, 400);
  const other = await post('/api/agents/new', { name: 'm-other', kind: 'codex', folder: '~', tab: 'new', model: 'opus' });
  assert.equal(other.status, 400);
});

test('the free panel has no team chat: no API, nothing in the agents list', async () => {
  assert.equal((await req('GET', '/api/chat/room')).status, 404);
  assert.equal((await post('/api/chat/room', { text: 'hi' })).status, 404);
  const r = await req('GET', '/api/agents');
  assert.equal(r.status, 200);
  assert.equal(r.json.chat, null);
});
