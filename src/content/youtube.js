// YouTube content script entry point.
// All FL.* symbols are in scope from earlier scripts in the manifest js array.

console.log('[FeedLens] YouTube content script loaded, path:', location.pathname);

browser.runtime.sendMessage({
  type: 'session_start',
  sessionId: FL.SESSION_ID,
  platform: 'youtube',
  userAgent: navigator.userAgent,
  screenRes: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: navigator.language,
  ts: Date.now()
});

const YS = FL.youtube.SEL;

const { start } = FL.makeObserver({
  cardSelectors: [YS.HOMEPAGE_CARD, YS.SIDEBAR_CARD, YS.AUTOPLAY_CARD, YS.SHORTS_CARD, YS.WATCH_CARD],
  onSeen: async (card, feedPosition, dwellMs) => {
    const meta    = FL.youtube.extractMeta(card);
    const cls     = FL.youtube.classify(card);
    const media   = FL.youtube.classifyMedia(card);
    const fp      = await FL.fingerprint(meta.handle + '|' + meta.caption);
    const topics  = FL.inferTopics(meta.caption + ' ' + meta.description + ' ' + meta.hashtags.join(' '));
    const surface = FL.youtube.getSurface();

    console.log('[FeedLens:yt]', cls, media, topics.join(',') || 'no-topic', meta.handle || '?', 'pos:', feedPosition);

    browser.runtime.sendMessage({
      type: 'card_seen',
      platform: 'youtube',
      sessionId: FL.SESSION_ID,
      surface,
      ts: Date.now(),
      fp,
      feedPosition,
      dwellMs,
      class: cls,
      media,
      topics,
      isSponsored: cls === 'ad',
      ...meta
    });

    FL.youtube.attachInteractionListeners(card, fp, FL.SESSION_ID);
  }
});

start();
