'use strict';
// Team chat on an ORCA Host panel (OPERIO_ORCA_HOSTED=1), end to end against server.js with the
// fake herdr: post, read, unread counts, delete, the same-origin rule, translation off without a key.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-chat-'));
const FAKE = path.join(HOME, 'fake-herdr');
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `127.0.0.1:${PORT}`;
let child;

function req(method, p, { origin, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { Host: BASE, 'Content-Type': 'application/json' };
    if (origin) headers.Origin = origin;
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
const post = (p, body, origin = `http://${BASE}`) => req('POST', p, { origin, body });

test.before(async () => {
  fs.mkdirSync(FAKE, { recursive: true });
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { PATH: process.env.PATH, HOME, OPERIO_ORCA_PORT: String(PORT), OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'), FAKE_HERDR_DIR: FAKE, OPERIO_ORCA_POLL_MS: '200', OPERIO_ORCA_HOSTED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', c => { out += c; if (out.includes('"event":"listen"')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code + ' ' + out)));
  });
});
test.after(() => { child?.kill(); });

test('hosted: the team room takes a message and lists it', async () => {
  const before = await req('GET', '/api/agents');
  assert.equal(before.json.chat.translate, false); // no ANTHROPIC_API_KEY in this environment
  assert.equal(before.json.chat.room.n, 0);
  const r = await post('/api/chat/room', { text: 'Hello team' });
  assert.equal(r.status, 200);
  assert.equal(r.json.message.text, 'Hello team');
  assert.equal(r.json.message.mine, true);
  assert.equal(r.json.message.lang, null); // too short to tell
  const list = await req('GET', '/api/chat/room');
  assert.equal(list.status, 200);
  assert.deepEqual(list.json.messages.map(m => m.text), ['Hello team']);
  assert.equal((await req('GET', '/api/agents')).json.chat.room.n, 1);
});

test('hosted: writes need a same-origin Origin; bad threads and empty text are refused', async () => {
  assert.equal((await req('POST', '/api/chat/room', { body: { text: 'x' } })).status, 403);
  assert.equal((await post('/api/chat/room', { text: 'x' }, 'http://evil.example')).status, 403);
  assert.equal((await post('/api/chat/room', { text: '   ' })).status, 400);
  assert.equal((await req('GET', '/api/chat/..%2Fetc')).status, 400);
  assert.equal((await post('/api/chat/t-nosuchterminal', { text: 'hi' })).status, 409); // not a live agent
});

test('hosted: your own message can be deleted; translation is off without a key', async () => {
  const r = await post('/api/chat/room', { text: 'Can you check the order before noon please?' });
  assert.equal(r.json.message.lang, 'en');
  assert.equal((await post('/api/chat/room/translate', { id: r.json.message.id, to: 'es' })).status, 404);
  assert.equal((await post('/api/chat/room/delete', { id: r.json.message.id })).status, 200);
  const list = await req('GET', '/api/chat/room');
  const m = list.json.messages.find(x => x.id === r.json.message.id);
  assert.equal(m.deleted, true);
  assert.equal(m.text, '');
});
