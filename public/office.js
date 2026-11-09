'use strict';
// Free-ORCA — 8-bit office view, the second way to see the map. Same live data: every
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

// ─── Copy (EN / ES) ──────────────────────────────────────────────────────────
const T = {
  en: { title: '**** ORCA ****', floor: 'FLOOR', noAgents: 'NO AGENTS ON THIS FLOOR', empty: '+{0} EMPTY ROOMS',
        ready: 'READY.', none: 'NO AGENTS YET. PRESS NEW.', offline: '?CONNECTION ERROR',
        st: { working: 'WORKING', idle: 'IDLE', blocked: 'NEEDS YOU', done: 'DONE', unknown: 'STARTING' } },
  es: { title: '**** ORCA ****', floor: 'PISO', noAgents: 'SIN AGENTES EN ESTE PISO', empty: '+{0} SALAS VACIAS',
        ready: 'LISTO.', none: 'AUN NO HAY AGENTES. TOCA NUEVO.', offline: '?ERROR DE CONEXION',
        st: { working: 'TRABAJANDO', idle: 'LIBRE', blocked: 'TE NECESITA', done: 'TERMINO', unknown: 'INICIANDO' } },
};

// ─── Layout constants (logical pixels) ───────────────────────────────────────
const M = 6, GAP = 4, ROOM_W = 96, SLOT_W = 30, SLOT_H = 32, ROOM_HEAD = 9, PER_ROW = 3;
const HUD_H = 12, FOOT_H = 18;
const DEMO = new URLSearchParams(location.search).has('demo');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const box = document.getElementById('office');
const canvas = document.getElementById('world');
const rosterEl = document.getElementById('roster');
const ctx = canvas.getContext('2d');
let data = { agents: [], tabs: [], workspaces: [], tagColors: {} };
let state = { selected: null, lang: 'en', offline: false, matches: () => true };
let L = T.en;
let hits = [];         // [{ x, y, w, h, pane }]
let tick = 0;
let scale = 2;
let skew = 0;
let onPick = () => {};
const waves = new Map(); // pane -> until: just sent to the desktop screen, the worker cheers

// ─── Drawing primitives ──────────────────────────────────────────────────────
const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
function text(str, x, y, col, max = Infinity) {
  const s = norm(str).slice(0, max);
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const g = GLYPHS[s[i]] || GLYPHS['?'];
    for (let b = 0; b < 15; b++) if (g[b] === '1') ctx.fillRect(x + i * 4 + (b % 3), y + Math.floor(b / 3), 1, 1);
  }
  return s.length * 4;
}
const textW = s => norm(s).length * 4;
function sprite(rows, x, y, pal, dither = false) {
  rows.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (!col || (dither && (r + i) % 2)) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + i, y + r, 1, 1);
    }
  });
}

// ─── Layout: fits the box it lives in (narrower when the panel is open) ─────
function avail() {
  const cs = getComputedStyle(box);
  return Math.min(box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), 1800);
}
const scaleFor = w => (w < 600 ? 3 : 2); // phone: 3× so a worker stays readable; desktop: 2× for more rooms
function columns(w) {
  return Math.max(1, Math.floor((w / scaleFor(w) - 2 * M + GAP) / (ROOM_W + GAP)));
}

function layout(cols) {
  const byPane = new Map(data.agents.map(a => [a.pane, a]));
  const W = cols * (ROOM_W + GAP) - GAP + 2 * M;
  const floors = [];
  let y = HUD_H;
  const wsList = data.workspaces.length ? data.workspaces : [...new Set(data.tabs.map(t => t.ws))].map((id, i) => ({ id, number: i + 1 }));
  for (const ws of wsList) {
    const tabs = data.tabs.filter(t => t.ws === ws.id).sort((a, b) => a.number - b.number);
    const busy = tabs.filter(t => t.panes.some(p => byPane.has(p.pane)));
    const floor = { ws, y, rooms: [], emptyRooms: tabs.length - busy.length };
    y += 10;
    for (let i = 0; i < busy.length; i += cols) {
      const row = busy.slice(i, i + cols).map((tab, j) => {
        const panes = [...tab.panes].sort((a, b) => a.y - b.y || a.x - b.x);
        const rows = Math.max(1, Math.ceil(panes.length / PER_ROW));
        return { tab, panes, x: M + j * (ROOM_W + GAP), y, h: ROOM_HEAD + rows * SLOT_H + 3 };
      });
      const h = Math.max(...row.map(r => r.h));
      row.forEach(r => { r.h = h; floor.rooms.push(r); });
      y += h + GAP;
    }
    if (!busy.length || floor.emptyRooms) y += 8;
    floor.h = y - floor.y;
    floors.push(floor);
    y += 4;
  }
  if (!floors.length) y += 10;
  return { W, H: y + FOOT_H, floors, byPane };
}
// ─── Scene ───────────────────────────────────────────────────────────────────
const now = () => Date.now() + skew;
function ago(since) {
  if (!since) return '';
  const m = Math.floor((now() - since) / 60000);
  return m < 60 ? m + 'M' : Math.floor(m / 60) + 'H' + String(m % 60).padStart(2, '0');
}

