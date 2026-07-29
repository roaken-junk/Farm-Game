/* ==========================================================================
   state.js — the save file, plus every read/write that touches it.
   Anything that changes the farm goes through here so saving stays honest.
   ========================================================================== */

import * as D from './data.js';
import { now, clamp, uid } from './util.js';

const SAVE_VERSION = 1;
export const SLOTS = 3;

/** Slot 1 keeps the original key so farms from earlier builds survive. */
const slotKey = i => (i === 0 ? 'sunnyacres.save.v1' : `sunnyacres.save.v1.slot${i + 1}`);
const LAST_SLOT = 'sunnyacres.lastSlot';

export let S = null;
export let slot = 0;

/* --------------------------------- setup -------------------------------- */

export function freshState(name = 'Farmer', avatar = '🧑‍🌾') {
  return {
    v: SAVE_VERSION,
    name,
    avatar,
    createdAt: now(),
    lastSeen: now(),
    coins: 120,
    gems: 8,
    xp: 0,
    level: 1,
    plots: Array.from({ length: D.START_PLOTS }, () => null),
    silo: { wheat: 6 },
    barn: {},
    siloCap: D.START_SILO,
    barnCap: D.START_BARN,
    animals: [],
    machines: {}, // the Feed Mill is granted free at level 3
    orders: [],
    nextOrderAt: 0,
    upgrades: {},
    selectedSeed: 'wheat',
    settings: {
      sound: true,
      haptics: true,
      motion: true,
      confirmSell: false,     // ask before a Sell All
      bigText: false,
    },
    boosts: {},                                  // boost id -> expiry timestamp
    goals: {},                                   // goal id -> tiers claimed
    daily: { day: '', streak: 0 },
    fest: { cycle: -1, points: 0, claimed: [] },
    trough: { units: 24, grazedAt: now() },
    tips: { seenFest: false },
    stats: { harvested: 0, sold: 0, earned: 0, crafted: 0, orders: 0, collected: 0 },
  };
}

function readSlot(i) {
  try {
    const raw = localStorage.getItem(slotKey(i));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === SAVE_VERSION ? data : null;
  } catch {
    return null;
  }
}

/** A one-line summary of every slot, for the title screen. */
export function slotSummaries() {
  return Array.from({ length: SLOTS }, (_, i) => {
    const d = readSlot(i);
    if (!d) return { i, empty: true };
    return {
      i, empty: false,
      name: d.name, avatar: d.avatar, level: d.level,
      coins: d.coins, played: d.lastSeen || d.createdAt,
    };
  });
}

/** Loads a slot into play. Returns the state, or null if the slot is empty. */
export function load(i = null) {
  if (i === null) {
    const last = parseInt(localStorage.getItem(LAST_SLOT) || '0', 10);
    i = Number.isInteger(last) && last >= 0 && last < SLOTS ? last : 0;
  }
  const data = readSlot(i);
  if (!data) return null;
  slot = i;
  localStorage.setItem(LAST_SLOT, String(i));
  S = migrate(data);
  return S;
}

export function startNew(name, avatar, i = 0) {
  slot = i;
  localStorage.setItem(LAST_SLOT, String(i));
  S = freshState(name, avatar);
  save();
  return S;
}

export function deleteSlot(i) {
  localStorage.removeItem(slotKey(i));
}

/* ------------------------- moving a farm elsewhere ----------------------- */

/** The whole save as a paste-able code. */
export function exportCode() {
  const json = JSON.stringify(S);
  // encodeURIComponent first so non-ASCII farm names survive btoa.
  return btoa(unescape(encodeURIComponent(json))).replace(/=+$/, '');
}

/** Returns an error string, or null when the code was accepted. */
export function importCode(code, i = slot) {
  let data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
  } catch {
    return 'That code could not be read.';
  }
  if (!data || typeof data !== 'object' || data.v !== SAVE_VERSION || !Array.isArray(data.plots)) {
    return 'That code is not a Sunny Acres farm.';
  }
  slot = i;
  S = migrate(data);
  save();
  localStorage.setItem(LAST_SLOT, String(i));
  return null;
}

/** Fill in anything a save from an older build of the same version may lack. */
function migrate(data) {
  const base = freshState();
  for (const k of Object.keys(base)) if (data[k] === undefined) data[k] = base[k];
  data.settings = { ...base.settings, ...(data.settings || {}) };
  data.stats = { ...base.stats, ...(data.stats || {}) };
  data.goals = data.goals || {};
  data.boosts = data.boosts || {};
  data.daily = { ...base.daily, ...(data.daily || {}) };
  data.fest = { ...base.fest, ...(data.fest || {}) };
  data.trough = { ...base.trough, ...(data.trough || {}) };
  // Farms from before the trough kept milled feed in the barn; pour it in.
  if (data.barn && data.barn.feed) {
    data.trough.units = Math.min(D.TROUGH_CAP, data.trough.units + data.barn.feed);
    delete data.barn.feed;
  }
  data.tips = { ...base.tips, ...(data.tips || {}) };
  return data;
}

let saveTimer = null;
export function save() {
  if (!S) return;
  S.lastSeen = now();
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(S));
  } catch { /* storage full or private mode — keep playing in memory */ }
}

/** Coalesce the many little writes a tap storm produces. */
export function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; save(); }, 800);
}

export function wipe() {
  localStorage.removeItem(slotKey(slot));
}

/* ------------------------------- storage -------------------------------- */

