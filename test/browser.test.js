'use strict';
// Web browser: address checks, the tool filter, the built-in tool entry, and the proxy in front of
// a fake engine (no real browser, no network).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const {
  checkUrl, isPrivateIp, findChrome, filterTools, createBrowser, BLOCKED_HOSTS, READ_TOOLS, INTERACTIVE_TOOLS, ENGINE_VERSION, TOOL_ID,
} = require('../lib/browser');
const { createTools } = require('../lib/tools');
const { cleanEnv, PAGE_NOTE } = require('../lib/browser-proxy');

const APP = path.join(__dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orca-browser-'));

test('private addresses: v4, v6, mapped, and public ones pass', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.100.100.100', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])
    assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['93.184.215.14', '172.32.0.1', '8.8.8.8', '2606:4700::1111', '100.128.0.1'])
    assert.equal(isPrivateIp(ip), false, ip);
});

test('checkUrl refuses files, logins, this computer, the network and names that point there', async () => {
  const publicLookup = async () => [{ address: '93.184.215.14', family: 4 }];
  const sneaky = async () => [{ address: '93.184.215.14', family: 4 }, { address: '192.168.1.10', family: 4 }];
  for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com', 'not a url',
    'http://127.0.0.1:7171/', 'http://localhost:7171/', 'http://[::1]/', 'http://10.0.0.1/', 'http://router.lan/',
    'http://my-box.local/', 'http://box.example.ts.net/', 'http://intranet/', 'https://user:pw@example.com/'])
    await assert.rejects(checkUrl(u, { lookup: publicLookup }), { code: 'blocked_url' }, u);
  await assert.rejects(checkUrl('https://rebind.example.com/', { lookup: sneaky }), { code: 'blocked_url' });
  await assert.rejects(checkUrl('https://nx.example.com/', { lookup: async () => { throw new Error('ENOTFOUND'); } }), { code: 'blocked_url' });
  assert.equal((await checkUrl('https://example.com/menu', { lookup: publicLookup })).hostname, 'example.com');
  assert.equal((await checkUrl('http://93.184.215.14/')).hostname, '93.184.215.14');
});

test('engine block list covers loopback, private ranges and tailnet names', () => {
  for (const h of ['localhost*', '127.*', '10.*', '192.168.*', '169.254.*', '172.16.*', '172.31.*', '*.ts.net*', '*.local*'])
    assert.ok(BLOCKED_HOSTS.includes(h), h);
});

test('read level: only read tools reach agents', () => {
  const all = [...READ_TOOLS, ...INTERACTIVE_TOOLS, 'browser_evaluate', 'browser_run_code_unsafe', 'browser_file_upload', 'browser_network_requests']
    .map(name => ({ name }));
  const names = filterTools(all).map(t => t.name);
  assert.deepEqual(names.sort(), [...READ_TOOLS].sort());
  for (const n of ['browser_click', 'browser_type', 'browser_fill_form', 'browser_evaluate', 'browser_run_code_unsafe']) assert.ok(!names.includes(n), n);
});

test('findChrome: own path first, then the usual places; none when nothing is there', () => {
  const have = new Set(['/usr/bin/chromium', '/opt/x/chrome']);
  const exists = p => have.has(p);
  assert.equal(findChrome({ platform: 'linux', env: {}, exists }), '/usr/bin/chromium');
  assert.equal(findChrome({ platform: 'linux', env: { OPERIO_ORCA_BROWSER_EXECUTABLE: '/opt/x/chrome' }, exists }), '/opt/x/chrome');
  assert.equal(findChrome({ platform: 'linux', env: { OPERIO_ORCA_BROWSER_EXECUTABLE: '/nope' }, exists }), null);
  assert.equal(findChrome({ platform: 'linux', env: {}, exists: () => false }), null);
  assert.match(findChrome({ platform: 'darwin', env: { HOME: '/Users/a' }, exists: p => p.includes('Google Chrome') }), /Google Chrome\.app/);
});

test('engine arguments: headless, own profile, block list, never --no-sandbox', () => {
  const dir = tmp();
  const b = createBrowser({ configDir: dir, appDir: APP });
  const args = b.engineArgs({ executable: '/usr/bin/google-chrome' });
  assert.ok(args.includes('--headless'));
  assert.equal(args[args.indexOf('--user-data-dir') + 1], b.PROFILE);
  assert.ok(args[args.indexOf('--blocked-origins') + 1].includes('127.*'));
  assert.ok(!args.includes('--no-sandbox'));
});

