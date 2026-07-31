/* ==========================================================================
   cloud.js — signing in and syncing farms to a server.

   This is switched OFF until you fill in CONFIG below. Until then everything
   here reports "not configured" and the game runs entirely on the device.

   Why it needs configuring: signing in with Google, Apple or Facebook means
   registering an app with each of them and holding a client secret, which a
   static page cannot do — the secret would be public. Something server-side
   has to complete the handshake and own the database of saves. Supabase is
   the least work: it hosts the OAuth handshake and the database, and speaks
   plain REST, so no SDK is needed here.

   Setup, once:
     1. Create a free project at supabase.com and copy its URL + anon key
        into CONFIG below.
     2. Authentication -> Providers: switch on Google / Apple / Facebook and
        paste in the client IDs you get from each provider's console.
        (Apple requires a paid Apple Developer account; the other two are free.)
     3. Add the site URL to Authentication -> URL Configuration.
     4. Run this SQL so each player can only ever touch their own row:

        create table saves (
          user_id uuid references auth.users on delete cascade,
          slot    int  not null,
          data    jsonb not null,
          updated_at timestamptz default now(),
          primary key (user_id, slot)
        );
        alter table saves enable row level security;
        create policy "own saves" on saves
          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   The whole surface is four calls: providers(), signIn(), signOut(), sync().
   ========================================================================== */

export const CONFIG = {
  url: '',        // e.g. 'https://abcdefgh.supabase.co'
  anonKey: '',    // the public anon key — safe in client code
};

/** Which logins to offer. Only the ones you enabled server-side will work. */
export const PROVIDERS = [
  { id: 'google',   name: 'Google',   icon: '🟢' },
  { id: 'apple',    name: 'Apple',    icon: '🍎' },
  { id: 'facebook', name: 'Facebook', icon: '🔵' },
];

const SESSION_KEY = 'sunnyacres.session';

export const configured = () => !!(CONFIG.url && CONFIG.anonKey);

/* -------------------------------- session -------------------------------- */

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s || !s.access_token) return null;
    if (s.expires_at && s.expires_at * 1000 < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function writeSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* private mode */ }
}

export const session = () => readSession();
export const signedIn = () => !!readSession();

/** Display name for whoever is signed in. */
export function account() {
  const s = readSession();
  if (!s) return null;
  return { email: s.email || null, provider: s.provider || null };
}

/**
 * Supabase hands the tokens back in the URL fragment. Call this once at boot;
 * it stores the session and cleans the address bar.
 */
export function captureRedirect() {
  if (!location.hash || location.hash.indexOf('access_token=') < 0) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const token = p.get('access_token');
  if (!token) return false;
  writeSession({
    access_token: token,
    refresh_token: p.get('refresh_token') || '',
    expires_at: Number(p.get('expires_at')) || 0,
    provider: p.get('provider_token') ? 'oauth' : 'oauth',
  });
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

export function signIn(provider) {
  if (!configured()) return false;
  const back = encodeURIComponent(location.origin + location.pathname);
  location.href = `${CONFIG.url}/auth/v1/authorize?provider=${provider}&redirect_to=${back}`;
  return true;
}

export function signOut() {
  writeSession(null);
}

/* ------------------------------ the REST bits ---------------------------- */

async function api(path, opts = {}) {
  const s = readSession();
  if (!configured() || !s) throw new Error('Not signed in.');
  const res = await fetch(`${CONFIG.url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: CONFIG.anonKey,
      Authorization: `Bearer ${s.access_token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { signOut(); throw new Error('Your sign-in expired. Sign in again.'); }
  if (!res.ok) throw new Error(`The server said no (${res.status}).`);
  return res.status === 204 ? null : res.json();
}

async function pull() {
  const rows = await api('saves?select=slot,data,updated_at');
  const out = {};
  for (const r of rows || []) out[r.slot] = r.data;
  return out;
}

async function push(slots) {
  const rows = Object.entries(slots).map(([slot, data]) => ({
    slot: Number(slot), data, updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  await api('saves?on_conflict=user_id,slot', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
}

/* --------------------------------- sync ---------------------------------- */

/**
 * Two-way sync, newest-wins per slot. `local` is {slot: saveObject}; the
 * result is what the device should now hold, plus a short summary to show.
 *
 * Split out from the network so it can be reasoned about — and tested —
 * on its own.
 */
export function merge(local, remote) {
  const slots = {};
  const notes = { pulled: 0, pushed: 0, same: 0 };
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);

  for (const k of keys) {
    const a = (local || {})[k];
    const b = (remote || {})[k];
    if (a && !b) { slots[k] = a; notes.pushed++; continue; }
    if (b && !a) { slots[k] = b; notes.pulled++; continue; }
    const at = a.lastSeen || a.createdAt || 0;
    const bt = b.lastSeen || b.createdAt || 0;
    if (bt > at) { slots[k] = b; notes.pulled++; }
    else if (at > bt) { slots[k] = a; notes.pushed++; }
    else { slots[k] = a; notes.same++; }
  }
  return { slots, notes };
}

/**
 * Runs a full round trip. Hands back the merged slots so state.js can write
 * them, and a summary line for the UI.
 */
export async function sync(localSlots) {
  const remote = await pull();
  const { slots, notes } = merge(localSlots, remote);
  await push(slots);
  return { slots, notes };
}
