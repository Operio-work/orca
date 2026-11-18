'use strict';
// Tools for agents: MCP servers an admin registers once and saved agents pick by id.
//   <config>/tools.json    the catalogue: { tools: [{ id, name, type: stdio|http, command, args, env, url, headers }] }
//   <config>/secrets.env   NAME='value' lines (0600). Never sent to the page, never logged.
// env / headers values are templates: "${NAME}" is filled from secrets.env. At start ORCA writes the
// agent's own run files: mcp.json (templates as-is; Claude fills ${NAME} from its environment) and
// mcp.env with only the secrets those servers use, sourced into that agent's shell.
// Claude only for now: other kinds keep their own MCP settings (the editor says so).
const fs = require('fs');
const path = require('path');

const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const VAR_RE = /^[A-Z_][A-Z0-9_]{0,63}$/;
const KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/; // env var / header names
const MAX_TOOLS = 50, MAX_ARGS = 30, ARG_MAX = 500, VALUE_MAX = 4000;
// Variables a server may never take from us, whatever its config says.
// The built-in Web browser (lib/browser.js): only `operio-orca browser on|off` writes or removes it.
const BUILTIN_IDS = new Set(['web-browser']);
const RESERVED = new Set(['PATH', 'HOME', 'USER', 'SHELL', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'NODE_OPTIONS']);

class ToolError extends Error {
  constructor(code, status = 400, detail) { super(code); this.code = code; this.status = status; this.detail = detail; }
}
const bad = detail => new ToolError('bad_tool', 400, detail);
const oneLine = (v, max) => String(v ?? '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, max);
const varsIn = s => [...String(s).matchAll(/\$\{([A-Z_][A-Z0-9_]{0,63})\}/g)].map(m => m[1]);
const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";

function cleanMap(obj, what) {
  const out = {};
  for (const [k, v] of Object.entries(obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}).slice(0, 30)) {
    if (!KEY_RE.test(k) || RESERVED.has(k)) throw bad(what + ' name ' + k.slice(0, 40));
    const val = oneLine(v, 1000);
    out[k] = val;
  }
  return out;
}

function validate(t) {
  const id = String(t?.id || '');
  if (!ID_RE.test(id)) throw bad('id');
  const name = oneLine(t.name, 60) || id;
  const type = t.type === 'http' ? 'http' : t.type === 'stdio' ? 'stdio' : null;
  if (!type) throw bad('type');
  if (type === 'stdio') {
    const command = oneLine(t.command, 200);
    if (!command) throw bad('command');
    const args = (Array.isArray(t.args) ? t.args : []).map(a => String(a ?? ''));
    if (args.length > MAX_ARGS || args.some(a => a.length > ARG_MAX || /[\r\n\u0000]/.test(a))) throw bad('args');
    return { id, name, type, command, args, env: cleanMap(t.env, 'env') };
  }
  const url = oneLine(t.url, 500);
  if (!/^https?:\/\/[^\s]+$/.test(url)) throw bad('url');
  return { id, name, type, url, headers: cleanMap(t.headers, 'header') };
}
const varsOf = t => [...new Set([...Object.values(t.env || {}), ...Object.values(t.headers || {}), ...(t.args || []), t.url || ''].flatMap(varsIn))];

function createTools({ configDir, log = () => {} }) {
  const FILE = path.join(configDir, 'tools.json');
  const SECRETS = path.join(configDir, 'secrets.env');
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file + '.tmp', text, { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
  };

  function list() {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      return (raw.tools || []).flatMap(t => { try { return [validate(t)]; } catch (e) { log('tools.bad_entry', { id: String(t?.id).slice(0, 40), detail: e.detail }); return []; } });
    } catch (e) { if (e.code !== 'ENOENT') log('tools.bad_file', { error: e.message }); return []; }
  }
  const save = tools => write(FILE, JSON.stringify({ tools }, null, 2) + '\n');
  function put(input, { builtin = false } = {}) {
    const t = validate(input);
    if (BUILTIN_IDS.has(t.id) && !builtin) throw new ToolError('builtin_tool', 409);
    const all = list().filter(x => x.id !== t.id);
    if (all.length >= MAX_TOOLS) throw new ToolError('too_many');
    save([...all, t].sort((a, b) => a.id.localeCompare(b.id)));
    return t;
  }
  function remove(id, { builtin = false } = {}) {
    if (BUILTIN_IDS.has(id) && !builtin) throw new ToolError('builtin_tool', 409);
    const all = list();
    if (!all.some(t => t.id === id)) return false;
    save(all.filter(t => t.id !== id));
    return true;
  }

  // ── Secrets (write-only from the page)
  function readSecrets() {
    const out = {};
    let text = '';
    try { text = fs.readFileSync(SECRETS, 'utf8'); } catch { return out; }
    for (const line of text.split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]{0,63})='((?:[^']|'\\'')*)'$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/'\\''/g, "'");
    }
    return out;
  }
  function setSecret(name, value) {
    if (!VAR_RE.test(String(name)) || RESERVED.has(name)) throw new ToolError('bad_secret_name');
    const all = readSecrets();
    if (value == null || value === '') delete all[name];
    else {
      value = String(value);
      if (value.length > VALUE_MAX || /[\r\n\u0000]/.test(value)) throw new ToolError('bad_secret');
      all[name] = value;
    }
    write(SECRETS, Object.entries(all).map(([k, v]) => `${k}=${shq(v)}`).join('\n') + '\n');
  }
  const secretNames = () => Object.keys(readSecrets()).sort();

  // Each tool with the secrets it needs and whether they are set: for the page.
  function view() {
    const have = new Set(secretNames());
    return list().map(t => ({ ...t, needs: varsOf(t), missing: varsOf(t).filter(v => !have.has(v)) }));
  }

  // Run files for one agent: mcp.json with the chosen servers, mcp.env with only their secrets.
  // Unknown ids are skipped (removed since the setup was saved); a missing secret stops the start.
  function writeRun(dir, ids) {
    const chosen = list().filter(t => ids.includes(t.id));
    if (!chosen.length) return null;
    const secrets = readSecrets();
    const vars = [...new Set(chosen.flatMap(varsOf))];
    const missing = vars.filter(v => !(v in secrets));
    if (missing.length) throw new ToolError('secret_missing', 409, missing.join(', '));
    const servers = {};
    for (const t of chosen) {
      // The built-in browser learns which agent runs it: its Journal lines and screenshots.
      const args = BUILTIN_IDS.has(t.id) ? [...t.args, '--run-dir', dir] : t.args;
      servers[t.id] = t.type === 'stdio'
        ? { type: 'stdio', command: t.command, args, ...(Object.keys(t.env).length ? { env: t.env } : {}) }
        : { type: 'http', url: t.url, ...(Object.keys(t.headers).length ? { headers: t.headers } : {}) };
    }
    const mcpFile = path.join(dir, 'mcp.json'), envFile = path.join(dir, 'mcp.env');
    write(mcpFile, JSON.stringify({ mcpServers: servers }, null, 2) + '\n');
    write(envFile, vars.map(v => `${v}=${shq(secrets[v])}`).join('\n') + '\n');
    return { mcpFile, envFile: vars.length ? envFile : null, ids: chosen.map(t => t.id) };
  }

  return { list, put, remove, setSecret, secretNames, view, writeRun, FILE, SECRETS };
}

module.exports = { createTools, validate, varsOf, ToolError, ID_RE, BUILTIN_IDS };
