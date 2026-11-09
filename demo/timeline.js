'use strict';

// The demo's scripted agents: a pure function of (demo state, now). Nothing runs in the
// background; every `herdr` call the panel makes is answered by working out where each
// agent's script is at that moment. The only things stored are the start time, the speed,
// the active client, what the viewer typed or pressed, and the agents the viewer started.
//
// State ($FREE_ORCA_DEMO_DIR/herdr-state.json):
//   { epoch, speed, client, lang, inputs: { <pane>: [{ at, kind: 'key'|'text', value }] },
//     dyn: [{ pane, tab, client, name, kind, cwd, created, prompts: [{ at, text }] }], nextDyn }

const fs = require('fs');
const path = require('path');
const { CLIENTS, forLang, normLang } = require('./clients');

const STATE_NAME = 'herdr-state.json';
const MAX_CYCLES = 20000;

function freshState({ speed = 1, client = CLIENTS[0].id, lang = 'en', now = Date.now() } = {}) {
  return { epoch: now, speed, client, lang: normLang(lang), inputs: {}, dyn: [], nextDyn: 1 };
}
// The words for this state's language (`--lang`; English when unset).
const L = st => forLang(st && st.lang);

function stateFile(dir) { return path.join(dir, STATE_NAME); }
function loadState(dir) {
  try { return JSON.parse(fs.readFileSync(stateFile(dir), 'utf8')); } catch { return freshState(); }
}
function saveState(dir, st) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${stateFile(dir)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(st, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, stateFile(dir));
}

const clientById = (id, lang) => { const cs = forLang(lang).CLIENTS; return cs.find(c => c.id === id) || cs[0]; };
const clientOfPane = (pane, lang) => forLang(lang).CLIENTS.find(c => pane.startsWith(c.ws + ':'));
const lastSec = lines => (lines.length ? lines[lines.length - 1][0] : 0);
// A script line that follows the previous one within 0.15 s and starts with two spaces is the
// rest of the same sentence: join them, so the panel wraps the text to the screen (phones).
function flow(rows) {
  const out = [];
  for (const [s, text] of rows) {
    const prev = out[out.length - 1];
    if (prev && s - prev[0] <= 0.15 && /^  [^ ⎿└✓★]/.test(text)) prev[1] += ' ' + text.trim();
    else out.push([s, text]);
  }
  return out;
}

// ── One scripted agent ────────────────────────────────────────────────────────
// Returns { status, lines: [{ at, text }], seq, cycle }.
function scriptedView(a, st, now) {
  const U = L(st).UI;
  const speed = st.speed > 0 ? st.speed : 1;
  const ms = s => (s * 1000) / speed;
  const inputs = (st.inputs[a.pane] || []).slice().sort((x, y) => x.at - y.at);
  const notesIn = (from, to) => inputs.filter(i => i.kind === 'text' && i.at >= from && i.at < to)
    .flatMap(i => [{ at: i.at, text: `❯ ${i.value}` }, { at: i.at + ms(1.2), text: U.noted }]);
  const at = (base, rows) => rows.map(([s, text]) => ({ at: base + ms(s), text }));
  const spinner = (from, label) => ({ at: now, text: `✻ ${label}… (${Math.max(0, Math.round((now - from) / 1000))}s · ${U.interrupt})` });
  const visible = rows => rows.filter(r => r.at <= now).sort((x, y) => x.at - y.at);

  let start = st.epoch + ms(a.delay || 0);
  let prev = [];
  for (let k = 0; k < MAX_CYCLES; k++) {
    const head = prev.length ? [...prev, { at: start - 1, text: '' }] : [];
    if (now < start) {
      if (k === 0) return { status: 'idle', lines: [{ at: now, text: `  ${a.title} · ${U.ready}` }], seq: 0, cycle: 0 };
      return { status: 'done', lines: prev, seq: k * 5, cycle: k - 1 };
    }
    const work = flow(a.work);
    const task = [{ at: start, text: `❯ ${a.task}` }, ...at(start, work)];
    const blockedAt = start + ms(lastSec(work) + 1.2);
    if (now < blockedAt) {
      return { status: 'working', lines: [...head, ...visible([...task, ...notesIn(start, now + 1)]), spinner(start, a.spin)], seq: k * 5 + 1, cycle: k };
    }
    const nOpts = a.ask.options.length;
    let ans = inputs.find(i => i.at >= blockedAt && (i.kind === 'text' || (i.kind === 'key' && /^[1-9]$/.test(i.value) && Number(i.value) <= nOpts)));
    if (a.auto) {
      const autoAt = blockedAt + ms(a.auto);
      if ((!ans || ans.at > autoAt) && autoAt <= now) ans = { at: autoAt, kind: 'key', value: '1', auto: true };
    }
    const before = [...task, ...notesIn(start, blockedAt)];
    if (!ans || ans.at > now) {
      const ask = [
        { at: blockedAt, text: '' },
        { at: blockedAt, text: ` ${a.ask.question}` },
        { at: blockedAt, text: '' },
        ...a.ask.options.map((o, i) => ({ at: blockedAt, text: `${i === 0 ? '❯' : ' '} ${i + 1}. ${o}` })),
        { at: blockedAt, text: `  ${nOpts + 1}. ${U.typeSomething}` },
        { at: blockedAt, text: '' },
        { at: blockedAt, text: U.hint },
      ];
      return { status: 'blocked', lines: [...head, ...visible(before), ...ask], seq: k * 5 + 2, cycle: k };
    }
    const branch = flow(ans.kind === 'key' ? a.after[Number(ans.value)] : a.text(String(ans.value).replace(/\s+/g, ' ').trim().slice(0, 200)));
    const answered = ans.kind === 'key'
      ? { at: ans.at, text: `  ⎿  ${ans.auto ? U.picked : U.chose}: ${ans.value}. ${a.ask.options[Number(ans.value) - 1]}` }
      : { at: ans.at, text: `❯ ${String(ans.value).replace(/\s+/g, ' ').trim().slice(0, 200)}` };
    const doneAt = ans.at + ms(lastSec(branch) + 0.6);
    const next = doneAt + ms(a.hold || 30);
    const full = [...before, { at: blockedAt, text: '' }, { at: blockedAt, text: ` ${a.ask.question}` }, answered, ...at(ans.at, branch)];
    if (now < doneAt) {
      return { status: 'working', lines: [...head, ...visible([...full, ...notesIn(ans.at + 1, now + 1)]), spinner(ans.at, U.workingOnAnswer)], seq: k * 5 + 3, cycle: k };
    }
    const finished = [...full, ...notesIn(ans.at + 1, next)];
    if (now < next) return { status: 'done', lines: [...head, ...visible(finished)], seq: k * 5 + 4, cycle: k };
    prev = finished;
    start = next;
  }
  return { status: 'idle', lines: [], seq: 0, cycle: 0 };
}

