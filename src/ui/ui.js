// Shared UI plumbing: screen stack, toasts, modals, small DOM helpers.

import { sfx, haptic } from '../core/audio.js';
import { load } from '../core/storage.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

/* ------------------------------ navigation ------------------------------ */

const stack = ['home'];
const listeners = {};

export function onEnter(screen, fn) {
  (listeners[screen] ||= []).push(fn);
}

export function currentScreen() {
  return stack[stack.length - 1];
}

function show(name) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  const target = $(`#screen-${name}`);
  if (target) target.classList.add('active');
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.goto === name));
  (listeners[name] || []).forEach((fn) => fn());
}

export function go(name, replace = false) {
  if (replace) stack[stack.length - 1] = name;
  else if (currentScreen() !== name) stack.push(name);
  show(currentScreen());
}

export function goRoot(name) {
  stack.length = 0;
  stack.push(name);
  show(name);
}

export function back() {
  if (stack.length > 1) stack.pop();
  show(currentScreen());
}

export function refreshCurrent() {
  show(currentScreen());
}

/* -------------------------------- toasts -------------------------------- */

export function toast(msg, ms = 2200) {
  const layer = $('#toast-layer');
  const node = el('div', 'toast', msg);
  layer.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

/* -------------------------------- modals -------------------------------- */

let modalCloser = null;

export function modal({ title, jp, body, actions = [], dismissable = true, wide = false }) {
  const layer = $('#modal-layer');
  layer.innerHTML = '';
  layer.hidden = false;

  const box = el('div', 'modal');
  if (wide) box.style.maxWidth = '460px';
  if (title) box.appendChild(el('h3', null, title));
  if (jp) box.appendChild(el('div', 'jp-sub', jp));
  if (body) {
    if (typeof body === 'string') box.appendChild(el('div', null, body));
    else box.appendChild(body);
  }
  if (actions.length) {
    const row = el('div', 'modal-actions');
    for (const a of actions) {
      const b = el('button', `btn ${a.cls || 'btn-ghost'}`, a.label);
      b.onclick = () => {
        sfx('click'); haptic(8);
        // Close first: a handler is allowed to open a follow-up modal
        // (chest -> loot), and closing afterwards would eat it.
        if (a.keepOpen !== true) closeModal();
        if (a.onClick) a.onClick();
      };
      row.appendChild(b);
    }
    box.appendChild(row);
  }
  layer.appendChild(box);

  const onBackdrop = (e) => {
    if (e.target === layer && dismissable) closeModal();
  };
  layer.addEventListener('click', onBackdrop);
  modalCloser = () => layer.removeEventListener('click', onBackdrop);
  return box;
}

export function closeModal() {
  const layer = $('#modal-layer');
  layer.hidden = true;
  layer.innerHTML = '';
  if (modalCloser) { modalCloser(); modalCloser = null; }
}

export const modalOpen = () => !$('#modal-layer').hidden;

/* ------------------------------- utilities ------------------------------ */

export function fmtTime(ms) {
  if (ms <= 0) return 'READY';
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

export function tapFx(node) {
  node.addEventListener('pointerdown', () => { sfx('click'); haptic(6); }, { passive: true });
}

export function updateCurrencies() {
  const p = load();
  const t = $('#cur-trophies'); if (t) t.textContent = p.trophies;
  const g = $('#cur-gold'); if (g) g.textContent = p.gold;
  const m = $('#cur-gems'); if (m) m.textContent = p.gems;
  const sg = $('#shop-gems'); if (sg) sg.textContent = p.gems;
}

/** Keeps a canvas animating only while its screen is visible. */
export function animate(fn) {
  let raf = 0;
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fn(dt, now / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
