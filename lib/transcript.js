'use strict';
// Reader source for Claude Code agents: the session's own transcript (JSONL), not the screen.
// The screen is a picture of the conversation (wrapped, cut, repainted); the transcript is the
// conversation itself, so nothing is garbled or missing. Other agent kinds keep the screen.
//
// blocks(entries) -> [{ t: 'you', text } | { t: 'say', text } | { t: 'tools', items: [{ name, what }] }
//                     | { t: 'ask', questions }]   ('ask' only while an AskUserQuestion is unanswered)
const fs = require('fs');
const path = require('path');

const MAX_TAIL = 4 * 1024 * 1024; // read at most the last 4 MB of a transcript
const MAX_BLOCKS = 400;

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

function blocks(entries) {
  const out = [];
  const pendingAsk = new Map(); // tool_use id -> questions
  const add = b => {
    const last = out[out.length - 1];
    if (b.t === 'tools' && last?.t === 'tools') { last.items.push(...b.items); return; }
    if (b.t === 'say' && last?.t === 'say') { last.text += '\n\n' + b.text; return; }
    out.push(b);
  };
  for (const e of entries) {
    if (!e || e.isSidechain || e.isMeta) continue;
    const m = e.message;
    if (e.type === 'user' && m) {
      if (typeof m.content === 'string') {
        if (META_RE.test(m.content)) {
          const cmd = m.content.match(/<command-name>([^<]+)<\/command-name>/);
          const args = (m.content.match(/<command-args>([^<]*)<\/command-args>/) || [])[1]?.trim();
          if (cmd) add({ t: 'you', text: cmd[1].trim() + (args ? ' ' + args : '') });
          continue;
        }
        const text = strip(m.content);
        if (text) add({ t: 'you', text });
        continue;
      }
      for (const c of m.content || []) {
        if (c.type === 'tool_result') { pendingAsk.delete(c.tool_use_id); continue; }
        if (c.type === 'text' && !META_RE.test(c.text)) { const text = strip(c.text); if (text) add({ t: 'you', text }); }
        if (c.type === 'image') add({ t: 'you', text: '[image]' });
      }
      continue;
    }
    if (e.type === 'assistant' && m && Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'text' && c.text?.trim()) add({ t: 'say', text: c.text.trim() });
        else if (c.type === 'tool_use') {
          if (c.name === 'AskUserQuestion' && Array.isArray(c.input?.questions)) pendingAsk.set(c.id, c.input.questions);
          add({ t: 'tools', items: [{ name: toolName(c.name), what: toolWhat(c.name, c.input) }] });
        }
      }
    }
  }
  const asks = [...pendingAsk.values()];
  const res = out.slice(-MAX_BLOCKS);
  if (asks.length) res.push({ t: 'ask', questions: asks[asks.length - 1] });
  return res;
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

const parsed = new Map(); // file -> { size, mtime, blocks }
function readBlocks(file) {
  const st = fs.statSync(file);
  const c = parsed.get(file);
  if (c && c.size === st.size && c.mtime === st.mtimeMs) return c.blocks;
  const start = Math.max(0, st.size - MAX_TAIL);
  const fd = fs.openSync(file, 'r');
  let raw;
  try { const buf = Buffer.alloc(st.size - start); fs.readSync(fd, buf, 0, buf.length, start); raw = buf.toString('utf8'); }
  finally { fs.closeSync(fd); }
  const lines = raw.split('\n');
  if (start > 0) lines.shift(); // first line is cut
  const entries = [];
  for (const l of lines) { if (!l) continue; try { entries.push(JSON.parse(l)); } catch { /* a line being written */ } }
  const b = blocks(entries);
  parsed.set(file, { size: st.size, mtime: st.mtimeMs, blocks: b });
  if (parsed.size > 64) parsed.delete(parsed.keys().next().value);
  return b;
}

module.exports = { blocks, toolWhat, findTranscript, readBlocks };
