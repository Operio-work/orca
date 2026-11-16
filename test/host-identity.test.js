'use strict';
// A hosted panel behind ORCA Host: people come from the signed X-Orca-User header. Roles decide
// what each can do (viewers comment only), Operio staff see the chat only when the client lets
// them, a forged header is nobody, and translation runs on the client's own key (llm.env).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { sign } = require('../lib/identity');

const ROOT = path.join(__dirname, '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-host-'));
const FAKE = path.join(HOME, 'fake-herdr');
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `127.0.0.1:${PORT}`;
const SECRET = 'test-instance-secret';
const LLM_ENV = path.join(HOME, '.config', 'operio-orca', 'llm.env');
let child, api, apiCalls = [], serverLog = '';

const who = (u, n, r, c = 0) => sign(SECRET, { u, n, r, c });
const ADMIN = () => who('ana1', 'Ana', 'client_admin');
const VIEWER = () => who('vic1', 'Victor', 'client_viewer');
const STAFF = () => who('op1', 'Leo', 'operio_ops');
const STAFF_INVITED = () => who('op1', 'Leo', 'operio_ops', 1);

function req(method, p, { user, body, origin = method === 'GET' ? undefined : `http://${BASE}` } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { Host: BASE, 'Content-Type': 'application/json' };
    if (origin) headers.Origin = origin;
    if (user) headers['X-Orca-User'] = user;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers }, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(buf); } catch { /* text */ } resolve({ status: res.statusCode, json }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out'); await new Promise(r => setTimeout(r, 100)); } };

test.before(async () => {
  fs.mkdirSync(FAKE, { recursive: true });
  fs.writeFileSync(path.join(FAKE, 'state.json'), JSON.stringify({ n: 1, agents: [
    { pane_id: 'w1:p1', tab_id: 'w1:t1', terminal_id: 'term1', name: 'writer', agent: 'claude', agent_status: 'idle', cwd: HOME },
  ] }));
  // The Anthropic API, as a stub: records which key called it; a revoked key gets a 401.
  api = http.createServer((q, s) => {
    let body = '';
    q.on('data', c => { body += c; });
    q.on('end', () => {
      const key = q.headers['x-api-key'] || String(q.headers.authorization || '').replace(/^Bearer /, '');
      apiCalls.push({ url: q.url, key, body: JSON.parse(body) });
      if (key === 'sk-ant-revoked') {
        s.writeHead(401, { 'Content-Type': 'application/json' });
        return s.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
      }
      s.writeHead(200, { 'Content-Type': 'application/json' });
      s.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', stop_reason: 'end_turn',
        content: [{ type: 'text', text: '¿Puedes revisar el pedido antes del mediodía, por favor?' }], usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  await new Promise(r => api.listen(0, '127.0.0.1', r));
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: {
      PATH: process.env.PATH, HOME, OPERIO_ORCA_PORT: String(PORT), OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'),
      FAKE_HERDR_DIR: FAKE, OPERIO_ORCA_POLL_MS: '200', OPERIO_ORCA_HOSTED: '1', OPERIO_ORCA_IDENTITY_SECRET: SECRET,
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${api.address().port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', c => { serverLog += c; if (serverLog.includes('"event":"listen"')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code + ' ' + serverLog)));
  });
});
test.after(() => { child?.kill(); api?.close(); });

test('hosted identity: the signed person is who the panel sees', async () => {
  const r = await req('GET', '/api/agents', { user: ADMIN() });
  assert.equal(r.json.me.name, 'Ana');
  assert.equal(r.json.access.admin, true);
  assert.equal(r.json.chat.translate, false); // no Anthropic key in the client's llm.env yet
  const v = await req('GET', '/api/agents', { user: VIEWER() });
  assert.equal(v.json.me.name, 'Victor');
  assert.equal(v.json.access.admin, false);
  const names = v.json.people.map(p => p.name);
  assert.ok(names.includes('Ana') && names.includes('Victor') && !names.includes('You'));
});

test('hosted identity: a forged or stale header is nobody in particular', async () => {
  const forged = sign('not-the-secret', { u: 'x', n: 'Mallory', r: 'operio_admin' });
  assert.equal((await req('GET', '/api/agents', { user: forged })).json.me.name, 'You');
  const stale = sign(SECRET, { u: 'x', n: 'Mallory', r: 'operio_admin' }, Date.now() - 10 * 60e3);
  assert.equal((await req('GET', '/api/agents', { user: stale })).json.me.name, 'You');
});

test('hosted identity: a viewer comments but cannot send work or change anything else', async () => {
  const c = await req('POST', '/api/chat/room', { user: VIEWER(), body: { text: '@Ana looks good to me' } });
  assert.equal(c.status, 200);
  assert.equal(c.json.message.who.name, 'Victor');
  const ask = await req('POST', '/api/chat/t-term1', { user: VIEWER(), body: { text: '@writer shorten the intro' } });
  assert.equal(ask.status, 200);
  assert.deepEqual(ask.json.asks.map(a => [a.name, a.state, a.reason]), [['writer', 'refused', 'no_access']]);
  assert.equal((await req('POST', '/api/agents/w1:p1/prompt', { user: VIEWER(), body: { text: 'hi' } })).status, 403);
  assert.equal((await req('POST', '/api/map/order', { user: VIEWER(), body: { order: [] } })).status, 403);
  // Ana was mentioned: her room shows it.
  const mine = await req('GET', '/api/agents', { user: ADMIN() });
  assert.equal(mine.json.chat.room.mention, true);
});

test('hosted identity: an admin @agent sends the work, signed with her name', async () => {
  const r = await req('POST', '/api/chat/t-term1', { user: ADMIN(), body: { text: '@writer shorten the intro please' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.asks[0].state, 'queued');
  const sent = await until(() => { try { return fs.readFileSync(path.join(FAKE, 'prompts.jsonl'), 'utf8'); } catch { return null; } });
  assert.match(sent, /ORCA team chat/);
  assert.match(sent, /Ana/);
});

test('hosted identity: Operio staff see the team chat only when the client invited them', async () => {
  const out = await req('GET', '/api/agents', { user: STAFF() });
  assert.equal(out.json.chat, null);
  assert.equal((await req('GET', '/api/chat/room', { user: STAFF() })).status, 404);
  const inv = await req('GET', '/api/chat/room', { user: STAFF_INVITED() });
  assert.equal(inv.status, 200);
  const p = await req('POST', '/api/chat/room', { user: STAFF_INVITED(), body: { text: 'Hi, Leo from Operio here.' } });
  assert.equal(p.json.message.who.name, 'Operio — Leo');
});

test('hosted identity: translation runs on the client\'s own key, read from llm.env', async () => {
  const setKey = v => {
    fs.mkdirSync(path.dirname(LLM_ENV), { recursive: true });
    fs.writeFileSync(LLM_ENV, v ? `ANTHROPIC_API_KEY=${v}\n` : '# no keys\n', { mode: 0o600 });
    const later = new Date(Date.now() + (apiCalls.length + 1) * 2000);
    fs.utimesSync(LLM_ENV, later, later); // a new mtime, even within the same millisecond
  };
  const m = await req('POST', '/api/chat/room', { user: ADMIN(), body: { text: 'Can you check the order before noon please?' } });
  assert.equal((await req('POST', '/api/chat/room/translate', { user: VIEWER(), body: { id: m.json.message.id, to: 'es' } })).status, 404);

  setKey('sk-ant-client-own');
  assert.equal((await req('GET', '/api/agents', { user: VIEWER() })).json.chat.translate, true);
  const t = await req('POST', '/api/chat/room/translate', { user: VIEWER(), body: { id: m.json.message.id, to: 'es' } });
  assert.equal(t.status, 200);
  assert.equal(t.json.text, '¿Puedes revisar el pedido antes del mediodía, por favor?');
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].url, '/v1/messages');
  assert.equal(apiCalls[0].key, 'sk-ant-client-own');
  assert.equal(apiCalls[0].body.model, 'claude-haiku-5-5');

  // A refused key says so (the client fixes it in Model access).
  setKey('sk-ant-revoked');
  const m2 = await req('POST', '/api/chat/room', { user: ADMIN(), body: { text: 'Thanks, see you tomorrow.' } });
  const bad = await req('POST', '/api/chat/room/translate', { user: VIEWER(), body: { id: m2.json.message.id, to: 'es' } });
  assert.equal(bad.status, 502);
  assert.equal(bad.json.error, 'translate_key');
  assert.equal(apiCalls.at(-1).key, 'sk-ant-revoked');

  // The key removed: translation is off again, without a restart.
  setKey('');
  assert.equal((await req('GET', '/api/agents', { user: VIEWER() })).json.chat.translate, false);
});

test('hosted identity: client admins and Operio staff may ask for a skill; viewers only look', async () => {
  for (const [user, want] of [[ADMIN(), true], [STAFF(), true], [VIEWER(), false]]) {
    const r = await req('GET', '/api/skills', { user });
    assert.equal(r.status, 200);
    assert.equal(r.json.mode, 'hosted');
    assert.equal(r.json.canRequest, want);
  }
});
