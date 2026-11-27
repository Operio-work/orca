#!/usr/bin/env node
'use strict';
// operio-orca artifact — send pages, dashboards and data to ORCA Artifacts
// (https://github.com/Operio-work/orca-artifacts). New pages and dashboards arrive as drafts that a
// person approves in the Artifacts app; data for something already approved goes straight in.
//   artifact setup URL TOKEN      save the Artifacts app address + publish token (mode 600)
//   artifact status               is it set up, and does the token work
//   artifact off                  forget the address and token
//   artifact publish PATH [--slug SLUG] [--by NAME]
//                                 a folder (with index.html) or an .html file → a page;
//                                 a dashboard .json (version 1) → a dashboard
//   artifact data NAME FILE|-     JSON → dashboards/data/NAME.json   (--page SLUG: that page's data.json)
// Usage: artifacts-cli.js <cmd> <configDir> [args…]   (ARTIFACTS_URL / ARTIFACTS_TOKEN env win)

const fs = require('fs');
const path = require('path');

const LIMIT_FILES = 40;
const LIMIT_BYTES = 5 * 1024 * 1024;
const EXT = /\.(html|css|js|mjs|json|svg|png|jpe?g|webp|gif|txt|md|pdf|woff2)$/i;
const TEXT = /\.(html|css|js|mjs|json|svg|txt|md)$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

class CliError extends Error {}

function settingsFile(dir) { return path.join(dir, 'artifacts.json'); }

function loadSettings(dir, env = process.env) {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(settingsFile(dir), 'utf8')); } catch { /* not set up */ }
  return { url: env.ARTIFACTS_URL || s.url || '', token: env.ARTIFACTS_TOKEN || s.token || '', sso: !!s.sso };
}

/** The app's address: origin plus its path (an app served under /c/acme/artifacts keeps it), no trailing slash. */
function appAddress(u) {
  return u.origin + u.pathname.replace(/\/+$/, '');
}

/** Secret the Artifacts app accepts sign-in tickets with (it derives the same from its publish token). */
function ssoSecret(token) {
  return require('crypto').createHmac('sha256', String(token)).update('orca-artifacts/sso/v1').digest('base64url');
}

/** Check a URL + token pair without saving; returns the app's address. */
function parseSettings(url, token) {
  let u;
  try { u = new URL(url); } catch { throw new CliError(`not a URL: ${url}`); }
  if (!/^https?:$/.test(u.protocol)) throw new CliError('the URL must start with https:// (or http:// on this machine)');
  if (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) {
    throw new CliError('use https:// for anything but this machine (the token travels with every call)');
  }
  if (!token || token.length < 24) throw new CliError('the token has at least 24 characters (ARTIFACTS_PUBLISH_TOKEN in the Artifacts app)');
  return appAddress(u);
}

function saveSettings(dir, url, token, extra = {}) {
  const address = parseSettings(url, token);
  fs.mkdirSync(dir, { recursive: true });
  const file = settingsFile(dir);
  fs.writeFileSync(file, JSON.stringify({ url: address, token, ...extra }, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return address;
}

/** Turn a dashboard slug-ish name into a valid slug. */
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Read a page folder into { relPath: {text}|{base64} }, refusing what the app would refuse. */
function readPageDir(dir) {
  const files = {};
  let total = 0;
  const walk = (abs, rel, depth) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (depth >= 3) throw new CliError(`too deep: ${r} (at most 4 folder levels)`);
        walk(path.join(abs, e.name), r, depth + 1);
      } else if (e.isFile()) {
        if (!EXT.test(e.name)) throw new CliError(`file type not allowed: ${r}`);
        const buf = fs.readFileSync(path.join(abs, e.name));
        total += buf.length;
        if (total > LIMIT_BYTES) throw new CliError('the folder is over 5 MB');
        files[r] = TEXT.test(e.name) ? { text: buf.toString('utf8') } : { base64: buf.toString('base64') };
        if (Object.keys(files).length > LIMIT_FILES) throw new CliError(`more than ${LIMIT_FILES} files`);
      }
    }
  };
  walk(dir, '', 0);
  if (!files['index.html']) throw new CliError(`no index.html in ${dir}`);
  return files;
}

/** What `publish PATH` sends: a page (folder or .html) or a dashboard (.json with version 1). */
function buildPublishBody(target, { slug, by } = {}) {
  let st;
  try { st = fs.statSync(target); } catch { throw new CliError(`not found: ${target}`); }
  const base = path.basename(path.resolve(target)).replace(/\.[^.]+$/, '');
  if (st.isDirectory()) {
    const s = slug || slugify(base);
    if (!SLUG.test(s)) throw new CliError(`slug "${s}": 2–60 lowercase letters, digits, dashes (use --slug)`);
    return { kind: 'page', slug: s, by, files: readPageDir(target) };
  }
  if (/\.html?$/i.test(target)) {
    const s = slug || slugify(base);
    if (!SLUG.test(s)) throw new CliError(`slug "${s}": 2–60 lowercase letters, digits, dashes (use --slug)`);
    if (st.size > LIMIT_BYTES) throw new CliError('the file is over 5 MB');
    return { kind: 'page', slug: s, by, files: { 'index.html': { text: fs.readFileSync(target, 'utf8') } } };
  }
  if (/\.json$/i.test(target)) {
    let spec;
    try { spec = JSON.parse(fs.readFileSync(target, 'utf8')); } catch { throw new CliError(`${target} is not valid JSON`); }
    if (!spec || spec.version !== 1 || !Array.isArray(spec.widgets)) {
      throw new CliError(`${target} is not a dashboard (needs "version": 1 and "widgets"); for data use: operio-orca artifact data NAME ${target}`);
    }
    if (slug) spec.slug = slug;
    return { kind: 'dashboard', by, spec };
  }
  throw new CliError('publish a folder with index.html, an .html file, or a dashboard .json');
}

