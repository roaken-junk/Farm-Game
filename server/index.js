'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const QRCode = require('qrcode');

const store = require('./db');
const auth = require('./auth');
const queue = require('./queue');
const events = require('./events');
const { isValidTimeZone } = require('./time');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;

app.use(express.json({ limit: '4mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/static', express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));
app.use('/uploads', express.static(store.UPLOAD_DIR, { maxAge: '7d', immutable: true }));

/* ---------- helpers ---------- */

function page(name) {
  return (req, res) => res.sendFile(path.join(PUBLIC_DIR, `${name}.html`));
}

function loadBarber(req, res, next) {
  const b = store.get('SELECT * FROM barbers WHERE slug = ?', String(req.params.slug || '').toLowerCase());
  if (!b) return res.status(404).json({ error: 'No barber found at this address.' });
  req.barber = b;
  next();
}

function requireOwner(req, res, next) {
  const session = auth.sessionBarber(req);
  if (!session) return res.status(401).json({ error: 'Please sign in.' });
  if (session.slug !== req.params.slug.toLowerCase()) return res.status(403).json({ error: 'This dashboard belongs to a different barber.' });
  req.barber = session;
  next();
}

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return process.env.PUBLIC_URL || `${proto}://${host}`;
}

function reloadBarber(id) {
  return store.get('SELECT * FROM barbers WHERE id = ?', id);
}

