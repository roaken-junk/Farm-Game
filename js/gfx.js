/* ==========================================================================
   gfx.js — the Game Boy layer: 4-shade palette, a 5x7 bitmap font, the farmer
   sprite, procedural terrain tiles, and a baker that turns an emoji into a
   4-colour sprite so every crop and good gets art without hand-pixelling 30
   icons.
   ========================================================================== */

/** Original DMG panel, darkest to lightest. Index into this everywhere. */
export const PAL = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
export const DARK = 0, MID = 1, LITE = 2, PALE = 3;

export const TILE = 16;
export const SCREEN_W = 160;
export const SCREEN_H = 144;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = false;
  return c;
}

/* --------------------------------- font ---------------------------------- */
/* 5 wide, 7 tall, one string per row. Uppercase only — Gen 1 item and place
   names were all caps, and it halves the glyph count. */

const G = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#...#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '#####/...#./..#../...#./....#/#...#/.###.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '..##./.#.../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/...#./.##..',
  ' ': '...../...../...../...../...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../.##../.#...',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  ':': '...../.##../.##../...../.##../.##../.....',
  '-': '...../...../...../#####/...../...../.....',
  "'": '..#../..#../...../...../...../...../.....',
  '/': '....#/...#./..#../..#../.#.../#..../.....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '*': '...../#...#/.#.#./..#../.#.#./#...#/.....',
  '%': '#...#/...#./..#../..#../.#.../#...#/.....',
  '=': '...../...../#####/...../#####/...../.....',
  // pictograms
  '$': '...../.###./#.#.#/#.#.#/#.#.#/.###./.....',   // coin
  '@': '...../..#../.###./#####/.###./..#../.....',   // gem
  '>': '#..../##.../###../####./###../##.../#....',   // menu cursor
  '^': '..#../.###./#####/...../...../...../.....',
  'v': '...../...../...../#####/.###./..#../.....',
  '~': '...../.#.#./#####/#####/.###./..#../.....',   // heart
};

export const CHAR_W = 6, CHAR_H = 7, LINE_H = 9;

const glyphCache = new Map();

function glyph(ch, shade) {
  const key = ch + shade;
  let c = glyphCache.get(key);
  if (c) return c;
  const rows = (G[ch] || G[' ']).split('/');
  c = makeCanvas(5, 7);
  const x = c.getContext('2d');
  x.fillStyle = PAL[shade];
  rows.forEach((row, y) => {
    for (let i = 0; i < 5; i++) if (row[i] === '#') x.fillRect(i, y, 1, 1);
  });
  glyphCache.set(key, c);
  return c;
}

export function textWidth(str) {
  return String(str).length * CHAR_W - 1;
}

export function drawText(ctx, str, x, y, shade = DARK) {
  str = String(str).toUpperCase();
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch !== ' ') ctx.drawImage(glyph(G[ch] !== undefined ? ch : ' ', shade), x + i * CHAR_W, y);
  }
}

