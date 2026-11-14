'use strict';
// ORCA — 8-bit office view, the second way to see the map. Same live data: every
// workspace is a floor, every tab a room, every pane a desk, every agent a little worker.
// Drawn at low resolution on one canvas and scaled up with hard pixels. Colours are the
// Operio v3 tokens (tokens.css), read at runtime so the scene follows light/dark. No
// assets: sprites and the 3×5 font are data in this file. app.js owns the data and the
// panel; this file only draws and reports taps. Visible copy never names the tool.
(() => {

// ─── Palette: Operio v3 tokens only ──────────────────────────────────────────
const TOKENS = {
  bg: '--color-bg', surface: '--color-surface', surface2: '--color-surface-2', surface3: '--color-surface-3',
  t1: '--text-primary', t2: '--text-secondary', t3: '--text-tertiary', dim: '--text-dim',
  orange: '--color-orange', orangeDim: '--color-orange-dim', orangeBright: '--color-orange-bright', orangeStrong: '--color-orange-strong',
  green: '--color-green', red: '--color-red', yellow: '--color-yellow', blue: '--color-blue', info: '--color-info',
  orangeInk: '--color-orange-ink', greenInk: '--color-green-ink', redInk: '--color-red-ink',
};
const C = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const [k, v] of Object.entries(TOKENS)) C[k] = cs.getPropertyValue(v).trim() || '#888';
  // Lights on / lights off: a working desk glows warm, an idle one goes dark.
  const dark = rgb(C.bg).reduce((x, y) => x + y) < 384;
  C.warm = mix(C.orange, C.surface, dark ? 0.8 : 0.68); C.warmHi = mix(C.orange, C.surface, dark ? 0.6 : 0.45);
  C.alarm = mix(C.red, C.surface, 0.78); C.night = mix(C.surface, C.bg, 0.65);
  C.lamp = mix(C.yellow, C.surface, 0.55);
  // Character looks (token mixes): skin tones and hair colours.
  C.skins = [C.orangeBright, mix(C.orangeBright, C.orangeDim, 0.45), C.orangeDim, mix(C.orangeDim, C.bg, 0.4)];
  C.hairs = [C.dim, C.orangeDim, C.yellow, C.t3, mix(C.orangeDim, C.bg, 0.55), C.red, C.info, mix(C.t1, C.t3, 0.3)];
  C.caps = [C.red, C.blue, C.green, C.yellow, C.t1];
}
function rgb(c) {
  c = String(c).trim();
  if (c[0] === '#') { if (c.length === 4) c = '#' + [...c.slice(1)].map(x => x + x).join(''); const n = parseInt(c.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
const seedOf = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// Same tag hues, same order, as the map view.
const tagHue = slot => [C.blue, C.info, C.green, C.yellow, C.orangeStrong][slot % 5];

// ─── 3×5 font, 4 px advance ──────────────────────────────────────────────────
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000', '-': '000000111000000',
  _: '000000000000111', '/': '001001010100100', '!': '010010010000010', '?': '110001010000010', '#': '101111101111101',
  '>': '100010001010100', '<': '001010100010001', '+': '000010111010000', '=': '000111000111000', '(': '010100100100010',
  ')': '010001001001010', "'": '010010000000000', ',': '000000000010100', '*': '101010101000000', '[': '110100100100110',
  ']': '011001001001011',
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// ─── Sprites: 10 × 16, one pixel each ────────────────────────────────────────
// h hair/helmet · s skin · S skin shade · e eye · b shirt · B shirt shade · t tag stripe
// p trousers · f shoes · c chair · w wing
const SPRITES = {
  work: [
    '...hhhh...', '..hhhhhh..', '..hhhsss..', '..hhsses..', '...hssss..', '....sSs...',
    '..bbbbbb..', '.cbbbbbbss', '.cbbBbbb..', '.ctttbBb..', '.cbbbbbb..', '.cpppppppp',
    '.ccc...pp.', '..cc...pp.', '..c.c..pp.', '..c.c..fff',
  ],
  work2: [
    '...hhhh...', '..hhhhhh..', '..hhhsss..', '..hhsses..', '...hssss..', '....sSs...',
    '..bbbbbb..', '.cbbbbbbs.', '.cbbBbbbss', '.ctttbBb..', '.cbbbbbb..', '.cpppppppp',
    '.ccc...pp.', '..cc...pp.', '..c.c..pp.', '..c.c..fff',
  ],
  idle: [
    '..........', '...hhhh...', '..hhhhhh..', '..hhhhhss.', '...hhssss.', '....sss...',
    '..bbbbbb..', '.cbbbbbbb.', '.cbbBbbbss', '.ctttbBb..', '.cbbbbbb..', '.cpppppppp',
    '.ccc...pp.', '..cc...pp.', '..c.c..pp.', '..c.c..fff',
  ],
  ask: [
    '.......ss.', '...hhhhss.', '..hhhhhhb.', '..hhhsssb.', '..hhsesbb.', '...hsssb..',
    '....sSb...', '..bbbbbb..', '.sbbBbbb..', '.stttbBb..', '..bbbbbb..', '..pppppp..',
    '..ppp.pp..', '..pp..pp..', '..pp..pp..', '.fff..fff.',
  ],
  cheer: [
    'ss......ss', '.sb.hh.bs.', '..bhhhhb..', '..hhhsss..', '..hhsses..', '...hssss..',
    '....sSs...', '..bbbbbb..', '..bbBbbb..', '..tttbBb..', '..bbbbbb..', '..pppppp..',
    '..ppp.pp..', '..pp..pp..', '..pp..pp..', '.fff..fff.',
  ],
  sleep: [ // head down on the desk
    '..........', '..........', '..........', '..........', '....hhh...', '...hhhhh..',
    '..bhhhhhss', '.cbbbbbbss', '.cbbBbbb..', '.ctttbBb..', '.cbbbbbb..', '.cpppppppp',
    '.ccc...pp.', '..cc...pp.', '..c.c..pp.', '..c.c..fff',
  ],
  chair: [
    '..........', '..........', '..........', '..........', '..........', '..........',
    '..........', '.c........', '.c........', '.c........', '.c........', '.cccccc...',
    '.c....c...', '..c..c....', '..c..c....', '..c..c....',
  ],
};
// Where the head sits in each pose: T = the row with the 4-pixel hair top (x3–6); eye = [x, y].
const HEAD = { work: { T: 0, eye: [6, 3] }, work2: { T: 0, eye: [6, 3] }, idle: { T: 1 }, ask: { T: 1, eye: [5, 4] }, cheer: { T: 2, eye: [6, 4] }, sleep: { T: 4 } };
const STYLES = ['short', 'long', 'bun', 'mohawk', 'cap', 'bald', 'short', 'long'];
const ACCS = ['none', 'glasses', 'headphones', 'beard', 'none', 'glasses'];
// Every agent gets its own look from its name: hair style, hair colour, skin tone, accessory.
// The shirt stays the agent kind's colour, so the type still reads at a glance.
function lookOf(a) {
  const h = seedOf(a.name || a.pane);
  return { style: STYLES[h % STYLES.length], hair: C.hairs[(h >>> 3) % C.hairs.length], skin: C.skins[(h >>> 7) % C.skins.length],
           acc: ACCS[(h >>> 10) % ACCS.length], cap: C.caps[(h >>> 13) % C.caps.length] };
}
function dress(look, pose, x, y, pal, kind) {
  const H = HEAD[pose]; if (!H) return;
  const T = H.T, p = (dx, dy, c) => px(x + dx, y + T + dy, 1, 1, c);
  if (!kind.wings && !kind.robot) {
    if (look.style === 'long' && pose !== 'sleep') { p(2, 4, pal.h); p(2, 5, pal.h); p(3, 5, pal.h); }
    if (look.style === 'bun') { p(3, -1, pal.h); p(4, -1, pal.h); p(3, -2, pal.h); p(4, -2, pal.h); }
    if (look.style === 'mohawk') { p(4, -1, pal.h); p(5, -1, pal.h); p(4, -2, pal.h); }
    if (look.style === 'cap') { for (let i = 3; i <= 6; i++) p(i, 0, look.cap); for (let i = 2; i <= 7; i++) p(i, 1, look.cap); if (pose !== 'sleep') { p(8, 1, look.cap); p(9, 1, look.cap); } }
  }
  if (pose === 'sleep' || kind.robot) return;
  if (look.acc === 'glasses' && H.eye) { const [ex, ey] = H.eye; px(x + ex - 1, y + ey, 1, 1, C.bg); px(x + ex, y + ey, 1, 1, C.info); px(x + ex + 1, y + ey, 1, 1, C.bg); }
  if (look.acc === 'headphones' && !kind.wings) { for (let i = 3; i <= 6; i++) p(i, -1, C.dim); p(2, 2, C.red); p(2, 3, C.red); p(1, 2, C.dim); p(1, 3, C.dim); }
  if (look.acc === 'beard' && H.eye) { const [ex, ey] = H.eye; px(x + ex - 2, y + ey + 2, 1, 1, pal.h); px(x + ex - 1, y + ey + 2, 1, 1, pal.h); px(x + ex - 1, y + ey + 1, 1, 1, pal.h); }
}
// Agent kind = character. Values are token keys; unknown kinds get a plain worker.
const KINDS = {
  claude:   { h: 'orangeDim', s: 'orangeBright', S: 'orange', e: 'blue', b: 'orangeStrong', B: 'orangeDim', p: 't3', f: 'dim' },
  hermes:   { h: 'yellow', s: 'orangeBright', S: 'orange', e: 'blue', b: 'info', B: 'blue', p: 't3', f: 'dim', w: 't1', wings: true },
  codex:    { h: 't3', s: 't2', S: 't3', e: 'info', b: 'dim', B: 't3', p: 't3', f: 'dim', robot: true },
  opencode: { h: 'dim', s: 'orangeBright', S: 'orange', e: 'blue', b: 'green', B: 'greenInk', p: 't3', f: 'dim' },
  agy:      { h: 't1', s: 'orangeBright', S: 'orange', e: 'blue', b: 'blue', B: 'info', p: 't3', f: 'dim' },
  _:        { h: 'dim', s: 'orangeBright', S: 'orange', e: 'blue', b: 't2', B: 't3', p: 't3', f: 'dim' },
};

// Walking poses for the tower (standing, legs apart / together). Same head rows as 'work'.
SPRITES.walk1 = [
  '...hhhh...', '..hhhhhh..', '..hhhsss..', '..hhsses..', '...hssss..', '....sSs...',
  '..bbbbbb..', '.sbbBbbbs.', '.sbbbbbbs.', '..tttbBb..', '..bbbbbb..', '..pppppp..',
  '..pp..pp..', '.pp....pp.', '.pp....pp.', 'fff....fff',
];
SPRITES.walk2 = [
  '...hhhh...', '..hhhhhh..', '..hhhsss..', '..hhsses..', '...hssss..', '....sSs...',
  '..bbbbbb..', '..bbBbbbs.', '.sbbbbbbs.', '.stttbBb..', '..bbbbbb..', '..pppppp..',
  '...pppp...', '...pp.pp..', '...pp.pp..', '..fff.fff.',
];
SPRITES.ride = [ // standing still in the lift
  '...hhhh...', '..hhhhhh..', '..hhhsss..', '..hhsses..', '...hssss..', '....sSs...',
  '..bbbbbb..', '.sbbBbbbs.', '.sbbbbbbs.', '..tttbBb..', '..bbbbbb..', '..pppppp..',
  '..pp..pp..', '..pp..pp..', '..pp..pp..', '.fff..fff.',
];

// ─── Copy (EN / ES) ──────────────────────────────────────────────────────────
const T = {
  en: { title: 'ORCA', floor: 'FLOOR', dark: 'NO AGENTS ON THIS FLOOR', lobby: 'LOBBY',
        ready: 'READY.', none: 'NO AGENTS YET. PRESS NEW.', offline: '?CONNECTION ERROR',
        need1: '{0} NEEDS YOU', needN: '{0} NEED YOU', counts: '{0} WORKING · {1} IDLE · {2} NEED YOU',
        st: { working: 'WORKING', idle: 'IDLE', blocked: 'NEEDS YOU', done: 'DONE', unknown: 'STARTING' } },
  es: { title: 'ORCA', floor: 'PISO', dark: 'SIN AGENTES EN ESTE PISO', lobby: 'LOBBY',
        ready: 'LISTO.', none: 'AUN NO HAY AGENTES. TOCA NUEVO.', offline: '?ERROR DE CONEXION',
        need1: '{0} TE NECESITA', needN: '{0} TE NECESITAN', counts: '{0} TRABAJANDO · {1} LIBRES · {2} TE NECESITAN',
        st: { working: 'TRABAJANDO', idle: 'LIBRE', blocked: 'TE NECESITA', done: 'TERMINO', unknown: 'INICIANDO' } },
};

GLYPHS['·'] = '000000010000000';
GLYPHS['&'] = '010101010101011';

// ─── Tower geometry (logical pixels) ─────────────────────────────────────────
// The building is cut open from the side: sky and roof on top, one floor per workspace
// (map order: the map's first box is the top floor), the lift shaft on the right, the
// lobby at street level. Phone: 3× pixels, narrower desks, floor name on a strip.
const SKY_H = 30, ROOF_H = 7, LOBBY_H = 36, STREET_H = 5, ROOM_HEAD = 9, SLOT_H = 32, CAR_H = 17;
const geo = phone => phone
  ? { M: 3, GUT: 0, LBL: 9, SLOT_W: 40, ELEV_W: 13 }
  : { M: 8, GUT: 44, LBL: 0, SLOT_W: 52, ELEV_W: 15 };
const DEMO = new URLSearchParams(location.search).has('demo');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ON_RED = '#FFFFFF'; // text on the red flag (same as --on-red)
// Walks and rides take a fixed-feeling time, not a fixed speed, so a wide desktop isn't slow.
const walkSecs = dist => Math.min(2.2, Math.max(0.6, dist / 90));
const carSpeed = dy => Math.max(160, Math.abs(dy) / 2.2); // logical px per second

const box = document.getElementById('office');
const canvas = document.getElementById('world');
const rosterEl = document.getElementById('roster');
const ctx = canvas.getContext('2d');
let data = { agents: [], tabs: [], workspaces: [], tagColors: {}, mapOrder: [] };
let state = { selected: null, lang: 'en', offline: false, matches: () => true };
let L = T.en;
let hits = [];          // desks [{ x, y, w, h, pane }] and the roof flag [{ ..., flag: true }]
let floorHits = [];     // [{ y0, y1, ws }]
let scale = 2;
let skew = 0;
let lay = null;         // last layout
let onPick = () => {};
let onHover = () => {};
const waves = new Map();   // pane -> until: the worker cheers (show on desktop, or a job just finished)
const popups = [];         // { pane, glyph, col, t0 } — a ✓ or ! rising over a desk
const trips = [];          // queued walks/rides (one lift, one trip at a time)
const lastDesk = new Map(); // terminal -> { x, y, ws, row } last place seen (for agents that leave)
let prevSeen = null;        // terminal -> { status, ws, pane }; null until the first update
let hoverWs = null, hoverPane = null;
const car = { y: null };
let tick = 0;

// ─── Drawing primitives ──────────────────────────────────────────────────────
const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
function text(str, x, y, col, max = Infinity, big = 1) {
  let s = norm(str);
  if (s.length > max) s = s.slice(0, Math.max(1, max - 1)) + '.';
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const g = GLYPHS[s[i]] || GLYPHS['?'];
    for (let b = 0; b < 15; b++) if (g[b] === '1') ctx.fillRect(x + (i * 4 + (b % 3)) * big, y + Math.floor(b / 3) * big, big, big);
  }
  return s.length * 4 * big;
}
const textW = (s, max = Infinity) => Math.min(norm(s).length, max) * 4;
function sprite(rows, x, y, pal, dither = false, flip = false) {
  rows.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (!col || (dither && (r + i) % 2)) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + (flip ? row.length - 1 - i : i), y + r, 1, 1);
    }
  });
}