function drawDesk(x0, y0, pane, a) {
  const yb = y0 + SLOT_H - 1;
  const status = a ? a.status : 'shell';
  const waving = (waves.get(pane) || 0) > Date.now();
  // Lights: a working desk glows warm, a waiting one red, an idle one goes dark.
  const back = { working: C.warm, blocked: C.alarm, idle: C.night, done: C.night, shell: C.night }[status];
  if (back) px(x0, y0 + 8, SLOT_W - 1, SLOT_H - 8, back);
  if (status === 'working') { px(x0, y0 + 8, SLOT_W - 1, 1, C.warmHi); }
  // Desk lamp: on while working (a pool of light on the desk), off otherwise.
  px(x0 + 27, yb - 15, 1, 7, C.dim); px(x0 + 25, yb - 16, 3, 1, C.dim);
  if (status === 'working') { px(x0 + 25, yb - 15, 2, 1, C.yellow); px(x0 + 23, yb - 9, 7, 1, C.lamp); }
  // Desk: top, front edge, legs; keyboard; monitor with bezel, stand and base.
  px(x0 + 10, yb - 8, 20, 1, C.orangeDim);
  px(x0 + 10, yb - 7, 20, 1, C.dim);
  px(x0 + 11, yb - 6, 1, 7, C.dim);
  px(x0 + 28, yb - 6, 1, 7, C.dim);
  px(x0 + 11, yb - 9, 4, 1, C.t2);
  px(x0 + 17, yb - 17, 11, 7, C.t3);
  px(x0 + 22, yb - 10, 1, 1, C.dim);
  px(x0 + 20, yb - 9, 5, 1, C.dim);
  const flash = !reduced && tick % 2;
  const screen = { working: C.orange, idle: C.bg, blocked: flash ? C.red : C.redInk, done: C.green, unknown: C.surface3, shell: C.bg }[status] || C.bg;
  px(x0 + 18, yb - 16, 9, 5, waving ? (flash ? C.orangeBright : C.orange) : screen);
  if (waving) { // beamed to the big screen: sparkles around the monitor
    const k = reduced ? 0 : tick % 2;
    px(x0 + 16 - k, yb - 19 + k, 1, 1, C.orangeBright); px(x0 + 28 + k, yb - 19 + k, 1, 1, C.orangeBright);
    px(x0 + 22, yb - 21 - k, 1, 1, C.yellow);
  } else if (status === 'working') { // a lit screen with dark code scrolling up
    for (let r = 0; r < 4; r++) px(x0 + 19 + (r % 2), yb - 16 + r + 0, 2 + ((r * 3 + tick) % 6), 1, C.bg);
  } else if (status === 'idle') { // screen off: one standby dot
    if (reduced || tick % 2) px(x0 + 26, yb - 12, 1, 1, C.green);
  } else if (status === 'done') {
    px(x0 + 20, yb - 14, 1, 1, C.bg); px(x0 + 21, yb - 13, 1, 1, C.bg); px(x0 + 22, yb - 14, 1, 1, C.bg); px(x0 + 23, yb - 15, 1, 1, C.bg);
  }
  if (status === 'shell') {
    if (!reduced && tick % 2) px(x0 + 19, yb - 13, 2, 1, C.t2);
    sprite(SPRITES.chair, x0 + 1, yb - 15, { c: C.dim });
    return;
  }

  // Worker
  const kind = KINDS[a.agent] || KINDS._;
  const pal = Object.fromEntries(Object.entries(kind).filter(([k]) => k.length === 1).map(([k, v]) => [k, C[v]]));
  const look = lookOf(a);
  if (!kind.robot) { pal.s = look.skin; pal.S = mix(look.skin, C.bg, 0.25); }
  if (!kind.robot && !kind.wings) pal.h = look.style === 'bald' ? pal.s : look.hair;
  pal.c = C.dim;
  pal.t = a.tags.length ? tagHue(data.tagColors?.[a.tags[0]] ?? 0) : pal.b;
  const pose = waving ? 'cheer' : status === 'working' ? (!reduced && tick % 2 ? 'work2' : 'work')
    : status === 'blocked' ? 'ask' : status === 'done' ? 'cheer' : status === 'idle' ? 'sleep' : 'idle';
  const sy = yb - 15;
  sprite(SPRITES[pose], x0 + 1, sy, pal, status === 'unknown' || !state.matches(a));
  dress(look, pose, x0 + 1, sy, pal, kind);
  if (kind.wings) { // little wings on the helmet
    const wy = sy + (pose === 'idle' ? 2 : pose === 'cheer' ? 2 : 1);
    px(x0 + 2, wy, 1, 1, pal.w); px(x0 + 1, wy - 1, 1, 2, pal.w);
  }

  // Status mark above the head
  const mx = x0 + 3, my = y0 + 8;
  if (status === 'blocked') {
    px(mx, my, 7, 6, C.t1); px(mx + 1, my + 6, 2, 1, C.t1);
    px(mx + 3, my + 1, 1, 2, C.red); px(mx + 3, my + 4, 1, 1, C.red);
  } else if (a?.showFresh && status !== 'working') { // just finished, not opened yet: a green tick sign
    px(mx - 1, my, 9, 7, C.green); px(mx + 2, my + 7, 2, 1, C.green);
    px(mx + 1, my + 3, 1, 1, C.bg); px(mx + 2, my + 4, 1, 1, C.bg); px(mx + 3, my + 3, 1, 1, C.bg);
    px(mx + 4, my + 2, 1, 1, C.bg); px(mx + 5, my + 1, 1, 1, C.bg);
  } else if (status === 'idle') { // asleep: z's float up from the desk
    const lift = reduced ? 0 : tick % 2;
    text('Z', mx + 5, my + 3 - lift, C.greenInk);
    px(mx + 2, my + 7 - lift, 2, 1, C.greenInk); px(mx + 2, my + 9 - lift, 1, 1, C.greenInk);
  } else if (status === 'done') {
    px(mx + 1, my + 3, 1, 1, C.green); px(mx + 2, my + 4, 1, 1, C.green); px(mx + 3, my + 3, 1, 1, C.green);
    px(mx + 4, my + 2, 1, 1, C.green); px(mx + 5, my + 1, 1, 1, C.green);
  } else if (status === 'working') { // sparks over the monitor + time bar
    const k = reduced ? 0 : tick % 3;
    px(x0 + 19 + k * 2, yb - 19, 1, 1, C.orangeBright); px(x0 + 25 - k, yb - 20, 1, 1, C.orange);
    if (a.since) {
      const f = Math.max(0.1, Math.min(1, (now() - a.since) / 1800000));
      px(x0 + 1, y0 + 7, 28, 1, C.surface3);
      px(x0 + 1, y0 + 7, Math.round(28 * f), 1, C.orange);
    }
  }

  // Name tag
  const name = a.name || '?';
  const nw = Math.min(textW(name), 28);
  const nameCol = !a.name ? C.t3 : { working: C.orangeInk, blocked: C.redInk, done: C.greenInk, idle: C.t3 }[status] || C.t1;
  text(name, x0 + 15 - Math.floor(nw / 2), y0 + 1, nameCol, 7);
  if (a?.claim) { // who is on it: an initial tab in the person's colour, top-right of the desk
    const [bg, ink] = a.claim.team ? [C.yellow, C.bg] : [[C.blue, C.t1], [C.yellow, C.bg], [C.info, C.bg], [C.t1, C.bg]][(a.claim.slot || 0) % 4];
    px(x0 + SLOT_W - 9, y0 + 9, 8, 7, bg);
    if (a.claim.team) px(x0 + SLOT_W - 9, y0 + 9, 4, 7, C.blue); // the team: both colours
    text(a.claim.initial, x0 + SLOT_W - 7, y0 + 10, ink, 1);
  }

  if (state.selected === pane) { // corner brackets
    const col = C.orange, x1 = x0 - 1, y1 = y0 - 1, w = SLOT_W + 1, h = SLOT_H + 1;
    for (const [cx, cy, dx, dy] of [[x1, y1, 1, 1], [x1 + w, y1, -1, 1], [x1, y1 + h, 1, -1], [x1 + w, y1 + h, -1, -1]]) {
      px(Math.min(cx, cx + dx * 3), cy, 4, 1, col); px(cx, Math.min(cy, cy + dy * 3), 1, 4, col);
    }
  }
}

