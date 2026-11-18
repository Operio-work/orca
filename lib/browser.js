'use strict';
// Web browser for agents: a local headless Chrome that agents drive through a built-in MCP tool.
// Off until `operio-orca browser on`. Read-only in this release: agents open pages, read them and
// take screenshots; clicking and typing are not offered.
//
//   <config>/browser/browser.json   { enabled, executable, engine, installedAt }  (0600)
//   <config>/browser/engine/        the pinned browser engine (npm package), installed on `on`
//   <config>/browser/profile/       the browser's own profile (0700), never the user's Chrome
//   <config>/browser/shots/         screenshots when no agent run folder is known
//
// The agent never talks to the engine directly: lib/browser-proxy.js sits between them, hides the
// tools we do not offer, refuses addresses on this computer or the home network, marks page text
// as data, and writes one Journal line per page opened.
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');

const ENGINE_PKG = '@playwright/mcp';
const ENGINE_VERSION = '0.0.85'; // pinned: still 0.x, so every move is tested by hand first
const TOOL_ID = 'web-browser';
const NAV_TIMEOUT_MS = 120000;

// What agents get. Everything else the engine offers is hidden and refused.
const READ_TOOLS = new Set([
  'browser_navigate', 'browser_navigate_back', 'browser_snapshot', 'browser_take_screenshot',
  'browser_find', 'browser_wait_for', 'browser_tabs', 'browser_close', 'browser_resize',
  'browser_console_messages',
]);
// Clicking, typing and forms: offered in a later release, each submit behind an approval card.
const INTERACTIVE_TOOLS = new Set([
  'browser_click', 'browser_type', 'browser_fill_form', 'browser_select_option',
  'browser_press_key', 'browser_handle_dialog', 'browser_hover', 'browser_drag', 'browser_drop',
]);
// Tools that open a URL the agent chose: checked before they reach the engine.
const URL_TOOLS = new Set(['browser_navigate']);

