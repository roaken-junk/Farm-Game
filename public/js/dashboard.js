/* Barber dashboard: /b/:slug */
(function () {
  'use strict';
  const L = window.Lineup;
  const slug = L.slugFromPath();
  const base = `/api/admin/${slug}`;
  const $app = document.getElementById('app');

  const state = { snap: null, feed: null, sheetTicket: null, services: [] };
  const sheets = {};

  /* ---------- auth gate ---------- */
  async function boot() {
    try {
      const snap = await L.api('GET', base);
      start(snap);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        if (err.status === 403) await L.api('POST', '/api/logout').catch(() => {});
        showLogin();
      } else if (err.status === 404) {
        $app.innerHTML = `<div class="empty">No shop found at <code>/b/${L.esc(slug)}</code>. <a href="/">Set one up</a>.</div>`;
      } else {
        L.toast(err.message, 'error');
      }
    }
  }

  async function showLogin() {
    $app.innerHTML = '';
    $app.appendChild(document.getElementById('tpl-login').content.cloneNode(true));
    try {
      const pub = await L.api('GET', `/api/q/${slug}`);
      document.getElementById('login-shop').textContent = pub.barber.shop_name;
      document.title = `${pub.barber.shop_name} — Dashboard`;
    } catch { document.getElementById('login-shop').textContent = `/b/${slug}`; }
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        await L.api('POST', '/api/login', { slug, pin: f.pin.value });
        $app.innerHTML = '<div class="skeleton"></div>';
        boot();
      } catch (err) {
        L.toast(err.message, 'error');
        btn.disabled = false;
        f.pin.value = '';
        f.pin.focus();
      }
    });
  }

  /* ---------- main ---------- */
  function start(snap) {
    state.snap = snap;
    ['ticket', 'walkin', 'break', 'qr', 'rename', 'settings'].forEach((k) => { sheets[k] = L.sheet(`sheet-${k}`); });
    wireSheets();
    render();
    state.feed = L.live(`${base}/events`, base, (s) => { state.snap = s; render(); });
    setInterval(() => { if (state.snap) { state.snap.now = Date.now(); render(); } }, 30000);
    if (new URLSearchParams(location.search).get('welcome')) {
      history.replaceState(null, '', location.pathname);
      setTimeout(() => { openQr(); L.toast('Your queue is live. Print the QR code to get started.', 'success'); }, 300);
    }
  }

  function icon(name) {
    const paths = {
      qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3"/>',
      cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
      next: '<path d="M5 4l10 8-10 8V4z"/><path d="M19 5v14"/>',
    };
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  }

  function render() {
    const s = state.snap;
    const b = s.barber;
    const tz = b.timezone;
    document.title = `${b.shop_name} — Dashboard`;
    const paused = b.paused_until && b.paused_until > s.now;

    const logo = b.brand_image
      ? `<img class="topbar__logo" src="${L.esc(b.brand_image)}" alt="">`
      : `<div class="topbar__logo topbar__logo--mono">${L.esc(L.initials(b.shop_name))}</div>`;

    const chair = s.serving
      ? `<section class="card card--brass ticket fade-in" style="text-align:left;padding:20px">
          <div class="row row--between">
            <p class="eyebrow"><span class="pulse pulse--brass"></span>&nbsp; In the chair</p>
            <span class="small" style="color:rgba(27,21,8,.7)">Since ${L.fmtTime(s.serving.called_at, tz)}</span>
          </div>
          <h2 class="mt-8" style="font-size:26px">${L.esc(s.serving.name)}</h2>
          <p class="small mt-8" style="color:rgba(27,21,8,.75)">${L.esc(s.serving.service_name)} · ${s.serving.minutes} min · ${s.serving.est_end > s.now ? `finish around ${L.fmtTime(s.serving.est_end, tz)}` : `running ${L.fmtDuration(L.minutesUntil(s.now, s.serving.est_end))} over`}</p>
          <div class="btn-row mt-16">
            <button class="btn btn--dark" data-act="done" data-id="${s.serving.id}">Done</button>
            <button class="btn btn--ghost" style="border-color:rgba(27,21,8,.3);color:var(--brass-ink)" data-act="no-show" data-id="${s.serving.id}">No-show</button>
            <button class="btn btn--ghost btn--icon" style="border-color:rgba(27,21,8,.3);color:var(--brass-ink)" data-act="requeue" data-id="${s.serving.id}" title="Back to line" aria-label="Send back to the line">↩</button>
          </div>
        </section>`
      : `<section class="card card--outline center" style="padding:24px">
          <p class="eyebrow">In the chair</p>
          <h2 class="mt-8 muted" style="font-weight:500">Chair is empty</h2>
          ${s.waiting.length ? `<p class="small muted mt-8">${L.esc(s.waiting[0].name)} is next.</p>` : '<p class="small muted mt-8">Nobody waiting yet.</p>'}
        </section>`;

    const rows = s.waiting.map((t) => `
      <div class="list-row list-row--tap" data-open="${t.id}">
        <span class="list-row__pos">${t.position}</span>
        <div class="grow">
          <div class="list-row__name truncate">${L.esc(t.name)} ${t.source === 'walkin' ? '<span class="tag">Walk-in</span>' : ''}</div>
          <div class="list-row__sub">${L.esc(t.service_name)} · ${t.minutes} min · joined ${L.ago(t.created_at, s.now)}</div>
        </div>
        <div class="list-row__time">${L.fmtTime(t.est_start, tz)}<small>${t.position === 1 ? 'next' : `in ${L.fmtDuration(L.minutesUntil(t.est_start, s.now))}`}</small></div>
      </div>`).join('');

    const history = s.history.map((t) => {
      const tag = { done: 'tag--green', no_show: 'tag--red', cancelled: '', expired: '' }[t.status] || '';
      const label = { done: 'Done', no_show: 'No-show', cancelled: 'Left', expired: 'Expired' }[t.status] || t.status;
      return `<div class="list-row list-row--dim"><div class="grow"><div class="list-row__name truncate">${L.esc(t.name)}</div><div class="list-row__sub">${L.esc(t.service_name)} · ${L.fmtTime(t.finished_at, tz)}</div></div><span class="tag ${tag}">${label}</span></div>`;
    }).join('');

    $app.innerHTML = `
      <header class="topbar">
        ${logo}
        <div class="grow">
          <h1 class="truncate">${L.esc(b.shop_name)}</h1>
          <div class="topbar__sub">${L.esc(b.barber_name)} · ${b.is_open ? (paused ? `on a break until ${L.fmtTime(b.paused_until, tz)}` : 'taking walk-ups') : 'closed to walk-ups'}</div>
        </div>
        <button class="switch" role="switch" aria-checked="${b.is_open}" id="open-toggle" title="${b.is_open ? 'Close the line' : 'Open the line'}"></button>
      </header>

      <div class="stats">
        <div class="stat"><div class="stat__value">${s.waiting_count}</div><div class="stat__label">In line</div></div>
        <div class="stat"><div class="stat__value">${s.stats.served}</div><div class="stat__label">Served today</div></div>
        <div class="stat"><div class="stat__value">${s.stats.avg_wait_minutes == null ? '—' : `${s.stats.avg_wait_minutes}<span style="font-size:15px">m</span>`}</div><div class="stat__label">Avg wait</div></div>
      </div>

      <div class="mt-16">${chair}</div>

      ${paused ? `<div class="callout mt-16">${icon('pause')}<div class="grow">On a break until <strong>${L.fmtTime(b.paused_until, tz)}</strong>. Expected times are pushed back.</div><button class="btn btn--xs btn--soft" data-break="0">Clear</button></div>` : ''}
      ${!b.is_open ? `<div class="callout callout--warn mt-16">${icon('pause')}<div class="grow">The line is closed. New clients scanning the code will see a closed notice.</div></div>` : ''}

      <section class="mt-24">
        <div class="row row--between" style="margin-bottom:10px">
          <h3>Up next <span class="muted" style="font-weight:400;font-family:var(--body);font-size:14px">${s.waiting_count ? `· ~${L.fmtDuration(s.est_wait_minutes)} total` : ''}</span></h3>
          <button class="btn btn--xs btn--soft" id="add-walkin">${icon('plus')} Walk-in</button>
        </div>
        ${rows ? `<div class="list">${rows}</div>` : '<div class="empty">The line is empty. Clients who scan your code will appear here.</div>'}
      </section>

      <section class="mt-24">
        <div class="input-row">
          <button class="btn btn--soft" id="btn-break">${icon('pause')} Break</button>
          <button class="btn btn--soft" id="btn-qr">${icon('qr')} QR code</button>
        </div>
        <button class="btn btn--ghost mt-8" id="btn-settings" style="min-height:48px">${icon('cog')} Settings &amp; branding</button>
      </section>

      ${history ? `<section class="mt-24"><details class="acc"><summary>Earlier today · ${s.history.length}</summary><div class="list">${history}</div></details></section>` : ''}

      <div class="actionbar">
        <button class="btn btn--primary" id="btn-next" ${!s.waiting.length && !s.serving ? 'disabled' : ''}>
          ${icon('next')} ${s.waiting.length ? (s.serving ? `Finish &amp; call ${L.esc(s.waiting[0].name)}` : `Call ${L.esc(s.waiting[0].name)}`) : (s.serving ? 'Finish' : 'Call next')}
        </button>
      </div>`;

    $app.querySelector('#open-toggle').addEventListener('click', toggleOpen);
    $app.querySelector('#btn-next').addEventListener('click', callNext);
    $app.querySelector('#add-walkin').addEventListener('click', openWalkin);
    $app.querySelector('#btn-break').addEventListener('click', () => sheets.break.open());
    $app.querySelector('#btn-qr').addEventListener('click', openQr);
    $app.querySelector('#btn-settings').addEventListener('click', openSettings);
    $app.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', () => act(el.dataset.id, el.dataset.act)));
    $app.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => openTicket(Number(el.dataset.open))));
    $app.querySelectorAll('[data-break]').forEach((el) => el.addEventListener('click', () => setBreak(Number(el.dataset.break))));
  }

  /* ---------- actions ---------- */
  async function run(fn, okMsg) {
    try {
      await fn();
      if (okMsg) L.toast(okMsg, 'success');
      L.haptic(20);
    } catch (err) {
      L.toast(err.message, 'error');
    }
  }

  function act(id, action) {
    const msgs = { done: 'Marked done', 'no-show': 'Marked as no-show', remove: 'Removed from the line', requeue: 'Sent back to the front of the line', call: 'Called to the chair' };
    return run(() => L.api('POST', `${base}/tickets/${id}/${action}`), msgs[action]);
  }

  function callNext() {
    return run(() => L.api('POST', `${base}/next`));
  }

  function toggleOpen() {
    const open = !state.snap.barber.is_open;
    if (!open && !confirm('Close the line? New clients won\'t be able to join until you reopen.')) return;
    return run(() => L.api('POST', `${base}/open`, { open }), open ? 'Line is open' : 'Line is closed');
  }

  function setBreak(minutes) {
    sheets.break.close();
    return run(() => L.api('POST', `${base}/pause`, { minutes }), minutes ? `Break set for ${minutes} min` : 'Break cleared');
  }

  /* ---------- ticket sheet ---------- */
  function openTicket(id) {
    const t = state.snap.waiting.find((w) => w.id === id);
    if (!t) return;
    state.sheetTicket = t;
    const tz = state.snap.barber.timezone;
    document.getElementById('ts-name').textContent = t.name;
    document.getElementById('ts-sub').textContent = `#${t.position} · ${t.service_name} · expected ${L.fmtTime(t.est_start, tz)} · joined ${L.ago(t.created_at, state.snap.now)}`;
    const acts = document.getElementById('ts-actions');
    acts.innerHTML = `
      <button class="btn btn--primary" data-a="call">Call to the chair now</button>
      <div class="btn-row">
        <button class="btn btn--soft" data-a="up" ${t.position === 1 ? 'disabled' : ''}>Move up</button>
        <button class="btn btn--soft" data-a="down" ${t.position === state.snap.waiting.length ? 'disabled' : ''}>Move down</button>
      </div>
      <div class="btn-row">
        <button class="btn btn--ghost" data-a="rename">Rename</button>
        <button class="btn btn--ghost" data-a="no-show">No-show</button>
      </div>
      <button class="btn btn--danger" data-a="remove">Remove from the line</button>`;
    acts.querySelectorAll('[data-a]').forEach((el) => el.addEventListener('click', async () => {
      const a = el.dataset.a;
      if (a === 'rename') {
        sheets.ticket.close();
        const f = document.getElementById('rename-form');
        f.name.value = t.name;
        sheets.rename.open();
        setTimeout(() => f.name.focus(), 250);
        return;
      }
      if (a === 'remove' && !confirm(`Remove ${t.name} from the line?`)) return;
      sheets.ticket.close();
      await act(t.id, a);
    }));
    sheets.ticket.open();
  }

  /* ---------- walk-in ---------- */
  function openWalkin() {
    const f = document.getElementById('walkin-form');
    f.name.value = '';
    const svcs = state.snap.services;
    const host = document.getElementById('walkin-services');
    host.innerHTML = svcs.length > 1
      ? `<div class="field__label">Service</div><div class="chips">${svcs.map((x, i) => `<button type="button" class="chip" data-id="${x.id}" aria-pressed="${i === 0}">${L.esc(x.name)}<small>${x.minutes} min</small></button>`).join('')}</div>`
      : '';
    host.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      host.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      c.setAttribute('aria-pressed', 'true');
    }));
    sheets.walkin.open();
    setTimeout(() => f.name.focus(), 250);
  }

  /* ---------- QR ---------- */
  function openQr() {
    const url = `${location.origin}/q/${slug}`;
    document.getElementById('qr-img').src = `/q/${slug}/qr.svg`;
    document.getElementById('qr-url').textContent = url;
    document.getElementById('poster-link').href = `/b/${slug}/poster`;
    document.getElementById('board-link').href = `/b/${slug}/board`;
    sheets.qr.open();
  }

  /* ---------- settings ---------- */
  function fillTimezones(select, current) {
    let zones = [];
    try { zones = Intl.supportedValuesOf('timeZone'); } catch { zones = [current]; }
    if (!zones.includes(current)) zones.unshift(current);
    select.innerHTML = zones.map((z) => `<option value="${L.esc(z)}" ${z === current ? 'selected' : ''}>${L.esc(z.replace(/_/g, ' '))}</option>`).join('');
  }

  function renderServices() {
    const host = document.getElementById('services');
    host.innerHTML = state.services.map((s, i) => `
      <div class="row" data-i="${i}">
        <input class="input grow" placeholder="Service name" value="${L.esc(s.name)}" data-f="name" maxlength="40">
        <input class="input" style="width:88px;text-align:center" type="number" min="5" max="180" value="${s.minutes}" data-f="minutes" inputmode="numeric" aria-label="Minutes">
        <button class="btn btn--icon btn--soft" type="button" data-rm aria-label="Remove service">✕</button>
      </div>`).join('') || '<p class="muted small">No services listed. Clients will join as “Haircut”.</p>';
    host.querySelectorAll('[data-i]').forEach((row) => {
      const i = Number(row.dataset.i);
      row.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('input', () => { state.services[i][inp.dataset.f] = inp.dataset.f === 'minutes' ? Number(inp.value) : inp.value; }));
      row.querySelector('[data-rm]').addEventListener('click', () => { state.services.splice(i, 1); renderServices(); });
    });
  }

  function openSettings() {
    const b = state.snap.barber;
    const f = document.getElementById('settings-form');
    ['shop_name', 'barber_name', 'tagline', 'address', 'announcement', 'slot_minutes', 'buffer_minutes', 'max_queue'].forEach((k) => { f[k].value = b[k] == null ? '' : b[k]; });
    fillTimezones(f.timezone, b.timezone);
    state.services = (b.services || []).map((s) => ({ name: s.name, minutes: s.minutes }));
    renderServices();
    setBrandPreview(b.brand_image);
    sheets.settings.open();
  }

  function setBrandPreview(src) {
    const img = document.getElementById('brand-preview');
    const b = state.snap.barber;
    if (src) { img.src = src; img.style.display = ''; img.alt = b.shop_name; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
    document.getElementById('brand-remove').classList.toggle('hidden', !src);
  }

  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const isPng = file.type === 'image/png';
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.88));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file doesn\'t look like an image.')); };
      img.src = url;
    });
  }

  function wireSheets() {
    document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => Object.values(sheets).forEach((s) => s.close())));

    document.getElementById('walkin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const chip = document.querySelector('#walkin-services .chip[aria-pressed="true"]');
      sheets.walkin.close();
      await run(() => L.api('POST', `${base}/tickets`, { name: f.name.value, service_id: chip ? Number(chip.dataset.id) : null }), 'Added to the line');
    });

    document.querySelectorAll('#sheet-break [data-break]').forEach((el) => el.addEventListener('click', () => setBreak(Number(el.dataset.break))));

    document.getElementById('copy-url').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(document.getElementById('qr-url').textContent); L.toast('Link copied', 'success'); }
      catch { L.toast('Copy the link from the box above'); }
    });

    document.getElementById('rename-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = state.sheetTicket;
      const name = e.target.name.value;
      sheets.rename.close();
      if (t) await run(() => L.api('PATCH', `${base}/tickets/${t.id}`, { name }), 'Renamed');
    });

    const sf = document.getElementById('settings-form');
    sf.querySelectorAll('[data-step]').forEach((btn) => btn.addEventListener('click', () => {
      const inp = sf[btn.dataset.step];
      const v = Math.min(180, Math.max(5, (Number(inp.value) || 30) + Number(btn.dataset.delta)));
      inp.value = v;
    }));
    document.getElementById('add-service').addEventListener('click', () => {
      state.services.push({ name: '', minutes: Number(sf.slot_minutes.value) || 30 });
      renderServices();
      const inputs = document.querySelectorAll('#services [data-f="name"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    sf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      ['shop_name', 'barber_name', 'tagline', 'address', 'announcement', 'slot_minutes', 'buffer_minutes', 'max_queue', 'timezone'].forEach((k) => { body[k] = sf[k].value; });
      body.services = state.services.filter((s) => s.name.trim());
      await run(async () => {
        await L.api('PATCH', `${base}/settings`, body);
        sheets.settings.close();
      }, 'Settings saved');
    });

    document.getElementById('brand-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      await run(async () => {
        const dataUrl = await resizeImage(file, 720);
        const r = await L.api('POST', `${base}/brand`, { data_url: dataUrl });
        setBrandPreview(r.brand_image);
      }, 'Image updated');
    });
    document.getElementById('brand-remove').addEventListener('click', () => run(async () => {
      await L.api('DELETE', `${base}/brand`);
      setBrandPreview(null);
    }, 'Image removed'));

    document.getElementById('pin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      await run(async () => {
        await L.api('POST', `${base}/pin`, { current_pin: f.current_pin.value, new_pin: f.new_pin.value });
        f.reset();
      }, 'PIN updated');
    });

    document.getElementById('clear-line').addEventListener('click', async () => {
      if (!confirm('Remove everyone from the line? This can\'t be undone.')) return;
      sheets.settings.close();
      await run(() => L.api('POST', `${base}/clear`), 'Line cleared');
    });

    document.getElementById('logout').addEventListener('click', async () => {
      await L.api('POST', '/api/logout').catch(() => {});
      location.href = '/';
    });
  }

  boot();
})();
