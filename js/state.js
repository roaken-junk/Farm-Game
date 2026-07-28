/* ==========================================================================
   state.js — the save file, plus every read/write that touches it.
   Anything that changes the farm goes through here so saving stays honest.
   ========================================================================== */

import * as D from './data.js';
import { now, clamp, uid } from './util.js';

const KEY = 'sunnyacres.save.v1';
const SAVE_VERSION = 1;

export let S = null;

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
    settings: { sound: true },
    stats: { harvested: 0, sold: 0, earned: 0, crafted: 0, orders: 0, collected: 0 },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== SAVE_VERSION) return null;
    S = migrate(data);
    return S;
  } catch {
    return null;
  }
}

export function startNew(name, avatar) {
  S = freshState(name, avatar);
  save();
  return S;
}

/** Fill in anything a save from an older build of the same version may lack. */
function migrate(data) {
  const base = freshState();
  for (const k of Object.keys(base)) if (data[k] === undefined) data[k] = base[k];
  data.settings = { ...base.settings, ...(data.settings || {}) };
  data.stats = { ...base.stats, ...(data.stats || {}) };
  return data;
}

let saveTimer = null;
export function save() {
  if (!S) return;
  S.lastSeen = now();
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch { /* storage full or private mode — keep playing in memory */ }
}

/** Coalesce the many little writes a tap storm produces. */
export function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; save(); }, 800);
}

export function wipe() {
  localStorage.removeItem(KEY);
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

/** Multiplier applied to every crop timer. */
export function growthMult() {
  let m = 1;
  if (has('wateringCan')) m *= 0.9;
  if (has('sprinkler')) m *= 0.8;
  return m;
}

export function craftMult() {
  return has('foreman') ? 0.8 : 1;
}

export function sellMult() {
  return has('scythe') ? 1.25 : 1;
}

export function orderMult() {
  return has('truck') ? 1.3 : 1;
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
