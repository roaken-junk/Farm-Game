// Generates the PWA / apple-touch icon set.
//
// There is no image library in the toolchain (and no need for one) — the icon
// is a tiny signed-distance style scene evaluated per pixel and written out as
// a hand-rolled PNG. Run: node tools/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');
mkdirSync(OUT, { recursive: true });

/* ------------------------------ PNG writer ------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // truecolour + alpha
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------- scene --------------------------------- */

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const INK_TOP = [63, 30, 96];
const INK_BOT = [18, 9, 34];
const PETAL_IN = [255, 214, 231];
const PETAL_OUT = [232, 52, 124];
const GOLD = [255, 207, 92];
const GOLD_DEEP = [216, 138, 20];

function sample(u, v, opts) {
  // u,v in 0..1
  const pad = opts.pad;
  const cx = 0.5, cy = 0.5;
  const dx = u - cx, dy = v - cy;
  const r = Math.hypot(dx, dy);
  let theta = Math.atan2(dy, dx);

  // background: vertical gradient + magenta bloom behind the blossom
  let col = mix(INK_TOP, INK_BOT, clamp(v * 1.05, 0, 1));
  const bloom = clamp(1 - r / 0.62, 0, 1);
  col = mix(col, [176, 42, 110], bloom * bloom * 0.72);

  // corner vignette
  col = mix(col, [10, 5, 20], clamp((r - 0.5) * 1.5, 0, 1) * 0.6);

  const R = (0.5 - pad) * 0.98;

  // Five fat petals, each with the little V notch a real sakura has:
  // |cos(2.5θ)| gives five lobes over a full turn, and the notch term bites a
  // dip out at exactly the petal tip (where sin(5θ) crosses zero).
  const a = theta + Math.PI / 2;
  const lobe = Math.abs(Math.cos(2.5 * a));
  const notch = 1 - 0.17 * Math.pow(lobe, 14) * (1 - Math.abs(Math.sin(5 * a)));
  const petalR = R * (0.2 + 0.8 * Math.pow(lobe, 0.42)) * notch;

  const edge = 0.006;
  const inPetal = clamp((petalR - r) / edge, 0, 1);
  if (inPetal > 0) {
    const t = clamp(r / Math.max(petalR, 1e-4), 0, 1);
    let petal = mix(PETAL_IN, PETAL_OUT, Math.pow(t, 0.85));
    // subtle vein shading toward each petal centre line
    const vein = Math.abs(Math.sin(2.5 * (theta + Math.PI / 2)));
    petal = mix(petal, [255, 255, 255], (1 - vein) * 0.18 * (1 - t));
    col = mix(col, petal, inPetal);

    // ink outline just inside the silhouette
    const outline = clamp(1 - Math.abs(petalR - r) / (R * 0.06), 0, 1);
    col = mix(col, [58, 20, 62], Math.pow(outline, 1.6) * 0.62 * inPetal);
  }

  // gold pistil
  const pist = R * 0.185;
  const inPist = clamp((pist - r) / edge, 0, 1);
  if (inPist > 0) {
    const g = mix(GOLD, GOLD_DEEP, clamp(r / pist, 0, 1));
    col = mix(col, g, inPist);
  }

  // top-left specular
  col = mix(col, [255, 255, 255], clamp(0.5 - (u * 0.6 + v * 0.7), 0, 1) * 0.1);

  let alpha = 255;
  if (opts.round) {
    // rounded-square mask for the maskable icon
    const k = 0.5 - opts.pad * 0.35;
    const qx = Math.max(Math.abs(dx) - (k - 0.14), 0);
    const qy = Math.max(Math.abs(dy) - (k - 0.14), 0);
    const d = Math.hypot(qx, qy) - 0.14;
    alpha = clamp((-d) / 0.004, 0, 1) * 255;
  }
  return [col[0], col[1], col[2], alpha];
}

function render(size, opts) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3; // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const c = sample(u, v, opts);
          r += c[0]; g += c[1]; b += c[2]; a += c[3];
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, size, buf);
}

const targets = [
  { file: 'icon-180.png', size: 180, pad: 0.13, round: false }, // apple-touch-icon
  { file: 'icon-192.png', size: 192, pad: 0.13, round: false },
  { file: 'icon-512.png', size: 512, pad: 0.13, round: false },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.24, round: true },
];

for (const t of targets) {
  const png = render(t.size, t);
  writeFileSync(join(OUT, t.file), png);
  console.log(`wrote icons/${t.file} (${t.size}px, ${(png.length / 1024).toFixed(1)} KB)`);
}
