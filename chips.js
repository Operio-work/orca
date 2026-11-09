'use strict';
// Reply chips worked out from an agent's last reply on screen: when the agent ends with
// numbered next steps, each becomes a one-tap reply. Used for every agent kind; an optional
// Claude hook may instead write exact options to ~/.claude/orca/<session>.json.
const MAX_STEPS = 5;
const clip = (t, n) => (t.length <= n ? t : t.slice(0, n - 1) + '…');
const plain = s => s.replace(/\*\*|__|`/g, '').trim();

const isStep = item => {
  const t = plain(item);
  if (t.length < 12) return false;
  if (/^[`$]|^(cd|git|npm|pnpm|pm2|sudo|curl|ssh|ls|cat)\s/.test(item.trim())) return false;
  return /[a-zA-Z]{3,}\s+[a-zA-Z]{2,}/.test(t);
};

function stepsOf(lines) {
  const lists = [];
  let cur = [];
  for (const line of lines) {
    const m = /^\s*(?:\*\*)?(?:step\s*)?(\d{1,2})[.):]\*{0,2}\s+(.+)$/i.exec(line);
    if (!m) continue;
    const n = Number(m[1]);
    if (n === 1) { if (cur.length) lists.push(cur); cur = []; }
    if (n === cur.length + 1) cur.push(plain(m[2]));
  }
  if (cur.length) lists.push(cur);
  const last = [...lists].reverse().find(l => l.length >= 2);
  if (!last) return [];
  const steps = last.slice(0, MAX_STEPS);
  return steps.filter(isStep).length * 2 > steps.length ? steps : [];
}

function chipsFor(answer) {
  const lines = answer.split('\n');
  const tail = lines.map(plain).filter(Boolean).slice(-3);
  const asks = tail.some(l => /\?\s*["”)]?\s*$/.test(l));
  // Waiting for a go-ahead: the word it asked for ('say "deploy"' → Deploy), else "Go ahead".
  const said = /\b(?:say|reply|type|send)\s+["“']([^"”'\n]{1,24})["”']/i.exec(answer);
  const go = said ? { key: 'go', label: said[1].trim().replace(/^./, c => c.toUpperCase()), text: said[1].trim(), isPrimary: true }
    : /\bready to (start|build|deploy|go|merge)\b|\bnext step\b|\bwhen you('re| are) ready\b|\bshould I (start|go|proceed)\b/i.test(answer)
      ? { key: 'go', label: 'Go ahead', text: 'Go ahead.', isPrimary: true } : null;
  const act = /\b(your (action|turn|side|step)|on your side|you (need|have) to|please (run|paste|open|click|add|set|merge|approve)|run (this|these|the following)|paste (this|it))\b/i.test(answer);
  const merge = /\b(MR|PR)\s*!?#?\d+|\bmerge request\b|\bpull request\b|\bready to merge\b|\bmerge (it|the MR|the PR)\b/i.test(answer);
  const chips = stepsOf(lines).map((step, i) => ({
    key: `explain-${i + 1}`,
    label: `Explain ${i + 1} · ${clip(step.replace(/[:.]+$/, ''), 22)}`,
    text: `Explain step ${i + 1} ("${clip(step, 90)}") in plain words: what it does, why, and exactly what I need to do.`,
  }));
  if (asks) chips.push({ key: 'yes', label: 'Yes', text: 'Yes.', isPrimary: true }, { key: 'no', label: 'No', text: 'No.' });
  else if (go) chips.push(go);
  if (act) chips.push({ key: 'done', label: 'Done', text: 'Done on my side.' });
  if (merge) chips.push({ key: 'merged', label: 'Merged', text: 'Merged. Deploy it and verify it is live.', isRisky: true });
  chips.push({ key: 'wrap', label: 'Wrap up', text: '/wrap-up:wrap' });
  return chips;
}

// The agent's last reply, read off the terminal: from its last prose "●" line (not a tool
// call, not a hook notice) to the turn's end marker ("✻ … done", recap, status bar).
const NOISE = /hook was skipped|^Compacted |sent the event on past it|^\w[\w.-]*\(/;
function lastReply(text) {
  const lines = String(text || '').split('\n');
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^[●•]\s+(.*)$/.exec(lines[i]);
    if (m && !NOISE.test(m[1])) { start = i; break; }
    if (/^[❯›]\s+[^/\s]/.test(lines[i])) break; // a newer prompt: no reply after it yet (a /command doesn't count)
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (i > start && (/^(✻|※|●|•|❯|›|ctx |─{3})/.test(l) || /^\s*\/remote-control/.test(l))) break;
    out.push(i === start ? l.replace(/^[●•]\s+/, '') : l.replace(/^ {2}/, ''));
  }
  return out.join('\n').trim();
}

module.exports = { chipsFor, lastReply, stepsOf };
