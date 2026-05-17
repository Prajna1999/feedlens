import { CLASS } from '../shared/constants.js';
import { SPONSORED_LABEL, SUGGESTED_LABEL } from './selectors.js';

function hasFollowingSignal(card) {
  // Without access to the user's follow list, we can't reliably detect subscribed content.
  // Check for "Following" button state as a weak proxy.
  const buttons = card.querySelectorAll('button');
  for (const btn of buttons) {
    if (/^Following$/i.test(btn.textContent?.trim())) return true;
  }
  return false;
}

/**
 * @param {Element} card
 * @returns {import('../shared/types.d.ts').CardClass}
 */
export function classify(card) {
  // 1. Sponsored link label (most reliable signal)
  if (card.querySelector(SPONSORED_LABEL)) return CLASS.AD;

  const text = card.innerText || '';

  // 2. Text-based ad detection
  if (/\bSponsored\b/i.test(text)) return CLASS.AD;

  // 3. Suggested / Recommended labels
  if (/Suggested (for you|post|reel|reels)/i.test(text)) return CLASS.RECOMMENDED;
  if (/Recommended for you/i.test(text)) return CLASS.RECOMMENDED;

  // 4. Reels without a follow signal are typically recommended
  if (card.querySelector('a[href^="/reels/"]') && !hasFollowingSignal(card)) {
    return CLASS.RECOMMENDED;
  }

  // 5. MVP: cannot reliably detect subscribed without follow list
  return CLASS.UNKNOWN;
}
