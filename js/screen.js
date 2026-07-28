/* ==========================================================================
   screen.js — everything drawn into the 160x144 frame: the overworld camera,
   the status bar, and the windowed UI (text boxes, list menus, confirms).
   The UI is a stack, so B always walks back the way you came.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import * as W from './world.js';
import * as GFX from './gfx.js';
import { PAL, DARK, MID, LITE, PALE, TILE, SCREEN_W, SCREEN_H } from './gfx.js';
import { fmt, fmtTime, now } from './util.js';

export const HUD_H = 14;
const VIEW_H = SCREEN_H - HUD_H;

let ctx = null;
export const camera = { x: 0, y: 0 };

export function initScreen(canvas) {
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
}

/* ------------------------------- UI stack -------------------------------- */

const stack = [];
export const busy = () => stack.length > 0;
export const top = () => stack[stack.length - 1] || null;

export function closeAll() { stack.length = 0; }
export function pop() { stack.pop(); }

export function dialog(text, onDone) {
  stack.push({ kind: 'dialog', lines: GFX.wrapText(text, 24), onDone });
}

/**
 * items: { label, right, icon, detail, disabled, value }
 * onPick(item, index) — return false to keep the menu open.
 */
export function menu({ title, items, onPick, onCancel, cursor = 0 }) {
  stack.push({ kind: 'menu', title, items, onPick, onCancel, cursor, scroll: 0 });
}

export function confirm(text, onYes, onNo) {
  stack.push({ kind: 'confirm', lines: GFX.wrapText(text, 24), choice: 0, onYes, onNo });
}

/** Refreshes the open menu's rows in place, keeping the cursor put. */
export function refreshMenu(items) {
  const t = top();
  if (t && t.kind === 'menu') {
    t.items = items;
    t.cursor = Math.min(t.cursor, Math.max(0, items.length - 1));
  }
}

let flashMsg = null, flashUntil = 0;
export function flash(msg) {
  flashMsg = String(msg).toUpperCase();
  flashUntil = now() + 1800;
}

/* -------------------------------- input ---------------------------------- */

const ROWS = 5, ROW_H = 16, LIST_Y = 18;

/** action: 'up' | 'down' | 'left' | 'right' | 'a' | 'b'. */
export function uiKey(action) {
  const t = top();
  if (!t) return false;

  if (t.kind === 'dialog') {
    if (action === 'a' || action === 'b') { pop(); if (t.onDone) t.onDone(); }
    return true;
  }

  if (t.kind === 'confirm') {
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      t.choice = t.choice ? 0 : 1;
    } else if (action === 'a') {
      pop();
      if (t.choice === 0) { if (t.onYes) t.onYes(); } else if (t.onNo) t.onNo();
    } else if (action === 'b') {
      pop();
      if (t.onNo) t.onNo();
    }
    return true;
  }

  if (t.kind === 'menu') {
    const n = t.items.length;
    if (action === 'up' && n) t.cursor = (t.cursor - 1 + n) % n;
    else if (action === 'down' && n) t.cursor = (t.cursor + 1) % n;
    else if (action === 'a' && n) {
      const item = t.items[t.cursor];
      if (item.disabled) { flash(item.disabledWhy || 'CANT DO THAT'); return true; }
      if (t.onPick && t.onPick(item, t.cursor) !== false) { /* handler owns the stack */ }
    } else if (action === 'b') {
      pop();
      if (t.onCancel) t.onCancel();
    }
    if (t.cursor < t.scroll) t.scroll = t.cursor;
    if (t.cursor >= t.scroll + ROWS) t.scroll = t.cursor - ROWS + 1;
    return true;
  }
  return false;
}

/** Screen-space tap while a window is open. Returns true if it was consumed. */
export function uiTap(px, py) {
  const t = top();
  if (!t) return false;
  if (t.kind === 'dialog') { uiKey('a'); return true; }
  if (t.kind === 'confirm') {
    const yes = py >= 96 && py < 120;
    t.choice = yes ? 0 : 1;
    uiKey('a');
    return true;
  }
  if (t.kind === 'menu') {
    const row = Math.floor((py - LIST_Y - 2) / ROW_H);
    if (row >= 0 && row < ROWS) {
      const i = t.scroll + row;
      if (i < t.items.length) { t.cursor = i; uiKey('a'); }
    } else if (py > LIST_Y + ROWS * ROW_H + 6) {
      uiKey('b');
    }
    return true;
  }
  return false;
}

