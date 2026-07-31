/* ==========================================================================
   arcade.js — the barn arcade: three cabinets in the spirit of the old Atari
   machines, with the farm painted over them.

   Everything here is one <canvas> on a fixed W x H playfield of "arcade
   units", scaled to whatever space the phone has. Game logic never sees
   pixels, so a run plays identically on any screen.

   Each cabinet is a factory returning the same little contract:

     { score, lives, over, step(dt), draw(ctx),
       onTap?(x, y), onDrag?(x, y), onSwipe?(dx, dy), onKey?(key) }

   The engine below owns the loop, the input plumbing, the countdown and the
   results card; the games own nothing but their own rules.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import { el, fmt, clamp, haptic, randInt, pick } from './util.js';
import { SFX } from './audio.js';
import * as FX from './fx.js';

const W = 300, H = 400;          // the playfield, in arcade units

let live = null;                 // the cabinet currently on screen
export const isOpen = () => !!live;

/* ------------------------------ drawing bits ----------------------------- */

const EMOJI = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",serif';

function glyph(ctx, ch, x, y, size) {
  ctx.font = `${size}px ${EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y);
}

function label(ctx, text, x, y, size, color = '#3d2a14', align = 'left') {
  ctx.font = `800 ${size}px ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function rrect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Sky, then a band of field: the backdrop two of the three games share. */
function backdrop(ctx, groundY, sky = '#bfe7ff', ground = '#8fd05a') {
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, sky);
  grad.addColorStop(1, '#e6f6ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, groundY);
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = 'rgba(0,0,0,.07)';
  ctx.fillRect(0, groundY, W, 3);
}

/* ========================== cabinet 1 — Crow Patrol ======================= */

/**
 * Invaders. The scarecrow slides along the fence and throws kernels on its
 * own, so the whole game is one thumb dragging left and right.
 */
function makeCrows() {
  const COLS = 6, ROWS = 4;
  const PLAYER_Y = H - 30;
  const g = { score: 0, lives: 3, over: false, wave: 1, t: 0 };

  let crows = [], ox = 0, oy = 0, dir = 1, speed = 30;
  let px = W / 2, shots = [], pecks = [], fire = 0, drop = 1.4, hurt = 0;

  function spawnWave() {
    crows = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        crows.push({ x: 42 + c * 40, y: 52 + r * 30, alive: true });
      }
    }
    ox = 0;
    oy = Math.min(46, (g.wave - 1) * 9);
    dir = 1;
    speed = 26 + g.wave * 9;
    shots = [];
    pecks = [];
  }
  spawnWave();

  function loseLife(resetWave) {
    g.lives--;
    hurt = 0.7;
    pecks = [];
    SFX.error();
    haptic();
    if (g.lives <= 0) { g.over = true; return; }
    if (resetWave) spawnWave();
  }

  g.onDrag = x => { px = clamp(x, 18, W - 18); };
  g.onKey = k => {
    if (k === 'ArrowLeft') px = clamp(px - 22, 18, W - 18);
    if (k === 'ArrowRight') px = clamp(px + 22, 18, W - 18);
  };

  g.step = dt => {
    g.t += dt;
    hurt = Math.max(0, hurt - dt);

    ox += dir * speed * dt;
    if (ox > 36 || ox < -22) { ox = clamp(ox, -22, 36); dir *= -1; oy += 11; }

    fire -= dt;
    if (fire <= 0) { fire = 0.4; shots.push({ x: px, y: PLAYER_Y - 14 }); }
    for (const s of shots) s.y -= 300 * dt;

    drop -= dt;
    if (drop <= 0) {
      drop = Math.max(0.45, 1.6 - g.wave * 0.11);
      const alive = crows.filter(c => c.alive);
      if (alive.length) {
        const c = alive[randInt(0, alive.length - 1)];
        pecks.push({ x: c.x + ox, y: c.y + oy + 10 });
      }
    }
    for (const p of pecks) p.y += (120 + g.wave * 10) * dt;

    /* kernels vs crows */
    for (const s of shots) {
      for (const c of crows) {
        if (!c.alive) continue;
        if (Math.abs(s.x - (c.x + ox)) < 14 && Math.abs(s.y - (c.y + oy)) < 13) {
          c.alive = false;
          s.y = -999;
          g.score += 10 + g.wave * 2;
          SFX.plant();
          break;
        }
      }
    }
    shots = shots.filter(s => s.y > -12);

    /* pecks vs scarecrow */
    for (const p of pecks) {
      if (Math.abs(p.x - px) < 15 && Math.abs(p.y - PLAYER_Y) < 16) {
        p.y = H + 999;
        loseLife(false);
        if (g.over) return;
      }
    }
    pecks = pecks.filter(p => p.y < H + 12);

    /* the flock got to the fence */
    let lowest = 0;
    for (const c of crows) if (c.alive) lowest = Math.max(lowest, c.y + oy);
    if (lowest > PLAYER_Y - 24) { loseLife(true); return; }

    if (!crows.some(c => c.alive)) {
      g.score += 60 * g.wave;
      g.wave++;
      spawnWave();
      SFX.collect();
    }
  };

  g.draw = ctx => {
    backdrop(ctx, H - 46);

    /* fence posts along the ground line */
    ctx.fillStyle = '#c98d4e';
    for (let x = 6; x < W; x += 34) ctx.fillRect(x, H - 52, 6, 22);
    ctx.fillRect(0, H - 46, W, 5);

    for (const c of crows) if (c.alive) glyph(ctx, '🐦', c.x + ox, c.y + oy, 22);

    ctx.fillStyle = '#ffd44a';
    for (const s of shots) {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#5c4326';
    for (const p of pecks) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = hurt > 0 && Math.floor(hurt * 12) % 2 ? 0.35 : 1;
    glyph(ctx, '🧑‍🌾', px, PLAYER_Y, 30);
    ctx.globalAlpha = 1;

    label(ctx, `FLOCK ${g.wave}`, 8, 14, 11, 'rgba(30,60,80,.65)');
  };

  return g;
}

