'use strict';
// ORCA — sounds, synthesised with Web Audio (no audio files). Off by default; the
// choice is remembered per device (orca-sound). Short and quiet: a chime when an agent needs
// you, a soft arpeggio when one finishes, ticks and sweeps for selecting, sending and showing.
(() => {
let ctx = null, master = null;
let enabled = false;
try { enabled = localStorage.getItem('orca-sound') === 'on'; } catch { /* private mode */ }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Browsers only let audio start after a gesture: wake it on the first tap or key.
const wake = () => { if (enabled) audio(); };
addEventListener('pointerdown', wake, { once: true, capture: true });
addEventListener('keydown', wake, { once: true, capture: true });

// One note: oscillator → gain envelope (fast attack, exponential decay) → optional filter.
function note(freq, at, dur, { type = 'sine', gain = 0.12, to = null, filter = null } = {}) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc.connect(g);
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; node = node.connect(f); }
  node.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  needs:  () => { note(880, 0, 0.35, { gain: 0.14 }); note(1174.7, 0.13, 0.5, { gain: 0.14 }); note(1760, 0.13, 0.4, { type: 'triangle', gain: 0.03 }); },
  done:   () => { [523.3, 659.3, 784, 1046.5].forEach((f, i) => note(f, i * 0.07, 0.32, { type: 'triangle', gain: 0.07 })); },
  select: () => note(1600, 0, 0.05, { type: 'square', gain: 0.025, filter: 3000 }),
  focus:  () => { note(380, 0, 0.18, { type: 'sawtooth', gain: 0.04, to: 1400, filter: 2400 }); note(2200, 0.16, 0.06, { gain: 0.04 }); },
  show:   () => { note(300, 0, 0.22, { type: 'sawtooth', gain: 0.05, to: 1800, filter: 3000 }); note(1318.5, 0.2, 0.25, { gain: 0.08 }); },
  sent:   () => { note(660, 0, 0.09, { gain: 0.08 }); note(990, 0.07, 0.14, { gain: 0.08 }); },
  key:    () => note(1200, 0, 0.04, { type: 'triangle', gain: 0.05 }),
  switch: () => note(700, 0, 0.08, { type: 'triangle', gain: 0.05, to: 1050 }),
  boot:   () => { note(110, 0, 1.3, { type: 'sawtooth', gain: 0.05, to: 440, filter: 900 }); [0.35, 0.6, 0.85, 1.1].forEach((at, i) => note(1200 + i * 200, at, 0.05, { type: 'square', gain: 0.02, filter: 4000 })); note(1568, 1.3, 0.5, { gain: 0.07 }); },
  on:     () => { note(523.3, 0, 0.12, { gain: 0.08 }); note(784, 0.09, 0.2, { gain: 0.08 }); },
};

const last = {};
window.OrcaSound = {
  enabled: () => enabled,
  set(on) {
    enabled = !!on;
    try { localStorage.setItem('orca-sound', enabled ? 'on' : 'off'); } catch { /* private mode */ }
    if (enabled && audio()) SOUNDS.on();
  },
  play(name) {
    if (!enabled || !SOUNDS[name] || !audio()) return;
    const t = performance.now();
    if (last[name] && t - last[name] < 250) return; // never machine-gun
    last[name] = t;
    try { SOUNDS[name](); } catch { /* audio is a nicety */ }
  },
};
})();
