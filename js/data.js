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
  { id: 'potato',     name: 'Potato',     icon: '🥔', level: 5,  seed: 22,  grow: 240,  price: 62,   xp: 5 },
  { id: 'eggplant',   name: 'Eggplant',   icon: '🍆', level: 9,  seed: 44,  grow: 720,  price: 142,  xp: 10 },
  { id: 'sunflower',  name: 'Sunflower',  icon: '🌻', level: 12, seed: 70,  grow: 1200, price: 225,  xp: 15 },
  { id: 'melon',      name: 'Watermelon', icon: '🍉', level: 16, seed: 130, grow: 2400, price: 435,  xp: 26 },
  { id: 'beans',      name: 'Coffee',     icon: '🫘', level: 24, seed: 260, grow: 4200, price: 830,  xp: 42 },
];

/** Seed racks are shown in unlock order, not the order they were written. */
CROPS.sort((a, b) => a.level - b.level || a.seed - b.seed);

/** Animals live in pens, eat FEED, and drop goods into the BARN. */
export const ANIMALS = [
  { id: 'chicken', name: 'Chicken', icon: '🐔', level: 3,  cost: 200,   max: 8, feed: 1, cycle: 180,  product: 'egg' },
  { id: 'cow',     name: 'Cow',     icon: '🐄', level: 6,  cost: 900,   max: 6, feed: 2, cycle: 360,  product: 'milk' },
  { id: 'pig',     name: 'Pig',     icon: '🐖', level: 12, cost: 2500,  max: 6, feed: 3, cycle: 720,  product: 'bacon' },
  { id: 'sheep',   name: 'Sheep',   name2: 'Sheep', icon: '🐑', level: 16, cost: 6000,  max: 5, feed: 4, cycle: 1200, product: 'wool' },
  { id: 'bee',     name: 'Bee Hive',name2: 'Hives', icon: '🐝', level: 20, cost: 14000, max: 4, feed: 2, cycle: 1800, product: 'honey' },
  { id: 'duck',    name: 'Duck',    icon: '🦆', level: 5,  cost: 450,   max: 6, feed: 1, cycle: 240,  product: 'feather' },
  { id: 'goat',    name: 'Goat',    icon: '🐐', level: 14, cost: 4200,  max: 5, feed: 3, cycle: 900,  product: 'goatmilk' },
];
ANIMALS.sort((a, b) => a.level - b.level);

/** Goods produced by animals. Stored in the BARN. */
export const ANIMAL_GOODS = [
  { id: 'egg',   name: 'Egg',   icon: '🥚', price: 30,  xp: 3 },
  { id: 'milk',  name: 'Milk',  icon: '🥛', price: 70,  xp: 6 },
  { id: 'bacon', name: 'Bacon', icon: '🥓', price: 140, xp: 11 },
  { id: 'wool',  name: 'Wool',  icon: '🧶', price: 240, xp: 18 },
  { id: 'honey', name: 'Honey', icon: '🍯', price: 400, xp: 28 },
  { id: 'feather',  name: 'Down',      icon: '🪶', price: 50,  xp: 4 },
  { id: 'goatmilk', name: 'Goat Milk', icon: '🍶', price: 195, xp: 15 },
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
  { id: 'fryer',   name: 'Fry Shack',   icon: '🍟', level: 7,  cost: 2200 },
  { id: 'press',   name: 'Oil Press',   icon: '🫗', level: 13, cost: 13000 },
  { id: 'sweets',  name: 'Sweet Shop',  icon: '🍬', level: 18, cost: 42000 },
  { id: 'cafe',    name: 'Cafe',        icon: '☕', level: 26, cost: 480000 },
];
MACHINES.sort((a, b) => a.level - b.level);

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
  { id: 'fries',   machine: 'fryer',  level: 7,  time: 120, out: 'fries',   qty: 1, in: { potato: 3 } },
  { id: 'omelette',machine: 'fryer',  level: 10, time: 200, out: 'omelette',qty: 1, in: { egg: 2, eggplant: 1 } },
  { id: 'oil',     machine: 'press',  level: 13, time: 240, out: 'oil',     qty: 1, in: { sunflower: 3 } },
  { id: 'gcheese', machine: 'dairy',  level: 15, time: 260, out: 'gcheese', qty: 1, in: { goatmilk: 3 } },
  { id: 'candy',   machine: 'sweets', level: 18, time: 360, out: 'candy',   qty: 1, in: { melon: 2, honey: 1 } },
  { id: 'stew',    machine: 'grill',  level: 20, time: 540, out: 'stew',    qty: 1, in: { potato: 2, bacon: 1, eggplant: 1 } },
  { id: 'quilt',   machine: 'loom',   level: 23, time: 780, out: 'quilt',   qty: 1, in: { feather: 3, wool: 1 } },
  { id: 'espresso',machine: 'cafe',   level: 26, time: 900, out: 'espresso',qty: 1, in: { beans: 3 } },
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
  { id: 'fries',    name: 'Fries',         icon: '🍟', price: 215,  xp: 17 },
  { id: 'omelette', name: 'Omelette',      icon: '🍳', price: 330,  xp: 25 },
  { id: 'oil',      name: 'Sunflower Oil', icon: '🫗', price: 770,  xp: 47 },
  { id: 'gcheese',  name: 'Goat Cheese',   icon: '🧆', price: 690,  xp: 43 },
  { id: 'candy',    name: 'Melon Candy',   icon: '🍬', price: 1180, xp: 68 },
  { id: 'stew',     name: 'Farm Stew',     icon: '🍲', price: 1450, xp: 82 },
  { id: 'quilt',    name: 'Down Quilt',    icon: '🛏️', price: 1850, xp: 104 },
  { id: 'espresso', name: 'Espresso',      icon: '☕', price: 2550, xp: 132 },
];

