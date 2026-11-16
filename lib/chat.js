'use strict';

// ORCA team chat: one thread per agent (keyed by terminal id, so it follows moves) and one
// team room. Plain files, no database:
//
//   chat/<thread>.jsonl   one line per message {id, at, by, text, mentions}
//                         or per deletion      {del, at, by}
//   chat/meta.json        per person: when they last read each thread, and what they follow;
//                         plus the @agent asks (queue + recent outcomes, kept 2 days)
//
// An agent's answer is a message by "agent:<terminal>" with x = { name, ask, out, took }.
//
// Thread ids: "room" or "t-<terminal_id>". Messages older than keepDays are dropped by
// prune(). Text passes through redact() before it is written. Logins stay on disk only:
// the server shapes messages (logins become names) before they reach a page.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const THREAD_RE = /^(room|t-[A-Za-z0-9_-]{1,80})$/;
const TEXT_MAX = 2000;
const DELETE_WINDOW = 5 * 60 * 1000;

function createChat({ dir, keepDays = 90, redact = s => s, log = () => {}, now = () => Date.now() }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const META = path.join(dir, 'meta.json');
  const threads = new Map(); // id -> [{ id, at, by, text, mentions, deleted?, delAt? }]
  let meta = { reads: {}, follows: {}, asks: [] };
  try { meta = { reads: {}, follows: {}, asks: [], ...JSON.parse(fs.readFileSync(META, 'utf8')) }; } catch { /* first run */ }

  const fileOf = id => path.join(dir, id + '.jsonl');
  const valid = id => typeof id === 'string' && THREAD_RE.test(id);

  function load(id) {
    if (threads.has(id)) return threads.get(id);
    const list = [];
    let raw = '';
    try { raw = fs.readFileSync(fileOf(id), 'utf8'); } catch { /* no messages yet */ }
    for (const line of raw.split('\n')) {
      if (!line) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.del) { const m = list.find(x => x.id === e.del); if (m) { m.deleted = true; m.delAt = e.at; m.text = ''; } }
      else if (e.id) list.push({ id: e.id, at: e.at, by: e.by, text: e.text, mentions: e.mentions || [], ...(e.x ? { x: e.x } : {}) });
    }
    threads.set(id, list);
    return list;
  }
  // Every thread on disk, loaded once (summaries need them all; files are small).
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.jsonl') && valid(f.slice(0, -6))) load(f.slice(0, -6));

  function append(id, entry) {
    fs.appendFileSync(fileOf(id), JSON.stringify(entry) + '\n', { mode: 0o600 });
  }
  let metaTimer = null;
  function saveMeta() {
    if (metaTimer) return;
    metaTimer = setTimeout(() => {
      metaTimer = null;
      const tmp = META + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(meta), { mode: 0o600 });
      fs.renameSync(tmp, META);
    }, 500);
    metaTimer.unref?.();
  }

  function post(id, by, text, mentions = [], x = null) {
    if (!valid(id)) throw Object.assign(new Error('bad_thread'), { code: 'bad_thread' });
    const clean = redact(String(text ?? '').replace(/\r\n/g, '\n').trim());
    if (!clean) throw Object.assign(new Error('empty'), { code: 'empty' });
    if (clean.length > TEXT_MAX) throw Object.assign(new Error('too_long'), { code: 'too_long' });
    const list = load(id);
    // Strictly increasing times per thread, so "after=<at>" never misses a message.
    const last = list.length ? list[list.length - 1].at : 0;
    const msg = { id: crypto.randomBytes(6).toString('hex'), at: Math.max(now(), last + 1), by, text: clean, mentions: [...new Set(mentions)], ...(x ? { x } : {}) };
    append(id, msg);
    list.push(msg);
    markRead(by, id, msg.at);
    log('chat.post', { thread: id, chars: clean.length, mentions: msg.mentions.length }); // never the text
    return msg;
  }

  // Changed since `after`: new messages and messages deleted since then.
  function list(id, { after = 0, limit = 200 } = {}) {
    if (!valid(id)) return [];
    const all = load(id);
    const out = all.filter(m => m.at > after || (m.delAt && m.delAt > after));
    return out.slice(-limit);
  }

  function remove(id, msgId, by, isAdmin = false) {
    const m = valid(id) && load(id).find(x => x.id === msgId);
    if (!m || m.deleted) throw Object.assign(new Error('not_found'), { code: 'not_found' });
    if (m.by !== by && !isAdmin) throw Object.assign(new Error('not_yours'), { code: 'not_yours' });
    if (!isAdmin && now() - m.at > DELETE_WINDOW) throw Object.assign(new Error('too_late'), { code: 'too_late' });
    const at = now();
    append(id, { del: msgId, at, by });
    m.deleted = true; m.delAt = at; m.text = '';
    log('chat.delete', { thread: id });
    return m;
  }

  function markRead(login, id, at = now()) {
    if (!valid(id) || !login) return;
    const r = (meta.reads[login] = meta.reads[login] || {});
    if ((r[id] || 0) >= at) return;
    r[id] = at;
    saveMeta();
  }

  // Per thread: unread for this person (others' messages after their last read), total, last.
  function summary(login, ids) {
    const r = meta.reads[login] || {};
    const out = {};
    for (const id of ids) {
      if (!valid(id)) continue;
      const live = load(id).filter(m => !m.deleted);
      const seen = r[id] || 0;
      const last = live[live.length - 1];
      out[id] = {
        n: live.length,
        unread: live.filter(m => m.at > seen && m.by !== login).length,
        mention: live.some(m => m.at > seen && m.by !== login && m.mentions.includes(login)),
        lastAt: last?.at || 0,
      };
    }
    return out;
  }

  function prune() {
    const cut = now() - keepDays * 864e5;
    let dropped = 0;
    for (const [id, list] of threads) {
      const keep = list.filter(m => m.at >= cut);
      if (keep.length === list.length) continue;
      dropped += list.length - keep.length;
      threads.set(id, keep);
      if (!keep.length) { try { fs.unlinkSync(fileOf(id)); } catch { /* already gone */ } continue; }
      const lines = [];
      for (const m of keep) {
        lines.push(JSON.stringify({ id: m.id, at: m.at, by: m.by, text: m.deleted ? '' : m.text, mentions: m.mentions, ...(m.x ? { x: m.x } : {}) }));
        if (m.deleted) lines.push(JSON.stringify({ del: m.id, at: m.delAt, by: m.by }));
      }
      const tmp = fileOf(id) + '.tmp';
      fs.writeFileSync(tmp, lines.join('\n') + '\n', { mode: 0o600 });
      fs.renameSync(tmp, fileOf(id));
    }
    const before = meta.asks.length;
    meta.asks = meta.asks.filter(k => k.at >= now() - ASK_KEEP);
    if (meta.asks.length !== before) saveMeta();
    if (dropped) log('chat.pruned', { dropped });
    return dropped;
  }

  // ── Following: who hears about new messages in a thread (push).
  // Explicit choice wins (true = follow, false = muted). Otherwise an agent thread is followed by
  // the agent's holder and by everyone who wrote in it; the room by nobody (it is opt-in).
  function setFollow(login, id, on) {
    if (!valid(id) || !login) return;
    const f = (meta.follows[login] = meta.follows[login] || {});
    f[id] = !!on;
    saveMeta();
  }
  const posted = (id, login) => load(id).some(m => m.by === login && !m.deleted);
  function following(login, id, holder = null) {
    const explicit = meta.follows[login]?.[id];
    if (typeof explicit === 'boolean') return explicit;
    if (id === 'room') return false;
    return login === holder || posted(id, login);
  }
  // Who gets a push for this message: mentions always (even in a muted thread), then followers.
  function recipients(id, msg, { holder = null } = {}) {
    const out = new Map();
    for (const l of msg.mentions || []) if (l !== msg.by) out.set(l, 'mention');
    const candidates = new Set([...Object.keys(meta.follows).filter(l => meta.follows[l][id] === true)]);
    if (id !== 'room') {
      if (holder) candidates.add(holder);
      for (const m of load(id)) if (!m.deleted && !m.by.startsWith('agent:')) candidates.add(m.by);
    }
    for (const l of candidates) if (l !== msg.by && !out.has(l) && following(l, id, holder)) out.set(l, 'reply');
    return [...out].map(([login, kind]) => ({ login, kind }));
  }

  // Only people who turned this thread on themselves (and haven't muted it): used for
  // agent-to-agent messages, which must not wake the holder or past writers.
  function explicitFollowers(id) {
    return Object.keys(meta.follows).filter(l => meta.follows[l][id] === true);
  }

  // ── @agent asks: a chat message sent to an agent as a prompt.
  // state: queued → sent → done | failed (reason). One in flight per agent; FIFO per agent.
  // Limits count every ask that was accepted (queued or later), over the last hour.
  function askAllowed(by, terminal, { perPerson = 5, perAgent = 5, queueMax = 5 } = {}) {
    const hour = now() - 3600e3;
    const recent = meta.asks.filter(k => k.at >= hour);
    if (recent.filter(k => k.by === by).length >= perPerson) return 'limit_person';
    if (recent.filter(k => k.terminal === terminal).length >= perAgent) return 'limit_agent';
    if (meta.asks.filter(k => k.terminal === terminal && k.state === 'queued').length >= queueMax) return 'queue_full';
    return null;
  }
  function addAsk({ thread, msgId, by, terminal, name, prompt }) {
    const k = { id: crypto.randomBytes(6).toString('hex'), at: now(), thread, msgId, by, terminal, name: name || null, prompt, state: 'queued' };
    meta.asks.push(k);
    saveMeta();
    return k;
  }
  function updateAsk(id, patch) {
    const k = meta.asks.find(x => x.id === id);
    if (!k) return null;
    Object.assign(k, patch);
    if (patch.state === 'done' || patch.state === 'failed') delete k.prompt; // the journal keeps what was sent
    saveMeta();
    return k;
  }
  // Oldest queued ask per agent that has nothing in flight.
  function nextAsks() {
    const inFlight = new Set(meta.asks.filter(k => k.state === 'sent').map(k => k.terminal));
    const out = new Map();
    for (const k of meta.asks) if (k.state === 'queued' && !inFlight.has(k.terminal) && !out.has(k.terminal)) out.set(k.terminal, k);
    return [...out.values()];
  }
  const asksWhere = fn => meta.asks.filter(fn);
  // Position in its agent's line (1 = next), for "waiting — 2 ahead".
  function queuePos(k) {
    return meta.asks.filter(x => x.terminal === k.terminal && (x.state === 'queued' || x.state === 'sent') && x.at <= k.at).length;
  }

  // What the agent reads: who is asking, from where, the last few messages, then the message.
  // context: the thread's live messages before this one, oldest first, cut to fit `chars`.
  function contextFor(id, msgId, { max = 6, chars = 1500, nameOf = l => l } = {}) {
    const all = load(id).filter(m => !m.deleted);
    const i = all.findIndex(m => m.id === msgId);
    const before = (i < 0 ? all : all.slice(0, i)).slice(-max);
    const out = [];
    let used = 0;
    for (let j = before.length - 1; j >= 0; j--) {
      const m = before[j];
      let line = `${nameOf(m.by, m)}: ${m.text.replace(/\s+/g, ' ').trim()}`;
      if (line.length > 400) line = line.slice(0, 399) + '…';
      if (used + line.length > chars) break;
      out.unshift(line);
      used += line.length + 1;
    }
    return out;
  }

  const ids = () => [...threads.keys()];
  const get = (id, msgId) => (valid(id) ? load(id).find(m => m.id === msgId) || null : null);
  return {
    get, post, list, remove, markRead, summary, prune, ids, valid, setFollow, explicitFollowers, following, recipients,
    askAllowed, addAsk, updateAsk, nextAsks, asksWhere, queuePos, contextFor, DELETE_WINDOW, TEXT_MAX,
  };
}
const ASK_KEEP = 2 * 864e5;

