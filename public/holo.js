'use strict';
// ORCA — Holo view: the workspace as a holographic command table in 3D (three.js,
// vendored in /vendor/three, loaded only when this view opens). Every workspace is a floating
// hex platform, every tab a glowing tower, every agent a light core orbiting its tower:
// orange with rising data while working, slow green breathing when idle, a red light column
// and a shockwave across the table when it needs you, a green halo when done. One screen, no
// scrolling; drag to rotate, pinch or scroll to zoom, tap a core to open its agent page.
// Colours are Operio v3 tokens; the table stays dark in both themes (like the output well).
// app.js owns the data and the agent page. Visible copy never names the underlying tool.
(() => {
const box = document.getElementById('holo');
const stage = document.getElementById('holo-stage');
const labelsEl = document.getElementById('holo-labels');
const infoEl = document.getElementById('holo-info');
const clockEl = document.getElementById('holo-clock');
const hintEl = document.getElementById('holo-hint');
const rosterEl = document.getElementById('holo-roster');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEMO = new URLSearchParams(location.search).has('demo');

const T = {
  en: { title: 'ORCA // HOLO TABLE', hint: 'drag to rotate · pinch or scroll to zoom · tap a core', loading: 'Booting the table…',
        noGl: 'This device can’t draw 3D. Use Map, Office or Islands.', quiet: 'All quiet.', needs: '{0} need you', needs1: '1 needs you',
        offline: 'Connection lost — retrying…', open: 'Open', show: 'Show', zoom: 'Zoom', booting: 'BOOTING TABLE', st: { working: 'working', idle: 'idle', blocked: 'needs you', done: 'done', unknown: 'starting' } },
  es: { title: 'ORCA // MESA HOLO', hint: 'arrastra para girar · pellizca o desplaza para acercar · toca un núcleo', loading: 'Encendiendo la mesa…',
        noGl: 'Este dispositivo no puede dibujar 3D. Usa Mapa, Oficina o Islas.', quiet: 'Todo en calma.', needs: '{0} te necesitan', needs1: '1 te necesita',
        offline: 'Sin conexión — reintentando…', open: 'Abrir', show: 'Mostrar', zoom: 'Ampliar', booting: 'ENCENDIENDO MESA', st: { working: 'trabajando', idle: 'libre', blocked: 'te necesita', done: 'terminó', unknown: 'iniciando' } },
};
// Other languages: the pack loaded by lang-boot.js (missing strings fall back to English).
if (window.ORCA_I18N?.holo) T[window.ORCA_I18N.lang] = { ...T.en, ...window.ORCA_I18N.holo };

// ─── State ───────────────────────────────────────────────────────────────────
let THREE = null, loading = null, failed = false;
let renderer, scene, camera, raycaster, world, table, ndc;
let data = { agents: [], tabs: [], workspaces: [], tagColors: {} };
let state = { selected: null, lang: 'en', offline: false, matches: () => true };
let L = T.en;
let onPick = () => {};
let skew = 0;
let structureKey = '';
let agentsByPane = new Map();   // pane -> { orb, glow, hit, tower, phase, ... }
let towers = [], platforms = [], pulses = [];
let tex = {};
let running = false, raf = 0, lastFrame = 0;
let focus = null;          // pane the camera is on (first tap); a second tap opens it
let fly = null;            // camera tween
let composer = null, bloom = null, glowScale = 1;   // real glow (desktop only)
let booted = false, bootT0 = 0;      // boot sequence, once per page load
let onShow = () => {};
const cardEl = document.getElementById('holo-card');
const titleEl = box.querySelector('.holo-title');
const waves = new Map();
const C = {};
const now = () => Date.now() + skew;

// ─── Tokens ──────────────────────────────────────────────────────────────────
const TOKENS = { bg: '--color-bg', t1: '--text-primary', orange: '--color-orange', orangeBright: '--color-orange-bright',
  green: '--color-green', red: '--color-red', yellow: '--color-yellow', blue: '--color-blue', info: '--color-info', t3: '--text-tertiary' };
function rgb(c) {
  c = String(c).trim();
  if (c[0] === '#') { if (c.length === 4) c = '#' + [...c.slice(1)].map(x => x + x).join(''); const n = parseInt(c.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const [k, v] of Object.entries(TOKENS)) C[k] = cs.getPropertyValue(v).trim() || '#888';
  const dark = rgb(C.bg).reduce((a, b) => a + b) < 384;
  C.void = dark ? C.bg : C.t1;                // the table is always dark
  C.grid = mix(C.info, C.void, 0.82);
  C.gridHi = mix(C.info, C.void, 0.6);
}
const statusColor = s => ({ working: C.orange, idle: C.green, blocked: C.red, done: C.green }[s] || C.t3);

// ─── Boot (lazy) ─────────────────────────────────────────────────────────────
function ensure() {
  if (THREE || failed) return Promise.resolve();
  if (!loading) {
    infoEl.textContent = L.loading;
    loading = import('/vendor/three/three.module.min.js').then(m => { THREE = m; init(); }).catch(() => { failed = true; infoEl.textContent = L.noGl; });
  }
  return loading;
}

function glowTexture(inner = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, `rgba(255,255,255,${inner})`); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function beamTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d'), r = g.createLinearGradient(0, 128, 0, 0);
  r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.5, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch { failed = true; infoEl.textContent = L.noGl; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.className = 'holo-canvas';
  stage.prepend(renderer.domElement);
  // Real glow on computers (bloom); phones keep the cheaper sprite glow.
  const forceGlow = new URLSearchParams(location.search).has('glow'); // ?glow: test the bloom anywhere
  if (!reduced && (forceGlow || (matchMedia('(pointer: fine)').matches && window.innerWidth >= 960))) {
    const A = '/vendor/three/addons/postprocessing/';
    Promise.all(['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass'].map(n => import(A + n + '.js'))).then(([ec, rp, ub, op]) => {
      composer = new ec.EffectComposer(renderer);
      composer.addPass(new rp.RenderPass(scene, camera));
      bloom = new ub.UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.35, 0.62);
      // with real bloom the fake sprite glows would double up: tone them down
      scene.traverse(n => { if (n.isSprite) n.material.opacity *= 0.5; });
      glowScale = 0.5;
      table.traverse(n => { if (n.isMesh) n.visible = false; }); // the glow disc would haze the whole table
      composer.addPass(bloom);
      composer.addPass(new op.OutputPass());
      resize();
    }).catch(() => { composer = null; });
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
  raycaster = new THREE.Raycaster();
  ndc = new THREE.Vector2();
  tex = { glow: glowTexture(), soft: glowTexture(0.6), beam: beamTexture() };
  readTokens();
  buildTable();
  bindControls();
  structureKey = '';
  sync();
  resize();
  new ResizeObserver(() => { resize(); }).observe(stage);
}

// ─── Table: grid + glow disc ─────────────────────────────────────────────────
function buildTable() {
  if (table) { scene.remove(table); disposeTree(table); }
  table = new THREE.Group();
  scene.background = new THREE.Color(C.void);
  scene.fog = new THREE.Fog(C.void, 40, 140);
  const grid = new THREE.GridHelper(160, 160, C.gridHi, C.grid);
  grid.material.transparent = true; grid.material.opacity = 0.55; grid.position.y = -0.02;
  table.add(grid);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshBasicMaterial({ map: tex.soft, color: C.info, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.01;
  table.add(disc);
  scene.add(table);
}

function disposeTree(o) {
  o.traverse(n => { n.geometry?.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose()); });
}

// ─── Layout: platforms in a grid that matches the screen's shape ─────────────
function layoutPlatforms(aspect) {
  const byPane = new Map(data.agents.map(a => [a.pane, a]));
  const wsList = data.workspaces.length ? data.workspaces : [...new Set(data.tabs.map(t => t.ws))].map((id, i) => ({ id, number: i + 1 }));
  const plats = wsList.map(ws => {
    const tabs = data.tabs.filter(t => t.ws === ws.id).sort((a, b) => a.number - b.number)
      .map(tab => ({ tab, agents: [...tab.panes].sort((a, b) => a.y - b.y || a.x - b.x).map(p => byPane.get(p.pane)).filter(Boolean) }));
    const n = tabs.length;
    const R = n <= 1 ? 2 : Math.max(2.4, 1.3 + n * 0.62);
    return { ws, tabs, R };
  });
  // pack by real size: rows of platforms side by side, each row as deep as its biggest
  const n = plats.length || 1;
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspect * 1.1))));
  const GAP = 1.4;
  const rows = [];
  for (let i = 0; i < plats.length; i += cols) rows.push(plats.slice(i, i + cols));
  let z = 0;
  const zs = rows.map(r => { const R = Math.max(...r.map(p => p.R)); const zc = z + R; z += 2 * R + GAP; return zc; });
  rows.forEach((r, ri) => {
    const width = r.reduce((a, p) => a + 2 * p.R, 0) + GAP * (r.length - 1);
    let x = -width / 2;
    for (const p of r) { p.x = x + p.R; p.z = zs[ri] - (z - GAP) / 2; x += 2 * p.R + GAP; }
  });
  return plats;
}