// ─── Fit ─────────────────────────────────────────────────────────────────────
function avail() {
  const cs = getComputedStyle(box);
  return Math.min(box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), 1800);
}
const isPhone = w => w < 600;
const scaleFor = () => 2; // phone too: 3 desks fit across a room, names stay readable

// Map order → floor order and room order (same rule as the map: saved order first).
function ordered() {
  const pos = new Map((data.mapOrder || []).map((id, i) => [id, i]));
  const wsRank = new Map((data.workspaces || []).map((w, i) => [w.id, i]));
  const tabs = [...data.tabs].map((t, i) => [t, pos.has(t.id) ? pos.get(t.id) : 1e6 + (wsRank.get(t.ws) ?? 99) * 1000 + (t.number ?? i)])
    .sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const wsList = data.workspaces.length ? data.workspaces : [...new Set(data.tabs.map(t => t.ws))].map((id, i) => ({ id, number: i + 1 }));
  const first = new Map();
  tabs.forEach((t, i) => { if (!first.has(t.ws)) first.set(t.ws, i); });
  const floors = [...wsList].sort((a, b) => (first.get(a.id) ?? 1e9) - (first.get(b.id) ?? 1e9));
  return { floors, tabs };
}

function layout(w) {
  const phone = isPhone(w);
  const g = geo(phone);
  const W = Math.max(110, Math.floor(w / scaleFor(w)));
  const byPane = new Map(data.agents.map(a => [a.pane, a]));
  const bx0 = g.M, bx1 = W - g.M;
  const shaftX = bx1 - 2 - g.ELEV_W;
  const roomX0 = bx0 + 2 + g.GUT + 3, roomX1 = shaftX - 3;
  const perRow = Math.max(1, Math.floor((roomX1 - roomX0 - 6) / g.SLOT_W));
  const { floors: wsOrder, tabs } = ordered();
  const floors = [];
  let y = SKY_H + ROOF_H;
  const desks = new Map(); // pane -> { x, y, ws, rowY }
  wsOrder.forEach((ws, fi) => {
    const own = tabs.filter(t => t.ws === ws.id);
    const busy = own.filter(t => t.panes.some(p => byPane.has(p.pane)));
    const f = { ws, y, rooms: [], dark: !busy.length, number: wsOrder.length - fi };
    let cy = y + 3 + g.LBL;
    if (f.dark) cy += 14;
    else {
      let cx = roomX0, rowH = 0;
      for (const tab of busy) {
        const panes = [...tab.panes].sort((a, b) => a.y - b.y || a.x - b.x);
        const cols = Math.min(panes.length, perRow), rows = Math.ceil(panes.length / perRow);
        const rw = cols * g.SLOT_W + 6, rh = ROOM_HEAD + rows * SLOT_H + 3;
        if (cx > roomX0 && cx + rw > roomX1) { cy += rowH + 4; cx = roomX0; rowH = 0; }
        const room = { tab, panes, x: cx, y: cy, w: rw, h: rh };
        panes.forEach((p, i) => {
          const dx = cx + 3 + (i % perRow) * g.SLOT_W, dy = cy + ROOM_HEAD + Math.floor(i / perRow) * SLOT_H;
          desks.set(p.pane, { x: dx, y: dy, ws: ws.id });
        });
        f.rooms.push(room);
        cx += rw + 4; rowH = Math.max(rowH, rh);
      }
      cy += rowH;
    }
    f.h = cy + 3 - y;
    f.bottom = y + f.h;
    floors.push(f);
    y = f.bottom + 2; // slab
  });
  const lobbyY = y;
  return { W, H: lobbyY + LOBBY_H + STREET_H, g, phone, bx0, bx1, shaftX, floors, desks, byPane, lobbyY };
}
const floorOf = (l, ws) => l.floors.find(f => f.ws.id === ws);
const carStop = (l, ws) => { const f = ws && floorOf(l, ws); return (f ? f.bottom : l.lobbyY + LOBBY_H - 2) - CAR_H; };

