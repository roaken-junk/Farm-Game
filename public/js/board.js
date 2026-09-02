/* Full-screen "now serving" board for a tablet or TV: /b/:slug/board */
(function () {
  'use strict';
  const L = window.Lineup;
  const slug = L.slugFromPath();
  const $board = document.getElementById('board');
  let snap = null;

  function render() {
    if (!snap) return;
    const b = snap.barber;
    const tz = b.timezone;
    document.title = `${b.shop_name} — Now serving`;
    const logo = b.brand_image
      ? `<img class="brand__logo" src="${L.esc(b.brand_image)}" alt="">`
      : `<div class="brand__logo brand__logo--mono">${L.esc(L.initials(b.shop_name))}</div>`;

    const next = snap.waiting.slice(0, 6).map((t) => `
      <div class="list-row">
        <span class="list-row__pos">${t.position}</span>
        <div class="grow"><div class="list-row__name truncate">${L.esc(t.name)}</div><div class="list-row__sub">${L.esc(t.service_name)}</div></div>
        <div class="list-row__time">${L.fmtTime(t.est_start, tz)}</div>
      </div>`).join('');

    $board.innerHTML = `
      <div class="stack-lg">
        <header class="brand">
          ${logo}
          <div class="grow"><h1>${L.esc(b.shop_name)}</h1><p class="brand__sub">${L.esc(b.barber_name)}${b.tagline ? ` · ${L.esc(b.tagline)}` : ''}</p></div>
          <div class="clock">${L.fmtTime(Date.now(), tz)}</div>
        </header>
        <section class="card ${snap.serving ? 'card--brass' : 'card--outline'}" style="padding:28px">
          <p class="eyebrow">${snap.serving ? '<span class="pulse pulse--brass"></span>&nbsp; Now serving' : 'Now serving'}</p>
          <div class="serving-name ${snap.serving ? '' : 'muted'}">${snap.serving ? L.esc(snap.serving.name) : 'Chair is open'}</div>
          ${snap.serving ? `<p style="color:rgba(27,21,8,.75)">${L.esc(snap.serving.service_name)}</p>` : `<p class="muted">${snap.waiting.length ? `${L.esc(snap.waiting[0].name)} is up next` : 'Scan the code to be first in line'}</p>`}
        </section>
        <section class="next-list">
          <div class="rule rule--label"><span>Up next</span></div>
          ${next ? `<div class="list">${next}</div>` : '<div class="empty">Nobody waiting — walk right up.</div>'}
          ${snap.waiting.length > 6 ? `<p class="muted center mt-8">+ ${snap.waiting.length - 6} more in line</p>` : ''}
        </section>
      </div>
      <aside class="stack">
        <div class="card center" style="padding:24px">
          <p class="eyebrow">Join the line</p>
          <h2 class="mt-8">Scan to get a time</h2>
          <p class="muted small mt-8">${b.is_open ? (snap.waiting_count ? `${snap.waiting_count} in line · about ${L.fmtDuration(snap.est_wait_minutes)}` : 'No wait right now') : 'The line is closed right now'}</p>
          <div class="qr-box mt-16"><img src="/q/${L.esc(slug)}/qr.svg" alt="QR code"></div>
          <p class="muted small mt-16">${L.esc(location.host)}/q/${L.esc(slug)}</p>
        </div>
        ${b.announcement ? `<div class="callout">${L.esc(b.announcement)}</div>` : ''}
      </aside>`;
  }

  L.live(`/api/q/${slug}/events`, `/api/q/${slug}`, (s) => { snap = s; render(); });
  setInterval(render, 30000);
})();
