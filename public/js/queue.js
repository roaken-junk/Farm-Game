/* Client-facing queue page: /q/:slug */
(function () {
  'use strict';
  const L = window.Lineup;
  const slug = L.slugFromPath();
  const KEY = `lineup:ticket:${slug}`;

  const state = {
    snap: null,
    token: null,
    ticket: null,        // live view of my ticket (or final state)
    serviceId: null,
    name: '',
    joining: false,
    lastAlert: null,      // 'next' | 'serving'
    lastRenderedStatus: null,
  };

  const $brand = document.getElementById('brand');
  const $status = document.getElementById('status');
  const $view = document.getElementById('view');

  /* ---------- persistence ---------- */
  function loadToken() {
    try {
      const raw = L.storage.get(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state.token = saved.token;
      state.ticket = saved.ticket || null;
    } catch { /* ignore */ }
  }
  function saveTicket() {
    if (!state.token) { L.storage.del(KEY); return; }
    L.storage.set(KEY, JSON.stringify({ token: state.token, ticket: state.ticket }));
  }

  /* ---------- rendering ---------- */
  function renderBrand(b) {
    document.title = `${b.shop_name} — Join the line`;
    const logo = b.brand_image
      ? `<img class="brand__logo" src="${L.esc(b.brand_image)}" alt="${L.esc(b.shop_name)}">`
      : `<div class="brand__logo brand__logo--mono">${L.esc(L.initials(b.shop_name))}</div>`;
    $brand.innerHTML = `
      ${logo}
      <div>
        <h1>${L.esc(b.shop_name)}</h1>
        <p class="brand__sub">${L.esc(b.barber_name)}${b.address ? ` · ${L.esc(b.address)}` : ''}</p>
        ${b.tagline ? `<p class="brand__tag mt-8">${L.esc(b.tagline)}</p>` : ''}
      </div>`;
  }

  function renderStatus(s) {
    const b = s.barber;
    const parts = [];
    if (!b.is_open) parts.push(`<span class="pill pill--closed"><span class="pill__dot"></span>Closed</span>`);
    else if (s.queue_full) parts.push(`<span class="pill pill--closed"><span class="pill__dot"></span>Line is full</span>`);
    else parts.push(`<span class="pill pill--open"><span class="pill__dot"></span>Open</span>`);
    parts.push(`<span class="pill">${s.waiting_count === 0 ? 'No wait' : `${s.waiting_count} in line`}</span>`);
    if (b.is_open && s.waiting_count > 0) parts.push(`<span class="pill">~${L.fmtDuration(s.est_wait_minutes)} wait</span>`);
    if (b.paused_until && b.paused_until > s.now) parts.push(`<span class="pill pill--brass">Back ${L.fmtTime(b.paused_until, b.timezone)}</span>`);
    $status.innerHTML = parts.join('');
  }

  function queueList(s, myId) {
    const rows = [];
    if (s.serving) {
      rows.push(`<div class="list-row ${s.serving.id === myId ? 'list-row--me' : ''}">
        <span class="list-row__pos"><span class="pulse"></span></span>
        <div class="grow"><div class="list-row__name truncate">${L.esc(s.serving.name)}</div><div class="list-row__sub">In the chair · ${L.esc(s.serving.service_name)}</div></div>
      </div>`);
    }
    const limit = 8;
    s.waiting.slice(0, limit).forEach((t) => {
      rows.push(`<div class="list-row ${t.id === myId ? 'list-row--me' : ''}">
        <span class="list-row__pos">${t.position}</span>
        <div class="grow"><div class="list-row__name truncate">${L.esc(t.name)}${t.id === myId ? ' <span class="tag tag--brass">You</span>' : ''}</div><div class="list-row__sub">${L.esc(t.service_name)}</div></div>
        <div class="list-row__time">${L.fmtTime(t.est_start, s.barber.timezone)}</div>
      </div>`);
    });
    if (s.waiting.length > limit) rows.push(`<p class="muted small center">+ ${s.waiting.length - limit} more</p>`);
    if (!rows.length) return `<div class="empty">Nobody's waiting. Walk right up.</div>`;
    return `<div class="list">${rows.join('')}</div>`;
  }

  function announcement(b) {
    return b.announcement ? `<div class="callout"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg><div>${L.esc(b.announcement)}</div></div>` : '';
  }

  function serviceChips(s) {
    if (!s.services || s.services.length < 2) return '';
    if (!state.serviceId || !s.services.some((x) => x.id === state.serviceId)) state.serviceId = s.services[0].id;
    return `<div>
      <div class="field__label">What are you in for?</div>
      <div class="chips" id="chips">${s.services.map((x) => `<button type="button" class="chip" data-id="${x.id}" aria-pressed="${x.id === state.serviceId}">${L.esc(x.name)}<small>${x.minutes} min</small></button>`).join('')}</div>
    </div>`;
  }

  function selectedService(s) {
    if (s.services && s.services.length && state.serviceId) return s.services.find((x) => x.id === state.serviceId) || s.default_service;
    return s.default_service;
  }

  function renderJoin(s) {
    const b = s.barber;
    const tz = b.timezone;
    const svc = selectedService(s);
    const [hm, ap] = L.splitTime(s.next_start, tz);
    const defaultName = `${svc.name} ${L.fmtTime(s.next_start, tz).replace(/\s/g, '').toLowerCase()}`;

    if (!s.accepting) {
      const why = !b.is_open
        ? `<h2>The line is closed right now</h2><p class="muted mt-8">${L.esc(b.barber_name)} isn't taking walk-ups at the moment. Check back later or ask inside.</p>`
        : `<h2>The line is full</h2><p class="muted mt-8">Everyone who could fit today is already waiting. Check back in a little while.</p>`;
      $view.innerHTML = `
        ${announcement(b)}
        <section class="card center ticket fade-in">
          <p class="eyebrow">Walk-ups</p>
          <div class="mt-16">${why}</div>
        </section>
        <section>
          <div class="rule rule--label"><span>The line</span></div>
          ${queueList(s, null)}
        </section>`;
      return;
    }

    $view.innerHTML = `
      ${announcement(b)}
      <section class="card ticket fade-in">
        <p class="eyebrow">Next available</p>
        <div class="ticket__time">${hm}<small>${ap}</small></div>
        <div class="ticket__meta">
          <span>${s.waiting_count === 0 ? 'No one ahead of you' : `${s.waiting_count} ahead of you`}</span>
          <span>${s.est_wait_minutes < 1 ? 'Walk right in' : `About ${L.fmtDuration(s.est_wait_minutes)}`}</span>
        </div>
        <form id="join-form" class="stack mt-24" style="text-align:left" novalidate>
          ${serviceChips(s)}
          <label class="field">
            <span class="field__label">Your name <span class="muted">optional</span></span>
            <input class="input" id="name" name="name" maxlength="40" placeholder="First name works" autocomplete="given-name" value="${L.esc(state.name)}">
            <span class="field__hint">Leave it blank and we'll list you as “${L.esc(defaultName)}”.</span>
          </label>
          <button class="btn btn--primary" type="submit" id="join-btn" ${state.joining ? 'disabled' : ''}>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.5 15.5M8.5 8.5 20 20"/></svg>
            ${state.joining ? 'Joining…' : 'Join the line'}
          </button>
        </form>
      </section>
      <section>
        <div class="rule rule--label"><span>The line</span></div>
        ${queueList(s, null)}
      </section>`;

    const form = document.getElementById('join-form');
    const nameEl = document.getElementById('name');
    nameEl.addEventListener('input', () => { state.name = nameEl.value; });
    const chips = document.getElementById('chips');
    if (chips) {
      chips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        state.serviceId = Number(btn.dataset.id);
        render();
      });
    }
    form.addEventListener('submit', join);
  }

  function renderTicket(s) {
    const t = state.ticket;
    const b = s.barber;
    const tz = b.timezone;
    const live = t.status === 'serving' ? s.serving : s.waiting.find((w) => w.id === t.id);
    const view = live || t;

    let card;
    if (view.status === 'serving') {
      card = `<section class="card card--brass ticket fade-in">
        <p class="eyebrow"><span class="pulse pulse--brass"></span>&nbsp; It's your turn</p>
        <div class="ticket__time" style="font-size:38px;margin-top:14px">Take a seat</div>
        <div class="ticket__meta"><span>${L.esc(b.barber_name)} is ready for you</span></div>
        <div class="ticket__name"><strong>${L.esc(view.name)}</strong> · ${L.esc(view.service_name)}</div>
      </section>`;
    } else if (view.status === 'waiting') {
      const [hm, ap] = L.splitTime(view.est_start, tz);
      const mins = L.minutesUntil(view.est_start, s.now);
      const isNext = view.position === 1;
      card = `<section class="card ticket fade-in">
        <p class="eyebrow">${isNext ? 'You\'re next' : 'You\'re in line'}</p>
        <div class="ticket__time">${hm}<small>${ap}</small></div>
        <div class="ticket__meta">
          <span>${isNext ? 'No one ahead of you' : `${view.position - 1} ahead of you`}</span>
          <span>${mins < 1 ? 'Any moment now' : `About ${L.fmtDuration(mins)}`}</span>
        </div>
        <div class="ticket__name"><strong>${L.esc(view.name)}</strong> · ${L.esc(view.service_name)} · ${view.minutes} min</div>
      </section>
      ${isNext ? `<div class="callout"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z"/></svg><div>Stay close. ${L.esc(b.barber_name)} will call you up in a moment.</div></div>` : ''}
      <div class="btn-row">
        <button class="btn btn--soft" id="alerts-btn">${('Notification' in window && Notification.permission === 'granted') ? 'Alerts on' : 'Alert me'}</button>
        <button class="btn btn--danger" id="leave-btn">Leave the line</button>
      </div>`;
    } else {
      const copy = {
        done: ['Thanks for coming in', `Hope you like the cut. See you next time.`],
        cancelled: ['You left the line', 'No worries. Join again whenever you\'re ready.'],
        no_show: ['We couldn\'t find you', `${L.esc(b.barber_name)} called your name but you'd stepped away. Join again to get a new time.`],
        expired: ['This ticket has expired', 'It was from an earlier session. Join again for a fresh time.'],
      }[view.status] || ['All done', ''];
      card = `<section class="card ticket fade-in">
        <p class="eyebrow">${view.status === 'done' ? 'All done' : 'Heads up'}</p>
        <div class="ticket__time" style="font-size:30px;margin-top:14px">${copy[0]}</div>
        <p class="muted mt-8">${copy[1]}</p>
        <div class="ticket__name"><strong>${L.esc(view.name)}</strong> · ${L.esc(view.service_name)}</div>
      </section>
      <button class="btn btn--primary" id="again-btn">Join the line again</button>`;
    }

    $view.innerHTML = `
      ${announcement(b)}
      ${card}
      <section>
        <div class="rule rule--label"><span>The line</span></div>
        ${queueList(s, t.id)}
      </section>`;

    const leave = document.getElementById('leave-btn');
    if (leave) leave.addEventListener('click', leaveLine);
    const alerts = document.getElementById('alerts-btn');
    if (alerts) alerts.addEventListener('click', enableAlerts);
    const again = document.getElementById('again-btn');
    if (again) again.addEventListener('click', () => { state.token = null; state.ticket = null; saveTicket(); render(); });
  }

  function render() {
    const s = state.snap;
    if (!s) return;
    renderBrand(s.barber);
    renderStatus(s);
    if (state.ticket) renderTicket(s);
    else renderJoin(s);
  }

  /* ---------- actions ---------- */
  async function join(e) {
    e.preventDefault();
    if (state.joining) return;
    state.joining = true;
    const btn = document.getElementById('join-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
    try {
      const r = await L.api('POST', `/api/q/${slug}/join`, { name: state.name, service_id: state.serviceId });
      state.token = r.token;
      state.ticket = r.ticket;
      saveTicket();
      L.haptic([30, 40, 30]);
      L.toast('You\'re in the line', 'success');
      await refreshTicket();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      L.toast(err.message, 'error');
    } finally {
      state.joining = false;
      if (!state.ticket) render();
    }
  }

  async function leaveLine() {
    if (!confirm('Leave the line? You\'ll lose your spot.')) return;
    try {
      await L.api('DELETE', `/api/q/${slug}/ticket/${state.token}`);
      state.token = null;
      state.ticket = null;
      saveTicket();
      L.toast('You\'ve left the line');
      await feed.refresh();
      render();
    } catch (err) {
      L.toast(err.message, 'error');
    }
  }

  async function enableAlerts() {
    if (!('Notification' in window)) { L.toast('Keep this page open and we\'ll update it live.'); return; }
    const p = await Notification.requestPermission();
    L.toast(p === 'granted' ? 'We\'ll alert you when it\'s your turn' : 'Alerts are off. Keep this page open instead.');
    render();
  }

  async function refreshTicket() {
    if (!state.token) return;
    try {
      const r = await L.api('GET', `/api/q/${slug}/ticket/${state.token}`);
      state.ticket = r.ticket;
      state.snap = r.snapshot;
      saveTicket();
    } catch (err) {
      if (err.status === 404) { state.token = null; state.ticket = null; saveTicket(); }
    }
  }

  function alertIfNeeded(s) {
    const t = state.ticket;
    if (!t) return;
    const live = t.status === 'serving' ? s.serving : s.waiting.find((w) => w.id === t.id);
    const status = live ? live.status : t.status;
    let kind = null;
    if (status === 'serving') kind = 'serving';
    else if (status === 'waiting' && live && live.position === 1) kind = 'next';
    if (kind && kind !== state.lastAlert) {
      state.lastAlert = kind;
      L.haptic(kind === 'serving' ? [80, 60, 80, 60, 160] : [40, 40, 40]);
      const msg = kind === 'serving' ? `It's your turn at ${s.barber.shop_name}` : `You're next at ${s.barber.shop_name}`;
      document.title = `${kind === 'serving' ? '● ' : ''}${msg}`;
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        try { new Notification(msg, { body: kind === 'serving' ? 'Head to the chair.' : 'Stay close, you\'ll be called in a moment.', tag: 'lineup' }); } catch { /* ignore */ }
      }
    }
    if (!kind) state.lastAlert = null;
  }

  /* ---------- live feed ---------- */
  async function onUpdate(snap) {
    state.snap = snap;
    if (state.ticket && ['waiting', 'serving'].includes(state.ticket.status)) {
      const stillActive = (snap.serving && snap.serving.id === state.ticket.id) || snap.waiting.some((w) => w.id === state.ticket.id);
      if (!stillActive) await refreshTicket();
      else {
        const live = snap.serving && snap.serving.id === state.ticket.id ? snap.serving : snap.waiting.find((w) => w.id === state.ticket.id);
        state.ticket = { ...state.ticket, ...live };
        saveTicket();
      }
    }
    alertIfNeeded(state.snap);
    render();
  }

  loadToken();
  const feed = L.live(`/api/q/${slug}/events`, `/api/q/${slug}`, onUpdate);
  if (state.token) refreshTicket().then(render);

  // keep relative times fresh
  setInterval(() => { if (state.snap) { state.snap.now = Date.now(); render(); } }, 30000);
})();
