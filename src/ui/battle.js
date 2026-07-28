// ============================================================================
// Battle screen: camera, input, rendering, HUD, AI driving and results.
// ============================================================================

import { $, el, go, goRoot, toast, modal, closeModal, updateCurrencies } from './ui.js';
import { load, save } from '../core/storage.js';
import {
  createWorld, launch, step, legalLaunchers, unitById, aliveOf,
  MAX_DRAG, MIN_LAUNCH_SPEED, MAX_LAUNCH_SPEED, RAGE_MAX,
} from '../game/world.js';
import { planShot } from '../game/ai.js';
import { ARENA_BY_ID, ARENA_W, ARENA_H, arenaForTrophies } from '../data/arenas.js';
import { HERO_BY_ID } from '../data/heroes.js';
import { drawStage, drawHazards, drawUnit, drawDeadMarker, drawProjectile, drawAimGuide } from '../art/arena.js';
import { paintCard, withAlpha } from '../art/characters.js';
import { Fx, Ambient } from '../art/fx.js';
import { sfx, haptic, setMood } from '../core/audio.js';
import { clamp, len, norm, dist } from '../core/math.js';
import { teamMembers, buildRivalTeam, applyBattleResult, leagueName } from '../game/profile.js';
import { rivalForTrophies, CHESTS } from '../data/chests.js';
import { makeRng } from '../core/rng.js';
import { renderChests, showLoot } from './home.js';

const FIXED = 1 / 120;
const TURN_SECONDS = 16;

let canvas, ctx, dpr = 1;
let state = null;
let raf = 0;

/* ------------------------------ entry points ----------------------------- */

export function initBattle() {
  canvas = $('#arena');
  ctx = canvas.getContext('2d');
  $('#btn-pause').onclick = pauseMenu;
  window.addEventListener('resize', resize);
  bindInput();
}

export function startBattle(mode = 'ladder') {
  const p = load();
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  const rng = makeRng(seed);
  const arena = mode === 'practice' ? ARENA_BY_ID.courtyard : arenaForTrophies(p.trophies);
  const rival = rivalForTrophies(p.trophies, rng);

  const myTeam = teamMembers();
  const foeTeam = mode === 'versus' ? teamMembers().slice().reverse() : buildRivalTeam(p.trophies, seed);

  const world = createWorld({
    arenaId: arena.id,
    teams: [myTeam, foeTeam],
    seed,
    firstTurn: rng() < 0.5 ? 0 : 1,
  });

  state = {
    mode,
    world,
    arena,
    rival: mode === 'versus' ? { name: 'Player 2', jp: 'ふたり', skill: 0, hue: 280 } : rival,
    skill: mode === 'practice' ? 0.3 : clamp(rival.skill + (p.trophies / 4200), 0.2, 0.97),
    fx: new Fx(),
    ambient: new Ambient(arena.theme.petals, ARENA_W + 500, ARENA_H + 500),
    acc: 0,
    time: 0,
    aim: null,
    turnClock: TURN_SECONDS,
    aiPlan: null,
    aiThink: 0,
    aiShot: null,
    aiPreview: 0,
    paused: false,
    over: false,
    resultShown: false,
    cam: { x: 0, y: 0, s: 1 },
    lastTrail: 0,
  };

  // exposed for automated play-testing
  if (typeof window !== 'undefined') window.__battleState = state;

  setMood('battle');
  go('battle');
  $('#battle-overlay').hidden = true;
  $('#battle-overlay').innerHTML = '';
  resize();
  buildPips();
  showTurnBanner();
  loop(performance.now());
}

export function stopBattle() {
  cancelAnimationFrame(raf);
  raf = 0;
  state = null;
  if (typeof window !== 'undefined') window.__battleState = null;
  setMood('menu');
}

/* -------------------------------- camera --------------------------------- */