// ─── Build the world when the structure changes ──────────────────────────────
function makeLabel(cls) {
  const el = document.createElement('div');
  el.className = 'holo-label ' + cls;
  labelsEl.append(el);
  return el;
}

function build() {
  if (world) { scene.remove(world); disposeTree(world); }
  labelsEl.replaceChildren();
  world = new THREE.Group();
  agentsByPane = new Map(); towers = []; platforms = []; pulses = [];
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  const plats = layoutPlatforms(aspect);
  for (const p of plats) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    // hex deck: translucent fill, bright edges, a slow outer ring
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(p.R, p.R, 0.14, 6), new THREE.MeshBasicMaterial({ color: C.info, transparent: true, opacity: 0.08, depthWrite: false }));
    deck.position.y = 0.07; g.add(deck);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(deck.geometry), new THREE.LineBasicMaterial({ color: C.info, transparent: true, opacity: 0.85 }));
    edges.position.y = 0.07; g.add(edges);
    const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(p.R + 0.35, p.R + 0.35, 0.01, 6)), new THREE.LineBasicMaterial({ color: C.info, transparent: true, opacity: 0.3 }));
    g.add(ring);
    const plat = { g, ring, edges, R: p.R, label: makeLabel('ws'), anchor: new THREE.Vector3(p.x, 0, p.z + p.R + 0.6), towers: [] };
    plat.label.textContent = p.ws.label || `${p.ws.number}`;
    platforms.push(plat);
    // hub at the centre when there are several towers
    const m = p.tabs.length;
    const hub = new THREE.Vector3(0, 0.15, 0);
    if (m > 1) {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 6), new THREE.MeshBasicMaterial({ color: C.info, transparent: true, opacity: 0.5 }));
      core.position.y = 0.2; g.add(core);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: C.info, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(1.6); halo.position.y = 0.3; g.add(halo);
    }
    p.tabs.forEach((tb, ti) => {
      const k = tb.agents.length;
      const ang = m > 1 ? (ti / m) * Math.PI * 2 - Math.PI / 2 : 0;
      const rr = m > 1 ? p.R * 0.58 : 0;
      const tx = Math.cos(ang) * rr, tz = Math.sin(ang) * rr;
      const h = k ? 0.9 + 0.32 * k : 0.35;
      const tg = new THREE.Group(); tg.position.set(tx, 0.14, tz); g.add(tg);
      const bodyMat = new THREE.MeshBasicMaterial({ color: C.info, transparent: true, opacity: k ? 0.16 : 0.06, depthWrite: false });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, h, 6), bodyMat);
      body.position.y = h / 2; tg.add(body);
      const edgeMat = new THREE.LineBasicMaterial({ color: C.info, transparent: true, opacity: k ? 0.95 : 0.35 });
      const tedges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edgeMat);
      tedges.position.y = h / 2; tg.add(tedges);
      const rings = [];
      if (k) for (let r = 0; r < 2; r++) {
        const tor = new THREE.Mesh(new THREE.TorusGeometry(0.46 + r * 0.08, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: C.info, transparent: true, opacity: 0.7 }));
        tor.rotation.x = Math.PI / 2; tor.position.y = h * (0.35 + r * 0.4); tg.add(tor); rings.push(tor);
      }
      const capMat = new THREE.SpriteMaterial({ map: tex.glow, color: C.info, transparent: true, opacity: k ? 0.9 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
      const cap = new THREE.Sprite(capMat); cap.scale.setScalar(0.9); cap.position.y = h + 0.05; tg.add(cap);
      // fibre from the tower to the hub, with a pulse riding it while someone works
      let fibre = null, pulse = null;
      if (m > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(tx, 0.16, tz), hub]);
        fibre = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: C.info, transparent: true, opacity: 0.35 }));
        g.add(fibre);
        pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: C.orangeBright, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        pulse.scale.setScalar(0.45); g.add(pulse);
        pulses.push({ pulse, from: new THREE.Vector3(tx, 0.18, tz), to: hub.clone(), tower: null, seed: ti * 0.37 });
      }
      // a red light column + shockwave ring, shown while someone here needs you
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 9, 16, 1, true), new THREE.MeshBasicMaterial({ map: tex.beam, color: C.red, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = h + 4.5; beam.visible = false; tg.add(beam);
      const shock = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 64), new THREE.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      shock.rotation.x = -Math.PI / 2; shock.position.y = 0.02; shock.visible = false; tg.add(shock);
      const tower = { tg, h, bodyMat, edgeMat, capMat, rings, beam, shock, agents: tb.agents.map(a => a.pane), label: makeLabel('tab'), anchor: new THREE.Vector3(), fibre };
      tower.label.textContent = tb.tab.label || '#' + tb.tab.number;
      if (pulse) pulses[pulses.length - 1].tower = tower;
      towers.push(tower); plat.towers.push(tower);
      // agent cores
      tb.agents.forEach((a, j) => {
        const orbMat = new THREE.MeshBasicMaterial({ color: statusColor(a.status) });
        const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), orbMat);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: statusColor(a.status), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.scale.setScalar(0.85);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
        hit.userData.pane = a.pane;
        const holder = new THREE.Group(); holder.add(orb, glow, hit); tg.add(holder);
        // rising data while working
        const N = 14, pos = new Float32Array(N * 3);
        const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: C.orangeBright, size: 0.06, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        pts.visible = false; holder.add(pts);
        const sel = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 6, 40), new THREE.MeshBasicMaterial({ color: C.orange }));
        sel.visible = false; holder.add(sel);
        const halo = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 40), new THREE.MeshBasicMaterial({ color: C.green, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
        holder.add(halo);
        agentsByPane.set(a.pane, {
          a, holder, orb, orbMat, glow, hit, pts, pos, N, sel, halo, tower,
          phase: (j / Math.max(1, k)) * Math.PI * 2, radius: 0.62 + 0.04 * k, y: 0.45 + j * (h - 0.4) / Math.max(1, k),
          label: makeLabel('agent'), seeds: Array.from({ length: N }, (_, i) => (i * 0.618) % 1),
        });
      });
    });
    world.add(g);
  }
  if (glowScale !== 1) world.traverse(n => { if (n.isSprite) n.material.opacity *= glowScale; });
  scene.add(world);
  applyStatus();
  if (focus && agentsByPane.has(focus)) { fit(true); setFocus(focus, true); }
  else { focus = null; cardEl.hidden = true; fit(true); }
}

