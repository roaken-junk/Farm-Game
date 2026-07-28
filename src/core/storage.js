// Player save file. Everything lives in localStorage so the game works
// fully offline once the PWA is installed.

const KEY = 'sakura-smash-save-v1';

export const DEFAULT_SAVE = {
  version: 1,
  name: 'Sensei',
  avatarSeed: 7,
  trophies: 0,
  bestTrophies: 0,
  gold: 300,
  gems: 20,
  wins: 0,
  losses: 0,
  streak: 0,
  // heroId -> { level, cards }
  owned: {},
  team: [],
  // chest slots: null | { type, unlockAt|null, readyAt }
  chests: [null, null, null, null],
  lastFreeChest: 0,
  settings: { sfx: true, music: true, haptics: true, lefty: false, quality: 'auto' },
  seenIntro: false,
};

let cache = null;

// Deliberately not structuredClone: it is missing on iOS Safari before 15.4,
// and a save file is plain JSON anyway. A missing global here used to take the
// whole boot down, since the fallback path needed it too.
const clone = (v) => JSON.parse(JSON.stringify(v));

export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? deepMerge(clone(DEFAULT_SAVE), JSON.parse(raw)) : clone(DEFAULT_SAVE);
  } catch (err) {
    // Storage can be unavailable outright (private mode, sandboxed frame).
    // The game still has to run — it just will not remember anything.
    console.warn('save load failed, starting fresh', err);
    cache = clone(DEFAULT_SAVE);
  }
  return cache;
}

let saveTimer = 0;
export function save(immediate = false) {
  if (!cache) return;
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (err) {
      console.warn('save failed', err);
    }
  };
  if (immediate) {
    clearTimeout(saveTimer);
    write();
  } else {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(write, 220);
  }
}

export function resetSave() {
  cache = clone(DEFAULT_SAVE);
  save(true);
  return cache;
}

function deepMerge(base, patch) {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base)) return Array.isArray(patch) ? patch : base;
  if (typeof base !== 'object') return patch;
  if (typeof patch !== 'object') return base;
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    out[k] = k in base ? deepMerge(base[k], patch[k]) : patch[k];
  }
  return out;
}
