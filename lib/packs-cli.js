#!/usr/bin/env node
'use strict';
// operio-orca packs — industry packs put on this panel by ORCA Host.
//   packs add          stdin { id, version, pack, files, skills } → install its skills, store the pack
//   packs remove ID    take the pack off the panel's list (agents, routines and files already
//                      installed from it stay: they are the client's now)
//   packs list         one line per pack: <id> v<version>
// JSON only on stdin, never in argv. Usage: packs-cli.js <cmd> <configDir> [ID]   (HOME from env)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSkills } = require('./skills');
const { readStarters } = require('./starters');
const packs = require('./packs');

const MAX_STDIN = 4 * 1024 * 1024;
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

function main(argv, env = process.env) {
  const [cmd, dir, arg] = argv;
  if (!dir) throw new Error('usage: packs-cli.js <add|remove|list> <configDir> [ID]');
  const packsDir = path.join(dir, 'packs');
  if (cmd === 'add') {
    let b;
    try { b = JSON.parse(readStdin()); } catch (e) { throw new Error(e instanceof SyntaxError ? 'not valid JSON' : e.message); }
    const skills = createSkills({ home: env.HOME || os.homedir(), configDir: dir });
    const starters = readStarters(path.join(__dirname, '..', 'starters'));
    const r = packs.addBundle(b, { packsDir, starters, installSkill: s => skills.install(s, { source: 'operio' }) });
    return `added ${r.id} v${r.version} (${r.files} files${r.skills.length ? ', skills: ' + r.skills.join(', ') : ''})`;
  }
  if (cmd === 'remove') return packs.removePack(arg, packsDir) ? `removed ${arg}` : `${arg} was not on this panel`;
  if (cmd === 'list') return packs.listPacks(packsDir).map(p => `${p.id} v${p.version}`).join('\n');
  throw new Error(`unknown command: ${cmd}`);
}

if (require.main === module) {
  try { const out = main(process.argv.slice(2)); if (out) console.log(out); }
  catch (e) { console.error(`operio-orca packs: ${e.message}`); process.exit(1); }
}
module.exports = { main };