/* ========================= cabinet 2 — Chicken Run ======================== */

/**
 * Frogger. Tap the middle of the screen to hop forward, the sides to step
 * across. Every hen that reaches the coop speeds the traffic up.
 */
function makeChicken() {
  const ROWS = 8;                      // row 0 is the verge, row 8 the coop
  const LANE = 42;
  const yOf = r => H - 26 - r * LANE;
  const SPAN = W + 80;                 // how far a vehicle travels before wrapping

  const g = { score: 0, lives: 3, over: false, homes: 0, t: 0 };
  let cx = W / 2, row = 0, best = 0, mult = 1, safe = 0, hurt = 0;

  const lanes = [];
  for (let r = 1; r < ROWS; r++) {
    const gap = 104 + (r % 3) * 30;
    const n = Math.max(2, Math.round(SPAN / gap));
    lanes.push({
      r,
      dir: r % 2 ? 1 : -1,
      speed: 40 + r * 8,
      icon: r % 3 === 0 ? '🚜' : r % 3 === 1 ? '🛻' : '🚚',
      cars: Array.from({ length: n }, (_, i) => -40 + (i + (r * 0.37)) * (SPAN / n)),
    });
  }

  function backToStart(lostOne) {
    row = 0;
    best = 0;
    cx = W / 2;
    if (lostOne) {
      g.lives--;
      hurt = 0.7;
      SFX.error();
      haptic();
      if (g.lives <= 0) g.over = true;
    }
  }

  function hop() {
    if (safe > 0) return;
    row++;
    if (row > best) { best = row; g.score += 12; }
    SFX.plant();
    if (row >= ROWS) {
      g.homes++;
      g.score += 120 + g.homes * 20;
      mult = Math.min(2.6, mult + 0.12);
      safe = 0.45;
      SFX.collect();
      backToStart(false);
    }
  }

  const sideStep = d => { cx = clamp(cx + d * 32, 16, W - 16); };

  g.onTap = (x, y) => {
    if (x < W * 0.3) sideStep(-1);
    else if (x > W * 0.7) sideStep(1);
    else hop();
  };
  g.onSwipe = (dx, dy) => {
    if (Math.abs(dy) > Math.abs(dx)) { if (dy < 0) hop(); }
    else sideStep(dx > 0 ? 1 : -1);
  };
  g.onKey = k => {
    if (k === 'ArrowUp' || k === ' ') hop();
    if (k === 'ArrowLeft') sideStep(-1);
    if (k === 'ArrowRight') sideStep(1);
  };

  g.step = dt => {
    g.t += dt;
    safe = Math.max(0, safe - dt);
    hurt = Math.max(0, hurt - dt);

    for (const L of lanes) {
      const v = L.speed * mult * L.dir * dt;
      for (let i = 0; i < L.cars.length; i++) {
        L.cars[i] += v;
        if (L.cars[i] > W + 40) L.cars[i] -= SPAN;
        if (L.cars[i] < -40) L.cars[i] += SPAN;
      }
    }

    if (safe > 0 || hurt > 0) return;
    const lane = lanes.find(L => L.r === row);
    if (!lane) return;
    for (const x of lane.cars) {
      if (Math.abs(x - cx) < 27) { backToStart(true); return; }
    }
  };

  g.draw = ctx => {
    ctx.fillStyle = '#cfe9ff';
    ctx.fillRect(0, 0, W, H);

    /* the coop bank at the top, the verge at the bottom */
    ctx.fillStyle = '#8fd05a';
    ctx.fillRect(0, 0, W, yOf(ROWS) + 20);
    ctx.fillRect(0, yOf(0) - 20, W, H);

    for (const L of lanes) {
      const y = yOf(L.r);
      ctx.fillStyle = L.r % 2 ? '#9a9a96' : '#8f8f8b';
      ctx.fillRect(0, y - 20, W, 40);
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      for (let x = (g.t * 12) % 30 - 30; x < W; x += 30) ctx.fillRect(x, y - 1, 14, 2);
    }

    for (const L of lanes) {
      const y = yOf(L.r);
      for (const x of L.cars) {
        ctx.save();
        ctx.translate(x, y);
        if (L.dir < 0) ctx.scale(-1, 1);
        glyph(ctx, L.icon, 0, 0, 30);
        ctx.restore();
      }
    }

    glyph(ctx, '🏠', W / 2, yOf(ROWS), 30);

    ctx.globalAlpha = hurt > 0 && Math.floor(hurt * 12) % 2 ? 0.35 : 1;
    glyph(ctx, '🐔', cx, yOf(row), 26);
    ctx.globalAlpha = 1;

    label(ctx, `HOME ${g.homes}`, 8, 14, 11, 'rgba(30,60,30,.7)');
  };

  return g;
}

