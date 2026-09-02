'use strict';

const crypto = require('node:crypto');
const store = require('./db');

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE = 'lineup_session';

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function validPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4,8}$/.test(pin);
}

function slugify(text) {
  const base = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base || 'shop';
}

/** Turn a shop name into a URL slug, adding a numeric suffix if taken. */
function uniqueSlug(text) {
  const base = slugify(text);
  let slug = base;
  let n = 2;
  while (store.get('SELECT 1 FROM barbers WHERE slug = ?', slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function createSession(barberId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  store.run('INSERT INTO sessions (token, barber_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, barberId, now, now + SESSION_TTL);
  // opportunistic cleanup
  store.run('DELETE FROM sessions WHERE expires_at < ?', now);
  return token;
}

function destroySession(token) {
  if (token) store.run('DELETE FROM sessions WHERE token = ?', token);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function sessionBarber(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const row = store.get(
    'SELECT b.* FROM sessions s JOIN barbers b ON b.id = s.barber_id WHERE s.token = ? AND s.expires_at > ?',
    token, Date.now(),
  );
  return row || null;
}

function setSessionCookie(res, token, req) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${secure ? '; Secure' : ''}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function currentToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE] || null;
}

module.exports = {
  hashPin,
  verifyPin,
  validPin,
  slugify,
  uniqueSlug,
  createSession,
  destroySession,
  sessionBarber,
  setSessionCookie,
  clearSessionCookie,
  currentToken,
};