// ─── Status → materials (no rebuild) ─────────────────────────────────────────
function applyStatus() {
  for (const t of towers) {
    const list = t.agents.map(p => agentsByPane.get(p)?.a).filter(Boolean);
    const blocked = list.some(a => a.status === 'blocked');
    const col = blocked ? C.red : C.info;
    t.edgeMat.color.set(col); t.bodyMat.color.set(col); t.capMat.color.set(col);
    t.rings.forEach(r => r.material.color.set(col));
    t.beam.visible = blocked; t.shock.visible = blocked && !reduced;
    t.working = list.some(a => a.status === 'working');
    t.blocked = blocked;
  }
  for (const p of platforms) p.blocked = p.towers.some(t => t.blocked);
  for (const [pane, o] of agentsByPane) {
    const a = data.agents.find(x => x.pane === pane) || o.a;
    o.a = a;
    const col = statusColor(a.status);
    o.orbMat.color.set(col); o.glow.material.color.set(col);
    o.pts.visible = a.status === 'working' && !reduced;
    o.sel.visible = state.selected === pane || focus === pane;
    o.dim = !state.matches(a) || a.status === 'unknown';
    o.label.textContent = a.name || '?';
    o.label.classList.toggle('blocked', a.status === 'blocked');
    o.label.classList.toggle('fresh', !!a.showFresh && state.selected !== pane);
    o.label.classList.toggle('selected', state.selected === pane);
    o.label.classList.toggle('unnamed', !a.name);
    o.label.classList.toggle('claimed', !!a.claim);
    if (a.claim) {
      const [bg, ink] = a.claim.team ? ['linear-gradient(90deg, var(--color-blue) 0 50%, var(--color-yellow) 50% 100%)', '#0A0A0A'] : [['var(--color-blue)', '#FFFFFF'], ['var(--color-yellow)', '#0A0A0A'], ['var(--color-info)', '#0A0A0A'], ['#F0F0F0', '#0A0A0A']][(a.claim.slot || 0) % 4];
      o.label.dataset.who = a.claim.initial; o.label.style.setProperty('--who', bg); o.label.style.setProperty('--who-ink', ink);
    }
  }
}