// ─── Clock: the sky follows the real time where you are ──────────────────────
const localHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

// ─── Scene ───────────────────────────────────────────────────────────────────
const now = () => Date.now() + skew;
function ago(since) {
  if (!since) return '';
  const m = Math.floor((now() - since) / 60000);
  return m < 60 ? m + 'M' : Math.floor(m / 60) + 'H' + String(m % 60).padStart(2, '0');
}
function palFor(a) {
  const kind = KINDS[a.agent] || KINDS._;
  const pal = Object.fromEntries(Object.entries(kind).filter(([k]) => k.length === 1).map(([k, v]) => [k, C[v]]));
  const look = lookOf(a);
  if (!kind.robot) { pal.s = look.skin; pal.S = mix(look.skin, C.bg, 0.25); }
  if (!kind.robot && !kind.wings) pal.h = look.style === 'bald' ? pal.s : look.hair;
  pal.c = C.dim;
  pal.t = a.tags?.length ? tagHue(data.tagColors?.[a.tags[0]] ?? 0) : pal.b;
  return { pal, look, kind };
}

function drawSky(l) {
  const h = localHour();
  const night = h < 6 || h >= 20, dusk = (h >= 18 && h < 20) || (h >= 6 && h < 7);
  const top = night ? mix(C.blue, C.bg, 0.86) : dusk ? mix(C.orange, C.bg, C.dark ? 0.55 : 0.35) : mix(C.info, C.dark ? C.bg : C.surface, C.dark ? 0.55 : 0.6);
  const low = night ? mix(C.blue, C.bg, 0.75) : dusk ? mix(C.orangeBright, C.surface, 0.45) : mix(C.info, C.dark ? C.bg : C.surface, C.dark ? 0.68 : 0.78);
  const bands = 5;
  for (let i = 0; i < bands; i++) px(0, Math.floor(i * SKY_H / bands), l.W, Math.ceil(SKY_H / bands) + 1, mix(top, low, i / (bands - 1)));
  if (night) { // stars, a few twinkle
    for (let i = 0; i < Math.floor(l.W / 9); i++) {
      const sx = (seedOf('s' + i) % l.W), sy = 2 + (seedOf('y' + i) % (SKY_H - 6));
      if (!reduced && (i + tick) % 7 === 0) continue;
      px(sx, sy, 1, 1, (i % 5) ? C.t3 : C.t1);
    }
  } else if (!dusk) { // two clouds drifting
    for (let k = 0; k < 2; k++) {
      const span = l.W + 30;
      const cx = ((reduced ? 40 + k * 120 : Math.floor(now() / 1000 / (6 + k * 3)) + k * 157) % span) - 20;
      const cy = 6 + k * 9;
      const col = C.dark ? mix(C.t3, C.bg, 0.3) : C.surface;
      px(cx, cy + 2, 16, 3, col); px(cx + 3, cy, 7, 2, col); px(cx + 9, cy + 1, 4, 1, col);
    }
  }
  // Sun or moon on an arc across the sky
  const f = night ? ((h + 4) % 24) / 10 : (h - 6) / 14;
  const ax = Math.round(l.bx0 + 8 + Math.max(0, Math.min(1, f)) * (l.W - 2 * l.bx0 - 24));
  const ay = Math.round(4 + Math.pow(2 * Math.max(0, Math.min(1, f)) - 1, 2) * 10);
  if (night) { px(ax + 1, ay, 4, 6, C.t1); px(ax, ay + 1, 1, 4, C.t1); px(ax + 3, ay, 3, 5, top); }
  else { px(ax + 1, ay, 4, 6, C.yellow); px(ax, ay + 1, 6, 4, C.yellow); if (!dusk) px(ax + 1, ay + 1, 2, 1, C.orangeBright); }
  return { night, dusk };
}