test('the built-in tool: only operio-orca browser writes or removes it; each agent gets its run dir', () => {
  const dir = tmp();
  const tools = createTools({ configDir: dir });
  const b = createBrowser({ configDir: dir, appDir: APP });
  assert.throws(() => tools.put({ ...b.toolEntry(), command: '/bin/evil' }), { code: 'builtin_tool' });
  tools.put(b.toolEntry(), { builtin: true });
  assert.throws(() => tools.remove(TOOL_ID), { code: 'builtin_tool' });
  const run = path.join(dir, 'runs', 'menu-checker');
  const r = tools.writeRun(run, [TOOL_ID]);
  const mcp = JSON.parse(fs.readFileSync(r.mcpFile, 'utf8')).mcpServers[TOOL_ID];
  assert.deepEqual(mcp.args.slice(-2), ['--run-dir', run]);
  assert.match(mcp.args[0], /browser-proxy\.js$/);
});

test('the engine never sees API keys or tokens', () => {
  const e = cleanEnv({ HOME: '/h', PATH: '/bin', ANTHROPIC_API_KEY: 'x', GH_TOKEN: 'y', MY_SECRET: 'z', DB_PASSWORD: 'p' });
  assert.deepEqual(Object.keys(e).sort(), ['HOME', 'PATH']);
});

// ── The proxy against a fake engine
const FAKE_ENGINE = `
const fs = require('fs');
fs.writeFileSync(process.env.FAKE_ARGS_FILE, JSON.stringify({ argv: process.argv.slice(2), env: Object.keys(process.env) }));
let buf = '';
process.stdin.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; const m = JSON.parse(l);
  const out = r => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: r }) + '\\n');
  if (m.method === 'initialize') out({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '0' } });
  else if (m.method === 'tools/list') out({ tools: ${JSON.stringify([...READ_TOOLS, ...INTERACTIVE_TOOLS, 'browser_evaluate', 'browser_run_code_unsafe'].map(name => ({ name, inputSchema: { type: 'object' } })))} });
  else if (m.method === 'tools/call') {
    if (m.params.name === 'browser_take_screenshot' && m.params.arguments.filename) fs.writeFileSync(m.params.arguments.filename, 'png');
    const page = m.params.name === 'browser_snapshot' ? '\\n- Page URL: https://shop.example.com/contact\\n- Page Title: Contact\\n\\x60\\x60\\x60yaml\\n- textbox \\"Name\\" [ref=e4]\\n- button \\"Send\\" [ref=e7] [cursor=pointer]\\n\\x60\\x60\\x60' : '';
    out({ content: [{ type: 'text', text: 'ENGINE ' + m.params.name + ' ' + JSON.stringify(m.params.arguments) + page }] });
  }
} });
process.stdin.on('end', () => process.exit(0));
`;

function setup({ enabled = true, level = 'read' } = {}) {
  const dir = tmp();
  const b = createBrowser({ configDir: dir, appDir: APP });
  const pkg = path.join(b.ENGINE, 'node_modules', '@playwright', 'mcp');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'cli.js'), FAKE_ENGINE);
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ version: ENGINE_VERSION }));
  b.save({ enabled, level, executable: process.execPath, engine: ENGINE_VERSION });
  return { dir, b, argsFile: path.join(dir, 'fake-args.json') };
}

function session(dir, extraArgs = [], env = {}) {
  const p = spawn(process.execPath, [path.join(APP, 'lib', 'browser-proxy.js'), ...extraArgs], {
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, OPERIO_ORCA_CONFIG_DIR: dir, ...env },
  });
  let buf = '', id = 0;
  const pending = new Map();
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); pending.get(m.id)?.(m); } });
  const rpc = (method, params) => new Promise(res => { const n = ++id; pending.set(n, res); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  const call = (name, args = {}) => rpc('tools/call', { name, arguments: args });
  const close = () => new Promise(res => { p.on('exit', res); p.stdin.end(); });
  return { rpc, call, close };
}
const textOf = m => (m.result?.content || []).map(c => c.text).join('\n');
const journalOf = dir => {
  const jd = path.join(dir, 'journal');
  return fs.readdirSync(jd).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(jd, f), 'utf8').trim().split('\n').map(l => JSON.parse(l)));
};