/** Word-wraps to `cols` characters. Returns the lines. */
export function wrapText(str, cols) {
  const words = String(str).toUpperCase().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if ((line + ' ' + w).length <= cols) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/* ------------------------------ emoji baker ------------------------------ */

const bakeCache = new Map();

/**
 * Renders an emoji at `size`, then posterises it into the 4 shades. Every
 * edge pixel is forced to the darkest shade: that outline is what makes a
 * 4-colour sprite legible against the pale background.
 */
export function bake(emoji, size = 16) {
  const key = emoji + size;
  let cached = bakeCache.get(key);
  if (cached) return cached;

  const src = makeCanvas(size, size);
  const sx = src.getContext('2d');
  sx.font = `${size - 1}px serif`;
  sx.textAlign = 'center';
  sx.textBaseline = 'middle';
  sx.fillText(emoji, size / 2, size / 2 + 1);

  const d = sx.getImageData(0, 0, size, size).data;
  const on = new Uint8Array(size * size);
  const lum = new Float32Array(size * size);
  let lo = 1, hi = 0;
  for (let k = 0; k < size * size; k++) {
    if (d[k * 4 + 3] < 110) continue;
    on[k] = 1;
    const l = (d[k * 4] * 0.299 + d[k * 4 + 1] * 0.587 + d[k * 4 + 2] * 0.114) / 255;
    lum[k] = l;
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  const span = Math.max(0.001, hi - lo);

  const out = makeCanvas(size, size);
  const ox = out.getContext('2d');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = y * size + x;
    if (!on[k]) continue;
    const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1 ||
      !on[k - 1] || !on[k + 1] || !on[k - size] || !on[k + size];
    let shade;
    if (edge) shade = DARK;
    else {
      const n = (lum[k] - lo) / span;
      shade = n > 0.85 ? PALE : n > 0.5 ? LITE : MID;
    }
    ox.fillStyle = PAL[shade];
    ox.fillRect(x, y, 1, 1);
  }
  bakeCache.set(key, out);
  return out;
}

/* ----------------------------- farmer sprite ----------------------------- */
/* Digits are shade indices, '.' is transparent. Rows 0-11 are the body; the
   legs come from LEGS so both walk frames share one definition. */

const BODY = {
  down: [
    '.....000000.....',
    '....03333330....',
    '..000333333000..',
    '..03333333330...',
    '...0333333330...',
    '...0303333030...',
    '...0333333330...',
    '....03333330....',
    '..001111111100..',
    '.00111111111100.',
    '.00111111111100.',
    '.00000000000000.',
  ],
  up: [
    '.....000000.....',
    '....03333330....',
    '..000333333000..',
    '..03333333330...',
    '...0333333330...',
    '...0333333330...',
    '...0333333330...',
    '....03333330....',
    '..001111111100..',
    '.00111111111100.',
    '.00111111111100.',
    '.00000000000000.',
  ],
  side: [
    '.....000000.....',
    '....03333330....',
    '...00333333000..',
    '...03333333330..',
    '....03333330....',
    '....03303330....',
    '....03333330....',
    '.....033330.....',
    '...0011111100...',
    '..001111111100..',
    '..001111111100..',
    '..000000000000..',
  ],
};

const LEGS = [
  ['..00111..11100..', '..00111..11100..', '..00000..00000..'], // stride
  ['...0011111100...', '...0011111100...', '...0000000000...'], // together
];

function spriteFromRows(rows) {
  const c = makeCanvas(16, 16);
  const x = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      x.fillStyle = PAL[+ch];
      x.fillRect(i, y, 1, 1);
    }
  });
  return c;
}