/** One flat lookup for anything that can sit in storage or fill an order. */
export const ITEMS = {};
for (const c of CROPS)         ITEMS[c.id] = { ...c, kind: 'crop' };
for (const g of ANIMAL_GOODS)  ITEMS[g.id] = { ...g, kind: 'good', level: (ANIMALS.find(a => a.product === g.id) || {}).level || 1 };
for (const g of CRAFTED)       ITEMS[g.id] = { ...g, kind: 'good', level: (RECIPES.find(r => r.out === g.id) || {}).level || 1 };

/**
 * Timed boosts, bought over and over. These are the profit levers: buying a
 * Market Day before dumping a full silo is meant to be the smart play.
 * `effect` is what the rest of the game multiplies by.
 */
export const BOOSTS = [
  { id: 'coffee', name: 'Farmhand Coffee', icon: '☕', effect: 'grow',   mult: 2,
    mins: 30, coins: 2500,  level: 3,
    desc: 'Crops ripen twice as fast for 30 minutes.' },
  { id: 'market', name: 'Market Day',      icon: '💰', effect: 'sell',   mult: 1.5,
    mins: 20, coins: 5000,  level: 5,
    desc: 'Everything sells for +50% for 20 minutes.' },
  { id: 'feast',  name: 'Feed Frenzy',     icon: '🌟', effect: 'animal', mult: 2,
    mins: 30, coins: 7500,  level: 7,
    desc: 'Animals produce twice as fast for 30 minutes.' },
  { id: 'rush',   name: 'Rush Order',      icon: '⚡', effect: 'craft',  mult: 2,
    mins: 30, coins: 12000, level: 9,
    desc: 'Workshops craft twice as fast for 30 minutes.' },
  { id: 'school', name: 'Farm School',     icon: '📘', effect: 'xp',     mult: 2,
    mins: 30, gems: 6,      level: 6,
    desc: 'Double XP from everything for 30 minutes.' },
  { id: 'clover', name: 'Lucky Clover',    icon: '🍀', effect: 'order',  mult: 1.5,
    mins: 20, gems: 8,      level: 8,
    desc: 'Order payouts +50% for 20 minutes.' },
];