/** Push fresh state to everybody watching this barber. */
function notify(barber) {
  const fresh = reloadBarber(barber.id);
  if (events.hasListeners(fresh.slug, 'public')) {
    events.broadcast(fresh.slug, 'public', 'update', queue.snapshot(fresh));
  }
  if (events.hasListeners(fresh.slug, 'admin')) {
    events.broadcast(fresh.slug, 'admin', 'update', queue.snapshot(fresh, { full: true }));
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value, max, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return queue.cleanName(value).slice(0, max);
}

/* ---------- pages ---------- */

app.get('/', page('index'));
app.get('/q/:slug', page('queue'));
app.get('/b/:slug', page('dashboard'));
app.get('/b/:slug/board', page('board'));
app.get('/b/:slug/poster', page('poster'));

app.get('/q/:slug/qr.svg', loadBarber, async (req, res) => {
  const url = `${baseUrl(req)}/q/${req.barber.slug}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#141210', light: '#00000000' } });
  res.type('image/svg+xml').setHeader('Cache-Control', 'public, max-age=300').send(svg);
});

app.get('/q/:slug/qr.png', loadBarber, async (req, res) => {
  const url = `${baseUrl(req)}/q/${req.barber.slug}`;
  const buf = await QRCode.toBuffer(url, { type: 'png', margin: 2, width: 1024, errorCorrectionLevel: 'M' });
  res.type('image/png').setHeader('Cache-Control', 'public, max-age=300').send(buf);
});

/* ---------- account ---------- */

app.post('/api/register', (req, res) => {
  const { shop_name, barber_name, pin, timezone } = req.body || {};
  const shop = text(shop_name, 60);
  const name = text(barber_name, 60);
  if (!shop) return res.status(400).json({ error: 'Give your shop a name.' });
  if (!name) return res.status(400).json({ error: 'Add the barber’s name.' });
  if (!auth.validPin(pin)) return res.status(400).json({ error: 'PIN must be 4 to 8 digits.' });

  const tz = isValidTimeZone(timezone) ? timezone : 'UTC';
  const slug = auth.uniqueSlug(shop);
  const result = store.run(
    'INSERT INTO barbers (slug, shop_name, barber_name, pin_hash, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    slug, shop, name, auth.hashPin(pin), tz, Date.now(),
  );
  const token = auth.createSession(result.lastInsertRowid);
  auth.setSessionCookie(res, token, req);
  res.status(201).json({ slug, dashboard: `/b/${slug}`, queue_url: `${baseUrl(req)}/q/${slug}` });
});

app.post('/api/login', (req, res) => {
  const { slug, pin } = req.body || {};
  const b = store.get('SELECT * FROM barbers WHERE slug = ?', auth.slugify(String(slug || '')));
  if (!b || !auth.verifyPin(String(pin || ''), b.pin_hash)) {
    return res.status(401).json({ error: 'That shop and PIN don’t match.' });
  }
  const token = auth.createSession(b.id);
  auth.setSessionCookie(res, token, req);
  res.json({ slug: b.slug, dashboard: `/b/${b.slug}` });
});

app.post('/api/logout', (req, res) => {
  auth.destroySession(auth.currentToken(req));
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const b = auth.sessionBarber(req);
  res.json(b ? { slug: b.slug, shop_name: b.shop_name } : null);
});

/* ---------- public queue API ---------- */

app.get('/api/q/:slug', loadBarber, (req, res) => {
  res.json(queue.snapshot(req.barber));
});

app.get('/api/q/:slug/events', loadBarber, (req, res) => {
  events.subscribe(req.barber.slug, 'public', req, res);
  events.send(res, 'update', queue.snapshot(req.barber));
});

app.post('/api/q/:slug/join', loadBarber, (req, res) => {
  const { name, service_id } = req.body || {};
  const result = queue.join(req.barber, { name, service_id, source: 'qr' });
  notify(req.barber);
  res.status(201).json(result);
});

app.get('/api/q/:slug/ticket/:token', loadBarber, (req, res) => {
  const status = queue.ticketStatus(req.barber, req.params.token);
  if (!status) return res.status(404).json({ error: 'Ticket not found.' });
  res.json(status);
});

app.delete('/api/q/:slug/ticket/:token', loadBarber, (req, res) => {
  queue.leave(req.barber, req.params.token);
  notify(req.barber);
  res.json({ ok: true });
});

/* ---------- barber admin API ---------- */

app.get('/api/admin/:slug', requireOwner, (req, res) => {
  const snap = queue.snapshot(req.barber, { full: true });
  snap.queue_url = `${baseUrl(req)}/q/${req.barber.slug}`;
  res.json(snap);
});

app.get('/api/admin/:slug/events', requireOwner, (req, res) => {
  events.subscribe(req.barber.slug, 'admin', req, res);
  events.send(res, 'update', queue.snapshot(req.barber, { full: true }));
});

app.patch('/api/admin/:slug/settings', requireOwner, (req, res) => {
  const b = req.barber;
  const body = req.body || {};
  const next = {
    shop_name: text(body.shop_name, 60, b.shop_name) || b.shop_name,
    barber_name: text(body.barber_name, 60, b.barber_name) || b.barber_name,
    tagline: text(body.tagline, 90, b.tagline),
    address: text(body.address, 120, b.address),
    announcement: text(body.announcement, 160, b.announcement),
    slot_minutes: clampInt(body.slot_minutes, 5, 180, b.slot_minutes),
    buffer_minutes: clampInt(body.buffer_minutes, 0, 60, b.buffer_minutes),
    max_queue: clampInt(body.max_queue, 1, 200, b.max_queue),
    timezone: isValidTimeZone(body.timezone) ? body.timezone : b.timezone,
  };
  store.run(
    `UPDATE barbers SET shop_name = ?, barber_name = ?, tagline = ?, address = ?, announcement = ?,
       slot_minutes = ?, buffer_minutes = ?, max_queue = ?, timezone = ? WHERE id = ?`,
    next.shop_name, next.barber_name, next.tagline, next.address, next.announcement,
    next.slot_minutes, next.buffer_minutes, next.max_queue, next.timezone, b.id,
  );

  if (Array.isArray(body.services)) {
    const clean = body.services
      .map((s) => ({ name: text(s?.name, 40), minutes: clampInt(s?.minutes, 5, 180, next.slot_minutes) }))
      .filter((s) => s.name)
      .slice(0, 12);
    store.transaction(() => {
      store.run('DELETE FROM services WHERE barber_id = ?', b.id);
      clean.forEach((s, i) => store.run('INSERT INTO services (barber_id, name, minutes, sort_order) VALUES (?, ?, ?, ?)', b.id, s.name, s.minutes, i));
    });
  }

  notify(b);
  res.json({ settings: queue.settingsOf(reloadBarber(b.id)) });
});

app.post('/api/admin/:slug/pin', requireOwner, (req, res) => {
  const { current_pin, new_pin } = req.body || {};
  if (!auth.verifyPin(String(current_pin || ''), req.barber.pin_hash)) return res.status(401).json({ error: 'Current PIN is incorrect.' });
  if (!auth.validPin(new_pin)) return res.status(400).json({ error: 'New PIN must be 4 to 8 digits.' });
  store.run('UPDATE barbers SET pin_hash = ? WHERE id = ?', auth.hashPin(new_pin), req.barber.id);
  res.json({ ok: true });
});

app.post('/api/admin/:slug/brand', requireOwner, (req, res) => {
  const { data_url } = req.body || {};
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(data_url || ''));
  if (!m) return res.status(400).json({ error: 'Upload a PNG, JPEG or WebP image.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Image is too large (max 2.5 MB).' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const filename = `${req.barber.slug}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(store.UPLOAD_DIR, filename), buf);
  if (req.barber.brand_image) fs.rm(path.join(store.UPLOAD_DIR, req.barber.brand_image), { force: true }, () => {});
  store.run('UPDATE barbers SET brand_image = ? WHERE id = ?', filename, req.barber.id);
  notify(req.barber);
  res.json({ brand_image: `/uploads/${filename}` });
});

