window.FL = window.FL || {}; var FL = window.FL;

FL.instagram = FL.instagram || {};

FL.instagram.SEL = {
  CARD:              'article',
  HEADER_LINK:       'header a',  // text-content checked in extractor to skip avatar links
  POST_LINK:         'a[href*="/p/"]',
  REEL_LINK:         'a[href*="/reel/"]',
  // Avoid bare span[dir="auto"] — also matches usernames in header
  CAPTION:           'h1, [data-testid="post-caption"], ._a9zs, div._a9zs span, li._acaz span[dir="auto"]',
  FOLLOW_BTN:        'header button, header [role="button"]',
  SPONSORED_LINK:    '[href*="facebook.com/ads"], [href*="instagram.com/ads"], [href*="/ads/about"]',
  MUSIC_INFO:        'a[href*="/music/"], ._abm4, [aria-label*="Audio"]',
  LOCATION:          'a[href*="/explore/locations/"]',
  LIKE_COUNT:        'section span[aria-label*="like"] ~ span, a[href*="liked_by"] span',
  COMMENT_COUNT:     'a[href*="comments"] span',
  VIEW_COUNT:        'span[aria-label*="view"]',
  TIMESTAMP:         'time[datetime], a time',
  SLIDE_COUNT_DOTS:  'div[role="presentation"] > div > span',
};
