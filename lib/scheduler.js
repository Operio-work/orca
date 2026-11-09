'use strict';

// In-process scheduler: no system cron is touched. Every tick it looks at the enabled
// routines and fires the ones whose next run time has passed. Runs missed while the panel
// was stopped are skipped (the next run is worked out from when it starts again), so a
// laptop waking up never fires a backlog of agents at once.

const cron = require('./cron');

class Scheduler {
  // list: () => [{ id, schedule, enabled }]; fire: routine => Promise
  constructor({ list, fire, tickMs = 30000, now = () => new Date(), log = () => {} }) {
    this.list = list; this.fire = fire; this.tickMs = tickMs; this.now = now; this.log = log;
    this.next = new Map(); // id -> { schedule, at: Date|null }
    this.timer = null;
  }

  // When a routine runs next (recomputed if its schedule changed). null = never / disabled.
  nextFor(r, from = this.now()) {
    if (!r.enabled) { this.next.delete(r.id); return null; }
    const cur = this.next.get(r.id);
    if (cur && cur.schedule === r.schedule) return cur.at;
    let at = null;
    try { at = cron.nextRun(r.schedule, from); } catch { at = null; }
    this.next.set(r.id, { schedule: r.schedule, at });
    return at;
  }

  async tick() {
    const now = this.now();
    const routines = this.list();
    const live = new Set(routines.map(r => r.id));
    for (const id of this.next.keys()) if (!live.has(id)) this.next.delete(id);
    for (const r of routines) {
      const at = this.nextFor(r, now);
      if (!at || at > now) continue;
      // Work out the following run before firing, so a slow start never fires twice.
      let following = null;
      try { following = cron.nextRun(r.schedule, now); } catch { /* invalid */ }
      this.next.set(r.id, { schedule: r.schedule, at: following });
      try { await this.fire(r, 'schedule'); }
      catch (e) { this.log('routine.fire_error', { id: r.id, detail: e.detail || e.message }); }
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.tick().catch(() => {}); }, this.tickMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() { clearInterval(this.timer); this.timer = null; }
}

module.exports = { Scheduler };
