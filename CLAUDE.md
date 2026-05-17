# FeedLens — Firefox Extension MVP Spec

## 1. Goal
A Firefox WebExtension (Manifest V3) that observes the user's Instagram web feed, classifies each viewed post as **Ad / Subscribed / Recommended / Unknown**, and produces a per-session recap (e.g. "Last 30 min: 41 items — 11 ads, 23 recommended, 7 subscribed").

All processing is **on-device**. No network calls. No raw post content stored — only aggregate counts and minimal post fingerprints.

## 2. Scope (MVP)
- **Platform:** `https://www.instagram.com/*` only.
- **Surfaces:** Home feed (`/`) and Reels (`/reels/`). Skip Explore, DMs, Profile pages.
- **Storage:** `browser.storage.local` + JSON export from popup.
- **No remote sync. No screenshots. No raw caption/username retention.**

## 3. Architecture

```
[Instagram DOM]
      │
      ▼
[content script: instagram.js]   ── classifies cards, sends events
      │  runtime.sendMessage({type:'card_seen', class, fingerprint, ts})
      ▼
[background service worker: background.js]   ── dedupes, aggregates
      │  storage.local: sessions[], counters{}
      ▼
[popup: popup.html + popup.js]   ── reads storage, renders recap, exports JSON
```

**Why this split:**
- Content script has DOM access but is per-tab; multiple Instagram tabs would double-count without a central aggregator.
- Background worker owns state and storage writes (single source of truth).
- Popup is read-only on storage.

## 4. File layout

```
feedlens/
  manifest.json
  src/
    content/
      instagram.js          # observers + classifier
      selectors.js          # all DOM selectors in one place (brittle, isolate)
      classifier.js         # pure function: (cardNode) => class
    background/
      background.js         # message handler, session manager, storage writer
      session.js            # rolling-window counter logic
      storage.js            # storage.local wrapper
    popup/
      popup.html
      popup.js
      popup.css
    shared/
      constants.js          # CLASS enum, thresholds, storage keys
      types.d.ts            # JSDoc typedefs for editor hints
  icons/
    icon-48.png
    icon-128.png
  README.md
```

## 5. `manifest.json` (MV3, Firefox)

```json
{
  "manifest_version": 3,
  "name": "FeedLens",
  "version": "0.1.0",
  "description": "On-device classifier for your Instagram feed exposure.",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://www.instagram.com/*"],
  "background": {
    "scripts": ["src/background/background.js"],
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.instagram.com/*"],
      "js": ["src/content/instagram.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": { "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
  },
  "browser_specific_settings": {
    "gecko": { "id": "feedlens@local", "strict_min_version": "115.0" }
  }
}
```

Note: Firefox MV3 background uses `scripts` + `type: module`, not Chrome's `service_worker` field. This is a real divergence; don't copy Chrome examples blindly.

## 6. Data model

### 6.1 Card classes (`shared/constants.js`)
```js
export const CLASS = Object.freeze({
  AD: 'ad',
  SUBSCRIBED: 'subscribed',   // you follow the author
  RECOMMENDED: 'recommended', // "Suggested for you" etc.
  UNKNOWN: 'unknown'
});

export const DWELL_MS = 1500;            // min visible time before counted
export const VISIBILITY_RATIO = 0.6;     // ≥60% of card in viewport
export const SESSION_WINDOW_MS = 30 * 60 * 1000; // 30 min rolling
export const STORAGE_KEY = 'feedlens.v1';
```

### 6.2 Storage shape (single key `feedlens.v1`)
```js
{
  schemaVersion: 1,
  events: [
    // append-only, rolling-pruned to last 30 min
    { ts: 1715900000000, class: 'ad', fp: 'a1b2c3' }
  ],
  totals: {
    // lifetime aggregates, no PII
    ad: 0, subscribed: 0, recommended: 0, unknown: 0
  }
}
```

`fp` = SHA-1 of (author handle + first 40 chars of caption), truncated to 6 hex chars. Used only for **dedup within session**; never displayed. Computed in content script, raw text never leaves it.

## 7. Content script logic (`instagram.js`)

### 7.1 Card detection
Instagram's feed cards are `<article>` elements inside the main timeline. Reels use a different container.

```js
const FEED_CARD = 'article[role="presentation"]';   // home feed post
const REEL_CARD = 'div[data-media-type="reel"]';    // adjust on inspection
```

**Selectors are brittle.** Keep all of them in `selectors.js` so we replace in one place when Instagram ships a redesign.

### 7.2 Observer strategy

Two observers cooperate:

1. **`MutationObserver`** on `document.body` (subtree) — detects new cards being inserted as the user scrolls. On insertion, register the card with the IntersectionObserver.
2. **`IntersectionObserver`** with `threshold: VISIBILITY_RATIO` — fires when a card crosses 60% visibility. Start a dwell timer; if still visible after `DWELL_MS`, fire `card_seen`.

