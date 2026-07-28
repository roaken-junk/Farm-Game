// ============================================================================
// Procedural anime character art.
//
// Every hero is drawn from the parameters in data/heroes.js — chibi
// proportions, cel-shaded flats, heavy ink outline, big expressive eyes.
// Nothing is loaded from disk, so the whole game is a few hundred KB and
// stays razor sharp on any display density.
//
// Local drawing space for a full body: origin at the feet, character is
// 100 units tall and roughly 62 wide. The head alone is ~44 units — that
// oversized head is what sells the chibi look.
// ============================================================================

import { HERO_BY_ID } from '../data/heroes.js';
import { TAU } from '../core/math.js';

const INK = '#2b1a3f';
const LW = 2.6;

/* ------------------------------- helpers -------------------------------- */

function ink(ctx, lw = LW) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function shape(ctx, draw, fill, lw = LW) {
  ctx.beginPath();
  draw();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) ink(ctx, lw);
}

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function capsule(ctx, x1, y1, x2, y2, r) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = a + Math.PI / 2;
  ctx.moveTo(x1 + Math.cos(p) * r, y1 + Math.sin(p) * r);
  ctx.lineTo(x2 + Math.cos(p) * r, y2 + Math.sin(p) * r);
  ctx.arc(x2, y2, r, p, p + Math.PI, false);
  ctx.lineTo(x1 - Math.cos(p) * r, y1 - Math.sin(p) * r);
  ctx.arc(x1, y1, r, p + Math.PI, p + TAU, false);
  ctx.closePath();
}

function shade(color, amt) {
  // amt < 0 darkens, > 0 lightens. Works on #rrggbb.
  const n = parseInt(color.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) {
    r = Math.round(r * (1 + amt)); g = Math.round(g * (1 + amt)); b = Math.round(b * (1 + amt));
  } else {
    r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
  }
  return `rgb(${r},${g},${b})`;
}

function withAlpha(color, a) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
}

/* --------------------------------- hair --------------------------------- */

function backHair(ctx, art, hx, hy, hr) {
  const c = art.hair, c2 = art.hair2 || shade(art.hair, -0.25);
  const g = ctx.createLinearGradient(hx, hy - hr, hx, hy + hr * 2);
  g.addColorStop(0, c);
  g.addColorStop(1, c2);

  // Every style starts from a mass behind the skull so the silhouette reads.
  const cap = () => shape(ctx, () => ell(ctx, hx, hy - hr * 0.06, hr * 1.1, hr * 1.08), g);

  // Two side locks framing the jaw — far more readable than one big blob.
  const sideLocks = (drop, flare) => {
    for (const s of [-1, 1]) {
      shape(ctx, () => {
        ctx.moveTo(hx + s * hr * 0.5, hy - hr * 0.75);
        ctx.quadraticCurveTo(hx + s * hr * 1.22, hy - hr * 0.2, hx + s * hr * (1.02 + flare), hy + hr * drop);
        ctx.quadraticCurveTo(hx + s * hr * (0.78 + flare), hy + hr * (drop + 0.28), hx + s * hr * 0.58, hy + hr * (drop - 0.15));
        ctx.quadraticCurveTo(hx + s * hr * 0.74, hy + hr * 0.2, hx + s * hr * 0.42, hy - hr * 0.62);
        ctx.closePath();
      }, g);
    }
  };

  switch (art.hairStyle) {
    case 'ponytail':
      cap();
      shape(ctx, () => {
        ctx.moveTo(hx + hr * 0.55, hy - hr * 0.5);
        ctx.quadraticCurveTo(hx + hr * 2.05, hy - hr * 0.3, hx + hr * 1.8, hy + hr * 1.25);
        ctx.quadraticCurveTo(hx + hr * 1.45, hy + hr * 1.95, hx + hr * 1.05, hy + hr * 0.95);
        ctx.quadraticCurveTo(hx + hr * 1.32, hy + hr * 0.15, hx + hr * 0.5, hy + hr * 0.05);
        ctx.closePath();
      }, g);
      break;
    case 'twintails':
      cap();
      for (const s of [-1, 1]) {
        shape(ctx, () => {
          ctx.moveTo(hx + s * hr * 0.78, hy - hr * 0.5);
          ctx.quadraticCurveTo(hx + s * hr * 1.85, hy - hr * 0.22, hx + s * hr * 1.6, hy + hr * 1.1);
          ctx.quadraticCurveTo(hx + s * hr * 1.3, hy + hr * 1.72, hx + s * hr * 0.95, hy + hr * 0.8);
          ctx.quadraticCurveTo(hx + s * hr * 1.14, hy + hr * 0.12, hx + s * hr * 0.7, hy - hr * 0.1);
          ctx.closePath();
        }, g);
        shape(ctx, () => ell(ctx, hx + s * hr * 0.82, hy - hr * 0.52, hr * 0.2, hr * 0.16), art.accent || c2, 2);
      }
      break;
    case 'long':
      cap();
      sideLocks(1.55, 0.14);
      break;
    case 'straight':
      cap();
      sideLocks(1.25, 0.05);
      break;
    case 'wild':
    case 'spiky': {
      // spikes fan out from the crown only — never down over the face
      shape(ctx, () => {
        ctx.moveTo(hx - hr * 1.1, hy + hr * 0.1);
        const n = 11;
        for (let i = 0; i <= n; i++) {
          const a = Math.PI + (i / n) * Math.PI;
          const spike = i % 2 === 0 ? 1.62 : 1.06;
          ctx.lineTo(hx + Math.cos(a) * hr * spike, hy + Math.sin(a) * hr * spike);
        }
        ctx.closePath();
      }, g);
      break;
    }
    case 'bob':
      shape(ctx, () => ell(ctx, hx, hy + hr * 0.1, hr * 1.2, hr * 1.2), g);
      break;
    case 'messy':
      cap();
      sideLocks(0.75, 0);
      break;
    default:
      cap();
      break;
  }
}