function resize() {
  if (!canvas) return;
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  if (!state) return;
  const availW = w - 14;
  const availH = h - 150;
  const s = Math.min(availW / ARENA_W, availH / ARENA_H);
  state.cam.s = s;
  state.cam.x = (w - ARENA_W * s) / 2;
  state.cam.y = (h - ARENA_H * s) / 2;
}

const toWorld = (sx, sy) => ({
  x: (sx - state.cam.x) / state.cam.s,
  y: (sy - state.cam.y) / state.cam.s,
});

/* --------------------------------- input --------------------------------- */

function bindInput() {
  const c = $('#arena');
  let pointerId = null;

  const down = (e) => {
    if (!state || state.paused || state.over) return;
    if (state.world.phase !== 'aim') return;
    if (!isHumanTurn()) return;
    const rect = c.getBoundingClientRect();
    const p = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    let best = null, bestD = Infinity;
    for (const u of legalLaunchers(state.world, state.world.turn)) {
      const d = dist(p.x, p.y, u.x, u.y);
      if (d < u.r * 2.2 && d < bestD) { best = u; bestD = d; }
    }
    if (!best) return;
    pointerId = e.pointerId;
    c.setPointerCapture?.(e.pointerId);
    state.aim = { unitId: best.id, x: p.x, y: p.y, dirX: 0, dirY: -1, power: 0 };
    sfx('aim', 0.2);
    haptic(6);
    e.preventDefault();
  };

  const move = (e) => {
    if (!state || !state.aim || e.pointerId !== pointerId) return;
    const rect = c.getBoundingClientRect();
    const p = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const u = unitById(state.world, state.aim.unitId);
    if (!u) return;
    const dx = p.x - u.x, dy = p.y - u.y;
    const d = len(dx, dy);
    if (d < 6) { state.aim.power = 0; return; }
    const [nx, ny] = norm(-dx, -dy);
    const prevPower = state.aim.power;
    state.aim.dirX = nx; state.aim.dirY = ny;
    state.aim.power = clamp(d / MAX_DRAG, 0, 1);
    if (Math.abs(state.aim.power - prevPower) > 0.12) sfx('aim', state.aim.power);
    e.preventDefault();
  };

  const up = (e) => {
    if (!state || !state.aim || e.pointerId !== pointerId) return;
    pointerId = null;
    const a = state.aim;
    state.aim = null;
    if (a.power < 0.06) return;
    fire(a.unitId, a.dirX, a.dirY, a.power);
    e.preventDefault();
  };

  c.addEventListener('pointerdown', down);
  c.addEventListener('pointermove', move);
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
}

function isHumanTurn() {
  if (!state) return false;
  if (state.mode === 'versus') return true;
  return state.world.turn === 0;
}

function fire(unitId, dx, dy, power) {
  const w = state.world;
  const u = unitById(w, unitId);
  if (!u) return;
  if (!launch(w, unitId, dx, dy, power)) return;
  state.turnClock = TURN_SECONDS;
  state.aiShot = null;
  state.aiPlan = null;
  haptic(power > 0.7 ? [14, 20, 10] : 12);
}

/* ---------------------------------- HUD ---------------------------------- */

function buildPips() {
  for (const side of [0, 1]) {
    const bar = $(side === 0 ? '#bar-you' : '#bar-foe');
    bar.innerHTML = '';
    for (const u of state.world.units.filter((x) => x.side === side)) {
      const pip = el('div', `pip ${side === 1 ? 'foe' : ''}`);
      pip.dataset.unit = u.id;
      const cv = el('canvas');
      pip.appendChild(cv);
      const hp = el('div', 'hp');
      hp.appendChild(el('i'));
      pip.appendChild(hp);
      const rage = el('div', 'rage');
      rage.appendChild(el('i'));
      pip.appendChild(rage);
      bar.appendChild(pip);
      requestAnimationFrame(() => paintCard(cv, u.heroId, { w: 84, h: 34 }));
    }
  }
}

