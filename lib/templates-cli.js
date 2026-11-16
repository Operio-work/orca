#!/usr/bin/env node
'use strict';
// operio-orca templates — Operio's prompt-template library on an ORCA Host panel.
//   templates set     the library as JSON on stdin → <config>/operio-templates.json (mode 600)
//   templates show    how many templates, and when they were sent
//   templates clear   remove the library
// ORCA Host sends it (orcahost-run templates-set); the panel re-reads the file when it changes,
// so no restart. The free panel never shows it. Usage: templates-cli.js <set|show|clear> <configDir>

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 512 * 1024, MAX_TEMPLATES = 500, TITLE_MAX = 80, BODY_MAX = 4000;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const LANGS = ['en', 'es'];

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

// Throws with a plain message on anything that isn't a library. Keeps only known fields.
function normalizeLibrary(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.templates)) throw new Error('expected {"templates": [...]}');
  if (raw.templates.length > MAX_TEMPLATES) throw new Error(`too many templates (max ${MAX_TEMPLATES})`);
  const seen = new Set();
  const templates = raw.templates.map((t, i) => {
    const id = String(t?.id ?? '');
    if (!ID_RE.test(id)) throw new Error(`template ${i + 1}: bad id "${id.slice(0, 40)}"`);
    if (seen.has(id)) throw new Error(`template ${i + 1}: duplicate id "${id}"`);
    seen.add(id);
    const out = { id };
    for (const l of LANGS) {
      const title = str(t?.[l]?.title, TITLE_MAX), body = str(t?.[l]?.body, BODY_MAX);
      if (title && body) out[l] = { title, body };
    }
    if (!LANGS.some(l => out[l])) throw new Error(`template "${id}": needs a title and text in en or es`);
    if (Array.isArray(t.tags)) out.tags = t.tags.slice(0, 6).map(x => str(x, 24)).filter(Boolean);
    return out;
  });
  return { version: 1, updatedAt: Number(raw.updatedAt) || Date.now(), templates };
}

function readStdin() {
  const chunks = [];
  let n = 0;
  const buf = Buffer.alloc(65536);
  for (;;) {
    let r;
    try { r = fs.readSync(0, buf, 0, buf.length, null); }
    catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EOF') break; throw e; }
    if (!r) break;
    n += r;
    if (n > MAX_BYTES) throw new Error(`library too large (max ${MAX_BYTES / 1024} KB)`);
    chunks.push(Buffer.from(buf.subarray(0, r)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function main(argv) {
  const [cmd, dir] = argv;
  if (!dir) throw new Error('usage: templates-cli.js <set|show|clear> <configDir>');
  const file = path.join(dir, 'operio-templates.json');
  if (cmd === 'set') {
    let raw;
    try { raw = JSON.parse(readStdin()); } catch (e) { throw new Error(e instanceof SyntaxError ? 'not valid JSON' : e.message); }
    const lib = normalizeLibrary(raw);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(lib), { mode: 0o600 });
    fs.renameSync(tmp, file);
    return `saved ${lib.templates.length} Operio template${lib.templates.length === 1 ? '' : 's'} in ${file} (mode 600)`;
  }
  if (cmd === 'show') {
    let lib;
    try { lib = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return 'no Operio templates'; throw new Error(`unreadable: ${file}`); }
    const n = Array.isArray(lib.templates) ? lib.templates.length : 0;
    return `${n} Operio template${n === 1 ? '' : 's'}, sent ${new Date(Number(lib.updatedAt) || 0).toISOString()}`;
  }
  if (cmd === 'clear') {
    try { fs.unlinkSync(file); return 'removed the Operio templates'; }
    catch (e) { if (e.code === 'ENOENT') return 'no Operio templates'; throw e; }
  }
  throw new Error(`unknown templates command: ${cmd || ''} (set, show, clear)`);
}

if (require.main === module) {
  try { process.stdout.write(main(process.argv.slice(2)) + '\n'); }
  catch (e) { process.stderr.write(`operio-orca: ERROR: templates: ${e.message}\n`); process.exit(1); }
}

module.exports = { normalizeLibrary, main };