/* ------------------------------- drawing --------------------------------- */

function icon(emoji, size, x, y) {
  ctx.drawImage(GFX.bake(emoji, size), x, y);
}

export function drawFrame(player, hint) {
  ctx.fillStyle = PAL[PALE];
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawWorld(player, hint);
  drawHud();
  drawUi();
  drawFlash();
}

/* ---- overworld ---- */

function drawWorld(p, hint) {
  // Camera centres on the player, then stops at the edges of the farm.
  const px = p.x * TILE + p.ox, py = p.y * TILE + p.oy;
  camera.x = Math.max(0, Math.min(W.MAP_W * TILE - SCREEN_W, Math.round(px - SCREEN_W / 2 + 8)));
  camera.y = Math.max(0, Math.min(W.MAP_H * TILE - VIEW_H, Math.round(py - VIEW_H / 2 + 8)));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, SCREEN_W, VIEW_H);
  ctx.clip();
  ctx.translate(-camera.x, HUD_H - camera.y);

  const x0 = Math.floor(camera.x / TILE), y0 = Math.floor(camera.y / TILE);
  for (let ty = y0; ty <= y0 + VIEW_H / TILE + 1; ty++) {
    for (let tx = x0; tx <= x0 + SCREEN_W / TILE + 1; tx++) {
      if (!W.inBounds(tx, ty)) continue;
      ctx.drawImage(GFX.tile(W.terrain[ty * W.MAP_W + tx]), tx * TILE, ty * TILE);
    }
  }

  drawCrops();
  drawAnimals();
  drawSigns();

  // The farmer, and a nudge when something here can be used.
  const frames = GFX.farmer[p.dir] || GFX.farmer.down;
  ctx.drawImage(frames[p.frame], px, py - 4);
  if (hint) {
    GFX.plate(ctx, px + 3, py - 16, 10, 12);
    GFX.drawText(ctx, '!', px + 6, py - 13, DARK);
  }
  ctx.restore();
}

function drawCrops() {
  for (let i = 0; i < St.S.plots.length; i++) {
    const c = i % W.FIELD.cols, r = Math.floor(i / W.FIELD.cols);
    const tx = (W.FIELD.x + c) * TILE, ty = (W.FIELD.y + r) * TILE;
    const s = W.plotSprite(i);
    if (!s) continue;
    const size = [8, 12, 16][s.stage];
    ctx.drawImage(GFX.bake(s.icon, size), tx + (TILE - size) / 2, ty + (TILE - size) - 1);
    if (s.stage === 2) {                     // ripe: a little pop above the crop
      GFX.plate(ctx, tx + 4, ty - 10, 9, 11);
      GFX.drawText(ctx, '!', tx + 6, ty - 7, DARK);
    }
  }
}

function drawAnimals() {
  for (const type of D.ANIMALS) {
    const mine = St.animalsOf(type.id);
    mine.forEach((an, slot) => {
      const pos = W.penSlotPos(type.id, slot);
      const x = pos.x * TILE, y = pos.y * TILE;
      ctx.drawImage(GFX.bake(type.icon, 16), x, y);
      const st = G.animalState(an);
      if (st === 'ready') {
        ctx.drawImage(GFX.bake(D.ITEMS[type.product].icon, 8), x + 9, y - 7);
      } else if (st === 'hungry') {
        GFX.plate(ctx, x + 8, y - 10, 9, 11);
        GFX.drawText(ctx, '!', x + 10, y - 7, DARK);
      }
    });
  }
}

function sign(name, cx, y) {
  const w = GFX.textWidth(name) + 6;
  const x = Math.round(cx - w / 2);
  GFX.plate(ctx, x, y, w, 11);
  GFX.drawText(ctx, name, x + 3, y + 2, DARK);
}

function drawSigns() {
  // Nameplates sit on the roof course, where nothing else competes with them.
  for (const b of W.BUILDINGS) {
    sign(b.name, (b.x + b.w / 2) * TILE, b.y * TILE + 3);
  }
  sign(W.BOARD.name, (W.BOARD.x + 0.5) * TILE, W.BOARD.y * TILE - 12);
}

/* ---- status bar ---- */

