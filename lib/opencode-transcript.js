'use strict';

// Read OpenCode's local session database in the same block format as transcript.js.
// node:sqlite is optional so installations on Node 20 keep using the screen Reader.
const fs = require('fs');

const MAX_BLOCKS = 400;
const KEEP_BLOCKS = 1200;

function createReader({ loadSqlite = () => require('node:sqlite') } = {}) {
  const connections = new Map();
  const parsed = new Map();

  function dbFor(file) {
    if (!file || !fs.existsSync(file)) return null;
    let db = connections.get(file);
    if (db) return db;
    try {
      const { DatabaseSync } = loadSqlite();
      db = new DatabaseSync(file, { readOnly: true });
      db.exec('PRAGMA busy_timeout = 1000');
      connections.set(file, db);
      return db;
    } catch { return null; }
  }

  const parse = value => { try { return JSON.parse(value); } catch { return {}; } };
  const providerOf = row => parse(row.model).providerID || '';
  const providerMatches = (row, kind) => kind !== 'ollama' || providerOf(row) === 'ollama';

  function sessionRow(db, id) {
    try {
      return db.prepare(`SELECT id, directory, time_created, time_updated, model,
        tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write
        FROM session WHERE id = ?`).get(id) || null;
    } catch { return null; }
  }

  // Prefer the remembered session; otherwise match directory and the pane's start time.
  function findSession(file, { cwd, since, kind = 'opencode', known = null, now = Date.now() } = {}) {
    const db = dbFor(file);
    if (!db) return null;
    if (known) {
      const saved = sessionRow(db, known);
      if (saved && (!cwd || saved.directory === cwd) && providerMatches(saved, kind)) return saved.id;
    }
    if (!cwd) return null;
    try {
      const rows = db.prepare(`SELECT id, directory, time_created, time_updated, model
        FROM session WHERE directory = ? ORDER BY time_created DESC LIMIT 100`).all(cwd);
      const hasSince = since != null && Number.isFinite(Number(since));
      const threshold = hasSince ? Number(since) - 120000 : now - 60000;
      return rows.find(row => row.time_created >= threshold && providerMatches(row, kind))?.id || null;
    } catch { return null; }
  }

  const oneLine = value => String(value || '').split('\n')[0].trim().slice(0, 120);
  function toolWhat(part) {
    const state = part.state || {};
    if (typeof state.title === 'string' && state.title.trim()) return oneLine(state.title);
    const input = state.input || {};
    for (const key of ['description', 'command', 'filePath', 'path', 'pattern', 'query', 'url', 'code']) {
      if (typeof input[key] === 'string' && input[key].trim()) return oneLine(input[key]);
    }
    return '';
  }

  function askFor(part) {
    const input = part.state?.input || {};
    let rows = Array.isArray(input.questions) ? input.questions : null;
    if (!rows && typeof input.question === 'string') rows = [input];
    if (!rows?.length) return null;
    const questions = rows.filter(q => typeof q?.question === 'string' && q.question.trim()).map(q => ({
      question: q.question.trim(),
      ...(typeof q.header === 'string' ? { header: q.header } : {}),
      ...(q.multiSelect ? { multiSelect: true } : {}),
      options: (Array.isArray(q.options) ? q.options : []).filter(o => typeof o?.label === 'string').map(o => ({
        label: o.label,
        ...(typeof o.description === 'string' ? { description: o.description } : {}),
      })),
    }));
    return questions.length ? questions : null;
  }

  function blocks(messages, parts) {
    const out = [];
    const pending = [];
    let seq = 0;
    const add = b => {
      const last = out.at(-1);
      if (b.t === 'tools' && last?.t === 'tools') { last.items.push(...b.items); return; }
      if (b.t === 'say' && last?.t === 'say') { last.text += '\n\n' + b.text; return; }
      b.n = seq++;
      out.push(b);
      if (out.length > KEEP_BLOCKS) out.splice(0, out.length - KEEP_BLOCKS);
    };
    const byMessage = new Map();
    for (const p of parts) {
      if (!byMessage.has(p.message_id)) byMessage.set(p.message_id, []);
      byMessage.get(p.message_id).push(parse(p.data));
    }
    for (const row of messages) {
      const message = parse(row.data);
      const role = message.role;
      if (role !== 'user' && role !== 'assistant') continue;
      for (const part of byMessage.get(row.id) || []) {
        if (part.type === 'compaction') { add({ t: 'note', text: 'compacted' }); continue; }
        if (part.type === 'text') {
          if (part.synthetic || part.ignored || typeof part.text !== 'string' || !part.text.trim()) continue;
          add({ t: role === 'user' ? 'you' : 'say', text: part.text.trim() });
        } else if (part.type === 'file' && role === 'user') {
          const name = part.filename || part.source?.text?.value || 'file';
          add({ t: 'you', text: `[file: ${oneLine(name)}]` });
        } else if (part.type === 'tool' && role === 'assistant') {
          const name = String(part.tool || 'tool').replace(/^./, c => c.toUpperCase());
          const item = { name, what: toolWhat(part) };
          if (part.state?.status === 'error') item.err = true;
          add({ t: 'tools', items: [item] });
          if (name.toLowerCase() === 'question' && part.state?.status !== 'completed') {
            const questions = askFor(part);
            if (questions) pending.push(questions);
          }
        } else if (part.type === 'retry') {
          add({ t: 'tools', items: [{ name: 'Error', what: oneLine(part.error?.data?.message || part.error?.message || part.error), err: true }] });
        }
      }
      if (message.error) {
        const error = message.error.data?.message || message.error.message || message.error.name || 'Request failed';
        add({ t: 'tools', items: [{ name: 'Error', what: oneLine(error), err: true }] });
      }
    }
    const result = out.slice(-MAX_BLOCKS);
    if (pending.length) result.push({ t: 'ask', questions: pending.at(-1) });
    return result;
  }

  function read(file, id) {
    const db = dbFor(file);
    if (!db || !id) return null;
    try {
      const row = sessionRow(db, id);
      if (!row) return null;
      const counts = db.prepare(`SELECT COUNT(DISTINCT m.id) AS messages, COUNT(p.id) AS parts,
        COALESCE(MAX(p.time_updated), 0) AS part_updated
        FROM message m LEFT JOIN part p ON p.message_id = m.id WHERE m.session_id = ?`).get(id);
      const rev = `${id}:${row.time_updated}:${counts.part_updated}:${counts.messages}:${counts.parts}:${row.tokens_input}:${row.tokens_output}`;
      const key = `${file}\0${id}`;
      const hit = parsed.get(key);
      if (hit?.rev === rev) return hit;
      const messages = db.prepare('SELECT id, data FROM message WHERE session_id = ? ORDER BY rowid').all(id);
      const parts = db.prepare('SELECT id, message_id, data FROM part WHERE session_id = ? ORDER BY rowid').all(id);
      const input = Number(row.tokens_input) || 0;
      const output = Number(row.tokens_output) || 0;
      const value = { rev, blocks: blocks(messages, parts), usage: { input, output, total: input + output } };
      parsed.set(key, value);
      if (parsed.size > 64) parsed.delete(parsed.keys().next().value);
      return value;
    } catch { return null; }
  }

  function close(file) {
    const db = connections.get(file);
    if (db) { db.close(); connections.delete(file); }
    for (const key of parsed.keys()) if (key.startsWith(file + '\0')) parsed.delete(key);
  }

  function permissionMenu(screen) {
    const text = String(screen || '');
    if (/Permission required/i.test(text) && /Allow once/i.test(text) && /Allow always|Always allow/i.test(text) && /Reject/i.test(text)) {
      return { question: 'Permission required', keyMode: 'opencode-choice', options: [
        { n: 1, label: 'Allow once' }, { n: 2, label: /Always allow/i.test(text) ? 'Always allow' : 'Allow always', risky: true }, { n: 3, label: 'Reject', risky: true },
      ] };
    }
    if (/This will allow .* until OpenCode is restarted|This will allow the following patterns/i.test(text) && /Confirm/i.test(text) && /Cancel/i.test(text)) {
      return { question: 'Confirm permission', keyMode: 'opencode-choice', options: [
        { n: 1, label: 'Confirm', risky: true }, { n: 2, label: 'Cancel' },
      ] };
    }
    return null;
  }

  return { findSession, read, close, blocks, permissionMenu };
}

module.exports = { ...createReader(), createReader };
