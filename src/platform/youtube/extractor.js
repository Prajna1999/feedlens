window.FL = window.FL || {}; var FL = window.FL;
FL.youtube = FL.youtube || {};

const S = FL.youtube.SEL;

FL.youtube.classify = function(card) {
  // Promoted/ad slot
  if (card.matches(S.AD_BADGE) || card.querySelector(S.AD_BADGE)) return 'ad';
  if (card.querySelector('[aria-label*="Ad"]')) return 'ad';

  const surface = FL.youtube.getSurface();

  // Subscriptions feed — everything here is from channels you follow
  if (surface === 'subscriptions') return 'subscribed';

  // Watch page: use subscribe button state for the currently playing video
  if (card.tagName?.toLowerCase() === 'ytd-watch-metadata') {
    const subText = card.querySelector('ytd-subscribe-button-renderer button span[role="text"]')?.textContent?.trim() || '';
    if (/subscribed/i.test(subText)) return 'subscribed';
    if (/subscribe/i.test(subText)) return 'recommended';
    return 'unknown';
  }

  // Sidebar/autoplay — algorithmic recommendations
  if (surface === 'sidebar') return 'recommended';

  // Search results — intent-driven
  if (surface === 'search') return 'unknown';

  // Homepage / shorts: check subscribe button state if present in DOM
  const subBtn = card.querySelector(S.SUBSCRIBE_BTN);
  if (subBtn) {
    const label = (subBtn.getAttribute('aria-label') || subBtn.textContent || '').trim().toLowerCase();
    if (/\bsubscribed\b/.test(label)) return 'subscribed';
    if (/\bsubscribe\b/.test(label)) return 'recommended';
  }

  return 'unknown';
};

FL.youtube.classifyMedia = function(card) {
  if (card.matches('ytd-reel-item-renderer') || card.closest('ytd-shorts')) return 'short';
  if (card.querySelector(S.LIVE_BADGE)) return 'live';
  return 'video';
};

