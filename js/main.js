/* ==========================================================================
   main.js — boot, the farmer's movement, input, and the frame loop.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import * as W from './world.js';
import * as S from './screen.js';
import * as M from './menus.js';
import * as GFX from './gfx.js';
import { setSound, unlockAudio } from './audio.js';
import { fmtSpan, now } from './util.js';

const $ = id => document.getElementById(id);

const DX = { up: 0, down: 0, left: -1, right: 1 };
const DY = { up: -1, down: 1, left: 0, right: 0 };
const MOVE_MS = 150;
const TILE_F = GFX.TILE;

const player = { x: 6, y: 12, ox: 0, oy: 0, dir: 'down', frame: 0, step: null, path: [], goal: null };

let held = null;          // direction currently pressed
let repeatAt = 0;         // next auto-repeat for menu navigation
let canvas = null;

/* ------------------------------ interaction ------------------------------ */

function targetAt(x, y) {
  const b = W.buildingAt(x, y);
  if (b) return { kind: 'building', id: b.id };
  if (W.isBoard(x, y)) return { kind: 'orders' };
  const i = W.plotAt(x, y);
  if (i >= 0) return { kind: 'field', i };
  if (W.lockedPlotAt(x, y)) return { kind: 'locked' };
  const pen = W.penAt(x, y);
  if (pen) return { kind: 'pen', type: pen.type, slot: pen.slot };
  return null;
}

/** What A would act on: the tile you stand on, else the one you face. */
function currentTarget() {
  return targetAt(player.x, player.y) ||
         targetAt(player.x + DX[player.dir], player.y + DY[player.dir]);
}

function act(t) {
  if (!t) return;
  if (t.kind === 'building') M.openBuilding(t.id);
  else if (t.kind === 'orders') M.ordersMenu();
  else if (t.kind === 'field') M.fieldMenu(t.i);
  else if (t.kind === 'locked') M.lockedField();
  else if (t.kind === 'pen') M.penTile(t.type, t.slot);
}

/* -------------------------------- movement ------------------------------- */

function tryStep(dir) {
  player.dir = dir;
  const nx = player.x + DX[dir], ny = player.y + DY[dir];
  if (W.isSolid(nx, ny)) return false;
  player.step = { fromX: player.x, fromY: player.y, dir, t: now() };
  player.x = nx;
  player.y = ny;
  return true;
}

function updateMovement() {
  if (player.step) {
    const k = Math.min(1, (now() - player.step.t) / MOVE_MS);
    player.ox = -DX[player.step.dir] * TILE_F * (1 - k);
    player.oy = -DY[player.step.dir] * TILE_F * (1 - k);
    if (k >= 1) {
      player.step = null;
      player.ox = player.oy = 0;
      player.frame ^= 1;
      St.S.pos = { x: player.x, y: player.y };
      arrived();
    }
    return;
  }
  if (S.busy()) return;

  if (player.path.length) {
    const next = player.path[0];
    const dir = next.x > player.x ? 'right' : next.x < player.x ? 'left'
      : next.y > player.y ? 'down' : 'up';
    player.path.shift();
    if (!tryStep(dir)) { player.path.length = 0; player.goal = null; }
    return;
  }
  if (held) tryStep(held);
}


/** Fires once a queued walk reaches its destination. */
function arrived() {
  if (player.path.length || !player.goal) return;
  const g = player.goal;
  player.goal = null;
  const t = targetAt(g.x, g.y);
  if (t) act(t);
}

/* --------------------------------- input --------------------------------- */

function press(action) {
  unlockAudio();
  if (action === 'start') {
    if (S.busy()) S.closeAll(); else M.startMenu();
    return;
  }
  if (S.busy()) {
    S.uiKey(action);
    if (DX[action] !== undefined) held = action;   // lets menus auto-repeat
    return;
  }

  if (action === 'a') { player.path.length = 0; act(currentTarget()); return; }
  if (action === 'b') return;
  held = action;
  if (!player.step) { player.path.length = 0; player.goal = null; tryStep(action); }
}

function release(action) {
  if (held === action) held = null;
}

