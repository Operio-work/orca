'use strict';
// `operio-orca demo`: the scripted timeline, the demo herdr stand-in, the seeded folder and
// the panel in demo mode. Everything runs in throwaway folders.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const tl = require('../demo/timeline');
const { CLIENTS, ROUTINES, HISTORY } = require('../demo/clients');
const setup = require('../demo/setup');
const routinesLib = require('../lib/routines');

const bistro = CLIENTS.find(c => c.id === 'harbor-street-bistro');
const resv = bistro.agents.find(a => a.name === 'reservations');
const text = v => v.lines.map(l => l.text).join('\n');
const made = [];
const tmp = name => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `operio-orca-${name}-`)); made.push(d); return d; };
test.after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

// When the reservations agent asks its question at speed 1 (delay + last work line + 1.2 s).
const ASK_AT = (resv.delay + resv.work[resv.work.length - 1][0] + 1.2) * 1000;

test('demo data: two fictional clients, 3-4 agents each, safe contact details only', () => {
  assert.deepEqual(CLIENTS.map(c => c.name), ['Harbor Street Bistro', 'Brightside Dental']);
  for (const c of CLIENTS) {
    assert.ok(c.agents.length >= 3 && c.agents.length <= 4, c.id);
    for (const a of c.agents) {
      assert.ok(a.ask.options.length >= 2 && a.ask.options.length <= 3, a.name);
      for (let n = 1; n <= a.ask.options.length; n++) assert.ok(a.after[n]?.length, `${a.name} option ${n}`);
      assert.ok(a.text('hello').length, a.name);
    }
  }
  const src = fs.readFileSync(path.join(ROOT, 'demo', 'clients.js'), 'utf8');
  for (const m of src.matchAll(/\(?\d{3}\)?[ .-]\d{3}-\d{4}/g)) assert.match(m[0], /^\(555\) 010-01\d\d$/, m[0]);
  for (const m of src.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) assert.match(m[0], /@([\w-]+\.)*example\.com$/, m[0]);
  for (const m of src.matchAll(/\b[\w-]+\.example\.com\b|\b[a-z][\w-]*\.(com|net|org|mx)\b/g)) assert.match(m[0], /example\.com$/, m[0]);
});

test('timeline: working -> needs you -> working -> done -> next turn, deterministic', () => {
  const st = tl.freshState({ now: 0 });
  assert.equal(tl.scriptedView(resv, st, 500).status, 'working');
  assert.equal(tl.scriptedView(resv, st, ASK_AT - 10).status, 'working');
  const asking = tl.scriptedView(resv, st, ASK_AT + 10);
  assert.equal(asking.status, 'blocked');
  assert.match(text(asking), /How should I answer the Morgan party\?\n\n❯ 1\. Join tables/);
  // Waits for the viewer, however long it takes.
  assert.equal(tl.scriptedView(resv, st, ASK_AT + 3600e3).status, 'blocked');
  // Same state + same time = the same screen.
  assert.deepEqual(tl.scriptedView(resv, st, ASK_AT + 10), asking);

  st.inputs[resv.pane] = [{ at: ASK_AT + 5000, kind: 'key', value: '2' }];
  assert.equal(tl.scriptedView(resv, st, ASK_AT + 5500).status, 'working');
  const done = tl.scriptedView(resv, st, ASK_AT + 15000);
  assert.equal(done.status, 'done');
  assert.match(text(done), /You chose: 2\. Offer 6:30 pm instead/);
  assert.match(text(done), /seat\s+all 8 of you at 6:30 pm|all 8 of you at 6:30 pm/);
  assert.ok(done.seq > asking.seq);
  // After the hold, the next turn starts from the top, with the last one above it.
  const again = tl.scriptedView(resv, st, ASK_AT + 15000 + resv.hold * 1000);
  assert.equal(again.status, 'working');
  assert.match(text(again), /Offer 6:30 pm instead[\s\S]*❯ Answer tonight’s reservation requests/);
});

