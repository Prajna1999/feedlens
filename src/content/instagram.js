// Instagram content script entry point.
// All FL.* symbols are in scope from earlier scripts in the manifest js array.

console.log('[FeedLens] Instagram content script loaded, path:', location.pathname);

// Send session metadata once on load
browser.runtime.sendMessage({
  type: 'session_start',
  sessionId: FL.SESSION_ID,
  platform: 'instagram',
  userAgent: navigator.userAgent,
  screenRes: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: navigator.language,
  ts: Date.now()
});

const { start } = FL.makeObserver({
  cardSelectors: [FL.instagram.SEL.CARD],
  onSeen: async (card, feedPosition, dwellMs) => {
    const path = location.pathname;
    if (path !== '/' && !path.startsWith('/reels/')) return;

    const meta    = FL.instagram.extractMeta(card);
    const cls     = FL.instagram.classify(card);
    const media   = FL.instagram.classifyMedia(card);
    const fp      = await FL.fingerprint(meta.handle + '|' + meta.caption);
    const topics  = FL.inferTopics(meta.caption + ' ' + meta.hashtags.join(' '));
    const surface = location.pathname.startsWith('/reels/') ? 'reels' : 'home';

    console.log('[FeedLens:ig]', cls, media, topics.join(',') || 'no-topic', '@' + (meta.handle || '?'), 'pos:', feedPosition);

    browser.runtime.sendMessage({
      type: 'card_seen',
      platform: 'instagram',
      sessionId: FL.SESSION_ID,
      surface,
      ts: Date.now(),
      fp,
      feedPosition,
      dwellMs,
      class: cls,
      media,
      topics,
      ...meta
    });

    FL.instagram.attachInteractionListeners(card, fp, FL.SESSION_ID);
  }
});

start();
