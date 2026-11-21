'use strict';
// ORCA — Islands view: the workspace as a cartoon 90s sim. Every workspace is an
// island in the sea, every tab an office building on its lot, every agent a little character
// at the door: pacing with a box while working, dozing on a bench while idle, waving under a
// "!" balloon when it needs you, cheering when done. Smooth vector shapes with ink outlines,
// drawn at the screen's real resolution. Every colour is an Operio v3 token or a mix of two
// tokens, read at runtime so the scene follows light/dark. app.js owns the data and the agent
// page; this file draws and reports taps. Visible copy never names the underlying tool.
// With more than one workspace the view opens on the archipelago: one small island per
// workspace (houses + status dots, a red badge when someone needs you). Tap one to sail
// to it and see the whole island; the back sign (or Esc) returns to the archipelago.
(() => {
const box = document.getElementById('island');
const canvas = document.getElementById('isle');
const rosterEl = document.getElementById('isle-roster');
const ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEMO = new URLSearchParams(location.search).has('demo');

// ─── Palette: tokens + mixes of tokens ───────────────────────────────────────
const TOKENS = {
  bg: '--color-bg', surface: '--color-surface', surface2: '--color-surface-2', surface3: '--color-surface-3',
  t1: '--text-primary', t2: '--text-secondary', t3: '--text-tertiary', dim: '--text-dim',
  orange: '--color-orange', orangeDim: '--color-orange-dim', orangeBright: '--color-orange-bright', orangeStrong: '--color-orange-strong',
  green: '--color-green', red: '--color-red', yellow: '--color-yellow', blue: '--color-blue', info: '--color-info',
  orangeInk: '--color-orange-ink', greenInk: '--color-green-ink', redInk: '--color-red-ink', mono: '--font-mono',
};
const C = {};
const P = {};
function rgb(c) {
  c = String(c).trim();
  if (c[0] === '#') {
    if (c.length === 4) c = '#' + [...c.slice(1)].map(x => x + x).join('');
    const n = parseInt(c.slice(1, 7), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const m = c.match(/\d+(\.\d+)?/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const alpha = (c, a) => `rgba(${rgb(c).join(',')},${a})`;
let dark = true;
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const [k, v] of Object.entries(TOKENS)) C[k] = cs.getPropertyValue(v).trim() || '#888';
  dark = rgb(C.bg).reduce((a, b) => a + b) < 384;
  const black = dark ? C.bg : C.t1;
  const white = dark ? C.t1 : C.surface;
  Object.assign(P, {
    ink: mix(black, C.blue, 0.22),                       // cartoon outline
    sea: mix(C.blue, black, dark ? 0.42 : 0.12), seaDeep: mix(C.blue, black, dark ? 0.56 : 0.3),
    shallow: mix(C.blue, C.info, 0.55), foam: white, curl: alpha(white, 0.55),
    sand: mix(C.yellow, white, 0.45), sandShade: mix(C.yellow, C.orangeDim, 0.3),
    grass: mix(C.green, C.yellow, 0.18), grassDark: mix(C.green, black, 0.28), grassLight: mix(C.green, C.yellow, 0.45),
    cliffL: C.orangeDim, cliffR: mix(C.orangeDim, black, 0.35),
    lot: mix(C.t3, white, dark ? 0.15 : 0.55), lotEdge: mix(C.t3, black, 0.2),
    wallL: mix(white, C.t3, 0.12), wallR: mix(white, C.t3, 0.42),
    winOff: mix(C.blue, black, 0.55), winOn: C.yellow, door: mix(C.orangeDim, black, 0.35),
    trunk: mix(C.orangeDim, black, 0.15), leaf: mix(C.green, C.yellow, 0.1), leafDark: mix(C.green, black, 0.25),
    hull: C.orangeStrong, paper: white, plate: dark ? mix(C.bg, C.surface, 0.5) : C.surface,
    bar: C.surface2, barHi: mix(C.surface3, white, 0.2), barLo: mix(C.surface, black, 0.5), shadow: 'rgba(0,0,0,0.22)',
  });
  P.roofs = [C.red, C.blue, C.info, C.green, C.orange, C.yellow];
}

// ─── Copy (EN / ES) ──────────────────────────────────────────────────────────
const T = {
  en: { title: 'ORCA ISLANDS', island: 'Island', empty: 'empty lot', none: 'No agents yet. Press New.', quiet: 'All quiet.',
        back: '◂ All islands', backAria: 'Back to all islands', open: 'Open island {0}', agents: '{0} agents', agents1: '1 agent', noAgents: 'no agents',
        working: '{0} working', more: '+{0}', shoreTitle: window.ORCA_I18N?.app?.shoreTitle || 'On the Shore — Waiting for a Boat',
        needs: '{0} need you!', needs1: '1 needs you!', offline: 'Connection lost — retrying…',
        st: { working: 'working', idle: 'idle', blocked: 'needs you', done: 'done', unknown: 'arriving' } },
  es: { title: 'ISLAS ORCA', island: 'Isla', empty: 'lote vacío', none: 'Aún no hay agentes. Toca Nuevo.', quiet: 'Todo en calma.',
        back: '◂ Todas las islas', backAria: 'Volver a todas las islas', open: 'Abrir la isla {0}', agents: '{0} agentes', agents1: '1 agente', noAgents: 'sin agentes',
        working: '{0} trabajando', more: '+{0}', shoreTitle: window.ORCA_I18N?.app?.shoreTitle || 'En la orilla — esperando un barco',
        needs: '¡{0} te necesitan!', needs1: '¡1 te necesita!', offline: 'Sin conexión — reintentando…',
        st: { working: 'trabajando', idle: 'libre', blocked: 'te necesita', done: 'terminó', unknown: 'llegando' } },
};
// Other languages: the pack loaded by lang-boot.js (missing strings fall back to English).
if (window.ORCA_I18N?.island) T[window.ORCA_I18N.lang] = { ...T.en, ...window.ORCA_I18N.island };
// Agent kind = character (token keys): hair, skin, shirt, trousers; robots and wings as extras.
const KINDS = {
  claude:   { h: 'orangeDim', s: 'orangeBright', b: 'orangeStrong', p: 't3' },
  hermes:   { h: 'yellow', s: 'orangeBright', b: 'info', p: 't3', wings: true },
  codex:    { h: 't3', s: 't2', b: 'dim', p: 't3', robot: true },
  opencode: { h: 'dim', s: 'orangeBright', b: 'green', p: 't3' },
  agy:      { h: 't1', s: 'orangeBright', b: 'blue', p: 't3' },
  _:        { h: 'dim', s: 'orangeBright', b: 't2', p: 't3' },
};

// ─── State ───────────────────────────────────────────────────────────────────
let data = { agents: [], sleeping: [], tabs: [], workspaces: [], tagColors: {} };
let state = { selected: null, lang: 'en', offline: false, matches: () => true };
let L = T.en;
let hits = [];
let scale = 2;
let skew = 0;
let onPick = () => {};
let onSleepingPick = () => {};
const waves = new Map(); // pane -> until (Show on desktop landed: the character cheers)
// The island you sailed to (workspace id), or null for the archipelago. Remembered per browser.
const store = { get() { try { return localStorage.getItem('orca-isle'); } catch { return null; } },
                set(v) { try { v ? localStorage.setItem('orca-isle', v) : localStorage.removeItem('orca-isle'); } catch { /* private mode */ } } };
let focus = store.get();
let lastSelected = null;
let focusRing = null; // archipelago: the island holding the selected agent
const now = () => Date.now() + skew;
const hash = (a, b, s = 0) => { let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const seedOf = str => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

// ─── Drawing helpers (logical units; the canvas transform does the scaling) ──
function shape(build, fill, stroke = P.ink, lw = 1) {
  ctx.beginPath(); build();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
const poly = pts => () => { ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); };
const circle = (x, y, r) => () => ctx.arc(x, y, r, 0, Math.PI * 2);
const rrect = (x, y, w, h, r) => () => ctx.roundRect(x, y, w, h, r);
function font(size, weight = 700) { ctx.font = `${weight} ${size}px ${C.mono}`; }
function fit(str, max, size, weight) {
  font(size, weight);
  str = String(str);
  if (ctx.measureText(str).width <= max) return str;
  while (str.length > 1 && ctx.measureText(str + '…').width > max) str = str.slice(0, -1);
  return str + '…';
}
function txt(str, x, y, size, col, align = 'center', weight = 700) {
  font(size, weight); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y);
}
function pill(str, cx, cy, size, max, col = P.ink, fill = P.paper) { // label on a rounded sign
  const s = fit(str, max, size);
  font(size);
  const w = ctx.measureText(s).width + size * 1.4, h = size * 1.7;
  shape(rrect(cx - w / 2, cy - h / 2, w, h, h / 2), fill, P.ink, 0.9);
  txt(s, cx, cy + 0.3, size, col);
  return w;
}

// ─── Layout (logical px): islands stacked, lots flowing in rows on each ─────
const SLOT = 32, PAD_Y = 26, HUD_H = 16, FOOT_H = 16, SEA_GAP = 30, BANNER = 14;
const bldH = n => 16 + Math.min(n, 5) * 5;
function avail() {
  const cs = getComputedStyle(box);
  return Math.min(box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), 1800);
}

function allWs() {
  return data.workspaces.length ? data.workspaces : [...new Set(data.tabs.map(t => t.ws))].map((id, i) => ({ id, number: i + 1 }));
}
const wsName = ws => ws.label || `${L.island} ${ws.number}`;
function agentsOf(wsId, byPane) {
  return data.tabs.filter(t => t.ws === wsId).flatMap(t => t.panes.map(p => byPane.get(p.pane))).filter(Boolean);
}
// Which island is on screen: null = archipelago. One workspace (or none) needs no archipelago.
function current() {
  const list = allWs();
  if (list.length <= 1) return { list, ws: list[0] || null, multi: false };
  const ws = list.find(w => w.id === focus) || null;
  return { list, ws, multi: true };
}

function layout(W, only) {
  const byPane = new Map(data.agents.map(a => [a.pane, a]));
  const padX = W < 260 ? 18 : 36;
  const maxW = W - 2 * padX - 16;
  const cap = Math.max(1, Math.floor(maxW / SLOT));
  const wsList = only ? [only] : allWs();
  const islands = [];
  let y = HUD_H + 14;
  for (const ws of wsList) {
    const tabs = data.tabs.filter(t => t.ws === ws.id).sort((a, b) => a.number - b.number);
    const lots = tabs.map(tab => {
      const agents = [...tab.panes].sort((a, b) => a.y - b.y || a.x - b.x).map(p => byPane.get(p.pane)).filter(Boolean);
      const n = agents.length;
      const rows = Math.max(1, Math.ceil(n / cap));
      const byOff = 34 + bldH(n);
      return { tab, agents, empty: !n, w: n ? Math.min(cap, Math.max(3, n)) * SLOT : 56, h: n ? byOff + 50 + (rows - 1) * 32 : 52, byOff };
    }).sort((a, b) => a.empty - b.empty);
    const rows = [];
    let row = null;
    for (const lot of lots) {
      if (!row || row.w + lot.w > maxW) { row = { lots: [], w: 0, h: 0 }; rows.push(row); }
      row.lots.push(lot); row.w += lot.w; row.h = Math.max(row.h, lot.h);
    }
    const cw = Math.max(100, ...rows.map(r => r.w));
    const ch = rows.reduce((a, r) => a + r.h, 0) || 40;
    const isl = { ws, x: Math.round((W - cw) / 2 - padX + 8), y: y + BANNER, w: cw + 2 * padX - 16, h: ch + 2 * PAD_Y, lots: [], seed: seedOf(ws.id) };
    let ly = isl.y + PAD_Y;
    for (const r of rows) {
      let lx = Math.round(W / 2 - r.w / 2);
      for (const lot of r.lots) { Object.assign(lot, { x: lx, y: ly + (r.h - lot.h) }); isl.lots.push(lot); lx += lot.w; }
      ly += r.h;
    }
    islands.push(isl);
    y = isl.y + isl.h + SEA_GAP;
  }
  if (!islands.length) y += 40;
  const sleepers = data.sleeping || [];
  let shore = null;
  if (sleepers.length) {
    const cols = Math.max(1, Math.floor((W - 24) / SLOT));
    const rows = Math.ceil(sleepers.length / cols);
    shore = { x: 0, y: y + 2, w: W, h: 45 + rows * 42 + 4, cols };
    y = shore.y + shore.h;
  }
  return { W, H: y + 6 + FOOT_H, islands, byPane, shore };
}

// ─── Sea ─────────────────────────────────────────────────────────────────────
function drawSea(W, H, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, P.sea); g.addColorStop(1, P.seaDeep);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // cartoon wave curls drifting sideways
  ctx.strokeStyle = P.curl; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (let i = 0; i < Math.floor(W * H / 2600); i++) {
    const sx = hash(i, 1) * W, sy = hash(i, 2) * H;
    const x = (sx + (reduced ? 0 : t / 120 * (0.5 + hash(i, 3)))) % (W + 20) - 10;
    const k = reduced ? 1 : 0.6 + 0.4 * Math.sin(t / 900 + i);
    ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(x, sy, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(x + 6, sy, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ─── Islands: a soft squircle with sand, grass, an earth cliff and foam ──────
function blob(isl, grow, dy, wob = 1) {
  const cx = isl.x + isl.w / 2, cy = isl.y + isl.h / 2 + dy;
  const a = isl.w / 2 + grow, b = isl.h / 2 + grow * 0.8;
  const N = 72, pts = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const n = wob * (2.6 * Math.sin(i * 0.55 + isl.seed) + 1.8 * Math.sin(i * 1.3 + isl.seed * 0.7));
    pts.push([cx + Math.sign(c) * Math.abs(c) ** 0.4 * (a + n), cy + Math.sign(s) * Math.abs(s) ** 0.4 * (b + n * 0.7)]);
  }
  return () => {
    const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    ctx.moveTo(...m(pts[N - 1], pts[0]));
    for (let i = 0; i < N; i++) ctx.quadraticCurveTo(...pts[i], ...m(pts[i], pts[(i + 1) % N]));
    ctx.closePath();
  };
}

function drawIsland(isl, t, mini = false) {
  const E = mini ? 5 : 7;
  shape(blob(isl, 12, E + 3), alpha(P.shallow, 0.45), null);           // shallow water
  ctx.setLineDash([5, 4]); ctx.lineDashOffset = reduced ? 0 : -t / 150;  // foam, lapping
  shape(blob(isl, 4, E + 2), null, P.foam, 1.6);
  ctx.setLineDash([]);
  const cg = ctx.createLinearGradient(isl.x, 0, isl.x + isl.w, 0);
  cg.addColorStop(0, P.cliffL); cg.addColorStop(1, P.cliffR);
  shape(blob(isl, 0, E), cg, P.ink, 1.2);                              // earth cliff
  shape(blob(isl, 0, 0), P.sand, P.ink, 1.2);                          // beach
  const gg = ctx.createRadialGradient(isl.x + isl.w * 0.35, isl.y + isl.h * 0.3, 10, isl.x + isl.w / 2, isl.y + isl.h / 2, Math.max(isl.w, isl.h) * 0.7);
  gg.addColorStop(0, P.grassLight); gg.addColorStop(0.55, P.grass); gg.addColorStop(1, P.grassDark);
  shape(blob(isl, mini ? -6 : -9, -1, mini ? 0.9 : 1.4), gg, mix(P.grassDark, P.ink, 0.3), 0.8);  // grass
  // tufts and flowers
  for (let i = 0; i < isl.w * isl.h / 700; i++) {
    const x = isl.x + 22 + hash(i, isl.seed, 5) * (isl.w - 44), y = isl.y + 18 + hash(i, isl.seed, 6) * (isl.h - 36);
    if (isl.lots.some(l => x > l.x - 4 && x < l.x + l.w + 4 && y > l.y + 8 && y < l.y + l.h)) continue;
    if (hash(i, 9, isl.seed) < 0.75) {
      ctx.strokeStyle = P.grassDark; ctx.lineWidth = 0.8; ctx.beginPath();
      ctx.moveTo(x - 1.5, y - 2); ctx.lineTo(x, y); ctx.lineTo(x + 1.5, y - 2.5); ctx.stroke();
    } else shape(circle(x, y, 1), [C.yellow, P.paper, C.red][i % 3], null);
  }
  // palms near the shore, clear of the lots and the flag
  const palms = [];
  for (let i = 0; i < 30 && palms.length < (mini ? 1 : 3); i++) {
    const side = hash(i, isl.seed, 11);
    const x = side < 0.5 ? isl.x + 16 + hash(i, 12) * 14 : isl.x + isl.w - 18 - hash(i, 13) * 14;
    const y = isl.y + 26 + hash(i, isl.seed, 14) * (isl.h - 40);
    if (isl.lots.some(l => x > l.x - 12 && x < l.x + l.w + 12 && y > l.y - 6 && y < l.y + l.h + 10)) continue;
    if (!mini && y < isl.y + 34 && x < isl.x + 100) continue;
    if (palms.some(([px0, py0]) => Math.hypot(px0 - x, py0 - y) < 30)) continue;
    palms.push([x, y]);
    palm(x, y, t, i);
  }
  if (mini) return;
  // the island's name on a flag
  const name = wsName(isl.ws);
  const fx = isl.x + 14, fy = isl.y - 4;
  shape(() => { ctx.moveTo(fx, fy + 10); ctx.lineTo(fx, fy - 12); }, null, P.ink, 1.6);
  const s = fit(name, 120, 6.5);
  font(6.5);
  const w = ctx.measureText(s).width + 10;
  const flap = reduced ? 0 : Math.sin(t / 300) * 1.2;
  shape(() => { ctx.moveTo(fx, fy - 12); ctx.lineTo(fx + w, fy - 12 + flap); ctx.lineTo(fx + w - 3, fy - 6); ctx.lineTo(fx + w, fy + flap); ctx.lineTo(fx, fy); ctx.closePath(); }, C.orange, P.ink, 1);
  txt(s, fx + 4, fy - 6, 6.5, C.bg, 'left');
}

function palm(x, y, t, i) {
  const sway = reduced ? 0 : Math.sin(t / 700 + i) * 1.2;
  shape(() => ctx.ellipse(x + 3, y + 1, 7, 2.5, 0, 0, Math.PI * 2), P.shadow, null);
  const top = [x + 4 + sway, y - 20];
  shape(() => { ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 2, y - 11, ...top); }, null, P.ink, 4);
  shape(() => { ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 2, y - 11, ...top); }, null, P.trunk, 2.4);
  for (let k = 0; k < 5; k++) {
    const ang = -Math.PI / 2 + (k - 2) * 0.75 + sway * 0.04;
    const ex = top[0] + Math.cos(ang) * 11, ey = top[1] + Math.sin(ang) * 6 + 4;
    shape(() => {
      ctx.moveTo(...top);
      ctx.quadraticCurveTo(top[0] + Math.cos(ang - 0.4) * 8, top[1] + Math.sin(ang - 0.4) * 7 - 3, ex, ey);
      ctx.quadraticCurveTo(top[0] + Math.cos(ang + 0.4) * 6, top[1] + Math.sin(ang + 0.4) * 4, ...top);
    }, k % 2 ? P.leaf : P.leafDark, P.ink, 0.8);
  }
  shape(circle(top[0] - 1.5, top[1] + 2, 1.4), P.trunk, P.ink, 0.6);
  shape(circle(top[0] + 1.5, top[1] + 2.3, 1.4), P.trunk, P.ink, 0.6);
}

// ─── Buildings ───────────────────────────────────────────────────────────────
function windowPane(x0, y0, slope, col, glow) { // a small parallelogram on a wall
  if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 4; }
  shape(poly([[x0, y0], [x0 + 3, y0 + slope], [x0 + 3, y0 + slope + 4], [x0, y0 + 4]]), col, null);
  ctx.shadowBlur = 0;
}

function building(lot, t, flash) {
  const n = lot.agents.length;
  const bw = 16, bh = bldH(n);
  const bx = Math.round(lot.x + lot.w / 2), by = lot.y + lot.byOff;
  const any = s => lot.agents.some(a => a.status === s);
  const working = any('working'), blocked = any('blocked'), done = any('done');
  const roof = P.roofs[(lot.tab.number - 1 + 6) % P.roofs.length];
  // lot + shadow
  shape(poly([[bx - bw - 10, by + 2], [bx, by + bw / 2 + 8], [bx + bw + 10, by + 2], [bx, by - bw / 2 - 4]]), P.lot, P.lotEdge, 0.8);
  shape(poly([[bx, by + bw / 2], [bx + bw, by], [bx + bw + 9, by + 3], [bx + 7, by + bw / 2 + 4]]), P.shadow, null);
  // walls
  shape(poly([[bx - bw, by], [bx, by + bw / 2], [bx, by + bw / 2 - bh], [bx - bw, by - bh]]), P.wallL, P.ink, 1);
  shape(poly([[bx, by + bw / 2], [bx + bw, by], [bx + bw, by - bh], [bx, by + bw / 2 - bh]]), P.wallR, P.ink, 1);
  // windows: lit while someone works; red flicker when someone needs you
  for (let fy = 6; fy < bh - 9; fy += 7) {
    for (const i of [4, 10]) {
      for (const side of [-1, 1]) {
        const lit = working && (reduced || hash(i * side, fy, Math.floor(t / 900)) > 0.2);
        const col = blocked ? (flash ? C.red : P.winOff) : lit ? P.winOn : P.winOff;
        if (side < 0) windowPane(bx - bw + i, by - bh + fy + i / 2, 1.5, col, lit || (blocked && flash));
        else windowPane(bx + i - 2, by - bh + fy + (bw - i) / 2 - 1, -1.5, col, lit || (blocked && flash));
      }
    }
  }
  // door (arched) on the left face
  shape(() => { ctx.moveTo(bx - 9, by + 3.5); ctx.lineTo(bx - 9, by - 2); ctx.quadraticCurveTo(bx - 7, by - 5, bx - 5, by - 1); ctx.lineTo(bx - 5, by + 5.5); ctx.closePath(); }, P.door, P.ink, 0.8);
  // hip roof
  const ry = by - bh, o = 2.5, rh = 11;
  const Lp = [bx - bw - o, ry], Bp = [bx, ry + bw / 2 + o / 2], Rp = [bx + bw + o, ry], A = [bx, ry - rh];
  shape(poly([Lp, Bp, A]), mix(roof, P.paper, 0.15), P.ink, 1);
  shape(poly([Bp, Rp, A]), mix(roof, P.ink, 0.3), P.ink, 1);
  // chimney with smoke while working
  const cx = bx + 7, cy = ry - 3;
  shape(rrect(cx - 1.5, cy - 6, 3.5, 6, 0.6), mix(P.wallR, P.ink, 0.2), P.ink, 0.8);
  if (working) for (let k = 0; k < 3; k++) {
    const p = reduced ? k / 3 : ((t / 1600 + k / 3) % 1);
    ctx.globalAlpha = 0.75 * (1 - p);
    shape(circle(cx + p * 6, cy - 8 - p * 12, 1.8 + p * 2.4), P.paper, null);
    ctx.globalAlpha = 1;
  }
  const top = A[1];
  if (blocked) { // siren
    if (flash) { ctx.globalAlpha = 0.35; shape(circle(A[0], top - 4, 8), C.red, null); ctx.globalAlpha = 1; }
    shape(() => ctx.arc(A[0], top - 1, 3.2, Math.PI, 0), flash ? C.red : C.redInk, P.ink, 0.8);
    shape(rrect(A[0] - 4, top - 1, 8, 2, 0.6), P.wallR, P.ink, 0.6);
  } else if (done) { // green flag
    shape(() => { ctx.moveTo(A[0], top); ctx.lineTo(A[0], top - 13); }, null, P.ink, 1.2);
    const f = reduced ? 0 : Math.sin(t / 250);
    shape(() => { ctx.moveTo(A[0], top - 13); ctx.quadraticCurveTo(A[0] + 4, top - 14 + f, A[0] + 8, top - 12); ctx.lineTo(A[0] + 8, top - 7); ctx.quadraticCurveTo(A[0] + 4, top - 9 - f, A[0], top - 8); ctx.closePath(); }, C.green, P.ink, 0.8);
  }
  pill(lot.tab.label || '#' + lot.tab.number, bx, top - (blocked ? 13 : done ? 20 : 8), 5.5, lot.w - 8);
  return { bx, by, bw };
}

function emptyLot(lot) {
  const bx = Math.round(lot.x + lot.w / 2), by = lot.y + 30;
  shape(poly([[bx - 20, by], [bx, by + 10], [bx + 20, by], [bx, by - 10]]), P.lot, P.lotEdge, 0.8);
  ctx.setLineDash([2, 2]);
  shape(poly([[bx - 17, by], [bx, by + 8.5], [bx + 17, by], [bx, by - 8.5]]), null, P.ink, 0.7);
  ctx.setLineDash([]);
  shape(() => { ctx.moveTo(bx, by + 2); ctx.lineTo(bx, by - 10); }, null, P.ink, 1.2);
  pill(lot.tab.label || '#' + lot.tab.number, bx, by - 14, 5, 52);
  txt(L.empty, bx, by + 15, 4.5, alpha(P.ink, 0.8));
}

// ─── Characters: big heads, small bodies ─────────────────────────────────────
function person(a, x, fy, t, i) {
  const kind = KINDS[a.agent] || KINDS._;
  const col = k => C[kind[k]];
  const shirt = col('b');
  const tag = a.tags.length ? [C.blue, C.info, C.green, C.yellow, C.orangeStrong][(data.tagColors?.[a.tags[0]] ?? 0) % 5] : null;
  const faded = a.status === 'unknown' || !state.matches(a);
  const waving = (waves.get(a.pane) || 0) > Date.now();
  const st = waving ? 'cheer' : a.status;
  const seed = hash(i, seedOf(a.pane));
  let dx = 0, lift = 0, flip = 1, sit = false, arms = 'down', carry = false;
  const step = reduced ? 0 : Math.sin(t / 110);
  if (st === 'working') {
    const p = reduced ? 0 : ((t / 5200 + seed) % 1);
    const tri = p < 0.5 ? p * 2 : 2 - p * 2;
    dx = (tri - 0.5) * 16; flip = p < 0.5 ? 1 : -1; carry = true;
    lift = Math.abs(step) * 1.2;
  } else if (st === 'idle') sit = true;
  else if (st === 'blocked') { arms = 'wave'; lift = reduced ? 0 : Math.max(0, Math.sin(t / 160)) * 3; }
  else if (st === 'done' || st === 'cheer') { arms = 'up'; lift = reduced ? 0 : Math.abs(Math.sin(t / 180)) * (st === 'cheer' ? 4 : 2); }
  const X = x + dx, Y = fy - lift;
  ctx.globalAlpha = faded ? 0.45 : 1;
  shape(() => ctx.ellipse(x + dx, fy + 0.5, 5, 1.6, 0, 0, Math.PI * 2), P.shadow, null);
  if (sit) { // bench
    shape(rrect(x - 8, fy - 6, 16, 2.6, 1), P.trunk, P.ink, 0.8);
    shape(() => { ctx.moveTo(x - 6, fy - 3.4); ctx.lineTo(x - 6, fy); ctx.moveTo(x + 6, fy - 3.4); ctx.lineTo(x + 6, fy); }, null, P.ink, 1);
  }
  // legs
  const legY = Y - 5.5;
  if (sit) {
    const legs = () => { for (const o of [-1.6, 1.6]) { ctx.moveTo(X + o, Y - 9); ctx.lineTo(X + o + 3.5 * flip, Y - 8.5); ctx.lineTo(X + o + 3.5 * flip, Y - 4); } };
    shape(legs, null, P.ink, 2.8); shape(legs, null, col('p'), 1.6);
  } else {
    const sw = st === 'working' ? step * 1.8 : 0;
    const legs = () => { ctx.moveTo(X - 1.6, legY); ctx.lineTo(X - 1.6 + sw, Y); ctx.moveTo(X + 1.6, legY); ctx.lineTo(X + 1.6 - sw, Y); };
    shape(legs, null, P.ink, 2.8); shape(legs, null, col('p'), 1.6);
  }
  const bodyTop = (sit ? Y - 4 : Y) - 13;
  const hand = (sx, ex, ey) => {
    const arm = () => { ctx.moveTo(sx, bodyTop + 3); ctx.lineTo(ex, ey); };
    shape(arm, null, P.ink, 2.6); shape(arm, null, shirt, 1.4); shape(circle(ex, ey, 1.1), col('s'), P.ink, 0.5);
  };
  if (arms === 'up') { hand(X - 3, X - 6, bodyTop - 4); hand(X + 3, X + 6, bodyTop - 4); }
  else if (arms === 'wave') { const w = reduced ? 0 : Math.sin(t / 120) * 2; hand(X - 3, X - 5, bodyTop + 7); hand(X + 3, X + 6 + w, bodyTop - 5); }
  // body
  shape(rrect(X - 3.6, bodyTop, 7.2, 8.5, 2.6), shirt, P.ink, 0.9);
  if (tag) shape(rrect(X - 3.2, bodyTop + 4.5, 6.4, 1.6, 0.6), tag, null);
  if (arms === 'down' && !carry) { hand(X - 3.4, X - 4.4, bodyTop + 7.5); hand(X + 3.4, X + 4.4, bodyTop + 7.5); }
  if (carry) { // a box of work, held in front
    shape(rrect(X + flip * 3 - 3, bodyTop + 2.5, 6, 5, 0.8), C.orangeDim, P.ink, 0.8);
    shape(() => { ctx.moveTo(X + flip * 3 - 3, bodyTop + 4.3); ctx.lineTo(X + flip * 3 + 3, bodyTop + 4.3); }, null, P.ink, 0.5);
  }
  // head
  const hy = bodyTop - 4.6;
  if (kind.robot) {
    shape(rrect(X - 4.6, hy - 4.4, 9.2, 8.6, 2.2), col('s'), P.ink, 0.9);
    shape(rrect(X - 3.2 + flip * 0.6, hy - 1.6, 6.4, 2.6, 1.2), C.info, P.ink, 0.5);
    shape(() => { ctx.moveTo(X, hy - 4.4); ctx.lineTo(X, hy - 7); }, null, P.ink, 0.8);
    shape(circle(X, hy - 7.6, 1), (reduced || Math.floor(t / 400) % 2) ? C.red : P.ink, null);
  } else {
    shape(circle(X, hy, 4.8), col('s'), P.ink, 0.9);
    shape(() => { ctx.arc(X, hy - 0.4, 4.9, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(X + 2 * flip, hy - 2.6, X - 4.7, hy - 1.2); ctx.closePath(); }, col('h'), P.ink, 0.8);
    const blink = !reduced && (t / 1000 + seed * 5) % 4 < 0.12;
    if (st === 'idle') shape(() => { ctx.moveTo(X - 2.4 + flip, hy + 0.8); ctx.lineTo(X - 0.8 + flip, hy + 0.8); ctx.moveTo(X + 0.8 + flip, hy + 0.8); ctx.lineTo(X + 2.4 + flip, hy + 0.8); }, null, P.ink, 0.7);
    else if (!blink) { shape(circle(X - 1.6 + flip, hy + 0.6, 0.75), P.ink, null); shape(circle(X + 1.6 + flip, hy + 0.6, 0.75), P.ink, null); }
    if (st === 'cheer' || st === 'done') shape(() => ctx.arc(X + flip * 0.5, hy + 2, 1.4, 0.1, Math.PI - 0.1), null, P.ink, 0.6);
    if (kind.wings) for (const sgn of [-1, 1]) shape(poly([[X + sgn * 4.4, hy - 1], [X + sgn * 8, hy - 4.5], [X + sgn * 7, hy - 1], [X + sgn * 8.5, hy - 2], [X + sgn * 5, hy + 1]]), P.paper, P.ink, 0.6);
  }
  ctx.globalAlpha = 1;
  const top = hy - 6;
  if (a.showFresh && st !== 'working' && st !== 'blocked') { // just finished, not opened yet: green ✓ balloon
    const bxl = X - 5, byl = top - 12;
    shape(() => { ctx.roundRect(bxl, byl, 10, 9, 3); ctx.moveTo(X - 1, byl + 9); ctx.lineTo(X, byl + 12); ctx.lineTo(X + 1.5, byl + 9); }, C.green, P.ink, 0.9);
    txt('✓', X, byl + 4.8, 7, '#0A0A0A', 'center', 800);
  } else if (st === 'idle' || st === 'sleeping') { // Zz
    const p = reduced ? 0.3 : ((t / 2400 + seed) % 1);
    ctx.globalAlpha = 1 - p;
    txt('z', X + 6 + p * 3, top - p * 8, 4.5 + p * 2, st === 'sleeping' ? P.ink : C.greenInk);
    ctx.globalAlpha = 1;
  }
  if (st === 'blocked') { // balloon with a red "!"
    const bxl = X - 5, byl = top - 12;
    shape(() => { ctx.roundRect(bxl, byl, 10, 9, 3); ctx.moveTo(X - 1, byl + 9); ctx.lineTo(X, byl + 12); ctx.lineTo(X + 1.5, byl + 9); }, P.paper, P.ink, 0.9);
    txt('!', X, byl + 4.8, 7.5, C.red, 'center', 800);
  }
  if (st === 'done' || st === 'cheer') { // confetti
    for (let k = 0; k < 5; k++) {
      const p = reduced ? 0.5 : ((t / 1300 + k / 5 + seed) % 1);
      ctx.globalAlpha = 1 - p;
      const cx = X + (hash(k, i) - 0.5) * 18, cy = top - 4 - (1 - p) * 8 + p * 6;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(p * 6 + k);
      ctx.fillStyle = [C.yellow, C.red, C.info, C.green, C.orange][k]; ctx.fillRect(-1, -0.6, 2, 1.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  if (a.status === 'working' && a.since) { // time on the task, full at 30 min
    const f = Math.max(0.1, Math.min(1, (now() - a.since) / 1800000));
    shape(rrect(x - 8, fy + 11.5, 16, 2.6, 1.3), P.plate, P.ink, 0.6);
    shape(rrect(x - 8, fy + 11.5, 16 * f, 2.6, 1.3), C.orange, null);
  }
  return { x: X, top };
}

// ─── Archipelago: one small island per workspace ─────────────────────────────
const STATUS_ORDER = { blocked: 0, done: 1, working: 2, idle: 3, unknown: 4 };
function dotColor(st) { return { blocked: C.red, done: C.green, working: C.orange, idle: C.t3 }[st] || alpha(P.ink, 0.4); }

function miniHouse(cx, by, agents, number, t, flash) {
  const bw = 6, bh = 7 + Math.min(agents.length, 4) * 1.6;
  const any = s => agents.some(a => a.status === s);
  const working = any('working'), blocked = any('blocked'), done = any('done');
  const roof = P.roofs[(number - 1 + 6) % P.roofs.length];
  shape(poly([[cx, by + bw / 2], [cx + bw, by], [cx + bw + 4, by + 1.5], [cx + 3, by + bw / 2 + 2]]), P.shadow, null);
  shape(poly([[cx - bw, by], [cx, by + bw / 2], [cx, by + bw / 2 - bh], [cx - bw, by - bh]]), P.wallL, P.ink, 0.7);
  shape(poly([[cx, by + bw / 2], [cx + bw, by], [cx + bw, by - bh], [cx, by + bw / 2 - bh]]), P.wallR, P.ink, 0.7);
  const win = blocked ? (flash ? C.red : P.winOff) : working ? P.winOn : P.winOff;
  shape(poly([[cx - 4, by - bh + 3], [cx - 2, by - bh + 4], [cx - 2, by - bh + 6.5], [cx - 4, by - bh + 5.5]]), win, null);
  shape(poly([[cx + 2, by - bh + 4], [cx + 4, by - bh + 3], [cx + 4, by - bh + 5.5], [cx + 2, by - bh + 6.5]]), win, null);
  const ry = by - bh, A = [cx, ry - 6];
  shape(poly([[cx - bw - 1.5, ry], [cx, ry + bw / 2 + 1], A]), mix(roof, P.paper, 0.15), P.ink, 0.7);
  shape(poly([[cx, ry + bw / 2 + 1], [cx + bw + 1.5, ry], A]), mix(roof, P.ink, 0.3), P.ink, 0.7);
  if (working) {
    const p = reduced ? 0.4 : ((t / 1600) % 1);
    ctx.globalAlpha = 0.7 * (1 - p);
    shape(circle(cx + 3 + p * 3, ry - 5 - p * 6, 1 + p * 1.4), P.paper, null);
    ctx.globalAlpha = 1;
  }
  if (blocked) {
    if (flash) { ctx.globalAlpha = 0.35; shape(circle(A[0], A[1] - 2, 5), C.red, null); ctx.globalAlpha = 1; }
    shape(() => ctx.arc(A[0], A[1], 2, Math.PI, 0), flash ? C.red : C.redInk, P.ink, 0.6);
  } else if (done) {
    shape(() => { ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0], A[1] - 7); }, null, P.ink, 0.8);
    shape(poly([[A[0], A[1] - 7], [A[0] + 5, A[1] - 6], [A[0], A[1] - 4.5]]), C.green, P.ink, 0.5);
  }
  // one dot per agent under the house, worst news first
  const shown = [...agents].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)).slice(0, 4);
  shown.forEach((a, i) => {
    const x = cx + (i - (shown.length - 1) / 2) * 3.6;
    shape(circle(x, by + bw / 2 + 4, 1.3), dotColor(a.status), P.ink, 0.4);
  });
}

function gridLayout(W, list) {
  const pad = 10, gap = 10;
  const cols = W < 150 ? 1 : Math.max(2, Math.floor((W - 2 * pad + gap) / 150));
  const TW = Math.floor((W - 2 * pad - (cols - 1) * gap) / cols);
  const TH = Math.round(TW * 0.6) + 26;
  const tiles = list.map((ws, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    return { ws, x: pad + c * (TW + gap), y: HUD_H + 12 + r * (TH + gap), w: TW, h: TH };
  });
  const rows = Math.ceil(list.length / cols);
  return { W, H: HUD_H + 12 + rows * (TH + gap) + 14 + FOOT_H, tiles };
}

function drawTile(tile, byPane, t, flash) {
  const tabs = data.tabs.filter(tb => tb.ws === tile.ws.id).sort((a, b) => a.number - b.number);
  const houses = tabs.map(tab => ({ tab, agents: tab.panes.map(p => byPane.get(p.pane)).filter(Boolean) })).filter(h => h.agents.length);
  const agents = houses.flatMap(h => h.agents);
  const need = agents.filter(a => a.status === 'blocked').length;
  const work = agents.filter(a => a.status === 'working').length;
  const isl = { ws: tile.ws, x: tile.x + 8, y: tile.y + 4, w: tile.w - 16, h: tile.h - 26 - 10, lots: [], seed: seedOf(tile.ws.id) };
  // houses on a small grid in the middle of the grass
  // houses pack tighter on small tiles (phones) before any are folded into "+n"
  const sx = Math.max(13, Math.min(18, (isl.w - 18) / Math.max(1, houses.length))), sy = 19;
  const cols = Math.max(1, Math.floor((isl.w - 14) / sx)), rows = Math.max(1, Math.floor((isl.h - 10) / sy));
  const cap = Math.max(2, cols * rows);
  const list = houses.length > cap ? houses.slice(0, cap - 1) : houses;
  const extra = houses.length - list.length;
  const n = list.length + (extra ? 1 : 0);
  const usedRows = Math.max(1, Math.ceil(n / cols));
  const spots = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols);
    spots.push([isl.x + isl.w / 2 + (i % cols - (inRow - 1) / 2) * sx, isl.y + isl.h / 2 + (r - (usedRows - 1) / 2) * sy + 5]);
  }
  for (const [x, y] of spots) isl.lots.push({ x: x - 9, y: y - 16, w: 18, h: 24 });
  if (need) { // red glow under an island that needs you
    ctx.globalAlpha = flash ? 0.55 : 0.25;
    shape(blob(isl, 9, 6), C.red, null);
    ctx.globalAlpha = 1;
  }
  drawIsland(isl, t, true);
  list.forEach((h, i) => miniHouse(spots[i][0], spots[i][1], h.agents, h.tab.number, t, flash));
  if (extra) pill(L.more.replace('{0}', extra), spots[n - 1][0], spots[n - 1][1] - 4, 5, 22);
  // name + summary under the island
  const ly = tile.y + tile.h - 17;
  pill(wsName(tile.ws), tile.x + tile.w / 2, ly, 6, tile.w - 6, P.ink, P.paper);
  const sum = !agents.length ? L.noAgents : [agents.length === 1 ? L.agents1 : L.agents.replace('{0}', agents.length), work ? L.working.replace('{0}', work) : ''].filter(Boolean).join(' · ');
  txt(fit(sum, tile.w - 4, 4.8, 600), tile.x + tile.w / 2, ly + 10, 4.8, alpha(P.paper, 0.9), 'center', 600);
  if (need) { // "needs you" count on a red bubble
    const bx = isl.x + isl.w - 4, by = isl.y + 4, r = 6 + (reduced ? 0 : Math.sin(t / 200) * 0.6);
    shape(circle(bx, by, r), C.red, P.ink, 0.9);
    txt(String(need), bx, by + 0.3, 6.5, '#FFFFFF', 'center', 800);
  }
  if (focusRing === tile.ws.id) selection(tile.x + 2, tile.y, tile.w - 4, tile.h - 2, t);
  hits.push({ x: tile.x, y: tile.y, w: tile.w, h: tile.h, ws: tile.ws.id });
}

