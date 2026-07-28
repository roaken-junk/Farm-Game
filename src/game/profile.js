// Player progression: roster, upgrades, chests, trophies.

import { load, save } from '../core/storage.js';
import { HEROES, HERO_BY_ID, RARITY, cardsForNextLevel, goldForNextLevel, heroPower, MAX_LEVEL } from '../data/heroes.js';
import { CHESTS, WIN_CHEST_LADDER } from '../data/chests.js';
import { arenaForTrophies } from '../data/arenas.js';
import { makeRng, weighted } from '../core/rng.js';

const STARTERS = ['hikari', 'tetsu', 'hana', 'momo'];

export function profile() {
  return load();
}

export function ensureStarter() {
  const p = load();
  if (Object.keys(p.owned).length === 0) {
    for (const id of STARTERS) p.owned[id] = { level: 1, cards: 0 };
  }
  if (!p.team || p.team.length !== 4 || p.team.some((id) => !p.owned[id])) {
    p.team = Object.keys(p.owned).slice(0, 4);
    while (p.team.length < 4) p.team.push(p.team[0]);
  }
  save();
  return p;
}

export const ownedList = () =>
  HEROES.filter((h) => !!load().owned[h.id]).map((h) => ({ hero: h, ...load().owned[h.id] }));

export function teamMembers() {
  const p = load();
  return p.team.map((id) => ({ heroId: id, level: p.owned[id]?.level || 1 }));
}

export function teamPower() {
  const p = load();
  return p.team.reduce((s, id) => s + heroPower(id, p.owned[id]?.level || 1), 0);
}

export function setTeamSlot(slot, heroId) {
  const p = load();
  const existing = p.team.indexOf(heroId);
  if (existing >= 0 && existing !== slot) {
    // swap rather than duplicate
    p.team[existing] = p.team[slot];
  }
  p.team[slot] = heroId;
  save();
}

/* ------------------------------ upgrading ------------------------------- */

export function upgradeInfo(heroId) {
  const p = load();
  const own = p.owned[heroId];
  if (!own) return null;
  const hero = HERO_BY_ID[heroId];
  const need = cardsForNextLevel(hero.rarity, own.level);
  const gold = goldForNextLevel(own.level);
  return {
    level: own.level,
    cards: own.cards,
    need,
    gold,
    maxed: own.level >= MAX_LEVEL,
    canUpgrade: own.level < MAX_LEVEL && own.cards >= need && p.gold >= gold,
  };
}

export function upgradeHero(heroId) {
  const info = upgradeInfo(heroId);
  if (!info || !info.canUpgrade) return false;
  const p = load();
  p.owned[heroId].cards -= info.need;
  p.owned[heroId].level += 1;
  p.gold -= info.gold;
  save(true);
  return true;
}

export function addCards(heroId, n) {
  const p = load();
  if (!p.owned[heroId]) {
    p.owned[heroId] = { level: 1, cards: Math.max(0, n - 1) };
    save();
    return { isNew: true };
  }
  p.owned[heroId].cards += n;
  save();
  return { isNew: false };
}

/* -------------------------------- chests -------------------------------- */

export function chestSlots() {
  return load().chests;
}

export function grantChest(type) {
  const p = load();
  const idx = p.chests.findIndex((c) => c === null);
  if (idx < 0) return -1;
  p.chests[idx] = { type, unlockAt: null, readyAt: null };
  save(true);
  return idx;
}

export function startUnlock(slot) {
  const p = load();
  const c = p.chests[slot];
  if (!c || c.unlockAt) return false;
  // only one chest unlocks at a time
  if (p.chests.some((x) => x && x.unlockAt && !isReady(x))) return false;
  const def = CHESTS[c.type];
  c.unlockAt = Date.now();
  c.readyAt = Date.now() + def.unlockMs;
  save(true);
  return true;
}

export const isReady = (c) => !!c && c.readyAt !== null && Date.now() >= c.readyAt;

export function remainingMs(c) {
  if (!c || c.readyAt === null) return null;
  return Math.max(0, c.readyAt - Date.now());
}

export function gemCostToSkip(c) {
  const ms = remainingMs(c);
  if (ms === null) return null;
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 12)));
}

export function skipUnlock(slot) {
  const p = load();
  const c = p.chests[slot];
  if (!c) return false;
  const cost = c.unlockAt ? gemCostToSkip(c) : Math.max(1, Math.ceil(CHESTS[c.type].unlockMs / (1000 * 60 * 12)));
  if (p.gems < cost) return false;
  p.gems -= cost;
  c.unlockAt = Date.now();
  c.readyAt = Date.now();
  save(true);
  return true;
}

