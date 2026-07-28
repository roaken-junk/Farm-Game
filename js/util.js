/* Small shared helpers. */

export const now = () => Date.now();

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** 1,234,567 -> "1.23M" so the HUD never overflows on a narrow phone. */
export function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-US');
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
}

/** Countdown text: 1h 04m / 4m 30s / 12s */
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Same units, but wordier — used for offline summaries. */
export function fmtSpan(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h} hour${h > 1 ? 's' : ''} ${m} min`;
  if (m) return `${m} minute${m > 1 ? 's' : ''}`;
  return `${sec} seconds`;
}

export function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** A short buzz on supported hardware. iOS ignores it; harmless there. */
export function haptic(ms = 12) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
}
