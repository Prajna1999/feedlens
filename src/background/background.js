import { load, save } from './storage.js';

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

async function handleSessionStart(msg) {
  const data = await load();
  if (!data.sessions[msg.sessionId]) {
    data.sessions[msg.sessionId] = {
      start: msg.ts,
      platform: msg.platform,
      userAgent: msg.userAgent,
      screenRes: msg.screenRes,
      timezone: msg.timezone,
      language: msg.language
    };
    await save(data);
    console.log('[FeedLens bg] session registered:', msg.sessionId, msg.platform);
  }
}

async function handleCardSeen(msg) {
  const now = Date.now();
  const data = await load();

  // Scan only recent tail — events are append-only so dupes are always near the end
  const cutoff = now - DEDUP_WINDOW_MS;
  const tail = data.events.filter(e => e.ts >= cutoff);
  const isDupe = tail.some(e => e.fp === msg.fp && e.platform === msg.platform);
  if (isDupe) return;

  data.events.push({
    ts:               msg.ts,
    fp:               msg.fp,
    sessionId:        msg.sessionId,
    platform:         msg.platform,
    surface:          msg.surface,
    class:            msg.class,
    media:            msg.media,
    topics:           msg.topics || [],
    handle:           msg.handle || '',
    contentUrl:       msg.contentUrl || '',
    caption:          msg.caption || '',
    description:      msg.description || '',
    likeCount:        msg.likeCount ?? null,
    commentCount:     msg.commentCount ?? null,
    viewCount:        msg.viewCount ?? null,
    shareCount:       msg.shareCount ?? null,
    hashtags:         msg.hashtags || [],
    mentions:         msg.mentions || [],
    publishedAt:      msg.publishedAt || '',
    duration:         msg.duration ?? null,
    locationTag:      msg.locationTag || '',
    isSponsored:      msg.isSponsored || false,
    isPaidPartnership: msg.isPaidPartnership || false,
    musicInfo:        msg.musicInfo || '',
    slideCount:       msg.slideCount ?? null,
    feedPosition:     msg.feedPosition,
    dwellMs:          msg.dwellMs,
  });

  data.totals[msg.class] = (data.totals[msg.class] ?? 0) + 1;
  const mediaKey = msg.media ?? 'unknown';
  data.media[mediaKey] = (data.media[mediaKey] ?? 0) + 1;

  await save(data);
  console.log('[FeedLens bg] event saved. total events:', data.events.length, 'platform:', msg.platform);
}

async function handleUserAction(msg) {
  const data = await load();
  data.actions.push({
    ts:         msg.ts,
    sessionId:  msg.sessionId,
    platform:   msg.platform,
    contentFp:  msg.contentFp,
    action:     msg.action,
    surface:    msg.surface
  });
  await save(data);
  console.log('[FeedLens bg] action saved:', msg.action, msg.platform);
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'session_start') handleSessionStart(msg);
  else if (msg.type === 'card_seen') handleCardSeen(msg);
  else if (msg.type === 'user_action') handleUserAction(msg);
});
