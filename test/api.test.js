'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-test-'));
process.env.DATA_DIR = tmp;
process.env.DB_PATH = path.join(tmp, 'test.db');

const app = require('../server/index.js');

let server;
let origin;
let cookie = '';

function api(method, url, body, opts = {}) {
  return fetch(origin + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(opts.auth === false ? {} : { Cookie: cookie }) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => ({ status: res.status, headers: res.headers, data: await res.json().catch(() => null) }));
}

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

let slug;

test('register creates a barber, slug and session', async () => {
  const r = await api('POST', '/api/register', { shop_name: 'Fifth Street Barbers', barber_name: 'Marcus', pin: '1234', timezone: 'America/New_York' }, { auth: false });
  assert.equal(r.status, 201);
  assert.equal(r.data.slug, 'fifth-street-barbers');
  slug = r.data.slug;
  cookie = r.headers.get('set-cookie').split(';')[0];

  const dup = await api('POST', '/api/register', { shop_name: 'Fifth Street Barbers', barber_name: 'Dee', pin: '9999' }, { auth: false });
  assert.equal(dup.data.slug, 'fifth-street-barbers-2');
});

test('rejects a weak PIN', async () => {
  const r = await api('POST', '/api/register', { shop_name: 'X', barber_name: 'Y', pin: '12' }, { auth: false });
  assert.equal(r.status, 400);
});

test('public snapshot is readable without auth; admin is not', async () => {
  const pub = await api('GET', `/api/q/${slug}`, null, { auth: false });
  assert.equal(pub.status, 200);
  assert.equal(pub.data.barber.shop_name, 'Fifth Street Barbers');
  assert.equal(pub.data.accepting, true);
  assert.equal(pub.data.waiting_count, 0);

  const admin = await api('GET', `/api/admin/${slug}`, null, { auth: false });
  assert.equal(admin.status, 401);
});

test('barber can set the slot length', async () => {
  const r = await api('PATCH', `/api/admin/${slug}/settings`, { slot_minutes: 20, buffer_minutes: 0, tagline: 'Sharp since 2014' });
  assert.equal(r.status, 200);
  assert.equal(r.data.settings.slot_minutes, 20);
  assert.equal(r.data.settings.tagline, 'Sharp since 2014');
});

let tokens = [];

test('clients join and get times spaced by the slot length', async () => {
  const a = await api('POST', `/api/q/${slug}/join`, { name: 'Andre' }, { auth: false });
  assert.equal(a.status, 201);
  assert.equal(a.data.ticket.name, 'Andre');
  assert.equal(a.data.ticket.position, 1);

  const b = await api('POST', `/api/q/${slug}/join`, {}, { auth: false });
  assert.equal(b.status, 201);
  assert.equal(b.data.ticket.position, 2);
  assert.match(b.data.ticket.name, /^Haircut \d{1,2}:\d{2}(am|pm)$/);

  const c = await api('POST', `/api/q/${slug}/join`, { name: '  Chris  ' }, { auth: false });
  assert.equal(c.data.ticket.name, 'Chris');
  tokens = [a.data.token, b.data.token, c.data.token];

  const snap = (await api('GET', `/api/q/${slug}`, null, { auth: false })).data;
  assert.equal(snap.waiting_count, 3);
  const [w1, w2, w3] = snap.waiting;
  assert.equal(w2.est_start - w1.est_start, 20 * 60000);
  assert.equal(w3.est_start - w2.est_start, 20 * 60000);
  assert.ok(Math.abs(w1.est_start - snap.now) < 2000, 'first in line starts now');
  assert.equal(snap.est_wait_minutes, 60);
});

test('a client can read and leave with their token', async () => {
  const st = await api('GET', `/api/q/${slug}/ticket/${tokens[2]}`, null, { auth: false });
  assert.equal(st.status, 200);
  assert.equal(st.data.ticket.position, 3);

  const gone = await api('DELETE', `/api/q/${slug}/ticket/${tokens[2]}`, null, { auth: false });
  assert.equal(gone.status, 200);
  const after = await api('GET', `/api/q/${slug}/ticket/${tokens[2]}`, null, { auth: false });
  assert.equal(after.data.ticket.status, 'cancelled');
  assert.equal(after.data.snapshot.waiting_count, 2);
});

test('calling next moves the first client to the chair and shifts the line', async () => {
  const r = await api('POST', `/api/admin/${slug}/next`);
  assert.equal(r.status, 200);
  const snap = (await api('GET', `/api/admin/${slug}`)).data;
  assert.equal(snap.serving.name, 'Andre');
  assert.equal(snap.waiting_count, 1);
  // next person waits for Andre's 20-minute slot to finish
  assert.ok(Math.abs(snap.waiting[0].est_start - (snap.serving.called_at + 20 * 60000)) < 2000);

  const mine = (await api('GET', `/api/q/${slug}/ticket/${tokens[0]}`, null, { auth: false })).data;
  assert.equal(mine.ticket.status, 'serving');
});

test('a break pushes expected times back', async () => {
  const r = await api('POST', `/api/admin/${slug}/pause`, { minutes: 60 });
  assert.equal(r.status, 200);
  const snap = (await api('GET', `/api/q/${slug}`, null, { auth: false })).data;
  assert.ok(snap.waiting[0].est_start >= snap.barber.paused_until - 1000);
  await api('POST', `/api/admin/${slug}/pause`, { minutes: 0 });
});