test('timeline: the answer changes what comes next', () => {
  const after = value => {
    const st = tl.freshState({ now: 0 });
    st.inputs[resv.pane] = [{ at: ASK_AT + 1000, kind: value.length === 1 ? 'key' : 'text', value }];
    return text(tl.scriptedView(resv, st, ASK_AT + 20000));
  };
  const one = after('1'), two = after('2'), three = after('3');
  assert.match(one, /tables 4 \+ 5/);
  assert.match(three, /waitlist/);
  assert.notEqual(one, two);
  assert.notEqual(two, three);
  const typed = after('Offer them the private room at 8');
  assert.match(typed, /❯ Offer them the private room at 8/);
  assert.match(typed, /Following your note for the Morgan party: “Offer them the private room at 8”/);
  // A key that is not an option does nothing.
  assert.equal(tl.scriptedView(resv, { ...tl.freshState({ now: 0 }), inputs: { [resv.pane]: [{ at: ASK_AT + 1000, kind: 'key', value: '9' }] } }, ASK_AT + 20000).status, 'blocked');
});

test('timeline: --speed scales the script, auto agents answer themselves', () => {
  const st = tl.freshState({ now: 0, speed: 2 });
  assert.equal(tl.scriptedView(resv, st, ASK_AT / 2 - 10).status, 'working');
  assert.equal(tl.scriptedView(resv, st, ASK_AT / 2 + 10).status, 'blocked');
  const auto = bistro.agents.find(a => a.auto);
  const s1 = tl.freshState({ now: 0 });
  const ask = (auto.delay + auto.work[auto.work.length - 1][0] + 1.2) * 1000;
  assert.equal(tl.scriptedView(auto, s1, ask + auto.auto * 1000 - 10).status, 'blocked');
  const v = tl.scriptedView(auto, s1, ask + auto.auto * 1000 + 20000);
  assert.equal(v.status, 'done');
  assert.match(text(v), /Picked by default: 1\./);
});

function herdr(dir, home, ...args) {
  try {
    return execFileSync(path.join(ROOT, 'demo', 'demo-herdr'), args, { env: { PATH: process.env.PATH, HOME: home, OPERIO_ORCA_DEMO_DIR: dir }, encoding: 'utf8' });
  } catch (e) { return e.stdout; }
}

test('demo-herdr answers like herdr and records the viewer’s reply', () => {
  const dir = tmp('demo-herdr');
  const home = path.join(dir, 'home');
  tl.saveState(dir, tl.freshState({ now: Date.now() - ASK_AT - 2000 })); // reservations is asking
  const agents = JSON.parse(herdr(dir, home, 'agent', 'list')).result.agents;
  assert.deepEqual(agents.map(a => a.name), bistro.agents.map(a => a.name));
  assert.equal(agents[0].agent_status, 'blocked');
  assert.equal(agents[0].cwd, path.join(home, 'harbor-street-bistro'));
  assert.equal(JSON.parse(herdr(dir, home, 'workspace', 'list')).result.workspaces[0].label, 'Harbor Street Bistro');
  assert.equal(JSON.parse(herdr(dir, home, 'tab', 'list')).result.tabs.length, 2);
  const lay = JSON.parse(herdr(dir, home, 'pane', 'layout', '--pane', 'w1:p1')).result.layout;
  assert.deepEqual(lay.panes.map(p => p.pane_id), ['w1:p1', 'w1:p2']);
  assert.match(herdr(dir, home, 'agent', 'read', 'w1:p1', '--source', 'visible', '--format', 'text'), /❯ 1\. Join tables/);
  assert.match(herdr(dir, home, 'pane', 'read', 'w1:p1', '--source', 'visible', '--format', 'ansi'), /\x1b\[/);
  assert.match(herdr(dir, home, 'agent', 'read', 'w9:p1', '--format', 'text'), /pane_not_found/);

  herdr(dir, home, 'agent', 'send-keys', 'w1:p1', '3');
  assert.equal(tl.loadState(dir).inputs['w1:p1'][0].value, '3');
  // Keys to an agent that isn't asking are ignored.
  herdr(dir, home, 'agent', 'send-keys', 'w1:p4', '1');
  assert.equal(tl.loadState(dir).inputs['w1:p4'], undefined);

  const st = tl.loadState(dir);
  st.client = 'brightside-dental';
  tl.saveState(dir, st);
  const dental = JSON.parse(herdr(dir, home, 'agent', 'list')).result.agents;
  assert.deepEqual(dental.map(a => a.name), ['reminders', 'review-replies', 'intake-forms', 'recall']);
  assert.ok(dental.every(a => a.pane_id.startsWith('w2:')));
});

test('setup seeds both clients and refuses folders that are not the demo’s', () => {
  const base = tmp('demo-setup');
  const root = path.join(base, 'demo');
  const run = (...args) => execFileSync(process.execPath, [path.join(ROOT, 'demo', 'setup.js'), '--root', root, ...args], { encoding: 'utf8' });
  const out = run('--paths', '--speed', '2');
  assert.match(out, /DEMO_SPEED=2/);
  const L = setup.layout(root);
  for (const c of CLIENTS) {
    const dir = path.join(L.config, 'clients', c.id);
    const { routines, invalid } = routinesLib.loadAll(path.join(dir, 'routines'));
    assert.deepEqual(invalid, []);
    assert.equal(routines.length, fs.readdirSync(path.join(ROOT, 'routines')).length + ROUTINES[c.id].length);
    const rs = routinesLib.readState(path.join(dir, 'routines-state.json'));
    const runs = Object.entries(rs.runs);
    assert.equal(runs.length, HISTORY[c.id].length);
    assert.equal(runs.filter(([, r]) => r.state === 'ready').length, 1);
    for (const [id, r] of runs) { assert.match(id, routinesLib.RUN_RE); assert.ok(fs.existsSync(r.out)); assert.ok(r.out.startsWith(dir)); }
  }
  // --restart keeps routines, restarts the timeline.
  const st = tl.loadState(root); st.inputs['w1:p1'] = [{ at: 1, kind: 'key', value: '1' }]; tl.saveState(root, st);
  run('--restart');
  assert.deepEqual(tl.loadState(root).inputs, {});
  assert.equal(tl.loadState(root).speed, 2);
  // Never wipes a folder that isn't marked as the demo's.
  const other = path.join(base, 'mine');
  fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'keep.txt'), 'x');
  assert.throws(() => execFileSync(process.execPath, [path.join(ROOT, 'demo', 'setup.js'), '--root', other, '--reset'], { stdio: 'pipe' }));
  assert.ok(fs.existsSync(path.join(other, 'keep.txt')));
});