// ─── Camera: orbit around a target; fit everything on one screen ─────────────
const cam = { az: -0.32, el: 0.92, dist: 30, fitDist: 30, target: null, moved: false };
function placeCamera() {
  const t = cam.target;
  camera.position.set(t.x + cam.dist * Math.cos(cam.el) * Math.sin(cam.az), t.y + cam.dist * Math.sin(cam.el), t.z + cam.dist * Math.cos(cam.el) * Math.cos(cam.az));
  camera.lookAt(t);
}
function fit(force) {
  if (!world) return;
  // fit the real shapes: hex corners of every deck and the top of every tower
  const corners = [];
  const centre = new THREE.Vector3();
  for (const p of platforms) {
    const c = p.g.position;
    centre.add(c);
    for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3; corners.push(new THREE.Vector3(c.x + Math.cos(ang) * (p.R + 0.35), 0, c.z + Math.sin(ang) * (p.R + 0.35))); }
  }
  for (const t of towers) { const w = t.tg.getWorldPosition(new THREE.Vector3()); corners.push(new THREE.Vector3(w.x, t.h + 0.9, w.z)); }
  if (!corners.length) corners.push(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 2, 3));
  if (platforms.length) centre.divideScalar(platforms.length);
  cam.target = new THREE.Vector3(centre.x, 0.6, centre.z);
  if (cam.moved && !force) return;
  if (!cam.moved) cam.el = camera.aspect < 1 ? 1.15 : 0.92; // portrait: look more from above
  world.updateMatrixWorld(true);
  let d = 30;
  for (let it = 0; it < 8; it++) {
    cam.dist = d; placeCamera(); camera.updateMatrixWorld();
    let m = 0;
    for (const c of corners) { const p = c.clone().project(camera); m = Math.max(m, Math.abs(p.x), Math.abs(p.y) * 1.08); }
    d *= m / 0.9;
  }
  cam.dist = cam.fitDist = d;
  if (force) cam.moved = false;
  placeCamera();
  scene.fog.near = d * 0.9; scene.fog.far = d * 3;
}

