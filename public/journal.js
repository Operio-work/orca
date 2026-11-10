'use strict';
// ORCA Journal page: the day's timeline (filters, saved output, export) and the daily
// review queue. Reads /api/journal*. Text is always set with textContent.

const $ = s => document.querySelector(s);
const enc = encodeURIComponent;
const safeGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
let lang = safeGet('herdr-lang') || (navigator.language || 'en').slice(0, 2);
if (lang !== 'es') lang = 'en';

const T = {
  en: {
    title: 'Journal', back: 'Back to ORCA', themeToggle: 'Light / dark', close: 'Close',
    timeline: 'Timeline', review: 'Daily review', today: 'Today', prevDay: 'Previous day', nextDay: 'Next day', export: 'Export .md',
    search: 'Search what was said or done…', everyone: 'Everyone', allAgents: 'All agents', clearAgent: 'Show all agents', onlyAgent: 'Only {0}',
    g_all: 'All', g_lifecycle: 'Agents', g_work: 'Work', g_coordination: 'Links', g_security: 'Security', g_errors: 'Errors',
    empty: 'Nothing recorded for this day.', emptyFiltered: 'Nothing matches these filters.', showing: 'Showing the newest {0} of {1} — narrow it with the filters.',
    savedOutput: 'Saved output', openOutput: 'Saved output', more: 'More', less: 'Less', loading: 'Loading…', outGone: 'That output is no longer kept.',
    reviewLead: 'Each day is summed up here. Read it, add a note if something needs follow-up, and mark it reviewed.',
    toReview: 'To review', reviewedBy: 'Reviewed · {0}', inProgress: 'Today — so far', noDays: 'No days recorded yet. The journal starts filling as people and agents work.',
    stats: '{0} jobs · {1} prompts · {2} started · {3} ended · {4} security · {5} errors',
    people: 'People', agents: 'Agents', security: 'Security', errors: 'Errors', noAgents: 'No agent work this day.',
    startedBy: 'started {0}{1}', endedBy: 'ended {0}{1}', exited: 'exited on its own {0}', by: ' by {0}',
    personRow: '{0} actions · {1} prompts', note: 'Note for later (optional)', markReviewed: 'Mark reviewed', reopen: 'Reopen', openTimeline: 'Open timeline',
    marked: '{0} marked reviewed', reopened: '{0} reopened', notFinal: 'Today is still going — it can be reviewed tomorrow.', jobsN: '{0} jobs', promptsN: '{0} prompts', blockedN: 'needed you {0}×',
    e_generic: 'Something went wrong. Try again.', e_not_final: 'Today is not over yet — review it tomorrow.',
  },
  es: {
    title: 'Bitácora', back: 'Volver a ORCA', themeToggle: 'Claro / oscuro', close: 'Cerrar',
    timeline: 'Cronología', review: 'Revisión diaria', today: 'Hoy', prevDay: 'Día anterior', nextDay: 'Día siguiente', export: 'Exportar .md',
    search: 'Busca lo que se dijo o hizo…', everyone: 'Todos', allAgents: 'Todos los agentes', clearAgent: 'Ver todos los agentes', onlyAgent: 'Solo {0}',
    g_all: 'Todo', g_lifecycle: 'Agentes', g_work: 'Trabajo', g_coordination: 'Enlaces', g_security: 'Seguridad', g_errors: 'Errores',
    empty: 'No hay nada registrado este día.', emptyFiltered: 'Nada coincide con estos filtros.', showing: 'Se muestran los {0} más recientes de {1} — afina con los filtros.',
    savedOutput: 'Salida guardada', openOutput: 'Salida guardada', more: 'Más', less: 'Menos', loading: 'Cargando…', outGone: 'Esa salida ya no se conserva.',
    reviewLead: 'Aquí se resume cada día. Léelo, agrega una nota si algo necesita seguimiento y márcalo como revisado.',
    toReview: 'Por revisar', reviewedBy: 'Revisado · {0}', inProgress: 'Hoy — hasta ahora', noDays: 'Aún no hay días registrados. La bitácora se llena mientras la gente y los agentes trabajan.',
    stats: '{0} trabajos · {1} mensajes · {2} iniciados · {3} terminados · {4} seguridad · {5} errores',
    people: 'Personas', agents: 'Agentes', security: 'Seguridad', errors: 'Errores', noAgents: 'Sin trabajo de agentes este día.',
    startedBy: 'iniciado {0}{1}', endedBy: 'terminado {0}{1}', exited: 'salió solo {0}', by: ' por {0}',
    personRow: '{0} acciones · {1} mensajes', note: 'Nota para después (opcional)', markReviewed: 'Marcar revisado', reopen: 'Reabrir', openTimeline: 'Ver cronología',
    marked: '{0} marcado como revisado', reopened: '{0} reabierto', notFinal: 'El día sigue en curso — se puede revisar mañana.', jobsN: '{0} trabajos', promptsN: '{0} mensajes', blockedN: 'te necesitó {0}×',
    e_generic: 'Algo salió mal. Inténtalo de nuevo.', e_not_final: 'El día aún no termina — revísalo mañana.',
  },
};
const t = (k, ...a) => (T[lang][k] ?? T.en[k] ?? k).replace(/\{(\d)\}/g, (_, i) => a[i] ?? '');
const GROUPS = ['lifecycle', 'work', 'coordination', 'security', 'errors'];
const WHO_BG = ['var(--color-blue)', 'var(--color-yellow)', 'var(--color-info)', 'var(--text-primary)'];
const WHO_FG = ['#FFFFFF', '#0A0A0A', '#0A0A0A', 'var(--color-bg)'];