// ── The panel in demo mode, end to end ────────────────────────────────────────
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `127.0.0.1:${PORT}`;
function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { Host: BASE, 'Content-Type': 'application/json' };
    if (method !== 'GET') headers.Origin = `http://${BASE}`;
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

test('the panel in demo mode: client switch, per-client routines, answers change the output', async t => {
  const root = path.join(tmp('demo-e2e'), 'demo');
  const L = setup.layout(root);
  execFileSync(process.execPath, [path.join(ROOT, 'demo', 'setup.js'), '--root', root]);
  const st = tl.loadState(root); st.epoch = Date.now() - ASK_AT - 2000; tl.saveState(root, st);
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: {
      PATH: process.env.PATH, HOME: L.home, OPERIO_ORCA_DEMO: '1', OPERIO_ORCA_DEMO_DIR: root, OPERIO_ORCA_CONFIG_DIR: L.config,
      OPERIO_ORCA_HERDR_BIN: path.join(ROOT, 'demo', 'demo-herdr'), OPERIO_ORCA_PORT: String(PORT), OPERIO_ORCA_POLL_MS: '300',
      OPERIO_ORCA_AGENT_SOCK: path.join(root, 'agents.sock'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', c => { out += c; if (out.includes('"event":"listen"')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code + ' ' + out)));
  });

  const demo = (await req('GET', '/api/demo')).json;
  assert.equal(demo.demo, true);
  assert.equal(demo.active, 'harbor-street-bistro');
  assert.match((await req('GET', '/demo.js')).text, /demo-badge/);
  assert.match((await req('GET', '/cron.js')).text, /OperioOrcaCron/);

  const agents = (await req('GET', '/api/agents')).json;
  assert.deepEqual(agents.workspaces.map(w => w.label), ['Harbor Street Bistro']);
  const r1 = (await req('GET', '/api/routines')).json;
  assert.ok(r1.routines.some(r => r.id === 'reservation-confirmations'));
  assert.equal(r1.runs.filter(r => r.state === 'ready').length, 1);
  assert.match(r1.dir, /^~\/\.config\/operio-orca\/clients\/harbor-street-bistro\/routines$/);

  // Needs you: the panel reads the menu off the screen, the answer goes in as a key.
  const reply = (await req('GET', '/api/agents/w1%3Ap1/reply')).json;
  assert.deepEqual(reply.screen.options.map(o => o.n), [1, 2, 3]);
  assert.equal(reply.screen.question, 'How should I answer the Morgan party?');
  assert.equal((await req('POST', '/api/agents/w1%3Ap1/answer', { screen: 3 })).status, 200);
  const after = (await req('GET', '/api/agents/w1%3Ap1/read?lines=80')).json.text;
  assert.match(after, /You chose: 3\. Put them on the waitlist/);

  // Switch client: other agents, other routines, other draft.
  assert.equal((await req('POST', '/api/demo/client', { client: 'nope' })).status, 400);
  assert.equal((await req('POST', '/api/demo/client', { client: 'brightside-dental' })).status, 200);
  const dental = (await req('GET', '/api/agents')).json;
  assert.deepEqual(dental.agents.map(a => a.name).sort(), ['intake-forms', 'recall', 'reminders', 'review-replies']);
  const r2 = (await req('GET', '/api/routines')).json;
  assert.ok(r2.routines.some(r => r.id === 'reminder-drafts'));
  assert.ok(!r2.routines.some(r => r.id === 'reservation-confirmations'));
  const ready = r2.runs.find(r => r.state === 'ready');
  assert.equal(ready.id, 'reminder-drafts');
  assert.equal((await req('POST', `/api/routines/runs/${ready.run}/decide`, { action: 'approve' })).json.state, 'approved');

  // Run now: a scripted agent starts, writes its draft, and the run waits for approval.
  const run = await req('POST', '/api/routines/recall-list/run', {});
  assert.equal(run.status, 200, run.text);
  assert.ok(run.json.output.startsWith(path.join(L.config, 'clients', 'brightside-dental', 'drafts', 'recall-list')));
  t.diagnostic('waiting for the scripted routine run');
  const end = Date.now() + 20000;
  let state;
  while (Date.now() < end) {
    state = (await req('GET', '/api/routines')).json.runs.find(r => r.run === run.json.run)?.state;
    if (state === 'ready') break;
    await new Promise(r => setTimeout(r, 300));
  }
  assert.equal(state, 'ready');
  // Nothing outside the demo folder was written.
  assert.ok(fs.readFileSync(run.json.output, 'utf8').includes('Recall list'));
});

