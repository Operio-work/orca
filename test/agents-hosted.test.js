'use strict';
// Saved agents, accounts and MCP tools on a hosted panel: the client's admins set up agents,
// only Operio staff set up logins and tools (they hold credentials), viewers change nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { sign } = require('../lib/identity');

const ROOT = path.join(__dirname, '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'operio-orca-agents-'));
const FAKE = path.join(HOME, 'fake-herdr');
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `127.0.0.1:${PORT}`;
const SECRET = 'test-instance-secret';
let child;
const who = (u, n, r) => sign(SECRET, { u, n, r, c: 0 });
const ADMIN = () => who('ana1', 'Ana', 'client_admin');
const VIEWER = () => who('vic1', 'Victor', 'client_viewer');
const STAFF = () => who('op1', 'Leo', 'operio_ops');

function req(method, p, { user, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { Host: BASE, 'Content-Type': 'application/json' };
    if (method !== 'GET') headers.Origin = `http://${BASE}`;
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

test.before(async () => {
  fs.mkdirSync(FAKE, { recursive: true });
  fs.writeFileSync(path.join(FAKE, 'state.json'), JSON.stringify({ n: 1, agents: [] }));
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { PATH: process.env.PATH, HOME, OPERIO_ORCA_PORT: String(PORT), OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'),
      FAKE_HERDR_DIR: FAKE, OPERIO_ORCA_POLL_MS: '200', OPERIO_ORCA_HOSTED: '1', OPERIO_ORCA_IDENTITY_SECRET: SECRET },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { if ((await req('GET', '/api/meta', { user: STAFF() })).status === 200) return; } catch { /* starting */ } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start');
});
test.after(() => child?.kill());

const agent = { id: 'helper', create: true, kind: 'claude', folder: '~', instructions: 'Help.' };

test('hosted: client admins set up saved agents; viewers cannot', async () => {
  assert.equal((await req('POST', '/api/profiles', { user: VIEWER(), body: agent })).status, 403);
  assert.equal((await req('POST', '/api/profiles', { user: ADMIN(), body: agent })).status, 200);
  const list = await req('GET', '/api/profiles', { user: ADMIN() });
  assert.equal(list.json.canEdit, true);
  assert.deepEqual(list.json.profiles.map(p => p.id), ['helper']);
  assert.equal((await req('GET', '/api/profiles', { user: VIEWER() })).json.canEdit, false);
});

test('hosted: only Operio staff manage accounts and MCP tools (they hold credentials)', async () => {
  const tool = { id: 'crm', type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer ${CRM_TOKEN}' } };
  for (const user of [ADMIN(), VIEWER()]) {
    assert.equal((await req('POST', '/api/tools', { user, body: tool })).status, 403);
    assert.equal((await req('POST', '/api/tools/secret', { user, body: { name: 'CRM_TOKEN', value: 'x' } })).status, 403);
    assert.equal((await req('POST', '/api/accounts', { user, body: { kind: 'codex', label: 'work' } })).status, 403);
    assert.equal((await req('GET', '/api/tools', { user })).status, 403);
  }
  assert.equal((await req('POST', '/api/tools', { user: STAFF(), body: tool })).status, 200);
  assert.equal((await req('POST', '/api/tools/secret', { user: STAFF(), body: { name: 'CRM_TOKEN', value: 'tok' } })).status, 200);
  const view = await req('GET', '/api/tools', { user: STAFF() });
  assert.deepEqual(view.json.secrets, ['CRM_TOKEN']);
  assert.ok(!JSON.stringify(view.json).includes('tok"'));
  // The client admin still sees the tool by name to tick it on an agent, never its secret.
  const forAgents = await req('GET', '/api/profiles', { user: ADMIN() });
  assert.equal(forAgents.status, 200);
});

test('hosted: Admin overview shows tools only to Operio staff, never People', async () => {
  const a = await req('GET', '/api/admin', { user: ADMIN() });
  assert.equal(a.json.edition, 'hosted');
  assert.equal(a.json.sections.people, false);
  assert.equal(a.json.sections.tools, false);
  assert.equal((await req('GET', '/api/admin', { user: STAFF() })).json.sections.tools, true);
  assert.equal((await req('GET', '/api/admin', { user: VIEWER() })).status, 403);
});
