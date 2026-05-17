window.FL = window.FL || {}; var FL = window.FL;

FL.fingerprint = async function fingerprint(text) {
  const meaningful = text ? text.replace(/[|]/g, '').trim() : '';
  if (!meaningful) return Math.random().toString(36).slice(2, 8);
  const buf = new TextEncoder().encode(text.slice(0, 120));
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash)).slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('');
};
