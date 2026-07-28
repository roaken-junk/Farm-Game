// Particle + effect layer for the battle. Everything here is cosmetic —
// it reads world events and never writes back to the simulation.

import { TAU, clamp, lerp } from '../core/math.js';
import { withAlpha } from './characters.js';

export class Fx {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.bolts = [];
    this.slashes = [];
    this.trails = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flash = 0;
    this.flashColor = '#fff';
    this.slowmo = 0;
  }

  clear() {
    this.parts.length = 0; this.rings.length = 0; this.texts.length = 0;
    this.bolts.length = 0; this.slashes.length = 0; this.trails.length = 0;
    this.shake = 0; this.flash = 0; this.slowmo = 0;
  }

  /* ------------------------------ spawners ------------------------------ */

  burst(x, y, color, n = 14, speed = 340, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.6;
      const sp = speed * (0.45 + Math.random() * 0.85);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: opts.life || 0.45 + Math.random() * 0.35,
        r: opts.r || 4 + Math.random() * 6,
        color, kind: opts.kind || 'spark', spin: (Math.random() - 0.5) * 8, rot: Math.random() * TAU,
        drag: opts.drag ?? 0.06,
      });
    }
  }

  petals(x, y, color, n = 10, speed = 210) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.3 + Math.random());
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0, max: 0.9 + Math.random() * 0.7, r: 5 + Math.random() * 5,
        color, kind: 'petal', spin: (Math.random() - 0.5) * 6, rot: Math.random() * TAU, drag: 0.5,
      });
    }
  }

  ring(x, y, color, r0, r1, life = 0.45, width = 8, kind = 'ring') {
    this.rings.push({ x, y, color, r0, r1, life: 0, max: life, width, kind });
  }

  text(x, y, str, color, opts = {}) {
    this.texts.push({
      x, y, str, color, life: 0, max: opts.life || 0.9,
      size: opts.size || 30, vy: opts.vy ?? -70, crit: !!opts.crit, jp: !!opts.jp,
    });
  }

  bolt(x1, y1, x2, y2, color = '#ffe066') {
    const segs = 9;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const off = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * 60;
      const nx = -(y2 - y1), ny = x2 - x1;
      const l = Math.hypot(nx, ny) || 1;
      pts.push({ x: lerp(x1, x2, t) + (nx / l) * off, y: lerp(y1, y2, t) + (ny / l) * off });
    }
    this.bolts.push({ pts, life: 0, max: 0.32, color });
  }

  slash(x, y, angle, color = '#fff', size = 190) {
    this.slashes.push({ x, y, angle, color, size, life: 0, max: 0.34 });
  }

  trail(x, y, color, r) {
    this.trails.push({ x, y, color, r, life: 0, max: 0.34 });
  }

  kick(amount, color) {
    this.shake = Math.max(this.shake, amount);
    if (color) { this.flash = Math.max(this.flash, Math.min(0.55, amount / 26)); this.flashColor = color; }
  }

  /* -------------------------------- update ------------------------------- */

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      const f = Math.pow(p.drag, dt);
      p.vx *= f; p.vy *= f;
      if (p.kind === 'petal') p.vy += 120 * dt;
      if (p.kind === 'ember') p.vy -= 90 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life >= r.max) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.25, dt);
      if (t.life >= t.max) this.texts.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life += dt;
      if (this.bolts[i].life >= this.bolts[i].max) this.bolts.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life += dt;
      if (this.slashes[i].life >= this.slashes[i].max) this.slashes.splice(i, 1);
    }
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].life += dt;
      if (this.trails[i].life >= this.trails[i].max) this.trails.splice(i, 1);
    }

    this.shake *= Math.pow(0.0016, dt);
    if (this.shake < 0.4) this.shake = 0;
    this.shakeX = (Math.random() - 0.5) * this.shake * 2;
    this.shakeY = (Math.random() - 0.5) * this.shake * 2;
    this.flash *= Math.pow(0.0009, dt);
    this.slowmo = Math.max(0, this.slowmo - dt);
  }

  /* -------------------------------- render ------------------------------- */

  drawBelow(ctx) {
    // trails sit under the units
    for (const t of this.trails) {
      const k = 1 - t.life / t.max;
      ctx.globalAlpha = k * 0.4;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (0.5 + k * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const r of this.rings) {
      if (r.kind !== 'ground') continue;
      const k = r.life / r.max;
      const rad = lerp(r.r0, r.r1, k);
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawAbove(ctx) {
    // rings
    for (const r of this.rings) {
      if (r.kind === 'ground') continue;
      const k = r.life / r.max;
      const rad = lerp(r.r0, r.r1, k);
      ctx.globalAlpha = (1 - k) * (r.kind === 'shock' ? 0.95 : 0.8);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.7);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
      if (r.kind === 'shock') {
        ctx.globalAlpha = (1 - k) * 0.25;
        ctx.fillStyle = r.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // slashes — a crescent wipe
    for (const s of this.slashes) {
      const k = s.life / s.max;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = (1 - k) * 0.95;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      const L = s.size * (0.5 + k * 0.9);
      ctx.moveTo(-L, 0);
      ctx.quadraticCurveTo(0, -L * 0.42 * (1 - k), L, 0);
      ctx.quadraticCurveTo(0, -L * 0.16 * (1 - k), -L, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // lightning
    for (const b of this.bolts) {
      const k = b.life / b.max;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 9 * (1 - k);
      ctx.shadowColor = b.color; ctx.shadowBlur = 22;
      ctx.beginPath();
      b.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3.4 * (1 - k);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // particles
    for (const p of this.parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = 1 - k * k;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.kind === 'petal') {
        const r = p.r;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(r * 0.85, -r * 0.3, 0, r);
        ctx.quadraticCurveTo(-r * 0.85, -r * 0.3, 0, -r);
        ctx.fill();
      } else if (p.kind === 'shard') {
        ctx.beginPath();
        ctx.moveTo(0, -p.r * 1.4); ctx.lineTo(p.r * 0.5, 0);
        ctx.lineTo(0, p.r * 1.4); ctx.lineTo(-p.r * 0.5, 0);
        ctx.closePath(); ctx.fill();
      } else if (p.kind === 'streak') {
        ctx.fillRect(-p.r * 2.6, -p.r * 0.28, p.r * 5.2, p.r * 0.56);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r * (1 - k * 0.55), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // floating numbers / callouts
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.16 ? lerp(0.4, 1.15, k / 0.16) : k < 0.28 ? lerp(1.15, 1, (k - 0.16) / 0.12) : 1;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      ctx.globalAlpha = clamp((1 - k) * 2.2, 0, 1);
      ctx.font = `900 ${t.size}px ${t.jp ? '"Hiragino Sans","Yu Gothic",sans-serif' : '"Avenir Next",Helvetica,sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.size * 0.26;
      ctx.strokeStyle = 'rgba(30,12,50,.92)';
      ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx, w, h) {
    if (this.flash > 0.01) {
      ctx.globalAlpha = clamp(this.flash, 0, 0.7);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

/* ---------------------- ambient weather for arenas ---------------------- */

export class Ambient {
  constructor(kind, w, h) {
    this.kind = kind;
    this.w = w; this.h = h;
    this.items = [];
    const n = kind === 'star' ? 60 : 34;
    for (let i = 0; i < n; i++) this.items.push(this.make(true));
  }

  make(initial) {
    const k = this.kind;
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : -40,
      vx: (k === 'snow' ? -30 : k === 'ember' ? 12 : -46) + (Math.random() - 0.5) * 46,
      vy: k === 'ember' ? -(60 + Math.random() * 90) : 40 + Math.random() * 90,
      r: (k === 'star' ? 2 : 7) + Math.random() * (k === 'star' ? 2 : 8),
      rot: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 2.4,
      tw: Math.random() * TAU,
      sway: Math.random() * TAU,
    };
  }

  update(dt) {
    for (const p of this.items) {
      p.sway += dt * 1.6;
      p.x += (p.vx + Math.sin(p.sway) * 26) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.tw += dt * 3;
      const off = this.kind === 'ember' ? p.y < -50 : p.y > this.h + 50;
      if (off || p.x < -60 || p.x > this.w + 60) {
        Object.assign(p, this.make(false));
        if (this.kind === 'ember') p.y = this.h + 30;
      }
    }
  }

  draw(ctx, color) {
    const k = this.kind;
    for (const p of this.items) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (k === 'star') {
        ctx.globalAlpha = 0.35 + Math.sin(p.tw) * 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, p.r * 0.5, 0, TAU); ctx.fill();
      } else if (k === 'snow') {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#eaf6ff';
        ctx.beginPath(); ctx.arc(0, 0, p.r * 0.42, 0, TAU); ctx.fill();
      } else if (k === 'ember') {
        ctx.globalAlpha = 0.55 + Math.sin(p.tw) * 0.35;
        ctx.fillStyle = '#ff8a3c';
        ctx.beginPath(); ctx.arc(0, 0, p.r * 0.34, 0, TAU); ctx.fill();
      } else if (k === 'spark') {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color || '#63b6ff';
        ctx.fillRect(-p.r * 0.2, -p.r * 1.4, p.r * 0.4, p.r * 2.8);
      } else if (k === 'leaf') {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#7ad6a8';
        ctx.beginPath();
        ctx.moveTo(0, -p.r); ctx.quadraticCurveTo(p.r * 0.7, 0, 0, p.r);
        ctx.quadraticCurveTo(-p.r * 0.7, 0, 0, -p.r);
        ctx.fill();
      } else { // sakura
        ctx.globalAlpha = 0.62;
        ctx.fillStyle = Math.random() > 0.5 ? '#ffc7dd' : '#ff9ec4';
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.quadraticCurveTo(p.r * 0.85, -p.r * 0.25, 0, p.r * 0.9);
        ctx.quadraticCurveTo(-p.r * 0.85, -p.r * 0.25, 0, -p.r);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

export { withAlpha };
