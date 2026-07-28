/* ==========================================================================
   game.js — every player action and the clock that drives the farm.
   The UI only calls into this file; it never mutates state directly.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import { now, randInt, pick, uid, clamp } from './util.js';
import { SFX } from './audio.js';

/* ------------------------------- events --------------------------------- */

const listeners = {};
export function on(evt, fn) {
  (listeners[evt] || (listeners[evt] = [])).push(fn);
}
export function emit(evt, payload) {
  (listeners[evt] || []).forEach(fn => fn(payload));
}

/** Standard feedback path: a toast, optionally an error sound. */
function ok(msg, icon) { emit('toast', { msg, icon }); }
function fail(msg, icon) { SFX.error(); emit('toast', { msg, icon, bad: true }); }

function gainXp(n) {
  const levels = St.addXp(n);
  for (const lv of levels) emit('levelup', lv);
}

/* -------------------------------- fields -------------------------------- */

export function growSeconds(crop) {
  return Math.max(2, Math.round(crop.grow * St.growthMult()));
}

export function plotState(p) {
  if (!p) return 'empty';
  return now() >= p.end ? 'ready' : 'growing';
}

export function plant(i, cropId) {
  const S = St.S;
  const crop = D.CROPS.find(c => c.id === cropId);
  if (!crop) return false;
  if (crop.level > S.level) { fail(`${crop.name} unlocks at level ${crop.level}`, crop.icon); return false; }
  if (S.plots[i]) return false;
  if (!St.spendCoins(crop.seed)) { fail('Not enough coins for seeds', '🪙'); return false; }
  const t = now();
  S.plots[i] = { crop: cropId, at: t, end: t + growSeconds(crop) * 1000 };
  SFX.plant();
  St.saveSoon();
  return true;
}

/** Fills empty plots with the selected seed. The Tractor makes seeds free. */
export function plantAll(cropId) {
  const S = St.S;
  const crop = D.CROPS.find(c => c.id === cropId);
  if (!crop) return 0;
  if (crop.level > S.level) { fail(`${crop.name} unlocks at level ${crop.level}`, crop.icon); return 0; }
  const free = St.has('tractor');
  let planted = 0;
  for (let i = 0; i < S.plots.length; i++) {
    if (S.plots[i]) continue;
    if (!free && S.coins < crop.seed) break;
    if (!free) S.coins -= crop.seed;
    const t = now();
    S.plots[i] = { crop: cropId, at: t, end: t + growSeconds(crop) * 1000 };
    planted++;
  }
  if (planted) { SFX.plant(); ok(`Planted ${planted} × ${crop.name}`, crop.icon); St.saveSoon(); }
  else if (!free) fail('Not enough coins for seeds', '🪙');
  else fail('No empty fields', '🌱');
  return planted;
}

export function harvest(i, quiet = false) {
  const S = St.S;
  const p = S.plots[i];
  if (!p || plotState(p) !== 'ready') return 0;
  const crop = D.ITEMS[p.crop];
  const got = St.addItem(p.crop, D.CROP_YIELD);
  if (got === 0) {
    if (!quiet) fail('Silo is full — sell some crops', '🌾');
    return 0;
  }
  S.plots[i] = null;
  S.stats.harvested += got;
  gainXp(crop.xp);
  if (!quiet) SFX.harvest();
  St.saveSoon();
  return got;
}

export function harvestAll() {
  const S = St.S;
  let total = 0, full = false;
  for (let i = 0; i < S.plots.length; i++) {
    if (plotState(S.plots[i]) !== 'ready') continue;
    const got = harvest(i, true);
    if (got === 0) { full = true; break; }
    total += got;
  }
  if (total) { SFX.harvest(); ok(`Harvested ${total} crops`, '🧺'); }
  else if (full) fail('Silo is full — sell some crops', '🌾');
  else fail('Nothing is ripe yet', '⏳');
  return total;
}

export function speedUpPlot(i) {
  const S = St.S;
  const p = S.plots[i];
  if (!p || plotState(p) === 'ready') return false;
  const cost = D.speedUpCost((p.end - now()) / 1000);
  if (!St.spendGems(cost)) { fail(`Need ${cost} 💎`, '💎'); return false; }
  p.end = now();
  SFX.collect();
  St.saveSoon();
  return true;
}

/* -------------------------------- animals ------------------------------- */