function drawHud() {
  ctx.fillStyle = PAL[PALE];
  ctx.fillRect(0, 0, SCREEN_W, HUD_H);
  ctx.fillStyle = PAL[DARK];
  ctx.fillRect(0, HUD_H - 2, SCREEN_W, 2);

  GFX.drawText(ctx, '$' + fmt(St.S.coins), 3, 3, DARK);
  const gems = '@' + fmt(St.S.gems);
  GFX.drawText(ctx, gems, 74, 3, DARK);
  const lv = 'LV' + St.S.level;
  GFX.drawText(ctx, lv, SCREEN_W - GFX.textWidth(lv) - 3, 3, DARK);
}

/* ---- windows ---- */

function drawUi() {
  const t = top();
  if (!t) return;
  if (t.kind === 'dialog') return drawDialog(t);
  if (t.kind === 'confirm') return drawConfirm(t);
  if (t.kind === 'menu') return drawMenu(t);
}

function drawDialog(t) {
  const h = 14 + t.lines.length * GFX.LINE_H;
  const y = SCREEN_H - h;
  GFX.panel(ctx, 0, y, SCREEN_W, h);
  t.lines.forEach((l, i) => GFX.drawText(ctx, l, 8, y + 7 + i * GFX.LINE_H, DARK));
  if (Math.floor(now() / 350) % 2) GFX.drawText(ctx, 'v', SCREEN_W - 12, y + h - 11, DARK);
}

function drawConfirm(t) {
  GFX.panel(ctx, 0, 60, SCREEN_W, 34);
  t.lines.slice(0, 2).forEach((l, i) => GFX.drawText(ctx, l, 8, 68 + i * GFX.LINE_H, DARK));
  GFX.panel(ctx, 0, 96, SCREEN_W, 24);
  GFX.panel(ctx, 0, 120, SCREEN_W, 24);
  GFX.drawText(ctx, 'YES', 24, 104, DARK);
  GFX.drawText(ctx, 'NO', 24, 128, DARK);
  GFX.drawText(ctx, '>', 10, t.choice === 0 ? 104 : 128, DARK);
}

function drawMenu(t) {
  // title
  GFX.panel(ctx, 0, 0, SCREEN_W, 18);
  GFX.drawText(ctx, t.title, 6, 5, DARK);

  const listH = ROWS * ROW_H + 6;
  GFX.panel(ctx, 0, LIST_Y, SCREEN_W, listH);

  if (!t.items.length) {
    GFX.drawText(ctx, 'NOTHING HERE', 30, LIST_Y + 24, MID);
  }

  for (let r = 0; r < ROWS; r++) {
    const i = t.scroll + r;
    if (i >= t.items.length) break;
    const it = t.items[i];
    const y = LIST_Y + 4 + r * ROW_H;
    const shade = it.disabled ? MID : DARK;

    if (i === t.cursor) GFX.drawText(ctx, '>', 3, y + 4, DARK);
    let tx = 11;
    if (it.icon) { icon(it.icon, 14, tx, y); tx += 16; }
    GFX.drawText(ctx, it.label, tx, y + 4, shade);
    if (it.right) {
      GFX.drawText(ctx, it.right, SCREEN_W - GFX.textWidth(it.right) - 6, y + 4, shade);
    }
  }

  // scroll arrows
  if (t.scroll > 0) GFX.drawText(ctx, '^', SCREEN_W / 2 - 2, LIST_Y - 1, DARK);
  if (t.scroll + ROWS < t.items.length) {
    GFX.drawText(ctx, 'v', SCREEN_W / 2 - 2, LIST_Y + listH - 9, DARK);
  }

  // detail panel for the highlighted row
  const dy = LIST_Y + listH;
  GFX.panel(ctx, 0, dy, SCREEN_W, SCREEN_H - dy);
  const sel = t.items[t.cursor];
  const detail = sel ? (sel.detail || '') : '';
  GFX.wrapText(detail, 24).slice(0, 3)
    .forEach((l, i) => GFX.drawText(ctx, l, 6, dy + 6 + i * GFX.LINE_H, DARK));
}

function drawFlash() {
  if (!flashMsg || now() > flashUntil) return;
  const w = Math.min(SCREEN_W, GFX.textWidth(flashMsg) + 12);
  const x = (SCREEN_W - w) / 2;
  GFX.plate(ctx, x, SCREEN_H - 18, w, 14);
  GFX.drawText(ctx, flashMsg, x + 6, SCREEN_H - 14, DARK);
}