function frontHair(ctx, art, hx, hy, hr) {
  const c = art.hair, c2 = art.hair2 || shade(art.hair, -0.2);
  const g = ctx.createLinearGradient(hx, hy - hr * 1.2, hx, hy + hr * 0.1);
  g.addColorStop(0, shade(c, 0.26));
  g.addColorStop(0.6, c);
  g.addColorStop(1, c2);

  const spiky = art.hairStyle === 'spiky' || art.hairStyle === 'wild' || art.hairStyle === 'messy';

  // The fringe stops above the brow line (brows sit at hy - 0.22hr) so the
  // whole face always reads, even at battle-token size.
  shape(ctx, () => {
    ctx.moveTo(hx - hr * 1.02, hy - hr * 0.44);
    ctx.quadraticCurveTo(hx - hr * 1.14, hy - hr * 1.0, hx, hy - hr * 1.15);
    ctx.quadraticCurveTo(hx + hr * 1.14, hy - hr * 1.0, hx + hr * 1.02, hy - hr * 0.44);
    if (spiky) {
      const n = 3;
      for (let i = n; i >= 0; i--) {
        const t = i / n;
        const x = hx - hr * 0.96 + t * hr * 1.92;
        ctx.lineTo(x + hr * 0.13, hy - hr * 0.3);
        ctx.lineTo(x - hr * 0.14, hy - hr * 0.72);
      }
    } else {
      // two generous locks parted off-centre
      ctx.quadraticCurveTo(hx + hr * 0.88, hy - hr * 0.48, hx + hr * 0.32, hy - hr * 0.3);
      ctx.quadraticCurveTo(hx + hr * 0.2, hy - hr * 0.72, hx - hr * 0.18, hy - hr * 0.32);
      ctx.quadraticCurveTo(hx - hr * 0.62, hy - hr * 0.56, hx - hr * 1.02, hy - hr * 0.44);
    }
    ctx.closePath();
  }, g, 2.2);

  // glossy anime hair band
  ctx.save();
  ctx.globalAlpha = 0.5;
  shape(ctx, () => {
    ctx.moveTo(hx - hr * 0.6, hy - hr * 0.72);
    ctx.quadraticCurveTo(hx, hy - hr * 0.98, hx + hr * 0.6, hy - hr * 0.7);
    ctx.quadraticCurveTo(hx + hr * 0.2, hy - hr * 0.64, hx - hr * 0.08, hy - hr * 0.72);
    ctx.quadraticCurveTo(hx - hr * 0.34, hy - hr * 0.58, hx - hr * 0.6, hy - hr * 0.72);
    ctx.closePath();
  }, withAlpha(shade(c, 0.75), 0.95), 0);
  ctx.restore();
}

/* --------------------------------- eyes --------------------------------- */