export function buyAnimal(typeId) {
  const S = St.S;
  const a = D.ANIMALS.find(x => x.id === typeId);
  if (!a) return false;
  if (a.level > S.level) { fail(`Unlocks at level ${a.level}`, a.icon); return false; }
  if (St.animalsOf(typeId).length >= a.max) { fail(`Your pen is full`, a.icon); return false; }
  if (!St.spendCoins(a.cost)) { fail('Not enough coins', '🪙'); return false; }
  St.addAnimal(typeId);
  SFX.buy();
  ok(`Welcome, new ${a.name.toLowerCase()}!`, a.icon);
  St.saveSoon();
  return true;
}

export function animalState(an) {
  if (an.product) return 'ready';
  if (an.readyAt && now() < an.readyAt) return 'working';
  if (an.readyAt && now() >= an.readyAt) return 'ready';
  return 'hungry';
}

export function feedAnimal(an, quiet = false) {
  const type = D.ANIMALS.find(x => x.id === an.type);
  if (animalState(an) !== 'hungry') return false;
  if (St.count('feed') < type.feed) {
    if (!quiet) fail('Out of feed — mill some at the Feed Mill', '🌰');
    return false;
  }
  St.removeItem('feed', type.feed);
  an.fedAt = now();
  an.readyAt = now() + type.cycle * 1000;
  an.product = false;
  if (!quiet) SFX.plant();
  St.saveSoon();
  return true;
}

export function collectAnimal(an, quiet = false) {
  const S = St.S;
  const type = D.ANIMALS.find(x => x.id === an.type);
  if (animalState(an) !== 'ready') return 0;
  const got = St.addItem(type.product, 1);
  if (!got) {
    if (!quiet) fail('Barn is full — sell some goods', '📦');
    an.product = true;
    an.readyAt = 0;
    return 0;
  }
  an.product = false;
  an.readyAt = 0;
  S.stats.collected += 1;
  gainXp(D.ITEMS[type.product].xp);
  if (!quiet) SFX.collect();
  St.saveSoon();
  return 1;
}

export function collectAllAnimals() {
  let n = 0;
  for (const an of St.S.animals) n += collectAnimal(an, true);
  if (n) { SFX.collect(); ok(`Collected ${n} goods`, '🧺'); }
  else fail('Nothing ready to collect', '⏳');
  return n;
}

export function feedAllAnimals() {
  let n = 0;
  for (const an of St.S.animals) if (feedAnimal(an, true)) n++;
  if (n) { SFX.plant(); ok(`Fed ${n} animals`, '🌰'); }
  else fail('No hungry animals, or no feed left', '🌰');
  return n;
}

export function speedUpAnimal(an) {
  if (animalState(an) !== 'working') return false;
  const cost = D.speedUpCost((an.readyAt - now()) / 1000);
  if (!St.spendGems(cost)) { fail(`Need ${cost} 💎`, '💎'); return false; }
  an.readyAt = now();
  SFX.collect();
  St.saveSoon();
  return true;
}

/* ------------------------------- machines ------------------------------- */

export function buyMachine(id) {
  const S = St.S;
  const m = D.MACHINES.find(x => x.id === id);
  if (!m) return false;
  if (m.level > S.level) { fail(`Unlocks at level ${m.level}`, m.icon); return false; }
  if (S.machines[id] && S.machines[id].owned) return false;
  if (!St.spendCoins(m.cost)) { fail('Not enough coins', '🪙'); return false; }
  S.machines[id] = { owned: true, queue: [] };
  SFX.buy();
  ok(`${m.name} built!`, m.icon);
  St.saveSoon();
  return true;
}

export function craftTime(recipe) {
  return Math.max(2, Math.round(recipe.time * St.craftMult()));
}

/** Jobs run back to back, so a queued job's end time is fixed when enqueued. */
export function enqueue(machineId, recipeId) {
  const S = St.S;
  const m = S.machines[machineId];
  const r = D.RECIPES.find(x => x.id === recipeId);
  if (!m || !m.owned || !r) return false;
  if (r.level > S.level) { fail(`Unlocks at level ${r.level}`, '🔒'); return false; }
  if (m.queue.length >= St.queueCap()) { fail('Queue is full', '⏳'); return false; }
  if (!St.hasAll(r.in)) { fail('Missing ingredients', '📦'); return false; }
  St.removeAll(r.in);
  const last = m.queue.length ? m.queue[m.queue.length - 1].end : 0;
  const start = Math.max(now(), last);
  m.queue.push({ jid: uid(), recipe: r.id, start, end: start + craftTime(r) * 1000 });
  SFX.buy();
  St.saveSoon();
  return true;
}

export function jobReady(job) {
  return now() >= job.end;
}

