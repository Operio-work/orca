'use strict';

// ORCA team chat — the drawer for one thread: an agent's comments ("t-<terminal>") or the team
// room ("room"). Loaded after app.js and uses its globals ($, call, post, t, enc, agents, byPane,
// people, me, chatCounts, label, placeName, select, whoColor, toast).
// Open thread: polls ?after= every 2 s while visible; marks read while you look at it.

(() => {
  const box = $('#chat');
  const listEl = $('#chat-list');
  const textEl = $('#chat-text');
  const pickEl = $('#chat-pick');
  const emptyEl = $('#chat-empty');
  const endedEl = $('#chat-ended');
  const formEl = $('#chat-form');
  const POLL = 2000;

  let thread = null;      // { id, kind, live, pane, name }
  let msgs = new Map();   // id -> message
  let cursor = 0;         // newest at/delete time seen
  let timer = null;
  let loading = false;
  let readAt = 0;
  let asks = [];          // @agent requests in this thread: { msg, name, state, reason, pos, mine }
  let asksKey = '';
  // Translation into the page language (paid ORCA): id -> { state: 'busy'|'done'|'failed', text, show }.
  const trans = new Map();
  let autoTr = safeGet('orca-chat-autotr') === '1';
  const canTranslate = () => !!chatCounts.translate;
  const needsTr = m => canTranslate() && !m.mine && !m.deleted && !!m.lang && m.lang !== lang && !!m.text;

  const agentOfThread = id => (id && id.startsWith('t-') ? agents.find(a => 't-' + a.terminal === id) : null);
  const threadOfPane = pane => { const a = byPane.get(pane); return a?.terminal ? 't-' + a.terminal : null; };
  // Agents you can @: named ones (a person's name wins a clash, as on the server).
  function agentTargets() {
    const taken = new Set(people.map(p => (p.name || '').toLowerCase()));
    return agents.filter(a => a.name && a.terminal && !taken.has(a.name.toLowerCase()));
  }

  // ── Badges: header (room), agent panel (selected agent). Tiles read chatCounts in app.js.
  function badge(el, n, mention) {
    el.hidden = !n;
    el.textContent = n > 9 ? '9+' : String(n);
    el.classList.toggle('mention', !!mention);
  }
  // Chat is part of ORCA Host: the server sends no `chat` (room = null) when it is off.
  const chatOn = () => !!chatCounts.room;
  function update() {
    const room = chatCounts.room;
    $('#chat-btn').hidden = !room;
    $('#sheet-chat').hidden = !room;
    if (!room && !box.hidden) close();
    badge($('#chat-badge'), thread?.id === 'room' && !box.hidden ? 0 : room?.unread || 0, room?.mention);
    const sc = chatCounts.byPane?.[selected];
    const open = !box.hidden && thread && thread.id === threadOfPane(selected);
    badge($('#sheet-chat-badge'), open ? 0 : sc?.unread || 0, sc?.mention);
    if (!box.hidden && thread) renderHead();
  }

  // ── Open / close
  function open(id) {
    if (!id || !chatOn()) return;
    if (thread?.id !== id) { msgs = new Map(); cursor = 0; readAt = 0; asks = []; asksKey = ''; trans.clear(); listEl.textContent = ''; }
    const a = agentOfThread(id);
    thread = { id, kind: id === 'room' ? 'room' : 'agent', live: id === 'room' || !!a, pane: a?.pane || null, name: a?.name || null };
    box.hidden = false;
    setInert(true);
    requestAnimationFrame(() => box.classList.add('in'));
    if (location.hash.slice(1) !== 'chat-' + id) history.replaceState(history.state, '', '#chat-' + enc(id));
    renderHead();
    renderFollow();
    load(true);
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) load(); }, POLL);
    if (!matchMedia('(pointer: coarse)').matches && !formEl.hidden) textEl.focus(); else box.focus();
    update();
  }
  function close() {
    box.classList.remove('in');
    box.hidden = true;
    setInert(false);
    clearInterval(timer); timer = null;
    pickEl.hidden = true;
    if (location.hash.startsWith('#chat-')) history.replaceState(history.state, '', selected ? '#' + enc(selected) : location.pathname);
    thread = null;
    update();
  }

  function renderHead() {
    const a = agentOfThread(thread.id);
    if (thread.kind === 'room') {
      $('#chat-title').textContent = t('chatTeamTitle');
      $('#chat-sub').textContent = t('chatRoomSub');
    } else {
      const name = a ? label(a) : thread.name || t('unnamed');
      $('#chat-title').textContent = name;
      $('#chat-sub').textContent = a ? t('chatAgentSub', placeName(a.tab)) : '';
    }
    $('#chat-mark').classList.toggle('room', thread.kind === 'room');
    const trBtn = $('#chat-tr');
    trBtn.hidden = !canTranslate();
    trBtn.setAttribute('aria-pressed', String(autoTr));
    trBtn.classList.toggle('on', autoTr);
    $('#chat-tr-label').textContent = t('chatAutoTr');
    trBtn.title = t(autoTr ? 'chatAutoTrOn' : 'chatAutoTrOff');
    const agentBtn = $('#chat-agent');
    agentBtn.hidden = !a;
    endedEl.hidden = thread.kind === 'room' || !!a;
    formEl.hidden = !endedEl.hidden;
  }

  // ── Follow / mute (push alerts for this thread)
  function renderFollow() {
    const b = $('#chat-follow');
    const on = !!thread?.following;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
    const tip = t(thread?.kind === 'room' ? (on ? 'chatRoomOn' : 'chatRoomOff') : (on ? 'chatFollowOn' : 'chatFollowOff'));
    b.title = tip; b.setAttribute('aria-label', tip);
  }
  $('#chat-follow').addEventListener('click', async () => {
    if (!thread) return;
    const on = !thread.following;
    try {
      await post(`/api/chat/${enc(thread.id)}/follow`, { on });
      thread.following = on;
      renderFollow();
      const noPush = !('Notification' in window) || Notification.permission !== 'granted';
      toast(on && noPush ? t('chatNeedBell') : t(on ? 'chatNowOn' : 'chatNowOff'));
    } catch (e) { toast(e.message, true); }
  });

  // ── Load and render messages
  async function load(first = false) {
    if (loading || !thread) return;
    loading = true;
    const id = thread.id;
    try {
      const r = await call(`/api/chat/${enc(id)}?after=${first ? 0 : cursor}${document.hidden ? '' : '&open=1'}`);
      if (thread?.id !== id) return;
      thread = { ...thread, ...r.thread };
      renderFollow();
      for (const m of r.messages) { msgs.set(m.id, m); cursor = Math.max(cursor, m.at); }
      const asksChanged = setAsks(r.asks);
      if (first || r.messages.length || asksChanged) { render(first); autoTranslate(); }
      markRead();
    } catch (e) {
      if (first) toast(t('e_' + e.message) !== 'e_' + e.message ? t('e_' + e.message) : e.message, true);
    } finally { loading = false; }
  }
  function setAsks(list) {
    const k = JSON.stringify(list || []);
    if (k === asksKey) return false;
    asksKey = k; asks = list || [];
    return true;
  }
  function askLine(k) {
    if (k.state === 'queued') return k.pos > 1 ? t('chatAskQueuedN', k.name, k.pos - 1) : t('chatAskQueued', k.name);
    if (k.state === 'sent') return t('chatAskSent', k.name);
    if (k.state === 'done') return t('chatAskDone', k.name);
    return t('chatAsk_' + (k.reason || 'send_failed'), k.name);
  }

  function markRead() {
    if (!thread || document.hidden || box.hidden || cursor <= readAt) return;
    readAt = cursor;
    post(`/api/chat/${enc(thread.id)}/read`, { at: cursor }).catch(() => {});
    const c = thread.id === 'room' ? chatCounts.room : chatCounts.byPane?.[thread.pane];
    if (c) { c.unread = 0; c.mention = false; }
    update();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && thread) { load(); } });

  function when(ts) {
    const d = new Date(ts), now = new Date();
    const hm = hhmm(ts);
    if (d.toDateString() === now.toDateString()) return hm;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `${t('chatYesterday')} ${hm}`;
    return `${d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' })} ${hm}`;
  }

  // Text → nodes: links clickable, @Name highlighted. Never innerHTML.
  const LINK_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
  function fillText(node, text) {
    const agentNames = new Set(agentTargets().map(a => a.name.toLowerCase()));
    const names = [...people.filter(p => !p.team).map(p => p.name), ...agentNames].filter(Boolean)
      .sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const MENTION = names.length ? new RegExp('@(?:' + names.join('|') + ')(?![\\p{L}\\p{N}_])', 'giu') : null;
    const parts = [];
    let last = 0;
    const hits = [];
    for (const m of text.matchAll(LINK_RE)) hits.push({ i: m.index, s: m[0], kind: 'link' });
    if (MENTION) for (const m of text.matchAll(MENTION)) if (!hits.some(h => m.index >= h.i && m.index < h.i + h.s.length)) hits.push({ i: m.index, s: m[0], kind: 'at' });
    hits.sort((a, b) => a.i - b.i);
    for (const h of hits) {
      if (h.i < last) continue;
      if (h.i > last) parts.push(document.createTextNode(text.slice(last, h.i)));
      if (h.kind === 'link') { const a = document.createElement('a'); a.href = h.s; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = h.s; parts.push(a); }
      else {
        const who = h.s.slice(1).toLowerCase();
        parts.push(el('b', 'at' + (me && who === me.name.toLowerCase() ? ' me' : '') + (agentNames.has(who) ? ' bot' : ''), h.s));
      }
      last = h.i + h.s.length;
    }
    if (last < text.length) parts.push(document.createTextNode(text.slice(last)));
    node.replaceChildren(...parts);
  }

  function render(toBottom) {
    const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
    const all = [...msgs.values()].sort((a, b) => a.at - b.at);
    const frag = document.createDocumentFragment();
    let prev = null;
    for (const m of all) {
      const li = el('li', 'msg' + (m.mine ? ' mine' : '') + (m.deleted ? ' gone' : '') + (m.mentionsMe ? ' ping' : '') + (m.who.agent ? ' agent' : ''));
      const grouped = prev && prev.who.id === m.who.id && m.at - prev.at < 5 * 60e3 && !prev.deleted && !m.deleted && prev.a2a?.to === m.a2a?.to;
      if (grouped) li.classList.add('cont');
      else {
        const head = el('div', 'msg-head');
        const av = el('span', 'av' + (m.who.agent ? ' bot' : ''), (m.who.name || '?')[0].toUpperCase());
        if (!m.who.agent) { const [bg, fg] = whoColor(m.who); av.style.background = bg; av.style.color = fg; }
        head.append(av, el('span', 'nm', m.mine ? `${m.who.name} (${t('chatYou')})` : m.who.name));
        if (m.who.agent) head.append(el('span', 'tag-bot', t('chatAgentTag')));
        // Agent ↔ agent (orca-send or a hand-off): who it went to. Shown in both agents' threads.
        if (m.a2a) head.append(el('span', 'a2a', t(m.a2a.via === 'handoff' ? 'chatA2aHand' : 'chatA2aTo', m.a2a.to)));
        head.append(el('time', 'tm', when(m.at)));
        li.append(head);
      }
      const body = el('div', 'msg-body');
      if (m.deleted) body.textContent = t('chatDeleted');
      else if (m.answer?.empty) { body.textContent = t('chatNoText'); body.classList.add('dim'); }
      else {
        const tr = trans.get(m.id);
        const shown = tr?.state === 'done' && tr.show ? tr.text : m.text;
        if (m.who.agent) body.textContent = shown; // agent text: never parsed for mentions
        else fillText(body, shown);
        if (shown !== m.text) body.classList.add('tr');
      }
      if (m.a2a) li.classList.add('a2a');
      li.append(body);
      if (needsTr(m)) li.append(trLine(m));
      if (m.answer && !m.deleted) {
        const meta = el('div', 'msg-meta');
        if (m.answer.took != null) meta.append(el('span', '', t('chatAnswerTook', dur(m.answer.took))));
        if (m.answer.out) {
          const a = document.createElement('a');
          a.href = '/api/journal/out?id=' + enc(m.answer.out); a.target = '_blank'; a.rel = 'noopener';
          a.textContent = t('chatSeeOutput');
          meta.append(a);
        }
        if (meta.childNodes.length) li.append(meta);
      }
      for (const k of asks.filter(x => x.msg === m.id)) {
        li.append(el('div', 'msg-ask ' + k.state, askLine(k)));
      }
      if (m.canDelete) {
        const del = el('button', 'msg-del', t('chatDelete'));
        del.type = 'button';
        del.addEventListener('click', () => remove(m));
        li.append(del);
      }
      li.title = new Date(m.at).toLocaleString();
      frag.append(li);
      prev = m;
    }
    listEl.replaceChildren(frag);
    const none = !all.length;
    emptyEl.hidden = !none;
    if (none) emptyEl.textContent = t(thread?.kind === 'room' ? 'chatEmptyRoom' : 'chatEmptyAgent');
    if (toBottom || nearBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  // "Translate" / "Translated from Spanish · Show original" under a message in another language.
  function trLine(m) {
    const tr = trans.get(m.id);
    const row = el('div', 'msg-tr');
    const btn = (label, fn) => { const b = el('button', 'linkish', label); b.type = 'button'; b.addEventListener('click', fn); return b; };
    if (!tr || tr.state === 'failed') {
      if (tr?.state === 'failed') row.append(el('span', 'err', t(tr.key ? 'chatTrKey' : 'chatTrFailed')));
      row.append(btn(t('chatTranslate'), () => translateMsg(m, true)));
    } else if (tr.state === 'busy') row.append(el('span', 'busy', t('chatTranslating')));
    else {
      if (tr.show) row.append(el('span', '', t('chatTranslated', t('langName_' + m.lang))));
      row.append(btn(t(tr.show ? 'chatShowOriginal' : 'chatShowTranslation'), () => { tr.show = !tr.show; render(); }));
    }
    return row;
  }
  async function translateMsg(m, manual = false) {
    const cur = trans.get(m.id);
    if (cur && (cur.state === 'busy' || cur.state === 'done') || (!manual && cur?.state === 'failed')) return;
    const id = thread?.id;
    trans.set(m.id, { state: 'busy' });
    render();
    try {
      const r = await post(`/api/chat/${enc(id)}/translate`, { id: m.id, to: lang });
      if (thread?.id !== id) return;
      trans.set(m.id, { state: 'done', text: r.text, show: true });
    } catch (e) {
      if (thread?.id !== id) return;
      trans.set(m.id, { state: 'failed', key: e.message === 'translate_key' });
    }
    render();
  }
  // Auto-translate: newest first, one at a time (the model is shared).
  let autoBusy = false;
  async function autoTranslate() {
    if (!autoTr || autoBusy || !thread || !canTranslate()) return;
    autoBusy = true;
    try {
      for (;;) {
        const next = [...msgs.values()].sort((a, b) => b.at - a.at).find(m => needsTr(m) && !trans.has(m.id));
        if (!next || !autoTr || !thread) break;
        await translateMsg(next);
      }
    } finally { autoBusy = false; }
  }
  $('#chat-tr').addEventListener('click', () => {
    autoTr = !autoTr;
    safeSet('orca-chat-autotr', autoTr ? '1' : '0');
    for (const v of trans.values()) if (v.state === 'done') v.show = autoTr;
    renderHead(); render(); autoTranslate();
  });

  async function remove(m) {
    try {
      await post(`/api/chat/${enc(thread.id)}/delete`, { id: m.id });
      m.deleted = true; m.text = ''; m.canDelete = false;
      render();
    } catch (e) { toast(t('e_' + e.message), true); }
  }

  // ── Compose: Enter sends, Shift+Enter = new line, @ picks a person
  function grow() { textEl.style.height = 'auto'; textEl.style.height = Math.min(textEl.scrollHeight, 140) + 'px'; }
  let pickIdx = 0, pickList = [];
  function atQuery() {
    const before = textEl.value.slice(0, textEl.selectionStart);
    const m = before.match(/(^|\s)@([\p{L}\p{N}_]*)$/u);
    return m ? m[2] : null;
  }
  function renderPick() {
    const q = atQuery();
    if (q == null) { pickEl.hidden = true; return; }
    const ql = q.toLowerCase();
    pickList = [
      ...people.filter(p => !p.team && p.id !== me?.id && p.name.toLowerCase().startsWith(ql)).slice(0, 4),
      ...agentTargets().filter(a => a.name.toLowerCase().startsWith(ql))
        .sort((x, y) => (thread?.id === 't-' + y.terminal) - (thread?.id === 't-' + x.terminal) || x.name.localeCompare(y.name))
        .slice(0, 5).map(a => ({ name: a.name, bot: true })),
    ];
    if (!pickList.length) { pickEl.hidden = true; return; }
    pickIdx = Math.min(pickIdx, pickList.length - 1);
    pickEl.replaceChildren(...pickList.map((p, i) => {
      const b = el('button', 'pick' + (i === pickIdx ? ' on' : ''), '');
      b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === pickIdx));
      const av = el('span', 'av' + (p.bot ? ' bot' : ''), p.name[0].toUpperCase());
      if (!p.bot) { const [bg, fg] = whoColor(p); av.style.background = bg; av.style.color = fg; }
      b.append(av, el('span', '', p.name));
      if (p.bot) b.append(el('span', 'pick-note', t('chatPickAgent')));
      b.addEventListener('mousedown', e => { e.preventDefault(); choose(p); });
      return b;
    }));
    pickEl.hidden = false;
  }
  function choose(p) {
    const pos = textEl.selectionStart;
    const before = textEl.value.slice(0, pos).replace(/@([\p{L}\p{N}_]*)$/u, '@' + p.name + ' ');
    textEl.value = before + textEl.value.slice(pos);
    textEl.setSelectionRange(before.length, before.length);
    pickEl.hidden = true;
    grow();
    textEl.focus();
  }
  textEl.addEventListener('input', () => { pickIdx = 0; grow(); renderPick(); });
  textEl.addEventListener('blur', () => setTimeout(() => { pickEl.hidden = true; }, 120));
  textEl.addEventListener('keydown', e => {
    if (!pickEl.hidden) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pickIdx = (pickIdx + (e.key === 'ArrowDown' ? 1 : -1) + pickList.length) % pickList.length; renderPick(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(pickList[pickIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pickEl.hidden = true; return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); formEl.requestSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    e.stopPropagation(); // the map's single-key shortcuts never fire while typing here
  });
  let sending = false;
  formEl.addEventListener('submit', async e => {
    e.preventDefault();
    const text = textEl.value.trim();
    if (!text || sending || !thread) return;
    sending = true;
    $('#chat-send').disabled = true;
    try {
      const r = await post(`/api/chat/${enc(thread.id)}`, { text });
      msgs.set(r.message.id, r.message);
      cursor = Math.max(cursor, r.message.at);
      setAsks(r.askState);
      const no = (r.asks || []).filter(k => k.state === 'refused');
      if (no.length) toast(no.map(k => t('chatAskNo_' + k.reason, k.name)).join(' '), true, 6000);
      readAt = cursor;
      textEl.value = '';
      grow();
      render(true);
    } catch (err) {
      toast(t('e_' + err.message) !== 'e_' + err.message ? t('e_' + err.message) : err.message, true);
    } finally { sending = false; $('#chat-send').disabled = false; textEl.focus(); }
  });

  // ── Entry points
  $('#chat-btn').addEventListener('click', () => (thread?.id === 'room' && !box.hidden ? close() : open('room')));
  $('#sheet-chat').addEventListener('click', () => { const id = threadOfPane(selected); if (id) open(id); });
  $('#chat-close').addEventListener('click', close);
  $('#chat-agent').addEventListener('click', () => { const a = agentOfThread(thread?.id); if (!a) return; close(); select(a.pane); });
  // Modal: the page behind can't be reached (focus, clicks, the map's single-key shortcuts);
  // Esc closes it from anywhere (the @ picker takes the first Esc).
  function setInert(on) {
    for (const n of document.querySelectorAll('body > .shell, body > #peek, body > #finished, body > #term-view')) n.inert = on;
  }
  document.addEventListener('keydown', e => {
    if (box.hidden || e.key !== 'Escape' || !pickEl.hidden || document.querySelector('dialog[open]')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    close();
  }, true);
  box.addEventListener('keydown', e => e.stopPropagation());
  const fromHash = (hash = location.hash) => { const h = decodeURIComponent(hash.slice(1)); if (h.startsWith('chat-')) open(h.slice(5)); };
  const firstHash = location.hash; // the page may select an agent (and rewrite the hash) before chat is ready
  window.addEventListener('hashchange', () => fromHash());
  navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'chat' && e.data.thread) open(e.data.thread); });

  window.OrcaChat = { update, open, close, threadOfPane, get openThread() { return box.hidden ? null : thread?.id; } };
  // A #chat-… link opens once the first refresh has the agents.
  const wait = setInterval(() => { if (chatCounts.room) { clearInterval(wait); fromHash(firstHash); } }, 200);
  setTimeout(() => clearInterval(wait), 15000);
})();