function drawRoof(l, sky) {
  const y = SKY_H;
  const facade = sky.night ? mix(C.surface3, C.bg, 0.45) : C.surface3;
  px(l.bx0, y, l.bx1 - l.bx0, ROOF_H, facade);
  px(l.bx0 - 1, y, l.bx1 - l.bx0 + 2, 2, C.dim);                       // parapet
  px(l.bx0, y + ROOF_H - 1, l.bx1 - l.bx0, 1, C.dim);
  // Lift machine room on top of the shaft
  px(l.shaftX - 1, y - 7, l.g.ELEV_W + 2, 7, C.dim); px(l.shaftX + 1, y - 5, l.g.ELEV_W - 2, 3, facade);
  // Antenna with a blinking light
  const ax = l.bx0 + 6;
  px(ax, y - 13, 1, 13, C.dim); px(ax - 2, y - 9, 5, 1, C.dim);
  px(ax - 1, y - 15, 3, 2, (reduced || tick % 2) ? C.red : C.redInk);
  // Neon sign: ORCA, centred on the roof
  const sw = textW(L.title) + 6, sx = Math.floor((l.bx0 + l.shaftX - sw) / 2), sy = y - 10;
  px(sx, sy, sw, 9, C.bg); px(sx, sy + 9, 1, 1, C.dim); px(sx + sw - 1, sy + 9, 1, 1, C.dim);
  text(L.title, sx + 3, sy + 2, sky.night || (tick % 8) ? C.orange : C.orangeDim);
  // Flag: someone needs you — tap to open them
  const need = data.agents.filter(a => a.status === 'blocked');
  if (need.length) {
    const label = (need.length === 1 ? L.need1 : L.needN).replace('{0}', need.length);
    const fw = textW(label) + 6, fx = Math.min(l.shaftX - fw - 4, sx + sw + 8), fy = y - 13;
    const on = reduced || tick % 2;
    px(fx - 2, fy, 1, 13, C.dim);
    px(fx, fy, fw, 9, on ? C.red : C.redInk);
    text(label, fx + 3, fy + 2, ON_RED);
    hits.push({ x: fx - 2, y: fy, w: fw + 2, h: 13, flag: true, pane: need[0].pane });
  }
}