export function collectJob(machineId, jid, quiet = false) {
  const S = St.S;
  const m = S.machines[machineId];
  if (!m) return 0;
  const idx = m.queue.findIndex(j => j.jid === jid);
  if (idx < 0) return 0;
  const job = m.queue[idx];
  if (!jobReady(job)) return 0;
  const r = D.RECIPES.find(x => x.id === job.recipe);
  const got = St.addItem(r.out, r.qty);
  if (!got) { if (!quiet) fail('Barn is full — sell some goods', '📦'); return 0; }
  m.queue.splice(idx, 1);
  S.stats.crafted += got;
  gainXp(D.ITEMS[r.out].xp);
  if (!quiet) SFX.collect();
  St.saveSoon();
  return got;
}

export function collectAllJobs() {
  const S = St.S;
  let n = 0;
  for (const [mid, m] of Object.entries(S.machines)) {
    if (!m.owned) continue;
    for (const job of [...m.queue]) if (jobReady(job)) n += collectJob(mid, job.jid, true);
  }
  if (n) { SFX.collect(); ok(`Collected ${n} goods`, '🧺'); }
  return n;
}

export function speedUpJob(machineId, jid) {
  const m = St.S.machines[machineId];
  if (!m) return false;
  const idx = m.queue.findIndex(j => j.jid === jid);
  if (idx < 0) return false;
  const job = m.queue[idx];
  if (jobReady(job)) return false;
  const cost = D.speedUpCost((job.end - now()) / 1000);
  if (!St.spendGems(cost)) { fail(`Need ${cost} 💎`, '💎'); return false; }
  const saved = job.end - now();
  job.end = now();
  // Pull every job behind it forward by the same amount.
  for (let k = idx + 1; k < m.queue.length; k++) {
    m.queue[k].start -= saved;
    m.queue[k].end -= saved;
  }
  SFX.collect();
  St.saveSoon();
  return true;
}

/* -------------------------------- selling ------------------------------- */

export function sellPrice(id) {
  return Math.max(1, Math.round(D.ITEMS[id].price * St.sellMult()));
}

export function sell(id, qty = 1) {
  const S = St.S;
  const have = St.count(id);
  qty = Math.min(qty, have);
  if (qty <= 0) return 0;
  St.removeItem(id, qty);
  const gold = sellPrice(id) * qty;
  St.earnCoins(gold);
  S.stats.sold += qty;
  SFX.coin();
  St.saveSoon();
  return gold;
}

/* --------------------------------- shop --------------------------------- */

export function buyPlot() {
  const S = St.S;
  const owned = S.plots.length;
  if (owned >= D.MAX_PLOTS) { fail('Every field is yours already', '🏆'); return false; }
  const lv = D.plotLevel(owned);
  if (S.level < lv) { fail(`Next field unlocks at level ${lv}`, '🔒'); return false; }
  if (!St.spendCoins(D.plotCost(owned))) { fail('Not enough coins', '🪙'); return false; }
  S.plots.push(null);
  SFX.buy();
  ok('New field cleared!', '🌱');
  St.saveSoon();
  return true;
}

export function upgradeSilo() {
  const S = St.S;
  if (!St.spendCoins(D.siloUpgradeCost(S.siloCap))) { fail('Not enough coins', '🪙'); return false; }
  S.siloCap += D.SILO_STEP;
  SFX.buy();
  ok(`Silo holds ${S.siloCap} now`, '🛖');
  St.saveSoon();
  return true;
}

export function upgradeBarn() {
  const S = St.S;
  if (!St.spendCoins(D.barnUpgradeCost(S.barnCap))) { fail('Not enough coins', '🪙'); return false; }
  S.barnCap += D.BARN_STEP;
  SFX.buy();
  ok(`Barn holds ${S.barnCap} now`, '🏠');
  St.saveSoon();
  return true;
}

export function buyUpgrade(id) {
  const S = St.S;
  const u = D.UPGRADES.find(x => x.id === id);
  if (!u || S.upgrades[id]) return false;
  if (S.level < u.level) { fail(`Unlocks at level ${u.level}`, '🔒'); return false; }
  if (!St.spendCoins(u.cost)) { fail('Not enough coins', '🪙'); return false; }
  S.upgrades[id] = true;
  SFX.levelUp();
  ok(`${u.name} unlocked!`, u.icon);
  St.saveSoon();
  return true;
}

/* -------------------------------- orders -------------------------------- */