function updatePips() {
  for (const u of state.world.units) {
    const pip = document.querySelector(`.pip[data-unit="${u.id}"]`);
    if (!pip) continue;
    pip.querySelector('.hp i').style.width = `${clamp((u.hp / u.hpMax) * 100, 0, 100)}%`;
    pip.querySelector('.rage i').style.width = `${clamp((u.rage / RAGE_MAX) * 100, 0, 100)}%`;
    pip.classList.toggle('dead', !u.alive);
    pip.classList.toggle('charged', u.charged && u.alive);
    pip.classList.toggle('turn', u.alive && state.world.turn === u.side && state.world.phase === 'aim');
  }
}

function showTurnBanner() {
  const b = $('#turn-banner');
  const w = state.world;
  const mine = w.turn === 0;
  const you = state.mode === 'versus' ? (mine ? 'PLAYER 1' : 'PLAYER 2') : (mine ? 'YOUR TURN' : `${state.rival.name.toUpperCase()}`);
  b.querySelector('b').textContent = you;
  b.querySelector('small').textContent = mine ? 'こうげき' : 'あいて';
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}

function comboPop(text) {
  const c = $('#combo-pop');
  c.textContent = text;
  c.classList.remove('show');
  void c.offsetWidth;
  c.classList.add('show');
}

/* ------------------------------- main loop -------------------------------- */

let lastNow = 0;

function loop(now) {
  raf = requestAnimationFrame(loop);
  if (!state) return;
  const dtRaw = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
  lastNow = now;

  const timeScale = state.fx.slowmo > 0 ? 0.28 : 1;
  const dt = dtRaw * (state.paused ? 0 : 1);

  state.time += dt;
  state.ambient.update(dt);
  state.fx.update(dt);

  if (!state.paused && !state.over) {
    simulate(dt * timeScale);
    drainEvents();
    updateTurnClock(dt);
    driveAI(dt);
  }

  render();
  updatePips();
}

function simulate(dt) {
  const w = state.world;
  if (w.phase !== 'sim') return;
  state.acc += dt;
  let guard = 0;
  while (state.acc >= FIXED && guard < 40) {
    step(w, FIXED);
    state.acc -= FIXED;
    guard++;
  }
  if (state.acc > 0.4) state.acc = 0;

  // motion trails
  state.lastTrail += dt;
  if (state.lastTrail > 0.022) {
    state.lastTrail = 0;
    for (const u of w.units) {
      if (!u.alive) continue;
      const sp = len(u.vx, u.vy);
      if (sp > 260) {
        state.fx.trail(u.x, u.y, withAlpha(HERO_BY_ID[u.heroId].art.aura, 0.8), u.r * 0.8);
      }
    }
    for (const p of w.projectiles) {
      state.fx.trail(p.x, p.y, withAlpha(HERO_BY_ID[p.heroId]?.art.aura || '#fff', 0.7), p.r * 0.8);
    }
  }
}

function updateTurnClock(dt) {
  const w = state.world;
  const fill = $('#turn-timer-fill');
  if (w.phase !== 'aim') {
    fill.style.width = '100%';
    fill.classList.remove('low');
    return;
  }
  if (!isHumanTurn()) { fill.style.width = '100%'; return; }
  state.turnClock -= dt;
  const frac = clamp(state.turnClock / TURN_SECONDS, 0, 1);
  fill.style.width = `${frac * 100}%`;
  fill.classList.toggle('low', frac < 0.3);
  if (state.turnClock <= 0) {
    autoFire();
    state.turnClock = TURN_SECONDS;
  }
}

function autoFire() {
  const w = state.world;
  const opts = legalLaunchers(w, w.turn);
  if (!opts.length) return;
  const u = opts[Math.floor(Math.random() * opts.length)];
  const foes = aliveOf(w, 1 - w.turn);
  const target = foes[Math.floor(Math.random() * foes.length)];
  const [nx, ny] = target ? norm(target.x - u.x, target.y - u.y) : [0, w.turn === 0 ? -1 : 1];
  toast('Out of time!');
  fire(u.id, nx, ny, 0.55);
}

