// Battlefield rendering: stage, hazards, decor and the hero "tokens".
// Kept separate from the simulation so the look can change freely.

import { ARENA_W, ARENA_H } from '../data/arenas.js';
import { HERO_BY_ID } from '../data/heroes.js';
import { drawBust, withAlpha, shade } from './characters.js';
import { TAU, clamp, norm } from '../core/math.js';

/* ------------------------------ background ------------------------------ */

export function drawStage(ctx, arena, t) {
  const th = arena.theme;

  // sky / backdrop
  const sky = ctx.createLinearGradient(0, -260, 0, ARENA_H + 260);
  sky.addColorStop(0, shade(th.sky, 0.12));
  sky.addColorStop(0.5, th.sky);
  sky.addColorStop(1, shade(th.sky, -0.35));
  ctx.fillStyle = sky;
  ctx.fillRect(-400, -400, ARENA_W + 800, ARENA_H + 800);

  // giant kanji watermark
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = th.line;
  ctx.font = `900 ${ARENA_W * 0.85}px "Hiragino Sans","Yu Gothic",serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(th.banner, ARENA_W / 2, ARENA_H / 2);
  ctx.restore();

  if (arena.decor.skyline) drawSkyline(ctx, th, t);
  if (arena.decor.bamboo) drawBamboo(ctx, th, t);
  if (arena.decor.torii) drawTorii(ctx, th);

  drawFloor(ctx, arena, t);

  if (arena.decor.lanterns) drawLanterns(ctx, th, arena.decor.lanterns, t);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx, arena, t) {
  const th = arena.theme;
  const R = 56;

  // drop shadow under the platform
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#000';
  roundRect(ctx, -14, 18, ARENA_W + 28, ARENA_H + 26, R + 10);
  ctx.filter = 'blur(0px)';
  ctx.fill();
  ctx.restore();

  const g = ctx.createLinearGradient(0, 0, ARENA_W, ARENA_H);
  g.addColorStop(0, th.floor);
  g.addColorStop(1, th.floor2);
  roundRect(ctx, 0, 0, ARENA_W, ARENA_H, R);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, ARENA_W, ARENA_H, R);
  ctx.clip();

  // tatami / plank grid
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = th.line;
  ctx.lineWidth = 3;
  for (let y = 0; y <= ARENA_H; y += 125) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
  }
  for (let x = 0; x <= ARENA_W; x += 125) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // centre line + emblem
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = th.line;
  ctx.lineWidth = 5;
  ctx.setLineDash([26, 22]);
  ctx.beginPath(); ctx.moveTo(0, ARENA_H / 2); ctx.lineTo(ARENA_W, ARENA_H / 2); ctx.stroke();
  ctx.setLineDash([]);

  const pulse = 1 + Math.sin(t * 1.6) * 0.03;
  ctx.globalAlpha = 0.26;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(ARENA_W / 2, ARENA_H / 2, 145 * pulse, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(ARENA_W / 2, ARENA_H / 2, 108 * pulse, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // vignette
  const vg = ctx.createRadialGradient(ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.3, ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.restore();

  // glowing rim
  roundRect(ctx, 0, 0, ARENA_W, ARENA_H, R);
  ctx.strokeStyle = withAlpha(th.glow, 0.85);
  ctx.lineWidth = 9;
  ctx.shadowColor = th.glow;
  ctx.shadowBlur = 34;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawTorii(ctx, th) {
  const y = -120, w = ARENA_W * 0.82, x = (ARENA_W - w) / 2;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#c0392b';
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 4;
  // pillars
  ctx.fillRect(x, y, 34, 190);
  ctx.fillRect(x + w - 34, y, 34, 190);
  // beams
  ctx.beginPath();
  ctx.moveTo(x - 60, y);
  ctx.lineTo(x + w + 60, y);
  ctx.lineTo(x + w + 44, y + 30);
  ctx.lineTo(x - 44, y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 20, y + 52, w + 40, 22);
  ctx.fillStyle = '#8b1f14';
  ctx.fillRect(x - 20, y + 68, w + 40, 8);
  ctx.restore();
}

function drawSkyline(ctx, th, t) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  let seed = 1;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer === 0 ? shade(th.sky, -0.4) : shade(th.sky, -0.62);
    let x = -300;
    while (x < ARENA_W + 300) {
      const w = 60 + rnd() * 110;
      const h = 160 + rnd() * (layer === 0 ? 300 : 460);
      const y = -80 - layer * 40;
      ctx.fillRect(x, y - h + 300, w, h + 400);
      // windows
      ctx.fillStyle = withAlpha(th.accent, 0.5);
      for (let wy = y - h + 320; wy < y + 260; wy += 26) {
        for (let wx = x + 8; wx < x + w - 10; wx += 20) {
          if (rnd() > 0.55) ctx.fillRect(wx, wy, 8, 12);
        }
      }
      ctx.fillStyle = layer === 0 ? shade(th.sky, -0.4) : shade(th.sky, -0.62);
      x += w + 16 + rnd() * 28;
    }
  }
  ctx.restore();
}

function drawBamboo(ctx, th, t) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 14; i++) {
    const x = -150 + i * 95 + Math.sin(t * 0.5 + i) * 8;
    const w = 22 + (i % 3) * 6;
    ctx.fillStyle = i % 2 ? '#3f6b4f' : '#35603f';
    ctx.fillRect(x, -300, w, ARENA_H + 600);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = -300; y < ARENA_H + 300; y += 150) ctx.fillRect(x, y, w, 7);
  }
  ctx.restore();
}

function drawLanterns(ctx, th, n, t) {
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side < 0 ? -78 : ARENA_W + 78;
    const y = 200 + Math.floor(i / 2) * 460 + Math.sin(t * 1.1 + i) * 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.9 + i) * 0.07);
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -140); ctx.lineTo(0, -46); ctx.stroke();

    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 120);
    g.addColorStop(0, 'rgba(255,180,90,.5)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, TAU); ctx.fill();

    ctx.fillStyle = '#e8463c';
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 50, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    for (let k = -2; k <= 2; k++) ctx.fillRect(-40, k * 16 - 2, 80, 3);
    ctx.fillStyle = '#2b1a3f';
    ctx.fillRect(-16, -54, 32, 10);
    ctx.fillRect(-16, 44, 32, 10);
    ctx.fillStyle = '#fdf4e6';
    ctx.font = '900 34px "Hiragino Sans",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(th.banner, 0, 2);
    ctx.restore();
  }
}

/* -------------------------------- hazards ------------------------------- */

export function drawHazards(ctx, world, arena, t) {
  const th = arena.theme;
  for (const h of world.hazards) {
    if (h.type === 'pit') {
      const g = ctx.createRadialGradient(h.x, h.y, h.r * 0.1, h.x, h.y, h.r);
      g.addColorStop(0, '#000');
      g.addColorStop(0.72, '#07040f');
      g.addColorStop(1, withAlpha(th.floor2, 0.9));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();

      ctx.strokeStyle = withAlpha(th.glow, 0.5 + h.pulse * 0.5);
      ctx.lineWidth = 5 + h.pulse * 8;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = th.line;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const rr = h.r * (0.35 + i * 0.22) + Math.sin(t * 1.4 + i) * 5;
        ctx.beginPath(); ctx.arc(h.x, h.y, rr, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    } else if (h.type === 'spike') {
      const hot = arena.decor.lava;
      const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r * 1.15);
      g.addColorStop(0, hot ? '#fff0b0' : '#eaf7ff');
      g.addColorStop(0.45, hot ? '#ff6a2a' : '#8fd8ff');
      g.addColorStop(1, hot ? 'rgba(255,60,20,.15)' : 'rgba(120,200,255,.12)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 1.12, 0, TAU); ctx.fill();

      const n = 9;
      ctx.fillStyle = hot ? '#ffb347' : '#dff2ff';
      ctx.strokeStyle = 'rgba(30,16,50,.6)';
      ctx.lineWidth = 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + t * (hot ? 0.5 : 0.25);
        const L = h.r * (0.85 + Math.sin(t * 3 + i) * 0.1);
        ctx.beginPath();
        ctx.moveTo(h.x + Math.cos(a) * L, h.y + Math.sin(a) * L);
        ctx.lineTo(h.x + Math.cos(a + 0.32) * h.r * 0.34, h.y + Math.sin(a + 0.32) * h.r * 0.34);
        ctx.lineTo(h.x + Math.cos(a - 0.32) * h.r * 0.34, h.y + Math.sin(a - 0.32) * h.r * 0.34);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    } else if (h.type === 'bumper') {
      const p = 1 + h.pulse * 0.28;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(p, p);
      const g = ctx.createRadialGradient(0, -h.r * 0.3, 4, 0, 0, h.r);
      g.addColorStop(0, '#fff3d0');
      g.addColorStop(0.5, th.accent);
      g.addColorStop(1, shade(th.accent, -0.45));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, h.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30,16,50,.7)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 0.8 * (0.5 + h.pulse * 0.5);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, h.r * 0.66, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(43,26,63,.75)';
      ctx.font = `900 ${h.r * 0.9}px "Hiragino Sans",serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('弾', 0, 2);
      ctx.restore();
    }
  }
}