function resize() {
  if (!renderer || box.hidden) return;
  // one screen: the stage takes what the window has left below it
  const top = stage.getBoundingClientRect().top + window.scrollY;
  const h = Math.max(340, Math.round(window.innerHeight - top - (window.innerWidth < 600 ? 14 : 28)));
  stage.style.height = h + 'px';
  const w = stage.clientWidth;
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const key = (w / h > 1) + '|' + Math.round(w / 200);
  if (stage.dataset.shape !== key) { stage.dataset.shape = key; structureKey = ''; sync(); }
  else fit(false);
  render();
}

// ─── Input: drag to orbit, pinch / wheel to zoom, tap to pick ────────────────
function bindControls() {
  const el = renderer.domElement;
  const pts = new Map();
  let downAt = null, moved = 0, pinch0 = 0, dist0 = 0;
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.dist; }
    hideHint();
  });
  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') hover(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 1) {
      cam.az -= dx * 0.0075;
      cam.el = Math.min(1.42, Math.max(0.32, cam.el + dy * 0.006));
      cam.moved = true;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0) cam.dist = clampDist(dist0 * pinch0 / d);
      cam.moved = true;
    }
    placeCamera(); render();
  });
  const up = e => {
    const wasSingle = pts.size === 1;
    pts.delete(e.pointerId);
    if (wasSingle && downAt && moved < 8) pick(e);
    if (!pts.size) downAt = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  el.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clampDist(cam.dist * (1 + Math.sign(e.deltaY) * 0.08)); cam.moved = true; placeCamera(); render(); hideHint(); }, { passive: false });
  el.addEventListener('dblclick', () => { fit(true); render(); });
}
const clampDist = d => Math.min(cam.fitDist * 1.8, Math.max(cam.fitDist * 0.35, d));

function castAt(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...agentsByPane.values()].map(o => o.hit), false);
  return hits[0]?.object.userData.pane || null;
}
function pick(e) {
  const pane = castAt(e);
  if (!pane) { clearFocus(); return; }
  if (focus === pane) onPick(pane); else setFocus(pane);
}