/* ----------------------------------- AI ----------------------------------- */

function driveAI(dt) {
  const w = state.world;
  if (state.mode === 'versus') return;
  if (w.phase !== 'aim' || w.turn !== 1) return;

  if (!state.aiPlan && !state.aiShot) {
    state.aiThink += dt;
    if (state.aiThink > 0.45) {
      state.aiPlan = planShot(w, 1, state.skill, (Date.now() ^ w.turnCount * 2654435761) >>> 0);
    }
    return;
  }

  if (state.aiPlan) {
    // spend a slice of this frame searching, so the UI never stutters
    const budget = performance.now() + 6;
    let r;
    do { r = state.aiPlan.next(); } while (!r.done && performance.now() < budget);
    if (r.done) {
      state.aiPlan = null;
      state.aiShot = r.value;
      state.aiPreview = 0;
    }
    return;
  }

  if (state.aiShot) {
    state.aiPreview += dt;
    if (state.aiPreview > 0.62) {
      const s = state.aiShot;
      state.aiShot = null;
      state.aiThink = 0;
      fire(s.unitId, s.dirX, s.dirY, s.power);
    }
  }
}

/* ------------------------------- events → fx ------------------------------ */

function drainEvents() {
  const w = state.world;
  const fx = state.fx;
  const p = load();
  const hap = p.settings.haptics;

  for (const ev of w.events) {
    switch (ev.type) {
      case 'launch': {
        sfx('launch', 0.5 + ev.power);
        const u = unitById(w, ev.unit);
        const color = HERO_BY_ID[u.heroId].art.aura;
        fx.burst(ev.x - ev.dirX * u.r, ev.y - ev.dirY * u.r, color, 12, 320 * ev.power, { kind: 'streak', r: 5, life: 0.3 });
        fx.ring(ev.x, ev.y, withAlpha(color, 0.8), u.r, u.r + 70, 0.35, 6);
        if (ev.special) { fx.kick(10, '#ffcf5c'); fx.flash = 0.35; }
        break;
      }
      case 'clash': {
        const power = ev.power;
        sfx('hit', 0.4 + power);
        if (hap) haptic(Math.round(6 + power * 22));
        fx.burst(ev.x, ev.y, '#fff6d0', Math.round(6 + power * 14), 260 + power * 420, { r: 4 + power * 4 });
        fx.ring(ev.x, ev.y, '#ffffff', 6, 60 + power * 130, 0.3, 9, 'shock');
        fx.kick(4 + power * 16, power > 0.8 ? '#ffd9a0' : null);
        if (power > 0.75) fx.text(ev.x, ev.y - 60, 'ドン!', '#ffcf5c', { size: 26, jp: true, life: 0.6 });
        break;
      }
      case 'bump':
        if (ev.power > 0.25) { sfx('wall', ev.power * 0.6); fx.burst(ev.x, ev.y, '#ffffff', 4, 160, { r: 3, life: 0.24 }); }
        break;
      case 'wall':
        sfx('wall', ev.power);
        fx.burst(ev.x, ev.y, '#ffffff', 5, 200 * ev.power, { r: 3, life: 0.25 });
        break;
      case 'bumper':
        sfx('wall', 0.9);
        fx.ring(ev.x, ev.y, '#ffe066', 8, 90, 0.32, 8, 'shock');
        fx.burst(ev.x, ev.y, '#ffe066', 10, 380, { r: 5 });
        fx.kick(9);
        break;
      case 'damage': {
        const mine = ev.side === 0;
        const size = clamp(20 + ev.amount / 14, 20, 52);
        fx.text(ev.x, ev.y - 40, `${ev.amount}`, mine ? '#ff8a8a' : '#fff', { size, life: 0.85 });
        break;
      }
      case 'heal':
        sfx('heal');
        fx.text(ev.x, ev.y - 50, `+${ev.amount}`, '#7dfaa8', { size: 26, life: 0.9 });
        fx.burst(ev.x, ev.y, '#7dfaa8', 10, 180, { kind: 'petal', r: 6 });
        break;
      case 'ko': {
        sfx(ev.cause === 'pit' ? 'pit' : 'ko');
        if (hap) haptic([18, 40, 26]);
        const hero = HERO_BY_ID[ev.heroId];
        fx.burst(ev.x, ev.y, hero.art.aura, 26, 540, { r: 8, life: 0.8 });
        fx.burst(ev.x, ev.y, '#fff', 16, 720, { kind: 'shard', r: 7, life: 0.6 });
        fx.ring(ev.x, ev.y, '#fff', 10, 260, 0.5, 12, 'shock');
        fx.text(ev.x, ev.y - 30, '撃破', '#ff5f9e', { size: 46, jp: true, life: 1.1 });
        fx.kick(26, '#ffffff');
        fx.slowmo = 0.55;
        break;
      }
      case 'pitfall':
        sfx('pit');
        fx.ring(ev.hx, ev.hy, '#a56bff', 20, 150, 0.5, 10);
        break;
      case 'spikeHit':
        sfx('hit', 0.7);
        fx.burst(ev.x, ev.y, '#ff6a2a', 12, 300, { kind: 'shard', r: 5 });
        fx.kick(10, '#ff6a2a');
        break;
      case 'abilityCast': {
        sfx('special');
        if (hap) haptic([10, 30, 10, 30, 18]);
        comboPop(`${ev.jp} ${ev.name}`);
        fx.ring(ev.x, ev.y, '#ffcf5c', 20, 300, 0.55, 14, 'shock');
        fx.burst(ev.x, ev.y, '#ffe9a8', 22, 420, { kind: 'petal', r: 8, life: 0.9 });
        fx.kick(16, '#fff3c4');
        break;
      }
      case 'slash':
        fx.slash(ev.x, ev.y, ev.angle, '#ffffff', 230);
        fx.kick(14);
        break;
      case 'nova':
        fx.ring(ev.x, ev.y, ev.color || '#c9b6ff', 20, ev.r, 0.55, 18, 'shock');
        fx.burst(ev.x, ev.y, ev.color || '#c9b6ff', 30, 620, { r: 7 });
        fx.kick(20, ev.color);
        break;
      case 'quake':
        fx.ring(ev.x, ev.y, '#ff8a5c', 20, ev.r, 0.6, 22, 'ground');
        fx.ring(ev.x, ev.y, '#ffd9a0', 10, ev.r * 0.7, 0.4, 12, 'shock');
        fx.burst(ev.x, ev.y, '#c9a06a', 26, 420, { kind: 'shard', r: 8 });
        fx.kick(28, '#ffb37a');
        break;
      case 'bloom':
        fx.ring(ev.x, ev.y, '#ff9ec4', 20, ev.r, 0.7, 14, 'ground');
        fx.petals(ev.x, ev.y, '#ff9ec4', 26, 300);
        break;
      case 'ward':
        fx.ring(ev.x, ev.y, '#4be3c8', 20, ev.r, 0.6, 14, 'shock');
        break;
      case 'shieldOn':
        fx.ring(ev.x, ev.y, '#4be3c8', 10, 70, 0.4, 6);
        break;
      case 'lightning':
        fx.bolt(ev.x1, ev.y1, ev.x2, ev.y2, '#ffe066');
        fx.kick(10, '#ffe066');
        sfx('hit', 0.8);
        break;
      case 'freeze':
        fx.burst(ev.x, ev.y, '#bfe9ff', 16, 300, { kind: 'shard', r: 7 });
        fx.text(ev.x, ev.y - 60, '氷', '#bfe9ff', { size: 34, jp: true });
        break;
      case 'thaw':
        fx.burst(ev.x, ev.y, '#dff2ff', 10, 200, { kind: 'shard', r: 5 });
        break;
      case 'burnApply':
        fx.text(ev.x, ev.y - 60, '業火', '#ff5a3c', { size: 30, jp: true });
        break;
      case 'burnTick':
        fx.burst(ev.x, ev.y, '#ff8a3c', 8, 180, { kind: 'ember', r: 5 });
        break;
      case 'inferno':
        sfx('special');
        fx.ring(ev.x, ev.y, '#ff5a3c', 20, ev.r, 0.6, 20, 'shock');
        fx.burst(ev.x, ev.y, '#ffb347', 30, 560, { kind: 'ember', r: 8 });
        fx.kick(24, '#ff8a3c');
        break;
      case 'foxfireCast':
        fx.burst(ev.x, ev.y, '#ffd9e8', 24, 380, { r: 7 });
        break;
      case 'projHit':
        sfx('hit', 0.45);
        fx.burst(ev.x, ev.y, '#fff0d0', 8, 240, { r: 4 });
        fx.kick(5);
        break;
      case 'projGone':
        fx.burst(ev.x, ev.y, '#ffd9e8', 5, 120, { r: 3, life: 0.3 });
        break;
      case 'collapse':
        fx.kick(18, '#ff5a5a');
        toast('The arena is collapsing!');
        break;
      case 'turnSkipped':
        toast('Frozen solid — turn skipped');
        break;
      case 'turnStart':
        state.turnClock = TURN_SECONDS;
        state.aiThink = 0;
        showTurnBanner();
        break;
      case 'battleEnd':
        endBattle(ev.winner);
        break;
      default: break;
    }
  }
  w.events.length = 0;
}

