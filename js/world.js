/* ==========================================================================
   world.js — the farm as a walkable tile map: layout, collision, what sits
   on any given tile, and a path finder for tap-to-walk.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as GFX from './gfx.js';

export const MAP_W = 24, MAP_H = 22;

/** The 6x4 block of fields — exactly D.MAX_PLOTS tiles. */
export const FIELD = { x: 9, y: 3, cols: 6, rows: 4 };

export const BUILDINGS = [
  { id: 'home',  x: 2,  y: 2,  w: 3, h: 3, name: 'HOME' },
  { id: 'silo',  x: 2,  y: 8,  w: 3, h: 3, name: 'SILO' },
  { id: 'barn',  x: 2,  y: 13, w: 3, h: 3, name: 'BARN' },
  { id: 'works', x: 2,  y: 17, w: 3, h: 3, name: 'WORKS' },
  { id: 'store', x: 19, y: 2,  w: 3, h: 3, name: 'STORE' },
];

/** A 1x1 signpost rather than a building. */
export const BOARD = { x: 7, y: 10, name: 'ORDERS' };

/** Pens are walkable; animals stand on them and never block. */
export const PENS = {
  chicken: { x: 17, y: 7,  w: 4, h: 2 },
  cow:     { x: 17, y: 11, w: 3, h: 2 },
  pig:     { x: 17, y: 15, w: 3, h: 2 },
  sheep:   { x: 21, y: 7,  w: 2, h: 3 },
  bee:     { x: 21, y: 11, w: 2, h: 2 },
};

export const terrain = [];
const solid = [];

const idx = (x, y) => y * MAP_W + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

export function buildMap() {
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    terrain[idx(x, y)] = GFX.T_GRASS;
    solid[idx(x, y)] = 0;
  }

  const put = (x, y, t, block) => {
    if (!inBounds(x, y)) return;
    terrain[idx(x, y)] = t;
    solid[idx(x, y)] = block ? 1 : 0;
  };

  // Tree line around the whole farm.
  for (let x = 0; x < MAP_W; x++) { put(x, 0, GFX.T_TREE, 1); put(x, MAP_H - 1, GFX.T_TREE, 1); }
  for (let y = 0; y < MAP_H; y++) { put(0, y, GFX.T_TREE, 1); put(MAP_W - 1, y, GFX.T_TREE, 1); }

  // A path spine down the middle with spurs to every door.
  for (let y = 1; y < MAP_H - 1; y++) put(6, y, GFX.T_PATH, 0);
  for (const b of BUILDINGS) {
    const doorY = b.y + b.h;                       // the tile in front of the door
    const dx = b.x + (b.w >> 1);
    if (!inBounds(dx, doorY)) continue;
    put(dx, doorY, GFX.T_PATH, 0);
    const [from, to] = dx < 6 ? [dx, 6] : [6, dx];
    for (let x = from; x <= to; x++) put(x, doorY, GFX.T_PATH, 0);
  }
  for (let x = 6; x <= FIELD.x; x++) put(x, FIELD.y + FIELD.rows, GFX.T_PATH, 0);
  for (let x = FIELD.x; x <= 22; x++) put(x, FIELD.y + FIELD.rows, GFX.T_PATH, 0);

  // Fields.
  for (let r = 0; r < FIELD.rows; r++) for (let c = 0; c < FIELD.cols; c++) {
    put(FIELD.x + c, FIELD.y + r, GFX.T_SOIL, 0);
  }

  // Pens.
  for (const p of Object.values(PENS)) {
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) put(p.x + x, p.y + y, GFX.T_PEN, 0);
  }

  // Buildings: a roof course on top, plank walls below, windows either side of
  // the door. Solid throughout — you interact by facing them.
  for (const b of BUILDINGS) {
    const mid = b.w >> 1;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      let t = GFX.T_WALL;
      if (y === 0) t = GFX.T_ROOF;
      else if (y === b.h - 1 && x === mid) t = GFX.T_DOOR;
      else if (y === b.h - 1) t = GFX.T_WINDOW;
      put(b.x + x, b.y + y, t, 1);
    }
  }

  put(BOARD.x, BOARD.y, GFX.T_FENCE, 1);          // the order board post

  // A pond and a few trees so the place doesn't read as a spreadsheet.
  for (const [x, y] of [[15, 19], [16, 19], [15, 20], [16, 20]]) put(x, y, GFX.T_WATER, 1);
  for (const [x, y] of [[8, 1], [16, 1], [11, 20], [3, 6], [22, 19], [12, 9], [19, 19]]) {
    put(x, y, GFX.T_TREE, 1);
  }
}

