// Hero roster. Every hero carries both gameplay stats and the parameters
// that drive its procedurally drawn anime portrait (see src/art/characters.js).
// No external art assets — the look is defined entirely by these numbers.

export const RARITY = {
  common: { key: 'common', label: 'Common', jp: '常', color: '#9fb4cc', cls: 'r-common', power: 1.0 },
  rare:   { key: 'rare',   label: 'Rare',   jp: '稀', color: '#5ec8ff', cls: 'r-rare',   power: 1.25 },
  epic:   { key: 'epic',   label: 'Epic',   jp: '極', color: '#c07bff', cls: 'r-epic',   power: 1.6 },
  legend: { key: 'legend', label: 'Legend', jp: '伝', color: '#ffcf5c', cls: 'r-legend', power: 2.1 },
};

// Cards needed to reach the NEXT level, indexed by current level - 1.
export const CARD_COST = {
  common: [2, 4, 10, 20, 50, 100, 200, 400, 800, 1400],
  rare:   [2, 4, 8, 16, 30, 60, 120, 240, 450, 800],
  epic:   [1, 2, 4, 8, 16, 30, 60, 120, 220, 400],
  legend: [1, 1, 2, 4, 8, 14, 26, 50, 90, 160],
};
export const GOLD_COST = [50, 120, 300, 700, 1400, 2600, 4600, 8000, 14000, 24000];
export const MAX_LEVEL = 11;

// +7% per level, compounding — mirrors the gentle power curve of the genre.
export const levelScale = (lvl) => Math.pow(1.07, lvl - 1);

export const ABILITY_TRIGGER = {
  onLaunch: 'On launch',
  onFirstHit: 'On first hit',
  onStop: 'When it stops',
};