/* -------------------------------- rendering ------------------------------- */

function render() {
  const w = state.world;
  const cw = canvas.width / dpr, ch = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0b0618';
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.translate(state.cam.x + state.fx.shakeX, state.cam.y + state.fx.shakeY);
  ctx.scale(state.cam.s, state.cam.s);

  drawStage(ctx, state.arena, state.time);

  ctx.save();
  ctx.translate(-250, -250);
  state.ambient.draw(ctx, state.arena.theme.accent);
  ctx.restore();

  drawHazards(ctx, w, state.arena, state.time);
  state.fx.drawBelow(ctx);

  for (const u of w.units) if (!u.alive) drawDeadMarker(ctx, u, state.time);

  const order = w.units.filter((u) => u.alive).sort((a, b) => a.y - b.y);
  const aiming = w.phase === 'aim';
  for (const u of order) {
    const chosen = state.aim?.unitId === u.id || state.aiShot?.unitId === u.id;
    drawUnit(ctx, u, state.time, {
      active: chosen,
      selectable: aiming && !chosen && u.side === w.turn && u.frozen <= 0 && isHumanTurn(),
    });
  }

  for (const p of w.projectiles) drawProjectile(ctx, p, state.time);

  // aim guides
  if (state.aim && state.aim.power > 0.03) {
    const u = unitById(w, state.aim.unitId);
    if (u) drawAimGuide(ctx, u, state.aim.dirX, state.aim.dirY, state.aim.power, w, state.time);
  } else if (state.aiShot && state.aiPreview > 0.12) {
    const u = unitById(w, state.aiShot.unitId);
    const k = clamp((state.aiPreview - 0.12) / 0.4, 0, 1);
    if (u) drawAimGuide(ctx, u, state.aiShot.dirX, state.aiShot.dirY, state.aiShot.power * k, w, state.time);
  }

  state.fx.drawAbove(ctx);
  ctx.restore();

  state.fx.drawFlash(ctx, cw, ch);

  // "thinking" indicator for the rival
  if (state.aiPlan) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#fff';
    ctx.font = '900 13px "Avenir Next",Helvetica,sans-serif';
    ctx.textAlign = 'center';
    const dots = '.'.repeat(1 + Math.floor(state.time * 3) % 3);
    ctx.fillText(`${state.rival.name} is thinking${dots}`, cw / 2, 92);
    ctx.restore();
  }
}

