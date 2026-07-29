/* ==========================================================================
   fx.js — the small feedback layer: confetti, button pops, numbers that fly
   off the thing you just tapped. Everything here checks the player's
   "Animations" setting first, and degrades to nothing when it's off.
   ========================================================================== */

import { el } from './util.js';

let motion = true;
export function setMotion(on) {
  motion = !!on;
  document.body.classList.toggle('no-motion', !on);
}
export const motionOn = () => motion;

/* ------------------------------- confetti -------------------------------- */

const CONFETTI = ['#ffc42e', '#57c04b', '#ef5a5a', '#47c9ff', '#f09ac0', '#fff1b8'];

/**
 * A burst of paper from a point (defaults to the top third of the screen).
 * Pure DOM: a few dozen absolutely-positioned chips with staggered falls.
 */
export function confetti(count = 70, originX = null, originY = null) {
  if (!motion) return;
  const host = document.getElementById('fx') || document.body;
  const x0 = originX == null ? innerWidth / 2 : originX;
  const y0 = originY == null ? innerHeight * 0.32 : originY;

  for (let i = 0; i < count; i++) {
    const bit = el('i', 'confetti');
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 190;
    bit.style.cssText = `
      left:${x0}px; top:${y0}px;
      background:${CONFETTI[i % CONFETTI.length]};
      --dx:${Math.cos(angle) * dist}px;
      --dy:${Math.sin(angle) * dist - 120}px;
      --rot:${Math.random() * 900 - 450}deg;
      --dur:${(1.1 + Math.random() * 0.9).toFixed(2)}s;
      --delay:${(Math.random() * 0.18).toFixed(2)}s;
      width:${6 + Math.random() * 6}px;
      height:${8 + Math.random() * 8}px;
      border-radius:${Math.random() < 0.4 ? '50%' : '2px'};`;
    host.appendChild(bit);
    setTimeout(() => bit.remove(), 2400);
  }
}

/* ------------------------------ tap feedback ----------------------------- */

/** Squash-and-stretch on the element that was just pressed. */
export function pop(node) {
  if (!motion || !node) return;
  node.classList.remove('fx-pop');
  void node.offsetWidth;               // restart the animation
  node.classList.add('fx-pop');
  setTimeout(() => node.classList.remove('fx-pop'), 340);
}

/** A number or label that drifts up and fades, anchored to an element. */
export function floatFrom(node, text, tone = 'good') {
  if (!motion) return;
  const host = document.getElementById('fx') || document.body;
  const r = node && node.getBoundingClientRect
    ? node.getBoundingClientRect()
    : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  const f = el('div', 'floaty ' + tone, text);
  f.style.left = (r.left + r.width / 2) + 'px';
  f.style.top = r.top + 'px';
  host.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}

/* ------------------------------ farm effects ----------------------------- */

/** Scatters a few soil specks out of a plot. */
function specks(node, count, cls) {
  const host = document.getElementById('fx') || document.body;
  const r = node.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const s = el('i', 'speck ' + cls);
    const a = Math.random() * Math.PI * 2;
    const d = 18 + Math.random() * 38;
    s.style.cssText = `
      left:${r.left + r.width / 2}px; top:${r.top + r.height * 0.62}px;
      --dx:${Math.cos(a) * d}px; --dy:${Math.sin(a) * d - 16}px;
      --dur:${(0.5 + Math.random() * 0.35).toFixed(2)}s;`;
    host.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
}

/** A seed drops in and the soil puffs. */
export function sowFx(node) {
  if (!motion || !node) return;
  node.classList.remove('fx-sow');
  void node.offsetWidth;
  node.classList.add('fx-sow');
  setTimeout(() => node.classList.remove('fx-sow'), 620);
  specks(node, 6, 'soil');
}

/** The crop leaps out of the ground and arcs away. */
export function reapFx(node, icon) {
  if (!motion || !node) return;
  const host = document.getElementById('fx') || document.body;
  const r = node.getBoundingClientRect();

  node.classList.remove('fx-reap');
  void node.offsetWidth;
  node.classList.add('fx-reap');
  setTimeout(() => node.classList.remove('fx-reap'), 520);

  const fly = el('div', 'reaped', icon);
  fly.style.left = (r.left + r.width / 2) + 'px';
  fly.style.top = (r.top + r.height / 2) + 'px';
  host.appendChild(fly);
  setTimeout(() => fly.remove(), 900);

  specks(node, 8, 'leaf');
}

/** Every button in the app gets a press animation, without wiring each one. */
export function bindTapFeedback(root = document) {
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('button:not([disabled])');
    if (b) pop(b);
  }, { passive: true });
}
