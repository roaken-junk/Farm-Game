/* Generates the app icons as real PNGs — no binary assets checked in by hand.
   Run: node scripts/make-icons.mjs                                            */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SIZE = 512;

/* ------------------------------ tiny painter ----------------------------- */

const buf = new Uint8Array(SIZE * SIZE * 3);

function px(x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 3;
  buf[i] = buf[i] * (1 - a) + r * a;
  buf[i + 1] = buf[i + 1] * (1 - a) + g * a;
  buf[i + 2] = buf[i + 2] * (1 - a) + b * a;
}

const mix = (c1, c2, t) => c1.map((v, i) => v + (c2[i] - v) * t);

function rect(x0, y0, x1, y1, c) {
  for (let y = Math.round(y0); y < Math.round(y1); y++)
    for (let x = Math.round(x0); x < Math.round(x1); x++) px(x, y, c);
}

function disc(cx, cy, r, c) {
  for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r + 0.5) px(x, y, c, Math.min(1, r + 0.5 - d));
    }
  }
}

/** Filled triangle via edge functions (winding-agnostic). */
function tri(p0, p1, p2, c) {
  const edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const xs = [p0[0], p1[0], p2[0]], ys = [p0[1], p1[1], p2[1]];
  for (let y = Math.min(...ys) | 0; y <= Math.max(...ys); y++) {
    for (let x = Math.min(...xs) | 0; x <= Math.max(...xs); x++) {
      const a = edge(p0, p1, x + .5, y + .5);
      const b = edge(p1, p2, x + .5, y + .5);
      const d = edge(p2, p0, x + .5, y + .5);
      if ((a >= 0 && b >= 0 && d >= 0) || (a <= 0 && b <= 0 && d <= 0)) px(x, y, c);
    }
  }
}

/* -------------------------------- artwork -------------------------------- */

const SKY_TOP = [122, 200, 240], SKY_BOT = [205, 238, 255];
const GRASS_1 = [130, 200, 80], GRASS_2 = [86, 165, 52];
const BARN = [206, 68, 60], BARN_DK = [163, 44, 40];
const WHITE = [255, 252, 244], SUN = [255, 209, 74];

// sky
for (let y = 0; y < SIZE; y++) {
  const c = mix(SKY_TOP, SKY_BOT, Math.min(1, y / (SIZE * 0.62)));
  for (let x = 0; x < SIZE; x++) px(x, y, c);
}

// sun with a soft halo
disc(410, 108, 96, mix(SUN, SKY_TOP, 0.72));
disc(410, 108, 62, SUN);

// two rolling hills
for (let x = 0; x < SIZE; x++) {
  const back = 300 + Math.sin(x / 150) * 26;
  for (let y = Math.round(back); y < SIZE; y++) px(x, y, GRASS_2);
  const front = 348 + Math.sin(x / 92 + 1.9) * 20;
  for (let y = Math.round(front); y < SIZE; y++) px(x, y, mix(GRASS_1, GRASS_2, (y - front) / 190));
}

// ploughed furrows in the foreground
for (let y = 430; y < SIZE; y += 22) {
  for (let x = 0; x < SIZE; x++) px(x, y, [120, 78, 44], 0.35);
  for (let x = 0; x < SIZE; x++) px(x, y + 1, [120, 78, 44], 0.2);
}

// barn
const bx = 150, by = 250, bw = 212, bh = 132;
tri([bx - 26, by], [bx + bw / 2, by - 84], [bx + bw + 26, by], BARN_DK);   // roof
rect(bx, by, bx + bw, by + bh, BARN);                                      // body
rect(bx, by, bx + bw, by + 10, BARN_DK);
rect(bx + bw / 2 - 40, by + 46, bx + bw / 2 + 40, by + bh, WHITE);          // doors
rect(bx + bw / 2 - 3, by + 46, bx + bw / 2 + 3, by + bh, BARN_DK);
rect(bx + bw / 2 - 40, by + 46, bx + bw / 2 + 40, by + 54, BARN_DK);       // door lintel
rect(bx + 22, by + 40, bx + 60, by + 76, WHITE);                           // window
rect(bx + bw - 60, by + 40, bx + bw - 22, by + 76, WHITE);

// a couple of wheat stalks out front
for (const sx of [80, 108, 396, 428]) {
  rect(sx, 400, sx + 6, 470, [216, 178, 70]);
  disc(sx + 3, 396, 13, [244, 208, 96]);
}

/* --------------------------------- output -------------------------------- */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return bytes => {
    let c = -1;
    for (const b of bytes) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    Buffer.from(pixels.buffer, pixels.byteOffset + y * size * 3, size * 3)
      .copy(raw, y * (size * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Box-filter downscale from the 512px master. */
function resize(size) {
  const out = new Uint8Array(size * size * 3);
  const step = SIZE / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = Math.floor(y * step); sy < (y + 1) * step; sy++) {
        for (let sx = Math.floor(x * step); sx < (x + 1) * step; sx++) {
          const i = (sy * SIZE + sx) * 3;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++;
        }
      }
      const o = (y * size + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return out;
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
const write = (name, size) => {
  const data = size === SIZE ? buf : resize(size);
  writeFileSync(new URL(`../icons/${name}`, import.meta.url), png(data, size));
  console.log('wrote icons/' + name);
};

write('icon-512.png', 512);
write('icon-192.png', 192);
write('apple-touch-icon.png', 180);
