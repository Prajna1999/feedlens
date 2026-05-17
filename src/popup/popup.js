const STORAGE_KEY = 'feedlens.v1';
const SESSION_WINDOW_MS = 30 * 60 * 1000;

const $ = id => document.getElementById(id);

let activePlatform = 'instagram';

const MEDIA_ICONS = {
  image:    '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><circle cx="4" cy="4.5" r="1" fill="currentColor"/><path d="M1.5 8.5l2.5-2.5 2 2 1.5-1.5 3 3" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  video:    '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M8.5 4.5l2.5-1.5v5l-2.5-1.5V4.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>',
  carousel: '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/><rect x="2.5" y="1" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.1" opacity="0.5"/></svg>',
  short:    '▲',
  live:     '⬤',
  unknown:  ''
};

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

let currentEvents = [];
let currentActions = [];

function filterByPlatform(events) {
  if (activePlatform === 'all') return events;
  return events.filter(e => e.platform === activePlatform);
}

function fmtCount(n) {
  if (n == null) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function fmtDuration(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderList(query = '') {
  const list = $('post-list');
  const emptyEl = $('empty-list');
  const q = query.trim().toLowerCase();

  const filtered = currentEvents.filter(e => {
    if (!q) return true;
    return (e.handle || '').toLowerCase().includes(q) ||
           (e.caption || '').toLowerCase().includes(q) ||
           (e.topics || []).some(t => t.includes(q)) ||
           (e.hashtags || []).some(h => h.includes(q));
  });

  [...list.querySelectorAll('.post-row')].forEach(n => n.remove());

  if (filtered.length === 0) {
    emptyEl.style.display = '';
    emptyEl.textContent = q ? 'No matches' : 'No posts yet';
    return;
  }
  emptyEl.style.display = 'none';

  const sorted = [...filtered].sort((a, b) => b.ts - a.ts);
  for (const e of sorted) {
    const row = document.createElement('a');
    row.className = 'post-row';
    row.href = e.contentUrl || '#';
    row.target = '_blank';
    row.rel = 'noopener';
    if (!e.contentUrl) row.removeAttribute('href');

    const platformDot = e.platform === 'youtube' ? ' yt' : '';

    // Stats line — only include fields that have values
    const stats = [];
    const likes = fmtCount(e.likeCount);
    const comments = fmtCount(e.commentCount);
    const views = fmtCount(e.viewCount);
    const dur = fmtDuration(e.duration);
    if (likes)    stats.push(`<span class="stat-item">♥ ${likes}</span>`);
    if (comments) stats.push(`<span class="stat-item">💬 ${comments}</span>`);
    if (views)    stats.push(`<span class="stat-item">👁 ${views}</span>`);
    if (dur)      stats.push(`<span class="stat-item">⏱ ${dur}</span>`);
    if (e.feedPosition != null) stats.push(`<span class="stat-item">#${e.feedPosition + 1}</span>`);

    // Topic + hashtag badges
    const topicBadges = (e.topics || []).map(t =>
      `<span class="topic-badge">${t}</span>`).join('');
    const hashBadges = (e.hashtags || []).slice(0, 3).map(h =>
      `<span class="hash-badge">${h}</span>`).join('');

    const mentionLine = (e.mentions || []).length
      ? `<div class="post-mentions">${e.mentions.slice(0, 3).map(m => `<span>${m}</span>`).join(' ')}</div>`
      : '';

    row.innerHTML = `
      <div class="post-row-top">
        <span class="post-dot ${e.class}${platformDot}"></span>
        <span class="post-handle">${e.handle ? '@' + e.handle : '—'}</span>
        <span class="post-media-icon">${MEDIA_ICONS[e.media] || ''}</span>
        <span class="post-surface">${e.surface || ''}</span>
      </div>
      ${e.caption ? `<div class="post-caption">${(e.caption).slice(0, 90)}${e.caption.length > 90 ? '…' : ''}</div>` : ''}
      ${(topicBadges || hashBadges) ? `<div class="post-badges">${topicBadges}${hashBadges}</div>` : ''}
      ${mentionLine}
      ${stats.length ? `<div class="post-stats">${stats.join('')}</div>` : ''}
    `;
    list.appendChild(row);
  }
}

function renderActions() {
  const log = $('actions-log');
  const filtered = filterByPlatform(currentActions).slice(-20).reverse();
  $('action-count').textContent = filtered.length;

  log.innerHTML = '';
  if (filtered.length === 0) {
    log.innerHTML = '<div class="empty-list">No interactions yet</div>';
    return;
  }
  for (const a of filtered) {
    const row = document.createElement('div');
    row.className = 'action-row';
    const time = new Date(a.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    row.innerHTML = `<span class="action-badge">${a.action}</span><span class="action-surface">${a.surface}</span><span class="action-time">${time}</span>`;
    log.appendChild(row);
  }
}

async function render() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY];

  if (!data || !data.events?.length) {
    $('total-count').textContent = '0';
    setBar('ad', 0, 0); setBar('rec', 0, 0); setBar('sub', 0, 0); setBar('unk', 0, 0);
    $('count-image').textContent = 0; $('count-video').textContent = 0;
    $('count-carousel').textContent = 0; $('count-short').textContent = 0;
    $('status-dot').className = 'status-dot inactive';
    $('status-text').textContent = 'No data yet — open Instagram or YouTube and scroll';
    currentEvents = []; currentActions = [];
    renderList($('search').value); renderActions();
    return;
  }

  const now = Date.now();
  const allRecent = data.events.filter(e => (now - e.ts) < SESSION_WINDOW_MS);
  const events = filterByPlatform(allRecent);
  currentEvents = events;
  currentActions = data.actions || [];

  const counts = { ad: 0, subscribed: 0, recommended: 0, unknown: 0 };
  for (const e of events) counts[e.class] = (counts[e.class] ?? 0) + 1;
  const total = events.length;

  $('total-count').textContent = total;
  setBar('ad', counts.ad, total);
  setBar('rec', counts.recommended, total);
  setBar('sub', counts.subscribed, total);
  setBar('unk', counts.unknown, total);

  const media = { image: 0, video: 0, carousel: 0, short: 0 };
  for (const e of events) { if (media[e.media] !== undefined) media[e.media]++; }
  $('count-image').textContent = media.image;
  $('count-video').textContent = media.video;
  $('count-carousel').textContent = media.carousel;
  $('count-short').textContent = media.short;

  $('status-dot').className = 'status-dot active';
  $('status-text').textContent = `Tracking · ${total} post${total !== 1 ? 's' : ''} · ${data.events.length} total stored`;

  renderList($('search').value);
  renderActions();
}

// Platform tab switching
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activePlatform = btn.dataset.platform;
    render();
  });
});