test('proxy: filters the list, refuses other tools, checks addresses, marks page text, writes the Journal', async () => {
  const { dir, argsFile } = setup();
  const run = path.join(dir, 'runs', 'menu-checker');
  const s = session(dir, ['--run-dir', run], { FAKE_ARGS_FILE: argsFile, ANTHROPIC_API_KEY: 'sk-ant-should-not-pass' });
  await s.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const list = await s.rpc('tools/list', {});
  assert.deepEqual(list.result.tools.map(t => t.name).sort(), [...READ_TOOLS].sort());

  const click = await s.call('browser_click', { target: 'e1' });
  assert.equal(click.result.isError, true);
  const evil = await s.call('browser_run_code_unsafe', { code: 'x' });
  assert.equal(evil.result.isError, true);

  const local = await s.call('browser_navigate', { url: 'http://127.0.0.1:7171/api/agents' });
  assert.equal(local.result.isError, true);
  assert.match(textOf(local), /Not opened/);
  const tab = await s.call('browser_tabs', { action: 'new', url: 'file:///etc/passwd' });
  assert.equal(tab.result.isError, true);

  const ok = await s.call('browser_navigate', { url: 'http://93.184.215.14/' });
  assert.notEqual(ok.result.isError, true);
  assert.equal(ok.result.content[0].text, PAGE_NOTE);
  assert.match(textOf(ok), /ENGINE browser_navigate/);

  const shot = await s.call('browser_take_screenshot', { filename: '../../.ssh/authorized_keys', isolatedContext: 'x' });
  const sent = JSON.parse(textOf(shot).split('ENGINE browser_take_screenshot ')[1]);
  assert.equal(sent.filename, path.join(run, 'shots', 'authorized_keys'));
  assert.equal(sent.isolatedContext, undefined);
  await s.close();

  const engine = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.ok(!engine.argv.includes('--no-sandbox'));
  assert.equal(engine.argv[engine.argv.indexOf('--output-dir') + 1], path.join(run, 'shots'));
  assert.ok(!engine.env.includes('ANTHROPIC_API_KEY'));

  const j = journalOf(dir);
  const ev = e => j.filter(x => x.event === e);
  assert.equal(ev('browser.refused').length, 2);
  assert.equal(ev('browser.blocked').length, 2);
  assert.equal(ev('browser.open').length, 1);
  assert.equal(ev('browser.open')[0].url, 'http://93.184.215.14/');
  assert.equal(ev('browser.open')[0].agent.name, 'menu-checker');
});

test('proxy when the browser is off: the agent is told why, nothing starts', async () => {
  const { dir, argsFile } = setup({ enabled: false });
  const s = session(dir, [], { FAKE_ARGS_FILE: argsFile });
  const init = await s.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  assert.match(init.result.instructions, /browser on/);
  const r = await s.call('browser_navigate', { url: 'http://93.184.215.14/' });
  assert.equal(r.result.isError, true);
  assert.match(textOf(r), /off/);
  await s.close();
  assert.equal(fs.existsSync(argsFile), false);
});

test('CLI: browser help, status on a fresh config, test needs a URL', () => {
  const dir = tmp();
  const cli = (...a) => spawnSync(path.join(APP, 'bin', 'operio-orca'), ['browser', ...a], { encoding: 'utf8', env: { ...process.env, OPERIO_ORCA_CONFIG_DIR: dir } });
  assert.match(cli().stdout, /browser test URL/);
  const st = cli('status');
  assert.equal(st.status, 0);
  assert.match(st.stdout, /Web browser: OFF/);
  assert.notEqual(cli('test').status, 0);
  assert.notEqual(cli('fly').status, 0);
  const off = cli('off');
  assert.match(off.stdout, /already off/);
});

