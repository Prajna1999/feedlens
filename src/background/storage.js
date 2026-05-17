const STORAGE_KEY = 'feedlens.v1';

const EMPTY = () => ({
  schemaVersion: 3,
  sessions: {},
  events: [],        // retained indefinitely (45-day study)
  actions: [],       // user interaction events
  totals: { ad: 0, subscribed: 0, recommended: 0, unknown: 0 },
  media: { image: 0, video: 0, carousel: 0, short: 0, live: 0, unknown: 0 }
});

export async function load() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY] ?? EMPTY();
  // Migrations
  if (!data.sessions)  data.sessions = {};
  if (!data.actions)   data.actions = [];
  if (!data.media)     data.media = { image: 0, video: 0, carousel: 0, short: 0, live: 0, unknown: 0 };
  if (!data.media.short) data.media.short = 0;
  if (!data.media.live)  data.media.live  = 0;
  data.schemaVersion = 3;
  return data;
}

export async function save(data) {
  await browser.storage.local.set({ [STORAGE_KEY]: data });
}

export async function clear() {
  await browser.storage.local.remove(STORAGE_KEY);
}