function selection(x, y, w, h, t) { // RTS selection brackets, breathing a little
  const g = reduced ? 0 : Math.sin(t / 250) * 0.8;
  x -= g; y -= g; w += 2 * g; h += 2 * g;
  ctx.strokeStyle = C.orange; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx + sx * 5, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * 5);
  }
  ctx.stroke();
}

function drawShore(lay, t) {
  const shore = lay.shore;
  if (!shore) return;
  const top = shore.y, bottom = top + shore.h;
  shape(() => {
    ctx.moveTo(0, top + 9); ctx.quadraticCurveTo(lay.W * 0.2, top + 1, lay.W * 0.42, top + 8);
    ctx.quadraticCurveTo(lay.W * 0.7, top + 16, lay.W, top + 5); ctx.lineTo(lay.W, bottom);
    ctx.lineTo(0, bottom); ctx.closePath();
  }, P.sand, P.ink, 0.9);
  shape(() => {
    ctx.moveTo(0, top + 8); ctx.quadraticCurveTo(lay.W * 0.25, top + 2, lay.W * 0.48, top + 10);
    ctx.quadraticCurveTo(lay.W * 0.75, top + 17, lay.W, top + 6);
  }, null, P.foam, 1.5);
  const title = fit(L.shoreTitle, lay.W - 14, 5.5, 700);
  txt(title, 7, top + 20, 5.5, P.ink, 'left', 700);
  const agents = data.sleeping || [];
  agents.forEach((item, i) => {
    const row = Math.floor(i / shore.cols), n = Math.min(shore.cols, agents.length - row * shore.cols);
    const col = i % shore.cols;
    const x = Math.round(lay.W / 2 + (col - (n - 1) / 2) * SLOT);
    const fy = top + 52 + row * 42;
    const sleeper = { ...item, pane: item.paneId, agent: item.agent || item.role || '_', status: 'sleeping', tags: [] };
    person(sleeper, x, fy, t, i);
    pill(item.name || item.paneId, x, fy + 7, 4.5, SLOT - 2, P.ink, P.paper);
    hits.push({ x: x - 15, y: fy - 30, w: 30, h: 42, pane: item.paneId, sleeping: true });
  });
}