test('allowed sites: a site covers its subdomains, nothing else; profiles keep host names only', async () => {
  const { siteAllowed } = require('../lib/browser');
  assert.ok(siteAllowed('www.example.com', ['example.com']));
  assert.ok(siteAllowed('example.com', ['example.com']));
  assert.ok(!siteAllowed('badexample.com', ['example.com']));
  assert.ok(!siteAllowed('example.com.evil.net', ['example.com']));
  const lookup = async () => [{ address: '93.184.215.14', family: 4 }];
  await assert.rejects(checkUrl('https://other.com/', { lookup, sites: ['example.com'] }), { code: 'blocked_url' });
  assert.ok(await checkUrl('https://maps.example.com/x', { lookup, sites: ['example.com'] }));

  const { createProfiles } = require('../lib/profiles');
  const dir = tmp();
  const profiles = createProfiles({ configDir: dir, kinds: ['claude'], models: { claude: ['sonnet'] } });
  const base = { id: 'checker', create: true, kind: 'claude', folder: '~', instructions: 'x', tools: { mcp: ['web-browser'] } };
  const saved = profiles.put({ ...base, tools: { ...base.tools, browserSites: ['https://www.Example.com/menu', 'example.com', ' maps.google.com '] } });
  assert.deepEqual(saved.tools.browserSites, ['example.com', 'maps.google.com']);
  assert.throws(() => profiles.put({ ...base, id: 'c2', tools: { ...base.tools, browserSites: ['not a host'] } }), { code: 'bad_profile' });
  assert.throws(() => profiles.put({ ...base, id: 'c3', tools: { ...base.tools, browserSites: ['localhost'] } }), { code: 'bad_profile' });
});

test('proxy: --sites limits what this agent opens', async () => {
  const { dir, argsFile } = setup();
  const s = session(dir, ['--sites', 'example.com'], { FAKE_ARGS_FILE: argsFile });
  await s.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const r = await s.call('browser_navigate', { url: 'http://93.184.215.14/' });
  assert.equal(r.result.isError, true);
  assert.match(textOf(r), /only open example\.com/);
  await s.close();
});

test('run files: allowed sites reach the browser tool as --sites', () => {
  const dir = tmp();
  const tools = createTools({ configDir: dir });
  tools.put(createBrowser({ configDir: dir, appDir: APP }).toolEntry(), { builtin: true });
  const r = tools.writeRun(path.join(dir, 'runs', 'a'), [TOOL_ID], { browserSites: ['example.com', 'google.com'] });
  const args = JSON.parse(fs.readFileSync(r.mcpFile, 'utf8')).mcpServers[TOOL_ID].args;
  assert.deepEqual(args.slice(-2), ['--sites', 'example.com,google.com']);
});

test('approval rules: clicks, Enter, typing with submit and accepting a dialog wait for a person', () => {
  const { needsApproval, fieldsOf, isPayField, maskField, refLine, FORM_TOOLS } = require('../lib/browser');
  assert.equal(needsApproval('browser_click', {}), true);
  assert.equal(needsApproval('browser_click', { target: 'e3' }, 'radio "Medium"'), false, 'a radio is a field');
  assert.equal(needsApproval('browser_click', { target: 'e3' }, 'checkbox "Bacon"'), false);
  assert.equal(needsApproval('browser_click', { target: 'e7' }, 'button "Send"'), true);
  assert.equal(needsApproval('browser_click', { target: 'e8' }, 'link "Delete account"'), true);
  assert.equal(needsApproval('browser_press_key', { key: 'Enter' }), true);
  assert.equal(needsApproval('browser_press_key', { key: 'Tab' }), false);
  assert.equal(needsApproval('browser_type', { text: 'x' }), false);
  assert.equal(needsApproval('browser_type', { text: 'x', submit: true }), true);
  assert.equal(needsApproval('browser_handle_dialog', { accept: false }), false);
  assert.equal(needsApproval('browser_fill_form', { fields: [] }), false);
  assert.deepEqual(fieldsOf('browser_fill_form', { fields: [{ name: 'Email', value: 'a@b.co' }] }), [{ label: 'Email', value: 'a@b.co' }]);
  for (const l of ['Card number', 'CVV', 'Número de tarjeta', 'Expiry date', 'IBAN', 'CLABE']) assert.ok(isPayField(l), l);
  for (const l of ['Name', 'Email', 'Message', 'Phone']) assert.ok(!isPayField(l), l);
  assert.equal(maskField({ label: 'Password', value: 'hunter2' }).value, '••••••');
  assert.equal(maskField({ label: 'Name', value: 'Ana' }).value, 'Ana');
  assert.equal(refLine('- form:\n  - button "Send" [ref=e7] [cursor=pointer]', 'e7'), 'button "Send"');
  assert.equal(refLine('- button "Send" [ref=e7]', 'e7) .* (x'), null);
  assert.equal(filterTools([...FORM_TOOLS].map(name => ({ name })), 'read').length, 0);
  assert.equal(filterTools([...FORM_TOOLS, 'browser_hover', 'browser_evaluate'].map(name => ({ name })), 'forms').length, FORM_TOOLS.size);
});

