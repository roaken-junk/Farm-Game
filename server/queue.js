'use strict';

const crypto = require('node:crypto');
const store = require('./db');
const { MIN, shortTime, dayKey } = require('./time');

const STALE_WAITING_MS = 14 * 60 * MIN; // a ticket left waiting overnight is expired
const ACTIVE = ['waiting', 'serving'];

function publicBarber(b) {
  return {
    slug: b.slug,
    shop_name: b.shop_name,
    barber_name: b.barber_name,
    tagline: b.tagline,
    address: b.address,
    announcement: b.announcement,
    slot_minutes: b.slot_minutes,
    is_open: !!b.is_open,
    paused_until: b.paused_until || null,
    brand_image: b.brand_image ? `/uploads/${b.brand_image}` : null,
    timezone: b.timezone,
  };
}

function settingsOf(b) {
  return {
    ...publicBarber(b),
    buffer_minutes: b.buffer_minutes,
    max_queue: b.max_queue,
    services: listServices(b.id),
  };
}

function listServices(barberId) {
  return store.all('SELECT id, name, minutes FROM services WHERE barber_id = ? ORDER BY sort_order, id', barberId);
}

/** Resolve the service a joiner asked for; falls back to the barber's default slot. */
function resolveService(barber, serviceId) {
  if (serviceId != null) {
    const s = store.get('SELECT id, name, minutes FROM services WHERE id = ? AND barber_id = ?', Number(serviceId), barber.id);
    if (s) return s;
  }
  const first = store.get('SELECT id, name, minutes FROM services WHERE barber_id = ? ORDER BY sort_order, id LIMIT 1', barber.id);
  return first || { id: null, name: 'Haircut', minutes: barber.slot_minutes };
}

function expireStale(barberId, now) {
  store.run(
    "UPDATE tickets SET status = 'expired', finished_at = ? WHERE barber_id = ? AND status = 'waiting' AND created_at < ?",
    now, barberId, now - STALE_WAITING_MS,
  );
}

function activeTickets(barberId) {
  return store.all(
    "SELECT * FROM tickets WHERE barber_id = ? AND status IN ('waiting','serving') ORDER BY CASE status WHEN 'serving' THEN 0 ELSE 1 END, sort_key, id",
    barberId,
  );
}

/**
 * Walk the active queue and assign expected start/end times.
 * The cursor starts at "now", is pushed out by whoever is in the chair
 * (their expected finish, or now if they've overrun), then by any break
 * the barber has set, then advances one slot per waiting client.
 */
function computeTimeline(barber, tickets, now) {
  const buffer = (barber.buffer_minutes || 0) * MIN;
  let cursor = now;
  let serving = null;
  const waiting = [];

  for (const t of tickets) {
    if (t.status === 'serving') {
      const startedAt = t.called_at || t.created_at;
      const expectedEnd = startedAt + t.minutes * MIN;
      serving = { ...t, started_at: startedAt, est_end: Math.max(now, expectedEnd) };
      cursor = Math.max(cursor, expectedEnd) + buffer;
    }
  }
  if (barber.paused_until && barber.paused_until > cursor) cursor = barber.paused_until;

  let position = 0;
  for (const t of tickets) {
    if (t.status !== 'waiting') continue;
    position += 1;
    const est_start = cursor;
    const est_end = est_start + t.minutes * MIN;
    waiting.push({ ...t, position, est_start, est_end });
    cursor = est_end + buffer;
  }

  return { serving, waiting, next_start: cursor };
}

function ticketView(t, full) {
  const v = {
    id: t.id,
    name: t.name,
    service_name: t.service_name,
    minutes: t.minutes,
    status: t.status,
    position: t.position || null,
    est_start: t.est_start || null,
    est_end: t.est_end || null,
    created_at: t.created_at,
    called_at: t.called_at || null,
  };
  if (full) {
    v.source = t.source;
    v.named_by_client = !!t.named_by_client;
  }
  return v;
}