function boat(W, y, t) {
  if (reduced) return;
  const x = ((t / 70) % (W + 60)) - 30, bob = Math.sin(t / 500) * 1.2;
  ctx.save(); ctx.translate(x, y + bob);
  shape(() => { ctx.moveTo(-11, -3); ctx.lineTo(11, -3); ctx.quadraticCurveTo(9, 3, 0, 3); ctx.quadraticCurveTo(-9, 3, -11, -3); ctx.closePath(); }, P.hull, P.ink, 1);
  shape(() => { ctx.moveTo(0, -3); ctx.lineTo(0, -20); }, null, P.ink, 1);
  shape(poly([[1, -19], [1, -5], [10, -5]]), P.paper, P.ink, 0.9);
  shape(poly([[1, -11], [1, -8], [6.5, -8], [5, -11]]), C.orange, null);
  shape(poly([[0, -20], [-5, -18.5], [0, -17]]), C.red, P.ink, 0.6);
  ctx.strokeStyle = P.curl; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(-20, 3); ctx.moveTo(-15, 4); ctx.lineTo(-22, 5.5); ctx.stroke();
  ctx.restore();
}

function gulls(W, t) {
  if (reduced) return;
  for (let k = 0; k < 2; k++) {
    const x = ((t / (45 + k * 15) + k * 200) % (W + 40)) - 20, y = 34 + k * 14 + Math.sin(t / 700 + k) * 4;
    const f = Math.sin(t / 140 + k) * 1.6;
    shape(() => { ctx.moveTo(x - 4, y - f); ctx.quadraticCurveTo(x - 2, y - 2 - f, x, y); ctx.quadraticCurveTo(x + 2, y - 2 - f, x + 4, y - f); }, null, P.paper, 1);
  }
}