function drawDesk(x0, y0, pane, a, empty) {
  const g = lay.g;
  const ox = Math.floor((g.SLOT_W - 30) / 2);
  const dx = x0 + ox;
  const yb = y0 + SLOT_H - 1;
  const status = a ? (empty ? 'away' : a.status) : 'shell';
  const waving = (waves.get(pane) || 0) > Date.now();
  // Desk lamp: on while working (a pool of light on the desk), off otherwise.
  px(dx + 27, yb - 15, 1, 7, C.dim); px(dx + 25, yb - 16, 3, 1, C.dim);
  if (status === 'working') { px(dx + 25, yb - 15, 2, 1, C.yellow); px(dx + 23, yb - 9, 7, 1, C.lamp); }
  // Desk: top, front edge, legs; keyboard; monitor with bezel, stand and base.
  px(dx + 10, yb - 8, 20, 1, C.orangeDim);
  px(dx + 10, yb - 7, 20, 1, C.dim);
  px(dx + 11, yb - 6, 1, 7, C.dim);
  px(dx + 28, yb - 6, 1, 7, C.dim);
  px(dx + 11, yb - 9, 4, 1, C.t2);
  px(dx + 17, yb - 17, 11, 7, C.t3);
  px(dx + 22, yb - 10, 1, 1, C.dim);
  px(dx + 20, yb - 9, 5, 1, C.dim);
  const flash = !reduced && tick % 2;
  const screen = { working: C.orange, idle: C.bg, blocked: flash ? C.red : C.redInk, done: C.green, unknown: C.surface3, shell: C.bg, away: C.bg }[status] || C.bg;
  px(dx + 18, yb - 16, 9, 5, waving ? (flash ? C.orangeBright : C.orange) : screen);
  if (waving) {
    const k = reduced ? 0 : tick % 2;
    px(dx + 16 - k, yb - 19 + k, 1, 1, C.orangeBright); px(dx + 28 + k, yb - 19 + k, 1, 1, C.orangeBright);
    px(dx + 22, yb - 21 - k, 1, 1, C.yellow);
  } else if (status === 'working') { // code scrolling up the lit screen
    const fr = Math.floor(now() / 180);
    for (let r = 0; r < 4; r++) px(dx + 19 + (r % 2), yb - 16 + r, 2 + ((r * 3 + fr) % 6), 1, C.bg);
  } else if (status === 'idle') {
    if (reduced || tick % 2) px(dx + 26, yb - 12, 1, 1, C.green);
  } else if (status === 'done') {
    px(dx + 20, yb - 14, 1, 1, C.bg); px(dx + 21, yb - 13, 1, 1, C.bg); px(dx + 22, yb - 14, 1, 1, C.bg); px(dx + 23, yb - 15, 1, 1, C.bg);
  }
  if (status === 'shell' || status === 'away') {
    if (status === 'shell' && !reduced && tick % 2) px(dx + 19, yb - 13, 2, 1, C.t2);
    sprite(SPRITES.chair, dx + 1, yb - 15, { c: C.dim });
    if (status === 'shell') return;
  } else {
    const { pal, look, kind } = palFor(a);
    const pose = waving ? 'cheer' : status === 'working' ? (!reduced && Math.floor(now() / 260) % 2 ? 'work2' : 'work')
      : status === 'blocked' ? 'ask' : status === 'done' ? 'cheer' : status === 'idle' ? 'sleep' : 'idle';
    const bounce = status === 'blocked' && !reduced ? (Math.floor(now() / 220) % 2) : 0;
    const sy = yb - 15 - bounce;
    sprite(SPRITES[pose], dx + 1, sy, pal, status === 'unknown' || !state.matches(a));
    dress(look, pose, dx + 1, sy, pal, kind);
    if (kind.wings) { const wy = sy + (pose === 'idle' || pose === 'cheer' ? 2 : 1); px(dx + 2, wy, 1, 1, pal.w); px(dx + 1, wy - 1, 1, 2, pal.w); }
    // Status mark above the head
    const mx = dx + 3, my = y0 + 8;
    if (status === 'blocked') {
      px(mx, my - bounce, 7, 6, C.t1); px(mx + 1, my + 6 - bounce, 2, 1, C.t1);
      px(mx + 3, my + 1 - bounce, 1, 2, C.red); px(mx + 3, my + 4 - bounce, 1, 1, C.red);
    } else if (a.showFresh && status !== 'working') {
      px(mx - 1, my, 9, 7, C.green); px(mx + 2, my + 7, 2, 1, C.green);
      px(mx + 1, my + 3, 1, 1, C.bg); px(mx + 2, my + 4, 1, 1, C.bg); px(mx + 3, my + 3, 1, 1, C.bg);
      px(mx + 4, my + 2, 1, 1, C.bg); px(mx + 5, my + 1, 1, 1, C.bg);
    } else if (status === 'idle') {
      const lift = reduced ? 0 : Math.floor(now() / 700) % 3;
      text('Z', mx + 5, my + 3 - lift, C.greenInk);
      px(mx + 2, my + 7 - lift, 2, 1, C.greenInk);
    } else if (status === 'working') {
      const k = reduced ? 0 : Math.floor(now() / 200) % 3;
      px(dx + 19 + k * 2, yb - 19, 1, 1, C.orangeBright); px(dx + 25 - k, yb - 20, 1, 1, C.orange);
      if (a.since) {
        const f = Math.max(0.1, Math.min(1, (now() - a.since) / 1800000));
        px(x0 + 1, y0 + 7, g.SLOT_W - 2, 1, C.surface3);
        px(x0 + 1, y0 + 7, Math.round((g.SLOT_W - 2) * f), 1, C.orange);
      }
    }
  }
  // Name tag (as long as the desk allows; the hover card has the rest)
  const max = Math.floor((g.SLOT_W - 2) / 4);
  const name = a.name || '?';
  const nw = textW(name, max);
  const nameCol = !a.name ? C.t3 : { working: C.orangeInk, blocked: C.redInk, done: C.greenInk, idle: C.t3, away: C.t3 }[status] || C.t1;
  text(name, x0 + Math.floor((g.SLOT_W - nw) / 2), y0 + 1, nameCol, max);
  if (a.claim && !empty) {
    const [bg, ink] = a.claim.team ? [C.yellow, C.bg] : [[C.blue, C.t1], [C.yellow, C.bg], [C.info, C.bg], [C.t1, C.bg]][(a.claim.slot || 0) % 4];
    px(x0 + g.SLOT_W - 9, y0 + 9, 8, 7, bg);
    if (a.claim.team) px(x0 + g.SLOT_W - 9, y0 + 9, 4, 7, C.blue);
    text(a.claim.initial, x0 + g.SLOT_W - 7, y0 + 10, ink, 1);
  }
  const sel = state.selected === pane, hov = hoverPane === pane;
  if (sel || hov) { // corner brackets
    const col = sel ? C.orange : C.t3, x1 = x0 - 1, y1 = y0 - 1, w = g.SLOT_W + 1, h = SLOT_H + 1;
    for (const [cx, cy, ddx, ddy] of [[x1, y1, 1, 1], [x1 + w, y1, -1, 1], [x1, y1 + h, 1, -1], [x1 + w, y1 + h, -1, -1]]) {
      px(Math.min(cx, cx + ddx * 3), cy, 4, 1, col); px(cx, Math.min(cy, cy + ddy * 3), 1, 4, col);
    }
  }
}

