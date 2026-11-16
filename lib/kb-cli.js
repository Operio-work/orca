#!/usr/bin/env node
'use strict';
// operio-orca kb — the business's documents for agents (lib/kb.js).
//   kb search "question" [-n 5] [--collection NAME] [--json]   what agents run (`-` or none → stdin)
//                        run inside an ORCA agent: only the collections that agent may use
//                        (asks the panel over the agent socket, like operio-orca-send)
//   kb add PATH          the file's content on stdin → knowledge/PATH (relative, no `..`)
//   kb remove PATH       remove one document
//   kb list              PATH  bytes  chunks  indexed|skipped:<reason>
//   kb status            files, chunks, collections, semantic on/off, last indexed
//   kb reindex [--full]  index changed files (everything with --full); embeds new chunks when hosted
// Usage: kb-cli.js <cmd> <configDir> <appDir> [args…]   (HOME and OPERIO_ORCA_HOSTED from env)

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const config = require('./config');
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

// Which collections may the agent running this search use? Asks the panel over the agent socket,
// which works out the agent from this process (same pid lookup as operio-orca-send).
//   { by: 'agent', agent, scope: 'all' | [...], denied }   inside an agent
//   { by: 'person' }                                        not inside an agent → everything
//   { by: 'unknown', why }                                  panel not reachable → everything + a note
function askScope(sock, pid = process.pid, timeout = 5000) {
  return new Promise(resolve => {
    let done = false;
    const end = v => { if (!done) { done = true; resolve(v); } };
    const req = http.request({ socketPath: sock, method: 'GET', path: `/kb-scope?pid=${pid}`, timeout }, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        let j = {};
        try { j = JSON.parse(buf); } catch { /* not JSON */ }
        if (res.statusCode === 403 && j.error === 'not_an_agent') return end({ by: 'person' });
        if (res.statusCode !== 200 || !(j.scope === 'all' || Array.isArray(j.scope))) return end({ by: 'unknown', why: j.error || `HTTP ${res.statusCode}` });
        end({ by: 'agent', agent: j.me || null, scope: j.scope, denied: Array.isArray(j.denied) ? j.denied : [] });
      });
    });
    req.on('timeout', () => { req.destroy(); end({ by: 'unknown', why: 'timeout' }); });
    req.on('error', e => end({ by: 'unknown', why: e.code || e.message }));
    req.end();
  });
}
const UNCHECKED = 'could not check this agent\'s access; searched everything';

const semText = s => (s.on ? `on (${s.provider} ${s.model})` : `off (${s.why === 'free' ? 'keyword search on the free panel' : 'no VOYAGE_API_KEY or OPENAI_API_KEY in llm.env'})`);
const fmtBytes = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

async function main(argv, env = process.env, opts = {}) {
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
    // Per-agent access (lib/kb-access.js): a scoping aid, not a security wall.
    const sock = env.OPERIO_ORCA_AGENT_SOCK || config.load({ ...env, OPERIO_ORCA_CONFIG_DIR: dir }).AGENT_SOCK;
    const who = await (opts.askScope || askScope)(sock);
    const denied = who.by === 'agent' ? who.denied : [];
    if (o.collection && denied.includes(o.collection)) {
      throw new Error(`this agent may not search the folder "${o.collection}" — a person decides which agents search which folder in ORCA → Knowledge`);
    }
    const r = await kb.search(q, { n: o.n, collection: o.collection, exclude: denied });
    const notes = [r.note, who.by === 'unknown' ? UNCHECKED : null, denied.length ? 'searched only the folders this agent may use' : null].filter(Boolean);
    if (o.json) {
      const scope = who.by === 'agent' ? { agent: who.agent, collections: who.scope, denied, checked: true }
        : { agent: null, collections: 'all', denied: [], checked: who.by === 'person' };
      const j = { ...r, scope };
      if (who.by === 'unknown') j.note = [r.note, UNCHECKED].filter(Boolean).join('; ');
      return JSON.stringify(j);
    }
    if (!r.results.length) return ['Nothing found in the business\'s documents for that question.', ...notes.map(n => `(${n})`), 'Say so — do not guess.'].join('\n');
    const out = r.results.map((x, i) => `${i + 1}. ${x.source}:${x.lines}\n   ${x.snippet}`);
    for (const n of notes) out.push(`(${n})`);
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

module.exports = { main, parseArgs, askScope };
