/* ==========================================================================
   map.js — the farm as a place you can look at.

   A scrollable world of absolutely-positioned pieces: fields you plant and
   harvest by tapping the soil, pens with the animals standing in them, and
   buildings you walk your finger over to open. ui.js owns the panels; this
   file owns the scene and calls back when something is tapped.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import { el, fmt, fmtTime, now, clamp, haptic } from './util.js';

/* ------------------------------- layout ---------------------------------- */

export const WORLD_W = 720;
export const WORLD_H = 1180;

const PLOT_W = 96, PLOT_H = 78, PLOT_GAP = 8;
const FIELD = { x: 48, y: 208, cols: 6 };

/** Pens sit under the fields, two rows of them. */
const PEN_SPOTS = {
  chicken: { x: 40,  y: 604, w: 200, h: 132 },
  duck:    { x: 260, y: 604, w: 190, h: 132 },
  cow:     { x: 470, y: 604, w: 210, h: 132 },
  pig:     { x: 40,  y: 754, w: 200, h: 132 },
  goat:    { x: 260, y: 754, w: 190, h: 132 },
  sheep:   { x: 470, y: 754, w: 210, h: 132 },
  bee:     { x: 470, y: 100, w: 190, h: 92 },
};

const BUILDINGS = [
  { id: 'silo',   name: 'Silo',      icon: '🛖', x: 46,  y: 60,  roof: '#8ec8f0' },
  { id: 'barn',   name: 'Barn',      icon: '🏠', x: 190, y: 60,  roof: '#e2685f' },
  { id: 'works',  name: 'Workshops', icon: '🏭', x: 46,  y: 924, roof: '#b79bd8' },
  { id: 'orders', name: 'Orders',    icon: '📋', x: 205, y: 924, roof: '#f09ac0' },
  { id: 'store',  name: 'Store',     icon: '🛒', x: 364, y: 924, roof: '#f2c14e' },
  { id: 'goals',  name: 'Goals',     icon: '🏆', x: 523, y: 924, roof: '#7fd6a5' },
];

/** Purely decorative scenery, so the land doesn't read as a spreadsheet. */
const DECOR = [
  { icon: '🌳', x: 655, y: 40,  s: 44 }, { icon: '🌳', x: 12,  y: 520, s: 40 },
  { icon: '🌳', x: 668, y: 520, s: 40 }, { icon: '🌲', x: 640, y: 880, s: 38 },
  { icon: '🌻', x: 300, y: 176, s: 22 }, { icon: '🌷', x: 26,  y: 180, s: 20 },
  { icon: '🪨', x: 660, y: 700, s: 26 }, { icon: '🐦', x: 350, y: 44,  s: 20 },
  { icon: '🦋', x: 120, y: 560, s: 20 }, { icon: '🌼', x: 690, y: 300, s: 20 },
];

export function plotPos(i) {
  const c = i % FIELD.cols, r = Math.floor(i / FIELD.cols);
  return { x: FIELD.x + c * (PLOT_W + PLOT_GAP), y: FIELD.y + r * (PLOT_H + PLOT_GAP) };
}

/* -------------------------------- build ---------------------------------- */

/**
 * @param T      register a per-second updater (from ui.js)
 * @param open   open(kind, arg) — 'sell-silo' | 'sell-barn' | tab ids | 'plot'
 */
