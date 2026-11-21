'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const sleepState = require('../lib/sleep');

test('sleep state reconciliation keeps live sleeps, resumes pids for missing panes, and handles due wakes', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const state = {
    'w1:p1': { pids: [11], wakeAt: '2025-12-31T23:59:00Z' },
    'w1:p2': { pids: [22], wakeAt: '2026-01-01T00:10:00Z' },
    'w1:p3': { pids: [33], wakeAt: null },
    'w1:p4': { pids: [44, 33], wakeAt: null },
    'w1:p5': { pids: [], wakeAt: null },
    'w1:p6': { pids: [66], wakeAt: null },
  };
  const plan = sleepState.reconcile(state, new Set(['w1:p1', 'w1:p2', 'w1:p3', 'w1:p5', 'w1:p6']), pid => pid !== 33, now);
  assert.deepEqual(plan, { drop: ['w1:p3', 'w1:p5'], wake: ['w1:p1'], arm: ['w1:p2'], release: ['w1:p4'] });
});

test('wake only nudges when an agent that was working or blocked is idle or errored', () => {
  assert.equal(sleepState.shouldNudge('idle', 'idle'), false);
  assert.equal(sleepState.shouldNudge('done', 'idle'), false);
  assert.equal(sleepState.shouldNudge('working', 'working'), false);
  assert.equal(sleepState.shouldNudge('blocked', 'blocked'), false);
  assert.equal(sleepState.shouldNudge('working', 'idle'), true);
  assert.equal(sleepState.shouldNudge('blocked', 'done'), true);
  assert.equal(sleepState.shouldNudge('working', 'error'), true);
});

test('wake duration accepts only whole minutes from 1 through 1440', () => {
  assert.equal(sleepState.wakeInMinutes({}), null);
  assert.equal(sleepState.wakeInMinutes({ wakeInMinutes: 1 }), 1);
  assert.equal(sleepState.wakeInMinutes({ wakeInMinutes: 1440 }), 1440);
  for (const n of [0, -1, 1441, 1.5, '5', null]) assert.equal(sleepState.wakeInMinutes({ wakeInMinutes: n }), undefined);
});

test('sleep routes validate pane ids and wake duration over HTTP', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-sleep-test-'));
  const fake = path.join(home, 'fake-herdr');
  const port = 30000 + Math.floor(Math.random() * 20000);
  const base = `127.0.0.1:${port}`;
  const shell = spawn(process.execPath, ['-e', "const {spawn}=require('child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000)"], { stdio: ['ignore', 'pipe', 'ignore'] });
  let childPid = null;
  await new Promise((resolve, reject) => {
    let out = '';
    const timeout = setTimeout(() => reject(new Error('fake shell did not start its child')), 5000);
    shell.stdout.on('data', c => {
      out += c;
      if (out.includes('\n')) { childPid = Number(out.trim()); clearTimeout(timeout); resolve(); }
    });
    shell.once('exit', code => reject(new Error(`fake shell exited ${code}`)));
  });
  fs.mkdirSync(fake, { recursive: true });
  fs.writeFileSync(path.join(fake, 'state.json'), JSON.stringify({ agents: [
    { pane_id: 'w1:p1', tab_id: 'w1:t1', terminal_id: 'term1', name: 'sleep-test', agent: 'claude', agent_status: 'idle', shell_pid: shell.pid },
  ] }));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { PATH: process.env.PATH, HOME: home, OPERIO_ORCA_PORT: String(port), OPERIO_ORCA_HERDR_BIN: path.join(__dirname, 'fixtures', 'fake-herdr'), FAKE_HERDR_DIR: fake, OPERIO_ORCA_POLL_MS: '1000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { child.kill(); try { process.kill(childPid, 'SIGKILL'); } catch {} shell.kill('SIGKILL'); fs.rmSync(home, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => {
    let out = '';
    const timeout = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 10000);
    child.stdout.on('data', chunk => {
      out += chunk;
      if (out.includes('"event":"listen"')) { clearTimeout(timeout); resolve(); }
    });
    child.once('exit', code => reject(new Error(`server exited ${code}: ${out}`)));
  });
  const request = (method, url, body) => new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers: {
      Host: base, ...(data ? { Origin: `http://${base}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
    } }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => { let json; try { json = JSON.parse(text); } catch {} resolve({ status: res.statusCode, json }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
  const until = async fn => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 50)); }
    throw new Error('timed out waiting for process state');
  };
  const procState = pid => {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
    } catch { return null; }
  };
  assert.equal((await request('GET', '/api/agents/sleeping')).status, 200);
  assert.deepEqual((await request('GET', '/api/agents/sleeping')).json, []);
  const initial = await request('GET', '/api/agents');
  assert.equal(initial.json.agents[0].state, 'active');
  assert.deepEqual((await request('POST', '/api/agents/bad-pane/sleep', {})).json, { error: 'bad_request' });
  assert.deepEqual((await request('POST', '/api/agents/w1%3Ap1/sleep', { wakeInMinutes: 0 })).json, { error: 'bad_request' });
  assert.deepEqual((await request('POST', '/api/agents/w1%3Ap1/sleep', null)).json, { error: 'bad_request' });
  const sleeping = await request('POST', '/api/agents/w1%3Ap1/sleep', {});
  assert.equal(sleeping.status, 200, JSON.stringify(sleeping.json));
  assert.equal(sleeping.json.agent.paneId, 'w1:p1');
  assert.equal(sleeping.json.agent.pid, childPid);
  await until(() => procState(childPid) === 'T');
  assert.notEqual(procState(shell.pid), 'T', 'the pane shell stays running');
  assert.deepEqual((await request('POST', '/api/agents/w1%3Ap1/sleep', {})).json, { error: 'already_sleeping' });
  assert.equal((await request('GET', '/api/agents')).json.agents[0].state, 'sleeping');
  assert.equal((await request('GET', '/api/agents')).json.sleeping.length, 1);
  const woke = await request('POST', '/api/agents/w1%3Ap1/wake', {});
  assert.deepEqual(woke.json, { agent: { id: 'w1:p1', name: 'sleep-test', state: 'active' }, nudged: false });
  await until(() => procState(childPid) !== 'T');
  assert.equal((await request('POST', '/api/agents/w1%3Ap1/wake', {})).json.error, 'not_sleeping');
  assert.equal(fs.existsSync(path.join(fake, 'prompts.jsonl')), false, 'an agent that was idle before sleep is not nudged');
  assert.equal((await request('POST', '/api/agents/w1%3Ap1/sleep', {})).status, 200);
  await until(() => procState(childPid) === 'T');
  const finished = await request('POST', '/api/agents/w1%3Ap1/finish', {});
  assert.deepEqual(finished.json, { id: 'w1:p1', state: 'terminated' });
  await until(() => procState(childPid) !== 'T');
  assert.deepEqual(await request('GET', '/api/agents/sleeping').then(r => r.json), []);
});
