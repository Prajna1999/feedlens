window.FL = window.FL || {}; var FL = window.FL;

FL.CLASS = Object.freeze({ AD: 'ad', SUBSCRIBED: 'subscribed', RECOMMENDED: 'recommended', UNKNOWN: 'unknown' });
FL.MEDIA = Object.freeze({ IMAGE: 'image', VIDEO: 'video', CAROUSEL: 'carousel', SHORT: 'short', LIVE: 'live', UNKNOWN: 'unknown' });
FL.TOPIC = Object.freeze(['politics','news','sports','fitness','food','travel','fashion','tech','gaming','music','entertainment','education','health','business','humor','beauty','family','relationships']);

FL.DWELL_MS = 300;
FL.VISIBILITY_RATIO = 0.6;
FL.SESSION_WINDOW_MS = 30 * 60 * 1000;
FL.STORAGE_KEY = 'feedlens.v1';

// Unique session ID per content script load (per tab)
FL.SESSION_ID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