function makeOrder() {
  const S = St.S;
  const pool = St.producibleItems();
  if (!pool.length) return null;
  const kinds = clamp(randInt(1, S.level < 5 ? 1 : S.level < 12 ? 2 : 3), 1, pool.length);
  const chosen = [];
  while (chosen.length < kinds) {
    const id = pick(pool);
    if (!chosen.includes(id)) chosen.push(id);
  }
  const items = {};
  let coins = 0, xp = 0;
  for (const id of chosen) {
    const it = D.ITEMS[id];
    // Cheap staples are asked for in bulk, expensive goods one or two at a time.
    const max = it.price < 50 ? 8 : it.price < 300 ? 5 : 3;
    const q = randInt(1, max);
    items[id] = q;
    coins += it.price * q;
    xp += it.xp * q;
  }
  return {
    oid: uid(),
    items,
    coins: Math.round(coins * 1.4 * St.orderMult()),
    xp: Math.max(3, Math.round(xp * 1.8)),
    gems: Math.random() < 0.16 ? 1 : 0,
    createdAt: now(),
  };
}

function orderWait() {
  return D.ORDER_REFRESH * (St.has('truck') ? 0.5 : 1) * 1000;
}

/** Keeps the board at ORDER_SLOTS entries, each either an order or a timer. */
export function tickOrders() {
  const S = St.S;
  if (!Array.isArray(S.orders)) S.orders = [];
  while (S.orders.length < D.ORDER_SLOTS) S.orders.push({ wait: 0 });
  S.orders.length = D.ORDER_SLOTS;
  for (let i = 0; i < S.orders.length; i++) {
    const slot = S.orders[i];
    if (slot && slot.oid) continue;
    const until = slot && slot.wait ? slot.wait : 0;
    if (now() >= until) {
      const o = makeOrder();
      S.orders[i] = o || { wait: now() + 30000 };
    }
  }
}

export function canDeliver(o) {
  return St.hasAll(o.items);
}

export function deliverOrder(oid) {
  const S = St.S;
  const i = S.orders.findIndex(o => o && o.oid === oid);
  if (i < 0) return false;
  const o = S.orders[i];
  if (!St.removeAll(o.items)) { fail('You are missing some items', '📦'); return false; }
  St.earnCoins(o.coins);
  S.gems += o.gems;
  S.stats.orders += 1;
  gainXp(o.xp);
  S.orders[i] = { wait: now() + orderWait() };
  SFX.order();
  ok(`Order delivered! +${o.coins} coins`, '🚚');
  St.saveSoon();
  return true;
}

export function declineOrder(oid) {
  const S = St.S;
  const i = S.orders.findIndex(o => o && o.oid === oid);
  if (i < 0) return false;
  S.orders[i] = { wait: now() + orderWait() * 0.5 };
  St.saveSoon();
  return true;
}

/* --------------------------------- clock -------------------------------- */

/** Runs about once a second, and once on load to settle offline progress. */
export function tick() {
  const S = St.S;
  if (!S) return;

  // The Feed Mill comes with the first chicken — no coins asked.
  if (S.level >= 3 && !(S.machines.mill && S.machines.mill.owned)) {
    S.machines.mill = { owned: true, queue: [] };
  }

  tickOrders();

  // Auto Feeder: any hungry animal eats itself as soon as feed exists.
  if (St.has('autoFeeder')) {
    for (const an of S.animals) {
      if (animalState(an) === 'hungry') feedAnimal(an, true);
    }
  }

  // Safety net: broke, nothing growing and an empty silo would be a dead end.
  if (S.coins < D.CROPS[0].seed && S.plots.every(p => !p) && St.siloUsed() === 0) {
    S.coins += 25;
    ok('A neighbour dropped off some seed money', '🪙');
    St.saveSoon();
  }

  // Combine: ripe fields harvest themselves (silo permitting).
  if (St.has('combine')) {
    for (let i = 0; i < S.plots.length; i++) {
      if (plotState(S.plots[i]) === 'ready') harvest(i, true);
    }
  }
}

/** Marks animals whose timer elapsed while the tab was closed. */
export function settleOffline() {
  const S = St.S;
  const away = Math.max(0, (now() - (S.lastSeen || now())) / 1000);
  let ready = 0;
  for (const an of S.animals) if (animalState(an) === 'ready') ready++;
  let ripe = 0;
  for (const p of S.plots) if (plotState(p) === 'ready') ripe++;
  let crafts = 0;
  for (const m of Object.values(S.machines)) {
    if (!m.owned) continue;
    for (const j of m.queue) if (jobReady(j)) crafts++;
  }
  tick();
  return { away, ready, ripe, crafts };
}