function bevelBar(y, h, W) {
  ctx.fillStyle = P.bar; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = P.barHi; ctx.fillRect(0, y, W, 0.8);
  ctx.fillStyle = P.barLo; ctx.fillRect(0, y + h - 0.8, W, 0.8);
}

// ─── Frame ───────────────────────────────────────────────────────────────────
function draw() {
  if (box.hidden) return;
  const w = avail();
  if (w <= 0) return;
  scale = w >= 1500 ? 3 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.floor(w / scale);
  const cur = current();
  const overview = cur.multi && !cur.ws;
  const byPane = new Map(data.agents.map(a => [a.pane, a]));
  const lay = overview ? gridLayout(W, cur.list) : layout(W, cur.multi ? cur.ws : null);
  const cw = Math.round(lay.W * scale * dpr), chh = Math.round(lay.H * scale * dpr);
  if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
  canvas.style.width = lay.W * scale + 'px';
  canvas.style.height = lay.H * scale + 'px';
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  hits = [];
  const t = reduced ? 0 : performance.now();
  const flash = reduced || Math.floor(t / 400) % 2 === 0;

  drawSea(lay.W, lay.H, t);
  gulls(lay.W, t);
  if (overview) {
    const selWs = state.selected && wsOfPane(state.selected);
    focusRing = selWs || null;
    for (const tile of lay.tiles) drawTile(tile, byPane, t, flash);
  }
  for (const isl of lay.islands || []) {
    drawIsland(isl, t);
    for (const lot of isl.lots) {
      if (lot.empty) { emptyLot(lot); continue; }
      const b = building(lot, t, flash);
      const cap = Math.max(1, Math.floor(lot.w / SLOT));
      lot.agents.forEach((a, i) => {
        const r = Math.floor(i / cap), inRow = Math.min(cap, lot.agents.length - r * cap);
        const x = Math.round(b.bx + (i % cap - (inRow - 1) / 2) * SLOT);
        const fy = b.by + 30 + r * 32;
        const p = person(a, x, fy, t, i);
        pill(a.name || '?', x, fy + 6.5, 4.6, SLOT - 2, a.name ? P.ink : alpha(P.ink, 0.6));
        if (a.claim) { // who is on it: a little flag with their initial beside the character
          let [bg, ink] = [[C.blue, '#FFFFFF'], [C.yellow, '#0A0A0A'], [C.info, '#0A0A0A'], [P.paper, P.ink]][(a.claim.slot || 0) % 4];
          if (a.claim.team) { const g = ctx.createLinearGradient(x + 10, 0, x + 20, 0); g.addColorStop(0.5, C.blue); g.addColorStop(0.5, C.yellow); bg = g; ink = '#0A0A0A'; }
          const fx = x + 10, ftop = p.top - 4;
          shape(() => { ctx.moveTo(fx, fy - 1); ctx.lineTo(fx, ftop); }, null, P.ink, 1);
          shape(() => { ctx.moveTo(fx, ftop); ctx.lineTo(fx + 10, ftop + 1.5); ctx.lineTo(fx + 10, ftop + 7.5); ctx.lineTo(fx, ftop + 7); ctx.closePath(); }, bg, P.ink, 0.8);
          txt(a.claim.initial, fx + 5, ftop + 4.2, 5.2, ink, 'center', 800);
        }
        if (state.selected === a.pane) selection(x - 11, p.top - 3, 22, fy - p.top + 14, t);
        hits.push({ x: x - 15, y: fy - 30, w: 30, h: 40, pane: a.pane });
      });
    }
  }
  if (!overview && !lay.islands.length && !(data.sleeping || []).length) txt(L.none, lay.W / 2, HUD_H + 24, 7, P.paper);
  drawShore(lay, t);
  boat(lay.W, lay.shore ? lay.shore.y - 3 : lay.H - FOOT_H - 8, t);

  // Toolbar: title left, the date right
  bevelBar(0, HUD_H, lay.W);
  if (cur.multi && cur.ws) { // back sign + this island's name
    font(6, 700);
    const bw = ctx.measureText(L.back).width + 9;
    shape(rrect(4, 2.5, bw, HUD_H - 5, (HUD_H - 5) / 2), C.orange, P.ink, 0.8);
    txt(L.back, 4 + bw / 2, HUD_H / 2 + 0.4, 6, C.bg, 'center', 700);
    hits.push({ x: 0, y: 0, w: bw + 8, h: HUD_H, back: true });
    txt(fit(wsName(cur.ws), lay.W - bw - 90, 6.5, 800), bw + 10, HUD_H / 2 + 0.5, 6.5, C.orangeInk, 'left', 800);
  } else txt(L.title, 6, HUD_H / 2 + 0.5, 6.5, C.orangeInk, 'left', 800);
  const d = new Date(now());
  const date = d.toLocaleString(state.window.orcaLocale(lang), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  txt(date, lay.W - 6, HUD_H / 2 + 0.5, 5.5, C.t2, 'right', 600);

  // Info bar: the selected agent, or the news
  const fy = lay.H - FOOT_H;
  bevelBar(fy, FOOT_H, lay.W);
  const sel = data.agents.find(a => a.pane === state.selected);
  const need = data.agents.filter(a => a.status === 'blocked').length;
  let line, col = C.t1;
  if (state.offline) { line = L.offline; col = C.redInk; }
  else if (sel) line = `▸ ${sel.name || sel.pane} — ${L.st[sel.status] || L.st.unknown}${ago(sel.since)}`;
  else if (need) { line = need === 1 ? L.needs1 : L.needs.replace('{0}', need); col = flash ? C.redInk : C.t1; }
  else line = L.quiet;
  txt(fit(line, lay.W - 12, 6, 600), 6, fy + FOOT_H / 2 + 0.5, 6, col, 'left', 600);

  box.classList.toggle('alarm', need > 0 && flash);
}

function ago(since) {
  if (!since) return '';
  const m = Math.floor((now() - since) / 60000);
  return ' · ' + (m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm');
}

// ─── Keyboard + screen readers: the roster is the way in ────────────────────
function rosterBtn(label, fn) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', fn);
  li.append(b);
  return li;
}
function roster() {
  const cur = current();
  const byPane = new Map(data.agents.map(a => [a.pane, a]));
  const key = data.agents.map(a => a.pane + a.name + a.status).join('|') + state.lang + '|' + (cur.multi ? (cur.ws?.id ?? '*') + cur.list.map(w => w.id + wsName(w)).join(',') : '');
  if (rosterEl.dataset.key === key) return;
  const had = rosterEl.contains(document.activeElement);
  rosterEl.dataset.key = key;
  if (cur.multi && !cur.ws) {
    rosterEl.replaceChildren(...cur.list.map(ws => {
      const ag = agentsOf(ws.id, byPane), need = ag.filter(a => a.status === 'blocked').length;
      return rosterBtn(`${L.open.replace('{0}', wsName(ws))} (${ag.length === 1 ? L.agents1 : L.agents.replace('{0}', ag.length)}${need ? ', ' + (need === 1 ? L.needs1 : L.needs.replace('{0}', need)) : ''})`, () => setFocus(ws.id));
    }));
  } else {
    const list = cur.multi ? agentsOf(cur.ws.id, byPane) : data.agents;
    rosterEl.replaceChildren(...(cur.multi ? [rosterBtn(L.backAria, () => setFocus(null))] : []),
      ...list.map(a => rosterBtn(`${a.name || a.pane}: ${L.st[a.status] || L.st.unknown}`, () => onPick(a.pane))));
  }
  if (had) rosterEl.querySelector('button')?.focus();
}

function wsOfPane(pane) {
  return data.tabs.find(tb => tb.panes.some(p => p.pane === pane))?.ws ?? null;
}
function setFocus(id, quiet = false) {
  if (focus === id) return;
  focus = id;
  store.set(id);
  if (!quiet) {
    window.OrcaSound?.play(id ? 'focus' : 'switch');
    if (box.getBoundingClientRect().top < 0) box.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }
  roster();
  draw();
}

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
  const h = hits.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
  if (!h) return;
  if (h.back) setFocus(null);
  else if (h.ws) setFocus(h.ws);
  else (h.sleeping ? onSleepingPick : onPick)(h.pane);
});

