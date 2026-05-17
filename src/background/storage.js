import { STORAGE_KEY } from '../shared/constants.js';

const EMPTY = () => ({
  schemaVersion: 1,
  events: [],
  totals: { ad: 0, subscribed: 0, recommended: 0, unknown: 0 },
  media: { image: 0, video: 0, carousel: 0, unknown: 0 }
});

export async function load() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY] ?? EMPTY();
  // migrate older records missing media key
  if (!data.media) data.media = { image: 0, video: 0, carousel: 0, unknown: 0 };
  return data;
}

export async function save(data) {
  await browser.storage.local.set({ [STORAGE_KEY]: data });
}

export async function clear() {
  await browser.storage.local.remove(STORAGE_KEY);
}
