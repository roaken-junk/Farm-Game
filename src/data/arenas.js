// Arenas double as the trophy ladder (leagues). Play space is a fixed
// virtual 1000x1500 field that gets letterboxed to whatever screen it lands on.

export const ARENA_W = 1000;
export const ARENA_H = 1500;

// Formation slots (bottom = player, mirrored for the opponent).
const FORMATION = [
  { x: 250, y: 1240 },
  { x: 500, y: 1330 },
  { x: 750, y: 1240 },
  { x: 500, y: 1120 },
];

export const ARENAS = [
  {
    id: 'courtyard',
    name: 'Sakura Courtyard',
    jp: '桜庭',
    minTrophies: 0,
    reward: { gold: 60, trophy: 28 },
    friction: 0.30, // fraction of speed retained per second — lower = grippier
    theme: {
      floor: '#3d2a4f', floor2: '#2b1c3b', line: '#ff9ec4', glow: '#ff5f9e',
      sky: '#492a63', accent: '#ffcf5c', petals: 'sakura', banner: '桜',
    },
    hazards: [],
    decor: { torii: true, lanterns: 4, tree: true },
  },
  {
    id: 'bamboo',
    name: 'Bamboo Hollow',
    jp: '竹林',
    minTrophies: 150,
    reward: { gold: 90, trophy: 29 },
    friction: 0.30,
    theme: {
      floor: '#243d33', floor2: '#182a24', line: '#7ad6a8', glow: '#4be3c8',
      sky: '#1d3a30', accent: '#a8e063', petals: 'leaf', banner: '竹',
    },
    hazards: [
      { type: 'pit', x: 235, y: 750, r: 86 },
      { type: 'pit', x: 765, y: 750, r: 86 },
    ],
    decor: { bamboo: true, lanterns: 2 },
  },
  {
    id: 'rooftop',
    name: 'Neon Rooftop',
    jp: '電脳屋上',
    minTrophies: 400,
    reward: { gold: 130, trophy: 30 },
    friction: 0.36,
    theme: {
      floor: '#1b1b3d', floor2: '#111128', line: '#63b6ff', glow: '#ff2fa0',
      sky: '#161034', accent: '#2fffd0', petals: 'spark', banner: '電',
    },
    hazards: [
      { type: 'pit', x: 500, y: 750, r: 104 },
      { type: 'bumper', x: 220, y: 520, r: 70 },
      { type: 'bumper', x: 780, y: 980, r: 70 },
    ],
    decor: { skyline: true, neon: true },
  },
  {
    id: 'frozen',
    name: 'Frozen Shrine',
    jp: '氷社',
    minTrophies: 700,
    reward: { gold: 180, trophy: 31 },
    friction: 0.46, // slick ice — everything slides further
    theme: {
      floor: '#2a4468', floor2: '#1a2c47', line: '#bfe9ff', glow: '#7fcfff',
      sky: '#22355c', accent: '#e6f7ff', petals: 'snow', banner: '氷',
    },
    hazards: [
      { type: 'spike', x: 300, y: 640, r: 78, dmg: 150 },
      { type: 'spike', x: 700, y: 860, r: 78, dmg: 150 },
      { type: 'pit', x: 500, y: 260, r: 76 },
      { type: 'pit', x: 500, y: 1240, r: 76 },
    ],
    decor: { torii: true, snow: true },
  },
  {
    id: 'forge',
    name: 'Volcano Forge',
    jp: '火山炉',
    minTrophies: 1100,
    reward: { gold: 240, trophy: 32 },
    friction: 0.29, // ash and slag drag you to a halt
    theme: {
      floor: '#4a2320', floor2: '#2e1412', line: '#ff8a3c', glow: '#ff4d2e',
      sky: '#3a1512', accent: '#ffcf5c', petals: 'ember', banner: '炎',
    },
    hazards: [
      { type: 'spike', x: 500, y: 750, r: 120, dmg: 210 },
      { type: 'bumper', x: 200, y: 750, r: 76 },
      { type: 'bumper', x: 800, y: 750, r: 76 },
      { type: 'pit', x: 160, y: 340, r: 76 },
      { type: 'pit', x: 840, y: 1160, r: 76 },
    ],
    decor: { lava: true, lanterns: 2 },
  },
  {
    id: 'celestial',
    name: 'Celestial Torii',
    jp: '天鳥居',
    minTrophies: 1600,
    reward: { gold: 320, trophy: 33 },
    friction: 0.44,
    theme: {
      floor: '#2d2160', floor2: '#1a1240', line: '#c9b6ff', glow: '#a56bff',
      sky: '#221a4d', accent: '#ffe066', petals: 'star', banner: '天',
    },
    hazards: [
      { type: 'pit', x: 190, y: 560, r: 90 },
      { type: 'pit', x: 810, y: 560, r: 90 },
      { type: 'pit', x: 190, y: 940, r: 90 },
      { type: 'pit', x: 810, y: 940, r: 90 },
      { type: 'bumper', x: 500, y: 750, r: 92 },
    ],
    decor: { torii: true, stars: true },
  },
];

export const ARENA_BY_ID = Object.fromEntries(ARENAS.map((a) => [a.id, a]));

export function arenaForTrophies(trophies) {
  let out = ARENAS[0];
  for (const a of ARENAS) if (trophies >= a.minTrophies) out = a;
  return out;
}

export function nextArena(trophies) {
  return ARENAS.find((a) => a.minTrophies > trophies) || null;
}

export function spawnPoints(side) {
  // side 0 = bottom (player), side 1 = top (opponent)
  return FORMATION.map((p) =>
    side === 0 ? { x: p.x, y: p.y } : { x: ARENA_W - p.x, y: ARENA_H - p.y }
  );
}