// ─── Focus: the camera flies to a core and a command card opens beside it ────
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function flyTo(b, db, after) {
  fly = { a: cam.target.clone(), b: b.clone(), da: cam.dist, db, t0: performance.now(), dur: reduced ? 0 : 950, after };
  if (reduced || !running) stepFly(performance.now() + 2000);
}
function stepFly(t) {
  if (!fly) return;
  const k = fly.dur ? Math.min(1, (t - fly.t0) / fly.dur) : 1, e = ease(k);
  cam.target.lerpVectors(fly.a, fly.b, e);
  cam.dist = fly.da + (fly.db - fly.da) * e;
  placeCamera();
  if (k >= 1) { const f = fly.after; fly = null; f?.(); render(); }
}
function setFocus(pane, instant) {
  const o = agentsByPane.get(pane);
  if (!o) return;
  focus = pane;
  hideHint();
  cam.moved = true; // no drift while focused
  const w = o.tower.tg.getWorldPosition(new THREE.Vector3());
  w.y = Math.min(1.4, 0.4 + o.tower.h * 0.5);
  const d = Math.max(camera.aspect < 1 ? 7 : 4.5, Math.min(cam.fitDist * (camera.aspect < 1 ? 0.55 : 0.42), 12));
  if (instant) { cam.target.copy(w); cam.dist = d; placeCamera(); } else { flyTo(w, d); window.OrcaSound?.play('focus'); }
  applyStatus();
  updateCard();
  render();
}
function clearFocus() {
  if (!focus) return;
  focus = null;
  cardEl.hidden = true;
  const a = cam.target.clone(), da = cam.dist;
  fit(true);
  const b = cam.target.clone(), db = cam.dist;
  cam.target.copy(a); cam.dist = da; cam.moved = true; placeCamera();
  flyTo(b, db, () => { cam.moved = false; });
  applyStatus();
  render();
}
function updateCard() {
  const o = focus && agentsByPane.get(focus);
  if (!o) { cardEl.hidden = true; return; }
  const a = o.a;
  cardEl.hidden = false;
  cardEl.className = 'holo-card ' + (a.status || 'unknown');
  cardEl.querySelector('.hc-name').textContent = a.name || a.pane;
  const m = a.since ? Math.floor((now() - a.since) / 60000) : null;
  cardEl.querySelector('.hc-state').textContent = (L.st[a.status] || L.st.unknown) + (m === null ? '' : ' · ' + (m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'));
  cardEl.querySelector('.hc-title').textContent = a.title || '';
  cardEl.querySelector('.hc-open span').textContent = L.open;
  cardEl.querySelector('.hc-show:not(.hc-zoom) span').textContent = L.show;
  cardEl.querySelector('.hc-zoom span').textContent = L.zoom;
}
cardEl.querySelector('.hc-open').addEventListener('click', () => focus && onPick(focus));
cardEl.querySelector('.hc-show:not(.hc-zoom)').addEventListener('click', () => focus && onShow(focus));
cardEl.querySelector('.hc-zoom').addEventListener('click', () => focus && onShow(focus, true));
let hot = null;
function hover(e) {
  const pane = castAt(e);
  if (pane === hot) return;
  if (hot) agentsByPane.get(hot)?.label.classList.remove('hot');
  hot = pane;
  if (hot) agentsByPane.get(hot)?.label.classList.add('hot');
  renderer.domElement.style.cursor = hot ? 'pointer' : 'grab';
}
function hideHint() { hintEl.classList.add('gone'); }

// ─── Frame ───────────────────────────────────────────────────────────────────
const v3 = () => new THREE.Vector3();
const tmp = { a: null };
function animate(t) {
  const s = t / 1000;
  stepFly(t);
  if (!cam.moved && !fly && !reduced) { cam.az = -0.32 + Math.sin(s * 0.12) * 0.16; placeCamera(); } // slow drift
  if (bootT0) { // boot: decks rise one by one, labels come on last
    const el = t - bootT0;
    platforms.forEach((p, i) => { const k = Math.max(0, Math.min(1, (el - 250 - i * 170) / 750)); p.g.position.y = -3 * Math.pow(1 - k, 3); p.g.visible = k > 0; });
    const total = 250 + platforms.length * 170 + 750;
    titleEl.textContent = `${L.booting} ${String(Math.min(100, Math.round(el / total * 100))).padStart(3, ' ')}%`;
    if (el > total) { bootT0 = 0; platforms.forEach(p => { p.g.position.y = 0; p.g.visible = true; }); labelsEl.classList.remove('off'); titleEl.textContent = L.title; }
  }
  for (const p of platforms) {
    p.ring.rotation.y = s * 0.08;
    p.edges.material.color.set(p.blocked && Math.floor(t / 400) % 2 === 0 ? C.red : C.info);
  }
  for (const tw of towers) {
    tw.rings.forEach((r, i) => { r.rotation.z = (tw.working ? s * (1.6 + i) : s * 0.2) * (i ? -1 : 1); });
    if (tw.blocked) {
      const k = (s * 0.62) % 1;
      tw.shock.scale.setScalar(1 + k * 9); tw.shock.material.opacity = 0.75 * (1 - k);
      tw.beam.material.opacity = 0.55 + 0.35 * Math.sin(s * 8);
    }
  }
  for (const pl of pulses) {
    const on = pl.tower?.working;
    pl.pulse.material.opacity = on ? 0.95 : 0;
    if (on) { const k = (s * 0.7 + pl.seed) % 1; pl.pulse.position.lerpVectors(pl.from, pl.to, k); }
  }
  for (const [pane, o] of agentsByPane) {
    const st = o.a.status;
    const speed = st === 'working' ? 1.4 : st === 'blocked' ? 0 : 0.25;
    const ang = o.phase + s * speed;
    const bob = st === 'blocked' ? Math.abs(Math.sin(s * 5)) * 0.25 : Math.sin(s * 1.5 + o.phase) * 0.05;
    o.holder.position.set(Math.cos(ang) * o.radius, o.y + bob, Math.sin(ang) * o.radius);
    const breathe = st === 'idle' ? 0.75 + 0.25 * Math.sin(s * 1.6 + o.phase) : 1;
    const wave = (waves.get(pane) || 0) > Date.now();
    o.glow.scale.setScalar((wave ? 1.8 + 0.4 * Math.sin(s * 14) : 0.85) * breathe);
    if (wave) o.glow.material.color.set(C.orangeBright); else o.glow.material.color.set(statusColor(st));
    o.glow.material.opacity = (o.dim ? 0.25 : 0.9) * glowScale;
    o.orb.rotation.y = s * 2;
    o.sel.visible = state.selected === pane || focus === pane;
    if (o.sel.visible) { o.sel.lookAt(camera.position); o.sel.scale.setScalar(1 + Math.sin(s * 4) * 0.08); }
    if (st === 'done') { const k = (s * 0.5 + o.phase) % 1; o.halo.material.opacity = 0.8 * (1 - k); o.halo.scale.setScalar(1 + k * 2.2); o.halo.lookAt(camera.position); }
    else o.halo.material.opacity = 0;
    if (o.pts.visible) {
      for (let i = 0; i < o.N; i++) {
        const k = (o.seeds[i] + s * 0.45) % 1;
        o.pos[i * 3] = Math.sin(i * 2.4) * 0.12; o.pos[i * 3 + 1] = 0.1 + k * 1.3; o.pos[i * 3 + 2] = Math.cos(i * 2.4) * 0.12;
      }
      o.pts.geometry.attributes.position.needsUpdate = true;
    }
  }
}

function placeLabels() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const p = v3();
  const put = (el, vec, dy = 0) => {
    p.copy(vec).project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) { el.style.opacity = '0'; return; }
    el.style.opacity = '';
    el.style.transform = `translate(${((p.x + 1) / 2 * w).toFixed(1)}px, ${((1 - p.y) / 2 * h + dy).toFixed(1)}px) translate(-50%, -100%)`;
  };
  const many = agentsByPane.size > 14 && w < 600;
  for (const pl of platforms) put(pl.label, pl.anchor, 18);
  const fo = focus && agentsByPane.get(focus);
  if (fo && !cardEl.hidden && w >= 600) {
    fo.holder.getWorldPosition(p); p.project(camera);
    const x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
    const cw = cardEl.offsetWidth, ch = cardEl.offsetHeight;
    const left = Math.min(w - cw - 16, Math.max(16, x + 34)), top = Math.min(h - ch - 44, Math.max(40, y - ch / 2));
    cardEl.style.transform = `translate(${left.toFixed(0)}px, ${top.toFixed(0)}px)`;
  } else if (w < 600) cardEl.style.transform = '';
  const narrow = w < 600; // phones: tab names would crowd the cores
  for (const tw of towers) { tw.label.hidden = narrow; if (narrow) continue; tw.tg.getWorldPosition(p); const top = p.clone(); top.y += tw.h + 0.45; put(tw.label, top); }
  for (const [pane, o] of agentsByPane) {
    o.holder.getWorldPosition(p);
    const v = p.clone(); v.y -= 0.22;
    o.label.hidden = many && state.selected !== pane && o.a.status !== 'blocked';
    put(o.label, v, 16);
  }
}

