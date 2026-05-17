window.FL = window.FL || {}; var FL = window.FL;
FL.instagram = FL.instagram || {};

const S = FL.instagram.SEL;

FL.instagram.getFollowState = function(card) {
  // Instagram uses div[role="button"] not <button> for follow — no <header> wrapper either
  for (const btn of card.querySelectorAll('[role="button"], button')) {
    const label = (btn.textContent || '').trim();
    if (label === 'Follow') return 'not-following';
    if (label === 'Following' || label === 'Unfollow') return 'following';
  }
  return 'unknown'; // button absent — own post or not yet rendered
};

FL.instagram.classify = function(card) {
  const headerText = (card.querySelector('header') ?? card).textContent ?? '';
  const fullText = card.textContent ?? '';

  if (/\bSponsored\b/i.test(headerText)) return 'ad';
  if (card.querySelector(S.SPONSORED_LINK)) return 'ad';
  if (/Paid [Pp]artnership/i.test(headerText)) return 'ad';

  if (/Suggested (for you|post|reel|reels)/i.test(fullText)) return 'recommended';
  if (/Recommended for you/i.test(fullText)) return 'recommended';

  const followState = FL.instagram.getFollowState(card);
  if (followState === 'not-following') return 'recommended';
  if (followState === 'following') return 'subscribed';
  return 'unknown';
};

FL.instagram.classifyMedia = function(card) {
  if (card.querySelector('video')) return 'video';
  const ul = card.querySelector('ul');
  if (ul && ul.children.length > 1) return 'carousel';
  if (card.querySelector('img')) return 'image';
  return 'unknown';
};

FL.instagram.extractMeta = function(card) {
  // Handle: find the profile link — pathname is /username/ (one segment).
  // Strip query params before matching — sponsored posts have tracking params on the profile href.
  // The avatar is a <span role="link"><img></span>, not an <a>, so we only scan <a> tags.
  let handle = '';
  const NON_USER = new Set(['explore', 'reels', 'stories', 'p', 'reel', 'tv', 'music', 'accounts', 'ads', 'about', 'legal', 'directory']);
  for (const a of card.querySelectorAll('a[href]')) {
    const path = (a.getAttribute('href') || '').split('?')[0];
    const m = path.match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (!m || NON_USER.has(m[1])) continue;
    const t = a.textContent?.trim();
    handle = (t && t.length >= 1) ? t : m[1]; // prefer visible text; fall back to href-extracted
    break;
  }

  const postHref = card.querySelector(S.POST_LINK)?.getAttribute('href') ||
                   card.querySelector(S.REEL_LINK)?.getAttribute('href') || '';
  const contentUrl = postHref ? `https://www.instagram.com${postHref}` : '';

  // Caption: find the first [dir="auto"] span that isn't the username.
  // Username spans are always inside <a> tags so we skip those.
  // We do NOT skip [role="button"] ancestors — Instagram wraps the entire caption in a
  // div[role="button"] (tap-to-expand), so that skip would kill caption extraction entirely.
  // Instagram UI labels (Follow, Like, etc.) do not carry dir="auto" so they won't match.
  let caption = '';
  for (const el of card.querySelectorAll('[dir="auto"]')) {
    if (el.closest('a')) continue; // username, hashtag, or location link — skip
    const t = el.textContent?.trim();
    if (t && t.length > 5 && !/^[•·\-–—]+$/.test(t)) {
      caption = t.replace(/\s*\.{3}\s*more\s*$/i, '').trim(); // strip trailing "...more"
      break;
    }
  }
  if (!caption) {
    const captionEl = card.querySelector('h1, [data-testid="post-caption"]');
    caption = captionEl?.textContent?.trim() || '';
  }

  const hashtags = FL.extractHashtags(caption);
  const mentions = FL.extractMentions(caption);

  const locationEl = card.querySelector(S.LOCATION);
  const locationTag = locationEl?.textContent?.trim() || '';

  const musicEl = card.querySelector(S.MUSIC_INFO);
  const musicInfo = musicEl?.textContent?.trim() || '';

  const timestampEl = card.querySelector(S.TIMESTAMP);
  const publishedAt = timestampEl?.getAttribute('datetime') || timestampEl?.textContent?.trim() || '';

  const isSponsored = /\bSponsored\b/i.test((card.querySelector('header') ?? card).textContent ?? '');
  const isPaidPartnership = /Paid [Pp]artnership/i.test(card.textContent ?? '');

  const slideList = card.querySelector('ul');
  const slideCount = (slideList && slideList.children.length > 1) ? slideList.children.length : null;

  // Like + comment counts live in <section> as <span role="button"> with numeric text.
  // Order in DOM is always: Like-btn, LikeCount, Comment-btn, CommentCount, Share-btn, Save-btn.
  const section = card.querySelector('section');
  const countSpans = section
    ? [...section.querySelectorAll('span[role="button"]')]
        .filter(s => /^[\d,.]+[KMBkmb]?\s*$/.test(s.textContent?.trim()))
    : [];
  const likeCount = FL.parseCount(countSpans[0]?.textContent?.trim()) || null;
  const commentCount = FL.parseCount(countSpans[1]?.textContent?.trim()) || null;

  // View count: aria-label on video view span (e.g. "1,234 views")
  const viewText = card.querySelector(S.VIEW_COUNT)?.getAttribute('aria-label')?.match(/[\d,.]+[KMB]?/i)?.[0] || null;
  const viewCount = FL.parseCount(viewText) || null;

  return {
    handle,
    contentUrl,
    caption,
    description: '', // Instagram doesn't show extended description in feed cards
    hashtags,
    mentions,
    locationTag,
    musicInfo,
    publishedAt,
    isSponsored,
    isPaidPartnership,
    slideCount,
    likeCount,
    commentCount,
    viewCount,
    shareCount: null, // not shown in feed DOM
    duration: null,   // not applicable for images; video length not shown in feed
  };
};
