import { load, save } from './storage.js';
import { pruneEvents } from './session.js';

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

async function handleCardSeen(msg) {
  console.log('[FeedLens bg] received card_seen:', msg.class, msg.media, msg.fp);
  const now = Date.now();
  const data = await load();

  const isDupe = data.events.some(e => e.fp === msg.fp && (now - e.ts) < DEDUP_WINDOW_MS);
  if (isDupe) {
    console.log('[FeedLens bg] deduped:', msg.fp);
    return;
  }

  data.events.push({ ts: msg.ts, class: msg.class, media: msg.media, fp: msg.fp });
  data.totals[msg.class] = (data.totals[msg.class] ?? 0) + 1;
  data.media[msg.media ?? 'unknown'] = (data.media[msg.media ?? 'unknown'] ?? 0) + 1;
  data.events = pruneEvents(data.events, now);

  await save(data);
  console.log('[FeedLens bg] totals:', JSON.stringify(data.totals), 'media:', JSON.stringify(data.media));
}

// Listener must return synchronously — async handlers can cause Firefox to drop messages.
// Fire-and-forget the async work instead.
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'card_seen') handleCardSeen(msg);
});
