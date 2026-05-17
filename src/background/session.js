const SESSION_WINDOW_MS = 30 * 60 * 1000;

export function pruneEvents(events, now = Date.now()) {
  return events.filter(e => (now - e.ts) < SESSION_WINDOW_MS);
}

export function countWindow(events, now = Date.now()) {
  const window = pruneEvents(events, now);
  const counts = { ad: 0, subscribed: 0, recommended: 0, unknown: 0 };
  for (const e of window) {
    counts[e.class] = (counts[e.class] ?? 0) + 1;
  }
  return { total: window.length, counts };
}