/* ========================= cabinet 3 — Hungry Goat ======================== */

/**
 * Snake. The goat never stops; tap the left half to turn left, the right half
 * to turn right. One life, as the original intended.
 */
function makeGoat() {
  const CELL = 20, COLS = W / CELL, ROWS = H / CELL;
  const VEG = ['🥕', '🥬', '🍅', '🌽', '🍆', '🍓', '🥔'];

  const g = { score: 0, lives: 1, over: false, t: 0 };
  let body = [{ x: 7, y: 12 }, { x: 7, y: 13 }, { x: 7, y: 14 }];
  let dir = { x: 0, y: -1 }, next = dir, carry = 0, rate = 6, grow = 0;
  let food = null, flash = 0;

  function placeFood() {
    const taken = new Set(body.map(b => b.x + ',' + b.y));
    let spot, guard = 0;
    do {
      spot = { x: randInt(0, COLS - 1), y: randInt(1, ROWS - 1) };
    } while (taken.has(spot.x + ',' + spot.y) && ++guard < 200);
    food = { ...spot, icon: pick(VEG) };
  }
  placeFood();

  const opposite = (a, b) => a.x === -b.x && a.y === -b.y;

  function turn(way) {
    const d = next;
    const t = way < 0 ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
    if (!opposite(t, dir)) next = t;
  }

  function face(d) { if (!opposite(d, dir)) next = d; }

  g.onTap = x => turn(x < W / 2 ? -1 : 1);
  g.onSwipe = (dx, dy) => {
    if (Math.abs(dx) > Math.abs(dy)) face({ x: dx > 0 ? 1 : -1, y: 0 });
    else face({ x: 0, y: dy > 0 ? 1 : -1 });
  };
  g.onKey = k => {
    if (k === 'ArrowLeft') face({ x: -1, y: 0 });
    if (k === 'ArrowRight') face({ x: 1, y: 0 });
    if (k === 'ArrowUp') face({ x: 0, y: -1 });
    if (k === 'ArrowDown') face({ x: 0, y: 1 });
  };

  function advance() {
    dir = next;
    const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
      g.over = true; SFX.error(); haptic(); return;
    }
    // The tail cell is about to empty, so walking into it is fair play.
    for (let i = 0; i < body.length - 1; i++) {
      if (body[i].x === head.x && body[i].y === head.y) {
        g.over = true; SFX.error(); haptic(); return;
      }
    }

    body.unshift(head);
    if (food && head.x === food.x && head.y === food.y) {
      g.score += 10 + Math.floor(rate);
      grow += 2;
      rate = Math.min(13, rate + 0.2);
      flash = 0.25;
      SFX.collect();
      placeFood();
    }
    if (grow > 0) grow--;
    else body.pop();
  }

  g.step = dt => {
    g.t += dt;
    flash = Math.max(0, flash - dt);
    carry += dt * rate;
    let steps = 0;
    while (carry >= 1 && steps++ < 4) { carry -= 1; advance(); if (g.over) return; }
  };

  g.draw = ctx => {
    /* dark tilled soil, so the vegetables and the goat both read against it */
    ctx.fillStyle = '#7a4f27';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.10)';
    for (let r = 0; r < ROWS; r++) ctx.fillRect(0, r * CELL + CELL - 4, W, 4);
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) if ((r + c) % 2) ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
    ctx.strokeStyle = '#c98d4e';
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, W - 5, H - 5);

    if (food) {
      const fx = food.x * CELL + CELL / 2, fy = food.y * CELL + CELL / 2;
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.46, 0, Math.PI * 2);
      ctx.fill();
      glyph(ctx, food.icon, fx, fy, 17);
    }

    for (let i = body.length - 1; i > 0; i--) {
      const b = body[i];
      ctx.fillStyle = i % 2 ? '#f4ece0' : '#ddd0bb';
      rrect(ctx, b.x * CELL + 2, b.y * CELL + 2, CELL - 4, CELL - 4, 6);
      ctx.fill();
    }
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(0, 0, W, H);
    }
    glyph(ctx, '🐐', body[0].x * CELL + CELL / 2, body[0].y * CELL + CELL / 2, 20);

    label(ctx, `LENGTH ${body.length}`, 8, 14, 11, 'rgba(255,255,255,.85)');
  };

  return g;
}