async function call(settings, method, body, fetchImpl = fetch) {
  if (!settings.url || !settings.token) throw new CliError('not set up: operio-orca artifact setup URL TOKEN');
  let res;
  try {
    res = await fetchImpl(`${settings.url}/api/publish`, {
      method,
      headers: { authorization: `Bearer ${settings.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new CliError(`can't reach ${settings.url} (${e.cause?.code || e.name || e.message})`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new CliError('the token was refused (check ARTIFACTS_PUBLISH_TOKEN in the Artifacts app)');
  if (res.status === 404) throw new CliError('publishing is off in the Artifacts app (set ARTIFACTS_PUBLISH_TOKEN there)');
  if (res.status === 422) throw new CliError('refused:\n  ' + (data.problems || []).join('\n  '));
  if (!res.ok) throw new CliError(`the Artifacts app answered ${res.status}`);
  return data;
}

function parseArgs(args) {
  const o = { pos: [], slug: '', by: '', page: '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const m = /^--(slug|by|page)(?:=(.*))?$/.exec(a);
    if (m) {
      const v = m[2] !== undefined ? m[2] : args[++i];
      if (v === undefined) throw new CliError(`--${m[1]} needs a value`);
      o[m[1]] = v;
    } else if (a.startsWith('--')) throw new CliError(`unknown option ${a}`);
    else o.pos.push(a);
  }
  return o;
}

function readJsonArg(src) {
  const text = src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8');
  if (text.length > LIMIT_BYTES) throw new CliError('the data is over 5 MB');
  try { return JSON.parse(text); } catch { throw new CliError('the data is not valid JSON'); }
}

async function main(argv, env = process.env, out = console.log, fetchImpl = fetch) {
  const [cmd, dir, ...rest] = argv;
  if (!dir) throw new CliError('usage: artifacts-cli.js <cmd> <configDir> [args…]');
  const o = parseArgs(rest);
  const who = o.by || env.OPERIO_ORCA_AGENT_NAME || 'ORCA';
  switch (cmd) {
    case 'setup': {
      if (o.pos.length !== 2) throw new CliError('usage: operio-orca artifact setup URL TOKEN');
      // Saved only once the app accepts the token, so a typo never replaces a working setup.
      const address = parseSettings(o.pos[0], o.pos[1]);
      const check = await call({ url: address, token: o.pos[1] }, 'GET', null, fetchImpl);
      // The app signs people in with ORCA (ARTIFACTS_AUTH=orca): the panel button then opens it signed in.
      saveSettings(dir, address, o.pos[1], check.sso ? { sso: true } : {});
      out(`set up: ${address} (token OK${check.sso ? ', one sign-in with ORCA' : ''})`);
      return;
    }
    case 'status': {
      const s = loadSettings(dir, env);
      if (!s.url) { out('not set up (operio-orca artifact setup URL TOKEN)'); return; }
      const check = await call(s, 'GET', null, fetchImpl);
      out(`${s.url}: token OK${check.sso ? ', one sign-in with ORCA' : ''}`);
      return;
    }
    case 'off':
      fs.rmSync(settingsFile(dir), { force: true });
      out('address and token removed');
      return;
    case 'publish': {
      if (o.pos.length !== 1) throw new CliError('usage: operio-orca artifact publish PATH [--slug SLUG] [--by NAME]');
      const body = buildPublishBody(o.pos[0], { slug: o.slug, by: who });
      const r = await call(loadSettings(dir, env), 'POST', body, fetchImpl);
      const s = loadSettings(dir, env);
      out(`${r.status === 'draft' ? 'draft, waiting for approval' : 'published'}: ${s.url}${r.url || ''}`);
      return;
    }
    case 'data': {
      if (o.page ? o.pos.length !== 1 : o.pos.length !== 2) throw new CliError('usage: operio-orca artifact data NAME FILE|-   or   artifact data --page SLUG FILE|-');
      const json = readJsonArg(o.pos[o.pos.length - 1]);
      const body = o.page ? { kind: 'data', page: o.page, json, by: who } : { kind: 'data', name: o.pos[0], json, by: who };
      await call(loadSettings(dir, env), 'POST', body, fetchImpl);
      out(o.page ? `data updated: page ${o.page}` : `data updated: ${o.pos[0]}`);
      return;
    }
  }
  throw new CliError(`unknown artifact command: ${cmd} (setup, status, off, publish, data)`);
}

module.exports = { main, buildPublishBody, loadSettings, saveSettings, slugify, ssoSecret, CliError };

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`operio-orca: ${e instanceof CliError ? e.message : e.stack || e}`);
    process.exit(1);
  });
}