function drawFloors(l, sky) {
  const facade = sky.night ? mix(C.surface3, C.bg, 0.45) : C.surface3;
  const away = new Set(trips.flatMap(t => t.hidePanes || []));
  for (const f of l.floors) {
    const hov = hoverWs === f.ws.id;
    px(l.bx0, f.y, l.bx1 - l.bx0, f.h, f.dark ? mix(C.bg, facade, 0.35) : facade);
    px(l.bx0, f.y, 2, f.h, C.dim); px(l.bx1 - 2, f.y, 2, f.h, C.dim);                         // outer walls
    px(l.bx0, f.bottom, l.bx1 - l.bx0, 2, C.dim);                                               // slab
    // Floor sign: big number + name in the left gutter (desktop) or a strip (phone)
    const name = f.ws.label || ('#' + f.ws.number);
    const signCol = f.dark ? C.t3 : hov ? C.orange : C.orangeInk;
    if (l.g.GUT) {
      text(String(f.number), l.bx0 + 6, f.y + 4, signCol, 3, 2);
      text(name, l.bx0 + 6, f.y + 17, f.dark ? C.t3 : C.t2, Math.floor((l.g.GUT - 4) / 4));
      px(l.bx0 + 2 + l.g.GUT, f.y + 2, 1, f.h - 4, C.dim);
    } else {
      text(`${f.number} ${name}`, l.bx0 + 5, f.y + 3, signCol, Math.floor((l.shaftX - l.bx0 - 10) / 4));
    }
    if (f.dark) {
      const msg = L.dark, x = l.bx0 + 2 + l.g.GUT + 6;
      text(msg, x, f.y + 3 + l.g.LBL + 4, C.t3, Math.floor((l.shaftX - x - 4) / 4));
      continue;
    }
    for (const r of f.rooms) {
      const ags = r.panes.map(p => l.byPane.get(p.pane)).filter(Boolean);
      const blocked = ags.some(a => a.status === 'blocked'), working = ags.some(a => a.status === 'working');
      const on = reduced || tick % 2;
      const light = blocked ? (on ? C.alarm : mix(C.alarm, C.night, 0.5)) : working ? C.warm : C.night;
      px(r.x, r.y, r.w, r.h, light);
      if (working || blocked) px(r.x + 2, r.y + 1, r.w - 4, 1, blocked ? C.red : C.warmHi); // ceiling light
      px(r.x, r.y, r.w, 1, C.dim); px(r.x, r.y, 1, r.h, C.dim); px(r.x + r.w - 1, r.y, 1, r.h, C.dim);
      px(r.x, r.y + r.h - 1, r.w, 1, C.dim);
      const label = r.tab.label || '#' + r.tab.number;
      text(label, r.x + 3, r.y + 2, C.t2, Math.floor((r.w - 12) / 4));
      text(String(ags.length), r.x + r.w - 3 - textW(String(ags.length)), r.y + 2, C.t1);
      for (const p of r.panes) {
        const d = l.desks.get(p.pane);
        const a = l.byPane.get(p.pane);
        drawDesk(d.x, d.y, p.pane, a, a && away.has(p.pane));
        if (a) hits.push({ x: d.x, y: d.y, w: l.g.SLOT_W, h: SLOT_H, pane: p.pane });
      }
    }
    floorHits.push({ y0: f.y, y1: f.bottom, ws: f.ws.id });
  }
}

function drawShaft(l) {
  const top = SKY_H, bottom = l.lobbyY + LOBBY_H;
  px(l.shaftX, top, l.g.ELEV_W, bottom - top, mix(C.bg, C.dim, 0.35));
  px(l.shaftX, top, 1, bottom - top, C.dim); px(l.shaftX + l.g.ELEV_W - 1, top, 1, bottom - top, C.dim);
  // Cables + the car
  const cy = Math.round(car.y);
  const cx = l.shaftX + 2, cw = l.g.ELEV_W - 4;
  px(cx + Math.floor(cw / 2), top, 1, Math.max(0, cy - top), C.t3);
  px(cx, cy, cw, CAR_H, C.surface); px(cx, cy, cw, 1, C.orange); px(cx, cy + CAR_H - 1, cw, 1, C.orange);
  px(cx, cy, 1, CAR_H, C.orange); px(cx + cw - 1, cy, 1, CAR_H, C.orange);
  if (!trips[0]?.riding) px(cx + Math.floor(cw / 2), cy + 4, 1, CAR_H - 5, C.dim); // closed doors
  px(cx + 2, cy + 2, cw - 4, 1, C.lamp);
  const rider = trips[0]?.riding;
  if (rider) sprite(SPRITES.ride, cx + Math.floor((cw - 10) / 2), cy + 1, rider.pal);
  // Floor indicator lights on the shaft wall
  for (const f of l.floors) px(l.shaftX - 2, f.bottom - CAR_H + 2, 1, 2, Math.abs(car.y - (f.bottom - CAR_H)) < 2 ? C.orange : C.dim);
}

function drawLobby(l, sky) {
  const y = l.lobbyY;
  px(l.bx0, y, l.bx1 - l.bx0, LOBBY_H, sky.night ? mix(C.surface2, C.bg, 0.3) : C.surface2);
  px(l.bx0, y, 2, LOBBY_H, C.dim); px(l.bx1 - 2, y, 2, LOBBY_H, C.dim);
  // Entrance: glass double doors on the left
  const dx = l.bx0 + 6, dy = y + LOBBY_H - 18;
  px(dx, dy, 16, 17, C.dim); px(dx + 1, dy + 1, 6, 16, mix(C.info, C.surface, 0.6)); px(dx + 9, dy + 1, 6, 16, mix(C.info, C.surface, 0.6));
  px(dx + 6, dy + 8, 1, 2, C.t2); px(dx + 9, dy + 8, 1, 2, C.t2);
  text(L.lobby, dx, dy - 7, C.t3);
  // Plant
  const pxp = l.shaftX - 12;
  px(pxp, y + LOBBY_H - 6, 6, 5, C.orangeDim); px(pxp + 1, y + LOBBY_H - 11, 1, 5, C.green); px(pxp + 3, y + LOBBY_H - 13, 1, 7, C.green); px(pxp + 5, y + LOBBY_H - 10, 1, 4, C.green);
  // Counts, selection, READY.
  const tx = dx + 22, maxc = Math.floor((pxp - tx - 4) / 4);
  const n = s => data.agents.filter(a => a.status === s).length;
  text(L.counts.replace('{0}', n('working')).replace('{1}', n('idle') + n('done')).replace('{2}', n('blocked')), tx, y + 4, C.t2, maxc);
  const sel = data.agents.find(a => a.pane === state.selected);
  if (sel) text(`> ${sel.name || sel.pane} ${L.st[sel.status] || L.st.unknown} ${ago(sel.since)}`.trim(), tx, y + 13, C.t1, maxc);
  const ready = state.offline ? L.offline : (data.agents.length ? L.ready : L.none);
  const rw = text(ready, tx, y + 22, state.offline ? C.redInk : C.t2, maxc);
  if (reduced || tick % 2 === 0) px(tx + rw + 1, y + 21, 4, 6, C.orange);
  // Street
  px(0, y + LOBBY_H, l.W, 1, C.dim); px(0, y + LOBBY_H + 1, l.W, STREET_H - 1, mix(C.surface3, C.bg, 0.3));
  for (let i = 0; i < l.W; i += 12) px(i + 2, y + LOBBY_H + 3, 6, 1, C.t3);
}