function render() {
  if (!renderer || box.hidden) return;
  if (composer) composer.render(); else renderer.render(scene, camera);
  placeLabels();
}

function loop(t) {
  if (!running) return;
  raf = requestAnimationFrame(loop);
  if (document.hidden) return;
  if (t - lastFrame < 15) return;
  lastFrame = t;
  animate(t);
  render();
  if (Math.floor(t / 1000) !== Math.floor((t - 16) / 1000)) clock();
}
function start() { if (running || reduced || !renderer) return; running = true; raf = requestAnimationFrame(loop); }
function stop() { running = false; cancelAnimationFrame(raf); }

// ─── HUD ─────────────────────────────────────────────────────────────────────
function clock() {
  const d = new Date(now());
  clockEl.textContent = d.toLocaleTimeString(state.window.orcaLocale(lang), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function info() {
  if (failed) return;
  const sel = data.agents.find(a => a.pane === state.selected);
  const need = data.agents.filter(a => a.status === 'blocked').length;
  infoEl.classList.toggle('alert', !sel && need > 0);
  if (state.offline) infoEl.textContent = L.offline;
  else if (sel) infoEl.textContent = `▸ ${sel.name || sel.pane} — ${L.st[sel.status] || L.st.unknown}`;
  else if (need) infoEl.textContent = need === 1 ? L.needs1 : L.needs.replace('{0}', need);
  else infoEl.textContent = L.quiet;
  box.classList.toggle('alarm', need > 0);
}

function roster() {
  const key = data.agents.map(a => a.pane + a.name + a.status).join('|') + state.lang;
  if (rosterEl.dataset.key === key) return;
  rosterEl.dataset.key = key;
  rosterEl.replaceChildren(...data.agents.map(a => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${a.name || a.pane}: ${L.st[a.status] || L.st.unknown}`;
    b.addEventListener('click', () => onPick(a.pane));
    li.append(b);
    return li;
  }));
}

// ─── Data in ─────────────────────────────────────────────────────────────────
function sync() {
  if (!THREE || !renderer) return;
  const key = JSON.stringify([data.workspaces.map(w => w.id + w.label), data.tabs.map(t => t.id + t.label + t.panes.map(p => p.pane).join()), data.agents.map(a => a.pane)]);
  if (key !== structureKey) { structureKey = key; build(); }
  else applyStatus();
  render();
}

function demo(d) {
  d = { ...d, agents: d.agents.map(a => ({ ...a })) };
  const plan = ['blocked', 'working', 'done', 'working', 'idle', 'unknown'];
  d.agents.forEach((a, i) => { if (i < plan.length) a.status = plan[i]; });
  return d;
}

new MutationObserver(() => { if (!THREE) return; readTokens(); buildTable(); structureKey = ''; sync(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
addEventListener('resize', () => resize());

window.OrcaHolo = {
  onPick(fn) { onPick = fn; },
  update(d, s) {
    if (d) { data = DEMO ? demo(d) : d; if (d.now) skew = d.now - Date.now(); }
    Object.assign(state, s);
    L = T[state.lang] || T.en;
    box.querySelector('.holo-title').textContent = L.title;
    hintEl.textContent = L.hint;
    roster();
    info();
    if (!box.hidden) ensure().then(() => { sync(); updateCard(); });
  },
  show(on) {
    box.hidden = !on;
    if (!on) { stop(); box.classList.remove('alarm'); return; }
    ensure().then(() => {
      resize(); sync();
      if (!booted && renderer) {
        booted = true;
        if (!reduced) { window.OrcaSound?.play('boot'); bootT0 = performance.now(); labelsEl.classList.add('off'); stage.classList.add('booting'); setTimeout(() => stage.classList.remove('booting'), 1600); }
      }
      start(); clock();
    });
  },
  wave(pane) { waves.set(pane, Date.now() + 2200); },
  onShow(fn) { onShow = fn; },
  focus(pane) { if (THREE && renderer) setFocus(pane); },
  focused() { return focus; },
  clearFocus() { clearFocus(); },
  rectOf() { return null; },
};
})();