async function call(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('json') ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) throw new Error((body && body.error) || res.statusText);
  return body;
}
const post = (p, b = {}) => call(p, { method: 'POST', body: JSON.stringify(b) });
let toastTimer;
function toast(msg, err = false) {
  const el = $('#toast');
  el.textContent = msg; el.classList.toggle('error', err); el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, err ? 5000 : 2400);
}
const errText = e => t('e_' + e.message) !== 'e_' + e.message ? t('e_' + e.message) : t('e_generic');
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const pad = n => String(n).padStart(2, '0');
const hhmm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const localDay = (ts = Date.now()) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function shiftDay(day, n) { const [y, m, d] = day.split('-').map(Number); return localDay(new Date(y, m - 1, d + n).getTime()); }
function dayLabel(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const fmtDur = ms => window.OrcaJText.mins(ms, lang);

// ─── State (mirrored in the URL so a view can be shared or reloaded) ─────────
const params = new URLSearchParams(location.search);
const st = {
  tab: params.get('tab') === 'review' ? 'review' : 'timeline',
  day: /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') ? params.get('day') : localDay(),
  agent: params.get('agent') || '', agentName: params.get('name') || '',
  who: '', group: '', q: '',
  data: null, admin: false, me: null,
};
function syncUrl() {
  const p = new URLSearchParams();
  if (st.tab === 'review') p.set('tab', 'review');
  if (st.day !== localDay()) p.set('day', st.day);
  if (st.agent) { p.set('agent', st.agent); if (st.agentName) p.set('name', st.agentName); }
  history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
let loadSeq = 0;
async function loadTimeline() {
  const seq = ++loadSeq;
  const qs = new URLSearchParams({ day: st.day, limit: '800' });
  if (st.agent) qs.set('terminal', st.agent);
  if (st.who) qs.set('who', st.who);
  if (st.q) qs.set('q', st.q);
  try {
    const r = await call('/api/journal?' + qs);
    if (seq !== loadSeq) return;
    st.data = r;
    if (r.me) st.me = r.me;
    if (r.admin !== st.admin) { st.admin = r.admin; $('#tab-review').hidden = !r.admin; if (r.admin) loadDigests(); }
    renderTimeline();
  } catch (e) { toast(errText(e), true); }
}

function renderGroups(entries) {
  const counts = Object.fromEntries(GROUPS.map(g => [g, 0]));
  for (const e of entries) if (counts[e.group] != null) counts[e.group]++;
  const box = $('#groups');
  const mk = (g, n) => {
    const b = el('button', 'chip small');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(st.group === g));
    b.append(el('span', null, t('g_' + (g || 'all')) + ' '), el('b', null, String(n)));
    b.addEventListener('click', () => { st.group = st.group === g ? '' : g; renderTimeline(); });
    return b;
  };
  box.replaceChildren(mk('', entries.length), ...GROUPS.filter(g => counts[g] || st.group === g).map(g => mk(g, counts[g])));
}

function fillSelect(sel, first, items, value) {
  const opts = [new Option(first, '')].concat(items.map(([v, label]) => new Option(label, v)));
  sel.replaceChildren(...opts);
  sel.value = items.some(([v]) => v === value) ? value : '';
}

function entryRow(e) {
  const li = el('li', `jentry g-${e.group} e-${e.event.replace(/\./g, '-')}`);
  const time = el('time', null, hhmm(e.ts));
  time.dateTime = new Date(e.ts).toISOString();
  time.title = new Date(e.ts).toLocaleString();
  const who = el('span', 'jwho' + (e.who ? '' : ' sys'), e.who ? e.who.name.charAt(0).toUpperCase() : '·');
  if (e.who) { const s = (e.who.slot || 0) % WHO_BG.length; who.style.background = WHO_BG[s]; who.style.color = WHO_FG[s]; who.title = e.who.name; }
  else who.title = 'ORCA';
  const body = el('div', 'jbody');
  body.append(el('p', 'jline', window.OrcaJText.describe(e, lang, st.me)));
  const det = window.OrcaJText.detail(e);
  const acts = el('div', 'jacts');
  if (det) {
    const p = el('p', 'jdet', det);
    body.append(p);
    if (det.length > 220 || det.split('\n').length > 3) {
      p.classList.add('clamp');
      const more = el('button', 'jlink', t('more'));
      more.type = 'button';
      more.addEventListener('click', () => { const open = p.classList.toggle('clamp'); more.textContent = open ? t('more') : t('less'); });
      acts.append(more);
    }
  }
  if (e.out) {
    const b = el('button', 'jlink', t('openOutput'));
    b.type = 'button';
    b.addEventListener('click', () => openOutput(e));
    acts.append(b);
  }
  if (acts.childNodes.length) body.append(acts);
  li.append(time, who, body);
  return li;
}

function renderTimeline() {
  const r = st.data;
  if (!r) return;
  $('#day').value = st.day;
  $('#day').max = r.today;
  $('#day-next').disabled = st.day >= r.today;
  $('#day-today').hidden = st.day === r.today;
  $('#export').href = '/api/journal/export?day=' + st.day;
  $('#export').setAttribute('download', `orca-journal-${st.day}.md`);
  const af = $('#agent-filter');
  af.hidden = !st.agent;
  if (st.agent) af.querySelector('span').textContent = t('onlyAgent', st.agentName || r.agents.find(a => a.key === st.agent)?.name || st.agent);
  fillSelect($('#who'), t('everyone'), r.people.map(p => [p.id, p.name]), st.who);
  fillSelect($('#agent'), t('allAgents'), r.agents.map(a => [a.key, a.name]), st.agent);
  renderGroups(r.entries);
  const list = st.group ? r.entries.filter(e => e.group === st.group) : r.entries;
  const ol = $('#entries');
  if (!list.length) {
    ol.replaceChildren(el('li', 'jempty', r.total || st.q || st.who || st.agent ? t('emptyFiltered') : t('empty')));
  } else {
    const out = [];
    let hour = null;
    for (const e of list) {
      const h = new Date(e.ts).getHours();
      if (h !== hour) { hour = h; out.push(el('li', 'jhour', `${pad(h)}:00`)); }
      out.push(entryRow(e));
    }
    ol.replaceChildren(...out);
  }
  const note = $('#tl-note');
  note.hidden = r.total <= r.entries.length;
  note.textContent = t('showing', r.entries.length, r.total);
  syncUrl();
}

// Saved output: fetched as text, shown in a pre (never as HTML).
const outDialog = $('#out-dialog');
async function openOutput(e) {
  $('#out-title').textContent = `${t('savedOutput')} — ${e.agent?.name || e.agent?.pane || ''} · ${hhmm(e.ts)}`;
  const pre = $('#out-text');
  pre.textContent = t('loading');
  outDialog.showModal();
  try {
    pre.textContent = await call('/api/journal/out?id=' + enc(e.out));
    pre.scrollTop = pre.scrollHeight;
  } catch (err) { pre.textContent = err.message === 'gone' ? t('outGone') : errText(err); }
}
$('#out-close').addEventListener('click', () => outDialog.close());
outDialog.addEventListener('click', ev => { if (ev.target === outDialog) outDialog.close(); });

// Controls
$('#day').addEventListener('change', () => { if ($('#day').value) { st.day = $('#day').value; loadTimeline(); } });
$('#day-prev').addEventListener('click', () => { st.day = shiftDay(st.day, -1); loadTimeline(); });
$('#day-next').addEventListener('click', () => { st.day = shiftDay(st.day, 1); loadTimeline(); });
$('#day-today').addEventListener('click', () => { st.day = localDay(); loadTimeline(); });
let qTimer;
$('#q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { st.q = $('#q').value.trim(); loadTimeline(); }, 250); });
$('#who').addEventListener('change', () => { st.who = $('#who').value; loadTimeline(); });
$('#agent').addEventListener('change', () => {
  st.agent = $('#agent').value;
  st.agentName = st.data?.agents.find(a => a.key === st.agent)?.name || '';
  loadTimeline();
});
$('#agent-filter button').addEventListener('click', () => { st.agent = ''; st.agentName = ''; loadTimeline(); });

// ─── Daily review ─────────────────────────────────────────────────────────────
let digests = [];
const openDays = new Set();
async function loadDigests() {
  try {
    const r = await call('/api/journal/digests');
    digests = r.digests;
    const c = $('#review-count');
    c.hidden = !r.toReview;
    c.textContent = String(r.toReview);
    // First visit: open the oldest day still waiting for review.
    if (!openDays.size) { const todo = digests.filter(d => d.final && !d.reviewed); if (todo.length) openDays.add(todo[todo.length - 1].day); }
    renderDigests();
  } catch (e) { if (e.message !== 'not_yours') toast(errText(e), true); }
}
function statsLine(c) { return t('stats', c.jobs, c.prompts, c.started, c.ended + c.gone, c.security, c.errors); }
function renderDigests() {
  const ol = $('#digests');
  if (!digests.length) { ol.replaceChildren(el('li', 'jempty', t('noDays'))); return; }
  ol.replaceChildren(...digests.map(d => {
    const li = el('li');
    const card = el('details', 'dcard' + (d.final && !d.reviewed ? ' todo' : ''));
    card.open = openDays.has(d.day);
    const sum = el('summary');
    sum.append(el('p', 'dday', dayLabel(d.day)));
    const pill = !d.final ? el('span', 'dpill live', t('inProgress')) : d.reviewed ? el('span', 'dpill done', t('reviewedBy', d.reviewed.by)) : el('span', 'dpill todo', t('toReview'));
    sum.append(pill, el('p', 'dstats', statsLine(d.counts)));
    const body = el('div', 'dbody');
    card.append(sum, body);
    card.addEventListener('toggle', () => {
      if (card.open) { openDays.add(d.day); if (!body.dataset.loaded) loadDigest(d.day, body); }
      else openDays.delete(d.day);
    });
    if (card.open) loadDigest(d.day, body);
    li.append(card);
    return li;
  }));
}

async function loadDigest(day, body) {
  body.dataset.loaded = '1';
  body.replaceChildren(el('p', 'jnote', t('loading')));
  try { renderDigest(await call('/api/journal/digest?day=' + day), body); }
  catch (e) { body.dataset.loaded = ''; body.replaceChildren(el('p', 'jnote', errText(e))); }
}

function renderDigest(d, body) {
  const parts = [];
  if (d.people.length) {
    const box = el('div', 'dpeople');
    for (const p of d.people) { const s = el('span', null, `${p.name} — ${t('personRow', p.actions, p.prompts)}`); box.append(s); }
    parts.push(el('h3', null, t('people')), box);
  }
  parts.push(el('h3', null, t('agents')));
  if (!d.agents.length) parts.push(el('p', 'jnote', t('noAgents')));
  else {
    const ul = el('ul', 'dagents');
    for (const a of d.agents) {
      const li = el('li', 'dagent');
      li.append(el('p', 'an', a.name));
      const meta = [a.kind, a.cwd].filter(Boolean);
      const life = [];
      if (a.started) life.push(t('startedBy', hhmm(a.started.at), (a.started.by ? t('by', a.started.by) : '')));
      if (a.ended) life.push(a.ended.mode === 'gone' ? t('exited', hhmm(a.ended.at)) : t('endedBy', hhmm(a.ended.at), a.ended.by ? t('by', a.ended.by) : ''));
      const counts = [a.jobs.length ? t('jobsN', a.jobs.length) : '', a.prompts ? t('promptsN', a.prompts) : '', a.blocked ? t('blockedN', a.blocked) : ''].filter(Boolean);
      li.append(el('p', 'am', [...meta, ...life, ...counts, a.people.length ? a.people.join(', ') : ''].filter(Boolean).join(' · ')));
      if (a.jobs.length) {
        const jl = el('ul', 'djobs');
        for (const j of a.jobs) {
          const row = el('li');
          const txt = el('div');
          if (j.ask) txt.append(el('p', 'ask', '“' + j.ask + '”'));
          txt.append(el('p', null, (j.said || '—') + (j.secs != null ? ` (${fmtDur(j.secs * 1000)})` : '')));
          if (j.out) {
            const b = el('button', 'jlink', t('openOutput'));
            b.type = 'button';
            b.addEventListener('click', () => openOutput({ out: j.out, ts: j.at, agent: { name: a.name } }));
            txt.append(b);
          }
          row.append(el('time', null, hhmm(j.at)), txt);
          jl.append(row);
        }
        li.append(jl);
      }
      ul.append(li);
    }
    parts.push(ul);
  }
  if (d.security.length) {
    const ul = el('ul', 'dlist');
    for (const s of d.security) ul.append(el('li', null, `${hhmm(s.at)} · ${window.OrcaJText.describe({ event: s.event, who: s.who ? { id: s.who, name: s.who } : null, agent: s.agent ? { name: s.agent } : null, code: s.detail, minutes: s.minutes }, lang, null)}`));
    parts.push(el('h3', null, t('security')), ul);
  }
  if (d.errors.length) {
    const ul = el('ul', 'dlist');
    for (const e of d.errors) ul.append(el('li', null, `${e.what} ×${e.n}`));
    parts.push(el('h3', null, t('errors')), ul);
  }
  // Review actions
  const acts = el('div', 'dactions');
  if (d.reviewed?.note) acts.append(el('p', 'dnote', d.reviewed.note));
  const row = el('div', 'drow');
  const tl = el('a', 'btn', t('openTimeline'));
  tl.href = '/journal.html?day=' + d.day;
  tl.addEventListener('click', ev => { ev.preventDefault(); st.day = d.day; st.agent = ''; setTab('timeline'); loadTimeline(); scrollTo(0, 0); });
  const ex = el('a', 'btn', t('export'));
  ex.href = '/api/journal/export?day=' + d.day;
  ex.setAttribute('download', `orca-journal-${d.day}.md`);
  if (!d.final) {
    acts.append(el('p', 'jnote', t('notFinal')));
  } else if (d.reviewed) {
    const b = el('button', 'btn', t('reopen'));
    b.type = 'button';
    b.addEventListener('click', () => review(d.day, '', true, b));
    row.append(b);
  } else {
    const note = el('textarea');
    note.placeholder = t('note');
    note.maxLength = 500;
    note.rows = 2;
    acts.append(note);
    const b = el('button', 'btn primary', t('markReviewed'));
    b.type = 'button';
    b.addEventListener('click', () => review(d.day, note.value, false, b));
    row.append(b);
  }
  row.append(tl, ex);
  acts.append(row);
  parts.push(acts);
  body.replaceChildren(...parts);
}

async function review(day, note, undo, btn) {
  btn.disabled = true;
  try {
    await post('/api/journal/review', { day, note, undo });
    toast(t(undo ? 'reopened' : 'marked', dayLabel(day)));
    if (!undo) {
      openDays.delete(day);
      const next = digests.filter(d => d.final && !d.reviewed && d.day !== day);
      if (next.length) openDays.add(next[next.length - 1].day);
    }
    await loadDigests();
  } catch (e) { toast(errText(e), true); btn.disabled = false; }
}

// ─── Tabs, language, theme ───────────────────────────────────────────────────
function setTab(tab) {
  st.tab = tab;
  for (const [id, name] of [['#tab-timeline', 'timeline'], ['#tab-review', 'review']]) $(id).setAttribute('aria-selected', String(tab === name));
  $('#timeline').hidden = tab !== 'timeline';
  $('#review').hidden = tab !== 'review';
  syncUrl();
}
$('#tab-timeline').addEventListener('click', () => setTab('timeline'));
$('#tab-review').addEventListener('click', () => { setTab('review'); loadDigests(); });

function applyLang() {
  document.documentElement.lang = lang;
  $('#lang').textContent = lang === 'en' ? 'ES' : 'EN';
  document.title = `ORCA ${t('title')}`;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); n.setAttribute('aria-label', n.title); });
  document.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = t(n.dataset.i18nPh); });
  renderTimeline();
  renderDigests();
}
$('#lang').addEventListener('click', () => { lang = lang === 'en' ? 'es' : 'en'; safeSet('herdr-lang', lang); applyLang(); });
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#F4F4F5' : '#0A0A0A';
}
$('#theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  safeSet('herdr-theme', next);
  applyTheme(next);
});
applyTheme(document.documentElement.dataset.theme || 'dark');

applyLang();
setTab(st.tab);
loadTimeline();
// The day keeps filling while you look at it.
setInterval(() => { if (!document.hidden && st.tab === 'timeline' && st.day === localDay()) loadTimeline(); }, 20000);