export const isSolid = (x, y) => !inBounds(x, y) || solid[idx(x, y)] === 1;

/* --------------------------- what's on a tile ---------------------------- */

/** Plot index at this tile, or -1. Only bought fields count. */
export function plotAt(x, y) {
  const c = x - FIELD.x, r = y - FIELD.y;
  if (c < 0 || r < 0 || c >= FIELD.cols || r >= FIELD.rows) return -1;
  const i = r * FIELD.cols + c;
  return i < St.S.plots.length ? i : -1;
}

/** True for a field tile you have not cleared yet. */
export function lockedPlotAt(x, y) {
  const c = x - FIELD.x, r = y - FIELD.y;
  if (c < 0 || r < 0 || c >= FIELD.cols || r >= FIELD.rows) return false;
  return r * FIELD.cols + c >= St.S.plots.length;
}

/** {type, slot} for a pen tile, else null. */
export function penAt(x, y) {
  for (const [type, p] of Object.entries(PENS)) {
    if (x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h) {
      return { type, slot: (y - p.y) * p.w + (x - p.x) };
    }
  }
  return null;
}

/** Tile position of animal `slot` in its pen. */
export function penSlotPos(type, slot) {
  const p = PENS[type];
  return { x: p.x + (slot % p.w), y: p.y + Math.floor(slot / p.w) };
}

export function buildingAt(x, y) {
  return BUILDINGS.find(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) || null;
}

export const isBoard = (x, y) => x === BOARD.x && y === BOARD.y;

/* ------------------------------ pathfinding ------------------------------ */

/**
 * Breadth-first walk from (sx,sy) to (tx,ty) over walkable tiles.
 * Returns a list of steps, or null when there's no route.
 */
export function findPath(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  if (isSolid(tx, ty)) return null;
  const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
  const seen = new Uint8Array(MAP_W * MAP_H);
  const q = [idx(sx, sy)];
  seen[idx(sx, sy)] = 1;
  const goal = idx(tx, ty);

  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    if (cur === goal) {
      const steps = [];
      for (let n = goal; n !== idx(sx, sy); n = prev[n]) {
        steps.push({ x: n % MAP_W, y: Math.floor(n / MAP_W) });
      }
      return steps.reverse();
    }
    const cx = cur % MAP_W, cy = Math.floor(cur / MAP_W);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = cx + dx, ny = cy + dy;
      if (isSolid(nx, ny)) continue;
      const n = idx(nx, ny);
      if (seen[n]) continue;
      seen[n] = 1;
      prev[n] = cur;
      q.push(n);
    }
  }
  return null;
}

/** Nearest walkable tile next to a solid target, so taps on buildings work. */
export function approach(sx, sy, tx, ty) {
  let best = null, bestLen = Infinity;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const p = findPath(sx, sy, tx + dx, ty + dy);
    if (p && p.length < bestLen) { best = p; bestLen = p.length; }
  }
  return best;
}

/* ------------------------------ decoration ------------------------------- */

/** Sprite to draw on a field tile, or null for bare soil. */
export function plotSprite(i) {
  const p = St.S.plots[i];
  if (!p) return null;
  const crop = D.ITEMS[p.crop];
  const t = Math.min(1, (Date.now() - p.at) / Math.max(1, p.end - p.at));
  return { icon: crop.icon, stage: t >= 1 ? 2 : t > 0.45 ? 1 : 0 };
}