function drawEye(ctx, x, y, w, h, art, side, expr) {
  const closed = expr === 'happy' && art.hairStyle !== 'spiky';
  const narrow = expr === 'cool' || expr === 'angry' || (expr === 'smug' && side > 0);

  const lidded = expr === 'calm' || (expr === 'smug' && side > 0);

  if (closed) {
    shape(ctx, () => {
      ctx.moveTo(x - w, y + h * 0.35);
      ctx.quadraticCurveTo(x, y - h * 0.85, x + w, y + h * 0.35);
    }, null, 2.8);
    return;
  }

  const hh = narrow ? h * 0.72 : h;
  const lidDrop = lidded ? hh * 0.5 : 0;

  // sclera
  shape(ctx, () => {
    ctx.moveTo(x - w, y + hh * 0.15);
    ctx.quadraticCurveTo(x - w * 0.7, y - hh, x + w * 0.15, y - hh * 0.95);
    ctx.quadraticCurveTo(x + w, y - hh * 0.7, x + w * 0.92, y + hh * 0.2);
    ctx.quadraticCurveTo(x + w * 0.3, y + hh * 0.95, x - w, y + hh * 0.15);
    ctx.closePath();
  }, '#ffffff', 0);

  ctx.save();
  ctx.clip();

  // iris with the classic vertical gradient
  const ig = ctx.createLinearGradient(x, y - hh, x, y + hh);
  ig.addColorStop(0, shade(art.eye, -0.45));
  ig.addColorStop(0.55, art.eye);
  ig.addColorStop(1, shade(art.eye, 0.55));
  ctx.beginPath();
  ell(ctx, x + w * 0.02, y, w * 0.66, hh * 0.92);
  ctx.fillStyle = ig; ctx.fill();

  ctx.beginPath();
  ell(ctx, x + w * 0.02, y + hh * 0.06, w * 0.34, hh * 0.5);
  ctx.fillStyle = 'rgba(20,10,35,.92)'; ctx.fill();

  // highlights
  ctx.beginPath();
  ell(ctx, x - w * 0.28, y - hh * 0.42, w * 0.26, hh * 0.3, -0.4);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath();
  ell(ctx, x + w * 0.34, y + hh * 0.36, w * 0.14, hh * 0.16);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();

  // upper shadow inside the eye
  ctx.beginPath();
  ctx.moveTo(x - w * 1.2, y - hh * 1.2);
  ctx.lineTo(x + w * 1.2, y - hh * 1.2);
  ctx.lineTo(x + w * 1.2, y - hh * 0.42);
  ctx.quadraticCurveTo(x, y - hh * 0.1, x - w * 1.2, y - hh * 0.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(43,26,63,.28)'; ctx.fill();
  ctx.restore();

  // a relaxed / winking eye gets a real skin-coloured lid over the top half
  if (lidDrop > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - w * 1.15, y - hh * 1.3);
    ctx.lineTo(x + w * 1.15, y - hh * 1.3);
    ctx.lineTo(x + w * 1.15, y - hh + lidDrop);
    ctx.quadraticCurveTo(x, y - hh * 0.5 + lidDrop, x - w * 1.15, y - hh + lidDrop);
    ctx.closePath();
    ctx.fillStyle = art.skin;
    ctx.fill();
    ctx.restore();
  }

  // lash line — thick on top, thin below
  shape(ctx, () => {
    ctx.moveTo(x - w * 1.03, y + hh * 0.1 - lidDrop * 0.2);
    ctx.quadraticCurveTo(x - w * 0.7, y - hh * 1.1 + lidDrop, x + w * 0.18, y - hh * 1.02 + lidDrop);
    ctx.quadraticCurveTo(x + w * 1.02, y - hh * 0.72 + lidDrop, x + w * 0.95, y + hh * 0.18 - lidDrop * 0.2);
  }, null, 3.4);
  shape(ctx, () => {
    ctx.moveTo(x - w * 0.95, y + hh * 0.22);
    ctx.quadraticCurveTo(x + w * 0.25, y + hh * 0.92, x + w * 0.9, y + hh * 0.24);
  }, null, 1.5);
}

function drawBrow(ctx, x, y, w, side, expr) {
  let tilt = 0;
  if (expr === 'angry') tilt = side * 0.42;
  if (expr === 'determined') tilt = side * 0.3;
  if (expr === 'smug') tilt = side * 0.22;
  if (expr === 'calm') tilt = -side * 0.1;
  shape(ctx, () => {
    ctx.moveTo(x - w, y + tilt * w * 0.55);
    ctx.quadraticCurveTo(x, y - w * 0.4 + tilt * w * 0.1, x + w, y - tilt * w * 0.35);
  }, null, 2.1);
}

