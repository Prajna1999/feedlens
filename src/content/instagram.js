// Content script — constants inlined (ES module imports unavailable in content scripts)
const DWELL_MS = 300;
const VISIBILITY_RATIO = 0.6;

const FEED_CARD = 'article';
const REEL_CARD = 'div[data-media-type="reel"]';

console.log('[FeedLens] content script loaded, path:', location.pathname);

// ── Media type ────────────────────────────────────────────────────
// Detects whether a card contains a static image, video/reel, or carousel.
//
// TO VERIFY in DevTools (F12 → Inspector, click into a post):
//   Video posts:    look for <video> inside the article
//   Carousels:      look for <ul> with multiple <li> children (the slide list)
//                   or a button[aria-label="Next"] / button[aria-label="Go forward"]
//   Static image:   just <img> with no video sibling

function classifyMedia(card) {
  if (card.querySelector('video')) return 'video';
  // Carousel: Instagram wraps slides in a <ul> with role="presentation" or uses
  // navigation arrows. The Next button aria-label varies by locale but checking
  // for the slide list structure is more stable.
  const slideList = card.querySelector('ul');
  if (slideList && slideList.children.length > 1) return 'carousel';
  if (card.querySelector('img')) return 'image';
  return 'unknown';
}

// ── Classifier ────────────────────────────────────────────────────
// Subscribed heuristic:
//   Instagram shows a "Follow" button in the post header for accounts you DON'T follow.
//   For accounts you DO follow, the button either says "Following" or is absent entirely.
//   So: no-follow-button + no ad/recommended signals → subscribed.
//
// TO VERIFY in DevTools:
//   On a post from someone you follow: inspect the article > header > div > button
//   — it should say "Following" or be absent.
//   On a suggested post: the button should say "Follow".
//   The aria-label on the button is often "Follow" / "Following" even if text is locale-specific.

function getFollowState(card) {
  const buttons = card.querySelectorAll('header button, header [role="button"]');
  for (const btn of buttons) {
    const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim().toLowerCase();
    if (label === 'follow') return 'not-following';
    if (label === 'following') return 'following';
  }
  // No follow button found — likely already following (Instagram hides it)
  return 'following';
}

function getHeaderText(card) {
  const header = card.querySelector('header') ?? card;
  return header.textContent ?? '';
}

function classify(card) {
  const headerText = getHeaderText(card);
  const fullText = card.textContent ?? '';

  // Ad signals
  if (/\bSponsored\b/i.test(headerText)) return 'ad';
  if (card.querySelector('[href*="facebook.com/ads"], [href*="instagram.com/ads"], [href*="/ads/about"]')) return 'ad';

  // Recommended signals
  if (/Suggested (for you|post|reel|reels)/i.test(fullText)) return 'recommended';
  if (/Recommended for you/i.test(fullText)) return 'recommended';

  // Subscribed vs recommended via follow button
  const followState = getFollowState(card);
  if (followState === 'not-following') return 'recommended';
  if (followState === 'following') return 'subscribed';

  return 'unknown';
}

// ── Fingerprint ───────────────────────────────────────────────────

function getHandle(card) {
  return (
    card.querySelector('header a[role="link"]')?.textContent?.trim() ||
    card.querySelector('header a')?.textContent?.trim() ||
    card.querySelector('a[href^="/"]:not([href^="/reels"])')?.getAttribute('href') ||
    ''
  );
}

function getCaption(card) {
  return (
    card.querySelector('h1')?.textContent ||
    card.querySelector('[data-testid="post-caption"]')?.textContent ||
    card.querySelector('._a9zs')?.textContent ||
    card.querySelector('span[dir="auto"]')?.textContent ||
    ''
  ).slice(0, 40);
}

async function fingerprint(card) {
  const handle = getHandle(card);
  const caption = getCaption(card);
  if (!handle && !caption) {
    return Math.random().toString(36).slice(2, 8);
  }
  const buf = new TextEncoder().encode(handle + '|' + caption);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash)).slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Surface guard ─────────────────────────────────────────────────

function isMonitoredSurface() {
  const p = location.pathname;
  return p === '/' || p.startsWith('/reels/');
}

// ── Observers ─────────────────────────────────────────────────────
const seen = new WeakSet();
const timers = new WeakMap();

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && e.intersectionRatio >= VISIBILITY_RATIO) {
      if (seen.has(e.target)) continue;
      const t = setTimeout(async () => {
        if (seen.has(e.target)) return;
        if (!isMonitoredSurface()) return;
        seen.add(e.target);
        const cls = classify(e.target);
        const media = classifyMedia(e.target);
        const fp = await fingerprint(e.target);
        console.log('[FeedLens] card_seen:', cls, media, fp);
        browser.runtime.sendMessage({ type: 'card_seen', class: cls, media, fp, ts: Date.now() })
          .catch(err => console.error('[FeedLens] sendMessage failed:', err));
      }, DWELL_MS);
      timers.set(e.target, t);
    } else {
      const t = timers.get(e.target);
      if (t) { clearTimeout(t); timers.delete(e.target); }
    }
  }
}, { threshold: [VISIBILITY_RATIO] });

function observeCards(root) {
  const cards = root.querySelectorAll?.(`${FEED_CARD}, ${REEL_CARD}`) ?? [];
  if (cards.length > 0) {
    console.log('[FeedLens] observing', cards.length, 'cards');
  }
  cards.forEach(c => io.observe(c));
}

observeCards(document.body);

const mo = new MutationObserver((muts) => {
  for (const m of muts) {
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches?.(FEED_CARD) || n.matches?.(REEL_CARD)) {
        io.observe(n);
      } else {
        observeCards(n);
      }
    }
  }
});
mo.observe(document.body, { childList: true, subtree: true });