const BUILDERS = { crows: makeCrows, chicken: makeChicken, goat: makeGoat };

/* ================================ the engine ============================= */

/**
 * Opens a cabinet full-screen. `onDone` fires once, when the player leaves,
 * so the arcade tab can repaint the wallet and the high scores.
 */
export function open(gameId, onDone) {
  if (live) return;
  const game = D.ARCADE.find(x => x.id === gameId);
  const build = BUILDERS[gameId];
  if (!game || !build) return;

  /* ------------------------------- chrome ------------------------------- */

  const root = el('div', 'cab');
  const head = el('div', 'cab-head');
  head.innerHTML =
    `<span class="cab-name">${game.icon} ${game.name}</span>
     <span class="cab-stat" id="cab-score">0</span>
     <span class="cab-stat cab-lives" id="cab-lives"></span>`;
  const quit = el('button', 'cab-x', '✕');
  quit.setAttribute('aria-label', 'Leave the arcade');
  head.appendChild(quit);

  const stage = el('div', 'cab-stage');
  const canvas = el('canvas', 'cab-screen');
  stage.appendChild(canvas);

  const hint = el('div', 'cab-hint', game.how);
  root.append(head, stage, hint);
  document.body.appendChild(root);

  const ctx = canvas.getContext('2d');

  function fit() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = Math.max(120, Math.min(r.width, r.height * W / H));
    const cssH = cssW * H / W;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  /* -------------------------------- input -------------------------------- */

  const at = e => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / Math.max(1, r.width) * W,
      y: (e.clientY - r.top) / Math.max(1, r.height) * H,
    };
  };

  let press = null;

  const onDown = e => {
    if (phase === 'over') return;
    const p = at(e);
    press = p;
    if (g.onDrag) g.onDrag(p.x, p.y);
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ } }
  };
  const onMove = e => {
    if (!press) return;
    const p = at(e);
    if (g.onDrag) g.onDrag(p.x, p.y);
    if (e.cancelable) e.preventDefault();
  };
  const onUp = e => {
    if (!press || phase === 'over') { press = null; return; }
    const p = at(e);
    const dx = p.x - press.x, dy = p.y - press.y;
    if (Math.abs(dx) + Math.abs(dy) > 16) { if (g.onSwipe) g.onSwipe(dx, dy); }
    else if (g.onTap) g.onTap(p.x, p.y);
    press = null;
  };
  const onKey = e => {
    if (e.key === 'Escape') { leave(); return; }
    if (phase !== 'play') return;
    if (g.onKey) g.onKey(e.key);
    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { press = null; });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', fit);

  /* --------------------------------- loop -------------------------------- */

  let g = build();
  let phase = 'ready', wait = 1.1, raf = 0, last = 0;
  const scoreEl = head.querySelector('#cab-score');
  const livesEl = head.querySelector('#cab-lives');

  function paintChrome() {
    scoreEl.textContent = fmt(g.score);
    livesEl.textContent = g.lives > 0 ? '❤️'.repeat(Math.min(5, g.lives)) : '';
  }

  function paint() {
    g.draw(ctx);
    if (phase === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,.32)';
      ctx.fillRect(0, 0, W, H);
      const n = Math.max(1, Math.ceil(wait));
      label(ctx, String(n), W / 2, H / 2 - 12, 64, '#fff', 'center');
      label(ctx, 'GET READY', W / 2, H / 2 + 34, 16, '#fff', 'center');
    }
    paintChrome();
  }

  function frame(ts) {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    if (phase === 'ready') {
      wait -= dt;
      if (wait <= 0) phase = 'play';
    } else if (phase === 'play') {
      g.step(dt);
      if (g.over) { finish(); return; }
    }
    paint();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    g = build();
    phase = 'ready';
    wait = 1.1;
    last = 0;
    fit();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------- results ------------------------------- */

  function finish() {
    phase = 'over';
    cancelAnimationFrame(raf);
    paint();

    const r = G.arcadeFinish(game.id, g.score);
    if (r && r.gems) FX.confetti(60);

    const card = el('div', 'cab-over');
    const next = game.gemAt.find(t => t > g.score);
    const bits = [];
    bits.push(`<div class="cab-final"><small>Score</small><b>${fmt(g.score)}</b></div>`);
    if (r && r.isBest) bits.push('<div class="cab-best">🏆 New personal best!</div>');
    else if (r) bits.push(`<div class="cab-best muted">Your best: ${fmt(r.prev)}</div>`);

    const pay = [];
    if (r && r.gems) pay.push(`<span class="chip chip-gem">💎 +${r.gems}</span>`);
    if (r && r.coins) pay.push(`<span class="chip chip-gold">🪙 +${fmt(r.coins)}</span>`);
    if (!pay.length) pay.push('<span class="chip">No score, no prize</span>');

    card.innerHTML =
      `${bits.join('')}<div class="chips cab-pay">${pay.join('')}</div>
       <p class="cab-note">${
         r && r.capped
           ? 'That is every gem the arcade pays today — coins keep coming, and the gems reset at midnight.'
           : next
             ? `${fmt(next - g.score)} more points would have earned another 💎.`
             : 'You cleared every gem rung in this cabinet. Superb.'
       }</p>`;

    const again = el('button', 'btn btn-big btn-green', '🔁 Play again');
    again.onclick = () => { haptic(); card.remove(); start(); };
    const done = el('button', 'btn btn-big btn-blue', 'Back to the barn');
    done.style.marginTop = '8px';
    done.onclick = () => { haptic(); leave(); };
    card.append(again, done);
    stage.appendChild(card);
  }

  /* -------------------------------- leaving ------------------------------ */

  let gone = false;
  function leave() {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', fit);
    root.remove();
    live = null;
    // A run abandoned mid-game still counts — nobody likes losing a good score.
    if (phase === 'play' && g.score > 0) G.arcadeFinish(game.id, g.score);
    if (onDone) onDone();
  }
  quit.onclick = () => { haptic(); leave(); };

  live = { id: game.id, leave };
  start();
}

/** Shuts any open cabinet — used when the game needs the screen back. */
export function close() {
  if (live) live.leave();
}