function snapshot(barber, { full = false, now = Date.now() } = {}) {
  expireStale(barber.id, now);
  const tickets = activeTickets(barber.id);
  const { serving, waiting, next_start } = computeTimeline(barber, tickets, now);
  const defaultService = resolveService(barber, null);
  const accepting = !!barber.is_open && waiting.length < barber.max_queue;

  const snap = {
    now,
    barber: full ? settingsOf(barber) : publicBarber(barber),
    services: listServices(barber.id),
    default_service: defaultService,
    accepting,
    queue_full: waiting.length >= barber.max_queue,
    serving: serving ? ticketView(serving, full) : null,
    waiting: waiting.map((t) => ticketView(t, full)),
    waiting_count: waiting.length,
    next_start,
    est_wait_minutes: Math.max(0, Math.round((next_start - now) / MIN)),
  };

  if (full) {
    const today = dayKey(now, barber.timezone);
    snap.stats = stats(barber.id, today);
    snap.history = store
      .all(
        "SELECT * FROM tickets WHERE barber_id = ? AND day = ? AND status NOT IN ('waiting','serving') ORDER BY finished_at DESC, id DESC LIMIT 40",
        barber.id, today,
      )
      .map((t) => ({ ...ticketView(t, true), finished_at: t.finished_at }));
  }
  return snap;
}

function stats(barberId, today) {
  const row = store.get(
    `SELECT
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS served,
       SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_shows,
       SUM(CASE WHEN status = 'done' AND called_at IS NOT NULL THEN called_at - created_at ELSE 0 END) AS wait_total,
       SUM(CASE WHEN status = 'done' AND called_at IS NOT NULL THEN 1 ELSE 0 END) AS wait_n,
       SUM(CASE WHEN status = 'done' AND called_at IS NOT NULL AND finished_at IS NOT NULL THEN finished_at - called_at ELSE 0 END) AS cut_total,
       COUNT(*) AS total
     FROM tickets WHERE barber_id = ? AND day = ?`,
    barberId, today,
  );
  const served = row.served || 0;
  return {
    served,
    no_shows: row.no_shows || 0,
    joined: row.total || 0,
    avg_wait_minutes: row.wait_n ? Math.round(row.wait_total / row.wait_n / MIN) : null,
    avg_cut_minutes: row.wait_n ? Math.round(row.cut_total / row.wait_n / MIN) : null,
  };
}

function findTicket(barber, token) {
  const t = store.get('SELECT * FROM tickets WHERE barber_id = ? AND token = ?', barber.id, token);
  return t || null;
}

/** A single ticket, with its live position/estimate merged in from the timeline. */
function ticketStatus(barber, token, now = Date.now()) {
  const t = findTicket(barber, token);
  if (!t) return null;
  const snap = snapshot(barber, { now });
  if (ACTIVE.includes(t.status)) {
    const live = t.status === 'serving' ? snap.serving : snap.waiting.find((w) => w.id === t.id);
    return { ticket: live || ticketView(t), snapshot: snap };
  }
  return { ticket: { ...ticketView(t), finished_at: t.finished_at }, snapshot: snap };
}

function nextSortKey(barberId) {
  const row = store.get("SELECT MAX(sort_key) AS m FROM tickets WHERE barber_id = ? AND status IN ('waiting','serving')", barberId);
  return (row?.m || 0) + 1;
}

/** Strip control characters, collapse whitespace, cap length. */
function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, 40);
}

class QueueError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function join(barber, { name, service_id, source = 'qr' } = {}) {
  const now = Date.now();
  return store.transaction(() => {
    expireStale(barber.id, now);
    const tickets = activeTickets(barber.id);
    const waitingCount = tickets.filter((t) => t.status === 'waiting').length;

    if (source === 'qr') {
      if (!barber.is_open) throw new QueueError(409, 'This queue is closed right now.');
      if (waitingCount >= barber.max_queue) throw new QueueError(409, 'The line is full right now. Please check back shortly.');
    }

    const service = resolveService(barber, service_id);
    const timeline = computeTimeline(barber, tickets, now);
    const est_start = timeline.next_start;

    const given = cleanName(name);
    const finalName = given || `${service.name} ${shortTime(est_start, barber.timezone)}`;
    const token = crypto.randomBytes(18).toString('base64url');

    const result = store.run(
      `INSERT INTO tickets (barber_id, token, name, named_by_client, service_name, minutes, status, sort_key, source, day, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?)`,
      barber.id, token, finalName, given ? 1 : 0, service.name, service.minutes, nextSortKey(barber.id), source, dayKey(now, barber.timezone), now,
    );
    const t = store.get('SELECT * FROM tickets WHERE id = ?', result.lastInsertRowid);
    return { token, ticket: { ...ticketView(t, true), est_start, est_end: est_start + service.minutes * MIN, position: waitingCount + 1 } };
  });
}

