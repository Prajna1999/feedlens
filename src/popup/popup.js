const STORAGE_KEY = 'feedlens.v1';
const SESSION_WINDOW_MS = 30 * 60 * 1000;

const $ = id => document.getElementById(id);

function pct(count, total) {
  if (!total) return '—';
  return Math.round((count / total) * 100) + '%';
}

function setBar(key, count, total) {
  const w = total ? Math.round((count / total) * 100) : 0;
  $(`bar-${key}`).style.width = w + '%';
  $(`count-${key}`).textContent = count;
  $(`pct-${key}`).textContent = pct(count, total);
}

async function render() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY];

  if (!data || data.events.length === 0) {
    $('total-count').textContent = '0';
    setBar('ad', 0, 0);
    setBar('rec', 0, 0);
    setBar('sub', 0, 0);
    setBar('unk', 0, 0);
    $('count-image').textContent = 0;
    $('count-video').textContent = 0;
    $('count-carousel').textContent = 0;
    $('status-dot').className = 'status-dot inactive';
    $('status-text').textContent = 'No data yet — open Instagram and scroll';
    return;
  }

  const now = Date.now();
  const events = data.events.filter(e => (now - e.ts) < SESSION_WINDOW_MS);
  const counts = { ad: 0, subscribed: 0, recommended: 0, unknown: 0 };
  for (const e of events) counts[e.class] = (counts[e.class] ?? 0) + 1;
  const total = events.length;

  $('total-count').textContent = total;
  setBar('ad', counts.ad, total);
  setBar('rec', counts.recommended, total);
  setBar('sub', counts.subscribed, total);
  setBar('unk', counts.unknown, total);

  const media = { image: 0, video: 0, carousel: 0 };
  for (const e of events) {
    if (e.media && media[e.media] !== undefined) media[e.media]++;
  }
  $('count-image').textContent = media.image;
  $('count-video').textContent = media.video;
  $('count-carousel').textContent = media.carousel;

  $('status-dot').className = 'status-dot active';
  $('status-text').textContent = `Tracking active · ${total} post${total !== 1 ? 's' : ''} this session`;
}

function formatDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

$('btn-export').addEventListener('click', async () => {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY] ?? {};
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feedlens-${formatDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('btn-reset').addEventListener('click', async () => {
  if (!confirm('Reset all FeedLens data? This cannot be undone.')) return;
  await browser.storage.local.remove(STORAGE_KEY);
  render();
});

// Re-render whenever storage changes — live updates while popup is open
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) render();
});

render();
