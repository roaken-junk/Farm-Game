// Procedurally drawn treasure chests + the shop's gem/gold icons.
// Styled as lacquered Japanese boxes with rope ties and a hanko seal.

import { TAU } from '../core/math.js';
import { withAlpha, shade } from './characters.js';

export function drawChest(ctx, chest, size, t = 0, opts = {}) {
  const s = size / 100;
  const open = opts.open || 0;
  const bob = Math.sin(t * 2.2) * 2 * (opts.idle ? 1 : 0);

  ctx.save();
  ctx.scale(s, s);
  ctx.translate(0, bob);

  // glow
  if (opts.glow !== false) {
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 74);
    g.addColorStop(0, withAlpha(chest.color, 0.5));
    g.addColorStop(1, withAlpha(chest.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 74, 0, TAU); ctx.fill();
  }

  // shadow
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 40, 40, 9, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -4); ctx.lineTo(40, -4);
    ctx.lineTo(36, 36); ctx.lineTo(-36, 36);
    ctx.closePath();
  };

  const bg = ctx.createLinearGradient(-40, -4, 40, 36);
  bg.addColorStop(0, shade(chest.color, 0.18));
  bg.addColorStop(0.55, chest.color);
  bg.addColorStop(1, chest.color2);
  body(); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = '#2b1a3f'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();

  // wood grain
  ctx.save();
  body(); ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  for (let i = -3; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 12, -4); ctx.lineTo(i * 12 - 2, 36);
    ctx.stroke();
  }
  ctx.restore();

  // lid
  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(-open * 1.05);
  ctx.translate(0, 4);
  const lg = ctx.createLinearGradient(-42, -30, 42, -4);
  lg.addColorStop(0, shade(chest.color, 0.3));
  lg.addColorStop(1, chest.color2);
  ctx.beginPath();
  ctx.moveTo(-42, -4);
  ctx.quadraticCurveTo(-40, -30, 0, -32);
  ctx.quadraticCurveTo(40, -30, 42, -4);
  ctx.closePath();
  ctx.fillStyle = lg; ctx.fill();
  ctx.strokeStyle = '#2b1a3f'; ctx.lineWidth = 4; ctx.stroke();

  // gold trim
  ctx.strokeStyle = '#ffd97a'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-36, -10);
  ctx.quadraticCurveTo(0, -28, 36, -10);
  ctx.stroke();
  ctx.restore();

  // rope tie
  ctx.strokeStyle = '#f2e2c4'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, -4 - open * 4); ctx.lineTo(0, 36); ctx.stroke();
  ctx.strokeStyle = '#d8c5a4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-36, 14); ctx.lineTo(36, 14); ctx.stroke();

  // hanko seal
  ctx.fillStyle = '#e8463c';
  ctx.beginPath(); ctx.roundRect(-13, 2, 26, 26, 5); ctx.fill();
  ctx.strokeStyle = '#8b1f14'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff4e8';
  ctx.font = '900 19px "Hiragino Sans",serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(chest.jp ? chest.jp[0] : '宝', 0, 16);

  // sparkles
  if (opts.sparkle !== false) {
    for (let i = 0; i < 4; i++) {
      const a = t * 1.4 + (i / 4) * TAU;
      const rr = 46 + Math.sin(t * 3 + i) * 6;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.6 - 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.globalAlpha = 0.55 + Math.sin(t * 5 + i) * 0.4;
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const aa = (k / 4) * TAU;
        ctx.lineTo(Math.cos(aa) * 7, Math.sin(aa) * 7);
        ctx.lineTo(Math.cos(aa + TAU / 8) * 2.2, Math.sin(aa + TAU / 8) * 2.2);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function paintChest(canvasEl, chest, opts = {}) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const rect = canvasEl.getBoundingClientRect();
  const w = Math.max(30, rect.width || opts.w || 90);
  const h = Math.max(30, rect.height || opts.h || w);
  canvasEl.width = Math.round(w * dpr);
  canvasEl.height = Math.round(h * dpr);
  const ctx = canvasEl.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h * 0.52);
  drawChest(ctx, chest, Math.min(w, h) * 0.92, opts.t || 0, opts);
}

/** Card fragment icon used in loot lists. */
export function drawCardIcon(ctx, color, size) {
  const s = size / 100;
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.roundRect(-26, -34, 52, 68, 7);
  const g = ctx.createLinearGradient(-26, -34, 26, 34);
  g.addColorStop(0, shade(color, 0.3));
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#2b1a3f'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.beginPath(); ctx.roundRect(-19, -27, 38, 30, 4); ctx.fill();
  ctx.restore();
}

/** The little crest that plays on the boot screen. */
export function drawCrest(ctx, size, t) {
  const s = size / 200;
  ctx.save();
  ctx.scale(s, s);

  ctx.rotate(Math.sin(t * 0.8) * 0.05);

  // outer ring
  const g = ctx.createLinearGradient(-90, -90, 90, 90);
  g.addColorStop(0, '#ff86b8');
  g.addColorStop(0.5, '#ff5f9e');
  g.addColorStop(1, '#d92b6b');
  ctx.beginPath(); ctx.arc(0, 0, 86, 0, TAU);
  ctx.strokeStyle = g; ctx.lineWidth = 12; ctx.stroke();

  ctx.beginPath(); ctx.arc(0, 0, 72, 0, TAU);
  ctx.fillStyle = 'rgba(30,16,50,.85)'; ctx.fill();

  // five-petal blossom
  ctx.save();
  ctx.rotate(t * 0.35);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * TAU);
    const pg = ctx.createLinearGradient(0, -60, 0, -6);
    pg.addColorStop(0, '#ffd7e6');
    pg.addColorStop(1, '#ff5f9e');
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(-26, -34, -11, -58);
    ctx.quadraticCurveTo(-4, -66, 0, -52);
    ctx.quadraticCurveTo(4, -66, 11, -58);
    ctx.quadraticCurveTo(26, -34, 0, -8);
    ctx.closePath();
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(43,26,63,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU);
  ctx.fillStyle = '#ffcf5c'; ctx.fill();
  ctx.strokeStyle = '#e39a1c'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}