export const isCrop = id => D.ITEMS[id] && D.ITEMS[id].kind === 'crop';
const store = id => (isCrop(id) ? S.silo : S.barn);

export function count(id) {
  return store(id)[id] || 0;
}

export function siloUsed() {
  return Object.values(S.silo).reduce((a, b) => a + b, 0);
}
export function barnUsed() {
  return Object.values(S.barn).reduce((a, b) => a + b, 0);
}
export function spaceFor(id) {
  return isCrop(id) ? S.siloCap - siloUsed() : S.barnCap - barnUsed();
}

/** Adds up to `qty`, stopping at the storage cap. Returns how many fit. */
export function addItem(id, qty = 1) {
  const room = Math.max(0, spaceFor(id));
  const n = Math.min(qty, room);
  if (n <= 0) return 0;
  const st = store(id);
  st[id] = (st[id] || 0) + n;
  return n;
}

export function removeItem(id, qty = 1) {
  const st = store(id);
  const have = st[id] || 0;
  if (have < qty) return false;
  st[id] = have - qty;
  if (st[id] <= 0) delete st[id];
  return true;
}

export function hasAll(map) {
  return Object.entries(map).every(([id, q]) => count(id) >= q);
}

export function removeAll(map) {
  if (!hasAll(map)) return false;
  for (const [id, q] of Object.entries(map)) removeItem(id, q);
  return true;
}

/* ------------------------------- currency ------------------------------- */

export function spendCoins(n) {
  if (S.coins < n) return false;
  S.coins -= n;
  return true;
}

export function earnCoins(n) {
  S.coins += n;
  S.stats.earned += n;
}

export function spendGems(n) {
  if (S.gems < n) return false;
  S.gems -= n;
  return true;
}

/* -------------------------------- levels -------------------------------- */

/** Returns the list of levels gained, so the UI can celebrate each one. */
export function addXp(n) {
  S.xp += n;
  const gained = [];
  while (S.xp >= D.xpToNext(S.level)) {
    S.xp -= D.xpToNext(S.level);
    S.level += 1;
    gained.push(S.level);
    S.coins += S.level * 120;
    S.gems += S.level % 5 === 0 ? 3 : 1;
  }
  return gained;
}

export function levelProgress() {
  const need = D.xpToNext(S.level);
  return { have: S.xp, need, pct: clamp(S.xp / need, 0, 1) };
}

export function has(upgradeId) {
  return !!S.upgrades[upgradeId];
}

/* --------------------------- derived modifiers -------------------------- */

/** Seconds left on a boost, or 0. */
export function boostLeft(id) {
  const end = (S.boosts || {})[id] || 0;
  return Math.max(0, (end - now()) / 1000);
}

export function boostsRunning() {
  return D.BOOSTS.filter(b => boostLeft(b.id) > 0);
}

/** Combined multiplier for one effect across every running boost. */
export function boostMult(effect) {
  let m = 1;
  for (const b of D.BOOSTS) if (b.effect === effect && boostLeft(b.id) > 0) m *= b.mult;
  return m;
}

/** Multiplier applied to every crop timer. Lower is faster. */
export function growthMult() {
  let m = 1;
  if (has('wateringCan')) m *= 0.9;
  if (has('sprinkler')) m *= 0.8;
  return m / boostMult('grow');
}

export function craftMult() {
  return (has('foreman') ? 0.8 : 1) / boostMult('craft');
}

/** Animal cycles shorten the same way crops do. */
export function animalMult() {
  return 1 / boostMult('animal');
}

export function sellMult() {
  return (has('scythe') ? 1.25 : 1) * boostMult('sell');
}

export function orderMult() {
  return (has('truck') ? 1.3 : 1) * boostMult('order');
}

export function xpMult() {
  return boostMult('xp');
}

/* -------------------------------- trough -------------------------------- */

export const troughUnits = () => Math.floor(S.trough.units);

export function addTrough(n) {
  const before = S.trough.units;
  S.trough.units = Math.min(D.TROUGH_CAP, S.trough.units + n);
  return Math.round(S.trough.units - before);
}

export function takeTrough(n) {
  if (S.trough.units < n) return false;
  S.trough.units -= n;
  return true;
}

/** Grass grows back on its own, faster with Rich Pasture. */
export function grazeRate() {
  return (has('autoFeeder') ? 2 : 1) / D.GRAZE_SECONDS;
}

export function queueCap() {
  return D.BASE_QUEUE + (has('foreman') ? 3 : 0);
}

/* -------------------------------- unlocks ------------------------------- */

export function unlockedCrops() {
  return D.CROPS.filter(c => c.level <= S.level);
}

export function unlockedRecipes(machineId) {
  return D.recipesFor(machineId).filter(r => r.level <= S.level);
}

export function animalsOf(typeId) {
  return S.animals.filter(a => a.type === typeId);
}

export function addAnimal(typeId) {
  S.animals.push({ id: uid(), type: typeId, fedAt: 0, readyAt: 0, product: false });
}

/** Everything the player can currently make — used to build fair orders. */
export function producibleItems() {
  const ids = new Set();
  for (const c of D.CROPS) if (c.level <= S.level) ids.add(c.id);
  for (const a of D.ANIMALS) if (animalsOf(a.id).length) ids.add(a.product);
  for (const r of D.RECIPES) {
    const m = S.machines[r.machine];
    if (m && m.owned && r.level <= S.level && r.out !== 'feed') ids.add(r.out);
  }
  return [...ids];
}