// ── `operio-orca demo --lang es` ────────────────────────────────────────────────
const { forLang } = require('../demo/clients');
const EN = forLang('en');
const ES = forLang('es');
const secs = rows => rows.map(r => r[0]);

test('es: same agents, steps and timings as en, only the words change', () => {
  assert.deepEqual(ES.CLIENTS.map(c => c.id), EN.CLIENTS.map(c => c.id));
  assert.deepEqual(ES.CLIENTS.map(c => c.name), ['Harbor Street Bistro', 'Brightside Dental']);
  EN.CLIENTS.forEach((c, ci) => {
    const e = ES.CLIENTS[ci];
    assert.deepEqual(e.tabs.map(t => t.id), c.tabs.map(t => t.id));
    assert.equal(e.agents.length, c.agents.length);
    c.agents.forEach((a, i) => {
      const b = e.agents[i];
      for (const k of ['pane', 'tab', 'kind', 'delay', 'hold', 'auto']) assert.equal(b[k], a[k], `${a.pane} ${k}`);
      assert.match(b.name, /^[a-z][a-z0-9_-]{0,31}$/, b.name);
      assert.notEqual(b.task, a.task, a.pane);
      assert.deepEqual(secs(b.work), secs(a.work), `${a.pane} work`);
      assert.equal(b.ask.options.length, a.ask.options.length, a.pane);
      assert.deepEqual(Object.keys(b.after), Object.keys(a.after));
      for (const n of Object.keys(a.after)) assert.deepEqual(secs(b.after[n]), secs(a.after[n]), `${a.pane} after ${n}`);
      assert.deepEqual(secs(b.text('hola')), secs(a.text('hello')), `${a.pane} text`);
      assert.ok(b.text('hola').some(r => r[1].includes('hola')), `${a.pane} quotes the reply`);
    });
  });
});