// Hosts the browser may never load, whatever the page asks. Globs as the engine reads them
// (`*` stops at `/`, so `127.*` also covers a port). The proxy also resolves every address an
// agent opens and refuses one that points here (a public name for a private address).
const BLOCKED_HOSTS = [
  'localhost*', '*.localhost*', '127.*', '0.0.0.0*', '[::1]*', '[::]*', '[fc*', '[fd*', '[fe80:*',
  '10.*', '192.168.*', '169.254.*', '100.64.*',
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*`),
  '*.local*', '*.internal*', '*.lan*', '*.home.arpa*', '*.ts.net*',
];

class BrowserError extends Error {
  constructor(code, detail) { super(detail || code); this.code = code; this.detail = detail; }
}

// ── Addresses
function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s);
  }
  return false;
}
const PRIVATE_NAME = /(^|\.)(localhost|local|internal|lan|home\.arpa|ts\.net)$/i;

// Throws BrowserError('blocked_url') for anything an agent may not open. Returns the URL as parsed.
async function checkUrl(raw, { lookup = dns.lookup } = {}) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { throw new BrowserError('blocked_url', 'not a web address'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new BrowserError('blocked_url', 'only http and https pages');
  if (u.username || u.password) throw new BrowserError('blocked_url', 'addresses with a login in them are not opened');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) throw new BrowserError('blocked_url', 'no host');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new BrowserError('blocked_url', 'addresses on this computer or your network are not opened');
    return u;
  }
  if (PRIVATE_NAME.test(host) || !host.includes('.')) throw new BrowserError('blocked_url', 'addresses on this computer or your network are not opened');
  let addrs;
  try { addrs = await lookup(host, { all: true }); } catch { throw new BrowserError('blocked_url', 'that address does not exist'); }
  if (addrs.some(a => isPrivateIp(a.address))) throw new BrowserError('blocked_url', 'that name points to this computer or your network');
  return u;
}

// ── Finding a browser with a working sandbox. A Chrome we download cannot start its sandbox on
// recent Ubuntu, so we use one installed on the computer and never run without the sandbox.
function chromeCandidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') {
    const apps = ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser'];
    return apps.flatMap(a => [`/Applications/${a}.app/Contents/MacOS/${a}`, path.join(env.HOME || '', `Applications/${a}.app/Contents/MacOS/${a}`)]);
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable',
    '/usr/bin/brave-browser', '/snap/bin/chromium'];
}
function findChrome({ platform = process.platform, env = process.env, exists = p => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } } } = {}) {
  const own = env.OPERIO_ORCA_BROWSER_EXECUTABLE;
  if (own) return exists(own) ? own : null;
  return chromeCandidates(platform, env).find(exists) || null;
}
function installHint(platform = process.platform) {
  if (platform === 'darwin') return 'Install Google Chrome from https://www.google.com/chrome/ and run this again.';
  return 'Install Google Chrome (Debian/Ubuntu: download the .deb from https://www.google.com/chrome/ and run\n'
    + '  sudo apt install ./google-chrome-stable_current_amd64.deb) or Chromium, then run this again.\n'
    + 'Or point ORCA at a browser: OPERIO_ORCA_BROWSER_EXECUTABLE=/path/to/chrome operio-orca browser on';
}

// ── State
function createBrowser({ configDir, appDir }) {
  const DIR = path.join(configDir, 'browser');
  const FILE = path.join(DIR, 'browser.json');
  const ENGINE = path.join(DIR, 'engine');
  const PROFILE = path.join(DIR, 'profile');
  const SHOTS = path.join(DIR, 'shots');
  const engineCli = () => path.join(ENGINE, 'node_modules', ENGINE_PKG, 'cli.js');

  function read() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { enabled: false }; }
  }
  function save(state) {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(FILE + '.tmp', FILE);
  }
  function engineVersion() {
    try { return JSON.parse(fs.readFileSync(path.join(ENGINE, 'node_modules', ENGINE_PKG, 'package.json'), 'utf8')).version; } catch { return null; }
  }
  // The MCP entry agents get. `--run-dir` is added per agent when its run files are written.
  function toolEntry(nodeBin = process.execPath) {
    return { id: TOOL_ID, name: 'Web browser', type: 'stdio', command: nodeBin, args: [path.join(appDir, 'lib', 'browser-proxy.js')], env: {} };
  }
  // Engine arguments, built here so the proxy and the tests agree on them.
  function engineArgs(state, { outputDir = SHOTS } = {}) {
    return [engineCli(), '--headless', '--user-data-dir', PROFILE, '--executable-path', state.executable,
      '--output-dir', outputDir, '--blocked-origins', BLOCKED_HOSTS.join(';'), '--block-service-workers',
      '--timeout-navigation', String(NAV_TIMEOUT_MS), '--image-responses', 'omit'];
  }
  function profileInUse() {
    try { fs.lstatSync(path.join(PROFILE, 'SingletonLock')); return true; } catch { return false; }
  }
  function resetProfile() {
    if (profileInUse()) throw new BrowserError('busy', 'the browser is open: stop the agents using it first');
    fs.rmSync(PROFILE, { recursive: true, force: true });
    fs.mkdirSync(PROFILE, { recursive: true, mode: 0o700 });
  }
  return { DIR, FILE, ENGINE, PROFILE, SHOTS, read, save, engineVersion, engineCli, toolEntry, engineArgs, profileInUse, resetProfile };
}

// Tool list as the agent sees it: only what this release offers.
function filterTools(tools) {
  return (tools || []).filter(t => READ_TOOLS.has(t.name));
}
function allowedTool(name) { return READ_TOOLS.has(name); }

module.exports = {
  createBrowser, checkUrl, isPrivateIp, findChrome, chromeCandidates, installHint, filterTools, allowedTool,
  BrowserError, BLOCKED_HOSTS, READ_TOOLS, INTERACTIVE_TOOLS, URL_TOOLS, ENGINE_PKG, ENGINE_VERSION, TOOL_ID,
};