app.delete('/api/admin/:slug/brand', requireOwner, (req, res) => {
  if (req.barber.brand_image) fs.rm(path.join(store.UPLOAD_DIR, req.barber.brand_image), { force: true }, () => {});
  store.run('UPDATE barbers SET brand_image = NULL WHERE id = ?', req.barber.id);
  notify(req.barber);
  res.json({ ok: true });
});

app.post('/api/admin/:slug/open', requireOwner, (req, res) => {
  const open = req.body?.open ? 1 : 0;
  store.run('UPDATE barbers SET is_open = ?, paused_until = NULL WHERE id = ?', open, req.barber.id);
  notify(req.barber);
  res.json({ is_open: !!open });
});

app.post('/api/admin/:slug/pause', requireOwner, (req, res) => {
  const minutes = clampInt(req.body?.minutes, 0, 240, 0);
  const until = minutes > 0 ? Date.now() + minutes * 60000 : null;
  store.run('UPDATE barbers SET paused_until = ? WHERE id = ?', until, req.barber.id);
  notify(req.barber);
  res.json({ paused_until: until });
});

app.post('/api/admin/:slug/tickets', requireOwner, (req, res) => {
  const { name, service_id } = req.body || {};
  const result = queue.join(req.barber, { name, service_id, source: 'walkin' });
  notify(req.barber);
  res.status(201).json(result);
});

app.post('/api/admin/:slug/next', requireOwner, (req, res) => {
  const id = queue.callNext(req.barber);
  notify(req.barber);
  res.json({ called: id });
});

app.post('/api/admin/:slug/clear', requireOwner, (req, res) => {
  queue.clearWaiting(req.barber);
  notify(req.barber);
  res.json({ ok: true });
});

const ticketActions = {
  call: (b, id) => queue.call(b, id),
  done: (b, id) => queue.finish(b, id, 'done'),
  'no-show': (b, id) => queue.finish(b, id, 'no_show'),
  remove: (b, id) => queue.finish(b, id, 'cancelled'),
  requeue: (b, id) => queue.requeue(b, id),
  up: (b, id) => queue.move(b, id, 'up'),
  down: (b, id) => queue.move(b, id, 'down'),
};

app.post('/api/admin/:slug/tickets/:id/:action', requireOwner, (req, res) => {
  const fn = ticketActions[req.params.action];
  if (!fn) return res.status(404).json({ error: 'Unknown action.' });
  fn(req.barber, req.params.id);
  notify(req.barber);
  res.json({ ok: true });
});

app.patch('/api/admin/:slug/tickets/:id', requireOwner, (req, res) => {
  queue.rename(req.barber, req.params.id, req.body?.name);
  notify(req.barber);
  res.json({ ok: true });
});

/* ---------- errors ---------- */

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof queue.QueueError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Upload is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed request.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

/* ---------- boot ---------- */

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Lineup running on http://localhost:${port}`));
}

module.exports = app;