FL.youtube.extractMetaWatchPage = function(card) {
  // Title: h1 yt-formatted-string has title attribute with untruncated text
  const titleEl = card.querySelector('#title h1 yt-formatted-string, h1 yt-formatted-string');
  const caption = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';

  // Channel name + URL from video owner renderer
  const ownerLink = card.querySelector('ytd-video-owner-renderer > a.yt-simple-endpoint');
  const channelHref = ownerLink?.getAttribute('href') || '';
  const channelUrl = channelHref ? 'https://www.youtube.com' + channelHref : '';

  // Handle: <a> inside ytd-channel-name is the leaf node with the display name text.
  // yt-formatted-string#text wraps it but its textContent can include sibling sub-text,
  // so we target the <a> directly. Fall back to URL path extraction.
  let handle = '';
  for (const sel of ['ytd-channel-name a', 'ytd-channel-name yt-formatted-string', '#owner ytd-channel-name']) {
    const el = card.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) { handle = t; break; }
  }
  if (!handle && channelHref) {
    const m = channelHref.match(/\/@([^/?]+)/);
    if (m) handle = '@' + m[1];
  }

  // Subscriber count from owner-sub-count aria-label ("2.22 million subscribers")
  const subCountEl = card.querySelector('#owner-sub-count');
  const subscriberCount = subCountEl?.getAttribute('aria-label') || subCountEl?.textContent?.trim() || null;

  // Video URL: current page URL
  const contentUrl = location.href;

  // Precise view count + premiere date from tooltip (e.g. "65,887 views • Premiered Apr 19, 2026 • 14 products")
  const tooltipText = card.querySelector('tp-yt-paper-tooltip #tooltip')?.textContent?.trim() || '';
  let viewCount = null;
  let publishedAt = '';
  if (tooltipText) {
    const vM = tooltipText.match(/([\d,]+)\s*views?/i);
    if (vM) viewCount = FL.parseCount(vM[1].replace(/,/g, '')) || null;
    const dM = tooltipText.match(/Premiered\s+([^•]+)/i) || tooltipText.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/);
    if (dM) publishedAt = dM[1].trim();
  }

  // Fallback view count + date from #info spans if tooltip didn't yield them
  if (!viewCount || !publishedAt) {
    const infoSpans = [...card.querySelectorAll('#info span[dir="auto"]')];
    if (!viewCount) {
      const viewEl = infoSpans.find(s => /view/i.test(s.textContent));
      if (viewEl) viewCount = FL.parseCount(viewEl.textContent.replace(/\s*views?/i, '').trim()) || null;
    }
    if (!publishedAt) {
      // Match absolute dates ("Jan 5, 2024"), relative dates ("3 weeks ago", "2 months ago"), and years
      const dateEl = infoSpans.find(s =>
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(s.textContent) ||
        /\d{4}/.test(s.textContent) ||
        /\d+\s*(second|minute|hour|day|week|month|year)/i.test(s.textContent)
      );
      publishedAt = dateEl?.textContent?.trim() || '';
    }
  }

  // Like count: button text content "4.5K" is most reliable; fall back to aria-label parsing
  const likeBtn = card.querySelector('like-button-view-model button[aria-label]');
  let likeCount = null;
  if (likeBtn) {
    const btnText = likeBtn.querySelector('.ytSpecButtonShapeNextButtonTextContent')?.textContent?.trim();
    if (btnText) {
      likeCount = FL.parseCount(btnText) || null;
    } else {
      const label = likeBtn.getAttribute('aria-label') || '';
      const m = label.match(/([\d,]+)\s*(K|M|B)?\s*other/i) || label.match(/along with ([\d,.]+[KMB]?)/i);
      if (m) likeCount = FL.parseCount(m[1]) || null;
    }
  }

  // Description: try expanded first, fall back to snippet (when description is collapsed)
  const expandedEl = card.querySelector('#description-inline-expander #expanded yt-attributed-string, #description-inline-expander #expanded');
  const snippetEl = card.querySelector('#attributed-snippet-text');
  const rawDesc = expandedEl?.textContent?.trim() || snippetEl?.textContent?.trim() || '';
  const description = rawDesc.replace(/\s{3,}/g, '\n').trim();

  // Hashtags from description links and #info links
  const hashLinks = [...card.querySelectorAll('#expanded a[href^="/hashtag/"], #info a[href^="/hashtag/"]')];
  const hashtags = hashLinks.map(a => a.textContent?.trim()).filter(Boolean);

  // Mentions from @-links in description
  const mentionLinks = [...card.querySelectorAll('#expanded a[href^="/@"]')];
  const mentions = mentionLinks.map(a => {
    const t = a.textContent?.trim();
    return t ? (t.startsWith('@') ? t : '@' + t) : null;
  }).filter(Boolean);

  // Chapters from macro markers list
  const chapterEls = [...card.querySelectorAll('ytd-macro-markers-list-item-renderer h4.macro-markers')];
  const chapters = chapterEls.map(el => {
    const title = el.getAttribute('title') || el.textContent?.trim() || '';
    const timeEl = el.closest('ytd-macro-markers-list-item-renderer')?.querySelector('#time');
    const timestamp = timeEl?.textContent?.trim() || '';
    return title ? { title, timestamp } : null;
  }).filter(Boolean);

  // Merch shelf items
  const merchEls = [...card.querySelectorAll('ytd-merch-shelf-item-renderer a[aria-label]')];
  const merch = merchEls.map(el => el.getAttribute('aria-label')?.trim()).filter(Boolean);

  return {
    handle,
    channelUrl,
    contentUrl,
    caption,
    description,
    hashtags,
    mentions,
    publishedAt,
    duration: null, // duration not in watch metadata panel
    viewCount,
    likeCount,
    commentCount: null,
    shareCount: null,
    locationTag: '',
    isPaidPartnership: false,
    musicInfo: '',
    slideCount: null,
    subscriberCount,
    chapters: chapters.length ? chapters : null,
    merch: merch.length ? merch : null,
  };
};