// ── Agents the viewer starts (New, or a routine's Run now) ────────────────────
const ROUTINE_RE = /^\[Free-ORCA routine: ([^\]]+)\]/;
const OUT_RE = /write your result as Markdown to this file \(create the folder if needed\): (\S+\.md)/;

function dynTurn(p, speed, U) {
  const ms = s => (s * 1000) / speed;
  const r = p.text.match(ROUTINE_RE);
  if (r) {
    const out = (p.text.match(OUT_RE) || [])[1] || '';
    const shown = out.replace(/^.*\/\.config\//, '~/.config/');
    return {
      rows: [
        [0, `❯ [Free-ORCA ${U.routine}: ${U.routineName(r[1])}] …`],
        [1.2, U.routineRead],
        [2.8, U.routineFiles],
        [4.4, U.routineWriting],
        [6.4, `${U.routineWrote} ${shown}`],
        [7.2, U.routineDone],
      ].map(([s, text]) => ({ at: p.at + ms(s), text })),
      doneAt: p.at + ms(7.8),
      out,
      writeAt: p.at + ms(6.4),
      routine: r[1],
    };
  }
  const text = p.text.replace(/\s+/g, ' ').trim().slice(0, 200);
  return {
    rows: [
      { at: p.at, text: `❯ ${text}` },
      { at: p.at + ms(1.5), text: U.dynScripted },
      { at: p.at + ms(2.2), text: U.dynTry },
    ],
    doneAt: p.at + ms(2.6),
  };
}

function dynView(d, st, now) {
  const U = { ...L(st).UI, routineName: L(st).routineName };
  const speed = st.speed > 0 ? st.speed : 1;
  const prompts = (d.prompts || []).filter(p => p.at <= now);
  if (!d.kind) return { status: 'unknown', lines: [], seq: 0 };
  if (d.kind === 'shell') return { status: 'unknown', lines: [{ at: now, text: '$ ' }], seq: 0 };
  if (!prompts.length) return { status: 'idle', lines: [{ at: now, text: `  ${d.name} · ${U.dynReady}` }], seq: 1 };
  const turns = prompts.map(p => dynTurn(p, speed, U));
  const last = turns[turns.length - 1];
  const lines = turns.flatMap(t => t.rows).filter(r => r.at <= now);
  const working = now < last.doneAt;
  if (working) lines.push({ at: now, text: `✻ ${U.working}… (${Math.round((now - prompts[prompts.length - 1].at) / 1000)}s · ${U.interrupt})` });
  return { status: working ? 'working' : 'done', lines, seq: 1 + turns.length * 2 + (working ? 0 : 1), turns };
}

// Routine runs started in the demo get a canned draft once their script reaches "Wrote".
// Only paths inside the demo folder are ever written.
function writeDueOutputs(st, now, root) {
  const base = path.resolve(root) + path.sep;
  for (const d of st.dyn || []) {
    const v = dynView(d, st, now);
    for (const t of v.turns || []) {
      if (!t.out || now < t.writeAt) continue;
      const out = path.resolve(t.out);
      if (!out.startsWith(base) || fs.existsSync(out)) continue;
      const id = path.basename(path.dirname(out));
      const { DRAFTS, UI, routineName } = L(st);
      const text = DRAFTS[`${id}@${d.client}`] || UI.fallbackDraft(routineName(t.routine));
      try { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, text); } catch { /* best effort */ }
    }
  }
}