/** Permanent upgrades — the "game gets easier as you go" track. */
export const UPGRADES = [
  { id: 'wateringCan', name: 'Watering Can',  icon: '🪣', level: 5,  cost: 600,    desc: 'Crops grow 10% faster.' },
  { id: 'autoFeeder',  name: 'Rich Pasture',  icon: '🌱', level: 9,  cost: 4000,   desc: 'Grass grows back twice as fast, so the trough fills itself quicker.' },
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

/* -------------------------------- goals ---------------------------------- */

/** Tiered goals, each tier claimed once. `stat` reads off S.stats (or level). */
export const GOALS = [
  { id: 'harvest', name: 'Green Thumb',  icon: '🧺', stat: 'harvested', unit: 'crops harvested',  tiers: [50, 300, 1500, 8000] },
  { id: 'collect', name: 'Rancher',      icon: '🥚', stat: 'collected', unit: 'goods collected',  tiers: [25, 150, 700, 3000] },
  { id: 'craft',   name: 'Artisan',      icon: '🏭', stat: 'crafted',   unit: 'goods crafted',    tiers: [20, 120, 600, 2500] },
  { id: 'orders',  name: 'Shipper',      icon: '🚚', stat: 'orders',    unit: 'orders delivered', tiers: [10, 60, 250, 1000] },
  { id: 'earn',    name: 'Merchant',     icon: '🪙', stat: 'earned',    unit: 'coins earned',     tiers: [2000, 50000, 500000, 5000000] },
  { id: 'level',   name: 'Homesteader',  icon: '⭐', stat: 'level',     unit: 'farm level',       tiers: [5, 12, 20, 30] },
];

export const GOAL_RANKS = ['Bronze', 'Silver', 'Gold', 'Legend'];

export function goalReward(tier) {
  return { coins: Math.round(400 * Math.pow(4, tier)), gems: tier + 1 };
}

/* ------------------------------ market prices ---------------------------- */

/**
 * Every good's price drifts on its own slow cycle. It's a pure function of the
 * clock, so nothing has to be stored and every device agrees on the price.
 * Range is roughly 0.70x to 1.30x.
 */
export function marketMult(id, t = Date.now()) {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  const phase = (h / 9973) * Math.PI * 2;
  return 1 + 0.22 * Math.sin(phase + t / 900000) + 0.08 * Math.sin(phase * 3 + t / 300000);
}

/* ------------------------------ the trough ------------------------------- */

/**
 * Animals eat from one shared trough and feed themselves — no tapping, and no
 * turning your fields over to growing animal feed. The trough fills three
 * ways, cheapest last:
 *   grazing   free, slow, and capped part-way up, so you always trickle along
 *   hay bale  coins, instant, the "I'd rather spend money than fields" option
 *   feed mill wheat + corn, best value per unit, entirely optional
 */
export const TROUGH_CAP = 80;
export const GRAZE_SECONDS = 40;        // one unit of pasture per this many seconds
export const GRAZE_CEILING = 0.6;       // grazing alone tops out here
export const HAY = { units: 20, coins: 240 };
export const MILL_UNITS = 6;            // what one Feed Mill job pours in

/* --------------------------- the harvest festival ------------------------ */

/**
 * A festival is always running: the clock is cut into fixed cycles, and each
 * one gives you a fresh points bar with three milestones. Nothing is gated
 * behind waiting, and points come from ordinary play, so it rewards a session
 * rather than demanding one.
 */
export const FEST_HOURS = 6;
export const FEST_MS = FEST_HOURS * 3600 * 1000;

/** Points earned by simply playing. */
export const FEST_POINTS = { harvest: 1, collect: 2, craft: 4, order: 15 };

export const FEST_TIERS = [
  { at: 40,  name: 'Warm-Up',   icon: '🎪' },
  { at: 120, name: 'Main Stage', icon: '🎠' },
  { at: 300, name: 'Grand Prize', icon: '🎡' },
];

/** Which festival we're in — changes on its own every FEST_HOURS. */
export const festCycle = (t = Date.now()) => Math.floor(t / FEST_MS);
export const festEndsAt = (t = Date.now()) => (festCycle(t) + 1) * FEST_MS;

/** Rewards scale with level so the prize stays worth chasing. */
export function festReward(tier, level) {
  const mult = [1, 3, 9][tier];
  return {
    coins: Math.round(1200 * mult * Math.max(1, level) / 2),
    gems: [3, 6, 15][tier],
    xp: Math.round(D_xpHint(level) * [0.15, 0.35, 0.9][tier]),
  };
}

/** A slice of the current level's XP bar, so the prize always feels like progress. */
function D_xpHint(level) {
  return xpToNext(Math.max(1, level));
}

/* ------------------------------ daily bonus ------------------------------ */

export const DAILY_MAX_STREAK = 7;

export function dailyReward(streak, level) {
  const n = Math.min(streak, DAILY_MAX_STREAK);
  return { coins: 150 * level * n, gems: n >= DAILY_MAX_STREAK ? 5 : n >= 4 ? 2 : 1 };
}

/** Local calendar day, so the bonus lands at midnight where the player is. */
export function today(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

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
