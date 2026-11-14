'use strict';

// ORCA LLM keys: ~/.config/operio-orca/llm.env, one NAME=value per line, mode 0600.
// The file is loaded into herdr's environment by every way it starts (the systemd units'
// EnvironmentFile=, the launchd agents, the CLI's start path), and agents run inside herdr,
// so every agent sees the keys. Values never leave the file except into that environment:
// list() gives names and the last 4 characters, nothing more.
//
// Used by server.js (the panel's /api/llm) and by the CLI (bin/operio-orca llm …), which
// runs this file as a small program:  node lib/llm.js FILE set NAME  (value on stdin)
//                                     node lib/llm.js FILE unset NAME | list

const fs = require('fs');
const path = require('path');

const NAME_RE = /^[A-Z][A-Z0-9_]*$/;
// What can go in a value: it must survive `. llm.env` in sh unquoted and systemd's
// EnvironmentFile= as is. So no spaces, quotes, $, backslashes or other shell characters.
// Keys, tokens and URLs (OPENAI_BASE_URL) fit.
const VALUE_RE = /^[A-Za-z0-9._:/+=@,%-]{1,4096}$/;
const KINDS = ['claude', 'codex', 'opencode', 'gemini'];
const HEADER = '# ORCA: API keys for your agents, one NAME=value per line (mode 600). Change with: operio-orca llm set NAME';

const hint = v => '****' + String(v).slice(-4);
const readLines = file => { try { return fs.readFileSync(file, 'utf8').split('\n'); } catch { return []; } };

function parse(file) {
  const out = [];
  for (const line of readLines(file)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) out.push({ name: m[1], value: m[2] });
  }
  return out;
}
const list = file => parse(file).map(e => ({ name: e.name, hint: hint(e.value) }));

// Rewrite without NAME, then with NAME=value when a value is given; comments and other lines
// stay. Written 0600 to a temp file in the same folder and renamed into place.
function write(file, name, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lines = readLines(file).filter(l => !l.startsWith(name + '='));
  while (lines.length && lines.at(-1) === '') lines.pop();
  if (!lines.length) lines.push(HEADER);
  if (value != null) lines.push(`${name}=${value}`);
  const tmp = path.join(dir, `.llm.env.${process.pid}.tmp`);
  fs.writeFileSync(tmp, lines.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(tmp, 0o600); // the create mode is masked by umask
  fs.renameSync(tmp, file);
}

// set(): one trailing newline is dropped (a piped `echo`); anything else that is not a plain
// one-line value is refused. Returns the hint for the message ("****1234").
function set(file, name, value) {
  if (!NAME_RE.test(String(name ?? ''))) throw new Error('bad_name');
  const v = String(value ?? '').replace(/\r?\n$/, '');
  if (!v) throw new Error('empty');
  if (!VALUE_RE.test(v)) throw new Error('bad_value');
  write(file, name, v);
  return hint(v);
}
function unset(file, name) {
  if (!NAME_RE.test(String(name ?? ''))) throw new Error('bad_name');
  const had = parse(file).some(e => e.name === name);
  if (had) write(file, name, null);
  return had;
}
function mode(file) { try { return fs.statSync(file).mode & 0o777; } catch { return null; } }

module.exports = { NAME_RE, VALUE_RE, KINDS, list, set, unset, mode, hint };

if (require.main === module) {
  const [file, cmd, name] = process.argv.slice(2);
  const fail = msg => { process.stderr.write(`operio-orca: ERROR: ${msg}\n`); process.exit(1); };
  const ERRORS = {
    bad_name: 'NAME must be upper case letters, digits and _ and start with a letter (e.g. ANTHROPIC_API_KEY)',
    empty: 'no value given: pipe it in, or type it at the prompt',
    bad_value: 'the value has a character that cannot go in llm.env (letters, digits and . _ - : / + = @ , % only, on one line)',
  };
  if (!file || !['set', 'unset', 'list'].includes(cmd)) fail('usage: llm.js FILE set NAME | unset NAME | list');
  try {
    if (cmd === 'list') for (const k of list(file)) process.stdout.write(`${k.name}  ${k.hint}\n`);
    else if (cmd === 'set') process.stdout.write(set(file, name, fs.readFileSync(0, 'utf8')) + '\n');
    else process.stdout.write((unset(file, name) ? 'removed' : 'absent') + '\n');
  } catch (e) { fail(ERRORS[e.message] || e.message); }
}