// ── Everything the panel lists for the active client ──────────────────────────
function agentsFor(st, now, home) {
  const c = clientById(st.client, st.lang);
  const cwd = path.join(home, c.folder);
  const out = c.agents.map((a, i) => {
    const v = scriptedView(a, st, now);
    return {
      def: a, view: v,
      row: {
        pane_id: a.pane, tab_id: a.tab, terminal_id: `${c.ws}-term${i + 1}`, name: a.name, agent: a.kind,
        agent_status: v.status, terminal_title_stripped: a.title, cwd, foreground_cwd: cwd,
        focused: false, agent_session: null, state_change_seq: v.seq,
      },
    };
  });
  for (const d of (st.dyn || []).filter(x => x.client === c.id)) {
    const v = dynView(d, st, now);
    out.push({
      dyn: d, view: v,
      row: {
        pane_id: d.pane, tab_id: d.tab, terminal_id: `${d.pane.replace(':', '-')}-term`, name: d.name || null,
        agent: d.kind === 'shell' ? null : d.kind || null, agent_status: v.status, terminal_title_stripped: d.name || '',
        cwd: d.cwd, foreground_cwd: d.cwd, focused: false, agent_session: null, state_change_seq: v.seq,
      },
    });
  }
  return out;
}

function tabsFor(st) {
  const c = clientById(st.client, st.lang);
  const tabs = c.tabs.map(t => ({ tab_id: t.id, workspace_id: c.ws, number: t.number, label: t.label }));
  for (const d of (st.dyn || []).filter(x => x.client === c.id)) {
    tabs.push({ tab_id: d.tab, workspace_id: c.ws, number: tabs.length + 1, label: d.name || null });
  }
  return tabs;
}

// Pane rectangles: two panes side by side per scripted tab, one full pane per started agent.
function layoutFor(st, tabId) {
  const area = { x: 0, y: 0, width: 200, height: 50 };
  const c = clientById(st.client, st.lang);
  const scripted = c.agents.filter(a => a.tab === tabId);
  if (scripted.length) {
    const w = Math.floor(area.width / scripted.length);
    return { area, zoomed: false, panes: scripted.map((a, i) => ({ pane_id: a.pane, rect: { x: i * w, y: 0, width: i === scripted.length - 1 ? area.width - i * w : w, height: area.height } })) };
  }
  const d = (st.dyn || []).find(x => x.tab === tabId);
  return d ? { area, zoomed: false, panes: [{ pane_id: d.pane, rect: { ...area } }] } : null;
}

// ── Colour for `--format ansi` ─────────────────────────────────────────────────
const E = '\x1b[';
function colorize(line) {
  if (/^❯ \d\. /.test(line)) return `${E}38;5;208m${line}${E}0m`;
  if (/^❯ /.test(line)) return `${E}1m${line}${E}0m`;
  if (/^[●•] /.test(line)) return `${E}32m${line[0]}${E}0m${line.slice(1)}`;
  if (/^✻ /.test(line)) return `${E}38;5;208m${line}${E}0m`;
  if (/^\s+(⎿|└)/.test(line)) return `${E}2m${line}${E}0m`;
  if (/^\s+✓ /.test(line)) return line.replace('✓', `${E}32m✓${E}0m`);
  if (/^ [A-Z¿].*\?$/.test(line)) return `${E}1m${line}${E}0m`;
  return line;
}
const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '');

module.exports = {
  STATE_NAME, freshState, loadState, saveState, clientById, clientOfPane,
  scriptedView, dynView, writeDueOutputs, agentsFor, tabsFor, layoutFor, colorize, stripAnsi,
};
