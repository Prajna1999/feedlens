# FeedLens

Firefox WebExtension (Manifest V3) that classifies your Instagram feed posts as **Ad / Recommended / Subscribed / Unknown** and shows a 30-minute rolling recap. Also tracks image vs. video vs. carousel breakdown.

All processing is on-device. No network calls. No post content stored.

---

## Firefox

**Load unpacked (temporary, cleared on restart):**

1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**
2. Select `manifest.json` from this directory

**Persistent via web-ext:**

```bash
npx web-ext run --source-dir .
npx web-ext build   # produces .zip for AMO submission
```

---

## Chrome / Brave / Edge (Chromium)

The codebase needs two small changes before loading in any Chromium browser.

### 1. Update `manifest.json`

Replace the `background` block — Chromium uses `service_worker`, not `scripts`:

```json
// Remove this (Firefox):
"background": {
  "scripts": ["src/background/background.js"],
  "type": "module"
}

// Replace with this (Chromium):
"background": {
  "service_worker": "src/background/background.js",
  "type": "module"
}
```

Also remove the `browser_specific_settings` block entirely — Chromium ignores it but it's cleaner without it.

### 2. Replace `browser.*` with `chrome.*`

Chromium doesn't have the `browser` global that Firefox exposes. Run this find-and-replace across all JS files:

```bash
# from the feedlens/ directory
sed -i '' 's/browser\./chrome./g' src/content/instagram.js src/background/background.js src/background/storage.js src/popup/popup.js
```

Or do it manually — every `browser.runtime`, `browser.storage`, etc. becomes `chrome.runtime`, `chrome.storage`, etc. The API surface is identical for what FeedLens uses.

### 3. Load in Chrome / Brave

1. Go to `chrome://extensions` (Chrome) or `brave://extensions` (Brave)
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the `feedlens/` folder

The extension loads immediately and persists across restarts (unlike Firefox's temporary add-on method).

### Keeping a single codebase for both

If you want one repo that works on both browsers without manual edits, add a small polyfill at the top of each script that needs it:

```js
const _browser = typeof browser !== 'undefined' ? browser : chrome;
```

Then replace all `browser.` calls with `_browser.`. No build step needed.

---

## File layout

```
manifest.json
src/
  content/
    instagram.js      # MutationObserver + IntersectionObserver + classifier
    selectors.js      # DOM selectors (update here when Instagram redesigns)
    classifier.js     # rules-based card classifier (reference copy)
  background/
    background.js     # message handler, dedup, aggregation
    session.js        # rolling-window counter logic
    storage.js        # storage.local wrapper
  popup/
    popup.html / popup.js / popup.css
  shared/
    constants.js      # CLASS enum, thresholds, storage keys
    types.d.ts        # JSDoc typedefs
icons/
  icon-48.png
  icon-128.png
```

---

## Known limitations (MVP)

- "Subscribed" detection uses the Follow button as a proxy — may misclassify edge cases.
- "Sponsored" text matching is English-only.
- Reels selectors may drift after Instagram DOM updates (`selectors.js` is the single place to fix them).
- Chrome/Brave port requires the two manual changes above; no automated build is set up yet.
