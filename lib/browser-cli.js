#!/usr/bin/env node
'use strict';
// operio-orca browser — the agents' web browser.
//   browser on          find a Chrome with a working sandbox, install the pinned engine, turn it on
//   browser off         turn it off (saved agents keep the tool; it tells them it is off)
//   browser forms on|off  let agents type and click; every submit waits for approval in the panel
//   browser reset       wipe the browser's own profile (cookies, cache)
//   browser status      on/off, which browser, engine version, profile size
//   browser test URL    open URL through the same checks agents get, print the text, save a screenshot
// Usage: browser-cli.js <cmd> <configDir> <appDir> [URL]
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const {
  createBrowser, findChrome, installHint, checkUrl, BrowserError, ENGINE_PKG, ENGINE_VERSION, TOOL_ID,
} = require('./browser');
const { createTools } = require('./tools');
const { createJournal } = require('./journal');

const say = s => process.stdout.write(s + '\n');
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); throw e; }); // `| head` is fine

function dirSize(dir) {
  let n = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) n += dirSize(p); else if (e.isFile()) { try { n += fs.statSync(p).size; } catch { /* gone */ } }
    }
  } catch { /* missing */ }
  return n;
}
const mb = n => (n / 1048576).toFixed(1) + ' MB';

// The browser must start headless with its sandbox. We never pass --no-sandbox.
function launchCheck(exe) {
  const r = spawnSync(exe, ['--headless=new', '--disable-gpu', '--dump-dom', 'about:blank'], { encoding: 'utf8', timeout: 45000 });
  if (r.status === 0 && /<html/i.test(r.stdout || '')) return null;
  const err = String(r.stderr || r.error?.message || '').trim().split('\n').slice(-3).join('\n');
  if (/sandbox/i.test(err)) return 'its sandbox cannot start on this computer (ORCA never runs a browser without it)';
  return 'it did not start' + (err ? ':\n' + err : '');
}

function npmBin() {
  const near = path.join(path.dirname(process.execPath), process.platform === 'win32' ? 'npm.cmd' : 'npm');
  return fs.existsSync(near) ? near : 'npm';
}

function installEngine(b) {
  if (b.engineVersion() === ENGINE_VERSION) return false;
  fs.mkdirSync(b.ENGINE, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(b.ENGINE, 'package.json'), JSON.stringify({ name: 'orca-browser-engine', private: true }) + '\n');
  say(`Installing the browser engine (${ENGINE_PKG}@${ENGINE_VERSION}, about 20 MB)…`);
  const r = spawnSync(npmBin(), ['install', '--prefix', b.ENGINE, '--no-audit', '--no-fund', '--no-update-notifier', '--save-exact', `${ENGINE_PKG}@${ENGINE_VERSION}`], {
    stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
  });
  if (r.status !== 0 || b.engineVersion() !== ENGINE_VERSION) throw new Error('the engine did not install (npm failed; see above)');
  return true;
}

function jot(configDir, event, data = {}) {
  if (process.env.OPERIO_ORCA_BROWSER_PANEL === '1') return; // the panel writes the line itself, with who
  try { createJournal({ dir: path.join(configDir, 'journal') }).write(event, data); } catch { /* best effort */ }
}

function cmdOn(configDir, appDir) {
  const b = createBrowser({ configDir, appDir });
  const exe = findChrome();
  if (!exe) {
    if (process.env.OPERIO_ORCA_BROWSER_EXECUTABLE) throw new Error(`OPERIO_ORCA_BROWSER_EXECUTABLE is not a program: ${process.env.OPERIO_ORCA_BROWSER_EXECUTABLE}`);
    throw new Error('no Chrome, Chromium, Edge or Brave found.\n' + installHint());
  }
  say(`Browser: ${exe}`);
  const why = launchCheck(exe);
  if (why) throw new Error(`that browser cannot be used: ${why}.\n${installHint()}`);
  installEngine(b);
  createTools({ configDir }).put(b.toolEntry(), { builtin: true });
  fs.mkdirSync(b.PROFILE, { recursive: true, mode: 0o700 });
  const level = b.read().level === 'forms' ? 'forms' : 'read'; // turning on again keeps the owner's choice
  b.save({ enabled: true, executable: exe, engine: ENGINE_VERSION, level, since: new Date().toISOString() });
  jot(configDir, 'browser.on', { level });
  say(`Web browser: ON (${level === 'forms' ? 'form filling, each submit approved by you' : 'read only: open, read, screenshot'}).`);
  say('Give it to an agent: Saved agents → edit → Tools → Web browser. Try it: operio-orca browser test https://example.com');
}

function cmdOff(configDir, appDir) {
  const b = createBrowser({ configDir, appDir });
  const st = b.read();
  if (!st.enabled) return say('Web browser: already off.');
  b.save({ ...st, enabled: false });
  jot(configDir, 'browser.off');
  say('Web browser: OFF. Agents that have it are told it is off. The profile is kept (operio-orca browser reset wipes it).');
}

function cmdForms(configDir, appDir, arg) {
  if (arg !== 'on' && arg !== 'off') throw new Error('usage: operio-orca browser forms on|off');
  const b = createBrowser({ configDir, appDir });
  const st = b.read();
  if (!st.enabled) throw new Error('the web browser is off: operio-orca browser on first');
  const level = arg === 'on' ? 'forms' : 'read';
  b.save({ ...st, level });
  jot(configDir, 'browser.level', { level });
  say(level === 'forms'
    ? 'Form filling: ON. Agents can type and click; every click, Enter or submit waits for your approval in the panel. Payment fields are never typed.'
    : 'Form filling: OFF. Agents only open and read pages.');
}

