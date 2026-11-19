'use strict';
// Reader source for Claude Code agents: the session's own transcript (JSONL), not the screen.
// The screen is a picture of the conversation (wrapped, cut, repainted); the transcript is the
// conversation itself, so nothing is garbled or missing. Other agent kinds keep the screen.
//
// blocks(entries) -> [{ t: 'you', text } | { t: 'say', text } | { t: 'tools', items: [{ name, what, err? }] }
//                     | { t: 'note', text: 'compacted' } | { t: 'ask', questions }]
// ('ask' only while an AskUserQuestion is unanswered; err = the call failed or was refused).
// readBlocks(file) adds n (the block's number since the session started) for stable fold keys.
const fs = require('fs');
const path = require('path');

const MAX_BLOCKS = 400;   // sent to the panel (the newest)
const KEEP_BLOCKS = 1200; // kept in memory per transcript
const CHUNK = 8 * 1024 * 1024; // read at most this much per refresh (a huge first read goes in steps)

// The CLI's own bookkeeping that arrives as "user" text: slash-command echoes, hook/system notes.
const META_RE = /^\s*<(command-name|command-message|command-args|local-command-stdout|local-command-stderr|local-command-caveat|system-reminder|bash-input|bash-stdout|bash-stderr|task-notification)>/;
const strip = s => String(s || '')
  .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
  .replace(/<\/?pasted_content[^>]*>/g, '')
  .trim();

// One short line saying what a tool call did ("Bash · git status", "Read · server.js").
function toolWhat(name, input) {
  const i = input || {};
  const base = p => (p ? path.basename(String(p)) : '');
  const one = s => String(s || '').split('\n')[0].slice(0, 120);
  switch (name) {
    case 'Bash': return one(i.description || i.command);
    case 'Read': case 'Write': case 'Edit': case 'NotebookEdit': return base(i.file_path || i.notebook_path);
    case 'Grep': return one(i.pattern);
    case 'Glob': return one(i.pattern);
    case 'WebFetch': return one(i.url);
    case 'WebSearch': return one(i.query);
    case 'Agent': case 'Task': return one(i.description);
    case 'Skill': return one(i.skill);
    case 'TodoWrite': return '';
    default: {
      const v = i.description || i.query || i.title || i.name || i.url || i.path || '';
      return one(typeof v === 'string' ? v : '');
    }
  }
}
const toolName = n => String(n || '').replace(/^mcp__([^_]+(?:_[^_]+)*?)__/, (m, srv) => srv.replace(/^claude_ai_/, '') + ' · ');

// Builds the Reader blocks one transcript entry at a time, so a growing file is parsed only
// once: each refresh feeds the new lines. Tool calls carry their id (stable fold keys, and a
// failed or refused call is marked when its result comes back).
function builder() {
  const out = [];
  const pendingAsk = new Map(); // tool_use id -> questions
  const toolById = new Map();   // tool_use id -> item (until its result arrives)
  let seq = 0;                  // blocks ever made: the panel's fold keys stay stable when old ones drop
  const add = b => {
    const last = out[out.length - 1];
    if (b.t === 'tools' && last?.t === 'tools') { last.items.push(...b.items); return; }
    if (b.t === 'say' && last?.t === 'say') { last.text += '\n\n' + b.text; return; }
    b.n = seq++;
    out.push(b);
    if (out.length > KEEP_BLOCKS) out.splice(0, out.length - KEEP_BLOCKS);
  };
  const you = text => add({ t: 'you', text });
  function feed(e) {
    if (!e || e.isSidechain) return;
    // Messages typed while the agent was busy are recorded as attachments, not user entries.
    if (e.type === 'attachment') {
      const a = e.attachment || {};
      if (a.type === 'queued_command' && (a.commandMode === 'prompt' || !a.commandMode) && !a.isMeta && typeof a.prompt === 'string' && !META_RE.test(a.prompt)) {
        const text = strip(a.prompt); if (text) you(text);
      }
      return;
    }
    const m = e.message;
    if (e.type === 'user' && m) {
      // After /compact or an automatic compaction: a marker, not the whole summary as "you".
      if (e.isCompactSummary) { add({ t: 'note', text: 'compacted' }); return; }
      if (e.isMeta) return;
      if (typeof m.content === 'string') {
        if (META_RE.test(m.content)) {
          const cmd = m.content.match(/<command-name>([^<]+)<\/command-name>/);
          const args = (m.content.match(/<command-args>([^<]*)<\/command-args>/) || [])[1]?.trim();
          if (cmd) you(cmd[1].trim() + (args ? ' ' + args : ''));
          return;
        }
        const text = strip(m.content);
        if (text) you(text);
        return;
      }
      for (const c of m.content || []) {
        if (c.type === 'tool_result') {
          pendingAsk.delete(c.tool_use_id);
          const it = toolById.get(c.tool_use_id);
          if (it) { if (c.is_error) it.err = true; toolById.delete(c.tool_use_id); }
          continue;
        }
        if (c.type === 'text' && !META_RE.test(c.text)) { const text = strip(c.text); if (text) you(text); }
        if (c.type === 'image') you('[image]');
      }
      return;
    }
    if (e.isMeta) return;
    if (e.type === 'assistant' && m && Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'text' && c.text?.trim()) add({ t: 'say', text: c.text.trim() });
        else if (c.type === 'tool_use') {
          if (c.name === 'AskUserQuestion' && Array.isArray(c.input?.questions)) pendingAsk.set(c.id, c.input.questions);
          const item = { name: toolName(c.name), what: toolWhat(c.name, c.input) };
          if (c.id) { item.id = c.id; toolById.set(c.id, item); if (toolById.size > 2000) toolById.delete(toolById.keys().next().value); }
          add({ t: 'tools', items: [item] });
        }
      }
    }
  }
  function result() {
    const asks = [...pendingAsk.values()];
    // Copies: the panel gets a snapshot, later entries keep growing the live blocks.
    const res = out.slice(-MAX_BLOCKS).map(b => {
      const c = { ...b };
      if (b.t === 'tools') c.items = b.items.map(({ id, ...rest }) => rest);
      return c;
    });
    if (asks.length) res.push({ t: 'ask', questions: asks[asks.length - 1] });
    return res;
  }
  return { feed, result };
}