test('es: the timeline plays beat for beat like en (states, seq, line times)', () => {
  const at = st => ({ ...st, lang: 'es' });
  EN.CLIENTS.forEach((c, ci) => c.agents.forEach((a, i) => {
    const b = ES.CLIENTS[ci].agents[i];
    const ask = (a.delay + a.work[a.work.length - 1][0] + 1.2) * 1000;
    const runs = [
      {}, // nobody answers (auto agents answer themselves)
      { [a.pane]: [{ at: ask + 1500, kind: 'key', value: '1' }] },
      { [a.pane]: [{ at: ask + 2500, kind: 'key', value: String(a.ask.options.length) }] },
      { [a.pane]: [{ at: 4000, kind: 'text', value: 'note' }, { at: ask + 3000, kind: 'text', value: 'my words' }] },
    ];
    for (const inputs of runs) {
      const st = { ...tl.freshState({ now: 0, speed: 1.5 }), inputs };
      for (let now = 0; now <= ask + 160e3; now += 700) {
        const ve = tl.scriptedView(a, st, now);
        const vs = tl.scriptedView(b, at(st), now);
        assert.equal(vs.status, ve.status, `${a.pane} @${now}`);
        assert.equal(vs.seq, ve.seq, `${a.pane} @${now}`);
        assert.equal(vs.cycle, ve.cycle, `${a.pane} @${now}`);
        assert.deepEqual(vs.lines.map(l => l.at), ve.lines.map(l => l.at), `${a.pane} @${now}`);
      }
    }
  }));
});

// Common English words that should never appear in a Spanish question or option.
const ENGLISH = /\b(the|and|or|of|to|for|with|should|what|how|which|who|it|them|they|as|usual|instead|keep|offer|put|leave|swap|only|first|both|draft|email|flag|apologi[sz]e|invite|thank|explain|skip|join|tables?|guests?|waitlist|order|week|day|slots?|open|reply|review|type|something|select|cancel|photo|lead|post|bright|warm|close|room|top-down|manager|call|batch|starting|monday|halibut is|chose|picked|default)\b/i;