export const HEROES = [
  {
    id: 'hikari', name: 'Hikari', jp: '光', title: 'Dawnblade',
    rarity: 'common',
    lore: 'A wandering swordswoman who fights facing the sunrise. Reliable, balanced, relentless.',
    hp: 1050, atk: 250, weight: 1.0, radius: 67,
    ability: {
      id: 'pierce', name: 'Moonlit Slash', jp: '月斬', trigger: 'onFirstHit',
      desc: 'Her first impact cuts clean through: +120% damage and she keeps most of her momentum.',
      dmgMul: 2.2, keepMomentum: 0.82,
    },
    art: {
      skin: '#ffe0cf', hair: '#ffd97a', hair2: '#ffb845', hairStyle: 'ponytail',
      eye: '#3fb2ff', outfit: '#f7f2e6', outfit2: '#e0446e', accent: '#ffcf5c',
      weapon: 'katana', aura: '#ffd97a', expression: 'determined',
    },
  },
  {
    id: 'tetsu', name: 'Tetsu', jp: '鉄', title: 'Iron Oni',
    rarity: 'common',
    lore: 'A mountain in human shape. Slow to move, impossible to move aside.',
    hp: 1500, atk: 205, weight: 1.75, radius: 81,
    ability: {
      id: 'quake', name: 'Iron Quake', jp: '鉄震', trigger: 'onStop',
      desc: 'Slams the ground where he stops, blasting every nearby enemy away and dealing shockwave damage.',
      radius: 280, dmg: 190, knock: 780,
    },
    art: {
      skin: '#c96a6a', hair: '#2b1a2e', hair2: '#4a2f52', hairStyle: 'spiky',
      eye: '#ffd23f', outfit: '#3a2a55', outfit2: '#ffcf5c', accent: '#8b3f3f',
      weapon: 'club', aura: '#ff7b4d', expression: 'angry', horns: true, big: true,
    },
  },
  {
    id: 'hana', name: 'Hana', jp: '花', title: 'Petal Archer',
    rarity: 'common',
    lore: 'She looses arrows wrapped in cherry blossom. They never quite stop travelling.',
    hp: 880, atk: 235, weight: 0.78, radius: 61,
    ability: {
      id: 'arrow', name: 'Petal Volley', jp: '花矢', trigger: 'onLaunch',
      desc: 'Glides like an arrow — barely slows down, and damages every enemy she brushes past.',
      friction: 0.62, dmgMul: 1.35,
    },
    art: {
      skin: '#ffe3d4', hair: '#ff9ec4', hair2: '#ff6ba6', hairStyle: 'twintails',
      eye: '#ff5f9e', outfit: '#fff4f8', outfit2: '#7ad6a8', accent: '#ff5f9e',
      weapon: 'bow', aura: '#ff9ec4', expression: 'happy',
    },
  },
  {
    id: 'momo', name: 'Momo', jp: '桃', title: 'Tanuki Trickster',
    rarity: 'common',
    lore: 'Half brawler, half appetite. Every bruise he gives, he eats.',
    hp: 1200, atk: 215, weight: 1.3, radius: 72,
    ability: {
      id: 'vampire', name: 'Feast', jp: '喰', trigger: 'onFirstHit',
      desc: 'Devours the impact — heals himself for 70% of all damage dealt this turn.',
      leech: 0.7,
    },
    art: {
      skin: '#ffd9b8', hair: '#a9713f', hair2: '#7c4d26', hairStyle: 'messy',
      eye: '#5ce08a', outfit: '#6b9f5c', outfit2: '#f2e2c4', accent: '#a9713f',
      weapon: 'fan', aura: '#a9713f', expression: 'smug', ears: 'tanuki',
    },
  },
  {
    id: 'kuro', name: 'Kuro', jp: '黒', title: 'Shadow Step',
    rarity: 'rare',
    lore: 'Nobody has seen him arrive. Several have seen him leave.',
    hp: 900, atk: 300, weight: 0.72, radius: 61,
    ability: {
      id: 'clones', name: 'Shadow Split', jp: '影分身', trigger: 'onLaunch',
      desc: 'Splits into two shadow clones that fan out on either side, each striking for 60% damage.',
      count: 2, spread: 0.42, dmgMul: 0.6,
    },
    art: {
      skin: '#f7dcc4', hair: '#3b2f5c', hair2: '#6b5aa8', hairStyle: 'swept',
      eye: '#a56bff', outfit: '#241a3d', outfit2: '#8f7dd6', accent: '#a56bff',
      weapon: 'kunai', aura: '#a56bff', expression: 'cool', mask: true,
    },
  },
  {
    id: 'mochi', name: 'Mochi', jp: '餅', title: 'Cat Sorceress',
    rarity: 'rare',
    lore: 'Tiny, fluffy, and carrying more raw magic than the rest of the roster combined.',
    hp: 800, atk: 340, weight: 0.68, radius: 58,
    ability: {
      id: 'nova', name: 'Arcane Nova', jp: '魔弾', trigger: 'onStop',
      desc: 'Detonates a ring of starlight where she lands, damaging every enemy caught inside.',
      radius: 330, dmg: 300,
    },
    art: {
      skin: '#fff0e2', hair: '#c9b6ff', hair2: '#9d84f0', hairStyle: 'bob',
      eye: '#ffd23f', outfit: '#4b3a8c', outfit2: '#ffd23f', accent: '#c9b6ff',
      weapon: 'staff', aura: '#c9b6ff', expression: 'happy', ears: 'cat', small: true,
    },
  },
  {
    id: 'yuki', name: 'Yuki', jp: '雪', title: 'Snow Yokai',
    rarity: 'rare',
    lore: 'The blizzard walks with her. Whatever she touches forgets how to move.',
    hp: 1000, atk: 250, weight: 0.95, radius: 67,
    ability: {
      id: 'freeze', name: 'Frost Prison', jp: '氷牢', trigger: 'onFirstHit',
      desc: 'Encases the target in ice — it cannot be launched on its next turn and takes 30% extra damage while frozen.',
      turns: 1, brittle: 1.3,
    },
    art: {
      skin: '#f2f6ff', hair: '#bfe9ff', hair2: '#7fcfff', hairStyle: 'long',
      eye: '#63b6ff', outfit: '#dff2ff', outfit2: '#4b7fd6', accent: '#7fcfff',
      weapon: 'fan', aura: '#7fcfff', expression: 'calm',
    },
  },
  {
    id: 'sora', name: 'Sora', jp: '空', title: 'Gale Monk',
    rarity: 'rare',
    lore: 'He does not block the blow. He convinces the wind to do it for him.',
    hp: 1250, atk: 225, weight: 1.15, radius: 70,
    ability: {
      id: 'shield', name: 'Gale Ward', jp: '風壁', trigger: 'onStop',
      desc: 'Wraps every living ally in a wind barrier that absorbs 45% of incoming damage for two turns.',
      reduce: 0.45, turns: 2,
    },
    art: {
      skin: '#e8c9a0', hair: '#7ad6a8', hair2: '#3fae86', hairStyle: 'short',
      eye: '#4be3c8', outfit: '#f2e6cf', outfit2: '#e07b3f', accent: '#4be3c8',
      weapon: 'staff', aura: '#4be3c8', expression: 'calm',
    },
  },
  {
    id: 'ren', name: 'Ren', jp: '蓮', title: 'Shrine Maiden',
    rarity: 'epic',
    lore: 'She sweeps the shrine steps at dawn and mends broken warriors at dusk.',
    hp: 1150, atk: 210, weight: 1.0, radius: 67,
    ability: {
      id: 'heal', name: 'Petal Blessing', jp: '花恵', trigger: 'onStop',
      desc: 'Blossoms scatter from her landing point, restoring 340 health to every living ally.',
      heal: 340,
    },
    art: {
      skin: '#ffe6d5', hair: '#241a2e', hair2: '#4b3560', hairStyle: 'straight',
      eye: '#ff5f9e', outfit: '#fdf4e6', outfit2: '#e0446e', accent: '#ffcf5c',
      weapon: 'gohei', aura: '#ff9ec4', expression: 'calm', halo: true,
    },
  },
  {
    id: 'raiden', name: 'Raiden', jp: '雷電', title: 'Storm Herald',
    rarity: 'epic',
    lore: 'Drums on his back, thunder in his fists. He arrives before the sound does.',
    hp: 1080, atk: 320, weight: 1.05, radius: 68,
    ability: {
      id: 'chain', name: 'Chain Lightning', jp: '雷連', trigger: 'onFirstHit',
      desc: 'Lightning arcs from the target to up to 3 more enemies, dealing 230 damage to each.',
      jumps: 3, dmg: 230, range: 520,
    },
    art: {
      skin: '#f0cfa8', hair: '#ffe066', hair2: '#ffb400', hairStyle: 'spiky',
      eye: '#63b6ff', outfit: '#2b3a6b', outfit2: '#ffe066', accent: '#63b6ff',
      weapon: 'drumstick', aura: '#ffe066', expression: 'determined',
    },
  },
  {
    id: 'kitsune', name: 'Kitsune', jp: '狐', title: 'Nine-Tail',
    rarity: 'legend',
    lore: 'An old, old spirit playing an old, old game. Each tail keeps its own grudge.',
    hp: 1120, atk: 330, weight: 0.9, radius: 67,
    ability: {
      id: 'barrage', name: 'Nine Tails', jp: '九尾', trigger: 'onStop',
      desc: 'Releases nine foxfire spirits that hunt down living enemies, each burning for 95 damage.',
      count: 9, dmg: 95,
    },
    art: {
      skin: '#fff0dd', hair: '#ffffff', hair2: '#ffd9e8', hairStyle: 'long',
      eye: '#ffcf5c', outfit: '#ff5f9e', outfit2: '#fdf4e6', accent: '#ffcf5c',
      weapon: 'none', aura: '#ff9ec4', expression: 'smug', ears: 'fox', tails: 9,
    },
  },
  {
    id: 'akuma', name: 'Akuma', jp: '悪魔', title: 'Demon Sovereign',
    rarity: 'legend',
    lore: 'He signed a contract with himself, and has been winning it ever since.',
    hp: 1350, atk: 355, weight: 1.4, radius: 75,
    ability: {
      id: 'burn', name: 'Inferno Brand', jp: '業火', trigger: 'onFirstHit',
      desc: 'Brands the target with hellfire: 160 damage at the start of each of the next 3 turns, then a 260 damage detonation.',
      turns: 3, tick: 160, blast: 260, blastRadius: 240,
    },
    art: {
      skin: '#d97a7a', hair: '#2b1030', hair2: '#7a2050', hairStyle: 'wild',
      eye: '#ff3b3b', outfit: '#1b0f2e', outfit2: '#ff5a3c', accent: '#ff3b3b',
      weapon: 'scythe', aura: '#ff3b3b', expression: 'angry', horns: true, wings: true, big: true,
    },
  },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

// Token radii are authored large on purpose: a hero has to be a comfortable
// thumb target on a phone-sized arena.
export function heroStats(heroId, level) {
  const h = HERO_BY_ID[heroId];
  const s = levelScale(level);
  return {
    hp: Math.round(h.hp * s),
    atk: Math.round(h.atk * s),
    weight: h.weight,
    radius: h.radius,
  };
}

export function heroPower(heroId, level) {
  const h = HERO_BY_ID[heroId];
  const s = heroStats(heroId, level);
  return Math.round((s.hp / 12 + s.atk / 3) * RARITY[h.rarity].power);
}

export function cardsForNextLevel(rarity, level) {
  const table = CARD_COST[rarity];
  return level >= MAX_LEVEL ? Infinity : table[Math.min(level - 1, table.length - 1)];
}
export function goldForNextLevel(level) {
  return level >= MAX_LEVEL ? Infinity : GOLD_COST[Math.min(level - 1, GOLD_COST.length - 1)];
}