// ─── Trips: agents walking in, out, and between floors (one lift, one trip at a time) ─
// A trip is a list of legs: { walk: [x0, x1], y } or { ride: [y0, y1] } (car), run in order.
function planTrips(before) {
  if (!lay || !prevSeen) return;
  const seen = new Map();
  for (const a of data.agents) {
    if (!a.terminal) continue;
    const d = lay.desks.get(a.pane);
    if (!d) continue;
    seen.set(a.terminal, { status: a.status, ws: d.ws, pane: a.pane });
    const was = prevSeen.get(a.terminal);
    if (!was) { queueTrip('in', a, null, d); continue; }
    if (was.ws !== d.ws) queueTrip('move', a, before.get(a.terminal), d);
    if (was.status === 'working' && (a.status === 'idle' || a.status === 'done')) {
      waves.set(a.pane, Date.now() + 2200); popups.push({ pane: a.pane, glyph: 'ok', t0: Date.now() });
    }
    if (was.status !== 'blocked' && a.status === 'blocked') popups.push({ pane: a.pane, glyph: '!', t0: Date.now() });
  }
  for (const [term, was] of prevSeen) {
    if (seen.has(term)) continue;
    const old = before.get(term);
    if (old?.agent) queueTrip('out', old.agent, old, null);
  }
  prevSeen = seen;
}
function queueTrip(kind, a, from, to) {
  if (reduced) return;
  if (trips.length > 6) return; // a burst (e.g. a restart): don't queue a parade
  trips.push({ kind, agent: { ...a }, from, to, pal: palFor(a).pal, hidePanes: to ? [a.pane] : [] });
  kick();
}
function legsFor(t, l) {
  const door = l.shaftX - 8;
  const rowY = d => d.y + SLOT_H - 17;
  const legs = [];
  const goCar = (y) => legs.push({ ride: [null, y], empty: true });
  if (t.kind === 'in') {
    goCar(carStop(l, null));
    legs.push({ ride: [carStop(l, null), carStop(l, t.to.ws)] });
    legs.push({ walk: [door, t.to.x + 4], y: rowY(t.to) });
  } else if (t.kind === 'out') {
    goCar(carStop(l, t.from.ws));
    legs.push({ walk: [t.from.x + 4, door], y: rowY(t.from) });
    legs.push({ ride: [carStop(l, t.from.ws), carStop(l, null)] });
    legs.push({ walk: [door, l.bx0 + 10], y: l.lobbyY + LOBBY_H - 17 });
  } else {
    goCar(carStop(l, t.from?.ws));
    if (t.from) legs.push({ walk: [t.from.x + 4, door], y: rowY(t.from) });
    legs.push({ ride: [carStop(l, t.from?.ws), carStop(l, t.to.ws)] });
    legs.push({ walk: [door, t.to.x + 4], y: rowY(t.to) });
  }
  return legs;
}
function runTrips(dt) {
  const t = trips[0];
  if (!t) return false;
  if (!t.legs) { t.legs = legsFor(t, lay); t.i = 0; t.p = 0; }
  const leg = t.legs[t.i];
  t.riding = null; t.walking = null;
  if (!leg) { trips.shift(); return true; }
  if (leg.ride) {
    const [y0, y1] = leg.ride;
    if (y0 == null || leg.empty) { // the car comes to pick them up
      const d = y1 - car.y, step = carSpeed(d) * dt;
      if (Math.abs(d) <= step) { car.y = y1; t.i++; } else car.y += Math.sign(d) * step;
    } else {
      car.y = car.y ?? y0;
      const d = y1 - car.y, step = carSpeed(y1 - y0) * dt;
      t.riding = { pal: t.pal };
      if (Math.abs(d) <= step) { car.y = y1; t.i++; } else car.y += Math.sign(d) * step;
    }
  } else if (leg.walk) {
    const [x0, x1] = leg.walk;
    t.p += dt / walkSecs(Math.abs(x1 - x0));
    if (t.p >= 1) { t.p = 0; t.i++; } else t.walking = { x: x0 + (x1 - x0) * t.p, y: leg.y, left: x1 < x0 };
  }
  return true;
}
function drawWalker() {
  const t = trips[0];
  if (!t?.walking) return;
  const w = t.walking;
  const frame = Math.floor(now() / 160) % 2 ? 'walk1' : 'walk2';
  sprite(SPRITES[frame], Math.round(w.x), Math.round(w.y), t.pal, false, w.left);
}
function drawPopups() {
  const T0 = Date.now();
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i], age = (T0 - p.t0) / 1400;
    if (age >= 1) { popups.splice(i, 1); continue; }
    const d = lay.desks.get(p.pane);
    if (!d) continue;
    const x = d.x + Math.floor(lay.g.SLOT_W / 2) - 4, y = d.y + 6 - Math.round(age * 12);
    if (p.glyph === 'ok') {
      px(x, y, 9, 8, C.green);
      px(x + 2, y + 4, 1, 1, C.bg); px(x + 3, y + 5, 1, 1, C.bg); px(x + 4, y + 4, 1, 1, C.bg); px(x + 5, y + 3, 1, 1, C.bg); px(x + 6, y + 2, 1, 1, C.bg);
    } else {
      px(x, y, 9, 8, C.red); px(x + 4, y + 1, 1, 4, ON_RED); px(x + 4, y + 6, 1, 1, ON_RED);
    }
  }
}

// ─── Lift target when no trip runs: hovered floor > selected agent's floor > lobby ─
function idleCarTarget(l) {
  if (hoverWs && floorOf(l, hoverWs)) return carStop(l, hoverWs);
  const sel = state.selected && l.desks.get(state.selected);
  return carStop(l, sel?.ws || null);
}