/* --------------------------------- units -------------------------------- */

const SIDE_COLORS = [
  { rim: '#ffcf5c', rim2: '#e39a1c', hp: '#5ce08a', hp2: '#2fae63' },
  { rim: '#a56bff', rim2: '#6b3fd6', hp: '#ff7b7b', hp2: '#d63232' },
];

export function drawUnit(ctx, u, t, opts = {}) {
  const hero = HERO_BY_ID[u.heroId];
  const col = SIDE_COLORS[u.side];
  const R = u.r;

  ctx.save();
  ctx.translate(u.x, u.y);

  if (u.falling > 0) {
    const k = clamp(u.falling, 0, 1);
    ctx.scale(1 - k * 0.85, 1 - k * 0.85);
    ctx.rotate(k * 3);
    ctx.globalAlpha = 1 - k * 0.7;
  }

  // ground shadow
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(3, R * 0.42, R * 0.94, R * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // charged aura
  if (u.charged && u.alive) {
    const pulse = 0.55 + Math.sin(t * 6) * 0.25;
    const g = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 1.9);
    g.addColorStop(0, withAlpha('#ffcf5c', 0.55 * pulse));
    g.addColorStop(1, 'rgba(255,207,92,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R * 1.9, 0, TAU); ctx.fill();
  }

  if (opts.active) {
    const pulse = 0.5 + Math.sin(t * 7) * 0.3;
    ctx.strokeStyle = withAlpha('#ffffff', 0.5 + pulse * 0.4);
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 9]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.arc(0, 0, R + 15, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  } else if (opts.selectable) {
    // a soft breathing halo: "you may fire this one", without the noise of
    // four dashed rings competing for attention
    ctx.globalAlpha = 0.28 + Math.sin(t * 3 + u.slot) * 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R + 11, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // token body
  const tilt = clamp(u.spin, -0.3, 0.3);
  ctx.rotate(tilt);

  const rim = ctx.createLinearGradient(-R, -R, R, R);
  rim.addColorStop(0, shade(col.rim, 0.35));
  rim.addColorStop(0.5, col.rim);
  rim.addColorStop(1, col.rim2);
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(28,14,45,.85)';
  ctx.lineWidth = 4;
  ctx.stroke();

  const inner = R * 0.82;
  const bg = ctx.createRadialGradient(0, -inner * 0.3, 3, 0, 0, inner);
  bg.addColorStop(0, withAlpha(hero.art.aura, 0.95));
  bg.addColorStop(1, shade(hero.art.aura, -0.6));
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0, 0, inner, 0, TAU); ctx.fill();

  // hero art, clipped into the disc
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, inner, 0, TAU); ctx.clip();
  ctx.translate(0, inner * 0.42);
  drawBust(ctx, u.heroId, inner * 2.05, t + u.slot);
  ctx.restore();

  ctx.strokeStyle = 'rgba(28,14,45,.5)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, inner, 0, TAU); ctx.stroke();

  ctx.rotate(-tilt);

  // HP arc
  const hpFrac = clamp(u.hp / u.hpMax, 0, 1);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, R + 5.5, -Math.PI * 0.82, -Math.PI * 0.18);
  ctx.stroke();
  const hg = ctx.createLinearGradient(-R, 0, R, 0);
  hg.addColorStop(0, col.hp);
  hg.addColorStop(1, col.hp2);
  ctx.strokeStyle = hg;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.arc(0, 0, R + 5.5, -Math.PI * 0.82, -Math.PI * 0.82 + Math.PI * 0.64 * hpFrac);
  ctx.stroke();

  // rage arc (bottom)
  if (u.alive) {
    const rageFrac = clamp(u.rage / 100, 0, 1);
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, R + 5.5, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    if (rageFrac > 0.01) {
      ctx.strokeStyle = u.charged ? '#fff3c4' : '#ffcf5c';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, R + 5.5, Math.PI * 0.82 - Math.PI * 0.64 * rageFrac, Math.PI * 0.82);
      ctx.stroke();
    }
  }

  // status overlays
  if (u.frozen > 0) {
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath(); ctx.arc(0, 0, R * 1.04, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#eaf8ff';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
      ctx.lineTo(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (u.burn > 0) {
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 5; i++) {
      const a = t * 4 + (i / 5) * TAU;
      const fy = -R - 6 - ((t * 90 + i * 30) % 34);
      ctx.fillStyle = i % 2 ? '#ff8a3c' : '#ffd23f';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.6, fy + R * 0.4, 6 - (i % 3), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (u.shieldTurns > 0) {
    ctx.globalAlpha = 0.4 + Math.sin(t * 4) * 0.12;
    ctx.strokeStyle = '#4be3c8';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R + 13, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(75,227,200,.12)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawDeadMarker(ctx, u, t) {
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  const R = u.r * 0.55;
  ctx.beginPath();
  ctx.moveTo(-R, -R); ctx.lineTo(R, R);
  ctx.moveTo(R, -R); ctx.lineTo(-R, R);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------- projectiles ----------------------------- */

export function drawProjectile(ctx, p, t) {
  const hero = HERO_BY_ID[p.heroId];
  const color = hero ? hero.art.aura : '#fff';
  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.kind === 'clone') {
    ctx.globalAlpha = 0.72;
    ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r * 1.4);
    g.addColorStop(0, withAlpha(color, 0.9));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 1.5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.clip();
    ctx.translate(0, p.r * 0.4);
    drawBust(ctx, p.heroId, p.r * 2, t);
    ctx.restore();
    ctx.strokeStyle = withAlpha(color, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.stroke();
  } else {
    // foxfire wisp
    const flick = 1 + Math.sin(t * 18 + p.id) * 0.16;
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, p.r * 2.6 * flick);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, withAlpha(color, 0.95));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 2.6 * flick, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.45, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* -------------------------------- aim guide ------------------------------ */

export function drawAimGuide(ctx, unit, dirX, dirY, power, world, t) {
  const [nx, ny] = norm(dirX, dirY);
  ctx.save();

  // pull-back arrow behind the hero
  const back = unit.r + 12;
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(unit.x - nx * back, unit.y - ny * back);
  ctx.lineTo(unit.x - nx * (back + 90 * power), unit.y - ny * (back + 90 * power));
  ctx.stroke();
  ctx.setLineDash([]);

  // Forward trajectory preview: bounces off the walls and stops at the first
  // hero it would actually strike, so the dotted line never lies to you.
  let px = unit.x, py = unit.y, vx = nx, vy = ny;
  const total = 240 + power * 640;
  let travelled = 0;
  const stepLen = 22;
  let i = 0;
  let contact = null;
  while (travelled < total && i < 90 && !contact) {
    px += vx * stepLen; py += vy * stepLen;
    if (px < unit.r) { px = unit.r; vx = -vx; }
    if (px > ARENA_W - unit.r) { px = ARENA_W - unit.r; vx = -vx; }
    if (py < unit.r) { py = unit.r; vy = -vy; }
    if (py > ARENA_H - unit.r) { py = ARENA_H - unit.r; vy = -vy; }
    travelled += stepLen;
    i++;

    for (const o of world.units) {
      if (!o.alive || o.id === unit.id || o.falling > 0) continue;
      const dx = o.x - px, dy = o.y - py;
      if (dx * dx + dy * dy < (o.r + unit.r) * (o.r + unit.r)) { contact = o; break; }
    }
    for (const h of world.hazards) {
      if (h.type !== 'pit') continue;
      const dx = h.x - px, dy = h.y - py;
      if (dx * dx + dy * dy < h.r * h.r * 0.36) { contact = h; break; }
    }

    const k = 1 - travelled / total;
    ctx.globalAlpha = 0.14 + k * 0.65;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, py, 3.2 + k * 3.6, 0, TAU);
    ctx.fill();
  }

  // mark the predicted impact
  if (contact) {
    const foe = contact.side !== undefined && contact.side !== unit.side;
    const col = contact.type === 'pit' ? '#a56bff' : foe ? '#ff5f9e' : '#ffcf5c';
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -t * 60;
    ctx.beginPath();
    ctx.arc(contact.x, contact.y, (contact.r || 40) + 12, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // aim head
  ctx.globalAlpha = 0.9;
  const hx = unit.x + nx * (unit.r + 30 + power * 34);
  const hy = unit.y + ny * (unit.r + 30 + power * 34);
  ctx.translate(hx, hy);
  ctx.rotate(Math.atan2(ny, nx));
  ctx.fillStyle = power > 0.85 ? '#ff5f9e' : '#ffcf5c';
  ctx.beginPath();
  ctx.moveTo(26, 0); ctx.lineTo(-12, -15); ctx.lineTo(-4, 0); ctx.lineTo(-12, 15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,14,50,.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // power ring around the hero
  ctx.save();
  ctx.translate(unit.x, unit.y);
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(0, 0, unit.r + 24, 0, TAU); ctx.stroke();
  ctx.strokeStyle = power > 0.85 ? '#ff5f9e' : '#ffcf5c';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, unit.r + 24, -Math.PI / 2, -Math.PI / 2 + TAU * power);
  ctx.stroke();
  ctx.restore();
}
