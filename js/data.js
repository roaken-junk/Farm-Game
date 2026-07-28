/* ==========================================================================
   data.js — all game content: crops, animals, machines, recipes, upgrades.
   Tuned so early levels move fast (seconds) and later tiers reward planning.
   ========================================================================== */

/** Crops live in the SILO. Grow time in seconds. */
export const CROPS = [
  { id: 'wheat',      name: 'Wheat',      icon: '🌾', level: 1,  seed: 3,   grow: 25,   price: 9,    xp: 1 },
  { id: 'corn',       name: 'Corn',       icon: '🌽', level: 2,  seed: 8,   grow: 70,   price: 22,   xp: 2 },
  { id: 'carrot',     name: 'Carrot',     icon: '🥕', level: 4,  seed: 16,  grow: 180,  price: 48,   xp: 4 },
  { id: 'tomato',     name: 'Tomato',     icon: '🍅', level: 7,  seed: 30,  grow: 420,  price: 92,   xp: 7 },
  { id: 'strawberry', name: 'Strawberry', icon: '🍓', level: 10, seed: 55,  grow: 900,  price: 175,  xp: 12 },
  { id: 'pumpkin',    name: 'Pumpkin',    icon: '🎃', level: 14, seed: 100, grow: 1800, price: 330,  xp: 20 },
  { id: 'grape',      name: 'Grapes',     icon: '🍇', level: 18, seed: 180, grow: 3000, price: 580,  xp: 32 },
  { id: 'chili',      name: 'Chili',      icon: '🌶️', level: 22, seed: 320, grow: 5400, price: 1050, xp: 50 },
];

/** Animals live in pens, eat FEED, and drop goods into the BARN. */
export const ANIMALS = [
  { id: 'chicken', name: 'Chicken', icon: '🐔', level: 3,  cost: 200,   max: 8, feed: 1, cycle: 180,  product: 'egg' },
  { id: 'cow',     name: 'Cow',     icon: '🐄', level: 6,  cost: 900,   max: 6, feed: 2, cycle: 360,  product: 'milk' },
  { id: 'pig',     name: 'Pig',     icon: '🐖', level: 12, cost: 2500,  max: 6, feed: 3, cycle: 720,  product: 'bacon' },
  { id: 'sheep',   name: 'Sheep',   name2: 'Sheep', icon: '🐑', level: 16, cost: 6000,  max: 5, feed: 4, cycle: 1200, product: 'wool' },
  { id: 'bee',     name: 'Bee Hive',name2: 'Hives', icon: '🐝', level: 20, cost: 14000, max: 4, feed: 2, cycle: 1800, product: 'honey' },
];

/** Goods produced by animals. Stored in the BARN. */
export const ANIMAL_GOODS = [
  { id: 'egg',   name: 'Egg',   icon: '🥚', price: 30,  xp: 3 },
  { id: 'milk',  name: 'Milk',  icon: '🥛', price: 70,  xp: 6 },
  { id: 'bacon', name: 'Bacon', icon: '🥓', price: 140, xp: 11 },
  { id: 'wool',  name: 'Wool',  icon: '🧶', price: 240, xp: 18 },
  { id: 'honey', name: 'Honey', icon: '🍯', price: 400, xp: 28 },
];

/** Crafting stations. Jobs run one after another in a shared queue. */
export const MACHINES = [
  { id: 'mill',    name: 'Feed Mill',   icon: '🏚️', level: 3,  cost: 0 },
  { id: 'bakery',  name: 'Bakery',      icon: '🥐', level: 5,  cost: 800 },
  { id: 'dairy',   name: 'Dairy',       icon: '🧈', level: 8,  cost: 3000 },
  { id: 'juice',   name: 'Juice Press', icon: '🧃', level: 11, cost: 8000 },
  { id: 'jam',     name: 'Jam Kitchen', icon: '🫙', level: 15, cost: 20000 },
  { id: 'grill',   name: 'BBQ Grill',   icon: '🍗', level: 19, cost: 60000 },
  { id: 'loom',    name: 'Textile Mill',icon: '🧵', level: 23, cost: 150000 },
  { id: 'winery',  name: 'Winery',      icon: '🍷', level: 25, cost: 320000 },
];