/* --------------------------------- results -------------------------------- */

function endBattle(winner) {
  if (state.over) return;
  state.over = true;
  state.fx.slowmo = 0.9;
  const win = winner === 0;

  setTimeout(() => showResult(win), 1100);
}

function showResult(win) {
  if (!state || state.resultShown) return;
  state.resultShown = true;
  sfx(win ? 'win' : 'lose');
  haptic(win ? [20, 60, 20, 60, 40] : [40, 80, 40]);

  const overlay = $('#battle-overlay');
  overlay.hidden = false;
  overlay.innerHTML = '';
  const panel = el('div', 'panel');

  const versus = state.mode === 'versus';
  const practice = state.mode === 'practice';

  panel.appendChild(el('h2', `result-title ${win ? 'win' : 'lose'}`,
    versus ? (win ? 'PLAYER 1' : 'PLAYER 2') : win ? 'VICTORY' : 'DEFEAT'));
  panel.appendChild(el('div', 'result-jp', versus ? 'かち' : win ? 'しょうり' : 'はいぼく'));

  let result = null;
  if (!versus && !practice) {
    result = applyBattleResult(win, state.arena.id);
    const line = el('div', 'reward-line');
    line.appendChild(el('div', 'reward-pill',
      `🏆 <b style="color:${result.trophies >= 0 ? '#5ce08a' : '#ff8a8a'}">${result.trophies >= 0 ? '+' : ''}${result.trophies}</b>`));
    line.appendChild(el('div', 'reward-pill', `🪙 <b>+${result.gold}</b>`));
    panel.appendChild(line);

    if (result.chest) {
      const c = CHESTS[result.chest.type];
      const chestLine = el('div', 'reward-line');
      chestLine.appendChild(el('div', 'reward-pill', `🎁 <b style="color:${c.color}">${c.name}</b>`));
      panel.appendChild(chestLine);
    } else if (win) {
      panel.appendChild(el('p', null, 'Chest slots are full — open one to make room.'));
    }

    if (result.leagueUp) {
      panel.appendChild(el('p', null,
        `<b style="color:#ffcf5c">PROMOTED — ${result.leagueUp.jp} ${result.leagueUp.name}!</b>`));
      const p = load();
      p.gems += 10;
      save(true);
    } else if (result.leagueDown) {
      panel.appendChild(el('p', null, `Demoted to ${result.leagueDown.name}.`));
    }
    updateCurrencies();
    renderChests();
  } else if (practice) {
    panel.appendChild(el('p', null, 'Practice bout — no trophies at stake.'));
  }

  const mode = state.mode; // captured before stopBattle() clears state
  const again = el('button', 'btn btn-primary', 'BATTLE AGAIN');
  again.onclick = () => {
    sfx('click');
    overlay.hidden = true;
    stopBattle();
    startBattle(mode);
  };
  const home = el('button', 'btn btn-ghost', 'HOME');
  home.onclick = () => {
    sfx('click');
    overlay.hidden = true;
    stopBattle();
    goRoot('home');
  };

  panel.appendChild(again);
  panel.appendChild(home);
  overlay.appendChild(panel);
}

/* ---------------------------------- pause --------------------------------- */

function pauseMenu() {
  if (!state || state.over) return;
  state.paused = true;
  sfx('click');
  modal({
    title: 'PAUSED', jp: 'きゅうけい',
    body: `<p>${state.arena.jp} ${state.arena.name}<br>vs <b>${state.rival.name}</b> ${state.rival.jp || ''}</p>`,
    dismissable: false,
    actions: [
      { label: 'RESUME', cls: 'btn-gold', onClick: () => { state.paused = false; lastNow = performance.now(); } },
      {
        label: 'FORFEIT', onClick: () => {
          const mode = state.mode;
          if (mode === 'ladder') { applyBattleResult(false, state.arena.id); updateCurrencies(); }
          stopBattle();
          goRoot('home');
        },
      },
    ],
  });
}
