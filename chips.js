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
  // Questions near the end. Several, or an either/or one ("A or B?", "Which…?"), can't be answered
  // with Yes/No, and a numbered list of open questions isn't steps to explain.
  const qs = lines.map(plain).filter(Boolean).slice(-15).filter(l => /\?\s*["”)]?\s*$/.test(l));
  const lastQ = qs[qs.length - 1] || '';
  const open = qs.length >= 2 || /\bor\b|\bo\b|^(?:[-*•\d.)\s]*)(which|what|how|when|where|who|why|¿?(cuál|qué|cómo|cuándo|dónde|quién))\b/i.test(lastQ);
  const recommends = /\brecommend(ed|ation)?\b|\brecomend(ado|ación|o)\b/i.test(answer);
  const chips = (qs.length >= 2 ? [] : stepsOf(lines)).map((step, i) => ({
    key: `explain-${i + 1}`,
    label: `Explain ${i + 1} · ${clip(step.replace(/[:.]+$/, ''), 22)}`,
    text: `Explain step ${i + 1} ("${clip(step, 90)}") in plain words: what it does, why, and exactly what I need to do.`,
  }));
  if (asks && open) { if (recommends) chips.push({ key: 'rec', label: 'Go with your picks', text: 'Go with your recommendations for each question.', isPrimary: true }); }
  else if (asks) chips.push({ key: 'yes', label: 'Yes', text: 'Yes.', isPrimary: true }, { key: 'no', label: 'No', text: 'No.' });
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

// The reply to one prompt: from the last line that starts with `head` up to the next prompt line
// (the next message, or the input box — which can hold a suggested prompt in grey, so it must
// never count as "a newer prompt with no reply"). '' when the head isn't there.
function replyAfter(text, head) {
  const lines = String(text || '').split('\n');
  let i = -1;
  for (let j = lines.length - 1; j >= 0; j--) if (/^[❯›]\s+/.test(lines[j]) && lines[j].replace(/^[❯›]\s+/, '').startsWith(head)) { i = j; break; }
  if (i < 0) return '';
  let end = lines.length;
  for (let j = i + 1; j < lines.length; j++) if (/^[❯›](\s|$)/.test(lines[j])) { end = j; break; }
  return lastReply(lines.slice(i, end).join('\n'));
}

// The last reply of a finished turn, ignoring the input box below it (it may hold a suggestion).
function turnReply(text) {
  const lines = String(text || '').split('\n');
  let p = -1, s = -1;
  lines.forEach((l, i) => { if (/^[❯›](\s|$)/.test(l)) p = i; if (/^[●•]\s+\S/.test(l)) s = i; });
  return lastReply((p > s ? lines.slice(0, p) : lines).join('\n'));
}

module.exports = { chipsFor, lastReply, replyAfter, turnReply, stepsOf };