// A stand-in for ORCA's agent socket: records asks and answers with `answer`.
function fakeOrca(answer) {
  const http = require('http');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-sock-'));
  const sockPath = path.join(dir, 's.sock');
  const asks = [];
  const srv = http.createServer((req, res) => {
    let buf = ''; req.on('data', c => { buf += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST' && u.pathname === '/browser/ask') { asks.push(JSON.parse(buf)); return res.end(JSON.stringify({ id: 'a' + asks.length })); }
      if (req.method === 'GET' && u.pathname === '/browser/ask') return res.end(JSON.stringify({ state: answer }));
      res.end('{}');
    });
  });
  return new Promise(r => srv.listen(sockPath, () => r({ sockPath, asks, close: () => srv.close() })));
}

test('forms level: typing is free, payment fields refused, a click waits and goes ahead when approved', async () => {
  const { dir, argsFile } = setup({ level: 'forms' });
  const orca = await fakeOrca('approved');
  const run = path.join(dir, 'runs', 'booker');
  const s = session(dir, ['--run-dir', run], { FAKE_ARGS_FILE: argsFile, OPERIO_ORCA_AGENT_SOCK: orca.sockPath, OPERIO_ORCA_BROWSER_POLL_MS: '50' });
  await s.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const names = (await s.rpc('tools/list', {})).result.tools.map(t => t.name);
  assert.ok(names.includes('browser_click') && names.includes('browser_fill_form') && !names.includes('browser_evaluate') && !names.includes('browser_hover'));
  await s.call('browser_snapshot');
  const typed = await s.call('browser_fill_form', { fields: [{ name: 'Name', value: 'Ana' }, { name: 'Password', value: 'hunter2' }] });
  assert.notEqual(typed.result.isError, true);
  const pay = await s.call('browser_type', { element: 'Card number', target: 'e9', text: '4111111111111111' });
  assert.equal(pay.result.isError, true);
  assert.match(textOf(pay), /payment/);
  const click = await s.call('browser_click', { element: 'Submit button', target: 'e7' });
  assert.notEqual(click.result.isError, true);
  assert.match(textOf(click), /ENGINE browser_click/);
  await s.close();
  orca.close();
  assert.equal(orca.asks.length, 1);
  const a = orca.asks[0];
  assert.equal(a.tool, 'browser_click');
  assert.equal(a.real, 'button "Send"');
  assert.equal(a.url, 'https://shop.example.com/contact');
  assert.deepEqual(a.fields.map(f => [f.label, f.value]), [['Name', 'Ana'], ['Password', '••••••']]);
  assert.ok(!JSON.stringify(a).includes('hunter2') && !JSON.stringify(a).includes('4111'));
  assert.ok(a.shot && a.shot.startsWith(path.join(run, 'shots')) && fs.existsSync(a.shot));
  assert.ok(journalOf(dir).some(e => e.event === 'browser.refused' && e.reason === 'payment field'));
});

test('forms level: a declined click never reaches the page; no ORCA means nothing is sent', async () => {
  const { dir, argsFile } = setup({ level: 'forms' });
  const orca = await fakeOrca('declined');
  const s = session(dir, [], { FAKE_ARGS_FILE: argsFile, OPERIO_ORCA_AGENT_SOCK: orca.sockPath, OPERIO_ORCA_BROWSER_POLL_MS: '50' });
  await s.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const r = await s.call('browser_press_key', { key: 'Enter' });
  assert.equal(r.result.isError, true);
  assert.match(textOf(r), /declined/);
  assert.doesNotMatch(textOf(r), /ENGINE/);
  await s.close(); orca.close();

  const s2 = session(dir, [], { FAKE_ARGS_FILE: argsFile, OPERIO_ORCA_AGENT_SOCK: path.join(dir, 'nobody.sock') });
  await s2.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const r2 = await s2.call('browser_click', { element: 'Send', target: 'e7' });
  assert.equal(r2.result.isError, true);
  assert.match(textOf(r2), /could not be reached/);
  await s2.close();
});

test('read level: form tools are refused even if an agent calls them by name', async () => {
  const { dir, argsFile } = setup({ level: 'read' });
  const s = session(dir, [], { FAKE_ARGS_FILE: argsFile });
  await s.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const r = await s.call('browser_type', { element: 'Name', target: 'e4', text: 'Ana' });
  assert.equal(r.result.isError, true);
  assert.match(textOf(r), /owner can allow form filling/);
  await s.close();
});