test('finishing records stats; calling next again clears the chair', async () => {
  await api('POST', `/api/admin/${slug}/next`); // finishes Andre, calls the timed client
  let snap = (await api('GET', `/api/admin/${slug}`)).data;
  assert.equal(snap.stats.served, 1);
  assert.match(snap.serving.name, /^Haircut/);
  assert.equal(snap.waiting_count, 0);

  await api('POST', `/api/admin/${slug}/next`); // nobody waiting: just clears the chair
  snap = (await api('GET', `/api/admin/${slug}`)).data;
  assert.equal(snap.serving, null);
  assert.equal(snap.stats.served, 2);
  assert.equal(snap.history.length, 3);
});

test('walk-ins, reorder, rename, no-show', async () => {
  const w1 = await api('POST', `/api/admin/${slug}/tickets`, { name: 'Walk One' });
  const w2 = await api('POST', `/api/admin/${slug}/tickets`, { name: 'Walk Two' });
  assert.equal(w1.status, 201);
  await api('POST', `/api/admin/${slug}/tickets/${w2.data.ticket.id}/up`);
  let snap = (await api('GET', `/api/admin/${slug}`)).data;
  assert.deepEqual(snap.waiting.map((t) => t.name), ['Walk Two', 'Walk One']);
  assert.equal(snap.waiting[0].source, 'walkin');

  await api('PATCH', `/api/admin/${slug}/tickets/${w2.data.ticket.id}`, { name: 'Tony' });
  await api('POST', `/api/admin/${slug}/tickets/${w1.data.ticket.id}/no-show`);
  snap = (await api('GET', `/api/admin/${slug}`)).data;
  assert.deepEqual(snap.waiting.map((t) => t.name), ['Tony']);
  assert.equal(snap.stats.no_shows, 1);
});

test('services drive the default name and duration', async () => {
  const r = await api('PATCH', `/api/admin/${slug}/settings`, { services: [{ name: 'Skin fade', minutes: 45 }, { name: 'Beard trim', minutes: 15 }] });
  assert.equal(r.data.settings.services.length, 2);
  const beard = r.data.settings.services[1];
  const j = await api('POST', `/api/q/${slug}/join`, { service_id: beard.id }, { auth: false });
  assert.match(j.data.ticket.name, /^Beard trim /);
  assert.equal(j.data.ticket.minutes, 15);
  const j2 = await api('POST', `/api/q/${slug}/join`, {}, { auth: false });
  assert.match(j2.data.ticket.name, /^Skin fade /);
  assert.equal(j2.data.ticket.minutes, 45);
});

test('closing the line blocks QR joins but not walk-ins', async () => {
  await api('POST', `/api/admin/${slug}/open`, { open: false });
  const blocked = await api('POST', `/api/q/${slug}/join`, { name: 'Late' }, { auth: false });
  assert.equal(blocked.status, 409);
  const walkin = await api('POST', `/api/admin/${slug}/tickets`, { name: 'Regular' });
  assert.equal(walkin.status, 201);
  await api('POST', `/api/admin/${slug}/open`, { open: true });
});

test('max queue length is enforced', async () => {
  await api('PATCH', `/api/admin/${slug}/settings`, { max_queue: 4 });
  const snap = (await api('GET', `/api/q/${slug}`, null, { auth: false })).data;
  assert.equal(snap.queue_full, true);
  const r = await api('POST', `/api/q/${slug}/join`, {}, { auth: false });
  assert.equal(r.status, 409);
  await api('PATCH', `/api/admin/${slug}/settings`, { max_queue: 25 });
});

test('brand image upload and removal', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const up = await api('POST', `/api/admin/${slug}/brand`, { data_url: `data:image/png;base64,${png}` });
  assert.equal(up.status, 200);
  assert.match(up.data.brand_image, /^\/uploads\/fifth-street-barbers-[a-f0-9]+\.png$/);
  const img = await fetch(origin + up.data.brand_image);
  assert.equal(img.status, 200);
  const bad = await api('POST', `/api/admin/${slug}/brand`, { data_url: 'data:text/html;base64,PGI+' });
  assert.equal(bad.status, 400);
  const rm = await api('DELETE', `/api/admin/${slug}/brand`);
  assert.equal(rm.status, 200);
});

test('QR code endpoints respond', async () => {
  const svg = await fetch(`${origin}/q/${slug}/qr.svg`);
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get('content-type'), /svg/);
  const png = await fetch(`${origin}/q/${slug}/qr.png`);
  assert.equal(png.status, 200);
});

test('login, wrong PIN, and cross-shop access', async () => {
  const bad = await api('POST', '/api/login', { slug, pin: '0000' }, { auth: false });
  assert.equal(bad.status, 401);
  const good = await api('POST', '/api/login', { slug, pin: '1234' }, { auth: false });
  assert.equal(good.status, 200);
  const other = await api('GET', '/api/admin/fifth-street-barbers-2');
  assert.equal(other.status, 403);
});

test('pages are served', async () => {
  for (const p of ['/', `/q/${slug}`, `/b/${slug}`, `/b/${slug}/board`, `/b/${slug}/poster`]) {
    const r = await fetch(origin + p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-type'), /html/);
  }
});