test('es: no English left in the questions and options on screen', () => {
  for (const c of ES.CLIENTS) {
    for (const a of c.agents) {
      const st = { ...tl.freshState({ now: 0 }), lang: 'es' };
      const ask = (a.delay + a.work[a.work.length - 1][0] + 1.2) * 1000;
      const v = tl.scriptedView(a, st, ask + 10);
      assert.equal(v.status, 'blocked', a.pane);
      const lines = v.lines.map(l => l.text);
      const q = lines.indexOf(` ${a.ask.question}`);
      assert.ok(q > 0, a.pane);
      const shown = lines.slice(q).filter(l => /^ \S|^[❯ ] \d\. /.test(l) && !/^ Enter /.test(l));
      assert.equal(shown.length, 1 + a.ask.options.length + 1, `${a.pane}: question, options, free text`);
      for (const line of shown) {
        const words = line.replace(/\S+\.(jpg|png|md|csv|txt|html)\b/g, '');
        assert.doesNotMatch(words, ENGLISH, `${a.pane}: "${line}"`);
      }
      // The panel reads the Spanish menu: the question, the 3 options, not the free-text line.
      st.inputs[a.pane] = [{ at: ask + 1000, kind: 'key', value: '1' }];
      const after = tl.scriptedView(a, st, ask + 1000 + 600).lines.map(l => l.text).join('\n');
      assert.match(after, new RegExp(`Elegiste: 1\\. ${a.ask.options[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      assert.doesNotMatch(after, /You chose|Working on your answer|esc to interrupt/);
    }
  }
  // Idle and auto-answer chrome is Spanish too.
  const auto = ES.CLIENTS[0].agents.find(a => a.auto);
  const st = { ...tl.freshState({ now: 0 }), lang: 'es' };
  const ask = (auto.delay + auto.work[auto.work.length - 1][0] + 1.2) * 1000;
  assert.match(text(tl.scriptedView(auto, st, ask + auto.auto * 1000 + 20000)), /Opción por defecto: 1\./);
  assert.match(text(tl.scriptedView(auto, st, 1000)), /listo para la siguiente ronda/);
});

test('es: contacts in the Spanish text stay fictional', () => {
  const src = fs.readFileSync(path.join(ROOT, 'demo', 'clients.es.js'), 'utf8');
  for (const m of src.matchAll(/\(?\d{3}\)?[ .-]\d{3}-\d{4}/g)) assert.match(m[0], /^\(555\) 010-01\d\d$/, m[0]);
  for (const m of src.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) assert.match(m[0], /@([\w-]+\.)*example\.com$/, m[0]);
  for (const m of src.matchAll(/\b[\w-]+\.example\.com\b|\b[a-z][\w-]*\.(com|net|org|mx)\b/g)) assert.match(m[0], /example\.com$/, m[0]);
});

test('es: --lang persists through --restart and --reset, and seeds Spanish routines and drafts', () => {
  const base = tmp('demo-lang');
  const root = path.join(base, 'demo');
  const run = (...args) => execFileSync(process.execPath, [path.join(ROOT, 'demo', 'setup.js'), '--root', root, ...args], { encoding: 'utf8' });
  assert.match(run('--paths'), /DEMO_LANG=en/);
  assert.match(run('--lang', 'es', '--paths'), /DEMO_LANG=es/);
  assert.equal(tl.loadState(root).lang, 'es');
  assert.match(run('--restart', '--paths'), /DEMO_LANG=es/);
  assert.match(run('--reset', '--paths'), /DEMO_LANG=es/);
  assert.match(run('--speed', '2', '--paths'), /DEMO_LANG=es/);
  assert.throws(() => run('--lang', 'fr'), /--lang/);
  const L = setup.layout(root);
  const dir = path.join(L.config, 'clients', 'harbor-street-bistro');
  const { routines, invalid } = routinesLib.loadAll(path.join(dir, 'routines'));
  assert.deepEqual(invalid, []);
  for (const r of routines) assert.doesNotMatch(r.prompt, /^(You|Read|Compare|List)\b/, r.id);
  const rs = routinesLib.readState(path.join(dir, 'routines-state.json'));
  const ready = Object.values(rs.runs).find(r => r.state === 'ready');
  assert.match(fs.readFileSync(ready.out, 'utf8'), /Respuestas a reseñas/);
  // The demo-herdr answers in Spanish.
  const st = tl.loadState(root); st.epoch = Date.now() - ASK_AT - 2000; tl.saveState(root, st);
  const agents = JSON.parse(herdr(root, L.home, 'agent', 'list')).result.agents;
  assert.deepEqual(agents.map(a => a.name), ['reservas', 'opiniones', 'menu-semanal', 'pedidos']);
  assert.deepEqual(JSON.parse(herdr(root, L.home, 'tab', 'list')).result.tabs.map(t => t.label), ['Sala', 'Cocina y oficina']);
  assert.match(herdr(root, L.home, 'agent', 'read', 'w1:p1', '--source', 'visible', '--format', 'text'), /¿Cómo le respondo al grupo de Morgan\?\n\n❯ 1\. Juntar las mesas/);
  // Back to English: everything is seeded again in English.
  assert.match(run('--lang', 'en', '--paths'), /DEMO_LANG=en/);
  const en = routinesLib.loadAll(path.join(dir, 'routines')).routines;
  assert.ok(en.find(r => r.id === 'reservation-confirmations').prompt.startsWith('Read the reservation requests'));
});

test('es: the panel starts in Spanish and reads the Spanish menu', async t => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const host = `127.0.0.1:${port}`;
  const get = p => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p, headers: { Host: host } }, res => {
      let buf = ''; res.on('data', c => { buf += c; }); res.on('end', () => resolve(JSON.parse(buf)));
    }).on('error', reject);
  });
  const root = path.join(tmp('demo-es-e2e'), 'demo');
  const L = setup.layout(root);
  execFileSync(process.execPath, [path.join(ROOT, 'demo', 'setup.js'), '--root', root, '--lang', 'es']);
  const st = tl.loadState(root); st.epoch = Date.now() - ASK_AT - 2000; tl.saveState(root, st);
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: {
      PATH: process.env.PATH, HOME: L.home, OPERIO_ORCA_DEMO: '1', OPERIO_ORCA_DEMO_DIR: root, OPERIO_ORCA_CONFIG_DIR: L.config,
      OPERIO_ORCA_HERDR_BIN: path.join(ROOT, 'demo', 'demo-herdr'), OPERIO_ORCA_PORT: String(port), OPERIO_ORCA_POLL_MS: '300',
      OPERIO_ORCA_AGENT_SOCK: path.join(root, 'agents.sock'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', c => { out += c; if (out.includes('"event":"listen"')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code + ' ' + out)));
  });
  assert.equal((await get('/api/demo')).lang, 'es');
  const reply = await get('/api/agents/w1%3Ap1/reply');
  assert.equal(reply.screen.question, '¿Cómo le respondo al grupo de Morgan?');
  assert.deepEqual(reply.screen.options.map(o => o.label), ES.CLIENTS[0].agents[0].ask.options);
  assert.ok(reply.screen.options.every(o => !o.risky));
});