function flip(src) {
  const c = makeCanvas(16, 16);
  const x = c.getContext('2d');
  x.translate(16, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

/** farmer[dir][frame] — dir is 'down' | 'up' | 'left' | 'right'. */
export const farmer = {};

export function buildFarmer() {
  for (const dir of ['down', 'up', 'side']) {
    const frames = LEGS.map(legs => spriteFromRows([...BODY[dir], ...legs]));
    if (dir === 'side') {
      farmer.right = frames;
      farmer.left = frames.map(flip);
    } else {
      farmer[dir] = frames;
    }
  }
}

/* ------------------------------ terrain tiles ---------------------------- */
/* Drawn procedurally: at 16x16 with four shades, a few rects and speckles
   read better than hand-authored data and cost a fraction of the source. */

export const T_GRASS = 0, T_PATH = 1, T_WATER = 2, T_TREE = 3,
  T_FENCE = 4, T_SOIL = 5, T_WALL = 6, T_ROOF = 7, T_DOOR = 8, T_PEN = 9,
  T_WINDOW = 10;

const tiles = [];
export const tile = i => tiles[i];

function px(x, s, a, b, w = 1, h = 1) { x.fillStyle = PAL[s]; x.fillRect(a, b, w, h); }

export function buildTiles() {
  const mk = draw => { const c = makeCanvas(TILE, TILE); draw(c.getContext('2d')); return c; };

  tiles[T_GRASS] = mk(x => {
    px(x, LITE, 0, 0, 16, 16);
    for (const [a, b] of [[2, 3], [9, 6], [5, 11], [13, 13], [12, 2]]) {
      px(x, MID, a, b, 2, 1);
      px(x, MID, a + 1, b - 1);
    }
  });

  tiles[T_PATH] = mk(x => {
    px(x, PALE, 0, 0, 16, 16);
    for (const [a, b] of [[3, 4], [11, 9], [6, 13], [14, 2]]) px(x, LITE, a, b, 2, 2);
  });

  tiles[T_WATER] = mk(x => {
    px(x, MID, 0, 0, 16, 16);
    for (let y = 2; y < 16; y += 5) {
      px(x, LITE, 1, y, 5, 1);
      px(x, LITE, 9, y + 2, 5, 1);
    }
  });

  tiles[T_TREE] = mk(x => {
    px(x, LITE, 0, 0, 16, 16);            // grass underneath
    px(x, DARK, 7, 10, 2, 6);             // trunk
    px(x, DARK, 4, 0, 8, 12);             // canopy silhouette
    px(x, DARK, 2, 2, 12, 8);
    px(x, DARK, 1, 4, 14, 4);
    px(x, MID, 5, 1, 6, 10);              // foliage
    px(x, MID, 3, 3, 10, 6);
    px(x, MID, 2, 5, 12, 2);
    px(x, LITE, 5, 3, 2, 2);              // catchlights
    px(x, LITE, 9, 6, 2, 2);
  });

  tiles[T_FENCE] = mk(x => {
    px(x, LITE, 0, 0, 16, 16);
    px(x, DARK, 0, 6, 16, 2);
    px(x, DARK, 2, 3, 2, 10);
    px(x, DARK, 11, 3, 2, 10);
  });

  tiles[T_PEN] = mk(x => {                // trodden pen floor
    px(x, PALE, 0, 0, 16, 16);
    for (const [a, b] of [[2, 2], [10, 5], [5, 10], [12, 12]]) px(x, LITE, a, b, 3, 1);
  });

  /* Broken furrows: a block of these reads as tilled ground instead of a
     barcode, and leaves contrast for the crop sprite on top. */
  tiles[T_SOIL] = mk(x => {
    px(x, LITE, 0, 0, 16, 16);
    for (const y of [2, 7, 12]) {
      px(x, MID, 0, y, 16, 3);
      px(x, DARK, 1, y + 1, 6, 1);
      px(x, DARK, 9, y + 1, 6, 1);
    }
  });

  /** Plank siding — quiet, so signs and doors read against it. */
  const wall = x => {
    px(x, LITE, 0, 0, 16, 16);
    for (const a of [0, 5, 10, 15]) px(x, MID, a, 0, 1, 16);
  };

  tiles[T_WALL] = mk(wall);

  tiles[T_ROOF] = mk(x => {
    px(x, DARK, 0, 0, 16, 16);
    for (let y = 2; y < 14; y += 4) px(x, MID, 0, y, 16, 1);   // shingle courses
    px(x, MID, 0, 14, 16, 2);                                  // eave
  });

  tiles[T_WINDOW] = mk(x => {
    wall(x);
    px(x, DARK, 2, 3, 12, 10);
    px(x, PALE, 3, 4, 4, 8);
    px(x, PALE, 9, 4, 4, 8);
  });

  tiles[T_DOOR] = mk(x => {
    wall(x);
    px(x, DARK, 3, 1, 10, 15);
    px(x, LITE, 4, 2, 8, 14);
    px(x, DARK, 10, 8, 2, 2);             // handle
  });
}

/* ------------------------------ frames/boxes ----------------------------- */

/**
 * A flat label plate: one dark pixel of border, pale inside, nothing else.
 * `panel` adds an inner highlight that eats small text, so signs use this.
 */
export function plate(ctx, x, y, w, h) {
  ctx.fillStyle = PAL[DARK];
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL[PALE];
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

/** Pokémon-style bordered window: dark frame, pale fill. */
export function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PAL[PALE];
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL[DARK];
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = PAL[LITE];
  ctx.fillRect(x + 3, y + 3, w - 6, 1);
  ctx.fillRect(x + 3, y + 3, 1, h - 6);
}

export function buildAll() {
  buildTiles();
  buildFarmer();
}