/** Recipes: `in` = {itemId: qty}, output is 1 of `out` (or `qty`). */
export const RECIPES = [
  { id: 'feed',    machine: 'mill',   level: 3,  time: 20,  out: 'feed',    qty: 2, in: { wheat: 2, corn: 1 } },
  { id: 'bread',   machine: 'bakery', level: 5,  time: 45,  out: 'bread',   qty: 1, in: { wheat: 3 } },
  { id: 'cookie',  machine: 'bakery', level: 9,  time: 120, out: 'cookie',  qty: 1, in: { wheat: 2, egg: 1 } },
  { id: 'butter',  machine: 'dairy',  level: 8,  time: 100, out: 'butter',  qty: 1, in: { milk: 2 } },
  { id: 'cheese',  machine: 'dairy',  level: 10, time: 180, out: 'cheese',  qty: 1, in: { milk: 3 } },
  { id: 'cjuice',  machine: 'juice',  level: 11, time: 150, out: 'cjuice',  qty: 1, in: { carrot: 3 } },
  { id: 'tjuice',  machine: 'juice',  level: 13, time: 240, out: 'tjuice',  qty: 1, in: { tomato: 3 } },
  { id: 'jam',     machine: 'jam',    level: 15, time: 300, out: 'jam',     qty: 1, in: { strawberry: 3 } },
  { id: 'pie',     machine: 'jam',    level: 16, time: 420, out: 'pie',     qty: 1, in: { pumpkin: 2, wheat: 2 } },
  { id: 'ribs',    machine: 'grill',  level: 19, time: 480, out: 'ribs',    qty: 1, in: { bacon: 2, corn: 2 } },
  { id: 'burger',  machine: 'grill',  level: 21, time: 600, out: 'burger',  qty: 1, in: { bacon: 1, bread: 1, cheese: 1 } },
  { id: 'sweater', machine: 'loom',   level: 23, time: 900, out: 'sweater', qty: 1, in: { wool: 3 } },
  { id: 'hotsauce',machine: 'loom',   level: 24, time: 720, out: 'hotsauce',qty: 1, in: { chili: 2, tomato: 2 } },
  { id: 'wine',    machine: 'winery', level: 25, time: 1200,out: 'wine',    qty: 1, in: { grape: 3 } },
];

/** Crafted goods. Stored in the BARN. */
export const CRAFTED = [
  { id: 'feed',     name: 'Feed',          icon: '🌰', price: 6,    xp: 1 },
  { id: 'bread',    name: 'Bread',         icon: '🍞', price: 60,   xp: 6 },
  { id: 'cookie',   name: 'Cookies',       icon: '🍪', price: 185,  xp: 15 },
  { id: 'butter',   name: 'Butter',        icon: '🧈', price: 190,  xp: 15 },
  { id: 'cheese',   name: 'Cheese',        icon: '🧀', price: 320,  xp: 24 },
  { id: 'cjuice',   name: 'Carrot Juice',  icon: '🥤', price: 250,  xp: 19 },
  { id: 'tjuice',   name: 'Tomato Juice',  icon: '🧃', price: 430,  xp: 31 },
  { id: 'jam',      name: 'Berry Jam',     icon: '🫙', price: 780,  xp: 48 },
  { id: 'pie',      name: 'Pumpkin Pie',   icon: '🥧', price: 1150, xp: 66 },
  { id: 'ribs',     name: 'BBQ Ribs',      icon: '🍖', price: 1250, xp: 72 },
  { id: 'burger',   name: 'Farm Burger',   icon: '🍔', price: 2300, xp: 120 },
  { id: 'sweater',  name: 'Wool Sweater',  icon: '🧥', price: 1600, xp: 92 },
  { id: 'hotsauce', name: 'Hot Sauce',     icon: '🌶️', price: 1900, xp: 105 },
  { id: 'wine',     name: 'Grape Wine',    icon: '🍷', price: 2700, xp: 140 },
];