// ─── Frame ───────────────────────────────────────────────────────────────────
let lastT = 0;
function draw(dt = 0) {
  if (box.hidden) return;
  const w = avail();
  if (w <= 0) return;
  tick = Math.floor(Date.now() / 500);
  lay = layout(w);
  const l = lay;
  if (canvas.width !== l.W || canvas.height !== l.H) { canvas.width = l.W; canvas.height = l.H; }
  scale = Math.max(1, Math.min(scaleFor(w), Math.floor(w / l.W)));
  canvas.style.width = l.W * scale + 'px';
  canvas.style.height = l.H * scale + 'px';
  ctx.imageSmoothingEnabled = false;
  hits = []; floorHits = [];
  for (const a of data.agents) { const d = l.desks.get(a.pane); if (d && a.terminal) lastDesk.set(a.terminal, { ...d, agent: a }); }

  if (car.y == null) car.y = idleCarTarget(l);
  const tripOn = runTrips(dt);
  if (!tripOn) { // the lift glides to its resting floor (only the animation loop moves it)
    const target = idleCarTarget(l), d = target - car.y, step = carSpeed(d) * dt;
    if (reduced || Math.abs(d) <= step) car.y = target;
    else if (dt) car.y += Math.sign(d) * step;
  }

  px(0, 0, l.W, l.H, C.bg);
  const sky = drawSky(l);
  drawRoof(l, sky);
  drawFloors(l, sky);
  drawLobby(l, sky);
  drawShaft(l); // after the lobby: the car parks there
  drawWalker();
  drawPopups();
  if (!l.floors.length) text(L.none, l.bx0 + 6, SKY_H + ROOF_H + 4, C.t3);

  const need = data.agents.some(a => a.status === 'blocked');
  box.classList.toggle('alarm', need && (reduced || tick % 2 === 0));
}
// Smooth frames only while something moves; otherwise a calm redraw twice a second.
function animating() {
  if (reduced || !lay) return false;
  if (trips.length || popups.length) return true;
  if ([...waves.values()].some(u => u > Date.now())) return true;
  return Math.abs(idleCarTarget(lay) - (car.y ?? 0)) > 0.5;
}
let running = false;
function loop(ts) {
  if (box.hidden || !animating()) { running = false; return; }
  const dt = lastT ? Math.min(0.1, (ts - lastT) / 1000) : 0;
  if (ts - lastT >= 30) { draw(dt); lastT = ts; }
  requestAnimationFrame(loop);
}
function kick() { if (running || box.hidden) return; running = true; lastT = 0; requestAnimationFrame(loop); }

// ─── Keyboard + screen readers: the canvas is a picture, the roster is the way in ─
function roster() {
  const key = data.agents.map(a => a.pane + a.name + a.status).join('|') + state.lang;
  if (rosterEl.dataset.key === key) return;
  rosterEl.dataset.key = key;
  rosterEl.replaceChildren(...data.agents.map(a => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${a.name || a.pane}: ${(L.st[a.status] || L.st.unknown).toLowerCase()}`;
    b.addEventListener('click', () => onPick(a.pane));
    li.append(b);
    return li;
  }));
}

// ─── Pointer: hover a desk (card) or a floor (lift comes), click to open ─────
function at(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
  return { x, y, hit: hits.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h), floor: floorHits.find(f => y >= f.y0 && y < f.y1) };
}
canvas.addEventListener('click', e => { const { hit } = at(e); if (hit) onPick(hit.pane); });
canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const { hit, floor } = at(e);
  canvas.style.cursor = hit ? 'pointer' : 'default';
  const ws = floor?.ws || null;
  if (ws !== hoverWs) { hoverWs = ws; kick(); }
  const pane = hit && !hit.flag ? hit.pane : null;
  if (pane !== hoverPane) {
    hoverPane = pane;
    draw();
    if (pane) {
      const r = canvas.getBoundingClientRect();
      onHover(pane, { left: r.left + hit.x * scale, top: r.top + hit.y * scale, right: r.left + (hit.x + hit.w) * scale, bottom: r.top + (hit.y + hit.h) * scale, width: hit.w * scale, height: hit.h * scale });
    } else onHover(null);
  }
});
canvas.addEventListener('pointerleave', () => { hoverWs = null; hoverPane = null; onHover(null); kick(); draw(); });

// Mock mode (?demo): every state at once on the live layout. Drawing only.
function demo(d) {
  d = { ...d, agents: d.agents.map(a => ({ ...a })) };
  const plan = ['blocked', 'working', 'done', 'working', 'idle', 'unknown'];
  d.agents.forEach((a, i) => {
    if (i < plan.length) a.status = plan[i];
    if (a.status === 'working') a.since = (d.now || Date.now()) - (i === 1 ? 12 : 26) * 60000;
  });
  if (d.agents[1]) d.agents[1].tags = ['operio'];
  return d;
}

function readTheme() { readTokens(); C.dark = rgb(C.bg).reduce((x, y) => x + y) < 384; }
readTheme();
new MutationObserver(() => { readTheme(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
new ResizeObserver(() => draw()).observe(box);
setInterval(() => { if (!document.hidden && !box.hidden && !running) draw(); }, 500);

window.OrcaOffice = {
  font: { GLYPHS, norm }, // shared with the islands view
  onPick(fn) { onPick = fn; },
  onHover(fn) { onHover = fn; },
  // d = latest /api/agents; s = { selected, lang, offline, matches }
  update(d, s) {
    if (d) {
      data = DEMO ? demo(d) : d;
      if (d.now) skew = d.now - Date.now();
    }
    Object.assign(state, s);
    L = T[state.lang] || T.en;
    roster();
    const before = new Map(lastDesk); // where everyone sat before this answer
    draw();
    if (d) {
      // First answer: remember everyone where they are (no parade on load).
      if (!prevSeen) { prevSeen = new Map(); for (const a of data.agents) { const x = lay?.desks.get(a.pane); if (a.terminal && x) prevSeen.set(a.terminal, { status: a.status, ws: x.ws, pane: a.pane }); } }
      else planTrips(before);
    }
    kick();
  },
  show(on) {
    box.hidden = !on;
    if (!on) { box.classList.remove('alarm'); onHover(null); }
    else { draw(); kick(); }
  },
  // Show-on-desktop worked: the worker jumps up and cheers for two seconds.
  wave(pane) { waves.set(pane, Date.now() + 2200); kick(); },
  rectOf(pane) {
    const h = hits.find(z => z.pane === pane && !z.flag);
    if (!h) return null;
    const r = canvas.getBoundingClientRect();
    return { top: r.top + h.y * scale, bottom: r.top + (h.y + h.h) * scale };
  },
};
})();
