window.FL = window.FL || {}; var FL = window.FL;
FL.instagram = FL.instagram || {};

// Click selectors for interaction detection
const INTERACTION_SELECTORS = {
  like:          'section svg[aria-label="Like"], section button[aria-label="Like"]',
  unlike:        'section svg[aria-label="Unlike"], section button[aria-label="Unlike"]',
  save:          'svg[aria-label="Save"], button[aria-label="Save"]',
  unsave:        'svg[aria-label="Remove"], button[aria-label="Remove"]',
  comment:       'svg[aria-label="Comment"], a[href*="comments"]',
  share:         'svg[aria-label="Share Post"], button[aria-label="Share"]',
  click_profile: 'header a[role="link"]',
  click_hashtag: 'a[href*="/explore/tags/"]',
};

const attached = new WeakSet();

FL.instagram.attachInteractionListeners = function(card, fp, sessionId) {
  if (attached.has(card)) return;
  attached.add(card);

  const surface = location.pathname.startsWith('/reels/') ? 'reels' : 'home';

  for (const [action, selector] of Object.entries(INTERACTION_SELECTORS)) {
    const els = card.querySelectorAll(selector);
    els.forEach(el => {
      el.addEventListener('click', () => {
        browser.runtime.sendMessage({
          type: 'user_action',
          action,
          contentFp: fp,
          sessionId,
          platform: 'instagram',
          surface,
          ts: Date.now()
        });
      }, { passive: true });
    });
  }
};