function tap(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const px = (clientX - r.left) / r.width * GFX.SCREEN_W;
  const py = (clientY - r.top) / r.height * GFX.SCREEN_H;
  unlockAudio();

  if (S.busy()) { S.uiTap(px, py); return; }
  if (py < S.HUD_H) { M.startMenu(); return; }

  const tx = Math.floor((px + S.camera.x) / GFX.TILE);
  const ty = Math.floor((py - S.HUD_H + S.camera.y) / GFX.TILE);
  if (!W.inBounds(tx, ty)) return;

  // Standing on it already? Just use it.
  if (tx === player.x && ty === player.y) { act(currentTarget()); return; }

  const path = W.isSolid(tx, ty) ? W.approach(player.x, player.y, tx, ty)
                                 : W.findPath(player.x, player.y, tx, ty);
  if (!path) { S.flash('CANT GET THERE'); return; }
  player.path = path;
  player.goal = { x: tx, y: ty };
  if (!path.length) act(targetAt(tx, ty));
}

function bindControls() {
  for (const btn of document.querySelectorAll('[data-key]')) {
    const key = btn.dataset.key;
    const down = e => {
      e.preventDefault();
      btn.classList.add('on');
      press(key);
      repeatAt = now() + 320;
    };
    const up = e => { e.preventDefault(); btn.classList.remove('on'); release(key); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  }

  canvas.addEventListener('pointerdown', e => { e.preventDefault(); tap(e.clientX, e.clientY); });

  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Shift: 'start', Tab: 'start',
  };
  addEventListener('keydown', e => {
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    if (!e.repeat) { press(k); repeatAt = now() + 320; }
  });
  addEventListener('keyup', e => { const k = KEYS[e.key]; if (k) release(k); });
}

/* --------------------------------- loop ---------------------------------- */

let lastTick = 0;

function frame() {
  // Held direction repeats inside menus so long lists are quick to scroll.
  if (held && S.busy() && now() >= repeatAt) {
    S.uiKey(held);
    repeatAt = now() + 130;
  }
  updateMovement();

  if (now() - lastTick >= 1000) {
    lastTick = now();
    G.tick();
    St.saveSoon();
  }

  S.drawFrame(player, !S.busy() && !!currentTarget());
  requestAnimationFrame(frame);
}

/* --------------------------------- boot ---------------------------------- */

function boot() {
  setSound(St.S.settings.sound !== false);
  $('onboard').hidden = true;
  $('device').hidden = false;

  GFX.buildAll();
  W.buildMap();
  // Pick up where you left off, unless that spot is no longer walkable.
  const pos = St.S.pos;
  if (pos && !W.isSolid(pos.x, pos.y)) { player.x = pos.x; player.y = pos.y; }
  canvas = $('screen');
  S.initScreen(canvas);
  bindControls();

  G.on('toast', t => S.flash(t.msg));
  G.on('levelup', lv => {
    const bits = [];
    for (const c of D.CROPS) if (c.level === lv) bits.push(c.name);
    for (const a of D.ANIMALS) if (a.level === lv) bits.push(a.name);
    for (const m of D.MACHINES) if (m.level === lv) bits.push(m.name);
    for (const u of D.UPGRADES) if (u.level === lv) bits.push(u.name);
    S.dialog(`LEVEL ${lv}! ${bits.length ? 'YOU UNLOCKED ' + bits.join(', ') + '.' : 'KEEP GOING!'}`);
  });

  const info = G.settleOffline();
  if (info.away > 120 && (info.ripe || info.ready || info.crafts)) {
    const bits = [];
    if (info.ripe) bits.push(`${info.ripe} FIELDS RIPENED`);
    if (info.ready) bits.push(`${info.ready} ANIMALS PRODUCED`);
    if (info.crafts) bits.push(`${info.crafts} CRAFTS FINISHED`);
    S.dialog(`WELCOME BACK! YOU WERE AWAY ${fmtSpan(info.away).toUpperCase()}. ${bits.join('. ')}.`);
  }

  addEventListener('pagehide', St.save);
  addEventListener('blur', St.save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) St.save(); else G.tick();
  });

  requestAnimationFrame(frame);
}

function showOnboarding() {
  const ob = $('onboard');
  ob.hidden = false;
  let avatar = D.AVATARS[0];
  const grid = $('ob-avatars');
  D.AVATARS.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'av' + (i === 0 ? ' on' : '');
    b.textContent = a;
    b.onclick = () => {
      avatar = a;
      [...grid.children].forEach(c => c.classList.toggle('on', c === b));
    };
    grid.appendChild(b);
  });
  $('ob-start').onclick = () => {
    unlockAudio();
    St.startNew(($('ob-name').value || '').trim().slice(0, 10) || 'FARMER', avatar);
    boot();
  };
}

if (St.load()) boot();
else showOnboarding();

/* @strip-in-bundle:start — the single-file build ships no sw.js to register */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch { /* no scope */ }
  });
}
/* @strip-in-bundle:end */