export function farmMap({ T, open }) {
  const wrap = el('div', 'map-wrap');
  const canvas = el('div', 'map-canvas');
  const world = el('div', 'map');
  world.style.width = WORLD_W + 'px';
  world.style.height = WORLD_H + 'px';
  canvas.appendChild(world);
  wrap.appendChild(canvas);

  // Scale the farm down so its full width fits the phone, but never so far
  // that a field stops being a comfortable tap target.
  const fit = () => {
    const z = clamp((wrap.clientWidth || 390) / WORLD_W, 0.46, 1);
    world.style.transform = `scale(${z})`;
    canvas.style.width = Math.round(WORLD_W * z) + 'px';
    canvas.style.height = Math.round(WORLD_H * z) + 'px';
  };
  requestAnimationFrame(fit);
  addEventListener('resize', fit);
  T(fit);

  world.appendChild(el('div', 'map-pond'));
  world.appendChild(el('div', 'map-path'));

  for (const d of DECOR) {
    const n = el('div', 'map-decor', d.icon);
    n.style.cssText = `left:${d.x}px;top:${d.y}px;font-size:${d.s}px`;
    world.appendChild(n);
  }

  /* ------------------------------ buildings ------------------------------ */
  for (const b of BUILDINGS) {
    const node = el('button', 'mp-bldg');
    node.style.left = b.x + 'px';
    node.style.top = b.y + 'px';
    node.innerHTML =
      `<span class="roof" style="--roof:${b.roof}"></span>
       <span class="body"><span class="face">${b.icon}</span></span>
       <span class="sign">${b.name}</span>
       <span class="ping" hidden></span>`;
    node.onclick = () => { haptic(); open(b.id); };
    world.appendChild(node);

    const ping = node.querySelector('.ping');
    T(() => {
      const n = buildingAlert(b.id);
      ping.hidden = !n;
      ping.textContent = n > 99 ? '99+' : n;
    });
  }

  /* -------------------------------- fields ------------------------------- */
  const fieldsWrap = el('div', 'mp-fields');
  world.appendChild(fieldsWrap);
  const plotNodes = [];

  const layFields = () => {
    fieldsWrap.innerHTML = '';
    plotNodes.length = 0;
    for (let i = 0; i < D.MAX_PLOTS; i++) {
      const p = plotPos(i);
      const owned = i < St.S.plots.length;
      const node = el('button', 'mp-plot' + (owned ? '' : ' wild'));
      node.style.cssText = `left:${p.x}px;top:${p.y}px;width:${PLOT_W}px;height:${PLOT_H}px`;
      node.onclick = () => { haptic(); open(owned ? 'plot' : 'land', i); };
      fieldsWrap.appendChild(node);
      plotNodes.push(owned ? node : null);
      if (!owned) node.innerHTML = '<span class="wildtag">🌿</span>';
    }
  };
  layFields();

  T(() => {
    // A bought field can appear mid-session; rebuild the block when it does.
    if (plotNodes.filter(Boolean).length !== St.S.plots.length) layFields();

    for (let i = 0; i < plotNodes.length; i++) {
      const node = plotNodes[i];
      if (!node) continue;
      const plot = St.S.plots[i];
      const state = G.plotState(plot);
      node.className = 'mp-plot ' + state;
      if (state === 'empty') { node.innerHTML = '<span class="seedme">+</span>'; continue; }

      const crop = D.ITEMS[plot.crop];
      const total = Math.max(1, plot.end - plot.at);
      const pct = clamp((now() - plot.at) / total, 0, 1);
      if (node.dataset.crop !== plot.crop) {
        node.dataset.crop = plot.crop;
        node.innerHTML = `<span class="grow"><i></i></span>
                          <span class="sprout">${crop.icon}</span>
                          <span class="clock"></span>`;
      }
      // One bar across the top of every field: full means ready, and you can
      // read the whole farm's state without looking at a single number.
      node.querySelector('.grow > i').style.width = (pct * 100).toFixed(1) + '%';
      node.querySelector('.sprout').style.transform = `scale(${(0.5 + 0.5 * pct).toFixed(2)})`;
      node.querySelector('.clock').textContent =
        state === 'ready' ? 'READY' : fmtTime((plot.end - now()) / 1000);
    }
  });

  /* --------------------------------- pens -------------------------------- */
  for (const type of D.ANIMALS) {
    const spot = PEN_SPOTS[type.id];
    if (!spot) continue;
    const pen = el('div', 'mp-pen');
    pen.style.cssText = `left:${spot.x}px;top:${spot.y}px;width:${spot.w}px;height:${spot.h}px`;
    pen.innerHTML = `<span class="pen-sign">${type.icon} ${type.name2 || type.name + 's'}</span>
                     <div class="pen-yard"></div>`;
    world.appendChild(pen);
    const yard = pen.querySelector('.pen-yard');

    T(() => {
      const locked = type.level > St.S.level;
      pen.classList.toggle('locked', locked);
      if (locked) {
        if (yard.dataset.mode !== 'lock') {
          yard.dataset.mode = 'lock';
          yard.innerHTML = `<span class="pen-lock">🔒 Lv ${type.level}</span>`;
        }
        return;
      }

      const mine = St.animalsOf(type.id);
      const want = mine.length + (mine.length < type.max ? 1 : 0);
      if (yard.dataset.mode !== 'live' || yard.children.length !== want) {
        yard.dataset.mode = 'live';
        yard.innerHTML = '';
        mine.forEach((an, idx) => {
          const a = el('button', 'critter-m');
          a.style.animationDelay = (idx * 0.37).toFixed(2) + 's';
          a.onclick = () => { haptic(); open('animal', { type: type.id, idx }); };
          yard.appendChild(a);
        });
        if (mine.length < type.max) {
          const add = el('button', 'critter-m add', `<span>＋</span>`);
          add.onclick = () => { haptic(); open('buy-animal', type.id); };
          yard.appendChild(add);
        }
      }

      mine.forEach((an, idx) => {
        const a = yard.children[idx];
        if (!a) return;
        const st = G.animalState(an);
        a.className = 'critter-m ' + st;
        const cycle = Math.max(1, an.readyAt - an.fedAt);
        const pct = st === 'working' ? clamp((now() - an.fedAt) / cycle, 0, 1) : st === 'ready' ? 1 : 0;
        a.innerHTML =
          `<span class="beast">${type.icon}</span>` +
          `<span class="agrow"><i style="width:${(pct * 100).toFixed(1)}%"></i></span>` +
          (st === 'ready' ? `<span class="mark">${D.ITEMS[type.product].icon}</span>` : '') +
          (st === 'hungry' ? `<span class="mark waiting">🌾</span>` : '');
      });
    });
  }

  return wrap;
}

/** Red-dot count for a building: what's waiting for a tap inside it. */
function buildingAlert(id) {
  const S = St.S;
  if (id === 'works') {
    return Object.values(S.machines)
      .reduce((n, m) => n + (m.owned ? m.queue.filter(G.jobReady).length : 0), 0);
  }
  if (id === 'orders') return (S.orders || []).filter(o => o && o.oid && G.canDeliver(o)).length;
  if (id === 'goals') return G.goalsReady() + (G.dailyReady() ? 1 : 0);
  if (id === 'silo') return St.siloUsed() >= S.siloCap ? 1 : 0;
  if (id === 'barn') return St.barnUsed() >= S.barnCap ? 1 : 0;
  return 0;
}
