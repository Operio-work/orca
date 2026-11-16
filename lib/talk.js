'use strict';
// For the map: who has been talking to whom (agent messages and hand-offs), by pane pair.
// Counts and times only — message text stays behind /api/agents/:pane/messages (requireActOn).

const TALK_VIA = new Set(['agent', 'handoff']);

// msgs: [{ from, to, at, via, state }] by terminal; byTerminal: terminal -> { pane }.
// Returns [{ a, b, n, queued, lastAt, lastFrom, lastTo }] with a < b (pane ids).
function talkView(msgs, byTerminal, since) {
  const pairs = new Map();
  for (const m of msgs) {
    if (!TALK_VIA.has(m.via) || m.at < since) continue;
    const A = byTerminal.get(m.from), B = byTerminal.get(m.to);
    if (!A || !B || A.pane === B.pane) continue;
    const [a, b] = [A.pane, B.pane].sort();
    const key = a + '|' + b;
    let p = pairs.get(key);
    if (!p) pairs.set(key, (p = { a, b, n: 0, queued: 0, lastAt: 0, lastFrom: null, lastTo: null }));
    p.n++;
    if (m.state === 'queued') p.queued++;
    if (m.at >= p.lastAt) { p.lastAt = m.at; p.lastFrom = A.pane; p.lastTo = B.pane; }
  }
  return [...pairs.values()];
}

module.exports = { talkView };