function drawMouth(ctx, x, y, s, expr) {
  switch (expr) {
    case 'happy':
      shape(ctx, () => {
        ctx.moveTo(x - s * 0.6, y - s * 0.1);
        ctx.quadraticCurveTo(x, y + s * 0.95, x + s * 0.6, y - s * 0.1);
        ctx.quadraticCurveTo(x, y + s * 0.25, x - s * 0.6, y - s * 0.1);
        ctx.closePath();
      }, '#8c2f4d', 2);
      break;
    case 'angry':
      shape(ctx, () => {
        ctx.moveTo(x - s * 0.75, y - s * 0.25);
        ctx.lineTo(x - s * 0.25, y + s * 0.45);
        ctx.lineTo(x + s * 0.2, y - s * 0.2);
        ctx.lineTo(x + s * 0.7, y + s * 0.4);
        ctx.lineTo(x + s * 0.75, y - s * 0.3);
        ctx.quadraticCurveTo(x, y - s * 0.75, x - s * 0.75, y - s * 0.25);
        ctx.closePath();
      }, '#7d2436', 2);
      break;
    case 'smug':
      shape(ctx, () => {
        ctx.moveTo(x - s * 0.5, y + s * 0.2);
        ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.45, x + s * 0.65, y - s * 0.25);
      }, null, 2.3);
      break;
    case 'cool':
      shape(ctx, () => {
        ctx.moveTo(x - s * 0.42, y + s * 0.05);
        ctx.lineTo(x + s * 0.42, y + s * 0.05);
      }, null, 2.3);
      break;
    case 'determined':
      shape(ctx, () => {
        ctx.moveTo(x - s * 0.5, y + s * 0.1);
        ctx.quadraticCurveTo(x, y - s * 0.28, x + s * 0.5, y + s * 0.12);
      }, null, 2.5);
      break;
    default: // calm
      shape(ctx, () => {
        ctx.moveTo(x - s * 0.35, y);
        ctx.quadraticCurveTo(x, y + s * 0.42, x + s * 0.35, y);
      }, null, 2.2);
      break;
  }
}

/* --------------------------------- head --------------------------------- */

function drawEars(ctx, art, hx, hy, hr) {
  const kind = art.ears;
  if (!kind) return;
  const furA = art.hair, furB = art.hair2 || shade(art.hair, -0.3);
  const inner = kind === 'cat' ? '#ffb6c8' : '#f7d5b0';
  for (const s of [-1, 1]) {
    const bx = hx + s * hr * 0.66, by = hy - hr * 0.86;
    shape(ctx, () => {
      ctx.moveTo(bx - hr * 0.3, by + hr * 0.24);
      ctx.quadraticCurveTo(bx + s * hr * 0.06, by - hr * 0.78, bx + hr * 0.34, by + hr * 0.18);
      ctx.quadraticCurveTo(bx, by + hr * 0.34, bx - hr * 0.3, by + hr * 0.24);
      ctx.closePath();
    }, s < 0 ? furA : furB);
    shape(ctx, () => {
      ctx.moveTo(bx - hr * 0.14, by + hr * 0.16);
      ctx.quadraticCurveTo(bx + s * hr * 0.04, by - hr * 0.42, bx + hr * 0.17, by + hr * 0.13);
      ctx.closePath();
    }, inner, 0);
  }
}

function drawHorns(ctx, art, hx, hy, hr) {
  for (const s of [-1, 1]) {
    shape(ctx, () => {
      const bx = hx + s * hr * 0.78, by = hy - hr * 0.72;
      ctx.moveTo(bx - s * hr * 0.16, by + hr * 0.16);
      ctx.quadraticCurveTo(bx + s * hr * 0.5, by - hr * 0.5, bx + s * hr * 0.28, by - hr * 0.92);
      ctx.quadraticCurveTo(bx + s * hr * 0.02, by - hr * 0.42, bx - s * hr * 0.2, by - hr * 0.02);
      ctx.closePath();
    }, '#f6e7cf');
  }
}