function blocks(entries) {
  const b = builder();
  for (const e of entries) b.feed(e);
  return b.result().map(({ n, ...rest }) => rest);
}

// Finds <projects>/*/<session>.jsonl. The folder name is the cwd with / → -, but don't rely on it.
const fileCache = new Map(); // session -> path
function findTranscript(projectsDir, session) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(String(session || ''))) return null;
  const hit = fileCache.get(session);
  if (hit && fs.existsSync(hit)) return hit;
  let dirs = [];
  try { dirs = fs.readdirSync(projectsDir); } catch { return null; }
  for (const d of dirs) {
    const f = path.join(projectsDir, d, session + '.jsonl');
    if (fs.existsSync(f)) { fileCache.set(session, f); return f; }
  }
  return null;
}

// file -> { size, mtime, offset, carry, b: builder, res }. A grown file is read from where the
// last read stopped; a shorter or replaced one (new inode, size went down) is read again.
const parsed = new Map();
function readBlocks(file) {
  const st = fs.statSync(file);
  let c = parsed.get(file);
  if (c && c.size === st.size && c.mtime === st.mtimeMs) return c.res;
  if (!c || st.size < c.offset || c.ino !== st.ino) {
    c = { size: 0, mtime: 0, ino: st.ino, offset: 0, carry: '', b: builder(), res: [] };
    parsed.delete(file); parsed.set(file, c);
    if (parsed.size > 64) parsed.delete(parsed.keys().next().value);
  }
  const fd = fs.openSync(file, 'r');
  try {
    while (c.offset < st.size) {
      const len = Math.min(CHUNK, st.size - c.offset);
      const buf = Buffer.alloc(len);
      const got = fs.readSync(fd, buf, 0, len, c.offset);
      if (got <= 0) break;
      c.offset += got;
      // Cut on the last newline in bytes, so a multi-byte character is never split.
      const nl = buf.lastIndexOf(10, got - 1);
      let text;
      if (nl < 0) { c.carry += buf.toString('utf8', 0, got); continue; }
      text = c.carry + buf.toString('utf8', 0, nl);
      c.carry = buf.toString('utf8', nl + 1, got);
      for (const l of text.split('\n')) {
        if (!l) continue;
        let e; try { e = JSON.parse(l); } catch { continue; }
        c.b.feed(e);
      }
    }
  } finally { fs.closeSync(fd); }
  // A last line still being written stays in carry and is parsed next time.
  c.size = st.size; c.mtime = st.mtimeMs;
  c.res = c.b.result();
  return c.res;
}

module.exports = { blocks, toolWhat, findTranscript, readBlocks };
