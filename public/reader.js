// Reader view: turns the terminal mirror of an agent into something you can read.
// Your messages become bubbles, the agent's replies become prose (wrapped lines joined back,
// lists and tables laid out), tool work folds into one line, CLI chrome is dropped.
// Pure functions: parse(text) -> blocks, render(blocks, doc, open) -> fragment. Unknown
// shapes fall back to plain paragraphs, so a new agent kind still reads, just less polished.
(function (root) {
  'use strict';

  // Lines that are the CLI's own furniture, never content.
  const CHROME = [
    /^\s*[─━═]{8,}\s*$/, /^\s*[❯›>]\s*$/, /^\s*⚠ /, /^\s*⏵⏵/, /^\s*ctx [█░]/, /✔ Update installed/,
    /^\s*\[-\]\s*$/, /^\s*[▐▝▘▛▜▟▙]/, /^\s*☤ .*│/, /^\s*\? for shortcuts/, /^\s*esc to interrupt/,
  ];
  // Claude Code's folded tool summary: "Read 1 file, ran 2 shell commands, searched memories".
  const SUMMARY_RE = /^(Read|Ran|Called|Searched|Listed|Edited|Wrote|Created|Updated|Fetched|Loaded|Used|Reading|Running|Searching|Calling|Writing|Editing|Listing|Fetching|Updating|Creating)\b/;
  const isSummary = s => SUMMARY_RE.test(s) && s.length < 160 && !/[.!?]$/.test(s) && /\d|memor|files?\b|commands?\b/.test(s);
  // "● Bash(…)", "● mcp__x__y(…)", "● Agent "…" finished", "● Task "…" still running"
  const isToolCall = s => /^[\w.:-]+\(/.test(s) || /^(Agent|Task|Skill|Background) ["“]/.test(s) || /^[\w-]+: its [\w.]+ hook/.test(s);

  // A line that starts a new block (agent reply, your message, tool line, Hermes box).
  const MARK_RE = /^(?:[●⏺❯›✻※] |\s*[⎿┊]|\s*╭─)/;
  const indentOf = s => s.match(/^ */)[0].length;
  const blank = s => !s.trim();

  function parse(text) {
    let src = String(text || '').replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, ''));
    // The CLI's input box (a rule line, the draft you are typing, a rule line) is not a message.
    const rules = []; src.forEach((l, k) => { if (/^[─━]{20,}$/.test(l)) rules.push(k); });
    if (rules.length >= 2) {
      const [a, b] = rules.slice(-2);
      if (b - a <= 12 && src.length - b <= 12) src = src.slice(0, a).concat(src.slice(b + 1));
    }
    const lines = src.filter(l => !CHROME.some(re => re.test(l)));
    // Wrap width: the longest content line (borders excluded) is where the terminal cut lines.
    let W = 0;
    for (const l of lines) if (!/[─━]{6,}/.test(l)) W = Math.max(W, l.length);
    const blocks = [];
    const push = b => {
      const last = blocks[blocks.length - 1];
      if (b.t === 'tools' && last?.t === 'tools') { last.items.push(...b.items); last.sums.push(...b.sums); return; }
      if (b.t === 'say' && b.plain && last?.t === 'say' && last.plain) { last.lines.push('', ...b.lines); return; }
      blocks.push(b);
    };

    // Indented continuation of a block that started at column 0. Stops at the next column-0
    // line, and before a lone summary paragraph ("  Ran 3 shell commands") that follows a blank.
    function cont(i) {
      const out = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!blank(l) && indentOf(l) === 0) break;
        if (blank(l)) {
          let j = i + 1; while (j < lines.length && blank(lines[j])) j++;
          const nx = lines[j];
          if (nx != null && indentOf(nx) > 0 && isSummary(nx.trim()) && (j + 1 >= lines.length || blank(lines[j + 1]) || indentOf(lines[j + 1]) === 0)) break;
          if (nx != null && /^\s*⎿/.test(nx)) break;
        }
        out.push(l); i++;
      }
      while (out.length && blank(out[out.length - 1])) out.pop();
      return { out, i };
    }

    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      const s = l.trim();
      if (!s) { i++; continue; }
      const ind = indentOf(l);

      // A draft still in the CLI's input box ("❯" + no-break space): not sent, not shown.
      if (/^❯\u00a0/.test(l)) { i = cont(i + 1).i; continue; }
      // A question menu ("❯ 1. Option" is the highlighted choice): the agent's words, not yours.
      if (ind === 0 && /^❯ \d+\. /.test(l)) {
        const c = cont(i + 1);
        push({ t: 'say', plain: true, lines: ['  ' + l.slice(2), ...c.out], W });
        i = c.i; continue;
      }
      // Your message
      if (ind === 0 && /^❯ /.test(l)) {
        const c = cont(i + 1);
        push({ t: 'you', lines: ['  ' + l.slice(2), ...c.out], W });
        i = c.i; continue;
      }
      // Agent line: a reply, or a tool call
      if (ind === 0 && /^[●⏺] /.test(l)) {
        const body = l.slice(2);
        const c = cont(i + 1);
        if (isToolCall(body)) push({ t: 'tools', items: [body, ...c.out.map(x => x.replace(/^ {2}/, ''))], sums: [] });
        else push({ t: 'say', lines: ['  ' + body, ...c.out], W });
        i = c.i; continue;
      }
      // Notes from the CLI ("› Message from @agent", "✻ Worked for 2m")
      if (ind === 0 && /^[›✻※]\s/.test(l)) {
        const c = cont(i + 1);
        if (/^›/.test(l)) push({ t: 'note', text: s.replace(/^›\s*/, '').replace(/\s*\(ctrl\+o to expand\)/, '') });
        i = c.i; continue;
      }
      // Hermes: ╭─ ☤ Hermes ─╮ box … ╰─╯ (the borders wrap onto a second line)
      if (/^╭─/.test(s)) {
        i++;
        if (i < lines.length && /^[─━]+╮$/.test(lines[i].trim())) i++;
        const body = [];
        while (i < lines.length && !/^╰/.test(lines[i].trim())) body.push('  ' + lines[i++]);
        i++;
        if (i < lines.length && /^[─━]+╯$/.test(lines[i].trim())) i++;
        push({ t: 'say', lines: body, W: W + 2, cw: true });
        continue;
      }
      // Tool work: Claude summaries and results, Hermes ┊ lines
      if ((ind > 0 && isSummary(s)) || /^⎿/.test(s) || /^┊/.test(s)) {
        const items = [];
        const sums = [];
        while (i < lines.length) {
          const x = lines[i], xs = x.trim();
          if (!xs) { i++; continue; }
          if (indentOf(x) > 0 && isSummary(xs)) { sums.push(xs); items.push(xs); i++; continue; }
          if (/^[⎿┊]/.test(xs)) {
            items.push(xs.replace(/^[⎿┊]\s*/, ''));
            i++;
            // The tool's own output runs on until a blank line or the next marker; a line the
            // terminal cut at full width is glued back without a break.
            while (i < lines.length && !blank(lines[i]) && !MARK_RE.test(lines[i])) {
              const glue = lines[i - 1].length >= W - 1;
              items[items.length - 1] += (glue ? '' : '\n') + (glue ? lines[i].trim() : lines[i]);
              i++;
            }
            continue;
          }
          break;
        }
        push({ t: 'tools', items, sums });
        continue;
      }
      // Anything else: plain text, kept as paragraphs
      const body = [];
      while (i < lines.length) {
        const x = lines[i];
        if (!blank(x) && MARK_RE.test(x)) break;
        if (!blank(x) && indentOf(x) > 0 && (isSummary(x.trim()) || /^\s*⎿/.test(x))) break;
        body.push('  ' + x); i++;
      }
      while (body.length && blank(body[body.length - 1])) body.pop();
      if (body.length) push({ t: 'say', lines: body, W: W + 2, plain: true });
      else i++;
    }
    return blocks;
  }

  // ─── Text layout: rejoin wrapped lines, find lists, tables and headings ───
  const LIST_RE = /^(\s*)([-•*◦▪]|\d{1,3}[.)])\s+(.*)$/;
  const TABLE_RE = /[│┃┌┐└┘├┤┬┴┼║╔╗╚╝╠╣]|\S {3,}\S/;

  // lines carry a 2-space base indent; W is the column the terminal wrapped at.
  function layout(lines, W, cw = false) {
    const els = []; // { k: 'p'|'li'|'pre', text|lines, level, mark, ci }
    let cur = null;
    let prevRaw = '';
    const wrapped = (prev, next) => {
      if (!prev) return false;
      const word = next.trim().split(/\s+/)[0] || '';
      return prev.length >= W - 1 || prev.length + 1 + word.length > W - 2;
    };
    for (const raw of lines) {
      const l = raw.replace(/^ {2}/, '');
      if (blank(l)) { cur = null; prevRaw = ''; continue; }
      if (TABLE_RE.test(l) && !LIST_RE.test(l)) {
        if (cur?.k === 'pre') cur.lines.push(l); else { cur = { k: 'pre', lines: [l] }; els.push(cur); }
        prevRaw = raw; continue;
      }
      const li = l.match(LIST_RE);
      if (li) {
        const ind = li[1].length;
        cur = { k: 'li', mark: li[2], text: li[3], level: Math.min(4, Math.floor(ind / 2)), ci: ind + li[2].length + 1 };
        els.push(cur); prevRaw = raw; continue;
      }
      const ind = indentOf(l);
      if (cur && cur.k !== 'pre') {
        const charWrap = cw && prevRaw.length >= W - 1;
        if (wrapped(prevRaw, raw)) { cur.text += (charWrap && !/\s$/.test(prevRaw) ? '' : ' ') + l.trim(); prevRaw = raw; continue; }
        if (cur.k === 'li' && ind >= cur.ci) { cur.text += '\n' + l.trim(); prevRaw = raw; continue; }
        if (cur.k === 'p') { cur.text += '\n' + l.trim(); prevRaw = raw; continue; }
      }
      cur = { k: 'p', text: l.trim() };
      els.push(cur); prevRaw = raw;
    }
    // A short line with no closing punctuation, right before a list, reads as a heading.
    for (let k = 0; k < els.length - 1; k++) {
      const e = els[k];
      if (e.k === 'p' && !e.text.includes('\n') && e.text.length < 80 && !/[.!?,;]$/.test(e.text) && /\p{L}{2}/u.test(e.text) && els[k + 1].k === 'li') e.k = 'h';
    }
    return els;
  }

  // ─── DOM ───
  const URL_RE = /(https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]])|((?:~|\/home|\/etc|\/tmp|\/var|\/opt|\/usr)\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]])/g;
  function inline(doc, parent, text) {
    const parts = String(text).split('\n');
    parts.forEach((part, n) => {
      if (n) parent.appendChild(doc.createElement('br'));
      let at = 0;
      for (const m of part.matchAll(URL_RE)) {
        if (m.index > at) parent.appendChild(doc.createTextNode(part.slice(at, m.index)));
        if (m[1]) {
          const a = doc.createElement('a');
          a.href = m[1]; a.textContent = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer';
          parent.appendChild(a);
        } else {
          const c = doc.createElement('code');
          c.className = 'rp'; c.textContent = m[2]; c.dataset.copy = m[2]; c.tabIndex = 0; c.setAttribute('role', 'button');
          parent.appendChild(c);
        }
        at = m.index + m[0].length;
      }
      if (at < part.length) parent.appendChild(doc.createTextNode(part.slice(at)));
    });
  }

  function body(doc, parent, lines, W, cw) {
    for (const e of layout(lines, W, cw)) {
      if (e.k === 'pre') { const p = doc.createElement('pre'); p.className = 'rtab'; p.textContent = e.lines.join('\n'); parent.appendChild(p); continue; }
      if (e.k === 'li') {
        const d = doc.createElement('div'); d.className = 'rli'; d.style.setProperty('--lv', e.level);
        const m = doc.createElement('span'); m.className = 'rmk'; m.textContent = /^\d/.test(e.mark) ? e.mark : '•';
        const t = doc.createElement('span'); inline(doc, t, e.text);
        d.append(m, t); parent.appendChild(d); continue;
      }
      const p = doc.createElement('p'); if (e.k === 'h') p.className = 'rh';
      inline(doc, p, e.text); parent.appendChild(p);
    }
  }

  function toolLabel(b, t) {
    if (b.sums.length) return b.sums.join(' · ');
    const names = new Map();
    for (const it of b.items) { const m = it.match(/^([\w.:-]+)\(/) || it.match(/^(Agent|Task|Skill) /); if (m) { const n = m[1].replace(/^mcp__\w+?__/, ''); names.set(n, (names.get(n) || 0) + 1); } }
    if (names.size) return [...names].map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(' · ');
    return t('rdSteps', b.items.length);
  }

  // open: Set of tool-group keys the reader had open, kept across refreshes.
  function render(blocks, doc, open, t) {
    const frag = doc.createDocumentFragment();
    blocks.forEach((b, n) => {
      if (b.t === 'you') {
        const d = doc.createElement('div'); d.className = 'ryou';
        const lab = doc.createElement('span'); lab.className = 'rwho'; lab.textContent = t('rdYou');
        d.appendChild(lab); body(doc, d, b.lines, b.W); frag.appendChild(d);
      } else if (b.t === 'say') {
        const d = doc.createElement('div'); d.className = 'rsay' + (b.plain ? ' plain' : '');
        body(doc, d, b.lines, b.W, b.cw); frag.appendChild(d);
      } else if (b.t === 'note') {
        const d = doc.createElement('p'); d.className = 'rnote'; d.textContent = b.text; frag.appendChild(d);
      } else if (b.t === 'tools' && b.items.length === b.sums.length) {
        // Only Claude's own summary ("Ran 3 shell commands"): nothing more to open.
        const d = doc.createElement('p'); d.className = 'rtool flat'; d.textContent = b.sums.join(' · '); frag.appendChild(d);
      } else if (b.t === 'tools') {
        const key = n + ':' + (b.items[0] || '').slice(0, 40);
        const det = doc.createElement('details'); det.className = 'rtool'; det.dataset.key = key;
        if (open?.has(key)) det.open = true;
        const sum = doc.createElement('summary'); sum.textContent = toolLabel(b, t);
        const pre = doc.createElement('pre'); pre.textContent = b.items.join('\n');
        det.append(sum, pre); frag.appendChild(det);
      }
    });
    return frag;
  }

  // ── Transcript blocks (Claude agents): the reply text is markdown, exactly as written. ──
  // Inline: `code`, **bold**, [label](url); the rest goes through inline() (links, copyable paths).
  function inlineMd(doc, parent, text) {
    const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let at = 0;
    for (const m of String(text).matchAll(re)) {
      if (m.index > at) inline(doc, parent, text.slice(at, m.index));
      if (m[1] != null) {
        const c = doc.createElement('code');
        if (/^(~|\/)[\w./-]+$/.test(m[1])) { c.className = 'rp'; c.dataset.copy = m[1]; c.tabIndex = 0; c.setAttribute('role', 'button'); }
        c.textContent = m[1]; parent.appendChild(c);
      } else if (m[2] != null) { const b = doc.createElement('b'); inline(doc, b, m[2]); parent.appendChild(b); }
      else { const a = doc.createElement('a'); a.href = m[4]; a.textContent = m[3]; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.appendChild(a); }
      at = m.index + m[0].length;
    }
    if (at < text.length) inline(doc, parent, text.slice(at));
  }
  function md(doc, parent, text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      const fence = l.match(/^\s*(```|~~~)/);
      if (fence) {
        const buf = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence[1])) buf.push(lines[i++]);
        i++;
        const pre = doc.createElement('pre'); pre.className = 'rcode'; pre.textContent = buf.join('\n'); parent.appendChild(pre); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l)) {
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const wrap = doc.createElement('div'); wrap.className = 'rtable';
        const table = doc.createElement('table');
        rows.forEach((r, k) => {
          if (/^\s*\|?[\s:|-]+\|?\s*$/.test(r) && r.includes('-')) return; // the |---| line
          const tr = doc.createElement('tr');
          for (const c of cells(r)) { const td = doc.createElement(k === 0 ? 'th' : 'td'); inlineMd(doc, td, c); tr.appendChild(td); }
          table.appendChild(tr);
        });
        wrap.appendChild(table); parent.appendChild(wrap); continue;
      }
      const h = l.match(/^\s*#{1,6}\s+(.*)$/);
      if (h) { const p = doc.createElement('p'); p.className = 'rh'; inlineMd(doc, p, h[1].replace(/\s*#+\s*$/, '')); parent.appendChild(p); i++; continue; }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(l)) { parent.appendChild(doc.createElement('hr')); i++; continue; }
      const li = l.match(/^(\s*)([-*•]|\d{1,3}[.)])\s+(.*)$/);
      if (li) {
        let text = li[3]; i++;
        // Continuation lines of the same item (indented, not a new item).
        while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d{1,3}[.)])\s+/.test(lines[i])) text += ' ' + lines[i++].trim();
        const d = doc.createElement('div'); d.className = 'rli'; d.style.setProperty('--lv', Math.min(3, Math.floor(li[1].length / 2)));
        const mk = doc.createElement('span'); mk.className = 'rmk'; mk.textContent = /^\d/.test(li[2]) ? li[2] : '•';
        const tx = doc.createElement('span'); inlineMd(doc, tx, text.replace(/^\[( |x)\]\s*/i, (m0, x) => (x.trim() ? '☑ ' : '☐ ')));
        d.append(mk, tx); parent.appendChild(d); continue;
      }
      if (/^\s*>/.test(l)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        const q = doc.createElement('blockquote'); q.className = 'rquote'; md(doc, q, buf.join('\n')); parent.appendChild(q); continue;
      }
      // Paragraph: consecutive plain lines (a hard break inside keeps its line).
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|\||#{1,6}\s|>|([-*•]|\d{1,3}[.)])\s+)/.test(lines[i])) buf.push(lines[i++].trim());
      if (!buf.length) { buf.push(lines[i++].trim()); }
      const p = doc.createElement('p'); inlineMd(doc, p, buf.join('\n')); parent.appendChild(p);
    }
  }

  function renderTranscript(blocks, doc, open, t) {
    const frag = doc.createDocumentFragment();
    blocks.forEach((b, n) => {
      if (b.t === 'you') {
        const d = doc.createElement('div'); d.className = 'ryou';
        const lab = doc.createElement('span'); lab.className = 'rwho'; lab.textContent = t('rdYou');
        d.appendChild(lab);
        const body = doc.createElement('div'); body.className = 'rtext'; md(doc, body, b.text); d.appendChild(body);
        frag.appendChild(d);
      } else if (b.t === 'say') {
        const d = doc.createElement('div'); d.className = 'rsay'; md(doc, d, b.text); frag.appendChild(d);
      } else if (b.t === 'tools') {
        const key = 't' + (b.n ?? n) + ':' + (b.items[0]?.name || '');
        const det = doc.createElement('details'); det.className = 'rtool'; det.dataset.key = key;
        if (open?.has(key)) det.open = true;
        const names = new Map();
        for (const it of b.items) names.set(it.name, (names.get(it.name) || 0) + 1);
        const sum = doc.createElement('summary');
        const fails = b.items.filter(it => it.err).length;
        sum.textContent = [...names].map(([nm, c]) => c > 1 ? `${nm} ×${c}` : nm).join(' · ') + (fails ? ' · ' + t('rdFailed', fails) : '');
        const ul = doc.createElement('ol'); ul.className = 'rsteps';
        for (const it of b.items) {
          const li = doc.createElement('li');
          if (it.err) li.className = 'rerr';
          const nm = doc.createElement('b'); nm.textContent = it.name;
          li.appendChild(nm);
          if (it.what) li.appendChild(doc.createTextNode(' ' + it.what));
          ul.appendChild(li);
        }
        det.append(sum, ul); frag.appendChild(det);
      } else if (b.t === 'note') {
        const d = doc.createElement('div'); d.className = 'rnote'; d.textContent = t('rdCompacted'); frag.appendChild(d);
      } else if (b.t === 'ask') {
        const d = doc.createElement('div'); d.className = 'rask';
        for (const q of b.questions || []) {
          const p = doc.createElement('p'); p.className = 'rask-q'; p.textContent = q.permission ? t('rdPermission') : q.question; d.appendChild(p);
          const ol = doc.createElement('ol');
          for (const o of q.options || []) { const li = doc.createElement('li'); const b2 = doc.createElement('b'); b2.textContent = o.label; li.appendChild(b2); if (o.description) li.appendChild(doc.createTextNode(' — ' + o.description)); ol.appendChild(li); }
          d.appendChild(ol);
        }
        const hint = doc.createElement('p'); hint.className = 'rask-hint'; hint.textContent = t('rdAnswerBelow'); d.appendChild(hint);
        frag.appendChild(d);
      }
    });
    return frag;
  }

  const api = { parse, layout, render, renderTranscript, md };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrcaReader = api;
})(this);