function draw() {
  if (box.hidden) return;
  const w = avail();
  if (w <= 0) return;
  const lay = layout(columns(w));
  if (canvas.width !== lay.W || canvas.height !== lay.H) { canvas.width = lay.W; canvas.height = lay.H; }
  scale = Math.max(1, Math.min(scaleFor(w), Math.floor(w / lay.W)));
  canvas.style.width = lay.W * scale + 'px';
  canvas.style.height = lay.H * scale + 'px';
  ctx.imageSmoothingEnabled = false;
  hits = [];

  px(0, 0, lay.W, lay.H, C.bg);
  text(L.title, Math.floor((lay.W - textW(L.title)) / 2), 3, C.orangeInk);

  // Floors and rooms
  for (const f of lay.floors) {
    const label = `${L.floor} ${f.ws.number} ${f.ws.label || ''}`.trim();
    text(label, M, f.y + 2, C.orangeInk);
    px(M + textW(label) + 2, f.y + 4, lay.W - 2 * M - textW(label) - 2, 1, C.dim);
    for (const r of f.rooms) {
      px(r.x, r.y, ROOM_W, r.h, C.surface);               // back wall
      px(r.x, r.y, ROOM_W, 1, C.dim); px(r.x, r.y, 1, r.h, C.dim); px(r.x + ROOM_W - 1, r.y, 1, r.h, C.dim);
      px(r.x, r.y + r.h - 2, ROOM_W, 1, C.dim);            // floor
      px(r.x, r.y + r.h - 1, ROOM_W, 1, C.surface3);
      const count = r.panes.filter(p => lay.byPane.has(p.pane)).length;
      text(r.tab.label || '#' + r.tab.number, r.x + 3, r.y + 2, C.t2, 19);
      text(String(count), r.x + ROOM_W - 3 - textW(String(count)), r.y + 2, C.t1);
      r.panes.forEach((p, i) => {
        const sx = r.x + 3 + (i % PER_ROW) * SLOT_W, sy = r.y + ROOM_HEAD + Math.floor(i / PER_ROW) * SLOT_H;
        const a = lay.byPane.get(p.pane);
        drawDesk(sx, sy, p.pane, a);
        if (a) hits.push({ x: sx, y: sy, w: SLOT_W, h: SLOT_H, pane: p.pane });
      });
    }
    const after = f.rooms.length ? f.rooms[f.rooms.length - 1].y + f.rooms[f.rooms.length - 1].h + GAP : f.y + 10;
    if (!f.rooms.length) text(L.noAgents, M, after, C.t3);
    else if (f.emptyRooms) text(L.empty.replace('{0}', f.emptyRooms), M, after, C.t3);
  }
  if (!lay.floors.length) text(L.none, M, HUD_H + 2, C.t3);

  // Footer: selection line, READY. + blinking cursor
  const fy = lay.H - FOOT_H + 2;
  const sel = data.agents.find(a => a.pane === state.selected);
  if (sel) {
    const line = `> ${sel.name || sel.pane} ${L.st[sel.status] || L.st.unknown} ${ago(sel.since)}`.trim();
    text(line, M, fy, C.t1, Math.floor((lay.W - 2 * M) / 4));
  }
  const ready = state.offline ? L.offline : L.ready;
  const rw = text(ready, M, fy + 8, state.offline ? C.redInk : C.t2);
  if (reduced || tick % 2 === 0) px(M + rw + 1, fy + 7, 4, 6, C.orange);

  // The frame is the old computer's border: it turns red while someone needs you.
  const need = data.agents.some(a => a.status === 'blocked');
  box.classList.toggle('alarm', need && (reduced || tick % 2 === 0));
}

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

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
  const h = hits.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
  if (h) onPick(h.pane);
});

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

readTokens();
new MutationObserver(() => { readTokens(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
new ResizeObserver(() => draw()).observe(box);
setInterval(() => { tick++; if (!document.hidden && !box.hidden) draw(); }, 500);

window.OrcaOffice = {
  font: { GLYPHS, norm }, // shared with the islands view
  onPick(fn) { onPick = fn; },
  // d = latest /api/agents; s = { selected, lang, offline, matches }
  update(d, s) {
    if (d) { data = DEMO ? demo(d) : d; if (d.now) skew = d.now - Date.now(); }
    Object.assign(state, s);
    L = T[state.lang] || T.en;
    roster();
    draw();
  },
  show(on) {
    box.hidden = !on;
    if (!on) box.classList.remove('alarm');
    else draw();
  },
  // Where a worker is on screen (to keep it above the phone panel).
  // Show-on-desktop worked: the worker jumps up and cheers for two seconds.
  wave(pane) { waves.set(pane, Date.now() + 2200); draw(); setTimeout(draw, 2300); },
  rectOf(pane) {
    const h = hits.find(z => z.pane === pane);
    if (!h) return null;
    const r = canvas.getBoundingClientRect();
    return { top: r.top + h.y * scale, bottom: r.top + (h.y + h.h) * scale };
  },
};
})();