// The prompt an @agent message becomes. `where` names the thread when it isn't the agent's own.
function buildPrompt({ from, agentName, where = null, context = [], text, replyMax = 2000 }) {
  const head = where
    ? `[ORCA team chat — ${where}, from ${from}. You were mentioned as @${agentName}.]`
    : `[ORCA team chat — your own thread, from ${from}.]`;
  const ctx = context.length ? `\nRecent messages (oldest first):\n${context.join('\n')}\n` : '';
  return `${head}\n${ctx}\n${from} wrote:\n${text}\n\n(Your last reply in this turn is posted back into the chat, up to ${replyMax.toLocaleString('en-US')} characters. Do not use orca-send for it.)`;
}

// The answer to post back: the reply text cut to fit, on a line boundary when possible.
// Agent ↔ agent messages (orca-send, hand-offs) shown in a chat thread: one post in the
// receiver's thread and one in the sender's, as the sending agent. No mentions, never parsed,
// so they can never prompt another agent (no loops). Returns [{ thread, by, text, x }].
const A2A_VIA = new Set(['agent', 'handoff']);
function a2aPosts(m, { fromName, toName, max = TEXT_MAX } = {}) {
  if (!m || !A2A_VIA.has(m.via) || !m.from || !m.to || m.from === m.to) return [];
  const text = cutReply(String(m.text || '').replace(/\r\n/g, '\n').trim(), max);
  if (!text) return [];
  const base = { name: fromName || 'agent', a2a: { from: fromName || 'agent', to: toName || 'agent', via: m.via, msg: m.id } };
  return [
    { thread: 't-' + m.to, by: 'agent:' + m.from, text, x: { ...base, a2a: { ...base.a2a, dir: 'in' } } },
    { thread: 't-' + m.from, by: 'agent:' + m.from, text, x: { ...base, a2a: { ...base.a2a, dir: 'out' } } },
  ].filter(p => THREAD_RE.test(p.thread));
}

function cutReply(text, max = 2000) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const nl = cut.lastIndexOf('\n');
  return (nl > max * 0.6 ? cut.slice(0, nl) : cut).trimEnd() + '…';
}

// "@Ana can you look" → logins whose name follows an @ (case-insensitive, whole word).
function findMentions(text, people) {
  const found = [];
  const lower = String(text || '').toLowerCase();
  for (const p of people) {
    const name = String(p.name || '').toLowerCase();
    if (!name) continue;
    const re = new RegExp('(^|[^\\p{L}\\p{N}_])@' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'u');
    if (re.test(lower)) found.push(p.login);
  }
  return found;
}

module.exports = { createChat, findMentions, buildPrompt, cutReply, a2aPosts, THREAD_RE, DELETE_WINDOW };
