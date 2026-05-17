window.FL = window.FL || {}; var FL = window.FL;

FL.parseCount = function parseCount(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/,/g, '');
  const m = s.match(/^([\d.]+)\s*([KMBkmb]?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const suffix = m[2].toUpperCase();
  if (suffix === 'K') return Math.round(n * 1_000);
  if (suffix === 'M') return Math.round(n * 1_000_000);
  if (suffix === 'B') return Math.round(n * 1_000_000_000);
  return Math.round(n);
};

// Parse "4:32" or "1:04:12" duration strings to seconds
FL.parseDuration = function parseDuration(str) {
  if (!str) return null;
  const parts = String(str).trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};