function demo(d) { // ?demo: every state at once, drawing only
  d = { ...d, agents: d.agents.map(a => ({ ...a })) };
  const plan = ['blocked', 'working', 'done', 'working', 'idle', 'unknown'];
  d.agents.forEach((a, i) => {
    if (i < plan.length) a.status = plan[i];
    if (a.status === 'working') a.since = (d.now || Date.now()) - (i === 1 ? 12 : 26) * 60000;
  });
  return d;
}

readTokens();
new MutationObserver(() => { readTokens(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
new ResizeObserver(() => draw()).observe(box);
// Animation: ~12 frames a second while visible (none under reduced motion).
setInterval(() => { if (!document.hidden && !box.hidden && !reduced) draw(); }, 83);

window.OrcaIsland = {
  onPick(fn) { onPick = fn; },
  onSleepingPick(fn) { onSleepingPick = fn; },
  update(d, s) {
    if (d) { data = DEMO ? demo(d) : d; if (d.now) skew = d.now - Date.now(); }
    Object.assign(state, s);
    L = T[state.lang] || T.en;
    // A newly selected agent (tap in another view, keyboard next/prev, or one that needs you
    // opening by itself) brings its island on screen.
    if (state.selected && state.selected !== lastSelected && current().multi) {
      const ws = wsOfPane(state.selected);
      if (ws && ws !== focus) setFocus(ws, true);
    }
    lastSelected = state.selected;
    roster();
    draw();
  },
  show(on) {
    box.hidden = !on;
    if (!on) box.classList.remove('alarm');
    else draw();
  },
  clearFocus() { if (current().multi && current().ws) setFocus(null); },
  wave(pane) { waves.set(pane, Date.now() + 2200); draw(); setTimeout(draw, 2300); },
  rectOf(pane) {
    const h = hits.find(z => z.pane === pane);
    if (!h) return null;
    const r = canvas.getBoundingClientRect();
    return { top: r.top + h.y * scale, bottom: r.top + (h.y + h.h) * scale };
  },
};
})();