function drawHead(ctx, art, hx, hy, hr, expr) {
  const skin = art.skin;
  backHair(ctx, art, hx, hy, hr);
  if (art.ears) drawEars(ctx, art, hx, hy, hr);
  if (art.horns) drawHorns(ctx, art, hx, hy, hr);

  // face
  shape(ctx, () => {
    ctx.moveTo(hx - hr, hy - hr * 0.12);
    ctx.quadraticCurveTo(hx - hr, hy + hr * 0.74, hx, hy + hr * 1.06);
    ctx.quadraticCurveTo(hx + hr, hy + hr * 0.74, hx + hr, hy - hr * 0.12);
    ctx.quadraticCurveTo(hx + hr * 0.9, hy - hr * 1.06, hx, hy - hr * 1.08);
    ctx.quadraticCurveTo(hx - hr * 0.9, hy - hr * 1.06, hx - hr, hy - hr * 0.12);
    ctx.closePath();
  }, skin);

  // gentle cel shadow on the shaded side only — never across the whole face
  ctx.save();
  ctx.beginPath();
  ell(ctx, hx, hy, hr * 0.99, hr * 1.05);
  ctx.clip();
  const sg = ctx.createLinearGradient(hx + hr * 0.45, hy, hx + hr * 1.05, hy);
  sg.addColorStop(0, 'rgba(0,0,0,0)');
  sg.addColorStop(1, withAlpha(shade(skin, -0.3), 0.42));
  ctx.fillStyle = sg;
  ctx.fillRect(hx - hr * 1.2, hy - hr * 1.2, hr * 2.4, hr * 2.4);
  // soft shadow cast by the fringe
  const fg = ctx.createLinearGradient(hx, hy - hr * 0.9, hx, hy - hr * 0.1);
  fg.addColorStop(0, withAlpha(shade(skin, -0.35), 0.5));
  fg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fg;
  ctx.fillRect(hx - hr * 1.2, hy - hr * 1.2, hr * 2.4, hr * 1.3);
  ctx.restore();

  const eyeY = hy + hr * 0.26;
  const eyeDX = hr * 0.45;
  const eyeW = hr * 0.33, eyeH = hr * 0.38;

  drawEye(ctx, hx - eyeDX, eyeY, eyeW, eyeH, art, -1, expr);
  drawEye(ctx, hx + eyeDX, eyeY, eyeW, eyeH, art, 1, expr);
  drawBrow(ctx, hx - eyeDX, eyeY - hr * 0.34, hr * 0.2, -1, expr);
  drawBrow(ctx, hx + eyeDX, eyeY - hr * 0.34, hr * 0.2, 1, expr);

  // blush
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ell(ctx, hx + s * hr * 0.72, eyeY + hr * 0.3, hr * 0.19, hr * 0.1);
    ctx.fillStyle = '#ff7ba3'; ctx.fill();
  }
  ctx.restore();

  // nose dot + mouth
  ctx.beginPath();
  ell(ctx, hx + hr * 0.03, eyeY + hr * 0.36, hr * 0.03, hr * 0.045);
  ctx.fillStyle = withAlpha(shade(skin, -0.5), 0.6); ctx.fill();
  drawMouth(ctx, hx, eyeY + hr * 0.58, hr * 0.19, expr);

  if (art.mask) {
    shape(ctx, () => {
      ctx.moveTo(hx - hr * 0.94, eyeY + hr * 0.42);
      ctx.quadraticCurveTo(hx, eyeY + hr * 0.24, hx + hr * 0.94, eyeY + hr * 0.42);
      ctx.quadraticCurveTo(hx + hr * 0.78, hy + hr * 1.04, hx, hy + hr * 1.12);
      ctx.quadraticCurveTo(hx - hr * 0.78, hy + hr * 1.04, hx - hr * 0.94, eyeY + hr * 0.42);
      ctx.closePath();
    }, art.outfit2 || '#4a4a6a');
  }

  frontHair(ctx, art, hx, hy, hr);

  if (art.halo) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ell(ctx, hx, hy - hr * 1.52, hr * 0.85, hr * 0.22);
    ctx.strokeStyle = art.accent; ctx.lineWidth = 3.2; ctx.stroke();
    ctx.restore();
  }
}

/* -------------------------------- weapons -------------------------------- */