$('search').addEventListener('input', () => renderList($('search').value));

// ── Export JSON ───────────────────────────────────────────────────
function formatDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

$('btn-export').addEventListener('click', async () => {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const blob = new Blob([JSON.stringify(result[STORAGE_KEY] ?? {}, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `feedlens-${formatDate()}.json`; a.click();
  URL.revokeObjectURL(url);
});

// ── Export CSV ────────────────────────────────────────────────────
$('btn-export-csv').addEventListener('click', async () => {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY];
  if (!data?.events?.length) return;

  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const sessions = data.sessions || {};

  // Events CSV — session fields (userAgent, screenRes, timezone, language) joined by sessionId
  const evHeader = 'ts,datetime,sessionId,platform,surface,class,media,topics,handle,contentUrl,caption,hashtags,mentions,publishedAt,duration,viewCount,likeCount,commentCount,locationTag,isSponsored,isPaidPartnership,musicInfo,slideCount,feedPosition,dwellMs,userAgent,screenRes,timezone,language';
  const evRows = data.events.map(e => {
    const sess = sessions[e.sessionId] || {};
    return [
      e.ts, new Date(e.ts).toISOString(), esc(e.sessionId),
      esc(e.platform), esc(e.surface), esc(e.class), esc(e.media),
      esc((e.topics||[]).join('|')), esc(e.handle), esc(e.contentUrl), esc(e.caption),
      esc((e.hashtags||[]).join('|')), esc((e.mentions||[]).join('|')),
      esc(e.publishedAt), e.duration ?? '', e.viewCount ?? '', e.likeCount ?? '', e.commentCount ?? '',
      esc(e.locationTag), e.isSponsored|0, e.isPaidPartnership|0,
      esc(e.musicInfo), e.slideCount ?? '', e.feedPosition, e.dwellMs,
      esc(sess.userAgent), esc(sess.screenRes), esc(sess.timezone), esc(sess.language)
    ].join(',');
  });

  const evCsv = [evHeader, ...evRows].join('\n');

  // Actions CSV
  const acHeader = 'ts,datetime,platform,surface,action,contentFp,sessionId';
  const acRows = (data.actions || []).map(a => [
    a.ts, new Date(a.ts).toISOString(),
    esc(a.platform), esc(a.surface), esc(a.action), esc(a.contentFp), esc(a.sessionId)
  ].join(','));

  const combined = `=== EVENTS ===\n${evCsv}\n\n=== INTERACTIONS ===\n${acHeader}\n${acRows.join('\n')}`;
  const blob = new Blob([combined], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `feedlens-${formatDate()}.csv`; a.click();
  URL.revokeObjectURL(url);
});

// ── Reset ─────────────────────────────────────────────────────────
$('btn-reset').addEventListener('click', async () => {
  if (!confirm('Reset ALL FeedLens data? This cannot be undone.')) return;
  await browser.storage.local.remove(STORAGE_KEY);
  render();
});

// Live updates
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) render();
});

render();