Pseudo:
```js
const seen = new WeakSet();
const timers = new WeakMap();

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && e.intersectionRatio >= VISIBILITY_RATIO) {
      if (seen.has(e.target)) continue;
      const t = setTimeout(() => {
        if (seen.has(e.target)) return;
        seen.add(e.target);
        const cls = classify(e.target);
        const fp = fingerprint(e.target);
        browser.runtime.sendMessage({ type: 'card_seen', class: cls, fp, ts: Date.now() });
      }, DWELL_MS);
      timers.set(e.target, t);
    } else {
      const t = timers.get(e.target);
      if (t) { clearTimeout(t); timers.delete(e.target); }
    }
  }
}, { threshold: [VISIBILITY_RATIO] });

const mo = new MutationObserver((muts) => {
  for (const m of muts) {
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      const cards = n.matches?.(FEED_CARD) ? [n] : n.querySelectorAll?.(FEED_CARD) ?? [];
      cards.forEach(c => io.observe(c));
    }
  }
});
mo.observe(document.body, { childList: true, subtree: true });
```

### 7.3 Classifier (`classifier.js`)

Pure function, rules-based. No ML in MVP.

```js
export function classify(card) {
  const text = card.innerText || '';
  // 1. Ads: Instagram labels sponsored posts with "Sponsored" near the header.
  if (/\bSponsored\b/i.test(text)) return CLASS.AD;
  // 2. Suggested: explicit label "Suggested for you" / "Suggested post"
  if (/Suggested (for you|post)/i.test(text)) return CLASS.RECOMMENDED;
  // 3. Reels in the home feed without a follow signal are usually recommendations
  if (card.querySelector('a[href^="/reels/"]') && !hasFollowingSignal(card)) {
    return CLASS.RECOMMENDED;
  }
  // 4. Following signal: header lacks "Suggested"/"Sponsored" and shows a known followed account.
  //    MVP: if no recommendation/ad label is present, default to UNKNOWN (do not assume subscribed).
  return CLASS.UNKNOWN;
}
```

**Important honesty constraint:** without access to the user's follow list, "subscribed" can't be reliably inferred from DOM alone. MVP returns `UNKNOWN` rather than guessing. A v0.2 enhancement: scrape `/api/v1/friendships/.../following/` once on consent, store handle set locally, then classify by author handle.

### 7.4 Fingerprint
```js
async function fingerprint(card) {
  const handle = card.querySelector('header a')?.textContent?.trim() ?? '';
  const caption = (card.querySelector('h1, [data-testid="post-caption"]')?.textContent ?? '').slice(0, 40);
  const buf = new TextEncoder().encode(handle + '|' + caption);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash)).slice(0, 3).map(b => b.toString(16).padStart(2,'0')).join('');
}
```

## 8. Background script (`background.js`)

```js
import { STORAGE_KEY, SESSION_WINDOW_MS } from '../shared/constants.js';

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== 'card_seen') return;
  const now = Date.now();
  const cur = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY] ?? {
    schemaVersion: 1, events: [], totals: { ad:0, subscribed:0, recommended:0, unknown:0 }
  };

  // dedup: same fingerprint within last 5 min = same card re-seen
  const recent = cur.events.find(e => e.fp === msg.fp && (now - e.ts) < 5*60*1000);
  if (recent) return;

  cur.events.push({ ts: msg.ts, class: msg.class, fp: msg.fp });
  cur.totals[msg.class] = (cur.totals[msg.class] ?? 0) + 1;

  // prune events older than the rolling window
  cur.events = cur.events.filter(e => (now - e.ts) < SESSION_WINDOW_MS);

  await browser.storage.local.set({ [STORAGE_KEY]: cur });
});
```

## 9. Popup (`popup.html` + `popup.js`)
- Reads `STORAGE_KEY`.
- Computes counts over `events[]` (last 30 min) — *not* `totals`, which is lifetime.
- Renders a single card: total + 4-class breakdown + percentages.
- Two buttons: **Export JSON** (downloads `feedlens-YYYYMMDD-HHmm.json` of the full storage object) and **Reset** (clears storage with a confirm).

## 10. Build & run

```bash
# from feedlens/
npm init -y
# no bundler needed for MVP — flat ES modules work in Firefox MV3 background.
# Load unpacked:
#   about:debugging → This Firefox → Load Temporary Add-on → pick manifest.json
```

For persistence across restarts (temporary add-ons clear on shutdown), sign via `web-ext` later:
```bash
npx web-ext run --source-dir .
npx web-ext build
```

## 11. Acceptance tests (manual, MVP)

1. Open Instagram home feed. Scroll for 2 minutes.
2. Click extension icon. Recap shows N > 0 cards.
3. At least one card classified as `ad` if a sponsored post appeared (verify by inspecting the post).
4. Export JSON. Open file. `events[]` length matches popup count.
5. Reset. Popup shows zeros.
6. Open Instagram in two tabs. Counts do not double for the same post within 5 min.
7. Wait 31 min without scrolling. Popup window count drops to 0; lifetime `totals` retained.

## 12. Known gaps (post-MVP roadmap)
- Subscribed detection needs follow-list bootstrap (v0.2).
- Reels detection selectors need verification (Instagram swaps these often).
- No per-creator stats — intentional, privacy-preserving.
- No locale handling: "Sponsored" string is English-only. Add i18n list in v0.2.
- Chrome compatibility: swap `browser.*` → `chrome.*` and change background field. Trivial later.

## 13. Privacy invariants (do not violate)
- Never send a network request.
- Never store post text, captions, image URLs, or full author handles.
- Fingerprints are one-way hashes, truncated, used only for dedup.
- All storage cleared on uninstall (default `storage.local` behavior).
- Export is user-initiated only.