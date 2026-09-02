'use strict';

/**
 * Server-Sent Events fan-out, keyed by barber slug.
 * Two channels per slug: 'public' (clients, board) and 'admin' (dashboard).
 */
const channels = new Map(); // "channel:slug" -> Set<res>

function key(slug, channel) {
  return `${channel}:${slug}`;
}

function subscribe(slug, channel, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const k = key(slug, channel);
  if (!channels.has(k)) channels.set(k, new Set());
  channels.get(k).add(res);

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* closed */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    const set = channels.get(k);
    if (set) {
      set.delete(res);
      if (set.size === 0) channels.delete(k);
    }
  });
}

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(slug, channel, event, data) {
  const set = channels.get(key(slug, channel));
  if (!set) return;
  for (const res of set) {
    try { send(res, event, data); } catch { set.delete(res); }
  }
}

function hasListeners(slug, channel) {
  const set = channels.get(key(slug, channel));
  return !!set && set.size > 0;
}

module.exports = { subscribe, send, broadcast, hasListeners };