function drawWeapon(ctx, art, x, y, s, behind) {
  const kind = art.weapon;
  if (!kind || kind === 'none') return;
  const metal = '#e8eef7', dark = '#4a4a6a';

  if (behind) {
    if (kind === 'katana') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.62);
      shape(ctx, () => { capsule(ctx, -s * 0.1, 0, s * 1.5, 0, s * 0.075); }, metal);
      shape(ctx, () => { capsule(ctx, -s * 0.55, 0, -s * 0.12, 0, s * 0.07); }, art.accent || '#c0392b');
      shape(ctx, () => ell(ctx, -s * 0.08, 0, s * 0.055, s * 0.16), '#ffd97a');
      ctx.restore();
    } else if (kind === 'scythe') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(0.3);
      shape(ctx, () => { capsule(ctx, 0, s * 0.9, 0, -s * 1.15, s * 0.065); }, '#3a2440');
      shape(ctx, () => {
        ctx.moveTo(0, -s * 1.15);
        ctx.quadraticCurveTo(s * 1.25, -s * 1.3, s * 1.05, -s * 0.25);
        ctx.quadraticCurveTo(s * 0.85, -s * 0.95, 0, -s * 0.98);
        ctx.closePath();
      }, '#ff5a3c');
      ctx.restore();
    } else if (kind === 'staff') {
      shape(ctx, () => { capsule(ctx, x, y + s * 0.95, x, y - s * 1.25, s * 0.06); }, '#8b5a2b');
      shape(ctx, () => ell(ctx, x, y - s * 1.35, s * 0.2, s * 0.2), art.accent || '#c9b6ff');
    } else if (kind === 'bow') {
      ctx.save();
      ctx.translate(x, y);
      shape(ctx, () => {
        ctx.moveTo(0, -s * 1.15);
        ctx.quadraticCurveTo(s * 0.85, 0, 0, s * 1.15);
      }, null, 3.2);
      shape(ctx, () => { ctx.moveTo(0, -s * 1.15); ctx.lineTo(0, s * 1.15); }, null, 1.2);
      ctx.restore();
    } else if (kind === 'club') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.4);
      shape(ctx, () => { capsule(ctx, 0, s * 0.8, 0, -s * 0.95, s * 0.1); }, '#6b4a2a');
      shape(ctx, () => ell(ctx, 0, -s * 1.15, s * 0.34, s * 0.44), '#7c5630');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        shape(ctx, () => ell(ctx, Math.cos(a) * s * 0.28, -s * 1.15 + Math.sin(a) * s * 0.34, s * 0.06, s * 0.06), '#d8d8e8', 1.4);
      }
      ctx.restore();
    } else if (kind === 'gohei') {
      shape(ctx, () => { capsule(ctx, x, y + s * 0.8, x, y - s * 1.1, s * 0.055); }, '#c8a06a');
      for (let i = 0; i < 4; i++) {
        shape(ctx, () => {
          ctx.moveTo(x - s * 0.3, y - s * 1.05 + i * s * 0.13);
          ctx.lineTo(x + s * 0.3, y - s * 1.0 + i * s * 0.13);
          ctx.lineTo(x + s * 0.24, y - s * 0.9 + i * s * 0.13);
          ctx.lineTo(x - s * 0.26, y - s * 0.95 + i * s * 0.13);
          ctx.closePath();
        }, '#fdf4e6', 1.2);
      }
    } else if (kind === 'drumstick') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.5);
      shape(ctx, () => { capsule(ctx, -s * 0.5, 0, s * 0.7, 0, s * 0.07); }, '#d9b382');
      shape(ctx, () => ell(ctx, s * 0.78, 0, s * 0.16, s * 0.16), '#f0e0c0');
      ctx.restore();
    }
    return;
  }

  // in-front pieces
  if (kind === 'kunai') {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(0.5);
    shape(ctx, () => {
      ctx.moveTo(0, -s * 0.62); ctx.lineTo(s * 0.17, -s * 0.1);
      ctx.lineTo(0, s * 0.16); ctx.lineTo(-s * 0.17, -s * 0.1);
      ctx.closePath();
    }, metal);
    shape(ctx, () => { capsule(ctx, 0, s * 0.16, 0, s * 0.62, s * 0.06); }, dark);
    ctx.restore();
  } else if (kind === 'fan') {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.35);
    shape(ctx, () => {
      ctx.moveTo(0, s * 0.3);
      ctx.arc(0, s * 0.3, s * 0.72, -Math.PI * 0.92, -Math.PI * 0.08);
      ctx.closePath();
    }, art.outfit || '#fdf4e6');
    for (let i = 0; i <= 4; i++) {
      const a = -Math.PI * 0.92 + (i / 4) * Math.PI * 0.84;
      shape(ctx, () => {
        ctx.moveTo(0, s * 0.3);
        ctx.lineTo(Math.cos(a) * s * 0.72, s * 0.3 + Math.sin(a) * s * 0.72);
      }, null, 1.3);
    }
    ctx.restore();
  }
}

