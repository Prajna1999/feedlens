window.FL = window.FL || {}; var FL = window.FL;
FL.youtube = FL.youtube || {};

const INTERACTION_SELECTORS = {
  like:        '#top-level-buttons-computed yt-icon-button:first-child button',
  subscribe:   'tp-yt-paper-button#subscribe-button, ytd-subscribe-button-renderer button',
  click_video: 'a#thumbnail',
  click_channel: 'ytd-channel-name a',
};

const attached = new WeakSet();

FL.youtube.attachInteractionListeners = function(card, fp, sessionId) {
  if (attached.has(card)) return;
  attached.add(card);

  const surface = FL.youtube.getSurface();

  for (const [action, selector] of Object.entries(INTERACTION_SELECTORS)) {
    const els = card.querySelectorAll(selector);
    els.forEach(el => {
      el.addEventListener('click', () => {
        browser.runtime.sendMessage({
          type: 'user_action',
          action,
          contentFp: fp,
          sessionId,
          platform: 'youtube',
          surface,
          ts: Date.now()
        });
      }, { passive: true });
    });
  }
};
