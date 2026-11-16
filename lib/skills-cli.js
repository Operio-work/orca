#!/usr/bin/env node
'use strict';
// operio-orca skills — install, remove and list skills; store this client's gallery (ORCA Host).
//   skills install       stdin { key, version, files: { "SKILL.md": "...", ... } } → install or replace
//   skills remove KEY    remove one ORCA installed (never anything else)
//   skills list          one line per installed skill: <key> v<version>
//   skills catalog-set   stdin = Operio's gallery for this client → <config>/operio-skills.json (0600)
// JSON only on stdin, never in argv. Usage: skills-cli.js <cmd> <configDir> [KEY]   (HOME from env)

const fs = require('fs');
const os = require('os');
const { createSkills, SkillError } = require('./skills');

const MAX_STDIN = 1024 * 1024;

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
    if (n > MAX_STDIN) throw new Error(`input too large (max ${MAX_STDIN / 1024} KB)`);
    chunks.push(Buffer.from(buf.subarray(0, r)));
  }
  return Buffer.concat(chunks).toString('utf8');
}
function readJson() {
  try { return JSON.parse(readStdin()); } catch (e) { throw new Error(e instanceof SyntaxError ? 'not valid JSON' : e.message); }
}

function main(argv, env = process.env) {
  const [cmd, dir, arg] = argv;
  if (!dir) throw new Error('usage: skills-cli.js <install|remove|list|catalog-set> <configDir> [KEY]');
  const skills = createSkills({ home: env.HOME || os.homedir(), configDir: dir });
  if (cmd === 'install') {
    const r = skills.install(readJson(), { source: 'operio' });
    return `installed ${r.key} v${r.version}`;
  }
  if (cmd === 'remove') {
    const r = skills.remove(arg);
    return r.removed ? `removed ${r.key}` : `${r.key} was not installed`;
  }
  if (cmd === 'list') {
    const l = skills.list();
    return l.map(s => `${s.key} v${s.version}`).join('\n');
  }
  if (cmd === 'catalog-set') {
    const cat = skills.setCatalog(readJson());
    return `saved ${cat.skills.length} skill${cat.skills.length === 1 ? '' : 's'} in ${skills.CATALOG_FILE} (mode 600)`;
  }
  throw new Error(`unknown skills command: ${cmd || ''} (install, remove, list, catalog-set)`);
}

if (require.main === module) {
  try { const out = main(process.argv.slice(2)); if (out) process.stdout.write(out + '\n'); }
  catch (e) {
    const msg = e instanceof SkillError ? (e.detail ? `${e.code} — ${e.detail}` : e.code) : e.message;
    process.stderr.write(`operio-orca: ERROR: skills: ${msg}\n`);
    process.exit(1);
  }
}

module.exports = { main };