function drawTails(ctx, art, x, y, s, t) {
  const n = art.tails || 0;
  if (!n) return;
  for (let i = 0; i < n; i++) {
    const spread = (i / (n - 1) - 0.5) * 2;
    const a = -Math.PI * 0.5 + spread * 1.15 + Math.sin(t * 1.6 + i) * 0.07;
    const L = s * (1.35 + Math.abs(spread) * 0.15);
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
    shape(ctx, () => {
      capsule(ctx, x, y, ex, ey, s * 0.15);
    }, art.hair);
    shape(ctx, () => ell(ctx, ex, ey, s * 0.17, s * 0.17), art.hair2 || '#ffd9e8', 2);
  }
}

function drawWings(ctx, art, x, y, s, t) {
  if (!art.wings) return;
  const flap = Math.sin(t * 2.2) * 0.12;
  for (const sd of [-1, 1]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sd, 1);
    ctx.rotate(flap);
    shape(ctx, () => {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 1.1, -s * 0.95, s * 1.5, -s * 0.15);
      ctx.quadraticCurveTo(s * 1.05, -s * 0.2, s * 1.15, s * 0.3);
      ctx.quadraticCurveTo(s * 0.75, -s * 0.02, s * 0.7, s * 0.5);
      ctx.quadraticCurveTo(s * 0.4, s * 0.05, 0, 0);
      ctx.closePath();
    }, '#3a1030');
    ctx.restore();
  }
}

/* ------------------------------- full body ------------------------------- */

/**
 * Draws a hero at chibi scale. Local space: feet at (0,0), body 100 tall,
 * y increases downward like canvas, so the head sits at negative y.
 */
export function drawBody(ctx, art, t = 0, opts = {}) {
  const bounce = Math.sin(t * 2) * 1.2;
  const big = art.big ? 1.1 : art.small ? 0.9 : 1;

  ctx.save();
  ctx.translate(0, bounce);
  ctx.scale(big, big);

  const hipY = -30;
  const shoulderY = -54;
  const headR = 23;
  const headY = -54 - headR * 0.95;

  drawWings(ctx, art, 0, shoulderY + 4, 26, t);
  drawTails(ctx, art, 0, hipY - 2, 26, t);
  drawWeapon(ctx, art, 16, shoulderY - 2, 26, true);

  // legs
  const legSwing = Math.sin(t * 2) * 1.4;
  for (const s of [-1, 1]) {
    shape(ctx, () => capsule(ctx, s * 7, hipY, s * 8 + legSwing * s, -6, 6.2), art.outfit2 || '#444');
    shape(ctx, () => ell(ctx, s * 8 + legSwing * s, -3.5, 7.4, 4.6), '#3b2a4a');
  }

  // torso — kimono-ish wrap
  shape(ctx, () => {
    ctx.moveTo(-13, hipY + 2);
    ctx.quadraticCurveTo(-17, shoulderY + 10, -14, shoulderY);
    ctx.quadraticCurveTo(0, shoulderY - 4, 14, shoulderY);
    ctx.quadraticCurveTo(17, shoulderY + 10, 13, hipY + 2);
    ctx.closePath();
  }, art.outfit);

  // collar V
  shape(ctx, () => {
    ctx.moveTo(-11, shoulderY + 1);
    ctx.lineTo(0, shoulderY + 15);
    ctx.lineTo(11, shoulderY + 1);
    ctx.quadraticCurveTo(0, shoulderY + 5, -11, shoulderY + 1);
    ctx.closePath();
  }, art.outfit2 || '#fff', 1.8);

  // obi sash
  shape(ctx, () => {
    ctx.moveTo(-13.5, hipY - 3);
    ctx.lineTo(13.5, hipY - 3);
    ctx.lineTo(13, hipY + 4);
    ctx.lineTo(-13, hipY + 4);
    ctx.closePath();
  }, art.accent || '#ffcf5c', 1.8);

  // arms
  const armSwing = Math.sin(t * 2 + 1) * 2.2;
  for (const s of [-1, 1]) {
    shape(ctx, () =>
      capsule(ctx, s * 13, shoulderY + 4, s * 18, hipY - 2 + armSwing * s, 4.6), art.outfit);
    shape(ctx, () => ell(ctx, s * 18, hipY + 1 + armSwing * s, 4.4, 4.4), art.skin);
  }

  drawWeapon(ctx, art, 18, hipY - 2, 22, false);
  drawHead(ctx, art, 0, headY, headR, art.expression || 'calm');

  ctx.restore();
}