function cmdReset(configDir, appDir) {
  createBrowser({ configDir, appDir }).resetProfile();
  jot(configDir, 'browser.reset');
  say('Browser profile wiped (cookies, cache, history).');
}

function cmdStatus(configDir, appDir) {
  const b = createBrowser({ configDir, appDir });
  const st = b.read();
  const tool = createTools({ configDir }).list().some(t => t.id === TOOL_ID);
  say(`Web browser: ${st.enabled ? 'ON' : 'OFF'}${st.enabled ? (st.level === 'forms' ? ' (form filling, each submit approved)' : ' (read only)') : ''}`);
  say(`Browser:     ${st.executable || '—'}${st.executable && !fs.existsSync(st.executable) ? '  (missing: run operio-orca browser on)' : ''}`);
  say(`Engine:      ${b.engineVersion() || '—'}${b.engineVersion() && b.engineVersion() !== ENGINE_VERSION ? `  (ORCA wants ${ENGINE_VERSION}: run operio-orca browser on)` : ''}`);
  say(`Profile:     ${mb(dirSize(b.PROFILE))}${b.profileInUse() ? '  (open now)' : ''}`);
  say(`Tool:        ${tool ? 'listed in Admin → Tools' : 'not listed'}`);
}

// Talk to the proxy exactly as an agent would.
function cmdTest(configDir, appDir, url) {
  if (!url) throw new Error('usage: operio-orca browser test URL');
  const proxy = spawn(process.execPath, [path.join(appDir, 'lib', 'browser-proxy.js'), '--test'], {
    stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, OPERIO_ORCA_CONFIG_DIR: configDir },
  });
  let buf = '', id = 0;
  const pending = new Map();
  proxy.stdin.on('error', () => { /* proxy gone: the exit handler reports it */ });
  proxy.stdout.setEncoding('utf8');
  proxy.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id != null && pending.has(m.id)) { pending.get(m.id).res(m); pending.delete(m.id); }
    }
  });
  const rpc = (method, params) => new Promise((res, rej) => {
    const n = ++id;
    const t = setTimeout(() => { pending.delete(n); rej(new Error(`${method}: no answer after 150 s`)); }, 150000);
    pending.set(n, { res: m => { clearTimeout(t); res(m); }, rej: e => { clearTimeout(t); rej(e); } });
    if (proxy.exitCode != null) { pending.get(n).rej(new Error('the web browser stopped; run: operio-orca browser on')); pending.delete(n); return; }
    proxy.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n');
  });
  // The proxy exits when the engine cannot start: answer every waiting call at once, not after 150 s.
  proxy.on('exit', code => {
    for (const [n, p] of pending) { pending.delete(n); p.rej(new Error(`the web browser stopped (exit ${code ?? '?'}); run: operio-orca browser on`)); }
  });
  const text = m => (m.result?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n') || (m.error ? m.error.message : '');
  const end = code => { try { proxy.stdin.end(); proxy.kill(); } catch { /* gone */ } process.exitCode = code; };
  return (async () => {
    await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'operio-orca-browser-test', version: '1' } });
    proxy.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const list = await rpc('tools/list', {});
    say(`Tools offered to agents: ${(list.result?.tools || []).map(t => t.name.replace(/^browser_/, '')).join(', ')}`);
    const t0 = Date.now();
    const nav = await rpc('tools/call', { name: 'browser_navigate', arguments: { url } });
    if (nav.result?.isError) { say(text(nav)); return end(1); }
    say(`Opened in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
    const snap = await rpc('tools/call', { name: 'browser_snapshot', arguments: {} });
    const body = text(snap).split('\n');
    say(body.slice(0, 40).join('\n') + (body.length > 40 ? `\n… (${body.length - 40} more lines)` : ''));
    const shot = await rpc('tools/call', { name: 'browser_take_screenshot', arguments: { filename: 'browser-test.png' } });
    say(shot.result?.isError ? 'Screenshot failed: ' + text(shot) : `Screenshot: ${path.join(createBrowser({ configDir, appDir }).SHOTS, 'browser-test.png')}`);
    await rpc('tools/call', { name: 'browser_close', arguments: {} });
    end(0);
  })().catch(e => { say('Test failed: ' + e.message); end(1); });
}

function main(argv) {
  const [cmd, configDir, appDir, arg] = argv;
  if (!configDir || !appDir) throw new Error('usage: browser-cli.js <on|off|reset|status|test> <configDir> <appDir> [URL]');
  if (cmd === 'on') return cmdOn(configDir, appDir);
  if (cmd === 'off') return cmdOff(configDir, appDir);
  if (cmd === 'reset') return cmdReset(configDir, appDir);
  if (cmd === 'forms') return cmdForms(configDir, appDir, arg);
  if (cmd === 'status') return cmdStatus(configDir, appDir);
  if (cmd === 'test') return cmdTest(configDir, appDir, arg);
  throw new Error(`unknown browser command: ${cmd} (on, off, reset, status, test)`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { process.stderr.write('operio-orca: ERROR: ' + (e instanceof BrowserError ? (e.detail || e.message) : e.message) + '\n'); process.exit(1); }
}
module.exports = { main, launchCheck, checkUrl };
