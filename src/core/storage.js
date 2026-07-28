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

export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = deepMerge(structuredClone(DEFAULT_SAVE), parsed);
    } else {
      cache = structuredClone(DEFAULT_SAVE);
    }
  } catch (err) {
    console.warn('save load failed, starting fresh', err);
    cache = structuredClone(DEFAULT_SAVE);
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
  cache = structuredClone(DEFAULT_SAVE);
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