export function openChest(slot, seed = Date.now()) {
  const p = load();
  const c = p.chests[slot];
  if (!c || !isReady(c)) return null;
  const loot = rollChest(c.type, seed);
  p.chests[slot] = null;
  p.gold += loot.gold;
  p.gems += loot.gems;
  for (const item of loot.cards) {
    const r = addCards(item.heroId, item.count);
    item.isNew = r.isNew;
  }
  save(true);
  return loot;
}

export function rollChest(type, seed = Date.now()) {
  const def = CHESTS[type];
  const rng = makeRng(seed >>> 0);
  const gold = Math.round(def.gold[0] + rng() * (def.gold[1] - def.gold[0]));
  const gems = Math.round(def.gems[0] + rng() * (def.gems[1] - def.gems[0]));
  const totalCards = Math.round(def.cards[0] + rng() * (def.cards[1] - def.cards[0]));

  // Split the card budget across 3-5 heroes, respecting the rarity odds.
  const stacks = 3 + Math.floor(rng() * 3);
  const cards = [];
  let left = totalCards;
  for (let i = 0; i < stacks; i++) {
    const rarity = weighted(rng, def.odds.map(([k, v]) => [k, v]));
    const pool = HEROES.filter((h) => h.rarity === rarity);
    const hero = pool[Math.floor(rng() * pool.length)] || HEROES[0];
    const isLast = i === stacks - 1;
    const rarityCap = rarity === 'legend' ? 3 : rarity === 'epic' ? 6 : rarity === 'rare' ? 14 : 30;
    let count = isLast ? left : Math.max(1, Math.min(rarityCap, Math.round((left / (stacks - i)) * (0.6 + rng() * 0.9))));
    count = Math.max(1, Math.min(count, left));
    left -= count;
    const existing = cards.find((c) => c.heroId === hero.id);
    if (existing) existing.count += count;
    else cards.push({ heroId: hero.id, count, rarity });
    if (left <= 0) break;
  }

  return { type, gold, gems, cards, def };
}

/* ------------------------------ battle result ---------------------------- */

export function applyBattleResult(win, arenaId, seed = Date.now()) {
  const p = load();
  const arena = arenaForTrophies(p.trophies);
  const rng = makeRng(seed >>> 0);
  const out = { win, trophies: 0, gold: 0, chest: null, leagueUp: false, leagueDown: false };

  if (win) {
    out.trophies = arena.reward.trophy + Math.floor(rng() * 3);
    out.gold = Math.round(arena.reward.gold * (0.85 + rng() * 0.4));
    p.wins += 1;
    p.streak = Math.max(0, p.streak) + 1;
    if (p.streak >= 3) out.gold = Math.round(out.gold * 1.25);
    const type = weighted(rng, WIN_CHEST_LADDER);
    const slot = grantChest(type);
    if (slot >= 0) out.chest = { type, slot };
  } else {
    out.trophies = -Math.round(arena.reward.trophy * 0.72);
    out.gold = Math.round(arena.reward.gold * 0.22);
    p.losses += 1;
    p.streak = 0;
  }

  const before = p.trophies;
  p.trophies = Math.max(0, p.trophies + out.trophies);
  p.gold += out.gold;
  p.bestTrophies = Math.max(p.bestTrophies, p.trophies);

  const arenaBefore = arenaForTrophies(before);
  const arenaAfter = arenaForTrophies(p.trophies);
  if (arenaAfter.id !== arenaBefore.id) {
    if (p.trophies > before) out.leagueUp = arenaAfter;
    else out.leagueDown = arenaAfter;
  }

  save(true);
  return out;
}

/* -------------------------- opponent generation -------------------------- */

export function buildRivalTeam(trophies, seed = Date.now()) {
  const rng = makeRng(seed >>> 0);
  const p = load();
  const avgLevel = Math.max(1, Math.round(
    p.team.reduce((s, id) => s + (p.owned[id]?.level || 1), 0) / Math.max(1, p.team.length)
  ));
  // The rival tracks the player's level with a little variance either way.
  const lvl = () => Math.max(1, Math.min(MAX_LEVEL, avgLevel + (rng() < 0.35 ? 1 : 0) - (rng() < 0.2 ? 1 : 0)));

  const leagueIdx = Math.min(5, Math.floor(trophies / 300));
  const pool = HEROES.filter((h) => {
    if (h.rarity === 'legend') return leagueIdx >= 3;
    if (h.rarity === 'epic') return leagueIdx >= 2;
    if (h.rarity === 'rare') return leagueIdx >= 1;
    return true;
  });

  const picked = [];
  const used = new Set();
  while (picked.length < 4) {
    const h = pool[Math.floor(rng() * pool.length)];
    if (used.has(h.id) && used.size < pool.length) continue;
    used.add(h.id);
    picked.push({ heroId: h.id, level: lvl() });
  }
  return picked;
}

export function leagueName(trophies) {
  return arenaForTrophies(trophies).name;
}

export { RARITY };