/** One flat lookup for anything that can sit in storage or fill an order. */
export const ITEMS = {};
for (const c of CROPS)         ITEMS[c.id] = { ...c, kind: 'crop' };
for (const g of ANIMAL_GOODS)  ITEMS[g.id] = { ...g, kind: 'good', level: (ANIMALS.find(a => a.product === g.id) || {}).level || 1 };
for (const g of CRAFTED)       ITEMS[g.id] = { ...g, kind: 'good', level: (RECIPES.find(r => r.out === g.id) || {}).level || 1 };

/** Permanent upgrades — the "game gets easier as you go" track. */
export const UPGRADES = [
  { id: 'wateringCan', name: 'Watering Can',  icon: '🪣', level: 5,  cost: 600,    desc: 'Crops grow 10% faster.' },
  { id: 'autoFeeder',  name: 'Auto Feeder',   icon: '🥫', level: 9,  cost: 4000,   desc: 'Animals feed themselves whenever feed is in the barn.' },
  { id: 'sprinkler',   name: 'Sprinkler Rig', icon: '💦', level: 12, cost: 18000,  desc: 'Another 20% off every crop timer.' },
  { id: 'scythe',      name: 'Golden Scythe', icon: '🪄', level: 15, cost: 45000,  desc: 'Everything you sell is worth 25% more.' },
  { id: 'truck',       name: 'Delivery Truck',icon: '🚚', level: 17, cost: 90000,  desc: 'Order payouts +30%, and orders refresh twice as fast.' },
  { id: 'tractor',     name: 'Tractor',       icon: '🚜', level: 20, cost: 160000, desc: 'Plant All fills every empty plot in one tap, free of charge.' },
  { id: 'foreman',     name: 'Farm Foreman',  icon: '🧑‍🔧', level: 24, cost: 400000, desc: 'Craft queues hold 3 more jobs and run 20% faster.' },
  { id: 'combine',     name: 'Combine',       icon: '🌾', level: 27, cost: 900000, desc: 'Ripe crops harvest themselves while you play.' },
];

/** Farmer titles, unlocked purely by level. */
export const TITLES = [
  { level: 1,  name: 'Sprout' },
  { level: 4,  name: 'Field Hand' },
  { level: 8,  name: 'Homesteader' },
  { level: 12, name: 'Rancher' },
  { level: 16, name: 'Master Grower' },
  { level: 20, name: 'Estate Owner' },
  { level: 25, name: 'Agri-Baron' },
  { level: 30, name: 'Farm Legend' },
];

export const AVATARS = ['🧑‍🌾', '👩‍🌾', '👨‍🌾', '🧔', '👵', '🤠', '🧙', '🐸'];

/* ------------------------------- economy -------------------------------- */

/** Every harvested field yields this many crops. */
export const CROP_YIELD = 2;
export const ORDER_REFRESH = 300;

export const START_PLOTS = 6;
export const MAX_PLOTS = 24;
export const START_SILO = 60;
export const START_BARN = 40;
export const BASE_QUEUE = 3;
export const ORDER_SLOTS = 3;

/** XP required to go from `level` to `level + 1`. */
export function xpToNext(level) {
  return Math.floor(55 * Math.pow(level, 1.55));
}

/** Coin price of the next field, and the level needed to buy it. */
export function plotCost(owned) {
  return Math.floor(180 * Math.pow(1.52, owned - START_PLOTS));
}
export function plotLevel(owned) {
  return 3 + (owned - START_PLOTS) * 2;
}

export function siloUpgradeCost(cap) {
  return Math.floor(120 * Math.pow(1.42, (cap - START_SILO) / 25));
}
export function barnUpgradeCost(cap) {
  return Math.floor(160 * Math.pow(1.42, (cap - START_BARN) / 15));
}

export const SILO_STEP = 25;
export const BARN_STEP = 15;

/** Gems asked for skipping `sec` of waiting — same curve the big titles use. */
export function speedUpCost(sec) {
  return Math.max(1, Math.ceil(sec / 90));
}

export function titleFor(level) {
  let t = TITLES[0];
  for (const x of TITLES) if (level >= x.level) t = x;
  return t.name;
}

export function recipesFor(machineId) {
  return RECIPES.filter(r => r.machine === machineId);
}
