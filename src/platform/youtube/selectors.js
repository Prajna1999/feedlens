window.FL = window.FL || {}; var FL = window.FL;
FL.youtube = FL.youtube || {};

FL.youtube.SEL = {
  HOMEPAGE_CARD:   'ytd-rich-item-renderer',
  SIDEBAR_CARD:    'ytd-compact-video-renderer',
  AUTOPLAY_CARD:   'ytd-autoplay-video-renderer',
  SHORTS_CARD:     'ytd-reel-item-renderer, ytd-shorts',
  WATCH_CARD:      'ytd-watch-metadata',  // currently playing video info panel

  // TITLE, CHANNEL, VIDEO_LINK, DURATION — handled with multi-selector fallback loops in extractor.js
  LIVE_BADGE:      'ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"]',
  LIVE_BADGE:      'ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"]',
  AD_BADGE:        'ytd-ad-slot-renderer, [is-ad-component], ytd-promoted-video-renderer',
  SUBSCRIBE_BTN:   'yt-formatted-string.ytd-subscribe-button-renderer, tp-yt-paper-button#subscribe-button',
  DESCRIPTION:     '#description-text, ytd-video-secondary-info-renderer #description',
};

FL.youtube.getSurface = function() {
  const p = location.pathname;
  if (p === '/feed/subscriptions') return 'subscriptions'; // separate — all content is subscribed
  if (p === '/') return 'homepage';
  if (p.startsWith('/watch')) return 'sidebar';
  if (p.startsWith('/shorts')) return 'shorts';
  if (p.startsWith('/results')) return 'search';
  return 'homepage';
};