/* ------------------------------ public API ------------------------------- */

/** Full-body portrait fitted into a w x h canvas region. */
export function drawPortrait(ctx, heroId, w, h, t = 0, opts = {}) {
  const hero = HERO_BY_ID[heroId];
  if (!hero) return;
  const art = hero.art;
  const pad = opts.pad ?? 0.08;
  const scale = (h * (1 - pad * 2)) / 108;

  ctx.save();
  ctx.translate(w / 2, h * (1 - pad * 0.7));
  ctx.scale(scale, scale);

  if (opts.glow !== false) {
    const g = ctx.createRadialGradient(0, -50, 4, 0, -50, 80);
    g.addColorStop(0, withAlpha(art.aura, 0.42));
    g.addColorStop(1, withAlpha(art.aura, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -50, 80, 0, TAU); ctx.fill();
  }
  if (opts.shadow !== false) {
    ctx.beginPath();
    ell(ctx, 0, 2, 26, 6);
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fill();
  }

  drawBody(ctx, art, t, opts);
  ctx.restore();
}

/** Head-and-shoulders bust, used on cards and battle tokens. */
export function drawBust(ctx, heroId, size, t = 0) {
  const hero = HERO_BY_ID[heroId];
  if (!hero) return;
  const art = hero.art;
  const s = size / 74;

  ctx.save();
  ctx.scale(s, s);
  ctx.translate(0, 6);

  drawTails(ctx, art, 0, 24, 16, t);
  drawWings(ctx, art, 0, 16, 17, t);

  // shoulders
  shape(ctx, () => {
    ctx.moveTo(-25, 44);
    ctx.quadraticCurveTo(-24, 17, -10, 13);
    ctx.quadraticCurveTo(0, 10, 10, 13);
    ctx.quadraticCurveTo(24, 17, 25, 44);
    ctx.closePath();
  }, art.outfit);
  shape(ctx, () => {
    ctx.moveTo(-10, 13); ctx.lineTo(0, 27); ctx.lineTo(10, 13);
    ctx.quadraticCurveTo(0, 16, -10, 13);
    ctx.closePath();
  }, art.outfit2 || '#fff', 1.6);

  drawHead(ctx, art, 0, -8, 23, art.expression || 'calm');
  ctx.restore();
}

/* --------------------------- cached renderers ---------------------------- */

const cache = new Map();

/** Renders a bust once into an offscreen canvas and reuses it. */
export function bustCanvas(heroId, size, dpr = window.devicePixelRatio || 1) {
  const key = `${heroId}|${size}|${dpr}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = Math.ceil(size * dpr);
  c.height = Math.ceil(size * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.translate(size / 2, size * 0.56);
  drawBust(ctx, heroId, size * 0.92, 0);
  cache.set(key, c);
  return c;
}

/** Paints a hero bust into an existing <canvas> element (cards, pips). */
export function paintCard(canvasEl, heroId, opts = {}) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const rect = canvasEl.getBoundingClientRect();
  const w = Math.max(24, rect.width || opts.w || 90);
  const h = Math.max(24, rect.height || opts.h || 90);
  canvasEl.width = Math.round(w * dpr);
  canvasEl.height = Math.round(h * dpr);
  const ctx = canvasEl.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const hero = HERO_BY_ID[heroId];
  if (!hero) return;

  if (opts.backdrop !== false) {
    const g = ctx.createRadialGradient(w / 2, h * 0.42, 2, w / 2, h * 0.42, Math.max(w, h) * 0.7);
    g.addColorStop(0, withAlpha(hero.art.aura, 0.5));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (opts.full) {
    drawPortrait(ctx, heroId, w, h, opts.t || 0, { glow: false });
  } else {
    ctx.save();
    ctx.translate(w / 2, h * 0.62);
    drawBust(ctx, heroId, Math.min(w, h) * 0.98, opts.t || 0);
    ctx.restore();
  }
}

export { withAlpha, shade };
