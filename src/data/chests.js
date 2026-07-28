// Chest / reward tables and the roster of AI rivals.

export const CHESTS = {
  wood: {
    id: 'wood', name: 'Wood Chest', jp: '木箱', unlockMs: 0,
    gold: [40, 90], cards: [3, 6],
    odds: [['common', 88], ['rare', 11], ['epic', 1], ['legend', 0]],
    color: '#a9713f', color2: '#7c4d26', gems: [0, 0],
  },
  silver: {
    id: 'silver', name: 'Silver Chest', jp: '銀箱', unlockMs: 15 * 60 * 1000,
    gold: [110, 220], cards: [8, 14],
    odds: [['common', 74], ['rare', 22], ['epic', 3.6], ['legend', 0.4]],
    color: '#c9d4e0', color2: '#8b98ab', gems: [0, 2],
  },
  gold: {
    id: 'gold', name: 'Gold Chest', jp: '金箱', unlockMs: 3 * 60 * 60 * 1000,
    gold: [260, 480], cards: [18, 30],
    odds: [['common', 62], ['rare', 28], ['epic', 8.4], ['legend', 1.6]],
    color: '#ffcf5c', color2: '#e39a1c', gems: [2, 6],
  },
  sakura: {
    id: 'sakura', name: 'Sakura Chest', jp: '桜箱', unlockMs: 8 * 60 * 60 * 1000,
    gold: [620, 1100], cards: [40, 64],
    odds: [['common', 46], ['rare', 33], ['epic', 16], ['legend', 5]],
    color: '#ff5f9e', color2: '#d92b6b', gems: [8, 18],
  },
  oni: {
    id: 'oni', name: 'Oni Chest', jp: '鬼箱', unlockMs: 0,
    gold: [1400, 2400], cards: [90, 140],
    odds: [['common', 38], ['rare', 34], ['epic', 20], ['legend', 8]],
    color: '#a56bff', color2: '#6b3fd6', gems: [20, 40],
  },
};

// Which chest a battle win drops, by league index.
export const WIN_CHEST_LADDER = [
  ['wood', 62], ['silver', 28], ['gold', 8], ['sakura', 2],
];

export const RIVALS = [
  { name: 'Yamato', jp: 'ヤマト', tag: 'Rookie of the dojo', skill: 0.32, hue: 200 },
  { name: 'Suzume', jp: 'スズメ', tag: 'Rooftop sprinter', skill: 0.42, hue: 330 },
  { name: 'Genji', jp: 'ゲンジ', tag: 'Old man, older tricks', skill: 0.5, hue: 40 },
  { name: 'Aoi', jp: 'アオイ', tag: 'Reads you like a scroll', skill: 0.58, hue: 170 },
  { name: 'Rin', jp: 'リン', tag: 'Never blinks first', skill: 0.66, hue: 280 },
  { name: 'Shuten', jp: 'シュテン', tag: 'Drinks, then destroys', skill: 0.74, hue: 10 },
  { name: 'Kagerou', jp: 'カゲロウ', tag: 'The heat-haze duelist', skill: 0.82, hue: 300 },
  { name: 'Amaterasu', jp: 'アマテラス', tag: 'Champion of the high shrine', skill: 0.93, hue: 55 },
];

export function rivalForTrophies(trophies, rng) {
  const idx = Math.min(RIVALS.length - 1, Math.floor(trophies / 260));
  const lo = Math.max(0, idx - 1);
  const pickIdx = lo + Math.floor(rng() * (idx - lo + 1));
  return RIVALS[pickIdx];
}
