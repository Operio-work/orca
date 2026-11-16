#!/usr/bin/env node
'use strict';
// operio-orca kb — the business's documents for agents (lib/kb.js).
//   kb search "question" [-n 5] [--collection NAME] [--json]   what agents run (`-` or none → stdin)
//   kb add PATH          the file's content on stdin → knowledge/PATH (relative, no `..`)
//   kb remove PATH       remove one document
//   kb list              PATH  bytes  chunks  indexed|skipped:<reason>
//   kb status            files, chunks, collections, semantic on/off, last indexed
//   kb reindex [--full]  index changed files (everything with --full); embeds new chunks when hosted
// Usage: kb-cli.js <cmd> <configDir> <appDir> [args…]   (HOME and OPERIO_ORCA_HOSTED from env)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKb, installKnowledgeSkill, KbError, MAX_FILE } = require('./kb');
const { createSkills } = require('./skills');

function readStdin(max) {
  const chunks = [];
  let n = 0;
  const buf = Buffer.alloc(65536);
  for (;;) {
    let r;
    try { r = fs.readSync(0, buf, 0, buf.length, null); }
    catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EOF') break; throw e; }
    if (!r) break;
    n += r;
    if (n > max) throw new KbError('too_large', 413, `max ${Math.round(max / 1024 / 1024)} MB`);
    chunks.push(Buffer.from(buf.subarray(0, r)));
  }
  return Buffer.concat(chunks);
}

// -n N, --collection NAME (or --collection=NAME), --json, --full; the rest are positional.
function parseArgs(args) {
  const o = { pos: [], n: 5, collection: null, json: false, full: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n' || a === '--n') { o.n = Number(args[++i]); if (!Number.isInteger(o.n) || o.n < 1 || o.n > 20) throw new Error('-n needs a number from 1 to 20'); }
    else if (a.startsWith('-n') && /^-n\d+$/.test(a)) o.n = Math.min(Number(a.slice(2)), 20) || 5;
    else if (a === '--collection') { o.collection = args[++i]; if (!o.collection) throw new Error('--collection needs a name'); }
    else if (a.startsWith('--collection=')) o.collection = a.slice(13);
    else if (a === '--json') o.json = true;
    else if (a === '--full') o.full = true;
    else if (a.startsWith('-') && a.length > 1) throw new Error(`unknown option: ${a}`);
    else o.pos.push(a);
  }
  return o;
}

const semText = s => (s.on ? `on (${s.provider} ${s.model})` : `off (${s.why === 'free' ? 'keyword search on the free panel' : 'no VOYAGE_API_KEY or OPENAI_API_KEY in llm.env'})`);
const fmtBytes = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

async function main(argv, env = process.env) {
  const [cmd, dir, appDir, ...rest] = argv;
  if (!dir) throw new Error('usage: kb-cli.js <search|add|remove|list|status|reindex> <configDir> <appDir> [args]');
  const log = (event, d) => { if (event === 'kb.skill_skipped') process.stderr.write(`operio-orca: ${d.key}: ${d.reason} — left alone\n`); };
  const skills = createSkills({ home: env.HOME || os.homedir(), configDir: dir, bundledDir: appDir ? path.join(appDir, 'skills') : null });
  const kb = createKb({
    configDir: dir, hosted: env.OPERIO_ORCA_HOSTED === '1', env, log,
    onIndexed: () => installKnowledgeSkill(skills, log),
  });
  const o = parseArgs(rest);

  if (cmd === 'search') {
    // `-` (or no question at all): read it from stdin, so it never sits on a command line
    // (other users of a shared box can read /proc/<pid>/cmdline).
    let q = o.pos.join(' ').trim();
    if (!q || q === '-') q = readStdin(64 * 1024).toString('utf8').trim();
    const r = await kb.search(q, { n: o.n, collection: o.collection });
    if (o.json) return JSON.stringify(r);
    if (!r.results.length) return ['Nothing found in the business\'s documents for that question.', r.note ? `(${r.note})` : null, 'Say so — do not guess.'].filter(Boolean).join('\n');
    const out = r.results.map((x, i) => `${i + 1}. ${x.source}:${x.lines}\n   ${x.snippet}`);
    if (r.note) out.push(`(${r.note})`);
    out.push('Cite the source when you use it.');
    return out.join('\n');
  }
  if (cmd === 'add') {
    if (o.pos.length !== 1) throw new Error('usage: operio-orca kb add PATH  (the content on stdin)');
    const r = await kb.add(o.pos[0], readStdin(MAX_FILE));
    return `${r.replaced ? 'replaced' : 'added'} ${r.path} (${r.bytes} bytes, ${r.status === 'indexed' ? `${r.chunks} chunks` : `skipped: ${r.reason}`})`;
  }
  if (cmd === 'remove') {
    if (o.pos.length !== 1) throw new Error('usage: operio-orca kb remove PATH');
    const r = await kb.remove(o.pos[0]);
    return r.removed ? `removed ${r.path}` : `${r.path} was not there`;
  }
  if (cmd === 'list') {
    await kb.refresh();
    return kb.list().map(f => `${f.path}  ${f.bytes}  ${f.chunks}  ${f.status === 'indexed' ? 'indexed' : `skipped:${f.reason}`}`).join('\n');
  }
  if (cmd === 'status') {
    const s = await kb.status();
    if (o.json) return JSON.stringify(s);
    return [
      `files: ${s.files} (${s.indexed} indexed, ${s.skipped} skipped, ${fmtBytes(s.bytes)})`,
      `chunks: ${s.chunks}`,
      `collections: ${s.collections.length ? s.collections.join(', ') : '-'}`,
      `semantic: ${semText(s.semantic)}`,
      `last indexed: ${s.lastIndexed ? new Date(s.lastIndexed).toISOString() : 'never'}`,
      `folder: ${kb.DOCS}`,
    ].join('\n');
  }
  if (cmd === 'reindex') {
    const r = await kb.reindex({ full: o.full });
    const s = await kb.status();
    const out = [`indexed ${s.indexed} files (${s.chunks} chunks), ${s.skipped} skipped; ${r.changed.length} changed, ${r.removed.length} removed`];
    if (s.semantic.on) {
      try {
        const e = await kb.embedPending();
        out.push(`semantic: ${e.embedded} new chunks embedded (${s.semantic.provider} ${s.semantic.model})`);
      } catch (e) { out.push(`semantic: embedding failed (${e.code || 'error'}) — keyword search still works`); }
    }
    return out.join('\n');
  }
  throw new Error(`unknown kb command: ${cmd || ''} (search, add, remove, list, status, reindex)`);
}

if (require.main === module) {
  main(process.argv.slice(2)).then(out => { if (out) process.stdout.write(out + '\n'); }, e => {
    const msg = e instanceof KbError ? (e.detail ? `${e.code} — ${e.detail}` : e.code) : e.message;
    process.stderr.write(`operio-orca: ERROR: kb: ${msg}\n`);
    process.exit(1);
  });
}

module.exports = { main, parseArgs };
