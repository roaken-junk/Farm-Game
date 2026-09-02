/* Shared helpers for every Lineup page. */
(function () {
  'use strict';

  const MIN = 60000;

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const fmtCache = {};
  function timeFormatter(tz) {
    const key = tz || 'local';
    if (!fmtCache[key]) {
      try {
        fmtCache[key] = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz || undefined });
      } catch {
        fmtCache[key] = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
      }
    }
    return fmtCache[key];
  }

  /** "4:15 PM" */
  function fmtTime(ms, tz) {
    if (!ms) return '—';
    return timeFormatter(tz).format(new Date(ms));
  }

  /** ["4:15", "PM"] for display with a smaller meridiem. */
  function splitTime(ms, tz) {
    const s = fmtTime(ms, tz);
    const m = /^(.*?)\s*(AM|PM)$/i.exec(s);
    return m ? [m[1], m[2]] : [s, ''];
  }

  function minutesUntil(ms, now) {
    return Math.max(0, Math.round((ms - (now || Date.now())) / MIN));
  }

  function fmtDuration(mins) {
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }

  function ago(ms, now) {
    const mins = Math.max(0, Math.round(((now || Date.now()) - ms) / MIN));
    if (mins < 1) return 'just now';
    return `${fmtDuration(mins)} ago`;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'L';
  }

  /* ----- toast ----- */
  let host;
  function toast(message, kind) {
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast${kind ? ` toast--${kind}` : ''}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
    setTimeout(() => el.remove(), 3000);
  }

  function haptic(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern || 30); } catch { /* unsupported */ }
  }

  /* ----- live updates: SSE with polling fallback ----- */
  function live(eventsUrl, pollUrl, onUpdate) {
    let source = null;
    let pollTimer = null;
    let failures = 0;

    async function poll() {
      try {
        const data = await api('GET', pollUrl);
        onUpdate(data);
      } catch { /* try again next tick */ }
    }

    function startPolling() {
      if (pollTimer) return;
      poll();
      pollTimer = setInterval(poll, 8000);
    }
    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    function connect() {
      if (!window.EventSource) { startPolling(); return; }
      source = new EventSource(eventsUrl, { withCredentials: true });
      source.addEventListener('update', (e) => {
        failures = 0;
        stopPolling();
        try { onUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
      });
      source.onerror = () => {
        failures += 1;
        if (failures >= 3) startPolling();
      };
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') poll();
    });

    connect();
    return {
      refresh: poll,
      close() { if (source) source.close(); stopPolling(); },
    };
  }

  /* ----- bottom sheets ----- */
  function sheet(id) {
    const el = document.getElementById(id);
    let backdrop = document.querySelector('.sheet-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sheet-backdrop';
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', () => {
        document.querySelectorAll('.sheet.is-open').forEach((s) => s.classList.remove('is-open'));
        backdrop.classList.remove('is-open');
      });
    }
    return {
      open() {
        document.querySelectorAll('.sheet.is-open').forEach((s) => s.classList.remove('is-open'));
        el.classList.add('is-open');
        backdrop.classList.add('is-open');
      },
      close() {
        el.classList.remove('is-open');
        backdrop.classList.remove('is-open');
      },
      el,
    };
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.sheet.is-open').forEach((s) => s.classList.remove('is-open'));
      const b = document.querySelector('.sheet-backdrop');
      if (b) b.classList.remove('is-open');
    }
  });

  function slugFromPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts[1] || '';
  }

  /* Storage that tolerates private mode. */
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  window.Lineup = { api, fmtTime, splitTime, minutesUntil, fmtDuration, ago, esc, initials, toast, haptic, live, sheet, slugFromPath, storage, MIN };
})();
