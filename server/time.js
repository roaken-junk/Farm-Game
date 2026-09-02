'use strict';

const MIN = 60 * 1000;

const fmtCache = new Map();
function formatter(timeZone, opts, key) {
  const k = `${timeZone}|${key}`;
  let f = fmtCache.get(k);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone, ...opts });
    } catch {
      f = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts });
    }
    fmtCache.set(k, f);
  }
  return f;
}

/** "4:15pm" style label used for default ticket names. */
function shortTime(ms, timeZone) {
  const s = formatter(timeZone, { hour: 'numeric', minute: '2-digit' }, 'hm').format(new Date(ms));
  return s.replace(/\s/g, '').toLowerCase();
}

/** YYYY-MM-DD in the barber's local zone, used for daily stats. */
function dayKey(ms, timeZone) {
  const parts = formatter(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'ymd').formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

module.exports = { MIN, shortTime, dayKey, isValidTimeZone };