FL.youtube.extractMeta = function(card) {
  if (card.tagName?.toLowerCase() === 'ytd-watch-metadata') {
    return FL.youtube.extractMetaWatchPage(card);
  }

  // Title: prefer title attribute (untruncated); fall back through multiple elements
  let caption = '';
  for (const sel of ['yt-formatted-string#video-title', 'a#video-title', '#video-title', 'h3 a', 'h3']) {
    const el = card.querySelector(sel);
    if (!el) continue;
    const t = el.getAttribute('title') || el.textContent?.trim();
    if (t) { caption = t; break; }
  }

  // Channel name: target the <a> leaf node first — its textContent is the display name only,
  // whereas yt-formatted-string.textContent can bleed in subscriber/separator sibling text.
  // a[href^="/@"] is a reliable structural fallback for modern YouTube /@handle URLs.
  let handle = '';
  for (const sel of [
    'ytd-channel-name a',
    '#channel-name a',
    'a[href^="/@"]',
    'ytd-channel-name yt-formatted-string',
    '#channel-name yt-formatted-string',
    'ytd-channel-name',
  ]) {
    const el = card.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) { handle = t; break; }
  }

  // Channel URL
  let channelUrl = '';
  const channelLink = card.querySelector('ytd-channel-name a, #channel-name a, a[href^="/@"]');
  const channelHref = channelLink?.getAttribute('href') || '';
  if (channelHref) channelUrl = channelHref.startsWith('http') ? channelHref : 'https://www.youtube.com' + channelHref;

  // Video URL: thumbnail link is most reliable; title link as fallback
  let contentUrl = '';
  for (const sel of ['a#thumbnail', 'a#video-title', 'h3 a']) {
    const el = card.querySelector(sel);
    const href = el?.getAttribute('href') || '';
    if (href) { contentUrl = href.startsWith('http') ? href : 'https://www.youtube.com' + href; break; }
  }

  // View count: scan metadata area for "N views" pattern
  const metaSpans = [...card.querySelectorAll(
    '#metadata-line span, #metadata-line yt-formatted-string, .inline-metadata-item'
  )];
  const viewEl = metaSpans.find(el => /[\d,.]+\s*(K|M|B)?\s*view/i.test(el.textContent));
  const viewCount = viewEl ? FL.parseCount(viewEl.textContent.replace(/\s*views?/i, '').trim()) || null : null;

  // Published date
  const publishedAt = metaSpans.find(el =>
    /\d+\s*(second|minute|hour|day|week|month|year)/i.test(el.textContent)
  )?.textContent?.trim() || '';

  // Duration: aria-label on overlay, then badge text
  let duration = null;
  const overlayEl = card.querySelector('ytd-thumbnail-overlay-time-status-renderer');
  if (overlayEl) {
    const ariaLabel = overlayEl.getAttribute('aria-label') || '';
    const badgeText = overlayEl.querySelector('span, badge-shape')?.textContent?.trim();
    duration = FL.parseDuration(badgeText) ?? (() => {
      const m = ariaLabel.match(/(?:(\d+)\s*hour[s]?,?\s*)?(?:(\d+)\s*minute[s]?,?\s*)?(?:(\d+)\s*second[s]?)?/i);
      if (!m || (!m[1] && !m[2] && !m[3])) return null;
      return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
    })();
  }

  const descEl = card.querySelector(S.DESCRIPTION);
  const description = descEl?.textContent?.trim() || '';

  const hashtags = FL.extractHashtags(caption + ' ' + description);
  const mentions = FL.extractMentions(caption + ' ' + description);

  return {
    handle,
    channelUrl,
    contentUrl,
    caption,
    description,
    hashtags,
    mentions,
    publishedAt,
    duration,
    viewCount,
    likeCount: null,
    commentCount: null,
    shareCount: null,
    locationTag: '',
    isPaidPartnership: false,
    musicInfo: '',
    slideCount: null,
  };
};