function leave(barber, token) {
  const t = findTicket(barber, token);
  if (!t) throw new QueueError(404, 'Ticket not found.');
  if (t.status !== 'waiting') throw new QueueError(409, 'This ticket can no longer be cancelled.');
  store.run("UPDATE tickets SET status = 'cancelled', finished_at = ? WHERE id = ?", Date.now(), t.id);
}

function getTicketById(barberId, id) {
  const t = store.get('SELECT * FROM tickets WHERE barber_id = ? AND id = ?', barberId, Number(id));
  if (!t) throw new QueueError(404, 'Ticket not found.');
  return t;
}

/** Bring a client to the chair. Whoever is currently being served is marked done. */
function call(barber, id) {
  const now = Date.now();
  return store.transaction(() => {
    const t = getTicketById(barber.id, id);
    if (t.status !== 'waiting') throw new QueueError(409, 'Only waiting clients can be called.');
    store.run("UPDATE tickets SET status = 'done', finished_at = ? WHERE barber_id = ? AND status = 'serving'", now, barber.id);
    store.run("UPDATE tickets SET status = 'serving', called_at = ? WHERE id = ?", now, t.id);
  });
}

function callNext(barber) {
  const next = store.get("SELECT id FROM tickets WHERE barber_id = ? AND status = 'waiting' ORDER BY sort_key, id LIMIT 1", barber.id);
  if (!next) {
    store.run("UPDATE tickets SET status = 'done', finished_at = ? WHERE barber_id = ? AND status = 'serving'", Date.now(), barber.id);
    return null;
  }
  call(barber, next.id);
  return next.id;
}

function finish(barber, id, status = 'done') {
  const t = getTicketById(barber.id, id);
  if (!ACTIVE.includes(t.status)) throw new QueueError(409, 'Ticket is already closed.');
  store.run('UPDATE tickets SET status = ?, finished_at = ? WHERE id = ?', status, Date.now(), t.id);
}

/** Put a called client back at the front of the line (they stepped out, etc.). */
function requeue(barber, id) {
  const t = getTicketById(barber.id, id);
  if (t.status !== 'serving') throw new QueueError(409, 'Only the client in the chair can be sent back to the line.');
  const first = store.get("SELECT MIN(sort_key) AS m FROM tickets WHERE barber_id = ? AND status = 'waiting'", barber.id);
  const key = first?.m != null ? first.m - 1 : nextSortKey(barber.id);
  store.run("UPDATE tickets SET status = 'waiting', called_at = NULL, sort_key = ? WHERE id = ?", key, t.id);
}

function move(barber, id, direction) {
  return store.transaction(() => {
    const t = getTicketById(barber.id, id);
    if (t.status !== 'waiting') throw new QueueError(409, 'Only waiting clients can be reordered.');
    const neighbour = direction === 'up'
      ? store.get("SELECT * FROM tickets WHERE barber_id = ? AND status = 'waiting' AND sort_key < ? ORDER BY sort_key DESC LIMIT 1", barber.id, t.sort_key)
      : store.get("SELECT * FROM tickets WHERE barber_id = ? AND status = 'waiting' AND sort_key > ? ORDER BY sort_key ASC LIMIT 1", barber.id, t.sort_key);
    if (!neighbour) return;
    store.run('UPDATE tickets SET sort_key = ? WHERE id = ?', neighbour.sort_key, t.id);
    store.run('UPDATE tickets SET sort_key = ? WHERE id = ?', t.sort_key, neighbour.id);
  });
}

function rename(barber, id, name) {
  const t = getTicketById(barber.id, id);
  const clean = cleanName(name);
  if (!clean) throw new QueueError(400, 'Name cannot be empty.');
  store.run('UPDATE tickets SET name = ?, named_by_client = 1 WHERE id = ?', clean, t.id);
}

function clearWaiting(barber) {
  store.run("UPDATE tickets SET status = 'cancelled', finished_at = ? WHERE barber_id = ? AND status = 'waiting'", Date.now(), barber.id);
}

module.exports = {
  QueueError,
  publicBarber,
  settingsOf,
  listServices,
  snapshot,
  ticketStatus,
  join,
  leave,
  call,
  callNext,
  finish,
  requeue,
  move,
  rename,
  clearWaiting,
  cleanName,
};
