'use strict';

const MIN_WAKE_MINUTES = 1;
const MAX_WAKE_MINUTES = 1440;

function wakeInMinutes(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  if (!Object.hasOwn(body, 'wakeInMinutes')) return null;
  const n = body.wakeInMinutes;
  if (!Number.isInteger(n) || n < MIN_WAKE_MINUTES || n > MAX_WAKE_MINUTES) return undefined;
  return n;
}

// Split persisted sleep entries into stale panes, due wakes, and timers to re-arm.
function reconcile(sleeping, livePanes, isPidAlive, now = Date.now()) {
  const drop = [];
  const wake = [];
  const arm = [];
  for (const [pane, entry] of Object.entries(sleeping || {})) {
    if (!livePanes.has(pane) || !Array.isArray(entry.pids) || !entry.pids.length || !entry.pids.every(isPidAlive)) {
      drop.push(pane);
    } else if (entry.wakeAt != null && Date.parse(entry.wakeAt) <= now) {
      wake.push(pane);
    } else if (entry.wakeAt != null) {
      arm.push(pane);
    }
  }
  return { drop, wake, arm };
}

module.exports = { MIN_WAKE_MINUTES, MAX_WAKE_MINUTES, wakeInMinutes, reconcile };
